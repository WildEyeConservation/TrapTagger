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
from app.functions.globals import retryTime, checkForIdWork, taggingLevelSQ, updateAllStatuses, rDets
from app.functions.annotation import launch_task
from app.functions.individualID import calculate_detection_similarities
from app.functions.admin import edit_survey
import GLOBALS
from sqlalchemy.sql import func, distinct, or_, alias, and_
from sqlalchemy import desc
from datetime import datetime, timedelta
from config import Config
import traceback
import re
from celery.result import allow_join_result
import os 
import zipfile
import json

def check_restore_status(key,days=None):
    '''
    Check if a object has been restored or is in the process of being restored from Glacier Deep Archive.
    Returns a tuple of three values:
    - A boolean indicating whether an object is restored/available or requires restoration (True if restored/available, False if not)
    - A datetime object indicating the date restore request was made, if it is in the process of being restored
    - A boolean indicating whether a wait is required for the object to be restored
    
    '''
    try:
        response = GLOBALS.s3client.head_object(Bucket=Config.BUCKET, Key=key)
        if response.get('StorageClass') != 'DEEP_ARCHIVE':
            return True, None, False
        
        restore_info = response.get('Restore')
        if restore_info:
            if 'ongoing-request="true"' in restore_info:
                try:
                    restore_date = datetime.strptime(response['ResponseMetadata']['HTTPHeaders']['x-amz-restore-request-date'], '%a, %d %b %Y %H:%M:%S %Z')
                except:
                    restore_date = None
                return True, restore_date, True
            
            elif 'expiry-date' in restore_info:
                if days:
                    try:
                        expiry_string = restore_info.split('expiry-date="')[1].split('"')[0]
                        object_expiry_date = datetime.strptime(expiry_string, '%a, %d %b %Y %H:%M:%S %Z')
                        available_days = (object_expiry_date - datetime.utcnow()).days
                    except:
                        available_days = None
                    if available_days and available_days < days:
                        return False, None, False
                    
                return True, None, False
            
        return False, None, True
    except:
        return True, None, False

def binary_search_restored_objects(keys,days=None):
    '''Check progress of restore requests for a list of objects and return index of first object that is not restored.'''
    
    restore_date = None
    require_wait = False
    if not keys:
        return 0, restore_date, require_wait

    first, restore_date, require_wait = check_restore_status(keys[0],days)
    if not first:
        return 0, restore_date, require_wait
    
    check = check_restore_status(keys[-1],days)
    last = check[0]
    restore_date = check[1] if check[1] else restore_date
    require_wait = check[2] if check[2] else require_wait
    if last:
        return len(keys), restore_date, require_wait

    low = 1
    high = len(keys) - 2
        
    while low <= high:
        mid = (low + high) // 2
        check = check_restore_status(keys[mid],days)
        restore_date = check[1] if check[1] else restore_date
        require_wait = check[2] if check[2] else require_wait
        if check[0]:
            low = mid + 1
        else:
            high = mid - 1
    return low, restore_date, require_wait

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_empty_zips(self,task_id,tier):
    '''Restores zips from Glacier that contain empty images.'''
    
    try:
        task = db.session.query(Task).get(task_id)
        survey = task.survey
        zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
        
        restore_request = {
            'Days': Config.EMPTY_RESTORE_DAYS,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }

        zip_ids = [r[0] for r in db.session.query(Zip.id)\
                                            .join(Image)\
                                            .join(Detection)\
                                            .join(Labelgroup)\
                                            .filter(Labelgroup.task_id==task_id)\
                                            .filter(Labelgroup.checked==False)\
                                            .filter(Zip.survey_id==survey.id)\
                                            .distinct().all()]
        
        if zip_ids:
            zip_ids = sorted(zip_ids)
            zip_keys = [zip_folder + '/' + str(zip_id) + '.zip' for zip_id in zip_ids]
            restore_index, restore_date, require_wait = binary_search_restored_objects(zip_keys,Config.EMPTY_RESTORE_DAYS)
            zip_ids = zip_ids[restore_index:]

            restore_zip = False
            for zip_id in zip_ids:
                zip_key = zip_folder + '/' + str(zip_id) + '.zip'
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=zip_key, RestoreRequest=restore_request)
                    restore_zip = True
                except:
                    continue

            if restore_zip or restore_date:
                survey.empty_restore = datetime.utcnow() if restore_zip else restore_date
                if require_wait or restore_date:
                    survey.status = 'Restoring Files'
                    task.status = 'Ready'
                    launch_kwargs = {'task_id':task_id, 'tagging_level':task.tagging_level, 'zip_ids':zip_ids}
                    survey.require_launch = True
                    GLOBALS.redisClient.set('empty_launch_kwargs_'+str(survey.id),json.dumps(launch_kwargs))
                    db.session.commit()
                else:
                    db.session.commit()
                    extract_zips.apply_async(kwargs={'task_id':task_id, 'zip_ids':zip_ids})
            else:
                extract_zips.apply_async(kwargs={'task_id':task_id, 'zip_ids':zip_ids})
        else:
            survey.status = 'Ready'
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

@celery.task(bind=True,max_retries=2,ignore_result=True)
def extract_zips(self,task_id,zip_ids):
    '''Handles zips from Glacier that contain empty images.'''
    
    try:
        survey = db.session.query(Survey).join(Task).filter(Task.id==task_id).first()
        zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
        zip_keys = [zip_folder + '/' + str(zip_id) + '.zip' for zip_id in zip_ids]

        results = []
        for zip_key in zip_keys:
            results.append(extract_zip.apply_async(kwargs={'zip_key':zip_key},queue='parallel'))
            
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

        # Launch task
        launch_task.apply_async(kwargs={'task_id':task_id})

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

@celery.task(bind=True,max_retries=2)
def extract_zip(self,zip_key):
    '''Handles a zip from Glacier that contains empty images.'''
    
    try:
 
        app.logger.info('Handling zip {}'.format(zip_key))

        zip_path = zip_key.split('/')[-1]
        zip_id = zip_path.split('.')[0]
        try:
            GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=zip_key, Filename=zip_path)
        except:
            return True

        # Unzip & get all image ids from filenames
        image_ids = []  
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for filename in zip_ref.namelist():
                image_id = filename.split('.')[0]
                image_ids.append(image_id)


        image_data = db.session.query(Image.id, Image.filename, Camera.path)\
                        .join(Camera)\
                        .filter(Image.id.in_(image_ids))\
                        .filter(Image.zip_id==zip_id)\
                        .distinct().all()

        # Extract images from zip and upload to S3
        for image in image_data:
            image_id = image[0]
            image_path = image[2] + '/' + image[1]
            splits = image_path.split('/')
            splits[0] = splits[0] + '-comp'
            image_key = '/'.join(splits)
            image_fn = str(image_id) + '.jpg'
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extract(image_fn)
                GLOBALS.s3client.upload_file(Bucket=Config.BUCKET, Key=image_key, Filename=image_fn)
                os.remove(image_fn)

        # Remove zip
        os.remove(zip_path)


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

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_images_for_id(self,task_id,days,tier,extend=False):
    '''Restores images from Glacier for a specified species in the specified tasks.'''
    
    try:
        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level
        tL = re.split(',',taggingLevel)
        species = tL[1]
        task_ids = [task_id]
        for sub_task in task.sub_tasks:
            task_ids.append(sub_task.id)
        
        algorithm = None
        if '-5' in taggingLevel and len(task_ids) > 1:
            if tL[4]=='h':
                algorithm = 'hotspotter'
            elif tL[4]=='n':
                algorithm = 'none'

        cluster_count = 0
        if '-4' in taggingLevel:
            sq = db.session.query(Cluster.id) \
                .join(Image, Cluster.images) \
                .join(Detection)
            
            sq = taggingLevelSQ(sq,taggingLevel,False,task_id)

            cluster_count = rDets(sq.filter(Cluster.task_id == task_id)).distinct().count()
        else:
            cluster_count = checkForIdWork(task_ids,species,'-1')

        if cluster_count > 0 or extend:
            app.logger.info('Restoring images for tasks {} for {} days '.format(task_ids,days))
            
            cluster_sq = rDets(db.session.query(Cluster.id)\
                        .join(Image,Cluster.images)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .join(Label,Labelgroup.labels)\
                        .filter(Cluster.task_id.in_(task_ids))\
                        .filter(Label.description==species)\
                        .filter(Labelgroup.task_id.in_(task_ids))\
                        ).subquery()

            images = db.session.query(Image.filename, Camera.path)\
                            .join(Camera)\
                            .join(Cluster,Image.clusters)\
                            .join(cluster_sq,Cluster.id==cluster_sq.c.id)\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(cluster_sq.c.id!=None)\
                            .order_by(Image.id)\
                            .distinct().all()
        
            restore_request = {
                'Days': days,
                'GlacierJobParameters': {
                    'Tier': tier
                }
            }

            image_keys = [image[1] + '/' + image[0] for image in images]
            restore_index, restore_date, require_wait = binary_search_restored_objects(image_keys,days)
            image_keys = image_keys[restore_index:]

            restored_image = False
            for image_key in image_keys:
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                    restored_image = True
                except:
                    continue
            
            if extend:
                if restored_image:
                    task.survey.id_restore = datetime.utcnow()
                    db.session.commit()
            else:
                if restored_image or restore_date:
                    date_value = datetime.utcnow() if restored_image else restore_date
                    task.survey.id_restore = date_value
                    for sub_task in task.sub_tasks:
                        sub_task.survey.id_restore = date_value

                    if require_wait or restore_date:
                        task.survey.status = 'Restoring Files'
                        task.status = 'Ready'
                        for sub_task in task.sub_tasks:
                            sub_task.status = 'Ready'
                            sub_task.survey.status = 'Restoring Files'

                        if algorithm:
                            launch_kwargs = {'task_ids':task_ids,'species':species,'algorithm':algorithm, 'tagging_level':taggingLevel, 'task_id':task_id}
                        else:
                            launch_kwargs = {'task_id':task_id, 'tagging_level':taggingLevel}

                        task.survey.require_launch = True
                        GLOBALS.redisClient.set('id_launch_kwargs_'+str(task.survey.id),json.dumps(launch_kwargs))

                        db.session.commit()
                    else:
                        db.session.commit()
                        if algorithm:
                            calculate_detection_similarities.apply_async(kwargs={'task_ids':task_ids,'species':species,'algorithm':algorithm})
                        else:
                            launch_task.apply_async(kwargs={'task_id':task_id})
                else:
                    if algorithm:
                        calculate_detection_similarities.apply_async(kwargs={'task_ids':task_ids,'species':species,'algorithm':algorithm})
                    else:
                        launch_task.apply_async(kwargs={'task_id':task_id})
        else:
            updateAllStatuses(task_id=task_id)
            task = db.session.query(Task).get(task_id)
            task.status = 'SUCCESS'
            task.survey.status = 'Ready'
            for tsk in task.sub_tasks:
                tsk.status = 'SUCCESS'
                tsk.survey.status = 'Ready'
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

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_images_for_classification(self,survey_id,days,edit_survey_args,tier):
    '''Restores images from Glacier for a specified survey.'''
    
    try:
        app.logger.info('Restoring images (classification) for survey {} for {} days '.format(survey_id,days))

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Processing'
        db.session.commit()

        images = db.session.query(Image.filename, Camera.path)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Detection)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .order_by(Image.id)\
                        .distinct().all()
        
        if images:
            image_keys = [image[1] + '/' + image[0] for image in images]
            restore_index, restore_date, require_wait = binary_search_restored_objects(image_keys,days)
            image_keys = image_keys[restore_index:]

            restore_request = {
                'Days': days,
                'GlacierJobParameters': {
                    'Tier': tier
                }
            }
            restored_image = False
            for image_key in image_keys:
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                    restored_image = True
                except:
                    continue
            
            if restored_image or restore_date:
                survey.edit_restore = datetime.utcnow() if restored_image else restore_date
                if require_wait or restore_date:
                    survey.status = 'Restoring Files'   
                    survey.require_launch = True
                    GLOBALS.redisClient.set('edit_launch_kwargs_'+str(survey.id),json.dumps(edit_survey_args))
                    db.session.commit()   
                else:
                    db.session.commit()
                    edit_survey.apply_async(kwargs=edit_survey_args)   
            else:
                edit_survey.apply_async(kwargs=edit_survey_args)
        else:
            edit_survey.apply_async(kwargs=edit_survey_args)

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

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_files_for_download(self,task_id,download_request_id,download_params,days,tier,extend=False):
    '''Restores files from Glacier for a specified task.'''
    try:
        task = db.session.query(Task).get(task_id)
        survey = task.survey
        species = download_params['species']
        include_empties = download_params['include_empties']
        include_frames = download_params['include_frames']
        include_video = download_params['include_video']
        raw_files = download_params['raw_files']

        if '0' in species:
            localLabels = [r.id for r in task.labels]
            localLabels.append(GLOBALS.vhl_id)
            localLabels.append(GLOBALS.knocked_id)
            localLabels.append(GLOBALS.unknown_id)
        else:
            localLabels = [int(r) for r in species]

        images = []
        if raw_files:
            if include_empties: 
                localLabels.append(GLOBALS.nothing_id)
                images = db.session.query(Image.filename, Camera.path)\
                                        .join(Camera)\
                                        .join(Detection)\
                                        .outerjoin(Labelgroup)\
                                        .outerjoin(Label,Labelgroup.labels)\
                                        .filter(or_(Labelgroup.task_id==task_id,Labelgroup.id==None))\
                                        .filter(or_(Label.id.in_(localLabels),Label.id==None))\
                                        .filter(Image.zip_id==None)

            else:
                images = db.session.query(Image.filename, Camera.path)\
                                    .join(Camera)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .join(Label,Labelgroup.labels)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(Label.id.in_(localLabels))\
                
            if include_frames:
                images = images.order_by(Image.id).distinct().all()
            else:
                images = images.outerjoin(Video)\
                                .filter(Video.id==None)\
                                .order_by(Image.id)\
                                .distinct().all()

        videos = []
        if include_video:
            videos = db.session.query(Video.filename, Camera.path)\
                                .join(Camera)\
                                .join(Image)\
                                .join(Detection)\
                                .join(Labelgroup)\
                                .join(Label,Labelgroup.labels)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(Label.id.in_(localLabels))\
                                .order_by(Video.id)\
                                .distinct().all()
            

        restore_request = {
            'Days': days,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }
        
        image_keys = [image[1] + '/' + image[0] for image in images]
        restore_index, restore_date_img, require_wait_img = binary_search_restored_objects(image_keys,days)
        image_keys = image_keys[restore_index:]

        restored_image = False
        for image_key in image_keys:
            try:
                GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                restored_image = True
            except:
                continue

        restored_video = False
        restore_date_vid = None
        require_wait_vid = False
        if include_video:
            video_keys = []
            for video in videos:
                pathSplit  = video[1].split('/',1)
                video_key = pathSplit[0] + '-comp/' + pathSplit[1].split('_video_images_')[0] + video[0].split('.')[0] + '.mp4'
                video_keys.append(video_key)

            restore_index, restore_date_vid, require_wait_vid = binary_search_restored_objects(video_keys,days)
            video_keys = video_keys[restore_index:]

            for video_key in video_keys:
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=video_key, RestoreRequest=restore_request)
                    restored_video = True
                except:
                    continue
        
        restored_zip = False
        restore_date_zip = None
        require_wait_zip = False
        if include_empties and not extend:
            if survey.zips:
                zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
                zip_ids = [zip.id for zip in survey.zips]
                zip_ids = sorted(zip_ids)
                zip_keys = [zip_folder + '/' + str(zip_id) + '.zip' for zip_id in zip_ids]
                restore_index, restore_date_zip, require_wait_zip = binary_search_restored_objects(zip_keys,Config.EMPTY_RESTORE_DAYS)
                zip_keys = zip_keys[restore_index:]

                zip_restore_request = {
                    'Days': Config.EMPTY_RESTORE_DAYS,
                    'GlacierJobParameters': {
                        'Tier': tier
                    }
                }

                for zip_key in zip_keys:
                    try:
                        GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=zip_key, RestoreRequest=zip_restore_request)
                        restored_zip = True
                    except:
                        continue
        
        restored_files = any([restored_image,restored_video,restored_zip])
        restore_dates = [date for date in [restore_date_img,restore_date_vid,restore_date_zip] if date]
        restore_date = max(restore_dates) if restore_dates else None
        require_wait = any([require_wait_img,require_wait_vid,require_wait_zip])
        if extend:
            if restored_files:
                survey.download_restore = datetime.utcnow()
                db.session.commit()
        else:
            if restored_files or restore_date:
                date_now = datetime.now() if restored_files else restore_date
                survey.download_restore = date_now
                if require_wait or restore_date:
                    survey.status = 'Restoring Files'

                    download_request = db.session.query(DownloadRequest).get(download_request_id)
                    download_request.status = 'Restoring Files'
                    download_request.timestamp = date_now

                    survey.require_launch = True
                    launch_kwargs = {'task_id':task_id,'download_request_id':download_request_id,'zips':restored_zip}
                    GLOBALS.redisClient.set('download_launch_kwargs_'+str(survey.id),json.dumps(launch_kwargs))

                    db.session.commit()
                else:
                    db.session.commit()
                    process_files_for_download.apply_async(kwargs={'task_id':task_id,'download_request_id':download_request_id,'zips':restored_zip})
                
            else:
                download_request = db.session.query(DownloadRequest).get(download_request_id)
                download_request.status = 'Available'
                download_request.timestamp = datetime.now()

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


@celery.task(bind=True,max_retries=2,ignore_result=True)
def process_files_for_download(self,task_id,download_request_id,zips):
    '''Processes files for download after they have been restored from Glacier.'''
    try:
        task = db.session.query(Task).get(task_id)
        survey = task.survey
        survey_id = survey.id

        if zips:
            zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
            zip_keys = [zip_folder + '/' + str(zip.id) + '.zip' for zip in survey.zips]

            results = []
            for zip_key in zip_keys:
                results.append(extract_zip.apply_async(kwargs={'zip_key':zip_key},queue='parallel'))
                
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

        download_request = db.session.query(DownloadRequest).get(download_request_id)
        download_request.status = 'Available'
        download_request.timestamp = datetime.now()

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
