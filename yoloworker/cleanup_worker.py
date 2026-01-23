'''
Copyright 2026

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

'''Cleans up the local worker by stopping its task consumption before re-queueing its active and reserved tasks.'''

from yoloworker.worker import app as celery
from yoloworker.config import Config
import importlib
import re
import sys

celery.control.cancel_consumer(queue=Config.QUEUE, destination=[Config.WORKER_NAME])
inspector = celery.control.inspect()

active_tasks = []
active_tasks.extend(inspector.active()[Config.WORKER_NAME])
active_tasks.extend(inspector.reserved()[Config.WORKER_NAME])

for active_task in active_tasks:
    for function_location in ['yoloworker.worker']:
        if function_location in active_task['name']:
            module = importlib.import_module(function_location)
            function_name = re.split(function_location+'.',active_task['name'])[1]
            active_function = getattr(module, function_name)
            break
    kwargs = active_task['kwargs']
    task_id = active_task['id']
    priority = active_task['delivery_info']['priority']
    print('Rescheduling {} with args {}'.format(active_task['name'],kwargs))
    active_function.apply_async(kwargs=kwargs, queue=Config.QUEUE, priority=priority, task_id=task_id)

sys.exit(99)