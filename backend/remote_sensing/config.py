"""Bounded, server-only configuration. Invalid configuration fails closed."""
import os
from dataclasses import dataclass, field


def integer(name, default, lower, upper):
    try:
        return max(lower, min(upper, int(os.getenv(name, str(default)))))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    enabled: bool = False
    provider: str = "cdse"
    client_id: str = field(default="", repr=False)
    client_secret: str = field(default="", repr=False)
    max_area_ha: int = 500
    cache_ttl: int = 3600
    image_ttl: int = 1800
    per_minute: int = 6
    per_day: int = 60
    global_per_day: int = 300
    decision_influence: bool = False

    @classmethod
    def from_env(cls):
        return cls(
            enabled=os.getenv("REMOTE_SENSING_ENABLED", "false").lower() == "true",
            provider=os.getenv("REMOTE_SENSING_PROVIDER", "cdse"),
            client_id=os.getenv("CDSE_CLIENT_ID", "").strip(),
            client_secret=os.getenv("CDSE_CLIENT_SECRET", "").strip(),
            max_area_ha=integer("REMOTE_SENSING_MAX_AREA_HA", 500, 1, 500),
            cache_ttl=integer("REMOTE_SENSING_CACHE_TTL", 3600, 60, 86400),
            image_ttl=integer("REMOTE_SENSING_IMAGE_TTL", 1800, 60, 86400),
            per_minute=integer("REMOTE_SENSING_IP_PER_MINUTE", 6, 1, 30),
            per_day=integer("REMOTE_SENSING_IP_PER_DAY", 60, 1, 500),
            global_per_day=integer("REMOTE_SENSING_GLOBAL_PER_DAY", 300, 1, 3000),
            decision_influence=os.getenv("REMOTE_SENSING_DECISION_INFLUENCE", "false").lower() == "true",
        )
