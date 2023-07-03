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
                                    getClusterClassifications, checkForIdWork, numify_timestamp
from app.functions.individualID import calculate_detection_similarities, generateUniqueName, cleanUpIndividuals, calculate_individual_similarities
from app.functions.results import resetImageDownloadStatus, resetVideoDownloadStatus
import GLOBALS
from sqlalchemy.sql import func, distinct, or_, alias, and_
from sqlalchemy import desc
from datetime import datetime, timedelta
import re
import math
from config import Config
import traceback
import time
from multiprocessing.pool import ThreadPool as Pool

def required_images(cluster,relevent_classifications,transDict):
    '''
    Returns the required images for a specified cluster.
    
        Parameters:
            cluster (Cluster): Cluster that the required images are needed for
            relevent_classifications (list): The list of tagging-level relevent classifications for a cluster
            transDict (dict): The translation dictionary between child labels and the relevent classifications
    '''
    
    sortedImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.detection_rating)).all()

    species = db.session.query(Detection.classification)\
                        .join(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Survey)\
                        .join(Classifier)\
                        .filter(Image.clusters.contains(cluster))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .filter(Detection.class_score>Classifier.threshold)\
                        .filter(Detection.classification!=None)\
                        .filter(Detection.classification.in_(relevent_classifications))\
                        .distinct().all()

    species = set([transDict[r[0]] for r in species])

    required = []
    coveredSpecies = set()
    for image in sortedImages:
        imageSpecies = db.session.query(Detection.classification)\
                        .join(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Survey)\
                        .join(Classifier)\
                        .filter(Detection.image_id==image.id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .filter(Detection.class_score>Classifier.threshold)\
                        .filter(Detection.classification!=None)\
                        .filter(Detection.classification.in_(relevent_classifications))\
                        .distinct().all()

        imageSpecies = [transDict[r[0]] for r in imageSpecies]

        if any(species not in coveredSpecies for species in imageSpecies):
            coveredSpecies.update(imageSpecies)
            required.append(image)
            if coveredSpecies == species:
                break

    return required

def prep_required_images(task_id):
    '''Prepares the required images for every cluster in a specified task - the images that must be viewed by the 
    user based on the species contained therein.'''

    task = db.session.query(Task).get(task_id)
    survey_id = task.survey_id
    taggingLevel = task.tagging_level
    isBounding = task.is_bounding

    clusters = db.session.query(Cluster)\
                    .filter(Cluster.task_id == task_id)\
                    .filter(Cluster.examined==False)\
                    .distinct().all()

    if len(clusters) != 0:
        if (',' in taggingLevel) or isBounding:
            for cluster in clusters:
                cluster.required_images = []
        else:
            if int(taggingLevel) > 0:
                parent_id = int(taggingLevel)
                label = db.session.query(Label).get(int(taggingLevel))
                names = [label.description]
                ids = [label.id]
                names, ids = addChildLabels(names,ids,label,task_id)
                relevent_classifications = db.session.query(Translation.classification)\
                                                    .filter(Translation.label_id.in_(ids))\
                                                    .filter(Translation.task_id==task_id)\
                                                    .filter(func.lower(Translation.classification)!='nothing')\
                                                    .filter(Translation.label_id!=GLOBALS.nothing_id)\
                                                    .distinct().all()
                relevent_classifications = [r[0] for r in relevent_classifications]
            else:
                parent_id = None
                label = None
                relevent_classifications = db.session.query(Detection.classification)\
                                                    .join(Translation,Translation.classification==Detection.classification)\
                                                    .join(Image)\
                                                    .join(Camera)\
                                                    .join(Trapgroup)\
                                                    .filter(Translation.task_id==task_id)\
                                                    .filter(Trapgroup.survey_id==survey_id)\
                                                    .filter(Detection.classification!=None)\
                                                    .filter(func.lower(Detection.classification)!='nothing')\
                                                    .filter(Translation.label_id!=GLOBALS.nothing_id)\
                                                    .distinct().all()
                relevent_classifications = [r[0] for r in relevent_classifications]
            
            transDict = {}
            categories = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==parent_id).all()
            categories.append(db.session.query(Label).get(GLOBALS.vhl_id))
            categories.append(db.session.query(Label).get(GLOBALS.nothing_id))

            if label:
                categories.append(label)

            for category in categories:
                names = [category.description]
                ids = [category.id]
                names, ids = addChildLabels(names,ids,category,task_id)
                child_classifications = db.session.query(Translation.classification)\
                                                    .filter(Translation.label_id.in_(ids))\
                                                    .filter(Translation.task_id==task_id)\
                                                    .distinct().all()
                child_classifications = [r[0] for r in child_classifications]
                
                for child_classification in child_classifications:
                    transDict[child_classification] = category.description

            for cluster in clusters:
                cluster.required_images = required_images(cluster,relevent_classifications,transDict)
        # db.session.commit()
    
    return len(clusters)

@celery.task(bind=True,max_retries=29,ignore_result=True)
def launch_task(self,task_id):
    '''Celery task for launching the specified task for annotation.'''

    try:
        app.logger.info('Started LaunchTask for task {}'.format(task_id))

        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level
        isBounding = task.is_bounding

        if task.jobs_finished == None:
            task.jobs_finished = 0

        # Do some prep for individual ID tasks
        if ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            species = tL[1]

            if tL[0] == '-4':
                label = db.session.query(Label).filter(Label.task==task).filter(Label.description==species).first()

                #Start calculating detection similarities in the background
                if tL[4]=='h':
                    calculate_detection_similarities.delay(task_ids=[task_id],species=label.description,algorithm='hotspotter')
                elif tL[4]=='n':
                    calculate_detection_similarities.delay(task_ids=[task_id],species=label.description,algorithm='none')

                if tL[3] == 'a':
                    sq = db.session.query(Cluster.id.label('clusterID'),Detection.id.label('detID'),func.count(distinct(Detection.id)).label('detCount'),func.count(distinct(Image.id)).label('imCount'))\
                                        .join(Image,Cluster.images)\
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(['deleted','hidden'])) \
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
                                        .filter(~Detection.status.in_(['deleted','hidden'])) \
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
                    check = db.session.query(IndSimilarity)\
                                    .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Task.id.in_(task_ids))\
                                    .filter(Individual.species==species)\
                                    .first()
                    if check==None:
                        calculate_individual_similarities(task.id,species,None)

                #extract threshold
                threshold = tL[2]
                if threshold=='-1':
                    tL[2] = str(Config.SIMILARITY_SCORE)
                    task.tagging_level = ','.join(tL)
                    taggingLevel = task.tagging_level

                skips = db.session.query(IndSimilarity)\
                                .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==species)\
                                .filter(IndSimilarity.skipped==True)\
                                .distinct().all()
                
                for skip in skips:
                    skip.skipped = False

                allocateds = db.session.query(IndSimilarity)\
                                .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==species)\
                                .filter(IndSimilarity.allocated!=None)\
                                .distinct().all()

                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                allocateds = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==species)\
                                .filter(Individual.allocated!=None)\
                                .distinct().all()

                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                # db.session.commit()
        
        # Mark clusters that need to be examined
        if '-5' in taggingLevel:
            cluster_count = checkForIdWork(task_ids,species,tL[2])

            if cluster_count == 0:
                # Release task if the are no clusters to annotate
                updateTaskCompletionStatus(task_id)
                updateLabelCompletionStatus(task_id)
                updateIndividualIdStatus(task_id)
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

            clusters = sq.filter(Cluster.task_id == task_id) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .distinct().all()

            cluster_count = len(clusters)

            if cluster_count == 0:
                # Release task if the are no clusters to annotate
                updateTaskCompletionStatus(task_id)
                updateLabelCompletionStatus(task_id)
                updateIndividualIdStatus(task_id)
                task.status = 'SUCCESS'
                task.survey.status = 'Ready'
                for tsk in task.sub_tasks:
                    tsk.status = 'SUCCESS'
                    tsk.survey.status = 'Ready'
                db.session.commit()
                return True

            # for chunk in chunker(clusters,2500):
            for cluster in clusters:
                cluster.examined = False
            # db.session.commit()

        task.cluster_count = cluster_count

        if not (any(item in taggingLevel for item in ['-4','-5']) or isBounding):
            prep_required_images(task_id)

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

# @celery.task(bind=True,max_retries=29,ignore_result=True)
def freeUpWork(task,session):
    '''Attempts to free up trapgroups etc. to allow task annotation to complete.'''

    if '-5' not in task.tagging_level:
        clusterSQ = session.query(Trapgroup.id,func.max(Cluster.timestamp).label('timestamp'))\
                                .join(Camera)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .filter(Cluster.task_id == task.id) \
                                .subquery()

        trapgroups = session.query(Trapgroup) \
                        .join(Camera) \
                        .join(Image) \
                        .join(Cluster, Image.clusters) \
                        .outerjoin(clusterSQ,clusterSQ.c.id==Trapgroup.id)\
                        .filter(Cluster.task_id == task.id) \
                        .filter(Trapgroup.active == False) \
                        .filter(Trapgroup.processing == False) \
                        .filter(Trapgroup.queueing == False)\
                        .filter(Trapgroup.user_id == None)\
                        .filter(Cluster.examined==False)\
                        .filter(or_(clusterSQ.c.timestamp<datetime.utcnow()-timedelta(minutes=2),clusterSQ.c.timestamp==None))\
                        .distinct().all()

        if Config.DEBUGGING: app.logger.info('{} inactive trapgroups identified for survey {}'.format(len(trapgroups),task.survey.name))

        for trapgroup in trapgroups:
            trapgroup.active = True
            GLOBALS.redisClient.rpush('trapgroups_'+str(task.survey_id),trapgroup.id)

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def wrapUpTask(self,task_id):
    '''Cleans up a task after annotation.'''

    try:
        task = db.session.query(Task).get(task_id)

        GLOBALS.redisClient.delete('active_jobs_'+str(task.id))
        GLOBALS.redisClient.delete('job_pool_'+str(task.id))

        turkcodes = db.session.query(Turkcode).outerjoin(User).filter(Turkcode.task_id==task_id).filter(User.id==None).filter(Turkcode.active==True).all()
        for turkcode in turkcodes:
            db.session.delete(turkcode)

        if '-5' in task.tagging_level:
            cleanUpIndividuals(task_id)

        clusters = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.skipped==True).distinct().all()
        for cluster in clusters:
            cluster.skipped = False

        updateTaskCompletionStatus(task_id)
        updateLabelCompletionStatus(task_id)
        updateIndividualIdStatus(task_id)

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

        if '-4' in task.tagging_level:
            #Check if complete
            tL = re.split(',',task.tagging_level)
            species = tL[1]
            incompleteIndividuals = db.session.query(Individual)\
                                            .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                            .filter(Individual.tasks.contains(task))\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .filter(IndSimilarity.score==None)\
                                            .distinct().count() 
            if Config.DEBUGGING: app.logger.info('There are {} incomplete individuals for wrapTask'.format(incompleteIndividuals))
            if incompleteIndividuals == 0:
                task.survey.status = 'Ready'

        elif '-3' in task.tagging_level:
            task.ai_check_complete = True

        #Accounts for individual ID background processing
        if 'processing' not in task.survey.status:
            task.survey.status = 'Ready'

        # handle multi-tasks
        for sub_task in task.sub_tasks:
            sub_task.status = 'SUCCESS'
            sub_task.survey.status = 'Ready'
        task.sub_tasks = []

        #remove trapgroup list from redis
        GLOBALS.redisClient.delete('trapgroups_'+str(task.survey_id))

        if task_id in GLOBALS.mutex.keys(): GLOBALS.mutex.pop(int(task_id), None)
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

def manage_task(task,session):
    '''Manages an active task by controlling the number of active jobs, cleaning up item statuses, and even cleans up tasks when annotation is complete.'''

    task_id = task.id
    taggingLevel = task.tagging_level
    survey_id = task.survey_id
    jobs_to_delete = 0

    # if not populateMutex(int(task_id)):
    #     return False, jobs_to_delete

    #Manage number of workers
    if '-5' in taggingLevel:
        task_ids = [r.id for r in task.sub_tasks]
        task_ids.append(task.id)
        tL = re.split(',',taggingLevel)
        species = tL[1]
        OtherIndividual = alias(Individual)

        sq1 = session.query(Individual.id.label('indID1'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Individual.species==species)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq2 = session.query(Individual.id.label('indID2'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Task.id.in_(task_ids))\
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

    task.clusters_remaining = clusters_remaining

    if (clusters_remaining==0) and (active_jobs==0):
        processing = session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(or_(Trapgroup.processing==True,Trapgroup.queueing==True)).first()

        if not processing:
            app.logger.info('Task finished.')
            task.status = 'Wrapping Up'
            # session.commit()
            # wrapUpTask.delay(task_id=task_id)
            return True, jobs_to_delete

    elif task_jobs == 0: freeUpWork(task, session)

    return False, jobs_to_delete

@celery.task(ignore_result=True)
def manageTasks():
    '''Celery task for managing active tasks. Keeps the correct number of active jobs, cleans up abandoned jobs, and cleans up the task upon completion.'''

    try:
        startTime = datetime.utcnow()
        session = db.session()

        # Check Knockdown for timeout
        tasks = session.query(Task)\
                        .join(Survey)\
                        .join(User)\
                        .filter(User.last_ping < (datetime.utcnow()-timedelta(minutes=5)))\
                        .filter(Task.status=='Knockdown Analysis')\
                        .distinct().all()
        
        for task in tasks:
            task.status = 'successInitial'

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

        Owner = alias(User)
        Worker = alias(User)
        tasks = session.query(Task)\
                        .join(Survey)\
                        .join(Owner,Owner.c.id==Survey.user_id)\
                        .outerjoin(workersTable,Owner.c.id==workersTable.c.user_id)\
                        .outerjoin(Worker,Worker.c.id==workersTable.c.worker_id)\
                        .outerjoin(Turkcode)\
                        .outerjoin(User)\
                        .filter(or_(
                            User.last_ping>(datetime.utcnow()-timedelta(minutes=5)),
                            Owner.c.last_ping>(datetime.utcnow()-timedelta(minutes=5)),
                            Worker.c.last_ping>(datetime.utcnow()-timedelta(minutes=5)),
                            ))\
                        .filter(Task.status=='PROGRESS')\
                        .distinct().all()
        print('{} tasks are currently active.'.format(len(tasks)))

        active_jobs = []
        for task in tasks:
            active_jobs = [r.decode() for r in GLOBALS.redisClient.smembers('active_jobs_'+str(task.id))]

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

        # Ensure there are no locked-out individuals
        allocateds = session.query(IndSimilarity)\
                            .join(User)\
                            .filter(~User.username.in_(active_jobs))\
                            .distinct().all()
        
        for allocated in allocateds:
            allocated.allocated = None
            allocated.allocation_timestamp = None

        allocateds = session.query(Individual)\
                            .join(User, User.id==Individual.allocated)\
                            .filter(~User.username.in_(active_jobs))\
                            .distinct().all()
        
        for allocated in allocateds:
            allocated.allocated = None
            allocated.allocation_timestamp = None

        #Catch trapgroups that are still allocated to users that are finished
        trapgroups = session.query(Trapgroup)\
                            .join(User)\
                            .filter(~User.username.in_(active_jobs))\
                            .distinct().all()

        for trapgroup in trapgroups:
            trapgroup.user_id = None

        session.commit()

        # pool = Pool(processes=4)
        wrapUps = []
        jobs_to_delete = {}
        for task in tasks:
            wrapUp, jobs_to_delete[task.id] = manage_task(task,session)
            if wrapUp: wrapUps.append(task.id)
            # pool.apply_async(manage_task,(task_id,))
        # pool.close()
        # pool.join()

        session.commit()

        # Delete excess jobs
        for task_id in jobs_to_delete.keys():
            deleteTurkcodes(jobs_to_delete[task_id], task_id, session)

        # Wrap up finished tasks
        for task_id in wrapUps:
            wrapUpTask.delay(task_id=task_id)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        session.close()
        if Config.DEBUGGING: app.logger.info('Manage tasks completed in {}'.format(datetime.utcnow()-startTime))
        countdown = 20 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        manageTasks.apply_async(queue='priority', priority=0, countdown=countdown)
        
    return True

def allocate_new_trapgroup(task_id,user_id,survey_id,session):
    '''Allocates a new trapgroup to the specified user for the given task. Attempts to free up trapgroups if none are available. Returns the allocate trapgroup.'''

    trapgroup = GLOBALS.redisClient.lpop('trapgroups_'+str(survey_id))
    
    # trapgroup = session.query(Trapgroup) \
    #                 .filter(Trapgroup.survey_id==survey_id)\
    #                 .filter(Trapgroup.active == True) \
    #                 .filter(Trapgroup.user_id == None) \
    #                 .first()

    # if trapgroup == None:
    #     #Try to free up trapgroups
    #     trapgroups = session.query(Trapgroup) \
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
        trapgroup = session.query(Trapgroup).get(int(trapgroup.decode()))
        trapgroup.user_id = user_id
        session.commit()

    return trapgroup

def fetch_clusters(taggingLevel,task_id,isBounding,trapgroup_id,session,id=None):
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

        # Find indviduals (joined on left side of similarity) with work available
        sq1 = db.session.query(Individual.id.label('indID1'))\
                        .join(Task,Individual.tasks)\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.allocated==None)\
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
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.allocated==None)\
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
                            Trapgroup.longitude
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
                        .filter(Individual.allocated==None)\
                        .filter(or_(sq1.c.indID1!=None, sq2.c.indID2!=None))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .filter(Detection.static==False)\
                        .order_by(desc(sq3.c.count3)).all()

        if clusters:
            individuals = [clusters[0][0]]
        else:
            individuals = []

        for row in clusters:
            # Handle clusters
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
                    'static': row[13],
                    'labels': []
                }

        return clusterInfo, individuals

    else:
        IndividualTask = alias(Task)
        if id:
            # need to filter by cluster id and include videos
            clusters = session.query(
                            Cluster.id,
                            Cluster.notes,
                            Image.id,
                            Image.filename,
                            Image.corrected_timestamp,
                            Image.detection_rating,
                            Camera.id,
                            Camera.path,
                            Camera.trapgroup_id,
                            Detection.id,
                            Detection.top,
                            Detection.bottom,
                            Detection.left,
                            Detection.right,
                            Detection.category,
                            Detection.static,
                            Label.id,
                            Label.description,
                            requiredimagestable.c.image_id,
                            Tag.id,
                            Tag.description,
                            Individual.id,
                            Video.id,
                            Video.filename,
                            Detection.source,
                            Detection.score,
                            Detection.status,
                            IndividualTask.c.id
                        )\
                        .join(Image, Cluster.images) \
                        .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                        .join(Camera) \
                        .outerjoin(Video)\
                        .outerjoin(Detection) \
                        .join(Labelgroup)\
                        .outerjoin(Label,Labelgroup.labels)\
                        .outerjoin(Tag,Labelgroup.tags)\
                        .outerjoin(Individual,Detection.individuals)\
                        .outerjoin(IndividualTask,Individual.tasks)\
                        .filter(Cluster.id==id)

        elif '-3' in taggingLevel:

            classSQ = db.session.query(Cluster.id,Label.description.label('label'),func.count(distinct(Detection.id)).label('count'))\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .join(Translation,Detection.classification==Translation.classification)\
                                    .join(Label)\
                                    .join(Camera)\
                                    .join(Trapgroup)\
                                    .join(Survey)\
                                    .join(Classifier)\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(Translation.task_id==task_id)\
                                    .filter(Trapgroup.id==trapgroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
                                    .filter(Detection.class_score>Classifier.threshold) \
                                    .group_by(Cluster.id,Label.id)\
                                    .subquery()
            
            clusterDetCountSQ = db.session.query(Cluster.id,func.count(distinct(Detection.id)).label('count'))\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
                                    .group_by(Cluster.id)\
                                    .subquery()

            clusters = session.query(
                            Cluster.id,
                            Cluster.notes,
                            Image.id,
                            Image.filename,
                            Image.corrected_timestamp,
                            Image.detection_rating,
                            Camera.id,
                            Camera.path,
                            Camera.trapgroup_id,
                            Detection.id,
                            Detection.top,
                            Detection.bottom,
                            Detection.left,
                            Detection.right,
                            Detection.category,
                            Detection.static,
                            Label.id,
                            Label.description,
                            requiredimagestable.c.image_id,
                            Tag.id,
                            Tag.description,
                            Individual.id,
                            classSQ.c.label,
                            classSQ.c.count/clusterDetCountSQ.c.count,
                            Detection.source,
                            Detection.score,
                            Detection.status,
                            IndividualTask.c.id
                        )\
                        .join(Image, Cluster.images) \
                        .join(classSQ,classSQ.c.id==Cluster.id)\
                        .join(clusterDetCountSQ,clusterDetCountSQ.c.id==Cluster.id)\
                        .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                        .join(Camera) \
                        .outerjoin(Detection) \
                        .join(Labelgroup)\
                        .outerjoin(Label,Labelgroup.labels)\
                        .outerjoin(Tag,Labelgroup.tags)\
                        .outerjoin(Individual,Detection.individuals)\
                        .outerjoin(IndividualTask,Individual.tasks)\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .filter(classSQ.c.count/clusterDetCountSQ.c.count>=Config.MIN_CLASSIFICATION_RATIO)\
                        .filter(classSQ.c.count>1)\
                        .filter(Cluster.examined==False)

        else:
            # Need to filter by trapgroup id and exclude video
            clusters = session.query(
                            Cluster.id,
                            Cluster.notes,
                            Image.id,
                            Image.filename,
                            Image.corrected_timestamp,
                            Image.detection_rating,
                            Camera.id,
                            Camera.path,
                            Camera.trapgroup_id,
                            Detection.id,
                            Detection.top,
                            Detection.bottom,
                            Detection.left,
                            Detection.right,
                            Detection.category,
                            Detection.static,
                            Label.id,
                            Label.description,
                            requiredimagestable.c.image_id,
                            Tag.id,
                            Tag.description,
                            Individual.id,
                            Detection.source,
                            Detection.score,
                            Detection.status,
                            IndividualTask.c.id
                        )\
                        .join(Image, Cluster.images) \
                        .outerjoin(requiredimagestable,requiredimagestable.c.cluster_id==Cluster.id)\
                        .join(Camera) \
                        .outerjoin(Detection) \
                        .join(Labelgroup)\
                        .outerjoin(Label,Labelgroup.labels)\
                        .outerjoin(Tag,Labelgroup.tags)\
                        .outerjoin(Individual,Detection.individuals)\
                        .outerjoin(IndividualTask,Individual.tasks)\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .filter(Cluster.examined==False)
                        
        clusters = clusters.filter(Labelgroup.task_id == task_id) \
                        .filter(Cluster.task_id == task_id) \
                        .order_by(desc(Cluster.classification), desc(Image.corrected_timestamp))\
                        .distinct().all()

        for row in clusters:
            # Handle clusters
            if row[0] and (row[0] not in clusterInfo.keys()):
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
                    'notes': row[1]
                }
                if id: clusterInfo[row[0]]['videos'] = {}

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
                if (row[-2] not in ['deleted','hidden']) and (row[15]==False) and (row[-3]>Config.DETECTOR_THRESHOLDS[row[-4]]):
                    clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]] = {
                        'id': row[9],
                        'top': row[10],
                        'bottom': row[11],
                        'left': row[12],
                        'right': row[13],
                        'category': row[14],
                        'individuals': [],
                        'static': row[15],
                        'labels': []
                    }

            # Handle video
            if id and row[22] and (row[22] not in clusterInfo[row[0]]['videos'].keys()):
                clusterInfo[row[0]]['videos'][row[22]] = {
                    'id': row[22],
                    'url': row[7].split('/_video_images_')[0] + '/' + row[23],
                    'timestamp': numify_timestamp(row[4]),
                    'camera': row[6],
                    'rating': 1,
                    'detections': {}
                }

            # Handle classifications
            if ('-3' in taggingLevel) and row[22] and (row[22] not in clusterInfo[row[0]]['classification'].keys()):
                clusterInfo[row[0]]['classification'][row[22]] = float(row[23])

            if row[17] and (row[17] not in clusterInfo[row[0]]['label']): clusterInfo[row[0]]['label'].append(row[17])
            if row[16] and (row[16] not in clusterInfo[row[0]]['label_ids']): clusterInfo[row[0]]['label_ids'].append(row[16])
            if row[18] and (row[18] not in clusterInfo[row[0]]['required']): clusterInfo[row[0]]['required'].append(row[18])
            if row[20] and (row[20] not in clusterInfo[row[0]]['tags']): clusterInfo[row[0]]['tags'].append(row[20])
            if row[19] and (row[19] not in clusterInfo[row[0]]['tag_ids']): clusterInfo[row[0]]['tag_ids'].append(row[19])

            if (row[9] in clusterInfo[row[0]]['images'][row[2]]['detections'].keys()):
                if row[17] and (row[17] not in clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['labels']):
                    clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['labels'].append(row[17])
                
                # Handle individuals
                if row[-1] and row[21] and (row[21] not in clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['individuals']) and (row[-1]==task_id):
                    clusterInfo[row[0]]['images'][row[2]]['detections'][row[9]]['individuals'].append(row[21])
    
        return clusterInfo

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

def genInitKeys(taggingLevel,task_id,addSkip,addRemoveFalseDetections):
    '''Returns the labels and hotkeys for the given tagging level and task'''

    if taggingLevel == '-1':
        categories = db.session.query(Label).filter(Label.task_id == task_id).filter(Label.parent_id == None).all()
        
        special_categories = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip')
        if not addRemoveFalseDetections: special_categories = special_categories.filter(Label.id != GLOBALS.remove_false_detections_id)
        
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
                indx = Config.NUMBER_OF_HOTKEYS-2
            elif num==45:
                #minus
                indx = Config.NUMBER_OF_HOTKEYS-1
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

    if ',' in taggingLevel:
        tL = re.split(',',taggingLevel)
        species = tL[1]
    
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

            # Add videos
            if id:
                for video_id in clusterInfo[cluster_id]['videos']:
                    images.append({
                        'id': clusterInfo[cluster_id]['videos'][video_id]['id'],
                        'url': clusterInfo[cluster_id]['videos'][video_id]['url'],
                        'timestamp': clusterInfo[cluster_id]['videos'][video_id]['timestamp'],
                        'camera': clusterInfo[cluster_id]['videos'][video_id]['camera'],
                        'rating': clusterInfo[cluster_id]['videos'][video_id]['rating'],
                        'detections': []
                    })

            # add required images
            if (not id) and (not isBounding) and (',' not in taggingLevel):
                for image_id in clusterInfo[cluster_id]['required']:
                    covered_images.append(image_id)
                    images.append({
                        'id': clusterInfo[cluster_id]['images'][image_id]['id'],
                        'url': clusterInfo[cluster_id]['images'][image_id]['url'],
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
                            'static': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['static'],
                            'labels': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'],
                            'label': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'][0]}
                        for detection_id in clusterInfo[cluster_id]['images'][image_id]['detections'] if ((
                                                                '-4' not in taggingLevel) 
                                                            or (
                                                                (clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals']==['-1']) 
                                                                and (species in clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels']
                                                            )))]
                    })
            
            required = [n for n in range(len(images))]
            
            # Order images
            if id or ('-4' in taggingLevel) or ('-5' in taggingLevel):
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
            if (id or isBounding or ('-4' in taggingLevel) or ('-5' in taggingLevel)) or (len(images) < 5):
                for image_id in ordered_ids:
                    if image_id not in covered_images:
                        covered_images.append(image_id)
                        images.append({
                            'id': clusterInfo[cluster_id]['images'][image_id]['id'],
                            'url': clusterInfo[cluster_id]['images'][image_id]['url'],
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
                                'static': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['static'],
                                'labels': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'],
                                'label': clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels'][0]}
                            for detection_id in clusterInfo[cluster_id]['images'][image_id]['detections'] if ((
                                                                '-4' not in taggingLevel) 
                                                            or (
                                                                (clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['individuals']==['-1']) 
                                                                and (species in clusterInfo[cluster_id]['images'][image_id]['detections'][detection_id]['labels']
                                                            )))]
                        })
                    
                    # dont break if certain annotation types
                    if not (id or isBounding or ('-4' in taggingLevel) or ('-5' in taggingLevel)) and (len(images) >= 5): break

            # Handle classifications
            classification = []
            if '-3' in taggingLevel:
                # Order by ratio
                ordered_labels = {k: v for k, v in sorted(clusterInfo[cluster_id]['classification'].items(), key=lambda item: item[1], reverse=True)}
                for label in ordered_labels:
                    if label not in clusterInfo[cluster_id]['label']:
                        classification.append([label,clusterInfo[cluster_id]['classification'][label]])

            # Add cluster to reply
            reply['info'].append({
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
            })

        else:
            break

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
#                                 .filter(~Detection.status.in_(['deleted','hidden']))\
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
#                                 (detection.status not in ['deleted','hidden']) and 
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
#                                         .filter(~Detection.status.in_(['deleted','hidden']))\
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
#                                         .filter(~Detection.status.in_(['deleted','hidden']))\
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
#                                 (detection.status not in ['deleted','hidden']) and 
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

@celery.task(ignore_result=True)
def manageDownloads():
    '''Celery task for managing image download statuses - cleans up abandoned downloads.'''

    try:
        startTime = datetime.utcnow()

        tasks = [r[0] for r in db.session.query(Task.id)\
                            .join(Survey)\
                            .join(User)\
                            .join(Trapgroup)\
                            .join(Camera)\
                            .join(Image)\
                            .filter(Image.downloaded==True)\
                            .filter(User.last_ping>(datetime.utcnow()-timedelta(minutes=15)))\
                            .filter(~Task.status.in_(['Processing','Preparing Download']))\
                            .distinct().all()]
        
        for task in tasks:
            resetImageDownloadStatus.delay(task_id=task,then_set=False,labels=None,include_empties=None, include_frames=True)

        tasks = [r[0] for r in db.session.query(Task.id)\
                            .join(Survey)\
                            .join(User)\
                            .join(Trapgroup)\
                            .join(Camera)\
                            .join(Video)\
                            .filter(Video.downloaded==True)\
                            .filter(User.last_ping>(datetime.utcnow()-timedelta(minutes=15)))\
                            .filter(~Task.status.in_(['Processing','Preparing Download']))\
                            .distinct().all()]
        
        for task in tasks:
            resetVideoDownloadStatus.delay(task_id=task,then_set=False,labels=None,include_empties=None, include_frames=True)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
        countdown = 120 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        manageDownloads.apply_async(queue='priority', priority=0, countdown=countdown)
        
    return True
