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

from app import app, db, celery, mail
from app.models import *
import GLOBALS
import json
from flask import render_template
import time
import threading
from sqlalchemy.sql import func, or_, alias, distinct, and_, literal_column
from sqlalchemy import desc, insert
import random
import string
from datetime import datetime, timedelta
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
import piexif
import io
import pandas as pd
import pytz
import timezonefinder
import secrets

# def cleanupWorkers(one, two):
#     '''
#     Reschedules all active Celery tasks on app shutdown. Docker stop flask, and then docker-compose down when message appears. Alternatively, if you do 
#     not wish to reschedule the currently active Celery tasks, use docker kill flask instead.
#     '''

#     # Stop all task consumption
#     allQueues = ['default'] #default needs to be first
#     allQueues.extend([queue for queue in Config.QUEUES if queue not in allQueues])
#     allQueues.extend([r[0] for r in db.session.query(Classifier.name).all()])
#     for queue in allQueues:
#         celery.control.cancel_consumer(queue)

#     app.logger.info('')
#     app.logger.info('*********************************************************')
#     app.logger.info('')
#     app.logger.info('All queues cancelled. Revoking active tasks...')
    
#     # revoke active and reserved tasks
#     active_tasks = []
#     inspector = celery.control.inspect()
#     inspector_reserved = inspector.reserved()
#     inspector_active = inspector.active()
#     defaultWorkerNames = ['default_worker','traptagger_worker','ram_worker']

#     if inspector_active!=None:
#         for worker in inspector_active:
#             if any(name in worker for name in defaultWorkerNames): active_tasks.extend(inspector_active[worker])
#             for task in inspector_active[worker]:
#                 try:
#                     celery.control.revoke(task['id'], terminate=True)
#                 except:
#                     pass
    
#     if inspector_reserved != None:
#         for worker in inspector_reserved:
#             if any(name in worker for name in defaultWorkerNames): active_tasks.extend(inspector_reserved[worker])
#             for task in inspector_reserved[worker]:
#                 try:
#                     celery.control.revoke(task['id'], terminate=True)
#                 except:
#                     pass

#     app.logger.info('Active tasks revoked. Flushing queues...')

#     # Flush all other (non-default) queues
#     for queue in allQueues:
#         if queue not in ['default','ram_intensive']:
#             while True:
#                 task = GLOBALS.redisClient.blpop(queue, timeout=1)
#                 if not task:
#                     break

#     app.logger.info('Queues flushed. Rescheduling active tasks...')

#     # Reschedule default queue tasks
#     for active_task in active_tasks:
#         for function_location in ['app.routes','app.functions.admin','app.functions.annotation','app.functions.globals',
#                                     'app.functions.imports','app.functions.individualID','app.functions.results']:
#             if function_location in active_task['name']:
#                 module = importlib.import_module(function_location)
#                 function_name = re.split(function_location+'.',active_task['name'])[1]
#                 active_function = getattr(module, function_name)
#                 break
#         kwargs = active_task['kwargs']
#         # priority = active_task['delivery_info']['priority']
#         if 'ram_worker' in active_task['hostname']:
#             queue = 'ram_intensive'
#         else:
#             queue = 'default'
#         app.logger.info('Rescheduling {} with args {}'.format(active_task['name'],kwargs))
#         active_function.apply_async(kwargs=kwargs, queue=queue) #, priority=priority)

#     #Ensure redis db is saved
#     app.logger.info('Saving redis db...')
#     GLOBALS.redisClient.save()
#     app.logger.info('Redis db saved')

#     app.logger.info('')
#     app.logger.info('*********************************************************')
#     app.logger.info('')
#     app.logger.info('                 Exited Gracefully!')
#     app.logger.info('          You may docker-compose down now')
#     app.logger.info('')
#     app.logger.info('*********************************************************')
#     app.logger.info('')

#     sys.exit(0)

# signal.signal(signal.SIGTERM, cleanupWorkers) #only necessary one
# signal.signal(signal.SIGINT, cleanupWorkers)
# signal.signal(signal.SIGABRT, cleanupWorkers)

@celery.task(bind=True,max_retries=5,ignore_result=True)
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

def getQueueLengths():
    '''Returns a dictionary of all Redis queues and their length.'''
    queues = {}
    for queue in Config.QUEUES:
        queueLength = GLOBALS.redisClient.llen(queue)
        if Config.DEBUGGING: print('{} queue length: {}'.format(queue,queueLength))
        if queueLength: queues[queue] = queueLength

    for queue in [r[0] for r in db.session.query(Classifier.queue).filter(Classifier.queue!=None).distinct().all()]:
        queueLength = GLOBALS.redisClient.llen(queue)
        if Config.DEBUGGING: print('{} queue length: {}'.format(queue,queueLength))
        if queueLength: queues[queue] = queueLength

    return queues

def getImagesProcessing():
    '''Gets the quantities of images being processed'''
    commit = False
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
            commit = True
            # db.session.commit()
    return images_processing, commit

def getInstanceCount(client,queue,ami,host_ip,instance_types):
    '''Returns the count of running instances for the given queue'''
    instance_count = 0
    filters = [
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
        },
        {
            'Name': 'instance-state-name',
            'Values': ['running','pending']
        }
    ]
    
    resp = client.describe_instances(
        Filters=filters,
        MaxResults=100
    )

    while True:
        for reservation in resp["Reservations"]:
            for instance in reservation["Instances"]:
                instance_count += 1
        if 'NextToken' in resp.keys() and resp['NextToken']:
            resp = client.describe_instances(
                Filters=filters,
                MaxResults=100,
                NextToken=resp['NextToken']
            )
        else:
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

def launch_instances(queue,ami,user_data,instances_required,idle_multiplier,ec2,instances,instance_rates,git_pull,subnet):
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
        userData += 'cd /home/ubuntu/TrapTagger/WorkR;'
        userData += ' chown -R root /home/ubuntu/TrapTagger/WorkR;'
        userData += ' git fetch --all;'
        if queue=='statistics':
            userData += ' git checkout master;'
        else:
            userData += ' git checkout server;'
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
                GLOBALS.redisClient.set(queue+'_last_launch',round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()))
                break

            except ClientError:
                # Handle insufficient capacity
                pass

    return True

def updateTaskCompletionStatus(task_id):
    '''
    Updates the various task-level counts and completion statuses.

        Parameters:
            task_id (int): Task that must be checked.
    '''

    complete = True
    task = db.session.query(Task).get(task_id)
    
    # Check if there init level is complete
    check = db.session.query(Labelgroup)\
                    .join(Detection)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .filter(Labelgroup.task_id==task_id)\
                    .filter(~Labelgroup.labels.any())\
                    .first()
    if check:
        complete = False

    task.init_complete = complete

    # # Check if parent categories are complete
    # parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
    # if db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==GLOBALS.vhl_id).first():
    #     parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
    # for parentLabel in parentLabels:
    #     parentCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(parentLabel)).first()
    #     for childLabel in db.session.query(Label).filter(Label.task_id).filter(Label.parent==parentLabel).distinct().all():
    #         childCheck = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(childLabel)).first()
    #         if childCheck != None:
    #             break
    #     if (parentCheck!=None) and (childCheck==None):
    #         complete = False
    #         break
    
    # task.complete = complete

    subq = db.session.query(detectionLabels.c.labelgroup_id.label('labelgroupID'), func.count(distinct(detectionLabels.c.label_id)).label('labelCount')) \
                    .join(Labelgroup,Labelgroup.id==detectionLabels.c.labelgroup_id) \
                    .filter(Labelgroup.task_id==task_id) \
                    .group_by(detectionLabels.c.labelgroup_id) \
                    .subquery()

    task.unchecked_multi_count = db.session.query(Cluster) \
                    .join(Image,Cluster.images) \
                    .join(Detection) \
                    .join(Labelgroup) \
                    .join(subq, subq.c.labelgroupID==Labelgroup.id) \
                    .filter(Labelgroup.task_id==task_id) \
                    .filter(Labelgroup.checked==False) \
                    .filter(Cluster.task_id==task_id) \
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                    .filter(Detection.static==False) \
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                    .filter(subq.c.labelCount>1).distinct().count()
                    
    task.unlabelled_animal_cluster_count = db.session.query(Cluster)\
                    .join(Image, Cluster.images)\
                    .join(Detection)\
                    .join(Labelgroup)\
                    .filter(Labelgroup.task_id==task_id)\
                    .filter(Cluster.task_id==int(task_id))\
                    .filter(~Labelgroup.labels.any())\
                    .filter(Detection.static==False)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .distinct().count()
                    
    vhl_label = db.session.query(Label).get(GLOBALS.vhl_id)
    task.vhl_count = db.session.query(Cluster)\
                .join(Image,Cluster.images)\
                .join(Detection)\
                .join(Labelgroup)\
                .filter(Labelgroup.task_id==int(task_id))\
                .filter(Cluster.task_id==int(task_id))\
                .filter(Labelgroup.labels.contains(vhl_label))\
                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                .filter(Detection.static==False)\
                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                .distinct().count()
                    
    task.infoless_count = db.session.query(Cluster)\
                    .join(Image, Cluster.images)\
                    .join(Detection)\
                    .join(Labelgroup)\
                    .filter(Labelgroup.task_id==task_id)\
                    .filter(Cluster.task_id==int(task_id))\
                    .filter(Labelgroup.labels.any())\
                    .filter(~Labelgroup.tags.any())\
                    .filter(Detection.static==False)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .distinct().count()
                    
    task.infoless_vhl_count = db.session.query(Cluster)\
                    .join(Image, Cluster.images)\
                    .join(Detection)\
                    .join(Labelgroup)\
                    .filter(Labelgroup.task_id==task_id)\
                    .filter(Cluster.task_id==task_id)\
                    .filter(Labelgroup.labels.contains(vhl_label))\
                    .filter(~Labelgroup.tags.any())\
                    .filter(Detection.static==False)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .distinct().count()
    
    task.vhl_bounding_count = db.session.query(Labelgroup) \
                    .join(Detection) \
                    .filter(Labelgroup.task_id==task_id) \
                    .filter(Labelgroup.labels.contains(vhl_label)) \
                    .filter(Labelgroup.checked==False) \
                    .filter(Detection.static==False) \
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                    .distinct().count()
    
    # sq = db.session.query(Cluster)\
    #                 .join(Translation,Cluster.classification==Translation.classification)\
    #                 .filter(Translation.label_id==vhl_label.id)\
    #                 .filter(Cluster.task==task)

    # sq = taggingLevelSQ(sq,'-3',False,task.id)

    # task.potential_vhl_clusters = sq.distinct().count() 
    
    task.vhl_image_count = db.session.query(Image)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.static==False)\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .filter(Labelgroup.labels.contains(vhl_label))\
                                    .distinct().count()

    task.vhl_sighting_count = db.session.query(Labelgroup)\
                                    .join(Detection)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(Labelgroup.labels.contains(vhl_label))\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.static==False)\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .distinct().count()
    
    cluster_sq = db.session.query(Cluster.id)\
                            .join(Image, Cluster.images)\
                            .join(Detection)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .distinct().subquery()             

    task.empty_count = db.session.query(Image.id)\
                        .join(Cluster, Image.clusters)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .outerjoin(cluster_sq, cluster_sq.c.id==Cluster.id)\
                        .filter(cluster_sq.c.id==None)\
                        .filter(Cluster.task_id==task_id)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.checked==False)\
                        .distinct().count()

    db.session.commit()

    return True

# def clusterIdComplete(task_id,label_id):
#     '''
#     Returns whether the first stage of individual identification has been completed for a particular task and label combination.

#         Parameters:
#             task_id (int): The task to be checked
#             label_id (int): The label to be checked
#     '''

#     label = db.session.query(Label).get(label_id)
#     task = db.session.query(Task).get(task_id)

#     check = db.session.query(Detection)\
#                         .join(Labelgroup)\
#                         .filter(Labelgroup.task_id==task_id)\
#                         .filter(Labelgroup.labels.contains(label))\
#                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                         .filter(Detection.static == False) \
#                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
#                         .distinct().first()

#     if check:
#         identified = db.session.query(Detection)\
#                             .join(Labelgroup)\
#                             .join(Individual, Detection.individuals)\
#                             .filter(Labelgroup.labels.contains(label))\
#                             .filter(Individual.species==label.description)\
#                             .filter(Labelgroup.task_id==task_id)\
#                             .filter(Individual.tasks.contains(task))\
#                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                             .filter(Detection.static == False) \
#                             .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
#                             .subquery()

#         count = db.session.query(Detection)\
#                             .outerjoin(identified,identified.c.id==Detection.id)\
#                             .join(Labelgroup)\
#                             .filter(Labelgroup.task_id==task_id)\
#                             .filter(Labelgroup.labels.contains(label))\
#                             .filter(identified.c.id==None)\
#                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                             .filter(Detection.static == False) \
#                             .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
#                             .distinct().count()

#         if count==0:
#             return True
    
#     return False

def updateIndividualIdStatus(task_id):
    '''Updates the icID_allowed status of all labels of a specified task, based on whether the first stage of individual identification has been completed.'''
    
    labels = db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.children.any()).all()
    task = db.session.query(Task).get(task_id)

    for label in labels:

        individualsSQ = db.session.query(Individual)\
                            .filter(Individual.species==label.description)\
                            .filter(Individual.tasks.contains(task))\
                            .subquery()

        label.unidentified_count = db.session.query(Cluster.id)\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .outerjoin(individualsSQ,Detection.individuals)\
                            .join(Labelgroup)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(Labelgroup.task_id==task_id)\
                            .filter(Labelgroup.labels.contains(label))\
                            .filter(individualsSQ.c.id==None)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .distinct().count()

        check = db.session.query(Detection)\
                            .join(Labelgroup)\
                            .filter(Labelgroup.task_id==task_id)\
                            .filter(Labelgroup.labels.contains(label))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .distinct().first()

        if check and (label.unidentified_count==0):
            label.icID_allowed = True
        else:
            label.icID_allowed = False
            label.icID_q1_complete = False
        
        label.icID_count = checkForIdWork([label.task_id],label.description,'-1')
        
    db.session.commit()

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def removeFalseDetections(self,cluster_id,undo):
    '''
    Celery task for marking false detections as static. Takes all relevent detections from a cluster marked as containing nothing, and marks all high-IOU detections 
    from the same camera as static.
    '''

    try:
        cluster = db.session.query(Cluster).get(cluster_id)
        task_id = cluster.task_id
        trapgroup_id = cluster.images[0].camera.trapgroup.id
        survey_id = cluster.task.survey_id

        if cluster:
            detections = db.session.query(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)).distinct().all()

            if undo:
                if Config.DEBUGGING: app.logger.info('Undoing the removal of false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
                staticState = False
            else:
                if Config.DEBUGGING: app.logger.info('Removing false detections assocated with nothing-labelled cluster {}'.format(cluster_id))
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

            # TODO: add a user interface to check user-labelled clusters that have all their detections removed?
            # For now just adding back all of the detections if the above happens
            clusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .outerjoin(Detection)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .filter(Detection.static==False)\
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                .filter(Detection.id==None)\
                                .filter(Cluster.user_id!=1)\
                                .filter(Cluster.labels.any())\
                                .distinct().all()

            for cluster in clusters:
                detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .filter(Image.clusters.contains(cluster))\
                                    .filter(Detection.static==True)\
                                    .distinct().all()
                
                for detection in detections:
                    detection.static=False

            db.session.commit()

            for image in set(images):
                image.detection_rating = detection_rating(image)
            db.session.commit()
            
            re_evaluate_trapgroup_examined(trapgroup_id,task_id)

            trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
            trapgroup.processing = False
            trapgroup.active = True
            GLOBALS.redisClient.lrem('trapgroups_'+str(survey_id),0,trapgroup.id)
            GLOBALS.redisClient.rpush('trapgroups_'+str(survey_id),trapgroup.id) 
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

# def populateMutex(task_id,user_id=None):
#     '''Checks for and populates the mutex globals for a given task, and optional user combination.'''
#     try:
#         task = db.session.query(Task).get(task_id)
#         if task_id not in GLOBALS.mutex.keys():
#             if task and (task.status in ['PROGRESS','Processing','Knockdown Analysis']):
#                 GLOBALS.mutex[task_id] = {
#                     'global': threading.Lock(),
#                     # 'user': {},
#                     'job': threading.Lock(),
#                     'trapgroup': {}
#                 }

#                 for trapgroup in task.survey.trapgroups:
#                     GLOBALS.mutex[task_id]['trapgroup'][trapgroup.id] = threading.Lock()
            
#             else:
#                 return False
#         else:
#             if task and (task.status not in ['PROGRESS','Processing','Knockdown Analysis']):
#                 GLOBALS.mutex.pop(task_id, None)

#         # if user_id:
#         #     user = db.session.query(User).get(user_id)
#         #     if user:
#         #         if user_id not in GLOBALS.mutex[task_id]['user'].keys():
#         #             if user.passed not in ['cTrue', 'cFalse', 'true', 'false']:
#         #                 GLOBALS.mutex[task_id]['user'][user_id] = threading.Lock()
#         #             else:
#         #                 return False
#         #         else:
#         #             if user.passed in ['cTrue', 'cFalse', 'true', 'false']:
#         #                 GLOBALS.mutex[task_id]['user'].pop(user_id, None)

#     except:
#         return False
   
#     return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def finish_knockdown(self,rootImageID, task, current_user_id, lastImageID=None):
    '''
    Celery task for marking a camera as knocked down. Combines all images into a new cluster, and reclusters the images from the other cameras.

        Parameters:
            rootImageID (int): The image viewed by the user when they marked a cluster as knocked down
            task (int/db object): The task being tagged
            current_user_id (int): The user who annotated the knock down
            lastImageID (int): The last image from the sequence that is known to be knocked down
    '''
    
    try:
        if Config.DEBUGGING: app.logger.info('Started finish_knockdown for image ' + str(rootImageID))

        task = db.session.query(Task).get(task)
        task_id = task.id

        # if celeryTask: populateMutex(task_id)

        rootImage = db.session.query(Image).get(rootImageID)
        trapgroup = db.session.query(Trapgroup).join(Camera).join(Image).filter(Image.id==rootImageID).first()
        trapgroup_id = trapgroup.id
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

        # if celeryTask and (task_id in GLOBALS.mutex.keys()):
        #     GLOBALS.mutex[task_id]['trapgroup'][trapgroup_id].acquire()
        #     # db.session.commit()

        if Config.DEBUGGING: app.logger.info('Continuing finish_knockdown for image ' + str(rootImageID))

        trapgroup.processing = True
        trapgroup.active = False
        trapgroup.user_id = None
        db.session.commit()

        # if celeryTask and (task_id in GLOBALS.mutex.keys()):
        #     GLOBALS.mutex[task_id]['trapgroup'][trapgroup_id].release()

        cluster = Cluster(user_id=current_user_id, labels=[downLabel], timestamp=datetime.utcnow(), task=task)
        db.session.add(cluster)

        #Move images to new cluster
        images = db.session.query(Image) \
                        .join(Camera) \
                        .filter(Camera.cameragroup_id==rootImage.camera.cameragroup_id) \
                        .filter(Image.corrected_timestamp >= rootImage.corrected_timestamp)

        if lastImageID:
            lastImage = db.session.query(Image).get(lastImageID)
            images = images.filter(Image.corrected_timestamp <= lastImage.corrected_timestamp)

        imageSQ = images.subquery()
        images = images.distinct().all() 
        cluster.images = images

        from app.functions.imports import classifyCluster
        cluster.classification = classifyCluster(cluster)

        labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task==task)\
                                .all()

        for labelgroup in labelgroups:
            labelgroup.labels = [downLabel]

        # db.session.commit()

        if not lastImageID:
            lastImage = db.session.query(Image).join(Camera).filter(Camera.cameragroup_id==rootImage.camera.cameragroup_id).order_by(desc(Image.corrected_timestamp)).first()

        old_clusters = db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .join(Camera) \
                            .filter(Camera.trapgroup_id == trapgroup_id) \
                            .filter(Image.corrected_timestamp >= rootImage.corrected_timestamp) \
                            .filter(Image.corrected_timestamp <= lastImage.corrected_timestamp) \
                            .filter(Cluster.task == task) \
                            .distinct() \
                            .all()

        recluster_ims = db.session.query(Image) \
                            .outerjoin(imageSQ, Image.id == imageSQ.c.id) \
                            .filter(imageSQ.c.id == None) \
                            .filter(Image.clusters.any(Cluster.id.in_([r.id for r in old_clusters]))) \
                            .order_by(Image.corrected_timestamp) \
                            .distinct() \
                            .all()
        
        labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .outerjoin(imageSQ, Image.id == imageSQ.c.id) \
                            .filter(imageSQ.c.id == None) \
                            .filter(Image.clusters.any(Cluster.id.in_([r.id for r in old_clusters]))) \
                            .filter(Labelgroup.task==task)\
                            .distinct() \
                            .all()

        old_clusters.remove(cluster)

        for old_cluster in old_clusters:
            old_cluster.labels = []
            old_cluster.tags = []
            old_cluster.images = []
            old_cluster.required_images = []
            db.session.delete(old_cluster)

        for labelgroup in labelgroups:
            labelgroup.labels = []

        # db.session.commit()

        if len(recluster_ims) > 0:
            long_clusters = []
            clusterList = []
            prev = None    
            for image in recluster_ims:
                timestamp = image.corrected_timestamp
                if not (prev) or (timestamp - prev).total_seconds() > 60:
                    if prev is not None:
                        reCluster.images = imList
                        if (imList[-1].corrected_timestamp-imList[0].corrected_timestamp).total_seconds() > Config.MAX_CLUSTER_MINUTES * 60:
                            long_clusters.append(reCluster)
                        else:
                            clusterList.append(reCluster)
                        reCluster.classification = classifyCluster(reCluster)
                    reCluster = Cluster(task=task, timestamp=datetime.utcnow())
                    db.session.add(reCluster)
                    imList = []                 
                prev = timestamp
                imList.append(image)

            if imList:
                reCluster.images = imList
                if (imList[-1].corrected_timestamp-imList[0].corrected_timestamp).total_seconds() > Config.MAX_CLUSTER_MINUTES * 60:
                    long_clusters.append(reCluster)
                else:
                    clusterList.append(reCluster)
                reCluster.classification = classifyCluster(reCluster)
            
            db.session.commit()

            clusterList = [r.id for r in clusterList]

            if long_clusters:
                from app.functions.imports import recluster_large_clusters
                newClusters = recluster_large_clusters(task_id,True,None,[r.id for r in long_clusters])
                clusterList.extend(newClusters)

            if clusterList: classifyTask(task_id,clusterList)

        #Reactivate trapgroup
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)

        if trapgroup.queueing:
            trapgroup.queueing = False
            db.session.commit()
            unknock_cluster.apply_async(kwargs={'image_id':int(rootImageID), 'label_id':None, 'user_id':current_user_id, 'task_id':task_id})
        else:
            re_evaluate_trapgroup_examined(trapgroup_id,task_id)
            trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
            trapgroup.active = True
            trapgroup.processing = False
            GLOBALS.redisClient.lrem('trapgroups_'+str(trapgroup.survey_id),0,trapgroup.id)
            GLOBALS.redisClient.rpush('trapgroups_'+str(trapgroup.survey_id),trapgroup.id)                 
            db.session.commit()

        if Config.DEBUGGING: app.logger.info('Completed finish_knockdown for image ' + str(rootImageID))

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

@celery.task(bind=True,max_retries=5,ignore_result=True)
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
        if Config.DEBUGGING: app.logger.info('Started unknock_cluster for cluster ' + str(image_id))

        image = db.session.query(Image).get(image_id)
        cluster = db.session.query(Cluster).filter(Cluster.task_id == task_id).filter(Cluster.images.contains(image)).first()
        trapgroup = image.camera.trapgroup
        trapgroup_id = trapgroup.id
        
        # populateMutex(int(task_id))

        # if int(task_id) in GLOBALS.mutex.keys():
        #     GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].acquire()
        #     db.session.commit()

        #Checkout tg
        trapgroup.processing = True
        trapgroup.active = False
        trapgroup.user_id = None
        db.session.commit()

        # if int(task_id) in GLOBALS.mutex.keys():
        #     GLOBALS.mutex[int(task_id)]['trapgroup'][trapgroup_id].release()

        cluster.labels = []
        cluster.user_id = None

        #Recluster entire trapgroup
        rootImage = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).first()
        lastImage = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.corrected_timestamp)).first()
        default_task = db.session.query(Task).filter(Task.name=='default').filter(Task.survey_id==cluster.task.survey_id).first()
        nothingLabel = db.session.query(Label).get(GLOBALS.nothing_id)
        rootImage_id = rootImage.id

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
        admin = db.session.query(User).filter(User.username == 'Admin').first()
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

            # strip labels that are AI-generated or empty as they could now be wrong
            labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .join(Cluster,Image.clusters)\
                            .filter(Cluster.user_id==admin.id)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(Labelgroup.task_id==task_id)\
                            .filter(Image.id.in_([r.id for r in new_cluster.images]))\
                            .distinct().all()

            for labelgroup in labelgroups:
                labelgroup.labels = []

            # copy across human-annotated labels
            labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .filter(Image.clusters.contains(newCluster))\
                            .filter(Labelgroup.task_id==task_id)\
                            .all()
            
            labels = db.session.query(Label)\
                            .join(Labelgroup,Label.labelgroups)\
                            .join(Detection)\
                            .join(Image)\
                            .filter(Labelgroup.task_id==task_id)\
                            .filter(Image.clusters.contains(newCluster))\
                            .distinct().all()

            # Drop nothing and knocked down labels
            if nothingLabel in labels: labels.remove(nothingLabel)
            if downLabel in labels: labels.remove(downLabel)

            newCluster.labels = labels
            for labelgroup in labelgroups:
                labelgroup.labels = labels
                labelgroup.checked = False

        # Remove the re-allocated images from their old clusters & delete the clusters if they are now empty
        for old_cluster in old_clusters:
            for image in reAllocated:
                if image in old_cluster.images[:]:
                    old_cluster.images.remove(image)

            if len(old_cluster.images[:]) == 0:
                db.session.delete(old_cluster)

        db.session.commit()
        clusterList = [r.id for r in clusterList]
        classifyTask(task_id,clusterList)

        #Add label to original cluster
        if label_id != None:
            rootImage = db.session.query(Image).get(rootImage_id)
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
            # db.session.commit()

        #reactivate trapgroup
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        
        if trapgroup.queueing:
            trapgroup.queueing = False
            finish_knockdown.apply_async(kwargs={'rootImageID':rootImage.id, 'task':task_id, 'current_user_id':user_id})
        else:
            re_evaluate_trapgroup_examined(trapgroup_id,task_id)
            trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
            trapgroup.active = True
            trapgroup.processing = False
        db.session.commit()

        if Config.DEBUGGING: app.logger.info('Completed unknock_cluster for cluster ' + str(image_id))

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

@celery.task(bind=True,max_retries=5)
def classifyTask(self,task,reClusters=None,trapgroup_ids=None):
    '''
    Auto-classifies and labels the species contained in each cluster of a specified task, based on the species selected by the user. Can be given a specific subset of 
    clusters to classify.
    '''
    
    try:
        app.logger.info('Classifying task '+str(task))

        if type(task) == int:
            task = db.session.query(Task).get(task)

        admin = db.session.query(User).filter(User.username == 'Admin').first()
        parentLabel = task.parent_classification
        survey_id = task.survey_id
        classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==task.id).first()[0]
        dataType = db.session.query(Survey.type).join(Task).filter(Task.id==task.id).first()[0]

        api_check = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Detection.source=='api').first()
        if api_check:
            #Handle API added labels
            api_user = db.session.query(User).filter(User.username == 'API').first()
            api_clusters = db.session.query(Cluster)\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .filter(Labelgroup.task==task)\
                                    .filter(Labelgroup.labels.any())\
                                    .filter(Cluster.task==task)\
                                    .filter(Detection.source=='api')\
                                    .filter(Detection.static==False)\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .filter(~Cluster.labels.any())\

            if trapgroup_ids: api_clusters = api_clusters.join(Camera).filter(Camera.trapgroup_id.in_(trapgroup_ids))
            if reClusters: api_clusters = api_clusters.filter(Cluster.id.in_(reClusters))

            api_clusters = api_clusters.distinct().all()

            for cluster in api_clusters:
                labels = db.session.query(Label).join(Labelgroup, Label.labelgroups).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task==task).filter(or_(Label.task==task,Label.task==None)).distinct().all()
                for label in labels:
                    if label not in cluster.labels: 
                        cluster.labels.append(label)
                        cluster.user_id = api_user.id
                        cluster.timestamp = datetime.utcnow()


        totalDetSQ = db.session.query(Cluster.id.label('clusID'), func.count(distinct(Detection.id)).label('detCountTotal')) \
                                .join(Image, Cluster.images) \
                                .join(Detection) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                                .filter(Cluster.task==task) \
                                .group_by(Cluster.id).subquery()

        parentGroupings = {}
        labelGroupings = db.session.query(Label).join(Translation).filter(Translation.task==task).filter(Translation.auto_classify==True).distinct().all()
        for label in labelGroupings:
            classifications = [r[0] for r in db.session.query(Translation.classification).filter(Translation.task==task).filter(Translation.auto_classify==True).filter(Translation.label_id==label.id).all()]
            if parentLabel:
                if label.parent_id != None:
                    label = label.parent
            if label not in parentGroupings.keys():
                parentGroupings[label] = classifications
            else:
                parentGroupings[label].extend(classifications)

        if Config.DEBUGGING: app.logger.info('Groupings prepped for task '+str(task))

        for species in parentGroupings:

            detCountSQ = db.session.query(Cluster.id.label('clusID'), func.count(distinct(Detection.id)).label('detCount')) \
                                .join(Image, Cluster.images) \
                                .join(Detection) \
                                .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                .filter(ClassificationLabel.classifier_id==classifier_id) \
                                .filter(Detection.class_score>ClassificationLabel.threshold) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                                .filter(Detection.classification.in_(parentGroupings[species])) \
                                .filter(Cluster.task==task) \
                                .group_by(Cluster.id).subquery()

            # detCountSQ = db.session.query(Cluster.id.label('clusID'), func.count(distinct(Detection.id)).label('detCount')) \
            #                     .join(Image, Cluster.images) \
            #                     .join(Camera)\
            #                     .join(Trapgroup)\
            #                     .join(Survey)\
            #                     .join(Classifier)\
            #                     .join(Detection) \
            #                     .filter(Detection.class_score>Classifier.threshold) \
            #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
            #                     .filter(Detection.static == False) \
            #                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
            #                     .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
            #                     .filter(Detection.classification.in_(parentGroupings[species])) \
            #                     .filter(Cluster.task==task) \
            #                     .group_by(Cluster.id).subquery()

            detRatioSQ = db.session.query(Cluster.id.label('clusID'), (detCountSQ.c.detCount/totalDetSQ.c.detCountTotal).label('detRatio')) \
                                .join(detCountSQ, detCountSQ.c.clusID==Cluster.id) \
                                .join(totalDetSQ, totalDetSQ.c.clusID==Cluster.id) \
                                .filter(Cluster.task==task) \
                                .subquery()

            clusters = db.session.query(Cluster) \
                                .join(detCountSQ, detCountSQ.c.clusID==Cluster.id) \
                                .join(detRatioSQ, detRatioSQ.c.clusID==Cluster.id) \
                                .filter(Cluster.task==task)\
                                .filter(or_(Cluster.user_id==None, Cluster.user_id==admin.id))
                                
            if dataType == 'trails':
                clusters = clusters.filter(detCountSQ.c.detCount >= Config.CLUSTER_DET_COUNT['trails']).filter(detRatioSQ.c.detRatio > Config.DET_RATIO['trails'])
            else:
                clusters = clusters.filter(
                                or_(
                                    and_(
                                        detCountSQ.c.detCount >= Config.CLUSTER_DET_COUNT['trails'],
                                        detRatioSQ.c.detRatio > Config.DET_RATIO['trails']),
                                    and_(
                                        detCountSQ.c.detCount >= Config.CLUSTER_DET_COUNT[dataType],
                                        detRatioSQ.c.detRatio > Config.DET_RATIO[dataType])
                                ))

            if trapgroup_ids: clusters = clusters.join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup_id.in_(trapgroup_ids))
            if reClusters: clusters = clusters.filter(Cluster.id.in_(reClusters))

            clusters = clusters.distinct().all()

            # for chunk in chunker(clusters,1000):
            for cluster in clusters:
                if species not in cluster.labels: cluster.labels.append(species)
                cluster.user_id = admin.id
                cluster.timestamp = datetime.utcnow()

                labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task==task).all()
                for labelgroup in labelgroups:
                    if species not in labelgroup.labels: labelgroup.labels.append(species)
        
        db.session.commit()
        app.logger.info('Finished classifying task '+str(task))

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

def update_label_ids():
    ''' Updates the default label IDs in the globals. '''

    try:
        nothing = db.session.query(Label).filter(Label.description=='Nothing').first()
        knockdown = db.session.query(Label).filter(Label.description=='Knocked Down').first()
        vehicles = db.session.query(Label).filter(Label.description=='Vehicles/Humans/Livestock').first()
        unknown = db.session.query(Label).filter(Label.description=='Unknown').first()
        wrong = db.session.query(Label).filter(Label.description=='Wrong').first()
        remove_false_detections = db.session.query(Label).filter(Label.description=='Remove False Detections').first()
        mask_area = db.session.query(Label).filter(Label.description=='Mask Area').first()

        GLOBALS.nothing_id = nothing.id
        GLOBALS.knocked_id = knockdown.id
        GLOBALS.vhl_id = vehicles.id
        GLOBALS.unknown_id = unknown.id
        GLOBALS.wrong_id = wrong.id
        GLOBALS.remove_false_detections_id = remove_false_detections.id
        GLOBALS.mask_area_id = mask_area.id
        app.logger.info('Global label IDs updated')

    except:
        pass

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
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
        images = db.session.query(Image).filter(Image.corrected_timestamp!=None).filter(Image.clusters.contains(oldCluster)).order_by(Image.corrected_timestamp).all()

        newCluster.images = images[SplitPoint:]
        oldCluster.images = images[:SplitPoint]

        from app.functions.imports import classifyCluster
        newCluster.classification = classifyCluster(newCluster)
        oldCluster.classification = classifyCluster(oldCluster)
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

    countdown = int(60*4**(random.uniform(retries-0.5,retries+0.5)))
    if countdown > 3600: countdown=3600
    return countdown

def createTurkcodes(number_of_workers, task_id, session):
    '''Creates requested number of turkcodes (jobs) for the specified task'''
    
    user_ids = []
    for n in range(number_of_workers):
        user_ids.append(randomString(24))

    turkcodes = []
    checks = [r[0] for r in session.query(Turkcode.code).filter(Turkcode.code.in_(user_ids)).all()]
    for user_id in user_ids:
        if user_id not in checks:
            turkcode = Turkcode(code=user_id, task_id=task_id, active=True)
            session.add(turkcode)
            turkcodes.append({'user_id':user_id})
            GLOBALS.redisClient.sadd('job_pool_'+str(task_id),turkcode.code)

    return turkcodes

def deleteTurkcodes(number_of_jobs, task_id):
    '''Deletes the specified number of turkcodes (jobs) for the specified task'''
    
    # if not populateMutex(int(task_id)): return False

    session = db.session()
    for n in range(number_of_jobs):
        code = GLOBALS.redisClient.spop('job_pool_'+str(task_id))
        if code:
            turkcode = session.query(Turkcode).filter(Turkcode.code==code).first()
            session.delete(turkcode)
    session.commit()
    session.close()

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def updateAllStatuses(self,task_id,status=False):
    '''Updates the completion status of all parent labels of a specified task.'''

    try:
        updateTaskCompletionStatus(task_id)
        updateLabelCompletionStatus(task_id)
        updateIndividualIdStatus(task_id)
        updateEarthRanger(task_id)

        if status:
            task = db.session.query(Task).get(task_id)
            task.status = 'Ready'
            db.session.commit()

        try:
            GLOBALS.redisClient.delete('updateAllStatuses_'+str(task_id))
            GLOBALS.redisClient.srem('tasks_to_update_status',task_id)
        except:
            pass

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

def updateLabelCompletionStatus(task_id):
    '''Updates the completion status of all parent labels of a specified task.'''

    task = db.session.query(Task).get(task_id)
    for label in task.labels:
        label.cluster_count = db.session.query(Cluster)\
                        .join(Image,Cluster.images)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .filter(Labelgroup.task_id==int(task_id))\
                        .filter(Cluster.task_id==int(task_id))\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                        .distinct().count()
        if label.cluster_count == 0:
            label.complete = True
        else:
            label.complete = False     

        # Bounding
        label.bounding_count = db.session.query(Labelgroup) \
                            .join(Detection) \
                            .filter(Labelgroup.task_id==task_id) \
                            .filter(Labelgroup.labels.contains(label)) \
                            .filter(Labelgroup.checked==False) \
                            .filter(Detection.static==False) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .distinct().count()

        # Info tagging
        label.info_tag_count = db.session.query(Cluster)\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .filter(Labelgroup.task_id==int(task_id))\
                            .filter(Cluster.task_id==int(task_id))\
                            .filter(Labelgroup.labels.contains(label))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(~Labelgroup.tags.any())\
                            .distinct().count() 

        # sq = db.session.query(Cluster)\
        #                 .join(Translation,Cluster.classification==Translation.classification)\
        #                 .filter(Translation.label_id==label.id)\
        #                 .filter(Cluster.task==task)

        # sq = taggingLevelSQ(sq,'-3',False,task.id)

        # label.potential_clusters = sq.distinct().count() 
        
        label.image_count = db.session.query(Image)\
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                        .filter(Detection.static==False)\
                                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .distinct().count()

        label.sighting_count = db.session.query(Labelgroup)\
                                        .join(Detection)\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                        .filter(Detection.static==False)\
                                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                        .distinct().count()

    #Also update the number of clusters requiring a classification check
    task = db.session.query(Task).get(task_id)

    count = db.session.query(Cluster).filter(Cluster.task_id==task_id)
    count = taggingLevelSQ(count,'-3',False,task_id)
    task.class_check_count = count.distinct().count()

    count = db.session.query(Cluster).filter(Cluster.task_id==task_id)
    count = taggingLevelSQ(count,'-8',False,task_id)
    task.related_check_count = count.distinct().count()

    db.session.commit()

    return True

def resolve_abandoned_jobs(abandoned_jobs,session=None):
    '''Cleans up jobs that have been abandoned.'''

    if session==None:
        session = db.session()
    
    for item in abandoned_jobs:
        user = item[0]
        task = item[1]

        # if ('-4' in task.tagging_level) and (task.survey.status=='indprocessing'):
        #     if Config.DEBUGGING: app.logger.info('Triggering individual similarity calculation for user {}'.format(user.parent.username))
        #     from app.functions.individualID import calculate_individual_similarities
        #     calculate_individual_similarities.delay(task_id=task.id,species=re.split(',',task.tagging_level)[1],user_ids=[user.id])
        
        if '-5' in task.tagging_level:
            #flush allocations
            userIndividuals = [int(r.decode()) for r in GLOBALS.redisClient.lrange('user_individuals_'+str(user.id),0,-1)]
            for userIndividual in userIndividuals:
                GLOBALS.redisClient.srem('active_individuals_'+str(task.id),userIndividual)
            GLOBALS.redisClient.delete('user_individuals_'+str(user.id))

            userIndSims = [int(r.decode()) for r in GLOBALS.redisClient.lrange('user_indsims_'+str(user.id),0,-1)]
            for userIndSim in userIndSims:
                GLOBALS.redisClient.srem('active_indsims_'+str(task.id),userIndSim)
            GLOBALS.redisClient.delete('user_indsims_'+str(user.id))

        else:
            for trapgroup in user.trapgroup:
                trapgroup.user_id = None
                if trapgroup.active:
                    GLOBALS.redisClient.lrem('trapgroups_'+str(task.survey_id),0,trapgroup.id)
                    GLOBALS.redisClient.rpush('trapgroups_'+str(task.survey_id),trapgroup.id)

        # user.trapgroup = []
        # user.passed = 'cFalse'
        GLOBALS.redisClient.srem('active_jobs_'+str(task.id),user.turkcode[0].code)

        GLOBALS.redisClient.delete('clusters_allocated_'+str(user.id))

        # if task.id in GLOBALS.mutex.keys():
        #     GLOBALS.mutex[task.id]['user'].pop(user.id, None)
            
    # session.commit()

    return True

def coordinateDistance(lat1,lon1,lat2,lon2):
    '''Returns the distance (km) between two coordinate points (km).'''

    try:
        a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(math.radians(lon2-lon1)/2)**2    
        distance = 6371 * 2 * math.atan2(a**0.5, (1-a)**0.5)
    except:
        distance = 0
    
    return distance

def checkForIdWork(task_ids,label,theshold):
    '''Returns the number of individuals that need to be examined during inter-cluster indentification for the specified task and label.'''

    OtherIndividual = alias(Individual)
    if theshold=='-1': theshold=0 #theshold=Config.SIMILARITY_SCORE

    relevant_detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .join(Trapgroup)\
                                    .join(Survey)\
                                    .join(Task)\
                                    .filter(Task.id.in_(task_ids))\
                                    .subquery()
    
    relevant_individuals = db.session.query(Individual)\
                                    .join(Detection,Individual.detections)\
                                    .join(relevant_detections,relevant_detections.c.id==Detection.id)\
                                    .filter(Individual.species==label)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .subquery()
    
    relevant_individuals2 = db.session.query(Individual)\
                                    .join(Detection,Individual.detections)\
                                    .join(relevant_detections,relevant_detections.c.id==Detection.id)\
                                    .filter(Individual.species==label)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .subquery()

    sq1 = db.session.query(Individual.id.label('indID1'))\
                    .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                    .join(relevant_individuals,relevant_individuals.c.id==Individual.id)\
                    .join(relevant_individuals2,relevant_individuals2.c.id==OtherIndividual.c.id)\
                    .filter(IndSimilarity.score>=theshold)\
                    .filter(IndSimilarity.skipped==False)\
                    .group_by(Individual.id)\
                    .subquery()

    sq2 = db.session.query(Individual.id.label('indID2'))\
                    .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                    .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                    .join(relevant_individuals,relevant_individuals.c.id==Individual.id)\
                    .join(relevant_individuals2,relevant_individuals2.c.id==OtherIndividual.c.id)\
                    .filter(IndSimilarity.score>=theshold)\
                    .filter(IndSimilarity.skipped==False)\
                    .group_by(Individual.id)\
                    .subquery()

    num_individuals = db.session.query(Individual)\
                    .join(Task,Individual.tasks)\
                    .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                    .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                    .filter(Task.id.in_(task_ids))\
                    .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
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

def getChildNameList(label,task_id):
    '''Returns a list of all child label descriptions for the specified label for the specified task.'''

    children = db.session.query(Label).filter(Label.parent_id==label.id).filter(Label.task_id==task_id).all()
    label_list = []
    for lab in children:
        label_list.append(lab.description)
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
        if (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.static == False) and (detection.status not in Config.DET_IGNORE_STATUSES) and (detection.classification!=None):
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
            sq = sq.join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(~Labelgroup.labels.any())
    elif (taggingLevel == '-2'):
        # info tagging
        sq = sq.join(Labelgroup)\
                .filter(Labelgroup.task_id==task_id)\
                .filter(Labelgroup.labels.any()) \
                .join(Label,Labelgroup.labels) \
                .filter(~Label.id.in_([GLOBALS.nothing_id,GLOBALS.knocked_id])) \
                .filter(Cluster.skipped==False)
                # .filter(~Cluster.tags.any())                                    
                # .filter(~Cluster.labels.contains(db.session.query(Label).get(GLOBALS.vhl_id))) \
    elif (taggingLevel == '-3'):
        # Classifier checking
        downLabel = db.session.query(Label).get(GLOBALS.vhl_id)
        classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==task_id).first()[0]
        dataType = db.session.query(Survey.type).join(Task).filter(Task.id==task_id).first()[0]

        classificationSQ = db.session.query(Cluster.id.label('cluster_id'),Detection.classification.label('classification'),func.count(distinct(Detection.id)).label('count'))\
                                .join(Image,Cluster.images)\
                                .join(Detection)\
                                .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                .join(Translation,Translation.classification==Detection.classification)\
                                .filter(Translation.task_id==task_id)\
                                .filter(Translation.label_id!=GLOBALS.nothing_id)\
                                .filter(ClassificationLabel.classifier_id==classifier_id) \
                                .filter(Detection.class_score>ClassificationLabel.threshold) \
                                .filter(Cluster.task_id==task_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                                .group_by(Cluster.id,Detection.classification)\
                                .subquery()

        # classificationSQ = db.session.query(Cluster.id.label('cluster_id'),Detection.classification.label('classification'),func.count(distinct(Detection.id)).label('count'))\
        #                         .join(Image,Cluster.images)\
        #                         .join(Camera)\
        #                         .join(Trapgroup)\
        #                         .join(Survey)\
        #                         .join(Classifier)\
        #                         .join(Detection)\
        #                         .filter(Cluster.task_id==task_id)\
        #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
        #                         .filter(Detection.static == False) \
        #                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
        #                         .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
        #                         .filter(Detection.class_score>Classifier.threshold) \
        #                         .group_by(Cluster.id,Detection.classification)\
        #                         .subquery()

        clusterDetCountSQ = db.session.query(Cluster.id.label('cluster_id'),func.count(Detection.id).label('count'))\
                                .join(Image,Cluster.images)\
                                .join(Detection)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
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
                                .filter((classificationSQ.c.count/clusterDetCountSQ.c.count)>Config.MIN_CLASSIFICATION_RATIO[dataType])\
                                .filter(classificationSQ.c.count>1)\
                                .filter(labelstableSQ.c.classification==None)\
                                .filter(~Cluster.labels.contains(downLabel))
        
    # elif (taggingLevel == '-6'):
    #     # NOTE: This is not currently used (is for check masked sightings)
    #     # Masked sightings
    #     sq = sq.join(Labelgroup).filter(Labelgroup.task_id==task_id).filter(Labelgroup.checked==False)

    elif (taggingLevel == '-7'):
        # Empty clusters
        cluster_sq = db.session.query(Cluster.id)\
                            .join(Image, Cluster.images)\
                            .join(Detection)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .distinct().subquery()  

        sq = sq.outerjoin(cluster_sq,Cluster.id==cluster_sq.c.id).filter(cluster_sq.c.id==None).join(Labelgroup).filter(Labelgroup.task_id==task_id).filter(Labelgroup.checked==False)

    elif (taggingLevel == '-8'):
        # Related cluster check
        clusterTimestampsSQ = db.session.query(\
                                Cluster.id.label('cluster_id'),\
                                func.min(Image.corrected_timestamp).label('start_time'),\
                                func.max(Image.corrected_timestamp).label('end_time'),\
                                Camera.trapgroup_id.label('trapgroup_id')\
                            )\
                            .join(Image,Cluster.images)\
                            .join(Camera)\
                            .filter(Cluster.task_id==task_id)\
                            .group_by(Cluster.id)\
                            .subquery()

        Cluster1 = alias(Cluster)
        Cluster2 = alias(Cluster)
        ClusterTimestampsSQ1 = alias(clusterTimestampsSQ)
        ClusterTimestampsSQ2 = alias(clusterTimestampsSQ)
        Labelstable2 = alias(labelstable)

        Labelstable1 = db.session.query(labelstable.c.cluster_id.label('cluster_id'),labelstable.c.label_id.label('label_id'),Label.parent_id.label('parent_id'))\
                    .join(Label,labelstable.c.label_id==Label.id)\
                    .subquery()

        relatedClustersSQ = db.session.query(Cluster1.c.id.label('cluster_id'))\
                                    .join(Task,Cluster1.c.task_id==Task.id)\
                                    .join(Cluster2,Cluster2.c.task_id==Task.id)\
                                    .join(ClusterTimestampsSQ1,ClusterTimestampsSQ1.c.cluster_id==Cluster1.c.id)\
                                    .join(ClusterTimestampsSQ2,ClusterTimestampsSQ2.c.cluster_id==Cluster2.c.id)\
                                    .join(Labelstable2,Labelstable2.c.cluster_id==Cluster2.c.id)\
                                    .outerjoin(Labelstable1,\
                                        (Labelstable1.c.cluster_id == Cluster1.c.id) & \
                                        ((Labelstable2.c.label_id == Labelstable1.c.label_id) | (Labelstable2.c.label_id==Labelstable1.c.parent_id)))\
                                    .filter(Task.id==task_id)\
                                    .filter(Cluster1.c.id!=Cluster2.c.id)\
                                    .filter(ClusterTimestampsSQ1.c.trapgroup_id==ClusterTimestampsSQ2.c.trapgroup_id)\
                                    .filter(or_(\
                                        func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.end_time, ClusterTimestampsSQ2.c.start_time)) < Config.RELATED_CLUSTER_TIME,\
                                        func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.start_time, ClusterTimestampsSQ2.c.end_time)) < Config.RELATED_CLUSTER_TIME\
                                    ))\
                                    .filter(Labelstable1.c.label_id.is_(None))\
                                    .filter(~Labelstable2.c.label_id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))\
                                    .group_by(Cluster1.c.id,Cluster2.c.id)\
                                    .subquery()

        sq = sq.join(relatedClustersSQ,relatedClustersSQ.c.cluster_id==Cluster.id)

    else:
        # Specific label levels
        if ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            species = tL[1]
            if species.isdigit():
                label = db.session.query(Label).get(species)
            else:
                if species=='Vehicles/Humans/Livestock':
                    label=db.session.query(Label).get(GLOBALS.vhl_id)
                else:
                    label = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.description==species).first()
            task = db.session.query(Task).get(task_id)
            
            if tL[0] == '-4':
                # Cluster-level individual ID
                # sq = sq.filter(Cluster.examined==False)

                individualsSQ = db.session.query(Individual)\
                                    .filter(Individual.species==label.description)\
                                    .filter(Individual.tasks.contains(task))\
                                    .subquery()

                sq = sq.join(Labelgroup)\
                        .outerjoin(individualsSQ,Detection.individuals)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(individualsSQ.c.id==None)

            elif tL[0] == '-2':
                # Species-level informational tagging
                sq = sq.join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(Cluster.skipped==False)

        # Species-level labelling
        else:
            label = db.session.query(Label).get(int(taggingLevel))
            if isBounding:
                sq = sq.join(Labelgroup).filter(Labelgroup.task_id==task_id).filter(Labelgroup.labels.contains(label)).filter(Labelgroup.checked==False)
            else:
                sq = sq.join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(label))\
                        .filter(Cluster.skipped==False)

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

@celery.task(bind=True,max_retries=5)
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

# @celery.task(bind=True,max_retries=5)
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

def save_crops(image_id,source,min_area,destBucket,external,update_image_info,label_source=None,task_id=None,check=False):
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
        if Config.DEBUGGING: print('Asserting image')
        assert image
        if Config.DEBUGGING: print('Success')

        if check:
            detection = rDets(db.session.query(Detection).filter(Detection.image_id==image_id)).first()
            key = image.camera.path+'/'+image.filename[:-4] + '_' + str(detection.id) + '.jpg'
            try:
                check = GLOBALS.s3client.head_object(Bucket=destBucket,Key=key)
                # it already exists: bail out
                return False
            except:
                pass

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
            if Config.DEBUGGING:print('Success')

            if Config.DEBUGGING: print('Opening image...')
            with pilImage.open(temp_file.name) as img:
                img.load()

            assert img
            if Config.DEBUGGING: print('Success')
                
            # always save as RGB for consistency
            if img.mode != 'RGB':
                if Config.DEBUGGING: print('Converting to RGB')
                img = img.convert(mode='RGB')

            if update_image_info:
                # Get image hash
                if Config.DEBUGGING: print('Updating image hash...')
                try:
                    image.etag = md5(temp_file.name)
                    image.hash = generate_raw_image_hash(temp_file.name)
                    db.session.commit()
                    if Config.DEBUGGING: print('Success')
                except:
                    print("Skipping {} could not generate hash...".format(image.camera.path+'/'+image.filename))

                # Attempt to extract and save timestamp
                if Config.DEBUGGING: print('Updating timestamp...')
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
                    if Config.DEBUGGING: print('Success')
                except:
                    if Config.DEBUGGING: print("Skipping {} could not extract EXIF timestamp...".format(image.camera.path+'/'+image.filename))

                # Extract exif labels
                if Config.DEBUGGING: print('Extracting Labels')
                if label_source:
                    try:
                        cluster = Cluster(task_id=task_id)
                        db.session.add(cluster)
                        cluster.images = [image]
                        if Config.DEBUGGING: print('Cluster created')
                        if label_source=='iptc':
                            print('type: iptc')
                            info = IPTCInfo(temp_file.name)
                            if Config.DEBUGGING: print('Info extracted')
                            labelgroups = []
                            for detection in image.detections:
                                labelgroup = Labelgroup(task_id=task_id,detection=detection)
                                db.session.add(labelgroup)
                                labelgroups.append(labelgroup)
                            for label_name in info['keywords']:
                                description = label_name.decode()
                                if Config.DEBUGGING: print('Handling label: {}'.format(description))
                                label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
                                if not label:
                                    if Config.DEBUGGING: print('Creating label')
                                    label = Label(description=description,task_id=task_id)
                                    db.session.add(label)
                                    db.session.commit()
                                cluster.labels.append(label)
                                for labelgroup in labelgroups:
                                    labelgroup.labels.append(label)
                                if Config.DEBUGGING: print('label added')
                        elif label_source=='path':
                            descriptions = [image.camera.path.split('/')[-1],image.camera.path.split('/')[-1]]
                            for description in descriptions:
                                if Config.DEBUGGING: print('Handling label: {}'.format(description))
                                label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
                                if not label:
                                    if Config.DEBUGGING: print('Creating label')
                                    label = Label(description=description,task_id=task_id)
                                    db.session.add(label)
                                    db.session.commit()
                                cluster.labels.append(label)
                                if Config.DEBUGGING: print('label added')
                        db.session.commit()
                        if Config.DEBUGGING: print('Success')
                    except:
                        if Config.DEBUGGING: print("Skipping {} could not extract labels...".format(image.camera.path+'/'+image.filename))

            # crop the detections if they have sufficient area and score
            if Config.DEBUGGING: print('Cropping detections...')
            for detection in image.detections:
                area = (detection.right-detection.left)*(detection.bottom-detection.top)
                
                if (area > min_area) and (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]):
                    key = image.camera.path+'/'+image.filename[:-4] + '_' + str(detection.id) + '.jpg'
                    bbox = [detection.left,detection.top,(detection.right-detection.left),(detection.bottom-detection.top)]
                    if Config.DEBUGGING: print('Crropping detection {} on image {}'.format(bbox,key))
                    save_crop(img, bbox_norm=bbox, square_crop=True, bucket=destBucket, key=key)
                    if Config.DEBUGGING: print('Success')
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

def list_all(bucket,prefix,include_size=False,include_restored=False,include_all=False):
    """list_all is just a thin wrapper around list_objects_v2 to remove the limitation that only the first 1000 objects
    are returned. list_all will call list_objects_v2 as many times as required in order to return all the results."""

    prefixes=[]
    contents=[]
    resp = GLOBALS.s3client.list_objects_v2(Bucket=bucket, Delimiter='/',Prefix=prefix, OptionalObjectAttributes=['RestoreStatus'])
    lp=len(prefix)
    while True:
        if 'CommonPrefixes' in resp.keys():
            prefixes+=[p['Prefix'][lp:-1] for p in resp['CommonPrefixes']]
        if 'Contents' in resp.keys():
            # contents += [f['Key'].split('/')[-1] for f in resp['Contents']]
            for f in resp['Contents']:
                if include_all:
                    if include_size:
                        contents.append((f['Key'].split('/')[-1],f['Size']))
                    else:
                        contents.append(f['Key'].split('/')[-1])
                else:
                    if 'STANDARD' in f['StorageClass']:
                        if include_size:
                            contents.append((f['Key'].split('/')[-1],f['Size']))
                        else:
                            contents.append(f['Key'].split('/')[-1])
                    else:
                        if include_restored:
                            if 'RestoreStatus' in f.keys() and 'RestoreExpiryDate' in f['RestoreStatus'].keys():
                                if include_size:
                                    contents.append((f['Key'].split('/')[-1],f['Size']))
                                else:
                                    contents.append(f['Key'].split('/')[-1])
        if resp['IsTruncated']:
            resp = GLOBALS.s3client.list_objects_v2(Bucket=bucket, Delimiter='/',Prefix=prefix, ContinuationToken=resp['NextContinuationToken'], OptionalObjectAttributes=['RestoreStatus'])
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
        last_aurora_request = GLOBALS.redisClient.get('last_aurora_request')
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
                GLOBALS.redisClient.set('last_aurora_request',round((datetime.utcnow()-datetime(1970, 1, 1)).total_seconds()))

                # Increment the request count
                aurora_request_count = GLOBALS.redisClient.get('aurora_request_count')
                if not aurora_request_count:
                    aurora_request_count = 0
                else:
                    aurora_request_count = int(aurora_request_count.decode())
                aurora_request_count += 1
                GLOBALS.redisClient.set('aurora_request_count',aurora_request_count)

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
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                    .distinct().all()

    # for chunk in chunker(clusters,2500):
    for cluster in clusters:
        cluster.examined = False
        cluster.required_images = []
    db.session.commit()

    if not (any(item in task.tagging_level for item in ['-4','-5','-7']) or task.is_bounding):
        prep_required_images(task_id,trapgroup_id)
        db.session.commit()

    return True

def getClusterClassifications(cluster_id):
    '''Returns an ordered list of classifications for a given cluster along with their respective ratio of detections.'''
    
    startTime=time.time()
    cluster = db.session.query(Cluster).get(cluster_id)
    task = cluster.task
    classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==cluster.task_id).first()[0]
    dataType = db.session.query(Survey.type).join(Task).filter(Task.id==cluster.task_id).first()[0]
    
    classSQ = db.session.query(Label.id.label('label_id'),func.count(distinct(Detection.id)).label('count'))\
                            .join(Translation)\
                            .join(Detection,Detection.classification==Translation.classification)\
                            .join(Image)\
                            .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                            .filter(ClassificationLabel.classifier_id==classifier_id) \
                            .filter(Detection.class_score>ClassificationLabel.threshold) \
                            .filter(Translation.task==task)\
                            .filter(Image.clusters.contains(cluster))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                            .group_by(Label.id)\
                            .subquery()
    
    # classSQ = db.session.query(Label.id.label('label_id'),func.count(distinct(Detection.id)).label('count'))\
    #                         .join(Translation)\
    #                         .join(Detection,Detection.classification==Translation.classification)\
    #                         .join(Image)\
    #                         .join(Camera)\
    #                         .join(Trapgroup)\
    #                         .join(Survey)\
    #                         .join(Classifier)\
    #                         .filter(Translation.task==task)\
    #                         .filter(Image.clusters.contains(cluster))\
    #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
    #                         .filter(Detection.static == False) \
    #                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
    #                         .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
    #                         .filter(Detection.class_score>Classifier.threshold) \
    #                         .group_by(Label.id)\
    #                         .subquery()
    
    clusterDetCount = db.session.query(Detection)\
                            .join(Image)\
                            .filter(Image.clusters.contains(cluster))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                            .distinct().count()

    possibilities = [r[0] for r in db.session.query(Label.id)\
                            .join(classSQ,classSQ.c.label_id==Label.id)\
                            .filter(classSQ.c.count/clusterDetCount>=Config.MIN_CLASSIFICATION_RATIO[dataType])\
                            .filter(classSQ.c.count>1)\
                            .distinct().all()]
    
    classifications = db.session.query(Label.description,classSQ.c.count/clusterDetCount)\
                            .join(classSQ,classSQ.c.label_id==Label.id)\
                            .filter(classSQ.c.count/clusterDetCount>=Config.MIN_CLASSIFICATION_RATIO[dataType])\
                            .filter(classSQ.c.count>1)\
                            .filter(or_(~Label.parent_id.in_(possibilities),Label.parent_id==None))\
                            .filter(~Label.clusters.contains(cluster))\
                            .order_by(classSQ.c.count.desc())\
                            .distinct().all()
    
    classifications = [[item[0],float(item[1])] for item in classifications]
    
    if Config.DEBUGGING: print('Cluster classifications fetched in {}'.format(time.time()-startTime))
    
    return classifications

def getRelatedClusterLabels(cluster_id):
    '''Returns all the labels from related clusters that are not associated with the current cluster.'''

    cluster = db.session.query(Cluster).get(cluster_id)

    clusterTimestampsSQ = db.session.query(\
                                        Cluster.id.label('cluster_id'),\
                                        func.min(Image.corrected_timestamp).label('start_time'),\
                                        func.max(Image.corrected_timestamp).label('end_time'),\
                                        Camera.trapgroup_id.label('trapgroup_id')\
                                    )\
                                    .join(Image,Cluster.images)\
                                    .join(Camera)\
                                    .filter(Cluster.task_id==cluster.task_id)\
                                    .group_by(Cluster.id)\
                                    .subquery()

    Cluster1 = alias(Cluster)
    Cluster2 = alias(Cluster)
    ClusterTimestampsSQ1 = alias(clusterTimestampsSQ)
    ClusterTimestampsSQ2 = alias(clusterTimestampsSQ)
    Labelstable2 = alias(labelstable)
    Label2 = alias(Label)

    Labelstable1 = db.session.query(labelstable.c.cluster_id.label('cluster_id'),labelstable.c.label_id.label('label_id'),Label.parent_id.label('parent_id'))\
                    .join(Label,labelstable.c.label_id==Label.id)\
                    .subquery()

    labels = db.session.query(Cluster1.c.id,func.group_concat(Label2.c.description))\
                                .join(Task,Cluster1.c.task_id==Task.id)\
                                .join(Cluster2,Cluster2.c.task_id==Task.id)\
                                .join(ClusterTimestampsSQ1,ClusterTimestampsSQ1.c.cluster_id==Cluster1.c.id)\
                                .join(ClusterTimestampsSQ2,ClusterTimestampsSQ2.c.cluster_id==Cluster2.c.id)\
                                .join(Labelstable2,Labelstable2.c.cluster_id==Cluster2.c.id)\
                                .join(Label2,Label2.c.id==Labelstable2.c.label_id)\
                                .outerjoin(Labelstable1,\
                                    (Labelstable1.c.cluster_id == Cluster1.c.id) & \
                                    ((Labelstable2.c.label_id == Labelstable1.c.label_id) | (Labelstable2.c.label_id==Labelstable1.c.parent_id)))\
                                .filter(Task.id==cluster.task_id)\
                                .filter(Cluster1.c.id!=Cluster2.c.id)\
                                .filter(ClusterTimestampsSQ1.c.trapgroup_id==ClusterTimestampsSQ2.c.trapgroup_id)\
                                .filter(or_(\
                                    func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.end_time, ClusterTimestampsSQ2.c.start_time)) < Config.RELATED_CLUSTER_TIME,\
                                    func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.start_time, ClusterTimestampsSQ2.c.end_time)) < Config.RELATED_CLUSTER_TIME\
                                ))\
                                .filter(Labelstable1.c.label_id.is_(None))\
                                .filter(~Labelstable2.c.label_id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))\
                                .filter(Cluster1.c.id==cluster_id)\
                                .group_by(Cluster1.c.id,Cluster2.c.id)\
                                .distinct().all()

    result = []
    for row in labels:
        if row[1]:
            result.extend([[label,1] for label in row[1].split(',') if [label,1] not in result])

    return result

def checkFile(file,folder):
    '''Checks if a file exists in S3. Returns the filename if it does and None otherwise.'''
    try:
        if Config.DEBUGGING: print('checking {}'.format(folder + '/' + file))
        check = GLOBALS.s3client.head_object(Bucket=Config.BUCKET,Key=folder + '/' + file)
        return file
    except:
        if Config.DEBUGGING: print('{} does not exist'.format(folder + '/' + file))
        # file does not exist
        return None

def checkFileExist(file,folder):
    '''Checks if a file exists in db & s3. Returns the filename if it does and None otherwise.'''
    try:
        filename = file['name']
        hash = file['hash']
        common_path = folder + '/' + filename.split('/')[0] + '/%' 
        common_path = common_path.replace('_','\\_')

        if Config.DEBUGGING: app.logger.info('checking {} with hash {}'.format(folder + '/' + filename,hash))

        if hash == '' or hash == None or len(hash) < 32:
            if Config.DEBUGGING: app.logger.info('{} does not have a hash'.format(folder + '/' + filename))
            return filename, False

        if re.compile('(\.jpe?g$)|(_jpe?g$)', re.I).search(filename):
            check = db.session.query(Image).join(Camera).filter(Image.hash==hash).filter(Camera.path.like(common_path)).first()
        elif re.compile('(\.avi$)|(\.mp4$)|(\.mov$)', re.I).search(filename):
            check = db.session.query(Video).join(Camera).filter(Video.hash==hash).filter(Camera.path.like(common_path)).first()

        if check:
            if Config.DEBUGGING: app.logger.info('{} exists in db'.format(folder + '/' + filename))
            return filename, False
        else:
            try: 
                s3_check = GLOBALS.s3client.head_object(Bucket=Config.BUCKET,Key=folder + '/' + filename)
                if Config.DEBUGGING: app.logger.info('{} exists in S3'.format(folder + '/' + filename))
                return filename, True
            except:
                if Config.DEBUGGING: app.logger.info('{} does not exist'.format(folder + '/' + filename))
                return None, False
    except:
        if Config.DEBUGGING: app.logger.info('{} does not exist'.format(folder + '/' + filename))
        # file does not exist
        return None, False

def checkFilesExist(files,folder):
    '''Checks if a list of files exists in db & s3. Returns the filename if it does and None otherwise.'''

    starttime = time.time()
    already_uploaded = []  
    not_imported = []
    req_lambda = []
    new_names = {}

    hash_dict = {}
    camera_paths = []
    
    for file in files:
        hash_dict[folder + '/' +file['name']] = file['hash']

    survey_path = folder + '/' + files[0]['name'].split('/')[0] + '/%'
    survey_path = survey_path.replace('_','\\_')

    # Check if the files are already in the database based on the hash
    hashes = list(hash_dict.values())
    hash_check = db.session.query(Image.hash).join(Camera).filter(Image.hash.in_(hashes)).filter(Camera.path.like(survey_path))
    vid_hash_check = db.session.query(Video.hash).join(Camera).filter(Video.hash.in_(hashes)).filter(Camera.path.like(survey_path))
    hash_check = [h[0] for h in hash_check.union(vid_hash_check).distinct().all()]

    for file in hash_dict:
        if hash_dict[file] in hash_check:
            already_uploaded.append(file)
        else:
            not_imported.append(file)

    if not_imported:
        camera_paths = [file.rsplit('/',1)[0] for file in not_imported]
        common_camera_path = os.path.commonpath(camera_paths)
        common_camera_path = common_camera_path.replace('_','\\_')

        # Get files in db with the same path but different hash
        files_in_db = db.session.query(Image.filename,Camera.path, Image.hash)\
                                .join(Camera)\
                                .filter(Camera.path.in_(camera_paths))\
                                .filter(Image.hash.notin_(hashes))\
                                .filter(~Camera.videos.any())
        
        videos_in_db = db.session.query(Video.filename,Camera.path, Video.hash)\
                                .join(Camera)\
                                .filter(Camera.path.like(common_camera_path + '/%'))\
                                .filter(Video.hash.notin_(hashes))\
        
        files_in_db = {r[1].split('/_video_images_/')[0] + '/' + r[0]: r[2] for r in files_in_db.union(videos_in_db).distinct().all()}

        # Check if the files are in S3 and if they are, check if they have the same hash as the file in S3 otherwise generate a new name                   
        for file in not_imported:
            req_new_name = False
            try:
                filename = file.rsplit('/',1)[1]
                if len(filename) > 64:
                    filename = hash_dict[file] + '.' + filename.rsplit('.',1)[1]  # If filename is too long, replace it with the hash
                    new_names[file.split('/', 1)[1]] = filename
                    continue

                file_db = files_in_db.get(file)
                if file_db:
                    if file_db != hash_dict[file]:
                        req_new_name = True
                    else:
                        already_uploaded.append(file)
                else:
                    s3_hash = generate_hash_from_s3(Config.BUCKET,file)
                    if s3_hash:
                        if s3_hash == hash_dict[file]:
                            already_uploaded.append(file)
                            req_lambda.append(file.split('/',1)[1])
                        else:
                            req_new_name = True
                if req_new_name:
                    counter = 1 
                    filename, ext = file.rsplit('.',1)
                    new_name = filename + '_(' + str(counter) + ').' + ext
                    while files_in_db.get(new_name):
                        counter += 1
                        new_name =  filename + '_(' + str(counter) + ').' + ext
                    s3_nn_hash = generate_hash_from_s3(Config.BUCKET,new_name)
                    if s3_nn_hash:
                        if s3_nn_hash == hash_dict[file]:
                            already_uploaded.append(file)
                            req_lambda.append(file.split('/',1)[1])
                            if len(new_name.rsplit('/',1)[1]) > 64:
                                new_name = hash_dict[file] + '.' + ext
                            else:
                                new_names[file.split('/', 1)[1]] = new_name.rsplit('/',1)[1]
                        else:
                            counter += 1
                            new_name = filename + '_(' + str(counter) + ').' + ext
                            if len(new_name.rsplit('/',1)[1]) > 64:
                                new_name = hash_dict[file] + '.' + ext
                            else:
                                new_names[file.split('/', 1)[1]] = new_name.rsplit('/',1)[1]
                    else:
                        if len(new_name.rsplit('/',1)[1]) > 64:
                            new_name = hash_dict[file] + '.' + ext
                        else:
                            new_names[file.split('/', 1)[1]] = new_name.rsplit('/',1)[1]
            except:
                pass

    # Remove the folder name by splitting the first part of the path
    already_uploaded = [x.split('/', 1)[1] for x in already_uploaded]

    if Config.DEBUGGING: 
        app.logger.info('Checked files in {} seconds'.format(time.time()-starttime))
        app.logger.info('Already uploaded: {}, Req Lambda: {}, New names: {}'.format(len(already_uploaded),len(req_lambda),len(new_names)))

    return already_uploaded, req_lambda, new_names

def generate_hash_from_s3(bucket,key):
    '''Generates a hash of an image stored in S3.'''
    try:
        response = GLOBALS.s3client.get_object(Bucket=bucket,Key=key)
        if re.compile('(\.avi$)|(\.mp4$)|(\.mov$)', re.I).search(key):
            hash = hashlib.md5(response['Body'].read()).hexdigest()
        else:
            output=io.BytesIO()
            piexif.insert(piexif.dump({'0th': {}, '1st': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, 'thumbnail': None}),response['Body'].read(),output)
            hash = hashlib.md5(output.getbuffer()).hexdigest()
        return hash
    except:
        return None

def rDets(sq):
    '''Adds the necessary SQLAlchemy filters for a detection to be considered 'relevent'. ie. non-static, not deleted and of sufficient confidence.'''
    return sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                .filter(Detection.static==False)\
                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))

def generate_raw_image_hash(filename):
    '''Generates a hash of an image with no EXIF data in a format compatable with the front end or generates a hash of a video.'''
    
    if filename.endswith('.AVI') or filename.endswith('.MP4') or filename.endswith('.avi') or filename.endswith('.mp4') or filename.endswith('.mov') or filename.endswith('.MOV'):
        hash = hashlib.md5(open(filename, "rb").read()).hexdigest()
    else:
        output=io.BytesIO()
        with open(filename, "rb") as f:
            piexif.insert(piexif.dump({'0th': {}, '1st': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, 'thumbnail': None}),f.read(),output)
            hash = hashlib.md5(output.getbuffer()).hexdigest()
        
    return hash

@celery.task(bind=True,max_retries=5,ignore_result=True)
def calculateChunkHashes(self,chunk):
    '''Partner function to calculateTrapgroupHashes. Allows further parallisation.'''

    try:
        images = db.session.query(Image).filter(Image.id.in_(chunk)).distinct().all()
        for image in images:
            try:
                with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                    GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=image.camera.path+'/'+image.filename, Filename=temp_file.name)
                    try:
                        image.hash = generate_raw_image_hash(temp_file.name)
                    except:
                        pass
            except:
                pass
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

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def calculateTrapgroupHashes(self,trapgroup_id):
    '''Temporary function to allow massive parallisation of hash calculation.'''
    
    try:
        pool = Pool(processes=4)
        images = [r[0] for r in db.session.query(Image.id).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).distinct().all()]
        for chunk in chunker(images,200):
            pool.apply_async(calculateChunkHashes,(chunk,))
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

def stringify_timestamp(timestamp, download=False):
    '''Cleanly returns a string value for a timestamp'''
    try:
        if download:
            return timestamp.strftime("%Y%m%d_%H%M%S")
        else:
            return timestamp.strftime("%Y/%m/%d %H:%M:%S")
    except:
        return 'None'

def numify_timestamp(timestamp):
    '''Cleanly returns a numeric value for a timestamp'''
    try:
        return (timestamp-datetime(1970,1,1)).total_seconds()
    except:
        return 0

def fire_up_instances(queue,instance_count):
    ''' Function to manually fire up extra instances when needed'''

    ec2 = boto3.resource('ec2', region_name=Config.AWS_REGION)
    client = boto3.client('ec2',region_name=Config.AWS_REGION)

    if queue in Config.QUEUES.keys():
        ami = Config.QUEUES[queue]['ami']
        instances = Config.QUEUES[queue]['instances']
        user_data = Config.QUEUES[queue]['user_data']
        idle_multiplier = Config.IDLE_MULTIPLIER[queue]
        instance_rates = Config.INSTANCE_RATES[queue]
        git_pull = True
        subnet = Config.PUBLIC_SUBNET_ID
    else:
        classifier = db.session.query(Classifier).filter(Classifier.queue==queue).first()
        ami = classifier.ami_id
        instances = Config.GPU_INSTANCE_TYPES
        user_data = Config.CLASSIFIER['user_data']
        idle_multiplier = Config.IDLE_MULTIPLIER['classification']
        instance_rates = Config.INSTANCE_RATES['classification']
        git_pull = False
        subnet = Config.PRIVATE_SUBNET_ID
    
    launch_instances(queue,ami,user_data,instance_count,idle_multiplier,ec2,instances,instance_rates,git_pull,subnet)

    return True

def inspect_celery(include_spam=False,include_reserved=False,include_scheduled=False):
    ''' Funcion to manually inspect the running celery tasks'''
    inspector = celery.control.inspect()
    spam = ['importImages','.detection','.classify','runClassifier','processCameraStaticDetections', 'process_video_batch','cluster_trapgroup','processStaticWindow', 
            'segment_and_pose', 'calculate_individual_similarity','calculate_hotspotter_similarity', 'generateDetections', 'archive_images', 'archive_empty_images',
            'archive_videos', 'recluster_large_clusters', 'group_cameras', 'updateTrapgroupStaticDetections', 'extrapolate_timestamps', 'classifyTrapgroup', 
            'updateTrapgroupDetectionRatings', 'extract_zip']
    if include_spam: spam = []

    print('//////////////////////Active tasks://////////////////////')
    print('{:{}}{:{}}{:{}}{:{}}{:{}}'.format(
                    'ID',40,
                    'Function',36,
                    'Worker',36,
                    'Time Start',29,
                    '  Kwargs',50
    ))
    inspector_active = inspector.active()
    for worker in inspector_active:
        for task in inspector_active[worker]:
            if not any(name in task['name'] for name in spam):
                time_start = str(datetime.fromtimestamp(task['time_start']))
                name = task['name'].split('.')[-1]
                hostname = task['hostname'].split('@')[-1]
                if 'importImages' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['survey_id']))
                elif '.detection' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]))
                elif 'runClassifier' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  cameragroup_ids={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['cameragroup_ids']))
                elif 'process_video_batch' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['dirpath']))
                elif 'prepTask' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['survey_id']))
                elif '.classifyTrapgroup' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))
                elif '.classify_survey' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))
                elif '.classify' in task['name']:
                    batch = task['kwargs']['batch']
                    detection_id=batch['detection_ids'][0]
                    image_id=batch['detections'][detection_id]['image_id']
                    path = batch['images'][image_id]
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,path))
                elif 'segment_and_pose' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]))
                elif 'calculate_hotspotter_similarity' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['query_ids']))
                elif 'generateDetections' in task['name']:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['dirpath']))
                else:
                    print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))

    if include_reserved:
        print('')
        print('')
        print('')
        print('//////////////////////Reserved tasks://////////////////////')
        print('{:{}}{:{}}{:{}}{:{}}{:{}}'.format(
                        'ID',40,
                        'Function',36,
                        'Worker',36,
                        'Time Start',29,
                        '  Kwargs',50
        ))
        inspector_reserved = inspector.reserved()
        for worker in inspector_reserved:
            for task in inspector_reserved[worker]:
                if not any(name in task['name'] for name in spam):
                    time_start = str(datetime.fromtimestamp(task['time_start'])) if task['time_start'] else 'None'
                    name = task['name'].split('.')[-1]
                    hostname = task['hostname'].split('@')[-1]
                    if 'importImages' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['survey_id']))
                    elif '.detection' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]))
                    elif 'runClassifier' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  cameragroup_ids={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['cameragroup_ids']))
                    elif 'process_video_batch' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['dirpath']))
                    elif 'prepTask' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['survey_id']))
                    elif '.classifyTrapgroup' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))
                    elif '.classify_survey' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))
                    elif '.classify' in task['name']:
                        batch = task['kwargs']['batch']
                        detection_id=batch['detection_ids'][0]
                        image_id=batch['detections'][detection_id]['image_id']
                        path = batch['images'][image_id]
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,path))
                    elif 'segment_and_pose' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]))
                    elif 'calculate_hotspotter_similarity' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['query_ids']))
                    elif 'generateDetections' in task['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']['batch'][0]['dirpath']))
                    else:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(task['id'],40,name,36,hostname,36,time_start,29,task['kwargs']))

    if include_scheduled:
        inspector_scheduled = inspector.scheduled()
        print('')
        print('')
        print('')
        print('//////////////////////Scheduled tasks://////////////////////')
        print('{:{}}{:{}}{:{}}{:{}}{:{}}'.format(
                        'ID',40,
                        'Function',36,
                        'Worker',36,
                        'ETA',29,
                        '  Kwargs',50
        ))

        for worker in inspector_scheduled:
            for task in inspector_scheduled[worker]:
                request = task['request']
                if not any(name in request['name'] for name in spam):
                    eta = datetime.fromisoformat(task['eta']).strftime("%Y-%m-%d %H:%M:%S.%f")
                    name = request['name'].split('.')[-1]
                    hostname = request['hostname'].split('celery@')[-1]
                    if 'importImages' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['batch'][0]['survey_id']))
                    elif '.detection' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['batch'][0]))
                    elif 'runClassifier' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  cameragroup_ids={}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['cameragroup_ids']))
                    elif 'process_video_batch' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['dirpath']))
                    elif 'prepTask' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  survey_id={}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['survey_id']))
                    elif '.classifyTrapgroup' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']))
                    elif '.classify_survey' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']))
                    elif '.classify' in request['name']:
                        batch = request['kwargs']['batch']
                        detection_id=batch['detection_ids'][0]
                        image_id=batch['detections'][detection_id]['image_id']
                        path = batch['images'][image_id]
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,path))
                    elif 'segment_and_pose' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['batch'][0]))
                    elif 'calculate_hotspotter_similarity' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['batch'][0]['query_ids']))
                    elif 'generateDetections' in request['name']:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']['batch'][0]['dirpath']))
                    else:
                        print('{:{}}{:{}}{:{}}{:{}}  {}'.format(request['id'],40,name,36,hostname,36,eta,29,request['kwargs']))

    return True

def format_count(count):
    '''Formats counts for display.'''
    if count>=1000000:
        return str(round((count/1000000),2))+'M'
    else:
        return '{:,}'.format(count).replace(',', ' ')

# def required_images(cluster,relevent_classifications,transDict):
#     '''
#     Returns the required images for a specified cluster.
    
#         Parameters:
#             cluster (Cluster): Cluster that the required images are needed for
#             relevent_classifications (list): The list of tagging-level relevent classifications for a cluster
#             transDict (dict): The translation dictionary between child labels and the relevent classifications
#     '''
    
#     sortedImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.detection_rating)).all()
#     classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==cluster.task_id).first()[0]

#     species = db.session.query(Detection.classification)\
#                         .join(Image)\
#                         .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
#                         .filter(ClassificationLabel.classifier_id==classifier_id) \
#                         .filter(Detection.class_score>ClassificationLabel.threshold) \
#                         .filter(Image.clusters.contains(cluster))\
#                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                         .filter(Detection.static==False)\
#                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                         .filter(Detection.classification!=None)\
#                         .filter(Detection.classification.in_(relevent_classifications))\
#                         .distinct().all()
    
#     # species = db.session.query(Detection.classification)\
#     #                     .join(Image)\
#     #                     .join(Camera)\
#     #                     .join(Trapgroup)\
#     #                     .join(Survey)\
#     #                     .join(Classifier)\
#     #                     .filter(Image.clusters.contains(cluster))\
#     #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#     #                     .filter(Detection.static==False)\
#     #                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#     #                     .filter(Detection.class_score>Classifier.threshold)\
#     #                     .filter(Detection.classification!=None)\
#     #                     .filter(Detection.classification.in_(relevent_classifications))\
#     #                     .distinct().all()

#     species = set([transDict[r[0]] for r in species])

#     required = []
#     coveredSpecies = set()
#     for image in sortedImages:
#         imageSpecies = db.session.query(Detection.classification)\
#                         .join(Image)\
#                         .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
#                         .filter(ClassificationLabel.classifier_id==classifier_id) \
#                         .filter(Detection.class_score>ClassificationLabel.threshold) \
#                         .filter(Detection.image_id==image.id)\
#                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                         .filter(Detection.static==False)\
#                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                         .filter(Detection.classification!=None)\
#                         .filter(Detection.classification.in_(relevent_classifications))\
#                         .distinct().all()

#         # imageSpecies = db.session.query(Detection.classification)\
#         #                 .join(Image)\
#         #                 .join(Camera)\
#         #                 .join(Trapgroup)\
#         #                 .join(Survey)\
#         #                 .join(Classifier)\
#         #                 .filter(Detection.image_id==image.id)\
#         #                 .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#         #                 .filter(Detection.static==False)\
#         #                 .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#         #                 .filter(Detection.class_score>Classifier.threshold)\
#         #                 .filter(Detection.classification!=None)\
#         #                 .filter(Detection.classification.in_(relevent_classifications))\
#         #                 .distinct().all()

#         imageSpecies = [transDict[r[0]] for r in imageSpecies]

#         if any(animal not in coveredSpecies for animal in imageSpecies):
#             coveredSpecies.update(imageSpecies)
#             required.append(image)
#             if coveredSpecies == species:
#                 break

#     return required

@celery.task(bind=True,max_retries=5)
def prep_required_images(self,task_id,trapgroup_id=None):
    '''Prepares the required images for every cluster in a specified task - the images that must be viewed by the 
    user based on the species contained therein.'''

    try:
        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level
        isBounding = task.is_bounding
        classifier_id = task.survey.classifier_id
        dataType = task.survey.type

        if isBounding or ('-4' in taggingLevel) or ('-5' in taggingLevel) or ('-7' in taggingLevel): return True

        if '-8' in taggingLevel:
            # related cluster check

            #################################related clusters and associated classifications#####################
            # the present classifications in each image
            imageClassificationSQ = rDets(db.session.query(\
                                            Image.id.label('image_id'),\
                                            Image.detection_rating.label('detection_rating'),\
                                            Detection.classification.label('classification')\
                                        )\
                                        .join(Detection))\
                                        .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                        .filter(ClassificationLabel.classifier_id==classifier_id) \
                                        .filter(Detection.class_score>ClassificationLabel.threshold) \
                                        .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])

            if trapgroup_id: imageClassificationSQ = imageClassificationSQ.join(Camera).filter(Camera.trapgroup_id==trapgroup_id)
            imageClassificationSQ = imageClassificationSQ.distinct(Image.id,Detection.classification).subquery()

            # the start and end times for each cluster
            clusterTimestampsSQ = db.session.query(\
                                    Cluster.id.label('cluster_id'),\
                                    func.min(Image.corrected_timestamp).label('start_time'),\
                                    func.max(Image.corrected_timestamp).label('end_time'),\
                                    Camera.trapgroup_id.label('trapgroup_id')\
                                )\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .filter(Cluster.task_id==task_id)\
                                .group_by(Cluster.id)\
                                .subquery()

            Cluster1 = alias(Cluster)
            Cluster2 = alias(Cluster)
            ClusterTimestampsSQ1 = alias(clusterTimestampsSQ)
            ClusterTimestampsSQ2 = alias(clusterTimestampsSQ)
            Labelstable2 = alias(labelstable)
            Label2 = alias(Label)
            Translation2 = alias(Translation)

            Labelstable1 = db.session.query(labelstable.c.cluster_id.label('cluster_id'),labelstable.c.label_id.label('label_id'),Label.parent_id.label('parent_id'))\
                        .join(Label,labelstable.c.label_id==Label.id)\
                        .subquery()

            # the proposed classification for each cluster from related clusters
            relatedClustersSQ = db.session.query(Cluster1.c.id.label('cluster_id'),Translation2.c.classification.label('classification'))\
                                        .join(Task,Cluster1.c.task_id==Task.id)\
                                        .join(Cluster2,Cluster2.c.task_id==Task.id)\
                                        .join(ClusterTimestampsSQ1,ClusterTimestampsSQ1.c.cluster_id==Cluster1.c.id)\
                                        .join(ClusterTimestampsSQ2,ClusterTimestampsSQ2.c.cluster_id==Cluster2.c.id)\
                                        .join(Labelstable2,Labelstable2.c.cluster_id==Cluster2.c.id)\
                                        .join(Label2,Label2.c.id==Labelstable2.c.label_id)\
                                        .join(Translation2,Translation2.c.label_id==Label2.c.id)\
                                        .outerjoin(Labelstable1,\
                                            (Labelstable1.c.cluster_id == Cluster1.c.id) & \
                                            ((Labelstable2.c.label_id == Labelstable1.c.label_id) | (Labelstable2.c.label_id==Labelstable1.c.parent_id)))\
                                        .filter(Task.id==task_id)\
                                        .filter(Translation2.c.task_id==task_id)\
                                        .filter(Cluster1.c.id!=Cluster2.c.id)\
                                        .filter(ClusterTimestampsSQ1.c.trapgroup_id==ClusterTimestampsSQ2.c.trapgroup_id)\
                                        .filter(or_(\
                                            func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.end_time, ClusterTimestampsSQ2.c.start_time)) < Config.RELATED_CLUSTER_TIME,\
                                            func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.start_time, ClusterTimestampsSQ2.c.end_time)) < Config.RELATED_CLUSTER_TIME\
                                        ))\
                                        .filter(Labelstable1.c.label_id.is_(None))\
                                        .filter(~Labelstable2.c.label_id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))

            if trapgroup_id: relatedClustersSQ = relatedClustersSQ.filter(ClusterTimestampsSQ1.c.trapgroup_id==trapgroup_id)
            relatedClustersSQ = relatedClustersSQ.distinct(Cluster1.c.id,Translation2.c.classification).subquery()

            # The ranked images (based on detection rating) for each classification in a cluster
            requiredImagesSQ = db.session.query(\
                                            Cluster.id.label('cluster_id'),\
                                            imageClassificationSQ.c.classification.label('classification'),\
                                            Image.id.label('image_id'),\
                                            func.row_number().over(
                                                partition_by=[Cluster.id, imageClassificationSQ.c.classification],
                                                order_by=imageClassificationSQ.c.detection_rating.desc()
                                            ).label("rank")
                                        )\
                                        .join(Image,Cluster.images)\
                                        .join(relatedClustersSQ,relatedClustersSQ.c.cluster_id==Cluster.id)\
                                        .join(imageClassificationSQ,(imageClassificationSQ.c.image_id==Image.id) & (imageClassificationSQ.c.classification==relatedClustersSQ.c.classification))\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Cluster.examined==False)
            
            if trapgroup_id: requiredImagesSQ = requiredImagesSQ.join(Camera).filter(Camera.trapgroup_id==trapgroup_id)
            requiredImagesSQ = requiredImagesSQ.subquery()

            # The concatonated images for each cluster (based on related cluster classifications)
            classificationImagesSQ = db.session.query(
                requiredImagesSQ.c.cluster_id.label('cluster_id'),
                func.group_concat(
                    distinct(requiredImagesSQ.c.image_id)
                ).label('image_ids')
            ).filter(requiredImagesSQ.c.rank <= 3).group_by(requiredImagesSQ.c.cluster_id).subquery()

            #################################Quantile images for clusters where they are missing the proposed classification#####################
            # Split each clusters images into 5 equal quantiles
            # We need rDets here to ensure that the chosen quantile images indeed have detections
            if trapgroup_id:
                rDetsSQ = rDets(db.session.query(Image).join(Detection).join(Camera).filter(Camera.trapgroup_id==trapgroup_id)).distinct(Image.id).subquery()
            else:
                rDetsSQ = rDets(db.session.query(Image).join(Detection).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==task.survey_id)).distinct(Image.id).subquery()
            
            clusterQuantileSQ = db.session.query(
                                            Cluster.id.label("cluster_id"),
                                            Image.id.label("image_id"),
                                            func.ntile(5).over(
                                                partition_by=Cluster.id,
                                                order_by=Image.corrected_timestamp
                                            ).label("quantile_bin")
                                        )\
                                        .join(Image, Cluster.images)\
                                        .join(rDetsSQ,rDetsSQ.c.id==Image.id)\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Cluster.examined==False)
            
            if trapgroup_id: clusterQuantileSQ = clusterQuantileSQ.join(Camera).filter(Camera.trapgroup_id==trapgroup_id)
            clusterQuantileSQ = clusterQuantileSQ.subquery()

            # now apply a row number to each ordered image in each quantile
            clusterOrderSQ = db.session.query(
                                            clusterQuantileSQ.c.cluster_id.label("cluster_id"),
                                            clusterQuantileSQ.c.image_id.label("image_id"),
                                            func.row_number().over(
                                                partition_by=[clusterQuantileSQ.c.cluster_id, clusterQuantileSQ.c.quantile_bin],
                                                order_by=clusterQuantileSQ.c.quantile_bin
                                            ).label("row_num")
                                        ).subquery()

            # request the first image from each quantile
            quantilesSQ = db.session.query(
                                            clusterOrderSQ.c.cluster_id.label('cluster_id'),
                                            func.group_concat(
                                                distinct(clusterOrderSQ.c.image_id)
                                            ).label('image_ids')
                                        )\
                                        .filter(clusterOrderSQ.c.row_num == 1)\
                                        .group_by(clusterOrderSQ.c.cluster_id)\
                                        .subquery()

            #################################Now join our clusters to both and prioritise classification-based options#####################
            requiredImages = db.session.query(
                                            Cluster.id,
                                            func.coalesce(
                                                    classificationImagesSQ.c.image_ids,  # If classification-based images exist, use them
                                                    quantilesSQ.c.image_ids  # Otherwise, fallback to quantile-based images
                                            )
                                        )\
                                        .outerjoin(classificationImagesSQ,classificationImagesSQ.c.cluster_id==Cluster.id)\
                                        .join(quantilesSQ,quantilesSQ.c.cluster_id==Cluster.id)\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Cluster.examined==False)\
                                        .distinct().all()

        else:
            # info tag level needs to be handled correctly
            taggingLevel = taggingLevel.replace('-2,','')

            if int(taggingLevel) > 0:
                # We are interested in the images containing the launched species and it's children
                label = db.session.query(Label).get(int(taggingLevel))
                names = [label.description]
                ids = [label.id]
                names, ids = addChildLabels(names,ids,label,task_id)
                relevent_classifications = [r[0] for r in db.session.query(Translation.classification)\
                                                    .filter(Translation.label_id.in_(ids))\
                                                    .filter(Translation.task_id==task_id)\
                                                    .filter(Translation.label_id!=GLOBALS.nothing_id)\
                                                    .filter(~Translation.classification.in_(['nothing','unknown']))\
                                                    .distinct().all()]
            else:
                # We are interested in all non-nothing and user-ignored classifications
                relevent_classifications = [r[0] for r in db.session.query(Translation.classification)\
                                                    .filter(Translation.task_id==task_id)\
                                                    .filter(Translation.label_id!=GLOBALS.nothing_id)\
                                                    .filter(~Translation.classification.in_(['nothing','unknown']))\
                                                    .distinct().all()]

            # Here we determine the classifications visible in each image
            imageClassificationSQ = rDets(db.session.query(\
                                            Image.id.label('image_id'),\
                                            Image.detection_rating.label('detection_rating'),\
                                            Detection.classification.label('classification')\
                                        )\
                                        .join(Detection))\
                                        .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                        .filter(ClassificationLabel.classifier_id==classifier_id) \
                                        .filter(Detection.class_score>ClassificationLabel.threshold) \
                                        .filter(Detection.classification.in_(relevent_classifications))\
                                        .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])
            
            if trapgroup_id: imageClassificationSQ = imageClassificationSQ.join(Camera).filter(Camera.trapgroup_id==trapgroup_id)
            imageClassificationSQ = imageClassificationSQ.distinct(Image.id,Detection.classification).subquery()

            # Here we find the ranked images (based on detection rating) for each classification in a cluster
            requiredImagesSQ = db.session.query(\
                                            Cluster.id.label('cluster_id'),\
                                            imageClassificationSQ.c.classification.label('classification'),\
                                            Image.id.label('image_id'),\
                                            func.row_number().over(
                                                partition_by=[Cluster.id, imageClassificationSQ.c.classification],
                                                order_by=imageClassificationSQ.c.detection_rating.desc()
                                            ).label("rank")
                                        )\
                                        .join(Image,Cluster.images)\
                                        .join(imageClassificationSQ,imageClassificationSQ.c.image_id==Image.id)\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Cluster.examined==False)
            
            if trapgroup_id: requiredImagesSQ = requiredImagesSQ.join(Camera).filter(Camera.trapgroup_id==trapgroup_id)
            requiredImagesSQ = requiredImagesSQ.subquery()

            # Here we select the the pool of top images for each cluster
            requiredImages = db.session.query(
                requiredImagesSQ.c.cluster_id,
                func.group_concat(func.distinct(requiredImagesSQ.c.image_id))
            ).filter(requiredImagesSQ.c.rank == 1).group_by(requiredImagesSQ.c.cluster_id).all()

        # Prepare the list of dictionaries for bulk insert
        insert_values = []
        for row in requiredImages:
            cluster_id = row[0]
            for image_id in row[1].split(','):
                insert_values.append({"cluster_id": cluster_id, "image_id": int(image_id)})

        # Perform bulk insert
        db.session.execute(insert(requiredimagestable), insert_values)
        
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
    
    return True

def create_er_api_dict(group):
    return dict(zip(group['api_key'], group['er_id']))

def updateEarthRanger(task_id):
    ''' Function for syncing to Earth Ranger Report a task is complete'''
    task = db.session.query(Task).get(task_id)
    if task:
        organisation_id = task.survey.organisation_id
        er_integrations = db.session.query(EarthRanger).filter(EarthRanger.organisation_id==organisation_id).all()
        if len(er_integrations) > 0:

            # Get all species of interest and their api keys
            er_species_api = {}
            er_species = []
            for er_integration in er_integrations:
                if er_integration.label not in er_species_api.keys():
                    er_species_api[er_integration.label] = []
                    er_species.append(er_integration.label)
                er_species_api[er_integration.label].append(er_integration.api_key)

            # Get applicable data to send to EarthRanger
            labels = db.session.query(Label).filter(Label.description.in_(er_species)).filter(Label.task_id==task_id).all()
            label_list = []
            parent_children = {}
            for label in labels:
                label_list.append(label.id)
                child_labels = []
                child_labels = addKids(child_labels,label,task_id)
                if len(child_labels) > 0:
                    parent_children[label.description] = []
                for child_label in child_labels:
                    label_list.append(child_label.id)
                    parent_children[label.description].append(child_label.description)
                    if child_label.description not in er_species_api.keys():
                        er_species_api[child_label.description] = er_species_api[label.description]
                    else:
                        er_species_api[child_label.description].extend(er_species_api[label.description])
                    if child_label.description not in er_species:
                        er_species.append(child_label.description)

            sq1 = rDets(db.session.query(Labelgroup.id.label('labelgroup_id'), Label.description.label('species'), Image.id.label('image_id'))\
                                        .join(Label,Labelgroup.labels)\
                                        .join(Detection)\
                                        .join(Image)\
                                        .filter(Labelgroup.task_id == task_id)\
                                        .filter(Labelgroup.labels.any(Label.id.in_(label_list)))).subquery()

            sq2 = db.session.query(sq1.c.image_id.label('image_id'), sq1.c.species.label('species'), func.count(distinct(sq1.c.labelgroup_id)).label('count'))\
                                        .group_by(sq1.c.image_id, sq1.c.species)\
                                        .subquery()

            df = pd.read_sql(rDets(db.session.query(
                            Cluster.id.label('cluster_id'),
                            Cluster.notes.label('notes'),
                            Image.corrected_timestamp.label('timestamp'),
                            Trapgroup.tag.label('trapgroup_tag'),
                            Trapgroup.latitude.label('trapgroup_lat'),
                            Trapgroup.longitude.label('trapgroup_lon'),
                            Tag.description.label('tag'),
                            sq2.c.species.label('species'),
                            sq2.c.count.label('count'),
                            Image.filename.label('filename'),
                            Camera.path.label('path'),
                            Image.detection_rating.label('detection_rating'),
                            ERangerID.id.label('er_id'),
                            ERangerID.api_key.label('api_key'),
                            Detection.id.label('detection_id')
                        )\
                        .outerjoin(ERangerID)\
                        .join(Image, Cluster.images)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .join(Label, Labelgroup.labels)\
                        .outerjoin(Tag, Labelgroup.tags)\
                        .join(sq2,sq2.c.image_id==Image.id)\
                        .filter(sq2.c.species.in_(er_species))\
                        .filter(Cluster.task_id == task_id)\
                        .filter(Labelgroup.task_id == task_id)\
                        .filter(Labelgroup.labels.any(Label.id.in_(label_list)))).statement,db.session.bind)

            if len(df) == 0:
                return True

            # add individuals which don't want to outer join
            df2 = pd.read_sql(db.session.query(Detection.id.label('detection_id'),Individual.name.label('individual'))\
                                        .join(Individual,Detection.individuals)\
                                        .filter(Individual.tasks.contains(task))\
                                        .filter(Individual.species.in_(er_species)).statement,db.session.bind)
            df = pd.merge(df, df2, on=['detection_id'], how='outer')

            grouped_dict = df.groupby('cluster_id').apply(create_er_api_dict)
            df['er_id_dict'] = df['cluster_id'].map(grouped_dict)
            df['tag'] = df['tag'].fillna('None')
            df['individual'] = df['individual'].fillna('None')
            df = df.sort_values(by=['cluster_id','species','detection_rating'], ascending=False)
            df = df.groupby(['cluster_id','species','trapgroup_tag','trapgroup_lat','trapgroup_lon']).agg({
                'timestamp':'min',
                'tag': lambda x: x.unique().tolist(),
                'individual': lambda x: x.unique().tolist(),
                'notes': 'first',
                'count':'max',
                'filename': 'first', # Highest detection rating
                'path': 'first',
                'er_id_dict': 'first'
            }).reset_index()
            df['tag'] = df['tag'].apply(lambda x: [] if x == ['None'] else x)
            df['individual'] = df['individual'].apply(lambda x: [] if x == ['None'] else x)

            # Handle clusters that contain multiple species that contains labels from parent and children of parent
            duplicate_clusters = df[df.duplicated(subset=['cluster_id'], keep=False)]
            for cluster_id, group in duplicate_clusters.groupby(['cluster_id']):
                for parent, children in parent_children.items():
                    if parent in group['species'].unique():
                        for child in children:
                            if child in group['species'].unique():
                                parent_filter = (df['cluster_id'] == cluster_id) & (df['species'] == parent)
                                child_filter = (df['cluster_id'] == cluster_id) & (df['species'] == child)
                                df.loc[parent_filter, 'count'] += float(df.loc[child_filter, 'count'])
                                df = df.drop(df[child_filter].index)

            # Send data to EarthRanger
            tf = timezonefinder.TimezoneFinder()
            er_url = 'https://sensors.api.gundiservice.org/v2/events/'

            for index, row in df.iterrows():
                if pd.isnull(row['timestamp']):
                    # row['timestamp'] = datetime.utcnow()
                    continue

                if row['trapgroup_lat'] != 0 and row['trapgroup_lon'] != 0:
                    tz = tf.timezone_at(lng=row['trapgroup_lon'], lat=row['trapgroup_lat'])
                    if tz:
                        row['timestamp'] = pytz.timezone(tz).localize(row['timestamp'])
                    else:
                        row['timestamp'] = row['timestamp'].replace(tzinfo=pytz.UTC)
                else:
                    row['timestamp'] = row['timestamp'].replace(tzinfo=pytz.UTC)

                if row['species'] in er_species_api.keys():
                    er_api_keys = er_species_api[row['species']]
                    for er_api_key in er_api_keys:
                        if (er_api_key in row['er_id_dict'].keys()) and (row['er_id_dict'][er_api_key]):
                            # Update report
                            update_existing_er_report(row,er_api_key,row['er_id_dict'][er_api_key])
                        else:
                            # Create a new report
                            create_new_er_report(row,er_api_key,er_url)

    db.session.commit()

    return True

def update_existing_er_report(row,er_api_key,er_object_id):
    '''Updates the existing Earth Ranger report for a cluster'''

    payload = {
        "recorded_at": row['timestamp'].isoformat(),
        "location": {
            "lat": row['trapgroup_lat'],
            "lon": row['trapgroup_lon']
        },
        "event_details": { 
            "location": row['trapgroup_tag'],
            "species": row['species'].lower(),
            "tags": row['tag'],
            "group_size": row['count']
        }
    }

    if ('notes' in row.keys()) and row['notes']: payload['event_details']['comments'] = row['notes']
    if ('individual' in row.keys()) and row['individual']: payload['event_details']['individuals'] = row['individual']

    # Set header
    er_header_json = {
        'Content-Type': 'application/json',
        'apikey': er_api_key
    }

    # Patch payload to EarthRanger
    update_url = 'https://sensors.api.gundiservice.org/v2/events/' + er_object_id + '/'
    retry = True
    attempts = 0
    max_attempts = 10
    while retry and (attempts < max_attempts):
        attempts += 1
        try:
            response = requests.patch(update_url, headers=er_header_json, json=payload)
            assert response.status_code == 200
            retry = False
        except:
            retry = True

    if response.status_code == 200:
        if Config.DEBUGGING: app.logger.info('Event updated in EarthRanger: {}'.format(er_object_id))
    else:
        if Config.DEBUGGING: app.logger.info('Error updating event in EarthRanger: {}'.format(response.status_code))
    
    return True

def create_new_er_report(row,er_api_key,er_url):
    '''Creates a new report in EarthRanger.'''

    payload = {
        "source": str(row['cluster_id']),
        "title": "TrapTagger Event",
        "recorded_at": row['timestamp'].isoformat(),
        "location": {
            "lat": row['trapgroup_lat'],
            "lon": row['trapgroup_lon']
        },
        "event_details": { 
            "location": row['trapgroup_tag'],
            "species": row['species'].lower(),
            "tags": row['tag'],
            "group_size": row['count']
        }
    }

    if ('notes' in row.keys()) and row['notes']: payload['event_details']['comments'] = row['notes']
    if ('individual' in row.keys()) and row['individual']: payload['event_details']['individuals'] = row['individual']

    # Set headers
    er_header_json = {
        'Content-Type': 'application/json',
        'apikey': er_api_key
    }
    er_header_img = {
        'apikey': er_api_key
    }

    # Post payload to EarthRanger
    retry = True
    attempts = 0
    max_attempts = 10
    while retry and (attempts < max_attempts):
        attempts += 1
        try:
            response = requests.post(er_url, headers=er_header_json, json=payload)
            assert response.status_code == 200 and response.json()['object_id']
            retry = False
        except:
            retry = True

    # Dowload image from S3 and send blob to EarthRanger
    if response.status_code == 200 and response.json()['object_id']:
        if Config.DEBUGGING: app.logger.info('Event posted to EarthRanger: {}'.format(payload['source']))

        object_id = response.json()['object_id']

        try:
            er_id = ERangerID(id=object_id,api_key=er_api_key,cluster_id=row['cluster_id'])
            db.session.add(er_id)

            splits = row['path'].split('/')
            splits[0] = splits[0] + '-comp'
            comp_path = '/'.join(splits)
            image_key = comp_path+'/'+row['filename']
            er_url_img = er_url + object_id + '/attachments/'

            with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file:
                try:
                    GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=image_key, Filename=temp_file.name)
                except:
                    if Config.DEBUGGING: app.logger.info('Error downloading image from S3: {}'.format(image_key))
                    return True

                files = {'file1': open(temp_file.name, 'rb')}

                retry_img = True
                attempts_img = 0
                max_attempts_img = 10
                while retry_img and (attempts_img < max_attempts_img):
                    attempts_img += 1
                    try:
                        response_img = requests.post(er_url_img, headers=er_header_img, files=files)
                        assert response_img.status_code == 200 and response_img.json()['object_id']
                        retry_img = False
                    except:
                        retry_img = True

                if response_img.status_code == 200 and response_img.json()['object_id']:
                    if Config.DEBUGGING: app.logger.info('Image posted to EarthRanger: {}'.format(row['filename']))
                else:
                    if Config.DEBUGGING: app.logger.info('Error posting image to EarthRanger: {}'.format(response.status_code))
        except:
            if Config.DEBUGGING: app.logger.info('Error posting image to EarthRanger: Duplicate object ID')
    else:
        if Config.DEBUGGING: app.logger.info('Error posting event to EarthRanger: {}'.format(response.status_code))
    
    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def mask_area(self, image_id, task_id, masks, user_id):
    ''' Create masks and mask detections in a specified area of an image. '''

    try:
        image = db.session.query(Image).get(image_id)
        trapgroup = image.camera.trapgroup
        cameragroup = image.camera.cameragroup
        trapgroup_id = trapgroup.id

        if trapgroup and cameragroup:
            # Validate & create masks
            for mask in masks:
                poly_coords = mask['poly_coords']
                poly_string = 'POLYGON(('
                for coord in poly_coords:
                    if round(coord[0],2) == 0 or coord[0] < 0 : coord[0] = 0
                    if round(coord[1],2) == 0 or coord[1] < 0: coord[1] = 0
                    if round(coord[0],2) == 1 or coord[0] > 1: coord[0] = 1
                    if round(coord[1],2) == 1 or coord[1] > 1: coord[1] = 1
                    poly_string += str(coord[0]) + ' ' + str(coord[1]) + ','
                poly_string = poly_string[:-1] + '))'

                poly_area = db.session.query(func.ST_Area(func.ST_GeomFromText(poly_string))).first()[0]
                if poly_area > Config.MIN_MASK_AREA:
                    check = db.session.query(Mask).filter(Mask.shape==poly_string).filter(Mask.cameragroup_id==cameragroup.id).first()
                    if not check:
                        new_mask = Mask(shape=poly_string,cameragroup_id=cameragroup.id,user_id=user_id)
                        db.session.add(new_mask)

            # Mask detections
            polygon = func.ST_GeomFromText(func.concat('POLYGON((',
                                      Detection.left, ' ', Detection.top, ', ',
                                      Detection.left, ' ', Detection.bottom, ', ',
                                      Detection.right, ' ', Detection.bottom, ', ',
                                      Detection.right, ' ', Detection.top, ', ',
                                      Detection.left, ' ', Detection.top, '))'), 32734)

            detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .join(Cameragroup)\
                                    .join(Mask)\
                                    .filter(Cameragroup.id==cameragroup.id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .filter(Detection.source!='user')\
                                    .filter(func.ST_Contains(Mask.shape, polygon))\
                                    .distinct().all()

            images = []
            for detection in detections:
                detection.status = 'masked'
                images.append(detection.image)
                if Config.DEBUGGING: app.logger.info('Masking detection {}'.format(detection.id))
            db.session.commit()

            for image in set(images):
                image.detection_rating = detection_rating(image)
            db.session.commit()
            
            re_evaluate_trapgroup_examined(trapgroup.id,task_id)

        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        trapgroup.processing = False
        trapgroup.active = True
        GLOBALS.redisClient.lrem('trapgroups_'+str(trapgroup.survey_id),0,trapgroup.id)
        GLOBALS.redisClient.rpush('trapgroups_'+str(trapgroup.survey_id),trapgroup.id) 
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
    
    return True


def update_masks(survey_id,removed_masks,added_masks,edited_masks,user_id):
    '''Updates the masks for a survey.'''

    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Processing'
    db.session.commit()

    # Remove masks
    for mask_id in removed_masks:
        mask = db.session.query(Mask).get(mask_id)
        if mask:
            db.session.delete(mask)

    # Add masks
    for mask in added_masks:
        poly_coords = mask['coords']
        poly_string = 'POLYGON(('
        for coord in poly_coords:
            if round(coord[0],2) == 0 or coord[0] < 0 : coord[0] = 0
            if round(coord[1],2) == 0 or coord[1] < 0: coord[1] = 0
            if round(coord[0],2) == 1 or coord[0] > 1: coord[0] = 1
            if round(coord[1],2) == 1 or coord[1] > 1: coord[1] = 1
            poly_string += str(coord[0]) + ' ' + str(coord[1]) + ','
        poly_string = poly_string[:-1] + '))'
        poly_area = db.session.query(func.ST_Area(func.ST_GeomFromText(poly_string))).first()[0]
        if poly_area > Config.MIN_MASK_AREA:
            check = db.session.query(Mask).filter(Mask.shape==poly_string).filter(Mask.cameragroup_id==mask['cameragroup_id']).first()
            if not check:
                new_mask = Mask(shape=poly_string,cameragroup_id=mask['cameragroup_id'],user_id=user_id)
                db.session.add(new_mask)

    # Edit masks
    for mask in edited_masks:
        poly_coords = mask['coords']
        poly_string = 'POLYGON(('
        for coord in poly_coords:
            if round(coord[0],2) == 0 or coord[0] < 0 : coord[0] = 0
            if round(coord[1],2) == 0 or coord[1] < 0: coord[1] = 0
            if round(coord[0],2) == 1 or coord[0] > 1: coord[0] = 1
            if round(coord[1],2) == 1 or coord[1] > 1: coord[1] = 1
            poly_string += str(coord[0]) + ' ' + str(coord[1]) + ','
        poly_string = poly_string[:-1] + '))'
        poly_area = db.session.query(func.ST_Area(func.ST_GeomFromText(poly_string))).first()[0]
        if poly_area > Config.MIN_MASK_AREA:
            mask = db.session.query(Mask).get(mask['id'])
            if mask:
                mask.shape = poly_string
                mask.user_id = user_id


    # Mask detections
    polygon = func.ST_GeomFromText(func.concat('POLYGON((',
                        Detection.left, ' ', Detection.top, ', ',
                        Detection.left, ' ', Detection.bottom, ', ',
                        Detection.right, ' ', Detection.bottom, ', ',
                        Detection.right, ' ', Detection.top, ', ',
                        Detection.left, ' ', Detection.top, '))'), 32734)

    mask_query = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Cameragroup)\
                            .join(Trapgroup)\
                            .join(Mask)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.source!='user')\
                            .filter(func.ST_Contains(Mask.shape, polygon))

    detections = mask_query.filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)).distinct().all()
    
    images = []
    for detection in detections:
        detection.status = 'masked'
        images.append(detection.image)


    # Unmask detections
    masked_detections = mask_query.filter(Detection.status=='masked').subquery()

    unmasked_detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Cameragroup)\
                            .join(Trapgroup)\
                            .outerjoin(masked_detections, masked_detections.c.id==Detection.id)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.status=='masked')\
                            .filter(masked_detections.c.id==None)

    for detection in unmasked_detections:
        detection.status = 'active'
        images.append(detection.image)

    db.session.commit()

    for image in set(images):
        image.detection_rating = detection_rating(image)
    db.session.commit()
    
    return True

def setup_new_survey_permissions(survey,organisation_id,user_id,permission,annotation,detailed_access):
    '''Sets up the user permissions for a new survey.'''

    user_permission = db.session.query(UserPermissions.default, UserPermissions.annotation).filter(UserPermissions.user_id==user_id).filter(UserPermissions.organisation_id==organisation_id).first()
    if user_permission[0] != 'admin' and user_permission[0] != 'worker':
        surveyException = SurveyPermissionException(user_id=user_id, survey=survey, permission='write', annotation=user_permission[1])
        db.session.add(surveyException)

    exclude_user_ids = [user_id]
    if detailed_access:
        user_query = db.session.query(User.id, UserPermissions.default).join(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.default!='admin').filter(~User.id.in_(exclude_user_ids)).distinct().all()
        user_default = {r[0]:r[1] for r in user_query}
        for access in detailed_access:
            exclude_user_ids.append(access['user_id'])
            annotation_access = True if access['annotation']=='1' else False
            if user_default[access['user_id']] != 'admin':
                if user_default[access['user_id']] == 'worker': 
                    newDetailedException = SurveyPermissionException(user_id=access['user_id'], survey=survey, permission='worker', annotation=annotation_access)
                else:
                    newDetailedException = SurveyPermissionException(user_id=access['user_id'], survey=survey, permission=access['permission'], annotation=annotation_access)
                db.session.add(newDetailedException)

    if permission != 'default' and annotation != 'default':
        user_query = db.session.query(User.id, UserPermissions.default).join(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.default!='admin').filter(~User.id.in_(exclude_user_ids)).distinct().all()
        user_ids = [r[0] for r in user_query]
        user_permissions = [r[1] for r in user_query]   
        annotation_access = True if annotation== '1' else False
        for i in range(len(user_ids)):
            if user_permissions[i] == 'worker':
                newException = SurveyPermissionException(user_id=user_ids[i], survey=survey, permission='worker', annotation=annotation_access)
            else:
                newException = SurveyPermissionException(user_id=user_ids[i], survey=survey, permission=permission, annotation=annotation_access)
            db.session.add(newException)

    elif permission != 'default':
        user_query = db.session.query(User.id, UserPermissions.default, UserPermissions.annotation).join(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.default!='admin').filter(~User.id.in_(exclude_user_ids)).distinct().all()
        user_ids = [r[0] for r in user_query]
        user_permissions = [r[1] for r in user_query]   
        user_annotations = [r[2] for r in user_query]
        for i in range(len(user_ids)):
            if user_permissions[i] != 'worker':
                newException = SurveyPermissionException(user_id=user_ids[i], survey=survey, permission=permission, annotation=user_annotations[i])
                db.session.add(newException)

    elif annotation != 'default':
        user_query = db.session.query(User.id, UserPermissions.default).join(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.default!='admin').filter(~User.id.in_(exclude_user_ids)).distinct().all()
        user_ids = [r[0] for r in user_query]
        user_permissions = [r[1] for r in user_query]
        annotation_access = True if annotation== '1' else False
        for i in range(len(user_ids)):
            newException = SurveyPermissionException(user_id=user_ids[i], survey=survey, permission=user_permissions[i], annotation=annotation_access)
            db.session.add(newException)

    return True

def manageDownload(task_id):
    '''Kicks off the necessary download cleanup for the specified task after the download has been abandoned.'''

    resetImageDownloadStatus.delay(task_id=task_id,then_set=False,labels=None,include_empties=None, include_frames=True)
    resetVideoDownloadStatus.delay(task_id=task_id,then_set=False,labels=None,include_empties=None, include_frames=True)
    GLOBALS.redisClient.delete('download_ping_'+str(task_id))

    download_requests = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==task_id).filter(DownloadRequest.type=='file').filter(DownloadRequest.status=='Downloading').all()
    if download_requests:
        cleanup = False
        for request in download_requests:
            if request.name == 'restore':
                user_id = request.user_id
                try:
                    download_params = json.loads(GLOBALS.redisClient.get('fileDownloadParams_'+str(task_id)+'_'+str(user_id)).decode())
                    expiry_date = request.timestamp
                    if expiry_date and datetime.utcnow() < expiry_date:
                        request.status = 'Available'
                    else:
                        cleanup = download_params['include_empties']

                        GLOBALS.redisClient.delete('fileDownloadParams_'+str(task_id)+'_'+str(user_id))
                        db.session.delete(request)
                except:
                    GLOBALS.redisClient.delete('fileDownloadParams_'+str(task_id)+'_'+str(user_id))
                    db.session.delete(request)
            else:
                db.session.delete(request)

        if cleanup:
            task = db.session.query(Task).get(task_id)
            check = db.session.query(Task.id).filter(Task.survey_id==task.survey_id).filter(Task.tagging_level=='-7').filter(Task.status.in_(['PROGRESS','PENDING'])).first()
            if not check:
                cleanup_empty_restored_images.delay(task_id=task_id)

        db.session.commit()
    
    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def resetImageDownloadStatus(self,task_id,then_set,labels,include_empties, include_frames):
    '''Resets the image downloaded status to the default not-downloaded state'''
    
    try:
        task = db.session.query(Task).get(task_id)
        if task.status=='Preparing Download': return True
        task.status = 'Processing'
        db.session.commit()

        images = db.session.query(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey==task.survey)\
                        .filter(Image.downloaded!=False)\
                        .all()

        # for chunk in chunker(images,10000):
        for image in images:
            image.downloaded = False
        db.session.commit()

        if then_set:
            setImageDownloadStatus.delay(task_id=task_id,labels=labels,include_empties=include_empties, include_video=False, include_frames=include_frames)
        else:
            GLOBALS.redisClient.delete(str(task.id)+'_filesToDownload')
            task.status = 'Ready'
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

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def resetVideoDownloadStatus(self,task_id,then_set,labels,include_empties, include_frames):
    '''Resets the video downloaded status to the default not-downloaded state'''
    
    try:
        task = db.session.query(Task).get(task_id)
        if task.status=='Preparing Download': return True
        task.status = 'Processing'
        db.session.commit()

        videos = db.session.query(Video)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey==task.survey)\
                        .filter(Video.downloaded!=False)\
                        .all()
        
        for video in videos:
            video.downloaded = False
        db.session.commit()

        if then_set:
            setImageDownloadStatus.delay(task_id=task_id,labels=labels,include_empties=include_empties, include_video=True, include_frames=include_frames)
        else:
            GLOBALS.redisClient.delete(str(task.id)+'_filesToDownload')
            task.status = 'Ready'
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

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def setImageDownloadStatus(self,task_id,labels,include_empties, include_video, include_frames):
    '''Sets the download status of images for a particular task to let the fileHandler know what images to serve the client.'''

    try:
        task = db.session.query(Task).get(task_id)
        task.status='Preparing Download'
        db.session.commit()

        if ('0' in labels) or (labels==[]):
            labels = [r.id for r in task.labels]
            labels.append(GLOBALS.vhl_id)
            labels.append(GLOBALS.knocked_id)
            labels.append(GLOBALS.unknown_id)
        labels = [int(r) for r in labels]

        if include_frames:
            wantedImages = db.session.query(Image)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(Labelgroup.task_id==task_id)    
        else:
            wantedImages = db.session.query(Image)\
                            .join(Camera)\
                            .outerjoin(Video)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(Labelgroup.task_id==task_id)\
                            .filter(Video.id==None)
                            

        if include_video:
            wantedVideos = db.session.query(Video)\
                            .join(Camera)\
                            .join(Image)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(Labelgroup.task_id==task_id)               
        
        if include_empties:
            if GLOBALS.nothing_id not in labels: labels.append(GLOBALS.nothing_id)

            # Include non-desired labelled images without detections
            rDetImages = rDets(db.session.query(Image.id.label('image_id'))\
                            .join(Detection)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey==task.survey))\
                            .subquery()
            
            wantedImages = wantedImages.outerjoin(rDetImages,rDetImages.c.image_id==Image.id)\
                            .filter(or_(\
                                Label.id.in_(labels),\
                                ~Labelgroup.labels.any(),\
                                rDetImages.c.image_id==None
                            ))

            if include_video:
                wantedVideos = wantedVideos.outerjoin(rDetImages,rDetImages.c.image_id==Image.id)\
                            .filter(or_(\
                                Label.id.in_(labels),\
                                ~Labelgroup.labels.any(),\
                                rDetImages.c.image_id==None
                            ))\
                            .filter(Image.zip_id==None) # NOTE: WE DO NOT KEEP EMPTY VIDEOS ANYMORE IN S3 (CAN"T BE DOWNLOADED)
        else:
            wantedImages = rDets(wantedImages.filter(Label.id.in_(labels)))
            if include_video:
                wantedVideos = rDets(wantedVideos.filter(Label.id.in_(labels)))

        wantedImages = wantedImages.distinct().all()

        allImages = db.session.query(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey==task.survey)\
                            .distinct().all()

        if include_video:
            wantedVideos = wantedVideos.distinct().all()

            allVideos = db.session.query(Video)\
                            .join(Camera)\
                            .join(Image)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey==task.survey)\
                            .distinct().all()
        else:
            wantedVideos = []
            allVideos = []

        # Get total count
        filesToDownload = len(wantedImages) + len(wantedVideos)	
        if Config.DEBUGGING: app.logger.info('Files to download: '+str(filesToDownload))

        GLOBALS.redisClient.set(str(task.id)+'_filesToDownload',filesToDownload)

        unwantedImages = list(set(allImages) - set(wantedImages))

        # for chunk in chunker(unwantedImages,10000):
        for image in unwantedImages:
            image.downloaded = True
        db.session.commit()

        unwantedVideos = list(set(allVideos) - set(wantedVideos))

        for chunk in chunker(unwantedVideos,10000):
            for video in chunk:
                video.downloaded = True
            db.session.commit()

        task.status = 'Ready'
        db.session.commit()

        test=db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==task.survey).filter(Image.downloaded==False).distinct().count()
        testVideo=db.session.query(Video).join(Camera).join(Image).join(Trapgroup).filter(Trapgroup.survey==task.survey).filter(Video.downloaded==False).distinct().count()
        if test==0:
            resetImageDownloadStatus(task_id,False,None,None,True)

        if testVideo==0:
            resetVideoDownloadStatus(task_id,False,None,None,True)

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

def checkUploadUser(user_id,survey_id):
    '''Checks if the upload is checked out by the specified user. If the survey is available, then the upload is checked out.'''
    
    upload_user = GLOBALS.redisClient.get('upload_user_'+str(survey_id))
    
    if upload_user==None:
        GLOBALS.redisClient.set('upload_user_'+str(survey_id),user_id)
        GLOBALS.redisClient.set('upload_ping_'+str(survey_id),datetime.utcnow().timestamp())
        return True
    else:   
        if int(upload_user.decode())==user_id:
            GLOBALS.redisClient.set('upload_ping_'+str(survey_id),datetime.utcnow().timestamp())
            return True
    
    return False

def update_staticgroups(survey_id,staticgroups,user_id):
    '''Updates the staticgroups and static detections for the specified survey.'''

    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Processing'
    db.session.commit()

    # Update staticgroups
    for staticgroup in staticgroups:
        if staticgroup['status'] in ['accepted','rejected']:
            static_group = db.session.query(Staticgroup).get(staticgroup['id'])
            static_group.status = staticgroup['status']
            static_group.user_id = user_id


    # Update detections
    static_detections = db.session.query(Detection)\
                                .join(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Staticgroup)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(or_(Staticgroup.status=='accepted',Staticgroup.status=='unknown'))\
                                .filter(Detection.static!=True)\
                                .distinct().all()

    images = []
    for detection in static_detections:
        images.append(detection.image)
        detection.static = True

    rejected_detections = db.session.query(Detection)\
                                .join(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Staticgroup)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(Staticgroup.status=='rejected')\
                                .filter(Detection.static!=False)\
                                .distinct().all()

    for detection in rejected_detections:
        images.append(detection.image)
        detection.static = False

    db.session.commit()


    for image in images:
        image.detection_rating = detection_rating(image)
    db.session.commit()

    return True


def verify_label(description,hotkey,parent):
    '''Verifies the label description and hotkey.'''	

    valid = True
    if description.lower() in ['knocked down','nothing','vehicles/humans/livestock','unknown','skip','remove false detections', 'mask area']:
        valid = False

    if not hotkey.isdigit() and not hotkey.isalpha() and not hotkey.isspace():
        valid = False

    if parent == 'None' or parent == 'none':
        parent = None

    if not parent:
        if hotkey.lower() in ['v', 'q', 'n', 'u']:
            valid = False
    else:
        if hotkey == '9':
            valid = False

    if hotkey == '0':
        valid = False

    if len(description) == 0 or len(hotkey) == 0:
        valid = False

    return valid

def getParentLabels(task_id,description,parent_labels,addLabel=True):
    '''Returns all a child label's parent labels.'''

    label = db.session.query(Label).filter(Label.description==description).filter(Label.task_id==task_id).first()
    if label:
        if addLabel: parent_labels.append(label.id)
        if label.parent:
            getParentLabels(task_id,label.parent.description,parent_labels)

    return parent_labels

def generate_api_key(survey_id=None):
    '''Generates a API key for Live Data integration'''
    if survey_id:
        idx = random.randint(0,24)
        survey_str = hashlib.md5(str(survey_id).encode()).hexdigest()[idx:idx+random.randint(2,8)]
        api_key = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(32-len(survey_str))) + survey_str
    else:
        api_key = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(32))
    hashed_key = hashlib.md5(api_key.encode()).hexdigest()
    while db.session.query(APIKey).filter(APIKey.api_key==hashed_key).first():
        api_key = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        hashed_key = hashlib.md5(api_key.encode()).hexdigest()
    return {'api_key':api_key,'hashed_key':hashed_key}

def generate_site_name(survey_id):
    '''Generates a unique site name for a new site'''
    site_count = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag.like('Site%')).count()
    site_name = 'Site' + str(site_count+1)
    check = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==site_name).first()
    while check:
        site_count += 1
        site_name = 'Site' + str(site_count+1)
        check = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==site_name).first()
    return site_name

def generate_hotkey(species, task_id=None):
    '''Generates a unique hotkey for a new label.'''
    hotkey = None
    species = species.lower()
    invalid_hotkeys = ['0','9','v','q','n','u']
    if task_id:
        taken_hotkeys = [r[0] for r in db.session.query(Label.hotkey).filter(Label.task_id==task_id).all()]
    else:
        taken_hotkeys = []
    available_hotkeys = [c for c in (string.digits + string.ascii_lowercase) if c not in taken_hotkeys and c not in invalid_hotkeys]

    if len(available_hotkeys) > 0:
        if species[0] in available_hotkeys:
            hotkey = species[0]
        else:
            hotkey = available_hotkeys[0]

    return hotkey

@celery.task(bind=True,max_retries=2,ignore_result=True)
def cleanup_empty_restored_images(self,task_id):
    ''' Deletes empty images that have been restored from the zip files. '''

    try:

        cluster_sq = db.session.query(Cluster.id)\
                        .join(Image, Cluster.images)\
                        .join(Detection)\
                        .filter(Cluster.task_id==task_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .distinct().subquery()             


        image_data = db.session.query(Image.id, Image.filename, Camera.path)\
                            .join(Camera, Image.camera_id==Camera.id)\
                            .join(Cluster, Image.clusters)\
                            .outerjoin(cluster_sq, cluster_sq.c.id==Cluster.id)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(cluster_sq.c.id==None)\
                            .filter(Image.zip_id!=None)\
                            .distinct().all()

        for image in image_data:
            image_path = image[2] + '/' + image[1]
            splits = image_path.split('/')
            splits[0] = splits[0] + '-comp'
            image_key = '/'.join(splits)
            try:
                GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_key)
            except:
                pass


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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def deleteFile(self,fileName):
    '''
    Celery task that periodically checks for and attempts to delete specified file on S3. Used to cleanup files after successful download.

        Parameters:
            filename (str): The path of the file to be deleted
    '''
    
    # try:
    #     if os.path.isfile(fileName):
    #         try:
    #             os.remove(fileName)
    #         except:
    #             deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=300)

    # except Exception as exc:
    #     app.logger.info(' ')
    #     app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    #     app.logger.info(traceback.format_exc())
    #     app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    #     app.logger.info(' ')
    #     self.retry(exc=exc, countdown= retryTime(self.request.retries))

    try:
        GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName)
    except:
        pass

    finally:
        db.session.remove()

    return True

def calculate_restore_expiry_date(restore_date,restore_time,days):
    '''Calculates the expiry date for objects in Glacier DEEP ARCHIVE after a restore request.'''
    
    expiry_date = None
    try:
        available_date = restore_date + timedelta(seconds=restore_time)
        # if the available date and restore date is on the same day we need to add an extra day
        if available_date.date() == restore_date.date():
            expiry_date = available_date + timedelta(days=days+1)
        else:
            expiry_date = available_date + timedelta(days=days)
        expiry_date = expiry_date.replace(hour=0,minute=0,second=0,microsecond=0)
    except:
        expiry_date = None

    return expiry_date

def reconcile_cluster_labelgroup_labels_and_tags(task_id):
    '''
    During annotation we simply set the cluster labels and tags for speed. If a cluster is huge, then the request runs the risk of timing out while the labelgroup
    labels and tags are updated for all the detections. So we reconcile them at wrap up here instead.
    '''
    
    # Reconcile Labels first
    labels = db.session.query(Label).filter(Label.task_id==task_id).distinct().all()
    labels.extend(db.session.query(Label).filter(Label.id.in_([GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id])).distinct().all())

    # Add labels to labelgroups that are in cluster
    for label in labels:

        first_iteration = True
        while first_iteration or labelgroups:
            first_iteration = False

            labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(Cluster.labels.contains(label))\
                                .filter(~Labelgroup.labels.contains(label))\
                                .filter(Labelgroup.checked==False)\
                                .distinct().limit(10000).all()
            
            for labelgroup in labelgroups:
                labelgroup.labels.append(label)

            db.session.commit()

    # Remove labels from labelgroups that are not in cluster
    for label in labels:

        first_iteration = True
        while first_iteration or labelgroups:
            first_iteration = False

            labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(~Cluster.labels.contains(label))\
                                .filter(Labelgroup.labels.contains(label))\
                                .filter(Labelgroup.checked==False)\
                                .distinct().limit(10000).all()
            
            for labelgroup in labelgroups:
                labelgroup.labels.remove(label)

            db.session.commit()

    # Then reconcile tags
    tags = db.session.query(Tag).filter(Tag.task_id==task_id).distinct().all()

    # Add tags to labelgroups that are in cluster
    for tag in tags:

        first_iteration = True
        while first_iteration or labelgroups:
            first_iteration = False

            labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(Cluster.tags.contains(tag))\
                                .filter(~Labelgroup.tags.contains(tag))\
                                .distinct().limit(10000).all()
                                # .filter(Labelgroup.checked==False)\
            
            for labelgroup in labelgroups:
                labelgroup.tags.append(tag)

            db.session.commit()

    # Remove tags from labelgroups that are not in cluster
    for tag in tags:

        first_iteration = True
        while first_iteration or labelgroups:
            first_iteration = False

            labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .filter(Cluster.task_id==task_id)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(~Cluster.tags.contains(tag))\
                                .filter(Labelgroup.tags.contains(tag))\
                                .distinct().limit(10000).all()
                                # .filter(Labelgroup.checked==False)\
            
            for labelgroup in labelgroups:
                labelgroup.tags.remove(tag)

            db.session.commit()

    return True

@celery.task(bind=True,max_retries=2,ignore_result=True)
def update_labelgroup_labels_tags(self,cluster_id):
    ''' Updates the labelgroup labels and tags for a given cluster. '''

    try:

        cluster = db.session.query(Cluster).get(cluster_id)

        # Update labels
        for label in cluster.labels:
            first_iteration = True
            while first_iteration or labelgroups:
                first_iteration = False

                labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==cluster.task_id)\
                                .filter(~Labelgroup.labels.contains(label))\
                                .distinct().limit(10000).all()
                
                for labelgroup in labelgroups:
                    labelgroup.labels.append(label)

                db.session.commit()

        labels = db.session.query(Label).filter(Label.task_id==cluster.task_id).distinct().all()
        labels.extend(db.session.query(Label).filter(Label.id.in_([GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id])).distinct().all())
        labels = [r for r in labels if r not in cluster.labels]

        # Remove labels
        for label in labels:
            first_iteration = True
            while first_iteration or labelgroups:
                first_iteration = False

                labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==cluster.task_id)\
                                .filter(~Cluster.labels.contains(label))\
                                .filter(Labelgroup.labels.contains(label))\
                                .distinct().limit(10000).all()
                
                for labelgroup in labelgroups:
                    labelgroup.labels.remove(label)

                db.session.commit()

        # Update tags
        for tag in cluster.tags:
            first_iteration = True
            while first_iteration or labelgroups:
                first_iteration = False

                labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==cluster.task_id)\
                                .filter(~Labelgroup.tags.contains(tag))\
                                .distinct().limit(10000).all()
                
                for labelgroup in labelgroups:
                    labelgroup.tags.append(tag)

                db.session.commit()

        tags = db.session.query(Tag).filter(Tag.task_id==cluster.task_id).distinct().all()
        tags = [r for r in tags if r not in cluster.tags]
        
        # Remove tags
        for tag in tags:
            first_iteration = True
            while first_iteration or labelgroups:
                first_iteration = False

                labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==cluster.task_id)\
                                .filter(~Cluster.tags.contains(tag))\
                                .filter(Labelgroup.tags.contains(tag))\
                                .distinct().limit(10000).all()
                
                for labelgroup in labelgroups:
                    labelgroup.tags.remove(tag)

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

    return True 

def hideSmallDetections(survey_id,ignore_small_detections,edge):
    ''' Sets all small detections to hidden for a survey.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey.status in Config.SURVEY_READY_STATUSES:
        survey.status = 'Processing'
        db.session.commit()

    # Don't edit the Detection.status != 'deleted' line
    detections = db.session.query(Detection)\
                            .join(Image) \
                            .join(Camera) \
                            .join(Trapgroup) \
                            .filter(Trapgroup.survey_id==survey_id) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','masked'])) \
                            .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) < Config.SMALL_DET_AREA)

    if (not edge) and (ignore_small_detections==False) and (survey.sky_masked==True):
        detections = detections.filter(Detection.bottom>=Config.SKY_CONST)
    
    detections = detections.distinct().all()

    if ignore_small_detections==True:
        status = 'hidden'
    else:
        status = 'active'
                            
    # for chunk in chunker(detections,1000):
    for detection in detections:
        detection.status = status

    survey = db.session.query(Survey).get(survey_id)
    if ignore_small_detections==True:
        survey.ignore_small_detections = True
    else:
        survey.ignore_small_detections = False
    db.session.commit()

    return True

def maskSky(survey_id,sky_masked,edge):
    ''' Masks all detections in the sky for a survey.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey.status in Config.SURVEY_READY_STATUSES:
        survey.status = 'Processing'
        db.session.commit()

    # Don't edit the Detection.status != 'deleted' line
    detections = db.session.query(Detection)\
                            .join(Image) \
                            .join(Camera) \
                            .join(Trapgroup) \
                            .filter(Trapgroup.survey_id==survey_id) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','masked'])) \
                            .filter(Detection.bottom<Config.SKY_CONST)


    if (not edge) and (sky_masked==False) and (survey.ignore_small_detections==True):
        detections.filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.SMALL_DET_AREA)
                            
    detections = detections.distinct().all()

    if sky_masked==True:
        status = 'hidden'
    else:
        status = 'active'
                            
    # for chunk in chunker(detections,1000):
    for detection in detections:
        detection.status = status

    survey = db.session.query(Survey).get(survey_id)
    if sky_masked==True:
        survey.sky_masked = True
    else:
        survey.sky_masked = False

    db.session.commit()

    return True

def get_utc_offset(lat,lon):
    '''Returns a timedelta object for the current time zone of a given set of coordinates'''
    try:
        tf = timezonefinder.TimezoneFinder()
        timezone_str = tf.timezone_at(lat=lat, lng=lon)
        tz = pytz.timezone(timezone_str)
        offset = datetime.utcnow().astimezone(tz).utcoffset()
    except:
        offset = timedelta(hours=0)
    return offset