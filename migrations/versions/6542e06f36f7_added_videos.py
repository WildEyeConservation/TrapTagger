"""added videos

Revision ID: 6542e06f36f7
Revises: d96f6080bb9a
Create Date: 2023-04-24 14:06:11.644655

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6542e06f36f7'
down_revision = 'd96f6080bb9a'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('video',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=64), nullable=True),
    sa.Column('camera_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['camera_id'], ['camera.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_video_camera_id'), 'video', ['camera_id'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_video_camera_id'), table_name='video')
    op.drop_table('video')
    # ### end Alembic commands ###

