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

from asyncio import queues
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_bootstrap import Bootstrap
from config import Config
import os
import os.path
from celery import Celery
import logging
from logging.handlers import RotatingFileHandler
import sys
from kombu import Queue
from flask_mail import Mail
from werkzeug.middleware.proxy_fix import ProxyFix
from celery.signals import celeryd_after_setup

REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
REDIS_ADDRESS = 'redis://'+REDIS_IP+':6379/0'

task_routes = {
        'megadetectorworker.megaDetector.infer': {
            'queue': 'celery',
            'routing_key': 'celery.infer',
        },
        # 'megadetectorworker.megaDetector.classify': {
        #     'queue': 'classification',
        #     'routing_key': 'classification.classify',
        # },
        'megadetectorworker.megaDetector.inferAndClassify': {
            'queue': 'local',
            'routing_key': 'local.inferAndClassify',
        },
}

def make_celery(flask_app):
    celery = Celery(
        'TrapTagger',
        backend=REDIS_ADDRESS,
        broker=REDIS_ADDRESS,
        broker_transport_options={
            'visibility_timeout': 86400,
            'queue_order_strategy': 'priority'
        },
        result_expires=86400
    )
    # worker_prefetch_multiplier=1,
    # task_reject_on_worker_lost=True,
    # task_acks_late=True,
    # task_acks_on_failure_or_timeout=False,
    celery.conf.update(flask_app.config)

    ####
    celery.conf.task_acks_late = True
    celery.conf.worker_prefetch_multiplier = 1
    celery.conf.task_default_queue = 'default'
    celery.conf.task_queues = (
        Queue('default',    routing_key='task.#'),
        Queue('celery',     routing_key='celery.#'),
        # Queue('classification',     routing_key='classification.#'),
        Queue('local',     routing_key='local.#'),
        Queue('priority',     routing_key='priority.#'),
        Queue('parallel',     routing_key='parallel.#'),
    )
    celery.conf.task_default_exchange = 'tasks'
    celery.conf.task_default_exchange_type = 'topic'
    celery.conf.task_default_routing_key = 'task.default'
    ####

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 #set the max request size to 50MB
app.config['CELERY_BROKER_URL'] = REDIS_ADDRESS
app.config.from_object(Config)
# app.config['SQLALCHEMY_ECHO'] = True
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1, x_proto=1)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login = LoginManager(app)
bootstrap = Bootstrap(app)
login.login_view = 'login_page'
mail = Mail(app)

if not os.path.exists('logs'):
    os.mkdir('logs')

logger = logging.getLogger(__name__)
file_handler = RotatingFileHandler('logs/traptagger.log', maxBytes=1024000, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)
logger.addHandler(file_handler)

handler = logging.StreamHandler(stream=sys.stderr)
logger.addHandler(handler)

logger.setLevel(logging.INFO)
logger.info('App Startup')

celery = make_celery(app)

from app import routes
from app.functions.globals import update_label_ids
update_label_ids()

@celeryd_after_setup.connect
def initialise_periodic_functions(sender, instance, **kwargs):
    '''Initialises the periodic functions, which then call themselves when they complete. Prevents overlap when server is under load.'''

    if sender=='celery@priority_worker':
        import sqlalchemy as sa
        from flask_migrate import upgrade
        from app.functions.imports import setupDatabase
        from app.functions.annotation import manageTasks
        from app.functions.globals import importMonitor
   
        # Try to create the database in case it does not exist. If it allready exists a sqlalchemy ProgrammingError
        # exception will be raised, which we can then ignore.
        try:
            engine = sa.create_engine(Config.SQLALCHEMY_DATABASE_SERVER,echo=True)
            engine.execute("CREATE DATABASE " + Config.SQLALCHEMY_DATABASE_NAME)
        except sa.exc.ProgrammingError:
            pass

        # Upgrade the db to the latest schema version
        with app.app_context():
            upgrade()

        setupDatabase()

        importMonitor.apply_async(queue='priority', priority=0)
        manageTasks.apply_async(queue='priority', priority=0)
        print('Periodic functions initialised.')