"""Field assessment: expected harvest, inputs, money, risks, a better-crop check
and the government schemes worth checking, from the farmer's own records.

Runs the existing planning engine (yield, cost, price and risk heuristics with
Monte Carlo ranges). Every figure is an estimate from stated assumptions; the
response lists them and says what would make the estimate better.
"""

import asyncio
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from db.models import CropCycle, MarketPrice, utcnow
from repositories.ownership import owned_plot

from .agronomy import CROP_PLANS, SEASON_RAIN_MM, fertilizer_products, typical_soil
from .crops import BY_ID
from .router import current_farmer, database, require_consent

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
    msp = config().MSP_RATES_2025.get(planning_name(crop_id) or "")
    if msp:
        return {"per_quintal": float(msp), "source": "msp", "market": None, "date": "2025-26"}
    return None


def plan_inputs(crop_id, area, soil_type, soil, water, price, pest_level):
    season, days, seed_rate, *_ = CROP_PLANS[crop_id]
    months = round(days / 30, 1)
    rain = SEASON_RAIN_MM[season] * (0.7 if soil.get("condition") == "dry" else 1)
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
        "current_market_price": price["per_quintal"] if price else 2000,
        "seed_quantity_kg": round(seed_rate * area, 1),
        "season_months": months,
    }


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


@router.post("/plots/{plot_id}/assessment")
async def assess(
    plot_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    plot = owned_plot(db, farmer.id, plot_id)
    require_consent(db, farmer, "agronomic_analysis")
    request.app.state.v2_quotas.check("assessment", str(farmer.id), 20, 3600)
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
    season = CROP_PLANS[cycle.crop_id][0]
    from pest_intelligence import PestAnalyzer

    pests = PestAnalyzer().get_seasonal_risk(planning_name(cycle.crop_id))
    price = price_for(db, cycle.crop_id, farmer.state, farmer.district)
    params = plan_inputs(cycle.crop_id, area, soil_type, soil, water, price, pests.get("risk_level"))
    candidates = [
        crop_id
        for crop_id, plan in CROP_PLANS.items()
        if plan[0] == season and crop_id != cycle.crop_id and planning_name(crop_id)
    ]
    alternative_inputs = []
    for crop_id in candidates:
        alt_price = price_for(db, crop_id, farmer.state, farmer.district)
        if alt_price:
            alternative_inputs.append(
                (crop_id, alt_price, plan_inputs(crop_id, area, soil_type, soil, water, alt_price, None))
            )
    db.commit()
    slots = request.app.state.v2_planning_slots
    if slots.locked():
        raise HTTPException(429, "Many farmers are checking right now. Please retry in a minute.")
    simulator = engine(request)

    better_inputs, changes = improved_plan(params)

    def run():
        result = simulator.run_whatif_simulation(params, 300)
        result["ai_optimal_plan"] = simulator._simulate_scenario(better_inputs, "optimal")
        others = [
            (crop_id, alt_price, simulator._simulate_scenario(inputs, "alternative"))
            for crop_id, alt_price, inputs in alternative_inputs
        ]
        return result, others

    async with slots:
        result, others = await asyncio.wait_for(asyncio.to_thread(run), 20)
    current, optimal = result["current_plan"], result["ai_optimal_plan"]
    crop = params["crop"]
    fit = suitability(crop, soil_type)
    score = round(max(0, min(100, 0.6 * (100 - current["risk"]["overall_risk_score"]) + 40 * fit)))
    mine = summarize(current, area)
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
    return {
        "crop_id": cycle.crop_id,
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
            ],
            "chance_of_profit_percent": round(stats["probability_of_profit"]),
        },
        "price": price,
        "inputs": {
            "seed_kg": params["seed_quantity_kg"],
            "fertilizer_kg": {name: round(kg * area, 1) for name, kg in params["fertilizer_mix"].items()},
            "nutrients_kg_per_hectare": dict(zip(("N", "P2O5", "K2O"), CROP_PLANS[cycle.crop_id][3:], strict=True)),
            "waterings": round(params["irrigation_frequency"] * params["season_months"]),
            "days_to_harvest": CROP_PLANS[cycle.crop_id][1],
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
            "profit": round(optimal["profit"]),
            "extra_profit": max(0, round(optimal["profit"] - current["profit"])),
        },
        "better_crop": better,
        "alternatives": alternatives,
        "schemes": schemes(cycle.crop_id, season, soil, water, price),
        "assumptions": {
            "water_mm": params["expected_rainfall"],
            "seed_quality": params["seed_quality"],
            "pest_likelihood": params["pest_probability"],
            "method": "heuristic_estimate_not_validated_prediction",
        },
        "generated_at": utcnow().isoformat(),
    }
