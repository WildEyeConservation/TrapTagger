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
from app.functions.globals import classifyTask, finish_knockdown, updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, retryTime, chunker
from app.functions.individualID import calculate_individual_similarities
from app.functions.imports import cluster_survey, classifyTrapgroup, classifySurvey, s3traverse
import GLOBALS
from sqlalchemy.sql import func, or_
from datetime import datetime
import re
import ast
from multiprocessing.pool import ThreadPool as Pool
import traceback

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
        task = db.session.query(Task).get(task_id)
        clusters = db.session.query(Cluster).filter(Cluster.task_id==task.id).all()

        app.logger.info('Deleting task {} from survey {}'.format(task.name,task.survey.name))

        try:
            for chunk in chunker(clusters,1000):
                for cluster in chunk:
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
                for chunk in chunker(labelgroups,1000):
                    for labelgroup in chunk:
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
                individuals = db.session.query(Individual).filter(Individual.task_id==task_id).all()
                for chunk in chunker(individuals,1000):
                    for individual in chunk:
                        individual.detections = []
                        individual.children = []
                        individual.tags = []
                    db.session.commit()

                    for individual in chunk:
                        indSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
                        for indSimilarity in indSimilarities:
                            db.session.delete(indSimilarity)
                        db.session.delete(individual)
                    db.session.commit()
                app.logger.info('Individuals deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete individuals.'
                app.logger.info('Failed to delete individuals.')

        #Delete translations
        if status != 'error':
            try:
                translations = db.session.query(Translation).filter(Translation.task_id==task_id).all()
                for chunk in chunker(translations,1000):
                    for translation in chunk:
                        db.session.delete(translation)
                    db.session.commit()
                app.logger.info('Translations deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete translations.'
                app.logger.info('Failed to delete translations.')

        #Delete tags
        if status != 'error':
            try:
                tags = db.session.query(Tag).filter(Tag.task_id==task_id).all()
                for chunk in chunker(tags,1000):
                    for tag in chunk:
                        db.session.delete(tag)
                    db.session.commit()
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

        #Delete turkcodes & workers
        if status != 'error':
            try:
                turkcodes = db.session.query(Turkcode) \
                                    .join(User, User.username==Turkcode.user_id) \
                                    .filter(Turkcode.task_id==task_id) \
                                    .filter(User.email==None) \
                                    .all()
                for chunk in chunker(turkcodes,1000):
                    for turkcode in chunk:
                        worker = db.session.query(User).filter(User.username==turkcode.user_id).first()
                        db.session.delete(worker)
                        db.session.delete(turkcode)
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

        tasks = db.session.query(Task).filter(Task.survey_id==survey_id).all()

        app.logger.info('Deleting survey {}'.format(survey_id))

        if status != 'error':
            for task in tasks:
                tempStatus, tempMessage = delete_task(task.id)
                if tempStatus != None:
                    status = tempStatus
                    message = tempMessage

        #Delete detections
        if status != 'error':
            try:
                detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for chunk in chunker(detections,1000):
                    for detection in chunk:
                        detection.individuals = []
                        detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.detection_1==detection.id,DetSimilarity.detection_2==detection.id)).all()
                        for detSimilarity in detSimilarities:
                            db.session.delete(detSimilarity)
                        db.session.delete(detection)
                    db.session.commit()
                app.logger.info('Detections deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete detections.'
                app.logger.info('Failed to delete detections.')

        #Delete images
        if status != 'error':
            try:
                images = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for chunk in chunker(images,1000):
                    for image in chunk:
                        db.session.delete(image)
                    db.session.commit()
                app.logger.info('Images deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete images.'
                app.logger.info('Failed to delete images.')

        #Delete cameras
        if status != 'error':
            try:
                cameras = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for chunk in chunker(cameras,1000):
                    for camera in chunk:
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
                trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for chunk in chunker(trapgroups,1000):
                    for trapgroup in chunk:
                        db.session.delete(trapgroup)
                    db.session.commit()
                app.logger.info('Trapgroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete trap groups.'
                app.logger.info('Failed to delete Trapgroups')

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
    
    for label in parent.children:
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

def copyClusters(newTask_id):
    '''Copies default task clustering to the specified task.'''

    survey_id = db.session.query(Task).get(newTask_id).survey_id
    default = db.session.query(Task).filter(Task.name=='default').filter(Task.survey_id==int(survey_id)).first()
    trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==int(survey_id)).all()

    for trapgroup in trapgroups:
        clusters = db.session.query(Cluster).join(Image, Cluster.images).join(Camera).filter(Camera.trapgroup_id==trapgroup.id).filter(Cluster.task_id==default.id).distinct().all()
        check = db.session.query(Cluster).join(Image, Cluster.images).join(Camera).filter(Camera.trapgroup_id==trapgroup.id).filter(Cluster.task_id==newTask_id).first()

        if check == None:
            for cluster in clusters:
                newCluster = Cluster(task_id=newTask_id)
                db.session.add(newCluster)
                newCluster.images=cluster.images
                newCluster.classification = cluster.classification

                if cluster.labels != []:
                    newCluster.labels=cluster.labels
                    newCluster.user_id=cluster.user_id
                    newCluster.timestamp = datetime.utcnow()

                detections = db.session.query(Detection).join(Image).filter(Image.clusters.contains(cluster)).all()
                for detection in detections:
                    labelgroup = Labelgroup(detection_id=detection.id,task_id=newTask_id,checked=False)
                    db.session.add(labelgroup)
                    labelgroup.labels = cluster.labels

            db.session.commit()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def prepTask(self,newTask_id, survey_id, includes, translation):
    '''
    Celery task for preparing a new task for a survey, includes setting up translations, clustering, and auto-classification.

        Parameters:
            newTask_id (int): The ID of the new task
            survey_id (int): The ID of the survey for which it was added
            includes (list): The list of species to auto-classify
            translation (dict): The translations between user and classifier labels
    '''

    try:
        setupTranslations(newTask_id, int(survey_id), translation, includes)

        newTask = db.session.query(Task).get(newTask_id)
        newTask.status = 'Generating Clusters'
        db.session.commit()

        copyClusters(newTask_id)

        newTask.status = 'Auto-Classifying'
        db.session.commit()
        classifyTask(newTask_id,None)

        newTask.status = 'Ready'
        survey = db.session.query(Survey).get(int(survey_id))
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

def reclusterAfterTimestampChange(survey_id):
    '''Reclusters all tasks for a specified survey after a timestamp correction, preserving all labels. Saves all old tasks 
    in a hidden state with _o_l_d_ at the end of their name.'''

    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Reclustering'
    db.session.commit()

    # delete default task
    defaultTask = db.session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name=='default').first()
    if defaultTask:
        delete_task(defaultTask.id)

    # create new default task
    cluster_survey(survey_id,'default')
    db.session.commit()
    defaultTask = db.session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name=='default').first()
    pool = Pool(processes=4)
    for trapgroup in db.session.query(Survey).get(survey_id).trapgroups:
        pool.apply_async(classifyTrapgroup,(defaultTask.id,trapgroup.id))
    pool.close()
    pool.join()

    db.session.commit()
    survey=db.session.query(Survey).get(survey_id)
    for task in survey.tasks:
        if ('_o_l_d_' not in task.name) and (task.name != 'default'):

            if '_copying' not in task.name:
                taskName = task.name

                _o_l_d_count = db.session.query(Task).filter(Task.name.contains(task.name+'_o_l_d_')).filter(Task.survey_id==survey_id).distinct().count()

                #Rename old task
                task.name += '_o_l_d_'
                if _o_l_d_count: task.name += str(_o_l_d_count)
                # db.session.commit

                #create new task
                newTask = Task(name=taskName+'_copying', survey_id=survey_id, status='Ready', tagging_time=task.tagging_time, test_size=task.test_size, size=task.size, parent_classification=task.parent_classification)
                db.session.add(newTask)
                db.session.commit()
            else:
                #Copy was interrupted
                taskName = re.split('_copying',task.name)[0] + '_o_l_d_'
                newTask = task
                task = db.session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name==taskName).first()

            #copy labels, tags, and translations
            labels = db.session.query(Label).filter(Label.task_id==task.id).all()
            for label in labels:
                check = db.session.query(Label).filter(Label.task_id==newTask.id).filter(Label.description==label.description).filter(Label.hotkey==label.hotkey).first()
                if not check:
                    newLabel = Label(description=label.description,hotkey=label.hotkey,complete=label.complete,task_id=newTask.id)
                    db.session.add(newLabel)
            for label in labels:
                if label.parent_id != None:
                    newLabel = db.session.query(Label).filter(Label.description==label.description).filter(Label.task_id==newTask.id).first()
                    parent = label.parent
                    if parent.task_id != None:
                        parent = db.session.query(Label).filter(Label.description==parent.description).filter(Label.task_id==newTask.id).first()
                    newLabel.parent = parent
            db.session.commit()

            #copy tags
            tags = db.session.query(Tag).filter(Tag.task_id==task.id).all()
            for tag in tags:
                check = db.session.query(Tag).filter(Tag.task_id==newTask.id).filter(Tag.description==tag.description).first()
                if not check:
                    newTag = Tag(   task_id=newTask.id,
                                    description=tag.description,
                                    hotkey=tag.hotkey)
                    db.session.add(newTag)
            db.session.commit()

            translations = db.session.query(Translation).filter(Translation.task_id==task.id).all()
            for translation in translations:
                if translation.label.task_id:
                    newLabel = db.session.query(Label).filter(Label.description==translation.label.description).filter(Label.task_id==newTask.id).first()
                else:
                    newLabel = translation.label
                check = db.session.query(Translation).filter(Translation.classification==translation.classification).filter(Translation.task_id==newTask.id).filter(Translation.label_id==newLabel.id).first()
                if not check:
                    newTranslation = Translation(classification=translation.classification,auto_classify=translation.auto_classify,task_id=newTask.id,label_id=newLabel.id)
                    db.session.add(newTranslation)
            db.session.commit()

            # Copying clusters
            copyClusters(newTask.id)

            # deal with knockdowns
            downLabel =  db.session.query(Label).get(GLOBALS.knocked_id)
            clusters = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.contains(downLabel)).all()
            pool = Pool(processes=4)
            for cluster in clusters:
                rootImage = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).first()
                trapgroup = rootImage.camera.trapgroup

                if (trapgroup.queueing==False) and (trapgroup.processing==False):
                    trapgroup.active = False
                    trapgroup.user_id = None
                    trapgroup.processing = True
                    db.session.commit()
                    pool.apply_async(finish_knockdown,(rootImage.id, newTask.id, survey.user.id))

            pool.close()
            pool.join()

            #copy labels & tags
            labelgroups = db.session.query(Labelgroup).join(Detection).filter(~Labelgroup.labels.contains(downLabel)).filter(Detection.score>0.8).filter(Detection.status!='deleted').filter(Detection.static==False).filter(Labelgroup.task_id==task.id).filter(Labelgroup.labels.any()).all()
            for labelgroup in labelgroups:
                newGroup = db.session.query(Labelgroup).filter(Labelgroup.task_id==newTask.id).filter(Labelgroup.detection_id==labelgroup.detection_id).first()
                newGroup.checked = labelgroup.checked
                
                labels = []
                for label in labelgroup.labels[:]:
                    if label.task_id != None:
                        newLabel = db.session.query(Label).filter(Label.description==label.description).filter(Label.task_id==newTask.id).first()
                    else:
                        newLabel = label
                    labels.append(newLabel)
                newGroup.labels = labels

                tags = []
                for tag in labelgroup.tags[:]:
                    if tag.task_id != None:
                        newTag = db.session.query(Tag).filter(Tag.description==Tag.description).filter(Tag.task_id==newTask.id).first()
                    else:
                        newTag = tag
                    tags.append(newTag)
                newGroup.tags = tags

            db.session.commit()

            clusters = db.session.query(Cluster).filter(Cluster.task_id==newTask.id).all()
            for cluster in clusters:
                cluster.labels = db.session.query(Label).join(Labelgroup,Label.labelgroups).join(Detection).join(Image).filter(Labelgroup.task_id==newTask.id).filter(Image.clusters.contains(cluster)).distinct().all()
                cluster.tags = db.session.query(Tag).join(Labelgroup,Tag.labelgroups).join(Detection).join(Image).filter(Labelgroup.task_id==newTask.id).filter(Image.clusters.contains(cluster)).distinct().all()
            db.session.commit()

            #copy individuals
            individuals = db.session.query(Individual).filter(Individual.task_id==task.id).all()
            for individual in individuals:
                label = individual.label
                if label.task_id != None:
                    newLabel = db.session.query(Label).filter(Label.description==label.description).filter(Label.task_id==newTask.id).first()
                else:
                    newLabel = label

                newIndividual = db.session.query(Individual).filter(Individual.task_id==newTask.id).filter(Individual.label_id==newLabel.id).filter(Individual.detections.contains(individual.detections[0])).first()

                if not newIndividual:
                    newIndividual = Individual( name=individual.name,
                                                notes=individual.notes,
                                                active=individual.active,
                                                task_id=newTask.id,
                                                label_id=newLabel.id,
                                                user_id=individual.user_id,
                                                timestamp=individual.timestamp)

                    db.session.add(newIndividual)

                newIndividual.detections = individual.detections

                tags = []
                for tag in individual.tags:
                    newTag = db.session.query(Tag).filter(Tag.description==tag.description).filter(Tag.task_id==newTask.id).first()
                    tags.append(newTag)
                newIndividual.tags = tags

            for individual in individuals:
                newIndividual = db.session.query(Individual).filter(Individual.task_id==newTask.id).filter(Individual.detections.contains(individual.detections[0])).first()
                for child in individual.children:
                    newChild = db.session.query(Individual).filter(Individual.task_id==newTask.id).filter(Individual.detections.contains(child.detections[0])).first()
                    newIndividual.children.append(newChild)

            # recalculate individual similarities as the heuristic values will have changed
            if len(individuals) > 0:
                label_ids = [r.id for r in db.session.query(Label).join(Individual).filter(Individual.task_id==newTask.id).distinct().all()]
                pool = Pool(processes=4)
                for label_id in label_ids:
                    user_ids = [r.id for r in db.session.query(User)\
                                                        .join(Individual, Individual.user_id==User.id)\
                                                        .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                        .filter(Individual.task_id==newTask.id)\
                                                        .filter(Individual.label_id==label_id)\
                                                        .filter(or_(IndSimilarity.id==None,IndSimilarity.score==None))\
                                                        .filter(User.passed=='cTrue')\
                                                        .distinct().all()]

                    pool.apply_async(calculate_individual_similarities,(newTask.id,label_id,user_ids))

                pool.close()
                pool.join()

            newTask.name = re.split('_copying',newTask.name)[0]
            db.session.commit()

    for task in survey.tasks:
        if task.name != 'default':
            updateTaskCompletionStatus(task.id)
            updateLabelCompletionStatus(task.id)
            updateIndividualIdStatus(task.id)
            
    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def updateCoords(self,survey_id,coordData):
    '''Updates the survey's trapgroup coordinates.'''

    try:
        for item in coordData:
            app.logger.info(item['tag'])
            trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==item['tag']).first()
            if trapgroup:
                try:
                    app.logger.info(item['latitude'])
                    trapgroup.latitude = float(item['latitude'])
                    app.logger.info(item['longitude'])
                    trapgroup.longitude = float(item['longitude'])
                    app.logger.info(item['altitude'])
                    trapgroup.altitude = float(item['altitude'])
                    db.session.commit()
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def changeTimestamps(self,survey_id,timestamps):
    '''
    Celery task for shifting the camera timestamps of a specified survey. Re-clusters all tasks afterword.
    
        Parameters:
            survey_id (int): The survey to edit
            timestamps (list): List of timestamp changes
    '''
    
    try:
        # Update timestamps
        for item in timestamps:
            try:
                timestamp = datetime.strptime(item['timestamp'],"%Y/%m/%d %H:%M:%S")
                folder = item['camera']
                # trapTag = re.split('/',identifier)[0]
                # folder = re.split(trapTag+'/',item['camera'])[-1]

                images = db.session.query(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(Camera.path==folder)\
                                .order_by(Image.corrected_timestamp).all()
                                
                delta = timestamp-images[0].timestamp
                for image in images:
                    image.corrected_timestamp = image.timestamp + delta
            except:
                # timestamp probably incorrectly formatted
                pass
        db.session.commit()

        reclusterAfterTimestampChange(survey_id)
        
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
def re_classify_survey(self,survey_id):
    '''Celery task for reclassifying the specified survey.'''
    
    try:
        survey = db.session.query(Survey).get(survey_id)
        survey.status='Classifying'
        survey.images_processing = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
        db.session.commit()

        classifySurvey(survey_id=survey_id,sourceBucket=survey.user.bucket)

        survey.images_processing = 0
        db.session.commit()

        clusters = db.session.query(Cluster)\
                            .join(Image,Cluster.images)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Cluster.classification_checked==True)\
                            .distinct().all()

        for cluster in clusters:
            cluster.classification_checked = False

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

    translation = db.session.query(Translation)\
                                    .filter(Translation.task_id==task_id)\
                                    .filter(Translation.label_id==label.id)\
                                    .filter(Translation.classification==classification)\
                                    .first()

    if translation == None:
        translation = Translation(classification=classification, label_id=label.id, task_id=task_id)
        db.session.add(translation)

    for child in label.children:
        createChildTranslations(classification,task_id,child)
    return True

def checkChildTranslations(label):
    '''Check if any children of a label already has a translation.'''
    
    result = False
    for child in label.children:
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
            translation = db.session.query(Translation)\
                                    .filter(Translation.task_id==task_id)\
                                    .filter(Translation.label_id==species.id)\
                                    .filter(Translation.classification==classification)\
                                    .first()

            if translation == None:
                translation = Translation(classification=classification, label_id=species.id, task_id=task_id)
                db.session.add(translation)

            if classification.lower() in includes:
                translation.auto_classify = True
                
    db.session.commit()

    # Translate children categories as well
    translations = db.session.query(Translation)\
                            .join(Label)\
                            .filter(Label.children.any())\
                            .filter(Label.description != 'Vehicles/Humans/Livestock')\
                            .filter(Label.description != 'Nothing')\
                            .filter(Label.description != 'Unknown')\
                            .filter(Translation.task_id==task_id).all()
    for translation in translations:
        if not checkChildTranslations(translation.label):
            for child in translation.label.children:
                createChildTranslations(translation.classification,task_id,child)    
    db.session.commit()

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

def generateLabels(labels, task_id):
    '''Generates the specified labels for the requested task. Tunnels down repeatedly until all children labels are created.'''
    
    notYet = []
    for label in labels:
        if label[0].lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown','skip']:
            if label[2] == 'Vehicles/Humans/Livestock':
                parent = db.session.query(Label).filter(Label.description==label[2]).first()
                newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=parent)
                db.session.add(newLabel)
            elif label[2] == 'None':
                newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=None)
                db.session.add(newLabel)
            else:
                parent = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.description==label[2]).first()
                if parent == None:
                    notYet.append(label)
                else:
                    newLabel = Label(description=label[0], hotkey=label[1], task_id=task_id, parent=parent)
                    db.session.add(newLabel)
    db.session.commit()
    
    if len(notYet) > 0:
        generateLabels(notYet, task_id)

    return True

@celery.task(bind=True,max_retries=29)
def findTrapgroupTags(self,tgCode,folder,user_id):
    '''Celery task that does the trapgroup code check. Returns the user message.'''

    try:
        reply = None
        sourceBucket = db.session.query(User).get(user_id).bucket+'-raw'
        isjpeg = re.compile('\.jpe?g$', re.I)
        tgCode = re.compile(tgCode)
        allTags = []
        for dirpath, folders, filenames in s3traverse(sourceBucket, folder):
            jpegs = list(filter(isjpeg.search, filenames))
            if len(jpegs):
                tags = tgCode.findall(dirpath)
                if len(tags) > 0:
                    tag = tags[0]
                    if tag not in allTags:
                        allTags.append(tag)

        reply = str(len(allTags)) + ' trapgroups found: ' + ', '.join([str(tag) for tag in sorted(allTags)])

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