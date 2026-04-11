"""add_faq_answers_community

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-04-10

Adds:
- faq_answers table (community answers to open questions)
- Changes faq_submissions default status from 'pending' to 'open' so questions appear immediately
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'faq_answers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('question_id', UUID(as_uuid=True),
                  sa.ForeignKey('faq_submissions.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('author_name', sa.String(200), nullable=True),
        sa.Column('answer_text', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
    )

    # Flip existing pending questions to open so they become visible
    op.execute("UPDATE faq_submissions SET status = 'open' WHERE status = 'pending'")

    # Change server default for new rows
    op.alter_column('faq_submissions', 'status', server_default='open')


def downgrade() -> None:
    op.drop_table('faq_answers')
    op.alter_column('faq_submissions', 'status', server_default='pending')
