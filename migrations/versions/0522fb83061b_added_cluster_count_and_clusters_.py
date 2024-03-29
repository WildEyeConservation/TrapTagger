"""Added cluster_count and clusters remaing columns to task table

Revision ID: 0522fb83061b
Revises: b3540e3a7ec5
Create Date: 2023-05-22 11:40:00.988487

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0522fb83061b'
down_revision = 'b3540e3a7ec5'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('task', sa.Column('cluster_count', sa.Integer(), nullable=True))
    op.add_column('task', sa.Column('clusters_remaining', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('task', 'clusters_remaining')
    op.drop_column('task', 'cluster_count')
    # ### end Alembic commands ###
