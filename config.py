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

basedir = os.path.abspath(os.path.dirname(__file__))

class Config(object):
    LOAD_TESTING = False
    DEBUGGING = False
    MAINTENANCE = False
    INITIAL_SETUP = False
    VERSION = 34

    HOST_IP = os.environ.get('HOST_IP')
    REDIS_IP = os.environ.get('REDIS_IP')
    KEY_NAME = os.environ.get('KEY_NAME')
    WORKER_NAME = 'celery@'+os.environ.get('WORKER_NAME')
    QUEUE = os.environ.get('QUEUE')
    BUCKET = os.environ.get('BUCKET')
    SKIP_ID = -117
    SKY_CONST = 0.33
    DETECTOR = 'MDv5b'
    VAT=1.15
    ADMIN_USERS = ['Admin','WildEye','Dashboard','Wild Parks','Nicholas','Marguerite','API']
    AWS_S3_UPLOAD_ACCESS_KEY_ID = os.environ.get('AWS_S3_UPLOAD_ACCESS_KEY_ID')
    AWS_S3_UPLOAD_SECRET_ACCESS_KEY = os.environ.get('AWS_S3_UPLOAD_SECRET_ACCESS_KEY')
    MONKEY_PATCH = os.environ.get('MONKEY_PATCH')
    INITIALISE_IBS = os.environ.get('INITIALISE_IBS')
    AWS_ACCOUNT_ID = str(os.environ.get('AWS_ACCOUNT_ID'))

    DETECTOR_THRESHOLDS = {
        'MDv4': 0.8,
        'MDv5a': 0.2,
        'MDv5b': 0.1,
        'error': 1.0,
        'golden': 0.9,
        'user': 0,
        'api': 0
    }

    DISALLOWED_USERNAMES = ['admin','dashboard','api']

    # SQLAlchemy Config
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_SERVER =  os.environ.get('DATABASE_SERVER')
    SQLALCHEMY_DATABASE_NAME =  os.environ.get('DATABASE_NAME')
    SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_SERVER+"/"+SQLALCHEMY_DATABASE_NAME
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    #Postgres Config
    WBIA_DB_NAME = os.environ.get('WBIA_DB_NAME')
    WBIA_DB_SERVER = os.environ.get('WBIA_DB_SERVER')
    WBIA_DB_URI = WBIA_DB_SERVER+"/"+WBIA_DB_NAME
    WBIA_DIR = os.environ.get('WBIA_DIR')

    # Email Config
    MAIL_SERVER = 'smtp.gmail.com'
    SSL_MAIL_PORT = 465
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    ADMINS = [os.environ.get('MAIL_USERNAME')]
    MONITORED_EMAIL_ADDRESS = os.environ.get('MONITORED_EMAIL_ADDRESS')

    AWS_REGION = os.environ.get('REGION_NAME')
    TOKEN = os.environ.get('TOKEN')
    IAM_ADMIN_GROUP = os.environ.get('IAM_ADMIN_GROUP')

    #Worker config
    PARALLEL_AMI = os.environ.get('PARALLEL_AMI')
    LLAVA_AMI = os.environ.get('LLAVA_AMI')
    BRANCH = os.environ.get('BRANCH')
    GPU_INSTANCE_TYPES = ['g4dn.xlarge'] #['p3.2xlarge', 'g4dn.xlarge', 'g3s.xlarge']
    XL_GPU_INSTANCE_TYPES = ['g5.12xlarge']
    CPU_INSTANCE_TYPES = ['t2.xlarge','t3a.xlarge'] #['t2.medium', 't3a.medium']
    PIPELINE_INSTANCE_TYPES = ['t2.xlarge','t3a.xlarge']
    INSTANCE_RATES = {
        'celery':           {'p3.2xlarge': 11668, 'g4dn.xlarge': 4128, 'g3s.xlarge': 2600}, #measured
        'classification':   {'p3.2xlarge': 11668, 'g4dn.xlarge': 4128, 'g3s.xlarge': 2600}, #estimated
        'parallel':         {'t2.xlarge': 1000, 't3a.xlarge': 1000},  #estimated
        'parallel_2':         {'t2.xlarge': 1000, 't3a.xlarge': 1000},  #estimated
        'default':         {'t2.xlarge': 1000, 't3a.xlarge': 1000},  #estimated
        'statistics':         {'t2.xlarge': 1000, 't3a.xlarge': 1000},  #estimated
        'pipeline':         {'t2.xlarge': 1000, 't3a.xlarge': 1000},  #estimated
        'llava':           {'g5.12xlarge': 3130}, #measured. 20 min startup
        'similarity':      {'g4dn.xlarge': 4128}
    } #Images per hour
    SG_ID = os.environ.get('SG_ID')
    PUBLIC_SUBNET_ID = os.environ.get('PUBLIC_SUBNET_ID')
    PRIVATE_SUBNET_ID = os.environ.get('PRIVATE_SUBNET_ID')
    MAX_INFER = 25
    MAX_CLASSIFICATION = 18
    MAX_PARALLEL = 25
    MAX_PARALLEL_2 = 8
    MAX_DEFAULT = 8
    MAX_STATS = 4
    MAX_PIPELINE = 8
    MAX_LLAVA = 5
    MAX_SIMILARITY = 5
    DNS = os.environ.get('DNS')

    # Species Classification Config
    CLUSTER_DET_COUNT = 1
    DET_RATIO = 0.5
    DET_AREA = 0.0025
    MIN_CLASSIFICATION_RATIO = 0.2 #the minimum ratio of detection classifications for a classification to be considered

    # Task and survey statuses
    TASK_READY_STATUSES = ['ready','success','successinitial','stopped']
    SURVEY_READY_STATUSES = ['ready','failed','stopped','cancelled','restoring files']

    # Detection statuses
    DET_IGNORE_STATUSES = ['deleted','hidden','masked']

    # Hotkey info
    NUMBER_OF_HOTKEYS = 39
    EMPTY_HOTKEY_ID= -967

    # Mask Area Config
    MIN_MASK_AREA = 0.001

    # Static Detection Config
    STATIC_MATCHCOUNT = 5
    STATIC_PERCENTAGE = 0.15
    STATIC_IOU5 = 0.6
    STATIC_IOU10 = 0.7
    STATIC_IOU30 = 0.85
    STATIC_IOU50 = 0.9
    STATIC_IOU90 = 0.95

    # Flank Config (for individual ID)
    FLANK_TEXT = {  # Database to flank text
        'L': 'left',
        'R': 'right',
        'A': 'ambiguous',
        None: 'none'
    }

    FLANK_DB = {  # Flank text to database
        'left': 'L',
        'right': 'R',
        'ambiguous': 'A',
        'none': None
    }

    # Individual ID Config
    ID_QUANTILES = [90, 80, 60, 30, 0]

    # Zip file folders
    SURVEY_ZIP_FOLDER = '_survey_zip_files_'

    # Glacier Restore 
    if DEBUGGING:
        RESTORE_TIME = 43200 # 12 hours
    else:
        RESTORE_TIME= 172800 # 48 hours
    RESTORE_COOLDOWN = 14 # 14 days
    ID_RESTORE_DAYS=30 
    DOWNLOAD_RESTORE_DAYS=7
    EDIT_RESTORE_DAYS=7
    EMPTY_RESTORE_DAYS=7
    if DEBUGGING:
        RESTORE_TIER = 'Standard'
    else:
        RESTORE_TIER = 'Bulk'

    # Lambda 
    RDS_HOST = SQLALCHEMY_DATABASE_SERVER.split('@')[1]
    RDS_USER = SQLALCHEMY_DATABASE_SERVER.split('@')[0].split('//')[1].split(':')[0]
    RDS_PASSWORD = SQLALCHEMY_DATABASE_SERVER.split('@')[0].split(':')[2]
    if DEBUGGING:
        IMAGE_IMPORT_LAMBDA = 'traptaggerImportImageDev'
        VIDEO_IMPORT_LAMBDA = 'traptaggerImportVideoDev'
        VIDEO_EXTRACT_LAMBDA = 'traptaggerExtractVideoDev'
        SQS_QUEUE = 'traptaggerLambdaDLQDev'
    else:
        IMAGE_IMPORT_LAMBDA = 'traptaggerImportImage'
        VIDEO_IMPORT_LAMBDA = 'traptaggerImportVideo'
        VIDEO_EXTRACT_LAMBDA = 'traptaggerExtractVideo'
        SQS_QUEUE = 'traptaggerLambdaDLQ'
    FFMPEG_LAYER = 'ffmpeg_layer:5'
    FFPROBE_LAYER = 'ffprobe_layer:6'
    OPENCV_LAYER = 'opencv_layer:2'
    LAMBDA_SUBNET_ID = os.environ.get('LAMBDA_SUBNET_ID')
    LAMBDA_ROLE = 'TrapTaggerImportLambdaRole'
    LAMBDA_DIR = {
        IMAGE_IMPORT_LAMBDA: 'importImage',
        VIDEO_IMPORT_LAMBDA: 'importVideo',
        VIDEO_EXTRACT_LAMBDA: 'extractVideo'
    }

    # LAMBDA CONFIG
    LAMBDA_FUNCTIONS = {
        IMAGE_IMPORT_LAMBDA: {
            'FunctionName': IMAGE_IMPORT_LAMBDA,
            'Handler': 'lambda_function.lambda_handler',
            'Role': 'arn:aws:iam::'+AWS_ACCOUNT_ID+':role/'+LAMBDA_ROLE,
            'Runtime': 'python3.12',
            'Timeout': 900,
            'MemorySize': 256,
            'EphemeralStorage': {
                'Size': 512
            },
            'Layers': [],
            'VpcConfig': {
                'SubnetIds': [LAMBDA_SUBNET_ID],
                'SecurityGroupIds': [SG_ID]
            },
            'DeadLetterConfig': {
                'TargetArn': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
            },
            'DestinationConfig': {
                'OnSuccess': {
                    'Destination': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
                }
            }
        },
        VIDEO_IMPORT_LAMBDA: {
            'FunctionName': VIDEO_IMPORT_LAMBDA,	
            'Handler': 'lambda_function.lambda_handler',
            'Role': 'arn:aws:iam::'+AWS_ACCOUNT_ID+':role/'+LAMBDA_ROLE,
            'Runtime': 'python3.9',
            'Timeout': 900,
            'MemorySize': 1024,
            'EphemeralStorage': {
                'Size': 640
            },
            'Layers': [
                'arn:aws:lambda:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':layer:'+FFMPEG_LAYER,
                'arn:aws:lambda:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':layer:'+FFPROBE_LAYER
            ],
            'VpcConfig': {
                'SubnetIds': [LAMBDA_SUBNET_ID],
                'SecurityGroupIds': [SG_ID]
            },
            'DeadLetterConfig': {
                'TargetArn': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
            },
            'DestinationConfig': {
                'OnSuccess': {
                    'Destination': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
                }
            }
        },
        VIDEO_EXTRACT_LAMBDA: {
            'FunctionName': VIDEO_EXTRACT_LAMBDA,
            'Handler': 'lambda_function.lambda_handler',
            'Role': 'arn:aws:iam::'+AWS_ACCOUNT_ID+':role/'+LAMBDA_ROLE,	
            'Runtime': 'python3.9',
            'Timeout': 900,
            'MemorySize': 512,
            'EphemeralStorage': {
                'Size': 512
            },
            'Layers': [
                'arn:aws:lambda:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':layer:'+OPENCV_LAYER
            ],
            'VpcConfig': {
                'SubnetIds': [LAMBDA_SUBNET_ID],
                'SecurityGroupIds': [SG_ID]
            },
            'DeadLetterConfig': {
                'TargetArn': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
            },
            'DestinationConfig': {
                'OnSuccess': {
                    'Destination': 'arn:aws:sqs:'+AWS_REGION+':'+AWS_ACCOUNT_ID+':'+SQS_QUEUE
                }
            }
        }
    }

    LAMBDA_LAYERS = {
        FFMPEG_LAYER: {
            'LayerName': 'ffmpeg_layer',
            'CompatibleRuntimes': ['python3.9', 'python3.12'],
            'CompatibleArchitectures': ['x86_64'],
        },
        FFPROBE_LAYER: {
            'LayerName': 'ffprobe_layer',
            'CompatibleRuntimes': ['python3.9', 'python3.12'],
            'CompatibleArchitectures': ['x86_64'],
        },
        OPENCV_LAYER: {
            'LayerName': 'opencv_layer',
            'CompatibleRuntimes': ['python3.9'],
            'CompatibleArchitectures': ['x86_64'],
        }
    }

    # Result File Type 
    RESULT_TYPES = {
        'csv': 'csv',
        'excel': 'xlsx',
        'coco': 'json',
        'export': 'zip'
    }

    # Time in seconds allowed for a worker to finish setting up beforte being checked for idleness
    SETUP_PERIOD = {
        'celery': '300',
        'classification': '300',
        'parallel': '300',
        'parallel_2': '300',
        'default': '300',
        'statistics': '300',
        'pipeline': '300',
        'llava': '1500',
        'similarity': '300',
    }

    #Aurora DB stuff
    MAX_AURORA = 64
    MIN_AURORA = 8
    DB_CLUSTER_NAME= os.environ.get('DB_CLUSTER_NAME')

    # How many multiples of 5 seconds a worker is checked for idleness
    IDLE_MULTIPLIER = {
        'celery': 12,
        'classification': 12,
        'parallel': 24,
        'parallel_2': 12,
        'default': 12,
        'statistics': 12,
        'pipeline': 12,
        'llava': 12,
        'similarity': 12
    }

    # Celery Worker concurrency
    CONCURRENCY = {
        'parallel': 1,
        'parallel_2': 1,
        'default': 1,
        'statistics': 1,
        'pipeline': 1,
        'llava': 1
    }

    # Queue config
    QUEUES = {
        'parallel': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_PARALLEL,
            'launch_delay': 180,
            'rate': 4, #2695
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'parallel_worker_{}' + ' ' + 
                'parallel' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['parallel'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['parallel']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "'" +
                ' -l info'
        },
        'parallel_2': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_PARALLEL_2,
            'launch_delay': 180,
            'rate': 4, #2695
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'parallel_2_worker_{}' + ' ' + 
                'parallel_2' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['parallel_2'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['parallel_2']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "'" +
                ' -l info'
        },
        'default': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_DEFAULT,
            'launch_delay': 120,
            'rate': 4,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'default_worker_{}' + ' ' + 
                'default' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['default'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['default']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "'" +
                ' -l info'
        },
        'statistics': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_STATS,
            'launch_delay': 120,
            'rate': 4,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/WorkR/launch.sh ' + 
                'statistics_worker_{}' + ' ' + 
                'statistics' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['statistics'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['statistics']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "'" + 
                ' -l info'
        },
        'celery': {
            'type': 'GPU',
            'ami': PARALLEL_AMI,
            'instances': GPU_INSTANCE_TYPES,
            'max_instances': MAX_INFER,
            'launch_delay': 600,
            'rate': 35,
            'init_size': 0.5,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data': 
                'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
                'celery_worker_{}' + ' ' + 
                HOST_IP + ' ' + 
                'celery ' + 
                SETUP_PERIOD['celery'] + " " + 
                'IDLE_MULTIPLIER' + " '" +
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "' " +
                '-l info'
        },
        'pipeline': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': PIPELINE_INSTANCE_TYPES,
            'max_instances': MAX_PIPELINE,
            'launch_delay': 120,
            'rate': 4,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'pipeline_worker_{}' + ' ' + 
                'pipeline' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['pipeline'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['pipeline']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "'" + 
                ' -l info'
        },
        'llava': {
            'type': 'GPU',
            'ami': LLAVA_AMI,
            'instances': XL_GPU_INSTANCE_TYPES,
            'max_instances': MAX_LLAVA,
            'launch_delay': 1500,
            'rate': 31,
            'init_size': 0.5,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data': 
                'bash /home/ubuntu/TrapTagger/llavaworker/launch.sh ' + 
                'celery_worker_{}' + ' ' + 
                HOST_IP + ' ' + 
                'llava ' + 
                SETUP_PERIOD['llava'] + " " + 
                'IDLE_MULTIPLIER' + " '" +
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' " + 
                '-l info'
        },
        'similarity': {
            'type': 'GPU',
            'ami': PARALLEL_AMI,
            'instances': GPU_INSTANCE_TYPES,
            'max_instances': MAX_SIMILARITY,
            'launch_delay': 600,
            'rate': 35,
            'init_size': 0.5,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data': 
                'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
                'similarity_worker_{}' + ' ' + 
                HOST_IP + ' ' + 
                'similarity ' + 
                SETUP_PERIOD['similarity'] + " " + 
                'IDLE_MULTIPLIER' + " '" +
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                os.environ.get('WBIA_DB_NAME') + "' '" +
                os.environ.get('WBIA_DB_SERVER') + "' '" +
                os.environ.get('WBIA_DIR') + "' " +
                '-l info'
        },
        # 'classification': {
        #     'type': 'GPU',
        #     'ami': PARALLEL_AMI,
        #     'instances': GPU_INSTANCE_TYPES,
        #     'max_instances': MAX_CLASSIFICATION,
        #     'launch_delay': 600,
        #     'rate': 4,
        #     'init_size': 2,
        #     'queue_type': 'rate',
        #     'repo': os.environ.get('MAIN_GIT_REPO'),
        #     'branch': BRANCH,
        #     'user_data': 
        #         'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
        #         'classification_worker_{}' + ' ' + 
        #         HOST_IP + ' ' + 
        #         'classification ' + 
        #         SETUP_PERIOD['classification'] + " " + 
        #         'IDLE_MULTIPLIER' + " '" +
        #         os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
        #         os.environ.get('AWS_SECRET_ACCESS_KEY') + "' " + 
        #         '-l info'
        # },
    }

    # General classifier settings
    CLASSIFIER = {
        'launch_delay': 600,
        'queue_type': 'rate',
        'init_size': 2,
        'max_instances': MAX_CLASSIFICATION,
        'rate': 35,
        'user_data':
            'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
            'classification_worker_{}' + ' ' + 
            HOST_IP + ' ' + 
            '{} ' + 
            SETUP_PERIOD['classification'] + " " + 
            'IDLE_MULTIPLIER' + " '" +
            os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
            os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' '" + 
            os.environ.get('WBIA_DB_NAME') + "' '" +
            os.environ.get('WBIA_DB_SERVER') + "' '" +
            os.environ.get('WBIA_DIR') + "' " +
            '-l info'
    }

    # csv options
    CSV_INFO = {
        '0':{'name': 'Sighting', 'columns': ['ID','Boxes','Labels','Individuals', 'Flank']},
        '1':{'name': 'Image', 'columns': ['Name', 'ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'URL', 'Individuals', 'Original Timestamp', 'Video Path']},
        '2':{'name': 'Capture', 'columns': ['Number', 'ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'Image Count', 'URL', 'Individuals']},
        '3':{'name': 'Cluster', 'columns': ['ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'Notes', 'Image Count', 'URL', 'Individuals', 'Annotator']},
        '4':{'name': 'Camera', 'columns': ['Name', 'Species Count', 'Labels', 'Tags', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '5':{'name': 'Site', 'columns': ['Name', 'Species Count', 'Labels', 'Tags', 'Latitude', 'Longitude', 'Altitude', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '6':{'name': 'Survey', 'columns': ['Name', 'Species Count', 'Labels', 'Tags', 'Description', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '7':{'name': 'Custom', 'columns': []}
    }

    # blank cluster formats
    FINISHED_CLUSTER = {
        'id': '-101',
        'classification': [],
        'required': [],
        'images': [{
            'id': '-101',
            'url': '-101',
            'rating': '-101',
            'detections': [{
                'id': '-101',
                'top': '-101',
                'bottom': '-101',
                'left': '-101',
                'right': '-101',
                'category': '-101',
                'static': '-101'
            }]
        }], 
        'label': '-101', 
        'tags': '-101', 
        'groundTruth': '-101', 
        'trapGroup': '-101',
        'notes': '-101'
    }

    EMPTY_CLUSTER = {
        'id': '-99',
        'classification': [],
        'required': [],
        'images': [{
            'id': '-99',
            'url': '-99',
            'rating': '-99',
            'detections': [{
                'id': '-99',
                'top': '-99',
                'bottom': '-99',
                'left': '-99',
                'right': '-99',
                'category': '-99',
                'static': '-99'
            }]
        }], 
        'label': '-99', 
        'tags': '-99', 
        'groundTruth': '-99', 
        'trapGroup': '-99'
    }

    #Random Name generation
    COLOURS = ["Red","Coral","Salmon","Crimson","Pink","Violet","Orange","Gold",
        "Yellow","Peach","Khaki","Lavender","Plum","Magenta","Purple","Indigo","Blue",
        "Chartreuse","Green","Lime","Olive","Aquamarine","Cyan","Teal","Aqua""Cyan",
        "Turquoise","Navy","White","Tan","Rose","Brown","Maroon","Mint","Azure",
        "Beige","Ivory","Grey","Black","Silver"]

    NOUNS = ["apple","bag","balloon","bananas","bed","beef","blouse","book","bookmark",
        "boom box","bottle","bottle cap","bow","bowl","box","bracelet","bread","brocolli",
        "hair brush","buckel","button","camera","candle","candy wrapper","canvas","car",
        "greeting card","playing card","carrots","cat","CD","cell phone","packing peanuts",
        "cinder block","chair","chalk","newspaper","soy sauce packet","chapter book",
        "checkbook","chocolate","clay pot","clock","clothes","computer","conditioner",
        "cookie jar","cork","couch","credit card","cup","deodorant ","desk","door",
        "drawer","drill press","eraser","eye liner","face wash","fake flowers","flag",
        "floor","flowers","food","fork","fridge","glass","glasses","glow stick","grid paper",
        "hair tie","hanger","helmet","house","ipod","charger","key chain","keyboard","keys",
        "knife","lace","lamp","lamp shade","leg warmers","lip gloss","lotion","milk","mirror",
        "model car","money","monitor","mop","mouse pad","mp3 player","nail clippers","nail file",
        "needle","outlet","paint brush","pants","paper","pen","pencil","perfume","phone",
        "photo album","picture frame","pillow","plastic fork","plate","pool stick",
        "soda can","puddle","purse","blanket","radio","remote","ring","rubber band",
        "rubber duck","rug","rusty nail","sailboat","sand paper","sandal","scotch tape",
        "screw","seat belt","shampoo","sharpie","shawl","shirt","shoe lace","shoes",
        "shovel","sidewalk","sketch pad","slipper","soap","socks","sofa","speakers",
        "sponge","spoon","spring","sticky note","stockings","stop sign","street light",
        "sun glasses","table","teddies","television","thermometer","thread","tire swing",
        "tissue box","toe ring","toilet","tomato","tooth picks","toothbrush","toothpaste",
        "towel","tree","truck","tv","twezzers","twister","vase","video games","wallet",
        "washing machine","watch","water bottle","doll","magnet","wagon","headphones",
        "clamp","USB drive","air freshener","piano","ice cube tray","white out","window",
        "controller","coasters","thermostat","zipper"]

    ADJECTIVES = ["aback","abaft","abandoned","abashed","aberrant","abhorrent","abiding",
        "abject","ablaze","able","abnormal","aboard","aboriginal","abortive","abounding",
        "abrasive","abrupt","absent","absorbed","absorbing","abstracted","absurd","abundant",
        "abusive","acceptable","accessible","accidental","accurate","acid","acidic","acoustic",
        "acrid","actually","ad hoc","adamant","adaptable","addicted","adhesive","adjoining",
        "adorable","adventurous","afraid","aggressive","agonizing","agreeable","ahead","ajar",
        "alcoholic","alert","alike","alive","alleged","alluring","aloof","amazing","ambiguous",
        "ambitious","amuck","amused","amusing","ancient","angry","animated","annoyed","annoying",
        "anxious","apathetic","aquatic","aromatic","arrogant","ashamed","aspiring","assorted",
        "astonishing","attractive","auspicious","automatic","available","average","awake",
        "aware","awesome","awful","axiomatic","bad","barbarous","bashful","bawdy","beautiful",
        "befitting","belligerent","beneficial","bent","berserk","best","better","bewildered",
        "big","billowy","bite-sized","bitter","bizarre","black","black-and-white","bloody",
        "blue","blue-eyed","blushing","boiling","boorish","bored","boring","bouncy","boundless",
        "brainy","brash","brave","brawny","breakable","breezy","brief","bright","bright","broad",
        "broken","brown","bumpy","burly","bustling","busy","cagey","calculating","callous","calm",
        "capable","capricious","careful","careless","caring","cautious","ceaseless","certain",
        "changeable","charming","cheap","cheerful","chemical","chief","childlike","chilly",
        "chivalrous","chubby","chunky","clammy","classy","clean","clear","clever","cloistered",
        "cloudy","closed","clumsy","cluttered","coherent","cold","colorful","colossal","combative",
        "comfortable","common","complete","complex","concerned","condemned","confused","conscious",
        "cooing","cool","cooperative","coordinated","courageous","cowardly","crabby","craven","crazy",
        "creepy","crooked","crowded","cruel","cuddly","cultured","cumbersome","curious","curly",
        "curved","curvy","cut","cute","cute","cynical","daffy","daily","damaged","damaging","damp",
        "dangerous","dapper","dark","dashing","dazzling","dead","deadpan","deafening","dear","debonair",
        "decisive","decorous","deep","deeply","defeated","defective","defiant","delicate","delicious",
        "delightful","demonic","delirious","dependent","depressed","deranged","descriptive","deserted",
        "detailed","determined","devilish","didactic","different","difficult","diligent","direful",
        "dirty","disagreeable","disastrous","discreet","disgusted","disgusting","disillusioned",
        "dispensable","distinct","disturbed","divergent","dizzy","domineering","doubtful","drab",
        "draconian","dramatic","dreary","drunk","dry","dull","dusty","dusty","dynamic","dysfunctional",
        "eager","early","earsplitting","earthy","easy","eatable","economic","educated","efficacious",
        "efficient","eight","elastic","elated","elderly","electric","elegant","elfin","elite","embarrassed",
        "eminent","empty","enchanted","enchanting","encouraging","endurable","energetic","enormous",
        "entertaining","enthusiastic","envious","equable","equal","erect","erratic","ethereal",
        "evanescent","evasive","even","excellent","excited","exciting","exclusive","exotic","expensive",
        "extra-large","extra-small","exuberant","exultant","fabulous","faded","faint","fair","faithful",
        "fallacious","false","familiar","famous","fanatical","fancy","fantastic","far","far-flung",
        "fascinated","fast","fat","faulty","fearful","fearless","feeble","feigned","female","fertile",
        "festive","few","fierce","filthy","fine","finicky","first","five","fixed","flagrant","flaky",
        "flashy","flat","flawless","flimsy","flippant","flowery","fluffy","fluttering","foamy","foolish",
        "foregoing","forgetful","fortunate","four","frail","fragile","frantic","free","freezing","frequent",
        "fresh","fretful","friendly","frightened","frightening","full","fumbling","functional","funny",
        "furry","furtive","future","futuristic","fuzzy","gabby","gainful","gamy","gaping","garrulous",
        "gaudy","general","gentle","giant","giddy","gifted","gigantic","glamorous","gleaming","glib",
        "glistening","glorious","glossy","godly","good","goofy","gorgeous","graceful","grandiose",
        "grateful","gratis","gray","greasy","great","greedy","green","grey","grieving","groovy",
        "grotesque","grouchy","grubby","gruesome","grumpy","guarded","guiltless","gullible","gusty",
        "guttural","habitual","half","hallowed","halting","handsome","handsomely","handy","hanging",
        "hapless","happy","hard","hard-to-find","harmonious","harsh","hateful","heady","healthy",
        "heartbreaking","heavenly","heavy","hellish","helpful","helpless","hesitant","hideous","high",
        "highfalutin","high-pitched","hilarious","hissing","historical","holistic","hollow","homeless",
        "homely","honorable","horrible","hospitable","hot","huge","hulking","humdrum","humorous","hungry",
        "hurried","hurt","hushed","husky","hypnotic","hysterical","icky","icy","idiotic","ignorant","ill",
        "illegal","ill-fated","ill-informed","illustrious","imaginary","immense","imminent","impartial",
        "imperfect","impolite","important","imported","impossible","incandescent","incompetent","inconclusive",
        "industrious","incredible","inexpensive","infamous","innate","innocent","inquisitive","insidious",
        "instinctive","intelligent","interesting","internal","invincible","irate","irritating","itchy",
        "jaded","jagged","jazzy","jealous","jittery","jobless","jolly","joyous","judicious","juicy","jumbled",
        "jumpy","juvenile","kaput","keen","kind","kindhearted","kindly","knotty","knowing","knowledgeable",
        "known","labored","lackadaisical","lacking","lame","lamentable","languid","large","last","late",
        "laughable","lavish","lazy","lean","learned","left","legal","lethal","level","lewd","light","like",
        "likeable","limping","literate","little","lively","lively","living","lonely","long","longing",
        "long-term","loose","lopsided","loud","loutish","lovely","loving","low","lowly","lucky","ludicrous",
        "lumpy","lush","luxuriant","lying","lyrical","macabre","macho","maddening","madly","magenta","magical",
        "magnificent","majestic","makeshift","male","malicious","mammoth","maniacal","many","marked","massive",
        "married","marvelous","material","materialistic","mature","mean","measly","meaty","medical","meek","mellow",
        "melodic","melted","merciful","mere","messy","mighty","military","milky","mindless","miniature","minor",
        "miscreant","misty","mixed","moaning","modern","moldy","momentous","motionless","mountainous","muddled",
        "mundane","murky","mushy","mute","mysterious","naive","nappy","narrow","nasty","natural","naughty","nauseating",
        "near","neat","nebulous","necessary","needless","needy","neighborly","nervous","new","next","nice","nifty",
        "nimble","nine","nippy","noiseless","noisy","nonchalant","nondescript","nonstop","normal","nostalgic","nosy",
        "noxious","null","numberless","numerous","nutritious","nutty","oafish","obedient","obeisant","obese","obnoxious",
        "obscene","obsequious","observant","obsolete","obtainable","oceanic","odd","offbeat","old","old-fashioned",
        "omniscient","one","onerous","open","opposite","optimal","orange","ordinary","organic","ossified","outgoing",
        "outrageous","outstanding","oval","overconfident","overjoyed","overrated","overt","overwrought","painful",
        "painstaking","pale","paltry","panicky","panoramic","parallel","parched","parsimonious","past","pastoral",
        "pathetic","peaceful","penitent","perfect","periodic","permissible","perpetual","petite","petite","phobic",
        "physical","picayune","pink","piquant","placid","plain","plant","plastic","plausible","pleasant","plucky",
        "pointless","poised","polite","political","poor","possessive","possible","powerful","precious","premium",
        "present","pretty","previous","pricey","prickly","private","probable","productive","profuse","protective",
        "proud","psychedelic","psychotic","public","puffy","pumped","puny","purple","purring","pushy","puzzled",
        "puzzling","quack","quaint","quarrelsome","questionable","quick","quickest","quiet","quirky","quixotic",
        "quizzical","rabid","racial","ragged","rainy","rambunctious","rampant","rapid","rare","raspy","ratty",
        "ready","real","rebel","receptive","recondite","red","redundant","reflective","regular","relieved",
        "remarkable","reminiscent","repulsive","resolute","resonant","responsible","rhetorical","rich","right",
        "righteous","rightful","rigid","ripe","ritzy","roasted","robust","romantic","roomy","rotten","rough",
        "round","royal","ruddy","rude","rural","rustic","ruthless","sable","sad","safe","salty","same","sassy",
        "satisfying","savory","scandalous","scarce","scared","scary","scattered","scientific","scintillating",
        "scrawny","screeching","second","second-hand","secret","secretive","sedate","seemly","selective","selfish",
        "separate","serious","shaggy","shaky","shallow","sharp","shiny","shivering","shocking","short","shrill","shut",
        "shy","sick","silent","silent","silky","silly","simple","simplistic","sincere","six","skillful","skinny","sleepy",
        "slim","slimy","slippery","sloppy","slow","small","smart","smelly","smiling","smoggy","smooth","sneaky","snobbish",
        "snotty","soft","soggy","solid","somber","sophisticated","sordid","sore","sore","sour","sparkling","special",
        "spectacular","spicy","spiffy","spiky","spiritual","spiteful","splendid","spooky","spotless","spotted","spotty",
        "spurious","squalid","square","squealing","squeamish","staking","stale","standing","statuesque","steadfast","steady",
        "steep","stereotyped","sticky","stiff","stimulating","stingy","stormy","straight","strange","striped","strong","stupendous",
        "stupid","sturdy","subdued","subsequent","substantial","successful","succinct","sudden","sulky","super","superb","superficial",
        "supreme","swanky","sweet","sweltering","swift","symptomatic","synonymous","taboo","tacit","tacky","talented","tall","tame",
        "tan","tangible","tangy","tart","tasteful","tasteless","tasty","tawdry","tearful","tedious","teeny","teeny-tiny","telling",
        "temporary","ten","tender","tense","tense","tenuous","terrible","terrific","tested","testy","thankful","therapeutic","thick",
        "thin","thinkable","third","thirsty","thirsty","thoughtful","thoughtless","threatening","three","thundering","tidy","tight",
        "tightfisted","tiny","tired","tiresome","toothsome","torpid","tough","towering","tranquil","trashy","tremendous","tricky",
        "trite","troubled","truculent","true","truthful","two","typical","ubiquitous","ugliest","ugly","ultra","unable","unaccountable",
        "unadvised","unarmed","unbecoming","unbiased","uncovered","understood","undesirable","unequal","unequaled","uneven","unhealthy",
        "uninterested","unique","unkempt","unknown","unnatural","unruly","unsightly","unsuitable","untidy","unused","unusual","unwieldy",
        "unwritten","upbeat","uppity","upset","uptight","used","useful","useless","utopian","utter","uttermost","vacuous","vagabond",
        "vague","valuable","various","vast","vengeful","venomous","verdant","versed","victorious","vigorous","violent","violet","vivacious",
        "voiceless","volatile","voracious","vulgar","wacky","waggish","waiting","wakeful","wandering","wanting","warlike","warm","wary",
        "wasteful","watery","weak","wealthy","weary","well-groomed","well-made","well-off","well-to-do","wet","whimsical","whispering",
        "white","whole","wholesale","wicked","wide","wide-eyed","wiggly","wild","willing","windy","wiry","wise","wistful","witty",
        "woebegone","womanly","wonderful","wooden","woozy","workable","worried","worthless","wrathful","wretched","wrong","wry",
        "yellow","yielding","young","youthful","yummy","zany","zealous","zesty","zippy","zonked"]
