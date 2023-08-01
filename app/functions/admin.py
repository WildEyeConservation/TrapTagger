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
from app.functions.globals import classifyTask, finish_knockdown, updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, \
                                    retryTime, chunker, resolve_abandoned_jobs, addChildLabels, updateAllStatuses
from app.functions.individualID import calculate_individual_similarities, cleanUpIndividuals
from app.functions.imports import cluster_survey, classifySurvey, s3traverse, recluster_large_clusters, removeHumans, classifyCluster
import GLOBALS
from sqlalchemy.sql import func, or_, and_, distinct, alias
from sqlalchemy import desc, extract
from datetime import datetime, timedelta
import re
import ast
from multiprocessing.pool import ThreadPool as Pool
import traceback
from config import Config
import json
import boto3

@celery.task(bind=True,max_retries=29,ignore_result=True)
def delete_task(self,task_id):
    '''
    Deletes task, and all associated data, for specified task ID.
    
        Parameters:
            task_id (int): Task to delete

        Returns:
            status (str): success or error
            message (str): Reason for error
    '''
    status = None
    message = None

    try:
        app.logger.info('Deleting task {}'.format(task_id))
        clusters = db.session.query(Cluster).filter(Cluster.task_id==task_id).all()

        try:
            # for chunk in chunker(clusters,1000):
            for cluster in clusters:
                #Delete cluster labels
                cluster.labels = []
                #Delete cluster tags
                cluster.tags = []
                #Delete cluster - image associations
                cluster.images = []
                #Delete required images
                cluster.required_images = []
                #Delete cluster
                db.session.delete(cluster)
            db.session.commit()
            app.logger.info('Clusters deleted successfully.')
        except:
            status = 'error'
            message = 'Could not delete clusters.'
            app.logger.info('Failed to delete clusters.')

        #Delete Labelgroups
        if status != 'error':
            try:
                labelgroups = db.session.query(Labelgroup).filter(Labelgroup.task_id==task_id).all()
                # for chunk in chunker(labelgroups,1000):
                for labelgroup in labelgroups:
                    labelgroup.labels = []
                    labelgroup.tags = []
                    db.session.delete(labelgroup)
                db.session.commit()
                app.logger.info('Labelgroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete labelgroups.'
                app.logger.info('Failed to delete labelgroups.')

        #Delete Individuals
        if status != 'error':
            try:
                individuals_to_delete = []
                task = db.session.query(Task).get(task_id)
                tasks = [r[0] for r in db.session.query(Tag.id).filter(Tag.task_id==task_id).all()]
                individuals = db.session.query(Individual).filter(Individual.tasks.contains(task)).all()
                detections = [r[0] for r in db.session.query(Detection.id)\
                                        .join(Image)\
                                        .join(Camera)\
                                        .join(Trapgroup)\
                                        .filter(Trapgroup.survey_id==task.survey_id)\
                                        .distinct().all()]
                
                for individual in individuals:                    
                    individual.detections = [detection for detection in individual.detections if detection.id not in detections]

                    if len(individual.detections)==0:
                        # individuals_to_delete.append(individual)
                        individual.detections = []
                        individual.children = []
                        individual.tags = []
                        individual.tasks = []
                        indSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
                        for indSimilarity in indSimilarities:
                            db.session.delete(indSimilarity)
                        db.session.delete(individual)
                    else:
                        # no point doing this if its going to be deleted
                        individual.tasks.remove(task)
                        individual.tags = [tag for tag in individual.tags if tag.id not in tags]

                db.session.commit()

                # for individual in individuals:
                #     if individual not in individuals_to_delete:
                #         individual.children = [child for child in individual.children if child not in individuals_to_delete]

                # individuals_to_delete = [r.id for r in individuals_to_delete]
                # db.session.commit()

                # individuals = db.session.query(Individual).filter(Individual.id.in_(individuals_to_delete)).all()
                # for chunk in chunker(individuals_to_delete,1000):
                # for individual in individuals:
                #     individual.detections = []
                #     individual.children = []
                #     individual.tags = []
                #     individual.tasks = []
                # db.session.commit()

                # individuals = db.session.query(Individual).filter(Individual.id.in_(individuals_to_delete)).all()
                # for individual in individuals:
                #     indSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
                #     for indSimilarity in indSimilarities:
                #         db.session.delete(indSimilarity)
                #     db.session.delete(individual)
                # db.session.commit()

                app.logger.info('Individuals deleted successfully.')

            except:
                status = 'error'
                message = 'Could not delete individuals.'
                app.logger.info('Failed to delete individuals.')

        #Delete translations
        if status != 'error':
            try:
                db.session.query(Translation).filter(Translation.task_id==task_id).delete(synchronize_session=False)
                # for chunk in chunker(translations,1000):
                # for translation in translations:
                #     db.session.delete(translation)
                db.session.commit()
                app.logger.info('Translations deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete translations.'
                app.logger.info('Failed to delete translations.')

        #Delete tags
        if status != 'error':
            try:
                db.session.query(Tag).filter(Tag.task_id==task_id).delete(synchronize_session=False)
                # for chunk in chunker(tags,1000):
                # for tag in tags:
                #     db.session.delete(tag)
                # db.session.commit()
                app.logger.info('Tags deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete tags.'
                app.logger.info('Failed to delete tags.')

        #Delete labels
        if status != 'error':
            try:
                while db.session.query(Label).filter(Label.task_id==task_id).count() != 0:
                    for label in db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.children.any()).all():
                        db.session.delete(label)
                    db.session.commit()
                app.logger.info('Labels deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete labels.'
                app.logger.info('Failed to delete labels.')

        # #Dissociate remaining multi-task individuals from this task's workers
        # if status != 'error':
        #     try:
        #         individuals = db.session.query(Individual)\
        #                                 .join(User,or_(User.id==Individual.user_id,User.id==Individual.allocated))\
        #                                 .join(Turkcode)\
        #                                 .filter(Turkcode.task_id==task_id) \
        #                                 .filter(User.email==None) \
        #                                 .all()
                
        #         for individual in individuals:
        #             individual.user_id = None
        #             individual.allocated = None
                
        #         db.session.commit()
        #         app.logger.info('Multi-task individuals dissociated successfully.')
        #     except:
        #         status = 'error'
        #         message = 'Could not dissociate multi-task individuals.'
        #         app.logger.info('Failed to dissociate multi-task individuals.')

        #Delete turkcodes & workers
        if status != 'error':
            try:
                data = db.session.query(Turkcode,User) \
                                    .join(User) \
                                    .filter(Turkcode.task_id==task_id) \
                                    .filter(User.email==None) \
                                    .all()
                # for chunk in chunker(turkcodes,1000):
                for row in data:
                    db.session.delete(row[1])
                    db.session.delete(row[0])
                db.session.commit()
                app.logger.info('Turkcodes and workers deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete turkcodes and users.'
                app.logger.info('Failed to delete turkcodes and workers.')

        #delete tasks
        if status != 'error':
            try:
                task = db.session.query(Task).get(task_id)
                db.session.delete(task)
                db.session.commit()
                app.logger.info('Task deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete task.'
                app.logger.info('Could not delete task.')

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return status, message

@celery.task(bind=True,max_retries=29,ignore_result=True)
def stop_task(self,task_id):
    '''Celery function that stops a running task.'''

    try:
        task = db.session.query(Task).get(int(task_id))

        if task.status.lower() not in Config.TASK_READY_STATUSES:
            survey = task.survey
            app.logger.info(task.survey.name + ': ' + task.name + ' stopped')

            GLOBALS.redisClient.delete('active_jobs_'+str(task.id))
            GLOBALS.redisClient.delete('job_pool_'+str(task.id))

            turkcodes = db.session.query(Turkcode).filter(Turkcode.task_id==int(task_id)).filter(Turkcode.user_id==None).filter(Turkcode.active==True).all()
            for turkcode in turkcodes:
                db.session.delete(turkcode)

            db.session.commit()

            active_jobs = [r.decode() for r in GLOBALS.redisClient.smembers('active_jobs_'+str(task_id))]
            abandoned_jobs = db.session.query(User,Task)\
                                .join(Turkcode,Turkcode.user_id==User.id)\
                                .join(Task)\
                                .filter(User.parent_id!=None)\
                                .filter(Turkcode.code.in_(active_jobs))\
                                .all()

            resolve_abandoned_jobs(abandoned_jobs)

            if (',' not in task.tagging_level) and (int(task.tagging_level) > 0):
                clusters = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.skipped==True).distinct().all()
                for cluster in clusters:
                    cluster.skipped = False
                db.session.commit()
            elif '-5' in task.tagging_level:
                cleanUpIndividuals(task_id)
                GLOBALS.redisClient.delete('active_individuals_'+str(task_id))
                GLOBALS.redisClient.delete('active_indsims_'+str(task_id))

            updateTaskCompletionStatus(int(task_id))
            updateLabelCompletionStatus(int(task_id))
            updateIndividualIdStatus(int(task_id))

            # if task_id in GLOBALS.mutex.keys(): GLOBALS.mutex.pop(task_id, None)

            task.current_name = None
            task.status = 'Stopped'

            # handle multi-tasks
            for sub_task in task.sub_tasks:
                sub_task.status = 'Stopped'
                sub_task.survey.status = 'Ready'
            task.sub_tasks = []

            #remove trapgroup list from redis
            GLOBALS.redisClient.delete('trapgroups_'+str(task.survey_id))

            if 'processing' not in survey.status:
                survey.status = 'Ready'
            elif survey.status=='indprocessing':
                #Check whether individual similarities are still being processed
                inspector = celery.control.inspect()
                active_tasks = inspector.active()
                reserved_tasks = inspector.reserved()

                still_processing = False
                for tasks in [active_tasks,reserved_tasks]:
                    for worker in tasks:
                        for task in tasks[worker]:
                            if ('calculate_individual_similarities' in task['name']) and (('task_id' in task['kwargs']) and (int(task['kwargs']['task_id']) == int(task_id)) or ((len(task['args'])>0) and (int(task['args'][0]) == int(task_id)))):
                                still_processing = True
                                break
                        else:
                            continue
                        break
                    else:
                        continue
                    break

                if not still_processing:
                    survey.status = 'Ready'

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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def delete_survey(self,survey_id):
    '''
    Celery task for deleting a specified survey, along with all associated data.
    
        Parameters:
            survey_id (int): Survey to delete

        Returns:
            status (str): success or error
            message (str): Reason for error
    '''

    try:
        status = 'success'
        message = ''

        tasks = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).all()]

        app.logger.info('Deleting survey {}'.format(survey_id))

        if status != 'error':
            for task_id in tasks:
                tempStatus, tempMessage = delete_task(task_id)
                if tempStatus != None:
                    status = tempStatus
                    message = tempMessage

        #Delete detections
        if status != 'error':
            try:
                detSimilarities = db.session.query(DetSimilarity)\
                                        .join(Detection,or_(Detection.id==DetSimilarity.detection_1,Detection.id==DetSimilarity.detection_2))\
                                        .join(Image)\
                                        .join(Camera)\
                                        .join(Trapgroup)\
                                        .filter(Trapgroup.survey_id==survey_id)\
                                        .all()
                
                for detSimilarity in detSimilarities:
                    db.session.delete(detSimilarity)
                db.session.commit()

                detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for detection in detections:
                    db.session.delete(detection)
                db.session.commit()

                # detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                # for chunk in chunker(detections,1000):
                #     for detection in chunk:
                #         detection.individuals = []
                #         detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.detection_1==detection.id,DetSimilarity.detection_2==detection.id)).all()
                #         for detSimilarity in detSimilarities:
                #             db.session.delete(detSimilarity)
                #     db.session.commit()
                #     for detection in chunk:
                #         db.session.delete(detection)
                #     db.session.commit()
                app.logger.info('Detections deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete detections.'
                app.logger.info('Failed to delete detections.')

        #Delete images
        if status != 'error':
            try:
                images = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                # for chunk in chunker(images,1000):
                for image in images:
                    db.session.delete(image)
                db.session.commit()
                app.logger.info('Images deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete images.'
                app.logger.info('Failed to delete images.')

        #Delete Videos
        if status != 'error':
            try:
                videos = db.session.query(Video).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for video in videos:
                    db.session.delete(video)
                db.session.commit()
                app.logger.info('Videos deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete videos.'
                app.logger.info('Failed to delete videos.')

        #Delete cameras
        if status != 'error':
            try:
                cameras = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                # for chunk in chunker(cameras,1000):
                for camera in cameras:
                    db.session.delete(camera)
                db.session.commit()
                app.logger.info('Cameras deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete cameras.'
                app.logger.info('Failed to delete cameras.')

        #Delete trapgroups
        if status != 'error':
            try:
                db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).delete(synchronize_session=False)
                # for chunk in chunker(trapgroups,1000):
                #     for trapgroup in chunk:
                #         db.session.delete(trapgroup)
                db.session.commit()
                app.logger.info('Trapgroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete trap groups.'
                app.logger.info('Failed to delete Trapgroups')

        #Delete images from S3
        if status != 'error':
            try:
                survey = db.session.query(Survey).get(survey_id)
                s3 = boto3.resource('s3')
                bucketObject = s3.Bucket(Config.BUCKET)
                bucketObject.objects.filter(Prefix=survey.user.folder+'/'+survey.name+'/').delete()
                app.logger.info('images deleted from S3 successfully.')
            except:
                # status = 'error'
                # message = 'Could not delete images from S3.'
                app.logger.info('Could not delete images from S3')
        
        #Delete images from S3-comp
        if status != 'error':
            try:
                bucketObject.objects.filter(Prefix=survey.user.folder+'-comp/'+survey.name+'/').delete()
                app.logger.info('images deleted from S3-comp successfully.')
            except:
                # status = 'error'
                # message = 'Could not delete images from S3.'
                app.logger.info('Could not delete images from S3-comp')

        #Delete survey
        if status != 'error':
            try:
                survey = db.session.query(Survey).get(survey_id)
                if survey:
                    db.session.delete(survey)
                db.session.commit()
                app.logger.info('Survey deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete survey.'
                app.logger.info('Failed to delete survey')

        if status == 'error':
            app.logger.info('Failed to delete survey {}: {}'.format(survey_id,message))
            # print(message)
            survey = db.session.query(Survey).get(survey_id)
            survey.status = 'Failed'
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def checkAndRelease(self,task_id):
    '''
    Celery task that checks to see if a reserved task has been launched successfully. If not, task is returned to a ready state.

        Parameters:
            task_id (int): Task to check
    '''
    try:
        task = db.session.query(Task).get(task_id)
        if task and (task.status=='PENDING'):
            task.status = 'Stopped'
            task.survey.status = 'Ready'
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

def deleteChildLabels(parent):
    '''
    Helper function for processChanges. Deletes all child labels of a label, including their children etc.

        Parameters:
            parent (Label): Label for which the child labels should be deleted
    '''
    labelChildren = db.session.query(Label).filter(Label.parent==parent).filter(Label.task==parent.task).all()
    for label in labelChildren:
        deleteChildLabels(label)
        db.session.delete(label)
    return True

def processChanges(changes, keys, sessionLabels, task_id):
    '''
    Processes requested changes to a task, specifically relating to the editing of labels.

        Parameters:
            changes (dict): The changes being implemented to a parent label - modifed, deleted, or added
            keys (list): List of parent labels for which changes need to be made
            sessionLabels (dict): Labels that have been added in the previous sessions
            task_id (int): Task being edited

        Returns:
            skipped (list): List of labels that cannot be added yet
            sessionLabels (dict): Labels that have been added this session
    '''

    skipped = []
    newSessionLabels = {}
    for parent in keys:
        parentLabel = None
        if 's' not in parent:
            if parent == '-99999':
                parentLabel='None'
            elif parent == '-100000':
                parentLabel = db.session.query(Label).get(GLOBALS.vhl_id)
            else:
                parentLabel = db.session.query(Label).get(parent)
        else:
            if parent in sessionLabels.keys():
                parentLabel = sessionLabels[parent]
            else:
                skipped.append(parent)

        if parentLabel:
            for delete_id in changes[parent]['edits']['delete']:
                if 's' not in delete_id:
                    deleteLabel = db.session.query(Label).get(int(delete_id))
                    if deleteLabel:
                        deleteChildLabels(deleteLabel)
                        db.session.delete(deleteLabel)

            for edit_id in changes[parent]['edits']['modify']:
                if 's' not in edit_id:
                    editLabel = db.session.query(Label).get(int(edit_id))

                    if editLabel:
                        editLabel.description = changes[parent]['edits']['modify'][edit_id]['description']
                        editLabel.hotkey = changes[parent]['edits']['modify'][edit_id]['hotkey']

            for additional_id in changes[parent]['additional']:
                check = db.session.query(Label) \
                                .filter(Label.task_id==task_id) \
                                .filter(Label.description==changes[parent]['additional'][additional_id]['description'])

                if parentLabel != 'None':
                    check = check.filter(Label.parent==parentLabel)
                    valueNeeded = parentLabel
                else:
                    check = check.filter(Label.parent_id==None)
                    valueNeeded = None

                check = check.first()

                if not check:
                    newLabel = Label(description=changes[parent]['additional'][additional_id]['description'],hotkey=changes[parent]['additional'][additional_id]['hotkey'],parent=valueNeeded,task_id=task_id)
                    db.session.add(newLabel)
                    newSessionLabels[additional_id] = newLabel

    for key in newSessionLabels:
        sessionLabels[key] = newSessionLabels[key]

    return skipped, sessionLabels

@celery.task(bind=True,max_retries=29,ignore_result=True)
def handleTaskEdit(self,task_id,changes,user_id):
    '''
    Celery task that handles task edits, specifically relating to the editing of labels.

        Parameters:
            task_id (int): The task being edited
            changes (dict): The changes being implemented to a parent label - modifed, deleted, or added
            user_id (int): The user requesting the changes
    '''
    
    try:
        if db.session.query(Task).get(task_id).survey.user_id==user_id:
            changes = ast.literal_eval(changes)
            sessionLabels = {}
            skipped, sessionLabels = processChanges(changes, changes.keys(), sessionLabels, task_id)

            while skipped != []:
                skipped, sessionLabels = processChanges(changes, skipped, sessionLabels, task_id)

            translations = db.session.query(Translation).filter(Translation.task_id==task_id).all()
            for translation in translations:
                db.session.delete(translation)

            task = db.session.query(Task).get(task_id)
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

def copyClusters(newTask,session=None):
    '''Copies default task clustering to the specified task.'''

    if session == None:
        session = db.session()
        newTask = session.query(Task).get(newTask)

    survey_id = newTask.survey_id
    default = session.query(Task).filter(Task.name=='default').filter(Task.survey_id==int(survey_id)).first()
    
    check = session.query(Cluster).filter(Cluster.task==newTask).first()

    if check == None:
        detections = session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
        for detection in detections:
            labelgroup = Labelgroup(detection_id=detection.id,task=newTask,checked=False)
            session.add(labelgroup)

        clusters = session.query(Cluster).filter(Cluster.task_id==default.id).distinct().all()
        for cluster in clusters:
            newCluster = Cluster(task=newTask)
            session.add(newCluster)
            newCluster.images=cluster.images
            newCluster.classification = cluster.classification

            if cluster.labels != []:
                newCluster.labels=cluster.labels
                newCluster.user_id=cluster.user_id
                newCluster.timestamp = datetime.utcnow()

                labelgroups = session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task==newTask).all()
                for labelgroup in labelgroups:
                    labelgroup.labels = cluster.labels

        # db.session.commit()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def prepTask(self,newTask_id, survey_id, includes, translation, labels):
    '''
    Celery task for preparing a new task for a survey, includes setting up translations, clustering, and auto-classification.

        Parameters:
            newTask_id (int): The ID of the new task
            survey_id (int): The ID of the survey for which it was added
            includes (list): The list of species to auto-classify
            translation (dict): The translations between user and classifier labels
            labels (list): The list of labels for the task
    '''

    try:
        # Make this indempotent
        if db.session.query(Label).filter(Label.task_id==newTask_id).first() == None:
            generateLabels(labels, newTask_id, {})
            setupTranslations(newTask_id, int(survey_id), translation, includes)

        newTask = db.session.query(Task).get(newTask_id)
        newTask.status = 'Generating Clusters'
        db.session.commit()

        copyClusters(newTask_id)

        newTask.status = 'Auto-Classifying'
        db.session.commit()
        classifyTask(newTask_id)

        updateTaskCompletionStatus(newTask_id)
        updateLabelCompletionStatus(newTask_id)
        updateIndividualIdStatus(newTask_id)

        newTask.status = 'Ready'
        newTask.survey.status = 'Ready'
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def reclusterAfterTimestampChange(self,survey_id,trapgroup_ids,camera_ids):
    '''Reclusters all tasks for a specified survey after a timestamp correction, preserving all labels etc.'''

    try:
        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Reclustering'
        for trapgroup in survey.trapgroups:
            trapgroup.processing = False
            trapgroup.queueing = False
            trapgroup.active = False
            trapgroup.user_id = None
        db.session.commit()

        # Force = True will cause double clustering - find highest ID so we can delete with ID < highest
        highest = db.session.query(Cluster.id).join(Task).filter(Task.survey_id==survey_id).order_by(Cluster.id.desc()).first()
        if highest:
            highest_id = highest[0]
        else:
            highest_id = 0

        #we want a fresh session after clustering
        db.session.close()

        cluster_survey(survey_id,'default',True,trapgroup_ids)

        # just adding the legacy _o_l_d_ for now - we are moving away from this though
        tasks = db.session.query(Task).filter(Task.survey_id==survey_id).filter(~Task.name.contains('_o_l_d_')).all()
        admin = db.session.query(User).filter(User.username=='Admin').first()
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

        for task in tasks:
            # copy notes across to new clusters
            clusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
                                .filter(Cluster.task_id==task.id)\
                                .filter(Cluster.notes!=None)\
                                .filter(Cluster.notes!='')\
                                .distinct().all()
            for cluster in clusters:
                newClusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .filter(Cluster.task_id==task.id)\
                                .filter(Cluster.id>highest_id)\
                                .filter(Image.id.in_([r.id for r in cluster.images]))\
                                .distinct().all()
                for newCluster in newClusters:
                    if not newCluster.notes: newCluster.notes = ''
                    newCluster.notes += cluster.notes

            # copy tags across to new clusters
            clusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
                                .filter(Cluster.task_id==task.id)\
                                .filter(Cluster.tags.any())\
                                .distinct().all()
            for cluster in clusters:
                newClusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .filter(Cluster.task_id==task.id)\
                                .filter(Cluster.id>highest_id)\
                                .filter(Image.id.in_([r.id for r in cluster.images]))\
                                .distinct().all()
                for newCluster in newClusters:
                    for tag in cluster.tags:
                        if tag not in newCluster.tags:
                            newCluster.tags.append(tag)

            # Remove auto-classifications as these may have changed
            # We are removing all auto-classifications because everything will be re-classified
            labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .join(Cluster,Image.clusters)\
                            .filter(Labelgroup.task_id==task.id)\
                            .filter(Labelgroup.labels.any())\
                            .filter(Cluster.task_id==task.id)\
                            .filter(Cluster.user==admin).all()
            for labelgroup in labelgroups:
                labelgroup.labels = []

            # Remove labels from split clusters
            # There is no reliable way to know what images were viewed and labelled
            # Need to use sq2 to be able to include all labelgroups from the affected clusters
            # Need to include labelgroup.checked because checked labelgroups are probbably right
            sq = db.session.query(Cluster.id,func.count(distinct(Image.camera_id)).label('count')).join(Image,Cluster.images).filter(Cluster.task==task).filter(Cluster.id<=highest_id).filter(Cluster.labels.any()).group_by(Cluster.id).subquery()
            sq2 = db.session.query(Cluster.id).join(Image,Cluster.images).filter(Image.camera_id.in_(camera_ids)).filter(Cluster.id<=highest_id).filter(Cluster.labels.any()).subquery()
            labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Cluster,Image.clusters)\
                            .join(sq,sq.c.id==Cluster.id)\
                            .join(sq2,sq2.c.id==Cluster.id)\
                            .filter(Labelgroup.task==task)\
                            .filter(Labelgroup.labels.any())\
                            .filter(Labelgroup.checked==False)\
                            .filter(Cluster.task==task)\
                            .filter(Cluster.id<=highest_id)\
                            .filter(Cluster.labels.any())\
                            .filter(sq.c.count>1)\
                            .distinct().all()
            for labelgroup in labelgroups:
                labelgroup.labels = []

            # Copy up labels from labelgroups & copy across cluster user IDs
            clusters = db.session.query(Cluster)\
                            .filter(Cluster.task_id==task.id)\
                            .filter(Cluster.id>highest_id)\
                            .distinct().all()
            for cluster in clusters:
                # Also update cluster-level classification at the same time
                cluster.classification = classifyCluster(cluster)

                labels = db.session.query(Label)\
                                .join(Labelgroup, Label.labelgroups)\
                                .join(Detection)\
                                .join(Image)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(Labelgroup.task_id==task.id)\
                                .filter(~Label.id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))\
                                .distinct().all()

                cluster.labels = labels

                if labels:
                    # Copy across user ID from old cluster
                    oldCluster = db.session.query(Cluster)\
                                    .join(Image,Cluster.images)\
                                    .filter(Image.id.in_([r.id for r in cluster.images]))\
                                    .filter(Cluster.task_id==task.id)\
                                    .filter(Cluster.user_id!=admin.id)\
                                    .filter(Cluster.user_id!=None)\
                                    .filter(Cluster.id<=highest_id)\
                                    .first()

                    if oldCluster: cluster.user_id = oldCluster.user_id

                    # Copy down labelgroup labels if not checked
                    labelgroups = db.session.query(Labelgroup)\
                                    .join(Detection)\
                                    .join(Image)\
                                    .filter(Image.clusters.contains(cluster))\
                                    .filter(Labelgroup.task_id==task.id)\
                                    .filter(Labelgroup.checked==False)\
                                    .distinct().all()

                    for labelgroup in labelgroups:
                        labelgroup.labels = labels

            # Remove old clusters
            # with timestamps - these weren't reclustered
            # ignore knockdowns - these weren't reclustered either
            clusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .filter(~Cluster.labels.contains(downLabel))\
                                .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
                                .filter(Cluster.task_id==task.id)\
                                .filter(Cluster.id<=highest_id)\
                                .filter(Image.corrected_timestamp!=None)\
                                .distinct().all()
            for cluster in clusters:
                cluster.labels = []
                cluster.tags = []
                cluster.images = []
                cluster.required_images = []
                db.session.delete(cluster)

        db.session.commit()

        wrapUpAfterTimestampChange.delay(survey_id=survey_id,trapgroup_ids=trapgroup_ids)

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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def wrapUpAfterTimestampChange(self,survey_id,trapgroup_ids):
    '''Wraps up a survey after a timestamp change by re-classifying & reclustering large clusters'''

    try:
        # just adding the legacy _o_l_d_ for now - we are moving away from this though
        task_ids = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).filter(~Task.name.contains('_o_l_d_')).all()]
        
        for task_id in task_ids:
            removeHumans(task_id,trapgroup_ids)
            recluster_large_clusters(task_id,True)
            classifyTask(task_id,None,None,trapgroup_ids)

        for task_id in task_ids:
            updateAllStatuses(task_id=task_id)

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Ready'
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

# def reclusterAfterTimestampChange(survey_id):
#     '''Reclusters all tasks for a specified survey after a timestamp correction, preserving all labels. Saves all old tasks 
#     in a hidden state with _o_l_d_ at the end of their name.'''

#     session = db.session()

#     survey = session.query(Survey).get(survey_id)
#     survey.status = 'Reclustering'
#     for trapgroup in survey.trapgroups:
#         trapgroup.processing = False
#         trapgroup.queueing = False
#         trapgroup.active = False
#         trapgroup.user_id = None
#     session.commit()

#     # delete default task
#     defaultTask = session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name=='default').first()
#     if defaultTask:
#         delete_task(defaultTask.id)

#     # create new default task
#     task_id = cluster_survey(survey_id,'default')
#     recluster_large_clusters(session.query(Task).get(task_id),True,session)
#     session.commit()
    
#     # pool = Pool(processes=4)
#     trapgroup_ids = [r[0] for r in session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).all()]
#     for trapgroup_id in trapgroup_ids:
#         classifyTrapgroup(task_id,trapgroup_id)
#         session.commit()
#     # pool.close()
#     # pool.join()

#     admin_id = session.query(User.id).filter(User.username=='Admin').first()[0]

#     OldGroup = alias(Labelgroup)
#     OldCluster = alias(Cluster)

#     # session.commit()
#     tasks=session.query(Task).filter(Task.survey_id==survey_id).all()
#     for task in tasks:
#         if ('_o_l_d_' not in task.name) and (task.name != 'default'):

#             # if '_copying' not in task.name:

#             taskName = task.name

#             _o_l_d_count = session.query(Task).filter(Task.name.contains(task.name+'_o_l_d_')).filter(Task.survey_id==survey_id).distinct().count()

#             #Rename old task
#             task.name += '_o_l_d_'
#             if _o_l_d_count: task.name += str(_o_l_d_count)
#             # session.commit

#             #create new task
#             newTask = Task(name=taskName, survey_id=survey_id, status='Ready', tagging_level=task.tagging_level, tagging_time=task.tagging_time, test_size=task.test_size, size=task.size, parent_classification=task.parent_classification)
#             session.add(newTask)
#             # session.commit()

#             # else:
#             #     #Copy was interrupted
#             #     taskName = re.split('_copying',task.name)[0] + '_o_l_d_'
#             #     newTask = task
#             #     task = session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name==taskName).first()
            
#             #copy labels, tags, and translations
#             labelTranslations = {
#                 GLOBALS.vhl_id: session.query(Label).get(GLOBALS.vhl_id),
#                 GLOBALS.knocked_id: session.query(Label).get(GLOBALS.knocked_id),
#                 GLOBALS.nothing_id: session.query(Label).get(GLOBALS.nothing_id),
#                 GLOBALS.unknown_id: session.query(Label).get(GLOBALS.unknown_id)
#             }
#             labels = session.query(Label).filter(Label.task_id==task.id).all()
#             for label in labels:
#                 newLabel = Label(description=label.description,hotkey=label.hotkey,complete=label.complete,task=newTask)
#                 session.add(newLabel)
#                 labelTranslations[label.id] = newLabel
#             for label in labels:
#                 if label.parent_id != None:
#                     labelTranslations[label.id].parent = labelTranslations[label.parent_id]
#                     # newLabel = session.query(Label).filter(Label.description==label.description).filter(Label.task_id==newTask.id).first()
#                     # parent = label.parent
#                     # if parent.task_id != None:
#                     #     parent = session.query(Label).filter(Label.description==parent.description).filter(Label.task_id==newTask.id).first()
#                     # newLabel.parent = parent
#             # session.commit()

#             #copy tags
#             tagTranslations = {}
#             tags = session.query(Tag).filter(Tag.task_id==task.id).all()
#             for tag in tags:
#                 # check = session.query(Tag).filter(Tag.task_id==newTask.id).filter(Tag.description==tag.description).first()
#                 # if not check:
#                 newTag = Tag(   task=newTask,
#                                 description=tag.description,
#                                 hotkey=tag.hotkey)
#                 session.add(newTag)
#                 tagTranslations[tag.id] = newTag
#             # session.commit()

#             translations = session.query(Translation).filter(Translation.task_id==task.id).all()
#             for translation in translations:
#                 # if translation.label.task_id:
#                 #     newLabel = session.query(Label).filter(Label.description==translation.label.description).filter(Label.task_id==newTask.id).first()
#                 # else:
#                 #     newLabel = translation.label
#                 # check = session.query(Translation).filter(Translation.classification==translation.classification).filter(Translation.task_id==newTask.id).filter(Translation.label_id==newLabel.id).first()
#                 # if not check:
#                 newTranslation = Translation(classification=translation.classification,auto_classify=translation.auto_classify,task=newTask,label=labelTranslations[translation.label_id])
#                 session.add(newTranslation)
#             # session.commit()

#             # Copying clusters
#             copyClusters(newTask,session)

#             # deal with knockdowns
#             downLabel =  session.query(Label).get(GLOBALS.knocked_id)

#             # sq = session.query(Cluster.id,Image.id.label('rootImage'))\
#             #                         .join(Image,Cluster.images)\
#             #                         .filter(Cluster.task_id==task.id)\
#             #                         .filter(func.min(Image.corrected_timestamp))\
#             #                         .group_by(Cluster.id)\
#             #                         .subquery()

#             #                         .filter(Cluster.labels.contains(downLabel))\


#             clusters = session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.contains(downLabel)).all()
#             # pool = Pool(processes=1)
#             for cluster in clusters:
#                 rootImage = session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).first()
#                 lastImage = session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.corrected_timestamp)).first()
#                 trapgroup = session.query(Trapgroup).join(Camera).join(Image).filter(Image.clusters.contains(cluster)).first()

#                 # if (trapgroup.queueing==False) and (trapgroup.processing==False):
#                 trapgroup.active = False
#                 trapgroup.user_id = None
#                 trapgroup.processing = True
#                 # session.commit()
#                 finish_knockdown(rootImage.id, newTask, admin_id, lastImage.id,session)
#                 # pool.apply_async(finish_knockdown,(rootImage.id, newTask.id, survey.user.id, lastImage.id))

#             # pool.close()
#             # pool.join()

#             #copy labels & tags
#             queryData = session.query(Labelgroup,detectionLabels.c.label_id,detectionTags.c.tag_id,OldGroup.c.checked)\
#                                         .join(Detection,Labelgroup.detection_id==Detection.id)\
#                                         .join(OldGroup,OldGroup.c.detection_id==Detection.id)\
#                                         .outerjoin(detectionLabels,detectionLabels.c.labelgroup_id==OldGroup.c.id)\
#                                         .outerjoin(detectionTags,detectionTags.c.labelgroup_id==OldGroup.c.id)\
#                                         .filter(Labelgroup.task==newTask)\
#                                         .filter(OldGroup.c.task_id==task.id)\
#                                         .all()

#             labelgroupInfo = {}
#             for item in queryData:
#                 if item[0] not in labelgroupInfo.keys():
#                     labelgroupInfo[item[0]] = {'labels':[],'tags':[],'checked':item[3]}
#                 if item[1] and (item[1] not in labelgroupInfo[item[0]]['labels']): labelgroupInfo[item[0]]['labels'].append(item[1])
#                 if item[2] and (item[2] not in labelgroupInfo[item[0]]['tags']): labelgroupInfo[item[0]]['tags'].append(item[2])

#             for labelgroup in labelgroupInfo:
#                 labelgroup.checked = labelgroupInfo[labelgroup]['checked']
#                 labelgroup.labels = [labelTranslations[label] for label in labelgroupInfo[labelgroup]['labels']]
#                 labelgroup.tags = [tagTranslations[tag] for tag in labelgroupInfo[labelgroup]['tags']]

#             queryData = session.query(Cluster,Label,Tag)\
#                                         .join(Image,Cluster.images)\
#                                         .join(Detection)\
#                                         .join(Labelgroup)\
#                                         .outerjoin(Label,Labelgroup.labels)\
#                                         .outerjoin(Tag,Labelgroup.tags)\
#                                         .filter(Labelgroup.task==newTask)\
#                                         .filter(Cluster.task==newTask)\
#                                         .all()

#             clusterInfo = {}
#             for item in queryData:
#                 if item[0] not in clusterInfo.keys():
#                     clusterInfo[item[0]] = {'labels':[],'tags':[]}
#                 if item[1] and (item[1] not in clusterInfo[item[0]]['labels']): clusterInfo[item[0]]['labels'].append(item[1])
#                 if item[2] and (item[2] not in clusterInfo[item[0]]['tags']): clusterInfo[item[0]]['tags'].append(item[2])

#             for cluster in clusterInfo:
#                 cluster.labels = clusterInfo[cluster]['labels']
#                 cluster.tags = clusterInfo[cluster]['tags']

#             # copy notes
#             noteData = session.query(Cluster,Cluster.notes)\
#                                         .join(Image,Cluster.images)\
#                                         .join(images,images.c.image_id==Image.id)\
#                                         .join(OldCluster,OldCluster.c.id==images.c.cluster_id)\
#                                         .filter(OldCluster.c.task_id==task.id)\
#                                         .filter(Cluster.task==newTask)\
#                                         .filter(OldCluster.c.notes!=None)\
#                                         .filter(OldCluster.c.notes!='')\
#                                         .all()

#             noteInfo = {}
#             for item in noteData:
#                 if item[0] not in noteInfo.keys():
#                     noteInfo[item[0]] = []
#                 if item[1] and (item[1] not in noteInfo[item[0]]): noteInfo[item[0]].append(item[1])

#             for cluster in noteInfo:
#                 note = ''
#                 for item in noteInfo[cluster]:
#                     note += item.note
#                 cluster.notes = note

#             # migrate individuals to new task
#             individuals = session.query(Individual).filter(Individual.tasks.contains(task)).all()
#             for individual in individuals:
#                 individual.tasks.remove(task)
#                 individual.tasks.append(newTask)

#                 # Update tags
#                 tags = []
#                 for tag in individual.tags:
#                     if tag.task_id==task.id:
#                         tag = tagTranslations[tag.id]
#                     tags.append(tag)
#                 individual.tags = tags

#             # recalculate individual similarities as the heuristic values will have changed
#             # species = [item[0] for item in session.query(Individual.species).filter(Individual.tasks.contains(newTask)).distinct().all()]
#             # for specie in species:
#             #     calculate_individual_similarities(newTask.id,specie,None)

#             # newTask.name = re.split('_copying',newTask.name)[0]
#             # session.commit()

#     session.commit()
#     tasks=[r[0] for r in session.query(Task.id).filter(Task.survey_id==survey_id).filter(Task.name!='default').filter(~Task.name.contains('_o_l_d_')).all()]
#     session.close()

#     for task_id in tasks:
#         updateAllStatuses.delay(task_id=task_id)
            
#     return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def updateCoords(self,survey_id,coordData):
    '''Updates the survey's trapgroup coordinates.'''

    try:
        for item in coordData:
            trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==item['tag']).first()
            
            if trapgroup:
                try:
                    latitude = float(item['latitude'])
                    if -180<=latitude<=180:
                        trapgroup.latitude = float(item['latitude'])
                except:
                    pass

                try:
                    longitude = float(item['longitude'])
                    if -180<=longitude<=180:
                        trapgroup.longitude = float(item['longitude'])
                except:
                    pass

                try:
                    altitude = float(item['altitude'])
                    if -180<=altitude<=180:
                        trapgroup.altitude = float(item['altitude'])
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def changeTimestamps(self,survey_id,timestamps):
    '''
    Celery task for shifting the camera timestamps of a specified survey. Re-clusters all tasks afterword.
    
        Parameters:
            survey_id (int): The survey to edit
            timestamps (dict): Timestamp changes formatted {camera_id: {'original': timestamp, 'corrected': timestamp}}
    '''
    
    try:
        app.logger.info('changeTimestamps called for survey {} with timestamps {}'.format(survey_id,timestamps))

        # double check for edited cameras
        camera_ids = [int(r) for r in timestamps.keys() if (timestamps[r]['corrected']!=timestamps[r]['original'])]

        # Check if there is a need to recluster (ie. there are overlapping edited cameras)
        # In order to make this indempotent, we use the 'original' timestamps which are more of an intermediate timestamp
        overlap_prior = []
        trapgroups = db.session.query(Trapgroup).join(Camera).filter(Camera.id.in_(camera_ids)).distinct().all()
        for trapgroup in trapgroups:
            camera_times = db.session.query(Camera.id,func.min(Image.timestamp).label('min'),func.max(Image.timestamp).label('max'),func.min(Image.corrected_timestamp).label('min_corrected'),func.max(Image.corrected_timestamp).label('max_corrected'))\
                                    .join(Image)\
                                    .filter(Image.timestamp!=None)\
                                    .filter(Camera.trapgroup_id==trapgroup.id)\
                                    .group_by(Camera.id)\
                                    .all()
            
            camera_times2 = camera_times.copy()
            for item in camera_times:
                if trapgroup.id in overlap_prior: break
                camera_times2.remove(item)
                camera1_id = item[0]

                if str(camera1_id) in timestamps.keys():
                    try:
                        # original = intermediate
                        camera1_original = datetime.strptime(timestamps[str(camera1_id)]['original'],"%Y/%m/%d %H:%M:%S")
                        camera1_delta = camera1_original - item[1]
                        camera1_min = item[1] + camera1_delta
                        camera1_max = item[2] + camera1_delta
                    except:
                        # if timestamp is incorrectly formatted, it will not be edited
                        camera2_min = item2[3]
                        camera2_max = item2[4]
                else:
                    # if timestamp is not edited, use the corrected timestamp from db
                    camera1_min = item[3]
                    camera1_max = item[4]

                for item2 in camera_times2:
                    camera2_id = item2[0]

                    if str(camera2_id) in timestamps.keys():
                        try:
                            camera2_original = datetime.strptime(timestamps[str(camera2_id)]['original'],"%Y/%m/%d %H:%M:%S")
                            camera2_delta = camera2_original - item2[1]
                            camera2_min = item2[1] + camera2_delta
                            camera2_max = item2[2] + camera2_delta
                        except:
                            # if timestamp is incorrectly formatted, it will not be edited
                            camera2_min = item2[3]
                            camera2_max = item2[4]
                    else:
                        # if timestamp is not edited, use the corrected timestamp from db
                        camera2_min = item2[3]
                        camera2_max = item2[4]

                    if (camera1_min<=camera2_max<=camera1_max) or (camera1_min<=camera2_min<=camera1_max) or (camera2_min<=camera1_max<=camera2_max) or (camera2_min<=camera1_min<=camera2_max):
                        if (camera1_id in camera_ids) or (camera2_id in camera_ids):
                            if Config.DEBUGGING: app.logger.info('Trapgroup {} overlapping prior to edit'.format(trapgroup.id))
                            overlap_prior.append(trapgroup.id)
                            break

        # Update timestamps
        for camera_id in camera_ids:
            try:
                timestamp = datetime.strptime(timestamps[str(camera_id)]['corrected'],"%Y/%m/%d %H:%M:%S")
                # folder = item['camera']
                # trapTag = re.split('/',identifier)[0]
                # folder = re.split(trapTag+'/',item['camera'])[-1]

                images = db.session.query(Image)\
                                .filter(Image.camera_id==camera_id)\
                                .filter(Image.timestamp!=None)\
                                .order_by(Image.timestamp).all()

                if images:            
                    delta = timestamp-images[0].timestamp
                    if Config.DEBUGGING: app.logger.info('Delta of {} for camera {}'.format(delta,camera_id))
                    for image in images:
                        image.corrected_timestamp = image.timestamp + delta
            except:
                # timestamp probably incorrectly formatted
                pass
        db.session.commit()

        # Check if there is a need to recluster - no need to double check prior overlaps
        overlap_after = []
        trapgroups = db.session.query(Trapgroup).join(Camera).filter(Camera.id.in_(camera_ids)).filter(~Trapgroup.id.in_(overlap_prior)).distinct().all()
        for trapgroup in trapgroups:
            camera_times = db.session.query(Camera.id,func.min(Image.corrected_timestamp).label('min'),func.max(Image.corrected_timestamp).label('max'))\
                                    .join(Image)\
                                    .filter(Image.corrected_timestamp!=None)\
                                    .filter(Camera.trapgroup_id==trapgroup.id)\
                                    .group_by(Camera.id)\
                                    .all()
            camera_times2 = camera_times.copy()
            for item in camera_times:
                if trapgroup.id in overlap_after: break
                camera_times2.remove(item)
                for item2 in camera_times2:
                    if (item[1]<=item2[2]<=item[2]) or (item[1]<=item2[1]<=item[2]) or (item2[1]<=item[2]<=item2[2]) or (item2[1]<=item[1]<=item2[2]):
                        if (item[0] in camera_ids) or (item2[0] in camera_ids):
                            if Config.DEBUGGING: app.logger.info('Trapgroup {} overlapping after to edit'.format(trapgroup.id))
                            overlap_after.append(trapgroup.id)
                            break

        # Recluster if overlaps
        if Config.DEBUGGING: app.logger.info('Overlaps found: trapgroups-{} cameras-{}'.format(overlap_prior+overlap_after,camera_ids))
        if overlap_prior or overlap_after:
            overlaps = (overlap_prior+overlap_after)
            reclusterAfterTimestampChange.delay(survey_id=survey_id,trapgroup_ids=overlaps,camera_ids=camera_ids)
        else:
            survey = db.session.query(Survey).get(survey_id)
            survey.status = 'Ready'
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def re_classify_survey(self,survey_id,classifier):
    '''Celery task for reclassifying the specified survey.'''
    
    try:
        survey = db.session.query(Survey).get(survey_id)
        survey.status='Classifying'
        survey.images_processing = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
        db.session.commit()

        classifySurvey(survey_id=survey_id,sourceBucket=Config.BUCKET,classifier=classifier)

        survey = db.session.query(Survey).get(survey_id)
        survey.images_processing = 0
        db.session.commit()

        for task in survey.tasks:
            translations = db.session.query(Translation).filter(Translation.task_id==task.id).all()

            for translation in translations:
                db.session.delete(translation)

        survey.status = 'Ready'
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

def createChildTranslations(classification,task_id,label):
    '''Creates a translation object in the database for the specified label and task, along with all its children.'''

    # translation = db.session.query(Translation)\
    #                                 .filter(Translation.task_id==task_id)\
    #                                 .filter(Translation.label_id==label.id)\
    #                                 .filter(Translation.classification==classification)\
    #                                 .first()

    # if translation == None:
    translation = Translation(classification=classification, label_id=label.id, task_id=task_id)
    db.session.add(translation)

    labelChildren = db.session.query(Label).filter(Label.parent==label).filter(Label.task_id==task_id).all()
    for child in labelChildren:
        createChildTranslations(classification,task_id,child)
    return True

def checkChildTranslations(label):
    '''Check if any children of a label already has a translation.'''
    
    result = False
    labelChildren = db.session.query(Label).filter(Label.parent==label).filter(Label.task==label.task).all()
    for child in labelChildren:
        check = db.session.query(Translation)\
                        .filter(Translation.label_id==child.id)\
                        .first()

        if check:
            result = True
            break
        else:
            result = checkChildTranslations(child)
            if result:
                break
    
    return result

def setupTranslations(task_id, survey_id, translations, includes):
    '''
    Sets up translations for a specified task. Additionally creates all translations for the child labels, and sets which labels must be auto-classified.
    
        Parameters:
            task_id (int): The task to set up translations for
            survey_id (int): The survey to set up translations for
            translations (dict): The translations to be set up
            includes (list): The list of species to be auto-classified
    '''
    classifications = db.session.query(Detection.classification).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().all()
    classifications = [r[0] for r in classifications if r[0]!=None]

    for classification in classifications:
        
        if classification in translations.keys():
            if translations[classification].lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
                species = db.session.query(Label).filter(Label.task_id==task_id).filter(func.lower(Label.description)==func.lower(translations[classification])).first()
            else:
                species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(translations[classification])).first()
        else:
            if classification.lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
                species = db.session.query(Label).filter(Label.task_id==task_id).filter(func.lower(Label.description)==func.lower(classification)).first()
            else:
                species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(classification)).first()

        if species:
            # translation = db.session.query(Translation)\
            #                         .filter(Translation.task_id==task_id)\
            #                         .filter(Translation.label_id==species.id)\
            #                         .filter(Translation.classification==classification)\
            #                         .first()

            # if translation == None:
            translation = Translation(classification=classification, label_id=species.id, task_id=task_id)
            db.session.add(translation)

            if classification.lower() in includes:
                translation.auto_classify = True
                
    # db.session.commit()

    # Translate children categories as well
    translations = db.session.query(Translation)\
                            .join(Label)\
                            .filter(Label.children.any())\
                            .filter(Label.description != 'Vehicles/Humans/Livestock')\
                            .filter(Label.description != 'Nothing')\
                            .filter(Label.description != 'Unknown')\
                            .filter(Translation.task_id==task_id).all()
    for translation in translations:
        check = db.session.query(Translation)\
                        .filter(Translation.label_id==translation.label_id)\
                        .filter(Translation.classification!=translation.classification)\
                        .first()
        if (check==None) and (not checkChildTranslations(translation.label)):
            for child in translation.label.children:
                createChildTranslations(translation.classification,task_id,child)    
    # db.session.commit()

    return True

def edit_translations(task_id, translations):
    '''Handles the editing of translations for the given set of translations and specified task.'''

    for classification in translations:
        if translations[classification].lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
            species = db.session.query(Label).filter(Label.task_id==task_id).filter(func.lower(Label.description)==func.lower(translations[classification])).first()
        else:
            species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(translations[classification])).first()

        if species:
            translation = Translation(classification=classification, label_id=species.id, task_id=task_id)
            db.session.add(translation)

    db.session.commit()
    return True

def generateLabels(labels, task_id, labelDictionary):
    '''Generates the specified labels for the requested task. Tunnels down repeatedly until all children labels are created.'''
    
    notYet = []
    for label in labels:
        if label[0].lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown','skip']:
            if label[2] == 'Vehicles/Humans/Livestock':
                parent = db.session.query(Label).get(GLOBALS.vhl_id)
                newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=parent)
                db.session.add(newLabel)
                labelDictionary[label[0]] = newLabel
            elif label[2] == 'None':
                newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=None)
                db.session.add(newLabel)
                labelDictionary[label[0]] = newLabel
            else:
                if label[2] in labelDictionary.keys():
                    parent = labelDictionary[label[2]]
                    newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=parent)
                    db.session.add(newLabel)
                    labelDictionary[label[0]] = newLabel
                else:
                    notYet.append(label)

    # db.session.commit()
    
    if len(notYet) > 0:
        generateLabels(notYet, task_id, labelDictionary)

    return True

@celery.task(bind=True,max_retries=29)
def findTrapgroupTags(self,tgCode,folder,user_id,surveyName):
    '''Celery task that does the trapgroup code check. Returns the user message.'''

    try:
        reply = None
        # isjpeg = re.compile('\.jpe?g$', re.I)

        try:
            tgCode = re.compile(tgCode)
            allTags = []
            for dirpath, folders, filenames in s3traverse(Config.BUCKET, db.session.query(User).get(user_id).folder+'/'+folder):
                # jpegs = list(filter(isjpeg.search, filenames))
                # if len(jpegs):
                tags = tgCode.findall(dirpath.replace(surveyName+'/',''))
                if len(tags) > 0:
                    tag = tags[0]
                    if tag not in allTags:
                        allTags.append(tag)

            reply = str(len(allTags)) + ' sites found: ' + ', '.join([str(tag) for tag in sorted(allTags)])

        except:
            reply = 'Malformed expression. Please try again.'

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return reply

@celery.task(bind=True,max_retries=29,ignore_result=True)
def hideSmallDetections(self,survey_id,ignore_small_detections,edge):
    '''Celery task that sets all small detections to hidden.'''

    try:
        survey = db.session.query(Survey).get(survey_id)
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
                                .filter(Detection.status != 'deleted') \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) < Config.DET_AREA)

        if (not edge) and (ignore_small_detections=='false') and (survey.sky_masked==True):
            detections = detections.filter(Detection.bottom>=Config.SKY_CONST)
        
        detections = detections.distinct().all()

        if ignore_small_detections=='true':
            status = 'hidden'
        else:
            status = 'active'
                                
        # for chunk in chunker(detections,1000):
        for detection in detections:
            detection.status = status
        db.session.commit()

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Ready'
        if ignore_small_detections=='true':
            survey.ignore_small_detections = True
        else:
            survey.ignore_small_detections = False
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def maskSky(self,survey_id,sky_masked,edge):
    '''Celery task that masks all detections in the sky.'''

    try:
        survey = db.session.query(Survey).get(survey_id)
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
                                .filter(Detection.status != 'deleted') \
                                .filter(Detection.bottom<Config.SKY_CONST)


        if (not edge) and (sky_masked=='false') and (survey.ignore_small_detections==True):
            detections.filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)
                                
        detections = detections.distinct().all()

        if sky_masked=='true':
            status = 'hidden'
        else:
            status = 'active'
                                
        # for chunk in chunker(detections,1000):
        for detection in detections:
            detection.status = status
        db.session.commit()

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Ready'
        if sky_masked=='true':
            survey.sky_masked = True
        else:
            survey.sky_masked = False
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

def get_AWS_costs(startDate,endDate):
    '''Returns the AWS cost stats for the specied period in USD.'''
    
    costExplorer = boto3.client('ce')
    timePeriod = {'Start': startDate.strftime("%Y-%m-%d"), 'End': endDate.strftime("%Y-%m-%d")}
    services = ['Amazon Elastic Compute Cloud - Compute','Amazon Simple Storage Service','Amazon Relational Database Service','Total']
    filter = {
        'And': [
            {'Dimensions': {
                'Key': 'SERVICE',
                'Values': []
            }},
            {'Dimensions': {
                'Key': 'REGION',
                'Values': [Config.AWS_REGION]
            }}
        ]
    }

    costs = {}
    for service in services:
        
        if service=='Total':
            filter = filter['And'][1]
        else:
            filter['And'][0]['Dimensions']['Values']=[service]
        
        costs[service] = round(float(costExplorer.get_cost_and_usage(
            TimePeriod=timePeriod,
            Granularity='MONTHLY',
            Filter = filter,
            Metrics=['UnblendedCost']
        )['ResultsByTime'][0]['Total']['UnblendedCost']['Amount'])*Config.VAT,2)

    return costs

@celery.task(bind=True,max_retries=29,ignore_result=True)
def updateStatistics(self):
    '''Updates the site statistics in the database for dashboard reference purposes.'''

    try:
        check = db.session.query(Statistic)\
                        .filter(extract('year',Statistic.timestamp)==datetime.utcnow().year)\
                        .filter(extract('month',Statistic.timestamp)==datetime.utcnow().month)\
                        .filter(extract('day',Statistic.timestamp)==datetime.utcnow().day)\
                        .first()

        if not check:
            statistic = Statistic(timestamp=datetime.utcnow())
            db.session.add(statistic)

            # Daily stats
            statistic.unique_daily_logins = db.session.query(User)\
                                                .filter(User.last_ping>(datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(days=1)))\
                                                .filter(User.email!=None).count()
            statistic.unique_daily_admin_logins = db.session.query(User)\
                                                .filter(User.last_ping>(datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(days=1)))\
                                                .filter(User.admin==True).count()

            #Monthly stats
            if datetime.utcnow().day==1:
                users = db.session.query(User).filter(~User.username.in_(['Admin','WildEye','Dashboard'])).filter(User.admin==True).distinct().all()
                image_count=0
                for user in users:
                    for survey in user.surveys:
                        image_count+=survey.image_count

                sq = db.session.query(User.id.label('user_id'),func.sum(Survey.image_count).label('count')).join(Survey).group_by(User.id).subquery()
                active_user_count = db.session.query(User)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .join(sq,sq.c.user_id==User.id)\
                                        .filter(Task.init_complete==True)\
                                        .filter(sq.c.count>10000)\
                                        .distinct().count()

                # AWS Costs
                startDate = (datetime.utcnow().replace(day=1)-timedelta(days=10)).replace(day=1)
                endDate = datetime.utcnow().replace(day=1)
                costs = get_AWS_costs(startDate,endDate)

                # Average daily logins
                average_daily_logins = 0
                average_daily_admin_logins = 0
                statistics = db.sessioon.query(Statistic).filter(Statistic.timestamp>startDate).all()
                if statistics:
                    for stat in statistics:
                        average_daily_logins += stat.unique_daily_logins
                        average_daily_admin_logins += stat.unique_daily_admin_logins
                    average_daily_logins = round(average_daily_logins/len(statistics),2)
                    average_daily_admin_logins = round(average_daily_admin_logins/len(statistics),2)

                # Unique monthly logins
                unique_monthly_logins = db.session.query(User)\
                                                    .filter(User.last_ping>startDate)\
                                                    .filter(User.email!=None).count()
                unique_monthly_admin_logins = db.session.query(User)\
                                                    .filter(User.last_ping>startDate)\
                                                    .filter(User.admin==True).count()

                # Update DB object
                statistic.user_count=len(users),
                statistic.active_user_count=active_user_count,
                statistic.image_count=image_count,
                statistic.server_cost=costs['Amazon Elastic Compute Cloud - Compute'],
                statistic.storage_cost=costs['Amazon Simple Storage Service'],
                statistic.db_cost=costs['Amazon Relational Database Service'],
                statistic.total_cost=costs['Total']
                statistic.average_daily_logins = average_daily_logins
                statistic.average_daily_admin_logins = average_daily_admin_logins
                statistic.unique_monthly_logins = unique_monthly_logins
                statistic.unique_monthly_admin_logins = unique_monthly_admin_logins

                # Update user image counts
                data = db.session.query(User,func.sum(Survey.image_count)).join(Survey).filter(User.admin==True).group_by(User.id).all()
                for item in data:
                    user = item[0]
                    count = int(item[1])
                    user.previous_image_count = user.image_count
                    user.image_count = count

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