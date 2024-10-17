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

from app import app, db, celery
from app.models import *
from app.functions.globals import getQueueLengths, getImagesProcessing, getInstanceCount, getInstancesRequired, launch_instances, manageDownload, resolve_abandoned_jobs, \
deleteTurkcodes, createTurkcodes, deleteFile, cleanup_empty_restored_images
from app.functions.imports import import_survey
from app.functions.admin import stop_task, edit_survey
from app.functions.annotation import freeUpWork, wrapUpTask, launch_task
from app.functions.archive import restore_images_for_id, restore_files_for_download, process_files_for_download, extract_zips
from app.functions.individualID import calculate_detection_similarities
import GLOBALS
from sqlalchemy.sql import func, distinct, or_, alias, and_
from sqlalchemy import desc
from datetime import datetime, timedelta
from config import Config
import traceback
import boto3
import re
import math 
import ast
import json

@celery.task(ignore_result=True)
def importMonitor():
    '''Periodic Celery task that monitors the length of the celery queues, and fires up EC2 instances as needed.'''
    
    try:
        startTime = datetime.utcnow()
        queues = getQueueLengths()
        commit = None

        if queues:
            ec2 = boto3.resource('ec2', region_name=Config.AWS_REGION)
            client = boto3.client('ec2',region_name=Config.AWS_REGION)
            images_processing, commit = getImagesProcessing()
            if Config.DEBUGGING: print('Images being imported: {}'.format(images_processing))

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
                
                if not GLOBALS.redisClient.get(queue+'_last_launch'):
                    GLOBALS.redisClient.set(queue+'_last_launch',0)

                instances_required[queue] = getInstancesRequired(current_instances[queue],
                                                                queue_type,
                                                                queues[queue],
                                                                images_processing['total'],
                                                                int(GLOBALS.redisClient.get(queue+'_last_launch').decode()),
                                                                rate,
                                                                launch_delay,
                                                                max_instances)
                
                # pre-emptively launch GPU instances with the CPU importers to smooth out control loop
                if queue=='celery':
                    instances_required[queue] += round(images_processing[queue]/10000)*Config.QUEUES[queue]['init_size']
                    
                if (queue not in Config.QUEUES.keys()) and (queue in images_processing.keys()):
                    instances_required[queue] += round(images_processing[queue]/10000)*init_size

                if instances_required[queue] > max_instances: instances_required[queue] = max_instances

            if Config.DEBUGGING: print('Instances required: {}'.format(instances_required))

            # # Check database capacity requirement (parallel & default)
            # required_capacity = 1*(instances_required['default'] + instances_required['parallel'])
            # current_capacity = scaleDbCapacity(required_capacity)

            # # Get time since last db scaling request
            # aurora_request_count = GLOBALS.redisClient.get('aurora_request_count')
            # if not aurora_request_count:
            #     aurora_request_count = 0
            # else:
            #     aurora_request_count = int(aurora_request_count.decode())

            # Launch Instances
            # if (current_capacity >= required_capacity) or (aurora_request_count >= 2):
            #     GLOBALS.redisClient.set('aurora_request_count',0)
            
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
                    launch_instances(queue,ami,user_data,instance_count,idle_multiplier,ec2,instances,instance_rates,git_pull,subnet)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        # self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        if commit: db.session.commit()
        db.session.remove()
        countdown = 20 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        importMonitor.apply_async(queue='priority', priority=0, countdown=countdown)

    return True

@celery.task(ignore_result=True)
def clean_up_redis():
    ''' Periodic function to manually clean up redis cache'''

    try:
        startTime = datetime.utcnow()
        redisKeys = [r.decode() for r in GLOBALS.redisClient.keys()]

        for key in redisKeys:

            if any(name in key for name in ['active_jobs','job_pool','active_individuals','active_indsims','quantiles_']):
                task_id = key.split('_')[-1]

                if task_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    task = db.session.query(Task).get(int(task_id))
                    if (task==None) or (task.status not in ['PENDING','PROGRESS']):
                        GLOBALS.redisClient.delete(key)

            elif any(name in key for name in ['clusters_allocated']):
                user_id = key.split('_')[-1]

                if user_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    user = db.session.query(User).get(int(user_id))
                    if (user==None) or (datetime.utcnow() - user.last_ping > timedelta(minutes=3)):
                        GLOBALS.redisClient.delete(key)

            elif any(name in key for name in ['trapgroups']):
                survey_id = key.split('_')[-1]

                if survey_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    task = db.session.query(Task).filter(Task.survey_id==int(survey_id)).filter(Task.status.in_(['PENDING','PROGRESS'])).first()
                    if not task:
                        GLOBALS.redisClient.delete(key)

            elif any(name in key for name in ['analysis']):
                user_id = key.split('_')[-1]

                if user_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    user = db.session.query(User).get(int(user_id))
                    if datetime.utcnow() - user.last_ping > timedelta(minutes=15):   # Not sure what to use for timedelta here
                        app.logger.info('Deleting analysis key {}'.format(key))
                        try:
                            result_id = GLOBALS.redisClient.get(key).decode()
                            celery.control.revoke(result_id, terminate=True)
                        except:
                            pass
                        GLOBALS.redisClient.delete(key)

            # clusters_remaining = int(GLOBALS.redisClient.get('clusters_remaining_'+str(item[0])).decode())
            elif any(name in key for name in ['clusters_remaining_']):
                task_id = key.split('_')[-1]

                if task_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    task = db.session.query(Task).get(int(task_id))
                    if (task==None) or (task.status not in ['PROGRESS']):
                        GLOBALS.redisClient.delete(key)

            # Manage downloads here
            elif any(name in key for name in ['download_ping']):
                task_id = key.split('_')[-1]

                if task_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    try:
                        timestamp = GLOBALS.redisClient.get(key)
                        if timestamp:
                            timestamp = datetime.fromtimestamp(float(timestamp.decode()))
                            if datetime.utcnow() - timestamp > timedelta(minutes=10):
                                manageDownload(task_id)
                            else:
                                checkRestoreDownloads(task_id)
                    except:
                        GLOBALS.redisClient.delete(key)

            # Manage uploads here
            elif any(name in key for name in ['upload_ping']):
                survey_id = key.split('_')[-1]

                if survey_id == 'None':
                    GLOBALS.redisClient.delete(key)
                    GLOBALS.redisClient.delete('upload_user_'+str(survey_id))
                else:
                    try:
                        timestamp = GLOBALS.redisClient.get(key)
                        if timestamp:
                            timestamp = datetime.fromtimestamp(float(timestamp.decode()))
                            if datetime.utcnow() - timestamp > timedelta(minutes=10):
                                GLOBALS.redisClient.delete('upload_ping_'+str(survey_id))
                                GLOBALS.redisClient.delete('upload_user_'+str(survey_id))
                    except:
                        GLOBALS.redisClient.delete(key)
                        GLOBALS.redisClient.delete('upload_user_'+str(survey_id))

            # Manage Knockdown here
            elif any(name in key for name in ['knockdown_ping']):
                task_id = key.split('_')[-1]

                if task_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    try:
                        timestamp = GLOBALS.redisClient.get(key)
                        if timestamp:
                            timestamp = datetime.fromtimestamp(float(timestamp.decode()))
                            if datetime.utcnow() - timestamp > timedelta(minutes=5):
                                # Add wrap up knockdown function here or whatever
                                task = db.session.query(Task).get(int(task_id))
                                if task.status == 'Knockdown Analysis':
                                    task.status = 'successInitial'
                                    db.session.commit()
                                GLOBALS.redisClient.delete('knockdown_ping_'+str(task_id))
                    except:
                        GLOBALS.redisClient.delete(key)

            # Manage Static Detection Check here
            elif any(name in key for name in ['static_check_ping']):
                survey_id = key.split('_')[-1]

                if survey_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    try:
                        timestamp = GLOBALS.redisClient.get(key)
                        if timestamp:
                            timestamp = datetime.fromtimestamp(float(timestamp.decode()))
                            if datetime.utcnow() - timestamp > timedelta(minutes=5):
                                survey = db.session.query(Survey).get(int(survey_id))
                                if 'preprocessing' in survey.status.lower():
                                    survey.status = "Preprocessing," + survey.status.split(',')[1] + ",Available"
                                    db.session.commit()
                                GLOBALS.redisClient.delete('static_check_ping_'+str(survey_id))
                    except:
                        GLOBALS.redisClient.delete(key)

            # Manage Video Timestamp Check here
            elif any(name in key for name in ['timestamp_check_ping']):
                survey_id = key.split('_')[-1]

                if survey_id == 'None':
                    GLOBALS.redisClient.delete(key)
                else:
                    try:
                        timestamp = GLOBALS.redisClient.get(key)
                        if timestamp:
                            timestamp = datetime.fromtimestamp(float(timestamp.decode()))
                            if datetime.utcnow() - timestamp > timedelta(minutes=5):
                                survey = db.session.query(Survey).get(int(survey_id))
                                if 'preprocessing' in survey.status.lower():
                                    survey.status = "Preprocessing,Available," + survey.status.split(',')[2]
                                    db.session.commit()
                                GLOBALS.redisClient.delete('timestamp_check_ping_'+str(survey_id))
                    except:
                        GLOBALS.redisClient.delete(key)

            elif any(name in key for name in ['user_individuals','user_indsims']):
                user_id = key.split('_')[-1]

                if not user_id.isdigit():
                    GLOBALS.redisClient.delete(key)
                else:
                    user = db.session.query(User).get(int(user_id))
                    if user==None:
                        GLOBALS.redisClient.delete(key)
                    elif datetime.utcnow() - user.last_ping > timedelta(minutes=3):
                        resolve_abandoned_jobs([[user,user.turkcode[0].task]])

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        countdown = 20 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        clean_up_redis.apply_async(queue='priority', priority=0, countdown=countdown)

    return True

@celery.task(ignore_result=True)
def manageTasks():
    '''Celery task for managing active tasks. Keeps the correct number of active jobs, cleans up abandoned jobs, and cleans up the task upon completion.'''

    try:
        startTime = datetime.utcnow()
        session = db.session()

        # # Check Knockdown for timeout
        # tasks = session.query(Task)\
        #                 .join(Survey)\
        #                 .join(Organisation)\
        #                 .join(UserPermissions)\
        #                 .join(User,UserPermissions.user_id==User.id)\
        #                 .filter(User.last_ping < (datetime.utcnow()-timedelta(minutes=5)))\
        #                 .filter(Task.status=='Knockdown Analysis')\
        #                 .distinct().all()
        
        # for task in tasks:
        #     task.status = 'successInitial'

        # #Look for abandoned jobs
        # abandoned_jobs = session.query(User,Task)\
        #                         .join(Turkcode,Turkcode.user_id==User.id)\
        #                         .join(Task)\
        #                         .filter(User.parent_id!=None)\
        #                         .filter(~User.passed.in_(['cTrue','cFalse']))\
        #                         .filter(User.last_ping<(datetime.utcnow()-timedelta(minutes=3)))\
        #                         .filter(Turkcode.active==False)\
        #                         .all()

        # if abandoned_jobs:
        #     resolve_abandoned_jobs(abandoned_jobs,session)
        #     session.commit()

        # # Ensure there are no locked-out individuals
        # allocateds = session.query(IndSimilarity)\
        #                     .join(User)\
        #                     .filter(User.passed.in_(['cTrue','cFalse']))\
        #                     .distinct().all()
        
        # for allocated in allocateds:
        #     allocated.allocated = None
        #     allocated.allocation_timestamp = None

        # allocateds = session.query(Individual)\
        #                     .join(User, User.id==Individual.allocated)\
        #                     .filter(User.passed.in_(['cTrue','cFalse']))\
        #                     .distinct().all()
        
        # for allocated in allocateds:
        #     allocated.allocated = None
        #     allocated.allocation_timestamp = None

        # #Catch trapgroups that are still allocated to users that are finished
        # trapgroups = session.query(Trapgroup)\
        #                     .join(User)\
        #                     .filter(User.passed.in_(['cTrue','cFalse']))\
        #                     .distinct().all()

        # for trapgroup in trapgroups:
        #     trapgroup.user_id = None

        # session.commit()

        Worker = alias(User)
        task_ids = [r[0] for r in session.query(Task.id)\
                        .outerjoin(Survey)\
                        .outerjoin(Organisation)\
                        .outerjoin(UserPermissions)\
                        .outerjoin(User,UserPermissions.user_id==User.id)\
                        .outerjoin(Turkcode,Turkcode.task_id==Task.id)\
                        .outerjoin(Worker,Turkcode.user_id==Worker.c.id)\
                        .filter(or_(
                            User.last_ping>(datetime.utcnow()-timedelta(minutes=5)),
                            Worker.c.last_ping>(datetime.utcnow()-timedelta(minutes=5)),
                            ))\
                        .filter(Task.status=='PROGRESS')\
                .distinct().all()]
        print('{} tasks are currently active.'.format(len(task_ids)))

        active_jobs = []
        for task_id in task_ids:
            active_jobs.extend([r.decode() for r in GLOBALS.redisClient.smembers('active_jobs_'+str(task_id))])

        #Look for abandoned jobs
        abandoned_jobs = session.query(User,Task)\
                            .join(Turkcode,Turkcode.user_id==User.id)\
                            .join(Task)\
                            .filter(User.parent_id!=None)\
                            .filter(Turkcode.code.in_(active_jobs))\
                            .filter(User.last_ping<(datetime.utcnow()-timedelta(minutes=3)))\
                            .all()

        if abandoned_jobs:
            resolve_abandoned_jobs(abandoned_jobs,session)
            session.commit()

        # Look for checked-out jobs that were never started (often due to the tutorial)
        abandoned_jobs = session.query(Turkcode)\
                            .filter(Turkcode.user_id==None)\
                            .filter(Turkcode.assigned<(datetime.utcnow()-timedelta(minutes=5)))\
                            .all()

        for abandoned_job in abandoned_jobs:
            abandoned_job.active = True
            abandoned_job.assigned = None
            GLOBALS.redisClient.srem('active_jobs_'+str(abandoned_job.task_id),abandoned_job.code)
            GLOBALS.redisClient.sadd('job_pool_'+str(abandoned_job.task_id),abandoned_job.code)

        # # Ensure there are no locked-out individuals
        # allocateds = session.query(IndSimilarity)\
        #                     .join(User)\
        #                     .filter(~User.username.in_(active_jobs))\
        #                     .distinct().all()
        
        # for allocated in allocateds:
        #     allocated.allocated = None
        #     allocated.allocation_timestamp = None

        # allocateds = session.query(Individual)\
        #                     .join(User, User.id==Individual.allocated)\
        #                     .filter(~User.username.in_(active_jobs))\
        #                     .distinct().all()
        
        # for allocated in allocateds:
        #     allocated.allocated = None
        #     allocated.allocation_timestamp = None

        #Catch trapgroups that are still allocated to users that are finished
        trapgroups = session.query(Trapgroup)\
                            .join(User)\
                            .filter(~User.username.in_(active_jobs))\
                            .distinct().all()

        for trapgroup in trapgroups:
            trapgroup.user_id = None

        session.commit()
        session.close()

        # pool = Pool(processes=4)
        wrapUps = []
        jobs_to_delete = {}
        for task_id in task_ids:
            wrapUp, jobs_to_delete[task_id] = manage_task(task_id)
            # if wrapUp: wrapUps.append(task_id)
            # pool.apply_async(manage_task,(task_id,))
        # pool.close()
        # pool.join()

        # session.commit()

        # Delete excess jobs
        for task_id in jobs_to_delete.keys():
            deleteTurkcodes(jobs_to_delete[task_id], task_id)

        # # Wrap up finished tasks
        # for task_id in wrapUps:
        #     wrapUpTask.delay(task_id=task_id)

        manage_tasks_with_restore()
        
    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        session.close()
        if Config.DEBUGGING: print('Manage tasks completed in {}'.format(datetime.utcnow()-startTime))
        countdown = 20 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        manageTasks.apply_async(queue='priority', priority=0, countdown=countdown)
        
    return True

def manage_task(task_id):
    '''Manages an active task by controlling the number of active jobs, cleaning up item statuses, and even cleans up tasks when annotation is complete.'''

    session = db.session()
    task = session.query(Task).get(task_id)
    taggingLevel = task.tagging_level
    survey_id = task.survey_id
    jobs_to_delete = 0
    quantiles_finished = False

    # if not populateMutex(int(task_id)):
    #     return False, jobs_to_delete

    #Manage number of workers
    if '-5' in taggingLevel:
        task_ids = [r.id for r in task.sub_tasks]
        task_ids.append(task.id)
        tL = re.split(',',taggingLevel)
        species = tL[1]
        OtherIndividual = alias(Individual)
        OtherIndividualTasks = alias(individualTasks)

        sq1 = session.query(Individual.id.label('indID1'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .join(OtherIndividualTasks,OtherIndividualTasks.c.individual_id==OtherIndividual.c.id)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(OtherIndividual.c.species==species)\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(OtherIndividualTasks.c.task_id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq2 = session.query(Individual.id.label('indID2'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                        .join(OtherIndividualTasks,OtherIndividualTasks.c.individual_id==OtherIndividual.c.id)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(OtherIndividual.c.species==species)\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(OtherIndividualTasks.c.task_id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        individuals_remaining = session.query(Individual)\
                        .join(Task,Individual.tasks)\
                        .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                        .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
                        .distinct().count()
        
        max_workers_possible = individuals_remaining

        # Dynamic individual ID threshold
        if individuals_remaining < 1:
            current_quantile = int(tL[3])
            
            if current_quantile==0:
                quantiles_finished = True
            
            else:
                quantiles = GLOBALS.redisClient.get('quantiles_'+str(task_id))
                
                try:
                    quantiles = ast.literal_eval(quantiles.decode())
                    available_quantiles = list(quantiles.keys())
                    available_quantiles.sort(reverse=True)
                    new_quantile = available_quantiles[available_quantiles.index(current_quantile)+1]
                    threshold = quantiles[new_quantile]

                    # When quantile is changed, release the skips back into the pool
                    skips = session.query(IndSimilarity)\
                                    .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                    .join(Task,Individual.tasks)\
                                    .join(OtherIndividual,IndSimilarity.individual_2==OtherIndividual.c.id)\
                                    .join(OtherIndividualTasks,OtherIndividualTasks.c.individual_id==OtherIndividual.c.id)\
                                    .filter(Task.id.in_(task_ids))\
                                    .filter(Individual.species==species)\
                                    .filter(IndSimilarity.skipped==True)\
                                    .filter(OtherIndividualTasks.c.task_id.in_(task_ids))\
                                    .filter(OtherIndividual.c.species==species)\
                                    .distinct().all()
                    
                    for skip in skips:
                        skip.skipped = False
                
                except:
                    threshold = 0
                    new_quantile = 0

                tL[2] = str(threshold)
                tL[3] = str(new_quantile)
                task.tagging_level = ','.join(tL)
                session.commit()

    else:
        max_workers_possible = session.query(Trapgroup) \
                        .join(Camera) \
                        .join(Image) \
                        .join(Cluster, Image.clusters) \
                        .filter(Cluster.task_id == task_id) \
                        .filter(Cluster.examined==False)\
                        .filter(Trapgroup.active == True) \
                        .distinct().count()

    if max_workers_possible != 1:
        max_workers_possible = math.floor(max_workers_possible * 0.9)
    else:
        max_workers_possible = 1

    #Check job count
    task_jobs = GLOBALS.redisClient.scard('job_pool_'+str(task_id))
    active_jobs = GLOBALS.redisClient.scard('active_jobs_'+str(task_id))
    # task_jobs = session.query(Turkcode).filter(Turkcode.task_id==task_id).filter(Turkcode.active==True).count()
    # active_jobs = session.query(Turkcode) \
    #                             .join(User) \
    #                             .filter(User.parent_id!=None) \
    #                             .filter(~User.passed.in_(['cTrue','cFalse'])) \
    #                             .filter(Turkcode.task_id==task_id) \
    #                             .filter(Turkcode.active==False) \
    #                             .count()
    task_jobs += active_jobs

    if task_jobs < max_workers_possible:
        if Config.DEBUGGING: app.logger.info('Creating {} new jobs.'.format(max_workers_possible - task_jobs))
        createTurkcodes(max_workers_possible - task_jobs, task_id, session)
    elif (task_jobs > max_workers_possible):
        if Config.DEBUGGING: app.logger.info('Removing {} excess jobs.'.format(task_jobs - max_workers_possible))
        jobs_to_delete = task_jobs - max_workers_possible
        # deleteTurkcodes(task_jobs - max_workers_possible, task_id, session)

    #Check if finished:
    if '-5' in taggingLevel:
        clusters_remaining = individuals_remaining
    else:
        clusters_remaining = session.query(Cluster)\
                        .filter(Cluster.task_id == task_id)\
                        .filter(Cluster.examined==False)\
                        .count()

    # task.clusters_remaining = clusters_remaining
    GLOBALS.redisClient.set('clusters_remaining_'+str(task_id), clusters_remaining)

    # # make sure trapgroup pool is correct:
    # trapgroups = session.query(Trapgroup) \
    #                 .join(Camera) \
    #                 .join(Image) \
    #                 .join(Cluster, Image.clusters) \
    #                 .filter(Cluster.task_id == task_id) \
    #                 .filter(Trapgroup.processing == False) \
    #                 .filter(Trapgroup.queueing == False)\
    #                 .filter(Trapgroup.user_id == None)\
    #                 .filter(Cluster.examined==False)\
    #                 .filter(~Trapgroup.id.in_([int(r.decode()) for r in GLOBALS.redisClient.lrange('trapgroups_'+str(survey_id), 0, -1)]))\
    #                 .distinct().all()

    # for trapgroup in trapgroups:
    #     GLOBALS.redisClient.lrem('trapgroups_'+str(survey_id),0,trapgroup.id)
    #     GLOBALS.redisClient.lpush('trapgroups_'+str(survey_id), trapgroup.id)

    session.commit()
    session.close()

    if (clusters_remaining==0) and (active_jobs==0) and (('-5' not in taggingLevel) or quantiles_finished):
        processing = session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(or_(Trapgroup.processing==True,Trapgroup.queueing==True)).first()

        if not processing:
            app.logger.info('Task finished.')
            task = session.query(Task).get(task_id)
            task.status = 'Wrapping Up'
            session.commit()
            session.close()
            wrapUpTask.delay(task_id=task_id)
            return True, jobs_to_delete

    if '-5' not in taggingLevel: freeUpWork(task_id)

    return False, jobs_to_delete  

def manage_tasks_with_restore():
    ''' Manages tasks which use images that have been restored from Glacier '''

    restored_tasks = db.session.query(Task.id, Task.tagging_level, Survey.id, Survey.id_restore, Survey.empty_restore, func.max(User.last_ping).label('last_active'))\
                    .join(Survey, Task.survey_id==Survey.id)\
                    .outerjoin(Turkcode, Turkcode.task_id==Task.id)\
                    .outerjoin(User, Turkcode.user_id==User.id)\
                    .filter(Task.status=='PROGRESS')\
                    .filter(or_(Task.tagging_level.contains('-4'),Task.tagging_level.contains('-5'),Task.tagging_level.contains('-7')))\
                    .filter(or_(User.parent_id!=None,User.id==None))\
                    .group_by(Task.id)\
                    .distinct().all()

    
    for data in restored_tasks:
        task_id = data[0]
        tagging_level = data[1]
        survey_id = data[2]
        id_restore = data[3]
        empty_restore = data[4]
        last_active = data[5]
        date_now = datetime.utcnow()

        if '-7' in tagging_level:
            if empty_restore:
                expiry_date = (empty_restore + timedelta(days=30, seconds=Config.RESTORE_TIME)).replace(hour=0,minute=0,second=0,microsecond=0)
                time_left = expiry_date - date_now

                if time_left.days < 1:
                    if last_active:
                        if (date_now - last_active).days > 5:
                            stop_task.delay(task_id=task_id)
                    else:
                        stop_task.delay(task_id=task_id)
        else:
            if id_restore:
                expiry_date = (id_restore + timedelta(days=Config.ID_RESTORE_DAYS, seconds=Config.RESTORE_TIME)).replace(hour=0,minute=0,second=0,microsecond=0)
                time_left = expiry_date - date_now

                if time_left.days < 1:
                    if last_active:
                        if (date_now - last_active).days > 5:
                            stop_task.delay(task_id=task_id)
                        else:
                            survey = db.session.query(Survey).get(survey_id)
                            survey.id_restore = date_now
                            db.session.commit()
                            restore_images_for_id.apply_async(kwargs={'task_id':task_id,'days':Config.ID_RESTORE_DAYS+1, 'extend':True})
                    else:
                        stop_task.delay(task_id=task_id)

    return True

@celery.task(ignore_result=True)
def monitor_live_data_surveys():
    '''Celery task that monitors surveys with live data and schedules and import for them.'''
    try:

        task_sq = db.session.query(Task.survey_id).filter(Task.status.notin_(Config.TASK_READY_STATUSES)).distinct().subquery()
        surveys = db.session.query(Survey)\
                            .join(Trapgroup)\
                            .join(Camera)\
                            .join(Image)\
                            .join(APIKey)\
                            .outerjoin(task_sq,task_sq.c.survey_id==Survey.id)\
                            .filter(Survey.status.in_(Config.SURVEY_READY_STATUSES))\
                            .filter(APIKey.api_key!=None)\
                            .filter(or_(~Image.clusters.any(),~Image.detections.any()))\
                            .filter(task_sq.c.survey_id==None)\
                            .distinct().all()

        if Config.DEBUGGING: app.logger.info('Found {} surveys with live data to import'.format(len(surveys)))

        for survey in surveys:
            survey.status = 'Import Queued'

        launched_tasks = db.session.query(Task)\
                                    .join(Survey)\
                                    .join(Trapgroup)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(APIKey)\
                                    .filter(Task.status.in_(['PENDING','PROGRESS']))\
                                    .filter(~Survey.status.in_(Config.SURVEY_READY_STATUSES))\
                                    .filter(APIKey.api_key!=None)\
                                    .filter(or_(~Image.clusters.any(),~Image.detections.any()))\
                                    .distinct().all()

        if Config.DEBUGGING: app.logger.info('Found {} surveys with live data that are launched'.format(len(launched_tasks)))
        for task in launched_tasks:
            task.status = 'Stopping'

        db.session.commit()

        for survey in surveys:
            import_survey.delay(survey_id=survey.id, live=True)

        for task in launched_tasks:
            stop_task.delay(task_id=task.id, live=True)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        #Schedule every 24hours
        monitor_live_data_surveys.apply_async(queue='priority', priority=0,countdown=86400)

    return True

@celery.task(ignore_result=True)
def manageDownloadRequests():
    '''Celery task that manages download requests for users'''	

    try:
        date_now = datetime.utcnow()
        download_requests = db.session.query(DownloadRequest, Survey.download_restore).join(Task,DownloadRequest.task_id==Task.id).join(Survey).distinct().all()
        for req in download_requests:
            request = req[0]
            survey_restore = req[1]
            expiry_date = (survey_restore + timedelta(days=Config.DOWNLOAD_RESTORE_DAYS, seconds=Config.RESTORE_TIME)).replace(hour=0,minute=0,second=0,microsecond=0) if survey_restore else None
            if request.type == 'file':
                task_id = request.task_id
                if request.status == 'Downloading':
                    # Check if the download is still active
                    redis_keys = [r.decode() for r in GLOBALS.redisClient.keys()]
                    if 'download_ping_'+str(task_id) not in redis_keys:
                        if expiry_date and expiry_date > date_now and 'fileDownloadParams_'+str(task_id)+'_'+str(request.user_id) in redis_keys:
                            request.status = 'Available'
                            request.timestamp = date_now
                            db.session.commit()
                        else:
                            try:
                                include_empties = json.loads(GLOBALS.redisClient.get('fileDownloadParams_'+str(task_id)+'_'+str(request.user_id)).decode())['include_empties']
                                if include_empties: cleanup_empty_restored_images.delay(task_id=task_id)
                            except:
                                pass
                            GLOBALS.redisClient.delete('fileDownloadParams_'+str(task_id)+'_'+str(request.user_id))
                            db.session.delete(request)
                else:
                    if expiry_date and expiry_date <= date_now:
                        GLOBALS.redisClient.delete('fileDownloadParams_'+str(task_id)+'_'+str(request.user_id))
                        db.session.delete(request)
                    elif not expiry_date:
                        if request.timestamp + timedelta(days=Config.DOWNLOAD_RESTORE_DAYS) <= date_now:
                            GLOBALS.redisClient.delete('fileDownloadParams_'+str(task_id)+'_'+str(request.user_id))
                            db.session.delete(request)
            else:
                if request.status == 'Available':
                    if request.timestamp + timedelta(days=7) <= date_now:
                        if request.name:
                            fileName = request.task.survey.organisation.folder+'/docs/'+request.task.survey.organisation.name+'_'+request.user.username+'_'+request.task.survey.name+'_'+request.task.name +'_'+ request.name +'.' + Config.RESULT_TYPES[request.type]
                            deleteFile.apply_async(kwargs={'fileName': fileName})
                            db.session.delete(request)
        
        db.session.commit() 

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        #Schedule every 24hours
        manageDownloadRequests.apply_async(queue='priority', priority=0,countdown=86400)


    return True

def checkRestoreDownloads(task_id):
    '''Function that checks if there are any downloads with restored images that require the files restoration to be extended'''

    survey = db.session.query(Survey).join(Task).filter(Task.id==task_id).first()
    date_now = datetime.utcnow()
    if survey.download_restore and survey.download_restore >= (date_now - timedelta(days=Config.DOWNLOAD_RESTORE_DAYS, seconds=Config.RESTORE_TIME)): 
        expiry_date = (survey.download_restore + timedelta(days=Config.DOWNLOAD_RESTORE_DAYS, seconds=Config.RESTORE_TIME)).replace(hour=0,minute=0,second=0,microsecond=0)
        if (expiry_date - date_now).days < 1:
            download_requests = db.session.query(DownloadRequest).filter(DownloadRequest.task_id == task_id).filter(DownloadRequest.type == 'file').filter(DownloadRequest.status == 'Downloading').all()
            for request in download_requests:
                try:
                    user_id = request.user_id
                    download_params = GLOBALS.redisClient.get('fileDownloadParams_'+str(task_id)+'_'+str(user_id)).decode()
                    download_params = json.loads(download_params)
                    survey.download_restore = date_now
                    db.session.commit()
                    restore_files_for_download.apply_async(kwargs={'task_id':task_id,'user_id':user_id,'days':Config.DOWNLOAD_RESTORE_DAYS+1,'download_params':download_params,'extend':True})
                except:
                    continue

    return True

@celery.task(ignore_result=True)
def monitorFileRestores():
    '''Celery task that monitors restores and schedules tasks for restored images that require processing'''
    try:
        start_restore = datetime.now() - timedelta(seconds=Config.RESTORE_TIME)

        surveys = db.session.query(Survey)\
                            .filter(Survey.require_launch==True)\
                            .filter(Survey.status.in_(Config.SURVEY_READY_STATUSES))\
                            .filter(or_(
                                Survey.download_restore<start_restore,
                                Survey.id_restore<start_restore,
                                Survey.empty_restore<start_restore,
                                Survey.edit_restore<start_restore
                            ))\
                            .distinct().all()
        
        for survey in surveys: 
            try:
                restore_dates = [survey.download_restore,survey.id_restore,survey.empty_restore,survey.edit_restore]
                restore_dates = [r for r in restore_dates if r]
                max_restore = max(restore_dates)
                if survey.download_restore and survey.download_restore<start_restore and survey.download_restore==max_restore:
                    launch_kwargs = GLOBALS.redisClient.get('download_launch_kwargs_'+str(survey.id)).decode()
                    launch_kwargs = json.loads(launch_kwargs)  
                    survey.require_launch = False
                    process_files_for_download.apply_async(kwargs=launch_kwargs)
                    GLOBALS.redisClient.delete('download_launch_kwargs_'+str(survey.id))

                elif survey.id_restore and survey.id_restore<start_restore and survey.id_restore==max_restore:
                    launch_kwargs = GLOBALS.redisClient.get('id_launch_kwargs_'+str(survey.id)).decode()
                    launch_kwargs = json.loads(launch_kwargs)                  
                    survey.require_launch = False
                    if 'algorithm' in launch_kwargs.keys():
                        calculate_detection_similarities.apply_async(kwargs=launch_kwargs)
                    else:
                        launch_task.apply_async(kwargs=launch_kwargs)
                    GLOBALS.redisClient.delete('id_launch_kwargs_'+str(survey.id))

                elif survey.empty_restore and survey.empty_restore<start_restore and survey.empty_restore==max_restore:
                    launch_kwargs = GLOBALS.redisClient.get('empty_launch_kwargs_'+str(survey.id)).decode()
                    launch_kwargs = json.loads(launch_kwargs)  
                    survey.require_launch = False
                    extract_zips.apply_async(kwargs=launch_kwargs)
                    GLOBALS.redisClient.delete('empty_launch_kwargs_'+str(survey.id))

                elif survey.edit_restore and survey.edit_restore<start_restore and survey.edit_restore==max_restore:
                    launch_kwargs = GLOBALS.redisClient.get('edit_launch_kwargs_'+str(survey.id)).decode()
                    launch_kwargs = json.loads(launch_kwargs)  
                    survey.require_launch = False
                    edit_survey.apply_async(kwargs=launch_kwargs)
                    GLOBALS.redisClient.delete('edit_kwargs_'+str(survey.id))
            except:
                continue
               
        if surveys:
            db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        #Schedule every 15 minutes
        monitorFileRestores.apply_async(queue='priority', priority=0,countdown=900)

    return True

@celery.task(ignore_result=True)
def monitorSQS():
    '''Celery task that monitors the SQS queue for new messages'''
    try:
    
        response = GLOBALS.sqsClient.receive_message(
            QueueUrl=GLOBALS.sqsQueueUrl,
            AttributeNames=[
                'All'
            ],
            MaxNumberOfMessages=10,
            MessageAttributeNames=[
                'All'
            ],
            VisibilityTimeout=60,
            WaitTimeSeconds=20
        )
        messages = response.get('Messages', [])
        while messages:
            for message in messages:
                if 'MessageAttributes' in message.keys():
                    message_attributes = message['MessageAttributes']
                    if 'ErrorCode' in message_attributes.keys():
                        error_code = message_attributes['ErrorCode']['StringValue']
                        if error_code in ['429','503']:
                            payload = json.loads(message['Body'])
                            if 'batch' in payload.keys():
                                GLOBALS.lambdaClient.invoke(FunctionName=Config.VIDEO_EXTRACT_LAMBDA, InvocationType='Event', Payload=json.dumps(payload))
                                GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])
                            else:
                                key = payload['keys'][0]
                                if key.split('.')[-1].lower() in ['mp4','mov','avi']:
                                    GLOBALS.lambdaClient.invoke(FunctionName=Config.VIDEO_IMPORT_LAMBDA, InvocationType='Event', Payload=json.dumps(payload))
                                    GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])
                                else:
                                    GLOBALS.lambdaClient.invoke(FunctionName=Config.IMAGE_IMPORT_LAMBDA, InvocationType='Event', Payload=json.dumps(payload))
                                    GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])

                        else:
                            #TODO: Handle other message types
                            # GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])
                            pass

                elif "Body" in message.keys():
                    body = json.loads(message['Body'])
                    response_payload = body['responsePayload']
                    function=body['requestContext']['functionArn'].split(':')[-1]
                    if response_payload['status'] == 'success':
                        survey_id = response_payload['survey_id']
                        count = 0
                        if function == Config.VIDEO_EXTRACT_LAMBDA:
                            invoked = response_payload['invoked']
                            if invoked:
                                count = 1
                            else:
                                count = 2
                        else:
                            count = 1

                        try:
                            GLOBALS.redisClient.incrby('lambda_completed_'+str(survey_id),count)
                        except:
                            GLOBALS.redisClient.set('lambda_completed_'+str(survey_id),count)

                        GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])

                    else:
                        # GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])
                        pass

                else:
                    # GLOBALS.sqsClient.delete_message(QueueUrl=GLOBALS.sqsQueueUrl, ReceiptHandle=message['ReceiptHandle'])
                    pass
            
            # Check for more messages
            response = GLOBALS.sqsClient.receive_message(
                QueueUrl=GLOBALS.sqsQueueUrl,
                AttributeNames=[
                    'All'
                ],
                MaxNumberOfMessages=10,
                MessageAttributeNames=[
                    'All'
                ],
                VisibilityTimeout=60,
                WaitTimeSeconds=20
            )
            messages = response.get('Messages', [])

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        #Schedule every 5 minutes
        monitorSQS.apply_async(queue='priority', priority=0,countdown=300)

    return True
