"""Operator-only aggregate health inventory; never prints farmer records or credentials."""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    from db.session import make_database
    from dotenv import dotenv_values
    from sqlalchemy import text
    from v2.settings import Settings

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, required=True)
    args = parser.parse_args()
    os.environ.update(
        {
            key: value
            for key, value in dotenv_values(args.env).items()
            if value is not None
        }
    )
    settings = Settings.from_env()
    if not settings.enabled:
        parser.error("An enabled configured database is required")
    engine, _ = make_database(settings)
    try:
        with engine.connect() as connection:
            age = connection.scalar(
                text(
                    "SELECT extract(epoch FROM now()-seen_at) FROM v2_worker_heartbeat WHERE name='evidence-worker'"
                )
            )
            summary = {
                "schema": connection.scalar(
                    text("SELECT version_num FROM alembic_version")
                ),
                "database_bytes": connection.scalar(
                    text("SELECT pg_database_size(current_database())")
                ),
                "jobs_by_status": dict(
                    connection.execute(
                        text("SELECT status,count(*) FROM v2_jobs GROUP BY status")
                    ).all()
                ),
                "object_cleanup_by_status": dict(
                    connection.execute(
                        text(
                            "SELECT status,count(*) FROM v2_object_deletions GROUP BY status"
                        )
                    ).all()
                ),
                "worker_heartbeat_age_seconds": float(age) if age is not None else None,
                "expired_running_leases": connection.scalar(
                    text(
                        "SELECT count(*) FROM v2_jobs WHERE status='running' AND leased_until < now()"
                    )
                ),
            }
        print(json.dumps(summary, indent=2))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
