"""Index Overhaul

Revision ID: 40ac30febb0b
Revises: 966f1254c74c
Create Date: 2023-05-05 13:03:17.852427

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40ac30febb0b'
down_revision = '966f1254c74c'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###

    # tags
    op.drop_index('tag_id', table_name='tags')
    op.create_unique_constraint('ix_tags_cluster_tag', 'tags', ['cluster_id', 'tag_id'])
    op.drop_index('cluster_id', table_name='tags')
    
    # labelstable
    op.drop_index('label_id', table_name='labelstable')
    op.create_unique_constraint('ix_labelstable_cluster_label', 'labelstable', ['cluster_id', 'label_id'])
    op.drop_index('cluster_id', table_name='labelstable')

    # images
    op.create_unique_constraint('ix_images_cluster_image', 'images', ['cluster_id', 'image_id'])
    op.drop_index('cluster_id', table_name='images')
    op.drop_index('ix_images_image_id', table_name='images')

    # requiredimagestable
    op.drop_index('ix_requiredimagestable_image_id', table_name='requiredimagestable')

    # detectionTags
    op.drop_index('tag_id', table_name='detectionTags')
    op.create_unique_constraint('ix_detectionTags_labelgroup_tag', 'detectionTags', ['labelgroup_id', 'tag_id'])
    op.drop_index('ix_detectionTags_labelgroup_id', table_name='detectionTags')

    # detectionLabels
    op.drop_index('label_id', table_name='detectionLabels')
    op.create_unique_constraint('ix_detectionLabels_labelgroup_label', 'detectionLabels', ['labelgroup_id', 'label_id'])
    op.drop_index('ix_detectionLabels_labelgroup_id', table_name='detectionLabels')

    # workersTable
    op.drop_index('ix_workersTable_user_id', table_name='workersTable')

    # individualDetections
    op.create_unique_constraint('ix_individualDetections_individual_detection', 'individualDetections', ['individual_id', 'detection_id'])
    op.drop_index('individual_id', table_name='individualDetections')
    op.drop_index('ix_individualDetections_detection_id', table_name='individualDetections')

    # individualTags
    op.drop_index('tag_id', table_name='individualTags')
    op.create_unique_constraint('ix_individualTags_individual_tag', 'individualTags', ['individual_id', 'tag_id'])
    op.drop_index('individual_id', table_name='individualTags')

    # individual_parent_child
    op.drop_index('parent_id', table_name='individual_parent_child')

    # userNotifications
    op.drop_index('user_id', table_name='userNotifications')
    op.create_unique_constraint('ix_userNotifications_notification_user', 'userNotifications', ['notification_id', 'user_id'])
    op.drop_index('notification_id', table_name='userNotifications')

    # individualTasks
    op.drop_index('task_id', table_name='individualTasks')
    op.create_unique_constraint('ix_individualTasks_individual_task', 'individualTasks', ['individual_id', 'task_id'])
    op.drop_index('individual_id', table_name='individualTasks')

    # taskGroupings
    op.drop_index('master_id', table_name='taskGroupings')

    # Image
    op.drop_index('ix_image_etag', table_name='image')

    # Camera
    op.drop_index('ix_camera_flagged', table_name='camera')
    op.drop_column('camera', 'flagged')

    # Survey
    op.create_index('ix_survey_status', 'survey', ['status'], unique=False)
    op.create_index('ix_survey_images_processing', 'survey', ['images_processing'], unique=False)

    # Trapgroup
    # combine active, provessing, queueing?

    # Labelgroup
    # compund: id, task_id, detection_id

    # Detection (should detection id and image_id be in the compund index?)
    op.create_index('ix_detection_bottom', 'detection', ['bottom'], unique=False)
    op.create_index('ix_det_srce_scre_stc_stat_class_classcre', 'detection', ['source', 'score', 'static', 'status', 'classification', 'class_score'], unique=False)
    
    # Turkcode

    # User
    op.create_index('ix_user_passed', 'user', ['passed'], unique=False)

    # Label

    # Tag

    # Individual
    op.drop_index('ix_individual_species', table_name='individual')
    op.create_index('ix_individual_species_active', 'individual', ['species','active'], unique=False)

    # Cluster
    op.drop_column('cluster', 'lastAssigned')
    op.create_index('ix_cluster_timestamp', 'cluster', ['timestamp'], unique=False)
    op.create_index('ix_cluster_notes', 'cluster', ['notes'], unique=False)
    op.create_index('ix_cluster_examined_task', 'cluster', ['examined','task_id'], unique=False)
    op.drop_index('ix_cluster_examined', table_name='cluster')

    # Task
    op.create_index('ix_task_name', 'task', ['name'], unique=False)
    op.create_index('ix_task_status', 'task', ['status'], unique=False)
    op.drop_index('ix_task_is_bounding', table_name='task')

    # Translation
    # Add compound? task_id, classification, label_id

    # DetSimilarity
    # Should we add score to the two compound indexes?
    # Migrate to multi-column primary key
    op.alter_column('det_similarity', 'id', existing_type=sa.Integer, autoincrement=False, nullable=False)
    op.drop_constraint('PRIMARY', 'det_similarity', type_='primary')
    op.drop_column('det_similarity', 'id')
    op.drop_constraint('det_similarity_ibfk_1', 'det_similarity', type_='foreignkey')
    op.drop_constraint('det_similarity_ibfk_2', 'det_similarity', type_='foreignkey')
    op.create_primary_key('det_similarity_pkey', 'det_similarity', ['detection_1', 'detection_2'])
    op.create_index('ix_det_similarity_2_1', 'det_similarity', ['detection_2','detection_1'], unique=True)
    op.create_foreign_key('det_similarity_ibfk_1', 'det_similarity', 'detection', ['detection_1'], ['id'])
    op.create_foreign_key('det_similarity_ibfk_2', 'det_similarity', 'detection', ['detection_2'], ['id'])

    # IndSimilarity
    op.alter_column('ind_similarity', 'id', existing_type=sa.Integer, autoincrement=False, nullable=False)
    op.drop_constraint('PRIMARY', 'ind_similarity', type_='primary')
    op.drop_column('ind_similarity', 'id')
    op.drop_constraint('ind_similarity_ibfk_1', 'ind_similarity', type_='foreignkey')
    op.drop_constraint('ind_similarity_ibfk_2', 'ind_similarity', type_='foreignkey')
    op.create_primary_key('ind_similarity_pkey', 'ind_similarity', ['individual_1', 'individual_2'])
    op.create_index('ix_ind_similarity_2_1', 'ind_similarity', ['individual_2','individual_1'], unique=True)
    op.create_foreign_key('ind_similarity_ibfk_1', 'ind_similarity', 'individual', ['individual_1'], ['id'])
    op.create_foreign_key('ind_similarity_ibfk_2', 'ind_similarity', 'individual', ['individual_2'], ['id'])

    # Notification

    # Statistic

    # Classifier

    # Video

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###

    # tags
    op.create_index('cluster_id', 'tags', ['cluster_id'], unique=False)
    op.drop_constraint('ix_tags_cluster_tag', 'tags', type_='unique')
    op.create_unique_constraint('tag_id', 'tags', ['tag_id', 'cluster_id'])

    # labelstable
    op.create_index('cluster_id', 'labelstable', ['cluster_id'], unique=False)
    op.drop_constraint('ix_labelstable_cluster_label', 'labelstable', type_='unique')
    op.create_unique_constraint('label_id', 'labelstable', ['label_id', 'cluster_id'])

    # images
    op.create_index('ix_images_image_id', 'images', ['image_id'], unique=False)
    op.create_index('cluster_id', 'images', ['cluster_id'], unique=False)
    op.drop_constraint('ix_images_cluster_image', 'images', type_='unique')

    # requiredimagestable
    op.create_index('ix_requiredimagestable_image_id', 'requiredimagestable', ['image_id'], unique=False)

    # detectionTags
    op.create_index('ix_detectionTags_labelgroup_id', 'detectionTags', ['labelgroup_id'], unique=False)
    op.drop_constraint('ix_detectionTags_labelgroup_tag', 'detectionTags', type_='unique')
    op.create_unique_constraint('tag_id', 'detectionTags', ['tag_id', 'labelgroup_id'])

    # detectionLabels
    op.create_index('ix_detectionLabels_labelgroup_id', 'detectionLabels', ['labelgroup_id'], unique=False)
    op.drop_constraint('ix_detectionLabels_labelgroup_label', 'detectionLabels', type_='unique')
    op.create_unique_constraint('label_id', 'detectionLabels', ['label_id', 'labelgroup_id'])

    # workersTable
    op.create_index('ix_workersTable_user_id', 'workersTable', ['user_id'], unique=False)

    # individualDetections
    op.create_index('ix_individualDetections_detection_id', 'individualDetections', ['detection_id'], unique=False)
    op.create_index('individual_id', 'individualDetections', ['individual_id'], unique=False)
    op.drop_constraint('ix_individualDetections_individual_detection', 'individualDetections', type_='unique')

    # individualTags
    op.create_index('individual_id', 'individualTags', ['individual_id'], unique=False)
    op.drop_constraint('ix_individualTags_individual_tag', 'individualTags', type_='unique')
    op.create_unique_constraint('tag_id', 'individualTags', ['tag_id', 'individual_id'])

    # individual_parent_child
    op.create_unique_constraint('parent_id', 'individual_parent_child', ['parent_id', 'child_id'])

    # userNotifications
    op.create_index('notification_id', 'userNotifications', ['notification_id'], unique=False)
    op.drop_constraint('ix_userNotifications_notification_user', 'userNotifications', type_='unique')
    op.create_unique_constraint('user_id', 'userNotifications', ['user_id', 'notification_id'])

    # individualTasks
    op.create_index('individual_id', 'individualTasks', ['individual_id'], unique=False)
    op.drop_constraint('ix_individualTasks_individual_task', 'individualTasks', type_='unique')
    op.create_unique_constraint('task_id', 'individualTasks', ['task_id', 'individual_id'])

    # taskGroupings
    op.create_unique_constraint('master_id', 'taskGroupings', ['master_id', 'sub_id'])

    # Image
    op.create_index('ix_image_etag', 'image', ['etag'], unique=False)

    # Camera
    op.create_index('ix_camera_flagged', 'camera', ['flagged'], unique=False)
    op.add_column('camera', sa.Column('flagged', sa.Boolean(), nullable=True))

    # Survey
    op.drop_index('ix_survey_status', table_name='survey')
    op.drop_index('ix_survey_images_processing', table_name='survey')

    # Detection
    op.drop_index('ix_detection_bottom', table_name='detection')
    op.drop_index('ix_detection_source_score_static_status_classification_class_score', table_name='detection')

    # User
    op.drop_index('ix_user_passed', table_name='user')

    # Individual
    op.drop_index('ix_individual_species_active', table_name='individual')
    op.create_index('ix_individual_species', 'individual', ['species'], unique=False)

    # Cluster
    op.create_index('ix_cluster_examined', 'cluster', ['examined'], unique=False)
    op.drop_index('ix_cluster_examined_task', table_name='cluster')
    op.drop_index('ix_cluster_notes', table_name='cluster')
    op.drop_index('ix_cluster_timestamp', table_name='cluster')
    op.add_column('cluster', sa.Column('lastAssigned', sa.DateTime(), nullable=True))
    
    # Task
    op.create_index('ix_task_is_bounding', 'task', ['is_bounding'], unique=False)
    op.drop_index('ix_task_status', table_name='task')
    op.drop_index('ix_task_name', table_name='task')

    # DetSimilarity
    op.drop_index('ix_det_similarity_2_1', table_name='det_similarity')
    op.drop_constraint('det_similarity_pkey', 'det_similarity', type_='primary')
    op.add_column('det_similarity', sa.Column('id', sa.Integer(), nullable=False))
    op.execute("ALTER TABLE det_similarity MODIFY id INTEGER AUTO_INCREMENT")
    op.create_primary_key('PRIMARY', 'det_similarity', ['id'])
    
    # IndSimilarity
    op.drop_index('ix_ind_similarity_2_1', table_name='ind_similarity')
    op.drop_constraint('ind_similarity_pkey', 'ind_similarity', type_='primary')
    op.add_column('ind_similarity', sa.Column('id', sa.Integer(), nullable=False))
    op.execute("ALTER TABLE ind_similarity MODIFY id INTEGER AUTO_INCREMENT")
    op.create_primary_key('PRIMARY', 'ind_similarity', ['id'])

    # ### end Alembic commands ###
