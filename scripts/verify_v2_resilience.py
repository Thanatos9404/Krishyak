"""Local Docker outage/recovery drill; never controls public services."""

import argparse
import json
import subprocess
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=ROOT / ".codex-tmp/v2-local.env")
    args = parser.parse_args()
    settings = dotenv_values(args.env)
    if settings.get("ENVIRONMENT") not in {"test", "development"} or make_url(
        settings["V2_DATABASE_URL"]
    ).host not in {"127.0.0.1", "localhost"}:
        parser.error("Only loopback development/test settings are allowed")
    command = [
        "docker",
        "compose",
        "--project-name",
        "krishyak-v2",
        "--env-file",
        str(args.env),
        "-f",
        str(ROOT / "docker-compose.v2.yml"),
    ]

    def compose(action, service):
        subprocess.run(
            command + [action, service],
            cwd=ROOT,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    results = {}
    with httpx.Client(base_url="http://127.0.0.1:18000", timeout=15) as client:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            try:
                if client.get("/health/ready").status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("Local API did not become ready before the drill")
        assert (
            client.get("/api/v2/status")
            .raise_for_status()
            .json()["development_identity"]
        )
        for service in ["redis", "db"]:
            before = time.time()
            try:
                compose("stop", service)
                readiness = client.get("/health/ready")
                assert readiness.status_code == 503, (
                    f"{service} outage must reject readiness"
                )
                if service == "redis":
                    assert client.get("/api/v2/me").status_code == 503, (
                        "Redis outage must fail closed"
                    )
            finally:
                compose("start", service)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                try:
                    if client.get("/health/ready").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(1)
            else:
                raise RuntimeError("Readiness did not recover")
            results[service] = {
                "outage_readiness": 503,
                "recovered_readiness": 200,
                "drill_seconds": round(time.time() - before, 2),
            }
        engine = create_engine(
            settings["V2_DATABASE_URL"], connect_args={"connect_timeout": 5}
        )
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                with engine.connect() as connection:
                    age = connection.scalar(
                        text(
                            "SELECT extract(epoch FROM now()-seen_at) FROM v2_worker_heartbeat WHERE name='evidence-worker'"
                        )
                    )
                if age is not None and float(age) < 10:
                    results["worker"] = {
                        "recovered": True,
                        "heartbeat_age_seconds": round(float(age), 2),
                    }
                    break
                time.sleep(1)
            else:
                raise RuntimeError(
                    "Worker heartbeat did not recover after storage outage"
                )
        finally:
            engine.dispose()
    output = ROOT / "output/local-resilience.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "scope": "isolated local Docker PostGIS/Redis/API/worker",
        "results": results,
        "limitations": ["Not a public production fault-injection or SLA test"],
    }
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
