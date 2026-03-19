"""add_password_hash_to_users

Revision ID: 1115097040d1
Revises: b52fd4d5f744
Create Date: 2026-03-09 16:15:12.901684

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1115097040d1'
down_revision: Union[str, Sequence[str], None] = 'b52fd4d5f744'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_hash', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_hash')
