"""Bounded synthetic local load check; refuses public hosts and real identity providers."""

import argparse
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:18000")
    parser.add_argument("--output", type=Path, default=Path("output/local-load.json"))
    args = parser.parse_args()
    if urlsplit(args.url).hostname not in {"127.0.0.1", "localhost"}:
        parser.error("Only loopback synthetic testing is permitted")
    with httpx.Client(
        base_url=args.url, timeout=30, headers={"Origin": "http://localhost:3000"}
    ) as client:
        state = client.get("/api/v2/status").raise_for_status().json()
        if not state.get("development_identity"):
            raise RuntimeError(
                "Synthetic development identity is required; no SMS is sent"
            )
        challenge = (
            client.post("/api/v2/auth/request-otp", json={"mobile": "+919000000003"})
            .raise_for_status()
            .json()
        )
        session = (
            client.post(
                "/api/v2/auth/verify-otp",
                json={
                    "challenge_id": challenge["challenge_id"],
                    "code": "123456",
                    "accept_policy_version": "2026-10-03",
                },
            )
            .raise_for_status()
            .json()
        )
        client.headers["X-CSRF-Token"] = session["csrf_token"]
        farm_id = None
        try:
            farm = (
                client.post(
                    "/api/v2/farms",
                    json={
                        "name": "Synthetic local load verification",
                        "operation_id": str(uuid4()),
                    },
                )
                .raise_for_status()
                .json()
            )
            farm_id = farm["id"]
            plot = (
                client.post(
                    "/api/v2/plots",
                    json={
                        "name": "Synthetic manual field",
                        "farm_id": farm_id,
                        "entered_area_hectares": 1,
                        "operation_id": str(uuid4()),
                    },
                )
                .raise_for_status()
                .json()
            )
            path = f"/api/v2/plots/{plot['id']}/today"

            def read(_):
                start = time.perf_counter()
                response = client.get(path)
                if response.status_code == 200:
                    assert response.json()["plot_id"] == plot["id"]
                return response.status_code, (time.perf_counter() - start) * 1000

            start = time.perf_counter()
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(read, range(100)))
            elapsed = time.perf_counter() - start
            assert all(code == 200 for code, _ in results), (
                "Local read errors; see status counts"
            )
            latencies = sorted(ms for _, ms in results)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            report = {
                "scope": "100 authenticated synthetic Today reads, 8 concurrent clients, loopback Docker",
                "requests": len(results),
                "errors": sum(code != 200 for code, _ in results),
                "elapsed_seconds": round(elapsed, 3),
                "requests_per_second": round(100 / elapsed, 2),
                "latency_p50_ms": round(statistics.median(latencies), 2),
                "latency_p95_ms": round(latencies[94], 2),
                "latency_max_ms": round(max(latencies), 2),
                "limitations": [
                    "Local synthetic storage/read workload only",
                    "No provider, image, production-scale or availability claim",
                ],
            }
            args.output.write_text(
                json.dumps(report, indent=2) + "\n", encoding="utf-8"
            )
            print(json.dumps(report))
        finally:
            if farm_id:
                client.delete(f"/api/v2/farms/{farm_id}").raise_for_status()
            client.post("/api/v2/auth/logout").raise_for_status()


if __name__ == "__main__":
    main()
