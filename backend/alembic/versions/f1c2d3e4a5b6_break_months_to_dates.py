"""break_months_to_dates

Revision ID: f1c2d3e4a5b6
Revises: e3a8f91b2c54
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1c2d3e4a5b6'
down_revision: Union[str, Sequence[str], None] = 'e3a8f91b2c54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old integer month columns
    op.drop_column('users', 'summer_break_start_month')
    op.drop_column('users', 'summer_break_end_month')
    op.drop_column('users', 'winter_break_start_month')
    op.drop_column('users', 'winter_break_end_month')
    # Add new Date columns (specific dates for annual break ranges)
    op.add_column('users', sa.Column('summer_break_start', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('summer_break_end', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('winter_break_start', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('winter_break_end', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'summer_break_start')
    op.drop_column('users', 'summer_break_end')
    op.drop_column('users', 'winter_break_start')
    op.drop_column('users', 'winter_break_end')
    op.add_column('users', sa.Column('summer_break_start_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('summer_break_end_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('winter_break_start_month', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('winter_break_end_month', sa.Integer(), nullable=True))
