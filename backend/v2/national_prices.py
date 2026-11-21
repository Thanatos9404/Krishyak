"""All-India daily average wholesale prices from the Agmarknet 2.0 public dashboard.

The Ministry of Agriculture's Agmarknet portal publishes, without a login, the
national average price and arrivals of the support-price crops and of tomato,
onion and potato for its three most recent reporting days. Krishyak reads that
one table a few times a day and stores each dated figure.

It is a national average, not a mandi quote: it is shown only when the
farmer's own mandis have nothing as recent, and always labelled as all-India.
Market-level reports on the same portal require a CAPTCHA or a login and are
not read.
"""

import logging
from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from db.models import MarketFetch, MarketPrice, utcnow

from .farm_context.models import india_today
from .farm_context.providers import number
from .farm_context.transport import Unavailable

logger = logging.getLogger("krishyak.v2.market")

PROVIDER = "agmarknet_national"
RESOURCE = "agmarknet-2.0-national-average"
SCOPE = "national-averages"
STATE, DISTRICT, MARKET, VARIETY, GRADE = "India", "All India", "All-India average", "All varieties", "All grades"
FRESH = timedelta(hours=3)
MAX_AGE_DAYS = 7
SOURCE = {
    "name": "Agmarknet 2.0 daily price and arrival report (all-India average)",
    "url": "https://agmarknet.gov.in/",
}
# Agmarknet's commodity names for the crops Krishyak covers.
COMMODITIES = {
    "wheat": "Wheat",
    "rice": "Paddy(Common)",
    "maize": "Maize",
    "bajra": "Bajra(Pearl Millet/Cumbu)",
    "jowar": "Jowar(Sorghum)",
    "ragi": "Ragi(Finger Millet)",
    "barley": "Barley(Jau)",
    "cotton": "Cotton",
    "groundnut": "Groundnut",
    "mustard": "Mustard",
    "sesame": "Sesamum(Sesame,Gingelly,Til)",
    "soybean": "Soyabean",
    "sunflower": "Sunflower/Sunflower Seed",
    "chickpea": "Bengal Gram(Gram)(Whole)",
    "urad": "Black Gram(Urd Beans)(Whole)",
    "moong": "Green Gram(Moong)(Whole)",
    "lentil": "Lentil(Masur)(Whole)",
    "pigeon_pea": "Red gram/Arhar/Tur(whole)",
    "onion": "Onion",
    "potato": "Potato",
    "tomato": "Tomato",
}
KNOWN = set(COMMODITIES.values())
# What the price is of, where that differs from the crop's everyday name.
DESCRIBES = {"rice": "Paddy (common)", "cotton": "Raw cotton (kapas)"}


def parse(payload, today):
    """Dated all-India rows from the dashboard table; anything odd is dropped, never repaired."""
    records = ((payload or {}).get("data") or {}).get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list) or not 1 <= len(records) <= 200:
        raise Unavailable()
    rows = []
    for record in records:
        try:
            name = str(record["cmdt_name"]).strip()
            if name not in KNOWN:
                continue
            reported = datetime.strptime(str(record["reported_date"]).strip(), "%d-%m-%Y").date()
            if reported > today or (today - reported).days > MAX_AGE_DAYS:
                continue
            for offset, key in enumerate(("as_on_price", "one_day_ago_price", "two_day_ago_price")):
                value = record.get(key)
                if value in (None, "", "NA", "-"):
                    continue
                price = number(value)
                if not 1 <= price <= 10_000_000:
                    continue
                rows.append(
                    {
                        "arrival_date": reported - timedelta(days=offset),
                        "state": STATE,
                        "district": DISTRICT,
                        "market": MARKET,
                        "commodity": name,
                        "variety": VARIETY,
                        "grade": GRADE,
                        "min_price": None,
                        "max_price": None,
                        "modal_price": price,
                        "source_resource": RESOURCE,
                    }
                )
        except (KeyError, ValueError, TypeError):
            continue
    if not rows:
        raise Unavailable()
    return rows


def store(factory, rows, status):
    with factory.begin() as db:
        for row in rows:
            statement = insert(MarketPrice).values(id=uuid4(), created_at=utcnow(), updated_at=utcnow(), **row)
            db.execute(
                statement.on_conflict_do_update(
                    index_elements=["arrival_date", "state", "district", "market", "commodity", "variety", "grade"],
                    set_={
                        "modal_price": statement.excluded.modal_price,
                        "retrieved_at": utcnow(),
                        "updated_at": utcnow(),
                    },
                )
            )
        db.execute(
            insert(MarketFetch)
            .values(scope=SCOPE, fetched_at=utcnow(), status=status)
            .on_conflict_do_update(index_elements=["scope"], set_={"fetched_at": utcnow(), "status": status})
        )


def due(factory):
    with factory() as db:
        last = db.get(MarketFetch, SCOPE)
    # A failed attempt is not repeated for half an hour, so an outage costs one call, not one per farmer.
    wait = FRESH if last is not None and last.status == "success" else timedelta(minutes=30)
    return last is None or utcnow() - last.fetched_at >= wait


async def refresh(gateway, factory, quotas=None, *, force=False):
    """Read the dashboard table if the stored copy is old. Returns what happened, never raises."""
    if not force and not await run_in_threadpool(due, factory):
        return "cached"
    try:
        if quotas is not None:
            quotas.check("agmarknet_national", "global", 48, 86400)
        payload = await gateway.read(
            PROVIDER, {"dashboard": "marketwise_price_arrival", "date": india_today().isoformat()}, deadline=8
        )
        rows = parse(payload, india_today())
    except Exception as error:  # noqa: BLE001 - a missing national figure must never break a price page
        logger.warning("National average prices unavailable type=%s", type(error).__name__)
        await run_in_threadpool(store, factory, [], "unavailable")
        return "unavailable"
    await run_in_threadpool(store, factory, rows, "success")
    return "success"


def latest(db, crop_id, today=None):
    """The most recent stored all-India average for a crop, with the day before it for a direction."""
    name = COMMODITIES.get(crop_id)
    if name is None:
        return None
    today = today or india_today()
    rows = db.scalars(
        select(MarketPrice)
        .where(
            MarketPrice.state == STATE,
            MarketPrice.commodity == name,
            MarketPrice.source_resource == RESOURCE,
            MarketPrice.arrival_date >= today - timedelta(days=MAX_AGE_DAYS),
        )
        .order_by(MarketPrice.arrival_date.desc())
        .limit(7)
    ).all()
    if not rows:
        return None
    newest, price = rows[0], float(rows[0].modal_price)
    result = {
        "per_quintal": price,
        "date": newest.arrival_date.isoformat(),
        "age_days": (today - newest.arrival_date).days,
        "commodity": name,
        "describes": DESCRIBES.get(crop_id),
        "series": [
            {"date": row.arrival_date.isoformat(), "modal_price": float(row.modal_price)} for row in reversed(rows)
        ],
        "change": None,
        "source": SOURCE,
    }
    if len(rows) > 1 and float(rows[1].modal_price) > 0:
        earlier = float(rows[1].modal_price)
        percent = (price - earlier) / earlier * 100
        result["change"] = {
            "from_date": rows[1].arrival_date.isoformat(),
            "from_price": earlier,
            "percent": round(percent, 1),
            "direction": "up" if percent >= 1 else "down" if percent <= -1 else "steady",
        }
    return result


def read_latest(factory, crop_id):
    with factory() as db:
        return latest(db, crop_id)


def lead(markets, national):
    """Which figure to show first: a local quote only when it is at least as recent as the national one."""
    if not markets:
        return "national" if national else "none"
    if national is None:
        return "local"
    best = date.fromisoformat(markets[0]["latest"]["date"])
    return "local" if best >= date.fromisoformat(national["date"]) else "national"
