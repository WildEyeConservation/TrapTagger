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

class Config(object):
    WORKER_NAME = 'celery@worker'+str(os.environ.get('WORKER_NUMBER'))+'@'+os.environ.get('WORKER_NAME')
    QUEUE = os.environ.get('QUEUE')

    # WBIA Configs
    WBIA_DB_NAME = os.environ.get('WBIA_DB_NAME')
    WBIA_DB_SERVER = os.environ.get('WBIA_DB_SERVER')
    WBIA_DB_URI = WBIA_DB_SERVER+"/"+WBIA_DB_NAME
    WBIA_DIR = os.environ.get('WBIA_DIR')
