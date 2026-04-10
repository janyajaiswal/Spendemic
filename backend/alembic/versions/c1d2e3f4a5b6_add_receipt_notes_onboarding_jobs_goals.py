"""add_receipt_notes_onboarding_jobs_goals

Revision ID: c1d2e3f4a5b6
Revises: b9c1d2e3f4a5
Create Date: 2026-04-05

Adds:
- receipt_url, notes to transactions
- onboarding_completed to users
- jobs table (multi-job support)
- goals table (savings goals)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'c1d2e3f4a5b6'
down_revision = 'b9c1d2e3f4a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # transactions: receipt image URL and personal notes
    op.add_column('transactions',
        sa.Column('receipt_url', sa.String(500), nullable=True))
    op.add_column('transactions',
        sa.Column('notes', sa.Text, nullable=True))

    # users: track whether first-login onboarding has been completed
    op.add_column('users',
        sa.Column('onboarding_completed', sa.Boolean, nullable=False, server_default='false'))

    # jobs: multi-job support per user
    op.create_table(
        'jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('job_name', sa.String(200), nullable=False),
        sa.Column('employer', sa.String(200), nullable=True),
        sa.Column('hourly_rate', sa.Numeric(8, 2), nullable=False),
        sa.Column('hours_per_week', sa.Numeric(5, 1), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=True),
        sa.Column('start_date', sa.Date, nullable=True),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('NOW()')),
    )

    # goals: savings goals funded from net-positive surplus
    op.create_table(
        'goals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('target_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('saved_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('deadline', sa.Date, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('goals')
    op.drop_table('jobs')
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('transactions', 'notes')
    op.drop_column('transactions', 'receipt_url')
