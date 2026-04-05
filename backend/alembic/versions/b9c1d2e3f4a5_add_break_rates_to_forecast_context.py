"""add_break_rates_to_forecast_context

Revision ID: b9c1d2e3f4a5
Revises: a1b2c3d4e5f6
Create Date: 2026-03-31

Adds break_hourly_rate and break_hours_per_week to forecast_context so the
UI's break-period income inputs are actually persisted to the database.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b9c1d2e3f4a5'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('forecast_context',
        sa.Column('break_hourly_rate', sa.Numeric(precision=8, scale=2), nullable=True))
    op.add_column('forecast_context',
        sa.Column('break_hours_per_week', sa.Numeric(precision=5, scale=1), nullable=True))


def downgrade() -> None:
    op.drop_column('forecast_context', 'break_hours_per_week')
    op.drop_column('forecast_context', 'break_hourly_rate')
