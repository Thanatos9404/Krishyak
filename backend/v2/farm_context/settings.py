"""Optional public sources. Restricted integrations never enable themselves."""

import os

from pydantic import BaseModel, SecretStr


class ProviderSettings(BaseModel):
    nominatim_enabled: bool = False
    imd_enabled: bool = False
    soilgrids_enabled: bool = False
    bhuvan_enabled: bool = True
    ogd_key: SecretStr = SecretStr("")

    @classmethod
    def from_env(cls):
        return cls(
            nominatim_enabled=os.getenv("FARM_CONTEXT_NOMINATIM_ENABLED", "false").lower() == "true",
            imd_enabled=os.getenv("FARM_CONTEXT_IMD_APPROVED", "false").lower() == "true",
            soilgrids_enabled=os.getenv("FARM_CONTEXT_SOILGRIDS_ENABLED", "false").lower() == "true",
            bhuvan_enabled=os.getenv("FARM_CONTEXT_BHUVAN_ENABLED", "true").lower() == "true",
            ogd_key=os.getenv("DATA_GOV_IN_API_KEY", ""),
        )
