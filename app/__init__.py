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

from config import Config
if Config.MONKEY_PATCH=='true':
    from gevent import monkey
    monkey.patch_all()

from asyncio import queues
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_bootstrap import Bootstrap
import os
import os.path
from celery import Celery
from celery.schedules import crontab
import logging
from logging.handlers import RotatingFileHandler
import sys
from kombu import Queue
from flask_mail import Mail
from werkzeug.middleware.proxy_fix import ProxyFix
from celery.signals import celeryd_after_setup
# import debugpy
# debugpy.listen(5678)

REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
REDIS_ADDRESS = 'redis://'+REDIS_IP+':6379/0'

# task_routes = {
#         'gpuworker.worker.detection': {
#             'queue': 'celery',
#             'routing_key': 'celery.detection',
#         },
#         # 'gpuworker.worker.classify': {
#         #     'queue': 'classification',
#         #     'routing_key': 'classification.classify',
#         # },
#         'gpuworker.worker.detectAndClassify': {
#             'queue': 'local',
#             'routing_key': 'local.detectAndClassify',
#         },
# }

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

    task_queues = [
        Queue('default',    routing_key='task.#'),
        Queue('celery',     routing_key='celery.#'),
        # Queue('classification',     routing_key='classification.#'),
        Queue('local',     routing_key='local.#'),
        Queue('priority',     routing_key='priority.#'),
        Queue('parallel',     routing_key='parallel.#'),
        Queue('parallel_2',     routing_key='parallel_2.#'),
        Queue('ram_intensive',     routing_key='ram_intensive.#'),
        Queue('statistics',     routing_key='statistics.#'),
        Queue('pipeline',     routing_key='pipeline.#'),
        Queue('llava',     routing_key='llava.#'),
        Queue('similarity',     routing_key='similarity.#')
    ]

    if not Config.INITIAL_SETUP:
        from app.models import Classifier
        for classifier in db.session.query(Classifier).filter(Classifier.active==True).filter(Classifier.name!='MegaDetector').all():
            task_queues.append(Queue(classifier.name,routing_key=classifier.name+'.#'))

    ####
    celery.conf.task_acks_late = True
    celery.conf.worker_prefetch_multiplier = 1
    celery.conf.task_default_queue = 'default'
    celery.conf.task_queues = task_queues
    celery.conf.task_default_exchange = 'tasks'
    celery.conf.task_default_exchange_type = 'topic'
    celery.conf.task_default_routing_key = 'task.default'
    ####

    # Store site stats on the first of the month
    celery.conf.beat_schedule = {
        'updateStatistics': {
            'task': 'app.functions.admin.updateStatistics',
            'schedule': crontab(hour=0,minute=0),
        },
    }

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
    try:
        os.mkdir('logs')
    except:
        pass

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

# Need db-uri arguement for wbia db
db_uri = Config.WBIA_DB_URI
if db_uri and '--db-uri' not in sys.argv:
    sys.argv.extend(['--db-uri', db_uri])

if Config.INITIALISE_IBS=='true':
    import GLOBALS
    if not GLOBALS.ibs:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore")
            from wbia import opendb
            GLOBALS.ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR, allow_newdir=True)
        app.logger.info('IBS initialised.')


# Create featurematches table in wbia db
# from wbia import opendb
# ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR, allow_newdir=True)
# ibs.db.add_table(
#     'featurematches',
#     [
#         ('fm_rowid', 'INTEGER PRIMARY KEY'),
#         ('annot_rowid1', 'INTEGER NOT NULL'),
#         ('annot_rowid2', 'INTEGER NOT NULL'),
#         ('fm', 'NDARRAY'),
#         ('fs', 'NDARRAY'),
#     ],
#     docstr="""
#     Stores feature matches between two annotations (index of the matching keypoints) and the feature scores
#     """,
#     superkeys=[('annot_rowid1', 'annot_rowid2')],
#     relates=('annotations', 'annotations'),
#     dependsmap={
#         'annot_rowid1': ('annotations', ('annot_rowid',), ('annot_visual_uuid',)),
#         'annot_rowid2': ('annotations', ('annot_rowid',), ('annot_visual_uuid',)),
#     },
# )

from app import routes
from app.functions.globals import update_label_ids
if not Config.MAINTENANCE: update_label_ids()

@celeryd_after_setup.connect
def initialise_periodic_functions(sender, instance, **kwargs):
    '''Initialises the periodic functions, which then call themselves when they complete. Prevents overlap when server is under load.'''

    if (not Config.MAINTENANCE) and (sender=='celery@priority_worker'):
        import sqlalchemy as sa
        import redis
        from app.models import Classifier
        # from flask_migrate import upgrade
        from app.functions.imports import setupDatabase
        from app.functions.annotation import manageTasks
        from app.functions.globals import importMonitor
        import GLOBALS
   
        # Try to create the database in case it does not exist. If it allready exists a sqlalchemy ProgrammingError
        # exception will be raised, which we can then ignore.
        try:
            engine = sa.create_engine(Config.SQLALCHEMY_DATABASE_SERVER,echo=True)
            engine.execute("CREATE DATABASE " + Config.SQLALCHEMY_DATABASE_NAME)
        except sa.exc.ProgrammingError:
            pass

        # # Upgrade the db to the latest schema version
        # with app.app_context():
        #     upgrade()

        setupDatabase()

        # Flush all other (non-default) queues
        allQueues = ['default'] #default needs to be first
        allQueues.extend([queue for queue in Config.QUEUES if queue not in allQueues])
        allQueues.extend([r[0] for r in db.session.query(Classifier.name).all()])
        for queue in allQueues:
            if queue not in ['default','ram_intensive']:
                while True:
                    task = GLOBALS.redisClient.blpop(queue, timeout=1)
                    if not task:
                        break

        print('Queues flushed.')

        # importMonitor.apply_async(queue='priority', priority=0)
        # manageTasks.apply_async(queue='priority', priority=0)
        # clean_up_redis.apply_async(queue='priority', priority=0)
        # print('Periodic functions initialised.')