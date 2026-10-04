"""Normalize documented public-provider payloads, never invent evidence."""

import math
from datetime import datetime, timedelta, timezone

from defusedxml import ElementTree

from ..locations import normalized_name
from .models import ForecastDay, ForecastHour, MarketRecord, Soil, Spatial, Weather, india_today, now
from .transport import Unavailable


def number(value):
    if isinstance(value, bool):
        raise ValueError("Invalid measurement")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Invalid measurement")
    return result


def distance_km(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    h = math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def observation(value, *, maximum_age_hours):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None or not now() - timedelta(hours=maximum_age_hours) <= stamp <= now() + timedelta(minutes=15):
        raise ValueError("Observation timestamp unavailable or expired")
    return stamp


async def open_meteo(gateway, lat, lon):
    fields = "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
    payload = await gateway.read(
        "open_meteo",
        {
            "latitude": lat,
            "longitude": lon,
            "current": fields,
            "hourly": fields,
            "forecast_hours": 48,
            "timezone": "UTC",
            "wind_speed_unit": "kmh",
            "temperature_unit": "celsius",
            "precipitation_unit": "mm",
        },
    )
    expected = {"temperature_2m": "°C", "relative_humidity_2m": "%", "precipitation": "mm", "wind_speed_10m": "km/h"}
    for group in ("current_units", "hourly_units"):
        if any(payload[group].get(k) != v for k, v in expected.items()):
            raise Unavailable()
    current, hourly = payload["current"], payload["hourly"]
    stamp = observation(current["time"] + "+00:00", maximum_age_hours=3)
    times = hourly["time"]
    if len(times) != 48 or any(len(hourly[k]) != 48 for k in expected):
        raise Unavailable()
    forecast = [
        ForecastHour(
            timestamp=datetime.fromisoformat(t).replace(tzinfo=timezone.utc),
            temperature_c=number(hourly["temperature_2m"][i]),
            humidity_percent=number(hourly["relative_humidity_2m"][i]),
            wind_kmh=number(hourly["wind_speed_10m"][i]),
            precipitation_mm=number(hourly["precipitation"][i]),
        )
        for i, t in enumerate(times)
    ]
    if any(
        b.timestamp - a.timestamp != timedelta(hours=1) for a, b in zip(forecast, forecast[1:], strict=False)
    ) or abs(forecast[0].timestamp - stamp) > timedelta(hours=2):
        raise Unavailable()
    return Weather(
        observed_at=stamp,
        temperature_c=number(current["temperature_2m"]),
        humidity_percent=number(current["relative_humidity_2m"]),
        wind_kmh=number(current["wind_speed_10m"]),
        precipitation_next_24h_mm=sum(x.precipitation_mm for x in forecast[:24]),
        forecast=forecast,
    )


async def imd(gateway, lat, lon):
    # Only enable after IMD approves IP/public access. No guessed token scheme.
    payload = await gateway.read("imd", {})
    rows = payload if isinstance(payload, list) else payload.get("data")
    if not isinstance(rows, list) or len(rows) > 2000:
        raise Unavailable()
    candidates = []
    for row in rows:
        try:
            station_lat, station_lon = number(row["Latitude"]), number(row["Longitude"])
            if not -90 <= station_lat <= 90 or not -180 <= station_lon <= 180:
                continue
            distance = distance_km(lat, lon, station_lat, station_lon)
            if distance > 100:
                continue
            issued = datetime.strptime(row["Date"], "%Y-%m-%d").replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
            stamp = observation(issued.isoformat(), maximum_age_hours=36)
            days = []
            for index in range(7):
                prefix = "Todays_Forecast_" if index == 0 else f"Day_{index + 1}_"
                description_key = "Todays_Forecast" if index == 0 else f"Day_{index + 1}_Forecast"
                days.append(
                    ForecastDay(
                        date=(issued + timedelta(days=index)).date(),
                        minimum_c=number(row[prefix + "Min_Temp"]),
                        maximum_c=number(row[prefix + "Max_Temp"]),
                        description=row[description_key],
                    )
                )
            value = Weather(
                observed_at=stamp,
                daily_forecast=days,
                station_name=row["Station_Name"],
                station_distance_km=round(distance, 1),
            )
            candidates.append((distance, value))
        except (ValueError, KeyError, TypeError):
            continue
    if not candidates:
        raise Unavailable()
    return min(candidates, key=lambda x: x[0])[1]


SOIL_PROPERTIES = {
    "phh2o": ("ph", 10, 10, "pH"),
    "nitrogen": ("nitrogen_g_kg", 100, 100, "g/kg"),
    "soc": ("organic_carbon_g_kg", 10, 10, "g/kg"),
    # The API conventional texture unit is percent. Keep our contract in g/kg,
    # which is the original mapped unit, rather than labelling percent as g/kg.
    "clay": ("clay_g_kg", 1, 10, "%"),
    "sand": ("sand_g_kg", 1, 10, "%"),
    "silt": ("silt_g_kg", 1, 10, "%"),
}


def normalize_soil(payload):
    values = {}
    layers = payload["properties"]["layers"]
    if not isinstance(layers, list) or len(layers) > 30:
        raise Unavailable()
    for layer in layers:
        name = layer["name"]
        if name not in SOIL_PROPERTIES:
            continue
        target, factor, provider_factor, unit = SOIL_PROPERTIES[name]
        metadata = layer["unit_measure"]
        if metadata.get("d_factor") != provider_factor or metadata.get("target_units") != unit:
            raise Unavailable()
        depths = [d for d in layer["depths"] if d["label"] == "0-5cm"]
        if len(depths) != 1 or target in values:
            raise Unavailable()
        raw = depths[0]["values"].get("mean")
        values[target] = None if raw is None else number(raw) / factor
    if not any(x is not None for x in values.values()):
        raise Unavailable()
    return Soil(**values)


async def soilgrids(gateway, lat, lon):
    params = [("lat", lat), ("lon", lon), ("depth", "0-5cm"), ("value", "mean")]
    params.extend(("property", x) for x in SOIL_PROPERTIES)
    return normalize_soil(await gateway.read("soilgrids", params))


def normalize_capabilities(raw):
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise Unavailable()
    root = ElementTree.fromstring(raw)
    if root.tag.split("}")[-1] not in {"WMS_Capabilities", "WMT_MS_Capabilities"}:
        raise Unavailable()
    layers, queryable = [], []
    for node in root.iter():
        if node.tag.split("}")[-1] != "Layer":
            continue
        name = next((x.text for x in node if x.tag.split("}")[-1] == "Name"), None)
        if not name or len(name) > 150:
            continue
        if len(layers) < 100:
            layers.append(name)
            if node.attrib.get("queryable") == "1":
                queryable.append(name)
    if not layers:
        raise Unavailable()
    return Spatial(available_layers=layers, queryable_layers=queryable)


async def bhuvan(gateway):
    return normalize_capabilities(
        await gateway.read("bhuvan", {"service": "WMS", "request": "GetCapabilities", "version": "1.3.0"}, xml=True)
    )


def normalize_markets(payload, state, district, crop):
    rows = payload["records"]
    if not isinstance(rows, list) or len(rows) > 100:
        raise Unavailable()
    result = {}
    today = india_today()
    for row in rows:
        try:
            if (
                normalized_name(row["state"]) != normalized_name(state)
                or district
                and normalized_name(row["district"]) != normalized_name(district)
                or normalized_name(row["commodity"]) != normalized_name(crop)
            ):
                continue
            stamp = datetime.strptime(row["arrival_date"], "%d/%m/%Y").date()
            if stamp > today or (today - stamp).days > 30:
                continue
            record = MarketRecord(
                commodity=row["commodity"],
                variety=row.get("variety", "Unspecified"),
                market=row["market"],
                district=row["district"],
                state=row["state"],
                min_price=number(row["min_price"]),
                max_price=number(row["max_price"]),
                modal_price=number(row["modal_price"]),
                observed_date=stamp,
            )
            key = (normalized_name(record.market), normalized_name(record.variety), stamp)
            # Conflicting duplicates are discarded instead of picking an arbitrary quote.
            if key in result and result[key] != record.model_dump(mode="json"):
                result[key] = None
            elif key not in result:
                result[key] = record.model_dump(mode="json")
        except (ValueError, TypeError, KeyError):
            continue
    return sorted((x for x in result.values() if x), key=lambda x: (x["observed_date"], x["market"]), reverse=True)


async def ogd(gateway, key, state, district, crop):
    params = {"api-key": key, "format": "json", "limit": 100, "filters[state]": state, "filters[commodity]": crop}
    if district:
        params["filters[district]"] = district
    payload = await gateway.read("ogd", params)
    return normalize_markets(payload, state, district, crop)
