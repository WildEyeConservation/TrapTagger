"""Added classification labels table

Revision ID: 1172a4cef6c4
Revises: 4a299e32bf94
Create Date: 2024-09-05 07:54:48.174953

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '1172a4cef6c4'
down_revision = '4a299e32bf94'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('classification_label',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('classification', sa.String(length=64), nullable=True),
    sa.Column('classifier_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['classifier_id'], ['classifier.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('classification_label')
    # ### end Alembic commands ###
