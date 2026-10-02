"""Bounded public contracts. No caller-selected owner or role fields."""

from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, field_validator, model_validator

from remote_sensing.schemas import Polygon

Number = StrictFloat | StrictInt
Purpose = Literal[
    "account_operation",
    "location_processing",
    "satellite_processing",
    "agronomic_analysis",
    "model_improvement",
    "pilot_research",
    "government_integration",
]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class RequestOTP(Input):
    mobile: str = Field(pattern=r"^\+91[6-9][0-9]{9}$")


class VerifyOTP(Input):
    challenge_id: UUID
    code: str = Field(pattern=r"^[0-9]{6}$")
    accept_policy_version: Literal["2026-10-03"]


class ProfileInput(Input):
    display_name: str = Field(min_length=1, max_length=100)
    preferred_language: str = Field(default="en", min_length=2, max_length=10)
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    village: str | None = Field(default=None, max_length=100)

    @field_validator("preferred_language")
    @classmethod
    def supported_language(cls, value):
        if value not in {
            "en",
            "hi",
            "bn",
            "as",
            "brx",
            "doi",
            "gu",
            "kn",
            "ks",
            "kok",
            "mai",
            "ml",
            "mni",
            "mr",
            "ne",
            "or",
            "pa",
            "sa",
            "sat",
            "sd",
            "ta",
            "te",
            "ur",
        }:
            raise ValueError("Unsupported language")
        return value


class FarmInput(Input):
    operation_id: UUID
    name: str = Field(min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    ownership: Literal["owned", "leased", "shared", "other"] | None = None


class FarmUpdate(Input):
    name: str = Field(min_length=1, max_length=100)
    revision: StrictInt = Field(ge=1)


class PlotInput(Input):
    operation_id: UUID
    farm_id: UUID
    name: str = Field(min_length=1, max_length=100)
    boundary: Polygon | None = None
    entered_area_hectares: Number | None = Field(default=None, gt=0, le=500)
    boundary_quality: Literal["manual", "approximate", "farmer_drawn"] = "manual"
    irrigation_type: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def valid_location(self):
        if self.boundary is None and self.entered_area_hectares is None:
            raise ValueError("A boundary or manual area is required")
        if self.boundary is None and self.boundary_quality != "manual":
            raise ValueError("A mapped boundary is required for this quality")
        if self.boundary is not None and self.boundary_quality == "manual":
            self.boundary_quality = "farmer_drawn"
        return self


class PlotUpdate(PlotInput):
    revision: StrictInt = Field(ge=1)


class CycleInput(Input):
    operation_id: UUID = Field(default_factory=uuid4)
    crop: str = Field(min_length=1, max_length=100)
    variety: str | None = Field(default=None, max_length=100)
    sowing_date: date
    expected_harvest: date
    growth_stage: str | None = Field(default=None, max_length=50)
    season: str | None = Field(default=None, max_length=50)
    status: Literal["planned", "active", "completed", "cancelled"] = "active"

    @model_validator(mode="after")
    def dates_and_crop(self):
        import config

        if self.crop not in config.CROPS:
            raise ValueError("Unsupported planning crop")
        if not 1 <= (self.expected_harvest - self.sowing_date).days <= 1095:
            raise ValueError("Crop dates must be ordered and within three years")
        if self.status == "active" and self.sowing_date > datetime.now(timezone.utc).date():
            raise ValueError("Future cycles must be planned")
        return self


class ObservationInput(Input):
    operation_id: UUID
    kind: Literal[
        "farmer_observation",
        "soil",
        "pest_report",
        "irrigation",
        "fertilizer_action",
        "harvest",
        "market_sale",
        "advisory_acknowledgement",
        "follow_up",
        "crop_loss",
        "treatment_action",
        "satisfaction",
        "advisory_usefulness",
        "actual_cost",
    ]
    observed_at: datetime
    note: str = Field(min_length=1, max_length=2000)
    measurements: dict[str, Number] = Field(default_factory=dict, max_length=20)
    unit: str | None = Field(default=None, max_length=30)

    @field_validator("observed_at")
    @classmethod
    def aware_past(cls, value):
        if value.tzinfo is None or value > datetime.now(timezone.utc):
            raise ValueError("Observation time must be timezone-aware and not future")
        return value.astimezone(timezone.utc)

    @field_validator("measurements")
    @classmethod
    def measured_bounds(cls, value):
        if any(len(k) > 50 or not 0 <= v <= 1_000_000_000 for k, v in value.items()):
            raise ValueError("Invalid measured values")
        return value

    @model_validator(mode="after")
    def outcome_units(self):
        definitions = {
            "harvest": ("quantity_kg", "kg"),
            "actual_cost": ("cost_inr", "INR"),
            "market_sale": ("sale_price_inr_per_kg", "INR/kg"),
            "crop_loss": ("loss_percent", "%"),
            "irrigation": ("water_litres", "L"),
            "fertilizer_action": ("fertilizer_kg", "kg"),
            "satisfaction": ("rating", "1–5"),
            "advisory_usefulness": ("rating", "1–5"),
        }
        if self.kind in definitions and self.measurements:
            key, unit = definitions[self.kind]
            if set(self.measurements) != {key} or self.unit != unit:
                raise ValueError("Use the documented measurement name and unit for this outcome")
            if self.kind == "crop_loss" and self.measurements[key] > 100:
                raise ValueError("Loss percentage must be within 0–100")
            if self.kind in {"satisfaction", "advisory_usefulness"} and not 1 <= self.measurements[key] <= 5:
                raise ValueError("Rating must be within 1–5")
        return self


class CycleUpdate(CycleInput):
    revision: StrictInt = Field(ge=1)


class ConsentInput(Input):
    purpose: Purpose
    granted: bool = Field(strict=True)
    policy_version: Literal["2026-10-03"]


class FeedbackInput(Input):
    operation_id: UUID = Field(default_factory=uuid4)
    image_id: UUID
    verdict: Literal["yes", "no", "unsure"]
    note: str | None = Field(default=None, max_length=2000)


class ReviewInput(Input):
    operation_id: UUID = Field(default_factory=uuid4)
    corrected_class: str = Field(min_length=1, max_length=150)
    note: str = Field(min_length=1, max_length=2000)
