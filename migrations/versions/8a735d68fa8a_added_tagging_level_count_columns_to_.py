"""Added tagging level count columns to label table

Revision ID: 8a735d68fa8a
Revises: e5069ea36aef
Create Date: 2022-06-15 15:03:12.809964

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a735d68fa8a'
down_revision = 'e5069ea36aef'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('label', sa.Column('cluster_count', sa.Integer(), nullable=True))
    op.add_column('label', sa.Column('bounding_count', sa.Integer(), nullable=True))
    op.add_column('label', sa.Column('info_tag_count', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('label', 'info_tag_count')
    op.drop_column('label', 'bounding_count')
    op.drop_column('label', 'cluster_count')
    # ### end Alembic commands ###