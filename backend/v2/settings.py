"""Explicit deployment settings; production never selects demo identity."""

import os
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: SecretStr = SecretStr("")
    auth_secret: SecretStr = SecretStr("")
    origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    otp_provider: Literal["disabled", "development", "twilio"] = "disabled"
    dev_mobiles: list[str] = Field(default_factory=list)
    twilio_account: SecretStr = SecretStr("")
    twilio_token: SecretStr = SecretStr("")
    twilio_service: str = ""
    storage_provider: Literal["local", "s3"] = "local"
    storage_root: Path = Path(__file__).resolve().parents[1] / "data" / "v2-objects"
    s3_bucket: str = ""
    s3_endpoint: str = ""
    redis_url: SecretStr = SecretStr("")
    session_seconds: int = Field(default=1800, ge=300, le=3600)
    refresh_seconds: int = Field(default=604800, ge=3600, le=2592000)
    image_retention_days: int = Field(default=365, ge=1, le=3650)
    audit_retention_days: int = Field(default=180, ge=30, le=3650)
    satellite_schedule_enabled: bool = False
    satellite_schedule_plots_per_day: int = Field(default=10, ge=1, le=50)

    @property
    def deployed(self) -> bool:
        return self.environment in {"staging", "production"}

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
            if (
                self.otp_provider != "twilio"
                or self.storage_provider != "s3"
                or not self.s3_bucket
                or not self.redis_url.get_secret_value()
            ):
                raise ValueError("Deployed V2 requires production OTP, private S3 storage and Redis")
            if any(not x.startswith("https://") for x in self.origins):
                raise ValueError("Deployed browser origins must use HTTPS")
            if self.s3_endpoint and not self.s3_endpoint.startswith("https://"):
                raise ValueError("Deployed object storage must use HTTPS")
            if not self.redis_url.get_secret_value().startswith("rediss://"):
                raise ValueError("Deployed Redis requires TLS")
        return self

    @classmethod
    def from_env(cls):
        return cls(
            enabled=os.getenv("KRISHYAK_V2_ENABLED", "false").lower() == "true",
            environment=os.getenv("ENVIRONMENT", "development"),
            database_url=os.getenv("V2_DATABASE_URL", ""),
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
            redis_url=os.getenv("V2_REDIS_URL", ""),
            image_retention_days=os.getenv("V2_IMAGE_RETENTION_DAYS") or 365,
            audit_retention_days=os.getenv("V2_AUDIT_RETENTION_DAYS") or 180,
            satellite_schedule_enabled=os.getenv("V2_SATELLITE_SCHEDULE_ENABLED", "false").lower() == "true",
            satellite_schedule_plots_per_day=os.getenv("V2_SATELLITE_SCHEDULE_PLOTS_PER_DAY") or 10,
        )
