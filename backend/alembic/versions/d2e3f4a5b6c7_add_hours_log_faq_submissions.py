"""add_hours_log_faq_submissions

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-04-10

Adds:
- job_hours_log table (weekly hours tracking per job)
- faq_submissions table (community Q&A)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'job_hours_log',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID(as_uuid=True),
                  sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('week_start_date', sa.Date, nullable=False),
        sa.Column('hours_worked', sa.Numeric(5, 1), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('job_id', 'week_start_date', name='uq_job_hours_log_job_week'),
    )

    op.create_table(
        'faq_submissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question', sa.Text, nullable=False),
        sa.Column('answer', sa.Text, nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('faq_submissions')
    op.drop_table('job_hours_log')
