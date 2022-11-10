'''
Copyright 2022

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

from app import app, db, celery, mail
from app.models import *
# from app.functions.imports import single_cluster_classification, recluster_large_clusters
# from app.functions.individualID import calculate_individual_similarities
import GLOBALS
import json
from flask import render_template
import time
import threading
from sqlalchemy.sql import func, or_, alias, distinct, and_
from sqlalchemy import desc
import random
import string
from datetime import datetime
import re
import math
import boto3
from config import Config
import redis
import os
import jwt
import traceback
from flask_mail import Message
import signal
import sys
import importlib
from pkg_resources import resource_filename
from botocore.exceptions import ClientError
import requests
import tempfile
from PIL import Image as pilImage
from PIL import ImageOps
import pyexifinfo
import hashlib
from multiprocessing.pool import ThreadPool as Pool
from iptcinfo3 import IPTCInfo

def cleanupWorkers(one, two):
    '''
    Reschedules all active Celery tasks on app shutdown. Docker stop flask, and then docker-compose down when message appears. Alternatively, if you do 
    not wish to reschedule the currently active Celery tasks, use docker kill flask instead.
    '''
    
    inspector = celery.control.inspect()
    queues = {'default': 'traptagger_worker'}
    for queue in queues:
        celery.control.cancel_consumer(queue)

        app.logger.info('')
        app.logger.info('*********************************************************')
        app.logger.info('')

        active_tasks = []
        inspector_active = inspector.active()
        if inspector_active!=None:
            for worker in inspector_active:
                if queues[queue] in worker: active_tasks.extend(inspector_active[worker])

        inspector_reserved = inspector.reserved()
        if inspector_reserved != None:
            for worker in inspector_reserved:
                if queues[queue] in worker: active_tasks.extend(inspector_reserved[worker])

        for active_task in active_tasks:
            for function_location in ['app.routes','app.functions.admin','app.functions.annotation','app.functions.globals',
                                        'app.functions.imports','app.functions.individualID','app.functions.results']:
                if function_location in active_task['name']:
                    module = importlib.import_module(function_location)
                    function_name = re.split(function_location+'.',active_task['name'])[1]
                    active_function = getattr(module, function_name)
                    break
            kwargs = active_task['kwargs']
            priority = active_task['delivery_info']['priority']
            app.logger.info('Rescheduling {} with args {}'.format(active_task['name'],kwargs))
            active_function.apply_async(kwargs=kwargs, queue=queue, priority=priority)

    app.logger.info('')
    app.logger.info('*********************************************************')
    app.logger.info('')
    app.logger.info('                 Exited Gracefully!')
    app.logger.info('          You may docker-compose down now')
    app.logger.info('')
    app.logger.info('*********************************************************')
    app.logger.info('')

    sys.exit(0)

signal.signal(signal.SIGTERM, cleanupWorkers) #only necessary one
signal.signal(signal.SIGINT, cleanupWorkers)
signal.signal(signal.SIGABRT, cleanupWorkers)

@celery.task(bind=True,max_retries=29,ignore_result=True)
def checkQueueingProcessing(self,task_id):
    '''
    Celery task helper function for completion of knockdown analysis. Periodically checks queueing and processing statuses of survey trapgroups and 
    returns survey status to success state on completion.

        Parameters:
            task_id (int): Task on which knockdown analysis was performed
    '''
    
    try:
        task = db.session.query(Task).get(task_id)
        queueing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Trapgroup.queueing==True).count()
        processing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Trapgroup.processing==True).count()

        if queueing==0 and processing==0:
            task.status = 'SUCCESS'
            db.session.commit()
        else:
            checkQueueingProcessing.apply_async(kwargs={'task_id': task_id}, countdown=30, queue='priority', priority=9)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

def get_region_name(region_code):
    '''Translates AWS redion codes to names.'''
    default_region = 'EU (Ireland)'
    endpoint_file = resource_filename('botocore', 'data/endpoints.json')
    try:
        with open(endpoint_file, 'r') as f:
            data = json.load(f)
        return data['partitions'][0]['regions'][region_code]['description']
    except IOError:
        return default_region

def get_price(region, instance, os):
    try:
        '''Returns the on-demand price of the desired instance.'''
        pricing_region = get_region_name(region)
        pricing_client = boto3.client('pricing', region_name=region)

        FLT = '[{{"Field": "tenancy", "Value": "shared", "Type": "TERM_MATCH"}},'\
        '{{"Field": "operatingSystem", "Value": "{o}", "Type": "TERM_MATCH"}},'\
        '{{"Field": "preInstalledSw", "Value": "NA", "Type": "TERM_MATCH"}},'\
        '{{"Field": "instanceType", "Value": "{t}", "Type": "TERM_MATCH"}},'\
        '{{"Field": "location", "Value": "{r}", "Type": "TERM_MATCH"}},'\
        '{{"Field": "capacitystatus", "Value": "Used", "Type": "TERM_MATCH"}}]'
        
        f = FLT.format(r=pricing_region, t=instance, o=os)
        data = pricing_client.get_products(ServiceCode='AmazonEC2', Filters=json.loads(f))
        od = json.loads(data['PriceList'][0])['terms']['OnDemand']
        id1 = list(od)[0]
        id2 = list(od[id1]['priceDimensions'])[0]
        return od[id1]['priceDimensions'][id2]['pricePerUnit']['USD']
    except:
        return None

def getQueueLengths(redisClient):
    '''Returns a dictionary of all Redis queues and their length.'''
    queues = {}
    for queue in Config.QUEUES:
        queueLength = redisClient.llen(queue)
        print('{} queue length: {}'.format(queue,queueLength))
        if queueLength: queues[queue] = queueLength

    for classifier in db.session.query(Classifier).all():
        queue = classifier.name
        queueLength = redisClient.llen(queue)
        print('{} queue length: {}'.format(queue,queueLength))
        if queueLength: queues[queue] = queueLength

    return queues

def getImagesProcessing():
    '''Gets the quantities of images being processed'''
    images_processing = {'total': 0, 'celery': 0}
    surveys = db.session.query(Survey).filter(Survey.images_processing!=0).distinct().all()
    for survey in surveys:
        images_processing['total'] += survey.images_processing
        if not survey.processing_initialised:
            if survey.status == 'Importing':
                images_processing['celery'] += survey.images_processing
            elif survey.status == 'Classifying':
                if survey.classifier.name not in images_processing.keys(): images_processing[survey.classifier.name] = 0
                images_processing[survey.classifier.name] += survey.images_processing
            survey.processing_initialised = True
            db.session.commit()
    return images_processing

def getInstanceCount(client,queue,ami,host_ip,instance_types):
    '''Returns the count of running instances for the given queue'''
    instance_count = 0

    response = client.describe_instances(
        Filters=[
            {
                'Name': 'instance-type',
                'Values': instance_types
            },
            {
                'Name': 'image-id',
                'Values': [ami]
            },          
            {
                'Name': 'tag:queue',
                'Values': [queue]
            },
            {
                'Name': 'tag:host',
                'Values': [str(host_ip)]
            }      
        ],
        MaxResults=100
    )    

    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            if (instance['State']['Name'] == 'running') or (instance['State']['Name'] == 'pending'):
                instance_count += 1

    print('EC2 instances active for {}: {}'.format(queue,instance_count))

    return instance_count

def getInstancesRequired(current_instances,queue_type,queue_length,total_images_processing,last_launch,rate,launch_delay,max_instances):
    '''Returns the number of instances required for a particular queue'''

    instances_required = 0

    # Parallel queue workers are limited to aim for an ~hour-long inference process
    if queue_type == 'time':
        instances_required = total_images_processing/rate

        if current_instances == 0:
            instances_required = math.ceil(instances_required)
        else:
            instances_required = round(instances_required)-current_instances

    # Workers are scaled according to the work available
    elif queue_type == 'rate':
        if (current_instances == 0) or ((round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()) - last_launch) > launch_delay):
            instances_required = queue_length/rate

            if current_instances == 0:
                instances_required = math.ceil(instances_required)
            else:
                instances_required = math.floor(instances_required)-1

    # Jobs that have a local queue should only scale up if the server is overwhelmed
    elif queue_type == 'local':
        if ((round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()) - last_launch) > launch_delay):
            instances_required = math.ceil(queue_length/rate)-1

    if instances_required > max_instances: instances_required = max_instances
    if instances_required < 0: instances_required = 0

    return instances_required

def launch_instances(queue,ami,user_data,instances_required,idle_multiplier,ec2,redisClient,instances,instance_rates,git_pull,subnet):
    '''Launches the required EC2 instances'''

    kwargs = {
        'ImageId':ami,
        'KeyName':Config.KEY_NAME,
        'MaxCount':1,
        'MinCount':1,
        'Monitoring':{'Enabled': True},
        'SecurityGroupIds':[Config.SG_ID],
        'SubnetId':subnet,
        'DisableApiTermination':False,
        'DryRun':False,
        'EbsOptimized':False,
        'InstanceInitiatedShutdownBehavior':'terminate',
        'TagSpecifications':[
            {
                'ResourceType': 'instance',
                'Tags': [
                    {
                        'Key': 'queue',
                        'Value': queue
                    },
                    {
                        'Key': 'host',
                        'Value': str(Config.HOST_IP)
                    }
                ]
            },
        ]
    }

    # Command to be sent to the image
    userData = ''
    if git_pull:
        userData += 'cd /home/ubuntu/TrapTagger;'
        userData += ' chown -R root /home/ubuntu/TrapTagger;'
        userData += ' git fetch --all;'
        userData += ' git checkout {};'.format(Config.BRANCH)
        userData += ' git pull; '
    userData += 'cd /home/ubuntu; '
    userData += user_data

    #Determine the cheapest option by calculating th cost per image of all instance types
    # Add spot instance pricing
    costPerImage = {}
    # for instance in instances:
    #     prices = client.describe_spot_price_history(
    #         InstanceTypes=[instance],
    #         MaxResults=1,
    #         ProductDescriptions=['Linux/UNIX']
    #     )

    #     if len(prices['SpotPriceHistory']) > 0:
    #         costPerImage[instance+',spot'] = float(prices['SpotPriceHistory'][0]['SpotPrice'])/instance_rates[instance]

    # Add on-demand prices to list
    for instance in instances:
        price = get_price('us-east-1', instance, 'Linux')
        if price: costPerImage[instance+',demand'] = float(price)/instance_rates[instance]

    # cheapestInstance = min(costPerImage, key=costPerImage.get)
    orderedInstances = {k: v for k, v in sorted(costPerImage.items(), key=lambda item: item[1])}
        
    #Launch instances - try launch cheapest, if no capacity, launch the next cheapest
    for n in range(round(instances_required)):
        #jitter idle check so that a whole bunch of instances down shutdown together
        kwargs['UserData'] = '#!/bin/bash\n { ' + userData.format(randomString(),queue).replace('IDLE_MULTIPLIER',str(round(idle_multiplier*random.uniform(0.5, 1.5)))) + ';} > /home/ubuntu/launch.log 2>&1'
        for item in orderedInstances:
            pieces = re.split(',',item)
            kwargs['InstanceType'] = pieces[0]
            if pieces[1] == 'spot':
                kwargs['InstanceMarketOptions'] = {
                    'MarketType': 'spot',
                    'SpotOptions': {
                        'SpotInstanceType': 'one-time',
                        'InstanceInterruptionBehavior': 'terminate'
                    }
                }
            
            else:
                try:
                    del kwargs['InstanceMarketOptions']
                except:
                    pass

            try:
                ec2.create_instances(**kwargs)
                app.logger.info('Launched {} {} instance for {} queue.'.format(pieces[1],kwargs['InstanceType'],queue))
                redisClient.set(queue+'_last_launch',round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()))
                break

            except ClientError:
                # Handle insufficient capacity
                pass

    return True

@celery.task(ignore_result=True)
def importMonitor():
    '''Periodic Celery task that monitors the length of the celery queues, and fires up EC2 instances as needed.'''
    
    try:
        startTime = datetime.utcnow()
        redisClient = redis.Redis(host=Config.REDIS_IP, port=6379)
        queues = getQueueLengths(redisClient)

        if queues:
            ec2 = boto3.resource('ec2', region_name=Config.AWS_REGION)
            client = boto3.client('ec2',region_name=Config.AWS_REGION)
            images_processing = getImagesProcessing()
            print('Images being imported: {}'.format(images_processing))

            current_instances = {}
            instances_required = {'default':0,'parallel':0}
            for queue in queues:
                if queue in Config.QUEUES.keys():
                    ami = Config.QUEUES[queue]['ami']
                    instances = Config.QUEUES[queue]['instances']
                    rate = Config.QUEUES[queue]['rate']
                    launch_delay = Config.QUEUES[queue]['launch_delay']
                    queue_type = Config.QUEUES[queue]['queue_type']
                    max_instances = Config.QUEUES[queue]['max_instances']
                else:
                    classifier = db.session.query(Classifier).filter(Classifier.name==queue).first()
                    ami = classifier.ami_id
                    instances = Config.GPU_INSTANCE_TYPES
                    rate = Config.CLASSIFIER['rate']
                    launch_delay = Config.CLASSIFIER['launch_delay']
                    queue_type = Config.CLASSIFIER['queue_type']
                    init_size = Config.CLASSIFIER['init_size']
                    max_instances = Config.CLASSIFIER['max_instances']

                current_instances[queue] = getInstanceCount(client,queue,ami,Config.HOST_IP,instances)

                if not redisClient.get(queue+'_last_launch'):
                    redisClient.set(queue+'_last_launch',0)

                instances_required[queue] = getInstancesRequired(current_instances[queue],
                                                                queue_type,
                                                                queues[queue],
                                                                images_processing['total'],
                                                                int(redisClient.get(queue+'_last_launch').decode()),
                                                                rate,
                                                                launch_delay,
                                                                max_instances)

                # pre-emptively launch GPU instances with the CPU importers to smooth out control loop
                if queue=='celery':
                    instances_required[queue] += round(images_processing[queue]/Config.QUEUES['parallel']['rate'])*Config.QUEUES[queue]['init_size']
                if (queue not in Config.QUEUES.keys()) and (queue in images_processing.keys()):
                    instances_required[queue] += round(images_processing[queue]/Config.QUEUES['parallel']['rate'])*init_size

            print('Instances required: {}'.format(instances_required))

            # Check database capacity requirement (parallel & default)
            required_capacity = 1*(instances_required['default'] + instances_required['parallel'])
            current_capacity = scaleDbCapacity(required_capacity)

            # Get time since last db scaling request
            aurora_request_count = redisClient.get('aurora_request_count')
            if not aurora_request_count:
                aurora_request_count = 0
            else:
                aurora_request_count = int(aurora_request_count.decode())

            # Launch Instances
            if (current_capacity >= required_capacity) or (aurora_request_count >= 2):
                redisClient.set('aurora_request_count',0)
                for queue in queues:
                    instance_count = instances_required[queue]-current_instances[queue]
                    if instance_count > 0:
                        if queue in Config.QUEUES.keys():
                            ami = Config.QUEUES[queue]['ami']
                            instances = Config.QUEUES[queue]['instances']
                            user_data = Config.QUEUES[queue]['user_data']
                            idle_multiplier = Config.IDLE_MULTIPLIER[queue]
                            instance_rates = Config.INSTANCE_RATES[queue]
                            git_pull = True
                            subnet = Config.PUBLIC_SUBNET_ID
                        else:
                            classifier = db.session.query(Classifier).filter(Classifier.name==queue).first()
                            ami = classifier.ami_id
                            instances = Config.GPU_INSTANCE_TYPES
                            user_data = Config.CLASSIFIER['user_data']
                            idle_multiplier = Config.IDLE_MULTIPLIER['classification']
                            instance_rates = Config.INSTANCE_RATES['classification']
                            git_pull = False
                            subnet = Config.PRIVATE_SUBNET_ID
                        launch_instances(queue,ami,user_data,instance_count,idle_multiplier,ec2,redisClient,instances,instance_rates,git_pull,subnet)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        # self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()
        countdown = 150 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        importMonitor.apply_async(queue='priority', priority=0, countdown=countdown)

    return True

def updateTaskCompletionStatus(task_id):
    '''
    Checks to see if species classification has been completed for a task, and sets the task complete status accordingly.

        Parameters:
            task_id (int): Task the must be checked.
    '''

    complete = True
    task = db.session.query(Task).get(task_id)
    
    # Check if there init level is complete
    check = db.session.query(Cluster)\
                    .join(Image,Cluster.images)\
                    .join(Detection)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(['deleted','hidden']))\
                    .filter(Cluster.task_id==task_id)\
                    .filter(~Cluster.labels.any())\
                    .first()
    if check:
        complete = False

    task.init_complete = complete

    # Check if parent categories are complete
    parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
    if db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==GLOBALS.vhl_id).first():
        parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
    for parentLabel in parentLabels:
        parentCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(parentLabel)).first()
        for childLabel in db.session.query(Label).filter(Label.task_id).filter(Label.parent==parentLabel).distinct().all():
            childCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(childLabel)).first()
            if childCheck != None:
                break
        if (parentCheck!=None) and (childCheck==None):
            complete = False
            break
    
    task.complete = complete
    db.session.commit()

    return True

def clusterIdComplete(task_id,label_id):
    '''
    Returns whether the first stage of individual identification has been completed for a particular task and label combination.

        Parameters:
            task_id (int): The task to be checked
            label_id (int): The label to be checked
    '''

    label = db.session.query(Label).get(label_id)

    identified = db.session.query(Detection)\
                        .join(Labelgroup)\
                        .join(Individual, Detection.individuals)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(Individual.label_id==label.id)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Individual.task_id==task_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static == False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .distinct().all()

    count = db.session.query(Detection)\
                        .join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(~Detection.id.in_([r.id for r in identified]))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static == False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .distinct().count()

    if count==0:
        return True
    else:
        return False

def updateIndividualIdStatus(task_id):
    '''Updates the icID_allowed status of all labels of a specified task, based on whether the first stage of individual identification has been completed.'''
    
    labels = db.session.query(Label).filter(Label.task_id==task_id).all()

    for label in labels:
        if clusterIdComplete(task_id,label.id):
            label.icID_allowed = True
        else:
            label.icID_allowed = False

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def removeFalseDetections(self,cluster_id,undo):
    '''
    Celery task for marking false detections as static. Takes all relevent detections from a cluster marked as containing nothing, and marks all high-IOU detections 
    from the same camera as static.
    '''

    try:
        cluster = db.session.query(Cluster).get(cluster_id)
        if cluster:
            detections = db.session.query(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(~Detection.status.in_(['deleted','hidden'])).distinct().all()

            if undo:
                app.logger.info('Undoing the removal of false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
                staticState = False
            else:
                app.logger.info('Removing false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
                staticState = True

            images = []
            for detection in detections:
                # Find and mark as static all high IOU detections if detection is large enough
                if ((detection.right-detection.left)*(detection.bottom-detection.top)) < 0.1:
                    query = """
                        SELECT
                            id2
                        FROM
                            (SELECT 
                                det1.id as id1,
                                det2.id as id2,
                                image1.camera_id as cam_id,
                                GREATEST(LEAST(det1.right,det2.right)-GREATEST(det1.left,det2.left),0)*
                                GREATEST(LEAST(det1.bottom,det2.bottom)-GREATEST(det1.top,det2.top),0) as intersection,
                                (det1.right-det1.left)*(det1.bottom-det1.top) AS area1,
                                (det2.right-det2.left)*(det2.bottom-det2.top) AS area2
                            FROM
                                detection as det1 
                                JOIN detection as det2 
                                JOIN image as image1 
                                JOIN image as image2 
                            ON
                                image1.camera_id = image2.camera_id
                                AND image1.id = det1.image_id
                                AND image2.id = det2.image_id
                                AND det1.id != det2.id
                            WHERE
                                det1.id = {}
                                AND ({})
                            ) as sq1
                        WHERE
                            area2 < 0.1
                            AND sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.65
                    """

                    resultproxy = db.session.execute(query.format(str(detection.id),'OR'.join([ ' (det2.source = "{}" AND det2.score > {}) '.format(model,Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS])))

                    d, result = {}, []
                    for rowproxy in resultproxy:
                        for column, value in rowproxy.items():
                            d = {**d, **{column: value}}
                        result.append(d)

                    detection.static = staticState
                    images.append(detection.image)

                    for row in result:
                        newDetection = db.session.query(Detection).get(row['id2'])
                        newDetection.static = staticState
                        images.append(newDetection.image)

                    db.session.commit()

            for image in set(images):
                image.detection_rating = detection_rating(image)
            db.session.commit()

            trapgroup = cluster.images[0].camera.trapgroup
            re_evaluate_trapgroup_examined(trapgroup.id,cluster.task_id)

            trapgroup.processing = False
            trapgroup.active = True
            db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return ""

def populateMutex(task_id,user_id=None):
    '''Checks for and populates the mutex globals for a given task, and optional user combination.'''
    try:
        task = db.session.query(Task).get(task_id)
        if task_id not in GLOBALS.mutex.keys():
            if task and (task.status in ['PROGRESS','Processing','Knockdown Analysis']):
                GLOBALS.mutex[task_id] = {
                    'global': threading.Lock(),
                    'user': {},
                    'job': threading.Lock(),
                    'trapgroup': {}
                }

                for trapgroup in task.survey.trapgroups:
                    GLOBALS.mutex[task_id]['trapgroup'][trapgroup.id] = threading.Lock()
            
            else:
                return False
        else:
            if task and (task.status not in ['PROGRESS','Processing','Knockdown Analysis']):
                GLOBALS.mutex.pop(task_id, None)

        if user_id:
            user = db.session.query(User).get(user_id)
            if user:
                if user_id not in GLOBALS.mutex[task_id]['user'].keys():
                    if user.passed not in ['cTrue', 'cFalse', 'true', 'false']:
                        GLOBALS.mutex[task_id]['user'][user_id] = threading.Lock()
                    else:
                        return False
                else:
                    if user.passed in ['cTrue', 'cFalse', 'true', 'false']:
                        GLOBALS.mutex[task_id]['user'].pop(user_id, None)

    except:
        return False
   
    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def finish_knockdown(self,rootImageID, task_id, current_user_id):
    '''
    Celery task for marking a camera as knocked down. Combines all images into a new cluster, and reclusters the images from the other cameras.

        Parameters:
            rootImageID (int): The image viewed by the user when they marked a cluster as knocked down
            task_id (int): The task being tagged
            current_user_id (int): The user who annotated the knock down
    '''
    
    try:
        app.logger.info('Started finish_knockdown for image ' + str(rootImageID))

        populateMutex(int(task_id))

        rootImage = db.session.query(Image).get(rootImageID)
        trapgroup = rootImage.camera.trapgroup
        trapgroup_id = trapgroup.id
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

        if int(task_id) in GLOBALS.mutex.keys():
            GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].acquire()
            db.session.commit()

        app.logger.info('Continuing finish_knockdown for image ' + str(rootImageID))

        trapgroup.processing = True
        trapgroup.active = False
        trapgroup.user_id = None
        db.session.commit()

        if int(task_id) in GLOBALS.mutex.keys():
            GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].release()

        cluster = Cluster(user_id=current_user_id, labels=[downLabel], timestamp=datetime.utcnow(), task_id=task_id)
        db.session.add(cluster)

        #Move images to new cluster
        images = db.session.query(Image) \
                        .filter(Image.camera == rootImage.camera) \
                        .filter(Image.corrected_timestamp >= rootImage.corrected_timestamp) \
                        .all() 

        cluster.images = images

        from app.functions.imports import single_cluster_classification
        cluster.classification = single_cluster_classification(cluster)

        labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==task_id)\
                                .all()

        for labelgroup in labelgroups:
            labelgroup.labels = [downLabel]

        db.session.commit()

        lastImage = db.session.query(Image).filter(Image.camera_id == rootImage.camera_id).order_by(desc(Image.corrected_timestamp)).first()

        old_clusters = db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .join(Camera) \
                            .filter(Camera.trapgroup_id == rootImage.camera.trapgroup.id) \
                            .filter(Image.corrected_timestamp >= rootImage.corrected_timestamp) \
                            .filter(Image.corrected_timestamp <= lastImage.corrected_timestamp) \
                            .filter(Cluster.task_id == task_id) \
                            .distinct(Cluster.id) \
                            .all()

        recluster_ims = db.session.query(Image) \
                            .join(Camera) \
                            .filter(Camera.id != rootImage.camera.id) \
                            .filter(Image.clusters.any(Cluster.id.in_([r.id for r in old_clusters]))) \
                            .order_by(Image.corrected_timestamp) \
                            .distinct(Image.id) \
                            .all()

        old_clusters.remove(cluster)

        for old_cluster in old_clusters:
            old_cluster.images = []
            db.session.delete(old_cluster)

        db.session.commit()

        if len(recluster_ims) > 0:
            reClusters = []
            prev = None    
            for image in recluster_ims:
                timestamp = image.corrected_timestamp
                if not (prev) or (timestamp - prev).total_seconds() > 60:
                    if prev is not None:
                        reCluster.images = imList
                        reCluster.classification = single_cluster_classification(reCluster)
                        reClusters.append(reCluster)
                    reCluster = Cluster(task_id=task_id, timestamp=datetime.utcnow())
                    db.session.add(reCluster)
                    imList = []                 
                prev = timestamp
                imList.append(image)

            reCluster.images = imList
            reCluster.classification = single_cluster_classification(reCluster)
            reClusters.append(reCluster)
            db.session.commit()

            reClusters = [r.id for r in reClusters]

            from app.functions.imports import recluster_large_clusters
            removedClusters, newClusters = recluster_large_clusters(task_id,True,reClusters)

            clusterList = [r for r in reClusters if r not in removedClusters]
            clusterList.extend(newClusters)
            classifyTask(task_id,clusterList)

        #Reactivate trapgroup
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)

        if trapgroup.queueing:
            trapgroup.queueing = False
            unknock_cluster.apply_async(kwargs={'image_id':int(rootImageID), 'label_id':None, 'user_id':current_user_id, 'task_id':task_id})
        else:
            re_evaluate_trapgroup_examined(trapgroup_id,task_id)
            trapgroup.active = True
            trapgroup.processing = False
        db.session.commit()

        app.logger.info('Completed finish_knockdown for image ' + str(rootImageID))

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return ''

@celery.task(bind=True,max_retries=29,ignore_result=True)
def unknock_cluster(self,image_id, label_id, user_id, task_id):
    '''
    Celery task for undoing the effects of marking a cluster as knocked down.

        Parameters:
            image_id (int): The earliest image of the camera in the cluster that is knocked down
            label_id (int): The label the cluster should be marked with instead
            user_id (int): The user who is undoing the knockdown
            task_id (int): The task for which this action is taking place
    '''
    
    try:
        app.logger.info('Started unknock_cluster for cluster ' + str(image_id))

        image = db.session.query(Image).get(image_id)
        cluster = db.session.query(Cluster).filter(Cluster.task_id == task_id).filter(Cluster.images.contains(image)).first()
        trapgroup = image.camera.trapgroup
        trapgroup_id = trapgroup.id
        
        populateMutex(int(task_id))

        if int(task_id) in GLOBALS.mutex.keys():
            GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].acquire()
            db.session.commit()

        #Checkout tg
        trapgroup.processing = True
        trapgroup.active = False
        trapgroup.user_id = None
        db.session.commit()

        if int(task_id) in GLOBALS.mutex.keys():
            GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].release()

        cluster.labels = []

        #Recluster entire trapgroup
        rootImage = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).first()
        lastImage = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.corrected_timestamp)).first()
        default_task = db.session.query(Task).filter(Task.name=='default').filter(Task.survey_id==cluster.task.survey_id).first()
        nothingLabel = db.session.query(Label).get(GLOBALS.nothing_id)

        new_clusters = db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .join(Camera) \
                            .filter(Camera.trapgroup_id == trapgroup_id) \
                            .filter(Image.corrected_timestamp >= rootImage.corrected_timestamp) \
                            .filter(Image.corrected_timestamp <= lastImage.corrected_timestamp) \
                            .filter(Cluster.task_id == default_task.id) \
                            .order_by(Image.corrected_timestamp) \
                            .distinct(Cluster.id) \
                            .all()

        true_first = db.session.query(Image).filter(Image.clusters.contains(new_clusters[0])).order_by(Image.corrected_timestamp).first()
        true_last = db.session.query(Image).filter(Image.clusters.contains(new_clusters[-1])).order_by(desc(Image.corrected_timestamp)).first()

        old_clusters = db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .join(Camera) \
                            .filter(Camera.trapgroup_id == trapgroup_id) \
                            .filter(Image.corrected_timestamp >= true_first.corrected_timestamp) \
                            .filter(Image.corrected_timestamp <= true_last.corrected_timestamp) \
                            .filter(Cluster.task_id == task_id) \
                            .distinct(Cluster.id) \
                            .all()

        reAllocated = []
        clusterList = []
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
        for new_cluster in new_clusters:
            newCluster = Cluster(task_id=task_id, timestamp=datetime.utcnow())
            db.session.add(newCluster)
            clusterList.append(newCluster)
            
            # don't recluster other knockdowns (cluster of interest's labels have already been set to [])
            reClusIms = db.session.query(Image) \
                                .join(Cluster,Image.clusters) \
                                .filter(Image.id.in_([r.id for r in new_cluster.images])) \
                                .filter(Cluster.task_id==task_id) \
                                .filter(~Cluster.labels.contains(downLabel)) \
                                .all()
            
            newCluster.images=reClusIms
            newCluster.classification = new_cluster.classification
            reAllocated.extend(reClusIms)

            labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .filter(Image.clusters.contains(newCluster))\
                            .filter(Labelgroup.task_id==task_id)\
                            .all()

            for labelgroup in labelgroups:
                labelgroup.labels = []
        
        db.session.commit()

        admin = db.session.query(User).filter(User.username == 'Admin').first()
        for old_cluster in old_clusters:        
            if (old_cluster.user_id != admin.id) and (old_cluster.labels != []) and (nothingLabel not in old_cluster.labels) and (downLabel not in old_cluster.labels):
                new_cluster = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.images.contains(old_cluster.images[0])).filter(~Cluster.labels.any()).first()
                if new_cluster != None:
                    new_cluster.labels = old_cluster.labels
                    new_cluster.timestamp = datetime.utcnow()

                    labelgroups = db.session.query(Labelgroup)\
                                    .join(Detection)\
                                    .join(Image)\
                                    .filter(Image.clusters.contains(new_cluster))\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .all()

                    for labelgroup in labelgroups:
                        labelgroup.labels = old_cluster.labels

            for image in reAllocated:
                if image in old_cluster.images[:]:
                    old_cluster.images.remove(image)

            if len(old_cluster.images[:]) == 0:
                db.session.delete(old_cluster)

        db.session.commit()
        classifyTask(task_id,[r.id for r in clusterList])

        #Add label to original cluster
        if label_id != None:
            cluster = db.session.query(Cluster).filter(Cluster.task_id == task_id).filter(Cluster.images.contains(rootImage)).first()

            labelgroups = db.session.query(Labelgroup)\
                                    .join(Detection)\
                                    .join(Image)\
                                    .filter(Image.clusters.contains(cluster))\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .all()

            if int(label_id) != GLOBALS.wrong_id:
                label = db.session.query(Label).get(int(label_id))
                cluster.labels = [label]

                for labelgroup in labelgroups:
                    labelgroup.labels = [label]
            else: 
                cluster.labels = []

                for labelgroup in labelgroups:
                    labelgroup.labels = []

            cluster.user_id = int(user_id)
            cluster.timestamp = datetime.utcnow()
            db.session.commit()

        #reactivate trapgroup
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        
        if trapgroup.queueing:
            trapgroup.queueing = False
            finish_knockdown.apply_async(kwargs={'rootImageID':rootImage.id, 'task_id':task_id, 'current_user_id':user_id})
        else:
            re_evaluate_trapgroup_examined(trapgroup_id,task_id)
            trapgroup.active = True
            trapgroup.processing = False
        db.session.commit()

        app.logger.info('Completed unknock_cluster for cluster ' + str(image_id))

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return None

def classifyTask(task_id,reClusters = None):
    '''
    Auto-classifies and labels the species contained in each cluster of a specified task, based on the species selected by the user. Can be given a specific subset of 
    clusters to classify.
    '''
    
    try:
        app.logger.info('Classifying task '+str(task_id))
        admin = db.session.query(User).filter(User.username == 'Admin').first()
        task = db.session.query(Task).get(task_id)
        parentLabel = task.parent_classification
        survey_id = task.survey_id

        dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                                .join(Image) \
                                .join(Camera) \
                                .join(Trapgroup) \
                                .join(Survey)\
                                .join(Classifier)\
                                .filter(Trapgroup.survey_id==survey_id) \
                                .filter(Detection.class_score>Classifier.threshold) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .subquery()

        totalDetSQ = db.session.query(Cluster.id.label('clusID'), func.count(distinct(Detection.id)).label('detCountTotal')) \
                                .join(Image, Cluster.images) \
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Survey)\
                                .join(Classifier)\
                                .join(Detection) \
                                .join(dimensionSQ, dimensionSQ.c.detID==Detection.id) \
                                .filter(Detection.class_score>Classifier.threshold) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .filter(dimensionSQ.c.area > Config.DET_AREA) \
                                .filter(Cluster.task_id==task_id) \
                                .group_by(Cluster.id).subquery()

        parentGroupings = {}
        labelGroupings = [r[0] for r in db.session.query(Translation.label_id).filter(Translation.task_id==task_id).filter(Translation.auto_classify==True).distinct().all()]
        for labelGrouping in labelGroupings:
            classifications = db.session.query(Translation).filter(Translation.task_id==task_id).filter(Translation.auto_classify==True).filter(Translation.label_id==labelGrouping).all()
            label = classifications[0].label
            if parentLabel:
                if label.parent_id != None:
                    label = label.parent
            if str(label.id) not in parentGroupings.keys():
                parentGroupings[str(label.id)] = [r.classification for r in classifications]
            else:
                parentGroupings[str(label.id)].extend([r.classification for r in classifications])

        app.logger.info('Groupings prepped for task '+str(task_id))

        for label_id in parentGroupings:
            species = db.session.query(Label).get(int(label_id))

            detCountSQ = db.session.query(Cluster.id.label('clusID'), func.count(distinct(Detection.id)).label('detCount')) \
                                .join(Image, Cluster.images) \
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Survey)\
                                .join(Classifier)\
                                .join(Detection) \
                                .join(dimensionSQ, dimensionSQ.c.detID==Detection.id) \
                                .filter(Detection.class_score>Classifier.threshold) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .filter(dimensionSQ.c.area > Config.DET_AREA) \
                                .filter(Detection.classification.in_(parentGroupings[label_id])) \
                                .filter(Cluster.task_id==task_id) \
                                .group_by(Cluster.id).subquery()

            detRatioSQ = db.session.query(Cluster.id.label('clusID'), (detCountSQ.c.detCount/totalDetSQ.c.detCountTotal).label('detRatio')) \
                                .join(detCountSQ, detCountSQ.c.clusID==Cluster.id) \
                                .join(totalDetSQ, totalDetSQ.c.clusID==Cluster.id) \
                                .filter(Cluster.task_id==task_id) \
                                .subquery()

            clusters = db.session.query(Cluster) \
                                .join(detCountSQ, detCountSQ.c.clusID==Cluster.id) \
                                .join(detRatioSQ, detRatioSQ.c.clusID==Cluster.id) \
                                .filter(detCountSQ.c.detCount >= Config.CLUSTER_DET_COUNT) \
                                .filter(detRatioSQ.c.detRatio > Config.DET_RATIO) \
                                .filter(Cluster.task_id==task_id)

            if reClusters != None:
                clusters = clusters.filter(Cluster.id.in_(reClusters))
            else:
                clusters = clusters.filter(~Cluster.labels.any())

            clusters = clusters.distinct().all()

            for chunk in chunker(clusters,1000):
                for cluster in chunk:
                    cluster.labels.append(species)
                    cluster.user_id = admin.id
                    cluster.timestamp = datetime.utcnow()

                    labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task_id==task_id).all()
                    for labelgroup in labelgroups:
                        labelgroup.labels = [species]
                db.session.commit()
        app.logger.info('Finished classifying task '+str(task_id))

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
    
    return True

def update_label_ids():
    ''' Updates the default label IDs in the globals. '''

    try:
        nothing = db.session.query(Label).filter(Label.description=='Nothing').first()
        knockdown = db.session.query(Label).filter(Label.description=='Knocked Down').first()
        vehicles = db.session.query(Label).filter(Label.description=='Vehicles/Humans/Livestock').first()
        unknown = db.session.query(Label).filter(Label.description=='Unknown').first()
        wrong = db.session.query(Label).filter(Label.description=='Wrong').first()

        GLOBALS.nothing_id = nothing.id
        GLOBALS.knocked_id = knockdown.id
        GLOBALS.vhl_id = vehicles.id
        GLOBALS.unknown_id = unknown.id
        GLOBALS.wrong_id = wrong.id
        app.logger.info('Global label IDs updated')

    except:
        pass

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def splitClusterAndUnknock(self,oldClusterID, SplitPoint):
    '''
    Celery task that splits a knocked-down cluster at a specified index point, and performs unknock_cluster on the second half.

        Parameters:
            oldClusterID (int): The ID number of the cluster being processed
            SplitPoint (int): The index at which the cluster should be split
    '''
    
    try:
        oldCluster = db.session.query(Cluster).get(oldClusterID)
        task_id = oldCluster.task_id
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
        newCluster = Cluster(task_id=task_id, timestamp = datetime.utcnow(), labels=[downLabel])
        db.session.add(newCluster)
        images = db.session.query(Image).filter(Image.clusters.contains(oldCluster)).order_by(Image.corrected_timestamp).all()

        newCluster.images = images[SplitPoint:]
        oldCluster.images = images[:SplitPoint]

        from app.functions.imports import single_cluster_classification
        newCluster.classification = single_cluster_classification(newCluster)
        oldCluster.classification = single_cluster_classification(oldCluster)
        db.session.commit()

        unknock_cluster.apply_async(kwargs={'image_id':images[SplitPoint].id, 'label_id':None, 'user_id':None, 'task_id':task_id})

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return ''

def randomString(stringLength=10):
    """Generate a random string of fixed length """

    letters = string.ascii_letters + string.digits
    return ''.join(random.choice(letters) for i in range(stringLength))

def retryTime(retries):
    '''Returns the jittered exponential-backed-off retry time based on the specified number of retries.'''

    countdown = int(60*2**(random.uniform(retries-0.5,retries+0.5)))
    if countdown > 3600: countdown=3600
    return countdown

def createTurkcodes(number_of_workers, task_id):
    '''Creates requested number of turkcodes (jobs) for the specified task'''
    
    turkcodes = []
    for n in range(number_of_workers):
        user_id = randomString(24)
        check = db.session.query(Turkcode).filter(Turkcode.user_id==user_id).first()
        if not check:
            turkcode = Turkcode(user_id=user_id, task_id=task_id, active=True)
            db.session.add(turkcode)
            turkcodes.append({'user_id':user_id})
    db.session.commit()
    return turkcodes

def deleteTurkcodes(number_of_jobs, jobs, task_id):
    '''Deletes the specified number of turkcodes (jobs) for the specified task'''
    
    if not populateMutex(int(task_id)): return jobs
    GLOBALS.mutex[int(task_id)]['job'].acquire()
    db.session.commit()
    turkcodes = db.session.query(Turkcode).outerjoin(User, User.username==Turkcode.user_id).filter(Turkcode.task_id==task_id).filter(Turkcode.active==True).filter(User.id==None).limit(number_of_jobs).all()
    for turkcode in turkcodes:
        db.session.delete(turkcode)
    db.session.commit()
    GLOBALS.mutex[int(task_id)]['job'].release()
    return jobs

def updateLabelCompletionStatus(task_id):
    '''Updates the completion status of all parent labels of a specified task.'''

    # Complete + Species annotation
    parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
    for label in parentLabels:
        count = db.session.query(Cluster).filter(Cluster.task_id==int(task_id)).filter(Cluster.labels.contains(label)).distinct().count()
        if count == 0:
            label.complete = True
        else:
            label.complete = False
        label.cluster_count = count        
    db.session.commit()

    labels = db.session.query(Label).filter(Label.task_id==task_id).all()
    for label in labels:
        
        # # Individual ID (cluster-level)
        # identified = db.session.query(Detection)\
        #                     .join(Labelgroup)\
        #                     .join(Individual, Detection.individuals)\
        #                     .filter(Labelgroup.labels.contains(label))\
        #                     .filter(Individual.label_id==label.id)\
        #                     .filter(Labelgroup.task_id==task_id)\
        #                     .filter(Individual.task_id==task_id)\
        #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
        #                     .filter(Detection.static == False) \
        #                     .filter(~Detection.status.in_(['deleted','hidden'])) \
        #                     .distinct().all()

        # count = db.session.query(Cluster)\
        #                     .join(Image,Cluster.images)\
        #                     .join(Detection)\
        #                     .join(Labelgroup)\
        #                     .filter(Cluster.task_id==task_id)\
        #                     .filter(Cluster.labels.contains(label))\
        #                     .filter(Labelgroup.task_id==task_id)\
        #                     .filter(Labelgroup.labels.contains(label))\
        #                     .filter(~Detection.id.in_([r.id for r in identified]))\
        #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
        #                     .filter(Detection.static == False) \
        #                     .filter(~Detection.status.in_(['deleted','hidden'])) \
        #                     .distinct().count()
        
        # label.individualless_count = count

        # Bounding
        count = db.session.query(Labelgroup) \
                            .join(Detection) \
                            .filter(Labelgroup.task_id==task_id) \
                            .filter(Labelgroup.labels.contains(label)) \
                            .filter(Labelgroup.checked==False) \
                            .filter(Detection.static==False) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .distinct().count()

        label.bounding_count = count

        # Info tagging
        count = db.session.query(Cluster)\
                            .filter(Cluster.task_id==int(task_id))\
                            .filter(Cluster.labels.contains(label))\
                            .filter(~Cluster.tags.any())\
                            .distinct().count() 

        label.info_tag_count = count
    db.session.commit()

    #Also update the number of clusters requiring a classification check
    task = db.session.query(Task).get(task_id)
    count = db.session.query(Cluster).filter(Cluster.task_id==task_id)
    count = taggingLevelSQ(count,'-3',False,task_id)
    task.class_check_count = count.distinct().count()

    return True

def resolve_abandoned_jobs(abandoned_jobs):
    '''Cleans up jobs that have been abandoned.'''
    
    for job in abandoned_jobs:
        user = db.session.query(User).filter(User.username==job.user_id).first()
        task_id = job.task_id

        if user:
            if ('-4' in job.task.tagging_level) and (job.task.survey.status=='indprocessing'):
                app.logger.info('Triggering individual similarity calculation for user {}'.format(user.parent.username))
                from app.functions.individualID import calculate_individual_similarities
                calculate_individual_similarities.delay(task_id=job.task_id,label_id=int(re.split(',',job.task.tagging_level)[1]),user_ids=[user.id])
            elif '-5' in job.task.tagging_level:
                #flush allocations
                allocateds = db.session.query(IndSimilarity).filter(IndSimilarity.allocated==user.id).all()
                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                allocateds = db.session.query(Individual).filter(Individual.allocated==user.id).all()
                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

            for trapgroup in user.trapgroup:
                trapgroup.user_id = None

            user.passed = 'cFalse'

            if int(task_id) in GLOBALS.mutex.keys():
                GLOBALS.mutex[int(task_id)]['user'].pop(user.id, None)
            
            db.session.commit()

    return True

def coordinateDistance(lat1,lon1,lat2,lon2):
    '''Returns the distance (km) between two coordinate points (km).'''

    try:
        a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(math.radians(lon2-lon1)/2)**2    
        distance = 6371 * 2 * math.atan2(a**0.5, (1-a)**0.5)
    except:
        distance = 0
    
    return distance

def checkForIdWork(task_id,label,theshold):
    '''Returns the number of individuals that need to be examined during inter-cluster indentification for the specified task and label.'''

    OtherIndividual = alias(Individual)
    if theshold=='-1': theshold=Config.SIMILARITY_SCORE

    sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                    .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                    .filter(OtherIndividual.c.active==True)\
                    .filter(OtherIndividual.c.name!='unidentifiable')\
                    .filter(IndSimilarity.score>=theshold)\
                    .filter(Individual.task_id==task_id)\
                    .filter(Individual.label_id==label.id)\
                    .filter(Individual.active==True)\
                    .filter(Individual.name!='unidentifiable')\
                    .group_by(Individual.id)\
                    .subquery()

    sq2 = db.session.query(Individual.id.label('indID2'),func.count(distinct(IndSimilarity.id)).label('count2'))\
                    .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                    .filter(OtherIndividual.c.active==True)\
                    .filter(OtherIndividual.c.name!='unidentifiable')\
                    .filter(IndSimilarity.score>=theshold)\
                    .filter(Individual.task_id==task_id)\
                    .filter(Individual.label_id==label.id)\
                    .filter(Individual.active==True)\
                    .filter(Individual.name!='unidentifiable')\
                    .group_by(Individual.id)\
                    .subquery()

    num_individuals = db.session.query(Individual)\
                    .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                    .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                    .filter(Individual.active==True)\
                    .filter(Individual.task_id==task_id)\
                    .filter(Individual.label_id==label.id)\
                    .filter(Individual.name!='unidentifiable')\
                    .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                    .distinct().count()

    return num_individuals

def delete_images(surveyName,folder):
    '''Deletes all images from a specified survey in the given AWS S3 folder.'''

    prefix = folder + '/' + surveyName + '/'
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(Config.BUCKET)
    bucket.objects.filter(Prefix=prefix).delete()
    return True

def getChildList(label,task_id):
    '''Returns a list of all child label IDs for the specified label for the specified task.'''

    children = db.session.query(Label).filter(Label.parent_id==label.id).filter(Label.task_id==task_id).all()
    label_list = []
    for lab in children:
        label_list.append(lab.id)
        if db.session.query(Label).filter(Label.parent_id==lab.id).filter(Label.task_id==task_id).first():
            label_list.extend(getChildList(lab,task_id))
    return label_list

def addChildLabs(task_id,label,labels):
    '''Adds all the children labels of the specified label to the supplied list. The modified list is returned.'''
    
    labels.append(label)
    children = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).all()
    for child in children:
        labels = addChildLabs(task_id,child,labels)
    return labels

def send_email(subject, sender, recipients, text_body, html_body):
    '''Sends an email with the specified self-explanatory characteristics.'''

    msg = Message(subject, sender=sender, recipients=recipients)
    msg.body = text_body
    msg.html = html_body
    mail.send(msg)

def send_enquiry_email(organisation,email,description):
    '''Sends an email to the administrator to let them know about an enquiry to the system.'''
    
    token = jwt.encode(
            {'organisation': organisation, 'email': email},
            app.config['SECRET_KEY'], algorithm='HS256')

    url = 'https://'+Config.DNS+'/createAccount/'+token

    send_email('[TrapTagger] New Enquiry',
               sender=app.config['ADMINS'][0],
               recipients=[Config.MONITORED_EMAIL_ADDRESS],
               text_body=render_template('email/enquiry.txt',
                                        organisation=organisation, email=email, description=description, url=url),
               html_body=render_template('email/enquiry.html',
                                        organisation=organisation, email=email, description=description, url=url))
    return True

def create_new_aws_user(userName):
    '''Creates the necessary AWS accounts and user profiles with the necessary permissions for the specified new user.'''

    #create IAM user
    iam = boto3.client('iam', region_name=Config.AWS_REGION)
    response = iam.create_user(
        UserName=userName
    )

    #Create access keys for user
    response = iam.create_access_key(
        UserName=userName
    )

    s3UserName = response['AccessKey']['AccessKeyId']
    s3Password = response['AccessKey']['SecretAccessKey']

    #Create folder
    GLOBALS.s3client.put_object(Bucket=Config.BUCKET, Key=userName+'/')

    #Add user to TrapTagger Admin Group
    response = iam.add_user_to_group(
        GroupName=Config.IAM_ADMIN_GROUP,
        UserName=userName
    )

    return s3UserName, s3Password

def detection_rating(image):
    '''Returns a rating of the best detection in an image for cluster-ordering purposes.'''

    runningscore = 0
    species = []
    for detection in image.detections:
        if (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.static == False) and (detection.status not in ['deleted','hidden']) and (detection.classification!=None):
            if (detection.classification.lower()!='nothing') and (detection.classification not in species):
                species.append(detection.classification)
            minDimension = min(detection.bottom - detection.top, detection.right - detection.left)
            clipcount = 1-0.225*((detection.top < 0.01) + (detection.bottom > 0.99) + (detection.left < 0.01) + (detection.right > 0.99))
            detScore = clipcount*minDimension
            if detection.classification.lower()=='nothing': detScore*0.5
            runningscore += detScore
    runningscore += 100*(len(species)-1)
    if runningscore == 0:
        runningscore = -1000
    return runningscore

def buildOrderedLabels(parent_id,task_id):
    '''Returns all child labels with a given parent ID for a specified task, in alphabetical order.'''
    
    output = []
    labels = db.session.query(Label.id, Label.description).filter(Label.task_id==task_id).filter(Label.parent_id==parent_id).order_by(Label.description).all()
    for label in labels:
        output.append(label)
        output.extend(buildOrderedLabels(label[0],task_id))
    return output

def addKids(lst, label, task_id):
    '''Adds the children of the given label to the supplied list, and returns it.'''
    
    children = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).all()
    for lab in children:
        lst.append(lab)
        if len(lab.children[:]) != 0:
            lst = addKids(lst, lab, task_id)
    return lst

def addChildToDict(childLabels,reply,task_id,useLabelIDs=False,addParent=True):
    '''Adds the child labels and their children for the specified task to the supplied dictionary.'''
    
    if useLabelIDs:
        if (len(childLabels) != 0) and (childLabels[0].parent_id!=None) and addParent:
            reply[childLabels[0].parent_id] = {}
        for label in childLabels:
            response = {}
            childLabels2 = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).order_by(Label.description).all()
            response = addChildToDict(childLabels2,response,task_id,useLabelIDs,addParent)
            reply[label.id] = response
    else:
        if (len(childLabels) != 0) and (childLabels[0].parent_id!=None) and addParent:
            reply[childLabels[0].parent.description] = {}
        for label in childLabels:
            response = {}
            childLabels2 = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).order_by(Label.description).all()
            response = addChildToDict(childLabels2,response,task_id,useLabelIDs,addParent)
            reply[label.description] = response
    return reply

def addChildLabels(names,ids,label,task_id):
    '''Appends and returns the names and IDs of the specified label for the given task.'''
    
    childLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).order_by(Label.description).all()
    for lab in childLabels:
        names.append(lab.description)
        ids.append(lab.id)
        if len(lab.children[:])>0:
            names, ids = addChildLabels(names,ids,lab,task_id)

    return names, ids

def taggingLevelSQ(sq,taggingLevel,isBounding,task_id):
    '''Filters and returns the provided SQLAlchemy query according to the specified task's tagging level.'''

    if (taggingLevel == '-1') or (taggingLevel == '0'):
        # Initial-level tagging
        if isBounding:
            subq = db.session.query(labelstable.c.cluster_id.label('clusterID'), func.count(distinct(labelstable.c.label_id)).label('labelCount')) \
                            .join(Cluster,Cluster.id==labelstable.c.cluster_id) \
                            .filter(Cluster.task_id==task_id) \
                            .group_by(labelstable.c.cluster_id) \
                            .subquery()
            sq = sq.join(Labelgroup).join(subq, subq.c.clusterID==Cluster.id).filter(Labelgroup.task_id==task_id).filter(Labelgroup.checked==False).filter(subq.c.labelCount>1)
        else:
            sq = sq.filter(~Cluster.labels.any())
    elif (taggingLevel == '-2'):
        # info tagging
        sq = sq.filter(Cluster.labels.any()) \
                .join(Label,Cluster.labels) \
                .filter(~Label.id.in_([GLOBALS.nothing_id,GLOBALS.knocked_id])) \
                .filter(Cluster.skipped==False)
                # .filter(~Cluster.tags.any())                                    
                # .filter(~Cluster.labels.contains(db.session.query(Label).get(GLOBALS.vhl_id))) \
    elif (taggingLevel == '-3'):
        # Classifier checking
        classificationSQ = db.session.query(Cluster.id.label('cluster_id'),Detection.classification.label('classification'),func.count(distinct(Detection.id)).label('count'))\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Survey)\
                                .join(Classifier)\
                                .join(Detection)\
                                .filter(Label.task_id==task_id)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
                                .filter(Detection.class_score>Classifier.threshold) \
                                .group_by(Cluster.id,Detection.classification)\
                                .subquery()

        clusterDetCountSQ = db.session.query(Cluster.id.label('cluster_id'),func.count(Detection.id).label('count'))\
                                .join(Image,Cluster.images)\
                                .join(Detection)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
                                .group_by(Cluster.id)\
                                .subquery()

        labelstableSQ = db.session.query(labelstable.c.cluster_id.label('cluster_id'),Translation.classification.label('classification'))\
                                .join(Translation,Translation.label_id==labelstable.c.label_id)\
                                .join(Cluster,Cluster.id==labelstable.c.cluster_id)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(Translation.task_id==task_id)\
                                .subquery()

        sq = sq.join(clusterDetCountSQ,clusterDetCountSQ.c.cluster_id==Cluster.id)\
                                .join(classificationSQ,classificationSQ.c.cluster_id==Cluster.id)\
                                .outerjoin(labelstableSQ,and_(labelstableSQ.c.cluster_id==Cluster.id,labelstableSQ.c.classification==classificationSQ.c.classification))\
                                .filter((classificationSQ.c.count/clusterDetCountSQ.c.count)>Config.MIN_CLASSIFICATION_RATIO)\
                                .filter(classificationSQ.c.count>1)\
                                .filter(labelstableSQ.c.classification==None)
        
    else:
        # Specific label levels
        if ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            label = db.session.query(Label).get(int(tL[1]))
            
            if tL[0] == '-4':
                # Cluster-level individual ID
                # sq = sq.filter(Cluster.examined==False)
                identified = db.session.query(Detection)\
                                    .join(Labelgroup)\
                                    .join(Individual, Detection.individuals)\
                                    .filter(Labelgroup.labels.contains(label))\
                                    .filter(Individual.label_id==label.id)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(Individual.task_id==task_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .distinct().all()

                sq = sq.join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(~Detection.id.in_([r.id for r in identified]))\
                        .filter(Cluster.labels.contains(label))

            elif tL[0] == '-2':
                # Species-level informational tagging
                sq = sq.filter(Cluster.labels.contains(label)).filter(Cluster.skipped==False)

        # Species-level labelling
        else:
            label = db.session.query(Label).get(int(taggingLevel))
            if isBounding:
                sq = sq.join(Labelgroup).filter(Labelgroup.task_id==task_id).filter(Labelgroup.labels.contains(label)).filter(Labelgroup.checked==False)
            else:
                sq = sq.filter(Cluster.labels.contains(label)).filter(Cluster.skipped==False)

    return sq

def chunker(seq, size):
    '''Breaks down the specified sequence into batches of the specified size.'''
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))

def md5(fname):
    '''Generates the md5 hash for a file'''
    hash_md5 = hashlib.md5()
    with open(fname, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

@celery.task(bind=True,max_retries=29)
def batch_crops(self,image_ids,source,min_area,destBucket,external,update_image_info):
    '''Batch cropping job to parallelise the process on worker instances.'''

    try:
        pool = Pool(processes=4)
        for image_id in image_ids:
            pool.apply_async(save_crops,(int(image_id),source,min_area,destBucket,external,update_image_info))
        pool.close()
        pool.join()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))
    
    finally:
        db.session.remove()

    return True

# @celery.task(bind=True,max_retries=29)
# def extract_labels(self,image_ids,source,external,label_source,task_id):
#     try:
#         for image_id in image_ids:
#             image = db.session.query(Image).get(image_id)

#             # Download file
#             print('Downloading file...')
#             with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
#                 if external:
#                     attempts = 0
#                     retry = True
#                     while retry and (attempts < 10):
#                         attempts += 1
#                         try:
#                             response = requests.get(source+'/'+image.camera.path+'/'+image.filename, timeout=30)
#                             assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
#                             retry = False
#                         except:
#                             retry = True
#                     with open(temp_file.name, 'wb') as handler:
#                         handler.write(response.content)
#                 else:
#                     GLOBALS.s3client.download_file(Bucket=source, Key=image.camera.path+'/'+image.filename, Filename=temp_file.name)
#                 print('Success')

#                 # Extract exif labels
#                 print('Extracting Labels')
#                 try:
#                     cluster = Cluster(task_id=task_id)
#                     db.session.add(cluster)
#                     cluster.images = [image]
#                     print('Cluster created')
#                     if label_source=='iptc':
#                         print('type: iptc')
#                         info = IPTCInfo(temp_file.name)
#                         print('Info extracted')
#                         for label_name in info['keywords']:
#                             description = label_name.decode()
#                             print('Handling label: {}'.format(description))
#                             label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
#                             if not label:
#                                 print('Creating label')
#                                 label = Label(description=description,task_id=task_id)
#                                 db.session.add(label)
#                                 db.session.commit()
#                             cluster.labels.append(label)
#                             print('label added')
#                     db.session.commit()
#                     print('Success')
#                 except:
#                     print("Skipping {} could not extract labels...".format(image.camera.path+'/'+image.filename))

#     except Exception as exc:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')
#         self.retry(exc=exc, countdown= retryTime(self.request.retries))
    
#     finally:
#         db.session.remove()

#     return True

def save_crops(image_id,source,min_area,destBucket,external,update_image_info,label_source=None,task_id=None):
    '''
    Crops all the detections out of the supplied image and saves them to S3 for training purposes.

        Parameters:
            image_id (int): The image being processed
            source (str): The image source - S3 bucket, or root URL if external
            min_area (float): The minimum area of a detection gor it to be cropped
            destBucket (str): The bucket where the crops must be saved
            external (bool): Whether the image is stored outside of S3
            update_image_info (bool): Whether to update the image hash and timestamp in the database
            label_source (str): If not None, the exif field to extract image labels from (for pipelining data)
            task_id (int): The task to which the exif labels must be added
    '''

    image = db.session.query(Image).get(image_id)
    try:
        print('Asserting image')
        assert image
        print('Success')

        # Download file
        print('Downloading file...')
        with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
            if external:
                attempts = 0
                retry = True
                while retry and (attempts < 10):
                    attempts += 1
                    try:
                        response = requests.get(source+'/'+image.camera.path+'/'+image.filename, timeout=30)
                        assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                        retry = False
                    except:
                        retry = True
                with open(temp_file.name, 'wb') as handler:
                    handler.write(response.content)
            else:
                if source:
                    GLOBALS.s3client.download_file(Bucket=source, Key=image.camera.path+'/'+image.filename, Filename=temp_file.name)
                else:
                    GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=image.camera.path+'/'+image.filename, Filename=temp_file.name)
            print('Success')

            print('Opening image...')
            with pilImage.open(temp_file.name) as img:
                img.load()

            assert img
            print('Success')
                
            # always save as RGB for consistency
            if img.mode != 'RGB':
                print('Converting to RGB')
                img = img.convert(mode='RGB')

            if update_image_info:
                # Get image hash
                print('Updating image hash...')
                try:
                    image.hash = md5(temp_file.name)
                    db.session.commit()
                    print('Success')
                except:
                    print("Skipping {} could not generate hash...".format(image.camera.path+'/'+image.filename))

                # Attempt to extract and save timestamp
                print('Updating timestamp...')
                try:
                    t = pyexifinfo.get_json(temp_file.name)[0]
                    timestamp = None
                    for field in ['EXIF:DateTimeOriginal','MakerNotes:DateTimeOriginal']:
                        if field in t.keys():
                            timestamp = datetime.strptime(t[field], '%Y:%m:%d %H:%M:%S')
                            break
                    assert timestamp
                    image.timestamp = timestamp
                    db.session.commit()
                    print('Success')
                except:
                    print("Skipping {} could not extract EXIF timestamp...".format(image.camera.path+'/'+image.filename))

                # Extract exif labels
                print('Extracting Labels')
                if label_source:
                    try:
                        cluster = Cluster(task_id=task_id)
                        db.session.add(cluster)
                        cluster.images = [image]
                        print('Cluster created')
                        if label_source=='iptc':
                            print('type: iptc')
                            info = IPTCInfo(temp_file.name)
                            print('Info extracted')
                            for label_name in info['keywords']:
                                description = label_name.decode()
                                print('Handling label: {}'.format(description))
                                label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
                                if not label:
                                    print('Creating label')
                                    label = Label(description=description,task_id=task_id)
                                    db.session.add(label)
                                    db.session.commit()
                                cluster.labels.append(label)
                                print('label added')
                        elif label_source=='path':
                            descriptions = [image.camera.path.split('/')[-1],image.camera.path.split('/')[-1]]
                            for description in descriptions:
                                print('Handling label: {}'.format(description))
                                label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
                                if not label:
                                    print('Creating label')
                                    label = Label(description=description,task_id=task_id)
                                    db.session.add(label)
                                    db.session.commit()
                                cluster.labels.append(label)
                                print('label added')
                        db.session.commit()
                        print('Success')
                    except:
                        print("Skipping {} could not extract labels...".format(image.camera.path+'/'+image.filename))

            # crop the detections if they have sufficient area and score
            print('Cropping detections...')
            for detection in image.detections:
                area = (detection.right-detection.left)*(detection.bottom-detection.top)
                
                if (area > min_area) and (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]):
                    key = image.camera.path+'/'+image.filename[:-4] + '_' + str(detection.id) + '.jpg'
                    bbox = [detection.left,detection.top,(detection.right-detection.left),(detection.bottom-detection.top)]
                    print('Crropping detection {} on image {}'.format(bbox,key))
                    save_crop(img, bbox_norm=bbox, square_crop=True, bucket=destBucket, key=key)
                    print('Success')
        print('Finished processing image!')
    
    except:
        print('Error processing image {}'.format(image.camera.path+'/'+image.filename))
        if update_image_info and image:
            print('Trying to delete image from database...')
            try:
                # delete if corrupt or inaccessible
                for detection in image.detections:
                    db.session.delete(detection)
                db.session.delete(image)
                db.session.commit()
                print('Success')
            except:
                print('Failed to delete image {}'.format(image_id))
    
    finally:
        db.session.remove()

    return True

def save_crop(img, bbox_norm, square_crop, bucket, key):
    """
    Crops an image and saves the crop to the specified S3 bucket.

        Parameters:
            img (PIL.Image): the image to crop
            bbox_norm (list): The normalised bounding box to be be cropped [xmin, ymin, width, height]
            square_crop (bool): Whether to crop bounding boxes as a square
            bucket (str): The S3 bucket where the crops must be saved
            key (str): The key where the crop should be saved

        Returns:
            True if a crop was saved, False otherwise
    """
    img_w, img_h = img.size
    xmin = int(bbox_norm[0] * img_w)
    ymin = int(bbox_norm[1] * img_h)
    box_w = int(bbox_norm[2] * img_w)
    box_h = int(bbox_norm[3] * img_h)

    if square_crop:
        # expand box width or height to be square, but limit to img size
        box_size = max(box_w, box_h)
        xmin = max(0, min(
            xmin - int((box_size - box_w) / 2),
            img_w - box_w))
        ymin = max(0, min(
            ymin - int((box_size - box_h) / 2),
            img_h - box_h))
        box_w = min(img_w, box_size)
        box_h = min(img_h, box_size)

    if box_w == 0 or box_h == 0:
        return False

    # Image.crop() takes box=[left, upper, right, lower]
    crop = img.crop(box=[xmin, ymin, xmin + box_w, ymin + box_h])

    if square_crop and (box_w != box_h):
        # pad to square using 0s
        crop = ImageOps.pad(crop, size=(box_size, box_size), color=0)

    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file:
            crop.save(temp_file.name)
            GLOBALS.s3client.put_object(Bucket=bucket,Key=key,Body=temp_file)
    except:
        print('Error saving crop: {}'.format(key))

    return True

def list_all(bucket,prefix):
    """list_all is just a thin wrapper around list_objects_v2 to remove the limitation that only the first 1000 objects
    are returned. list_all will call list_objects_v2 as many times as required in order to return all the results."""

    prefixes=[]
    contents=[]
    resp = GLOBALS.s3client.list_objects_v2(Bucket=bucket, Delimiter='/',Prefix=prefix)
    lp=len(prefix)
    while True:
        if 'CommonPrefixes' in resp.keys():
            prefixes+=[p['Prefix'][lp:-1] for p in resp['CommonPrefixes']]
        if 'Contents' in resp.keys():
            contents += [f['Key'].split('/')[-1] for f in resp['Contents']]
        if resp['IsTruncated']:
            resp = GLOBALS.s3client.list_objects_v2(Bucket=bucket, Delimiter='/',Prefix=prefix, ContinuationToken=resp['NextContinuationToken'])
        else:
            return prefixes,contents

def scaleDbCapacity(required_capacity):
    '''Scales the Aurora db capacity to the specified level. Returns the current capacity.'''

    if required_capacity>=1:
        required_capacity = 2**math.ceil(math.log(required_capacity,2))
    else:
        required_capacity=1
    if required_capacity>Config.MAX_AURORA: required_capacity=Config.MAX_AURORA
    if required_capacity<Config.MIN_AURORA: required_capacity=Config.MIN_AURORA

    # Find current capacity
    client = boto3.client('rds',region_name=Config.AWS_REGION)
    response = client.describe_db_clusters(
        DBClusterIdentifier=Config.DB_CLUSTER_NAME
    )
    if ('DBClusters' in response) and (len(response['DBClusters']) > 0):
        current_capacity = response['DBClusters'][0]['Capacity']

        # Get time since last request
        redisClient = redis.Redis(host=Config.REDIS_IP, port=6379)
        last_aurora_request = redisClient.get('last_aurora_request')
        if not last_aurora_request:
            last_aurora_request = 0
        else:
            last_aurora_request = int(last_aurora_request.decode())
        time_since_last_request = round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()) - last_aurora_request

        # Scale DB capacity if needed
        if (current_capacity < required_capacity) and (time_since_last_request > 300):
            try:
                client.modify_current_db_cluster_capacity(
                    DBClusterIdentifier=Config.DB_CLUSTER_NAME,
                    Capacity=required_capacity,
                    SecondsBeforeTimeout=300,
                    TimeoutAction='RollbackCapacityChange'
                )

                # Record the request time
                redisClient.set('last_aurora_request',round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()))

                # Increment the request count
                aurora_request_count = redisClient.get('aurora_request_count')
                if not aurora_request_count:
                    aurora_request_count = 0
                else:
                    aurora_request_count = int(aurora_request_count.decode())
                aurora_request_count += 1
                redisClient.set('aurora_request_count',aurora_request_count)

            except:
                pass
            
        return current_capacity
    
    else:
        return 'error'

def all_equal(iterator):
    '''Efficient methos for checking if all items in an iterator are equal.'''
    iterator = iter(iterator)
    try:
        first = next(iterator)
    except StopIteration:
        return True
    return all(first == x for x in iterator)

def re_evaluate_trapgroup_examined(trapgroup_id,task_id):
    '''Re-evaluates the examined status of a trapgroup's clusters.'''

    task = db.session.query(Task).get(task_id)

    clusters = db.session.query(Cluster)\
                        .join(Image,Cluster.images)\
                        .join(Camera)\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .filter(Cluster.task_id==task_id)\
                        .filter(Cluster.examined==False)\
                        .distinct().all()

    for cluster in clusters:
        cluster.examined = True

    sq = db.session.query(Cluster) \
                .join(Image, Cluster.images) \
                .join(Detection)\
                .join(Camera)\
                .filter(Camera.trapgroup_id==trapgroup_id)

    sq = taggingLevelSQ(sq,task.tagging_level,task.is_bounding,task_id)

    clusters = sq.filter(Cluster.task_id == task_id) \
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                    .filter(Detection.static == False) \
                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                    .distinct().all()

    for chunk in chunker(clusters,2500):
        for cluster in chunk:
            cluster.examined = False
        db.session.commit()

    return True

def getClusterClassifications(cluster_id):
    '''Returns an ordered list of classifications for a given cluster along with their respective ratio of detections.'''
    
    startTime=time.time()
    cluster = db.session.query(Cluster).get(cluster_id)
    task = cluster.task
    survey = task.survey
    
    dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                            .join(Image) \
                            .join(Camera) \
                            .join(Trapgroup) \
                            .join(Survey)\
                            .filter(Trapgroup.survey==survey) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .subquery()
    
    classSQ = db.session.query(Label.id.label('label_id'),func.count(distinct(Detection.id)).label('count'))\
                            .join(Translation)\
                            .join(Detection,Detection.classification==Translation.classification)\
                            .join(dimensionSQ,dimensionSQ.c.detID==Detection.id)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .join(Survey)\
                            .filter(Label.task==task)\
                            .filter(Translation.task==task)\
                            .filter(Image.clusters.contains(cluster))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .filter(dimensionSQ.c.area > Config.DET_AREA) \
                            .filter(Detection.class_score>Classifier.threshold) \
                            .group_by(Label.id)\
                            .subquery()
    
    clusterDetCount = db.session.query(Detection)\
                            .join(Image)\
                            .join(dimensionSQ,dimensionSQ.c.detID==Detection.id)\
                            .filter(Image.clusters.contains(cluster))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .filter(dimensionSQ.c.area > Config.DET_AREA) \
                            .distinct().count()
    
    classifications = db.session.query(Label.description,classSQ.c.count/clusterDetCount)\
                            .join(classSQ,classSQ.c.label_id==Label.id)\
                            .filter(classSQ.c.count/clusterDetCount>=Config.MIN_CLASSIFICATION_RATIO)\
                            .filter(classSQ.c.count>1)\
                            .order_by(classSQ.c.count.desc())\
                            .distinct().all()
    
    classifications = [[item[0],float(item[1])] for item in classifications]
    
    print('Cluster classifications fetched in {}'.format(time.time()-startTime))
    
    return classifications