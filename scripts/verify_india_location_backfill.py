"""Verify real historical LGD backfill only on the fixed empty migration-test DB."""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]


def main():
    values = dotenv_values(ROOT / ".codex-tmp/v2-local.env")
    source = make_url(values["V2_DATABASE_URL"])
    if (
        source.host != "127.0.0.1"
        or source.port != 55432
        or values["ENVIRONMENT"] not in {"development", "test"}
    ):
        raise SystemExit(
            "Only the explicitly local disposable migration database is allowed"
        )
    target = source.set(database="krishyak_v2_migration_test")
    engine = create_engine(target)
    with engine.connect() as db:
        tables = db.scalars(
            text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        ).all()
        for table in tables:
            if table in {"spatial_ref_sys", "alembic_version"}:
                continue
            if not table.startswith("v2_"):
                raise SystemExit("Unexpected table; preserving database")
            name = engine.dialect.identifier_preparer.quote(table)
            if db.scalar(text(f"SELECT count(*) FROM {name}")):
                raise SystemExit("Application data exists; preserving database")
    environment = dict(
        os.environ, V2_DATABASE_URL=target.render_as_string(hide_password=False)
    )

    def migrate(*args):
        subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=ROOT / "backend",
            env=environment,
            check=True,
        )

    cases = [
        ("rajasthan", " Jaipur ", 8, 102),
        ("राजस्थान", "Unknown historic district", 8, None),
        ("Unknown historic state", "Jaipur", None, None),
        ("Maharashtra", "नाशिक", 27, 487),
        ("Rajasthan", "Nashik", 8, None),
        (None, None, None, None),
    ]
    rows = []
    try:
        migrate("downgrade", "v2_0005")
        with engine.begin() as db:
            for number, (state, district, _, _) in enumerate(cases):
                identifier = uuid4()
                db.execute(
                    text("""INSERT INTO v2_farmers
                        (id,mobile,display_name,preferred_language,state,district,timezone,status,role,created_at,updated_at)
                        VALUES (:id,:mobile,'Disposable migration fixture','en',:state,:district,
                                'Asia/Kolkata','active','farmer',:now,:now)"""),
                    {
                        "id": identifier,
                        "mobile": f"+9190000001{number:02}",
                        "state": state,
                        "district": district,
                        "now": datetime.now(timezone.utc),
                    },
                )
                rows.append(identifier)
        migrate("upgrade", "head")
        with engine.connect() as db:
            for identifier, (state, district, state_code, district_code) in zip(
                rows, cases
            ):
                result = db.execute(
                    text(
                        "SELECT state,district,state_code,district_code FROM v2_farmers WHERE id=:id"
                    ),
                    {"id": identifier},
                ).one()
                assert tuple(result) == (state, district, state_code, district_code), (
                    "Backfill changed names or guessed codes"
                )
        print(
            f"PASS: {len(cases)} real historical backfills; reported names preserved and unknown codes remain null"
        )
    finally:
        # Only the exact fixtures this guarded run inserted can be removed.
        with engine.begin() as db:
            for identifier in rows:
                db.execute(
                    text("DELETE FROM v2_farmers WHERE id=:id"), {"id": identifier}
                )
        engine.dispose()


if __name__ == "__main__":
    main()
