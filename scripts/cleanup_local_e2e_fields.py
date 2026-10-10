"""Remove generated field fixtures only in the fixed local browser-test database."""

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from db.models import Farm, Farmer, ImageAsset, Plot
from v2.rights import queue_objects

NAMES = re.compile(
    r"^(?:Synthetic product field|Edited synthetic field|Synthetic field) \d+$"
)
MOBILES = {"+919000000001", "+919000000002", "+919000000003"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply only the printed generated-fixture selection",
    )
    args = parser.parse_args()
    values = dotenv_values(ROOT / ".codex-tmp/v2-e2e.env")
    url = make_url(values["V2_DATABASE_URL"])
    if (
        url.host != "127.0.0.1"
        or url.port != 55432
        or url.database != "krishyak_v2_e2e"
        or values["ENVIRONMENT"] not in {"development", "test"}
        or values["V2_OTP_PROVIDER"] != "development"
        or not MOBILES.issubset(set(values["V2_DEV_MOBILES"].split(",")))
    ):
        raise SystemExit(
            "Refusing cleanup outside the explicitly isolated development-identity test database"
        )
    # Importing provider code must not obtain production credentials.
    os.environ["ENVIRONMENT"] = "test"
    engine = create_engine(url)
    with Session(engine) as db:
        fields = db.scalars(
            select(Plot).join(Farm).join(Farmer).where(Farmer.mobile.in_(MOBILES))
        ).all()
        targets = [field for field in fields if NAMES.fullmatch(field.name)]
        print(
            f"Generated fixture fields: {len(targets)}; preserved other fields: {len(fields) - len(targets)}"
        )
        if not args.apply:
            print("Read-only selection; no records changed")
            return
        for field in targets:
            queue_objects(
                db,
                db.scalars(
                    select(ImageAsset).where(ImageAsset.plot_id == field.id)
                ).all(),
            )
            db.delete(field)
        db.flush()
        farms = db.scalars(
            select(Farm).join(Farmer).where(Farmer.mobile.in_(MOBILES))
        ).all()
        removed_farms = 0
        for farm in farms:
            if re.fullmatch(r"Synthetic product farm \d+", farm.name) and not db.scalar(
                select(Plot.id).where(Plot.farm_id == farm.id).limit(1)
            ):
                db.delete(farm)
                removed_farms += 1
        db.commit()
        remaining = db.scalars(
            select(Plot).join(Farm).join(Farmer).where(Farmer.mobile.in_(MOBILES))
        ).all()
        if any(NAMES.fullmatch(field.name) for field in remaining):
            raise SystemExit("Fixture cleanup did not complete")
        print(
            f"Removed {len(targets)} generated fields and {removed_farms} empty generated farms; no demo fields are stored in farmer accounts"
        )
    engine.dispose()


if __name__ == "__main__":
    main()
