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
import time
from celery import Celery
from celery.signals import celeryd_after_setup
from depthworker import depth_model

REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery(
    'depth',
    broker='redis://' + REDIS_IP,
    backend='redis://' + REDIS_IP,
    broker_transport_options={'visibility_timeout': 1209600},
    result_expires=1209600,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
workername = 'default'


@celeryd_after_setup.connect
def setup_direct_queue(sender, instance, **kwargs):
    '''Sets the global workername variable, allowing the source of results to be recorded.'''
    global workername
    print('Workername detected as {}'.format(sender))
    workername = sender


@app.task()
def depth_estimate(cameragroup_id, cam_name, calibration_items, trap_items, sourceBucket, external=False):
    '''
    Celery wrapper for depth estimation on one cameragroup.

        Parameters:
            cameragroup_id (int): Cameragroup ID for this job.
            cam_name (str): Camera/cameragroup name for the transects folder path.
            calibration_items (list): Calibration image dicts (image_path, bbox, known_distance).
            trap_items (list): Trap detection dicts (detection_id, image_path, bbox).
            sourceBucket (str): S3 bucket to download images from.
            external (bool): Whether images are external to S3.

        Returns:
            results (dict): {str(detection_id): {'distance': float|None, 'error': str|None}}
    '''
    starttime = time.time()
    print(
        'Depth job started for cameragroup {} ({}): {} calibration, {} trap detections'.format(
            cameragroup_id, cam_name, len(calibration_items), len(trap_items)
        )
    )

    results = depth_model.infer(
        cameragroup_id,
        cam_name,
        calibration_items,
        trap_items,
        sourceBucket,
        external,
    )

    finishtime = time.time()
    print(
        'Depth job completed for cameragroup {} in {}s ({} results)'.format(
            cameragroup_id, finishtime - starttime, len(results)
        )
    )
    return results