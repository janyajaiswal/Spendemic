"""add_profile_fields_to_users

Revision ID: 6c0396487c7c
Revises: 1115097040d1
Create Date: 2026-03-09 17:09:59.107296

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6c0396487c7c'
down_revision: Union[str, Sequence[str], None] = '1115097040d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('profile_picture_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('phone_number', sa.String(30), nullable=True))
    op.add_column('users', sa.Column('country', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('state_province', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('postal_code', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'postal_code')
    op.drop_column('users', 'state_province')
    op.drop_column('users', 'city')
    op.drop_column('users', 'country')
    op.drop_column('users', 'phone_number')
    op.drop_column('users', 'bio')
    op.drop_column('users', 'profile_picture_url')
