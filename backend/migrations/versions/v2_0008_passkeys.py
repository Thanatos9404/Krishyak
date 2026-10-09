"""Passkey sign-in, one-time recovery codes and unverified contact numbers."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "v2_0008"
down_revision = "v2_0007"
branch_labels = depends_on = None


def timestamps():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def owner(nullable=False):
    return sa.Column("farmer_id", sa.Uuid(), sa.ForeignKey("v2_farmers.id", ondelete="CASCADE"), nullable=nullable)


def upgrade():
    op.alter_column("v2_farmers", "mobile", existing_type=sa.String(16), nullable=True)
    op.add_column("v2_farmers", sa.Column("contact_mobile", sa.String(16), nullable=True))
    op.create_check_constraint(
        "ck_v2_farmers_contact_mobile",
        "v2_farmers",
        r"contact_mobile IS NULL OR contact_mobile ~ '^\+91[6-9][0-9]{9}$'",
    )
    op.create_table(
        "v2_passkeys",
        *timestamps(),
        owner(),
        sa.Column("credential_id", sa.String(1400), nullable=False, unique=True),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("device_label", sa.String(100), nullable=False),
        sa.Column("backed_up", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("sign_count >= 0", name="ck_v2_passkeys_sign_count"),
    )
    op.create_index("ix_v2_passkeys_farmer_id", "v2_passkeys", ["farmer_id"])
    op.create_table(
        "v2_recovery_codes",
        *timestamps(),
        owner(),
        sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
        sa.UniqueConstraint("farmer_id"),
    )
    op.create_table(
        "v2_webauthn_challenges",
        *timestamps(),
        owner(nullable=True),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("challenge", sa.String(200), nullable=False, unique=True),
        sa.Column("origin", sa.String(300), nullable=False),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(
            "purpose IN ('register', 'authenticate', 'add_device')", name="ck_v2_webauthn_challenges_purpose"
        ),
    )
    op.create_index("ix_v2_webauthn_challenges_farmer_id", "v2_webauthn_challenges", ["farmer_id"])


def downgrade():
    op.drop_table("v2_webauthn_challenges")
    op.drop_table("v2_recovery_codes")
    op.drop_table("v2_passkeys")
    op.drop_constraint("ck_v2_farmers_contact_mobile", "v2_farmers", type_="check")
    op.drop_column("v2_farmers", "contact_mobile")
    # Passkey-only accounts have no verified number and cannot satisfy NOT NULL.
    op.execute("DELETE FROM v2_farmers WHERE mobile IS NULL")
    op.alter_column("v2_farmers", "mobile", existing_type=sa.String(16), nullable=False)
