"""Weather outlook and climate history for a field, from Open-Meteo.

* a 7-day daily forecast (rain, chance of rain, hottest and coolest hour),
* ten-year rainfall and temperature normals for the place (ERA5 archive), and
* rain over the last 30 and 90 days against what is normal for those dates.

Coordinates are rounded before they leave the server (about 5 km for the
forecast, 11 km for climate), answers are cached in Redis under a hash of the
cell, and nothing here is tied to a farmer. Reanalysis rainfall is a gridded
estimate, not a rain gauge in the field; the response says so.
"""

import asyncio
import hashlib
import json
import logging
from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from repositories.ownership import owned_plot

from .farm_context.models import india_today
from .farm_context.providers import number
from .farm_context.transport import Unavailable
from .router import current_farmer, database, require_consent

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2", tags=["Weather outlook and climate"])

NORMAL_YEARS = 10
SEASON_MONTHS = {"kharif": (6, 7, 8, 9), "rabi": (10, 11, 12, 1, 2, 3), "summer": (4, 5)}
LOCAL = {}  # in-process cache for development without Redis


async def cached(redis, key, ttl, loader):
    """Read through a shared cache; a cache failure never blocks the answer."""
    key = "krishyak:climate:v1:" + hashlib.sha256(key.encode()).hexdigest()
    try:
        raw = await asyncio.to_thread(redis.get, key) if redis is not None else LOCAL.get(key)
        if raw:
            return json.loads(raw)
    except Exception as error:  # noqa: BLE001
        LOGGER.warning("Climate cache read failed type=%s", type(error).__name__)
    value = await loader()
    try:
        if redis is not None:
            await asyncio.to_thread(redis.set, key, json.dumps(value), ex=ttl)
        elif len(LOCAL) < 256:
            LOCAL[key] = json.dumps(value)
    except Exception as error:  # noqa: BLE001
        LOGGER.warning("Climate cache write failed type=%s", type(error).__name__)
    return value


def daily_rows(payload, fields):
    daily, units = payload["daily"], payload["daily_units"]
    for name, unit in fields.items():
        if units.get(name) != unit:
            raise Unavailable()
    days = daily["time"]
    if not days or any(len(daily[name]) != len(days) for name in fields):
        raise Unavailable()
    return [(date.fromisoformat(day), {name: daily[name][i] for name in fields}) for i, day in enumerate(days)]


async def week_ahead(gateway, lat, lon):
    lat, lon = round(lat * 20) / 20, round(lon * 20) / 20
    fields = {
        "temperature_2m_max": "°C",
        "temperature_2m_min": "°C",
        "precipitation_sum": "mm",
        "precipitation_probability_max": "%",
        "wind_speed_10m_max": "km/h",
        "weather_code": "wmo code",
    }

    async def load():
        payload = await gateway.read(
            "open_meteo",
            {
                "latitude": lat,
                "longitude": lon,
                "daily": ",".join(fields),
                "forecast_days": 7,
                "timezone": "Asia/Kolkata",
                "wind_speed_unit": "kmh",
            },
        )
        rows = daily_rows(payload, fields)
        if len(rows) != 7:
            raise Unavailable()
        days = []
        for day, row in rows:
            high, low = number(row["temperature_2m_max"]), number(row["temperature_2m_min"])
            rain = number(row["precipitation_sum"])
            if not (-60 <= low <= high <= 65) or not 0 <= rain <= 1500:
                raise Unavailable()
            chance = row["precipitation_probability_max"]
            days.append(
                {
                    "date": day.isoformat(),
                    "high_c": round(high, 1),
                    "low_c": round(low, 1),
                    "rain_mm": round(rain, 1),
                    "rain_chance_percent": None if chance is None else int(number(chance)),
                    "wind_kmh": round(number(row["wind_speed_10m_max"])),
                    "sky": sky(int(number(row["weather_code"])), rain),
                }
            )
        return {"days": days, "issued_on": india_today().isoformat()}

    return await cached(gateway.quotas.redis, f"week:{lat}:{lon}:{india_today()}", 3 * 3600, load)


def sky(code, rain):
    """WMO weather code in words a farmer uses."""
    if code in (95, 96, 99):
        return "storm"
    if rain >= 20 or code in (65, 67, 82):
        return "heavy_rain"
    if rain >= 1 or code in (51, 53, 55, 61, 63, 80, 81):
        return "rain"
    if code in (45, 48):
        return "fog"
    if code in (2, 3):
        return "cloudy"
    return "clear"


async def archive(gateway, lat, lon, start, end):
    fields = {"precipitation_sum": "mm", "temperature_2m_max": "°C", "temperature_2m_min": "°C"}
    payload = await gateway.read(
        "open_meteo_archive",
        {
            "latitude": lat,
            "longitude": lon,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": ",".join(fields),
            "timezone": "Asia/Kolkata",
        },
        deadline=25,
    )
    return daily_rows(payload, fields)


async def normals(gateway, lat, lon):
    """Ten complete years of daily reanalysis, reduced to monthly and seasonal normals."""
    lat, lon = round(lat, 1), round(lon, 1)
    last_year = india_today().year - 1
    first_year = last_year - NORMAL_YEARS + 1

    async def load():
        rows = await archive(gateway, lat, lon, date(first_year, 1, 1), date(last_year, 12, 31))
        rain = defaultdict(float)  # (year, month) -> mm
        highs, lows = defaultdict(list), defaultdict(list)
        wet_days = defaultdict(int)
        by_day = defaultdict(list)  # (month, day) -> daily rain across years
        for day, row in rows:
            mm = row["precipitation_sum"]
            if mm is None or row["temperature_2m_max"] is None:
                continue
            mm = number(mm)
            rain[(day.year, day.month)] += mm
            by_day[(day.month, day.day)].append(mm)
            wet_days[day.year] += mm >= 2.5
            highs[day.month].append(number(row["temperature_2m_max"]))
            lows[day.month].append(number(row["temperature_2m_min"]))
        years = sorted({year for year, _ in rain})
        if len(years) < NORMAL_YEARS - 1:
            raise Unavailable()
        monthly = [round(sum(rain[(year, month)] for year in years) / len(years), 1) for month in range(1, 13)]
        annual = {year: sum(rain[(year, month)] for month in range(1, 13)) for year in years}
        mean = sum(annual.values()) / len(years)
        spread = (sum((v - mean) ** 2 for v in annual.values()) / len(years)) ** 0.5
        return {
            "years": [first_year, last_year],
            "annual_rain_mm": round(mean),
            "monthly_rain_mm": monthly,
            "monthly_high_c": [round(sum(highs[m]) / len(highs[m]), 1) for m in range(1, 13)],
            "monthly_low_c": [round(sum(lows[m]) / len(lows[m]), 1) for m in range(1, 13)],
            "season_rain_mm": {
                name: round(sum(monthly[m - 1] for m in months)) for name, months in SEASON_MONTHS.items()
            },
            "rainy_days_per_year": round(sum(wet_days.values()) / len(years)),
            "driest_year": {"year": min(annual, key=annual.get), "rain_mm": round(min(annual.values()))},
            "wettest_year": {"year": max(annual, key=annual.get), "rain_mm": round(max(annual.values()))},
            "year_to_year_variation_percent": round(spread / mean * 100) if mean else None,
            "daily_normal_mm": {f"{m:02d}-{d:02d}": round(sum(v) / len(v), 2) for (m, d), v in by_day.items()},
        }

    return await cached(gateway.quotas.redis, f"normals:{lat}:{lon}:{last_year}", 180 * 86400, load)


async def recent_rain(gateway, lat, lon, normal):
    """Rain over the last 30 and 90 days, and what those same dates normally bring."""
    lat, lon = round(lat, 1), round(lon, 1)
    end = india_today() - timedelta(days=6)  # the archive trails real time by about five days

    async def load():
        rows = await archive(gateway, lat, lon, end - timedelta(days=89), end)
        result = {"until": end.isoformat()}
        for days in (30, 90):
            window = [(day, row) for day, row in rows if day > end - timedelta(days=days)]
            if any(row["precipitation_sum"] is None for _, row in window) or len(window) < days - 2:
                raise Unavailable()
            fell = sum(number(row["precipitation_sum"]) for _, row in window)
            usual = sum(normal["daily_normal_mm"].get(f"{day.month:02d}-{day.day:02d}", 0) for day, _ in window)
            result[f"last_{days}_days"] = {
                "rain_mm": round(fell, 1),
                "normal_mm": round(usual, 1),
                # Below 10 mm of normal rain a percentage means nothing (dry season).
                "percent_of_normal": round(fell / usual * 100) if usual >= 10 else None,
            }
        return result

    return await cached(gateway.quotas.redis, f"recent:{lat}:{lon}:{end}", 12 * 3600, load)


def public_normals(normal):
    return {key: value for key, value in normal.items() if key != "daily_normal_mm"}


async def outlook(gateway, lat, lon):
    """Forecast, normals and recent rain; each part is independent and may be missing."""

    async def part(loader):
        try:
            return await loader
        except (Unavailable, KeyError, TypeError, ValueError):
            return None

    week, normal = await asyncio.gather(part(week_ahead(gateway, lat, lon)), part(normals(gateway, lat, lon)))
    recent = await part(recent_rain(gateway, lat, lon, normal)) if normal else None
    return {
        "forecast": week,
        "climate": public_normals(normal) if normal else None,
        "recent_rain": recent,
        "sources": [
            {"name": "Open-Meteo forecast", "url": "https://open-meteo.com/"},
            {
                "name": "Open-Meteo historical weather (ERA5 reanalysis)",
                "url": "https://open-meteo.com/en/docs/historical-weather-api",
            },
        ],
        "limits": [
            "Forecasts change; check again before spraying, irrigating or harvesting.",
            "Past rainfall is a gridded estimate for the area (about 10 km), not a gauge in this field.",
        ],
    }


def plot_point(plot):
    from geoalchemy2.shape import to_shape

    point = plot.centroid if plot.centroid is not None else plot.approximate_location
    if point is None:
        return None
    shape = to_shape(point)
    return shape.y, shape.x


@router.get("/plots/{plot_id}/outlook")
async def plot_outlook(
    plot_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    plot = owned_plot(db, farmer.id, plot_id)
    require_consent(db, farmer, "location_processing")
    request.app.state.v2_quotas.check("outlook", str(farmer.id), 60, 3600)
    point = plot_point(plot)
    if point is None:
        raise HTTPException(422, "Add your field's location to see the weather outlook")
    db.commit()
    result = await outlook(request.app.state.v2_farm_context.gateway, *point)
    if not any(result[key] for key in ("forecast", "climate", "recent_rain")):
        raise HTTPException(503, "The weather service is not answering. Please try again shortly.")
    return {"plot_id": str(plot.id), **result}
