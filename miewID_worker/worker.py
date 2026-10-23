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

'''
Celery entrypoint for the MiewID GPU worker.

TrapTagger enqueues `miewid_prepare` onto queue `miewid` (routing_key
`miewid.prepare`). This process loads models once, then returns flank +
embedding per detection (see miewid_prepare@v1 contract).
'''

import os
import time

from celery import Celery
from celery.signals import celeryd_after_setup

REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery(
    'miewid',
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
    '''Record the Celery worker hostname for cleanup / logging.'''
    global workername
    print('Workername detected as {}'.format(sender))
    workername = sender


@app.task()
def miewid_prepare(batch, sourceBucket, species):
    '''
    SAM segment + ScarceNet flank + MiewID embedding for a batch of detections.

        Parameters:
            batch (list): Items with keys detection_id, image_id, bbox, image_path
            sourceBucket (str): S3 bucket containing the images
            species (str): Species string (logging / temp folder naming)

        Returns:
            dict: {
                str(detection_id): {
                    'flank': 'L'|'R'|'A',
                    'embedding': list[float]  # length 2152, L2-normalized
                },
                ...
            }
            Failed detections are omitted.
    '''
    from miewID_worker import miewid_model

    starttime = time.time()
    print(
        'miewid_prepare started: {} detections, species={}, bucket={}'.format(
            len(batch) if batch else 0, species, sourceBucket
        )
    )

    results = miewid_model.process_batch(batch, sourceBucket, species)

    print(
        'miewid_prepare finished in {:.1f}s ({} successes)'.format(
            time.time() - starttime, len(results)
        )
    )
    return results
