"""Relational owner-scoped records. Schema changes require Alembic migrations."""

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Record:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Farmer(Record, Base):
    __tablename__ = "v2_farmers"
    # Verified sign-in number (OTP). Passkey accounts may only have an
    # unverified contact number, which is never an identity or uniqueness key.
    mobile: Mapped[str | None] = mapped_column(String(16), unique=True)
    contact_mobile: Mapped[str | None] = mapped_column(String(16))
    display_name: Mapped[str] = mapped_column(String(100), default="Farmer")
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    state: Mapped[str | None] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(100))
    village: Mapped[str | None] = mapped_column(String(100))
    state_code: Mapped[int | None] = mapped_column(Integer)
    district_code: Mapped[int | None] = mapped_column(Integer)
    subdistrict: Mapped[str | None] = mapped_column(String(100))
    pin_code: Mapped[str | None] = mapped_column(String(6))
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(20), default="active")
    role: Mapped[str] = mapped_column(String(30), default="farmer")


class GovernmentIdentity(Record, Base):
    __tablename__ = "v2_government_identities"
    __table_args__ = (UniqueConstraint("issuer", "subject_hash"), UniqueConstraint("farmer_id", "issuer"))
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    issuer: Mapped[str] = mapped_column(String(200))
    subject_hash: Mapped[str] = mapped_column(String(64))


class AuthChallenge(Record, Base):
    __tablename__ = "v2_auth_challenges"
    mobile: Mapped[str] = mapped_column(String(16), index=True)
    provider: Mapped[str] = mapped_column(String(20))
    provider_reference: Mapped[str | None] = mapped_column(String(100))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class Passkey(Record, Base):
    __tablename__ = "v2_passkeys"
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    credential_id: Mapped[str] = mapped_column(String(1400), unique=True)
    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    transports: Mapped[list] = mapped_column(JSONB, default=list)
    device_label: Mapped[str] = mapped_column(String(100), default="This phone")
    backed_up: Mapped[bool] = mapped_column(Boolean, default=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RecoveryCode(Record, Base):
    __tablename__ = "v2_recovery_codes"
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), unique=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)


class WebAuthnChallenge(Record, Base):
    __tablename__ = "v2_webauthn_challenges"
    purpose: Mapped[str] = mapped_column(String(20))
    challenge: Mapped[str] = mapped_column(String(200), unique=True)
    origin: Mapped[str] = mapped_column(String(300))
    farmer_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class Session(Record, Base):
    __tablename__ = "v2_sessions"
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    refresh_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    authenticated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Consent(Record, Base):
    __tablename__ = "v2_consents"
    __table_args__ = (
        Index(
            "ix_v2_active_consent", "farmer_id", "purpose", unique=True, postgresql_where=text("withdrawn_at IS NULL")
        ),
    )
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(50))
    categories: Mapped[list] = mapped_column(JSONB, default=list)
    policy_version: Mapped[str] = mapped_column(String(30))
    consent_version: Mapped[str] = mapped_column(String(30))
    collection_surface: Mapped[str] = mapped_column(String(50))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Farm(Record, Base):
    __tablename__ = "v2_farms"
    __table_args__ = (UniqueConstraint("farmer_id", "operation_id"),)
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(200))
    ownership: Mapped[str | None] = mapped_column(String(30))
    operation_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class Plot(Record, Base):
    __tablename__ = "v2_plots"
    __table_args__ = (UniqueConstraint("farm_id", "operation_id"),)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farms.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    boundary: Mapped[object | None] = mapped_column(Geometry("POLYGON", srid=4326))
    centroid: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    # Rounded (~1 km) farmer-confirmed field location for weather and markets
    # when no boundary is drawn. Never used for satellite field statistics.
    approximate_location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326, spatial_index=False))
    area_hectares: Mapped[float | None] = mapped_column(Numeric(14, 6))
    entered_area_hectares: Mapped[float | None] = mapped_column(Numeric(14, 6))
    boundary_quality: Mapped[str] = mapped_column(String(20), default="manual")
    irrigation_type: Mapped[str | None] = mapped_column(String(50))
    soil_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    operation_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)


class CropCycle(Record, Base):
    __tablename__ = "v2_crop_cycles"
    __table_args__ = (UniqueConstraint("plot_id", "operation_id"),)
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("v2_plots.id", ondelete="CASCADE"), index=True)
    crop: Mapped[str] = mapped_column(String(100))
    crop_id: Mapped[str | None] = mapped_column(String(50))
    variety: Mapped[str | None] = mapped_column(String(100))
    sowing_date: Mapped[date] = mapped_column(Date)
    expected_harvest: Mapped[date] = mapped_column(Date)
    growth_stage: Mapped[str | None] = mapped_column(String(50))
    season: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="active")
    identity_source: Mapped[str] = mapped_column(String(30), default="farmer_entered")
    operation_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class Observation(Record, Base):
    __tablename__ = "v2_observations"
    __table_args__ = (
        UniqueConstraint("plot_id", "operation_id"),
        Index("ix_v2_observation_timeline", "plot_id", "observed_at", "kind"),
    )
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("v2_plots.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(40))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_type: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSONB)
    provenance: Mapped[dict] = mapped_column(JSONB, default=dict)
    operation_id: Mapped[UUID] = mapped_column(Uuid)
    payload_hash: Mapped[str] = mapped_column(String(64))


class ImageAsset(Record, Base):
    __tablename__ = "v2_images"
    __table_args__ = (UniqueConstraint("farmer_id", "operation_id"),)
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_plots.id", ondelete="CASCADE"), index=True)
    object_key: Mapped[str] = mapped_column(String(300), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    mime: Mapped[str] = mapped_column(String(50))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    research_consent_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_consents.id", ondelete="SET NULL"))
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    operation_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)


class Feedback(Record, Base):
    __tablename__ = "v2_feedback"
    __table_args__ = (UniqueConstraint("farmer_id", "operation_id"),)
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    image_id: Mapped[UUID] = mapped_column(ForeignKey("v2_images.id", ondelete="CASCADE"), index=True)
    verdict: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    corrected_class: Mapped[str | None] = mapped_column(String(150))
    reviewer_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_farmers.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    operation_id: Mapped[UUID] = mapped_column(Uuid, default=uuid4)


class Job(Record, Base):
    __tablename__ = "v2_jobs"
    __table_args__ = (UniqueConstraint("plot_id", "operation_id"),)
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("v2_plots.id", ondelete="CASCADE"), index=True)
    operation_id: Mapped[UUID] = mapped_column(Uuid)
    kind: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    leased_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(100))


class AuditLog(Record, Base):
    __tablename__ = "v2_audit_log"
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_farmers.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(100))
    target_id: Mapped[UUID | None] = mapped_column(Uuid)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)


class ObjectDeletion(Record, Base):
    """Durable storage cleanup survives deletion of the account/plot rows."""

    __tablename__ = "v2_object_deletions"
    object_key: Mapped[str] = mapped_column(String(300), unique=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)


class PilotCohort(Record, Base):
    __tablename__ = "v2_pilot_cohorts"
    name: Mapped[str] = mapped_column(String(100))
    organisation_admin_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    district: Mapped[str] = mapped_column(String(100))
    crops: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="planned")


class PilotEnrollment(Record, Base):
    __tablename__ = "v2_pilot_enrollments"
    __table_args__ = (UniqueConstraint("cohort_id", "farmer_id"),)
    cohort_id: Mapped[UUID] = mapped_column(ForeignKey("v2_pilot_cohorts.id", ondelete="CASCADE"), index=True)
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    consent_id: Mapped[UUID] = mapped_column(ForeignKey("v2_consents.id", ondelete="CASCADE"))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    plot_ids: Mapped[list] = mapped_column(JSONB, default=list)


class Notification(Record, Base):
    __tablename__ = "v2_notifications"
    __table_args__ = (UniqueConstraint("farmer_id", "operation_id"),)
    farmer_id: Mapped[UUID] = mapped_column(ForeignKey("v2_farmers.id", ondelete="CASCADE"), index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("v2_plots.id", ondelete="CASCADE"))
    operation_id: Mapped[UUID] = mapped_column(Uuid)
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSONB)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MarketPrice(Record, Base):
    """Public AGMARKNET wholesale quotes, kept to compute dated price trends."""

    __tablename__ = "v2_market_prices"
    __table_args__ = (
        UniqueConstraint("arrival_date", "state", "district", "market", "commodity", "variety", "grade"),
        Index("ix_v2_market_prices_lookup", "commodity", "state", "district", "arrival_date"),
    )
    arrival_date: Mapped[date] = mapped_column(Date)
    state: Mapped[str] = mapped_column(String(150))
    district: Mapped[str] = mapped_column(String(150))
    market: Mapped[str] = mapped_column(String(150))
    commodity: Mapped[str] = mapped_column(String(100))
    variety: Mapped[str] = mapped_column(String(100))
    grade: Mapped[str] = mapped_column(String(50))
    min_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    max_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    modal_price: Mapped[float] = mapped_column(Numeric(12, 2))
    source_resource: Mapped[str] = mapped_column(String(64))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MarketFetch(Base):
    """When a public market scope was last requested from the provider."""

    __tablename__ = "v2_market_fetches"
    scope: Mapped[str] = mapped_column(String(64), primary_key=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20))


class WorkerHeartbeat(Base):
    __tablename__ = "v2_worker_heartbeat"
    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
