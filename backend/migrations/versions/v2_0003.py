"""Consented plot cohorts, in-app acknowledgements and worker health."""

from alembic import op

revision = "v2_0003"
down_revision = "v2_0002"
branch_labels = depends_on = None


def upgrade():
    op.execute("ALTER TABLE v2_pilot_enrollments ADD COLUMN plot_ids jsonb NOT NULL DEFAULT '[]'::jsonb")
    op.execute("CREATE TABLE v2_worker_heartbeat (name varchar(50) PRIMARY KEY, seen_at timestamptz NOT NULL)")
    op.execute(
        "CREATE TABLE v2_notifications (id uuid PRIMARY KEY, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, farmer_id uuid NOT NULL REFERENCES v2_farmers(id) ON DELETE CASCADE, plot_id uuid REFERENCES v2_plots(id) ON DELETE CASCADE, operation_id uuid NOT NULL, kind varchar(40) NOT NULL, payload jsonb NOT NULL, acknowledged_at timestamptz, UNIQUE(farmer_id, operation_id))"
    )
    op.execute("CREATE INDEX ix_v2_notifications_farmer_id ON v2_notifications(farmer_id)")


def downgrade():
    op.execute("DROP TABLE v2_notifications, v2_worker_heartbeat")
    op.execute("ALTER TABLE v2_pilot_enrollments DROP COLUMN plot_ids")
