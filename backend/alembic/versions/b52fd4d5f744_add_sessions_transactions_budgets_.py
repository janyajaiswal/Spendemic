"""add_sessions_transactions_budgets_alerts_exchange_rates

Revision ID: b52fd4d5f744
Revises: 93cc500fd6c3
Create Date: 2026-03-02 15:20:56.690076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum


# revision identifiers, used by Alembic.
revision: str = 'b52fd4d5f744'
down_revision: Union[str, Sequence[str], None] = '93cc500fd6c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New enum types to create (existing ones from migration 93cc500fd6c3 are left untouched)
_new_enum_sql = [
    ("transactiontypeenum", "INCOME", "EXPENSE"),
    ("categoryenum",
     "HOUSING", "FOOD", "TRANSPORTATION", "EDUCATION", "HEALTHCARE",
     "ENTERTAINMENT", "SHOPPING", "UTILITIES", "PERSONAL_CARE", "TRAVEL",
     "SAVINGS", "SALARY", "STIPEND", "SCHOLARSHIP", "FINANCIAL_AID",
     "FAMILY_SUPPORT", "FREELANCE", "OTHER"),
    ("budgetperiodenum", "WEEKLY", "MONTHLY"),
    ("alerttypeenum",
     "BUDGET_EXCEEDED", "APPROACHING_LIMIT", "LARGE_TRANSACTION", "LOW_BALANCE"),
]


def _create_enum(name: str, *values: str) -> None:
    """Create a PostgreSQL ENUM type only if it does not already exist."""
    quoted = ", ".join(f"'{v}'" for v in values)
    op.execute(
        f"DO $$ BEGIN "
        f"CREATE TYPE {name} AS ENUM ({quoted}); "
        f"EXCEPTION WHEN duplicate_object THEN null; "
        f"END $$;"
    )


def _drop_enum(name: str) -> None:
    """Drop a PostgreSQL ENUM type if it exists."""
    op.execute(f"DROP TYPE IF EXISTS {name};")


def upgrade() -> None:
    """Upgrade schema — add 5 new tables."""

    # Create new enum types via raw SQL (existing ones are left untouched)
    for enum_def in _new_enum_sql:
        _create_enum(*enum_def)

    # Use create_type=False so SQLAlchemy never emits CREATE TYPE for these
    currency_enum    = PgEnum(name='currencyenum',        create_type=False)
    category_enum    = PgEnum(name='categoryenum',        create_type=False)
    tx_type_enum     = PgEnum(name='transactiontypeenum', create_type=False)
    budget_period    = PgEnum(name='budgetperiodenum',    create_type=False)
    alert_type_enum  = PgEnum(name='alerttypeenum',       create_type=False)

    # ── exchange_rate_cache ────────────────────────────────────────────────────
    op.create_table(
        'exchange_rate_cache',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('from_currency', sa.String(length=3), nullable=False),
        sa.Column('to_currency', sa.String(length=3), nullable=False),
        sa.Column('rate', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('from_currency', 'to_currency', name='uq_exchange_rate_pair'),
    )
    op.create_index('ix_exchange_rate_fetched_at', 'exchange_rate_cache', ['fetched_at'])
    op.create_index('ix_exchange_rate_pair', 'exchange_rate_cache', ['from_currency', 'to_currency'])

    # ── user_sessions ──────────────────────────────────────────────────────────
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('jti', sa.String(), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti'),
    )
    op.create_index('ix_user_sessions_expires_at', 'user_sessions', ['expires_at'])
    op.create_index('ix_user_sessions_jti', 'user_sessions', ['jti'])
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])

    # ── budgets ────────────────────────────────────────────────────────────────
    op.create_table(
        'budgets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('category', category_enum, nullable=False),
        sa.Column('limit_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', currency_enum, nullable=False),
        sa.Column('period', budget_period, nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_budgets_user_category', 'budgets', ['user_id', 'category'])
    op.create_index('ix_budgets_user_id', 'budgets', ['user_id'])

    # ── transactions ───────────────────────────────────────────────────────────
    op.create_table(
        'transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', currency_enum, nullable=False),
        sa.Column('amount_in_usd', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('type', tx_type_enum, nullable=False),
        sa.Column('category', category_enum, nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transactions_category', 'transactions', ['category'])
    op.create_index('ix_transactions_date', 'transactions', ['transaction_date'])
    op.create_index('ix_transactions_user_date', 'transactions', ['user_id', 'transaction_date'])
    op.create_index('ix_transactions_user_id', 'transactions', ['user_id'])

    # ── alerts ─────────────────────────────────────────────────────────────────
    op.create_table(
        'alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('budget_id', sa.UUID(), nullable=True),
        sa.Column('alert_type', alert_type_enum, nullable=False),
        sa.Column('threshold_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['budget_id'], ['budgets.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_alerts_user_id', 'alerts', ['user_id'])


def downgrade() -> None:
    """Downgrade schema — drop the 5 new tables and new enum types."""
    op.drop_index('ix_alerts_user_id', table_name='alerts')
    op.drop_table('alerts')

    op.drop_index('ix_transactions_user_id', table_name='transactions')
    op.drop_index('ix_transactions_user_date', table_name='transactions')
    op.drop_index('ix_transactions_date', table_name='transactions')
    op.drop_index('ix_transactions_category', table_name='transactions')
    op.drop_table('transactions')

    op.drop_index('ix_budgets_user_id', table_name='budgets')
    op.drop_index('ix_budgets_user_category', table_name='budgets')
    op.drop_table('budgets')

    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_index('ix_user_sessions_jti', table_name='user_sessions')
    op.drop_index('ix_user_sessions_expires_at', table_name='user_sessions')
    op.drop_table('user_sessions')

    op.drop_index('ix_exchange_rate_pair', table_name='exchange_rate_cache')
    op.drop_index('ix_exchange_rate_fetched_at', table_name='exchange_rate_cache')
    op.drop_table('exchange_rate_cache')

    # Drop only the new enum types — do NOT drop existing ones
    for enum_def in _new_enum_sql:
        _drop_enum(enum_def[0])
