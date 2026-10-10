"""Initial frozen Field Intelligence schema, with PostGIS constraints.

Revision ID: v2_0001
"""

from pathlib import Path

from alembic import op

revision = "v2_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # SQL snapshot deliberately avoids importing live ORM schema/create_all.
    sql = (Path(__file__).parent / "v2_0001.sql").read_text(encoding="utf-8")
    for statement in sql.split(";\n"):
        if statement.strip():
            op.execute(statement)


def downgrade():
    # Destructive downgrade is for disposable environments/approved restoration.
    for name in (
        "v2_object_deletions",
        "v2_pilot_enrollments",
        "v2_pilot_cohorts",
        "v2_audit_log",
        "v2_jobs",
        "v2_feedback",
        "v2_images",
        "v2_observations",
        "v2_crop_cycles",
        "v2_plots",
        "v2_farms",
        "v2_sessions",
        "v2_consents",
        "v2_auth_challenges",
        "v2_farmers",
    ):
        op.execute(f'DROP TABLE "{name}"')
