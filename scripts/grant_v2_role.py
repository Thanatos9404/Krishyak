"""Operator-only role assignment. Never expose this as a public registration API."""

import argparse
import os
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    from db.models import AuditLog, Farmer, Session
    from db.session import make_database
    from dotenv import dotenv_values
    from sqlalchemy import select, update
    from v2.settings import Settings

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, required=True)
    parser.add_argument("--farmer-id", type=UUID, required=True)
    parser.add_argument(
        "--role",
        choices=["farmer", "agronomist", "organisation_admin", "admin"],
        required=True,
    )
    parser.add_argument(
        "--reason",
        required=True,
        help="A non-personal operational reason, maximum 200 characters",
    )
    args = parser.parse_args()
    if not 1 <= len(args.reason.strip()) <= 200:
        parser.error("A bounded operational reason is required")
    os.environ.update(
        {
            key: value
            for key, value in dotenv_values(args.env).items()
            if value is not None
        }
    )
    settings = Settings.from_env()
    if not settings.enabled:
        parser.error("V2 must be configured before role assignment")
    engine, factory = make_database(settings)
    try:
        with factory.begin() as db:
            farmer = db.scalar(
                select(Farmer).where(Farmer.id == args.farmer_id).with_for_update()
            )
            if farmer is None or farmer.status != "active":
                parser.error("Active account not found")
            previous, farmer.role = farmer.role, args.role
            db.execute(
                update(Session)
                .where(Session.farmer_id == farmer.id)
                .values(revoked=True)
            )
            db.add(
                AuditLog(
                    actor_id=None,
                    action="operator_role_changed",
                    target_id=farmer.id,
                    details={
                        "from": previous,
                        "to": args.role,
                        "reason": args.reason.strip(),
                    },
                )
            )
        print("Role updated and sessions revoked. A new OTP sign-in is required.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
