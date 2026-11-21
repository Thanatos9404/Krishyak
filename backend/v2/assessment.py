"""Field assessment: expected harvest, inputs, money, risks, a better-crop check
and the government schemes worth checking, from the farmer's own records.

Runs the existing planning engine (yield, cost, price and risk heuristics with
Monte Carlo ranges). Every figure is an estimate from stated assumptions; the
response lists them and says what would make the estimate better.
"""

import asyncio
import hashlib
import json
import logging
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from db.models import CropCycle, MarketPrice, utcnow
from repositories.ownership import owned_plot
from security import client_ip

from .agronomy import CROP_PLANS, SEASON_RAIN_MM, fertilizer_products, typical_soil
from .climate import normals, outlook, plot_point
from .crop_calendar import calendar_for
from .crops import BY_ID
from .farm_context.models import india_today
from .farm_context.transport import Unavailable
from .radar import has_consent
from .router import current_farmer, database, require_consent
from .yields import district_yield, model_card

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2", tags=["Field assessment"])
SEED_QUALITY = {"certified": 0.8, "hybrid": 0.85, "own_saved": 0.6}
PEST_LIKELIHOOD = {"high": 0.35, "medium": 0.25, "low": 0.15}
INSURED_SEASONS = {"rabi": 1.5, "kharif": 2.0}


def config():
    import config as legacy

    return legacy


def engine(request):
    existing = getattr(request.app.state, "planning_engine", None)
    if existing is None:
        from simulation_engine import SimulationEngine

        existing = request.app.state.planning_engine = SimulationEngine()
    return existing


def planning_name(crop_id):
    row = BY_ID.get(crop_id)
    names = [name for name in (row or {}).get("planning_names", []) if name in config().CROPS]
    return names[0] if names else None


def price_for(db, crop_id, state, district):
    """Latest stored mandi modal price, else the government MSP, else nothing."""
    row = BY_ID.get(crop_id) or {}
    commodity = row.get("market_commodity")
    if commodity and state:
        quotes = db.scalars(
            select(MarketPrice)
            .where(
                MarketPrice.commodity.ilike(commodity),
                MarketPrice.state.ilike(state),
                MarketPrice.arrival_date >= utcnow().date() - timedelta(days=30),
            )
            .order_by(MarketPrice.arrival_date.desc())
            .limit(30)
        ).all()
        local = [x for x in quotes if district and x.district.lower() == district.lower()]
        best = (local or quotes or [None])[0]
        if best is not None:
            return {
                "per_quintal": float(best.modal_price),
                "source": "mandi",
                "market": best.market,
                "date": best.arrival_date.isoformat(),
            }
    # The dated, source-linked support prices the MSP page serves (not a copy in code).
    from gov_api_service import MSP_DATA

    names = [name for name in row.get("planning_names", []) if name in MSP_DATA["crops"]]
    if names:
        entry = MSP_DATA["crops"][names[0]]
        return {
            "per_quintal": float(entry["msp"]),
            "source": "msp",
            "market": None,
            "date": entry["year"],
            "source_url": entry.get("source_url"),
        }
    return None


def season_rain(season, climate):
    """Normal rain for the season at this place, else a labelled regional assumption."""
    if climate:
        if season == "annual":
            return climate["annual_rain_mm"], "ten_year_normal"
        # Rabi crops also draw on moisture the monsoon left in the soil.
        carry = min(120, climate["season_rain_mm"]["kharif"] * 0.15) if season == "rabi" else 0
        return round(climate["season_rain_mm"][season] + carry), "ten_year_normal"
    return SEASON_RAIN_MM[season], "regional_assumption"


def plan_inputs(crop_id, area, soil_type, soil, water, price, pest_level, rain_mm=None):
    season, days, seed_rate, *_ = CROP_PLANS[crop_id]
    months = round(days / 30, 1)
    rain = (SEASON_RAIN_MM[season] if rain_mm is None else rain_mm) * (0.7 if soil.get("condition") == "dry" else 1)
    # Irrigations a season (about 60 mm each): winter crops depend on them,
    # monsoon crops need a few to bridge dry spells.
    waterings = {"irrigated": 6 if season == "rabi" else 3, "rainfed": 0}.get(water, 3)
    return {
        "crop": planning_name(crop_id),
        "soil_type": soil_type,
        "area_hectares": area,
        "seed_quality": SEED_QUALITY.get(soil.get("seed"), 0.75),
        # The yield model reads this as all water reaching the crop.
        "expected_rainfall": round(rain + waterings * 60),
        "rainfall_delay": 0,
        "irrigation_frequency": round(waterings / months, 2),
        "fertilizer_mix": fertilizer_products(crop_id),
        "pest_probability": PEST_LIKELIHOOD.get(pest_level, 0.2),
        "labour_days": max(10, round(area * 30)),
        "pest_control_intensity": 0.5,
        "sale_month": 1,
        # Without any price the engine still needs a number to run; the report then
        # withholds every money figure instead of presenting a made-up profit.
        "current_market_price": price["per_quintal"] if price else 1,
        "seed_quantity_kg": round(seed_rate * area, 1),
        "season_months": months,
    }


def yield_modifier(simulator, params):
    """The combined farm-practice factor the engine applies to a plan (1.0 is its neutral case)."""
    result = simulator.yield_estimator.estimate_yield(
        params["crop"],
        params["soil_type"],
        params["seed_quality"],
        params["expected_rainfall"],
        params["rainfall_delay"],
        params["irrigation_frequency"],
        params["fertilizer_mix"],
        params["pest_probability"],
        1.0,
        baseline_record={"value": 1.0},
    )
    return result["modifiers"]["total"]


def local_baseline(simulator, crop_id, season, state, district, params, reference):
    """Anchor the estimate on the district forecast; farm practice moves it by at most 30 %.

    The district figure already reflects typical local soil, rain and
    management, so the plan is compared with a typical plan for the same place
    instead of being multiplied on top of it.
    """
    record = district_yield(crop_id, season, state, district)
    if record is None:
        return None, None
    typical, mine = yield_modifier(simulator, reference), yield_modifier(simulator, params)
    ratio = min(1.3, max(0.7, mine / typical)) if typical > 0 and mine > 0 else 1.0
    baseline = {
        "value": record["kg_per_hectare"] * ratio / mine if mine > 0 else record["kg_per_hectare"],
        "source": f"{record['level']} yield forecast ({record['model_id']})",
        "record_year": record["last_record_year"],
        "units": "kg/ha",
        "region": record["level"],
        "product_basis": "lint" if params["crop"] == "Cotton" else "crop_product",
    }
    return baseline, {**record, "farm_adjustment_percent": round((ratio - 1) * 100)}


def improved_plan(params):
    """Practical changes with a modelled effect: certified seed and weekly pest checks."""
    plan, changes = dict(params), []
    if params["seed_quality"] < SEED_QUALITY["certified"]:
        plan["seed_quality"] = SEED_QUALITY["certified"]
        changes.append({"kind": "seed"})
    plan["pest_control_intensity"] = 0.8
    plan["pest_probability"] = round(max(0.05, params["pest_probability"] - 0.1), 2)
    changes.append({"kind": "pest_watch"})
    return plan, changes


def suitability(crop, soil_type):
    return config().CROP_SOIL_COMPATIBILITY.get(crop, {}).get(soil_type, 0.7)


def summarize(plan, area):
    return {
        "yield_kg_per_hectare": round(plan["yield"]["yield_per_hectare"]),
        "total_quintals": round(plan["yield"]["total_production_quintals"], 1),
        "cost": round(plan["costs"]["total_cost"]),
        "revenue": round(plan["revenue"]),
        "profit": round(plan["profit"]),
        "profit_per_hectare": round(plan["profit"] / area),
        "risk": round(plan["risk"]["overall_risk_score"]),
    }


def schemes(crop_id, season, soil, water, price):
    items = [{"id": "pm-kisan"}]
    if season in INSURED_SEASONS:
        items.append({"id": "pmfby", "premium_percent": INSURED_SEASONS[season]})
    if soil.get("source") != "soil_test":
        items.append({"id": "soil-health-card"})
    items.append({"id": "kcc"})
    if water != "irrigated" or soil.get("condition") == "dry" or soil.get("soil_type") in {"Sandy", "Desert"}:
        items += [{"id": "pmksy"}, {"id": "pm-kusum"}]
    if price and price["source"] == "mandi" or (BY_ID.get(crop_id) or {}).get("market_commodity"):
        items.append({"id": "enam"})
    return items


REPORT_HOURS = 12


async def stored_report(request, key):
    """A report computed earlier today from exactly the same field records, if any."""
    redis = request.app.state.v2_quotas.redis
    if redis is None:
        return None
    try:
        raw = await asyncio.to_thread(redis.get, key)
        return json.loads(raw) if raw else None
    except Exception as error:  # noqa: BLE001 - the report is recomputed instead
        LOGGER.warning("Assessment cache read failed type=%s", type(error).__name__)
        return None


async def store_report(request, key, report):
    redis = request.app.state.v2_quotas.redis
    if redis is None:
        return
    try:
        await asyncio.to_thread(redis.set, key, json.dumps(report), ex=REPORT_HOURS * 3600)
    except Exception as error:  # noqa: BLE001
        LOGGER.warning("Assessment cache write failed type=%s", type(error).__name__)


async def build_report(request, db, *, crop_id, area, soil, soil_type, water, state, district, point, identity, quota):
    """The field report from plain values: district forecast, local rainfall, prices, risks, schemes."""
    season = CROP_PLANS[crop_id][0]
    from pest_intelligence import PestAnalyzer

    pests = PestAnalyzer().get_seasonal_risk(planning_name(crop_id))
    candidates = [
        other for other, plan in CROP_PLANS.items() if plan[0] == season and other != crop_id and planning_name(other)
    ]

    def prices():
        # Off the event loop: the first query may wait for a pooled connection.
        found = [(other, price_for(db, other, state, district)) for other in candidates]
        return price_for(db, crop_id, state, district), [(other, quote) for other, quote in found if quote]

    price, alternative_inputs = await run_in_threadpool(prices)
    # The same field records give the same report for the rest of the day, so
    # Home can show it on every visit without recomputing or using up the limit.
    fingerprint = json.dumps(
        [
            identity,
            crop_id,
            area,
            soil,
            water,
            state,
            district,
            price,
            [x[1] for x in alternative_inputs],
            point is not None,
            india_today().isoformat(),
            (model_card() or {}).get("model_id"),
        ],
        sort_keys=True,
        default=str,
    )
    cache_key = "krishyak:assessment:v2:" + hashlib.sha256(fingerprint.encode()).hexdigest()
    db.commit()
    cached = await stored_report(request, cache_key)
    if cached:
        return cached
    request.app.state.v2_quotas.check(*quota)
    normal = None
    if point is not None:
        try:
            normal = await normals(request.app.state.v2_farm_context.gateway, *point)
        except (Unavailable, KeyError, TypeError, ValueError):
            normal = None
    rain_mm, rain_source = season_rain(season, normal)
    params = plan_inputs(crop_id, area, soil_type, soil, water, price, pests.get("risk_level"), rain_mm)
    reference = plan_inputs(
        crop_id, area, typical_soil(state, district) or soil_type, {}, None, price, "medium", rain_mm
    )
    alternative_inputs = [
        (other, alt_price, plan_inputs(other, area, soil_type, soil, water, alt_price, None, rain_mm))
        for other, alt_price in alternative_inputs
    ]
    slots = request.app.state.v2_planning_slots
    if slots.locked():
        raise HTTPException(429, "Many farmers are checking right now. Please retry in a minute.")
    simulator = engine(request)

    better_inputs, changes = improved_plan(params)
    baseline, local = local_baseline(simulator, crop_id, season, state, district, params, reference)

    def scenario(inputs, kind, record):
        context = simulator._prepare_context(inputs["crop"])
        if record is not None:
            context["baseline"] = record
        return simulator._simulate_scenario(inputs, kind, context=context)

    def run():
        result = simulator.run_whatif_simulation(params, 300, baseline_record=baseline)
        result["ai_optimal_plan"] = scenario(better_inputs, "optimal", baseline)
        others = []
        for other, alt_price, inputs in alternative_inputs:
            other_baseline, other_local = local_baseline(simulator, other, season, state, district, inputs, inputs)
            # Only compare with crops this district is recorded as growing.
            if local and local["level"] == "district" and (other_local or {}).get("level") != "district":
                continue
            others.append((other, alt_price, scenario(inputs, "alternative", other_baseline)))
        return result, others

    async with slots:
        result, others = await asyncio.wait_for(asyncio.to_thread(run), 20)
    current, optimal = result["current_plan"], result["ai_optimal_plan"]
    crop = params["crop"]
    fit = suitability(crop, soil_type)
    score = round(max(0, min(100, 0.6 * (100 - current["risk"]["overall_risk_score"]) + 40 * fit)))
    mine = summarize(current, area)
    priced = price is not None
    if not priced:
        mine.update(revenue=None, profit=None, profit_per_hectare=None)
    alternatives = sorted(
        (
            {
                "crop_id": crop_id,
                "price": alt_price,
                "soil_suitability": round(suitability(plan["parameters_used"]["crop"], soil_type) * 100),
                **summarize(plan, area),
            }
            for crop_id, alt_price, plan in others
        ),
        key=lambda row: -row["profit"],
    )[:3]
    better = next(
        (
            row
            for row in alternatives
            if price
            and row["profit"] > mine["profit"] + max(5000 * area, abs(mine["profit"]) * 0.15)
            and row["risk"] <= mine["risk"] + 5
        ),
        None,
    )
    stats = result["micro_simulations_summary"]
    if soil.get("source") != "soil_test":
        changes.append({"kind": "soil_test"})
    report = {
        "crop_id": crop_id,
        "season": season,
        "area_hectares": round(area, 3),
        "soil": {**soil, "suitability_percent": round(fit * 100)},
        "water": water,
        "field_score": score,
        "score_band": "good" if score >= 70 else "fair" if score >= 50 else "needs_care",
        "harvest": {
            **mine,
            "range_kg_per_hectare": [round(stats["yield_stats"]["min"]), round(stats["yield_stats"]["max"])],
            "profit_range": [
                round(stats["profit_stats"]["percentile_25"]),
                round(stats["profit_stats"]["percentile_75"]),
            ]
            if priced
            else None,
            "chance_of_profit_percent": round(stats["probability_of_profit"]) if priced else None,
            "basis": local,
        },
        "price": price,
        "inputs": {
            "seed_kg": params["seed_quantity_kg"],
            "fertilizer_kg": {name: round(kg * area, 1) for name, kg in params["fertilizer_mix"].items()},
            "nutrients_kg_per_hectare": dict(zip(("N", "P2O5", "K2O"), CROP_PLANS[crop_id][3:], strict=True)),
            "waterings": round(params["irrigation_frequency"] * params["season_months"]),
            "days_to_harvest": CROP_PLANS[crop_id][1],
        },
        "risk": {
            "overall": round(current["risk"]["overall_risk_score"]),
            "weather": round(current["risk"]["components"]["weather_risk"]),
            "price": round(current["risk"]["components"]["price_volatility_risk"]),
            "pest": round(current["risk"]["components"]["pest_attack_risk"]),
            "soil": round(current["risk"]["components"]["soil_mismatch_risk"]),
        },
        "pests": {
            "level": pests.get("risk_level"),
            "active": [{"name": x["name"], "symptoms": x["symptoms"]} for x in pests.get("active_pests", [])][:3],
        },
        "ai_plan": {
            "changes": changes,
            "profit": round(optimal["profit"]) if priced else None,
            "extra_profit": max(0, round(optimal["profit"] - current["profit"])) if priced else None,
        },
        "better_crop": better,
        "alternatives": alternatives,
        "schemes": schemes(crop_id, season, soil, water, price),
        "assumptions": {
            "water_mm": params["expected_rainfall"],
            "season_rain_mm": rain_mm,
            "season_rain_source": rain_source,
            "seed_quality": params["seed_quality"],
            "pest_likelihood": params["pest_probability"],
            "method": "district_yield_model_with_farm_adjustments"
            if local
            else "heuristic_estimate_not_validated_prediction",
        },
        "generated_at": utcnow().isoformat(),
    }
    await store_report(request, cache_key, report)
    return report


@router.get("/plots/{plot_id}/assessment")
@router.post("/plots/{plot_id}/assessment")
async def assess(
    plot_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    plot = owned_plot(db, farmer.id, plot_id)
    require_consent(db, farmer, "agronomic_analysis")
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot.id, CropCycle.status.in_(["active", "planned"]))
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    if cycle is None or cycle.crop_id not in CROP_PLANS or planning_name(cycle.crop_id) is None:
        raise HTTPException(422, "Add a field crop that Krishyak can assess, such as wheat, rice or mustard")
    area = float(plot.area_hectares if plot.area_hectares is not None else plot.entered_area_hectares or 0)
    if area <= 0:
        raise HTTPException(422, "Add your field's area first")
    soil = dict(plot.soil_metadata or {})
    soil_type = soil.get("soil_type") or typical_soil(farmer.state, farmer.district)
    if not soil_type:
        raise HTTPException(422, "Tell Krishyak your soil type or your state first")
    if not soil.get("soil_type"):
        soil.update(soil_type=soil_type, source="state_typical")
    water = {"irrigated": "irrigated", "rainfed": "rainfed"}.get((plot.irrigation_type or "").lower())
    point = plot_point(plot) if has_consent(db, farmer.id, "location_processing") else None
    return await build_report(
        request,
        db,
        crop_id=cycle.crop_id,
        area=area,
        soil=soil,
        soil_type=soil_type,
        water=water,
        state=farmer.state,
        district=farmer.district,
        point=point,
        identity=[
            str(plot.id),
            plot.revision,
            plot.updated_at.isoformat(),
            str(cycle.id),
            cycle.revision,
            cycle.sowing_date.isoformat(),
        ],
        quota=("assessment", str(farmer.id), 20, 3600),
    )


# One fixed example so visitors can see the dashboard before making an account.
# The inputs are an example; every output is computed live from the same
# district records, rainfall archive, forecast and prices a real field gets.
EXAMPLE_FIELD = {
    "crop_id": "wheat",
    "area_hectares": 1.0,
    "soil_type": "Loamy",
    "water": "irrigated",
    "village": "Chomu",
    "district": "Jaipur",
    "state": "Rajasthan",
    "latitude": 27.17,
    "longitude": 75.72,
    "sown_days_ago": 25,
}


@router.get("/example/field")
async def example_field(request: Request, db=Depends(database, scope="function")):
    settings = request.app.state.v2_settings
    if not settings.enabled:
        raise HTTPException(503, "The example field is not available in this deployment")
    request.app.state.v2_quotas.check("example_ip", client_ip(request), 30, 60)
    field = EXAMPLE_FIELD
    point = (field["latitude"], field["longitude"])
    report = await build_report(
        request,
        db,
        crop_id=field["crop_id"],
        area=field["area_hectares"],
        soil={"soil_type": field["soil_type"], "source": "farmer_selected"},
        soil_type=field["soil_type"],
        water=field["water"],
        state=field["state"],
        district=field["district"],
        point=point,
        identity=["example-field-v1"],
        quota=("example_report", "all", 600, 3600),
    )
    sown = india_today() - timedelta(days=field["sown_days_ago"])
    return {
        "example": {**field, "sowing_date": sown.isoformat()},
        "report": report,
        "outlook": await outlook(request.app.state.v2_farm_context.gateway, *point),
        "calendar": {"status": "available"} | calendar_for(field["crop_id"], sown),
        "notice": "An example field. The weather, rain record, prices and district forecast are real and current; the field itself is not a real farm.",
    }
