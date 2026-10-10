"""Live smoke checks against a deployed Krishyak API (staging or production).

Reads secrets from ignored local files only and never prints them:
  .codex-tmp/staging-secrets.env  CRON_SECRET, KRISHYAK_API_PROTECTION_BYPASS

Usage:
  python scripts/smoke_staging.py --api https://krishyak-api-staging.vercel.app \
      --origin https://krishyak-staging.vercel.app
Exit code is non-zero if any required check fails.
"""

import argparse
import json
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", required=True)
    parser.add_argument("--origin", required=True)
    parser.add_argument("--secrets", default=str(ROOT / ".codex-tmp/staging-secrets.env"))
    args = parser.parse_args()
    secrets = dotenv_values(args.secrets)
    headers = {"Origin": args.origin}
    if secrets.get("KRISHYAK_API_PROTECTION_BYPASS"):
        headers["x-vercel-protection-bypass"] = secrets["KRISHYAK_API_PROTECTION_BYPASS"]
    results, failed = [], False

    def check(name, ok, detail="", required=True):
        nonlocal failed
        failed |= required and not ok
        results.append({"check": name, "pass": bool(ok), "required": required, "detail": detail})

    with httpx.Client(base_url=args.api, headers=headers, timeout=60, follow_redirects=False) as client:
        live = client.get("/health/live")
        check("liveness", live.status_code == 200, live.status_code)
        ready = client.get("/health/ready")
        body = ready.json() if ready.headers.get("content-type", "").startswith("application/json") else {}
        check("readiness with v2 enabled", ready.status_code == 200 and body.get("v2") == "enabled", body)
        status = client.get("/api/v2/status").json()
        check("passkey sign-in available", status.get("passkey_available") is True, status)
        check("no development identities", status.get("development_identity") is False, status)
        check("satellite configured", status.get("satellite_configuration") == "ready", status)
        model = client.get("/api/v2/model")
        check("disease model release", model.status_code == 200 and model.json().get("supported_crops"), model.status_code)
        denied = client.get("/api/v2/internal/worker")
        check("worker trigger hidden without secret", denied.status_code == 404, denied.status_code)
        if secrets.get("CRON_SECRET"):
            run = client.get("/api/v2/internal/worker", headers={"Authorization": f"Bearer {secrets['CRON_SECRET']}"})
            check("worker trigger runs with secret", run.status_code == 200, run.json() if run.status_code == 200 else run.status_code)
        market = client.get("/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"})
        data = market.json() if market.status_code == 200 else {}
        check("market endpoint responds honestly", market.status_code == 200 and data.get("status") in {"available", "stale", "unavailable"}, data.get("status"))
        check("live mandi data available", data.get("status") == "available", data.get("providers"), required=False)
        legacy = client.get("/register-farmer")
        check("removed legacy personal-data route", legacy.status_code in {404, 405, 410}, legacy.status_code)
        sat = client.post("/remote-sensing/timeseries", json={})
        check("public satellite route needs an account", sat.status_code == 401, sat.status_code)
    print(json.dumps({"api": args.api, "results": results}, indent=2, default=str))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
