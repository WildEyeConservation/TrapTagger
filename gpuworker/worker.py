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
from celery import Celery
from celery.signals import celeryd_after_setup
from gpuworker import detector
from gpuworker import classifier

BASE = "/data"
REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery('megaDetector', broker='redis://'+REDIS_IP,backend='redis://'+REDIS_IP,broker_transport_options={'visibility_timeout': 86400},result_expires=86400,task_acks_late=True)
workername="default"

@celeryd_after_setup.connect
def setup_direct_queue(sender, instance, **kwargs):
    '''Sets the global workername variable, allowing the source of results to be recorded.'''
    global workername
    print("Workername detected as {}".format(sender))
    workername=sender

@app.task()
def detection(batch,sourceBucket,external,model):
    '''
    Celery wrapper for the detector. Runs on the supplied batch of images, returning all detections with a score greater than 0.05. 

        Parameters:
            batch (list): A batch of image keys to be processed.
            sourceBucket (str): The image source - base URL if external, S3 bucket otherwise.
            external (bool): Whether the images are external to S3.
            model (str): The detector to use

        Returns:
            results (list): A list of detections for each image in the batch
    '''
    return detector.infer(batch,sourceBucket,external,model)

@app.task()
def detectAndClassify(batch,model,threshold):
    '''
    Celery function for running both detection and classification on a batch of image URLs for the API.

        Parameters:
            batch (list): List of image urls to process
            detector_model (str): The detector to use
            threshold (float): The confidence threshold to use

        Returns:
            output (dict): The detections and their classifications in a url-keyed dictionary
    '''

    try:
        result, images = detector.infer(batch,'',True,model,threshold,True)
        
        index = 0
        detections = {}
        image_detections = {}
        for n in range(len(batch)):
            imageURL = batch[n]
            image_detections[imageURL] = []
            for detection in result[n]:
                detection_id = str(index)
                detections[detection_id] = detection
                image_detections[imageURL].append(detection_id)
                index += 1

        result = classifier.infer({'images': images, 'detections': detections, 'image_detections':image_detections})

        output = []
        for url in batch:
            image_output = {'url': url, 'detections':[]}
            for detID in image_detections[url]:
                image_output['detections'].append({
                    'top': detections[detID]['top'],
                    'left': detections[detID]['left'],
                    'bottom': detections[detID]['bottom'],
                    'right': detections[detID]['right'],
                    'classification': result[detID]['classification'],
                    'score': float(result[detID]['score'])
                })
            output.append(image_output)

        print('Result complete: {}'.format(output))
        return output
    except:
        return 'Error'

@app.task()
def classify(batch):
    '''
    Celery wrapper for running species classification on the supplied batch of images. Returns a classification and associated confidence score for each detection ID.
    
        Parameters:
            batch (dict): Dictionary consisting of image urls, and their detections for processing.

        Returns:
            result (dict): detection-ID-keyed dictionary containing a classification and associated score.
    '''
    return classifier.infer(batch)