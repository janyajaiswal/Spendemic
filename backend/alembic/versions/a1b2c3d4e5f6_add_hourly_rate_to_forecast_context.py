"""add_hourly_rate_to_forecast_context

Revision ID: a1b2c3d4e5f6
Revises: f1c2d3e4a5b6
Create Date: 2026-03-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f1c2d3e4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'forecast_context',
        sa.Column('hourly_rate', sa.Numeric(precision=8, scale=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('forecast_context', 'hourly_rate')
