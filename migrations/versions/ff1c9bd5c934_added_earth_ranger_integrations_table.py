"""Added Earth Ranger integrations table

Revision ID: ff1c9bd5c934
Revises: 821bbc400a8d
Create Date: 2023-10-02 11:10:08.312870

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'ff1c9bd5c934'
down_revision = '821bbc400a8d'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('earth_ranger',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=64), nullable=True),
    sa.Column('api_key', sa.String(length=64), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_earth_ranger_user_id'), 'earth_ranger', ['user_id'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_earth_ranger_user_id'), table_name='earth_ranger')
    op.drop_table('earth_ranger')
    # ### end Alembic commands ###
