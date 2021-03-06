"""Added notes to clusters

Revision ID: a8f7642b1815
Revises: 8cb9fffabfd9
Create Date: 2020-03-19 15:43:14.733805

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8f7642b1815'
down_revision = '8cb9fffabfd9'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('cluster', sa.Column('notes', sa.String(length=512), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('cluster', 'notes')
    # ### end Alembic commands ###
