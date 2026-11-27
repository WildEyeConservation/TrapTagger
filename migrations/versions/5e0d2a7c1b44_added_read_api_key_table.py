"""Added read-only API key table

Revision ID: 5e0d2a7c1b44
Revises: 9a1a9f9f469c
Create Date: 2026-11-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5e0d2a7c1b44'
down_revision = '9a1a9f9f469c'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('read_api_key',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('api_key', sa.String(length=64), nullable=True),
    sa.Column('organisation_id', sa.Integer(), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['organisation_id'], ['organisation.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_read_api_key_api_key'), 'read_api_key', ['api_key'], unique=True)
    op.create_index(op.f('ix_read_api_key_organisation_id'), 'read_api_key', ['organisation_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_read_api_key_organisation_id'), table_name='read_api_key')
    op.drop_index(op.f('ix_read_api_key_api_key'), table_name='read_api_key')
    op.drop_table('read_api_key')
