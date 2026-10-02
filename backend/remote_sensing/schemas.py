from datetime import date, datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, model_validator

Index = Literal["ndvi", "ndmi", "ndre"]
Layer = Literal["true_color", "ndvi", "ndmi", "ndre"]


class LocationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    latitude: StrictFloat | StrictInt = Field(ge=-85, le=85)
    longitude: StrictFloat | StrictInt = Field(ge=-180, le=180)


class Polygon(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[StrictFloat | StrictInt]]] = Field(min_length=1, max_length=1)

    @model_validator(mode="after")
    def validate_ring(self):
        from .geometry import normalize_geometry
        self.coordinates = normalize_geometry(self.model_dump())["coordinates"]
        return self


class FieldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    geometry: Polygon
    start_date: date = Field(default_factory=lambda: datetime.now(timezone.utc).date() - timedelta(days=90))
    end_date: date = Field(default_factory=lambda: datetime.now(timezone.utc).date())
    index: Index = "ndvi"
    interval_days: Literal[5, 10] = 10
    max_cloud_percent: float = Field(default=100, ge=0, le=100)
    spatial_scope: Literal['field','device_neighborhood'] = 'field'

    @model_validator(mode="after")
    def validate_dates(self):
        if not 0 <= (self.end_date - self.start_date).days <= 180:
            raise ValueError("Date range must be ordered and at most 180 days")
        if self.end_date > datetime.now(timezone.utc).date():
            raise ValueError("Future observations cannot be requested")
        return self


class PreviewRequest(FieldRequest):
    layer: Layer = "true_color"
    width: int = Field(default=512, ge=64, le=768, strict=True)
    height: int = Field(default=512, ge=64, le=768, strict=True)

    @model_validator(mode="after")
    def single_day(self):
        if self.start_date != self.end_date:
            raise ValueError("Preview requires one acquisition day; composites must not be labelled single images")
        return self


class Observation(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    start: str
    end: str
    mean: float | None = None
    stdev: float | None = None
    min: float | None = None
    max: float | None = None
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    sample_count: int = Field(ge=0)
    valid_sample_count: int = Field(ge=0)
    valid_fraction: float = Field(ge=0, le=1)
    available_pixel_count: int = Field(ge=0)
    nominal_pixel_count: float = Field(ge=0)
    coverage_fraction_estimate: float = Field(ge=0, le=1)
    valid_fraction_among_available: float = Field(ge=0, le=1)
    cloud_invalid_fraction: float = Field(ge=0, le=1)
    quality_status: Literal["clear", "insufficient"]


class Provenance(BaseModel):
    evidence_type: Literal["remote_sensing_observation"] = "remote_sensing_observation"
    provider: str
    mission: str = "Sentinel-2"
    collection: str = "sentinel-2-l2a"
    processing_level: str = "L2A surface reflectance"
    requested_period: dict
    spatial_scope: Literal['field','device_neighborhood'] = 'field'
    acquisition_dates: list[str] = Field(default_factory=list)
    contributing_dates_verified: bool = False
    composite: bool = True
    bands: list[str]
    index: str
    formula: str
    processing_version: str = "krishyak-s2-v1"
    spatial_resolution_m: int
    quality_mask_resolution_m: int = 20
    requested_geometry_hash: str
    valid_pixel_fraction: float | None = None
    computed_at: str
    cache_status: Literal["hit", "miss"] = "miss"
    source_url: str = "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html"
    limitations: list[str]
