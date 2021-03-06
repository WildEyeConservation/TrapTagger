"""Added active status to trapgroups

Revision ID: d4c5bf8fc38e
Revises: ef3069ebf3b4
Create Date: 2020-01-14 09:38:56.841231

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4c5bf8fc38e'
down_revision = 'ef3069ebf3b4'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('trapgroup', sa.Column('active', sa.Boolean(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('trapgroup', 'active')
    # ### end Alembic commands ###
