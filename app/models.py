'''
Copyright 2022

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

tags = db.Table('tags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), index=True),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('tag_id', 'cluster_id')
)

labelstable = db.Table('labelstable',
    db.Column('label_id', db.Integer, db.ForeignKey('label.id'), index=True),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('label_id', 'cluster_id')
)

images = db.Table('images',
    db.Column('image_id', db.Integer, db.ForeignKey('image.id'), index=True),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('image_id', 'cluster_id')
)

requiredimagestable = db.Table('requiredimagestable',
    db.Column('image_id', db.Integer, db.ForeignKey('image.id'), index=True),
    db.Column('cluster_id', db.Integer, db.ForeignKey('cluster.id')),
    db.UniqueConstraint('image_id', 'cluster_id')
)

detectionTags = db.Table('detectionTags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), index=True),
    db.Column('labelgroup_id', db.Integer, db.ForeignKey('labelgroup.id'), index=True),
    db.UniqueConstraint('tag_id', 'labelgroup_id')
)

detectionLabels = db.Table('detectionLabels',
    db.Column('label_id', db.Integer, db.ForeignKey('label.id'), index=True),
    db.Column('labelgroup_id', db.Integer, db.ForeignKey('labelgroup.id'), index=True),
    db.UniqueConstraint('label_id', 'labelgroup_id')
)

workersTable = db.Table('workersTable',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), index=True),
    db.Column('worker_id', db.Integer, db.ForeignKey('user.id')),
    db.UniqueConstraint('user_id', 'worker_id')
)

individualDetections = db.Table('individualDetections',
    db.Column('detection_id', db.Integer, db.ForeignKey('detection.id'), index=True),
    db.Column('individual_id', db.Integer, db.ForeignKey('individual.id')),
    db.UniqueConstraint('detection_id', 'individual_id')
)

individualTags = db.Table('individualTags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), index=True),
    db.Column('individual_id', db.Integer, db.ForeignKey('individual.id')),
    db.UniqueConstraint('tag_id', 'individual_id')
)

individual_parent_child = db.Table("individual_parent_child", #db.Base.metadata,
    db.Column("parent_id", db.Integer, db.ForeignKey("individual.id"), primary_key=True),
    db.Column("child_id", db.Integer, db.ForeignKey("individual.id"), primary_key=True),
    db.UniqueConstraint('parent_id', 'child_id')
)

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(64), index=False, unique=False)
    timestamp = db.Column(db.DateTime, index=False)
    corrected_timestamp = db.Column(db.DateTime, index=True)
    detection_rating = db.Column(db.Float, default=0, index=True)
    hash = db.Column(db.String(64), index=True)
    detections = db.relationship('Detection', backref='image', lazy='dynamic')
    camera_id = db.Column(db.Integer, db.ForeignKey('camera.id'), index=True, unique=False)

    def __repr__(self):
        return '<Image {}>'.format(self.filename)


class Camera(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(256), index=True, unique=False)
    flagged = db.Column(db.Boolean, default=False, index=True)
    images = db.relationship('Image', backref='camera', lazy='dynamic')
    trapgroup_id = db.Column(db.Integer, db.ForeignKey('trapgroup.id'))

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
    status = db.Column(db.String(64), index=False)
    images_processing = db.Column(db.Integer, default=0, index=False)
    processing_initialised = db.Column(db.Boolean, default=False, index=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    classifier_version = db.Column(db.String(64), default='None', index=False)
    correct_timestamps = db.Column(db.Boolean, default=False, index=False)
    trapgroups = db.relationship('Trapgroup', backref='survey', lazy='dynamic')
    tasks = db.relationship('Task', backref='survey', lazy='dynamic')

    def __repr__(self):
        return '<Survey {}>'.format(self.name)

    @staticmethod
    def get_or_create(session, name, user_id, trapgroup_code):
        survey = session.query(Survey).filter_by(name=name,user_id=user_id).first()
        if not (survey):
            survey = Survey(name=name,user_id=user_id,trapgroup_code=trapgroup_code)
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
    cameras = db.relationship('Camera', backref='trapgroup', lazy='dynamic')

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
    labels = db.relationship('Label', secondary=detectionLabels, lazy='subquery', backref=db.backref('labelgroups', lazy=True))
    tags = db.relationship('Tag', secondary=detectionTags, lazy='subquery', backref=db.backref('labelgroups', lazy=True))

    def __repr__(self):
        return '<Label group for detection {}>'.format(self.detection_id)

class Detection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, db.ForeignKey('image.id'), index=True)
    category = db.Column(db.Integer, index=True)
    source = db.Column(db.String(64), index=False)
    status = db.Column(db.String(64), index=True)
    top = db.Column(db.Float, index=False)
    left = db.Column(db.Float, index=False)
    right = db.Column(db.Float, index=False)
    bottom = db.Column(db.Float, index=False)
    score = db.Column(db.Float, index=True)
    static = db.Column(db.Boolean, default=False, index=True)
    classification = db.Column(db.String(64), index=True)
    class_score = db.Column(db.Float, index=True)
    labelgroups = db.relationship('Labelgroup', backref='detection', lazy='dynamic')

    def __repr__(self):
        return '<Detection of class {} on image {}>'.format(self.category, self.image_id)

class Turkcode(db.Model):
    user_id = db.Column(db.String(64), primary_key=True, index=True)
    active = db.Column(db.Boolean, default=True, index=True)
    assigned = db.Column(db.DateTime, unique=False, index=False)
    tagging_time = db.Column(db.Integer, index=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)

    def __repr__(self):
        return '<Turkcode {}>'.format(self.user_id)


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    bucket = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(64), index=False, unique=True)
    passwordHash = db.Column(db.String(128), index=False, unique=False)
    passed = db.Column(db.String(64), index=False)
    admin = db.Column(db.Boolean, default=False, index=False)
    identity_pool_id = db.Column(db.String(64), index=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    last_ping = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    clusters_allocated = db.Column(db.Integer, default=0, index=False)
    clusters = db.relationship('Cluster', backref='user', lazy='dynamic')
    trapgroup = db.relationship('Trapgroup', backref='user', lazy='dynamic')
    surveys = db.relationship('Survey', backref='user', lazy='dynamic')
    children = db.relationship('User', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
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
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    children = db.relationship('Label', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    translations = db.relationship('Translation', backref='label', lazy='dynamic')
    individuals = db.relationship('Individual', backref='label', lazy='dynamic')

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
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=False)
    allocated = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    allocation_timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    detections = db.relationship('Detection', secondary=individualDetections, lazy='subquery', backref=db.backref('individuals', lazy=True))
    tags = db.relationship('Tag', secondary=individualTags, lazy='subquery', backref=db.backref('individuals', lazy=True))
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
    lastAssigned = db.Column(db.DateTime, unique=False, index=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=False)
    notes = db.Column(db.String(512), index=False)
    checked = db.Column(db.Boolean, default=False, index=True)
    classification_checked = db.Column(db.Boolean, default=False, index=True)
    classification = db.Column(db.String(64), index=True)
    examined = db.Column(db.Boolean, default=False, index=True)
    skipped = db.Column(db.Boolean, default=False, index=True)
    images = db.relationship('Image', secondary=images, lazy='subquery', backref=db.backref('clusters', lazy=True))
    required_images = db.relationship('Image', secondary=requiredimagestable, lazy='subquery', backref=db.backref('required_for', lazy=True))
    tags = db.relationship('Tag', secondary=tags, lazy='subquery', backref=db.backref('clusters', lazy=True))
    labels = db.relationship('Label', secondary=labelstable, lazy='subquery', backref=db.backref('clusters', lazy=True))

    def __repr__(self):
        return '<Cluster {}>'.format(self.id)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(256), index=False, unique=False)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), index=True)
    tagging_level = db.Column(db.String(32), index=False)
    test_size = db.Column(db.Integer, index=False)
    size = db.Column(db.Integer, index=False)
    status = db.Column(db.String(32), index=False)
    tagging_time = db.Column(db.Integer, index=False)
    complete = db.Column(db.Boolean, default=False, index=False)
    is_bounding = db.Column(db.Boolean, default=False, index=True)
    parent_classification = db.Column(db.Boolean, default=False, index=False)
    jobs_finished = db.Column(db.Integer, default=0, index=False)
    current_name = db.Column(db.String(8), index=False)
    clusters = db.relationship('Cluster', backref='task', lazy='dynamic')
    turkcodes = db.relationship('Turkcode', backref='task', lazy='dynamic')
    labels = db.relationship('Label', backref='task', lazy='dynamic')
    tags = db.relationship('Tag', backref='task', lazy='dynamic')
    labelgroups = db.relationship('Labelgroup', backref='task', lazy='dynamic')
    translations = db.relationship('Translation', backref='task', lazy='dynamic')
    individuals = db.relationship('Individual', backref='task', lazy='dynamic')

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
    id = db.Column(db.Integer, primary_key=True)
    detection_1 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    detection_2 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    score = db.Column(db.Float, index=True)

    def __repr__(self):
        return '<Detection similarity for {} and {}>'.format(self.detection_1, self.detection_2)


class IndSimilarity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    individual_1 = db.Column(db.Integer, db.ForeignKey('individual.id'), index=True)
    individual_2 = db.Column(db.Integer, db.ForeignKey('individual.id'), index=True)
    detection_1 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    detection_2 = db.Column(db.Integer, db.ForeignKey('detection.id'), index=True)
    score = db.Column(db.Float, index=True)
    old_score = db.Column(db.Float, index=False)
    skipped = db.Column(db.Boolean, default=False, index=True)
    allocated = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    allocation_timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return '<Individual similarity for {} and {}>'.format(self.individual_1, self.individual_2)
