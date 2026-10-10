"""Normalized evidence boundary for the existing scenario engines."""

from datetime import date, timedelta

import pandas as pd

from ..locations import normalized_name
from .models import FarmContext, india_today, now


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
        today = india_today()
        if (
            normalized_name(quote.commodity) != normalized_name(parameters["crop"])
            or quote.unit != "INR/quintal"
            or not today - timedelta(days=2) <= quote.observed_date <= today
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


def reviewed_market_history(context: FarmContext, selected_quote):
    """Keep a reviewed market/variety series separate from unrelated price records.

    Called only after scenario_inputs verifies the current quote and fingerprint.
    The current-day resource is not assumed to be a complete historical archive.
    """
    quote = selected_quote
    scope = ("state", "district", "commodity", "market", "variety", "unit")
    values = {}
    today = india_today()
    last_date = min(today, date.fromisoformat(quote["observed_date"]))
    for record in context.market.data or []:
        if any(normalized_name(getattr(record, key)) != normalized_name(quote[key]) for key in scope):
            continue
        stamp = record.observed_date
        if not today - timedelta(days=30) <= stamp <= last_date:
            continue
        # Conflicting same-day records are missing evidence, never averaged.
        if stamp in values and values[stamp] != record.modal_price:
            values[stamp] = None
        elif stamp not in values:
            values[stamp] = record.modal_price
    rows = sorted((stamp, price) for stamp, price in values.items() if price is not None)
    frame = pd.DataFrame(rows, columns=["Arrival_Date", "Modal_x0020_Price"])
    frame["Arrival_Date"] = pd.to_datetime(frame["Arrival_Date"])
    prices = frame["Modal_x0020_Price"]
    count = len(prices)
    stats = {
        "mean": float(prices.mean()) if count else None,
        "std": float(prices.std(ddof=0)) if count >= 2 else None,
        "min": float(prices.min()) if count else None,
        "max": float(prices.max()) if count else None,
        "volatility": float(prices.std(ddof=0) / prices.mean()) if count >= 2 else None,
        "source_type": "historical_dataset" if count >= 2 else "insufficient_evidence",
        "observations": count,
    }
    metadata = {
        "provider": context.market.source.provider,
        "source_url": context.market.source.source_url,
        "retrieved_at": context.market.source.retrieved_at.isoformat(),
        "selected_quote_id": quote["quote_id"],
        "market": quote["market"],
        "variety": quote["variety"],
        "state": quote["state"],
        "district": quote["district"],
        "commodity": quote["commodity"],
        "unit": quote["unit"],
        "observations": count,
        "first_date": rows[0][0].isoformat() if rows else None,
        "last_date": rows[-1][0].isoformat() if rows else None,
        "complete_archive": False,
        "missing_days_filled": False,
    }
    return frame, stats, metadata
