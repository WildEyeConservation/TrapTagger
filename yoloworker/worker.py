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

import os
from celery import Celery
from celery.signals import celeryd_after_setup
import sys
from yoloworker.config import Config
from yoloworker import yolo_classifier


BASE = "/data"
REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery('yolo', broker='redis://'+REDIS_IP,backend='redis://'+REDIS_IP,broker_transport_options={'visibility_timeout': 1209600},result_expires=1209600,task_acks_late=True,worker_prefetch_multiplier=1)
workername="default"

@celeryd_after_setup.connect
def setup_direct_queue(sender, instance, **kwargs):
    '''Sets the global workername variable, allowing the source of results to be recorded.'''
    global workername
    print("Workername detected as {}".format(sender))
    workername=sender

@app.task()
def classify(batch):
    '''
    Celery wrapper for running species classification on the supplied batch of images. Returns a classification and associated confidence score for each detection ID.
    
        Parameters:
            batch (dict): Dictionary consisting of image urls, and their detections for processing.

        Returns:
            result (dict): detection-ID-keyed dictionary containing a classification and associated score.
    '''
    return yolo_classifier.infer(batch)
