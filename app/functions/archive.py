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
from app.functions.globals import retryTime, checkForIdWork, taggingLevelSQ, updateAllStatuses, rDets, calculate_restore_expiry_date, chunker
from app.functions.annotation import launch_task
from app.functions.individualID import calculate_detection_similarities
from app.functions.admin import edit_survey
from app.functions.results import generate_wildbook_export
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
from botocore.exceptions import ClientError

def check_restore_status(key):
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
                try:
                    expiry_string = restore_info.split('expiry-date="')[1].split('"')[0]
                    expiry_date = datetime.strptime(expiry_string, '%a, %d %b %Y %H:%M:%S %Z')
                except:
                    expiry_date = None
                    
                return True, expiry_date, False
            
        return False, None, True
    except:
        return True, None, False

def get_restore_info(key):
    '''Get the ongoing restore information for an object in Glacier Deep Archive.'''
    restore_date = None
    restore_days = None
    try:   
        response = GLOBALS.s3client.head_object(Bucket=Config.BUCKET, Key=key)      
        restore_info = response.get('Restore')
        if restore_info and 'ongoing-request="true"' in restore_info:
            try:
                restore_date = datetime.strptime(response['ResponseMetadata']['HTTPHeaders']['x-amz-restore-request-date'], '%a, %d %b %Y %H:%M:%S %Z')
            except:
                restore_date = None
            
            try:
                restore_days = int(response['ResponseMetadata']['HTTPHeaders']['x-amz-restore-expiry-days'])
            except:
                restore_days = None
    except:
        pass
            
    return restore_date, restore_days

def check_storage_class(key):
    '''Check the storage class of an object in S3.'''
    try:
        response = GLOBALS.s3client.head_object(Bucket=Config.BUCKET, Key=key)
        return response['StorageClass']
    except:
        return None

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_empty_zips(self,task_id,tier,restore_time):
    '''Restores zips from Glacier that contain empty images.'''
    
    try:
        app.logger.info('Restoring zips for task {} '.format(task_id))
        task = db.session.query(Task).get(task_id)
        survey = task.survey
        zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
        
        restore_request = {
            'Days': Config.EMPTY_RESTORE_DAYS,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }

        expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, Config.EMPTY_RESTORE_DAYS)

        zips = db.session.query(Zip)\
                        .join(Image)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.checked==False)\
                        .filter(Zip.survey_id==survey.id)\
                        .order_by(Zip.id)\
                        .distinct().all()
        
        restore_zip = False
        restore_date = None
        require_wait = False
        zip_ids = []
        other_zips = []
        for zip in zips:
            if zip.expiry_date and zip.expiry_date >= expected_expiry_date:
                other_zips.append(zip.id)
                continue

            try:
                zip_key = zip_folder + '/' + str(zip.id) + '.zip'
                response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=zip_key, RestoreRequest=restore_request)
                restore_zip = True
                http_code = response['ResponseMetadata']['HTTPStatusCode']
                if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                    require_wait = True
                    zip.expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, Config.EMPTY_RESTORE_DAYS)
                elif http_code == 200:
                    zip.expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, Config.EMPTY_RESTORE_DAYS)
                zip_ids.append(zip.id)
            except ClientError as e:
                if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                    require_wait = True
                    file_restore_date, file_restore_days = get_restore_info(zip_key)
                    zip.expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                    if not restore_date or file_restore_date > restore_date: restore_date = file_restore_date
                    zip_ids.append(zip.id)
                continue
            except:
                continue
        
        db.session.commit()

        zip_ids = zip_ids + other_zips

        if not restore_zip and not restore_date and not require_wait and other_zips:
            zip_key = zip_folder + '/' + str(other_zips[0]) + '.zip'
            restore_file = get_restore_info(zip_key)
            if restore_file[0]:
                restore_date = restore_file[0]
                require_wait = True

        if zip_ids:
            if (restore_zip or restore_date) and require_wait:
                survey.status = 'Restoring Files'
                task.status = 'Ready'
                launch_kwargs = {'task_id':task_id, 'tagging_level':task.tagging_level, 'zip_ids':zip_ids}
                if restore_zip:
                    survey.require_launch = datetime.utcnow() + timedelta(seconds=restore_time)
                elif restore_date:
                    survey.require_launch = restore_date + timedelta(seconds=restore_time)
                GLOBALS.redisClient.set('empty_launch_kwargs_'+str(survey.id),json.dumps(launch_kwargs))
                db.session.commit()
            else:
                extract_zips.apply_async(kwargs={'task_id':task_id, 'zip_ids':zip_ids})
        else:
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
        zip_id = zip_path.rsplit('.', 1)[0]
        try:
            GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=zip_key, Filename=zip_path)
        except:
            return True

        # Unzip & get all image ids from filenames
        image_ids = []  
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for filename in zip_ref.namelist():
                image_id = filename.rsplit('.', 1)[0]
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
def restore_images_for_id(self,task_id,days,tier,restore_time,extend=False):
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

            if extend:
                expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
            else:
                expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
            
            cluster_sq = rDets(db.session.query(Cluster.id)\
                        .join(Image,Cluster.images)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .join(Label,Labelgroup.labels)\
                        .filter(Cluster.task_id.in_(task_ids))\
                        .filter(Label.description==species)\
                        .filter(Labelgroup.task_id.in_(task_ids))\
                        ).subquery()

            image_query = db.session.query(Image, Image.filename, Camera.path)\
                            .join(Camera)\
                            .join(Cluster,Image.clusters)\
                            .join(cluster_sq,Cluster.id==cluster_sq.c.id)\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(cluster_sq.c.id!=None)

            images = image_query.filter(or_(Image.expiry_date==None,Image.expiry_date<expected_expiry_date)).order_by(Image.id).distinct().all()

            restore_request = {
                'Days': days,
                'GlacierJobParameters': {
                    'Tier': tier
                }
            }

            restored_image = False
            restore_date = None
            require_wait = False    
            if images:
                storage_class = check_storage_class(images[0][2] + '/' + images[0][1])
                if storage_class == 'DEEP_ARCHIVE':
                    for chunk in chunker(images, 1000):
                        for image in chunk:
                            try:
                                image_key = image[2] + '/' + image[1]
                                response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                                restored_image = True
                                http_code = response['ResponseMetadata']['HTTPStatusCode']
                                if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                                    require_wait = True
                                    image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
                                elif http_code == 200:
                                    image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
                            except ClientError as e:
                                if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                                    require_wait = True
                                    file_restore_date, file_restore_days = get_restore_info(image_key)
                                    image[0].expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                                    if not restore_date or file_restore_date > restore_date: restore_date = file_restore_date
                            except:
                                continue
                        db.session.commit()
                else:
                    for image in images:
                        if image[0].expiry_date: image[0].expiry_date = None
                    db.session.commit()

            if extend:
                task.survey.require_launch = None
                db.session.commit()
            else:
                if not restored_image and not restore_date and not require_wait:
                    other_image = image_query.filter(Image.expiry_date>=expected_expiry_date).first()
                    if other_image:
                        image_key = other_image[2] + '/' + other_image[1]
                        restore_file = get_restore_info(image_key)
                        if restore_file[0]:
                            restore_date = restore_file[0]
                            require_wait = True
                        
                if (restored_image or restore_date) and require_wait:
                    if restored_image:
                        date_value = datetime.utcnow() + timedelta(seconds=restore_time)
                    elif restore_date:
                        date_value = restore_date + timedelta(seconds=restore_time)

                    task.survey.require_launch = date_value
                    task.survey.status = 'Restoring Files'
                    task.status = 'Ready'
                    for sub_task in task.sub_tasks:
                        sub_task.status = 'Ready'
                        sub_task.survey.status = 'Restoring Files'
                        sub_task.survey.require_launch = date_value

                    if algorithm:
                        launch_kwargs = {'task_ids':task_ids,'species':species,'algorithm':algorithm, 'tagging_level':taggingLevel, 'task_id':task_id}
                    else:
                        launch_kwargs = {'task_id':task_id, 'tagging_level':taggingLevel}

                    GLOBALS.redisClient.set('id_launch_kwargs_'+str(task.survey.id),json.dumps(launch_kwargs))
                    db.session.commit()
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
def restore_images_for_classification(self,survey_id,days,edit_survey_args,tier,restore_time):
    '''Restores images from Glacier for a specified survey.'''
    
    try:
        app.logger.info('Restoring images (classification) for survey {} for {} days '.format(survey_id,days))

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Processing'
        db.session.commit()

        expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)

        image_query = db.session.query(Image, Image.filename, Camera.path)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Detection)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))

        images = image_query.filter(or_(Image.expiry_date==None,Image.expiry_date<expected_expiry_date)).order_by(Image.id).distinct().all()
        
        restore_request = {
            'Days': days,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }

        restored_image = False
        restore_date = None
        require_wait = False

        if images:
            storage_class = check_storage_class(images[0][2] + '/' + images[0][1])
            if storage_class == 'DEEP_ARCHIVE':
                for chunk in chunker(images, 1000):
                    for image in chunk:
                        try:
                            image_key = image[2] + '/' + image[1]
                            response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                            restored_image = True
                            http_code = response['ResponseMetadata']['HTTPStatusCode']
                            if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                                require_wait = True
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
                            elif http_code == 200:
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                                require_wait = True
                                file_restore_date, file_restore_days = get_restore_info(image_key)
                                image[0].expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                                if not restore_date or file_restore_date > restore_date: restore_date = file_restore_date
                        except:
                            continue
                    db.session.commit()
            else:
                for image in images:
                    if image[0].expiry_date: image[0].expiry_date = None
                db.session.commit()

        if not restored_image and not restore_date and not require_wait:
            other_images = image_query.filter(Image.expiry_date>=expected_expiry_date).first()
            if other_images:
                image_key = other_images[2] + '/' + other_images[1]
                restore_file = get_restore_info(image_key)
                if restore_file[0]:
                    restore_date = restore_file[0]
                    require_wait = True
        
        if (restored_image or restore_date) and require_wait:
            survey.status = 'Restoring Files'   
            if restored_image:
                survey.require_launch = datetime.utcnow() + timedelta(seconds=restore_time)
            elif restore_date:
                survey.require_launch = restore_date + timedelta(seconds=restore_time)
            GLOBALS.redisClient.set('edit_launch_kwargs_'+str(survey.id),json.dumps(edit_survey_args))
            db.session.commit()   
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
def restore_files_for_download(self,task_id,download_request_id,download_params,days,tier,restore_time,extend=False):
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

        if extend:
            expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
        else:
            expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
        min_expiry_date = expected_expiry_date

        images = []
        images_query = None
        if raw_files:
            images_query = db.session.query(Image,Image.filename, Camera.path)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Detection)\
                                .join(Labelgroup)\
                                .outerjoin(Label,Labelgroup.labels)\
                                .filter(Trapgroup.survey_id==survey.id)\
                                .filter(Labelgroup.task_id==task_id)

            if include_empties: 
                localLabels.append(GLOBALS.nothing_id)
                images_query = images_query.filter(or_(Label.id.in_(localLabels),Label.id==None)).filter(Image.zip_id==None)
            else:
                images_query = images_query.filter(Label.id.in_(localLabels))
            
            if not include_frames:
                images_query = images_query.outerjoin(Video).filter(Video.id==None)

            images = images_query.filter(or_(Image.expiry_date==None,Image.expiry_date<expected_expiry_date)).order_by(Image.id).distinct().all()

        videos = []
        videos_query = None
        if include_video:
            # NOTE: WE DO NOT KEEP EMPTY VIDEOS IN S3 (CAN"T BE DOWNLOADED)
            videos_query = db.session.query(Video,Video.filename, Camera.path)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .join(Image)\
                                .join(Detection)\
                                .join(Labelgroup)\
                                .outerjoin(Label,Labelgroup.labels)\
                                .filter(Trapgroup.survey_id==survey.id)\
                                .filter(Labelgroup.task_id==task_id)
                                
            if include_empties:
                localLabels.append(GLOBALS.nothing_id)
                videos_query = videos_query.filter(or_(Label.id.in_(localLabels),Label.id==None)).filter(Image.zip_id==None)
            else:
                videos_query = videos_query.filter(Label.id.in_(localLabels))

            videos = videos_query.filter(or_(Video.expiry_date==None,Video.expiry_date<expected_expiry_date)).order_by(Video.id).distinct().all()
            
        restore_request = {
            'Days': days,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }

        restored_image = False
        restore_date_img = None
        require_wait_img = False
        if images:
            storage_class = check_storage_class(images[0][2] + '/' + images[0][1])
            if storage_class == 'DEEP_ARCHIVE':
                for chunk in chunker(images, 1000):
                    for image in chunk:
                        try:
                            image_key = image[2] + '/' + image[1]
                            response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                            restored_image = True
                            http_code = response['ResponseMetadata']['HTTPStatusCode']
                            if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                                require_wait_img = True
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
                            elif http_code == 200:
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
                            if image[0].expiry_date and image[0].expiry_date < min_expiry_date: min_expiry_date = image[0].expiry_date
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                                require_wait_img = True
                                file_restore_date, file_restore_days = get_restore_info(image_key)
                                image[0].expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                                if not restore_date_img or file_restore_date > restore_date_img: restore_date_img = file_restore_date
                                if image[0].expiry_date and image[0].expiry_date < min_expiry_date: min_expiry_date = image[0].expiry_date
                        except:
                            continue
                    db.session.commit()
            else:
                for image in images:
                    if image[0].expiry_date: image[0].expiry_date = None
                db.session.commit()

        restored_video = False
        restore_date_vid = None
        require_wait_vid = False
        if include_video and videos:
            first_video_path = videos[0][2].split('/_video_images_/')[0]
            splits = first_video_path.split('/')
            splits[0] = splits[0] + '-comp'
            first_video_path = '/'.join(splits)
            first_video_key = first_video_path + '/' + videos[0][1].rsplit('.', 1)[0] + '.mp4'
            storage_class = check_storage_class(first_video_key)
            if storage_class == 'DEEP_ARCHIVE':
                for chunk in chunker(videos, 1000):
                    for video in chunk:
                        try:
                            splits = video[2].split('/')
                            splits[0] = splits[0] + '-comp'
                            path = '/'.join(splits)
                            video_key = path.split('/_video_images_/')[0] + '/' + video[1].rsplit('.', 1)[0] + '.mp4'
                            response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=video_key, RestoreRequest=restore_request)
                            restored_video = True
                            http_code = response['ResponseMetadata']['HTTPStatusCode']
                            if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                                require_wait_vid = True
                                video[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
                            elif http_code == 200:
                                video[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
                            if video[0].expiry_date and video[0].expiry_date < min_expiry_date: min_expiry_date = video[0].expiry_date
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                                require_wait_vid = True
                                file_restore_date, file_restore_days = get_restore_info(video_key)
                                video[0].expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                                if not restore_date_vid or file_restore_date > restore_date_vid: restore_date_vid = file_restore_date
                                if video[0].expiry_date and video[0].expiry_date < min_expiry_date: min_expiry_date = video[0].expiry_date
                        except:
                            continue
                    db.session.commit()
            else:
                for video in videos:
                    if video[0].expiry_date: video[0].expiry_date = None
                db.session.commit()
        
        restored_zip = False
        restore_date_zip = None
        require_wait_zip = False
        if include_empties and not extend:
            if survey.zips:
                zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
                zips = [zip for zip in survey.zips if zip.expiry_date==None or zip.expiry_date<expected_expiry_date]

                zip_restore_request = {
                    'Days': Config.EMPTY_RESTORE_DAYS,
                    'GlacierJobParameters': {
                        'Tier': tier
                    }
                }

                for zip in zips:
                    try:
                        zip_key = zip_folder + '/' + str(zip.id) + '.zip'
                        response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=zip_key, RestoreRequest=zip_restore_request)
                        restored_zip = True
                        http_code = response['ResponseMetadata']['HTTPStatusCode']
                        if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                            require_wait_zip = True
                            zip.expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, Config.EMPTY_RESTORE_DAYS)
                        elif http_code == 200:
                            zip.expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, Config.EMPTY_RESTORE_DAYS)
                    except ClientError as e:
                        if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                            require_wait_zip = True
                            file_restore_date, file_restore_days = get_restore_info(zip_key)
                            zip.expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                            if not restore_date_zip or file_restore_date > restore_date_zip: restore_date_zip = file_restore_date
                        continue
                    except:
                        continue

                db.session.commit()
        
        restored_files = any([restored_image,restored_video,restored_zip])
        restore_dates = [date for date in [restore_date_img,restore_date_vid,restore_date_zip] if date]
        restore_date = max(restore_dates) if restore_dates else None
        require_wait = any([require_wait_img,require_wait_vid,require_wait_zip])
        if Config.DEBUGGING: app.logger.info('Restored files: {}, Restore date: {}, Require wait: {}, Extend: {}'.format(restored_files,restore_date,require_wait,extend))
        if extend:
            survey.require_launch = None
            download_request = db.session.query(DownloadRequest).get(download_request_id)
            download_request.timestamp = min_expiry_date
            db.session.commit()
        else:

            if not restored_files and not restore_date and not require_wait:
                if images_query:
                    other_images = images_query.filter(Image.expiry_date>=expected_expiry_date).first()
                    if other_images:
                        restore_file = get_restore_info(other_images[2] + '/' + other_images[1])
                        if restore_file[0]:
                            restore_date = restore_file[0]
                            require_wait = True

                if videos_query and not restore_date:
                    other_videos = videos_query.filter(Video.expiry_date>=expected_expiry_date).first()
                    if other_videos:
                        video_path = other_videos[2].split('/_video_images_/')[0]
                        splits = video_path.split('/')
                        splits[0] = splits[0] + '-comp'
                        video_path = '/'.join(splits)
                        video_key = video_path + '/' + other_videos[1].rsplit('.', 1)[0] + '.mp4'
                        restore_file = get_restore_info(video_key)
                        if restore_file[0]:
                            restore_date = restore_file[0]
                            require_wait = True

                if include_empties and not restore_date:
                    other_zips = [zip for zip in survey.zips if zip.expiry_date>=expected_expiry_date]
                    if other_zips:
                        zip_key = zip_folder + '/' + str(other_zips[0].id) + '.zip'
                        restore_file = get_restore_info(zip_key)
                        if restore_file[0]:
                            restore_date = restore_file[0]
                            require_wait = True

            if (restored_files or restore_date) and require_wait:
                survey.status = 'Restoring Files'
                if restored_files:
                    survey.require_launch  = datetime.utcnow() + timedelta(seconds=restore_time)
                elif restore_date:
                    survey.require_launch  = restore_date + timedelta(seconds=restore_time)

                download_request = db.session.query(DownloadRequest).get(download_request_id)
                download_request.status = 'Restoring Files'
                download_request.timestamp = min_expiry_date

                launch_kwargs = {'task_id':task_id,'download_request_id':download_request_id,'zips':include_empties}
                GLOBALS.redisClient.set('download_launch_kwargs_'+str(survey.id),json.dumps(launch_kwargs))

                db.session.commit()
            else:
                download_request = db.session.query(DownloadRequest).get(download_request_id)
                download_request.timestamp = min_expiry_date
                db.session.commit()
                process_files_for_download.apply_async(kwargs={'task_id':task_id,'download_request_id':download_request_id,'zips':include_empties})
                
        
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
            # zip_keys = [zip_folder + '/' + str(zip.id) + '.zip' for zip in survey.zips]
            zip_ids = [zip.id for zip in survey.zips]

            results = []
            for zip_id in zip_ids:
                zip_key = zip_folder + '/' + str(zip_id) + '.zip'
                img = db.session.query(Image).filter(Image.zip_id==zip_id).first()
                check = False
                try:
                    splits = img.camera.path.split('/')
                    splits[0] = splits[0] + '-comp'
                    path = '/'.join(splits)
                    image_key = path + '/' + img.filename
                    check = GLOBALS.s3client.head_object(Bucket=Config.BUCKET, Key=image_key)
                except:
                    pass
                if not check:
                    results.append(extract_zip.apply_async(kwargs={'zip_key':zip_key},queue='parallel'))

            if results:  
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

@celery.task(bind=True,max_retries=2,ignore_result=True)
def restore_images_for_export(self,task_id, data, user_name, download_request_id, days, tier, restore_time):

    try:
        task = db.session.query(Task).get(task_id)
        species = db.session.query(Label).get(int(data['species']))

        expected_expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
        min_expiry_date = expected_expiry_date  

        image_query = rDets(db.session.query(Image,Image.filename, Camera.path)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Labelgroup.labels.contains(species))\
                        .filter(Trapgroup.survey_id==task.survey_id)\
                        .order_by(Image.id)\
                        )
        
        images = image_query.filter(or_(Image.expiry_date==None,Image.expiry_date<expected_expiry_date)).distinct().all()

        restore_request = {
            'Days': days,
            'GlacierJobParameters': {
                'Tier': tier
            }
        }

        restored_image = False
        restore_date = None
        require_wait = False
        if images:
            storage_class = check_storage_class(images[0][2] + '/' + images[0][1])
            if storage_class == 'DEEP_ARCHIVE':
                for chunk in chunker(images, 1000):
                    for image in chunk:
                        try:
                            image_key = image[2] + '/' + image[1]
                            response = GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                            restored_image = True
                            http_code = response['ResponseMetadata']['HTTPStatusCode']
                            if http_code == 202: # 202 - Accepted (restore in progress), 200 - OK (restore completed - expiry date set)
                                require_wait = True
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), restore_time, days)
                            elif http_code == 200:
                                image[0].expiry_date = calculate_restore_expiry_date(datetime.utcnow(), 0, days)
                            if image[0].expiry_date and image[0].expiry_date < min_expiry_date: min_expiry_date = image[0].expiry_date
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                                require_wait = True
                                file_restore_date, file_restore_days = get_restore_info(image_key)
                                image[0].expiry_date = calculate_restore_expiry_date(file_restore_date, restore_time, file_restore_days)
                                if not restore_date or file_restore_date > restore_date: restore_date = file_restore_date
                                if image[0].expiry_date and image[0].expiry_date < min_expiry_date: min_expiry_date = image[0].expiry_date
                        except:
                            continue
                    db.session.commit()
            else:
                for image in images:
                    if image[0].expiry_date: image[0].expiry_date = None
                db.session.commit()

        if not restored_image and not restore_date and not require_wait:
            other_images = image_query.filter(Image.expiry_date>=expected_expiry_date).first()
            if other_images:
                restore_file = get_restore_info(other_images[2] + '/' + other_images[1])
                if restore_file[0]:
                    restore_date = restore_file[0]
                    require_wait = True

        if ((restored_image or restore_date) and require_wait):
            task.survey.status = 'Restoring Files'
            task.status = 'Ready'
            if restored_image:
                task.survey.require_launch = datetime.utcnow() + timedelta(seconds=restore_time)
            elif restore_date:
                task.survey.require_launch = restore_date + timedelta(seconds=restore_time)

            launch_kwargs = {'task_id':task_id, 'data':data, 'user_name':user_name, 'download_request_id':download_request_id}
            GLOBALS.redisClient.set('export_launch_kwargs_'+str(task.survey.id),json.dumps(launch_kwargs))

            download_request = db.session.query(DownloadRequest).get(download_request_id)
            download_request.status = 'Restoring Files'
            download_request.timestamp = min_expiry_date

            db.session.commit()

        else:
            task.survey.status = 'Ready'
            task.status = 'Ready'
            download_request = db.session.query(DownloadRequest).get(download_request_id)
            download_request.status = 'Pending'
            download_request.timestamp = min_expiry_date
            db.session.commit()
            response = generate_wildbook_export.apply_async(kwargs={'task_id':task_id, 'data':data, 'user_name':user_name, 'download_request_id':download_request_id})
            download_request.celery_id = response.id
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
