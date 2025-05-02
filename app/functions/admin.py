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
from app.functions.globals import classifyTask, update_masks, retryTime, resolve_abandoned_jobs, addChildLabels, updateAllStatuses, deleteFile,\
                                    stringify_timestamp, rDets, update_staticgroups, detection_rating, chunker, verify_label, cleanup_empty_restored_images, \
                                    reconcile_cluster_labelgroup_labels_and_tags, hideSmallDetections, maskSky, checkChildTranslations, createChildTranslations
from app.functions.individualID import calculate_detection_similarities, cleanUpIndividuals, check_individual_detection_mismatch
from app.functions.imports import classifySurvey, s3traverse, recluster_large_clusters, removeHumans, classifyCluster, importKML, import_survey
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
from celery.result import allow_join_result

@celery.task(bind=True,max_retries=5,ignore_result=True)
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

        earth_ranger_ids = db.session.query(ERangerID).join(Cluster).filter(Cluster.task_id==task_id).all()
        try:
            for earth_ranger_id in earth_ranger_ids:
                db.session.delete(earth_ranger_id)
            db.session.commit()
            app.logger.info('Earth Ranger IDs deleted successfully.')
        except:
            status = 'error'
            message = 'Could not delete Earth Ranger IDs.'
            app.logger.info('Failed to delete Earth Ranger IDs.')

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
                tags = [r[0] for r in db.session.query(Tag.id).filter(Tag.task_id==task_id).all()]
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

        #Delete download requests
        if status != 'error':
            try:
                download_requests = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==task_id).all()
                for request in download_requests:
                    if request.status == 'Available' and request.type != 'file':
                        fileName = request.task.survey.organisation.folder+'/docs/'+request.task.survey.organisation.name+'_'+request.user.username+'_'+request.task.survey.name+'_'+request.task.name + '.' + Config.RESULT_TYPES[request.type]
                        deleteFile.apply_async(kwargs={'fileName': fileName})
                    db.session.delete(request)
                db.session.commit()
                app.logger.info('Download requests deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete download requests.'
                app.logger.info('Failed to delete download requests.')

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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def stop_task(self,task_id,live=False):
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
                # db.session.commit()
            elif '-5' in task.tagging_level:
                cleanUpIndividuals(task_id)
                GLOBALS.redisClient.delete('active_individuals_'+str(task_id))
                GLOBALS.redisClient.delete('active_indsims_'+str(task_id))
                GLOBALS.redisClient.delete('quantiles_'+str(task_id))
                if not task.sub_tasks:
                    tL = task.tagging_level.split(',')
                    label = db.session.query(Label).filter(Label.task==task).filter(Label.description==tL[1]).first()
                    if len(tL) > 3 and tL[3].isdigit():
                        current_quantile = int(tL[3])
                        first_quantile = int(Config.ID_QUANTILES[0])
                        if not label.icID_q1_complete: 
                            if current_quantile < first_quantile:
                                label.icID_q1_complete = True
                            else:
                                label.icID_q1_complete = False

            db.session.commit()

            reconcile_cluster_labelgroup_labels_and_tags(task_id)

            if ',' not in task.tagging_level and task.init_complete and '-2' not in task.tagging_level:
                check_individual_detection_mismatch(task_id=task_id)

            updateAllStatuses(task_id=int(task_id))

            # if task_id in GLOBALS.mutex.keys(): GLOBALS.mutex.pop(task_id, None)

            task = db.session.query(Task).get(int(task_id))
            survey = task.survey
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

            # elif survey.status=='indprocessing':
            #     #Check whether individual similarities are still being processed
            #     inspector = celery.control.inspect()
            #     active_tasks = inspector.active()
            #     reserved_tasks = inspector.reserved()

            #     still_processing = False
            #     for tasks in [active_tasks,reserved_tasks]:
            #         for worker in tasks:
            #             for task in tasks[worker]:
            #                 if ('calculate_individual_similarities' in task['name']) and (('task_id' in task['kwargs']) and (int(task['kwargs']['task_id']) == int(task_id)) or ((len(task['args'])>0) and (int(task['args'][0]) == int(task_id)))):
            #                     still_processing = True
            #                     break
            #             else:
            #                 continue
            #             break
            #         else:
            #             continue
            #         break

            #     if not still_processing:
            #         survey.status = 'Ready'

            if '-7' in task.tagging_level:
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

        survey = db.session.query(Survey).get(survey_id)
        if not survey:
            return True
        
        survey_folder = survey.organisation.folder+'/'+survey.name+'/%'
        survey_folder = survey_folder.replace('_','\\_')

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

                aid_list = []
                detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for detection in detections:
                    if detection.aid: aid_list.append(detection.aid)
                    db.session.delete(detection)
                db.session.commit()

                staticgroups = db.session.query(Staticgroup).filter(~Staticgroup.detections.any()).all()
                for staticgroup in staticgroups:
                    db.session.delete(staticgroup)
                db.session.commit()

                #Delete WBIA data
                # keep_aid_list = [r[0] for r in db.session.query(Detection.aid, func.count(Detection.id))\
                #     .filter(Detection.aid.in_(aid_list))\
                #     .group_by(Detection.aid)\
                #     .distinct().all() if r[1]>0]
                # aid_list = list(set(aid_list) - set(keep_aid_list))
                # if aid_list:
                #     if not GLOBALS.ibs:
                #         from wbia import opendb
                #         GLOBALS.ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR+'_'+Config.WORKER_NAME,allow_newdir=True)
                #     GLOBALS.ibs.db.delete('featurematches', aid_list, 'annot_rowid1')
                #     GLOBALS.ibs.db.delete('featurematches', aid_list, 'annot_rowid2')
                #     gids = [g for g in GLOBALS.ibs.get_annot_gids(aid_list) if g is not None]
                #     GLOBALS.ibs.delete_images(gids)
                #     GLOBALS.ibs.delete_annots(aid_list)  

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

        #Delete floating images (from unfinished upload)
        if status != 'error':
            try:
                images = db.session.query(Image).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).all()
                for image in images:
                    db.session.delete(image)
                db.session.commit()
                app.logger.info('Floating images deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete floating images.'
                app.logger.info('Failed to delete floating images.')


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

        #Delete floating videos (from unfinished upload)
        if status != 'error':
            try:
                videos = db.session.query(Video).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).all()
                for video in videos:
                    db.session.delete(video)
                db.session.commit()
                app.logger.info('Floating videos deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete floating videos.'
                app.logger.info('Failed to delete floating videos.')

        #Delete masks
        if status != 'error':
            try:
                masks = db.session.query(Mask).join(Cameragroup).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for mask in masks:
                    db.session.delete(mask)
                db.session.commit()
                app.logger.info('Masks deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete masks.'
                app.logger.info('Failed to delete masks.')

        #Delete cameragroups
        if status != 'error':
            try:
                cameragroups = db.session.query(Cameragroup).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for cameragroup in cameragroups:
                    cameragroup.cameras = []
                    db.session.delete(cameragroup)
                db.session.commit()
                app.logger.info('Cameragroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete cameragroups.'
                app.logger.info('Failed to delete cameragroups.')

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

        #Delete floating cameras (from unfinished upload)
        if status != 'error':
            try:
                cameras = db.session.query(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).all()
                for camera in cameras:
                    db.session.delete(camera)
                db.session.commit()
                app.logger.info('Floating cameras deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete floating cameras.'
                app.logger.info('Failed to delete floating cameras.')

        #Delete trapgroups
        if status != 'error':
            try:
                # db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).delete(synchronize_session=False)
                # for chunk in chunker(trapgroups,1000):
                #     for trapgroup in chunk:
                #         db.session.delete(trapgroup)
                trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).all()
                for trapgroup in trapgroups:
                    trapgroup.sitegroups = []
                    db.session.delete(trapgroup)
                db.session.commit()
                app.logger.info('Trapgroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete trap groups.'
                app.logger.info('Failed to delete Trapgroups')

        #Delete empty sitegroups
        if status != 'error':
            try:
                sitegroups = db.session.query(Sitegroup).filter(~Sitegroup.trapgroups.any()).all()
                for sitegroup in sitegroups:
                        db.session.delete(sitegroup)
                db.session.commit()
                app.logger.info('Sitegroups deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete sitegroups.'
                app.logger.info('Failed to delete sitegroups.')

        #Delete survey shares
        if status != 'error':
            try:
                survey_shares = db.session.query(SurveyShare).filter(SurveyShare.survey_id==survey_id).all()
                for share in survey_shares:
                    db.session.delete(share)
                db.session.commit()
                app.logger.info('Survey shares deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete survey shares.'
                app.logger.info('Failed to delete survey shares.')

        #Delete Survey Permission Exceptions
        if status != 'error':
            try:
                survey_permission_exceptions = db.session.query(SurveyPermissionException).filter(SurveyPermissionException.survey_id==survey_id).all()
                for exception in survey_permission_exceptions:
                    db.session.delete(exception)
                db.session.commit()
                app.logger.info('Survey permission exceptions deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete survey permission exceptions.'
                app.logger.info('Failed to delete survey permission exceptions.')

        #Delete Survey API Keys
        if status != 'error':
            try:
                survey_api_keys = db.session.query(APIKey).filter(APIKey.survey_id==survey_id).all()
                for api_key in survey_api_keys:
                    db.session.delete(api_key)
                db.session.commit()
                app.logger.info('Survey API keys deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete survey API keys.'
                app.logger.info('Failed to delete survey API keys.')
                
        #Delete images from S3
        if status != 'error':
            try:
                survey = db.session.query(Survey).get(survey_id)
                s3 = boto3.resource('s3')
                bucketObject = s3.Bucket(Config.BUCKET)
                bucketObject.objects.filter(Prefix=survey.organisation.folder+'/'+survey.name+'/').delete()
                app.logger.info('images deleted from S3 successfully.')
            except:
                # status = 'error'
                # message = 'Could not delete images from S3.'
                app.logger.info('Could not delete images from S3')
        
        #Delete images from S3-comp
        if status != 'error':
            try:
                bucketObject.objects.filter(Prefix=survey.organisation.folder+'-comp/'+survey.name+'/').delete()
                app.logger.info('images deleted from S3-comp successfully.')
            except:
                # status = 'error'
                # message = 'Could not delete images from S3.'
                app.logger.info('Could not delete images from S3-comp')

        #Delete survey zips 
        if status != 'error':
            try:
                zips = db.session.query(Zip).filter(Zip.survey_id==survey_id).all()
                for zip in zips:
                    zip_key = survey.organisation.folder+'-comp/'+Config.SURVEY_ZIP_FOLDER+'/'+str(zip.id)+'.zip'
                    GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=zip_key)
                    db.session.delete(zip)
                db.session.commit()
                app.logger.info('Survey zips deleted successfully.')
            except:
                status = 'error'
                message = 'Could not delete survey zip files.'
                app.logger.info('Could not delete survey zip files.')
                
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
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
        has_individuals = checkForIndividuals(label)
        if not has_individuals:
            deleteChildLabels(label)
            label.labelgroups = []
            label.clusters = []
            db.session.delete(label)
            labelTranslations = db.session.query(Translation).filter(Translation.label_id==label.id).filter(Translation.task==label.task).all()
            for translation in labelTranslations:
                db.session.delete(translation)
    return True

def checkForIndividuals(label,has_individuals=False):
    '''
    Helper function for processChanges. Checks if there are any individuals with the specified label or its children.

        Parameters:
            label (Label): Label to check
            has_individuals (bool): Flag to indicate if individuals have been found

        Returns:
            has_individuals (bool): Flag to indicate if individuals have been found
    '''
    if not has_individuals:
        has_individuals = db.session.query(Individual).filter(Individual.species==label.description).filter(Individual.tasks.contains(label.task)).first()
        if not has_individuals:
            children = db.session.query(Label).filter(Label.parent==label).filter(Label.task==label.task).all()
            for child in children:
                has_individuals = checkForIndividuals(child,has_individuals)
                if has_individuals:
                    break
    return has_individuals

def processChanges(changes, task_id, speciesChanges=None):
    '''
    Processes requested changes to a task, specifically relating to the editing of labels.

        Parameters:
            changes (dict): The changes being implemented to a parent label - modifed, deleted, or added
            task_id (int): Task being edited
            speciesChanges (dict): The species that are being changed as well as the associated task IDs
    '''

    # First handle the deletes globally
    for parent in changes:
        for delete_id in changes[parent]['edits']['delete']:
            if 's' not in delete_id:
                deleteLabel = db.session.query(Label).get(int(delete_id))
                if deleteLabel and deleteLabel.task_id==task_id: #here we are checking write access
                    has_individuals = checkForIndividuals(deleteLabel)
                    if not has_individuals:
                        deleteTranslations = db.session.query(Translation).filter(Translation.label_id==deleteLabel.id).filter(Translation.task_id==task_id).all()
                        deleteChildLabels(deleteLabel)
                        deleteLabel.clusters = []
                        deleteLabel.labelgroups = []
                        db.session.delete(deleteLabel)
                        for translation in deleteTranslations:
                            db.session.delete(translation)

    # Then handle edits
    for parent in changes:
        for edit_id in changes[parent]['edits']['modify']:
            if 's' not in edit_id:
                editLabel = db.session.query(Label).get(int(edit_id))
                if editLabel and editLabel.task_id==task_id: #here we are checking write access again.
                    valid = verify_label(changes[parent]['edits']['modify'][edit_id]['description'],changes[parent]['edits']['modify'][edit_id]['hotkey'],editLabel.parent_id)
                    if valid:
                        oldLabel = editLabel.description    
                        editLabel.description = changes[parent]['edits']['modify'][edit_id]['description']
                        editLabel.hotkey = changes[parent]['edits']['modify'][edit_id]['hotkey']

                        # Find individuals with this label as their species and update their species and update the label in other tasks
                        # We have already checked write permission on all the tasks in speciesChanges
                        if speciesChanges and (oldLabel in speciesChanges) and (oldLabel != editLabel.description):
                            individuals = db.session.query(Individual).join(Task,Individual.tasks).filter(Task.id.in_(speciesChanges[oldLabel]['tasks'])).filter(Individual.species==oldLabel).all()
                            for individual in individuals:
                                individual.species = editLabel.description

                            for t_id in speciesChanges[oldLabel]['tasks']:
                                if t_id != task_id:
                                    checkLabel = db.session.query(Label).filter(Label.task_id==t_id).filter(Label.description==editLabel.description).first()
                                    if not checkLabel:
                                        taskLabel = db.session.query(Label).filter(Label.task_id==t_id).filter(Label.description==oldLabel).first()
                                        if taskLabel:
                                            taskLabel.description = editLabel.description

    # Then just add the new labels - orphaned
    sessionLabels = {}
    for parent in changes:
        for additional_id in changes[parent]['additional']:
            check = db.session.query(Label) \
                            .filter(Label.task_id==task_id) \
                            .filter(Label.description==changes[parent]['additional'][additional_id]['description']) \
                            .first()

            if check==None:
                parent_value = None
                if parent != '-99999': parent_value = 0
                valid = verify_label(changes[parent]['additional'][additional_id]['description'],changes[parent]['additional'][additional_id]['hotkey'],parent_value)
                if valid:
                    newLabel = Label(description=changes[parent]['additional'][additional_id]['description'],hotkey=changes[parent]['additional'][additional_id]['hotkey'],task_id=task_id)
                    db.session.add(newLabel)
                    sessionLabels[additional_id] = newLabel

    # Then associate parents
    for parent in changes:
        parentLabel = None
        if 's' not in parent:
            if parent == '-100000':
                parentLabel = db.session.query(Label).get(GLOBALS.vhl_id)
            else:
                parentLabel = db.session.query(Label).get(parent)
                # The user was screened for write access to the task_id. We need to ensure that the user has the necessary permissions for the specified label.
                if parentLabel and parentLabel.task_id!=task_id: continue
        else:
            if parent in sessionLabels.keys():
                parentLabel = sessionLabels[parent]
                # The user was screened for write access to the task_id. We need to ensure that the user has the necessary permissions for the specified label.
                if parentLabel and parentLabel.task_id!=task_id: continue

        if parentLabel:
            for additional_id in changes[parent]['additional']:
                sessionLabels[additional_id].parent = parentLabel

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def handleTaskEdit(self,task_id,labelChanges,tagChanges,translationChanges,deleteAutoLabels,speciesChanges=None):
    '''
    Celery task that handles task edits, relating to the editing of labels, tags and translations.

        Parameters:
            task_id (int): The task being edited
            labelChanges (dict): The changes being implemented to a parent label - modifed, deleted, or added
            tagChanges (dict): The changes being implemented to tags - modifed, deleted, or added
            translationChanges (dict): The changes being implemented to translations
            deleteAutoLabels (bool): Flag to indicate if auto classified labels should be deleted for edited translations
            speciesChanges (dict): The species that are being changed as well as the associated task IDs
    '''
    
    try:
        if Config.DEBUGGING: app.logger.info('Task Edit: {}'.format(task_id))
        task_id = int(task_id)
        task = db.session.query(Task).get(task_id)

        if task:
            # Labels
            processChanges(labelChanges, task_id, speciesChanges)

            # Tags 
            for tag_id in tagChanges['delete']:
                tag = db.session.query(Tag).get(tag_id)
                if tag and (tag.task_id==task_id): #the user has only been screen for write access to task_id
                    tag.individuals = []
                    tag.clusters = []
                    db.session.delete(tag)

            for tag_id in tagChanges['modify']:
                tag = db.session.query(Tag).get(tag_id)
                if tag and (tag.task_id==task_id): #the user has only been screen for write access to task_id
                    tag.description = tagChanges['modify'][tag_id]['description']
                    tag.hotkey = tagChanges['modify'][tag_id]['hotkey']

            for tag_id in tagChanges['additional']:
                check = db.session.query(Tag).filter(Tag.task_id==task_id).filter(Tag.description==tagChanges['additional'][tag_id]['description']).first()
                if not check:
                    tag = Tag(description=tagChanges['additional'][tag_id]['description'],hotkey=tagChanges['additional'][tag_id]['hotkey'],task_id=task_id)
                    db.session.add(tag)

            # Translations
            if len(translationChanges.keys()) > 0:
                classifications = []
                for classification in translationChanges:
                    if translationChanges[classification]['edited'].lower() == 'true':
                        classifications.append(classification)

                prev_labels = []
                prev_labels_description = []
                translations = db.session.query(Translation).filter(Translation.task_id==task_id).filter(Translation.classification.in_(classifications)).all()
                for translation in translations:
                    if translation.auto_classify and translation.label_id:
                        prev_labels.append(translation.label_id) 
                        prev_labels_description.append(translation.label.description)
                    db.session.delete(translation)

                includes = []
                translations_dict = {}
                for classification in translationChanges:
                    label = translationChanges[classification]['label'].lower()
                    classify = True if translationChanges[classification]['classify'].lower() == 'true' else False
                    translations_dict[classification] = label
                    if classify and label not in ['nothing', 'unknown']:
                        includes.append(classification)

                edit_translations(task_id, translations_dict, includes)

                if deleteAutoLabels:
                    # Delete auto classified labels from clusters (for edited translations) - only clusters with no individuals
                    admin = db.session.query(User).filter(User.username=='Admin').first()

                    indiv_sq = db.session.query(Individual)\
                            .filter(Individual.species.in_(prev_labels_description))\
                            .filter(Individual.tasks.contains(task))\
                            .subquery()
                    
                    clusters = db.session.query(Cluster)\
                                            .join(Label,Cluster.labels)\
                                            .join(Image,Cluster.images)\
                                            .join(Detection)\
                                            .outerjoin(indiv_sq,Detection.individuals)\
                                            .filter(Cluster.task_id==task_id)\
                                            .filter(Cluster.user==admin)\
                                            .filter(Label.id.in_(prev_labels))\
                                            .filter(indiv_sq.c.id==None)\
                                            .distinct().all()
                    
                    labelgroups = db.session.query(Labelgroup)\
                                            .join(Detection)\
                                            .join(Image)\
                                            .join(Cluster,Image.clusters)\
                                            .join(Label,Cluster.labels)\
                                            .outerjoin(indiv_sq,Detection.individuals)\
                                            .filter(Labelgroup.task_id==task_id)\
                                            .filter(Cluster.task_id==task_id)\
                                            .filter(Cluster.user==admin)\
                                            .filter(Label.id.in_(prev_labels))\
                                            .filter(indiv_sq.c.id==None)\
                                            .distinct().all()

                    for cluster in clusters:
                        cluster.labels = []
                        cluster.user = None

                    for labelgroup in labelgroups:
                        labelgroup.labels = []

                db.session.commit()

                if classifications:
                    classifyTask(task.id)
                    if GLOBALS.vhl_id in prev_labels:
                        removeHumans(task.id)
            
            db.session.commit()

            updateAllStatuses(task.id)

            task = db.session.query(Task).get(task_id)
            task.status = 'Ready'

            task_ids = []
            if speciesChanges:
                for species in speciesChanges:
                    for t_id in speciesChanges[species]['tasks']:
                        if t_id not in task_ids and t_id != task_id:
                            task = db.session.query(Task).get(t_id)
                            task.status = 'Ready'
                            task_ids.append(t_id)

            db.session.commit()

        GLOBALS.redisClient.delete('taskEdit_'+str(task_id))

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

# def reclusterAfterTimestampChange(survey_id,trapgroup_ids,camera_ids):
#     '''Reclusters all tasks for a specified survey after a timestamp correction, preserving all labels etc.'''

#     survey = db.session.query(Survey).get(survey_id)
#     survey.status = 'Reclustering'
#     for trapgroup in survey.trapgroups:
#         trapgroup.processing = False
#         trapgroup.queueing = False
#         trapgroup.active = False
#         trapgroup.user_id = None
#     db.session.commit()

#     # Force = True will cause double clustering - find highest ID so we can delete with ID < highest
#     highest = db.session.query(Cluster.id).join(Task).filter(Task.survey_id==survey_id).order_by(Cluster.id.desc()).first()
#     if highest:
#         highest_id = highest[0]
#     else:
#         highest_id = 0

#     #we want a fresh session after clustering
#     db.session.close()

#     cluster_survey(survey_id,'default',True,trapgroup_ids)

#     # just adding the legacy _o_l_d_ for now - we are moving away from this though
#     tasks = db.session.query(Task).filter(Task.survey_id==survey_id).filter(~Task.name.contains('_o_l_d_')).all()
#     admin = db.session.query(User).filter(User.username=='Admin').first()
#     downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

#     for task in tasks:
#         # copy notes across to new clusters
#         clusters = db.session.query(Cluster)\
#                             .join(Image,Cluster.images)\
#                             .join(Camera)\
#                             .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
#                             .filter(Cluster.task_id==task.id)\
#                             .filter(Cluster.notes!=None)\
#                             .filter(Cluster.notes!='')\
#                             .distinct().all()
#         for cluster in clusters:
#             newClusters = db.session.query(Cluster)\
#                             .join(Image,Cluster.images)\
#                             .filter(Cluster.task_id==task.id)\
#                             .filter(Cluster.id>highest_id)\
#                             .filter(Image.id.in_([r.id for r in cluster.images]))\
#                             .distinct().all()
#             for newCluster in newClusters:
#                 if not newCluster.notes: newCluster.notes = ''
#                 newCluster.notes += cluster.notes

#         # copy tags across to new clusters
#         clusters = db.session.query(Cluster)\
#                             .join(Image,Cluster.images)\
#                             .join(Camera)\
#                             .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
#                             .filter(Cluster.task_id==task.id)\
#                             .filter(Cluster.tags.any())\
#                             .distinct().all()
#         for cluster in clusters:
#             newClusters = db.session.query(Cluster)\
#                             .join(Image,Cluster.images)\
#                             .filter(Cluster.task_id==task.id)\
#                             .filter(Cluster.id>highest_id)\
#                             .filter(Image.id.in_([r.id for r in cluster.images]))\
#                             .distinct().all()
#             for newCluster in newClusters:
#                 for tag in cluster.tags:
#                     if tag not in newCluster.tags:
#                         newCluster.tags.append(tag)

#         # Remove auto-classifications as these may have changed
#         # We are removing all auto-classifications because everything will be re-classified
#         labelgroups = db.session.query(Labelgroup)\
#                         .join(Detection)\
#                         .join(Image)\
#                         .join(Cluster,Image.clusters)\
#                         .filter(Labelgroup.task_id==task.id)\
#                         .filter(Labelgroup.labels.any())\
#                         .filter(Cluster.task_id==task.id)\
#                         .filter(Cluster.user==admin).all()
#         for labelgroup in labelgroups:
#             labelgroup.labels = []

#         # Remove labels from split clusters
#         # There is no reliable way to know what images were viewed and labelled
#         # Need to use sq2 to be able to include all labelgroups from the affected clusters
#         # Need to include labelgroup.checked because checked labelgroups are probbably right
#         sq = db.session.query(Cluster.id,func.count(distinct(Image.camera_id)).label('count')).join(Image,Cluster.images).filter(Cluster.task==task).filter(Cluster.id<=highest_id).filter(Cluster.labels.any()).group_by(Cluster.id).subquery()
#         sq2 = db.session.query(Cluster.id).join(Image,Cluster.images).filter(Image.camera_id.in_(camera_ids)).filter(Cluster.id<=highest_id).filter(Cluster.labels.any()).subquery()
#         labelgroups = db.session.query(Labelgroup)\
#                         .join(Detection)\
#                         .join(Image)\
#                         .join(Camera)\
#                         .join(Cluster,Image.clusters)\
#                         .join(sq,sq.c.id==Cluster.id)\
#                         .join(sq2,sq2.c.id==Cluster.id)\
#                         .filter(Labelgroup.task==task)\
#                         .filter(Labelgroup.labels.any())\
#                         .filter(Labelgroup.checked==False)\
#                         .filter(Cluster.task==task)\
#                         .filter(Cluster.id<=highest_id)\
#                         .filter(Cluster.labels.any())\
#                         .filter(sq.c.count>1)\
#                         .distinct().all()
#         for labelgroup in labelgroups:
#             labelgroup.labels = []

#         # Copy up labels from labelgroups & copy across cluster user IDs
#         clusters = db.session.query(Cluster)\
#                         .filter(Cluster.task_id==task.id)\
#                         .filter(Cluster.id>highest_id)\
#                         .distinct().all()
#         for cluster in clusters:
#             # Also update cluster-level classification at the same time
#             cluster.classification = classifyCluster(cluster)

#             labels = db.session.query(Label)\
#                             .join(Labelgroup, Label.labelgroups)\
#                             .join(Detection)\
#                             .join(Image)\
#                             .filter(Image.clusters.contains(cluster))\
#                             .filter(Labelgroup.task_id==task.id)\
#                             .filter(~Label.id.in_([GLOBALS.nothing_id,GLOBALS.unknown_id,GLOBALS.knocked_id]))\
#                             .distinct().all()

#             cluster.labels = labels

#             if labels:
#                 # Copy across user ID from old cluster
#                 oldCluster = db.session.query(Cluster)\
#                                 .join(Image,Cluster.images)\
#                                 .filter(Image.id.in_([r.id for r in cluster.images]))\
#                                 .filter(Cluster.task_id==task.id)\
#                                 .filter(Cluster.user_id!=admin.id)\
#                                 .filter(Cluster.user_id!=None)\
#                                 .filter(Cluster.id<=highest_id)\
#                                 .first()

#                 if oldCluster: cluster.user_id = oldCluster.user_id

#                 # Copy down labelgroup labels if not checked
#                 labelgroups = db.session.query(Labelgroup)\
#                                 .join(Detection)\
#                                 .join(Image)\
#                                 .filter(Image.clusters.contains(cluster))\
#                                 .filter(Labelgroup.task_id==task.id)\
#                                 .filter(Labelgroup.checked==False)\
#                                 .distinct().all()

#                 for labelgroup in labelgroups:
#                     labelgroup.labels = labels

#         # Remove old clusters
#         # with timestamps - these weren't reclustered
#         # ignore knockdowns - these weren't reclustered either
#         clusters = db.session.query(Cluster)\
#                             .join(Image,Cluster.images)\
#                             .join(Camera)\
#                             .filter(~Cluster.labels.contains(downLabel))\
#                             .filter(Camera.trapgroup_id.in_(trapgroup_ids))\
#                             .filter(Cluster.task_id==task.id)\
#                             .filter(Cluster.id<=highest_id)\
#                             .filter(Image.corrected_timestamp!=None)\
#                             .distinct().all()
#         for cluster in clusters:
#             cluster.labels = []
#             cluster.tags = []
#             cluster.images = []
#             cluster.required_images = []
#             db.session.delete(cluster)

#     db.session.commit()

#     return True

def reclusterAfterTimestampChange(survey_id,trapgroup_ids,cameragroup_ids):
    '''Reclusters all tasks for a specified survey after a timestamp correction, preserving all labels etc.'''

    # just adding the legacy _o_l_d_ for now - we are moving away from this though
    task_ids = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).filter(~Task.name.contains('_o_l_d_')).all()]
    for task_id in task_ids:
        # Remove labels from split clusters
        # There is no reliable way to know what images were viewed and labelled
        # Need to use sq2 to be able to include all labelgroups from the affected clusters
        # Need to include labelgroup.checked because checked labelgroups are probbably right
        sq = db.session.query(Cluster.id,func.count(distinct(Camera.cameragroup_id)).label('count')).join(Image,Cluster.images).join(Camera).filter(Cluster.task_id==task_id).filter(Cluster.labels.any()).group_by(Cluster.id).subquery()
        sq2 = db.session.query(Cluster.id).join(Image,Cluster.images).join(Camera).filter(Camera.cameragroup_id.in_(cameragroup_ids)).filter(Cluster.labels.any()).filter(Cluster.task_id==task_id).subquery()
        labelgroups = db.session.query(Labelgroup)\
                        .join(Detection)\
                        .join(Image)\
                        .join(Cluster,Image.clusters)\
                        .join(sq,sq.c.id==Cluster.id)\
                        .join(sq2,sq2.c.id==Cluster.id)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.checked==False)\
                        .filter(Cluster.task_id==task_id)\
                        .filter(Cluster.labels.any())\
                        .filter(sq.c.count>1)\
                        .distinct().all()
        for labelgroup in labelgroups:
            labelgroup.labels = []

        prepTask(task_id=task_id,trapgroup_ids=trapgroup_ids)

    db.session.commit()

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

def updateCoords(survey_id,coordData):
    '''Updates the survey's trapgroup coordinates.'''

    for item in coordData:
        # trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==item['tag']).first()
        trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.id==item['site_id']).first()
        if trapgroup:
            try:
                latitude = float(item['latitude'])
                if -180<=latitude<=180:
                    trapgroup.latitude = latitude
            except:
                pass

            try:
                longitude = float(item['longitude'])
                if -180<=longitude<=180:
                    trapgroup.longitude = longitude
            except:
                pass

            try:
                altitude = float(item['altitude'])
                if altitude>=0:
                    trapgroup.altitude = altitude
            except:
                pass

            db.session.commit()

    return True

def changeTimestamps(survey_id,timestamps):
    '''
        Shifts the camera timestamps of a specified survey. Re-clusters all tasks afterword.
    
        Parameters:
            survey_id (int): The survey to edit
            timestamps (dict): Timestamp changes formatted {cameragroup_id: {'original': timestamp, 'corrected': timestamp}}
    '''
    
    app.logger.info('changeTimestamps called for survey {} with timestamps {}'.format(survey_id,timestamps))
    cameragroup_ids = [int(r) for r in timestamps.keys() if (timestamps[r]['corrected']!=timestamps[r]['original'])]

    # To ensure indempotency around the overlap_prior, we need to reverse the timestamp change if it has already been implemented
    camera_times = {item[0]: item[1] for item in db.session.query(Cameragroup.id,func.min(Image.corrected_timestamp).label('min'))\
                                .join(Camera,Cameragroup.id==Camera.cameragroup_id)\
                                .join(Image)\
                                .join(Trapgroup)\
                                .filter(Image.corrected_timestamp!=None)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .group_by(Cameragroup.id)\
                                .all()}
    for cameragroup_id in cameragroup_ids:
        try:
            timestamp = datetime.strptime(timestamps[str(cameragroup_id)]['original'],"%Y/%m/%d %H:%M:%S")

            if camera_times[cameragroup_id]!=timestamp:
                images = db.session.query(Image)\
                                .join(Camera)\
                                .filter(Camera.cameragroup_id==cameragroup_id)\
                                .filter(Image.corrected_timestamp!=None)\
                                .order_by(Image.corrected_timestamp).all()

                if images:
                    delta = camera_times[cameragroup_id]-timestamp
                    if Config.DEBUGGING: app.logger.info('Delta of {} for camera {}'.format(delta,cameragroup_id))
                    for image in images:
                        image.corrected_timestamp = image.corrected_timestamp - delta
        except:
            # timestamp probably incorrectly formatted
            pass

    # Check if there is a need to recluster (ie. there are overlapping edited cameras)
    overlap_prior = []
    trapgroup_ids = [r.id for r in db.session.query(Trapgroup).join(Camera).filter(Camera.cameragroup_id.in_(cameragroup_ids)).distinct().all()]
    for trapgroup_id in trapgroup_ids:
        camera_times = db.session.query(Cameragroup.id,func.min(Image.corrected_timestamp).label('min'),func.max(Image.corrected_timestamp).label('max'))\
                                .join(Camera,Cameragroup.id==Camera.cameragroup_id)\
                                .join(Image)\
                                .filter(Image.corrected_timestamp!=None)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .group_by(Cameragroup.id)\
                                .all()

        camera_times2 = camera_times.copy()
        for cameragroup_id_1, cameragroup_start_1, cameragroup_end_1 in camera_times:
            if trapgroup_id in overlap_prior: break
            camera_times2.remove((cameragroup_id_1,cameragroup_start_1,cameragroup_end_1))
            for cameragroup_id_2, cameragroup_start_2, cameragroup_end_2 in camera_times2:
                if (cameragroup_start_1<=cameragroup_end_2<=cameragroup_end_1) or (cameragroup_start_1<=cameragroup_start_2<=cameragroup_end_1) or (cameragroup_start_2<=cameragroup_end_1<=cameragroup_end_2) or (cameragroup_start_2<=cameragroup_start_1<=cameragroup_end_2):
                    if (cameragroup_id_1 in cameragroup_ids) or (cameragroup_id_2 in cameragroup_ids):
                        if Config.DEBUGGING: app.logger.info('Trapgroup {} overlapping prior to edit'.format(trapgroup_id))
                        overlap_prior.append(trapgroup_id)
                        break

    # Update timestamps
    for cameragroup_id in cameragroup_ids:
        try:
            timestamp = datetime.strptime(timestamps[str(cameragroup_id)]['original'],"%Y/%m/%d %H:%M:%S")
            new_timestamp = datetime.strptime(timestamps[str(cameragroup_id)]['corrected'],"%Y/%m/%d %H:%M:%S")

            images = db.session.query(Image)\
                            .join(Camera)\
                            .filter(Camera.cameragroup_id==cameragroup_id)\
                            .filter(Image.corrected_timestamp!=None)\
                            .order_by(Image.corrected_timestamp).all()

            if images:            
                delta = new_timestamp-timestamp
                if Config.DEBUGGING: app.logger.info('Delta of {} for camera {}'.format(delta,cameragroup_id))
                for image in images:
                    image.corrected_timestamp = image.corrected_timestamp + delta
        except:
            # timestamp probably incorrectly formatted
            pass

    # Check if there is a need to recluster - no need to double check prior overlaps
    overlap_after = []
    for trapgroup_id in trapgroup_ids:
        camera_times = db.session.query(Cameragroup.id,func.min(Image.corrected_timestamp).label('min'),func.max(Image.corrected_timestamp).label('max'))\
                                .join(Camera,Cameragroup.id==Camera.cameragroup_id)\
                                .join(Image)\
                                .filter(Image.corrected_timestamp!=None)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .group_by(Cameragroup.id)\
                                .all()

        camera_times2 = camera_times.copy()
        for cameragroup_id_1, cameragroup_start_1, cameragroup_end_1 in camera_times:
            if trapgroup_id in overlap_prior: break
            camera_times2.remove((cameragroup_id_1,cameragroup_start_1,cameragroup_end_1))
            for cameragroup_id_2, cameragroup_start_2, cameragroup_end_2 in camera_times2:
                if (cameragroup_start_1<=cameragroup_end_2<=cameragroup_end_1) or (cameragroup_start_1<=cameragroup_start_2<=cameragroup_end_1) or (cameragroup_start_2<=cameragroup_end_1<=cameragroup_end_2) or (cameragroup_start_2<=cameragroup_start_1<=cameragroup_end_2):
                    if (cameragroup_id_1 in cameragroup_ids) or (cameragroup_id_2 in cameragroup_ids):
                        if Config.DEBUGGING: app.logger.info('Trapgroup {} overlapping prior to edit'.format(trapgroup_id))
                        overlap_after.append(trapgroup_id)
                        break

    # Recluster if overlaps (done in edit_survey)
    if Config.DEBUGGING: app.logger.info('Overlaps found: trapgroups-{} cameras-{}'.format(overlap_prior+overlap_after,cameragroup_ids))
    overlaps = list(set(overlap_prior+overlap_after))

    db.session.commit()
    
    return overlaps, cameragroup_ids

def re_classify_survey(survey_id,classifier_id):
    '''Re-classifies a survey using a specified classifier.'''
    
    survey = db.session.query(Survey).get(survey_id)
    survey.status='Classifying'
    # survey.images_processing = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
    db.session.commit()

    classifySurvey(survey_id=survey_id,sourceBucket=Config.BUCKET,classifier_id=classifier_id)

    survey = db.session.query(Survey).get(survey_id)
    # survey.images_processing = 0
    db.session.commit()

    for task in survey.tasks:
        translations = db.session.query(Translation).filter(Translation.task_id==task.id).all()

        for translation in translations:
            db.session.delete(translation)

    db.session.commit()

    return True

def edit_translations(task_id, translations, includes,auto=False):
    '''Handles the editing of translations for the given set of translations and specified task.'''

    for classification in translations:
        if translations[classification].lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
            species = db.session.query(Label).filter(Label.task_id==task_id).filter(func.lower(Label.description)==func.lower(translations[classification])).first()
        else:
            # if auto and translations[classification].lower() == 'nothing':
            #     species = db.session.query(Label).filter(Label.task_id==task_id).filter(func.lower(Label.description)==func.lower(classification)).first()
            #     if species:
            #         includes.append(classification)
            #         old_translation = db.session.query(Translation)\
            #                                 .join(Label,Translation.label_id==Label.id)\
            #                                 .filter(Translation.task_id==task_id)\
            #                                 .filter(Translation.classification==classification)\
            #                                 .filter(func.lower(Label.description)=='nothing')\
            #                                 .all()
            #         for translation in old_translation:
            #             db.session.delete(translation)
            #     else:
            #         species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(translations[classification])).first()
            # else:
            species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(translations[classification])).first()

        if species:
            translation = db.session.query(Translation)\
                                    .filter(Translation.task_id==task_id)\
                                    .filter(Translation.label_id==species.id)\
                                    .filter(Translation.classification==classification)\
                                    .first()
            
            if not translation:
                translation = Translation(classification=classification, label_id=species.id, task_id=task_id)
                db.session.add(translation)

            if classification.lower() in includes:
                translation.auto_classify = True

    # prepare lower level translations (exclude global labels)
    translations = db.session.query(Translation)\
                            .join(Label)\
                            .filter(Label.children.any())\
                            .filter(Label.task_id==task_id)\
                            .filter(Translation.task_id==int(task_id)).all()
    for translation in translations:
        check = db.session.query(Translation)\
                        .filter(Translation.label_id==translation.label_id)\
                        .filter(Translation.classification!=translation.classification)\
                        .first()
        if (check==None) and (not checkChildTranslations(translation.label)):
            for child in translation.label.children:
                createChildTranslations(translation.classification,int(task_id),child)    

    db.session.commit()
    return True

@celery.task(bind=True,max_retries=5)
def findTrapgroupTags(self,tgCode,folder,organisation_id,surveyName,camCode):
    '''Celery task that does the trapgroup code check. Returns the user message.'''

    try:
        reply = {}
        # isjpeg = re.compile('\.jpe?g$', re.I)

        try:
            tgCode = re.compile(tgCode)
            if camCode == 'None':
                camCode = None
            else:
                camCode = re.compile(camCode)

            if surveyName == '' or surveyName == 'None' or surveyName == 'null':
                surveyName = None

            allTags = []
            allCams = []
            structure = {}
            for dirpath, folders, filenames in s3traverse(Config.BUCKET, db.session.query(Organisation).get(organisation_id).folder+'/'+folder):
                # jpegs = list(filter(isjpeg.search, filenames))
                # if len(jpegs):

                if dirpath.find('_video_images_')!=-1:
                    dirpath = dirpath.split('/_video_images_')[0]

                if surveyName:
                    dirpath = dirpath.replace(surveyName+'/','')

                tags = tgCode.search(dirpath)
                if camCode:
                    if camCode != tgCode:
                        if tags:
                            dirpath = dirpath.replace(tags.group(),'')
                    cams = camCode.search(dirpath) 
                    if cams:
                        cams = [cams.group()]
                else:
                    cam_path = dirpath.split('/')[-1]
                    cams = [cam_path]
                if tags and cams:
                    tag = tags.group()
                    cam = cams[0]
                    if tag not in allTags:
                        allTags.append(tag)
                    if cam not in allCams:
                        allCams.append(cam)
                    if tag not in structure.keys():
                        structure[tag] = [cam]
                    else:
                        if cam not in structure[tag]:
                            structure[tag].append(cam)
                
            # reply = str(len(allTags)) + ' sites found: ' + ', '.join([str(tag) for tag in sorted(allTags)])
            #Format as Site1: Camera1 Camera2 , Site2: Camera1 Camera2
            reply = {}
            validStructure = True

            if len(allTags) == 0:
                validStructure = False

            if len(allCams) == 0:
                validStructure = False

            totalCams = 0
            for tag in structure.keys():
                if len(structure[tag]) == 0:
                    validStructure = False
                totalCams += len(structure[tag])

            if validStructure:
                # reply = 'Structure found: ' + str(len(allTags)) + ' sites, ' + str(totalCams) + ' cameras. <br>'
                # for tag in sorted(structure.keys()):
                #     reply += tag + ' : ' + ' , '.join([str(cam) for cam in sorted(structure[tag])]) + '<br>'
                reply['message'] = 'Structure found.'
                reply['structure'] = structure
                reply['nr_sites'] = len(allTags)
                reply['nr_cams'] = totalCams

            else:
                reply['message'] = 'Invalid structure. Please check your site and camera identifiers.'
                reply['structure'] = {}
                reply['nr_sites'] = 0
                reply['nr_cams'] = 0

        except:
            reply['message'] = 'Malformed expression. Please try again.'
            reply['structure'] = {}
            reply['nr_sites'] = 0
            reply['nr_cams'] = 0

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

def get_AWS_costs(startDate,endDate):
    '''Returns the AWS cost stats for the specied period in USD.'''
    
    costExplorer = boto3.client('ce')
    timePeriod = {'Start': startDate.strftime("%Y-%m-%d"), 'End': endDate.strftime("%Y-%m-%d")}
    services = [
        'Amazon Elastic Compute Cloud - Compute', 
        'EC2 - Other', 
        'Amazon Simple Storage Service', 
        'Amazon Relational Database Service', 
        'Amazon Textract', 
        'AWS Lambda',
        'Total'
    ]

    region_filter = {
        'Dimensions': {
            'Key': 'REGION',
            'Values': [Config.AWS_REGION]
        }
    }

    service_filter = {
        'And': [
            {'Dimensions': {
                'Key': 'SERVICE',
                'Values': []
            }},
            region_filter
        ]
    }

    costs = {}
    for service in services:
        if service=='Total':
            filter = region_filter
        else:
            filter = service_filter
            filter['And'][0]['Dimensions']['Values']=[service]
        
        costs[service] = round(float(costExplorer.get_cost_and_usage(
            TimePeriod=timePeriod,
            Granularity='MONTHLY',
            Filter = filter,
            Metrics=['UnblendedCost']
        )['ResultsByTime'][0]['Total']['UnblendedCost']['Amount'])*Config.VAT,2)


    costs['Amazon Elastic Compute Cloud'] = round(costs['Amazon Elastic Compute Cloud - Compute'] + costs['EC2 - Other'],2)
    del costs['Amazon Elastic Compute Cloud - Compute']
    del costs['EC2 - Other']

    costs['Other'] = round(costs['Total']-sum([value for key,value in costs.items() if key!='Total']),2)

    return costs

@celery.task(bind=True,max_retries=5,ignore_result=True)
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
                                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                .filter(User.email!=None).count()

            statistic.unique_daily_admin_logins = db.session.query(User)\
                                                .filter(User.last_ping>(datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(days=1)))\
                                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                .filter(User.admin==True).count()
            
            statistic.unique_daily_organisation_logins = db.session.query(Organisation)\
                                                .join(UserPermissions)\
                                                .join(User,UserPermissions.user_id==User.id)\
                                                .filter(User.last_ping>(datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)-timedelta(days=1)))\
                                                .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                .filter(UserPermissions.default!='worker')\
                                                .distinct().count()

            #Monthly stats
            if datetime.utcnow().day==1:
                organisations = db.session.query(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).distinct().all()
                users = db.session.query(User).filter(~User.username.in_(Config.ADMIN_USERS)).filter(User.admin==True).distinct().all()
                image_count=int(db.session.query(func.sum(Survey.image_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])
                video_count=int(db.session.query(func.sum(Survey.video_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])
                frame_count=int(db.session.query(func.sum(Survey.frame_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])

                sq = db.session.query(Organisation.id.label('organisation_id'),func.sum(Survey.image_count).label('image_count'),func.sum(Survey.frame_count).label('frame_count')).join(Survey).group_by(Organisation.id).subquery()
                active_organisation_count = db.session.query(Organisation)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .join(sq,sq.c.organisation_id==Organisation.id)\
                                        .filter(Task.init_complete==True)\
                                        .filter((sq.c.image_count+sq.c.frame_count)>10000)\
                                        .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                        .distinct().count()

                # AWS Costs
                startDate = (datetime.utcnow().replace(day=1)-timedelta(days=10)).replace(day=1,hour=0,minute=0,second=0,microsecond=0)
                endDate = datetime.utcnow().replace(day=1)
                costs = get_AWS_costs(startDate,endDate)

                # Average daily logins (need the plus 1 hour here so as to not include the last day of the previous month)
                try:
                    average_daily_logins, average_daily_admin_logins, average_daily_organisation_logins = db.session.query(\
                                        func.sum(Statistic.unique_daily_logins)/func.count(Statistic.id),\
                                        func.sum(Statistic.unique_daily_admin_logins)/func.count(Statistic.id),\
                                        func.sum(Statistic.unique_daily_organisation_logins)/func.count(Statistic.id))\
                                        .filter(Statistic.timestamp>(startDate+timedelta(hours=1))).first()
                    average_daily_logins = round(float(average_daily_logins),2)
                    average_daily_admin_logins = round(float(average_daily_admin_logins),2)
                    average_daily_organisation_logins = round(float(average_daily_organisation_logins),2)
                except:
                    average_daily_logins = 0
                    average_daily_admin_logins = 0
                    average_daily_organisation_logins = 0

                # Unique monthly logins
                unique_monthly_logins = db.session.query(User)\
                                                    .filter(User.last_ping>startDate)\
                                                    .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                    .filter(User.email!=None).count()
                unique_monthly_admin_logins = db.session.query(User)\
                                                    .filter(User.last_ping>startDate)\
                                                    .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                    .filter(User.admin==True).count()
                unique_monthly_organisation_logins = db.session.query(Organisation)\
                                                    .join(UserPermissions)\
                                                    .join(User,UserPermissions.user_id==User.id)\
                                                    .filter(User.last_ping>startDate)\
                                                    .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                                    .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                    .filter(UserPermissions.default!='worker').count()

                # Update DB object
                statistic.user_count=len(users),
                statistic.organisation_count = len(organisations)
                statistic.active_organisation_count=active_organisation_count,
                statistic.image_count=image_count,
                statistic.video_count=video_count,
                statistic.frame_count=frame_count,
                statistic.server_cost=costs['Amazon Elastic Compute Cloud'],
                statistic.storage_cost=costs['Amazon Simple Storage Service'],
                statistic.db_cost=costs['Amazon Relational Database Service'],
                statistic.textract_cost=costs['Amazon Textract'],
                statistic.lambda_cost=costs['AWS Lambda'],
                statistic.other_cost=costs['Other'],
                statistic.total_cost=costs['Total']
                statistic.average_daily_logins = average_daily_logins
                statistic.average_daily_admin_logins = average_daily_admin_logins
                statistic.average_daily_organisation_logins = average_daily_organisation_logins
                statistic.unique_monthly_logins = unique_monthly_logins
                statistic.unique_monthly_admin_logins = unique_monthly_admin_logins
                statistic.unique_monthly_organisation_logins = unique_monthly_organisation_logins

                # Update organisation image counts
                data = db.session.query(Organisation,func.sum(Survey.image_count),func.sum(Survey.video_count),func.sum(Survey.frame_count)).join(Survey).group_by(Organisation.id).all()
                for item in data:
                    organisation = item[0]
                    image_count = int(item[1])
                    video_count = int(item[2])
                    frame_count = int(item[3])
                    organisation.previous_image_count = organisation.image_count
                    organisation.image_count = image_count
                    organisation.previous_video_count = organisation.video_count
                    organisation.video_count = video_count
                    organisation.previous_frame_count = organisation.frame_count
                    organisation.frame_count = frame_count                    

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
def delete_individuals(self,task_ids, species):
    ''' Deletes all individuals of the specified species in the specified tasks. '''
    try:
        app.logger.info('Deleting individuals of species {} in tasks {}'.format(species,task_ids))

        task_ids = [int(r) for r in task_ids]
        if species and species[0] == '0':
            species = [r[0] for r in db.session.query(Individual.species).join(Task, Individual.tasks).filter(Task.id.in_(task_ids)).distinct().all()]
            app.logger.info('Species to delete: {}'.format(species))

        # Get detections
        detections = [r[0] for r in db.session.query(Detection.id)\
                                        .join(Image)\
                                        .join(Camera)\
                                        .join(Trapgroup)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .join(Individual, Detection.individuals)\
                                        .filter(Task.id.in_(task_ids))\
                                        .filter(Individual.species.in_(species))\
                                        .distinct().all()]


        # Delete Individuals
        individuals = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.species.in_(species))\
                                .filter(Task.id.in_(task_ids))\
                                .all()

        for individual in individuals:
            individual.detections = [detection for detection in individual.detections if detection.id not in detections]
            if len(individual.detections)==0:
                individual.detections = []
                individual.children = []
                individual.tags = []
                individual.tasks = []
                # Delete Individual Similarities
                indSims = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
                for indSim in indSims:
                    db.session.delete(indSim)
                db.session.delete(individual)
            else:
                individual.tasks = [task for task in individual.tasks if task.id not in task_ids]
                individual.tags = [tag for tag in individual.tags if tag.task_id not in task_ids]


        # Delete Detection similarities (where detections from sims are no longer associated with individuals)
        det1 = alias(Detection)
        det2 = alias(Detection)
        indDets1 = alias(individualDetections)
        indDets2 = alias(individualDetections)

        detSims = db.session.query(DetSimilarity)\
                            .join(det1,det1.c.id==DetSimilarity.detection_1)\
                            .join(det2,det2.c.id==DetSimilarity.detection_2)\
                            .outerjoin(indDets1, indDets1.c.detection_id==det1.c.id)\
                            .outerjoin(indDets2, indDets2.c.detection_id==det2.c.id)\
                            .filter(indDets1.c.detection_id==None)\
                            .filter(indDets2.c.detection_id==None)\
                            .filter(det1.c.id.in_(detections))\
                            .filter(det2.c.id.in_(detections))\
                            .distinct().all()

        for detSim in detSims:
            db.session.delete(detSim)

        # Delete featurematches from WBIA db for detections that are no longer associated with individuals
        # wbia_detections = db.session.query(Detection).outerjoin(individualDetections).filter(Detection.id.in_(detections)).filter(individualDetections.c.detection_id==None).filter(Detection.aid!=None).distinct().all()
        # aid_list = []
        # for detection in wbia_detections:
        #     if detection.aid: aid_list.append(detection.aid)
        #     detection.aid = None

        # keep_aid_list = [r[0] for r in db.session.query(Detection.aid, func.count(Detection.id))\
        #             .filter(Detection.aid.in_(aid_list))\
        #             .group_by(Detection.aid)\
        #             .distinct().all() if r[1]>0]
        # aid_list = list(set(aid_list) - set(keep_aid_list))
        # if aid_list:
        #     if not GLOBALS.ibs:
        #         from wbia import opendb
        #         GLOBALS.ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR+'_'+Config.WORKER_NAME,allow_newdir=True)
        #     GLOBALS.ibs.db.delete('featurematches', aid_list, 'annot_rowid1')
        #     GLOBALS.ibs.db.delete('featurematches', aid_list, 'annot_rowid2')
        #     gids = [g for g in GLOBALS.ibs.get_annot_gids(aid_list) if g is not None]
        #     GLOBALS.ibs.delete_images(gids)
        #     GLOBALS.ibs.delete_annots(aid_list)  

        db.session.commit()
                
        # Update statuses
        for task_id in task_ids:
            updateAllStatuses(task_id=task_id)
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

def recluster_after_image_timestamp_change(survey_id,image_timestamps):
    '''
    An efficient way to do re-clustering after image timestamp editing
    image_timestamps = {image_id:{'timestamp':timestamp,'format':format}}
    timestamps = {image_id:timestamp}
    survey_id
    '''

    app.logger.info('Image timestamp edit and recluster for survey {} with image_timestamps {}'.format(survey_id,image_timestamps))

    tasks = db.session.query(Task).filter(Task.survey_id==survey_id).filter(~Task.name.contains('_o_l_d_')).all()
    admin = db.session.query(User).filter(User.username=='Admin').first()
    trapgroup_ids = []	
    images = {}
    trapgroups = {}
    videos = {}
    timestamps = {}
    data = db.session.query(Image,Camera.trapgroup_id,Video.id,Video.still_rate).join(Camera,Image.camera_id==Camera.id).outerjoin(Video,Camera.videos).filter(Image.id.in_(list(image_timestamps.keys()))).distinct().all()
    # Get all the images and their new timestamps (including all frames in videos)
    for item in data:
        try:
            if image_timestamps[str(item[0].id)]['timestamp'] != '':
                new_timestamp = datetime.strptime(image_timestamps[str(item[0].id)]['timestamp'],image_timestamps[str(item[0].id)]['format'])
            else:
                new_timestamp = None
            if item[2] != None:
                index = int(item[0].filename.split('frame')[1][:-4])
                fps = item[3]
                frames = db.session.query(Image).join(Camera).join(Video).filter(Video.id==item[2]).order_by(Image.id).all()
                video_timestamp = None
                if new_timestamp: video_timestamp = new_timestamp - timedelta(seconds=index/fps) 
                for frame in frames:
                    frame_count = int(frame.filename.split('frame')[1][:-4])
                    frame_timestamp = video_timestamp + timedelta(seconds=frame_count/fps) if video_timestamp else None
                    timestamps[frame.id] = frame_timestamp
                    images[frame.id] = frame
                    trapgroups[frame.id] = item[1]
                    videos[frame.id] = item[2]
            else:
                timestamps[item[0].id] = new_timestamp
                images[item[0].id] = item[0]
                trapgroups[item[0].id] = item[1]
                videos[item[0].id] = None
        except:
            # Timestamp probably incorrectly formatted
            pass

    image_ids = list(timestamps.keys())
    if image_ids:
        cluster_movement = {}
        old_clusters = {}
        checked = {}
        for task in tasks:
            old_clusters[task.id] = {}
            checked[task.id] = {}
            cluster_movement[task.id] = {}
    
        data = db.session.query(Image.id,Cluster,Cluster.task_id).join(Cluster,Image.clusters).filter(Image.id.in_(image_ids)).distinct().all()
        for item in data:
            old_clusters[item[2]][item[0]] = item[1]

        data = rDets(db.session.query(Image.id,Label,Labelgroup.task_id)\
                            .join(Detection,Image.detections)\
                            .join(Labelgroup)\
                            .join(Label,Labelgroup.labels)\
                            .filter(Labelgroup.checked==True)\
                            .filter(Image.id.in_(image_ids)))\
                            .distinct().all()

        for item in data:
            if item[0] not in checked[item[2]].keys(): checked[item[2]][item[0]] = []
            checked[item[2]][item[0]].append(item[1])

        for image_id in timestamps:
            image = images[image_id]
            trapgroup_id = trapgroups[image_id]
            
            for task in tasks:
                old_cluster = old_clusters[task.id][image_id]
                if old_cluster not in cluster_movement[task.id].keys(): cluster_movement[task.id][old_cluster] = []

                if timestamps[image_id] == None:
                    if image_id in videos.keys() and videos[image_id] != None:
                        video_id = videos[image_id]
                        # Get all the image keys in the videos dict where the value is the video_id
                        video_image_ids = [k for k,v in videos.items() if v==video_id]
                        candidate_clusters = db.session.query(Cluster)\
                                                .join(Image,Cluster.images)\
                                                .join(Camera)\
                                                .filter(Cluster.task==task)\
                                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                                .filter(Image.id.in_(video_image_ids))\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Cluster.id!=old_cluster.id)\
                                                .distinct().all()
                    else:
                        candidate_clusters = None
                else: 
                    candidate_clusters = db.session.query(Cluster)\
                                                .join(Image,Cluster.images)\
                                                .join(Camera)\
                                                .filter(Cluster.task==task)\
                                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                                .filter(Image.corrected_timestamp<=timestamps[image_id]+timedelta(seconds=60))\
                                                .filter(Image.corrected_timestamp>=timestamps[image_id]-timedelta(seconds=60))\
                                                .distinct().all()

                # This needs to be here in case the old_cluster is in the candidate_clusters
                if image in old_cluster.images: old_cluster.images.remove(image)

                if candidate_clusters:
                    newCluster = candidate_clusters[0]
                    if image not in newCluster.images: newCluster.images.append(image)

                    # If the cluster was AI annotated - drop labels
                    if newCluster.user == admin:
                        newCluster.labels = []
                        newCluster.user_id = None

                    # Combine all candidate clusters into new cluster (will be reclustered if too large later)
                    for cluster in candidate_clusters[1:]:
                        # Move images across
                        for img in cluster.images:
                            if img not in newCluster.images:
                                newCluster.images.append(img)
                        cluster.images = []

                        # Copy notes
                        if not newCluster.notes: newCluster.notes = ''
                        if cluster.notes: newCluster.notes += cluster.notes

                        # Copy tags
                        for tag in cluster.tags:
                            if tag not in newCluster.tags:
                                newCluster.tags.append(tag)

                        # Copy labels (don't copy AI labels)
                        if cluster.user != admin:
                            for label in cluster.labels:
                                if label not in newCluster.labels:
                                    newCluster.labels.append(label)
                        
                            # Pass through user
                            if (not newCluster.user) and cluster.user:
                                newCluster.user = cluster.user

                else:
                    # Create new cluster
                    newCluster = Cluster(task=task)
                    db.session.add(newCluster)
                    newCluster.images = [image]

                if newCluster not in cluster_movement[task.id][old_cluster]:
                    cluster_movement[task.id][old_cluster].append(newCluster)

                # Pass through checked labels
                if image_id in checked[task.id].keys():
                    for label in checked[task.id][image_id]:
                        if label not in newCluster.labels:
                            newCluster.labels.append(label)

                # handle labelgroups
                labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(newCluster)).filter(Labelgroup.task==task).distinct().all()
                for labelgroup in labelgroups:
                    if not labelgroup.checked:
                        labelgroup.labels = newCluster.labels

                # Update new clusters classification
                newCluster.classification = classifyCluster(newCluster)

            # Update image timestamp
            image.corrected_timestamp = timestamps[image_id]
            image.skipped = False if timestamps[image_id] else True
            trapgroup_ids.append(trapgroup_id)

        for task in tasks:
            # Go through all the old clusters and see if they split up - if so, we need to drop the labels because we don't know what images were viewed
            for old_cluster in cluster_movement[task.id]:

                if old_cluster.user==admin:
                    # if AI labelled - drop labels as the contents have changed
                    old_cluster.labels = []
                    old_cluster.user_id = None

                elif old_cluster.images:
                    # cluster has been split up - drop labels
                    old_cluster.labels = []
                    old_cluster.user_id = None

                elif len(cluster_movement[task.id][old_cluster]) == 1:
                    # single destination -> not split -> copy across labels
                    newCluster = cluster_movement[task.id][old_cluster][0]
                    
                    for label in old_cluster.labels:
                        if label not in newCluster.labels:
                            newCluster.labels.append(label)
                    
                    for tag in old_cluster.tags:
                        if tag not in newCluster.tags:
                            newCluster.tags.append(tag)

                    # Copy notes
                    if not newCluster.notes: newCluster.notes = ''
                    if old_cluster.notes: newCluster.notes += old_cluster.notes
                
                else:
                    #split up
                    old_cluster.labels = []
                    old_cluster.user_id = None
                
                if old_cluster.images:
                    # Check timing of images
                    groups = []
                    old_images = db.session.query(Image).filter(Image.clusters.contains(old_cluster)).order_by(Image.corrected_timestamp).all()
                    prev = old_images[0].corrected_timestamp
                    group = [old_images[0]]
                    for image in old_images[1:]:
                        if image.corrected_timestamp == None:
                            if prev != None:
                                groups.append(group)
                                group = []
                        else:
                            if prev == None or image.corrected_timestamp-prev > timedelta(seconds=60):
                                groups.append(group)
                                group = []
                        group.append(image)
                        prev = image.corrected_timestamp
                    groups.append(group)

                    old_cluster_user_id = old_cluster.user_id
                    if len(groups)>1:
                        temp_clusters = []
                        old_cluster.labels = []
                        old_cluster.user_id = None
                        old_cluster.images = []
                        for group in groups:
                            newCluster = Cluster(task=task)
                            db.session.add(newCluster)
                            newCluster.images = group
                            temp_clusters.append(newCluster)
                    else:
                        temp_clusters = [old_cluster]

                    for temp_cluster in temp_clusters:
                        # handle labelgroups - first check for checked labels
                        final_labels = temp_cluster.labels
                        labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(temp_cluster)).filter(Labelgroup.task==task).distinct().all()
                        for labelgroup in labelgroups:
                            if labelgroup.checked:
                                for label in labelgroup.labels:
                                    if label not in final_labels:
                                        final_labels.append(label)

                        # Copy the finalised labels through to the luster
                        temp_cluster.labels = final_labels
                        if not final_labels:
                            temp_cluster.user_id = None
                        else:
                            temp_cluster.user_id = old_cluster_user_id

                        for labelgroup in labelgroups:
                            if not labelgroup.checked: labelgroup.labels = final_labels

                        temp_cluster.classification = classifyCluster(temp_cluster)

            # delete any empty clusters that remain
            empty_clusters = db.session.query(Cluster).filter(Cluster.task==task).filter(~Cluster.images.any()).distinct().all()
            for cluster in empty_clusters:
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

        # commit changes
        db.session.commit()
            
        # Return trapgroups for wrap up (done in edit_survey)
        trapgroup_ids = list(set(trapgroup_ids))

    return trapgroup_ids


@celery.task(bind=True,max_retries=5,ignore_result=True)
def edit_survey(self,survey_id,user_id,classifier_id,sky_masked,ignore_small_detections,masks,staticgroups,timestamps,image_timestamps,coord_data,kml_file):
    '''Celery task that handles the editing of a survey.'''
    try:
        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Processing'
        db.session.commit()

        # Coordinates
        if coord_data:
            updateCoords(survey_id=survey_id,coordData=coord_data)

        # KML
        if kml_file:
            importKML(survey_id)

        # Static groups
        if staticgroups:
            update_staticgroups(survey_id=survey_id,staticgroups=staticgroups,user_id=user_id)

        # Ignore small detections & Mask sky
        edge = False
        survey = db.session.query(Survey).get(survey_id)
        if ignore_small_detections==False and sky_masked==False:
            if survey.ignore_small_detections==True and survey.sky_masked==True:
                edge = True

        if ignore_small_detections != None:
            if ignore_small_detections != survey.ignore_small_detections:
                hideSmallDetections(survey_id=survey_id,ignore_small_detections=ignore_small_detections,edge=edge)
                
        if sky_masked != None:
            if sky_masked != survey.sky_masked:
                maskSky(survey_id=survey_id,sky_masked=sky_masked,edge=edge)

        # Masks
        if masks:
            update_masks(survey_id=survey_id,removed_masks=masks['removed'],added_masks=masks['added'],edited_masks=masks['edited'],user_id=user_id)

        # Check detections
        if masks or ignore_small_detections!=None or sky_masked!=None:
            check_masked_and_hidden_detections(survey_id=survey_id)

        # Classify survey
        if classifier_id:
            classifier_id = int(classifier_id)
            survey = db.session.query(Survey).get(survey_id)
            if survey.classifier_id != classifier_id:
                re_classify_survey(survey_id=survey_id,classifier_id=classifier_id)

        # File Timestamps
        trapgroup_ids = []
        if image_timestamps:
            trapgroup_ids = recluster_after_image_timestamp_change(survey_id=survey_id,image_timestamps=image_timestamps)

        # Camera timestamps
        if timestamps:
            overlaps,cameragroup_ids = changeTimestamps(survey_id=survey_id,timestamps=timestamps)
            if overlaps and cameragroup_ids:
                reclusterAfterTimestampChange(survey_id=survey_id,trapgroup_ids=overlaps,cameragroup_ids=cameragroup_ids)

        # Update All statuses
        task_ids = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).filter(Task.name!='default').distinct().all()]
        for task_id in task_ids:
            updateAllStatuses(task_id=task_id)

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Ready'
        db.session.commit()
        app.logger.info('Finished editing survey {}'.format(survey_id))
        GLOBALS.redisClient.delete('edit_survey_{}'.format(survey_id))

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

def check_masked_and_hidden_detections(survey_id):
    ''' Checks for any detections that have been made active that should be hidden/masked.'''

    survey = db.session.query(Survey).get(survey_id)

    # Masked detections
    polygon = func.ST_GeomFromText(func.concat('POLYGON((',
                        Detection.left, ' ', Detection.top, ', ',
                        Detection.left, ' ', Detection.bottom, ', ',
                        Detection.right, ' ', Detection.bottom, ', ',
                        Detection.right, ' ', Detection.top, ', ',
                        Detection.left, ' ', Detection.top, '))'), 32734)

    masked_detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Cameragroup)\
                            .join(Trapgroup)\
                            .join(Mask)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(Detection.source!='user')\
                            .filter(func.ST_Contains(Mask.shape, polygon))\
                            .distinct().all()
    
    images = []
    for detection in masked_detections:
        detection.status = 'masked'
        images.append(detection.image)


    # Sky detections
    if survey.sky_masked:
        sky_detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(Detection.static == False) \
                            .filter(Detection.bottom<Config.SKY_CONST)\
                            .distinct().all()

        for detection in sky_detections:
            detection.status = 'hidden'
            images.append(detection.image)


    # Small detections
    if survey.ignore_small_detections:
        small_detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(Detection.static == False) \
                            .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) < Config.SMALL_DET_AREA)\
                            .distinct().all()

        for detection in small_detections:
            detection.status = 'hidden'
            images.append(detection.image)

    db.session.commit()

    for image in set(images):
        image.detection_rating = detection_rating(image)
    db.session.commit()

    return True
