'''
Copyright 2023

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login
from geoalchemy2 import Geometry

tags = db.Table('tags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id')),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('cluster_id','tag_id') #order here matters - creates a composite index on cluster_id, tag_id
)

labelstable = db.Table('labelstable',
    db.Column('label_id', db.Integer, db.ForeignKey('label.id')),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('cluster_id','label_id')
)

images = db.Table('images',
    db.Column('image_id', db.Integer, db.ForeignKey('image.id')),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('image_id', 'cluster_id'),
    db.UniqueConstraint('cluster_id', 'image_id')
)

requiredimagestable = db.Table('requiredimagestable',
    db.Column('image_id', db.Integer, db.ForeignKey('image.id')),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('image_id', 'cluster_id')
)

detectionTags = db.Table('detectionTags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id')),
    db.Column('labelgroup_id', db.Integer, db.ForeignKey('labelgroup.id')),
    db.UniqueConstraint('labelgroup_id', 'tag_id')
)

detectionLabels = db.Table('detectionLabels',
    db.Column('label_id', db.Integer, db.ForeignKey('label.id')),
    db.Column('labelgroup_id', db.Integer, db.ForeignKey('labelgroup.id')),
    db.UniqueConstraint('labelgroup_id', 'label_id')
)

workersTable = db.Table('workersTable',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('worker_id', db.Integer, db.ForeignKey('user.id')),
    db.UniqueConstraint('user_id', 'worker_id')
)

individualDetections = db.Table('individualDetections',
    db.Column('detection_id', db.Integer, db.ForeignKey('detection.id')),
    db.Column('individual_id', db.Integer, db.ForeignKey('individual.id')),
    db.UniqueConstraint('detection_id', 'individual_id'),
    db.UniqueConstraint('individual_id', 'detection_id')
)

individualTags = db.Table('individualTags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id')),
    db.Column('individual_id', db.Integer, db.ForeignKey('individual.id')),
    db.UniqueConstraint('individual_id', 'tag_id')
)

individual_parent_child = db.Table("individual_parent_child",
    db.Column("parent_id", db.Integer, db.ForeignKey("individual.id"), primary_key=True),
    db.Column("child_id", db.Integer, db.ForeignKey("individual.id"), primary_key=True),
)

userNotifications = db.Table('userNotifications',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('notification_id', db.Integer, db.ForeignKey('notification.id')),
    db.UniqueConstraint('notification_id', 'user_id')
)

individualTasks = db.Table('individualTasks',
    db.Column('task_id', db.Integer, db.ForeignKey('task.id')),
    db.Column('individual_id', db.Integer, db.ForeignKey('individual.id')),
    db.UniqueConstraint('individual_id', 'task_id')
)

taskGroupings = db.Table("taskGroupings",
    db.Column("master_id", db.Integer, db.ForeignKey("task.id"), primary_key=True),
    db.Column("sub_id", db.Integer, db.ForeignKey("task.id"), primary_key=True),
)

siteGroupings = db.Table('siteGroupings',
    db.Column('trapgroup_id', db.Integer, db.ForeignKey('trapgroup.id')),
    db.Column('sitegroup_id', db.Integer, db.ForeignKey('sitegroup.id')),
    db.UniqueConstraint('sitegroup_id', 'trapgroup_id')
)

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(64), index=False, unique=False)
    timestamp = db.Column(db.DateTime, index=False)
    corrected_timestamp = db.Column(db.DateTime, index=True)
    detection_rating = db.Column(db.Float, default=0, index=True)
    etag = db.Column(db.String(64), index=False)
    hash = db.Column(db.String(64), index=True)
    downloaded = db.Column(db.Boolean, default=False, index=True)
    extracted_data = db.Column(db.String(128), index=False)
    detections = db.relationship('Detection', backref='image', lazy=True)
    camera_id = db.Column(db.Integer, db.ForeignKey('camera.id'), index=True, unique=False)
    skipped = db.Column(db.Boolean, default=False, index=True)
    extracted = db.Column(db.Boolean, default=False, index=True)

    def __repr__(self):
        return '<Image {}>'.format(self.filename)


class Camera(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(256), index=True, unique=False)
    images = db.relationship('Image', backref='camera', lazy=True)
    trapgroup_id = db.Column(db.Integer, db.ForeignKey('trapgroup.id'))
    videos = db.relationship('Video', backref='camera', lazy=True)
    cameragroup_id = db.Column(db.Integer, db.ForeignKey('cameragroup.id'), index=True)

    def __repr__(self):
        return '<Camera {}>'.format(self.path)

    @staticmethod
    def get_or_create(session, trapgroup_id, path):
        camera = db.session.query(Camera).filter_by(trapgroup_id=trapgroup_id,path=path).first()
        if not (camera):
            camera = Camera(trapgroup_id=trapgroup_id,path=path)
            session.add(camera)
        return camera


class Survey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(256), index=True, unique=False)
    description = db.Column(db.String(256), index=False)
    trapgroup_code = db.Column(db.String(256), index=False)
    status = db.Column(db.String(64), index=True)
    images_processing = db.Column(db.Integer, default=0, index=True)
    processing_initialised = db.Column(db.Boolean, default=False, index=False)
    image_count = db.Column(db.Integer, default=0, index=False)
    frame_count = db.Column(db.Integer, default=0, index=False)
    video_count = db.Column(db.Integer, default=0, index=False)
    ignore_small_detections = db.Column(db.Boolean, default=False, index=False)
    sky_masked = db.Column(db.Boolean, default=False, index=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    correct_timestamps = db.Column(db.Boolean, default=False, index=False)
    folder = db.Column(db.String(64), index=False)
    trapgroups = db.relationship('Trapgroup', backref='survey', lazy=True)
    tasks = db.relationship('Task', backref='survey', lazy=True)
    classifier_id = db.Column(db.Integer, db.ForeignKey('classifier.id'), index=False)
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisation.id'), index=True, unique=False)
    exceptions = db.relationship('SurveyPermissionException', backref='survey', lazy=True)
    shares = db.relationship('SurveyShare', backref='survey', lazy=True)
    camera_code = db.Column(db.String(256), index=False)
    api_keys = db.relationship('APIKey', backref='survey', lazy=True)

    def __repr__(self):
        return '<Survey {}>'.format(self.name)

    @staticmethod
    def get_or_create(session, name, organisation_id, trapgroup_code):
        survey = session.query(Survey).filter_by(name=name,organisation_id=organisation_id).first()
        if not (survey):
            survey = Survey(name=name,organisation_id=organisation_id,trapgroup_code=trapgroup_code)
            session.add(survey)
        return survey

class Trapgroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'))
    tag = db.Column(db.String(64), index=False, unique=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    active = db.Column(db.Boolean, default=True, index=True)
    processing = db.Column(db.Boolean, default=False, index=True)
    queueing = db.Column(db.Boolean, default=False, index=True)
    longitude = db.Column(db.Float(precision=9), index=False)
    latitude = db.Column(db.Float(precision=9), index=False)
    altitude = db.Column(db.Float(precision=9), index=False)
    cameras = db.relationship('Camera', backref='trapgroup', lazy=True)

    def __repr__(self):
        return '<Trapgroup {}>'.format(self.tag)

    @staticmethod
    def get_or_create(session, tag, survey_id):
        trapgroup = session.query(Trapgroup).filter_by(tag=tag,survey_id=survey_id).first()
        if not (trapgroup):
            trapgroup = Trapgroup(tag=tag, survey_id=survey_id, altitude=0, latitude=0, longitude=0)
            session.add(trapgroup)
        return trapgroup

class Labelgroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    checked = db.Column(db.Boolean, default=False, index=True)
    detection_id = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    labels = db.relationship('Label', secondary=detectionLabels, lazy=True, backref=db.backref('labelgroups', lazy=True))
    tags = db.relationship('Tag', secondary=detectionTags, lazy=True, backref=db.backref('labelgroups', lazy=True))

    def __repr__(self):
        return '<Label group for detection {}>'.format(self.detection_id)

class Detection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, db.ForeignKey('image.id'), index=True)
    category = db.Column(db.Integer, index=True)
    source = db.Column(db.String(64), index=True)
    status = db.Column(db.String(64), index=True)
    top = db.Column(db.Float, index=False)
    left = db.Column(db.Float, index=False)
    right = db.Column(db.Float, index=False)
    bottom = db.Column(db.Float, index=True)
    score = db.Column(db.Float, index=True)
    static = db.Column(db.Boolean, default=False, index=True)
    classification = db.Column(db.String(64), index=True)
    class_score = db.Column(db.Float, index=True)
    labelgroups = db.relationship('Labelgroup', backref='detection', lazy=True)
    staticgroup_id = db.Column(db.Integer, db.ForeignKey('staticgroup.id'), index=True)
    flank = db.Column(db.String(1), index=True) #left/right
    aid = db.Column(db.Integer, index=True) # annotation id for wbia db 

    def __repr__(self):
        return '<Detection of class {} on image {}>'.format(self.category, self.image_id)

class Turkcode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    code = db.Column(db.String(64))
    active = db.Column(db.Boolean, default=True, index=True)
    assigned = db.Column(db.DateTime, unique=False, index=False)
    tagging_time = db.Column(db.Integer, index=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)

    def __repr__(self):
        return '<Turkcode {}>'.format(self.user_id)


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    affiliation = db.Column(db.String(64))
    regions = db.Column(db.String(128))
    folder = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(64), index=True, unique=False)
    passwordHash = db.Column(db.String(128), index=False, unique=False)
    passed = db.Column(db.String(64), index=True)
    admin = db.Column(db.Boolean, default=False, index=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    last_ping = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    clusters_allocated = db.Column(db.Integer, default=0, index=False)
    cloud_access = db.Column(db.Boolean, default=False, index=False)
    clusters = db.relationship('Cluster', backref='user', lazy=True)
    trapgroup = db.relationship('Trapgroup', backref='user', lazy=True)
    surveys = db.relationship('Survey', backref='user', lazy=True)
    children = db.relationship('User', backref=db.backref('parent', remote_side=[id]), lazy=True)
    turkcode = db.relationship('Turkcode', backref='user', lazy=True)
    image_count = db.Column(db.Integer, index=False)
    previous_image_count = db.Column(db.Integer, index=False)
    earth_ranger_integrations = db.relationship('EarthRanger', backref='user', lazy=True)
    permissions = db.relationship('UserPermissions', backref='user', lazy=True)
    exceptions = db.relationship('SurveyPermissionException', backref='user', lazy=True)
    root_organisation = db.relationship('Organisation', backref='root', uselist=False, lazy=True)
    notifications = db.relationship('Notification', backref='user', lazy=True)
    masks = db.relationship('Mask', backref='user', lazy=True)
    staticgroups = db.relationship('Staticgroup', backref='user', lazy=True)
    qualifications = db.relationship('User',secondary=workersTable,
                                    primaryjoin=id==workersTable.c.worker_id,
                                    secondaryjoin=id==workersTable.c.user_id,
                                    backref="workers")

    def __repr__(self):
        return '<User {}>'.format(self.username)

    def set_password(self, password):
        self.passwordHash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.passwordHash, password)


@login.user_loader
def load_user(_id):
    return User.query.get(int(_id))


class Label(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(64), index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('label.id'), index=True)
    hotkey = db.Column(db.String(1), index=False)
    complete = db.Column(db.Boolean, default=False, index=False)
    icID_allowed = db.Column(db.Boolean, default=False, index=False)
    icID_count = db.Column(db.Integer, index=False)
    cluster_count = db.Column(db.Integer, index=False)
    bounding_count = db.Column(db.Integer, index=False)
    info_tag_count = db.Column(db.Integer, index=False)
    potential_clusters = db.Column(db.Integer, index=False)
    image_count = db.Column(db.Integer, index=False)
    sighting_count = db.Column(db.Integer, index=False)
    unidentified_count = db.Column(db.Integer, index=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    algorithm = db.Column(db.String(64), index=False) #hotspotter/heuristic (for Individual ID)
    icID_q1_complete = db.Column(db.Boolean, default=False, index=False) # Individual ID first quantile complete
    children = db.relationship('Label', backref=db.backref('parent', remote_side=[id]), lazy=True)
    translations = db.relationship('Translation', backref='label', lazy=True)
    individuals = db.relationship('Individual', backref='label', lazy=True)

    def __repr__(self):
        return '<Label {}>'.format(self.description)


class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(64), index=True)
    hotkey = db.Column(db.String(1), index=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)

    def __repr__(self):
        return '<Tag {}>'.format(self.description)


class Individual(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), index=False)
    notes = db.Column(db.String(512), index=False)
    active = db.Column(db.Boolean, default=True, index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    label_id = db.Column(db.Integer, db.ForeignKey('label.id'), index=True)
    species = db.Column(db.String(64), index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=False)
    allocated = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    allocation_timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    detections = db.relationship('Detection', secondary=individualDetections, lazy=True, backref=db.backref('individuals', lazy=True))
    tags = db.relationship('Tag', secondary=individualTags, lazy=True, backref=db.backref('individuals', lazy=True))
    tasks = db.relationship('Task', secondary=individualTasks, lazy=True, backref=db.backref('individuals', lazy=True))
    children = db.relationship("Individual",
                        secondary=individual_parent_child,
                        primaryjoin=id==individual_parent_child.c.parent_id,
                        secondaryjoin=id==individual_parent_child.c.child_id,
                        backref="parents"
    )

    def __repr__(self):
        return '<Individual {}>'.format(self.name)


class Cluster(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    notes = db.Column(db.String(512), index=True)
    checked = db.Column(db.Boolean, default=False, index=True)
    classification = db.Column(db.String(64), index=True)
    examined = db.Column(db.Boolean, default=False, index=True)
    skipped = db.Column(db.Boolean, default=False, index=True)
    images = db.relationship('Image', secondary=images, lazy=True, backref=db.backref('clusters', lazy=True))
    required_images = db.relationship('Image', secondary=requiredimagestable, lazy=True, backref=db.backref('required_for', lazy=True))
    tags = db.relationship('Tag', secondary=tags, lazy=True, backref=db.backref('clusters', lazy=True))
    labels = db.relationship('Label', secondary=labelstable, lazy=True, backref=db.backref('clusters', lazy=True))
    earth_ranger_ids = db.relationship('ERangerID', backref='cluster', lazy=True)

    def __repr__(self):
        return '<Cluster {}>'.format(self.id)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(256), index=True, unique=False)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), index=True)
    tagging_level = db.Column(db.String(80), index=False)
    test_size = db.Column(db.Integer, index=False)
    size = db.Column(db.Integer, index=False)
    status = db.Column(db.String(32), index=True)
    tagging_time = db.Column(db.Integer, index=False)
    complete = db.Column(db.Boolean, default=False, index=False)
    init_complete = db.Column(db.Boolean, default=False, index=True)
    is_bounding = db.Column(db.Boolean, default=False, index=False)
    parent_classification = db.Column(db.Boolean, default=False, index=False)
    ai_check_complete = db.Column(db.Boolean, default=False, index=False)
    jobs_finished = db.Column(db.Integer, default=0, index=False)
    current_name = db.Column(db.String(8), index=False)
    class_check_count = db.Column(db.Integer, index=False)
    unchecked_multi_count = db.Column(db.Integer, index=False)
    unlabelled_animal_cluster_count = db.Column(db.Integer, index=False)
    vhl_count = db.Column(db.Integer, index=False)
    infoless_count = db.Column(db.Integer, index=False)
    infoless_vhl_count = db.Column(db.Integer, index=False)
    vhl_bounding_count = db.Column(db.Integer, index=False)
    potential_vhl_clusters = db.Column(db.Integer, index=False)
    vhl_image_count = db.Column(db.Integer, index=False)
    vhl_sighting_count = db.Column(db.Integer, index=False)
    cluster_count = db.Column(db.Integer, index=False)
    clusters_remaining = db.Column(db.Integer, index=False)
    clusters = db.relationship('Cluster', backref='task', lazy=True)
    turkcodes = db.relationship('Turkcode', backref='task', lazy=True)
    labels = db.relationship('Label', backref='task', lazy=True)
    tags = db.relationship('Tag', backref='task', lazy=True)
    labelgroups = db.relationship('Labelgroup', backref='task', lazy=True)
    translations = db.relationship('Translation', backref='task', lazy=True)
    # individuals = db.relationship('Individual', backref='task', lazy=True)
    sub_tasks = db.relationship("Task",
                        secondary=taskGroupings,
                        primaryjoin=id==taskGroupings.c.master_id,
                        secondaryjoin=id==taskGroupings.c.sub_id,
                        backref="master"
    )

    def __repr__(self):
        return '<Task {} for survey {}>'.format(self.name,self.survey_id)


class Translation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    classification = db.Column(db.String(64), index=True)
    auto_classify = db.Column(db.Boolean, default=False, index=True)
    label_id = db.Column(db.Integer, db.ForeignKey('label.id'), index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)

    def __repr__(self):
        return '<Translation {}:{} for task {}>'.format(self.classification,self.label_id,self.task_id)


class DetSimilarity(db.Model):
    detection_1 = db.Column(db.Integer, db.ForeignKey('detection.id'), primary_key=True)
    detection_2 = db.Column(db.Integer, db.ForeignKey('detection.id'), primary_key=True)
    score = db.Column(db.Float, index=True)

    def __repr__(self):
        return '<Detection similarity for {} and {}>'.format(self.detection_1, self.detection_2)


class IndSimilarity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    individual_1 = db.Column(db.Integer, db.ForeignKey('individual.id'))
    individual_2 = db.Column(db.Integer, db.ForeignKey('individual.id'))
    detection_1 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    detection_2 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    score = db.Column(db.Float, index=True)
    old_score = db.Column(db.Float, index=False)
    skipped = db.Column(db.Boolean, default=False, index=True)
    allocated = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    allocation_timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return '<Individual similarity for {} and {}>'.format(self.individual_1, self.individual_2)


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contents = db.Column(db.String(2048), index=False)
    expires = db.Column(db.DateTime, default=None, index=True)
    seen = db.Column(db.Boolean, default=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    users_seen = db.relationship('User', secondary=userNotifications, lazy=True, backref=db.backref('seen_notifications', lazy=True))

    def __repr__(self):
        return '<Notification: {}>'.format(self.contents)


class Statistic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    user_count = db.Column(db.Integer, index=True)
    organisation_count = db.Column(db.Integer, index=True)
    active_organisation_count = db.Column(db.Integer, index=False)
    image_count = db.Column(db.Integer, index=False)
    video_count = db.Column(db.Integer, index=False)
    frame_count = db.Column(db.Integer, index=False)
    server_cost = db.Column(db.Float, index=False)
    storage_cost = db.Column(db.Float, index=False)
    db_cost = db.Column(db.Float, index=False)
    total_cost = db.Column(db.Float, index=False)
    unique_daily_logins = db.Column(db.Integer, index=False)
    unique_daily_admin_logins = db.Column(db.Integer, index=False)
    unique_daily_organisation_logins = db.Column(db.Integer, index=False)
    average_daily_logins = db.Column(db.Float, index=False)
    average_daily_admin_logins = db.Column(db.Float, index=False)
    average_daily_organisation_logins = db.Column(db.Float, index=False)
    unique_monthly_logins = db.Column(db.Float, index=False)
    unique_monthly_admin_logins = db.Column(db.Float, index=False)
    unique_monthly_organisation_logins = db.Column(db.Float, index=False)

    def __repr__(self):
        return '<Statistic for {}>'.format(self.timestamp)


class Classifier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ami_id = db.Column(db.String(32), index=False)
    name = db.Column(db.String(64), index=True, unique=True)
    source = db.Column(db.String(64), index=True)
    description = db.Column(db.String(1024), index=False)
    region = db.Column(db.String(64), index=True)
    active = db.Column(db.Boolean, default=True, index=True)
    # threshold = db.Column(db.Float, index=False)
    surveys = db.relationship('Survey', backref='classifier', lazy=True)
    classification_labels = db.relationship('ClassificationLabel', backref='classifier', lazy=True)

    def __repr__(self):
        return '<Classifier {}>'.format(self.name)


class Video(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(64), index=False)
    hash = db.Column(db.String(64), index=True)
    downloaded = db.Column(db.Boolean, default=False, index=True)
    camera_id = db.Column(db.Integer, db.ForeignKey('camera.id'), index=True, unique=False)
    extracted_text = db.Column(db.String(64), index=False)
    still_rate = db.Column(db.Float, index=False)

    def __repr__(self):
        return '<Video {}>'.format(self.filename)

class Sitegroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), index=False)
    description = db.Column(db.String(256), index=False)
    trapgroups = db.relationship('Trapgroup', secondary=siteGroupings, lazy=True, backref=db.backref('sitegroups', lazy=True))

    def __repr__(self):
        return '<Sitegroup {}>'.format(self.name)

class EarthRanger(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(64), index=False)
    api_key = db.Column(db.String(64), index=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisation.id'), index=True, unique=False)

    def __repr__(self):
        return '<Earth Ranger integration for {} for>'.format(self.label,self.user_id)

class Organisation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), index=False)
    root_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)
    affiliation = db.Column(db.String(64), index=False)
    regions = db.Column(db.String(128), index=False)
    folder = db.Column(db.String(64), index=True, unique=True)
    cloud_access = db.Column(db.Boolean, default=False, index=False)
    image_count = db.Column(db.Integer, index=False)
    video_count = db.Column(db.Integer, index=False)
    frame_count = db.Column(db.Integer, index=False)
    previous_image_count = db.Column(db.Integer, index=False)
    previous_video_count = db.Column(db.Integer, index=False)
    previous_frame_count = db.Column(db.Integer, index=False)
    earth_ranger_integrations = db.relationship('EarthRanger', backref='organisation', lazy=True)
    permissions = db.relationship('UserPermissions', backref='organisation', lazy=True)
    shares = db.relationship('SurveyShare', backref='organisation', lazy=True)
    surveys = db.relationship('Survey', backref='organisation', lazy=True)

    def __repr__(self):
        return '<Organisation {}>'.format(self.name)

class UserPermissions(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisation.id'), index=True, unique=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)
    delete = db.Column(db.Boolean, default=False, index=False)
    create = db.Column(db.Boolean, default=False, index=False)
    annotation = db.Column(db.Boolean, default=False, index=False)
    default = db.Column(db.String(8), index=False) # admin/write/read/hidden/worker

    def __repr__(self):
        return '<User permissions for user {} for organisation {}>'.format(self.user_id,self.organisation_id)

class SurveyPermissionException(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), index=True, unique=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)
    permission = db.Column(db.String(8), index=False) # write/read/hidden
    annotation = db.Column(db.Boolean, default=False, index=False)

    def __repr__(self):
        return '<User permission exception for user {} for survey {}>'.format(self.user_id,self.survey_id)

class SurveyShare(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), index=True, unique=False)
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisation.id'), index=True, unique=False)
    permission = db.Column(db.String(8), index=False) # write/read
    # write = db.Column(db.Boolean, default=False, index=False)

    def __repr__(self):
        return '<A survey share for survey {} to organisation {}>'.format(self.survey_id,self.organisation_id)

class ERangerID(db.Model):
    id = db.Column(db.String(64), primary_key=True)
    api_key = db.Column(db.String(32), index=True)
    cluster_id = db.Column(db.Integer, db.ForeignKey('cluster.id'), index=True, unique=False)

    def __repr__(self):
        return '<Earth Ranger ID object for cluster {}>'.format(self.cluster_id)

class Cameragroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), index=False)
    cameras = db.relationship('Camera', backref='cameragroup', lazy=True)
    masks = db.relationship('Mask', backref='cameragroup', lazy=True)

    def __repr__(self):
        return '<Cameragroup {}>'.format(self.name)

class Mask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cameragroup_id = db.Column(db.Integer, db.ForeignKey('cameragroup.id'), index=True, unique=False)
    shape = db.Column(Geometry('POLYGON', srid=32734), index=True, unique=False)    # 32734 is the SRID for UTM Zone 34S (This is a hack because we can't use SRID = 0, so we use a linear unit to avoid distortion for cartesian coordinates)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)

    def __repr__(self):
        return '<Mask {}>'.format(self.id)

class Staticgroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(10), index=True) # accepted/rejected/unknown
    detections = db.relationship('Detection', backref='staticgroup', lazy=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=False)

    def __repr__(self):
        return '<Staticgroup {}>'.format(self.id)

class APIKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    api_key = db.Column(db.String(32), index=True, unique=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), index=False, unique=False)

    def __repr__(self):
        return '<APIKey for {}>'.format(self.survey_id)

class ClassificationLabel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    classification = db.Column(db.String(64), index=False)
    classifier_id = db.Column(db.Integer, db.ForeignKey('classifier.id'), index=False, unique=False)
    threshold = db.Column(db.Float, index=False)

    def __repr__(self):
        return '<Classification label {}>'.format(self.classification)

db.Index('ix_det_srce_scre_stc_stat_class_classcre', Detection.source, Detection.score, Detection.static, Detection.status, Detection.classification, Detection.class_score)
db.Index('ix_cluster_examined_task', Cluster.examined, Cluster.task_id)
db.Index('ix_det_similarity_2_1', DetSimilarity.detection_2, DetSimilarity.detection_1, unique=True)
db.Index('ix_ind_similarity_2_1', IndSimilarity.individual_2, IndSimilarity.individual_1, unique=True)
