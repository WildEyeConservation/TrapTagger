"""widen calibration_image filename to 512

Revision ID: 41f781754d20
Revises: 8d09aa2d5947
Create Date: 2026-07-03 11:59:59.918904

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '41f781754d20'
down_revision = '8d09aa2d5947'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'calibration_image',
        'filename',
        existing_type=sa.String(length=128),
        type_=sa.String(length=512),
        existing_nullable=True,
    )

def downgrade():
    op.alter_column(
        'calibration_image',
        'filename',
        existing_type=sa.String(length=512),
        type_=sa.String(length=128),
        existing_nullable=True,
    )
