"""Fixing uniqueness constraints.

Revision ID: bfb2c8312fb3
Revises: 87f4c249b047
Create Date: 2020-04-01 10:47:37.180434

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bfb2c8312fb3'
down_revision = '87f4c249b047'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('ix_survey_name', table_name='survey')
    op.create_index(op.f('ix_survey_name'), 'survey', ['name'], unique=False)
    op.drop_index('ix_task_name', table_name='task')
    op.create_index(op.f('ix_task_name'), 'task', ['name'], unique=False)
    op.drop_index('tag', table_name='trapgroup')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index('tag', 'trapgroup', ['tag'], unique=True)
    op.drop_index(op.f('ix_task_name'), table_name='task')
    op.create_index('ix_task_name', 'task', ['name'], unique=True)
    op.drop_index(op.f('ix_survey_name'), table_name='survey')
    op.create_index('ix_survey_name', 'survey', ['name'], unique=True)
    # ### end Alembic commands ###
