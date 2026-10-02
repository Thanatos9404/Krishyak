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
    mobile: Mapped[str] = mapped_column(String(16), unique=True)
    display_name: Mapped[str] = mapped_column(String(100), default="Farmer")
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    state: Mapped[str | None] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(100))
    village: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(20), default="active")
    role: Mapped[str] = mapped_column(String(30), default="farmer")


class AuthChallenge(Record, Base):
    __tablename__ = "v2_auth_challenges"
    mobile: Mapped[str] = mapped_column(String(16), index=True)
    provider: Mapped[str] = mapped_column(String(20))
    provider_reference: Mapped[str | None] = mapped_column(String(100))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
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


class WorkerHeartbeat(Base):
    __tablename__ = "v2_worker_heartbeat"
    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
