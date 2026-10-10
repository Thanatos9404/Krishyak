"""Explicit deployment settings; production never selects demo identity."""

import os
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


def psycopg_url(value):
    """Accept provider-standard URLs (Neon, Vercel Postgres) for the psycopg driver."""
    value = (value or "").strip()
    for prefix in ("postgres://", "postgresql://"):
        if value.startswith(prefix):
            return "postgresql+psycopg://" + value[len(prefix) :]
    return value


def database_url_from_env():
    return os.getenv("V2_DATABASE_URL") or psycopg_url(os.getenv("DATABASE_URL", ""))


def migration_url_from_env():
    """Migrations use a direct connection; transaction poolers break DDL locks."""
    return (
        os.getenv("V2_MIGRATION_DATABASE_URL")
        or psycopg_url(os.getenv("DATABASE_URL_UNPOOLED", ""))
        or database_url_from_env()
    )


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    environment: Literal["development", "test", "staging", "production"] = "development"
    hosted: bool = False
    database_url: SecretStr = SecretStr("")
    auth_secret: SecretStr = SecretStr("")
    origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    otp_provider: Literal["disabled", "development", "twilio"] = "disabled"
    dev_mobiles: list[str] = Field(default_factory=list)
    twilio_account: SecretStr = SecretStr("")
    twilio_token: SecretStr = SecretStr("")
    twilio_service: str = ""
    passkey_enabled: bool = True
    storage_provider: Literal["local", "s3", "vercel_blob"] = "local"
    storage_root: Path = Path(__file__).resolve().parents[1] / "data" / "v2-objects"
    s3_bucket: str = ""
    s3_endpoint: str = ""
    blob_token: SecretStr = SecretStr("")
    redis_url: SecretStr = SecretStr("")
    session_seconds: int = Field(default=1800, ge=300, le=3600)
    refresh_seconds: int = Field(default=604800, ge=3600, le=2592000)
    image_retention_days: int = Field(default=365, ge=1, le=3650)
    audit_retention_days: int = Field(default=180, ge=30, le=3650)
    satellite_schedule_enabled: bool = False
    satellite_schedule_plots_per_day: int = Field(default=10, ge=1, le=50)
    worker_stale_seconds: int = Field(default=600, ge=600, le=3600)
    # "dedicated" runs `python -m v2.worker`; "request" drains the durable queue
    # inside API invocations plus an authenticated scheduled trigger (serverless).
    worker_mode: Literal["dedicated", "request"] = "dedicated"
    cron_secret: SecretStr = SecretStr("")

    @property
    def deployed(self) -> bool:
        return self.hosted or self.environment in {"staging", "production"}

    @model_validator(mode="after")
    def deployment_contract(self):
        if not self.enabled:
            return self
        if not self.database_url.get_secret_value().startswith("postgresql+psycopg://"):
            raise ValueError("V2 requires a PostgreSQL psycopg database URL")
        if len(self.auth_secret.get_secret_value()) < 32:
            raise ValueError("V2_AUTH_SECRET must have at least 32 characters")
        if not self.origins or any(x == "*" or not x.startswith(("https://", "http://")) for x in self.origins):
            raise ValueError("Explicit browser origins are required")
        if any(
            urlsplit(origin).path not in {"", "/"}
            or urlsplit(origin).query
            or urlsplit(origin).fragment
            or urlsplit(origin).username
            or not urlsplit(origin).hostname
            for origin in self.origins
        ):
            raise ValueError("Browser origins must be exact origins without paths or credentials")
        if self.otp_provider == "development" and (self.deployed or not self.dev_mobiles):
            raise ValueError("Development OTP requires fixed test identities in development/test")
        if self.worker_mode == "request" and len(self.cron_secret.get_secret_value()) < 32:
            raise ValueError("Request worker mode requires a CRON_SECRET of at least 32 characters")
        if self.storage_provider == "vercel_blob" and not self.blob_token.get_secret_value().startswith(
            "vercel_blob_rw_"
        ):
            raise ValueError("Vercel Blob storage requires a read-write store token")
        if self.otp_provider == "twilio" and not all(
            (self.twilio_account.get_secret_value(), self.twilio_token.get_secret_value(), self.twilio_service)
        ):
            raise ValueError("Twilio Verify credentials are required")
        if self.deployed:
            if parse_qs(urlsplit(self.database_url.get_secret_value()).query).get("sslmode", [""])[0] not in {
                "require",
                "verify-ca",
                "verify-full",
            }:
                raise ValueError("Deployed PostgreSQL requires TLS")
            if self.otp_provider != "twilio" and not self.passkey_enabled:
                raise ValueError("Deployed V2 requires passkey sign-in or production OTP")
            if self.otp_provider == "development":
                raise ValueError("Development OTP is prohibited in deployments")
            if (
                not ((self.storage_provider == "s3" and self.s3_bucket) or self.storage_provider == "vercel_blob")
                or not self.redis_url.get_secret_value()
            ):
                raise ValueError("Deployed V2 requires private object storage and Redis")
            if any(not x.startswith("https://") for x in self.origins):
                raise ValueError("Deployed browser origins must use HTTPS")
            if self.s3_endpoint and not self.s3_endpoint.startswith("https://"):
                raise ValueError("Deployed object storage must use HTTPS")
            if not self.redis_url.get_secret_value().startswith("rediss://"):
                raise ValueError("Deployed Redis requires TLS")
        return self

    @classmethod
    def from_env(cls):
        hosted = os.getenv("VERCEL") == "1" or os.getenv("RENDER") == "true" or bool(os.getenv("RENDER_SERVICE_ID"))
        return cls(
            enabled=os.getenv("KRISHYAK_V2_ENABLED", "false").lower() == "true",
            environment=os.getenv("ENVIRONMENT", "production" if hosted else "development"),
            hosted=hosted,
            database_url=database_url_from_env(),
            auth_secret=os.getenv("V2_AUTH_SECRET", ""),
            origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()],
            otp_provider=os.getenv("V2_OTP_PROVIDER", "disabled"),
            dev_mobiles=[x.strip() for x in os.getenv("V2_DEV_MOBILES", "").split(",") if x.strip()],
            twilio_account=os.getenv("TWILIO_ACCOUNT_SID", ""),
            twilio_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
            twilio_service=os.getenv("TWILIO_VERIFY_SERVICE_SID", ""),
            storage_provider=os.getenv("V2_STORAGE_PROVIDER", "local"),
            storage_root=os.getenv("V2_STORAGE_ROOT") or str(cls.model_fields["storage_root"].default),
            s3_bucket=os.getenv("V2_S3_BUCKET", ""),
            s3_endpoint=os.getenv("V2_S3_ENDPOINT", ""),
            blob_token=os.getenv("BLOB_READ_WRITE_TOKEN", ""),
            passkey_enabled=os.getenv("V2_PASSKEY_ENABLED", "true").lower() == "true",
            # Upstash on Vercel provides KV_URL / REDIS_URL (rediss://).
            redis_url=os.getenv("V2_REDIS_URL") or os.getenv("KV_URL") or os.getenv("REDIS_URL", ""),
            image_retention_days=os.getenv("V2_IMAGE_RETENTION_DAYS") or 365,
            audit_retention_days=os.getenv("V2_AUDIT_RETENTION_DAYS") or 180,
            satellite_schedule_enabled=os.getenv("V2_SATELLITE_SCHEDULE_ENABLED", "false").lower() == "true",
            satellite_schedule_plots_per_day=os.getenv("V2_SATELLITE_SCHEDULE_PLOTS_PER_DAY") or 10,
            worker_stale_seconds=os.getenv("V2_WORKER_STALE_SECONDS") or 600,
            worker_mode=os.getenv("V2_WORKER_MODE") or ("request" if os.getenv("VERCEL") == "1" else "dedicated"),
            cron_secret=os.getenv("CRON_SECRET", ""),
        )
