"""Set up a relationship between turkcodes and users

Revision ID: df50ff634df2
Revises: 0522fb83061b
Create Date: 2023-06-28 08:38:05.123515

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'df50ff634df2'
down_revision = '0522fb83061b'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # op.drop_constraint('PRIMARY', 'turkcode', type_='primary')
    op.alter_column('turkcode', 'user_id', 
                nullable=True, 
                new_column_name='code',
                existing_type=mysql.VARCHAR(length=64))
    op.execute("ALTER TABLE turkcode ADD id INT PRIMARY KEY AUTO_INCREMENT;")
    op.add_column('turkcode', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'turkcode', 'user', ['user_id'], ['id'])
    # ### end Alembic commands ###

def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'turkcode', type_='foreignkey')
    op.drop_column('turkcode', 'user_id')
    op.drop_column('turkcode', 'id')
    op.alter_column('turkcode', 'code', 
                nullable=False, 
                new_column_name='user_id',
                existing_type=mysql.VARCHAR(length=64))
    # ### end Alembic commands ###
