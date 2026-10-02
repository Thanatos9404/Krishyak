"""Disposable migration and pg_dump/pg_restore verification. Never targets production."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    from dotenv import dotenv_values
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=ROOT / ".codex-tmp/v2-local.env")
    parser.add_argument("--docker", default="docker")
    parser.add_argument(
        "--reuse-empty",
        action="store_true",
        help="Recreate only the two named disposable databases after verifying they contain no application rows",
    )
    args = parser.parse_args()
    environment = os.environ | {
        k: v for k, v in dotenv_values(args.env).items() if v is not None
    }
    url = make_url(environment["V2_DATABASE_URL"])
    if url.host not in {"127.0.0.1", "localhost"} or environment.get(
        "ENVIRONMENT"
    ) not in {"development", "test"}:
        parser.error("Only explicitly local development/test databases are permitted")
    # These names are literals, not derived from arbitrary user input.
    names = ("krishyak_v2_migration_test", "krishyak_v2_restore_test")
    control = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with control.connect() as connection:
            for name in names:
                exists = connection.scalar(
                    text("SELECT 1 FROM pg_database WHERE datname=:name"),
                    {"name": name},
                )
                if exists:
                    if not args.reuse_empty:
                        raise SystemExit(
                            f"Disposable database {name} exists; use --reuse-empty only for empty verification databases."
                        )
                    probe = create_engine(url.set(database=name))
                    with probe.connect() as inspection:
                        tables = inspection.scalars(
                            text(
                                "SELECT tablename FROM pg_tables WHERE schemaname='public'"
                            )
                        ).all()
                        for table in tables:
                            if table in {"spatial_ref_sys", "alembic_version"}:
                                continue
                            if not table.startswith("v2_"):
                                raise SystemExit(
                                    "Unexpected table in disposable database; preserving it"
                                )
                            identifier = probe.dialect.identifier_preparer.quote(table)
                            if inspection.scalar(
                                text(f"SELECT count(*) FROM {identifier}")
                            ):
                                raise SystemExit(
                                    "Application rows exist in disposable database; preserving it"
                                )
                    probe.dispose()
                    connection.execute(text(f"DROP DATABASE {name}"))
                connection.execute(text(f"CREATE DATABASE {name}"))
        migration = environment | {
            "V2_DATABASE_URL": url.set(database=names[0]).render_as_string(
                hide_password=False
            )
        }
        for command in [
            ("upgrade", "head"),
            ("downgrade", "base"),
            ("upgrade", "head"),
            ("check",),
        ]:
            subprocess.run(
                [sys.executable, "-m", "alembic", *command],
                cwd=ROOT / "backend",
                env=migration,
                check=True,
            )
        container = subprocess.check_output(
            [
                args.docker,
                "compose",
                "-p",
                "krishyak-v2",
                "--env-file",
                str(args.env),
                "-f",
                str(ROOT / "docker-compose.v2.yml"),
                "ps",
                "-q",
                "db",
            ],
            text=True,
        ).strip()
        if not container:
            raise SystemExit("Local compose PostGIS container is unavailable")
        subprocess.run(
            [
                args.docker,
                "exec",
                container,
                "pg_dump",
                "-U",
                "krishyak",
                "-d",
                names[0],
                "-Fc",
                "-f",
                "/tmp/v2-migration-verify.dump",
            ],
            check=True,
        )
        subprocess.run(
            [
                args.docker,
                "exec",
                container,
                "pg_restore",
                "-U",
                "krishyak",
                "-d",
                names[1],
                "--exit-on-error",
                "/tmp/v2-migration-verify.dump",
            ],
            check=True,
        )
        # Schema, checks and indexes must all survive a real PostgreSQL backup.
        evidence = []
        for name in names:
            engine = create_engine(url.set(database=name))
            with engine.connect() as connection:
                evidence.append(
                    {
                        "schema": connection.scalar(
                            text("SELECT version_num FROM alembic_version")
                        ),
                        "tables": connection.scalar(
                            text(
                                "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'v2_%'"
                            )
                        ),
                        "constraints": connection.scalar(
                            text(
                                "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'"
                            )
                        ),
                        "indexes": connection.scalar(
                            text(
                                "SELECT count(*) FROM pg_indexes WHERE schemaname='public'"
                            )
                        ),
                    }
                )
            engine.dispose()
        if evidence[0] != evidence[1]:
            raise SystemExit("Restored database schema differs")
        output = ROOT / "output/database-verification.json"
        output.parent.mkdir(exist_ok=True)
        output.write_text(
            json.dumps(
                {
                    "migration_round_trip": "passed",
                    "backup_restore": "passed",
                    "scope": "empty disposable databases; no production records",
                    "evidence": evidence[0],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(
            "Migration round trip and PostgreSQL backup/restore passed on disposable databases."
        )
    finally:
        control.dispose()


if __name__ == "__main__":
    main()
