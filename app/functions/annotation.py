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

from app import app, db, celery
from app.models import *
from app.functions.globals import populateMutex, taggingLevelSQ, addChildLabels, resolve_abandoned_jobs, createTurkcodes, deleteTurkcodes, \
                                    updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, retryTime
from app.functions.individualID import calculate_detection_similarities, generateUniqueName, cleanUpIndividuals
import GLOBALS
from sqlalchemy.sql import func, distinct, or_, alias, and_
from sqlalchemy import desc
from datetime import datetime, timedelta
import re
import math
from config import Config
import traceback

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
                        .filter(Image.clusters.contains(cluster))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .filter(Detection.class_score>Config.CLASS_SCORE)\
                        .filter(Detection.classification!=None)\
                        .filter(Detection.classification.in_(relevent_classifications))\
                        .distinct().all()

    species = set([transDict[r[0]] for r in species])

    required = []
    coveredSpecies = set()
    for image in sortedImages:
        imageSpecies = db.session.query(Detection.classification)\
                    .filter(Detection.image_id==image.id)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(['deleted','hidden']))\
                    .filter(Detection.class_score>Config.CLASS_SCORE)\
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

    sq = db.session.query(Cluster) \
        .join(Image, Cluster.images) \
        .join(Camera) \
        .join(Trapgroup) \
        .join(Detection)

    sq = taggingLevelSQ(sq,taggingLevel,isBounding,int(task_id))

    clusters = sq.filter(Cluster.task_id == int(task_id)) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
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
        db.session.commit()
    
    return len(clusters)

@celery.task(bind=True,max_retries=29,ignore_result=True)
def launchTask(self,task_id):
    '''Celery task for launching the specified task for annotation.'''

    try:
        app.logger.info('Started LaunchTask for task {}'.format(task_id))

        task = db.session.query(Task).get(task_id)
        taskSize = task.size
        taggingLevel = task.tagging_level
        survey_id = task.survey_id
        isBounding = task.is_bounding

        if task.jobs_finished == None:
            task.jobs_finished = 0

        prep_required_images(task_id)

        if taggingLevel == '-3':
            for cluster in task.clusters:
                cluster.classification_checked = False

            correct_clusters = db.session.query(Cluster)\
                                        .join(Label, Cluster.labels)\
                                        .join(Translation)\
                                        .filter(Cluster.task_id==task_id)\
                                        .filter(Translation.task_id==task_id)\
                                        .filter(Cluster.classification==Translation.classification)\
                                        .distinct(Cluster.id).all()

            correct_clusters.extend(
                db.session.query(Cluster)\
                            .join(Translation,Translation.classification==Cluster.classification)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(Translation.task_id==task_id)\
                            .filter(Translation.label_id==GLOBALS.nothing_id)\
                            .distinct().all()
            )

            correct_clusters.extend(db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(func.lower(Cluster.classification)=='nothing').all())
            downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
            correct_clusters.extend(db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(downLabel)).all())

            for cluster in correct_clusters:
                cluster.classification_checked = True

            db.session.commit()
        elif ',' in taggingLevel:
            tL = re.split(',',taggingLevel)
            label = db.session.query(Label).get(int(tL[1]))

            if tL[0] == '-4':
                #Start calculating detection similarities in the background
                if tL[4]=='h':
                    calculate_detection_similarities.delay(task_id=task_id,label_id=label.id,algorithm='hotspotter')
                elif tL[4]=='n':
                    calculate_detection_similarities.delay(task_id=task_id,label_id=label.id,algorithm='none')

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

                    exclude = db.session.query(Detection)\
                                        .join(Individual, Detection.individuals)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                                        .filter(Individual.label==label)\
                                        .filter(Individual.task_id==task_id)\
                                        .distinct().all()

                    detections = db.session.query(Detection)\
                                        .join(sq,sq.c.detID==Detection.id)\
                                        .join(Labelgroup)\
                                        .filter(Labelgroup.labels.contains(label))\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                                        .filter(~Detection.id.in_([r.id for r in exclude]))\
                                        .filter(or_(sq.c.detCount==1,sq.c.imCount==1))\
                                        .distinct().all()

                    admin = db.session.query(User).filter(User.username == 'Admin').first()
                    for detection in detections:
                        newIndividual = Individual( name=generateUniqueName(task_id,label.id,tL[2]),
                                                    task_id=task_id,
                                                    label_id=label.id,
                                                    user_id=admin.id,
                                                    timestamp=datetime.utcnow())

                        db.session.add(newIndividual)
                        newIndividual.detections = [detection]

                    db.session.commit()

                for cluster in task.clusters:
                    cluster.examined = True

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

                unidentified = db.session.query(Cluster)\
                                    .join(Image,Cluster.images)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(Cluster.labels.contains(label))\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(Labelgroup.labels.contains(label))\
                                    .filter(~Detection.id.in_([r.id for r in identified]))\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .distinct().all()

                for cluster in unidentified:
                    cluster.examined = False

                unidentifiable = db.session.query(Individual).filter(Individual.task_id==task_id).filter(Individual.label_id==label.id).filter(Individual.name=='unidentifiable').first()
                if unidentifiable == None:
                    unidentifiable = Individual(
                        name = 'unidentifiable',
                        label_id = label.id,
                        task_id = task_id
                    )
                    db.session.add(unidentifiable)

                db.session.commit()

            elif tL[0] == '-5':

                #extact threshold
                threshold = tL[2]
                if threshold=='-1':
                    tL[2] = str(Config.SIMILARITY_SCORE)
                    task.tagging_level = ','.join(tL)
                    taggingLevel = task.tagging_level

                skips = db.session.query(IndSimilarity)\
                                .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(IndSimilarity.skipped==True)\
                                .distinct().all()
                
                for skip in skips:
                    skip.skipped = False

                allocateds = db.session.query(IndSimilarity)\
                                .join(Individual, IndSimilarity.individual_1==Individual.id)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(IndSimilarity.allocated!=None)\
                                .distinct().all()

                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                allocateds = db.session.query(Individual)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.allocated!=None)\
                                .distinct().all()

                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                db.session.commit()

        trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
        for trapgroup in trapgroups:

            if '-5' in taggingLevel:
                tL = re.split(',',taggingLevel)
                label = db.session.query(Label).get(int(tL[1]))
                OtherIndividual = alias(Individual)

                sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                                .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                                .filter(OtherIndividual.c.active==True)\
                                .filter(OtherIndividual.c.name!='unidentifiable')\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
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
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.name!='unidentifiable')\
                                .group_by(Individual.id)\
                                .subquery()

                clusterCount = db.session.query(Individual)\
                                .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                                .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                                .join(Detection,Individual.detections)\
                                .join(Image)\
                                .join(Camera)\
                                .filter(Individual.active==True)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.name!='unidentifiable')\
                                .filter(Camera.trapgroup_id==trapgroup.id)\
                                .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                                .distinct().count()
            else:
                sq = db.session.query(Cluster) \
                    .join(Image, Cluster.images) \
                    .join(Camera) \
                    .join(Trapgroup) \
                    .join(Detection)

                sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

                clusterCount = sq.filter(Trapgroup.id == trapgroup.id) \
                                        .filter(Cluster.task_id == task_id) \
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        .filter(Detection.static == False) \
                                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                                        .distinct().count()

            if clusterCount == 0:
                trapgroup.active = False
            else:
                trapgroup.active = True
            trapgroup.processing = False
            trapgroup.queueing = False
            trapgroup.user_id = None

        task.status = 'PROGRESS'
        db.session.commit()

        populateMutex(int(task_id))

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

@celery.task(ignore_result=True)
def manageTasks():
    '''Celery task for managing active tasks. Keeps the correct number of active jobs, cleans up abandoned jobs, and cleans up the task upon completion.'''

    try:
        startTime = datetime.utcnow()

        # Check Knockdown for timeout
        tasks = db.session.query(Task).filter(Task.status=='Knockdown Analysis').all()
        for task in tasks:
            user = task.survey.user
            if user.last_ping < (datetime.utcnow()-timedelta(minutes=5)):
                task.status = 'successInitial'
                db.session.commit()

        tasks = db.session.query(Task).filter(Task.status=='PROGRESS').all()
        print('{} tasks are currently active.'.format(len(tasks)))

        for task in tasks:
            task_id = task.id
            taggingLevel = task.tagging_level
            isBounding = task.is_bounding
            survey_id = task.survey_id
            db.session.commit()

            if not populateMutex(int(task_id)): continue

            #Look for abandoned jobs
            inactiveUsers = db.session.query(User)\
                                    .join(Turkcode,User.username==Turkcode.user_id)\
                                    .filter(User.parent_id!=None)\
                                    .filter(~User.passed.in_(['cTrue','cFalse']))\
                                    .filter(User.last_ping<(datetime.utcnow()-timedelta(minutes=3)))\
                                    .filter(Turkcode.task_id==task_id)\
                                    .filter(Turkcode.active==False)\
                                    .all()

            abandoned_jobs = []
            for user in inactiveUsers:
                turkcode = db.session.query(Turkcode).filter(Turkcode.user_id==user.username).first()
                abandoned_jobs.append(turkcode)
                # user.passed = 'cFalse'
                # db.session.commit()
            if abandoned_jobs!=[]:
                resolve_abandoned_jobs(abandoned_jobs)

            # Ensure there are no locked-out individuals
            if '-5' in taggingLevel:
                allocateds = db.session.query(IndSimilarity)\
                                    .join(User)\
                                    .filter(User.passed.in_(['cTrue','cFalse']))\
                                    .distinct().all()
                
                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                allocateds = db.session.query(Individual)\
                                    .join(User, User.id==Individual.allocated)\
                                    .filter(User.passed.in_(['cTrue','cFalse']))\
                                    .distinct().all()
                
                for allocated in allocateds:
                    allocated.allocated = None
                    allocated.allocation_timestamp = None

                db.session.commit()

            #Catch trapgroups that are still allocated to users that are finished
            trapgroups = db.session.query(Trapgroup)\
                                .join(User)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(User.passed.in_(['cTrue','cFalse']))\
                                .distinct().all()
            
            for trapgroup in trapgroups:
                trapgroup.user_id = None
                db.session.commit()
            
            task_jobs = db.session.query(Turkcode) \
                                .join(User, User.username==Turkcode.user_id) \
                                .filter(User.parent_id!=None) \
                                .filter(~User.passed.in_(['cTrue','cFalse'])) \
                                .filter(Turkcode.task_id==task_id) \
                                .filter(Turkcode.active==False) \
                                .all()

            task_jobs.extend(db.session.query(Turkcode).filter(Turkcode.task_id==task_id).filter(Turkcode.active==True).all())

            #Manage number of workers
            if '-5' in taggingLevel:
                tL = re.split(',',taggingLevel)
                label = db.session.query(Label).get(int(tL[1]))
                OtherIndividual = alias(Individual)

                sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                                .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                                .filter(OtherIndividual.c.active==True)\
                                .filter(OtherIndividual.c.name!='unidentifiable')\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
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
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.name!='unidentifiable')\
                                .group_by(Individual.id)\
                                .subquery()

                max_workers_possible = db.session.query(Individual)\
                                .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                                .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.name!='unidentifiable')\
                                .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                                .distinct().count()

            else:
                sq = db.session.query(Trapgroup) \
                                .join(Camera) \
                                .join(Image) \
                                .join(Cluster, Image.clusters) \
                                .join(Detection) \
                                .filter(Cluster.task_id == task_id) \
                                .filter(Trapgroup.active == True) \
                                .filter(Trapgroup.processing == False)

                sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

                max_workers_possible = sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .group_by(Trapgroup.id) \
                                .count()

            #Check if finished:
            if '-5' in taggingLevel:
                OtherIndividual = alias(Individual)

                sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                                .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                                .filter(OtherIndividual.c.active==True)\
                                .filter(OtherIndividual.c.name!='unidentifiable')\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
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
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.name!='unidentifiable')\
                                .group_by(Individual.id)\
                                .subquery()

                num_clusters = db.session.query(Individual)\
                                .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                                .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.name!='unidentifiable')\
                                .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                                .distinct().count()
            else:
                sq = db.session.query(Cluster) \
                                .join(Image, Cluster.images) \
                                .join(Detection)

                sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

                num_clusters = sq.filter(Cluster.task_id == task_id) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .distinct(Cluster.id).count()

            if max_workers_possible != 1:
                max_workers_possible = math.floor(max_workers_possible * 0.9)
            else:
                max_workers_possible = 1

            #Check job count
            if len(task_jobs) < max_workers_possible:
                app.logger.info('Creating {} new hits.'.format(max_workers_possible - len(task_jobs)))
                createTurkcodes(max_workers_possible - len(task_jobs), task_id)
            elif (len(task_jobs) > max_workers_possible):
                app.logger.info('Removing {} excess hits.'.format(len(task_jobs) - max_workers_possible))
                deleteTurkcodes(len(task_jobs) - max_workers_possible, task_jobs, task_id)

            if num_clusters == 0:
                processing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.processing==True).count()
                queueing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.queueing==True).count()

                active_jobs = db.session.query(Turkcode) \
                                    .join(User, User.username==Turkcode.user_id) \
                                    .filter(User.parent_id!=None) \
                                    .filter(~User.passed.in_(['cTrue','cFalse'])) \
                                    .filter(Turkcode.task_id==task_id) \
                                    .filter(Turkcode.active==False) \
                                    .count()

                if (processing==0) and (queueing==0) and (active_jobs==0):
                    app.logger.info('Task finished.')

                    GLOBALS.mutex[int(task_id)]['job'].acquire()
                    turkcodes = db.session.query(Turkcode).outerjoin(User, User.username==Turkcode.user_id).filter(Turkcode.task_id==task_id).filter(User.id==None).filter(Turkcode.active==True).all()
                    for turkcode in turkcodes:
                        db.session.delete(turkcode)

                    GLOBALS.mutex[int(task_id)]['job'].release()

                    if '-5' in taggingLevel:
                        cleanUpIndividuals(task_id)

                    clusters = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.skipped==True).distinct().all()
                    for cluster in clusters:
                        cluster.skipped = False
                    db.session.commit()

                    updateTaskCompletionStatus(task_id)
                    updateLabelCompletionStatus(task_id)
                    updateIndividualIdStatus(task_id)

                    task.current_name = None

                    GLOBALS.mutex.pop(int(task_id), None)

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
                                        .join(User, User.username==Turkcode.user_id)\
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
                        incompleteIndividuals = db.session.query(Individual)\
                                                        .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                        .filter(Individual.task_id==task_id)\
                                                        .filter(Individual.label_id==int(tL[1]))\
                                                        .filter(Individual.name!='unidentifiable')\
                                                        .filter(or_(IndSimilarity.id==None,IndSimilarity.score==None))\
                                                        .distinct().count() 

                        if incompleteIndividuals == 0:
                            task.survey.status = 'Ready'
                            db.session.commit()

                    #Accounts for individual ID background processing
                    if 'processing' not in task.survey.status:
                        task.survey.status = 'Ready'
                    db.session.commit()

            else:
                if len(task_jobs) == 0:
                    #There are some clusters in inactive trapgroups, so release them
                    app.logger.info('There are clusters remaining, but no HITs. Attempting to release trapgroups.')
                    if '-5' in taggingLevel:
                        tL = re.split(',',taggingLevel)
                        label = db.session.query(Label).get(int(tL[1]))
                        OtherIndividual = alias(Individual)

                        sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                                        .filter(OtherIndividual.c.active==True)\
                                        .filter(OtherIndividual.c.name!='unidentifiable')\
                                        .filter(IndSimilarity.score>=tL[2])\
                                        .filter(IndSimilarity.skipped==False)\
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
                                        .filter(IndSimilarity.score>=tL[2])\
                                        .filter(IndSimilarity.skipped==False)\
                                        .filter(Individual.task_id==task_id)\
                                        .filter(Individual.label_id==label.id)\
                                        .filter(Individual.active==True)\
                                        .filter(Individual.name!='unidentifiable')\
                                        .group_by(Individual.id)\
                                        .subquery()

                        trapgroups = db.session.query(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .join(Individual,Detection.individuals)\
                                        .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                                        .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                                        .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                        .filter(Individual.allocated==None)\
                                        .filter(IndSimilarity.allocated==None)\
                                        .filter(Individual.active==True)\
                                        .filter(Trapgroup.active == False)\
                                        .filter(Trapgroup.processing == False)\
                                        .filter(Trapgroup.queueing == False)\
                                        .filter(Individual.task_id==task_id)\
                                        .filter(Individual.label_id==label.id)\
                                        .filter(Individual.name!='unidentifiable')\
                                        .filter(Trapgroup.survey_id==survey_id)\
                                        .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                                        .distinct().all()

                    else:
                        sq = db.session.query(Trapgroup) \
                            .join(Camera) \
                            .join(Image) \
                            .join(Cluster, Image.clusters) \
                            .join(Detection) \
                            .filter(Cluster.task_id == task_id) \
                            .filter(Trapgroup.active == False) \
                            .filter(Trapgroup.processing == False) \
                            .filter(Trapgroup.queueing == False)

                        sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

                        trapgroups = sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .group_by(Trapgroup.id) \
                            .order_by(func.count(distinct(Cluster.id)).desc()) \
                            .all()

                    app.logger.info('{} inactive trapgroups identified: {}'.format(len(trapgroups),trapgroups))

                    for trapgroup in trapgroups:
                        if '-5' in taggingLevel:
                            most_recent = db.session.query(Individual)\
                                                    .join(Detection,Individual.detections)\
                                                    .join(Labelgroup)\
                                                    .join(Image)\
                                                    .join(Camera)\
                                                    .filter(Camera.trapgroup_id == trapgroup.id)\
                                                    .filter(Individual.task_id == task_id) \
                                                    .filter(Individual.timestamp!=None) \
                                                    .filter(Labelgroup.task_id==task_id)\
                                                    .filter(Labelgroup.labels.contains(label))\
                                                    .order_by(Individual.timestamp.desc()) \
                                                    .first()
                        else:
                            most_recent = db.session.query(Cluster) \
                                                    .join(Image, Cluster.images) \
                                                    .join(Camera) \
                                                    .filter(Camera.trapgroup_id == trapgroup.id) \
                                                    .filter(Cluster.task_id == task_id) \
                                                    .filter(Cluster.timestamp!=None) \
                                                    .order_by(Cluster.timestamp.desc()) \
                                                    .first()

                        if most_recent != None:
                            most_recent_time = most_recent.timestamp
                            if (datetime.utcnow() - most_recent_time) > timedelta(minutes=2):
                                trapgroup.active = True
                                db.session.commit()
                        else:
                            trapgroup.active = True
                            db.session.commit()

                    additional = db.session.query(Trapgroup)\
                                        .join(User)\
                                        .filter(Trapgroup.survey_id==survey_id)\
                                        .filter(User.passed.in_(['cTrue','cFalse']))\
                                        .distinct().all()

                    for trapgroup in additional:
                        trapgroup.user_id = None
                        db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        # self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()
        countdown = 10 - (datetime.utcnow()-startTime).total_seconds()
        if countdown < 0: countdown=0
        manageTasks.apply_async(queue='priority', priority=0, countdown=countdown)
        
    return True

def allocate_new_trapgroup(task_id,user_id):
    '''Allocates a new trapgroup to the specified user for the given task. Attempts to free up trapgroups if none are available. Returns the allocate trapgroup.'''

    taggingLevel = db.session.query(Task).get(task_id).tagging_level
    isBounding = db.session.query(Task).get(task_id).is_bounding
    survey_id = db.session.query(Task).get(task_id).survey_id
    #Allocate the trapgroup with the most remaining clusters to maximise efficiency
    if '-5' in taggingLevel:
        tL = re.split(',',taggingLevel)
        label = db.session.query(Label).get(int(tL[1]))
        OtherIndividual = alias(Individual)

        sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
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
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label.id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq3 = db.session.query(Individual.id.label('indID3'),func.count(distinct(Detection.id)).label('count3'))\
                        .join(Detection,Individual.detections)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label.id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq4 = db.session.query(Trapgroup.id.label('trapID'),func.max(sq3.c.count3).label('count4'))\
                        .join(Camera)\
                        .join(Image)\
                        .join(Detection)\
                        .join(Individual,Detection.individuals)\
                        .join(sq3,sq3.c.indID3==Individual.id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.label_id==label.id)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.name!='unidentifiable')\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .group_by(Trapgroup.id)\
                        .subquery()

        trapgroup = db.session.query(Trapgroup)\
                        .join(Camera)\
                        .join(Image)\
                        .join(Detection)\
                        .join(Individual,Detection.individuals)\
                        .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                        .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                        .join(sq4,sq4.c.trapID==Trapgroup.id)\
                        .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                        .filter(Individual.allocated==None)\
                        .filter(IndSimilarity.allocated==None)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.label_id==label.id)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.name!='unidentifiable')\
                        .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                        .filter(Trapgroup.active == True) \
                        .filter(Trapgroup.processing == False) \
                        .filter(Trapgroup.queueing == False) \
                        .filter(Trapgroup.user_id == None)\
                        .order_by(desc(sq4.c.count4))\
                        .first()

    else:
        sq = db.session.query(Trapgroup) \
                        .join(Camera) \
                        .join(Image) \
                        .join(Cluster, Image.clusters) \
                        .join(Detection) \
                        .filter(Cluster.task_id == task_id) \
                        .filter(Trapgroup.active == True) \
                        .filter(Trapgroup.processing == False) \
                        .filter(Trapgroup.queueing == False) \
                        .filter(Trapgroup.user_id == None)

        sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

        trapgroup = sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static == False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .group_by(Trapgroup.id) \
                        .order_by(func.count(distinct(Cluster.id)).desc()) \
                        .first()

    if trapgroup == None:
        #Check that a non-empty trapgroup hasn't been deactivated
        if '-5' in taggingLevel:

            sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                            .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                            .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                            .filter(OtherIndividual.c.active==True)\
                            .filter(OtherIndividual.c.name!='unidentifiable')\
                            .filter(IndSimilarity.score>=tL[2])\
                            .filter(IndSimilarity.skipped==False)\
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
                            .filter(IndSimilarity.score>=tL[2])\
                            .filter(IndSimilarity.skipped==False)\
                            .filter(Individual.task_id==task_id)\
                            .filter(Individual.label_id==label.id)\
                            .filter(Individual.active==True)\
                            .filter(Individual.name!='unidentifiable')\
                            .group_by(Individual.id)\
                            .subquery()

            trapgroups = db.session.query(Trapgroup)\
                            .join(Camera)\
                            .join(Image)\
                            .join(Detection)\
                            .join(Individual,Detection.individuals)\
                            .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                            .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                            .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                            .filter(Individual.allocated==None)\
                            .filter(IndSimilarity.allocated==None)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Individual.active==True)\
                            .filter(Individual.label_id==label.id)\
                            .filter(Individual.task_id==task_id)\
                            .filter(Individual.name!='unidentifiable')\
                            .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                            .filter(Trapgroup.active == False) \
                            .filter(Trapgroup.processing == False) \
                            .filter(Trapgroup.queueing == False) \
                            .all()
        else:
            sq = db.session.query(Trapgroup) \
                .join(Camera) \
                .join(Image) \
                .join(Cluster, Image.clusters) \
                .join(Detection) \
                .filter(Cluster.task_id == task_id) \
                .filter(Trapgroup.active == False) \
                .filter(Trapgroup.queueing == False) \
                .filter(Trapgroup.processing == False)

            sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

            trapgroups = sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                .filter(Detection.static == False) \
                .filter(~Detection.status.in_(['deleted','hidden'])) \
                .group_by(Trapgroup.id) \
                .order_by(func.count(distinct(Cluster.id)).desc()) \
                .all()

        #looking at most recent cluster by trapgroup
        for trapgroup in trapgroups:
            trapgroup.active = True

        if len(trapgroups) != 0:
            db.session.commit()
            #Try again
            if '-5' in taggingLevel:

                sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                                .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                                .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                                .filter(OtherIndividual.c.active==True)\
                                .filter(OtherIndividual.c.name!='unidentifiable')\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
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
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.name!='unidentifiable')\
                                .group_by(Individual.id)\
                                .subquery()

                sq3 = db.session.query(Individual.id.label('indID3'),func.count(distinct(Detection.id)).label('count3'))\
                                .join(Detection,Individual.detections)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.name!='unidentifiable')\
                                .group_by(Individual.id)\
                                .subquery()

                sq4 = db.session.query(Trapgroup.id.label('trapID'),func.max(sq3.c.count3).label('count4'))\
                                .join(Camera)\
                                .join(Image)\
                                .join(Detection)\
                                .join(Individual,Detection.individuals)\
                                .join(sq3,sq3.c.indID3==Individual.id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.name!='unidentifiable')\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .group_by(Trapgroup.id)\
                                .subquery()

                trapgroup = db.session.query(Trapgroup)\
                                .join(Camera)\
                                .join(Image)\
                                .join(Detection)\
                                .join(Individual,Detection.individuals)\
                                .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                                .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                                .join(sq4,sq4.c.trapID==Trapgroup.id)\
                                .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                .filter(Individual.allocated==None)\
                                .filter(IndSimilarity.allocated==None)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(Individual.active==True)\
                                .filter(Individual.label_id==label.id)\
                                .filter(Individual.task_id==task_id)\
                                .filter(Individual.name!='unidentifiable')\
                                .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                                .filter(Trapgroup.active == True) \
                                .filter(Trapgroup.processing == False) \
                                .filter(Trapgroup.queueing == False) \
                                .filter(Trapgroup.user_id == None)\
                                .order_by(desc(sq4.c.count4))\
                                .first()
            else:
                sq = db.session.query(Trapgroup) \
                            .join(Camera) \
                            .join(Image) \
                            .join(Cluster, Image.clusters) \
                            .join(Detection) \
                            .filter(Cluster.task_id == task_id) \
                            .filter(Trapgroup.active == True) \
                            .filter(Trapgroup.processing == False) \
                            .filter(Trapgroup.queueing == False) \
                            .filter(Trapgroup.user_id == None)

                sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

                trapgroup = sq.filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .group_by(Trapgroup.id) \
                            .order_by(func.count(distinct(Cluster.id)).desc()) \
                            .first()

    if trapgroup != None:
        trapgroup.user_id = user_id
        db.session.commit()

    return trapgroup

def fetch_clusters(taggingLevel,task_id,isBounding,trapgroup_id,limit):
    '''
    Returns a list of clusters for annotation for the specified parameters.
    
        Parameters:
            taggingLevel (str): The task tagging level
            task_id (int): The task being annotated
            isBounding (bool): Whether the task bounding boxes are being edited
            trapgroup_id (int): The trapgroup allocated to the user for which clusters must be fetched
            limit (int): The maximum number of clusters that should be returned
    '''
    
    if '-5' in taggingLevel:
        tL = re.split(',',taggingLevel)
        label_id = int(tL[1])
        OtherIndividual = alias(Individual)

        sq1 = db.session.query(Individual.id.label('indID1'),func.count(distinct(IndSimilarity.id)).label('count1'))\
                        .join(IndSimilarity,IndSimilarity.individual_1==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_2)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label_id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq2 = db.session.query(Individual.id.label('indID2'),func.count(distinct(IndSimilarity.id)).label('count2'))\
                        .join(IndSimilarity,IndSimilarity.individual_2==Individual.id)\
                        .join(OtherIndividual,OtherIndividual.c.id==IndSimilarity.individual_1)\
                        .filter(OtherIndividual.c.active==True)\
                        .filter(OtherIndividual.c.name!='unidentifiable')\
                        .filter(IndSimilarity.score>=tL[2])\
                        .filter(IndSimilarity.skipped==False)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label_id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        sq3 = db.session.query(Individual.id.label('indID3'),func.count(distinct(Detection.id)).label('count3'))\
                        .join(Detection,Individual.detections)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label_id)\
                        .filter(Individual.active==True)\
                        .filter(Individual.name!='unidentifiable')\
                        .group_by(Individual.id)\
                        .subquery()

        cluster = db.session.query(Individual)\
                        .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                        .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                        .join(sq3,sq3.c.indID3==Individual.id)\
                        .join(Detection,Individual.detections)\
                        .join(Image)\
                        .join(Camera)\
                        .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                        .filter(Individual.allocated==None)\
                        .filter(IndSimilarity.allocated==None)\
                        .filter(Individual.active==True)\
                        .filter(Individual.task_id==task_id)\
                        .filter(Individual.label_id==label_id)\
                        .filter(Individual.name!='unidentifiable')\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                        .distinct().order_by(desc(sq3.c.count3)).first()

        clusters = [cluster]
    else:
        sq = db.session.query(Cluster) \
            .join(Image, Cluster.images) \
            .join(Camera) \
            .join(Trapgroup) \
            .join(Detection)

        sq = taggingLevelSQ(sq,taggingLevel,isBounding,task_id)

        clusters = sq.filter(Trapgroup.id == trapgroup_id) \
                                .filter(Cluster.task_id == task_id) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .order_by(desc(Cluster.classification), desc(Image.corrected_timestamp)) \
                                .distinct().limit(limit).all()

    return clusters

def genInitKeys(taggingLevel,task_id):
    '''Returns the labels and hotkeys for the given tagging level and task'''

    addSkip = False
    if taggingLevel == '-1':
        categories = db.session.query(Label).filter(Label.task_id == task_id).filter(Label.parent_id == None).all()
        special_categories = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip').all()
        categories.extend(special_categories)
    elif taggingLevel == '0':
        temp_categories = db.session.query(Label).filter(Label.task_id == task_id).all()
        categories = []
        for category in temp_categories:
            check = db.session.query(Label).filter(Label.parent_id == category.id).first()
            if check == None:
                categories.append(category)
        special_categories = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip').all()
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