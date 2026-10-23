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


class Config(object):
    WORKER_NAME = 'celery@worker' + str(os.environ.get('WORKER_NUMBER')) + '@' + os.environ.get('WORKER_NAME')
    QUEUE = os.environ.get('QUEUE')

    # Local model paths (baked into the AMI / mounted at launch)
    MIEWID_MODEL_DIR = os.environ.get(
        'MIEWID_MODEL_DIR',
        '/opt/models/miewid-msv3-4f1d7f2b',
    )
    SAM_CHECKPOINT = os.environ.get(
        'SAM_CHECKPOINT',
        '/opt/models/sam_vit_h_4b8939.pth',
    )
    SCARCENET_CHECKPOINT = os.environ.get(
        'SCARCENET_CHECKPOINT',
        '/opt/models/model_best.pth',
    )
    SCARCENET_CFG = os.environ.get(
        'SCARCENET_CFG',
        'ScarceNet/experiments/ap10k/hrnet/w32_256x192_adam_lr1e-3.yaml',
    )

    # Mini-batch size for the MiewID forward pass only (SAM still runs per image)
    MIEWID_EMBED_BATCH = int(os.environ.get('MIEWID_EMBED_BATCH', '32'))
