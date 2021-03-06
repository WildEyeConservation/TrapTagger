"""Added tagging_time column to turkcode table.

Revision ID: c0f2872c74d4
Revises: d0af964d2508
Create Date: 2021-02-08 11:40:13.532082

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0f2872c74d4'
down_revision = 'd0af964d2508'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('turkcode', sa.Column('tagging_time', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('turkcode', 'tagging_time')
    # ### end Alembic commands ###
