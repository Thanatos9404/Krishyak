from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class PredictionMetadata(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction_mode: str = Field(..., description="ml_primary | heuristic_fallback | hybrid_adjusted | historical_only | unavailable")
    confidence_label: str = Field(..., description="high | medium | low | not_applicable")
    confidence_score: Optional[float] = Field(None, description="Float (0.0 - 1.0)")
    coverage_status: str = Field(..., description="supported | partial_support | out_of_scope | temporarily_unavailable")
    freshness_status: str = Field(..., description="realtime | cached | stale_data")
    explanation_basis: List[str] = Field(default_factory=list, description="List of drivers/explanations")
    source_label: str = Field(..., description="E.g., Krishyak ML Router")
    source_type: str = Field(..., description="E.g., XGBoost, Heuristic")
    model_version: Optional[str] = None
    feature_version: Optional[str] = None
    fallback_reason: Optional[str] = None
    record_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    disclaimer: str = Field("This is an AI-assisted estimate based on limited historical data. It does not replace official agricultural advisories.")

class PredictionRouter:
    """Report the algorithm actually executed, with no invented accuracy."""
    @staticmethod
    def get_coverage(crop: str, state: str = "") -> str:
        return "out_of_scope"  # No validated yield/price ML artifact is installed.

    @staticmethod
    def route_simulation(params, heuristic_result):
        return heuristic_result, PredictionMetadata(
            prediction_mode="heuristic_fallback", confidence_label="not_applicable",
            coverage_status="partial_support", freshness_status="cached",
            explanation_basis=["Multiplicative agronomic yield rules", "Entered-price persistence baseline",
                               "Monte Carlo sensitivity with assumed ranges; not calibrated probabilities"],
            source_label="Krishyak scenario calculator", source_type="Rule-based calculation",
            fallback_reason="No independently validated yield or price model is installed.")

    @staticmethod
    def route_disease(crop, cv_result, heuristic_result):
        has_model = bool(cv_result.get("sources"))
        score = cv_result.get("confidence", (cv_result.get("disease") or {}).get("confidence"))
        return cv_result, PredictionMetadata(
            prediction_mode="ml_primary" if has_model else "unavailable",
            confidence_label="not_applicable", confidence_score=score,
            coverage_status="supported" if cv_result.get("status") in ("healthy", "disease_detected") else "partial_support" if has_model else "temporarily_unavailable",
            freshness_status="realtime",
            explanation_basis=["Classifier softmax score is not calibrated diagnostic accuracy"] if has_model else [cv_result.get("message", "Classifier unavailable")],
            source_label="Krishyak image classifier", source_type="Image classifier" if has_model else "Unavailable",
            model_version=cv_result.get("model_version"))

    @staticmethod
    def route_price(commodity, forecast_result):
        return forecast_result, PredictionMetadata(
            prediction_mode="heuristic_fallback", confidence_label="not_applicable",
            coverage_status="partial_support", freshness_status="cached",
            explanation_basis=["Persistence baseline anchored to the supplied price; no validated selling window"],
            source_label="Price persistence baseline", source_type="Statistical baseline")
