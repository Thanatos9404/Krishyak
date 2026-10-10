"""Load ignored local settings without exposing credentials in command arguments."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))


def main():
    from dotenv import dotenv_values

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["migrate", "test", "api", "worker"])
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run the complete backend suite with disposable PostGIS",
    )
    parser.add_argument(
        "--env", type=Path, default=ROOT / ".codex-tmp" / "v2-local.env"
    )
    args = parser.parse_args()
    environment = os.environ | {
        key: value
        for key, value in dotenv_values(args.env).items()
        if value is not None
    }
    if args.command == "migrate":
        command = [sys.executable, "-m", "alembic", "upgrade", "head"]
    elif args.command == "test":
        from sqlalchemy import create_engine, text
        from sqlalchemy.engine import make_url

        url = make_url(environment["V2_DATABASE_URL"])
        with create_engine(
            url.set(database="postgres"), isolation_level="AUTOCOMMIT"
        ).connect() as connection:
            if not connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname='krishyak_v2_test'")
            ):
                connection.execute(text("CREATE DATABASE krishyak_v2_test"))
        environment["V2_DATABASE_URL"] = url.set(
            database="krishyak_v2_test"
        ).render_as_string(hide_password=False)
        environment["V2_TEST_DATABASE_URL"] = environment["V2_DATABASE_URL"]
        environment["ENVIRONMENT"] = "test"
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND,
            env=environment,
            check=True,
        )
        command = (
            [sys.executable, "-m", "unittest", "discover", "-v"]
            if args.all
            else [sys.executable, "-m", "unittest", "test_v2_foundation", "-v"]
        )
    elif args.command == "worker":
        command = [sys.executable, "-m", "v2.worker"]
    else:
        command = [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]
    raise SystemExit(subprocess.run(command, cwd=BACKEND, env=environment).returncode)


if __name__ == "__main__":
    main()
