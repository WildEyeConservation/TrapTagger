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

'''Shuts down the application by stopping all task consumption before re-queueing all active and reserved tasks.'''

from app import app, db, celery
from config import Config
# import redis
import importlib
import re
import GLOBALS
from app.models import *

# Stop all task consumption
allQueues = ['default'] #default needs to be first
allQueues.extend([queue for queue in Config.QUEUES if queue not in allQueues])
allQueues.extend([r[0] for r in db.session.query(Classifier.queue).filter(Classifier.active==True).filter(Classifier.queue!=None).distinct().all()])
for queue in allQueues:
    celery.control.cancel_consumer(queue)

app.logger.info('')
app.logger.info('*********************************************************')
app.logger.info('')
app.logger.info('All queues cancelled. Revoking active tasks...')

# revoke active and reserved tasks
active_tasks = []
inspector = celery.control.inspect()
inspector_reserved = inspector.reserved()
inspector_active = inspector.active()
defaultWorkerNames = ['default_worker','traptagger_worker','ram_worker']

if inspector_active!=None:
    for worker in inspector_active:
        if any(name in worker for name in defaultWorkerNames): active_tasks.extend(inspector_active[worker])
        for task in inspector_active[worker]:
            try:
                celery.control.revoke(task['id'], terminate=True)
            except:
                pass

if inspector_reserved != None:
    for worker in inspector_reserved:
        if any(name in worker for name in defaultWorkerNames): active_tasks.extend(inspector_reserved[worker])
        for task in inspector_reserved[worker]:
            try:
                celery.control.revoke(task['id'], terminate=True)
            except:
                pass

app.logger.info('Active tasks revoked. Flushing queues...')

# Flush all other (non-default) queues
for queue in allQueues:
    if queue not in ['default','ram_intensive']:
        while True:
            task = GLOBALS.redisClient.blpop(queue, timeout=1)
            if not task:
                break

app.logger.info('Queues flushed. Rescheduling active tasks...')

# Reschedule default queue tasks
for active_task in active_tasks:
    for function_location in ['app.routes','app.functions.admin','app.functions.annotation','app.functions.globals',
                                'app.functions.imports','app.functions.individualID','app.functions.permissions',
                                'app.functions.results','app.functions.utilities']:
        if function_location in active_task['name']:
            module = importlib.import_module(function_location)
            function_name = re.split(function_location+'.',active_task['name'])[1]
            active_function = getattr(module, function_name)
            break
    kwargs = active_task['kwargs']
    # priority = active_task['delivery_info']['priority']
    if 'ram_worker' in active_task['hostname']:
        queue = 'ram_intensive'
    else:
        queue = 'default'
    app.logger.info('Rescheduling {} with args {}'.format(active_task['name'],kwargs))
    active_function.apply_async(kwargs=kwargs, queue=queue) #, priority=priority)

#Ensure redis db is saved
app.logger.info('Saving redis db...')
GLOBALS.redisClient.save()
app.logger.info('Redis db saved')

app.logger.info('')
app.logger.info('*********************************************************')
app.logger.info('')
app.logger.info('                 Exited Gracefully!')
app.logger.info('          You may docker-compose down now')
app.logger.info('')
app.logger.info('*********************************************************')
app.logger.info('')