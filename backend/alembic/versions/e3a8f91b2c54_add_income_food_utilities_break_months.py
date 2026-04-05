"""add_income_food_utilities_break_months

Revision ID: e3a8f91b2c54
Revises: d7e54f925337
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3a8f91b2c54'
down_revision: Union[str, Sequence[str], None] = 'd7e54f925337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # forecast_context: actual income + living expense estimates
    op.add_column('forecast_context', sa.Column('income_amount', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('forecast_context', sa.Column('food_estimate', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('forecast_context', sa.Column('utilities_estimate', sa.Numeric(precision=10, scale=2), nullable=True))
    # users: academic break month ranges (1–12)
    op.add_column('users', sa.Column('summer_break_start_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('summer_break_end_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('winter_break_start_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('winter_break_end_month', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('forecast_context', 'income_amount')
    op.drop_column('forecast_context', 'food_estimate')
    op.drop_column('forecast_context', 'utilities_estimate')
    op.drop_column('users', 'summer_break_start_month')
    op.drop_column('users', 'summer_break_end_month')
    op.drop_column('users', 'winter_break_start_month')
    op.drop_column('users', 'winter_break_end_month')
