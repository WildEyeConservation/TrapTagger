"""Added last_ping to user table

Revision ID: f2a59d4dd981
Revises: d1c986c70ef7
Create Date: 2021-05-24 13:42:28.242926

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2a59d4dd981'
down_revision = 'd1c986c70ef7'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user', sa.Column('last_ping', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_user_last_ping'), 'user', ['last_ping'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_user_last_ping'), table_name='user')
    op.drop_column('user', 'last_ping')
    # ### end Alembic commands ###
