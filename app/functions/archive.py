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
from app.functions.globals import retryTime
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def restore_empty_zips(task_id):
    '''Restores zips from Glacier that contain empty images.'''
    
    try:

        survey = db.session.query(Survey).join(Task).filter(Task.id==task_id).first()
        zip_folder = survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER
        
        restore_request = {
            'Days': 1,
            'GlacierJobParameters': {
                'Tier': 'Bulk'
            }
        }

        if survey.zips:
            for zip in survey.zips:
                zip_key = zip_folder + '/' + str(zip.id) + '.zip'
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=zip_key, RestoreRequest=restore_request)
                except:
                    continue

            survey.empty_restore = datetime.utcnow()       
            extract_zips.apply_async(kwargs={'task_id':task_id},countdown=Config.RESTORE_COUNTDOWN)
        else:
            survey.status = 'Ready'
            task = db.session.query(Task).get(task_id)
            task.status = 'Ready'

        db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def extract_zips(self,task_id):
    '''Handles zips from Glacier that contain empty images.'''
    
    try:
        survey = db.session.query(Survey).join(Task).filter(Task.id==task_id).first()
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def extract_zip(self,zip_key):
    '''Handles a zip from Glacier that contains empty images.'''
    
    try:
 
        app.logger.info('Handling zip {}'.format(zip_key))

        zip_path = zip_key.split('/')[-1]
        GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=zip_key, Filename=zip_path)

        # Unzip & get all image ids from filenames
        image_ids = []  
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for filename in zip_ref.namelist():
                image_id = filename.split('.')[0]
                image_ids.append(image_id)


        image_data = {r[0]: r[2]+'/'+r[1] for r in db.session.query(Image.id, Image.filename, Camera.path)\
                        .join(Camera)\
                        .filter(Image.id.in_(image_ids))\
                        .distinct().all()}

        # Extract images from zip and upload to S3
        for image_id in image_ids:
            image_path = image_data[image_id]
            splits = image_path.split('/')
            splits[0] = splits[0] + '-comp'
            image_key = '/'.join(splits)
            image_fn = image_id + '.jpg'
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def restore_images_for_id(self,task_id,days):
    '''Restores images from Glacier for a specified species in the specified tasks.'''
    
    try:
        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level
        tL = re.split(',',taggingLevel)
        species = tL[1]
        task_ids = [task_id]
        for sub_task in task.sub_tasks:
            task_ids.append(sub_task.id)

        app.logger.info('Restoring images for tasks {} for {} days '.format(task_ids,days))

        cluster_sq = db.session.query(Cluster.id)\
                    .join(Image,Cluster.images)\
                    .join(Detection)\
                    .filter(Cluster.task_id.in_(task_ids))\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .distinct().subquery()

        images = db.session.query(Image.filename, Camera.path)\
                        .join(Cluster,Image.clusters)\
                        .join(Camera)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .join(Label,Labelgroup.labels)\
                        .join(cluster_sq,Cluster.id==cluster_sq.c.id)\
                        .filter(Label.description==species)\
                        .filter(Cluster.task_id.in_(task_ids))\
                        .filter(Labelgroup.task_id.in_(task_ids))\
                        .filter(cluster_sq.c.id!=None)\
                        .distinct().all()
        
        restore_request = {
            'Days': days,
            'GlacierJobParameters': {
                'Tier': 'Bulk'
            }
        }

        restored_image = False
        for image in images:     
            image_key = image[2] + '/' + image[1]
            try:
                GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                restored_image = True
            except:
                continue
        
        if restored_image:
            task.survey.id_restore = datetime.utcnow()
            db.session.commit()

            # Schedule launch_task to run after the restore is complete 
            if (len(task_ids) > 1) and ('-5' in taggingLevel):
                if tL[4]=='h':
                    algorithm = 'hotspotter'
                elif tL[4]=='n':
                    algorithm = 'none'
                calculate_detection_similarities.apply_async(kwargs={'task_ids':task_ids,'species':species,'algorithm':algorithm},countdown=Config.RESTORE_COUNTDOWN)
            else:
                launch_task.apply_async(kwargs={'task_id':task_id},countdown=Config.RESTORE_COUNTDOWN)
        else:
            if (len(task_ids) > 1) and ('-5' in taggingLevel):
                if tL[4]=='h':
                    algorithm = 'hotspotter'
                elif tL[4]=='n':
                    algorithm = 'none'
                calculate_detection_similarities.apply_async(kwargs={'task_ids':task_ids,'species':species,'algorithm':algorithm})
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def restore_images_for_classification(self,survey_id,days,edit_survey_args):
    '''Restores images from Glacier for a specified survey.'''
    
    try:
        app.logger.info('Restoring images (classification) for survey {} for {} days '.format(survey_id))

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Processing'
        db.session.commit()

        images = db.session.query(Image.filename, Camera.path)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .join(Detection)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .distinct().all()
        
        if images:
            restore_request = {
                'Days': days,
                'GlacierJobParameters': {
                    'Tier': 'Bulk'
                }
            }
            restored_image = False
            for image in images:     
                image_key = image[2] + '/' + image[1]
                try:
                    GLOBALS.s3client.restore_object(Bucket=Config.BUCKET, Key=image_key, RestoreRequest=restore_request)
                    restored_image = True
                except:
                    continue
            
            if restored_image:
                survey.edit_restore = datetime.utcnow()        
                db.session.commit()       
                edit_survey.apply_async(kwargs=edit_survey_args,countdown=Config.RESTORE_COUNTDOWN)
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
