"""Optional public sources. Restricted integrations never enable themselves."""

import os

from pydantic import BaseModel, SecretStr


class ProviderSettings(BaseModel):
    nominatim_enabled: bool = False
    imd_enabled: bool = False
    soilgrids_enabled: bool = False
    # Bhuvan's public WMS timed out from India and from Vercel in November 2026 and
    # only confirmed a map catalogue exists, so it is off unless switched on.
    bhuvan_enabled: bool = False
    ogd_key: SecretStr = SecretStr("")

    @classmethod
    def from_env(cls):
        return cls(
            nominatim_enabled=os.getenv("FARM_CONTEXT_NOMINATIM_ENABLED", "false").lower() == "true",
            imd_enabled=os.getenv("FARM_CONTEXT_IMD_APPROVED", "false").lower() == "true",
            soilgrids_enabled=os.getenv("FARM_CONTEXT_SOILGRIDS_ENABLED", "false").lower() == "true",
            bhuvan_enabled=os.getenv("FARM_CONTEXT_BHUVAN_ENABLED", "false").lower() == "true",
            ogd_key=os.getenv("DATA_GOV_IN_API_KEY", ""),
        )
