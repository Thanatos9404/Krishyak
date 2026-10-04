"""Normalized evidence boundary for the existing scenario engines."""

from datetime import date, timedelta

from .models import FarmContext, now


def scenario_inputs(parameters, context: FarmContext, quote_index=None, expected_quote_id=None):
    if not isinstance(context, FarmContext):
        raise ValueError("A normalized farm context is required")
    result = dict(parameters)
    quote = None
    if quote_index is not None:
        section = context.market
        if (
            section.source.status != "success"
            or not section.source.valid_until
            or section.source.valid_until < now()
            or not section.data
            or not 0 <= quote_index < len(section.data)
        ):
            raise ValueError("Choose a fresh available market quote")
        quote = section.data[quote_index]
        if not expected_quote_id or quote.quote_id != expected_quote_id:
            raise ValueError("Market quote changed. Review the updated quote before using it.")
        if (
            quote.commodity.casefold() != parameters["crop"].casefold()
            or quote.unit != "INR/quintal"
            or quote.observed_date < date.today() - timedelta(days=2)
        ):
            raise ValueError("Market quote crop, unit or date is not comparable")
        if parameters["crop"] == "Cotton":
            raise ValueError("Cotton simulation needs lint prices; a mandi quote has no verified lint basis")
        result["current_market_price"] = quote.modal_price
    evidence = {
        "weather": {
            "provider": context.weather.source.provider,
            "status": context.weather.source.status,
            "observed_at": context.weather.source.observed_at,
            "use": "Short-range context only. Seasonal rainfall remains the farmer's scenario assumption.",
        },
        "soil": {
            "provider": context.soil.source.provider,
            "status": context.soil.source.status,
            "estimated": context.soil.data.estimated if context.soil.data else None,
            "use": "No soil estimate is converted into fertilizer kg/ha or a laboratory soil type.",
        },
        "market": {
            "provider": context.market.source.provider,
            "status": context.market.source.status,
            "selected_quote": quote.model_dump(mode="json") if quote else None,
        },
        "geospatial": {
            "provider": context.geospatial.source.provider,
            "status": context.geospatial.source.status,
            "capabilities_only": context.geospatial.data.capabilities_only if context.geospatial.data else None,
        },
        "generated_at": context.generated_at.isoformat(),
        "benefit_eligibility_verified": False,
        "land_ownership_verified": False,
    }
    return result, evidence
