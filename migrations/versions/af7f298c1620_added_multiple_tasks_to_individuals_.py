"""Added multiple tasks to individuals table along with a species column

Revision ID: af7f298c1620
Revises: 3273b92ffa23
Create Date: 2023-03-30 15:06:14.370431

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'af7f298c1620'
down_revision = '3273b92ffa23'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('taskGroupings',
    sa.Column('master_id', sa.Integer(), nullable=False),
    sa.Column('sub_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['master_id'], ['task.id'], ),
    sa.ForeignKeyConstraint(['sub_id'], ['task.id'], ),
    sa.PrimaryKeyConstraint('master_id', 'sub_id'),
    sa.UniqueConstraint('master_id', 'sub_id')
    )
    op.create_table('individualTasks',
    sa.Column('task_id', sa.Integer(), nullable=True),
    sa.Column('individual_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['individual_id'], ['individual.id'], ),
    sa.ForeignKeyConstraint(['task_id'], ['task.id'], ),
    sa.UniqueConstraint('task_id', 'individual_id')
    )
    op.create_index(op.f('ix_individualTasks_task_id'), 'individualTasks', ['task_id'], unique=False)
    op.add_column('individual', sa.Column('species', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_individual_species'), 'individual', ['species'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_individual_species'), table_name='individual')
    op.drop_column('individual', 'species')
    op.drop_index(op.f('ix_individualTasks_task_id'), table_name='individualTasks')
    op.drop_table('individualTasks')
    op.drop_table('taskGroupings')
    # ### end Alembic commands ###