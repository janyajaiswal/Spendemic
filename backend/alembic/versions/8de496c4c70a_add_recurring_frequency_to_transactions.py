"""add_recurring_frequency_to_transactions

Revision ID: 8de496c4c70a
Revises: 6c0396487c7c
Create Date: 2026-03-19 11:35:45.938505

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum


revision: str = '8de496c4c70a'
down_revision: Union[str, Sequence[str], None] = '6c0396487c7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_freq_enum = PgEnum(
    'DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY',
    name='recurringfrequencyenum',
    create_type=False,
)


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE recurringfrequencyenum AS ENUM (
                'DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.add_column(
        'transactions',
        sa.Column('recurring_frequency', _freq_enum, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('transactions', 'recurring_frequency')
    op.execute("DROP TYPE IF EXISTS recurringfrequencyenum;")