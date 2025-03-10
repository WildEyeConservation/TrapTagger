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
from app.functions.globals import taggingLevelSQ, addChildLabels, resolve_abandoned_jobs, createTurkcodes, deleteTurkcodes, \
                                    updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, retryTime, chunker, \
                                    getClusterClassifications, checkForIdWork, numify_timestamp, rDets, prep_required_images, updateAllStatuses, classifyTask, cleanup_empty_restored_images,\
                                    reconcile_cluster_labelgroup_labels_and_tags
from app.functions.individualID import calculate_detection_similarities, generateUniqueName, cleanUpIndividuals, calculate_individual_similarities, check_individual_detection_mismatch, process_detections_for_individual_id
# from app.functions.results import resetImageDownloadStatus, resetVideoDownloadStatus
import GLOBALS
from sqlalchemy.sql import func, distinct, or_, alias, and_, literal_column
from sqlalchemy import desc
from datetime import datetime, timedelta
import re
import math
from config import Config
import traceback
import time
from multiprocessing.pool import ThreadPool as Pool
import ast
import numpy
import json
from celery.result import allow_join_result

@celery.task(bind=True,max_retries=5,ignore_result=True)
def launch_task(self,task_id,classify=False):
    '''Celery task for launching the specified task for annotation.'''

    try:
        app.logger.info('Started LaunchTask for task {}'.format(task_id))

        if classify:
            classifyTask(int(task_id))

        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level
        isBounding = task.is_bounding
        newIndividualsAdded = False

        if task.status != 'PENDING':
            task.status = 'PENDING'
            task.survey.status = 'Launched'
            for tsk in task.sub_tasks:
                tsk.status = 'Processing'
                tsk.survey.status = 'Launched'

            db.session.commit()

        if task.jobs_finished == None:
            task.jobs_finished = 0

        # Do some prep for individual ID tasks
        if ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            species = tL[1]

            if tL[0] == '-4':
                label = db.session.query(Label).filter(Label.task==task).filter(Label.description==species).first()

                #Start calculating detection similarities in the background
                # if tL[4]=='h':
                #     calculate_detection_similarities.delay(task_ids=[task_id],species=label.description,algorithm='hotspotter')
                # elif tL[4]=='n':
                #     calculate_detection_similarities.delay(task_ids=[task_id],species=label.description,algorithm='none')
                task.status = 'Processing'
                db.session.commit()
                if tL[4]=='h':
                    label.algorithm = 'hotspotter'
                    process_detections_for_individual_id([task_id],species)
                elif tL[4]=='n':
                    label.algorithm = 'heuristic'
                    process_detections_for_individual_id([task_id],species,pose_only=True)
                task = db.session.query(Task).get(task_id)
                if tL[3] == 'a':
                    sq = db.session.query(Cluster.id.label('clusterID'),Detection.id.label('detID'),func.count(distinct(Detection.id)).label('detCount'),func.count(distinct(Image.id)).label('imCount'))\
                                        .join(Image,Cluster.images)\
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                        .filter(Cluster.task_id==task_id)\
                                        .group_by(Cluster.id)\
                                        .subquery()

                    individualsSQ = db.session.query(Individual)\
                                    .filter(Individual.species==species)\
                                    .filter(Individual.tasks.contains(task))\
                                    .subquery()

                    detections = db.session.query(Detection)\
                                        .join(sq,sq.c.detID==Detection.id)\
                                        .outerjoin(individualsSQ,Detection.individuals)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                        .filter(individualsSQ.c.id==None)\
                                        .filter(or_(sq.c.detCount==1,sq.c.imCount==1))\
                                        .distinct().all()

                    admin = db.session.query(User).filter(User.username == 'Admin').first()
                    for detection in detections:
                        newIndividual = Individual( name=generateUniqueName(task_id,label.description,tL[2]),
                                                    species=species,
                                                    user_id=admin.id,
                                                    timestamp=datetime.utcnow())

                        db.session.add(newIndividual)
                        newIndividual.detections = [detection]
                        newIndividual.tasks = [task]
                        newIndividualsAdded = True

                    # db.session.commit()

                unidentifiable = db.session.query(Individual).filter(Individual.tasks.contains(task)).filter(Individual.species==species).filter(Individual.name=='unidentifiable').first()
                if unidentifiable == None:
                    unidentifiable = Individual(
                        name = 'unidentifiable',
                        species = species
                    )
                    db.session.add(unidentifiable)
                    unidentifiable.tasks = [task]

                # db.session.commit()

            elif tL[0] == '-5':
                task_ids = [r.id for r in task.sub_tasks]
                task_ids.append(task.id)

                # check if indsims are actually there - specifically for post timestamp edits
                if len(task_ids)==1:
                    # check = db.session.query(IndSimilarity)\
                    #                 .join(Individual, IndSimilarity.individual_1==Individual.id)\
                    #                 .join(Task,Individual.tasks)\
                    #                 .filter(Task.id.in_(task_ids))\
                    #                 .filter(Individual.species==species)\
                    #                 .first()
                    # if check==None:
                    #     calculate_individual_similarities(task.id,species)
                    #     task = db.session.query(Task).get(task_id)

                    individuals = db.session.query(Individual)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Individual.species==species)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .filter(Task.id.in_(task_ids))\
                                    .subquery()

                    indsims1 = db.session.query(Individual.id.label('indID1'), func.count(distinct(IndSimilarity.id)).label('simCount'))\
                                    .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                    .join(individuals,IndSimilarity.individual_2==individuals.c.id)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Individual.species==species)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .filter(Task.id.in_(task_ids))\
                                    .group_by(Individual.id)\
                                    .subquery()

                    indsims2 = db.session.query(Individual.id.label('indID2'), func.count(distinct(IndSimilarity.id)).label('simCount'))\
                                    .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                                    .join(individuals,IndSimilarity.individual_1==individuals.c.id)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Individual.species==species)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .filter(Task.id.in_(task_ids))\
                                    .group_by(Individual.id)\
                                    .subquery()

                    indsims_counts = db.session.query(Individual.id, func.coalesce(indsims1.c.simCount,0) + func.coalesce(indsims2.c.simCount,0))\
                                    .join(Task,Individual.tasks)\
                                    .outerjoin(indsims1,Individual.id==indsims1.c.indID1)\
                                    .outerjoin(indsims2,Individual.id==indsims2.c.indID2)\
                                    .filter(Individual.species==species)\
                                    .filter(Individual.active==True)\
                                    .filter(Individual.name!='unidentifiable')\
                                    .filter(Task.id.in_(task_ids))\
                                    .distinct().all()

                    check = False 
                    req_count = len(indsims_counts) - 1
                    if len(indsims_counts) > 1:
                        for counts in indsims_counts:
                            if counts[1] < req_count:
                                check = True
                                break

                    if check:
                        calculate_individual_similarities(task.id,species)
                        task = db.session.query(Task).get(task_id)

                # Define quantile thresholds
                desired_quantiles = Config.ID_QUANTILES
                OtherIndividual = alias(Individual)
                scores = [r[0] for r in db.session.query(IndSimilarity.score)\
                                            .join(Individual,Individual.id==IndSimilarity.individual_1)\
                                            .join(Task,Individual.tasks)\
                                            .join(OtherIndividual,IndSimilarity.individual_2==OtherIndividual.c.id)\
                                            .join(individualTasks,individualTasks.c.individual_id==OtherIndividual.c.id)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(individualTasks.c.task_id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .filter(OtherIndividual.c.species==species)\
                                            .filter(IndSimilarity.score>=0)\
                                            .filter(Individual.active==True)\
                                            .filter(OtherIndividual.c.active==True)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .filter(OtherIndividual.c.name!='unidentifiable')\
                                            .distinct().all()]
                
                quantiles = {}
                if scores:
                    for n in desired_quantiles:
                        if n == 0:
                            quantiles[n] = 0
                        else:
                            quantiles[n] = math.trunc(numpy.quantile(scores,n/100) * 100) / 100 # Truncate to 2 decimal places
                else:
                    desired_quantiles = [0]
                    quantiles = {0:0}

                GLOBALS.redisClient.set('quantiles_'+str(task_id),str(quantiles))
                
                threshold = quantiles[desired_quantiles[0]]
                tL[2] = str(threshold)
                if task.sub_tasks:
                    tL[3] = str(desired_quantiles[0])
                else:
                    tL.append(str(desired_quantiles[0]))
                task.tagging_level = ','.join(tL)
                taggingLevel = task.tagging_level

                skips = db.session.query(IndSimilarity)\
                                .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                .join(Task,Individual.tasks)\
                                .join(OtherIndividual,IndSimilarity.individual_2==OtherIndividual.c.id)\
                                .join(individualTasks,individualTasks.c.individual_id==OtherIndividual.c.id)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==species)\
                                .filter(IndSimilarity.skipped==True)\
                                .filter(individualTasks.c.task_id.in_(task_ids))\
                                .filter(OtherIndividual.c.species==species)\
                                .distinct().all()
                
                for skip in skips:
                    skip.skipped = False

                GLOBALS.redisClient.delete('active_individuals_'+str(task.id))
                GLOBALS.redisClient.delete('active_indsims_'+str(task.id))

                # db.session.commit()
        
        # Mark clusters that need to be examined
        if '-5' in taggingLevel:
            cluster_count = checkForIdWork(task_ids,species,tL[2])

            if cluster_count == 0:
                # Release task if the are no clusters to annotate
                updateAllStatuses(task_id=task_id)
                GLOBALS.redisClient.delete('quantiles_'+str(task_id))
                task = db.session.query(Task).get(task_id)
                task.status = 'SUCCESS'
                task.survey.status = 'Ready'
                for tsk in task.sub_tasks:
                    tsk.status = 'SUCCESS'
                    tsk.survey.status = 'Ready'
                db.session.commit()
                return True

        else:
            for cluster in task.clusters:
                cluster.examined = True
                cluster.skipped = False

            sq = db.session.query(Cluster) \
                .join(Image, Cluster.images) \
                .join(Detection)

            sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

            # if '-6' in taggingLevel:
            #     # NOTE: This is not currently used (is for check masked sightings)
            #     clusters = sq.filter(Cluster.task_id == task_id) \
            #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
            #                     .filter(Detection.static == False) \
            #                     .filter(Detection.status == 'masked') \
            #                     .distinct().all()

            if '-7' in taggingLevel:	
                clusters = sq.filter(Cluster.task_id == task_id).distinct().all()
            else:
                clusters = sq.filter(Cluster.task_id == task_id) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .distinct().all()

            cluster_count = len(clusters)

            if cluster_count == 0:
                # Release task if the are no clusters to annotate
                updateAllStatuses(task_id=task_id)
                task = db.session.query(Task).get(task_id)
                task.status = 'SUCCESS'
                task.survey.status = 'Ready'
                for tsk in task.sub_tasks:
                    tsk.status = 'SUCCESS'
                    tsk.survey.status = 'Ready'

                if newIndividualsAdded and '-4' in task.tagging_level:
                    tL = re.split(',',task.tagging_level)
                    species = tL[1]
                    task.survey.status = 'processing'
                    if tL[4]=='h':
                        calculate_detection_similarities.delay(task_ids=[task_id],species=species,algorithm='hotspotter')
                    elif tL[4]=='n':
                        calculate_detection_similarities.delay(task_ids=[task_id],species=species,algorithm='none')

                db.session.commit()
                return True

            # for chunk in chunker(clusters,2500):
            for cluster in clusters:
                cluster.examined = False
                cluster.required_images = []
            # db.session.commit()

        task.cluster_count = cluster_count
        db.session.commit()

        # if not (any(item in taggingLevel for item in ['-4','-5','-6']) or isBounding):
        if not (any(item in taggingLevel for item in ['-4','-5','-7']) or isBounding):
            results = []
            trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==task.survey_id).distinct().all()]
            for trapgroup_id in trapgroup_ids:
                results.append(prep_required_images.apply_async(kwargs={'task_id': task_id, 'trapgroup_id':trapgroup_id},queue='parallel'))
    
            #Wait for processing to complete
            db.session.remove()
            GLOBALS.lock.acquire()
            with allow_join_result():
                for result in results:
                    try:
                        result.get()
                    except Exception:
                        app.logger.info(' ')
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(traceback.format_exc())
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(' ')
                    
                    result.forget()
            GLOBALS.lock.release()

        task = db.session.query(Task).get(task_id)

        for trapgroup in task.survey.trapgroups:

            # if '-5' in taggingLevel:
                # OtherIndividual = alias(Individual)

                # sq1 = db.session.query(Individual.id.label('indID1'))\
                #                 .join(Task,Individual.tasks)\
                #                 .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                #                 .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                #                 .filter(OtherIndividual.c.active==True)\
                #                 .filter(OtherIndividual.c.name!='unidentifiable')\
                #                 .filter(IndSimilarity.score>=tL[2])\
                #                 .filter(IndSimilarity.skipped==False)\
                #                 .filter(Task.id.in_(task_ids))\
                #                 .filter(Individual.species==species)\
                #                 .filter(Individual.active==True)\
                #                 .filter(Individual.name!='unidentifiable')\
                #                 .group_by(Individual.id)\
                #                 .subquery()

                # sq2 = db.session.query(Individual.id.label('indID2'))\
                #                 .join(Task,Individual.tasks)\
                #                 .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                #                 .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                #                 .filter(OtherIndividual.c.active==True)\
                #                 .filter(OtherIndividual.c.name!='unidentifiable')\
                #                 .filter(IndSimilarity.score>=tL[2])\
                #                 .filter(IndSimilarity.skipped==False)\
                #                 .filter(Task.id.in_(task_ids))\
                #                 .filter(Individual.species==species)\
                #                 .filter(Individual.active==True)\
                #                 .filter(Individual.name!='unidentifiable')\
                #                 .group_by(Individual.id)\
                #                 .subquery()

                # clusterCount = db.session.query(Individual)\
                #                 .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                #                 .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                #                 .join(Detection,Individual.detections)\
                #                 .join(Image)\
                #                 .join(Camera)\
                #                 .filter(Camera.trapgroup_id==trapgroup.id)\
                #                 .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
                #                 .count()
            # else:

            if '-5' not in taggingLevel:
                clusterCount = db.session.query(Cluster)\
                            .join(Image,Cluster.images)\
                            .join(Camera)\
                            .filter(Camera.trapgroup==trapgroup)\
                            .filter(Cluster.task_id == task_id)\
                            .filter(Cluster.examined==False)\
                            .count()

                if clusterCount != 0:
                    trapgroup.active = True
                    GLOBALS.redisClient.rpush('trapgroups_'+str(task.survey_id),trapgroup.id)
                else:
                    trapgroup.active = False

            trapgroup.processing = False
            trapgroup.queueing = False
            trapgroup.user_id = None

        task.status = 'PROGRESS'
        db.session.commit()

        # populateMutex(int(task_id))

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

# @celery.task(bind=True,max_retries=5,ignore_result=True)
def freeUpWork(task_id):
    '''Attempts to free up trapgroups etc. to allow task annotation to complete.'''

    session = db.session()
    task = session.query(Task).get(task_id)

    clusterSQ = session.query(Trapgroup.id,func.max(Cluster.timestamp).label('timestamp'))\
                            .join(Camera)\
                            .join(Image)\
                            .join(Cluster,Image.clusters)\
                            .filter(Cluster.task_id == task_id) \
                            .subquery()

    trapgroup_pool = [int(r.decode()) for r in GLOBALS.redisClient.lrange('trapgroups_'+str(task.survey_id),0,-1)]

    trapgroups = session.query(Trapgroup) \
                    .join(Camera) \
                    .join(Image) \
                    .join(Cluster, Image.clusters) \
                    .outerjoin(clusterSQ,clusterSQ.c.id==Trapgroup.id)\
                    .filter(Cluster.task_id == task_id) \
                    .filter(Trapgroup.processing == False) \
                    .filter(Trapgroup.queueing == False)\
                    .filter(Trapgroup.user_id == None)\
                    .filter(Cluster.examined==False)\
                    .filter(~Trapgroup.id.in_(trapgroup_pool))\
                    .filter(or_(clusterSQ.c.timestamp<datetime.utcnow()-timedelta(minutes=3),clusterSQ.c.timestamp==None))\
                    .distinct().all()

    if Config.DEBUGGING: print('{} inactive trapgroups identified for survey {}'.format(len(trapgroups),task.survey.name))

    for trapgroup in trapgroups:
        trapgroup.active = True
        GLOBALS.redisClient.lrem('trapgroups_'+str(task.survey_id),0,trapgroup.id)
        GLOBALS.redisClient.rpush('trapgroups_'+str(task.survey_id),trapgroup.id)            

    session.commit()
    session.close()

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def wrapUpTask(self,task_id):
    '''Cleans up a task after annotation.'''

    try:
        task = db.session.query(Task).get(task_id)

        GLOBALS.redisClient.delete('active_jobs_'+str(task.id))
        GLOBALS.redisClient.delete('job_pool_'+str(task.id))

        turkcodes = db.session.query(Turkcode).filter(Turkcode.task_id==task_id).filter(Turkcode.user_id==None).filter(Turkcode.active==True).all()
        for turkcode in turkcodes:
            db.session.delete(turkcode)

        if '-5' in task.tagging_level:
            cleanUpIndividuals(task_id)

        clusters = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.skipped==True).distinct().all()
        for cluster in clusters:
            cluster.skipped = False

        db.session.commit()

        reconcile_cluster_labelgroup_labels_and_tags(task_id)
        
        if ',' not in task.tagging_level and task.init_complete and '-2' not in task.tagging_level:
            check_individual_detection_mismatch(task_id=task_id)

        updateAllStatuses(task_id=task_id)

        task = db.session.query(Task).get(task_id)
        task.current_name = None

        if task.tagging_level == '-1':
            downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
            check = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.contains(downLabel)).filter(Cluster.checked==False).first()
            if check:
                task.status = 'successInitial'
            else:
                task.status = 'SUCCESS'
        else:
            task.status = 'SUCCESS'

        turkcodes = db.session.query(Turkcode)\
                            .join(User)\
                            .filter(User.parent_id!=None)\
                            .filter(Turkcode.task_id==task_id)\
                            .filter(Turkcode.tagging_time!=None)\
                            .distinct().all()
        total_time = 0
        for turkcode in turkcodes:
            total_time += turkcode.tagging_time
        task.tagging_time = total_time
        task.jobs_finished = len(turkcodes)

        # if '-4' in task.tagging_level:
            #Check if complete
            # tL = re.split(',',task.tagging_level)
            # species = tL[1]
            # incompleteIndividuals = db.session.query(Individual)\
            #                                 .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
            #                                 .filter(Individual.tasks.contains(task))\
            #                                 .filter(Individual.species==species)\
            #                                 .filter(Individual.name!='unidentifiable')\
            #                                 .filter(IndSimilarity.score==None)\
            #                                 .distinct().count()
            # total_individual_count = db.session.query(Individual)\
            #                                 .filter(Individual.tasks.contains(task))\
            #                                 .filter(Individual.species==species)\
            #                                 .filter(Individual.name!='unidentifiable')\
            #                                 .count()
            # if Config.DEBUGGING: app.logger.info('There are {} incomplete individuals for wrapTask'.format(incompleteIndividuals))
            # if (incompleteIndividuals == 0) or (total_individual_count<2):
            #     task.survey.status = 'Ready'


        if '-5' in task.tagging_level:
            GLOBALS.redisClient.delete('active_individuals_'+str(task_id))
            GLOBALS.redisClient.delete('active_indsims_'+str(task_id))
            GLOBALS.redisClient.delete('quantiles_'+str(task_id))
            if not task.sub_tasks:
                label = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.description==task.tagging_level.split(',')[1]).first()
                label.icID_q1_complete = True

        elif '-3' in task.tagging_level:
            task.ai_check_complete = True

        elif '-7' in task.tagging_level:
            # Cleanup for -7
            # Only cleanup if there are no download requests that include empty images
            cleanup = True
            download_requests = db.session.query(DownloadRequest).join(Task).filter(Task.survey_id==task.survey_id).filter(DownloadRequest.name=='restore').all()
            for download_request in download_requests:
                try:
                    download_params = json.loads(GLOBALS.redisClient.get('fileDownloadParams_'+str(download_request.task_id)+'_'+str(download_request.user_id)).decode())
                    if download_params['include_empties'] == True:
                        cleanup = False
                        break
                except:
                    pass

            if cleanup: cleanup_empty_restored_images.delay(task_id)

        #Accounts for individual ID background processing
        # if 'processing' not in task.survey.status:
        #     if '-4' in task.tagging_level:
        #         tL = re.split(',',task.tagging_level)
        #         species = tL[1]
        #         task.survey.status = 'indprocessing'
        #         db.session.commit()
        #         calculate_individual_similarities.delay(task.id,species)	
        #     else:
        #         task.survey.status = 'Ready'
        if 'processing' not in task.survey.status:
            if '-4' in task.tagging_level:
                tL = re.split(',',task.tagging_level)
                species = tL[1]
                task.survey.status = 'processing'
                db.session.commit()
                if tL[4]=='h':
                    calculate_detection_similarities.delay(task_ids=[task_id],species=species,algorithm='hotspotter')
                elif tL[4]=='n':
                    calculate_detection_similarities.delay(task_ids=[task_id],species=species,algorithm='none')
            else:
                task.survey.status = 'Ready'

        # handle multi-tasks
        for sub_task in task.sub_tasks:
            sub_task.status = 'SUCCESS'
            sub_task.survey.status = 'Ready'
        task.sub_tasks = []

        #remove trapgroup list from redis
        GLOBALS.redisClient.delete('trapgroups_'+str(task.survey_id))

        # if task_id in GLOBALS.mutex.keys(): GLOBALS.mutex.pop(int(task_id), None)
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

def allocate_new_trapgroup(task_id,user,survey_id):
    '''Allocates a new trapgroup to the specified user for the given task. Attempts to free up trapgroups if none are available. Returns the allocate trapgroup.'''

    # check fort currently-allocated trapgroups first
    for trapgroup in user.trapgroup:
        if trapgroup.active: return trapgroup
    
    trapgroup = GLOBALS.redisClient.lpop('trapgroups_'+str(survey_id))
    
    # trapgroup = db.session.query(Trapgroup) \
    #                 .filter(Trapgroup.survey_id==survey_id)\
    #                 .filter(Trapgroup.active == True) \
    #                 .filter(Trapgroup.user_id == None) \
    #                 .first()

    # if trapgroup == None:
    #     #Try to free up trapgroups
    #     trapgroups = db.session.query(Trapgroup) \
    #                     .join(Camera) \
    #                     .join(Image) \
    #                     .join(Cluster, Image.clusters) \
    #                     .filter(Cluster.task_id == task_id) \
    #                     .filter(Trapgroup.active == False) \
    #                     .filter(Trapgroup.queueing == False) \
    #                     .filter(Trapgroup.processing == False) \
    #                     .filter(Trapgroup.user_id == None) \
    #                     .filter(Cluster.examined==False)\
    #                     .distinct().all()

    #     for trapgroup in trapgroups:
    #         trapgroup.active = True

    #     if trapgroups:
    #         trapgroup = trapgroups[0]

    if trapgroup:
        trapgroup = db.session.query(Trapgroup).get(int(trapgroup.decode()))
        trapgroup.user_id = user.id
        db.session.commit()

    return trapgroup

def fetch_clusters(taggingLevel,task_id,isBounding,trapgroup_id,limit=None,id=None,clusterIdList=None):
    '''Fetch the clusterInfo for the user'''

    clusterInfo = {}
    if '-5' in taggingLevel:
        # Extract data relating to the task
        task = db.session.query(Task).get(task_id)
        task_ids = [r.id for r in task.sub_tasks]
        task_ids.append(task.id)
        tL = re.split(',',taggingLevel)
        species = tL[1]
        OtherIndividual = alias(Individual)
        OtherIndividualTasks = alias(individualTasks)
        individuals = []

        allocatedIndSims = [int(r.decode()) for r in GLOBALS.redisClient.smembers('active_indsims_'+str(task_id))]

        # Find indviduals (joined on left side of similarity) with work available
        sq1 = db.session.query(Individual.id.label('indID1'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .join(OtherIndividualTasks,OtherIndividualTasks.c.individual_id==OtherIndividual.c.id)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(OtherIndividual.c.species==species)\
                        .filter(OtherIndividualTasks.c.task_id.in_(task_ids))\
                        .filter(~IndSimilarity.id.in_(allocatedIndSims))\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()
        
        # Find indviduals (joined on right side of similarity) with work available
        sq2 = db.session.query(Individual.id.label('indID2'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                        .join(OtherIndividualTasks,OtherIndividualTasks.c.individual_id==OtherIndividual.c.id)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(OtherIndividual.c.species==species)\
                        .filter(OtherIndividualTasks.c.task_id.in_(task_ids))\
                        .filter(~IndSimilarity.id.in_(allocatedIndSims))\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()
        
        # Find the number of detections per individual for ordering purposes
        sq3 = db.session.query(Individual.id.label('indID3'),func.count(distinct(Detection.id)).label('count3'))\
                        .join(Task,Individual.tasks)\
                        .join(Detection,Individual.detections)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()
        
        # Find the available individual with the most detections
        clusters = db.session.query(
                            Individual,
                            Individual.id,
                            Individual.notes,
                            Image.id,
                            Image.filename,
                            Image.corrected_timestamp,
                            Image.detection_rating,
                            Detection.id,
                            Detection.top,
                            Detection.bottom,
                            Detection.left,
                            Detection.right,
                            Detection.category,
                            Detection.static,
                            Camera.path,
                            Camera.id,
                            Trapgroup.latitude,
                            Trapgroup.longitude,
                            Detection.flank
                        )\
                        .join(Task,Individual.tasks)\
                        .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                        .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                        .join(sq3,sq3.c.indID3==Individual.id)\
                        .join(Detection,Individual.detections)\
                        .join(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                        .filter(Detection.static==False)\
                        .order_by(desc(sq3.c.count3)).all()

        for row in clusters:
            # sadd returns 1 if the item was added to the set, 0 if it was already in the set
            if GLOBALS.redisClient.sadd('active_individuals_'+str(task_id),row[1]):
                individuals.append(row[0])
                break

        if individuals:
            for row in clusters:
                # Handle clusters
                if row[0] and (row[0] in individuals):
                    if row[1] and (row[1] not in clusterInfo.keys()):
                        clusterInfo[row[1]] = {
                            'id': row[1],
                            'classification': {},
                            'required': [],
                            'images': {},
                            'label': [],
                            'label_ids': [],
                            'tags': [],
                            'tag_ids': [],
                            'groundTruth': [],
                            'trapGroup': 'None',
                            'notes': row[2]
                        }

                    # Handle images
                    if row[3] and (row[3] not in clusterInfo[row[1]]['images'].keys()):
                        clusterInfo[row[1]]['images'][row[3]] = {
                            'id': row[3],
                            'url': row[14] + '/' + row[4],
                            'filename': row[4],
                            'timestamp': numify_timestamp(row[5]),
                            'camera': row[15],
                            'rating': row[6],
                            'latitude': row[16],
                            'longitude': row[17],
                            'detections': {}
                        }

                    # Handle detections
                    if row[7] and (row[7] not in clusterInfo[row[1]]['images'][row[3]]['detections'].keys()):
                        clusterInfo[row[1]]['images'][row[3]]['detections'][row[7]] = {
                            'id': row[7],
                            'top': row[8],
                            'bottom': row[9],
                            'left': row[10],
                            'right': row[11],
                            'category': row[12],
                            'individuals': [],
                            'individual_names': [],
                            'static': row[13],
                            'labels': [],
                            'flank': Config.FLANK_TEXT[row[18]] if row[18] else 'None'
                        }

        return clusterInfo, individuals

    else:
        IndividualTask = alias(Task)
        if id:
            # we need to outerjoin to the rDets in order to display the empty images
            rDetsSQ = rDets(db.session.query(Detection)).subquery()

            # need to filter by cluster id and include videos
            clusters = db.session.query(
                            Cluster.id,
                            Cluster.notes,
                            Image.id,
                            Image.filename,
                            Image.corrected_timestamp,
                            Image.detection_rating,
                            Camera.id,
                            Camera.path,
                            Camera.trapgroup_id,
                            rDetsSQ.c.id,
                            rDetsSQ.c.top,
                            rDetsSQ.c.bottom,
                            rDetsSQ.c.left,
                            rDetsSQ.c.right,
                            rDetsSQ.c.category,
                            rDetsSQ.c.static,
                            Label.id,
                            Label.description,
                            requiredimagestable.c.image_id,
                            Tag.id,
                            Tag.description,
                            Individual.id,
                            rDetsSQ.c.source,
                            rDetsSQ.c.score,
                            rDetsSQ.c.status,
                            rDetsSQ.c.flank,
                            IndividualTask.c.id,
                            Cluster.user_id,
                            Trapgroup.tag,
                            Trapgroup.latitude,
                            Trapgroup.longitude,
                            Video.id,
                            Video.filename,
                            Individual.name
                        )\
                        .join(Image, Cluster.images) \
                        .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                        .join(Camera) \
                        .join(Trapgroup) \
                        .outerjoin(Video)\
                        .outerjoin(rDetsSQ,rDetsSQ.c.image_id==Image.id) \
                        .outerjoin(Labelgroup)\
                        .outerjoin(Label,Labelgroup.labels)\
                        .outerjoin(Tag,Labelgroup.tags)\
                        .outerjoin(individualDetections,individualDetections.c.detection_id==rDetsSQ.c.id)\
                        .outerjoin(Individual,Individual.id==individualDetections.c.individual_id)\
                        .outerjoin(IndividualTask,Individual.tasks)\
                        .filter(Cluster.id==id)\
                        .filter(or_(Labelgroup.task_id==task_id,Labelgroup.id==None))\
                        .filter(Image.zip_id==None)

        else:
            # Need to filter by trapgroup id and exclude video
            # clusters = db.session.query(
            #                 Cluster.id,
            #                 Cluster.notes,
            #                 Image.id,
            #                 Image.filename,
            #                 Image.corrected_timestamp,
            #                 Image.detection_rating,
            #                 Camera.id,
            #                 Camera.path,
            #                 Camera.trapgroup_id,
            #                 Detection.id,
            #                 Detection.top,
            #                 Detection.bottom,
            #                 Detection.left,
            #                 Detection.right,
            #                 Detection.category,
            #                 Detection.static,
            #                 Label.id,
            #                 Label.description,
            #                 requiredimagestable.c.image_id,
            #                 Tag.id,
            #                 Tag.description,
            #                 Individual.id,
            #                 Detection.source,
            #                 Detection.score,
            #                 Detection.status,
            #                 Detection.flank,
            #                 IndividualTask.c.id
            #             )\
            #             .join(Image, Cluster.images) \
            #             .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
            #             .join(Camera) \
            #             .outerjoin(Detection) \
            #             .outerjoin(Labelgroup)\
            #             .outerjoin(Label,Labelgroup.labels)\
            #             .outerjoin(Tag,Labelgroup.tags)\
            #             .outerjoin(Individual,Detection.individuals)\
            #             .outerjoin(IndividualTask,Individual.tasks)\
            #             .filter(Camera.trapgroup_id==trapgroup_id)\
            #             .filter(Cluster.examined==False)

            # this SQ helps us limit the results to MAX_DETS_PER_CLUSTER relevant detections per cluster
            detectionSQ = rDets(db.session.query(
                                            Detection,
                                            func.row_number().over(
                                                partition_by=Cluster.id,
                                                order_by=[Image.detection_rating,Detection.id]
                                            ).label("row_num")
                                        )\
                                        .join(Image)\
                                        .join(Cluster,Image.clusters)\
                                        .filter(Cluster.task_id==task_id))\
                                        .subquery()

            if (taggingLevel=='-1') and not isBounding:
                # basic species annotation. No need for labels and we want to limit detections
                clusters = db.session.query(
                                Cluster.id,
                                Cluster.notes,
                                Image.id,
                                Image.filename,
                                Image.corrected_timestamp,
                                Image.detection_rating,
                                Camera.id,
                                Camera.path,
                                Camera.trapgroup_id,
                                detectionSQ.c.id,
                                detectionSQ.c.top,
                                detectionSQ.c.bottom,
                                detectionSQ.c.left,
                                detectionSQ.c.right,
                                detectionSQ.c.category,
                                detectionSQ.c.static,
                                None,
                                None,
                                requiredimagestable.c.image_id,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None
                            )\
                            .join(Image, Cluster.images) \
                            .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                            .join(Camera) \
                            .outerjoin(detectionSQ,detectionSQ.c.image_id==Image.id)\
                            .filter(or_(
                                detectionSQ.c.row_num<Config.MAX_DETS_PER_CLUSTER,
                                detectionSQ.c.row_num==None,
                                requiredimagestable.c.image_id==Image.id
                            ))

            elif '-2' in taggingLevel:
                # informational tagging. We need the current tags and limit the detections
                clusters = db.session.query(
                                Cluster.id,
                                Cluster.notes,
                                Image.id,
                                Image.filename,
                                Image.corrected_timestamp,
                                Image.detection_rating,
                                Camera.id,
                                Camera.path,
                                Camera.trapgroup_id,
                                detectionSQ.c.id,
                                detectionSQ.c.top,
                                detectionSQ.c.bottom,
                                detectionSQ.c.left,
                                detectionSQ.c.right,
                                detectionSQ.c.category,
                                detectionSQ.c.static,
                                None,
                                None,
                                requiredimagestable.c.image_id,
                                Tag.id,
                                Tag.description,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None
                            )\
                            .join(Image, Cluster.images) \
                            .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                            .join(Camera) \
                            .outerjoin(detectionSQ,detectionSQ.c.image_id==Image.id)\
                            .outerjoin(Labelgroup,Labelgroup.detection_id==detectionSQ.c.id)\
                            .outerjoin(Tag,Labelgroup.tags)\
                            .filter(or_(Labelgroup.task_id==task_id,Labelgroup.id==None))\
                            .filter(or_(
                                detectionSQ.c.row_num<Config.MAX_DETS_PER_CLUSTER,
                                detectionSQ.c.row_num==None,
                                requiredimagestable.c.image_id==Image.id
                            ))
                
            elif ('-3' in taggingLevel) or (taggingLevel.isdigit() and not isBounding) or ('-8' in taggingLevel):
                # AI check and category species labelling. We need the labels and want to limit detections
                clusters = db.session.query(
                                Cluster.id,
                                Cluster.notes,
                                Image.id,
                                Image.filename,
                                Image.corrected_timestamp,
                                Image.detection_rating,
                                Camera.id,
                                Camera.path,
                                Camera.trapgroup_id,
                                detectionSQ.c.id,
                                detectionSQ.c.top,
                                detectionSQ.c.bottom,
                                detectionSQ.c.left,
                                detectionSQ.c.right,
                                detectionSQ.c.category,
                                detectionSQ.c.static,
                                Label.id,
                                Label.description,
                                requiredimagestable.c.image_id,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None
                            )\
                            .join(Image, Cluster.images) \
                            .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                            .join(Camera) \
                            .outerjoin(detectionSQ,detectionSQ.c.image_id==Image.id)\
                            .outerjoin(Labelgroup,Labelgroup.detection_id==detectionSQ.c.id)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(or_(Labelgroup.task_id==task_id,Labelgroup.id==None))\
                            .filter(or_(
                                detectionSQ.c.row_num<Config.MAX_DETS_PER_CLUSTER,
                                detectionSQ.c.row_num==None,
                                requiredimagestable.c.image_id==Image.id
                            ))

            elif '-7' in taggingLevel:
                clusters = db.session.query(
                                Cluster.id,
                                Cluster.notes,
                                Image.id,
                                Image.filename,
                                Image.corrected_timestamp,
                                Image.detection_rating,
                                Camera.id,
                                Camera.path,
                                Camera.trapgroup_id,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                requiredimagestable.c.image_id,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None
                            )\
                            .join(Image, Cluster.images) \
                            .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                            .join(Camera)

            elif isBounding:
                # we need to outerjoin to the rDets in order to display the empty images
                rDetsSQ = rDets(db.session.query(Detection)).subquery()

                # all rDets are required for bbox edit along with the labels
                clusters = db.session.query(
                                Cluster.id,
                                Cluster.notes,
                                Image.id,
                                Image.filename,
                                Image.corrected_timestamp,
                                Image.detection_rating,
                                Camera.id,
                                Camera.path,
                                Camera.trapgroup_id,
                                rDetsSQ.c.id,
                                rDetsSQ.c.top,
                                rDetsSQ.c.bottom,
                                rDetsSQ.c.left,
                                rDetsSQ.c.right,
                                rDetsSQ.c.category,
                                rDetsSQ.c.static,
                                Label.id,
                                Label.description,
                                requiredimagestable.c.image_id,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None,
                                None
                            )\
                            .join(Image, Cluster.images) \
                            .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                            .join(Camera) \
                            .outerjoin(rDetsSQ,rDetsSQ.c.image_id==Image.id) \
                            .outerjoin(Labelgroup)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(or_(Labelgroup.task_id==task_id,Labelgroup.id==None))
                
            elif '-4' in taggingLevel:
                # all detections are required for individual ID along with individual info and labels
                tL = re.split(',',taggingLevel)
                species = tL[1]

                detectionSQ = rDets(db.session.query(
                                            Detection,
                                            Label.id.label('label_id'),
                                            Label.description.label('label_description'),
                                            Individual.id.label('individual_id'),
                                            IndividualTask.c.id.label('individual_task_id')
                                        )\
                                        .join(Image)\
                                        .join(Labelgroup)\
                                        .join(Label,Labelgroup.labels)\
                                        .outerjoin(Individual,Detection.individuals)\
                                        .outerjoin(IndividualTask,Individual.tasks)\
                                        .join(Cluster,Image.clusters)\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(Label.description==species))\
                                        .subquery()
                
                clusters = db.session.query(
                                    Cluster.id,
                                    Cluster.notes,
                                    Image.id,
                                    Image.filename,
                                    Image.corrected_timestamp,
                                    Image.detection_rating,
                                    Camera.id,
                                    Camera.path,
                                    Camera.trapgroup_id,
                                    detectionSQ.c.id,
                                    detectionSQ.c.top,
                                    detectionSQ.c.bottom,
                                    detectionSQ.c.left,
                                    detectionSQ.c.right,
                                    detectionSQ.c.category,
                                    detectionSQ.c.static,
                                    detectionSQ.c.label_id,
                                    detectionSQ.c.label_description,
                                    requiredimagestable.c.image_id,
                                    None,
                                    None,
                                    detectionSQ.c.individual_id,
                                    None,
                                    None,
                                    None,
                                    detectionSQ.c.flank,
                                    detectionSQ.c.individual_task_id
                                )\
                                .join(Image, Cluster.images) \
                                .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                                .join(Camera) \
                                .outerjoin(detectionSQ,detectionSQ.c.image_id==Image.id)
            
            clusters = clusters.filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(Cluster.examined==False)
            
            if clusterIdList: clusters = clusters.filter(~Cluster.id.in_(clusterIdList))
        
        # if '-6' in taggingLevel:  
        #     # NOTE: This is not currently used (is for check masked sightings)
        #     clusters = clusters.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
        #                     .filter(Detection.static==False)\
        #                     .filter(Detection.status=='masked')\
        #                     .filter(Labelgroup.task_id == task_id) \
        #                     .filter(Cluster.task_id == task_id) \
        #                     .order_by(desc(Cluster.classification), Cluster.id)\
        #                     .distinct().limit(25000).all()

        # This need to be ordered by Cluster ID otherwise the a max request will drop random info
        # clusters = clusters.filter(Labelgroup.task_id == task_id) \
        #                 .filter(Cluster.task_id == task_id) \
        #                 .order_by(desc(Cluster.classification), Cluster.id)\
        #                 .distinct().limit(25000).all()

        clusters = clusters.filter(Cluster.task_id == task_id)
        
        dataType = db.session.query(Survey.type).join(Task).filter(Task.id==task_id).first()[0]
        if dataType in ['waterhole','baited','plains']:
            # the clusters in these data types are more related, so we want to show them in chronological order
            clusters = clusters.order_by(Image.corrected_timestamp)
        else:
            clusters = clusters.order_by(desc(Cluster.classification), Cluster.id)
        
        clusters = clusters.distinct().limit(25000).all()

        if len(clusters) == 25000:
            max_request = True
        else:
            max_request = False

        cluster_ids = []
        for row in clusters:
            # Handle clusters
            if row[0] and (row[0] not in clusterInfo.keys()):
                cluster_ids.append(row[0])
                clusterInfo[row[0]] = {
                    'id': row[0],
                    'classification': {},
                    'required': [],
                    'images': {},
                    'label': [],
                    'label_ids': [],
                    'tags': [],
                    'tag_ids': [],
                    'groundTruth': [],
                    'trapGroup': row[8],
                    'notes': row[1],
                    'individuals': []
                }
                if id: 
                    clusterInfo[row[0]]['videos'] = {}
                    user_id = row[27]
                    if user_id:
                        user = db.session.query(User.username,User.parent_id).filter(User.id==user_id).first()
                        if user and user[1]:
                            clusterInfo[row[0]]['user'] = db.session.query(User.username).filter(User.id==user[1]).first()[0]
                        elif user and user[1]==None and user[0] != 'Admin':
                            clusterInfo[row[0]]['user'] = user[0]
                        else:
                            clusterInfo[row[0]]['user'] = 'AI'
                    else:
                        clusterInfo[row[0]]['user'] = 'AI'
                    
                    clusterInfo[row[0]]['site_tag'] = row[28]
                    clusterInfo[row[0]]['latitude'] = row[29]
                    clusterInfo[row[0]]['longitude'] = row[30]

            # Handle images
            if row[2] and (row[2] not in clusterInfo[row[0]]['images'].keys()):
                clusterInfo[row[0]]['images'][row[2]] = {
                    'id': row[2],
                    'url': row[7] + '/' + row[3],
                    'filename': row[3],
                    'timestamp': numify_timestamp(row[4]),
                    'camera': row[6],
                    'rating': row[5],
                    'latitude': 0,
                    'longitude': 0,
                    'detections': {}
                }

            # Handle detections
            if row[9] and (row[9] not in clusterInfo[row[0]]['images'][row[2]]['detections'].keys()):
                # if (row[24] not in Config.DET_IGNORE_STATUSES) and (row[15]==False) and (row[23]>Config.DETECTOR_THRESHOLDS[row[22]]):
                clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]] = {
                    'id': row[9],
                    'top': row[10],
                    'bottom': row[11],
                    'left': row[12],
                    'right': row[13],
                    'category': row[14],
                    'individuals': [],
                    'individual_names': [],
                    'static': row[15],
                    'labels': [],
                    'flank': Config.FLANK_TEXT[row[25]] if row[25] else 'None'
                }

            # Handle video
            # if id and row[31] and (row[31] not in clusterInfo[row[0]]['videos'].keys()):
            #     clusterInfo[row[0]]['videos'][row[31]] = {
            #         'id': row[31],
            #         'url': row[7].split('/_video_images_')[0] + '/' + row[32],
            #         'timestamp': numify_timestamp(row[4]),
            #         'camera': row[6],
            #         'rating': 1,
            #         'detections': {}
            #     }

            # # Handle classifications
            # if ('-3' in taggingLevel) and row[22] and (row[22] not in clusterInfo[row[0]]['classification'].keys()):
            #     clusterInfo[row[0]]['classification'][row[22]] = float(row[23])

            if row[17] and (row[17] not in clusterInfo[row[0]]['label']): clusterInfo[row[0]]['label'].append(row[17])
            if row[16] and (row[16] not in clusterInfo[row[0]]['label_ids']): clusterInfo[row[0]]['label_ids'].append(row[16])
            if row[18] and (row[18] not in clusterInfo[row[0]]['required']): clusterInfo[row[0]]['required'].append(row[18])
            if row[20] and (row[20] not in clusterInfo[row[0]]['tags']): clusterInfo[row[0]]['tags'].append(row[20])
            if row[19] and (row[19] not in clusterInfo[row[0]]['tag_ids']): clusterInfo[row[0]]['tag_ids'].append(row[19])

            if (row[9] in clusterInfo[row[0]]['images'][row[2]]['detections'].keys()):
                if row[17] and (row[17] not in clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['labels']):
                    clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['labels'].append(row[17])
                
                # Handle individuals
                if row[26] and row[21] and (row[21] not in clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['individuals']) and (row[26]==task_id):
                    clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['individuals'].append(row[21])
                    if id: clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['individual_names'].append(row[33])

        if '-3' in taggingLevel:
            task = db.session.query(Task).get(task_id)
            classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==task_id).first()[0]
            # dataType = db.session.query(Survey.type).join(Task).filter(Task.id==task_id).first()[0]
            cluster_ids = cluster_ids[:limit]
            
            classSQ = db.session.query(Cluster.id,Detection.classification.label('label'),func.count(distinct(Detection.id)).label('count'))\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .join(Camera)\
                                    .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                    .filter(ClassificationLabel.classifier_id==classifier_id) \
                                    .filter(Detection.class_score>ClassificationLabel.threshold) \
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(Camera.trapgroup_id==trapgroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                    .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                                    .filter(Cluster.id.in_(cluster_ids))\
                                    .group_by(Cluster.id,Detection.classification)\
                                    .subquery()

            # classSQ = db.session.query(Cluster.id,Label.description.label('label'),func.count(distinct(Detection.id)).label('count'))\
            #                         .join(Image,Cluster.images)\
            #                         .join(Detection)\
            #                         .join(Translation,Detection.classification==Translation.classification)\
            #                         .join(Label,Translation.label_id==Label.id)\
            #                         .join(Camera)\
            #                         .join(Trapgroup)\
            #                         .join(Survey)\
            #                         .join(Classifier)\
            #                         .filter(Cluster.task_id==task_id)\
            #                         .filter(Translation.task_id==task_id)\
            #                         .filter(Trapgroup.id==trapgroup_id)\
            #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
            #                         .filter(Detection.static == False) \
            #                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
            #                         .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
            #                         .filter(Detection.class_score>Classifier.threshold) \
            #                         .filter(Cluster.id.in_(cluster_ids))\
            #                         .group_by(Cluster.id,Label.id)\
            #                         .subquery()
            
            clusterDetCountSQ = db.session.query(Cluster.id,func.count(distinct(Detection.id)).label('count'))\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                    .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.CLASSIFICATION_DET_AREA[dataType])\
                                    .filter(Cluster.id.in_(cluster_ids))\
                                    .group_by(Cluster.id)\
                                    .subquery()

            clusters2 = db.session.query(
                                    Cluster.id,
                                    classSQ.c.label,
                                    classSQ.c.count/clusterDetCountSQ.c.count
                                )\
                                .join(Image, Cluster.images) \
                                .join(Camera)\
                                .join(classSQ,classSQ.c.id==Cluster.id)\
                                .join(clusterDetCountSQ,clusterDetCountSQ.c.id==Cluster.id)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(classSQ.c.count/clusterDetCountSQ.c.count>=Config.MIN_CLASSIFICATION_RATIO[dataType])\
                                .filter(classSQ.c.count>1)\
                                .filter(Cluster.examined==False)\
                                .filter(Cluster.task_id == task_id) \
                                .order_by(desc(Cluster.classification), Cluster.id)\
                                .distinct().limit(25000).all()
            
            # The below code handles the case where there are multiple hierarchical translations for a single classification.
            # If a label's parent is also a translation of a classification, the label is dropped in favour of its parent
            # eg. if mongoose, banded mongoose, and yelow mongoose are all translations of the mongoose classification. Just mongoose is returned as a suggestion.
            data = db.session.query(Translation.classification,Label.id,Label.description,Label.parent_id)\
                                .join(Label)\
                                .filter(Translation.task_id==task_id).all()
            
            label_id_description_conversion = {}
            for item in data: label_id_description_conversion[item[1]] = item[2]

            translations = {}
            classifications = list(set([item[0] for item in data]))
            for classification in classifications:
                label_ids = [item[1] for item in data if item[0] == classification]
                all_label_ids = label_ids.copy()
                for item in data:
                    if item[0]==classification:
                        if item[3] in all_label_ids:
                            label_ids.remove(item[1])
                if label_ids:
                    translations[classification] = label_id_description_conversion[label_ids[0]]

            for row in clusters2:
                if row[0] and (row[0] in clusterInfo.keys()) and row[1]:
                    classification = translations[row[1]] if row[1] in translations.keys() else None
                    if classification and (classification not in clusterInfo[row[0]]['classification'].keys()):
                        clusterInfo[row[0]]['classification'][classification] = float(row[2])

        elif '-8' in taggingLevel:
            cluster_ids = cluster_ids[:limit]

            clusterTimestampsSQ = db.session.query(\
                                                Cluster.id.label('cluster_id'),\
                                                func.min(Image.corrected_timestamp).label('start_time'),\
                                                func.max(Image.corrected_timestamp).label('end_time'),\
                                                Camera.trapgroup_id.label('trapgroup_id')\
                                            )\
                                            .join(Image,Cluster.images)\
                                            .join(Camera)\
                                            .filter(Cluster.task_id==task_id)\
                                            .filter(Camera.trapgroup_id==trapgroup_id)\
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

            clusters2 = db.session.query(Cluster1.c.id,func.group_concat(Label2.c.description))\
                            .join(Task,Cluster1.c.task_id==Task.id)\
                            .join(Cluster2,Cluster2.c.task_id==Task.id)\
                            .join(ClusterTimestampsSQ1,ClusterTimestampsSQ1.c.cluster_id==Cluster1.c.id)\
                            .join(ClusterTimestampsSQ2,ClusterTimestampsSQ2.c.cluster_id==Cluster2.c.id)\
                            .join(Labelstable2,Labelstable2.c.cluster_id==Cluster2.c.id)\
                            .outerjoin(Labelstable1,\
                                (Labelstable1.c.cluster_id == Cluster1.c.id) & \
                                ((Labelstable2.c.label_id == Labelstable1.c.label_id) | (Labelstable2.c.label_id==Labelstable1.c.parent_id)))\
                            .join(Label2,Label2.c.id==Labelstable2.c.label_id)\
                            .filter(Task.id==task_id)\
                            .filter(Cluster1.c.id!=Cluster2.c.id)\
                            .filter(ClusterTimestampsSQ1.c.trapgroup_id==ClusterTimestampsSQ2.c.trapgroup_id)\
                            .filter(or_(\
                                func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.end_time, ClusterTimestampsSQ2.c.start_time)) < Config.RELATED_CLUSTER_TIME,\
                                func.abs(func.timestampdiff(literal_column("SECOND"), ClusterTimestampsSQ1.c.start_time, ClusterTimestampsSQ2.c.end_time)) < Config.RELATED_CLUSTER_TIME\
                            ))\
                            .filter(Labelstable1.c.label_id.is_(None))\
                            .filter(~Labelstable2.c.label_id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))\
                            .filter(Cluster1.c.examined==False)\
                            .filter(Cluster1.c.id.in_(cluster_ids))\
                            .group_by(Cluster1.c.id,Cluster2.c.id)\
                            .distinct().limit(25000).all()
            
            for row in clusters2:
                if row[0] and (row[0] in clusterInfo.keys()) and row[1]:
                    labels = row[1].split(',')
                    for label in labels:
                        clusterInfo[row[0]]['classification'][label] = 1

        # If its a max request, the last cluster is probably missing info
        if max_request and (len(clusterInfo.keys())>1): del clusterInfo[clusters[-1][0]]

        return clusterInfo, max_request

# def fetch_clusters(taggingLevel,task_id,isBounding,trapgroup_id,limit):
#     '''
#     Returns a list of clusters for annotation for the specified parameters.
    
#         Parameters:
#             taggingLevel (str): The task tagging level
#             task_id (int): The task being annotated
#             isBounding (bool): Whether the task bounding boxes are being edited
#             trapgroup_id (int): The trapgroup allocated to the user for which clusters must be fetched
#             limit (int): The maximum number of clusters that should be returned
#     '''
    
#     if limit < 0: return []

#     if '-5' in taggingLevel:
#         task = db.session.query(Task).get(task_id)
#         task_ids = [r.id for r in task.sub_tasks]
#         task_ids.append(task.id)
#         tL = re.split(',',taggingLevel)
#         species = tL[1]
#         OtherIndividual = alias(Individual)

#         sq1 = db.session.query(Individual.id.label('indID1'))\
#                         .join(Task,Individual.tasks)\
#                         .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
#                         .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
#                         .filter(OtherIndividual.c.active==True)\
#                         .filter(OtherIndividual.c.name!='unidentifiable')\
#                         .filter(IndSimilarity.allocated==None)\
#                         .filter(IndSimilarity.score>=tL[2])\
#                         .filter(IndSimilarity.skipped==False)\
#                         .filter(Task.id.in_(task_ids))\
#                         .filter(Individual.species==species)\
#                         .filter(Individual.active==True)\
#                         .filter(Individual.name!='unidentifiable')\
#                         .group_by(Individual.id)\
#                         .subquery()
        
#         sq2 = db.session.query(Individual.id.label('indID2'))\
#                         .join(Task,Individual.tasks)\
#                         .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
#                         .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
#                         .filter(OtherIndividual.c.active==True)\
#                         .filter(OtherIndividual.c.name!='unidentifiable')\
#                         .filter(IndSimilarity.allocated==None)\
#                         .filter(IndSimilarity.score>=tL[2])\
#                         .filter(IndSimilarity.skipped==False)\
#                         .filter(Task.id.in_(task_ids))\
#                         .filter(Individual.species==species)\
#                         .filter(Individual.active==True)\
#                         .filter(Individual.name!='unidentifiable')\
#                         .group_by(Individual.id)\
#                         .subquery()
        
#         sq3 = db.session.query(Individual.id.label('indID3'),func.count(distinct(Detection.id)).label('count3'))\
#                         .join(Task,Individual.tasks)\
#                         .join(Detection,Individual.detections)\
#                         .filter(Task.id.in_(task_ids))\
#                         .filter(Individual.species==species)\
#                         .filter(Individual.active==True)\
#                         .filter(Individual.name!='unidentifiable')\
#                         .group_by(Individual.id)\
#                         .subquery()
        
#         cluster = db.session.query(Individual)\
#                         .join(Task,Individual.tasks)\
#                         .outerjoin(sq1,sq1.c.indID1==Individual.id)\
#                         .outerjoin(sq2,sq2.c.indID2==Individual.id)\
#                         .join(sq3,sq3.c.indID3==Individual.id)\
#                         .filter(Task.id.in_(task_ids))\
#                         .filter(Individual.allocated==None)\
#                         .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
#                         .order_by(desc(sq3.c.count3)).first()

#         if cluster:
#             clusters = [cluster]
#         else:
#             clusters = []

#     else:
#         clusters = db.session.query(Cluster) \
#                         .join(Image, Cluster.images) \
#                         .join(Camera) \
#                         .filter(Camera.trapgroup_id==trapgroup_id)\
#                         .filter(Cluster.task_id == task_id) \
#                         .filter(Cluster.examined==False)\
#                         .order_by(desc(Cluster.classification), desc(Image.corrected_timestamp)) \
#                         .distinct().limit(limit+1).all()

#         if len(clusters) < (limit+1):
#             trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
#             trapgroup.active = False
#             db.session.commit()
#         else:
#             clusters = clusters[:limit]

#     return clusters

def genInitKeys(taggingLevel,task_id,addSkip,addRemoveFalseDetections,addMaskArea):
    '''Returns the labels and hotkeys for the given tagging level and task'''

    if taggingLevel == '-1':
        categories = db.session.query(Label).filter(Label.task_id == task_id).filter(Label.parent_id == None).all()
        
        special_categories = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip')
        if not addRemoveFalseDetections: special_categories = special_categories.filter(Label.id != GLOBALS.remove_false_detections_id)
        if not addMaskArea: special_categories = special_categories.filter(Label.id != GLOBALS.mask_area_id)
        
        special_categories = special_categories.all()
        
        categories.extend(special_categories)
    elif taggingLevel == '0':
        temp_categories = db.session.query(Label).filter(Label.task_id == task_id).all()
        categories = []
        for category in temp_categories:
            check = db.session.query(Label).filter(Label.parent_id == category.id).first()
            if check == None:
                categories.append(category)

        special_categories = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip')
        if not addRemoveFalseDetections: special_categories = special_categories.filter(Label.id != GLOBALS.remove_false_detections_id)
        if not addMaskArea: special_categories = special_categories.filter(Label.id != GLOBALS.mask_area_id)
        special_categories = special_categories.all()
        
        categories.extend(special_categories)
    elif '-2' in taggingLevel:
        categories = db.session.query(Tag).filter(Tag.task_id == task_id).all()
        # categories.extend( db.session.query(Tag).filter(Tag.task_id == None).all() )
        # addSkip = True
    else:
        wrong_category = db.session.query(Label).get(GLOBALS.wrong_id)
        categories = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==int(taggingLevel)).all()
        categories.append(wrong_category)
        if addMaskArea: 
            mask_category = db.session.query(Label).get(GLOBALS.mask_area_id)
            categories.append(mask_category)
        addSkip = True

    hotkeys = [Config.EMPTY_HOTKEY_ID] * Config.NUMBER_OF_HOTKEYS
    names = ['N'] * Config.NUMBER_OF_HOTKEYS
    for category in categories:
        if category.hotkey != None:
            num = ord(category.hotkey)

            if 48 <= num <= 57:
                #handle numbers
                indx = num-48
            elif 65 <= num <= 90:
                #handle uppercase
                indx = num-55
            elif num==32:
                #Spacebar
                indx = Config.NUMBER_OF_HOTKEYS-3
            elif num==45:
                #minus
                indx = Config.NUMBER_OF_HOTKEYS-1   #Mask Area hotkey (RFD old hotkey)
            else:
                #Handle letters
                indx = num-87

            if hotkeys[indx] == Config.EMPTY_HOTKEY_ID:
                hotkeys[indx] = category.id
                names[indx] = category.description

    if addSkip:
        hotkeys[0] = Config.SKIP_ID
        names[0] = 'Skip'

    return (hotkeys, names)

# def image_digest(image,detections):
#     '''Returns an image and detection dictionary for the given image and detections'''
#     return {'id': image.id,
#             'url': image.camera.path + '/' + image.filename,
#             'timestamp': numify_timestamp(image.corrected_timestamp),
#             'camera': image.camera_id,
#             'rating': image.detection_rating,
#             'detections': [{'id': detection.id,
#                             'top': detection.top,
#                             'bottom': detection.bottom,
#                             'left': detection.left,
#                             'right': detection.right,
#                             'category': detection.category,
#                             'individual': '-1',
#                             'static': detection.static}
#                             for detection in detections]
#     }

def translate_cluster_for_client(clusterInfo,reqId,limit,isBounding,taggingLevel,id=None,label_description=None):
    '''Outputs a cluster dictionary for consumption by the client's browser.'''

    commit = False
    if ',' in taggingLevel:
        tL = re.split(',',taggingLevel)
        # species = tL[1]
    
    reply = {'id': reqId, 'info': []}
    for cluster_id in clusterInfo:
        if len(reply['info']) < limit:
            images = []
            covered_images = []

            # Deal with labels and tags
            if clusterInfo[cluster_id]['label'] == []:
                clusterInfo[cluster_id]['label'] = ['None']
                clusterInfo[cluster_id]['label_ids'] = ['0']
            elif (',' not in taggingLevel):
                if (not isBounding) and int(taggingLevel) > 0:
                    # species annotating a parent category - remove the parent label
                    labels = []
                    label_ids = []
                    for description in clusterInfo[cluster_id]['label']:
                        if description!=label_description:
                            labels.append(description)
                    for label_id in clusterInfo[cluster_id]['label_ids']:
                        if label_id!=int(taggingLevel):
                            label_ids.append(label_id)
                    clusterInfo[cluster_id]['label'] = labels
                    clusterInfo[cluster_id]['label_ids'] = label_ids

            if clusterInfo[cluster_id]['tags'] == []:
                clusterInfo[cluster_id]['tags'] = ['None']
                clusterInfo[cluster_id]['tag_ids'] = ['0']

            for image_id in clusterInfo[cluster_id]['images']:
                for detection_id in clusterInfo[cluster_id]['images'][image_id]['detections']:
                    if clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'] == []:
                        clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'] = ['None']
                    if clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'] == []:
                        clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'] = ['-1']


            # add required images
            # if (not id) and (not isBounding) and (',' not in taggingLevel) and('-6' not in taggingLevel):
            if (not id) and (not isBounding) and (',' not in taggingLevel):
                for image_id in clusterInfo[cluster_id]['required']:
                    if image_id in clusterInfo[cluster_id]['images'].keys():
                        covered_images.append(image_id)
                        images.append({
                            'id': clusterInfo[cluster_id]['images'][image_id]['id'],
                            'url': clusterInfo[cluster_id]['images'][image_id]['url'].replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                            'timestamp': clusterInfo[cluster_id]['images'][image_id]['timestamp'],
                            'camera': clusterInfo[cluster_id]['images'][image_id]['camera'],
                            'rating': clusterInfo[cluster_id]['images'][image_id]['rating'],
                            'latitude': clusterInfo[cluster_id]['images'][image_id]['latitude'],
                            'longitude': clusterInfo[cluster_id]['images'][image_id]['longitude'],
                            'detections': [{
                                'id': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['id'],
                                'top': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['top'],
                                'bottom': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['bottom'],
                                'left': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['left'],
                                'right': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['right'],
                                'category': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['category'],
                                'individuals': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'],
                                'individual': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'][0],
                                'individual_names': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individual_names'],
                                'static': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['static'],
                                'labels': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'],
                                'label': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'][0],
                                'flank': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['flank'].capitalize()}
                            for detection_id in clusterInfo[cluster_id]['images'][image_id]['detections'] if ((
                                                                    '-4' not in taggingLevel) 
                                                                or (
                                                                    (clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals']==['-1']) 
                                                                    # and (species in clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'])
                                                                ))]
                        })
            
            required = [n for n in range(len(images))]

            # Add videos
            if id:
                for video_id in clusterInfo[cluster_id]['videos']:
                    images.append({
                        'id': clusterInfo[cluster_id]['videos'][video_id]['id'],
                        'url': clusterInfo[cluster_id]['videos'][video_id]['url'].replace('+','%2B').replace('?','%3F'),
                        'timestamp': clusterInfo[cluster_id]['videos'][video_id]['timestamp'],
                        'camera': clusterInfo[cluster_id]['videos'][video_id]['camera'],
                        'rating': clusterInfo[cluster_id]['videos'][video_id]['rating'],
                        'detections': []
                    })
            
            # Order images
            if id or ('-4' in taggingLevel) or ('-5' in taggingLevel) or ('-8' in taggingLevel):
                # Order chronologically
                order_by_filename = False
                x = {}
                x2 = {}
                for image_id in clusterInfo[cluster_id]['images']:
                    x[image_id] = clusterInfo[cluster_id]['images'][image_id]['timestamp']
                    x2[image_id] = clusterInfo[cluster_id]['images'][image_id]['filename']
                    if x[image_id]==0: order_by_filename = True

                if order_by_filename:
                    # If there are no timestamps - filename will give chronological order
                    ordered_ids = {k: v for k, v in sorted(x2.items(), key=lambda item: item[1])}
                else:
                    ordered_ids = {k: v for k, v in sorted(x.items(), key=lambda item: item[1])}

            else:
                # Order by detection rating
                x = {}
                for image_id in clusterInfo[cluster_id]['images']:
                    x[image_id] = clusterInfo[cluster_id]['images'][image_id]['rating']
                ordered_ids = {k: v for k, v in sorted(x.items(), key=lambda item: item[1], reverse=True)}

            # Add other images up until size limit
            # if (id or isBounding or ('-4' in taggingLevel) or ('-5' in taggingLevel) or ('-3' in taggingLevel)) or (len(images) < 5):
            if True:
                for image_id in ordered_ids:
                    if image_id not in covered_images:
                        covered_images.append(image_id)
                        images.append({
                            'id': clusterInfo[cluster_id]['images'][image_id]['id'],
                            'url': clusterInfo[cluster_id]['images'][image_id]['url'].replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                            'timestamp': clusterInfo[cluster_id]['images'][image_id]['timestamp'],
                            'camera': clusterInfo[cluster_id]['images'][image_id]['camera'],
                            'rating': clusterInfo[cluster_id]['images'][image_id]['rating'],
                            'latitude': clusterInfo[cluster_id]['images'][image_id]['latitude'],
                            'longitude': clusterInfo[cluster_id]['images'][image_id]['longitude'],
                            'detections': [{
                                'id': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['id'],
                                'top': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['top'],
                                'bottom': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['bottom'],
                                'left': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['left'],
                                'right': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['right'],
                                'category': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['category'],
                                'individuals': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'],
                                'individual': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals'][0],
                                'individual_names': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individual_names'],
                                'static': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['static'],
                                'labels': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'],
                                'label': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'][0],
                                'flank': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['flank'].capitalize()}
                            for detection_id in clusterInfo[cluster_id]['images'][image_id]['detections'] if ((
                                                                '-4' not in taggingLevel) 
                                                            or (
                                                                (clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals']==['-1']) 
                                                                # and (species in clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'])
                                                            ))]
                        })
                    
                    # dont break if certain annotation types
                    # if not (id or isBounding or ('-4' in taggingLevel) or ('-5' in taggingLevel) or ('-3' in taggingLevel)) and (len(images) >= 5): break

            # Handle classifications
            classification = []
            if ('-3' in taggingLevel) or ('-8' in taggingLevel):
                # Order by ratio
                ordered_labels = {k: v for k, v in sorted(clusterInfo[cluster_id]['classification'].items(), key=lambda item: item[1], reverse=True)}
                for label in ordered_labels:
                    if label not in clusterInfo[cluster_id]['label']:
                        classification.append([label,clusterInfo[cluster_id]['classification'][label]])

            # Add cluster to reply
            cluster_dict = {
                'id': cluster_id,
                'classification': classification,
                'required': required,
                'images': images,
                'label': clusterInfo[cluster_id]['label'], 
                'label_ids': clusterInfo[cluster_id]['label_ids'], 
                'tags': clusterInfo[cluster_id]['tags'], 
                'tag_ids': clusterInfo[cluster_id]['tag_ids'], 
                'groundTruth': clusterInfo[cluster_id]['groundTruth'], 
                'trapGroup': clusterInfo[cluster_id]['trapGroup'], 
                'notes': clusterInfo[cluster_id]['notes']
            }

            if id and ('user' in clusterInfo[cluster_id].keys()):
                cluster_dict['annotator'] = clusterInfo[cluster_id]['user']
                cluster_dict['site_tag'] = clusterInfo[cluster_id]['site_tag']
                cluster_dict['latitude'] = clusterInfo[cluster_id]['latitude']
                cluster_dict['longitude'] = clusterInfo[cluster_id]['longitude']

            if (('-3' in taggingLevel) or ('-8' in taggingLevel)) and (len(classification)==0):
                cluster = db.session.query(Cluster).get(cluster_id)
                if cluster:
                    cluster.examined = True
                    commit = True
                    if Config.DEBUGGING: app.logger.info('Cluster {} marked as examined (No classifications)'.format(cluster_id))
                continue

            reply['info'].append(cluster_dict)

        else:
            break
    
    if commit: db.session.commit()
    
    return reply

# def translate_cluster_for_client(cluster,id,isBounding,taggingLevel,user,sendVideo):
#     '''Outputs a cluster dictionary for consumption by the client's browser.'''

#     startTime = time.time()

#     sortedImages = []
#     required = []

#     if '-5' in taggingLevel:
#         # bufferCount = db.session.query(Individual).filter(Individual.allocated==user.id).count()
#         # if bufferCount >= 5:
#         #     remInds = db.session.query(Individual)\
#         #                     .filter(Individual.allocated==user.id)\
#         #                     .order_by(Individual.allocation_timestamp).limit(bufferCount-4).all()
#         #     for remInd in remInds:
#         #         remInd.allocated = None
#         #         remInd.allocation_timestamp = None

#         # cluster.allocated = user.id
#         # cluster.allocation_timestamp = datetime.utcnow()
#         # db.session.commit()

#         sortedImages = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(cluster)).order_by(Image.corrected_timestamp).all()

#         images = []
#         for image in sortedImages:
#             output = {'id': image.id,
#                     'url': image.camera.path + '/' + image.filename,
#                     'timestamp': numify_timestamp(image.corrected_timestamp),
#                     'camera': image.camera_id,
#                     'rating': image.detection_rating,
#                     'latitude': image.camera.trapgroup.latitude,
#                     'longitude': image.camera.trapgroup.longitude,
#                     'detections': []}

#             detection = db.session.query(Detection)\
#                                 .filter(Detection.image_id==image.id)\
#                                 .filter(Detection.individuals.contains(cluster))\
#                                 .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                 .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                                 .filter(Detection.static==False)\
#                                 .first()

#             output['detections'].append({'id': detection.id,
#                                         'top': detection.top,
#                                         'bottom': detection.bottom,
#                                         'left': detection.left,
#                                         'right': detection.right,
#                                         'category': detection.category,
#                                         'individual': '-1',
#                                         'static': detection.static})

#             images.append(output)

#         reply = {'id': cluster.id,'classification': [],'required': [], 'images': images, 'label': [], 'tags': [], 'groundTruth': [], 'trapGroup': 'None', 'notes':cluster.notes}
    
#     else:

#         if sendVideo:
#             videos = db.session.query(Video).join(Camera).join(Image).filter(Image.clusters.contains(cluster)).all()
#             if videos:
#                 images = [{'id': video.id,
#                     'url': video.camera.path.split('_video_images_')[0]  + video.filename,
#                     'timestamp': numify_timestamp(video.camera.images[0].corrected_timestamp),
#                     'camera': video.camera_id,
#                     'rating': 1,
#                     'detections': []
#                 } for video in videos]

#                 sortedImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.filename).all()
#                 required = []

#                 images_video = [image_digest(
#                             image,
#                             [detection for detection in image.detections if (
#                                 (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and
#                                 (detection.status not in Config.DET_IGNORE_STATUSES) and 
#                                 (detection.static == False)
#                             )]
#                         ) for image in sortedImages]

#                 images.extend(images_video)
        
#         if (sendVideo==False) or (len(videos)==0):
#             if (id is not None) or isBounding:
#                 sortedImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.detection_rating)).all()
#                 required = []
#             elif '-4' in taggingLevel:
#                 # If its for individual ID, send entire cluster, and order the images chronologically
#                 sortedImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp,Image.filename).all()
#                 required = []
#             else:
#                 sortedImages = db.session.query(Image).filter(Image.required_for.contains(cluster)).all()
#                 required = [n for n in range(len(sortedImages))]
#                 if len(sortedImages) < 5:
#                     images = db.session.query(Image)\
#                                 .filter(Image.clusters.contains(cluster))\
#                                 .filter(~Image.id.in_([r.id for r in sortedImages]))\
#                                 .order_by(desc(Image.detection_rating))\
#                                 .limit(5-len(sortedImages))\
#                                 .all()
#                     sortedImages.extend(images)
                
#             endTime = time.time()
#             if Config.DEBUGGING: print("getImages query completed in {}".format(endTime - startTime))

#             if '-4' in taggingLevel:
#                 tL = re.split(',',taggingLevel)
#                 species = tL[1]
#                 label = db.session.query(Label).filter(Label.task_id==cluster.task_id).filter(Label.description==species).first()

#                 images = []
#                 for image in sortedImages:
#                     exclude  = db.session.query(Detection)\
#                                         .join(Labelgroup)\
#                                         .join(Individual,Detection.individuals)\
#                                         .filter(Detection.image_id==image.id)\
#                                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                                         .filter(Detection.static==False)\
#                                         .filter(Labelgroup.task_id==cluster.task_id)\
#                                         .filter(Labelgroup.labels.contains(label))\
#                                         .filter(Individual.tasks.contains(cluster.task))\
#                                         .filter(Individual.species==species)\
#                                         .distinct().all()

#                     detections = db.session.query(Detection)\
#                                         .join(Labelgroup)\
#                                         .filter(Detection.image_id==image.id)\
#                                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                                         .filter(Detection.static==False)\
#                                         .filter(Labelgroup.task_id==cluster.task_id)\
#                                         .filter(Labelgroup.labels.contains(label))\
#                                         .filter(~Detection.id.in_([r.id for r in exclude]))\
#                                         .distinct().all()
                    
#                     images.append(image_digest(image,detections))

#             else:
#                 images = [image_digest(
#                             image,
#                             [detection for detection in image.detections if (
#                                 (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and
#                                 (detection.status not in Config.DET_IGNORE_STATUSES) and 
#                                 (detection.static == False)
#                             )]
#                         ) for image in sortedImages]

#             if isBounding:
#                 for image in images:
#                     for detection in image['detections']:
#                         labelgroup = db.session.query(Labelgroup).filter(Labelgroup.task_id==cluster.task_id).filter(Labelgroup.detection_id==detection['id']).first()
#                         if labelgroup.labels != []:
#                             detection['label'] = labelgroup.labels[0].description
#                         else:
#                             detection['label'] = ''

#         cluster_labels = []
#         cluster_label_ids = []
#         if cluster.labels == []:
#             cluster_labels.append('None')
#             cluster_label_ids.append('0')
#         else:
#             if (',' in taggingLevel) or isBounding or (int(taggingLevel) <= 0):
#                 for label in cluster.labels:
#                     cluster_labels.append(label.description)
#                     cluster_label_ids.append(str(label.id))
#             else:
#                 for label in cluster.labels:
#                     if label.id != int(taggingLevel):
#                         cluster_labels.append(label.description)
#                         cluster_label_ids.append(str(label.id))

#         tags = []
#         tag_ids = []
#         if cluster.tags == []:
#             tags.append('None')
#             tag_ids.append('0')
#         else:
#             for tag in cluster.tags:
#                 tags.append(tag.description)
#                 tag_ids.append(str(tag.id))

#         groundTruth = []
        
#         if taggingLevel == '-3':
#             classification = getClusterClassifications(cluster.id)
#         else:
#             classification = []

#         if len(sortedImages) > 0:
#             trapGroup = sortedImages[0].camera.trapgroup_id
#         else:
#             trapGroup = 'None'

#         reply = {'id': cluster.id,'classification': classification,'required': required, 'images': images, 'label': cluster_labels, 'label_ids': cluster_label_ids, 'tags': tags, 'tag_ids': tag_ids, 'groundTruth': groundTruth, 'trapGroup': trapGroup, 'notes': cluster.notes}

#     return reply

# @celery.task(ignore_result=True)
# def manageDownloads():
#     '''Celery task for managing image download statuses - cleans up abandoned downloads.'''

#     try:
#         startTime = datetime.utcnow()

#         tasks = [r[0] for r in db.session.query(Task.id)\
#                             .join(Survey)\
#                             .join(Organisation)\
#                             .outerjoin(UserPermissions)\
#                             .outerjoin(User,User.id==UserPermissions.user_id)\
#                             .join(Trapgroup, Trapgroup.survey_id==Survey.id)\
#                             .join(Camera)\
#                             .join(Image)\
#                             .filter(Image.downloaded==True)\
#                             .filter(User.last_ping>(datetime.utcnow()-timedelta(minutes=15)))\
#                             .filter(~Task.status.in_(['Processing','Preparing Download']))\
#                             .distinct().all()]
        
#         for task in tasks:
#             resetImageDownloadStatus.delay(task_id=task,then_set=False,labels=None,include_empties=None, include_frames=True)

#         tasks = [r[0] for r in db.session.query(Task.id)\
#                             .join(Survey)\
#                             .join(Organisation)\
#                             .outerjoin(UserPermissions)\
#                             .outerjoin(User,User.id==UserPermissions.user_id)\
#                             .join(Trapgroup, Trapgroup.survey_id==Survey.id)\
#                             .join(Camera)\
#                             .join(Video)\
#                             .filter(Video.downloaded==True)\
#                             .filter(User.last_ping>(datetime.utcnow()-timedelta(minutes=15)))\
#                             .filter(~Task.status.in_(['Processing','Preparing Download']))\
#                             .distinct().all()]
        
#         for task in tasks:
#             resetVideoDownloadStatus.delay(task_id=task,then_set=False,labels=None,include_empties=None, include_frames=True)

#     except Exception as exc:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')

#     finally:
#         db.session.remove()
#         countdown = 120 - (datetime.utcnow()-startTime).total_seconds()
#         if countdown < 0: countdown=0
#         manageDownloads.apply_async(queue='priority', priority=0, countdown=countdown)
        
#     return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def skipCameraImages(self,cameragroup_id):
    '''Clears the timestamps of all images in a cameragroup that were extracted or has no timestamp and sets them as skipped.'''
    try:
        images = db.session.query(Image)\
                    .join(Camera)\
                    .join(Cameragroup)\
                    .filter(Cameragroup.id==cameragroup_id)\
                    .filter(or_(Image.corrected_timestamp==None,Image.extracted==True))\
                    .distinct().all()
        
        for image in images:
            image.skipped = True
            image.corrected_timestamp = None
            image.timestamp = None

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
