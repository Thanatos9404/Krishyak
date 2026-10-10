"""Conservative deterministic composition, not a trained farm-health model."""

from datetime import timedelta

from db.models import utcnow
from remote_sensing.quality import trend


def freshness(observed_at, *, days=14):
    if observed_at is None:
        return "unavailable"
    return "recent" if observed_at >= utcnow() - timedelta(days=days) else "stale"


def compose_today(plot, satellite_rows, last_farmer_report=None, weather=None, soil=None, crop_cycle=None):
    current = [row for row in satellite_rows if row.provenance.get("boundary_revision") == plot.revision]
    ndvi = sorted((row for row in current if row.payload.get("index") == "ndvi"), key=lambda x: x.observed_at)
    actions = []
    satellite_status = "unavailable"
    if ndvi:
        latest = ndvi[-1]
        satellite_status = freshness(latest.observed_at)
        # Compare only equivalent aggregation intervals; latest cloudy/stale
        # evidence prevents the historical clear data from becoming an alert.
        interval = latest.provenance.get("aggregation_days")
        observations = [
            row.payload["observation"] for row in ndvi if row.provenance.get("aggregation_days") == interval
        ]
        result = trend(observations)
        if satellite_status == "recent" and result["status"] == "declining":
            actions.append(
                {
                    "kind": "inspect",
                    "title": "Inspect this field for visible changes",
                    "why": "Vegetation signal declined compared with the preceding four usable intervals.",
                    "evidence": {
                        "observed_at": latest.observed_at,
                        "source_type": latest.source_type,
                        "source": latest.source,
                        "freshness": satellite_status,
                        "method": result["method"],
                        "valid_pixel_fraction": latest.payload["observation"]["valid_fraction"],
                        "limitations": [
                            "Satellite indices cannot determine disease or its cause",
                            "Inspect before changing irrigation or treatment",
                        ],
                    },
                    "priority": 2,
                }
            )
        elif latest.payload["observation"].get("quality_status") != "clear":
            satellite_status = latest.payload["observation"].get("quality_status", "insufficient_pixels")
        elif result["status"] == "insufficient_data" and satellite_status != "stale":
            satellite_status = "insufficient_history"
    if not last_farmer_report:
        actions.append(
            {
                "kind": "observe",
                "title": "Record what you see in this field",
                "why": "No farmer observation has been recorded. Field inspection adds context satellite data cannot provide.",
                "evidence": {
                    "source_type": "rules",
                    "source": "Krishyak inspection workflow",
                    "freshness": "unavailable",
                    "method": "Missing farmer observation",
                    "limitations": ["This is a request for evidence, not a diagnosed problem"],
                },
                "priority": 1,
            }
        )
    weather_status = "unavailable"
    if weather and weather.provenance.get("boundary_revision") == plot.revision:
        weather_status = "recent" if weather.created_at >= utcnow() - timedelta(hours=6) else "stale"
        if weather_status == "recent" and crop_cycle:
            from weather_alerts import CROP_THRESHOLDS

            thresholds = CROP_THRESHOLDS.get(crop_cycle.crop)
            hourly = weather.payload.get("hourly", [])
            if thresholds and hourly:
                checks = [
                    (
                        "temperature",
                        "max_temp",
                        "high",
                        "Check the forecast heat window",
                        "Forecast temperature exceeds a draft crop reference threshold.",
                    ),
                    (
                        "temperature",
                        "min_temp",
                        "low",
                        "Check the forecast cold window",
                        "Forecast temperature falls below a draft crop reference threshold.",
                    ),
                    (
                        "wind_speed",
                        "spray_wind_max",
                        "high",
                        "Review wind before spraying",
                        "Forecast wind exceeds a draft crop reference threshold. Check local conditions and the product label.",
                    ),
                    (
                        "humidity",
                        "max_humidity",
                        "high",
                        "Inspect during humid weather",
                        "Humid forecast conditions provide context for inspection; they do not diagnose disease.",
                    ),
                ]
                for field, key, direction, title, why in checks:
                    windows = [
                        row["timestamp"]
                        for row in hourly
                        if field in row
                        and (row[field] > thresholds[key] if direction == "high" else row[field] < thresholds[key])
                    ]
                    if windows:
                        actions.append(
                            {
                                "kind": "weather_context",
                                "title": title,
                                "why": why,
                                "priority": 1,
                                "evidence": {
                                    "source": weather.source,
                                    "source_type": "weather_model",
                                    "observed_at": weather.observed_at,
                                    "freshness": weather_status,
                                    "forecast_window_start": windows[0],
                                    "forecast_window_end": windows[-1],
                                    "method": "draft crop reference threshold",
                                    "threshold": thresholds[key],
                                    "units": weather.payload.get("units", {}).get(field),
                                    "limitations": [
                                        "Thresholds are repository heuristics and have not been agronomically calibrated",
                                        "Forecasts are not field measurements",
                                        "No pesticide dose or automatic irrigation is prescribed",
                                    ],
                                },
                            }
                        )
    soil_status = freshness(soil.observed_at, days=180) if soil else "unavailable"
    ndmi = sorted((row for row in current if row.payload.get("index") == "ndmi"), key=lambda row: row.observed_at)
    if ndmi and weather_status == "recent" and weather.payload.get("precipitation_next_24h_mm") == 0:
        latest_moisture = ndmi[-1]
        comparable = [
            row.payload["observation"]
            for row in ndmi
            if row.provenance.get("aggregation_days") == latest_moisture.provenance.get("aggregation_days")
        ]
        if freshness(latest_moisture.observed_at) == "recent" and trend(comparable)["status"] == "declining":
            actions.insert(
                0,
                {
                    "kind": "moisture_context",
                    "priority": 2,
                    "title": "Inspect soil moisture and recent irrigation",
                    "why": "The stored moisture-sensitive index declined and the current forecast contains no rain in the next 24 hours. These signals provide context for a field inspection.",
                    "evidence": {
                        "source": f"{latest_moisture.source} + {weather.source}",
                        "source_type": "remote_sensing_and_weather_model",
                        "observed_at": latest_moisture.observed_at,
                        "weather_retrieved_at": weather.created_at,
                        "freshness": "recent",
                        "method": "NDMI comparison with four previous clear intervals plus zero forecast precipitation",
                        "limitations": [
                            "These signals cannot establish water stress or its cause",
                            "Forecast rain is not observed rainfall",
                            "Verify moisture, crop stage and irrigation history before changing irrigation",
                            "Rule has not been calibrated against field outcomes",
                        ],
                    },
                },
            )
    return {
        "plot_id": plot.id,
        "plot_name": plot.name,
        "actions": actions[:5],
        "satellite_status": satellite_status,
        "weather_status": weather_status,
        "soil_status": soil_status,
        "crop_cycle": {
            "crop": crop_cycle.crop,
            "growth_stage": crop_cycle.growth_stage,
            "sowing_date": crop_cycle.sowing_date,
            "identity_source": crop_cycle.identity_source,
        }
        if crop_cycle
        else None,
        "method": "deterministic evidence composition",
        "limitations": [
            "No universal farm health score",
            "Farmer-reported measurements and crop identity are not independently verified",
            "Weather rules require agronomic calibration before authoritative use",
        ],
    }
