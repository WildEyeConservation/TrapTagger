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
from sqlalchemy.sql import func, or_, alias
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

def cleanupWorkers(one, two):
    '''
    Reschedules all active Celery tasks on app shutdown. Docker stop flask, and then docker-compose down when message appears. Alternatively, if you do 
    not wish to reschedule the currently active Celery tasks, use docker kill flask instead.
    '''
    
    inspector = celery.control.inspect()
    queues = {'default': 'traptagger_worker', 'priority': 'priority_worker'}
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

@celery.task(ignore_result=True)
def importMonitor():
    '''Periodic Celery task that monitors the length of the classification & inference queues, and fires up EC2 instances as needed.'''
    
    try:
        startTime = datetime.utcnow()
        pricing_region = 'us-east-1' #Pricing API only available in a few regions
        redisClient = redis.Redis(host=Config.REDIS_IP, port=6379)

        queues = {}
        for queue in Config.QUEUES:
            queueLength = redisClient.llen(queue)
            print('{} queue length: {}'.format(queue,queueLength))
            queues[queue] = queueLength

        if len(queues) > 0:
            ec2 = boto3.resource('ec2', region_name=Config.AWS_REGION)
            client = boto3.client('ec2',region_name=Config.AWS_REGION)

            total_images = {'total': 0, 'celery': 0, 'classification': 0}
            surveys = db.session.query(Survey).filter(Survey.images_processing!=0).distinct().all()
            for survey in surveys:
                total_images['total'] += survey.images_processing
                if not survey.processing_initialised:
                    if survey.status=='Importing':
                        total_images['celery'] += survey.images_processing
                    elif survey.status=='Classifying':
                        total_images['classification'] += survey.images_processing
                    survey.processing_initialised = True
                    db.session.commit()
            print('Images being imported: {}'.format(total_images))

            instances_required = {}
            for queue in queues:
                instances_required[queue]=0

            instances = {}
            for queue in queues:
                instances[queue] = 0

                response = client.describe_instances(
                    Filters=[
                        {
                            'Name': 'instance-type',
                            'Values': Config.QUEUES[queue]['instances']
                        },
                        {
                            'Name': 'image-id',
                            'Values': [Config.QUEUES[queue]['ami']]
                        },          
                        {
                            'Name': 'tag:queue',
                            'Values': [queue]
                        },
                        {
                            'Name': 'tag:host',
                            'Values': [str(Config.HOST_IP)]
                        }      
                    ],
                    MaxResults=100
                )    

                for reservation in response['Reservations']:
                    for instance in reservation['Instances']:
                        if (instance['State']['Name'] == 'running') or (instance['State']['Name'] == 'pending'):
                            instances[queue] += 1

                print('EC2 instances active for {}: {}'.format(queue,instances[queue]))

                if not redisClient.get(queue+'_last_launch'):
                    redisClient.set(queue+'_last_launch',0)
                  
                # Parallel queue workers are limited to aim for an ~hour-long inference process
                if Config.QUEUES[queue]['queue_type'] == 'time':
                    if queues[queue] > 0:
                        ins_req = total_images['total']/Config.QUEUES[queue]['bin_size']

                        if instances[queue] == 0:
                            ins_req = math.ceil(ins_req)
                        else:
                            ins_req = round(ins_req)-instances[queue]

                        instances_required[queue] += ins_req

                # Workers are scaled according to the work available
                elif Config.QUEUES[queue]['queue_type'] == 'rate':
                    if (instances[queue] == 0) or ((round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()) - int(redisClient.get(queue+'_last_launch').decode())) > Config.QUEUES[queue]['launch_delay']):
                        ins_req = queues[queue]/Config.QUEUES[queue]['bin_size']

                        if instances[queue] == 0:
                            ins_req = math.ceil(ins_req)
                        else:
                            ins_req = math.floor(ins_req)-1

                        # # Prevent it from launching 50 instances in one go
                        # maxincrease = round(total_images['total']/Config.QUEUES['parallel']['bin_size'])*4
                        # if ins_req > maxincrease: ins_req=maxincrease

                        instances_required[queue] += ins_req

                # Jobs that have a local queue should only scale up if the server is overwhelmed
                elif Config.QUEUES[queue]['queue_type'] == 'local':
                    if ((round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()) - int(redisClient.get(queue+'_last_launch').decode())) > Config.QUEUES[queue]['launch_delay']):
                        instances_required[queue] += math.ceil(queues[queue]/Config.QUEUES[queue]['bin_size'])-1

            # pre-emptively launch GPU instances with the CPU importers to smooth out control loop
            instances_required['celery'] += round(total_images['celery']/Config.QUEUES['parallel']['bin_size'])*Config.QUEUES['celery']['init_size']
            instances_required['classification'] += round(total_images['classification']/Config.QUEUES['parallel']['bin_size'])*Config.QUEUES['classification']['init_size']

            print('Instances required: {}'.format(instances_required))

            for queue in queues:
                max_allowed = Config.QUEUES[queue]['max_instances']-instances[queue]
                if instances_required[queue] > max_allowed: instances_required[queue]=max_allowed

                if instances_required[queue] > 0:                   
                    kwargs = {
                        'ImageId':Config.QUEUES[queue]['ami'],
                        'KeyName':Config.KEY_NAME,
                        'MaxCount':1,
                        'MinCount':1,
                        'Monitoring':{'Enabled': True},
                        'SecurityGroupIds':[Config.SG_ID],
                        'SubnetId':Config.SUBNET_ID,
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
                    userData = '#!/bin/bash\n cd /home/ubuntu/TrapTagger;'
                    userData += ' git fetch;'
                    userData += ' git checkout {};'.format(Config.QUEUES[queue]['branch'])
                    userData += ' git pull;'
                    userData += ' git lfs fetch --all;'
                    userData += ' git lfs pull;'
                    userData += ' cd /home/ubuntu; '
                    userData += Config.QUEUES[queue]['user_data']

                    #Determine the cheapest option by calculating th cost per image of all instance types
                    # Add spot instance pricing
                    costPerImage = {}
                    # for instance in Config.QUEUES[queue]['instances']:
                    #     prices = client.describe_spot_price_history(
                    #         InstanceTypes=[instance],
                    #         MaxResults=1,
                    #         ProductDescriptions=['Linux/UNIX']
                    #     )

                    #     if len(prices['SpotPriceHistory']) > 0:
                    #         costPerImage[instance+',spot'] = float(prices['SpotPriceHistory'][0]['SpotPrice'])/Config.INSTANCE_RATES[queue][instance]

                    # Add on-demand prices to list
                    for instance in Config.QUEUES[queue]['instances']:
                        price = get_price(pricing_region, instance, 'Linux')
                        if price: costPerImage[instance+',demand'] = float(price)/Config.INSTANCE_RATES[queue][instance]

                    # cheapestInstance = min(costPerImage, key=costPerImage.get)
                    orderedInstances = {k: v for k, v in sorted(costPerImage.items(), key=lambda item: item[1])}
                        
                    #Launch instances - try launch cheapest, if no capacity, launch the next cheapest
                    for n in range(instances_required[queue]):
                        #jitter idle check so that a whole bunch of instances down shutdown together
                        idle_multiplier = round(Config.IDLE_MULTIPLIER[queue]*random.uniform(0.5, 1.5))
                        kwargs['UserData'] = userData.format(randomString()).replace('IDLE_MULTIPLIER',str(idle_multiplier))
                        for item in orderedInstances:
                            pieces = re.split(',',item)
                            kwargs['InstanceType'] = pieces[0]
                            if pieces[1] == 'spot':
                                kwargs['InstanceMarketOptions'] = {
                                    'MarketType': 'spot',
                                    'SpotOptions': {
                                        # 'MaxPrice': 'string',
                                        'SpotInstanceType': 'one-time',
                                        # 'BlockDurationMinutes': 123,
                                        # 'ValidUntil': datetime(2015, 1, 1),
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
    Checks to see if species classification has been completed for a task, and sets the task complete sttus accordingly.

        Parameters:
            task_id (int): Task the must be checked.
    '''
    
    complete = True
    parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
    parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
    for parentLabel in parentLabels:
        parentCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(parentLabel)).first()
        for childLabel in parentLabel.children:
            childCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(childLabel)).first()
            if childCheck != None:
                break
        if (parentCheck!=None) and (childCheck==None):
            complete = False
            break
    db.session.query(Task).get(task_id).complete = complete
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
                        .filter(Detection.score > 0.8) \
                        .filter(Detection.static == False) \
                        .filter(Detection.status!='deleted') \
                        .distinct().all()

    count = db.session.query(Detection)\
                        .join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(~Detection.id.in_([r.id for r in identified]))\
                        .filter(Detection.score > 0.8) \
                        .filter(Detection.static == False) \
                        .filter(Detection.status!='deleted') \
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
            detections = db.session.query(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Detection.score > 0.8).filter(Detection.status!='deleted').distinct().all()

            if undo:
                app.logger.info('Undoing the removal of false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
                staticState = False
            else:
                app.logger.info('Removing false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
                staticState = True

            images = []
            for detection in detections:
                # Find and mark as static all high IOU detections
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
                            AND det2.score > 0.8
                        ) as sq1
                    WHERE
                        area1 < 0.1
                        AND sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.9
                """

                resultproxy = db.session.execute(query.format(str(detection.id)))

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
            if task and (task.status in ['PROGRESS','Processing']):
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
            if task and (task.status not in ['PROGRESS','Processing']):
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
        trapgroup.active = True
        trapgroup.processing = False
        db.session.commit()

        if trapgroup.queueing:
            trapgroup.queueing = False
            db.session.commit()
            unknock_cluster.apply_async(kwargs={'image_id':int(rootImageID), 'label_id':None, 'user_id':current_user_id, 'task_id':task_id})

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
        trapgroup.active = True
        trapgroup.processing = False
        db.session.commit()

        if trapgroup.queueing:
            trapgroup.queueing = False
            db.session.commit()
            finish_knockdown.apply_async(kwargs={'rootImageID':rootImage.id, 'task_id':task_id, 'current_user_id':user_id})

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
                                .filter(Trapgroup.survey_id==survey_id) \
                                .filter(Detection.class_score>Config.CLASS_SCORE) \
                                .filter(Detection.score > 0.8) \
                                .filter(Detection.static == False) \
                                .filter(Detection.status != 'deleted') \
                                .subquery()

        totalDetSQ = db.session.query(Cluster.id.label('clusID'), func.count(Detection.id).label('detCountTotal')) \
                                .join(Image, Cluster.images) \
                                .join(Detection) \
                                .join(dimensionSQ, dimensionSQ.c.detID==Detection.id) \
                                .filter(Detection.class_score>Config.CLASS_SCORE) \
                                .filter(Detection.score > 0.8) \
                                .filter(Detection.static == False) \
                                .filter(Detection.status != 'deleted') \
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

            detCountSQ = db.session.query(Cluster.id.label('clusID'), func.count(Detection.id).label('detCount')) \
                                .join(Image, Cluster.images) \
                                .join(Detection) \
                                .join(dimensionSQ, dimensionSQ.c.detID==Detection.id) \
                                .filter(Detection.class_score>Config.CLASS_SCORE) \
                                .filter(Detection.score > 0.8) \
                                .filter(Detection.static == False) \
                                .filter(Detection.status != 'deleted') \
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

            clusters = clusters.distinct().all()

            for cluster in clusters:
                cluster.labels = [species]
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

    parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
    for label in parentLabels:
        check = db.session.query(Cluster).filter(Cluster.labels.contains(label)).first()
        if check == None:
            label.complete = True
        else:
            label.complete = False
    db.session.commit()
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

            user.passed = 'cTrue'

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

def checkForIdWork(task_id,label):
    '''Returns the number of individuals that need to be examined during inter-cluster indentification for the specified task and label.'''

    OtherIndividual = alias(Individual)

    sq1 = db.session.query(Individual.id.label('indID1'),func.count(IndSimilarity.id).label('count1'))\
                    .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                    .filter(OtherIndividual.c.active==True)\
                    .filter(OtherIndividual.c.name!='unidentifiable')\
                    .filter(IndSimilarity.score>Config.SIMILARITY_SCORE)\
                    .filter(Individual.task_id==task_id)\
                    .filter(Individual.label_id==label.id)\
                    .filter(Individual.active==True)\
                    .filter(Individual.name!='unidentifiable')\
                    .group_by(Individual.id)\
                    .subquery()

    sq2 = db.session.query(Individual.id.label('indID2'),func.count(IndSimilarity.id).label('count2'))\
                    .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                    .filter(OtherIndividual.c.active==True)\
                    .filter(OtherIndividual.c.name!='unidentifiable')\
                    .filter(IndSimilarity.score>Config.SIMILARITY_SCORE)\
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

def delete_images(surveyName,bucketName):
    '''Deletes all images from a specified survey in the given AWS S3 bucket.'''

    prefix = surveyName + '/'
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(bucketName)
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

def create_new_aws_user(organisation,bucket):
    '''Creates the necessary AWS accounts and user profiles with the necessary permissions for the specified new user.'''

    bucket_name_raw = bucket + '-raw'
    bucket_name = bucket
    userName = organisation.lower().replace(' ','-').replace('_','-')

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

    #Create buckets
    s3 = boto3.client('s3', region_name=Config.AWS_REGION)
    response = s3.create_bucket(
        ACL='private',
        Bucket=bucket_name_raw,
        CreateBucketConfiguration={
            'LocationConstraint': 'eu-west-2'
        }
    )

    response = s3.create_bucket(
        ACL='private',
        Bucket=bucket_name,
        CreateBucketConfiguration={
            'LocationConstraint': 'eu-west-2'
        }
    )

    time.sleep(10)

    #set bucket policy
    bucket_policy = {
        'Version': '2012-10-17',
        'Statement': [
        {
            'Sid': 'AddPerm',
            'Effect': 'Allow',
            'Principal': {"AWS": ["arn:aws:iam::275736403632:user/"+userName, "arn:aws:iam::275736403632:root"]},
            'Action': "s3:*",
            'Resource': 'arn:aws:s3:::'+bucket_name_raw+'/*'
        },
        {
            "Sid":"Allow get requests from traptagger",
            "Effect":"Allow",
            "Principal":"*",
            "Action":"s3:GetObject",
            "Resource":"arn:aws:s3:::"+bucket_name_raw+"/*",
            "Condition":{"StringLike":{"aws:Referer":["https://www."+Config.DNS+"/*","https://"+Config.DNS+"/*"]}}
        },
        {
            "Sid": "AddPerm",
            "Effect": "Allow",
            "Principal": {"AWS": ["arn:aws:iam::275736403632:user/"+userName, "arn:aws:iam::275736403632:root"]},
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::"+bucket_name_raw
        }
        ]
    }
    s3.put_bucket_policy(Bucket=bucket_name_raw, Policy=json.dumps(bucket_policy))

    bucket_policy = {
        "Version":"2012-10-17",
        "Statement":[
            {
                'Sid': 'AddPerm',
                'Effect': 'Allow',
                'Principal': {"AWS": ["arn:aws:iam::275736403632:root"]},
                'Action': "s3:*",
                'Resource': 'arn:aws:s3:::'+bucket_name+'/*'
            },
            {
                "Sid":"Allow get requests from traptagger",
                "Effect":"Allow",
                "Principal":"*",
                "Action":"s3:GetObject",
                "Resource":"arn:aws:s3:::"+bucket_name+"/*",
                "Condition":{"StringLike":{"aws:Referer":["https://www."+Config.DNS+"/*","https://"+Config.DNS+"/*"]}}
            },
            {
                "Sid": "AddPerm",
                "Effect": "Allow",
                "Principal": {"AWS": ["arn:aws:iam::275736403632:root"]},
                "Action": "s3:ListBucket",
                "Resource": "arn:aws:s3:::"+bucket_name
            }
        ]
        }
    s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(bucket_policy))


    ############################Set up for browser upload
    #Set bucket cors
    s3.put_bucket_cors(
        Bucket=bucket_name_raw,
        CORSConfiguration={
            'CORSRules': [
                {
                    'AllowedHeaders': ['*'],
                    'AllowedMethods': ['HEAD','POST','GET','PUT','DELETE'],
                    'AllowedOrigins': ['*'],
                    'ExposeHeaders': ['ETag','Content-Length','Content-Type','Connection','Date','Server','x-amz-delete-marker','x-amz-id-2','x-amz-request-id','x-amz-version-id']
                },
            ]
        },
    )

    cognito = boto3.client('cognito-identity', region_name=Config.AWS_REGION)

    response = cognito.create_identity_pool(
        IdentityPoolName='traptagger_identiy_pool_'+userName,
        AllowUnauthenticatedIdentities=True
    )

    IdentityPoolId = response['IdentityPoolId']

    policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::"+bucket_name_raw+"/*"
            }
        ]
    }

    response = iam.create_policy(
        PolicyName='traptagger_'+userName,
        PolicyDocument=json.dumps(policy_document)
    )

    policyArn = response['Policy']['Arn']

    roleName = 'traptagger_role_'+userName

    assume_role_policy_document = json.dumps({
    "Version": "2012-10-17",
    "Statement": [
        {
        "Effect": "Allow",
        "Principal": {
            "Federated": "cognito-identity.amazonaws.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
            "StringEquals": {
            "cognito-identity.amazonaws.com:aud": IdentityPoolId
            },
            "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated"
            }
        }
        }
    ]
    })

    response = iam.create_role(
        RoleName=roleName,
        AssumeRolePolicyDocument=assume_role_policy_document,
        MaxSessionDuration=43200
    )

    roleArn = response['Role']['Arn']

    response = iam.attach_role_policy(
        RoleName=roleName,
        PolicyArn=policyArn
    )

    response = cognito.set_identity_pool_roles(
        IdentityPoolId=IdentityPoolId,
        Roles={
            'authenticated': roleArn,
            'unauthenticated': roleArn
        }
    )

    user = db.session.query(User).filter(User.username==organisation).first()
    user.identity_pool_id = IdentityPoolId
    db.session.commit()

    ###############################

    return s3UserName, s3Password, bucket_name_raw

def detection_rating(image):
    '''Returns a rating of the best detection in an image for cluster-ordering purposes.'''

    runningscore = 0
    species = []
    for detection in image.detections:
        if (detection.score > 0.8) and (detection.static == False) and (detection.status!='deleted') and (detection.classification!=None) and (detection.classification.lower()!='nothing'):
            if detection.classification not in species:
                species.append(detection.classification)
            minDimension = min(detection.bottom - detection.top, detection.right - detection.left)
            clipcount = 1-0.225*((detection.top < 0.01) + (detection.bottom > 0.99) + (detection.left < 0.01) + (detection.right > 0.99))
            runningscore += clipcount*minDimension
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

def addChildToDict(childLabels,reply,task_id):
    '''Adds the child labels and their children for the specified task to the supplied dictionary.'''
    
    if (len(childLabels) != 0) and (childLabels[0].parent_id!=None):
        reply[childLabels[0].parent.description] = {}
    for label in childLabels:
        response = {}
        childLabels2 = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).all()
        response = addChildToDict(childLabels2,response,task_id)
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
            subq = db.session.query(labelstable.c.cluster_id.label('clusterID'), func.count(labelstable.c.label_id).label('labelCount')) \
                            .join(Cluster,Cluster.id==labelstable.c.cluster_id) \
                            .filter(Cluster.task_id==task_id) \
                            .group_by(labelstable.c.cluster_id) \
                            .subquery()
            sq = sq.join(Labelgroup).join(subq, subq.c.clusterID==Cluster.id).filter(Labelgroup.task_id==task_id).filter(Labelgroup.checked==False).filter(subq.c.labelCount>1)
        else:
            sq = sq.filter(~Cluster.labels.any())
    elif (taggingLevel == '-2'):
        # info tagging (depricated)
        sq = sq.filter(Cluster.labels.any()) \
                .join(Label,Cluster.labels) \
                .filter(~Label.id.in_([GLOBALS.nothing_id,GLOBALS.knocked_id])) \
                .filter(~Cluster.tags.any())                                    
                # .filter(~Cluster.labels.contains(db.session.query(Label).get(GLOBALS.vhl_id))) \
    elif (taggingLevel == '-3'):
        # Classifier checking
        sq = sq.filter(Cluster.classification_checked==False)
    else:
        # Specific label levels
        if ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            
            if tL[0] == '-4':
                # Cluster-level individual ID
                sq = sq.filter(Cluster.examined==False)

            elif tL[0] == '-2':
                # Species-level informational tagging
                label = db.session.query(Label).get(int(tL[1]))
                sq = sq.filter(Cluster.labels.contains(label)).filter(~Cluster.tags.any()).filter(Cluster.skipped==False)

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

def save_crops(image_id,source,min_area,destBucket,external,update_image_info):
    '''
    Crops all the detections out of the supplied image and saves them to S3 for training purposes.

        Parameters:
            image_id (int): The image being processed
            source (str): The image source - S3 bucket, or root URL if external
            min_area (float): The minimum area of a detection gor it to be cropped
            destBucket (str): The bucket where the crops must be saved
            external (bool): Whether the image is stored outside of S3
            update_image_info (bool): Whether to update the image hash and timestamp in the database
    '''

    image = db.session.query(Image).get(image_id)
    try:
        print('Asserting image')
        assert image
        print('Success')

        # Download file
        print('Downloading file...')
        temp_file = tempfile.NamedTemporaryFile(delete=True, suffix='.JPG')
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
            GLOBALS.s3client.download_file(Bucket=source, Key=image.camera.path+'/'+image.filename, Filename=temp_file.name)
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
            except (KeyError, ValueError):
                print("Skipping {} could not extract EXIF timestamp...".format(image.camera.path+'/'+image.filename))

        # crop the detections if they have sufficient area and score
        print('Cropping detections...')
        for detection in image.detections:
            area = (detection.right-detection.left)*(detection.bottom-detection.top)
            
            if (area > min_area) and (detection.score > 0.8):
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
        temp_file = tempfile.NamedTemporaryFile(delete=True, suffix='.jpg')
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