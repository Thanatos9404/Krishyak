"""Add LGD profile codes; backfill recognized names without rewriting reports."""

import json
import unicodedata
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "v2_0006"
down_revision = "v2_0005"
branch_labels = depends_on = None


def key(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").casefold().split())


def upgrade():
    for name in ("state_code", "district_code"):
        op.add_column("v2_farmers", sa.Column(name, sa.Integer(), nullable=True))
    op.add_column("v2_farmers", sa.Column("subdistrict", sa.String(100), nullable=True))
    op.add_column("v2_farmers", sa.Column("pin_code", sa.String(6), nullable=True))
    catalog = json.loads(
        (Path(__file__).resolve().parents[1] / "data/v2_0006_locations.json").read_text(encoding="utf-8")
    )
    states, districts = {}, {}
    for state in catalog["states"]:
        for name in {state["name"], state["local_name"]} - {""}:
            states.setdefault(key(name), set()).add(state["code"])
    states["rajsthan"] = states["राजस्थान"] = {8}
    for district in catalog["districts"]:
        for name in {district["name"], district["local_name"]} - {""}:
            districts.setdefault((district["state_code"], key(name)), set()).add(district["code"])
    connection = op.get_bind()
    historical = (
        connection.execute(sa.text("SELECT id, state, district FROM v2_farmers").execution_options(stream_results=True))
        .mappings()
        .yield_per(100)
    )
    for farmer in historical:
        state_ids = states.get(key(farmer["state"]), set())
        if len(state_ids) != 1:
            continue
        state_code = next(iter(state_ids))
        district_ids = districts.get((state_code, key(farmer["district"])), set())
        district_code = next(iter(district_ids)) if len(district_ids) == 1 else None
        connection.execute(
            sa.text("UPDATE v2_farmers SET state_code = :state, district_code = :district WHERE id = :id"),
            {"id": farmer["id"], "state": state_code, "district": district_code},
        )


def downgrade():
    for name in ("pin_code", "subdistrict", "district_code", "state_code"):
        op.drop_column("v2_farmers", name)
