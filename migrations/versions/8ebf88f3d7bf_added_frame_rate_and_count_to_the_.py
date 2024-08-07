"""Added frame rate and count to the videos table

Revision ID: 8ebf88f3d7bf
Revises: 91c228481869
Create Date: 2024-03-05 09:13:50.351667

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8ebf88f3d7bf'
down_revision = '91c228481869'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('video', sa.Column('fps', sa.Integer(), nullable=True))
    op.add_column('video', sa.Column('frame_count', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('video', 'frame_count')
    op.drop_column('video', 'fps')
    # ### end Alembic commands ###
