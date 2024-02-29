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

import os
import time
from celery import Celery
from celery.signals import celeryd_after_setup
from llavaworker import llava_model

BASE = "/data"
REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery('llava', broker='redis://'+REDIS_IP,backend='redis://'+REDIS_IP,broker_transport_options={'visibility_timeout': 86400},result_expires=86400,task_acks_late=True)
workername="default"

tokenizer = None
model = None
image_processor = None
context_len = None
conv_mode = None

@celeryd_after_setup.connect
def setup_direct_queue(sender, instance, **kwargs):
    '''Sets the global workername variable, allowing the source of results to be recorded.'''
    global workername
    print("Workername detected as {}".format(sender))
    workername=sender

@app.task()
def llava_infer(batch,sourceBucket,prompt,external=False):
    '''
    Celery wrapper for llava. Runs on the supplied batch of images. 

        Parameters:
            batch (list): A batch of image keys to be processed.
            sourceBucket (str): The image source - base URL if external, S3 bucket otherwise.
            external (bool): Whether the images are external to S3.
            prompt (str): The prompt to use on each of the images

        Returns:
            results (dict): A dictionary of the form {image_key: result} for each image in the batch.
    '''

    starttime = time.time()
    global model,tokenizer,image_processor,context_len,conv_mode
    if model == None: model,tokenizer,image_processor,context_len,conv_mode = llava_model.init()
    inittime = time.time()

    response = {}
    for image in batch:
       response[image] = llava_model.infer(image,sourceBucket,external,prompt,model,tokenizer,image_processor,context_len,conv_mode)
       print(image,response[image])

    finishtime = time.time()
    print('LLaVA job completed in {}s.'.format(finishtime-starttime))
    print('Init completed in {}s.'.format(inittime-starttime))
    print('Inference completed in {}s with an average if {} per image.'.format(finishtime-inittime,(finishtime-inittime/len(batch))))
    
    return response