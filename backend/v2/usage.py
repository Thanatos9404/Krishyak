"""Shared provider budgets so credentials cannot be drained across instances.

Every provider-spending path is limited per caller, per day and (for metered
services) per month in Redis, before any provider request is made. Limits are
deliberately below the free allowances of each service; raise them only after
the operator confirms the provider plan.
"""

import os

from fastapi import HTTPException

from remote_sensing.providers.base import ProviderError

# Copernicus Sentinel Hub requests per satellite operation (preview = quality
# statistics + image; acquisitions = up to three catalog pages).
SATELLITE_COST = {"preview": 2, "acquisitions": 3}


def limit(name, default):
    try:
        return max(1, int(os.getenv(name, default)))
    except ValueError:
        return default


def satellite_budget(quotas):
    per_minute = limit("REMOTE_SENSING_IP_PER_MINUTE", 6)
    per_day = limit("REMOTE_SENSING_IP_PER_DAY", 60)
    global_day = limit("REMOTE_SENSING_GLOBAL_PER_DAY", 300)
    # The CDSE general-user allowance is about 10,000 requests a month.
    global_month = limit("REMOTE_SENSING_GLOBAL_PER_MONTH", 9000)

    def check(operation, identity):
        cost = SATELLITE_COST.get(operation, 1)
        try:
            quotas.check("cdse_caller_minute", identity, per_minute, 60, amount=cost)
            quotas.check("cdse_caller_day", identity, per_day, 86400, amount=cost)
            quotas.check("cdse_global_day", "global", global_day, 86400, amount=cost)
            quotas.check("cdse_global_month", "global", global_month, 30 * 86400, amount=cost)
        except HTTPException as error:
            if error.status_code == 429:
                raise ProviderError("local_quota", "Satellite request limit reached; retry later", 429, 60) from None
            raise ProviderError("usage_controls", "Satellite usage controls are unavailable", 503) from None

    return check


def public_budget(quotas, path, identity):
    """Per-caller and global limits for unauthenticated public routes."""
    quotas.check("public_minute", identity, limit("RATE_LIMIT_PER_MINUTE", 60), 60)
    quotas.check("public_day", identity, limit("RATE_LIMIT_PER_DAY", 1000), 86400)
    if path.startswith("/weather/") or path.startswith("/remote-sensing/climate"):
        # Open-Meteo's free tier allows 10,000 calls a day; keep public use well below.
        quotas.check("open_meteo_public", "global", limit("OPEN_METEO_PUBLIC_PER_DAY", 4000), 86400)
    if path in {"/detect_disease", "/simulate", "/compare_scenarios", "/recommend"}:
        # CPU-bound model and Monte Carlo endpoints.
        quotas.check("compute_caller_minute", identity, 10, 60)
