"""Consent-gated POST context. Coordinates never enter URLs or stored records."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field, ValidationError

from ..auth import authenticate
from ..router import current_farmer, database, require_consent
from ..schemas import Input
from .models import ContextInput, FarmContext

router = APIRouter(prefix="/api/v2/farm-context", tags=["Automatic farm context"])


class PlanningInput(Input):
    context: ContextInput
    farming_input: dict = Field(max_length=30)
    market_quote_index: int | None = Field(default=None, ge=0, le=99)
    expected_quote_id: str | None = Field(default=None, pattern="^[a-f0-9]{64}$")
    num_simulations: int = Field(default=300, ge=100, le=500)


@router.post("", response_model=FarmContext)
async def context(
    body: ContextInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    require_consent(db, farmer, "government_integration")
    if body.latitude is not None:
        require_consent(db, farmer, "location_processing")
    request.app.state.v2_quotas.check("farm_context", str(farmer.id), 12, 3600)
    db.commit()
    try:
        result = await request.app.state.v2_farm_context.build(body)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    # Withdrawal/logout during slow requests prevents the result being returned.
    farmer, _ = authenticate(db, request)
    require_consent(db, farmer, "government_integration")
    if body.latitude is not None:
        require_consent(db, farmer, "location_processing")
    return result


@router.get("/health")
def health(request: Request, farmer=Depends(current_farmer)):
    result = request.app.state.v2_farm_context.health()
    if request.app.state.v2_government_auth.available():
        result["restricted"]["meri_pehchaan"] = {
            "status": "configured",
            "reason": "Partner-approved login configured; connection is checked only during an explicit login",
        }
    return result


@router.post("/planning")
async def planning(
    body: PlanningInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    require_consent(db, farmer, "agronomic_analysis")
    request.app.state.v2_quotas.check("context_planning", str(farmer.id), 6, 3600)
    if not hasattr(request.app.state, "planning_input_model"):
        raise HTTPException(503, "Scenario engine is unavailable")
    try:
        parameters = request.app.state.planning_input_model.model_validate(body.farming_input).model_dump()
    except ValidationError:
        raise HTTPException(422, "Check the scenario values and supported units") from None
    from ..crops import resolve_crop

    try:
        if body.context.crop_id and resolve_crop(body.context.crop_id, None)[1] != parameters["crop"]:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, "Choose the same supported crop for context and scenario") from None
    result = await context(body.context, request, farmer, db)
    require_consent(db, farmer, "agronomic_analysis")
    db.commit()
    slots = request.app.state.v2_planning_slots
    if slots.locked():
        raise HTTPException(429, "Scenario engine is busy. Retry shortly.")
    try:
        async with slots:
            comparison = await asyncio.to_thread(
                request.app.state.planning_engine.run_whatif_simulation,
                parameters,
                body.num_simulations,
                farm_context=result,
                market_quote_index=body.market_quote_index,
                expected_quote_id=body.expected_quote_id,
            )
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    farmer, _ = authenticate(db, request)
    for purpose in ("agronomic_analysis", "government_integration"):
        require_consent(db, farmer, purpose)
    if body.context.latitude is not None:
        require_consent(db, farmer, "location_processing")
    current, optimal = comparison["current_plan"], comparison["ai_optimal_plan"]
    return {
        "success": True,
        "data": {
            "simulation": current,
            "comparison": comparison,
            "recommendations": {
                "recommendation_text": comparison["recommendation"],
                "current_profit": current["profit"],
                "optimal_profit": optimal["profit"],
                "profit_improvement": optimal["profit"] - current["profit"],
                "current_risk": current["risk"]["overall_risk_score"],
                "optimal_risk": optimal["risk"]["overall_risk_score"],
                "risk_reduction": current["risk"]["overall_risk_score"] - optimal["risk"]["overall_risk_score"],
                "key_insights": optimal["risk"]["insights"],
                "optimal_parameters": optimal["parameters_used"],
            },
        },
        "context": result,
    }
