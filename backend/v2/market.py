"""Mandi prices with real, dated trends from AGMARKNET open data.

Two data.gov.in resources are combined:

* ``ogd`` – current daily prices from reporting mandis, and
* ``ogd_history`` – variety-wise daily prices with arrival dates.

Every accepted quote is stored, so a trend is only ever computed inside one
market/variety/grade series from dated observations. Nothing is interpolated;
when there is no comparable earlier quote the trend is reported as unknown.
"""

import asyncio
import hashlib
from collections import defaultdict
from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from db.models import MarketFetch, MarketPrice, utcnow
from security import client_ip

from .crops import BY_ID, BY_NAME
from .farm_context.models import india_today
from .farm_context.providers import number
from .farm_context.transport import ENDPOINTS, Unavailable
from .locations import normalized_name

router = APIRouter(prefix="/api/v2/market", tags=["Market prices"])

CURRENT = "9ef84268-d588-465a-a308-a864a43d0070"
HISTORY = "35985678-0d79-46b4-9ed6-6f13308a1d24"
FRESH = timedelta(hours=3)
WINDOW_DAYS = 30
FIELDS = {
    "state": ("state", "State"),
    "district": ("district", "District"),
    "market": ("market", "Market"),
    "commodity": ("commodity", "Commodity"),
    "variety": ("variety", "Variety"),
    "grade": ("grade", "Grade"),
    "arrival_date": ("arrival_date", "Arrival_Date"),
    "min_price": ("min_price", "Min_Price", "Min_x0020_Price"),
    "max_price": ("max_price", "Max_Price", "Max_x0020_Price"),
    "modal_price": ("modal_price", "Modal_Price", "Modal_x0020_Price"),
}


def field(row, name, default=None):
    for key in FIELDS[name]:
        value = row.get(key)
        if value not in (None, "", "NA"):
            return value
    if default is not None:
        return default
    raise KeyError(name)


def parse_date(value):
    for pattern in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(value).strip()[:10], pattern).date()
        except ValueError:
            continue
    raise ValueError("Unrecognized arrival date")


def normalize(payload, state, district, commodity, resource):
    """Accept only rows matching the requested scope inside the trend window."""
    rows = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or len(rows) > 2000:
        raise Unavailable()
    today = india_today()
    accepted = {}
    for row in rows:
        try:
            if (
                normalized_name(field(row, "state")) != normalized_name(state)
                or (district and normalized_name(field(row, "district")) != normalized_name(district))
                or normalized_name(field(row, "commodity")) != normalized_name(commodity)
            ):
                continue
            stamp = parse_date(field(row, "arrival_date"))
            if stamp > today or (today - stamp).days > WINDOW_DAYS:
                continue
            low = number(field(row, "min_price", "nan")) if field(row, "min_price", "") != "" else None
            high = number(field(row, "max_price", "nan")) if field(row, "max_price", "") != "" else None
            modal = number(field(row, "modal_price"))
            if modal <= 0 or modal > 10_000_000 or (low is not None and high is not None and low > high):
                continue
            record = {
                "arrival_date": stamp,
                "state": str(field(row, "state")).strip()[:150],
                "district": str(field(row, "district")).strip()[:150],
                "market": str(field(row, "market")).strip()[:150],
                "commodity": str(field(row, "commodity")).strip()[:100],
                "variety": str(field(row, "variety", "Unspecified")).strip()[:100] or "Unspecified",
                "grade": str(field(row, "grade", "Unspecified")).strip()[:50] or "Unspecified",
                "min_price": low,
                "max_price": high,
                "modal_price": modal,
                "source_resource": resource,
            }
        except (KeyError, ValueError, TypeError):
            continue
        key = tuple(
            normalized_name(record[x]) if isinstance(record[x], str) else record[x]
            for x in ("arrival_date", "market", "variety", "grade")
        )
        # Conflicting same-day duplicates are missing evidence, never averaged.
        if key in accepted and accepted[key] and accepted[key]["modal_price"] != record["modal_price"]:
            accepted[key] = None
        elif key not in accepted:
            accepted[key] = record
    return [x for x in accepted.values() if x]


async def fetch(gateway, key, state, district, commodity):
    """Read both resources independently; one failing source does not hide the other."""
    since = (india_today() - timedelta(days=WINDOW_DAYS)).strftime("%d/%m/%Y")

    async def current():
        params = {"api-key": key, "format": "json", "limit": 500, "filters[state]": state}
        params["filters[commodity]"] = commodity
        if district:
            params["filters[district]"] = district
        return normalize(await gateway.read("ogd", params), state, district, commodity, CURRENT)

    async def history():
        params = {
            "api-key": key,
            "format": "json",
            "limit": 1000,
            "filters[State]": state,
            "filters[Commodity]": commodity,
            "range[Arrival_Date][gte]": since,
            "sort[Arrival_Date]": "desc",
        }
        if district:
            params["filters[District]"] = district
        return normalize(await gateway.read("ogd_history", params), state, district, commodity, HISTORY)

    results = await asyncio.gather(current(), history(), return_exceptions=True)
    rows = [row for result in results if isinstance(result, list) for row in result]
    statuses = ["success" if isinstance(x, list) else "unavailable" for x in results]
    return rows, dict(zip(("current", "history"), statuses, strict=True))


def scope_key(state, district, commodity):
    text = "\0".join(normalized_name(x or "") for x in (state, district, commodity))
    return hashlib.sha256(text.encode()).hexdigest()


def store(factory, scope, rows, status):
    with factory.begin() as db:
        for row in rows:
            statement = insert(MarketPrice).values(id=uuid4(), created_at=utcnow(), updated_at=utcnow(), **row)
            db.execute(
                statement.on_conflict_do_update(
                    index_elements=["arrival_date", "state", "district", "market", "commodity", "variety", "grade"],
                    set_={
                        "min_price": statement.excluded.min_price,
                        "max_price": statement.excluded.max_price,
                        "modal_price": statement.excluded.modal_price,
                        "retrieved_at": utcnow(),
                        "updated_at": utcnow(),
                    },
                )
            )
        db.execute(
            insert(MarketFetch)
            .values(scope=scope, fetched_at=utcnow(), status=status)
            .on_conflict_do_update(index_elements=["scope"], set_={"fetched_at": utcnow(), "status": status})
        )


def last_fetch(factory, scope):
    with factory() as db:
        return db.get(MarketFetch, scope)


def stored(factory, state, district, commodity):
    since = india_today() - timedelta(days=WINDOW_DAYS)
    with factory() as db:
        query = select(MarketPrice).where(MarketPrice.arrival_date >= since)
        records = db.scalars(query.where(MarketPrice.commodity.ilike(commodity), MarketPrice.state.ilike(state))).all()
    wanted = normalized_name(district) if district else None
    return [x for x in records if wanted is None or normalized_name(x.district) == wanted]


def change(series, latest, days):
    """Compare with the nearest dated quote about ``days`` earlier in the same series."""
    target = latest[0] - timedelta(days=days)
    earlier = [x for x in series if abs((x[0] - target).days) <= max(2, days // 3) and x[0] < latest[0]]
    if not earlier:
        return None
    base = min(earlier, key=lambda x: (abs((x[0] - target).days), x[0]))
    percent = (latest[1] - base[1]) / base[1] * 100
    return {
        "from_date": base[0].isoformat(),
        "from_price": base[1],
        "percent": round(percent, 1),
        "direction": "up" if percent >= 3 else "down" if percent <= -3 else "steady",
    }


def summarize(records):
    groups = defaultdict(dict)
    for record in records:
        key = (record.market, record.district, record.state, record.variety, record.grade)
        groups[key][record.arrival_date] = float(record.modal_price), record
    markets = []
    for (market, district, state, variety, grade), points in groups.items():
        series = sorted((day, value[0]) for day, value in points.items())
        latest_day, (latest_price, latest_record) = max(points.items())
        markets.append(
            {
                "market": market,
                "district": district,
                "state": state,
                "variety": variety,
                "grade": grade,
                "latest": {
                    "date": latest_day.isoformat(),
                    "modal_price": latest_price,
                    "min_price": float(latest_record.min_price) if latest_record.min_price is not None else None,
                    "max_price": float(latest_record.max_price) if latest_record.max_price is not None else None,
                    "age_days": (india_today() - latest_day).days,
                },
                "change_7d": change(series, (latest_day, latest_price), 7),
                "change_30d": change(series, (latest_day, latest_price), 28),
                "series": [{"date": day.isoformat(), "modal_price": value} for day, value in series],
            }
        )
    markets.sort(key=lambda x: (-date.fromisoformat(x["latest"]["date"]).toordinal(), -x["latest"]["modal_price"]))
    return markets[:12]


@router.get("/prices")
async def prices(
    request: Request,
    crop: str = Query(min_length=1, max_length=100),
    state: str = Query(min_length=2, max_length=150),
    district: str | None = Query(default=None, max_length=150),
):
    settings = request.app.state.v2_settings
    if not settings.enabled:
        raise HTTPException(503, "Market prices are not available in this deployment")
    quotas = request.app.state.v2_quotas
    quotas.check("market_ip", client_ip(request), 30, 60)
    row = BY_ID.get(crop.strip().lower()) or BY_NAME.get(crop.strip())
    if row is None or not row.get("market_commodity"):
        raise HTTPException(422, "Choose a crop that is traded in mandis")
    commodity = row["market_commodity"]
    district = district.strip() if district and district.strip() else None
    service = request.app.state.v2_farm_context
    factory = request.app.state.v2_database
    key = service.settings.ogd_key.get_secret_value()
    providers = {"current": "not_configured", "history": "not_configured"}
    scope_level = "district" if district else "state"
    scope = scope_key(state, district, commodity)
    previous = await run_in_threadpool(last_fetch, factory, scope)
    fresh = previous is not None and previous.status == "success" and utcnow() - previous.fetched_at < FRESH
    if key and not fresh:
        quotas.check("market_provider", "global", 2000, 86400)
        rows, providers = await fetch(service.gateway, key, state, district, commodity)
        status = "success" if "success" in providers.values() else "unavailable"
        await run_in_threadpool(store, factory, scope, rows, status)
    elif fresh:
        providers = {"current": "cached", "history": "cached"}
    records = await run_in_threadpool(stored, factory, state, district, commodity)
    if not records and district:
        # Many districts have no reporting mandi on a given day: show the state.
        scope_level = "state"
        records = await run_in_threadpool(stored, factory, state, None, commodity)
        if not records and key:
            rows, _ = await fetch(service.gateway, key, state, None, commodity)
            await run_in_threadpool(store, factory, scope_key(state, None, commodity), rows, "success")
            records = await run_in_threadpool(stored, factory, state, None, commodity)
    markets = summarize(records)
    live = any(x in {"success", "cached"} for x in providers.values())
    status = "available" if markets and live else "stale" if markets else "unavailable"
    if not key and not markets:
        status = "not_configured"
    return {
        "status": status,
        "commodity": commodity,
        "state": state,
        "district": district,
        "scope": scope_level,
        "unit": "INR/quintal",
        "markets": markets,
        "providers": providers,
        "retrieved_at": (previous.fetched_at.isoformat() if fresh and previous else utcnow().isoformat()),
        "sources": [
            {"name": "AGMARKNET current daily prices (data.gov.in)", "url": ENDPOINTS["ogd"]},
            {"name": "AGMARKNET variety-wise daily prices (data.gov.in)", "url": ENDPOINTS["ogd_history"]},
        ],
        "limitations": [
            "Reported wholesale mandi prices; your actual offer depends on quality, quantity and buyer.",
            "A trend compares quotes from the same market, variety and grade only.",
        ],
    }
