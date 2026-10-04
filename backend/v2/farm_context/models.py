"""Provider-independent, bounded agricultural context contracts."""

import hashlib
import json
from datetime import date, datetime, timezone
from typing import Generic, Literal, TypeVar

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt, model_validator

from ..schemas import Input, Number


def now():
    return datetime.now(timezone.utc)


class ContextInput(Input):
    latitude: Number | None = Field(default=None, ge=-90, le=90)
    longitude: Number | None = Field(default=None, ge=-180, le=180)
    accuracy_meters: Number | None = Field(default=None, ge=0, le=100000)
    state_code: StrictInt | None = None
    district_code: StrictInt | None = None
    crop_id: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both coordinates or choose a location manually")
        if self.latitude is not None and not (6 <= self.latitude <= 38 and 68 <= self.longitude <= 98):
            raise ValueError("Choose a location in India")
        if self.district_code is not None and self.state_code is None:
            raise ValueError("Select a state before its district")
        return self


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Source(Model):
    provider: str = Field(max_length=80)
    status: Literal["success", "fallback", "unavailable", "stale", "disabled", "partial"]
    source_url: str
    retrieved_at: AwareDatetime = Field(default_factory=now)
    valid_until: AwareDatetime | None = None
    observed_at: AwareDatetime | None = None
    is_fallback: bool = False
    cache_hit: bool = False
    message: str | None = Field(default=None, max_length=180)


T = TypeVar("T")


class Section(Model, Generic[T]):
    source: Source
    data: T | None = None


class Location(Model):
    state_name: str | None = None
    state_lgd_code: int | None = None
    district_name: str | None = None
    district_lgd_code: int | None = None
    subdistrict_name: str | None = None
    subdistrict_lgd_code: int | None = None
    village_name: str | None = None
    village_lgd_code: int | None = None
    accuracy_meters: float | None = None
    resolution: Literal["manual", "name_mapping", "unresolved"]
    confidence: Literal["reported", "partial", "unresolved"]


class ForecastHour(Model):
    timestamp: AwareDatetime
    temperature_c: float = Field(ge=-100, le=70)
    humidity_percent: float = Field(ge=0, le=100)
    wind_kmh: float = Field(ge=0, le=500)
    precipitation_mm: float = Field(ge=0, le=1000)


class ForecastDay(Model):
    date: date
    minimum_c: float = Field(ge=-100, le=70)
    maximum_c: float = Field(ge=-100, le=70)
    description: str = Field(max_length=300)

    @model_validator(mode="after")
    def temperatures(self):
        if self.minimum_c > self.maximum_c:
            raise ValueError("Invalid temperature range")
        return self


class Weather(Model):
    observed_at: AwareDatetime
    temperature_c: float | None = Field(default=None, ge=-100, le=70)
    humidity_percent: float | None = Field(default=None, ge=0, le=100)
    wind_kmh: float | None = Field(default=None, ge=0, le=500)
    precipitation_next_24h_mm: float | None = Field(default=None, ge=0, le=24000)
    forecast: list[ForecastHour] = Field(default_factory=list, max_length=168)
    daily_forecast: list[ForecastDay] = Field(default_factory=list, max_length=7)
    station_name: str | None = Field(default=None, max_length=150)
    station_distance_km: float | None = Field(default=None, ge=0)


class Soil(Model):
    ph: float | None = Field(default=None, ge=0, le=14)
    nitrogen_g_kg: float | None = Field(default=None, ge=0, le=1000)
    organic_carbon_g_kg: float | None = Field(default=None, ge=0, le=1000)
    clay_g_kg: float | None = Field(default=None, ge=0, le=1000)
    sand_g_kg: float | None = Field(default=None, ge=0, le=1000)
    silt_g_kg: float | None = Field(default=None, ge=0, le=1000)
    depth_cm: str = "0-5"
    estimated: bool = True
    spatial_resolution_meters: int = 250
    phosphorus: float | None = None
    potassium: float | None = None


class MarketRecord(Model):
    quote_id: str = Field(default="", max_length=64)
    commodity: str = Field(max_length=100)
    variety: str = Field(max_length=100)
    market: str = Field(max_length=150)
    district: str = Field(max_length=150)
    state: str = Field(max_length=150)
    min_price: float | None = Field(default=None, ge=0, le=10000000)
    max_price: float | None = Field(default=None, ge=0, le=10000000)
    modal_price: float = Field(gt=0, le=10000000)
    unit: Literal["INR/quintal"] = "INR/quintal"
    observed_date: date

    @model_validator(mode="after")
    def prices(self):
        if self.min_price is not None and self.max_price is not None and self.min_price > self.max_price:
            raise ValueError("Invalid price range")
        if (
            self.min_price is not None
            and self.modal_price < self.min_price
            or self.max_price is not None
            and self.modal_price > self.max_price
        ):
            raise ValueError("Modal price is outside its range")
        identity = json.dumps(
            [
                self.state,
                self.district,
                self.commodity,
                self.market,
                self.variety,
                self.observed_date.isoformat(),
                self.min_price,
                self.max_price,
                self.modal_price,
                self.unit,
            ],
            ensure_ascii=True,
        )
        digest = hashlib.sha256(identity.encode()).hexdigest()
        if self.quote_id and self.quote_id != digest:
            raise ValueError("Market quote identity does not match its evidence")
        self.quote_id = digest
        return self


class Spatial(Model):
    available_layers: list[str] = Field(default_factory=list, max_length=100)
    queryable_layers: list[str] = Field(default_factory=list, max_length=100)
    land_use: str | None = None
    waterlogging_context: str | None = None
    flood_context: str | None = None
    capabilities_only: bool = True


class FarmContext(Model):
    generated_at: AwareDatetime = Field(default_factory=now)
    location: Section[Location]
    weather: Section[Weather]
    soil: Section[Soil]
    geospatial: Section[Spatial]
    market: Section[list[MarketRecord]]
    schemes: list[dict] = Field(default_factory=list)
    status: Literal["available", "partial", "unavailable"]
    precise_coordinates_stored: bool = False
