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

from crypt import methods
from email import message
from app import app, db
from app.models import *
from app.functions.admin import *
from app.functions.globals import *
from app.functions.results import *
from app.functions.individualID import *
from app.functions.annotation import *
from app.functions.imports import *
from app.functions.permissions import *
from app.functions.utilities import *
from app.functions.archive import *
from app.functions.periodic import *
import GLOBALS
import json
from flask import render_template, redirect, url_for, flash, request, send_from_directory, send_file
from flask_login import current_user, login_user, logout_user, login_required
from app.forms import LoginForm, NewSurveyForm, EnquiryForm, ResetPasswordForm, RequestPasswordChangeForm
from werkzeug.urls import url_parse
from app.forms import RegistrationForm
import time
from sqlalchemy.sql import func, or_, alias, and_, distinct, literal
from sqlalchemy import desc, extract
from datetime import datetime, timedelta
import re
import math
import ast
import boto3
from config import Config
import os
import jwt
import tempfile
from multiprocessing import Lock
from gpuworker.worker import detectAndClassify
from flask_cors import cross_origin
from calendar import monthrange
from botocore.client import Config as botoConfig
from multiprocessing.pool import ThreadPool as Pool
import urllib
import PIL
from PIL import ImageDraw, ImageFont
import io
import tracemalloc
import calendar
import pandas as pd
from WorkR.worker import calculate_activity_pattern, calculate_occupancy_analysis, calculate_spatial_capture_recapture
from celery.result import allow_join_result
from scipy.spatial import ConvexHull

tracemalloc.start(40)

GLOBALS.s3client = boto3.client('s3')
GLOBALS.s3UploadClient = boto3.client('s3', 
                                    config=botoConfig(signature_version='s3v4'), 
                                    region_name=Config.AWS_REGION,
                                    aws_access_key_id=Config.AWS_S3_UPLOAD_ACCESS_KEY_ID,
                                    aws_secret_access_key=Config.AWS_S3_UPLOAD_SECRET_ACCESS_KEY)
GLOBALS.redisClient = redis.Redis(host=Config.REDIS_IP, port=6379)
GLOBALS.lambdaClient = boto3.client('lambda', region_name=Config.AWS_REGION)
GLOBALS.sqsClient = boto3.client('sqs', region_name=Config.AWS_REGION)
try:
    GLOBALS.sqsQueueUrl = GLOBALS.sqsClient.get_queue_url(QueueName=Config.SQS_QUEUE)['QueueUrl']
except:
    GLOBALS.sqsQueueUrl = None
GLOBALS.lock = Lock()

# @app.before_first_request
# def initialise_ibs():
#     '''Initialises the IBS object, which is used to interact with the WBIA database.'''	
#     if 'fileHandler' in request.url:
#         return
#     app.logger.info('Initialising IBS')
#     if not GLOBALS.ibs:
#         import warnings
#         with warnings.catch_warnings():
#             warnings.filterwarnings("ignore")
#             from wbia import opendb
#             GLOBALS.ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR, allow_newdir=True)
#         app.logger.info('IBS initialised.')
#     return

@app.before_request
def check_for_maintenance():
    '''Checks if site is in maintenance mode and returns a message accordingly.'''
    if Config.MAINTENANCE:
        return render_template("html/block.html",text="Platform undergoing maintenance. Please try again later.", helpFile='block', version=Config.VERSION), 503

@app.errorhandler(404)
def not_found_error(error):
    '''Handles users requesting non-existent endpoints.'''
    return render_template("html/block.html",text="Page not found.", helpFile='block', version=Config.VERSION), 404

@app.errorhandler(500)
def internal_error(error):
    '''Handles server errors.'''
    # db.session.rollback()
    db.session.remove()
    return render_template("html/block.html",text="An unexpected error has occurred.", helpFile='block', version=Config.VERSION), 500

@app.route('/getUniqueName')
@login_required
def getUniqueName():
    '''Returns a unique name for an individual for the current task and species.'''

    task = current_user.turkcode[0].task
    tL = re.split(',',task.tagging_level)
    name = generateUniqueName(task.id,tL[1],tL[2])
    return json.dumps(name)

@app.route('/releaseTask/<task_id>')
@login_required
def releaseTask(task_id):
    '''Releases a reserved task by setting it's status to stopped.'''

    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user_id==current_user.id):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
        task.status = 'Stopped'
        task.survey.status = 'Ready'
        db.session.commit()
    return json.dumps('success')

# @app.route('/traceMalloc',methods=['GET'])
# def traceMalloc():
#   snapshot = tracemalloc.take_snapshot()
#   top_stats = snapshot.statistics('lineno')
#   return json.dumps([obj.__str__() for obj in top_stats])

# @app.route('/traceMallocSnapshot',methods=['GET'])
# def traceMallocSnapshot():
#   snapshot = tracemalloc.take_snapshot()
#   snapshot.dump('/code/snapshot.bin')
#   return send_file('/code/snapshot.bin', attachment_filename='snapshot.bin')

@app.route('/launchTask', methods=['POST'])
@login_required
def launchTask():
    '''
    Launches the specified task with the parameters provided.

        Parameters:
            task_id (int): Task to be launched
            taskSize (int): Batch size
            taggingLevel (str): The level at which the task is to be annotated
            isBounding (str): Whether the task is to correct bounding boxes or not

        Return statuses:
            success: Launch was successful
            error: Launch was unsuccessful
            tags: A list of tags is returned for a cluster-level individual identification
            untranslated: There are translated labels that must be dealt with before launching
    '''

    task_ids = ast.literal_eval(request.form['selectedTasks'])
    taskSize = request.form['taskSize']
    taggingLevel = request.form['taskTaggingLevel']
    isBounding = request.form['isBounding']

    if Config.DEBUGGING: app.logger.info('Task launched: {}, {}, {}, {}'.format(task_ids,taskSize,taggingLevel,isBounding))

    # if task_ids==['0']:
    #     species = re.split(',',taggingLevel)[1]
    #     task_ids = [r[0] for r in db.session.query(Task.id)\
    #                                     .join(Survey)\
    #                                     .join(Label)\
    #                                     .filter(Label.description==species)\
    #                                     .filter(Label.icID_count==0)\
    #                                     .filter(Label.icID_allowed==True)\
    #                                     .filter(Survey.user==current_user)\
    #                                     .filter(Task.status.in_(Config.TASK_READY_STATUSES))\
    #                                     .distinct().all()]
                    
    tasks = db.session.query(Task).filter(Task.id.in_([int(r) for r in task_ids])).filter(func.lower(Task.status).in_(Config.TASK_READY_STATUSES)).all()

    # check task statuses
    if len(tasks) != len(task_ids):
        statusPass = False
    else:
        statusPass = True


    # Check if any surveys are busy with a dearchival process
    surveys = [task.survey for task in tasks]
    if any(survey.status == 'Restoring Files' for survey in surveys):
        return json.dumps({'message': 'Files from one or more of the surveys associated with your selection are being restored from archival storage. Launching an annotation set is not possible during this process. Please wait until the 48 hour restoration period has completed.', 'status': 'Error'})


    if ('-4' in taggingLevel) or ('-5' in taggingLevel):
        species = re.split(',',taggingLevel)[1]

        # # Prevent individual ID for too many detections
        # detCount = db.session.query(Detection.id)\
        #                     .join(Labelgroup)\
        #                     .join(Task)\
        #                     .join(Label,Labelgroup.labels)\
        #                     .filter(Task.id.in_(task_ids))\
        #                     .filter(Label.description==species)\
        #                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
        #                     .filter(Detection.static == False) \
        #                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
        #                     .distinct().count()

        # if detCount > 2000:
        #     return json.dumps({'message':   'There are too many sightings/boxes for your selection, resulting in too many combinations for which similarities '+
        #                                     'need to be calculated. For now, individual ID cannot be performed across more than 2000 sightings/boxes (2 million combinations). '+
        #                                     'Please try again after future updates, or reduce the size of your dataset.', 'status': 'Error'})

        if '-5' in taggingLevel:
            # Prevent individual ID across fewer than 2 individuals
            indCount = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==species)\
                                .filter(Individual.name!='unidentifiable')\
                                .distinct().count()

            if indCount < 2:
                return json.dumps({'message': 'There are too few individuals for your selection. Individual ID requires at least 2 individuals.', 'status': 'Error'})

    if (len(task_ids)>1) and ('-5' in taggingLevel):
        # species = re.split(',',taggingLevel)[1]
        individuals_in_selection = db.session.query(Individual)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .subquery()

        # Check that all tasks associated with indivuals in this grouping are included
        applicableTasks = db.session.query(Task)\
                                    .join(Individual,Task.individuals)\
                                    .join(individuals_in_selection, individuals_in_selection.c.id==Individual.id)\
                                    .distinct().all()

        missing_tasks = [task for task in applicableTasks if task not in tasks]
        
        if missing_tasks:
            message = 'The following annotation sets are already associated with individuals in your selection and thus must also be included: '
            for task in missing_tasks:
                message += task.survey.name + ': ' + task.name + ', '
            message = message[:-2]

            return json.dumps({'message': message, 'status': 'Error'})

        # Check individuals not already associated to another task in a survey     
        problem_surveys_sq = db.session.query(Survey,func.count(distinct(Task.id)).label('count'))\
                                            .join(Task)\
                                            .join(Individual,Task.individuals)\
                                            .join(individuals_in_selection, individuals_in_selection.c.id==Individual.id)\
                                            .group_by(Survey.id)\
                                            .subquery()

        problem_surveys = db.session.query(Survey)\
                                            .join(problem_surveys_sq, Survey.id==problem_surveys_sq.c.id)\
                                            .filter(problem_surveys_sq.c.count>1)\
                                            .distinct().all()

        if problem_surveys:
            message = 'The following surveys already have another annotation set assoicated with the stipulated individual pool: '
            for survey in problem_surveys:
                message += survey.name + ', '
            message = message[:-2] + '.'

            return json.dumps({'message': message, 'status': 'Error'})
    
    if ('-4' in taggingLevel) or ('-5' in taggingLevel) or ('-7' in taggingLevel):
        if Config.DISABLE_RESTORE:
            return json.dumps({'message': 'File de-archival is currently not available. Please try again later.', 'status': 'Error'})
            
    task = db.session.query(Task).get(task_ids[0])
    message = 'Annotation set not ready to be launched.'

    if (task==None) or (taskSize in ['','none','null']) or (taggingLevel.lower() in ['','none','null']):
        message = 'An unexpected error has occurred. Please check your form and try again.'
        return json.dumps({'message': message, 'status': 'Error'})

    # if (statusPass) and (task.survey.user_id==current_user.id):
    # if statusPass and checkSurveyPermission(current_user.id,task.survey_id,'write'):
    if statusPass and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in tasks):
        survey = task.survey
        task.status = 'PENDING'
        survey.status = 'Launched'
        db.session.commit()

        app.logger.info(task.survey.name + ': ' + task.name + ' launched by ' + current_user.username)

        if isBounding=='true':
            isBounding = True
            task.test_size = 0
        else:
            isBounding = False

        if int(taskSize) > 10000:
            taskSize = 10000

        #Check if all classifications are translated, if not, prompt
        translations = [r[0] for r in db.session.query(Translation.classification).filter(Translation.task==task).all()]
        translations.extend(['nothing','unknown'])
        untranslated = [r[0] for r in db.session.query(ClassificationLabel.classification)\
                                            .filter(ClassificationLabel.classifier_id==task.survey.classifier_id)\
                                            .filter(~ClassificationLabel.classification.in_(translations))\
                                            .order_by(ClassificationLabel.classification).distinct().all()]

        # untranslated_prior = db.session.query(Detection.classification)\
        #                         .join(Image)\
        #                         .join(Camera)\
        #                         .join(Trapgroup)\
        #                         .filter(Trapgroup.survey_id==task.survey_id)\
        #                         .filter(~Detection.classification.in_(translations))\
        #                         .distinct().all()

        # untranslated_prior = [r[0] for r in untranslated_prior if r[0] != None]

        # if len(untranslated_prior) != 0:
        #     #Attempt to auto-translate
        #     for classification in untranslated_prior:
        #         if classification.lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
        #             species = db.session.query(Label).filter(Label.task==task).filter(func.lower(Label.description)==func.lower(classification)).first()
        #         else:
        #             species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(classification)).first()

        #         if species:
        #             translation = Translation(classification=classification, label_id=species.id, task=task)
        #             db.session.add(translation)
        #         else:
        #             untranslated.append(classification)
        #     # db.session.commit()

        #     if len(untranslated) != 0:
        #         translations = db.session.query(Translation)\
        #                                 .join(Label)\
        #                                 .filter(Label.children.any())\
        #                                 .filter(Label.description != 'Vehicles/Humans/Livestock')\
        #                                 .filter(Label.description != 'Nothing')\
        #                                 .filter(Label.description != 'Unknown')\
        #                                 .filter(Translation.task==task).all()
        #         for translation in translations:
        #             if not checkChildTranslations(translation.label):
        #                 for child in translation.label.children:
        #                     createChildTranslations(translation.classification,task.id,child)    
                # db.session.commit()

        # Handle multi-task launch
        if len(task_ids) > 1:
            task.sub_tasks = [tsk for tsk in tasks if tsk != task]
            for sub_task in task.sub_tasks:
                sub_task.status = 'Processing'
                sub_task.survey.status = 'Launched'

        task.size = taskSize
        task.tagging_level = taggingLevel
        task.is_bounding = isBounding
        db.session.commit()

        if any(level in taggingLevel for level in ['-4','-2']):
            tags = db.session.query(Tag.description,Tag.hotkey,Tag.id).filter(Tag.task==task).order_by(Tag.description).all()
            task.status = 'Waiting'
            db.session.commit()
            checkAndRelease.apply_async(kwargs={'task_id': task.id},countdown=300, queue='priority', priority=0)
            tags = [tuple(row) for row in tags]
            return json.dumps({'status': 'tags', 'tags': tags})

        elif len(untranslated) == 0:
            if '-4' in taggingLevel or '-5' in taggingLevel:
                restore_images_for_id.apply_async(kwargs={'task_id':task.id,'days':Config.ID_RESTORE_DAYS, 'tier':Config.RESTORE_TIER, 'restore_time':Config.RESTORE_TIME})
            elif '-7' in taggingLevel:
                restore_empty_zips.apply_async(kwargs={'task_id':task.id,'tier':Config.RESTORE_TIER, 'restore_time':Config.RESTORE_TIME})
            else:
                launch_task.apply_async(kwargs={'task_id':task.id})
            return json.dumps({'status': 'Success'})

        else:
            labels = ['Nothing (Ignore)','Vehicles/Humans/Livestock']
            labels.extend([label.description for label in db.session.query(Label).filter(Label.task==task).order_by(Label.description).all()])
            task.status = 'Waiting'
            db.session.commit()
            checkAndRelease.apply_async(kwargs={'task_id': task.id},countdown=300, queue='priority', priority=0)
            return json.dumps({'status': 'untranslated','untranslated':untranslated,'labels':labels})

    return json.dumps({'message': message, 'status': 'Error'})

# @app.route('/MturkStatus' , methods=['POST'])
# @login_required
# def MturkStatus():
#     '''Returns a dictionary status of a requested task: state, hitsCompleted, hitsActive and id.'''
#     if current_user.admin:
#         response = []
#         task_ids = ast.literal_eval(request.form['task_ids'])

#         for task_id in task_ids:
#             task = db.session.query(Task).get(int(task_id))

#             jobs_finished = db.session.query(Turkcode)\
#                                     .join(User)\
#                                     .filter(User.parent_id!=None)\
#                                     .filter(Turkcode.task_id==int(task_id))\
#                                     .filter(Turkcode.tagging_time!=None)\
#                                     .distinct().count()

#             jobs_finished = jobs_finished - task.jobs_finished
#             jobs_active = db.session.query(Turkcode).filter(Turkcode.task_id==int(task_id)).filter(Turkcode.active==True).count()

#             response.append({
#                 'state': task.status,
#                 'hitsCompleted': jobs_finished,
#                 'hitsActive': jobs_active,
#                 'id': task_id
#             })

#         return json.dumps(response)

#     else:
#         return redirect(url_for('jobs'))

@app.route('/takeJob/<task_id>')
@login_required
def takeJob(task_id):
    '''Returns an available job code and associated endpoint for a given task.'''

    task = db.session.query(Task).get(int(task_id))

    # if task and (task.status=='PROGRESS') and ((current_user in task.survey.user.workers) or (current_user == task.survey.user)):
    if task and (task.status=='PROGRESS') and (checkAnnotationPermission(current_user.id,task.id)):

        if (len(current_user.children[:]) == 0) and (not task.is_bounding) and (',' not in task.tagging_level) and (not Config.LOAD_TESTING):
            endpoint = '/tutorial/'
        else:
            endpoint = '/dotask/'

        # if not populateMutex(int(task_id)): return json.dumps({'status':'inactive'})

        job = GLOBALS.redisClient.spop('job_pool_'+str(task_id))
        if job == None: return json.dumps({'status':'error'})

        job = db.session.query(Turkcode).filter(Turkcode.code==job).first()

        if job:
            GLOBALS.redisClient.sadd('active_jobs_'+str(task_id),job.code)
            job.active = False
            job.assigned = datetime.utcnow()
            db.session.commit()
            return json.dumps({'status':'success','code':endpoint+job.code})

    return json.dumps({'status':'inactive'})

@app.route('/getAllIndividuals', methods=['POST'])
@login_required
def getAllIndividuals():
    '''Returns a paginated dictionary of all individuals associated with a specified label and tasks (all tasks or a list of tasks) and a specified tag, site and date range including the individual names, ID, and best image.'''

    task_ids = ast.literal_eval(request.form['task_ids'])   
    species_name = ast.literal_eval(request.form['species_name'])
    tag_name = ast.literal_eval(request.form['tag_name'])
    trap_name = ast.literal_eval(request.form['trap_name']) 
    start_date = ast.literal_eval(request.form['start_date'])
    end_date = ast.literal_eval(request.form['end_date'])
    search = ast.literal_eval(request.form['search'])

    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)

    if Config.DEBUGGING: app.logger.info('Get All Individuals for {}, {}, {}, {}, {},{} , {}, {}, {}'.format(task_ids,species_name,tag_name,trap_name,start_date,end_date,page,order,search))

    reply = []
    next = None
    prev = None
    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Survey.id).join(Survey),current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Survey.id).join(Survey).filter(Task.id.in_(task_ids)),current_user.id, 'read').distinct().all()
        task_ids = [r[0] for r in tasks]
        survey_ids = [r[1] for r in tasks] 

    individuals = db.session.query(Individual.id,Individual.name)\
                        .join(Detection,Individual.detections)\
                        .join(Image)\
                        .join(Task,Individual.tasks)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                        .filter(Individual.name!='unidentifiable')\
                        .filter(Individual.active==True)

    if species_name !='0': individuals = individuals.filter(Individual.species==species_name)

    if tag_name != 'None':
        if tag_name =='All':
            individuals = individuals.filter(Individual.tags.any())
        else:
            individuals = individuals.filter(Individual.tags.any(Tag.description==tag_name))
    
    if trap_name != '0': individuals = individuals.join(Camera).join(Trapgroup).filter(Trapgroup.tag == trap_name)
    
    if start_date: individuals = individuals.filter(Image.corrected_timestamp >= start_date)

    if end_date: individuals = individuals.filter(Image.corrected_timestamp <= end_date)

    searches = re.split('[ ,]',search)
    for search in searches:
        individuals = individuals.filter(Individual.name.contains(search))

    if order == 1:
        #alphabetical
        individuals = individuals.order_by(Individual.name)
    elif order == 2:
        #Reverse Alphabetical
        individuals = individuals.order_by(desc(Individual.name))
    elif order == 3:
        #Last seen
        # Get the most recent timestamp for each individual from their related images
        subquery = db.session.query(Individual.id,func.max(Image.corrected_timestamp).label('max_timestamp'))\
                            .join(Detection,Individual.detections)\
                            .join(Image)\
                            .group_by(Individual.id)\
                            .subquery()

        # Join the existing query with the subquery and order by the most recent timestamp
        individuals = individuals.join(subquery, subquery.c.id == Individual.id).order_by(desc(subquery.c.max_timestamp))
    elif order == 4:
        #First seen
        # Get the most recent timestamp for each individual from their related images
        subquery = db.session.query(Individual.id,func.min(Image.corrected_timestamp).label('min_timestamp'))\
                            .join(Detection,Individual.detections)\
                            .join(Image)\
                            .group_by(Individual.id)\
                            .subquery()

        # Join the existing query with the subquery and order by the most recent timestamp
        individuals = individuals.join(subquery, subquery.c.id == Individual.id).order_by(subquery.c.min_timestamp)

    individuals = individuals.distinct().paginate(page, 12, False)

    best_detections = calculate_individual_best_detection([individual[0] for individual in individuals.items])

    for individual in individuals.items:
        # Get the best detection for the individual
        best_detection = best_detections.get(individual[0], None)
        if not best_detection: continue

        id = individual[0]
        name = individual[1]
        reply.append({
            'id': id,
            'name': name,
            'url': (best_detection['path'] + '/' + best_detection['filename']).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
            'detection': {
                'top': best_detection['top'],
                'left': best_detection['left'],
                'right': best_detection['right'],
                'bottom': best_detection['bottom']
            }
        })

    next = individuals.next_num if individuals.has_next else None
    prev = individuals.prev_num if individuals.has_prev else None

    return json.dumps({'individuals': reply, 'next':next, 'prev':prev})

@app.route('/editIndividualName', methods=['POST'])
@login_required
def editIndividualName():
    ''' Edit the specified individual's name '''
    error = ''
    individual_id = ast.literal_eval(request.form['individual_id'])
    name = ast.literal_eval(request.form['name'])
    individual = db.session.query(Individual).get(individual_id)
    if name != '' and name.lower() != 'unidentifiable' and not any(c in name for c in ['/','\\']):
        if individual and individual.active and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
            check = db.session.query(Individual)\
                            .join(Task,Individual.tasks)\
                            .filter(Individual.species==individual.species)\
                            .filter(Individual.name==name)\
                            .filter(Task.id.in_([r.id for r in individual.tasks]))\
                            .first()
            if check:
                error = "Duplicate name detected. Please enter a different name."
            else:
                individual.name = name
                db.session.commit()
                return json.dumps({'status': 'success'}) 
        else:
            error = 'Could not edit individual name.'
    else:
        error = "Invalid name. Please enter a different name."

    return json.dumps({'status': error}) 

@app.route('/getIndividuals/<task_id>/<species>')
@login_required
def getIndividuals(task_id,species):
    '''Returns a paginated dictionary of all individuals associated with a specified label and task, including the individual names, ID, and best image.'''
    
    reply = []
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)

    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        page = request.args.get('page', 1, type=int)
        
        if species.lower()=='all':
            individuals = db.session.query(Individual.id,Individual.name).filter(Individual.tasks.contains(task)).filter(Individual.name!='unidentifiable').filter(Individual.active==True).order_by(Individual.name).distinct().paginate(page, 8, False)
        else:
            individuals = db.session.query(Individual.id,Individual.name).filter(Individual.tasks.contains(task)).filter(Individual.name!='unidentifiable').filter(Individual.active==True).filter(Individual.species==species).order_by(Individual.name).distinct().paginate(page, 8, False)

        best_detections = calculate_individual_best_detection([individual[0] for individual in individuals.items])

        for individual in individuals.items:
            # Get the best detection for the individual
            best_detection = best_detections.get(individual[0], None)
            if not best_detection: continue

            id = individual[0]
            name = individual[1]

            reply.append({
                'id': id,
                'name': name,
                'url': (best_detection['path'] + '/' + best_detection['filename']).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'detection': {
                    'top': best_detection['top'],
                    'left': best_detection['left'],
                    'right': best_detection['right'],
                    'bottom': best_detection['bottom']
                }
            })

        next = individuals.next_num if individuals.has_next else None
        prev = individuals.prev_num if individuals.has_prev else None

        return json.dumps({'individuals': reply, 'next':next, 'prev':prev})

    return json.dumps('error')

@app.route('/deleteIndividual/<individual_id>')
@login_required
def deleteIndividual(individual_id):
    '''Deletes the requested individual and returns a success or error status.'''
    if Config.DEBUGGING: app.logger.info('Delete individual: {}'.format(individual_id))

    individual_id = int(individual_id)
    individual = db.session.query(Individual).get(individual_id)

    task = db.session.query(Task).join(Individual,Task.individuals).filter(Task.sub_tasks.any()).filter(Individual.id==individual_id).distinct().first()
    if not task and individual: task = individual.tasks[0]

    if individual and individual.active and task and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
        individual.active = False
        db.session.commit()

        task_ids = [r.id for r in individual.tasks]

        for detection in individual.detections:
            newIndividual = Individual( name=generateUniqueName(task.id,individual.species,'n'),
                                        species=individual.species,
                                        user_id=current_user.id,
                                        timestamp=datetime.utcnow())

            db.session.add(newIndividual)
            newIndividual.detections.append(detection)
            newIndividual.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.id==detection.id)\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()
            db.session.commit()

            individuals = [r[0] for r in db.session.query(Individual.id)\
                                                .join(Task,Individual.tasks)\
                                                .filter(Task.id.in_([r.id for r in individual.tasks]))\
                                                .filter(Individual.species==individual.species)\
                                                .filter(Individual.name!='unidentifiable')\
                                                .filter(Individual.id != individual.id)\
                                                .filter(Individual.id != newIndividual.id)\
                                                .filter(Individual.active==True)\
                                                .all()]

            calculate_individual_similarity.delay(individual1=newIndividual.id,individuals2=individuals,species=individual.species)

        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:
            db.session.delete(similarity)

        individual.detections = []
        individual.tags = []
        individual.children = []
        individual.parents = []
        individual.tasks = []
        db.session.delete(individual)
        db.session.commit()

        return json.dumps('success')

    return json.dumps('error')

@app.route('/getIndividual/<individual_id>', methods=['POST'])
@login_required
def getIndividual(individual_id):
    '''Returns a dictionary of all images associated with the specified individual with the following info: ID, URL, timestamp, trapgroup, and detections.'''
    
    reply = []
    access = None
    individual_id = int(individual_id)
    individual = db.session.query(Individual).get(individual_id)

    # order = request.args.get('order', 'a1', type=str)
    order = ast.literal_eval(request.form['order']) 
    site = ast.literal_eval(request.form['site']) 
    start_date = ast.literal_eval(request.form['start_date'])
    end_date = ast.literal_eval(request.form['end_date'])

    # if individual and (individual.tasks[0].survey.user==current_user):
    if individual and individual.active==True:
        survey_ids = []
        for task in individual.tasks:
            if current_user.admin and checkSurveyPermission(current_user.id,task.survey_id,'read'):
                survey_ids.append(task.survey_id)
            elif current_user.parent_id and checkAnnotationPermission(current_user.parent_id,task.id):
                survey_ids.append(task.survey_id)

        images = db.session.query(
                        Image.id,
                        Image.filename,
                        Image.corrected_timestamp,
                        Detection.id,
                        Detection.static,
                        Detection.top,
                        Detection.left,
                        Detection.right,
                        Detection.bottom,
                        Detection.flank,
                        Camera.path,
                        Trapgroup.id,
                        Trapgroup.tag,
                        Trapgroup.latitude,
                        Trapgroup.longitude,
                        Trapgroup.altitude
                    )\
                    .join(Detection)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Detection.individuals.contains(individual))\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .filter(Trapgroup.survey_id.in_(survey_ids))

        if site != '0':
            images = images.filter(Trapgroup.tag==site)
 
        if start_date: 
            images = images.filter(Image.corrected_timestamp >= start_date)

        if end_date: 
            images = images.filter(Image.corrected_timestamp <= end_date)

        if order == 'a1':
            images = images.order_by(Image.corrected_timestamp)
        elif order == 'd1':
            images = images.order_by(desc(Image.corrected_timestamp))
        elif order == 'a2':
            images = images.order_by(Trapgroup.tag)
        elif order == 'd2':
            images = images.order_by(desc(Trapgroup.tag))
        elif order == 'a3':
            images = images.order_by(Image.detection_rating)
        elif order == 'd3':
            images = images.order_by(desc(Image.detection_rating))

        images = images.distinct().all()

        for image in images:
            image_id = image[0]
            filename = image[1]
            timestamp = stringify_timestamp(image[2])
            detection_id = image[3]
            static = image[4]
            top = image[5]
            left = image[6]
            right = image[7]
            bottom = image[8]
            flank = Config.FLANK_TEXT[image[9]].capitalize()
            path = image[10]
            trapgroup_id = image[11]
            tag = image[12]
            latitude = image[13]
            longitude = image[14]
            altitude = image[15]
            video_url = None

            reply.append({
                'id': image_id,
                'url': (path + '/' + filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'video_url': video_url,
                'timestamp': timestamp,
                'trapgroup':{
                    'id': trapgroup_id,
                    'tag': tag,
                    'latitude': latitude,
                    'longitude': longitude,
                    'altitude': altitude
                },
                'detections': [{
                    'id': detection_id,
                    'static': static,
                    'top': top,
                    'left': left,
                    'right': right,
                    'bottom': bottom,
                    'flank': flank
                }]
            })

        if survey_ids:
            access = 'write' if all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks) else 'read'
        else:
            access = 'hidden'

    return json.dumps({'individual': reply, 'access': access})

@app.route('/getCameraStamps')
@login_required
def getCameraStamps():
    '''Returns a list of all cameras in a survey along with the timestamp of their first image, and it's corrected timestamp.'''
    
    reply = []
    next_url = None
    prev_url = None
    page = request.args.get('page', 1, type=int)
    survey_id = request.args.get('survey_id', None, type=int)
    # order = request.args.get('order', 5, type=int)
    # search = request.args.get('search', '', type=str)

    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey_id,'read'):
        data = db.session.query(Trapgroup.tag, Cameragroup.id, Cameragroup.name, func.min(Image.corrected_timestamp))\
                            .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                            .join(Cameragroup, Cameragroup.id==Camera.cameragroup_id)\
                            .join(Image)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Image.corrected_timestamp!=None)\
                            .group_by(Trapgroup.id, Cameragroup.id)\
                            .order_by(Trapgroup.tag)\
                            .paginate(page, 10, False)

        temp_results = {}
        for row in data.items:
            if row[0] not in temp_results.keys():
                temp_results[row[0]] = []
            temp_results[row[0]].append({   'id': row[1],
                                            'folder': row[2],
                                            'corrected_timestamp': stringify_timestamp(row[3])})

        for key in temp_results.keys():
            reply.append({'tag': key, 'cameras': temp_results[key]})

        next_url = url_for('getCameraStamps', page=data.next_num, survey_id=survey_id) if data.has_next else None
        prev_url = url_for('getCameraStamps', page=data.prev_num, survey_id=survey_id) if data.has_prev else None

    return json.dumps({'survey': survey_id, 'data': reply, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getAllLabelsTagsTraps')
@login_required
def getAllLabelsTagsTraps():
    # labels = [r[0] for r in db.session.query(Label.description).join(Task).join(Survey).filter(Survey.user_id==current_user.id).distinct().all()]
    # tags = [r[0] for r in db.session.query(Tag.description).join(Task).join(Survey).filter(Survey.user_id==current_user.id).distinct().all()]
    # traps = [r[0] for r in db.session.query(Trapgroup.tag).join(Survey).filter(Survey.user_id==current_user.id).distinct().all()]

    labels = [r[0] for r in surveyPermissionsSQ(db.session.query(Label.description).join(Task).join(Survey),current_user.id,'read').distinct().all()]
    tags = [r[0] for r in surveyPermissionsSQ(db.session.query(Tag.description).join(Task).join(Survey),current_user.id,'read').distinct().all()]
    traps = [r[0] for r in surveyPermissionsSQ(db.session.query(Trapgroup.tag).join(Survey),current_user.id,'read').distinct().all()]

    return json.dumps({'labels': labels, 'tags': tags, 'traps': traps})

@app.route('/getTags/<individual_id>')
@login_required
def getTags(individual_id):
    '''Returns the available tags for that individual'''

    reply = []
    individual = db.session.query(Individual).get(individual_id)
    if individual and individual.active and any(checkSurveyPermission(current_user.id,task.survey_id,'read') for task in individual.tasks):
        tags = db.session.query(Tag).join(Task).filter(Task.individuals.contains(individual)).distinct().all()
        for tag in tags:
            if tag.description not in [r['tag'] for r in reply]:
                reply.append({'id': tag.id, 'tag': tag.description, 'hotkey': tag.hotkey})

    return json.dumps(reply)

@app.route('/submitTagsIndividual/<individual_id>', methods=['POST'])
@login_required
def submitTagsIndividual(individual_id):
    ''' Edits the tags for the specified individual'''

    individual = db.session.query(Individual).get(individual_id)
    tags = ast.literal_eval(request.form['tags'])
    if Config.DEBUGGING: app.logger.info('Submit Individual tags: {}'.format(tags))

    if individual and individual.active and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
        if tags:
            individual.tags = db.session.query(Tag).join(Task).filter(Task.individuals.contains(individual)).filter(Tag.description.in_(tags)).distinct().all()
        else:
            individual.tags = []
        db.session.commit()

        return json.dumps('success')
    
    return json.dumps('')

@app.route('/getTaggingLevelsbyTask/<task_id>/<task_type>')
@login_required
def getTaggingLevelsbyTask(task_id,task_type):
    '''Returns the available tagging levels and label-completion info for the specified task and tagging type.'''

    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)

    if task_type=='individualID':
        texts = []
        values = []
        colours = []
        disabled = {}
        labels = db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.children.any()).all()

        for label in labels:

            if label.icID_allowed:
                disabled[label.description] = 'false'
            else:
                disabled[label.description] = 'true'

            if label.icID_allowed:
                count = label.icID_count
                if count==0:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')
            else:
                if label.unidentified_count == None:
                    task.status = 'Processing'
                    db.session.commit()
                    updateAllStatuses.delay(task_id=task_id,status=True)
                    return json.dumps({'texts': [], 'values': [], 'disabled':{}, 'colours':[]})

                count = label.unidentified_count

                if count==0:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')
            
            texts.append(label.description)
            values.append(label.id)

    elif task_type=='AIcheck':
        values = ['-3']
        disabled = 'true'

        if task.class_check_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        check = task.class_check_count

        texts = ['AI check ('+str(check)+')']

        if check>0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

    elif task_type=='related':
        values = ['-8']
        disabled = 'true'

        if task.related_check_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        check = task.related_check_count

        texts = ['Related check ('+str(check)+')']

        if check>0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

    elif task_type=='differentiation':
        disabled = 'true'

        if task.unchecked_multi_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
    
        uncheckedMulti = task.unchecked_multi_count

        if uncheckedMulti>0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

        texts = ['Multiples ('+str(uncheckedMulti)+')']
        values = ['-1']

    elif task_type=='bounding':
        disabled = 'false'
        colours = []
        texts = []
        values = []

        for label in task.labels:
            if label.bounding_count == None:
                task.status = 'Processing'
                db.session.commit()
                updateAllStatuses.delay(task_id=task_id,status=True)
                return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})

            if label.bounding_count==0:
                colours.append('#0A7850')
            else:
                colours.append('#000000')
            
            texts.append(label.description+' ('+str(label.bounding_count)+')')
            values.append(label.id)

        # VHL
        if task.vhl_bounding_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        vhl_bounding_count = task.vhl_bounding_count
        texts.append('Vehicles/Humans/Livestock ('+str(vhl_bounding_count)+')')
        values.append(GLOBALS.vhl_id)


    elif task_type=='clusterTag':

        if not task.init_complete:
            disabled = 'true'
        else:
            disabled = 'false'

        if task.unlabelled_animal_cluster_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        check = task.unlabelled_animal_cluster_count

        if check != 0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']
        texts = ['Top-level ('+str(check)+')']
        values = ['-1']

        if disabled == 'false':
            for label in task.labels:
                if label.complete==True:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')

                if label.cluster_count == None:
                    task.status = 'Processing'
                    db.session.commit()
                    updateAllStatuses.delay(task_id=task_id,status=True)
                    return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
                
                texts.append(label.description+' ('+str(label.cluster_count)+')')
                values.append(label.id)

            #VHL
            if task.vhl_count == None:
                task.status = 'Processing'
                db.session.commit()
                updateAllStatuses.delay(task_id=task_id,status=True)
                return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
            
            count = task.vhl_count
            texts.append('Vehicles/Humans/Livestock ('+str(count)+')')
            values.append(GLOBALS.vhl_id)

    elif task_type=='infoTag':
        disabled = 'false'
        
        if task.infoless_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        check = task.infoless_count

        if check != 0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

        texts = ['All ('+str(check)+')']
        values = ['-2']
        for label in task.labels:
            if label.info_tag_count == None:
                task.status = 'Processing'
                db.session.commit()
                updateAllStatuses.delay(task_id=task_id,status=True)
                return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})

            if label.info_tag_count != 0:
                colours.append('#000000')
            else:
                colours.append('#0A7850')
            
            texts.append(label.description+' ('+str(label.info_tag_count)+')')
            values.append('-2,'+str(label.id))

        # VHL
        if (task.infoless_vhl_count == None) and (task.infoless_count != None):
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        count = task.infoless_vhl_count
        texts.append('Vehicles/Humans/Livestock ('+str(count)+')')
        values.append('-2,'+str(label.id))

    
    elif task_type=='empty':
        values = ['-7']
        disabled = 'true'

        if task.empty_count == None:
            task.status = 'Processing'
            db.session.commit()
            updateAllStatuses.delay(task_id=task_id,status=True)
            return json.dumps({'texts': [], 'values': [], 'disabled':'false', 'colours':[]})
        
        check = task.empty_count

        texts = ['Empty ('+str(check)+')']

        if check>0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']


    # elif task_type=='maskedTag':
    #     # NOTE: This is not currently used (is for check masked sightings)
    #     disabled = 'true'
    #     uncheckedMask = db.session.query(Detection)\
    #                                 .join(Labelgroup)\
    #                                 .join(Image)\
    #                                 .join(Cluster, Image.clusters)\
    #                                 .filter(Cluster.task_id==task_id)\
    #                                 .filter(Detection.status=='masked')\
    #                                 .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
    #                                 .filter(Detection.static == False) \
    #                                 .filter(Labelgroup.task_id==task_id)\
    #                                 .filter(Labelgroup.checked==False)\
    #                                 .distinct().count()

    #     if uncheckedMask>0:
    #         colours = ['#000000']
    #     else:
    #         colours = ['#0A7850']

    #     texts = ['Masked Sightings ('+str(uncheckedMask)+')']
    #     values = ['-6']



    return json.dumps({'texts': texts, 'values': values, 'disabled':disabled, 'colours':colours})

@app.route('/stopTask/<task_id>')
@login_required
def stopTask(task_id):
    '''Stops the specified task and does all necessary clean up. Returns success on completion, error otherwise.'''

    task = db.session.query(Task).get(int(task_id))
    tasks = [t for t in task.sub_tasks]
    tasks.append(task)
    if task and all(checkSurveyPermission(current_user.id,t.survey_id,'write') for t in tasks) and (task.status.lower() not in Config.TASK_READY_STATUSES):
        task.status = 'Stopping'
        db.session.commit()
        stop_task.apply_async(kwargs={'task_id':task_id})
        return json.dumps('success')

    return json.dumps('error')

@app.route('/deleteTask/<task_id>')
@login_required
def deleteTask(task_id):
    '''Deletes the specified task. Returns a success/error status and associated message.'''

    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)
    # if (task!=None) and (task.survey.user_id==current_user.id):
    # if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
    if task:
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==task.survey.organisation_id).filter(UserPermissions.user_id==current_user.id).first()
        if userPermissions and userPermissions.delete:
            if task.status.lower() not in Config.TASK_READY_STATUSES:
                status = 'error'
                message = 'The task is currently in use. Please stop it first.'
            else:  

                # Check if any surveys are busy with a dearchival process
                if task.survey.status == 'Restoring Files':
                    status = 'error'
                    message = 'Your survey is currently having files restored from archive. Deleting an annotation set is not possible during this process. Please wait until the 48 hour restoration period has completed.'

                else:
                    task.status = 'Deleting'
                    db.session.commit()
                    status = 'success'
                    message = ''

                    app.logger.info('Deleting task {}.'.format(task_id))
                    delete_task.delay(task_id=task_id)
        else:
            status = 'error'
            message = 'Task cannot be deleted.'
    else:
        status = 'error'
        message = 'The task cannot be found.'

    return json.dumps({'status': status, 'message': message})

@app.route('/deleteSurvey/<survey_id>')
@login_required
def deleteSurvey(survey_id):
    '''Deletes the survey belonging to the current user with the specified name and all associated tasks. Returns a success/error status and associated message.'''

    status = 'success'
    message = ''

    survey = db.session.query(Survey).get(survey_id)
    if survey:
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==survey.organisation_id).filter(UserPermissions.user_id==current_user.id).first()

        if userPermissions and userPermissions.delete:

            if survey.status.lower() == 'uploading':
                if not checkUploadUser(current_user.id,survey_id):
                    status = 'error'
                    message = 'The survey is currently being uploaded to by another user.'

            if 'preprocessing' in survey.status.lower():
                prep_statusses = survey.status.split(',')
                if 'In Progress' in prep_statusses:
                    status = 'error'
                    message = 'The survey is currently being preprocessed by another user.'


            # Check if any surveys are busy with a dearchival process
            if survey.status == 'Restoring Files':
                status = 'error'
                message = 'Your survey is currently having files restored from archive. Deleting your survey is not possible during this process. Please wait until the 48 hour restoration period has completed.'

            if Config.DISABLE_RESTORE:
                status = 'error'
                message = 'Deleting surveys is currently disabled. Please try again later.'

            #Check that survey is not in use
            if status != 'error':
                if (survey.status.lower() in Config.SURVEY_READY_STATUSES) or (survey.status.lower() == 'uploading') or ('preprocessing' in survey.status.lower()):
                    pass
                else:
                    status = 'error'
                    message = 'The survey is currently in use. Please try again later.'

            if status != 'error':
                tasks = db.session.query(Task).filter(Task.survey_id==survey_id).all()
                for task in tasks:
                    if task.status.lower() not in Config.TASK_READY_STATUSES:
                        status = 'error'
                        message = 'A task from this survey is currently launched. Please stop it before deleting this survey.'
            
            if status != 'error':
                app.logger.info('Deleting survey {}.'.format(survey_id))
                delete_survey.delay(survey_id=survey_id)

                for task in tasks:
                    task.status = 'Deleting'
                survey.status = 'Deleting'
                db.session.commit()
        else:
            status = 'error'
            message = 'You do not have permission to delete this survey.'
    else:
        status = 'error'
        message = 'Could not find survey.'

    return json.dumps({'status': status, 'message': message})

# @app.route('/deleteImages/<survey_id>')
# @login_required
# def deleteImages(survey_id):
#     '''Deletes all images associated with a survey belonging to the user with the specified name.'''

#     survey = db.session.query(Survey).get(survey_id)
#     if survey:
#         survey.status = 'Cancelled'
#         db.session.commit()
#         delete_images(surveyName,survey.user.folder)
#     return json.dumps('')

@app.route('/updateSurveyStatus/<survey_id>/<status>')
@login_required
def updateSurveyStatus(survey_id, status):
    '''Updates the status of the survey belonging to the requester with the specified name with the specified status.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey:
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==survey.organisation_id).filter(UserPermissions.user_id==current_user.id).first()

        if userPermissions and userPermissions.create:

            if status == 'Import Queued':
                if survey.status == 'Uploading':
                    survey.status = status
                    db.session.commit()
                    GLOBALS.redisClient.delete('upload_ping_'+str(survey_id))
                    GLOBALS.redisClient.delete('upload_user_'+str(survey_id))
                    # import_survey.delay(survey_id=survey.id, used_lambda=True)
                    GLOBALS.redisClient.set('upload_complete_'+str(survey_id), datetime.utcnow().timestamp())
                else:
                    return json.dumps('error')
            else:
                survey.status = status
                db.session.commit()

    return json.dumps('')

@app.route('/checkSightingEditStatus', methods=['POST'])
@login_required
def checkSightingEditStatus():
    '''Checks if a species has had its bounding boxes checked/edited for the specified task. Returns a warning status and associated message if it hasn't.'''

    task_ids = ast.literal_eval(request.form['task_ids'])
    species = ast.literal_eval(request.form['species'])

    status = 'success'
    message = ''

    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey), current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()

        task_ids = [r[0] for r in tasks]
    
        subq = db.session.query(labelstable.c.cluster_id.label('clusterID'), func.count(distinct(labelstable.c.label_id)).label('labelCount')) \
                        .join(Cluster,Cluster.id==labelstable.c.cluster_id) \
                        .filter(Cluster.task_id.in_(task_ids)) \
                        .group_by(labelstable.c.cluster_id) \
                        .subquery()

        test1 = db.session.query(Labelgroup) \
                        .join(Detection) \
                        .join(Image) \
                        .join(Cluster, Image.clusters) \
                        .join(subq, subq.c.clusterID==Cluster.id) \
                        .filter(Labelgroup.task_id.in_(task_ids)) \
                        .filter(Cluster.task_id.in_(task_ids)) \
                        .filter(Labelgroup.checked==False) \
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static==False) \
                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                        .filter(subq.c.labelCount>1).first()

        if test1:
            status = 'warning'
            message = 'WARNING: You have selected a detection-based count, but you have yet to correct the sightings for the mutiple-label clusters in this task. As such, the count presented will be of reduced accuracy.'
        else:
            test2 = db.session.query(Labelgroup) \
                            .join(Detection) \
                            .filter(Labelgroup.task_id.in_(task_ids)) \
                            .filter(Labelgroup.checked==False) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                            .filter(Detection.static==False)

            if species not in ['All','None','', '0', '-1']:
                label = db.session.query(Label).filter(Label.task_id.in_(task_ids)).filter(Label.description==species).first()
                test2 = test2.filter(Labelgroup.labels.contains(label))
            else:
                test2 = test2.filter(Labelgroup.labels.any()).filter(~Labelgroup.labels.any(Label.id.in_([GLOBALS.vhl_id,GLOBALS.knocked_id,GLOBALS.nothing_id])))

            test2 = test2.first()

            if test2:
                status = 'warning'
                message = 'WARNING: You have selected a detection-based count, but have yet to correct the sightings for one or more species in the selection. As such, the count presented will be of slightly reduced accuracy.'

    return json.dumps({'status':status,'message':message})

@app.route('/imageViewer')
@login_required
def imageViewer():
    '''
    Renders the image-viewer template with the specified images.
    
        Paramters:
            type (str): The level of abastration being requested - survey, trapgroup, camera, cluster, image
            id (int): The ID number of the requested object

        Returns:
            All images as a cluster-like dictionary
    '''

    try:
        view_type = request.args.get('type', None)
        id_no = request.args.get('id', None)
        include_detections = request.args.get('detections', 'False')
        comparisonsurvey = request.args.get('comparisonsurvey', None)
        admin=db.session.query(User).filter(User.username=='Admin').first()
        hasPermission = False
        reqImages = []
        if view_type=='image':
            image = db.session.query(Image).get(int(id_no))
            # if image and ((image.camera.trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
            if image and checkSurveyPermission(current_user.id,image.camera.trapgroup.survey_id,'read'):
                hasPermission = True
                if not image.zip_id: reqImages = [image]

        elif view_type=='capture':
            image = db.session.query(Image).get(int(id_no))
            # if image and ((image.camera.trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
            if image and checkSurveyPermission(current_user.id,image.camera.trapgroup.survey_id,'read'):
                hasPermission = True
                reqImages = db.session.query(Image)\
                                .filter(Image.camera_id==image.camera_id)\
                                .filter(Image.corrected_timestamp==image.corrected_timestamp)\
                                .filter(Image.zip_id==None)\
                                .distinct().all()

        elif view_type=='cluster':
            cluster = db.session.query(Cluster).get(int(id_no))
            # if cluster and ((cluster.task.survey.user==current_user) or (current_user.id==admin.id)):
            if cluster and checkSurveyPermission(current_user.id,cluster.task.survey_id,'read'):
                hasPermission = True
                reqImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).filter(Image.zip_id==None).order_by(Image.corrected_timestamp).distinct().all()

        elif view_type=='camera':
            cameragroup = db.session.query(Cameragroup).get(int(id_no))
            if cameragroup and checkSurveyPermission(current_user.id,cameragroup.cameras[0].trapgroup.survey_id,'read'):
                hasPermission = True
                reqImages = db.session.query(Image)\
                                .join(Camera)\
                                .filter(Camera.cameragroup_id==cameragroup.id)\
                                .filter(Image.zip_id==None)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        elif view_type=='trapgroup':
            trapgroup = db.session.query(Trapgroup).get(int(id_no))
            # if trapgroup and ((trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
            if trapgroup and checkSurveyPermission(current_user.id,trapgroup.survey_id,'read'):
                hasPermission = True
                reqImages = db.session.query(Image)\
                                .join(Camera)\
                                .filter(Camera.trapgroup==trapgroup)\
                                .filter(Image.zip_id==None)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        elif view_type=='survey':
            survey = db.session.query(Survey).get(int(id_no))
            # if survey and ((survey.user==current_user) or (current_user.id==admin.id)):
            if survey and checkSurveyPermission(current_user.id,survey.id,'read'):
                hasPermission = True
                reqImages = db.session.query(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .filter(Trapgroup.survey==survey)\
                                .filter(Image.zip_id==None)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        if hasPermission and (len(reqImages) == 0):
            return render_template("html/block.html",text="This item cannot be viewed.", helpFile='block', version=Config.VERSION)

        if comparisonsurvey:
            check = db.session.query(Survey).get(comparisonsurvey)

        # if (len(reqImages) == 0) or (comparisonsurvey and ((check.user!=current_user) and (current_user.id!=admin.id))):
        if (len(reqImages) == 0) or (comparisonsurvey and not checkSurveyPermission(current_user.id,check.id,'read')):
            return render_template("html/block.html",text="You do not have permission to view this item.", helpFile='block', version=Config.VERSION)

        images = [{'id': image.id,
                'url': (image.camera.path + '/' + image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'detections': [{'id': detection.id,
                                        'top': detection.top,
                                        'bottom': detection.bottom,
                                        'left': detection.left,
                                        'right': detection.right,
                                        'category': detection.category,
                                        'individual': '-1',
                                        'static': detection.static}
                                        for detection in image.detections
                                        if ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and 
                                        (detection.status not in Config.DET_IGNORE_STATUSES) and 
                                        (detection.static == False) and 
                                        (include_detections.lower()=='true')) ],
                'comparison': [{'id': detection.id,
                                        'top': detection.top,
                                        'bottom': detection.bottom,
                                        'left': detection.left,
                                        'right': detection.right,
                                        'category': detection.category,
                                        'individual': '-1',
                                        'static': detection.static}
                                        for detection in db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==comparisonsurvey).filter(Camera.path==image.camera.path).filter(Image.filename==image.filename).distinct().all()
                                        if (comparisonsurvey) and 
                                        ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and 
                                        (detection.status not in Config.DET_IGNORE_STATUSES) and 
                                        (detection.static == False) and 
                                        include_detections.lower()=='true') ]
                } for image in reqImages]

        result = json.dumps([{'id': '-444','classification': ['None'],'required': [], 'images': images, 'label': ['None'], 'tags': ['None'], 'groundTruth': [], 'trapGroup': 'None'}])

        return render_template('html/imageViewer.html', title='Image Viewer', clusters=result, helpFile='image_viewer', bucket=Config.BUCKET, version=Config.VERSION)

    except:
        return render_template("html/block.html",text="You do not have permission to view this item.", helpFile='block', version=Config.VERSION)

@app.route('/createNewSurvey', methods=['POST'])
@login_required
def createNewSurvey():
    '''
    Creates a new survey for the current user with the specified parameters. Begins the import immediately if a bucket upload, otherwise waits until browser upload is complete. 
    Returns a success/error status and associated message.
    
        Parameters:
            surveyName (str): The name for the survey
            newSurveyDescription (str): The survey description
            newSurveyTGCode (str): The regular expression trapgroup code
            newSurveyS3Folder (str): The AWS S3 folder where the survey images are found
            checkbox (str): Whether the specified trapgroup code is advanced or not
            correctTimestamps (str): Whether the timestamp correction algorithm should be run or not
    '''

    notAllowed = ['/', ',', '.', '"', "'"]
    status = 'success'
    message = ''
    organisation_id = request.form['organisation_id']
    newSurvey_id = 0
    surveyName = ''
    browser_upload = False
    action = None

    organisation = db.session.query(Organisation).get(organisation_id)
    userPermissions = db.session.query(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==organisation_id).first()

    if organisation and userPermissions and userPermissions.create:
        surveyName = request.form['surveyName']
        newSurveyDescription = request.form['newSurveyDescription']
        newSurveyTGCode = request.form['newSurveyTGCode']
        newSurveyS3Folder = request.form['newSurveyS3Folder']
        checkbox = request.form['checkbox']
        correctTimestamps = request.form['correctTimestamps']
        classifier_id = request.form['classifier_id']
        permission = request.form['permission']
        annotation = request.form['annotation']
        newSurveyCamCode = request.form['newSurveyCamCode']
        camCheckbox = request.form['camCheckbox']
        dataSource = request.form['dataSource']
        triggerSource = request.form['triggerSource']
        ignoreSmallDets = request.form['ignoreSmallDets']
        ignoreSkyDets = request.form['ignoreSkyDets']

        if 'detailed_access' in request.form:
            detailed_access = ast.literal_eval(request.form['detailed_access'])
        else:
            detailed_access = None

        emptySurvey = False
        if 'emptySurvey' in request.form:
            emptySurvey = request.form['emptySurvey']
            if emptySurvey == 'true':
                emptySurvey = True
                newSurveyS3Folder=surveyName

        surveyName = surveyName.strip()
        if newSurveyS3Folder=='none':
            browser_upload = True
            newSurveyS3Folder=surveyName

        if 'kml' in request.files:
            uploaded_file = request.files['kml']
            fileAttached = True
        else:
            fileAttached = False

        if checkbox=='false':
            newSurveyTGCode = newSurveyTGCode+'[0-9]+'

        if camCheckbox=='false' and newSurveyCamCode != 'None':
            newSurveyCamCode = newSurveyCamCode+'[0-9]+'

        if newSurveyCamCode == 'None':
            newSurveyCamCode = None

        if correctTimestamps=='true':
            correctTimestamps=True
        else:
            correctTimestamps=False

        if newSurveyDescription == 'None':
            newSurveyDescription = ''

        if ignoreSmallDets=='true':
            ignoreSmallDets=True
        else:
            ignoreSmallDets=False

        if ignoreSkyDets=='true':
            ignoreSkyDets=True
        else:
            ignoreSkyDets=False

        for item in notAllowed:
            if item in surveyName:
                status = 'error'
                message = 'Survey name cannot contain slashes or special characters.'

        test = db.session.query(Survey).filter(Survey.organisation_id==organisation_id).filter(Survey.name==surveyName).first()
        if test != None:
            status = 'error'
            message = 'Survey name already in use.'
        else:
            if newSurveyS3Folder=='none':
                # Browser upload - check that folder doesn't already exist
                response = GLOBALS.s3client.list_objects(Bucket=Config.BUCKET, Prefix=organisation.folder+'/'+surveyName, Delimiter='/',MaxKeys=1)
                if 'CommonPrefixes' in response:
                    status = 'error'
                    message = 'That folder name is already in use in your storage. Please try another name for your survey.' 

        if fileAttached:
            if uploaded_file.filename != '':
                if os.path.splitext(uploaded_file.filename)[1].lower() == '.kml':
                    pass    
                else:
                    status = 'error'
                    message = 'Coordinates file must be a kml file.'
            else:
                status = 'error'
                message = 'Coordinates file must have a name.' 

        # test = db.session.query(Survey).filter(Survey.organisation_id==organisation_id).filter(Survey.status=='Uploading').first()
        # if test and (newSurveyS3Folder=='none'):
        #     status = 'error'
        #     message = 'You already have an upload in progress. You must either finish that, or delete it in order to start a new one.' 

        if status == 'success':

            if fileAttached:
                key = organisation.folder + '-comp/kmlFiles/' + surveyName + '.kml'
                with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
                    uploaded_file.save(temp_file.name)
                    GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)

            # Create survey
            if emptySurvey:
                newSurvey = Survey(name=surveyName, description=newSurveyDescription, organisation_id=organisation_id, status='Ready', correct_timestamps=correctTimestamps, classifier_id=int(classifier_id), folder=newSurveyS3Folder, type=dataSource, trigger_source=triggerSource, ignore_small_detections=ignoreSmallDets, sky_masked=ignoreSkyDets)
                db.session.add(newSurvey)

                defaultTask = Task(name='default', survey=newSurvey, tagging_level='-1', test_size=0, status='Ready')
                db.session.add(defaultTask)
            else:
                newSurvey = Survey(name=surveyName, description=newSurveyDescription, trapgroup_code=newSurveyTGCode, organisation_id=organisation_id, status='Uploading', correct_timestamps=correctTimestamps, classifier_id=int(classifier_id), camera_code=newSurveyCamCode, folder=newSurveyS3Folder, type=dataSource, trigger_source=triggerSource, ignore_small_detections=ignoreSmallDets, sky_masked=ignoreSkyDets)
                db.session.add(newSurvey)

            # Add permissions
            setup_new_survey_permissions(survey=newSurvey, organisation_id=organisation_id, user_id=current_user.id, permission=permission, annotation=annotation, detailed_access=detailed_access)

            db.session.commit()

            if not emptySurvey:
                if browser_upload:
                    # Browser upload
                    newSurvey_id = newSurvey.id

                    # Checkout the upload
                    checkUploadUser(current_user.id,newSurvey_id)
                    action = 'upload'
                    GLOBALS.redisClient.set('lambda_invoked_'+str(newSurvey_id),0)
                    GLOBALS.redisClient.set('lambda_completed_'+str(newSurvey_id),0)
                    GLOBALS.redisClient.set('upload_complete_'+str(newSurvey_id), 'False')
                else:
                    # Bucket upload
                    import_survey.delay(survey_id=newSurvey.id)
                    action = 'import'
            else:
                action = 'empty'
    
        return json.dumps({'status': status, 'message': message, 'newSurvey_id': newSurvey_id, 'surveyName':surveyName, 'action': action})
    else:
        return json.dumps({'status': 'error', 'message': 'You do not have permission to create surveys for this organisation.'})

@app.route('/pipelineData', methods=['POST'])
@login_required
def pipelineData():
    '''An endpoint only availble to the admin user that allows them to process pre-annotated data for training purposes.'''

    status = 'success'
    message = ''
    admin = db.session.query(User).filter(User.username=='Admin').first()

    if current_user==admin:

        if 'surveyName' in request.form:
            surveyName = request.form['surveyName']
        else:
            surveyName = None

        if 'bucketName' in request.form:
            bucketName = request.form['bucketName']
        else:
            bucketName = None

        if 'dataSource' in request.form:
            dataSource = request.form['dataSource']
        else:
            dataSource = None

        if 'trapgroupCode' in request.form:
            trapgroupCode = request.form['trapgroupCode']
        else:
            trapgroupCode = None

        if 'min_area' in request.form:
            min_area = float(request.form['min_area'])
        else:
            min_area = None

        if 'exclusions' in request.form:
            exclusions = ast.literal_eval(request.form['exclusions'])
        else:
            exclusions = []

        if 'sourceBucket' in request.form:
            sourceBucket = request.form['sourceBucket']
        else:
            sourceBucket = None

        if 'label_source' in request.form:
            label_source = request.form['label_source']
        else:
            label_source = None

        if 'organisation_id' in request.form:
            organisation_id = request.form['organisation_id']
        else:
            organisation_id = None

        if surveyName and bucketName and dataSource and trapgroupCode and min_area:
            if 'csv' in request.files:
                uploaded_file = request.files['csv']
                fileAttached = True
            else:
                fileAttached = False

            test = db.session.query(Survey).filter(Survey.organisation_id==organisation_id).filter(Survey.name==surveyName).first()
            if test != None:
                status = 'error'
                message = 'Survey name already in use.'

            if fileAttached:
                if uploaded_file.filename != '':
                    if os.path.splitext(uploaded_file.filename)[1].lower() == '.csv':
                        pass    
                    else:
                        status = 'error'
                        message = 'File must be a csv.'
                else:
                    status = 'error'
                    message = 'File must have a name.'

            if status == 'success':

                if fileAttached:
                    key = 'csvFiles/' + surveyName + '.csv'
                    if not os.path.exists('csvFiles'):
                        os.mkdir('csvFiles')
                    uploaded_file.save(key)
                    GLOBALS.s3client.put_object(Bucket=bucketName,Key=key,Body=open(key, 'rb'))

                pipeline_survey.delay(surveyName=surveyName,bucketName=bucketName,dataSource=dataSource, trigger_source='motion',fileAttached=fileAttached,
                                        trapgroupCode=trapgroupCode,min_area=min_area,exclusions=exclusions,sourceBucket=sourceBucket,
                                        label_source=label_source)
        else:
            status='error'
            message='Insufficient arguments supplied.'
    else:
        status='error'
        message='Access denied.'

    return json.dumps({'status': status, 'message': message})

@app.route('/getClassificationDsLables', methods=['POST'])
@login_required
def getClassificationDsLables():
    '''
    Looks for the global classification_ds file in the specified bucket, and returns the list of unique labels. 
    Generates such a file if it does not exists.
    '''

    reply=[]
    admin = db.session.query(User).filter(User.username=='Admin').first()
    if current_user==admin:

        if 'sourceBucket' in request.form:
            sourceBucket = request.form['sourceBucket']
        else:
            sourceBucket = None

        # try download classification_ds. Create a new one otherwise.
        try:
            with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                GLOBALS.s3client.download_file(Bucket=sourceBucket, Key='classification_ds/classification_ds.csv', Filename=temp_file.name)
                df = pd.read_csv(temp_file.name)

            labels = sorted(list(set([r.lower() for r in df['label'].unique()])))

            for label in labels:
                reply.append({
                    'name': label,
                    'count': len(df[df['label'].str.lower()==label])
                })

        except:
            generate_classification_ds.delay(sourceBucket=sourceBucket)

    return json.dumps(reply)

@app.route('/requestLabelSpec', methods=['POST'])
@login_required
def requestLabelSpec():
    '''Recieves the label translations, and generates a label_spec file for classifier training.'''

    status = 'success'
    message = ''
    admin = db.session.query(User).filter(User.username=='Admin').first()
    if current_user==admin:

        if 'sourceBucket' in request.form:
            sourceBucket = request.form['sourceBucket']
        else:
            sourceBucket = None
            status = 'error'
            message = 'Source bucket not specified.'

        if 'translations' in request.form:
            translations = ast.literal_eval(request.form['translations'])
        else:
            translations = {}
            status = 'error'
            message = 'Translations not specified.'

        if status == 'success':
            generate_label_spec.delay(sourceBucket=sourceBucket,translations=translations)

    return json.dumps({'status': status, 'message': message})

@app.route('/checkTrapgroupCode', methods=['POST'])
@login_required
def checkTrapgroupCode():
    '''Checks the user's specified trapgroup code and returns the detected trapgroups in the specified folder.'''

    status = 'FAILURE'
    reply = None
    userPermissions = None
    survey_id = None
    organisation_id = None

    if 'task_id' in request.form:
        task_id = request.form['task_id']
    else:
        task_id = None
        
    if 'surveyName' in request.form:
        surveyName = request.form['surveyName']
    else:
        surveyName = None

    if 'organisation_id' in request.form:
        organisation_id = request.form['organisation_id']
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==organisation_id).first()

    if 'survey_id' in request.form:
        survey_id = request.form['survey_id']
        survey = db.session.query(Survey).get(survey_id)
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==survey.organisation_id).first()
        organisation_id = survey.organisation.id

    if userPermissions and userPermissions.create:
        if 'revoke_id' in request.form:
            try:
                celery.control.revoke(request.form['revoke_id'], terminate=True)
            except:
                pass

        if task_id:
            if task_id == 'none':
                tgCode = request.form['tgCode']
                folder = request.form['folder']
                camCode = request.form['camCode']
                task = findTrapgroupTags.apply_async(kwargs={'tgCode':tgCode,'folder':folder,'organisation_id':organisation_id,'surveyName':surveyName,'camCode':camCode})
                task_id = task.id
                status = 'PENDING'
            else:
                task = findTrapgroupTags.AsyncResult(task_id)
                status = task.state
                if status == 'SUCCESS':
                    reply = task.result
                    task.forget()

    return json.dumps({'status':status,'data':reply,'task_id':task_id})

@app.route('/getFolders')
@login_required
def getFolders():
    '''Fetches the list of folders in the user's S3 folder.'''
    
    org_id = request.args.get('org_id', None)
    survey_id = request.args.get('survey_id', None)
    folders = []
    if current_user.is_authenticated:
        if org_id:
            organisations = db.session.query(Organisation).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.create==True).all()
        elif survey_id:
            organisations = db.session.query(Organisation).join(UserPermissions).join(Survey).filter(UserPermissions.user_id==current_user.id).filter(Survey.id==survey_id).filter(UserPermissions.create==True).all()
        else:
            organisations = db.session.query(Organisation).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.create==True).all()
       
        for organisation in organisations:
            folders.extend(list_all(Config.BUCKET,organisation.folder+'/')[0])
            if 'Downloads' in folders: folders.remove('Downloads')

    return json.dumps(folders)

@app.route('/getSurveysAndTasksByUser/<organisation_id>')
@login_required
def getSurveysAndTasksByUser(organisation_id):
    '''Allows the admin user to get a list of all surveys and associated tasks for a specified organisation_id.'''

    reply=[]
    admin = db.session.query(User).filter(User.username=='Admin').first()
    if current_user==admin:
        surveys = db.session.query(Survey).filter(Survey.organisation_id==int(organisation_id)).distinct().all()
        
        for survey in surveys:
            survey_info = {'id': survey.id, 'name': survey.name, 'tasks': []}
            
            for task in survey.tasks:
                if (task.name != 'default') and ('_o_l_d_' not in task.name):
                    survey_info['tasks'].append({'value': task.id, 'name': task.name})

            reply.append(survey_info)

    return json.dumps(reply)

@app.route('/generateTrainingCSV', methods=['POST'])
@login_required
def generateTraingCSV():
    '''An endpoint only available to the admin user that allows them to generate a classifier training csv.'''

    status = 'success'
    message = ''
    admin = db.session.query(User).filter(User.username=='Admin').first()

    if current_user==admin:

        if 'min_area' in request.form:
            min_area = float(request.form['min_area'])
        else:
            min_area = None

        if 'tasks' in request.form:
            tasks = [int(r) for r in ast.literal_eval(request.form['tasks'])]
        else:
            tasks = []

        if 'bucketName' in request.form:
            destBucket = request.form['bucketName']
        else:
            destBucket = None

        if destBucket and min_area and (len(tasks)>0) and (status == 'success'):
            app.logger.info('Training csv requested for {}'.format(tasks))
            generate_training_csv.delay(tasks=tasks,destBucket=destBucket,min_area=min_area)

        else:
            status='error'
            message='Insufficient arguments supplied.'
    else:
        status='error'
        message='Access denied.'

    return json.dumps({'status': status, 'message': message})

@app.route('/getAdvancedOptions/<survey_id>')
@login_required
def getAdvancedOptions(survey_id):
    '''Returns the advanced options settings for the specified survey.'''
    reply = 'error'
    survey = db.session.query(Survey).get(int(survey_id))
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        reply = {'smallDetections': str(survey.ignore_small_detections),'skyMask': str(survey.sky_masked)}
    return json.dumps(reply)

@app.route('/getSurveyTGcode/<survey_id>')
@login_required
def getSurveyTGcode(survey_id):
    '''Returns the trapgroup code for the survey belonging to the current user with the specified name.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey_id,'read'):
        return json.dumps(survey.trapgroup_code)
    else:
        return json.dumps('error')

@app.route('/editSurvey', methods=['POST'])
@login_required
def editSurvey():
    '''
    Edits the specified survey by doing one of the following: adds images, edit timestamps, or import kml. Returns success/error status and associated message.
    
        Parameters:
            surveyName (str): The name of the survey to edit
            newSurveyTGCode (str): Trapgroup code for adding images
            newSurveyS3Folder (str): Folder where additional images should be found
            checkbox (str): Whether or not the trapgroup code is an advanced code or not
            ignore_small_detections (str): The desired status as to whether small detections should be ignored. Ignored if none
            sky_masked (str): The desired status as to whether the sky should be masked. Ignored if none
            timestamps (dict): Optional formData dictionary with timestamop corrections
            kml (file): Optional kml file to be imported
            coordData (list): Optional formData list of trapgrorups and their coordinates from the manual editor
    '''
    
    status = 'success'
    message = ''
    survey_id = request.form['survey_id']
    survey = db.session.query(Survey).get(survey_id)
    organisation = survey.organisation
    if survey and checkSurveyPermission(current_user.id,survey_id,'write') and (survey.status.lower() in Config.SURVEY_READY_STATUSES):


        # Check if any surveys are busy with a dearchival process
        if survey.status == 'Restoring Files':
            status = 'error'
            message = 'Files from your survey are currently being restored from archival storage. Editing your survey is not possible during this process. Please wait until the 48 hour restoration period has completed.'

        classifier_id = None
        if 'classifier_id' in request.form:
            classifier_id = request.form['classifier_id']
            if type(classifier_id)==str:
                if classifier_id.isdigit():
                    classifier_id = int(classifier_id)
                else:
                    classifier_id = None

        timestamps = None
        if 'timestamps' in request.form:
            timestamps = ast.literal_eval(request.form['timestamps'])
            if len(timestamps)==0: timestamps = None

        masks = None
        if 'masks' in request.form:
            masks = ast.literal_eval(request.form['masks'])
            removed_masks = masks['removed']
            added_masks = masks['added']
            edited_masks = masks['edited']
            if len(removed_masks)==0 and len(added_masks)==0 and len(edited_masks)==0: masks = None

        staticgroups = None
        if 'staticgroups' in request.form:
            staticgroups = ast.literal_eval(request.form['staticgroups'])
            if len(staticgroups)==0: staticgroups = None

        imageTimestamps = None
        if 'imageTimestamps' in request.form:
            imageTimestamps = ast.literal_eval(request.form['imageTimestamps'])
            if len(imageTimestamps)==0: imageTimestamps = None

        kml = None
        if 'kml' in request.files:
            uploaded_file = request.files['kml']
            if uploaded_file.filename != '':
                if os.path.splitext(uploaded_file.filename)[1].lower() == '.kml':
                    pass  
                else:
                    status = 'error'
                    message = 'Coordinates file must be a kml file.' 
            else:
                status = 'error'
                message = 'Coordinates file must have a name.' 
            if status == 'success':
                key = organisation.folder + '-comp/kmlFiles/' + survey.name + '.kml'
                with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
                    uploaded_file.save(temp_file.name)
                    GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)
                kml = key

        coordData = None 
        if 'coordData' in request.form:
            coordData = ast.literal_eval(request.form['coordData'])
            if len(coordData)==0: coordData = None

        ignore_small_detections = None
        if 'ignore_small_detections' in request.form:
            ignore_small_detections = request.form['ignore_small_detections']
            if ignore_small_detections == 'false':
                ignore_small_detections = False
            elif ignore_small_detections == 'true':
                ignore_small_detections = True
            else:
                ignore_small_detections = None

        sky_masked = None
        if 'sky_masked' in request.form:
            sky_masked = request.form['sky_masked']
            if sky_masked == 'false':
                sky_masked = False
            elif sky_masked == 'true':
                sky_masked = True
            else:
                sky_masked = None


        if status == 'success':
            if classifier_id or ignore_small_detections or sky_masked or timestamps or coordData or masks or staticgroups or kml or imageTimestamps:
                app.logger.info('Edit survey requested for {} with classifier: {}, ignore_small_detections: {}, sky_masked: {}, timestamps: {}, coordData: {}, masks: {}, staticgroups: {}, kml: {}, imageTimestamps: {}'.format(survey.name,classifier_id,ignore_small_detections,sky_masked,timestamps,coordData,masks,staticgroups,kml,imageTimestamps))
                if classifier_id and survey.classifier_id != classifier_id:
                    if Config.DISABLE_RESTORE:
                        status = 'error'
                        message = 'File de-archival is currently not available. Please try again later.'
                    else:
                        survey.status = 'Processing'
                        db.session.commit()
                        edit_survey_args = {'survey_id':survey.id,'user_id':current_user.id,'classifier_id':classifier_id,'ignore_small_detections':ignore_small_detections,'sky_masked':sky_masked,'timestamps':timestamps,'coord_data':coordData,'masks':masks,'staticgroups':staticgroups,'kml_file':kml,'image_timestamps':imageTimestamps}
                        GLOBALS.redisClient.set('edit_survey_{}'.format(survey_id),json.dumps(edit_survey_args))
                        restore_images_for_classification.delay(survey_id=survey.id,days=Config.EDIT_RESTORE_DAYS,edit_survey_args=edit_survey_args,tier=Config.RESTORE_TIER,restore_time=Config.RESTORE_TIME)
                else:
                    survey.status = 'Processing'
                    db.session.commit()
                    edit_survey_args = {'survey_id':survey.id,'user_id':current_user.id,'classifier_id':classifier_id,'ignore_small_detections':ignore_small_detections,'sky_masked':sky_masked,'timestamps':timestamps,'coord_data':coordData,'masks':masks,'staticgroups':staticgroups,'kml_file':kml,'image_timestamps':imageTimestamps}
                    GLOBALS.redisClient.set('edit_survey_{}'.format(survey_id),json.dumps(edit_survey_args))
                    edit_survey.delay(survey_id=survey.id,user_id=current_user.id,classifier_id=classifier_id,ignore_small_detections=ignore_small_detections,sky_masked=sky_masked,timestamps=timestamps,coord_data=coordData,masks=masks,staticgroups=staticgroups,kml_file=kml,image_timestamps=imageTimestamps)

    else:
        status = 'error'
        message = 'You do not have permission to edit this survey.'

    return json.dumps({'status': status, 'message': message})

@app.route('/addFiles', methods=['POST'])
@login_required
def addFiles():
    '''
    Adds Files to the specified survey. Returns success/error status and associated message.

        Parameters:
            survey_id (int): The ID of the survey to add files to
            newSurveyTGCode (str): Trapgroup code for adding images
            newSurveyS3Folder (str): Folder where additional images should be found
            checkbox (str): Whether or not the trapgroup code is an advanced code or not
            newSurveyCamCode (str): Camera code for adding images
            camCheckbox (str): Whether or not the camera code is an advanced code or not
    '''
    
    status = 'success'
    message = ''
    upload_survey_id = None
    upload_survey_name = None
    survey_id = request.form['survey_id']

    survey = db.session.query(Survey).get(survey_id)
    organisation = survey.organisation
    if survey and checkSurveyPermission(current_user.id,survey_id,'write') and (survey.status.lower() in Config.SURVEY_READY_STATUSES):
        
        userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==survey.organisation_id).filter(UserPermissions.user_id==current_user.id).first()
        if userPermissions and userPermissions.create:
            # Check if any surveys are busy with a dearchival process
            if survey.status == 'Restoring Files':
                status = 'error'
                message = 'Files from your survey are currently being restored from archival storage. Adding files to your survey is not possible during this process. Please wait until the 48 hour restoration period has completed.'

            if status == 'success':
                newSurveyTGCode = request.form['newSurveyTGCode']
                newSurveyS3Folder = request.form['newSurveyS3Folder']
                checkbox = request.form['checkbox']
                newSurveyCamCode = request.form['newSurveyCamCode']
                camCheckbox = request.form['camCheckbox']

                if newSurveyTGCode!=' ' and newSurveyCamCode!=' ':
                    if checkbox=='false':
                        newSurveyTGCode = newSurveyTGCode+'[0-9]+'

                    if camCheckbox=='false' and newSurveyCamCode!='None':
                        newSurveyCamCode = newSurveyCamCode+'[0-9]+'

                    survey.trapgroup_code=newSurveyTGCode

                    if newSurveyS3Folder!='none':
                        survey.folder = newSurveyS3Folder
                    else:
                        survey.folder = survey.name
                    
                    if newSurveyCamCode!='None':
                        survey.camera_code=newSurveyCamCode
                    else:
                        survey.camera_code=None
                        newSurveyCamCode=None

                    db.session.commit()
                    
                    if newSurveyS3Folder!='none':
                        import_survey.delay(survey_id=survey.id)
                    else:
                        survey.status = 'Uploading'
                        db.session.commit()
                        upload_survey_id = survey.id
                        upload_survey_name = survey.name
                        GLOBALS.redisClient.set('lambda_invoked_'+str(survey_id),0)
                        GLOBALS.redisClient.set('lambda_completed_'+str(survey_id),0)
                        GLOBALS.redisClient.set('upload_complete_'+str(survey_id), 'False')
        
        else:
            status = 'error'
            message = 'You do not have permission to add images to this survey.'

    else:
        status = 'error'
        message = 'You do not have permission to add images to this survey.'

    return json.dumps({'status': status, 'message': message, 'survey_id': upload_survey_id, 'survey_name': upload_survey_name})

@app.route('/TTWorkerSignup', methods=['GET', 'POST'])
def TTWorkerSignup():
    '''Returns the form for worker signup, and handles its submission.'''
    if current_user.is_authenticated:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        elif current_user.admin:
            return redirect(url_for('surveys'))
        elif current_user.parent_id == None:
            return redirect(url_for('jobs'))
        elif current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        form = RegistrationForm()
        if form.validate_on_submit():

            token = jwt.encode(
                    {'username': form.username.data, 'email': form.email.data, 'password': form.password.data, 'random': randomString()},
                    app.config['SECRET_KEY'], algorithm='HS256')

            url = 'https://'+Config.DNS+'/newWorkerAccount/'+token

            send_email('[TrapTagger] Email Verification',
                    recipients=[form.email.data],
                    text_body=render_template('email/emailVerification.txt',username=form.username.data, url=url),
                    html_body=render_template('email/emailVerification.html',username=form.username.data, url=url))

            flash('A verification email has been sent to you.')
            return redirect(url_for('login_page', _external=True))
        return render_template('html/signup.html', title='Sign Up', form=form, helpFile='worker_signup', version=Config.VERSION)

@app.route('/newWorkerAccount/<token>')
def newWorkerAccount(token):
    '''Handles the worker-account registration token.'''
    try:
        info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

    if 'username' in info.keys():
        username = info['username'].strip()
        email = info['email']

        if username.lower() not in Config.DISALLOWED_USERNAMES:
            check = db.session.query(User).filter(or_(User.username==username,and_(User.email==email,~User.root_organisation.has()))).first()
            folder = username.lower().replace(' ','-').replace('_','-')
            org_check = db.session.query(Organisation).filter(or_(func.lower(Organisation.name)==username.lower(), Organisation.folder==folder)).first()
            disallowed_chars = '"[@!#$%^&*()<>?/\|}{~:]' + "'"
            disallowed = any(r in disallowed_chars for r in username)
            
            if check==None and org_check==None and not disallowed and len(username)<=64:
                password = info['password']
                user = User(username=username, email=email, admin=False, cloud_access=False)
                user.set_password(password)
                db.session.add(user)
                turkcode = Turkcode(code=username, active=False, tagging_time=0)
                db.session.add(turkcode)
                turkcode.user = user
                notifications = db.session.query(Notification)\
                        .filter(Notification.user_id==None)\
                        .filter(or_(Notification.expires==None,Notification.expires<datetime.utcnow()))\
                        .distinct().all()
                user.seen_notifications = notifications
                db.session.commit()
                login_user(user, remember=False)
                return redirect(url_for('landing', _external=True))
    return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

@app.route('/grantQualification/<token>')
def grantQualification(token):
    '''Grants a qualification based on the data encoded in the recieved token.'''

    try:
        info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return render_template("html/block.html",text="Error.", helpFile='block')

    if 'requester' in info.keys():
        requester = db.session.query(User).get(int(info['requester']))
        requestee = db.session.query(User).get(int(info['requestee']))
        requestee.workers.append(requester)
        db.session.commit()
        return render_template("html/block.html",text="Qualification granted.", helpFile='block', version=Config.VERSION)
    else:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

@app.route('/')
def redir():
    '''Redirects the user to the corrct home page.'''

    if current_user.is_authenticated:
        if current_user.admin:
            return redirect(url_for('surveys'))
        else:
            return redirect(url_for('index'))
    else:
        return redirect(url_for('login_page'))

@app.route('/getPolarData', methods=['POST'])
@login_required
def getPolarData():
    '''
    Returns the time-of-day activity data for the requested species and task.
    
        Parameters:
            task_id (int): The task for which the data is required
            trapgroup_id (int): The trapgroup for which data is required
            species_id (int): The species fow which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            reqID (int): The request identifier
    '''

    task_ids = ast.literal_eval(request.form['task_ids'])
    species = ast.literal_eval(request.form['species'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    reqID = ast.literal_eval(request.form['reqID'])
    trapgroup = ast.literal_eval(request.form['trapgroup'])
    group = ast.literal_eval(request.form['group'])

    if 'startDate' in request.form:
        startDate = ast.literal_eval(request.form['startDate'])
        endDate = ast.literal_eval(request.form['endDate'])
    else:
        startDate = None
        endDate = None

    if baseUnit == '4':
        timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
        timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
    else:
        timeToIndependence = None
        timeToIndependenceUnit = None

    if 'normaliseBySite' in request.form:
        normaliseBySite = ast.literal_eval(request.form['normaliseBySite'])
        if normaliseBySite == '1':
            normaliseBySite = True
        else:
            normaliseBySite = False
    else:
        normaliseBySite = False

    if Config.DEBUGGING: app.logger.info('Polar data requested for tasks:{} species:{} base:{} reqID:{} trapgroup:{} group:{} sD:{} eD:{} TTI:{} TTIU:{}'.format(task_ids,species,baseUnit,reqID,trapgroup,group,startDate,endDate,timeToIndependence,timeToIndependenceUnit))

    reply = []
    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()
        task_ids = [r[0] for r in tasks]
        survey_ids = list(set([r[1] for r in tasks]))

        if baseUnit == '1' or baseUnit == '4':
            baseQuery = db.session.query(
                                Image.id,
                                Image.corrected_timestamp,
                                Label.description, 
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '2':
            baseQuery = db.session.query(
                                Cluster.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '3':
            baseQuery = db.session.query(
                                Detection.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        baseQuery = rDets(baseQuery)

        if trapgroup != '0' and trapgroup != '-1':
            if type(trapgroup) == list:
                trap_ids = [int(t) for t in trapgroup]
                baseQuery = baseQuery.filter(Trapgroup.id.in_(trap_ids))
            else:
                baseQuery = baseQuery.filter(Trapgroup.tag==trapgroup)

        if group != '0' and group != '-1':
            baseQuery = baseQuery.filter(Sitegroup.id==int(group))

        
        if normaliseBySite:
            trapgroups = db.session.query(
                                    Trapgroup.tag, 
                                    Trapgroup.latitude, 
                                    Trapgroup.longitude,
                                    func.count(distinct(func.date(Image.corrected_timestamp)))
                                )\
                                .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                                .join(Image)\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))                            

            if trapgroup and trapgroup != '0' and trapgroup != '-1' and group and group != '0' and group != '-1':
                trapgroups = trapgroups.filter(or_(Trapgroup.id.in_(trapgroup), Sitegroup.id.in_(group)))
            elif trapgroup and trapgroup != '0' and trapgroup != '-1':
                trapgroups = trapgroups.filter(Trapgroup.id.in_(trapgroup))
            elif group and group != '0' and group != '-1':
                trapgroups = trapgroups.filter(Sitegroup.id.in_(group))

            trapgroups = trapgroups.group_by(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).order_by(Trapgroup.tag).all()

        if species != '0':
            labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            vhl = db.session.query(Label).get(GLOBALS.vhl_id)
            label_list = [GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.knocked_id]
            for task_id in task_ids:
                label_list.extend(getChildList(vhl,int(task_id)))
            baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        if startDate: baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)

        if endDate: baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)

        df = pd.DataFrame(baseQuery.distinct().all(),columns=['id','timestamp','species','tag','latitude','longitude'])
        df.drop_duplicates(subset=['id'],inplace=True)
        df = df.dropna(subset=['timestamp'])
        if len(df) > 0:
            if timeToIndependence:
                if timeToIndependenceUnit == 's':
                    timeToIndependence = int(timeToIndependence)
                elif timeToIndependenceUnit == 'm':
                    timeToIndependence = int(timeToIndependence) * 60
                elif timeToIndependenceUnit == 'h':
                    timeToIndependence = int(timeToIndependence) * 3600
                timeToIndependence = timedelta(seconds=timeToIndependence)
                
                df = df.sort_values(by=['species','tag', 'latitude', 'longitude','timestamp'])
                df['timedelta'] = df.groupby(['species','tag','latitude','longitude'])['timestamp'].diff()
                df['timedelta'] = df['timedelta'].fillna(timedelta(seconds=9999999))
                df = df[df['timedelta'] >= timeToIndependence]
                df = df.drop(columns=['timedelta'])

            df['hour'] = df['timestamp'].dt.hour

            if normaliseBySite:
                if trapgroups:
                    for hour in range(24):
                        hour_count = []
                        for tag, lat, lng, effort in trapgroups:
                            species_count = df[(df['tag']==tag) & (df['latitude']==lat) & (df['longitude']==lng) & (df['hour']==hour)]['id'].count()
                            count = species_count / effort * 100
                            hour_count.append(count)
                        reply.append(round(sum(hour_count)/len(hour_count),3))
            else:
                
                df = df.groupby(['hour']).count()
                df = df.reindex(range(24),fill_value=0)
                reply = df['id'].tolist()

    return json.dumps({'reqID':reqID, 'data':reply})

@app.route('/getPolarDataIndividual/<individual_id>/<baseUnit>', methods=['POST'])
@login_required
def getPolarDataIndividual(individual_id, baseUnit):
    '''
    Returns the time-of-day activity data for the requested species and task.
    
        Parameters:
            individual_id (int): The indidvidual for which the data is required
            trapgroup_id (int): The trapgroup for which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
    '''

    reply = []

    trapgroup_tags = ast.literal_eval(request.form['trapgroup_tags'])  
    start_date = ast.literal_eval(request.form['start_date'])
    end_date = ast.literal_eval(request.form['end_date'])

    individual = db.session.query(Individual).get(int(individual_id))

    survey_ids = []
    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            survey_ids.append(task.survey_id)

    if individual and survey_ids:
        if baseUnit == '1':
            baseQuery = db.session.query(Image).join(Detection)
        elif baseUnit == '2':
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task_id.in_([x.id for x in individual.tasks]))
        elif baseUnit == '3':
            baseQuery = db.session.query(Detection).join(Image)
        baseQuery = baseQuery.join(Camera)\
                            .join(Trapgroup)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        if trapgroup_tags:
            # trap_ids = [int(x) for x in trapgroup_ids]
            baseQuery = baseQuery.filter(Trapgroup.tag.in_(trapgroup_tags))

        if start_date: baseQuery = baseQuery.filter(Image.corrected_timestamp >= start_date)

        if end_date: baseQuery = baseQuery.filter(Image.corrected_timestamp <= end_date)

        for n in range(24):
            count = baseQuery.filter(extract('hour',Image.corrected_timestamp)==n).distinct().count()
            reply.append(count)

    return json.dumps({'data':reply})

@app.route('/getBarData', methods=['POST'])
@login_required
def getBarData():
    '''
    Returns the bar graph data for the requested species and task.

        Parameters:
            task_ids (int): The tasks for which the data is required
            species (str): The species for which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            axis (str): The type of count - either a survey or trapgroup count
            startDate (str): The start date for the data
            endDate (str): The end date for the data
    '''
    task_ids = ast.literal_eval(request.form['task_ids'])
    species = ast.literal_eval(request.form['species'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    axis = ast.literal_eval(request.form['axis'])
    if 'sites_ids' in request.form:
        sites_ids = ast.literal_eval(request.form['sites_ids'])
        groups = ast.literal_eval(request.form['groups'])
    else:
        sites_ids = None
        groups = None
    if 'startDate' in request.form:
        startDate = ast.literal_eval(request.form['startDate'])
        endDate = ast.literal_eval(request.form['endDate'])
    else:
        startDate = None
        endDate = None

    if baseUnit == '4':
        timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
        timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
    else:
        timeToIndependence = None
        timeToIndependenceUnit = None

    if 'normaliseBySite' in request.form:
        normaliseBySite = ast.literal_eval(request.form['normaliseBySite'])
        if normaliseBySite == '1':
            normaliseBySite = True
        else:
            normaliseBySite = False
    else:
        normaliseBySite = False

    if Config.DEBUGGING: app.logger.info('Bar data requested for tasks:{} species:{} base:{} axis:{} sites:{} groups:{} sD:{} eD:{} TTI:{} TTIU:{}'.format(task_ids,species,baseUnit,axis,sites_ids,groups,startDate,endDate,timeToIndependence,timeToIndependenceUnit))

    data = []
    data_labels = []
    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()
        task_ids = [r[0] for r in tasks]
        survey_ids = list(set([r[1] for r in tasks]))

        if baseUnit == '1' or baseUnit == '4':
            baseQuery = db.session.query(
                                Image.id,
                                Image.corrected_timestamp,
                                Label.description, 
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '2':
            baseQuery = db.session.query(
                                Cluster.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '3':
            baseQuery = db.session.query(
                                Detection.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        baseQuery = rDets(baseQuery)

        if normaliseBySite:
            trapgroups = db.session.query(
                                    Trapgroup.tag, 
                                    Trapgroup.latitude, 
                                    Trapgroup.longitude,
                                    func.count(distinct(func.date(Image.corrected_timestamp)))
                                )\
                                .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                                .join(Image)\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))
        else:
            trapgroups = db.session.query(
                                    Trapgroup.tag,
                                    Trapgroup.latitude,
                                    Trapgroup.longitude
                                )\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))
                                           

        if sites_ids and sites_ids != '0' and sites_ids != '-1' and groups and groups != '0' and groups != '-1':
            trapgroups = trapgroups.filter(or_(Trapgroup.id.in_(sites_ids), Sitegroup.id.in_(groups)))
        elif sites_ids and sites_ids != '0' and sites_ids != '-1':
            trapgroups = trapgroups.filter(Trapgroup.id.in_(sites_ids))
        elif groups and groups != '0' and groups != '-1':
            trapgroups = trapgroups.filter(Sitegroup.id.in_(groups))

        trapgroups = trapgroups.group_by(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).order_by(Trapgroup.tag).all()

        if species != '0':
            labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            vhl = db.session.query(Label).get(GLOBALS.vhl_id)
            label_list = [GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.knocked_id]
            for task_id in task_ids:
                label_list.extend(getChildList(vhl,int(task_id)))
            baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        if startDate: baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)

        if endDate: baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)

    
        df = pd.DataFrame(baseQuery.distinct().all(),columns=['id','timestamp','species','tag','latitude','longitude'])
        df.drop_duplicates(subset=['id'],inplace=True)

        if len(df) > 0:
            if timeToIndependence:
                if timeToIndependenceUnit == 's':
                    timeToIndependence = int(timeToIndependence)
                elif timeToIndependenceUnit == 'm':
                    timeToIndependence = int(timeToIndependence) * 60
                elif timeToIndependenceUnit == 'h':
                    timeToIndependence = int(timeToIndependence) * 3600
                timeToIndependence = timedelta(seconds=timeToIndependence)

                df = df.sort_values(by=['species','tag', 'latitude', 'longitude','timestamp'])
                df['timedelta'] = df.groupby(['species','tag','latitude','longitude'])['timestamp'].diff()
                df['timedelta'] = df['timedelta'].fillna(timedelta(seconds=9999999))
                df = df[df['timedelta'] >= timeToIndependence]
                df = df.drop(columns=['timedelta'])

            if normaliseBySite:
                if trapgroups:
                    for tag, lat, long, effort in trapgroups:
                        species_count = df[(df['tag']==tag) & (df['latitude']==lat) & (df['longitude']==long)].nunique()['id']
                        count = species_count / effort * 100
                        data.append(float(round(count,3)))
                        data_labels.append(str(tag))

                    if axis == '1': #survey count
                        data = [round(sum(data)/len(data),3)]
                        data_labels = ['Mean RAI']

            else:
                if axis == '1': #survey count
                    count = df.nunique()['id']
                    data = [int(count)]
                    data_labels = ['Survey Count']

                elif axis == '2': #Trapgroup count
                    if trapgroups:
                        for tag, lat, long in trapgroups:
                            count = df[(df['tag']==tag) & (df['latitude']==lat) & (df['longitude']==long)].nunique()['id']
                            data.append(int(count))
                            data_labels.append(str(tag))

    return json.dumps({'data' :data, 'labels': data_labels})

@app.route('/getBarDataIndividual', methods=['POST'])
@login_required
def getBarDataIndividual():
    '''
    Returns the bar graph data for the requested species and task.

        Parameters:
            individual_id (int): The individual id for which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            axis (str): The type of count - either a survey or trapgroup count
            startDate (str): The start date for the data
            endDate (str): The end date for the data
    '''
    individual_id = ast.literal_eval(request.form['individual_id'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    axis = ast.literal_eval(request.form['axis'])
    if 'startDate' in request.form:
        startDate = ast.literal_eval(request.form['startDate'])
        endDate = ast.literal_eval(request.form['endDate'])
    else:
        startDate = None
        endDate = None

    if Config.DEBUGGING: app.logger.info('Bar data requested for Individual {} {} {} {} {}'.format(individual_id,baseUnit,axis,startDate,endDate))

    data = []
    labels = []
    individual = db.session.query(Individual).get(int(individual_id))

    survey_ids = []
    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            survey_ids.append(task.survey_id)

    if individual and survey_ids:
        if baseUnit == '1':
            baseQuery = db.session.query(Image).join(Detection)
        elif baseUnit == '2':
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task_id.in_([x.id for x in individual.tasks]))
        elif baseUnit == '3':
            baseQuery = db.session.query(Detection).join(Image)
        baseQuery = baseQuery.join(Camera)\
                            .join(Trapgroup)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        if startDate: baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)

        if endDate: baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)

        if axis == '1': #survey count
            count = baseQuery.distinct().count()
            data = [count]
            labels = ['Surveys Count']

        elif axis == '2': #Trapgroup count
            trapgroups = [trapgroup for task in individual.tasks for trapgroup in task.survey.trapgroups if trapgroup.survey_id in survey_ids]
            check_data = {}
            for trapgroup in trapgroups:
                count = baseQuery.filter(Trapgroup.tag==trapgroup.tag).distinct().count()

                key = (trapgroup.latitude,trapgroup.longitude,trapgroup.tag)
                if key not in check_data:
                    check_data[key] = count
                else:
                    check_data[key] += count

            data = list(check_data.values())
            labels = [str(x[2]) for x in check_data.keys()]

    return json.dumps({'data' :data, 'labels': labels})

@app.route('/setAdminTask/<task>')
@login_required
def setAdminTask(task):
    '''Sets the current user's active task to the specified one.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    if current_user.parent_id == None:
        turkcode = current_user.turkcode[0]
        turkcode.task_id = task
        db.session.commit()
    return json.dumps('')

@app.route('/getDetailedTaskStatus/<task_id>', methods=['POST'])
@login_required
def getDetailedTaskStatus(task_id):
    '''Returns a detailed status for the specified task, including the numbers of each species, and the numbers of bounding boxes added or deleted etc.'''

    task_id==int(task_id)
    task = db.session.query(Task).get(task_id)
    
    init = request.args.get('init', None)
    label_id = request.args.get('label', None)
    if label_id: label_id=int(label_id)
    
    reply = {}
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):

        headings = {
            'Summary': [
                'Clusters',
                'Images',
                'Sightings',
                'Individuals'
            ],
            'Species Annotation': [
                'Tagged',
                'Complete'
            ],
            'AI Check': [
                'Status'
                # 'Potential Clusters'
            ],
            'Informational Tagging': [
                'Tagged'
            ],
            'Sighting Correction': [
                'Checked Sightings'
            ],
            'Individual ID': [
                'Cluster-Level',
                'Inter-Cluster',
                'Exhaustive'
            ]
        }

        if init:
            labels = {}
            parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).order_by(Label.description).all()
            parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
            # parentLabels.append(db.session.query(Label).get(GLOBALS.knocked_id))
            # parentLabels.append(db.session.query(Label).get(GLOBALS.nothing_id))
            # parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
            for label in parentLabels:
                childLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).all()
                labels[label.id] = addChildToDict(childLabels,{},task_id,True,False)

            reply = {'status':'success','labels':labels,'headings':headings}

        if label_id:
            admin=db.session.query(User).filter(User.username=='Admin').first()
            label = db.session.query(Label).get(label_id)
            childLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label_id).all()

            if Config.DEBUGGING: app.logger.info('Getting {} detailled info from task {}'.format(label.description,label.task_id))

            if (label_id==GLOBALS.vhl_id) or (label.task==task):
                reply['status'] = 'success'
                reply['label'] = label.description
                reply['Summary'] = {}
                reply['Species Annotation'] = {}
                reply['AI Check'] = {}
                reply['Informational Tagging'] = {}
                reply['Sighting Correction'] = {}
                reply['Individual ID'] = {}
                
                if label_id==GLOBALS.vhl_id:
                    cluster_count = task.vhl_count
                    image_count = task.vhl_image_count
                    sighting_count = task.vhl_sighting_count
                    bounding_count = task.vhl_bounding_count
                    info_tag_count = task.infoless_vhl_count
                    # potential_clusters = task.potential_vhl_clusters
                else:
                    cluster_count = label.cluster_count
                    image_count = label.image_count
                    sighting_count = label.sighting_count
                    bounding_count = label.bounding_count
                    info_tag_count = label.info_tag_count
                    # potential_clusters = label.potential_clusters
                
                #check if one of its child labels in the survey
                names = []
                ids = []
                if childLabels:
                    names, ids = addChildLabels(names,ids,label,task_id)
                test2 = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.any(Label.id.in_(ids))).first()

                if test2 or (cluster_count != 0 and cluster_count != None):
                    reply['Summary']['Clusters'] = cluster_count
                    reply['Summary']['Images'] = image_count
                    reply['Summary']['Sightings'] = sighting_count
                    
                    # if label_id!=GLOBALS.vhl_id: reply['Summary']['Individuals'] = len(label.individuals[:])
                    if label_id!=GLOBALS.vhl_id: 
                        individual_count = db.session.query(Individual)\
                                                        .filter(Individual.species==label.description)\
                                                        .filter(Individual.tasks.contains(task))\
                                                        .filter(Individual.name!='unidentifiable')\
                                                        .filter(Individual.active==True)\
                                                        .distinct().count()
                                                        
                        reply['Summary']['Individuals'] = individual_count
                    # Checked Sightings
                    if sighting_count != 0:
                        checked_detections = sighting_count - bounding_count
                        checked_perc = round((checked_detections/sighting_count)*100,2)
                        reply['Sighting Correction']['Checked Sightings'] = str(checked_detections) + '/' + str(sighting_count) + ' (' + str(checked_perc) + '%)'
                    else:
                        reply['Sighting Correction']['Checked Sightings'] = '-'

                    # Species Annotation Status
                    if label.parent == None:
                        # based on initial
                        initial_tagged = db.session.query(Cluster)\
                                                .filter(Cluster.task_id==task_id)\
                                                .filter(Cluster.user_id!=admin.id)\
                                                .filter(Cluster.labels.any())\
                                                .first()

                        if task.unlabelled_animal_cluster_count:
                            reply['Species Annotation']['Complete'] = 'No'
                        else:
                            reply['Species Annotation']['Complete'] = 'Yes'
                        
                        if initial_tagged:
                            reply['Species Annotation']['Tagged'] = 'Yes'
                        else:
                            reply['Species Annotation']['Tagged'] = 'No'

                    else:
                        if childLabels:
                            parent_label = label
                        else:
                            parent_label = label.parent
                            names = []
                            ids = []
                            names, ids = addChildLabels(names,ids,parent_label,task_id)

                        test3 = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.user_id!=admin.id).filter(Cluster.labels.any(Label.id.in_(ids))).first()
                        parent_label_clusters = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.contains(parent_label)).first()

                        if parent_label_clusters:
                            reply['Species Annotation']['Complete'] = 'No'
                        else:
                            reply['Species Annotation']['Complete'] = 'Yes'

                        if test3:
                            reply['Species Annotation']['Tagged'] = 'Yes'
                        else:
                            reply['Species Annotation']['Tagged'] = 'No'

                    # Informational Tagging
                    if cluster_count - info_tag_count > 0:
                        reply['Informational Tagging']['Tagged'] = 'Yes'
                    else:
                        reply['Informational Tagging']['Tagged'] = 'No'

                    # AI Check
                    # ids.append(label.id)

                    if task.ai_check_complete:
                        reply['AI Check']['Status'] = 'Checked'
                    else:
                        reply['AI Check']['Status'] = 'Not Checked'

                    # reply['AI Check']['Potential Clusters'] = potential_clusters

                    # Individual ID
                    if label_id==GLOBALS.vhl_id:
                        reply['Individual ID']['Cluster-Level'] = '-'
                        reply['Individual ID']['Inter-Cluster'] = '-'
                        reply['Individual ID']['Exhaustive'] = '-'
                        reply['Summary']['Individuals'] = '-'
                    else:
                        if db.session.query(Individual).filter(Individual.species==label.description).filter(Individual.tasks.contains(task)).count() == 0:
                            reply['Individual ID']['Cluster-Level'] = '-'
                            reply['Individual ID']['Inter-Cluster'] = '-'
                            reply['Individual ID']['Exhaustive'] = '-'
                        elif label.unidentified_count:
                            reply['Individual ID']['Cluster-Level'] = 'Incomplete'
                            reply['Individual ID']['Inter-Cluster'] = 'Incomplete'
                            reply['Individual ID']['Exhaustive'] = 'Incomplete'
                        else:
                            reply['Individual ID']['Cluster-Level'] = 'Complete'
                            if not label.icID_q1_complete:
                                reply['Individual ID']['Inter-Cluster'] = 'Incomplete'
                                reply['Individual ID']['Exhaustive'] = 'Incomplete'
                            else:
                                reply['Individual ID']['Inter-Cluster'] = 'Complete'
                                if label.icID_count !=0:
                                    reply['Individual ID']['Exhaustive'] = 'Incomplete'
                                else:
                                    reply['Individual ID']['Exhaustive'] = 'Complete'

                else:
                    # No clusters of this species - just return canned reply for speed
                    reply['Summary']['Clusters'] = '-'
                    reply['Summary']['Images'] = '-'
                    reply['Summary']['Sightings'] = '-'
                    reply['Summary']['Individuals'] = '-'
                    reply['Species Annotation']['Complete'] = '-'
                    reply['Species Annotation']['Tagged'] = '-'
                    reply['AI Check']['Status'] = '-'
                    # reply['AI Check']['Potential Clusters'] = '-'
                    reply['Informational Tagging']['Tagged'] = '-'
                    reply['Sighting Correction']['Checked Sightings'] = '-'
                    reply['Individual ID']['Cluster-Level'] = '-'
                    reply['Individual ID']['Inter-Cluster'] = '-'
                    reply['Individual ID']['Exhaustive'] = '-'
    else:
        reply = {'status':'error','message':'Your survey is too large for this functionality. Please try again after the next update'}

    return json.dumps(reply)

@app.route('/dotask/<username>')
@login_required
def dotask(username):
    '''Allocates the specified job to the current user, logging them into a tmp user profile to perform the work.'''

    turkcode = db.session.query(Turkcode).filter(Turkcode.code==username).first()
    # if turkcode and (username.lower() not in Config.DISALLOWED_USERNAMES) and ((current_user in turkcode.task.survey.user.workers) or (current_user == turkcode.task.survey.user)):
    if turkcode and (username.lower() not in Config.DISALLOWED_USERNAMES) and checkAnnotationPermission(current_user.id,turkcode.task_id):
        # Job was probably cleaned up
        if not GLOBALS.redisClient.sismember('active_jobs_'+str(turkcode.task_id),turkcode.code): return redirect(url_for('jobs'))

        user = turkcode.user
        
        if user is None:
            user=User(username=username, passed='pending', admin=False, parent_id=current_user.id, last_ping=datetime.utcnow())
            db.session.add(user)
            turkcode.user = user
            db.session.commit()
        else:
            if current_user != user:
                return redirect(url_for('jobs'))
                    
        logout_user()
        login_user(user)

        # if not populateMutex(turkcode.task_id,user.id): return redirect(url_for('jobs'))

        if '-4' in turkcode.task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in turkcode.task.tagging_level:
            return redirect(url_for('individualID'))
        elif turkcode.task.is_bounding:
            return redirect(url_for('sightings'))
        else:
            return redirect(url_for('index'))
    else:
        return redirect(url_for('jobs'))

@app.route('/createAccount/<token>')
def createAccount(token):
    '''Creates a new account based on the recieved token.'''
    try:
        info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

    if ('organisation' in info.keys()) and (info['organisation'].lower().strip() not in Config.DISALLOWED_USERNAMES):
        info['organisation'] = info['organisation'].strip()
        folder = info['organisation'].lower().replace(' ','-').replace('_','-')

        check = db.session.query(Organisation).filter(or_(
            func.lower(Organisation.name)==info['organisation'].lower(),
            Organisation.folder==folder
        )).first()
        
        check2 = db.session.query(User).filter(func.lower(User.username)==info['organisation']).first()

        if (check == None) and (check2 == None) and (len(folder) <= 64):
            newUser = User(username=info['organisation'], email=info['email'], admin=True, passed='pending', cloud_access=False)
            newTurkcode = Turkcode(code=info['organisation'], active=False, tagging_time=0)
            newOrganisation = Organisation(name=info['organisation'], folder=folder, previous_image_count=0, image_count=0, previous_video_count=0, video_count=0, previous_frame_count=0, frame_count=0)
            newUserPermission = UserPermissions(default='admin', annotation=True, create=True, delete=True) 
            newTurkcode.user = newUser
            newOrganisation.root = newUser
            newUserPermission.user = newUser
            newUserPermission.organisation = newOrganisation
            newPassword = randomString()
            newUser.set_password(newPassword)

            notifications = db.session.query(Notification)\
                                    .filter(Notification.user_id==None)\
                                    .filter(or_(Notification.expires==None,Notification.expires<datetime.utcnow()))\
                                    .distinct().all()

            newUser.seen_notifications = notifications

            db.session.add(newUser)
            db.session.add(newTurkcode)
            db.session.add(newOrganisation)
            db.session.add(newUserPermission)
            db.session.commit()

            #Create all the necessary AWS stuff
            # s3UserName, s3Password = create_new_aws_user(folder)

            send_email('[TrapTagger] Account Information',
                recipients=[info['email']],
                text_body=render_template('email/enquirySuccess.txt',
                    name=info['name'],
                    organisation=info['organisation'],
                    password=newPassword,
                    tutorials_url=Config.TUTORIALS_PLAYLIST,
                    login_url='https://'+Config.DNS+'/login',
                    reset_url='https://'+Config.DNS+'/requestPasswordChange',
                    monitored_email_address=Config.MONITORED_EMAIL_ADDRESS),
                html_body=render_template('email/enquirySuccess.html',
                    name=info['name'],
                    organisation=info['organisation'],
                    password=newPassword,
                    tutorials_url=Config.TUTORIALS_PLAYLIST,
                    login_url='https://'+Config.DNS+'/login',
                    reset_url='https://'+Config.DNS+'/requestPasswordChange',
                    monitored_email_address=Config.MONITORED_EMAIL_ADDRESS),
                cc=[Config.MONITORED_EMAIL_ADDRESS]
            )

            return render_template("html/block.html",text="Account successfully created.", helpFile='block', version=Config.VERSION)
        else:
            return render_template("html/block.html",text="Account already exists.", helpFile='block', version=Config.VERSION)
    else:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

@app.route('/changePassword/<token>', methods=['GET', 'POST'])
def changePassword(token):
    '''Handles the password-reset token.'''
    
    if current_user.is_authenticated:
        if current_user.admin:
            return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
    else:
        resetPasswordForm = ResetPasswordForm()
        if resetPasswordForm.validate_on_submit():
            try:
                user_id = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])['user_id']
                exp = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])['exp']
                current_time = (datetime.utcnow()-datetime(1970,1,1)).total_seconds()

                if current_time<exp:
                    user = db.session.query(User).get(user_id)
                    user.set_password(resetPasswordForm.password.data)
                    db.session.commit()
                    flash('Password changed successfully.')
                else:
                    flash('Token expired. Please make a new password-change request.')
            except:
                pass
            return redirect(url_for('login_page'))
        return render_template("html/changePassword.html", resetPasswordForm=resetPasswordForm, helpFile='reset_password', version=Config.VERSION)

@app.route('/requestPasswordChange', methods=['GET', 'POST'])
def requestPasswordChange():
    '''Renders the request password change page, and handles form submission. Send passwword reset email to the owner of the account.'''

    if current_user.is_authenticated:
        if current_user.admin:
            return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
    else:
        requestPasswordChangeForm = RequestPasswordChangeForm()
        if requestPasswordChangeForm.validate_on_submit():
            user = db.session.query(User) \
                            .filter(User.username==requestPasswordChangeForm.username.data) \
                            .filter(User.email==requestPasswordChangeForm.email.data) \
                            .first()

            if user:
                token = jwt.encode(
                    {'user_id': user.id, 'exp': (datetime.utcnow()-datetime(1970,1,1)+timedelta(minutes=15)).total_seconds()},
                    app.config['SECRET_KEY'], algorithm='HS256')

                url = 'https://'+Config.DNS+'/changePassword/'+token

                send_email('[TrapTagger] Password Reset Request',
                    recipients=[user.email],
                    text_body=render_template('email/passwordChangeRequest.txt', username=user.username, url=url),
                    html_body=render_template('email/passwordChangeRequest.html', username=user.username, url=url))
            
            flash('Request submitted.')
            return redirect(url_for('login_page'))

        return render_template("html/requestPasswordChange.html", requestPasswordChangeForm=requestPasswordChangeForm, helpFile='request_password_change', version=Config.VERSION)

@app.route('/tutorial')
def tutorial():
    '''Renders the tutorial template.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    elif current_user.admin and (current_user.username=='Dashboard'):
        return redirect(url_for('dashboard'))
    elif not current_user.permissions:
        return redirect(url_for('landing'))
    else:
        return render_template('html/tutorial.html', helpFile='tutorial', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/individuals')
def individuals():
    '''Renders the individuals page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        if not current_user.permissions: return redirect(url_for('landing'))
        return render_template('html/individuals.html', title='Individuals', helpFile='individuals_page', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/index')
def index():
    '''Renders the annotation/tagging template.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.admin:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        else:
            if current_user.permissions:
                return redirect(url_for('surveys'))
            else:
                return redirect(url_for('landing'))
    elif current_user.parent_id == None:
        if current_user.permissions:
            return redirect(url_for('jobs'))
        else:
            return redirect(url_for('landing'))
    elif current_user.turkcode[0].task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-4' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('clusterID'))
    elif '-5' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('individualID'))
    else:
        if (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
            return redirect(url_for('done'))
        return render_template('html/index.html', title='TrapTagger', helpFile='annotation', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/jobs')
def jobs():
    '''Renders the jobs page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        if not current_user.permissions: return redirect(url_for('landing'))
        return render_template('html/jobs.html', title='Jobs', helpFile='jobs_page', version=Config.VERSION)

@app.route('/TTRegisterAdmin ', methods=['GET', 'POST'])
def TTRegisterAdmin():
    '''Renders the admin account registration page.'''
    logout = request.args.get('logout', None)
    if current_user.is_authenticated:
        if current_user.admin:
            if current_user.username=='Dashboard':
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                if logout:
                    logout_user()
                    return redirect(url_for('TTRegisterAdmin'))
                else:
                    return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
    else:
        enquiryForm = EnquiryForm()
        if enquiryForm.validate_on_submit():
            if enquiryForm.info.data == '':
                enquiryForm.organisation.data = enquiryForm.organisation.data.strip()
                folder = enquiryForm.organisation.data.lower().replace(' ','-').replace('_','-')

                check = db.session.query(Organisation).filter(or_(
                    func.lower(Organisation.name)==enquiryForm.organisation.data.lower(),
                    Organisation.folder==folder
                )).first()

                check2 = db.session.query(User).filter(func.lower(User.username)==enquiryForm.organisation.data.lower()).first()

                disallowed_chars = '"[@!#$%^&*()<>?/\|}{~:]' + "'"
                disallowed = any(r in disallowed_chars for r in enquiryForm.organisation.data)

                if (check == None) and (check2 == None) and (len(folder) <= 64) and not disallowed:
                    send_enquiry_email(enquiryForm.organisation.data,enquiryForm.email.data,enquiryForm.description.data,enquiryForm.name.data)
                    flash('Enquiry submitted.')
                    return redirect(url_for('TTRegisterAdmin'))
                elif disallowed:
                    flash('Your organisation name cannot contain special characters.')
                elif len(folder) > 64:
                    flash('Your organisation name is too long.')
                else:
                    flash('Invalid organisation name. Please try again.')
            else:
                flash('Enquiry (not) submitted.')
                return redirect(url_for('TTRegisterAdmin'))
        return render_template("html/register.html", enquiryForm=enquiryForm, helpFile='registration_page', version=Config.VERSION)

@app.route('/dataPipeline')
@login_required
def dataPipeline():
    '''Renders the data pipeline page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        admin = db.session.query(User).filter(User.username=='Admin').first()
        if current_user==admin:
            return render_template('html/dataPipeline.html', title='Data Pipeline', helpFile='data_pipeline', version=Config.VERSION)
        else:
            return redirect(url_for('index'))

@app.route('/trainingCSV')
@login_required
def trainingCSV():
    '''Renders the training CSV page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        admin = db.session.query(User).filter(User.username=='Admin').first()
        if current_user==admin:
            organisation_data = []
            organisations = db.session.query(Organisation).order_by(Organisation.name).distinct().all()
            for organisation in organisations:
                organisation_data.append({'id':organisation.id, 'name':organisation.name})
            return render_template('html/trainingCSV.html', title='Training CSV', organisation_data=organisation_data, helpFile='training_csv', version=Config.VERSION)
        else:
            return redirect(url_for('index'))

@app.route('/labelSpec')
@login_required
def labelSpec():
    '''Renders the label spec generation page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        admin = db.session.query(User).filter(User.username=='Admin').first()
        if current_user==admin:
            return render_template('html/labelSpec.html', title='Label Spec Generator', helpFile='lebel_spec', version=Config.VERSION)
        else:
            return redirect(url_for('index'))

@app.route('/surveys', methods=['GET', 'POST'])
@login_required
def surveys():
    '''Renders the surveys page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if not current_user.admin:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        if not current_user.permissions: return redirect(url_for('landing'))

        newSurveyForm = NewSurveyForm()

        return render_template('html/surveys.html', title='Home', newSurveyForm=newSurveyForm, helpFile='surveys_home', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/sightings', methods=['GET', 'POST'])
@login_required
def sightings():
    '''Renders the boundng-box editor page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.admin:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('surveys'))
    elif current_user.parent_id==None:
        return redirect(url_for('jobs'))
    elif not current_user.turkcode[0].task.is_bounding:
        return redirect(url_for('index'))
    elif '-4' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('clusterID'))
    elif '-5' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('individualID'))
    else:
        return render_template('html/bounding.html', title='Sighting Analysis', helpFile='edit_sightings', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/individualID', methods=['GET', 'POST'])
@login_required
def individualID():
    '''Renders the inter-cluster individual identification page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.admin:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('surveys'))
    elif current_user.parent_id==None:
        return redirect(url_for('jobs'))
    elif current_user.turkcode[0].task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-4' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('clusterID'))
    else:
        return render_template('html/individualID.html', title='Individual Identification', helpFile='inter-cluster_id', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/clusterID', methods=['GET', 'POST'])
@login_required
def clusterID():
    '''Renders the cluster-level individual identification page.'''
    
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.admin:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('surveys'))
    elif current_user.parent_id==None:
        return redirect(url_for('jobs'))
    elif current_user.turkcode[0].task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-5' in current_user.turkcode[0].task.tagging_level:
        return redirect(url_for('individualID'))
    else:
        return render_template('html/clusterID.html', title='Cluster Identification', helpFile='cluster_id', bucket=Config.BUCKET, version=Config.VERSION)

# @app.route('/workerStats')
# @login_required
# def workerStats():
#     '''Renders the worker statistics page.'''

#     if not current_user.is_authenticated:
#         return redirect(url_for('login_page'))
#     else:
#         if not current_user.admin:
#             if current_user.parent_id == None:
#                 return redirect(url_for('jobs'))
#             else:
#                 if current_user.turkcode[0].task.is_bounding:
#                     return redirect(url_for('sightings'))
#                 elif '-4' in current_user.turkcode[0].task.tagging_level:
#                     return redirect(url_for('clusterID'))
#                 elif '-5' in current_user.turkcode[0].task.tagging_level:
#                     return redirect(url_for('individualID'))
#                 else:
#                     return redirect(url_for('index'))

#         return render_template('html/workerStats.html', title='Worker Statistics', helpFile='worker_statistics', version=Config.VERSION)

@app.route('/workers')
@login_required
def workers():
    '''Renders the worker page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.parent_id == None:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            return render_template('html/workers.html', title='Annotation Statistics', helpFile='annotation_stats', version=Config.VERSION)
        else:
            if current_user.turkcode[0].task.is_bounding:
                return redirect(url_for('sightings'))
            elif '-4' in current_user.turkcode[0].task.tagging_level:
                return redirect(url_for('clusterID'))
            elif '-5' in current_user.turkcode[0].task.tagging_level:
                return redirect(url_for('individualID'))
            else:
                return redirect(url_for('index'))


@app.route('/getTaskCompletionStatus/<task_id>')
@login_required
def getTaskCompletionStatus(task_id):
    '''Returns whether the specified task has had all initial-level clusters tagged.'''

    task = db.session.query(Task).get(task_id)
    if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):

        if task.init_complete:
            return json.dumps(str(True))
        else:
            return json.dumps(str(False))
    
    return json.dumps('error')

@app.route('/getWorkerStats')
@login_required
def getWorkerStats():
    '''Returns the statistics of all workers involved in annotating the specified task.'''

    worker_id = request.args.get('worker_id',None)
    task_id = request.args.get('task_id',None)
    survey_id = request.args.get('survey_id',None)

    if task_id:
        tasks = [db.session.query(Task).get(task_id)]
        survey = tasks[0].survey
    else:
        survey = db.session.query(Survey).get(survey_id)
        tasks = db.session.query(Task).filter(Task.survey==survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).distinct().all()
    
    if checkSurveyPermission(current_user.id,survey.id,'worker'):

        for task in tasks:
            if worker_id:
                if int(worker_id) == current_user.id:
                    workers = [db.session.query(User).get(worker_id)]
                elif checkSurveyPermission(current_user.id,survey.id,'admin'):
                    workers = [db.session.query(User).get(worker_id)]
                else:
                    workers = []
            else:
                childWorker = alias(User)
                workers = db.session.query(User)\
                                    .join(childWorker, childWorker.c.parent_id==User.id)\
                                    .join(Turkcode, childWorker.c.id==Turkcode.user_id)\
                                    .filter(Turkcode.task_id==task.id)\
                                    .distinct().all()

            reply = []
            for worker in workers:
                info = {}
                info['batchCount'] = db.session.query(User)\
                                            .join(Turkcode)\
                                            .filter(User.parent_id==worker.id)\
                                            .filter(Turkcode.task_id==task.id)\
                                            .distinct().count()

                turkcodes = db.session.query(Turkcode)\
                                    .join(User)\
                                    .filter(User.parent_id==worker.id)\
                                    .filter(Turkcode.task_id==task.id)\
                                    .distinct().all()

                totalTime = 0
                for turkcode in turkcodes:
                    if turkcode.tagging_time:
                        totalTime += turkcode.tagging_time
                                    
                info['taggingTime'] = round(totalTime/3600,2)
                info['username'] = worker.username

                reply.append(info)

        if worker_id:
            headings = {'batchCount': 'Batches Completed', 'taggingTime': 'Tagging Time (h)'}
        else:
            headings = {'username': 'User', 'batchCount': 'Batches Completed', 'taggingTime': 'Tagging Time (h)'}

        return json.dumps({'headings': headings, 'data': reply})

    return json.dumps("error")

@app.route('/getHomeSurveys')
@login_required
def getHomeSurveys():
    '''Returns a paginated list of all surveys and their associated tasks for the current user.'''

    reqID = request.args.get('reqID', -1, type=int)
    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 5, type=int)
    search = request.args.get('search', '', type=str)
    current_downloads = request.args.get('downloads', '', type=str)
    permission_order = [None, 'worker', 'hidden', 'read', 'write', 'admin']

    siteSQ = db.session.query(Survey.id,func.count(Trapgroup.id).label('count')).join(Trapgroup).group_by(Survey.id).subquery()
    # availableJobsSQ = db.session.query(Task.id,func.count(Turkcode.id).label('count')).join(Turkcode).filter(Turkcode.active==True).group_by(Task.id).subquery()
    completeJobsSQ = db.session.query(Task.id,(func.count(Turkcode.id)-Task.jobs_finished).label('count'))\
                                        .join(Turkcode)\
                                        .join(User)\
                                        .filter(User.parent_id!=None)\
                                        .filter(Turkcode.tagging_time!=None)\
                                        .group_by(Task.id).subquery()

    ShareUserPermissions = alias(UserPermissions)

    survey_base_query = surveyPermissionsSQ(db.session.query(
                                Survey.id,
                                Survey.name,
                                Survey.description,
                                Survey.image_count,
                                Survey.video_count,
                                Survey.frame_count,
                                Survey.status,
                                siteSQ.c.count,
                                Task.id,
                                Task.name,
                                Task.status,
                                Task.complete,
                                Task.tagging_level,
                                Task.cluster_count,
                                Task.id, #temp replacement for Task.clusters_remaining
                                Task.id, #availableJobsSQ.c.count,
                                completeJobsSQ.c.count,
                                Organisation.name,
                                UserPermissions.user_id,
                                UserPermissions.default,
                                UserPermissions.delete, #20
                                SurveyPermissionException.user_id,
                                SurveyPermissionException.permission,
                                ShareUserPermissions.c.user_id,
                                ShareUserPermissions.c.default,
                                SurveyShare.permission,
                                UserPermissions.create,
                                Survey.require_launch,
                            ).outerjoin(Task,Task.survey_id==Survey.id)\
                            .outerjoin(siteSQ,siteSQ.c.id==Survey.id)\
                            .outerjoin(completeJobsSQ,completeJobsSQ.c.id==Task.id)\
                            .filter(or_(Task.id==None,~Task.name.contains('_o_l_d_'))),current_user.id,'read', ShareUserPermissions)

    # uploading/downloading surveys always need to be on the page
    compulsory_surveys = survey_base_query.filter(Survey.status=='Uploading').all()
    if current_downloads != '': compulsory_surveys.extend(survey_base_query.filter(Survey.id.in_(re.split('[,]',current_downloads))).all())

    # digest survey data
    survey_data = {}
    survey_permissions = {}
    handled_tasks = []
    for item in compulsory_surveys:

        if item[0] and (item[0] not in survey_data.keys()):
            surveyStatus = item[6]
            if surveyStatus in ['indprocessing','Preparing Download']:
                surveyStatus = 'processing'

            survey_data[item[0]] = {'id': item[0],
                                    'name': item[1], 
                                    'description': item[2], 
                                    'numImages': item[3], 
                                    'numVideos': item[4], 
                                    'numFrames': item[5], 
                                    'status': surveyStatus, 
                                    'numTrapgroups': item[7] if item[7] else 0,
                                    'organisation': item[17],
                                    'tasks': []}

            if 'preprocessing' in surveyStatus.lower():
                prep_statusses = surveyStatus.split(',')
                survey_data[item[0]]['status'] = prep_statusses[0]
                survey_data[item[0]]['prep_statusses'] = prep_statusses[1:]
                prep_progress = 0
                if prep_statusses[1] in ['Available', 'In Progress']:
                    prep_progress = 0
                elif prep_statusses[2] in ['Available', 'In Progress']:
                    prep_progress = 1
                else:
                    prep_progress = 2
                survey_data[item[0]]['prep_progress'] = prep_progress
            elif surveyStatus.lower() == 'restoring files':
                survey_data[item[0]]['restore'] = 0
                survey_data[item[0]]['total_restore'] = Config.RESTORE_TIME/3600
                require_launch = item[27]
                if require_launch:
                    restore_time = math.floor(((Config.RESTORE_TIME-(require_launch-datetime.now()).total_seconds()) / 3600))
                    survey_data[item[0]]['restore'] = restore_time

        if item[8] and (item[9]!='default') and (item[8] not in handled_tasks):
            handled_tasks.append(item[8])
            clusters_remaining = GLOBALS.redisClient.get('clusters_remaining_'+str(item[8]))
            if clusters_remaining: clusters_remaining = int(clusters_remaining.decode())

            jobsAvailable = GLOBALS.redisClient.scard('job_pool_'+str(item[8]))

            taskInfo = {'id': item[8],
                        'name': item[9],
                        'status': item[10],
                        'complete': item[11],
                        'tagging_level': item[12],
                        'total': item[13],
                        'remaining': clusters_remaining,
                        'jobsAvailable': jobsAvailable,
                        'jobsCompleted': item[16]}

            if taskInfo['total'] and taskInfo['remaining']:
                taskInfo['completed'] = taskInfo['total'] - taskInfo['remaining']
            else:
                taskInfo['completed'] = 0

            survey_data[item[0]]['tasks'].append(taskInfo)

        # user permissions
        if item[0]:
            up_uid=item[18]
            up_default=item[19]
            up_delete=item[20]
            up_create=item[26]
            exception_uid=item[21]
            exception_permission=item[22]
            sup_uid=item[23]
            sup_default=item[24]
            share_permission=item[25]
            if item[0] not in survey_permissions.keys():
                survey_permissions[item[0]] = {'exception': None, 'share_level': None, 'default': None, 'share_default': None, 'delete': False, 'create': False}
            if exception_permission and (exception_uid==current_user.id): survey_permissions[item[0]]['exception']=exception_permission
            if up_default and (up_uid==current_user.id): survey_permissions[item[0]]['default']=up_default
            if sup_default and (sup_uid==current_user.id) and (permission_order.index(sup_default) > permission_order.index(survey_permissions[item[0]]['share_default'])): survey_permissions[item[0]]['share_default']=sup_default
            if share_permission and (sup_uid==current_user.id): survey_permissions[item[0]]['share_level']=share_permission
            if up_delete and (up_uid==current_user.id): survey_permissions[item[0]]['delete']=up_delete
            if up_create and (up_uid==current_user.id): survey_permissions[item[0]]['create']=up_create

    for survey_id in survey_permissions:
        if survey_permissions[survey_id]['exception']:
            survey_data[survey_id]['access'] = survey_permissions[survey_id]['exception']
        else:
            if permission_order.index(survey_permissions[survey_id]['share_level']) < permission_order.index(survey_permissions[survey_id]['share_default']):
                survey_permissions[survey_id]['share_default'] = survey_permissions[survey_id]['share_level']
            if permission_order.index(survey_permissions[survey_id]['default']) > permission_order.index(survey_permissions[survey_id]['share_default']):
                survey_data[survey_id]['access'] = survey_permissions[survey_id]['default']
            else:
                survey_data[survey_id]['access'] = survey_permissions[survey_id]['share_default']
        if survey_permissions[survey_id]['delete']:
            survey_data[survey_id]['delete'] = True
        else:
            survey_data[survey_id]['delete'] = False
        if survey_permissions[survey_id]['create']:
            survey_data[survey_id]['create'] = True
        else:
            survey_data[survey_id]['create'] = False

    # add all the searches to the base query
    searches = re.split('[ ,]',search)
    for search in searches:
        survey_base_query = survey_base_query.filter(or_(Survey.name.contains(search),Task.name.contains(search)))

    # add the order to the base query
    # if order == 1:
    #     #Survey date
    #     timestampSQ = db.session.query(Survey.id,func.min(Image.corrected_timestamp).label('timestamp')).join(Trapgroup).join(Camera).join(Image).subquery()
    #     survey_base_query = survey_base_query.join(timestampSQ,timestampSQ.c.id==Survey.id).order_by(timestampSQ.c.timestamp)
    if order == 2:
        #Survey add date
        survey_base_query = survey_base_query.order_by(Survey.id)
    elif order == 3:
        #Alphabetical
        survey_base_query = survey_base_query.order_by(Survey.name)
    # elif order == 4:
    #     #Survey date descending
    #     timestampSQ = db.session.query(Survey.id,func.min(Image.corrected_timestamp).label('timestamp')).join(Trapgroup).join(Camera).join(Image).subquery()
    #     survey_base_query = survey_base_query.join(timestampSQ,timestampSQ.c.id==Survey.id).order_by(desc(timestampSQ.c.timestamp))
    elif order == 5:
        #Add date descending
        survey_base_query = survey_base_query.order_by(desc(Survey.id))

    count = 5-len(survey_data)
    if count <=0: count = 1
    
    if count > 0:
        surveys = survey_base_query.all()

        # digest the rest of the data
        survey_data2 = {}
        survey_permissions = {}
        handled_tasks = []
        for item in surveys:
            
            if item[0] and (item[0] not in survey_data2.keys()):
                surveyStatus = item[6]
                if surveyStatus in ['indprocessing','Preparing Download']:
                    surveyStatus = 'processing'

                survey_data2[item[0]] = {'id': item[0],
                                        'name': item[1], 
                                        'description': item[2], 
                                        'numImages': item[3], 
                                        'numVideos': item[4], 
                                        'numFrames': item[5], 
                                        'status': surveyStatus, 
                                        'numTrapgroups': item[7] if item[7] else 0,
                                        'organisation': item[17],
                                        'tasks': []}

                if 'preprocessing' in surveyStatus.lower():
                    prep_statusses = surveyStatus.split(',')
                    survey_data2[item[0]]['status'] = prep_statusses[0]
                    survey_data2[item[0]]['prep_statusses'] = prep_statusses[1:]
                    prep_progress = 0
                    if prep_statusses[1] in ['Available', 'In Progress']:
                        prep_progress = 0
                    elif prep_statusses[2] in ['Available', 'In Progress']:
                        prep_progress = 1
                    else:
                        prep_progress = 2
                    survey_data2[item[0]]['prep_progress'] = prep_progress
                elif surveyStatus.lower() == 'restoring files':
                    survey_data2[item[0]]['restore'] = 0
                    survey_data2[item[0]]['total_restore'] = Config.RESTORE_TIME/3600
                    require_launch = item[27]
                    if require_launch:
                        restore_time = math.floor(((Config.RESTORE_TIME-(require_launch-datetime.now()).total_seconds()) / 3600))
                        survey_data2[item[0]]['restore'] = restore_time

            if item[8] and (item[9]!='default') and (item[8] not in handled_tasks):
                handled_tasks.append(item[8])
                clusters_remaining = GLOBALS.redisClient.get('clusters_remaining_'+str(item[8]))
                if clusters_remaining: clusters_remaining = int(clusters_remaining.decode())

                jobsAvailable = GLOBALS.redisClient.scard('job_pool_'+str(item[8]))

                taskInfo = {'id': item[8],
                            'name': item[9],
                            'status': item[10],
                            'complete': item[11],
                            'tagging_level': item[12],
                            'total': item[13],
                            'remaining': clusters_remaining,
                            'jobsAvailable': jobsAvailable,
                            'jobsCompleted': item[16]}

                if taskInfo['total'] and taskInfo['remaining']:
                    taskInfo['completed'] = taskInfo['total'] - taskInfo['remaining']
                else:
                    taskInfo['completed'] = 0

                survey_data2[item[0]]['tasks'].append(taskInfo)

            # user permissions
            if item[0]:
                up_uid=item[18]
                up_default=item[19]
                up_delete=item[20]
                up_create=item[26]
                exception_uid=item[21]
                exception_permission=item[22]
                sup_uid=item[23]
                sup_default=item[24]
                share_permission=item[25]
                if item[0] not in survey_permissions.keys():
                    survey_permissions[item[0]] = {'exception': None, 'share_level': None, 'default': None, 'share_default': None, 'delete': False, 'create': False}
                if exception_permission and (exception_uid==current_user.id): survey_permissions[item[0]]['exception']=exception_permission
                if up_default and (up_uid==current_user.id): survey_permissions[item[0]]['default']=up_default
                if sup_default and (sup_uid==current_user.id) and (permission_order.index(sup_default) > permission_order.index(survey_permissions[item[0]]['share_default'])): survey_permissions[item[0]]['share_default']=sup_default
                if share_permission and (sup_uid==current_user.id): survey_permissions[item[0]]['share_level']=share_permission
                if up_delete and (up_uid==current_user.id): survey_permissions[item[0]]['delete']=up_delete
                if up_create and (up_uid==current_user.id): survey_permissions[item[0]]['create']=up_create

        for survey_id in survey_permissions:
            if survey_permissions[survey_id]['exception']:
                survey_data2[survey_id]['access'] = survey_permissions[survey_id]['exception']
            else:
                if permission_order.index(survey_permissions[survey_id]['share_level']) < permission_order.index(survey_permissions[survey_id]['share_default']):
                    survey_permissions[survey_id]['share_default'] = survey_permissions[survey_id]['share_level']
                if permission_order.index(survey_permissions[survey_id]['default']) > permission_order.index(survey_permissions[survey_id]['share_default']):
                    survey_data2[survey_id]['access'] = survey_permissions[survey_id]['default']
                else:
                    survey_data2[survey_id]['access'] = survey_permissions[survey_id]['share_default']
            if survey_permissions[survey_id]['delete']:
                survey_data2[survey_id]['delete'] = True
            else:
                survey_data2[survey_id]['delete'] = False
            if survey_permissions[survey_id]['create']:
                survey_data2[survey_id]['create'] = True
            else:
                survey_data2[survey_id]['create'] = False

        survey_ids = [survey_id for survey_id in survey_data2.keys() if survey_id not in survey_data.keys()]

        if (page*count) >= len(survey_ids):
            has_next = False
        else:
            has_next = True

        if (page-1)*count > 0:
            has_prev = True
        else:
            has_prev = False

        survey_ids = survey_ids[(page-1)*count:page*count]

        for survey_id in survey_ids:
            survey_data[survey_id] = survey_data2[survey_id]

        next_url = url_for('getHomeSurveys', page=(page+1), order=order, downloads=current_downloads, search=search) if has_next else None
        prev_url = url_for('getHomeSurveys', page=(page-1), order=order, downloads=current_downloads, search=search) if has_prev else None

    else:
        next_url = None
        prev_url = None

    # Handle disabled launches & translate to legacy client format
    survey_list = []
    for survey_id in survey_data:
        survey = survey_data[survey_id]

        disabledLaunch='false'
        for task in survey['tasks']:
            if task['status'] and (task['status'].lower() not in Config.TASK_READY_STATUSES):
                disabledLaunch='true'

            if task['tagging_level'] and ('-5' in task['tagging_level']) and (task['status']=='PROGRESS'):
                dbTask = db.session.query(Task).get(task['id'])
                if dbTask.sub_tasks:
                    task['status'] = 'Processing'

                if task['remaining'] != None:
                    task['remaining'] = str(task['remaining']) + ' individuals remaining'
                else:
                    task['remaining'] = '0 individuals remaining'
            elif task['tagging_level']:
                if task['remaining'] != None:
                    task['remaining'] = str(task['remaining']) + ' clusters remaining'
                else:
                    task['remaining'] = '0 clusters remaining'

        for task in survey['tasks']:
            task['disabledLaunch'] = disabledLaunch

        survey_list.append(survey)

    current_user.last_ping = datetime.utcnow()
    db.session.commit()

    return json.dumps({'reqID': reqID, 'surveys': survey_list, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getJobs')
@login_required
def getJobs():
    '''Returns a paginated list of available jobs available to the current user.'''
    
    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 5, type=int)
    search = request.args.get('search', '', type=str)
    individual_id = request.args.get('individual_id', 'false', type=str)

    # availableJobsSQ = db.session.query(Task.id,func.count(Turkcode.id).label('count')).join(Turkcode).filter(Turkcode.active==True).group_by(Task.id).subquery()
    completeJobsSQ = db.session.query(Task.id,(func.count(Turkcode.id)-Task.jobs_finished).label('count'))\
                                        .join(Turkcode)\
                                        .join(User)\
                                        .filter(User.parent_id!=None)\
                                        .filter(Turkcode.tagging_time!=None)\
                                        .group_by(Task.id).subquery()

    Worker = alias(User)

    task_base_query = annotationPermissionSQ(db.session.query(
                                Task.id,
                                Task.tagging_level,
                                Task.cluster_count,
                                Task.id, #temp replacement for Task.clusters_remaining
                                Task.id, #availableJobsSQ.c.count,
                                completeJobsSQ.c.count,
                                Survey.name,
                                Task.init_complete,
                                Task.is_bounding,
                                Organisation.name
                            ).join(Survey,Task.survey_id==Survey.id)\
                            .outerjoin(completeJobsSQ,completeJobsSQ.c.id==Task.id),current_user.id)
                            # .join(User,Survey.user_id==User.id)\
                            # .outerjoin(Worker, User.workers)\
                            # .filter(or_(User.id==current_user.id,Worker.c.id==current_user.id))

    if individual_id=='true':
        # We need to included the launching tasks on the individual ID page
        task_base_query = task_base_query.filter(or_(Task.status=='PROGRESS',Task.status=='PENDING')).filter(Task.sub_tasks.any()).filter(Task.tagging_level.contains('-5'))
    else:
        task_base_query = task_base_query.filter(Task.status=='PROGRESS')

    searches = re.split('[ ,]',search)
    for search in searches:
        task_base_query = task_base_query.filter(or_(Survey.name.contains(search),Task.name.contains(search)))

    # if order == 1:
    #     #Survey date
    #     # tasks = tasks.join(Trapgroup).join(Camera).join(Image).order_by(Image.corrected_timestamp)
    #     task_base_query = task_base_query.join(Cluster).join(Image,Cluster.images).order_by(Image.corrected_timestamp)
    if order == 2:
        #Survey add date
        task_base_query = task_base_query.order_by(Survey.id)
    elif order == 3:
        #Alphabetical
        task_base_query = task_base_query.order_by(Survey.name)
    # elif order == 4:
    #     #Survey date descending
    #     # tasks = tasks.join(Trapgroup).join(Camera).join(Image).order_by(desc(Image.corrected_timestamp))
    #     task_base_query = task_base_query.join(Cluster).join(Image,Cluster.images).order_by(desc(Image.corrected_timestamp))
    elif order == 5:
        #Add date descending
        task_base_query = task_base_query.order_by(desc(Survey.id))

    tasks = task_base_query.all()

    # digest the data
    task_list = []
    individual_id_names = []
    covered_tasks = []
    for item in tasks:
        sub_task_permission = True
        if item[0] not in covered_tasks:
            covered_tasks.append(item[0])
            clusters_remaining = GLOBALS.redisClient.get('clusters_remaining_'+str(item[0]))
            if clusters_remaining: clusters_remaining = int(clusters_remaining.decode())

            jobsAvailable = GLOBALS.redisClient.scard('job_pool_'+str(item[0]))

            # Get the task type and species-level
            if '-4' in item[1] or '-5' in item[1]:
                task_type = 'Individual ID'
                species = re.split(',',item[1])[1]
                if '-5' in item[1]:
                    quantile = re.split(',',item[1])[3]
                    task_type+=' - top {}% quantile'.format(round(100-float(quantile)))
            elif '-3' in item[1]:
                task_type = 'AI Species Check'
                species = 'All'
            elif '-8' in item[1]:
                task_type = 'Related Cluster Check'
                species = 'All'
            elif '-2' in item[1]:
                task_type = 'Informational Tagging'
                if ',' in item[1]:
                    species = db.session.query(Label).get(re.split(',',item[1])[1]).description
                else:
                    species = 'All'
            elif '-1' in item[1]:
                if item[7] == False:
                    task_type = 'Species Labelling'
                    species = 'Top-level'
                else:
                    task_type = 'Multi-Species Differentiation'
                    species = 'All'
            # elif '-6' in item[1]:
            #     # NOTE: This is not currently used (is for check masked sightings)
            #     task_type = 'Review Masked Sightings'
            #     species = 'All'
            elif '-7' in item[1]:
                task_type = 'Empty Label Check'
                species = 'All'
            else:
                if item[8] == False:
                    task_type = 'Species Labelling'
                else:
                    task_type = 'Sighting Correction'
                species = db.session.query(Label).get(item[1]).description

            taskInfo = {'id': item[0],
                        'name': item[6],
                        'tagging_level': item[1],
                        'species': species,
                        'type': task_type,
                        'total': item[2],
                        'remaining': clusters_remaining,
                        'jobsAvailable': jobsAvailable,
                        'jobsCompleted': item[5],
                        'organisation': item[9]}

            if taskInfo['total'] and taskInfo['remaining']:
                taskInfo['completed'] = taskInfo['total'] - taskInfo['remaining']
            else:
                taskInfo['completed'] = 0

            if '-5' in taskInfo['tagging_level']:
                dbTask = db.session.query(Task).get(taskInfo['id'])
                if dbTask.sub_tasks:
                    species = re.split(',',taskInfo['tagging_level'])[1]
                    name = species+' Individual ID'

                    count = 1
                    while name in individual_id_names:
                        count += 1
                        name = species+' Individual ID '+str(count)
                    individual_id_names.append(name)

                    taskInfo['name'] = name

                    # Check for sub task permission and if you do not have permission then do not add task to list  
                    if not all(checkAnnotationPermission(current_user.id,sub_task.id) for sub_task in dbTask.sub_tasks):
                        sub_task_permission = False

                if taskInfo['remaining'] != None:
                    taskInfo['remaining'] = str(taskInfo['remaining']) + ' individuals remaining'
                else:
                    taskInfo['remaining'] = '0 individuals remaining'

            else:
                if taskInfo['remaining'] != None:
                    taskInfo['remaining'] = str(taskInfo['remaining']) + ' clusters remaining'
                else:
                    taskInfo['remaining'] = '0 clusters remaining'
            
            if sub_task_permission:
                task_list.append(taskInfo)

    if (page*5) >= len(task_list):
        has_next = False
    else:
        has_next = True

    if (page-1)*5 > 0:
        has_prev = True
    else:
        has_prev = False

    task_list = task_list[(page-1)*5:page*5]

    next_url = url_for('getJobs', page=(page+1), order=order) if has_next else None
    prev_url = url_for('getJobs', page=(page-1), order=order) if has_prev else None

    current_user.last_ping = datetime.utcnow()
    db.session.commit()

    return json.dumps({'jobs': task_list, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getWorkers')
@login_required
def getWorkers():
    '''Returns a paginated list of users for annotation statistics'''

    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)
    search = request.args.get('search', '', type=str)

    # worker_ids = [r.id for r in current_user.workers]
    # worker_ids.append(current_user.id)

    worker_ids = [current_user.id]
    org_ids = [r[0] for r in db.session.query(Organisation.id).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').all()]
    if len(org_ids) > 0:
        worker_ids.extend([r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id.in_(org_ids)).distinct().all()])

    workers = db.session.query(User).filter(User.id.in_(worker_ids))

    searches = re.split('[ ,]',search)
    for search in searches:
        workers = workers.filter(or_(User.username.contains(search),User.email.contains(search)))

    if order == 1:
        #alphabetical
        workers = workers.order_by(User.username)
    elif order == 2:
        #Reverse Alphabetical
        workers = workers.order_by(desc(User.username))
    elif order == 3:
        #join date
        workers = workers.order_by(User.id)

    workers = workers.distinct().paginate(page, 5, False)

    worker_list = []
    for worker in workers.items:
        worker_dict = {}
        worker_dict['id'] = worker.id
        worker_dict['name'] = worker.username
        worker_dict['email'] = worker.email
        worker_dict['batch_count'] = len(worker.children[:])

        worker_dict['survey_count'] = db.session.query(Survey)\
                                                .join(Task)\
                                                .join(Turkcode)\
                                                .join(User)\
                                                .filter(User.parent_id==worker.id)\
                                                .distinct().count()
        
        if worker.id==current_user.id:
            worker_dict['isOwner'] = 'true'
        else:
            worker_dict['isOwner'] = 'false'

        turkcodes = db.session.query(Turkcode)\
                            .join(User)\
                            .filter(User.parent_id==worker.id)\
                            .distinct().all()

        totalTime = 0
        for turkcode in turkcodes:
            if turkcode.tagging_time:
                totalTime += turkcode.tagging_time
                            
        worker_dict['taggingTime'] = round(totalTime/3600,2)

        worker_list.append(worker_dict)

    next_url = url_for('getWorkers', page=workers.next_num, order=order) if workers.has_next else None
    prev_url = url_for('getWorkers', page=workers.prev_num, order=order) if workers.has_prev else None

    return json.dumps({'workers': worker_list, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/removeWorkerQualification', methods=['POST'])
@login_required
def removeWorkerQualification():
    '''Removes the specified user from the current user's qualified workers.'''

    status = 'Error'
    message = 'Could not find worker.'

    try:
        worker_id = request.form['worker_id']
        if worker_id:
            worker = db.session.query(User).get(worker_id)
            if worker in current_user.workers:
                current_user.workers.remove(worker)
                db.session.commit()
                status = 'Success'
                message = 'Worker successfully removed.'
    except:
        pass

    return json.dumps({'status': status, 'message':message})

@app.route('/inviteWorker', methods=['POST'])
@login_required
def inviteWorker():
    '''Invites a user to work for the current user.'''

    status = 'Error'
    message = 'Could not find user with that username. Please check the username, or ask them to sign up for a user account.'

    try:
        inviteUsername = ast.literal_eval(request.form['inviteUsername'])
        orgID = ast.literal_eval(request.form['orgID'])

        if inviteUsername:
            organisation = db.session.query(Organisation).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==orgID).filter(UserPermissions.default=='admin').first()
            if organisation:
                worker = db.session.query(User).filter(User.username==inviteUsername).first()
                if worker:
                    check = db.session.query(UserPermissions).filter(UserPermissions.user_id==worker.id).filter(UserPermissions.organisation_id==organisation.id).first()
                    if check:
                        message = 'That user is already a member of your organisation.'
                    else:
                        check_notif = db.session.query(Notification).filter(Notification.user_id==worker.id).filter(Notification.contents.contains(organisation.name+' has invited you to join their organisation.')).first()
                        if check_notif:
                            message = 'That user has already been invited to join your organisation.'
                        else:
                            token = jwt.encode(
                            {'organisation_id': organisation.id, 'worker_id': worker.id, 'user_id': current_user.id},
                            app.config['SECRET_KEY'], algorithm='HS256')

                            url = 'https://'+Config.DNS+'/acceptInvitation/'+token + '/'

                            notification_message = '<p>'+organisation.name+' has invited you to join their organisation. Do you <a href="'+url+'accept">Accept</a> or <a href="'+url+'decline">Decline</a>?</p>'

                            notification = Notification(user_id=worker.id, contents=notification_message, seen=False)
                            db.session.add(notification)

                            url_pending = 'https://'+Config.DNS+'/cancelInvitation/'+token 

                            organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]

                            prev_pending_notif = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains(worker.username+' has been invited to join '+organisation.name+'.')).all()
                            for notification in prev_pending_notif:
                                db.session.delete(notification)

                            for admin_id in organisation_admins:
                                notification_message = '<p>'+worker.username+' has been invited to join '+organisation.name+'. You can <a href="'+url_pending+'">Cancel</a> this invitation.</p>'
                                notification = Notification(user_id=admin_id, contents=notification_message, seen=False)
                                db.session.add(notification)

                            db.session.commit()
                            
                            status = 'Success'
                            message = 'Invitation sent.'
    except:
        pass

    return json.dumps({'status': status, 'message':message})

@app.route('/acceptInvitation/<token>/<action>')
@login_required
def acceptInvitation(token,action):
    '''Accepts a worker's invitation to annotate for a user based on the supplied token.'''

    try:
        if current_user and current_user.is_authenticated:
            info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            organisation_id = info['organisation_id']
            worker_id = info['worker_id']

            organisation = db.session.query(Organisation).get(organisation_id)
            worker = db.session.query(User).get(worker_id)

            notification = db.session.query(Notification).filter(Notification.user_id==current_user.id).filter(Notification.contents.contains(organisation.name+' has invited you to join their organisation.')).first()
            if notification:
                db.session.delete(notification)

            organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]

            pending_notifications = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains(worker.username+' has been invited to join '+organisation.name+'.')).all()
            for pending_notification in pending_notifications:
                db.session.delete(pending_notification)

            if action=='accept':
                user_permission = UserPermissions(user_id=worker_id, organisation_id=organisation_id, default='worker', annotation=False, delete=False)
                db.session.add(user_permission)

                notif_msg_org = '<p>'+worker.username+' has accepted the invitation to join '+organisation.name+'. Please modify their permissions as required <a href="/permissions">here</a>.</p>'
                for admin_id in organisation_admins:
                    notif_org = Notification(user_id=admin_id, contents=notif_msg_org, seen=False)
                    db.session.add(notif_org)

                notif_msg_worker = '<p>You have accepted an invitation to join '+organisation.name+'.</p>'
                notif_worker = Notification(user_id=worker_id, contents=notif_msg_worker, seen=False)
                db.session.add(notif_worker)

            else:
                notif_msg_org = '<p>'+worker.username+' has declined the invitation to join '+organisation.name+'.</p>'
                for admin_id in organisation_admins:
                    notif_org = Notification(user_id=admin_id, contents=notif_msg_org, seen=False)
                    db.session.add(notif_org)

                notif_msg_worker = '<p>You have declined an invitation to join '+organisation.name+'.</p>'
                notif_worker = Notification(user_id=worker_id, contents=notif_msg_worker, seen=False)
                db.session.add(notif_worker)

            db.session.commit()

            updateUserAdminStatus(worker_id)
        
    except:
        pass
    
    return redirect(url_for('index'))

@app.route('/cancelInvitation/<token>')
@login_required
def cancelInvitation(token):
    '''Cancels a worker's invitation to annotate for a user based on the supplied token.'''

    try:

        if current_user and current_user.is_authenticated:
            info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            organisation_id = info['organisation_id']
            worker_id = info['worker_id']

            if checkDefaultAdminPermission(current_user.id,organisation_id):

                organisation = db.session.query(Organisation).get(organisation_id)
                worker = db.session.query(User).get(worker_id)
                organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]   

                invite_notification = db.session.query(Notification).filter(Notification.user_id==worker_id).filter(Notification.contents.contains(organisation.name+' has invited you to join their organisation.')).first()
                if invite_notification:
                    db.session.delete(invite_notification)

                notifications = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains(worker.username+' has been invited to join '+organisation.name+'.')).all()
                for notification in notifications:
                    db.session.delete(notification)

                notif_msg_org = '<p> The invitation for '+worker.username+' to join '+organisation.name+' has been cancelled.</p>'
                for admin_id in organisation_admins:
                    notif_org = Notification(user_id=admin_id, contents=notif_msg_org, seen=False)
                    db.session.add(notif_org)

                db.session.commit()

                updateUserAdminStatus(worker_id)
            else:
                removeAdminNotifications(current_user.id, organisation_id)

    except:
        pass
        
    return redirect(url_for('permissions'))

# @app.route('/reClassify/<survey>')
# @login_required
# def reClassify(survey):
#     '''Initiates the reclassification of the specified survey.'''
    
#     survey = db.session.query(Survey).get(int(survey))
#     classifier = request.form['classifier']
#     if survey and (survey.user==current_user) and (survey.classifier.name != classifier):
#         re_classify_survey.delay(survey_id=survey.id,classifier=classifier)
#     return json.dumps('Success')

@app.route('/classifySpecies', methods=['POST'])
@cross_origin()
def classifySpecies():
    '''The species classifier API endpoint. Takes a list of urls and returns the species contained therein, and their respective scores.'''

    try:
        token = request.form['token']
        urls = re.split(',',request.form['urls'])

        if token==Config.TOKEN:
            result = detectAndClassify.apply_async(kwargs={'batch': urls,'detector_model': Config.DETECTOR,'threshold': Config.DETECTOR_THRESHOLDS[Config.DETECTOR]}, queue='local', routing_key='local.detectAndClassify',expires=datetime.now() + timedelta(minutes=2))
            GLOBALS.lock.acquire()
            with allow_join_result():
                try:
                    response = result.get()
                except:
                    response = 'error'
                result.forget()
            GLOBALS.lock.release()
            return json.dumps(response)
        else:
            return json.dumps('error')
    except:
        return json.dumps('error')


# @app.route('/getSurveyClassificationLevel/<survey>')
# @login_required
# def getSurveyClassificationLevel(survey):
#     '''Returns whether there is an update available for the species classifier used on the specified survey.'''

#     classifier = 'error'
#     survey = db.session.query(Survey).get(int(survey))
#     if survey and (survey.user == current_user):
#         classifier = survey.classifier.name
#     return json.dumps({'classifier': classifier})

# @app.route('/RequestExif', methods=['POST'])
# @login_required
# def RequestExif():
#     '''
#     Initiates the generation of an exif dataset for download. Returns a success/error status.
    
#         Parameters:
#             task_id (int): The task for which exif dataset is needed
#             species (list): The species for download
#             species_sorted (str): Whether the dataset should be sorted into species folders
#             flat_structure (str): Whether the folder structure should be flattened
#     '''

#     task_id = request.form['task']
#     species = ast.literal_eval(request.form['species'])
#     species_sorted = ast.literal_eval(request.form['species_sorted'])
#     flat_structure = ast.literal_eval(request.form['flat_structure'])
#     individual_sorted = ast.literal_eval(request.form['individual_sorted'])

#     if species_sorted.lower()=='true':
#         species_sorted = True
#     else:
#         species_sorted = False

#     if flat_structure.lower()=='true':
#         flat_structure = True
#     else:
#         flat_structure = False

#     if individual_sorted.lower()=='true':
#         individual_sorted = True
#     else:
#         individual_sorted = False

#     task = db.session.query(Task).get(task_id)
#     if task and (task.survey.user==current_user) and (task.status.lower() in Config.TASK_READY_STATUSES):
#         app.logger.info('exif request made: {}, {}, {}, {}, {}'.format(task_id,species,species_sorted,flat_structure,individual_sorted))
#         prepare_exif.delay(task_id=task_id,species=species,species_sorted=species_sorted,flat_structure=flat_structure,individual_sorted=individual_sorted)
#         return json.dumps('Success')

#     return json.dumps('Error')

@app.route('/exportRequest', methods=['POST'])
@login_required
def exportRequest():
    '''
    Initiates the preparation of an export format locally for download. Currently supported export types are: WildBook.
    
        Parameters:
            task_id (int): The task being exported
            exportType (str): The type of export format
            data (dict): The data required for the requested export type
    '''

    task_id = request.form['task']
    exportType = request.form['type']
    data = request.form['data']
    data = ast.literal_eval(data)

    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user==current_user):
    survey = task.survey
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read') and (task.status.lower() in Config.TASK_READY_STATUSES) and (survey.status.lower() in Config.SURVEY_READY_STATUSES):
        app.logger.info('export request made: {}, {}, {}'.format(task_id,exportType,data))

        if exportType == 'WildBook':
            # fileName = task.survey.user.folder+'/docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name
            # fileName = task.survey.organisation.folder+'/docs/'+task.survey.organisation.name+'_'+current_user.username+'_'+task.survey.name+'_'+task.name

            # # Delete old file if exists
            # try:
            #     GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName+'.zip')
            # except:
            #     pass
            if survey.status == 'Restoring Files':
                return json.dumps({'status':'error', 'message': 'Your survey is currently having files restored from archive. Initiating a new export request that requires file restoration is not possible at this time. Please wait for the current restoration process to complete.'})

            check = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==task_id).filter(DownloadRequest.user_id==current_user.id).filter(DownloadRequest.type=='export').filter(DownloadRequest.status=='Pending').first()
            if check:
                return json.dumps({'status':'error',  'message': 'A download request for this task is already pending. Please wait for the previous request to complete.'})
                    
            if Config.DISABLE_RESTORE:
                return json.dumps({'status':'error', 'message': 'File de-archival is currently not available. Please try again later.'})

            # Create Download request
            download_request = DownloadRequest(type='export', user_id=current_user.id, task_id=task_id, status='Pending', timestamp=None)
            db.session.add(download_request)

            survey.status = 'Processing'
            db.session.commit()

            restore_images_for_export.apply_async(kwargs={'task_id':task_id,'data':data,'user_name':current_user.username,'download_request_id':download_request.id, 'days':Config.DOWNLOAD_RESTORE_DAYS,'tier':Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})


        return json.dumps({'status':'success', 'message':None})

    return json.dumps({'status':'error', 'message': None})

@app.route('/createTask/<survey_id>/<parentLabel>', methods=['POST'])
@login_required
def createTask(survey_id,parentLabel):
    '''
    Creates a new task for the specified survey for the current user. Returns success/error status.
    
        Parameters:
            survey_id (int): Survey for which the task must be added
            parentLabel (str): Whether identified species must be classified as their parent label or not
            info (str): The info required for creating the task
            includes (str): A list of the species to be auto-classified
    '''
    
    try:
        info = request.form['info']
        info = info.replace('*****', '/')
        info = ast.literal_eval(info)

        includes = request.form['includes']
        includes = re.split(',',includes)
        if includes == ['']:
            includes = []

        if parentLabel == 'true':
            parentLabel = True
        else:
            parentLabel = False

        translation = request.form['translation']
        translation = ast.literal_eval(translation)
        taskName = info[0].strip()

        # Check if any surveys are busy with a dearchival process
        survey = db.session.query(Survey).get(int(survey_id))
        if survey.status == 'Restoring Files':
            status = 'error'
            message = 'Your survey is currently having files restored from archive. Adding an annotation set is not possible during this process. Please wait until the 48 hour restoration period has completed.'
            return json.dumps({'status':status, 'message':message})

        check = db.session.query(Task).filter(Task.survey_id==int(survey_id)).filter(Task.name==taskName).first()

        if (check == None) and checkSurveyPermission(current_user.id,survey_id,'write') and ('_o_l_d_' not in taskName.lower()) and ('_copying' not in taskName.lower()) and (taskName.lower() != 'default') and (survey.status.lower() in Config.SURVEY_READY_STATUSES):
            add_new_task(survey_id, taskName, includes, translation, info[1], parentLabel)

        return json.dumps({'status':'success', 'message':None})
    except:
        return json.dumps({'status':'error', 'message':'An error occurred while creating the annotation set. '})

@app.route('/editTranslations/<task_id>', methods=['POST'])
@login_required
def editTranslations(task_id):
    '''Endpoint for editing translations. Launches task upon completion and returns success/error status.'''

    task = db.session.query(Task).get(int(task_id))
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
        translation = request.form['translation']
        translation = ast.literal_eval(translation)
        includes = ast.literal_eval(request.form['includes'])
        edit_translations(int(task_id), translation, includes)

        # # prepare lower level translations
        # translations = db.session.query(Translation)\
        #                         .join(Label)\
        #                         .filter(Label.children.any())\
        #                         .filter(Label.description != 'Vehicles/Humans/Livestock')\
        #                         .filter(Label.description != 'Nothing')\
        #                         .filter(Label.description != 'Unknown')\
        #                         .filter(Translation.task_id==int(task_id)).all()
        # for translation in translations:
        #     if not checkChildTranslations(translation.label):
        #         for child in translation.label.children:
        #             createChildTranslations(translation.classification,int(task_id),child)    
        # db.session.commit()

        task.status = 'PENDING'
        task.is_bounding = False
        task.survey.status = 'Launched'
        db.session.commit()

        if '-4' in task.tagging_level or '-5' in task.tagging_level:
            restore_images_for_id.apply_async(kwargs={'task_id':task.id,'days':Config.ID_RESTORE_DAYS,'tier':Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})
        elif '-7' in task.tagging_level:
            restore_empty_zips.apply_async(kwargs={'task_id':task.id,'tier':Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})
        else:
            if len(includes) > 0:
                launch_task.apply_async(kwargs={'task_id':task.id, 'classify':True})
            else:
                launch_task.apply_async(kwargs={'task_id':task.id})

    return json.dumps('success')

@app.route('/UploadCSV', methods=['POST'])
@login_required
def UploadCSV():
    '''
    Endpoint for handling annotation-data csvs. Validates csv before creating a new task and importing the csv. Returns success/error status.
    
        Parameters:
            taskName (str): Name for the created task
            survey_id (int): The ID of the survey to create the task for
            csv (file): The csv file to import
    '''

    taskName = request.form['taskName']
    survey_id = int(request.form['survey'])
    survey = db.session.query(Survey).get(survey_id)

    # if survey and (survey.user==current_user):
    if survey and checkSurveyPermission(current_user.id,survey_id,'write'):
        survey_name = survey.name
        filePath = 'import/'+current_user.username+'/'+survey_name+'_'+taskName+'.csv'

        uploaded_file = request.files['csv']
        if uploaded_file and uploaded_file.filename != '':
            if os.path.splitext(uploaded_file.filename)[1].lower() == '.csv':
                if validate_csv(uploaded_file.stream,survey_id):

                    with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                        uploaded_file.save(temp_file.name)
                        GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=filePath,Body=temp_file)

                    task = Task(survey_id=survey_id,name=taskName,tagging_level='-1',test_size=0,status='Importing')
                    db.session.add(task)
                    survey.status = 'Importing'
                    db.session.commit()
                    task_id = task.id

                    importCSV.delay(survey_id=survey_id,task_id=task_id,filePath=filePath,user_id=current_user.id)
                    return json.dumps('success')

    return json.dumps('error')

@app.route('/explore')
@login_required
def explore():
    '''Renders the explore page for the specified task.'''
    
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.admin:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            task_id = request.args.get('task', None)
            if task_id:
                task = db.session.query(Task).get(task_id)
                if task and checkSurveyPermission(current_user.id,task.survey_id,'read') and (task.status.lower() in Config.TASK_READY_STATUSES) and (task.survey.status.lower() in Config.SURVEY_READY_STATUSES):
                    task.tagging_level = '-1'
                    db.session.commit()
                    return render_template('html/explore.html', title='Explore', helpFile='explore', bucket=Config.BUCKET, version=Config.VERSION)
            return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

@app.route('/exploreKnockdowns')
@login_required
def exploreKnockdowns():
    '''Renders the knockdown analysis page for the specified task.'''
    
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.admin:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            task_id = request.args.get('task', None)
            task = db.session.query(Task).get(task_id)
            # if task and (task.survey.user==current_user):
            if task and (checkAnnotationPermission(current_user.parent_id,task.id) or checkSurveyPermission(current_user.id,task.survey_id,'write')):
                GLOBALS.redisClient.set('knockdown_ping_'+str(task_id),datetime.utcnow().timestamp())
                return render_template('html/knockdown.html', title='Knockdowns', helpFile='knockdown_analysis', bucket=Config.BUCKET, version=Config.VERSION)
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

@app.route('/js/<path>')
def send_js(path):
    '''Serves all JavaScript files after removing their version numbers.'''
    
    if 'camtrap' in path:
        path = path.split('.')
        del path[-2]
        path = '.'.join(path)

    return send_from_directory('../static/js', path)

@app.route('/webfonts/<path>')
def send_webfonts(path):
    '''Serves all webfonts files'''
    return send_from_directory('../static/webfonts', path)

@app.route('/images/<path:path>')
def send_im(path):
    '''Serves all image files.'''
    return send_from_directory('../static/images', path)

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    '''Renders the login page, and handles the form submission.'''

    if current_user.is_authenticated:
        if current_user.admin:
            if current_user.username=='Dashboard':
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs', _external=True))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings', _external=True))
                else:
                    return redirect(url_for('index', _external=True))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()

        if (user is None) or (not user.check_password(form.password.data)):
            flash('Invalid username or password')
            return redirect(url_for('login_page', _external=True))
        
        login_user(user, remember=form.remember_me.data)
        app.logger.info(current_user.username + ' logged in.')
        next_page = request.args.get('next')
        if not next_page or url_parse(next_page).netloc != '':
            if user.admin:
                next_page = url_for('surveys', _external=True)
            elif user.parent_id == None:
                if user.permissions:
                    next_page = url_for('jobs', _external=True)
                else:
                    next_page = url_for('landing', _external=True)
        return redirect(next_page)

    return render_template('html/login.html', title='Sign In', form=form, helpFile='login', version=Config.VERSION)

@app.route('/load_login/<user_id>', methods=['GET', 'POST'])
def load_login(user_id):
    '''Provides a login point for the Locust load-testing bots. Only active when Config.LOAD_TESTING is set to true. 
    Keeps track of the total actiove load-testers in the load_testers global variable.'''

    if Config.LOAD_TESTING:
        organisation = db.session.query(User).get(int(user_id))
        if organisation:
            username = 'load_tester_'+str(GLOBALS.load_testers)
            user = db.session.query(User).filter(User.username==username).first()
            if user == None:
                user = User(username=username, admin=False, cloud_access=False)
                user.set_password(randomString())
                db.session.add(user)
                turkcode = Turkcode(code=username, active=False, tagging_time=0)
                turkcode.user=user
                db.session.add(turkcode)
                db.session.commit()

            if user not in organisation.workers[:]:
                organisation.workers.append(user)
                db.session.commit()

            GLOBALS.load_testers +=1

            login_user(user)
            app.logger.info('Locust user {} logged in successfully'.format(user.username))
            return redirect(url_for('jobs', _external=True))

    return json.dumps('error')

@app.route('/get_username')
def get_username():
    '''Returns the current user's username for the Locust load-testers. Only active when Config.LOAD_TESTING is true.'''

    if Config.LOAD_TESTING:
        return json.dumps(current_user.username)
    else:
        return json.dumps('error')

@app.route('/get_available_task/<organisation_id>')
def get_available_task(organisation_id):
    '''Returns a random task ID from the currently active tasks for load-testing purposes. Only active when Config.LOAD_TESTING is true.'''

    if Config.LOAD_TESTING:
        task = db.session.query(Task).join(Survey).filter(Survey.organisation_id==int(organisation_id)).filter(Task.status=='PROGRESS').order_by(func.rand()).first()
        if task:
            return json.dumps(task.id)
        else:
            return json.dumps('inactive')
    else:
        return json.dumps('error')

@app.route('/logout')
def logout():
    '''Logs out the current user.'''
    logout_user()
    return redirect(url_for('login_page', _external=True))

@app.route('/ping', methods=['POST'])
@login_required
def ping():
    '''Keeps the current user's annotation session active.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    if current_user.is_authenticated:
        current_user.last_ping = datetime.utcnow()
        db.session.commit()
        if current_user.parent:
            if Config.DEBUGGING: app.logger.info('Ping received from {} ({})'.format(current_user.parent.username,current_user.id))
        return json.dumps('success')

    return json.dumps('error')

@app.route('/skipSuggestion/<individual_1>/<individual_2>')
@login_required
def skipSuggestion(individual_1,individual_2):
    '''Skips the individual ID suggestion, removing the IndSimilarity from the session until relaunch. Returns success/error status and progress numbers.'''
    
    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual1.tasks]))\
                                .filter(Individual.species==individual1.species)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual2.tasks]))\
                                .filter(Individual.species==individual2.species)\
                                .filter(Individual.active==True)\
                                .first()

    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    # if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and ((current_user.parent in individual1.tasks[0].survey.user.workers) or (current_user.parent == individual1.tasks[0].survey.user)):
    if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and (all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids)):

        indSimilarity = db.session.query(IndSimilarity).filter(\
                                            or_(\
                                                and_(\
                                                    IndSimilarity.individual_1==int(individual_1),\
                                                    IndSimilarity.individual_2==int(individual_2)),\
                                                and_(\
                                                    IndSimilarity.individual_1==int(individual_2),\
                                                    IndSimilarity.individual_2==int(individual_1))\
                                            )).first()

        if indSimilarity:
            indSimilarity.skipped = True
            db.session.commit()
            return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1),task.id)})
    return json.dumps({'status': 'error'})

@app.route('/undoPreviousSuggestion/<individual_1>/<individual_2>')
@login_required
def undoPreviousSuggestion(individual_1,individual_2):
    '''Undoes the previous action for the two speciefied individual IDs. Returns error/success status, progress numbers and the current images associated with the first individual.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))
    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size
    
    # if (individual1 and individual2) and ((any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks))) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and ((current_user.parent in individual1.tasks[0].survey.user.workers) or (current_user.parent == individual1.tasks[0].survey.user)):
    if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and (all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids)):
        indSimilarity = db.session.query(IndSimilarity).filter(\
                                        or_(\
                                            and_(\
                                                IndSimilarity.individual_1==int(individual_1),\
                                                IndSimilarity.individual_2==int(individual_2)),\
                                            and_(\
                                                IndSimilarity.individual_1==int(individual_2),\
                                                IndSimilarity.individual_2==int(individual_1))\
                                        )).first()

        if indSimilarity or (individual1.name == 'unidentifiable'):
            handleIndividualUndo(indSimilarity,individual1,individual2,task.id)

            db.session.commit()
            sortedImages = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(individual1)).order_by(Image.corrected_timestamp).all()

            images = []
            for image in sortedImages:
                output = {'id': image.id,
                        'url': (image.camera.path + '/' + image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                        'timestamp': numify_timestamp(image.corrected_timestamp),
                        'camera': image.camera_id,
                        'rating': image.detection_rating,
                        'latitude': image.camera.trapgroup.latitude,
                        'longitude': image.camera.trapgroup.longitude,
                        'detections': []}

                detection = db.session.query(Detection)\
                                    .filter(Detection.image_id==image.id)\
                                    .filter(Detection.individuals.contains(individual1))\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .filter(Detection.static==False)\
                                    .first()

                output['detections'].append({'id': detection.id,
                                            'top': detection.top,
                                            'bottom': detection.bottom,
                                            'left': detection.left,
                                            'right': detection.right,
                                            'category': detection.category,
                                            'individual': '-1',
                                            'static': detection.static})

                images.append(output)

            return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1),task.id), 'images': images, 'id': individual1.id})

    return json.dumps({'status': 'error'})

@app.route('/dissociateDetection/<detection_id>')
@login_required
def dissociateDetection(detection_id):
    '''Dissociates the specified detection from either its current individual or the specified one. The detection will be allocated to a new individual, 
    and all necessary individual similarities recalculated. Returns a success/error status.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual_id = request.args.get('individual_id', None)
    if individual_id:
        individual = db.session.query(Individual).get(individual_id)
        task = db.session.query(Task).join(Individual,Task.individuals).filter(Task.sub_tasks.any()).filter(Individual.id==individual_id).distinct().first()
        if not task: task = individual.tasks[0]
    else:
        task = current_user.turkcode[0].task

    tasks = [r for r in task.sub_tasks]
    tasks.append(task)

    detection = db.session.query(Detection).get(detection_id)

    # if task and detection and ((current_user==task.survey.user) or (current_user.parent in detection.image.camera.trapgroup.survey.user.workers) or (current_user.parent == detection.image.camera.trapgroup.survey.user)):
    if task and detection and (all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in tasks) or all(checkAnnotationPermission(current_user.parent_id,task.id) for task in tasks)):

        if not individual_id:
            individual = db.session.query(Individual)\
                                    .filter(Individual.tasks.contains(task))\
                                    .filter(Individual.detections.contains(detection))\
                                    .filter(Individual.active==True)\
                                    .first()

        if individual and (detection in individual.detections[:]):
            individual.detections.remove(detection)

        newIndividual = Individual( name=generateUniqueName(task.id,individual.species,'n'),
                                    species=individual.species,
                                    user_id=current_user.id,
                                    timestamp=datetime.utcnow())

        db.session.add(newIndividual)
        newIndividual.detections.append(detection)

        if task.sub_tasks:
            task_ids = [r.id for r in task.sub_tasks]
        else:
            task_ids = [t.id for t in individual.tasks]
        task_ids.append(task.id)
        newIndividual.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .filter(Image.detections.contains(detection))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()
        individual.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.individuals.contains(individual))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()
        db.session.commit()

        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:
            similarity.old_score = similarity.score
        db.session.commit()

        individuals1 = [r[0] for r in db.session.query(Individual.id)\
                                                    .join(Task,Individual.tasks)\
                                                    .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                    .filter(Task.id.in_(task_ids))\
                                                    .filter(Individual.species==individual.species)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .filter(Individual.id != newIndividual.id)\
                                                    .filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id))\
                                                    .filter(or_(IndSimilarity.detection_1==int(detection_id),IndSimilarity.detection_2==int(detection_id)))\
                                                    .all()]

        individuals2 = [r[0] for r in db.session.query(Individual.id)\
                                                    .join(Task,Individual.tasks)\
                                                    .filter(Task.id.in_(task_ids))\
                                                    .filter(Individual.species==individual.species)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .filter(Individual.id != newIndividual.id)\
                                                    .all()]

        calculate_individual_similarity.delay(individual1=individual.id,individuals2=individuals1,species=individual.species)
        calculate_individual_similarity.delay(individual1=newIndividual.id,individuals2=individuals2,species=individual.species)

        newIndSimilarity = IndSimilarity(individual_1=individual.id, individual_2=newIndividual.id, score=0)
        db.session.add(newIndSimilarity)
        db.session.commit()

        return json.dumps({'status': 'success'})

    return json.dumps({'status': 'error'})

@app.route('/reAssociateDetection/<detection_id>/<individual_id>')
@login_required
def reAssociateDetection(detection_id,individual_id):
    '''Re-associates the detection with the specified individual ID, undoing a dissociate action. Restores all necessary similarity scores, and returns success/error status.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    detection = db.session.query(Detection).get(detection_id)
    individual = db.session.query(Individual).get(individual_id)
    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)

    # if detection and individual and (task in individual.tasks) and ((current_user.parent in individual.tasks[0].survey.user.workers) or (current_user.parent == individual.tasks[0].survey.user)):
    if detection and individual and (task in individual.tasks) and all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids):

        oldIndividual = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_([r.id for r in individual.tasks]))\
                                .filter(Individual.detections.contains(detection))\
                                .filter(Individual.active==True)\
                                .filter(Individual.species==individual.species)\
                                .first()

        if oldIndividual and (detection in oldIndividual.detections[:]):
            oldIndividual.detections.remove(detection)

            if len(oldIndividual.detections[:]) == 0:
                oldIndividual.active = False

            individual.detections.append(detection)
            individual.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.individuals.contains(individual))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()
            oldIndividual.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.individuals.contains(oldIndividual))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()

            allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
            for similarity in allSimilarities:
                similarity.score = similarity.old_score

            db.session.commit()

        return json.dumps({'status': 'success'})

    return json.dumps({'status': 'error'})

@app.route('/suggestionUnidentifiable/<individual_id>')
@login_required
def suggestionUnidentifiable(individual_id):
    '''Marks the suggested individual as unidentifiable. Returns success/error status, progress count, and unidentifiable ID.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual = db.session.query(Individual).get(int(individual_id))
    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    # if individual and individual.active and (task in individual.tasks) and ((current_user.parent in individual.tasks[0].survey.user.workers) or (current_user.parent == individual.tasks[0].survey.user)):
    if individual and individual.active and (task in individual.tasks) and all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids):
        
        if Config.DEBUGGING: app.logger.info('Individual {} marked as unidentifiable'.format(individual.name))

        for detection in individual.detections:
            rootTask = db.session.query(Task)\
                                .join(Survey)\
                                .join(Trapgroup)\
                                .join(Camera)\
                                .join(Image)\
                                .filter(Image.detections.contains(detection))\
                                .filter(Task.id.in_(task_ids))\
                                .first()

            unidentifiable = db.session.query(Individual)\
                                .filter(Individual.tasks.contains(rootTask))\
                                .filter(Individual.species==individual.species)\
                                .filter(Individual.name=='unidentifiable')\
                                .first()
            
            unidentifiable.detections.append(detection)

        # Search through & update indsimilarities
        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:                    
            similarity.old_score = similarity.score
            similarity.score = -2500

        individual.active = False
        db.session.commit()

        return json.dumps({'status': 'success', 'id': unidentifiable.id})

    return json.dumps({'status': 'error'})

@app.route('/acceptSuggestion/<individual_1>/<individual_2>')
@login_required
def acceptSuggestion(individual_1,individual_2):
    '''Accepts the suggestion that the two specified individuals are the same, combining them. Returns success/error status and progress numbers.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual1.tasks]))\
                                .filter(Individual.species==individual1.species)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual2.tasks]))\
                                .filter(Individual.species==individual2.species)\
                                .filter(Individual.active==True)\
                                .first()

    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    # if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and ((current_user.parent in individual1.tasks[0].survey.user.workers) or (current_user.parent == individual1.tasks[0].survey.user)):
    if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and (all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids)):

        if Config.DEBUGGING: app.logger.info('Individual {} combined into individual {}'.format(individual2.name,individual1.name))

        if individual2.notes != individual1.notes:
            if individual1.notes==None:
                individual1.notes = individual2.notes
            elif individual2.notes==None:
                pass
            else:
                individual1.notes += individual2.notes

        for child in individual2.children[:]:
            if child not in individual1.children[:]:
                individual1.children.append(child)

        for parent in individual2.parents[:]:
            if parent not in individual1.parents[:]:
                individual1.parents.append(parent)

        for tag in individual2.tags[:]:
            if tag not in individual1.tags[:]:
                individual1.tags.append(tag)

        individual1.detections.extend(individual2.detections)
        individual1.user_id = current_user.id
        individual1.timestamp = datetime.utcnow()

        task_ids.extend([t.id for t in individual1.tasks])
        task_ids.extend([t.id for t in individual2.tasks])
        task_ids = list(set(task_ids))

        individual1.tasks = db.session.query(Task)\
                                    .join(Survey)\
                                    .join(Trapgroup)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(Detection)\
                                    .filter(Detection.individuals.contains(individual1))\
                                    .filter(Task.id.in_(task_ids))\
                                    .distinct().all()

        # Search through & update indsimilarities
        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual1.id,IndSimilarity.individual_2==individual1.id)).distinct().all()
        for similarity in allSimilarities:
            similarity.old_score = similarity.score
            if similarity.individual_1 == individual1.id:
                other_id = similarity.individual_2
            else:
                other_id = similarity.individual_1
            if other_id != individual2.id:
                altSimilarity = db.session.query(IndSimilarity).filter(\
                                        or_(\
                                            and_(\
                                                IndSimilarity.individual_1==other_id,\
                                                IndSimilarity.individual_2==individual2.id),\
                                            and_(\
                                                IndSimilarity.individual_1==individual2.id,\
                                                IndSimilarity.individual_2==other_id)\
                                        )).first()
                if altSimilarity:
                    if (altSimilarity.score==-1000) or (similarity.score==-1000):
                        similarity.score = -1000
                    elif (altSimilarity.score==-1500) or (similarity.score==-1500):
                        similarity.score = -1500
                    elif (altSimilarity.score==-2000) or (similarity.score==-2000):
                        similarity.score = -2000
                    elif altSimilarity.score > similarity.score:
                        similarity.score = altSimilarity.score
                        similarity.detection_1 = altSimilarity.detection_1
                        similarity.detection_2 = altSimilarity.detection_2

        individual2.active = False
        db.session.commit()
        
        return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1),task.id)})
    return json.dumps({'status': 'error'})

@app.route('/rejectSuggestion/<individual_1>/<individual_2>')
@login_required
def rejectSuggestion(individual_1,individual_2):
    '''Rejects the suggestion that the two specified individuals are the same, removing their similarity from circulation. 
    Returns success/error status and progress numbers.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual1.tasks]))\
                                .filter(Individual.species==individual1.species)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .join(Task,Individual.tasks)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Task.id.in_([r.id for r in individual2.tasks]))\
                                .filter(Individual.species==individual2.species)\
                                .filter(Individual.active==True)\
                                .first()

    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    # if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and ((current_user.parent in individual1.tasks[0].survey.user.workers) or (current_user.parent == individual1.tasks[0].survey.user)):
    if (individual1 and individual2) and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and (any(task in individual2.tasks for task in task.sub_tasks) or (task in individual2.tasks)) and (individual1 != individual2) and (all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids)):

        indSimilarity  = db.session.query(IndSimilarity).filter(\
                                    or_(\
                                        and_(\
                                            IndSimilarity.individual_1==individual1.id,\
                                            IndSimilarity.individual_2==individual2.id),\
                                        and_(\
                                            IndSimilarity.individual_1==individual2.id,\
                                            IndSimilarity.individual_2==individual1.id)\
                                    )).first()
        
        indSimilarity.old_score = indSimilarity.score
        indSimilarity.score = -2000
        db.session.commit()

        return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1),task.id)})
    return json.dumps({'status': 'error'})

@app.route('/getSuggestion/<individual_id>')
@login_required
def getSuggestion(individual_id):
    '''Gets the next suggested match for the specified individual. Returns a suggestion dictionary.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    suggestion = None
    suggestionID = request.args.get('suggestion', None)
    task = current_user.turkcode[0].task
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    individual1 = db.session.query(Individual).get(int(individual_id))
    reply = {}

    # if individual1 and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and ((current_user.parent in individual1.tasks[0].survey.user.workers) or (current_user.parent == individual1.tasks[0].survey.user)):
    if individual1 and (any(task in individual1.tasks for task in task.sub_tasks) or (task in individual1.tasks)) and all(checkAnnotationPermission(current_user.parent_id,task_id) for task_id in task_ids):

        if suggestionID:
            indSim = db.session.query(IndSimilarity).filter(\
                                        or_(\
                                            and_(\
                                                IndSimilarity.individual_1==int(individual_id),\
                                                IndSimilarity.individual_2==int(suggestionID)),\
                                            and_(\
                                                IndSimilarity.individual_1==int(suggestionID),\
                                                IndSimilarity.individual_2==int(individual_id))\
                                        )).first()

            if indSim and GLOBALS.redisClient.sismember('active_indsims_'+str(current_user.turkcode[0].task_id),indSim.id):
                userIndSms = [int(r.decode()) for r in GLOBALS.redisClient.lrange('user_indsims_'+str(current_user.id),0,-1)]
                if indSim.id in userIndSms:
                    suggestion = indSim

            # if suggestion and not GLOBALS.redisClient.sismember('active_indsims_'+str(current_user.turkcode[0].task_id),suggestion.id):
            #     GLOBALS.redisClient.sadd('active_indsims_'+str(current_user.turkcode[0].task_id),suggestion.id)
        
        elif individual1 and individual1.active:
            tL = re.split(',',task.tagging_level)

            inactiveIndividuals = [r[0] for r in db.session.query(Individual.id)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==individual1.species)\
                                            .filter(Individual.active==False)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .all()]

            taskIndividuals = [r[0] for r in db.session.query(Individual.id)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==individual1.species)\
                                            .all()]

            userIndividuals = [r for r in GLOBALS.redisClient.lrange('user_individuals_'+str(current_user.id),0,-1)]
            activeIndividuals = [int(r.decode()) for r in GLOBALS.redisClient.smembers('active_individuals_'+str(current_user.turkcode[0].task_id)) if r not in userIndividuals]
            inactiveIndividuals.extend(activeIndividuals)
            inactiveIndividuals = list(set(inactiveIndividuals))

            suggestions = db.session.query(IndSimilarity)\
                                .filter(or_(IndSimilarity.individual_1==int(individual_id),IndSimilarity.individual_2==int(individual_id)))\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(IndSimilarity.skipped==False)\
                                .filter(~IndSimilarity.individual_1.in_(inactiveIndividuals))\
                                .filter(~IndSimilarity.individual_2.in_(inactiveIndividuals))\
                                .filter(IndSimilarity.individual_1.in_(taskIndividuals))\
                                .filter(IndSimilarity.individual_2.in_(taskIndividuals))\
                                .order_by(desc(IndSimilarity.score))\
                                .all()
            
            for item in suggestions:
                # sadd returns 1 if the item was added to the set, 0 if it was already in the set
                if GLOBALS.redisClient.sadd('active_indsims_'+str(current_user.turkcode[0].task_id),item.id):
                    suggestion = item
                    break

        if suggestion==None:
            reply = {'id': '-876'}
        else:

            if suggestion.individual_1==int(individual_id):
                individual = db.session.query(Individual).get(suggestion.individual_2)
            else:
                individual = db.session.query(Individual).get(suggestion.individual_1)

            # Handle buffer
            bufferCount = GLOBALS.redisClient.rpush('user_indsims_'+str(current_user.id),suggestion.id)
            for n in range(bufferCount-3):
                indSimID = GLOBALS.redisClient.lpop('user_indsims_'+str(current_user.id))
                if indSimID: GLOBALS.redisClient.srem('active_indsims_'+str(current_user.turkcode[0].task_id),int(indSimID.decode()))

            sortedImages = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(individual)).all()

            images = [{'id': image.id,
                    'url': (image.camera.path + '/' + image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'timestamp': numify_timestamp(image.corrected_timestamp),
                    'camera': image.camera_id,
                    'rating': image.detection_rating,
                    'latitude': image.camera.trapgroup.latitude,
                    'longitude': image.camera.trapgroup.longitude,
                    'detections': [{'id': detection.id,
                                    'top': detection.top,
                                    'bottom': detection.bottom,
                                    'left': detection.left,
                                    'right': detection.right,
                                    'category': detection.category,
                                    'individual': '-1',
                                    'static': detection.static,
                                    'flank': Config.FLANK_TEXT[detection.flank].capitalize()}
                                    for detection in image.detections if (
                                            (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and 
                                            (detection.status not in Config.DET_IGNORE_STATUSES) and 
                                            (detection.static == False) and 
                                            (individual in detection.individuals[:])
                                    )]}
                    for image in sortedImages]

            reply = {'id': individual.id, 'max_pair': [suggestion.detection_1,suggestion.detection_2], 'classification': [],'required': [], 'images': images, 'label': [], 'tags': [], 'groundTruth': [], 'trapGroup': 'None'}

            if Config.DEBUGGING:
                territorySize = 15
                distanceNormFactor = 1/(1.5*territorySize)
                distanceWeight = 0.3
                maxTime = 30
                timeNormFactor = 1/(maxTime*24*3600)
                timeWeight = 0.3
                tagWeight = 0.1
                matchWeight = 2
                mismatchWeight = 1
                iouWeight = 1

                # Find all family
                family = []
                children = individual1.children
                while children != []:
                    family.extend(children)
                    temp = []
                    for child in children:
                        temp.extend(child.children)
                    children = temp

                parents = individual1.parents
                while parents != []:
                    family.extend(parents)
                    temp = []
                    for parent in parents:
                        temp.extend(parent.parents)
                    parents = temp

                # siblings
                for parent in individual1.parents:
                    family.extend([child for child in parent.children if child.id != individual1.id])

                family = list(set(family))

                reply['indsim'] = suggestion.score
                reply['detsim'] = {}
                reply['adjsim'] = {}

                max_similarity = None
                if individual in family:
                    max_similarity = -1500
                else:
                    images1 = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(individual1)).all()
                    testImage = db.session.query(Image).join(Detection).filter(Image.id.in_([r.id for r in images1])).filter(Detection.individuals.contains(individual)).first()

                    if testImage:
                        # Individuals share an image
                        max_similarity = -1000
                    else:
                        tagScore = 0
                        for tag in individual1.tags[:]:
                            if tag in individual.tags[:]:
                                tagScore += matchWeight
                            else:
                                tagScore -= mismatchWeight
                        for tag in individual.tags[:]:
                            if tag not in individual1.tags[:]:
                                tagScore -= mismatchWeight

                        detections1 = individual1.detections[:]
                        detections2 = individual.detections[:]
                        for detection1 in detections1:
                            reply['detsim'][str(detection1.image.id)] = {}
                            reply['adjsim'][str(detection1.image.id)] = {}
                            for detection2 in detections2:

                                detSimilarity = db.session.query(DetSimilarity).filter(\
                                                            or_(\
                                                                and_(\
                                                                    DetSimilarity.detection_1==detection1.id,\
                                                                    DetSimilarity.detection_2==detection2.id),\
                                                                and_(\
                                                                    DetSimilarity.detection_1==detection2.id,\
                                                                    DetSimilarity.detection_2==detection1.id)\
                                                            )).first()

                                if max_similarity:
                                    reply['detsim'][str(detection1.image.id)][str(detection2.image.id)] = detSimilarity.score
                                    reply['adjsim'][str(detection1.image.id)][str(detection2.image.id)] = adjusted_score
                                else:
                                    if (detSimilarity != None) and (detSimilarity.score != None):
                                        iou_factor = 1
                                        # if detection1.image.camera==detection2.image.camera:
                                        #     intersection_left = max(detection1.left,detection2.left)
                                        #     intersection_right = min(detection1.right,detection2.right)
                                        #     intersection_top = max(detection1.top,detection2.top)
                                        #     intersection_bottom = min(detection1.bottom,detection2.bottom)
            
                                        #     if (intersection_right>intersection_left) and (intersection_bottom>intersection_top):
                                        #         intersection_area = (intersection_right-intersection_left)*(intersection_bottom-intersection_top)
                                        #         detection1_area = (detection1.right-detection1.left)*(detection1.bottom-detection1.top)
                                        #         detection2_area = (detection2.right-detection2.left)*(detection2.bottom-detection2.top)
                                        #         union_area = detection1_area + detection2_area - intersection_area
                                        #         iou = intersection_area/union_area
                                        #         iou_factor = iouWeight*((1-iou)**2)

                                        distance = coordinateDistance(detection1.image.camera.trapgroup.latitude, detection1.image.camera.trapgroup.longitude, detection2.image.camera.trapgroup.latitude, detection2.image.camera.trapgroup.longitude)
                                        
                                        if detection1.image.corrected_timestamp and detection2.image.corrected_timestamp:
                                            time = abs((detection1.image.corrected_timestamp-detection2.image.corrected_timestamp).total_seconds())
                                        else:
                                            time = 0
                                        
                                        distanceScore = 1 + distanceWeight - (distanceWeight*distanceNormFactor*distance)
                                        if distanceScore < 1: distanceScore=1

                                        timeScore = 1 + timeWeight - (timeWeight*timeNormFactor*time)
                                        if timeScore < 1: timeScore=1

                                        adjusted_score = iou_factor * distanceScore * timeScore * (1 + (tagWeight*tagScore)) * detSimilarity.score

                                        reply['detsim'][str(detection1.image.id)][str(detection2.image.id)] = detSimilarity.score
                                        reply['adjsim'][str(detection1.image.id)][str(detection2.image.id)] = adjusted_score

    return json.dumps(reply)

@app.route('/getIndividualInfo/<individual_id>')
@login_required
def getIndividualInfo(individual_id):
    '''Returns all info relating to the specified individual.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual = db.session.query(Individual).get(individual_id)

    # if individual and ((current_user.parent in individual.tasks[0].survey.user.workers) or (current_user.parent == individual.tasks[0].survey.user) or (current_user == individual.tasks[0].survey.user)):
    if individual and individual.active and (all(checkAnnotationPermission(current_user.parent_id,task.id) for task in individual.tasks) or any(checkSurveyPermission(current_user.id,task.survey_id,'read') for task in individual.tasks)):

        # Find all family
        family = []
        children = individual.children
        while children != []:
            family.extend([child.id for child in children])
            temp = []
            for child in children:
                temp.extend(child.children)
            children = temp

        parents = individual.parents
        while parents != []:
            family.extend([parent.id for parent in parents])
            temp = []
            for parent in parents:
                temp.extend(parent.parents)
            parents = temp

        siblings = []
        for parent in individual.parents:
            siblings.extend([child.id for child in parent.children if child.id != int(individual_id)])

        family.extend(siblings)
        family = list(set(family))

        firstSeen = db.session.query(Image).join(Detection).filter(Image.corrected_timestamp!=None).filter(Detection.individuals.contains(individual)).order_by(Image.corrected_timestamp).first()
        if firstSeen:
            firstSeen = stringify_timestamp(firstSeen.corrected_timestamp)
        else:
            firstSeen = None

        lastSeen = db.session.query(Image).join(Detection).filter(Image.corrected_timestamp!=None).filter(Detection.individuals.contains(individual)).order_by(desc(Image.corrected_timestamp)).first()
        if lastSeen:
            lastSeen = stringify_timestamp(lastSeen.corrected_timestamp)
        else:
            lastSeen = None

        if all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
            access = 'write'
        else:
            access = 'read'

        indiv_surveys = []
        for task in individual.tasks:
            if ('default' != task.name) or ('_o_l_d_' not in task.name) or ('_copying' not in task.name):
                indiv_surveys.append(task.survey.name + ' ' + task.name)

        
        # GEt the convex hull of all the indiviudals coordinates
        coords = db.session.query(Trapgroup.latitude, Trapgroup.longitude)\
                        .join(Camera)\
                        .join(Image)\
                        .join(Detection)\
                        .filter(Detection.individuals.contains(individual))\
                        .distinct().all()

        if len(coords) > 3:
            points = np.array([(lon, lat) for lat, lon in coords])
            hull = ConvexHull(points)
            hull_points = points[hull.vertices]
            hull_points = [(lat, lon) for lon, lat in hull_points]
        else:
            hull_points = [(lat, lon) for lat, lon in coords]
        
        return json.dumps({'id': individual_id, 'name': individual.name, 'tags': [tag.description for tag in individual.tags], 'label': individual.species,  'notes': individual.notes, 'children': [child.id for child in individual.children], 'family': family, 'surveys': indiv_surveys, 'seen_range': [firstSeen, lastSeen], 'access': access, 'bounds': hull_points})
    else:
        return json.dumps('error')

@app.route('/prepNewIndividual')
@login_required
def prepNewIndividual():
    '''Returns the individual tags for the users current task.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278
    
    reply = []
    task = current_user.turkcode[0].task
    
    # if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user)):
    if task and checkAnnotationPermission(current_user.parent_id,task.id):
        for tag in task.tags:
            reply.append({'tag': tag.description, 'hotkey': tag.hotkey})

    return json.dumps(reply)

@app.route('/submitIndividuals', methods=['POST'])
@login_required
def submitIndividuals():
    '''Submits all the individuals for a specified cluster, for the current species. Returns success/error status, progress numbers, and a dictionary for translating 
    the user-generated IDs into database IDs. Alternatively returns error status and a list of problem names in the case of duplicates.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    success = False
    try:
        task = current_user.turkcode[0].task
        task_id = task.id
        translations = {}
        individuals = ast.literal_eval(request.form['individuals'])
        tL = re.split(',',task.tagging_level)
        species = tL[1]
        unidentifiable = db.session.query(Individual).filter(Individual.tasks.contains(task)).filter(Individual.species==species).filter(Individual.name=='unidentifiable').first()

        detection = db.session.query(Detection).get(individuals[list(individuals.keys())[0]]['detections'][0])
        # if detection and ((current_user.parent in detection.image.camera.trapgroup.survey.user.workers) or (current_user.parent == detection.image.camera.trapgroup.survey.user)):
        if detection and checkAnnotationPermission(current_user.parent_id,task.id):
            # First check names:
            problemNames = []
            for individualID in individuals:
                if 'known' not in individuals[individualID]:
                    individuals[individualID]['known'] = 'false'

                if individuals[individualID]['name'].lower() != 'unidentifiable' and individuals[individualID]['known'] != 'true':
                    check = db.session.query(Individual)

                    if 'n' not in individualID:
                        check = check.filter(Individual.id!=int(individualID))

                    check = check.filter(Individual.species==species)\
                                        .filter(Individual.name==individuals[individualID]['name'])\
                                        .filter(Individual.tasks.contains(task))\
                                        .first()
                    
                    if check:
                        problemNames.append(individuals[individualID]['name'])

            if len(problemNames) > 0:
                return json.dumps({'status': 'error','message': 'There are duplicate names.', 'data': problemNames})

            all_detections = [] 
            for individualID in individuals:
                all_detections.extend(individuals[individualID]['detections'])

                if individuals[individualID]['name'] == 'unidentifiable':
                    individual = unidentifiable
                else:
                    if 'n' not in individualID:
                        # Modify individuals
                        individual = db.session.query(Individual).get(int(individualID))
                        individual.user_id = current_user.id
                        if individuals[individualID]['known'] == 'true' and task not in individual.tasks: individual.tasks.append(task)

                    else:
                        # Create new individual
                        name = individuals[individualID]['name']

                        check = db.session.query(Individual)\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name==name)\
                                            .filter(Individual.tasks.contains(task))\
                                            .first()

                        if check:
                            name = generateUniqueName(task_id,species,tL[2])

                        individual = Individual(
                            name = name,
                            species = species,
                            user_id = current_user.id
                        )
                        db.session.add(individual)
                        individual.tasks = [task]

                    if individuals[individualID]['known'] == 'true':
                        tags_exist = []
                        for tag in individual.tags:
                            if tag.description in individuals[individualID]['tags']: 
                                tags_exist.append(tag.description)
                            else:
                                individual.tags.remove(tag)

                        new_tags = [db.session.query(Tag).filter(Tag.description==tag).filter(Tag.task_id.in_([t.id for t in individual.tasks])).first() for tag in individuals[individualID]['tags'] if tag not in tags_exist]
                        for tag in new_tags:
                            if tag not in individual.tags: individual.tags.append(tag)

                    else:
                        individual.tags = [db.session.query(Tag).filter(Tag.description==tag).filter(Tag.task_id==task_id).first() for tag in individuals[individualID]['tags']]
                    individual.notes = individuals[individualID]['notes']

                for detID in individuals[individualID]['detections']:
                    det = db.session.query(Detection).get(detID)

                    indivs = db.session.query(Individual).filter(Individual.detections.contains(det))\
                                                        .filter(Individual.tasks.contains(task))\
                                                        .filter(Individual.id!=individual.id)\
                                                        .distinct().all()
                    for indiv in indivs:
                        indiv.detections.remove(det)
                        if (len(indiv.detections) == 0) and (indiv.name != 'unidentifiable'):
                            db.session.delete(indiv)

                    if det not in individual.detections:
                        individual.detections.append(det)

                translations[individualID] = str(individual.id)

            # Handle parents
            for individualID in individuals:
                if int(translations[individualID]) != unidentifiable.id:
                    individual = db.session.query(Individual).get(int(translations[individualID]))
                    for childID in individuals[individualID]['children']:
                        if int(translations[childID]) != unidentifiable.id:
                            individual.children.append(db.session.query(Individual).get(int(translations[childID])))

            clusters = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task_id==task_id).filter(Detection.id.in_(all_detections)).distinct().all()
            for cluster in clusters:
                cluster.user_id = current_user.id
                cluster.timestamp = datetime.utcnow()
                cluster.examined = True
            db.session.commit()

            num2 = task.size
            num = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.user_id==current_user.id).count()

            success = True
            
    except:
        pass

    if success:
        return json.dumps({'status': 'success','message': 'Individuals handled successfully.', 'progress': [num, num2], 'translations': translations})
    else:
        return json.dumps({'status': 'error'})

@app.route('/getCluster', methods=['POST'])
@login_required
def get_clusters():
    '''Returns the next clusters for annotation, based on the current user, their assigned task, and its associated tagging level.'''

    OverallStartTime = time.time()
    id = request.args.get('id', None)
    reqId = request.args.get('reqId', None)

    if 'cluster_id_list' in request.form:
        clusterIdList = ast.literal_eval(request.form['cluster_id_list'])
        if (type(clusterIdList)==int):
            # single item list is evaluated as an int
            clusterIdList = [clusterIdList]
        else:
            clusterIdList = list(clusterIdList)
    else:
        clusterIdList = []
    
    if reqId is None:
        reqId = '-99'

    # Find task info
    if id is None:
        if current_user.admin == True:    
            task_id = int(request.args.get('task', None))
            if task_id is None:
                return {'redirect': url_for('done')}, 278
        else:
            if current_user.parent_id==None:
                return {'redirect': url_for('done')}, 278
            else:
                task_id = current_user.turkcode[0].task_id
    else:
        cluster = db.session.query(Cluster).get(id)
        task_id = cluster.task_id

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(task_id),current_user.username)): return {'redirect': url_for('done')}, 278
    
    task = None
    try:
        task = db.session.query(Task).get(task_id)
    except:
        return {'redirect': url_for('done')}, 278
    
    # Check permissions
    # if (task == None) or ((current_user.parent not in task.survey.user.workers) and (current_user.parent != task.survey.user) and (current_user != task.survey.user)):
    if (task == None) or not (checkAnnotationPermission(current_user.parent_id,task_id) or checkSurveyPermission(current_user.id,task.survey_id,'read')):
        return {'redirect': url_for('done')}, 278
    else:
        if '-5' in task.tagging_level:
            if not all(checkAnnotationPermission(current_user.parent_id,task.id) for task in task.sub_tasks):
                return {'redirect': url_for('done')}, 278

    # Check worker cluster counts
    if current_user.admin:
        num = 0
    elif '-5' in task.tagging_level:
        num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    else:
        num = db.session.query(Cluster).filter(Cluster.user==current_user).count()

    if (num >= (task.size + task.test_size)): return {'redirect': url_for('done')}, 278

    # if (id is None) and (not populateMutex(task_id,current_user.id)): return json.dumps('error')

    isBounding = task.is_bounding
    taggingLevel = task.tagging_level
    task_size = task.size
    survey_id = task.survey_id
    limit = 1
    label_description = None

    if GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id))==None: GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),0)

    if (',' not in taggingLevel) and (not isBounding) and int(taggingLevel) > 0:
        label_description = db.session.query(Label).get(int(taggingLevel)).description

    if id:
        clusterInfo, max_request = fetch_clusters(taggingLevel,task_id,isBounding,None,None,id)

    else:

        if not GLOBALS.redisClient.sismember('active_jobs_'+str(task_id),current_user.username):
            clusterInfo = {}

        else:
            if '-5' in taggingLevel:
                # inter-cluster ID does not need to be on a per-trapgroup basis. Need to do this with a global mutex. Also handing allocation better.
                # session.close()
                # GLOBALS.mutex[task_id]['global'].acquire()
                # session = db.session()
                # session.add(current_user)
                # session.refresh(current_user)
                
                clusterInfo, individuals = fetch_clusters(taggingLevel,task_id,isBounding,None)

                # Handle buffer
                for individual in individuals:
                    bufferCount = GLOBALS.redisClient.rpush('user_individuals_'+str(current_user.id),individual.id)
                    for n in range(bufferCount-1):
                        indID = GLOBALS.redisClient.lpop('user_individuals_'+str(current_user.id))
                        if indID: GLOBALS.redisClient.srem('active_individuals_'+str(current_user.turkcode[0].task_id),int(indID.decode()))

                clusters_allocated = int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode()) + len(individuals)
                GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),clusters_allocated)
                # current_user.last_ping = datetime.utcnow()
                db.session.commit()

            else:
                # session.close()
                # GLOBALS.mutex[task_id]['global'].acquire()
                # Open a new session to ensure allocations are up to date after a long wait
                # session = db.session()
                # session.add(current_user)
                # session.refresh(current_user)

                trapgroup = allocate_new_trapgroup(task_id,current_user,survey_id)
                if trapgroup == None:
                    db.session.close()
                    # GLOBALS.mutex[task_id]['global'].release()
                    return json.dumps({'id': reqId, 'info': [Config.FINISHED_CLUSTER]})

                limit = task_size - int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode())
                
                clusterInfo, max_request = fetch_clusters(taggingLevel,task_id,isBounding,trapgroup.id,limit,None,clusterIdList)

                # if len(clusterInfo)==0: current_user.trapgroup = []
                clusters_allocated = int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode()) + len(clusterInfo)

                if (len(clusterInfo) <= limit) and not max_request:
                    # trapgroup is now finished
                    trapgroup.active = False
                    GLOBALS.redisClient.lrem('trapgroups_'+str(survey_id),0,trapgroup.id)

                GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),clusters_allocated)

                # current_user.last_ping = datetime.utcnow()
                
                db.session.commit()
                db.session.close()
                # GLOBALS.mutex[task_id]['global'].release()

                # if current_user.trapgroup[:]:
                #     trapgroup = current_user.trapgroup[0]
                # else:
                #     GLOBALS.mutex[task_id]['global'].acquire()
                #     db.session.commit()

                #     trapgroup = allocate_new_trapgroup(task_id,current_user.id)
                #     if trapgroup == None:
                #         GLOBALS.mutex[task_id]['global'].release()
                #         return json.dumps({'id': reqId, 'info': [Config.FINISHED_CLUSTER]})
                #     GLOBALS.mutex[task_id]['global'].release()

                # GLOBALS.mutex[task_id]['user'][current_user.id].acquire()
                # limit = task.size - current_user.clusters_allocated
                # # clusters = fetch_clusters(taggingLevel,task_id,isBounding,trapgroup.id,limit)
                # clusterInfo = fetch_clusters(taggingLevel,task_id,isBounding,trapgroup_id)
                # current_user.clusters_allocated += len(clusters)
                # db.session.commit()
                # GLOBALS.mutex[task_id]['user'][current_user.id].release()

    # if clusters == []:
    #     current_user.trapgroup = []
    #     db.session.commit()
        # return json.dumps({'id': reqId, 'info': [Config.FINISHED_CLUSTER]})

    # reply = {'id': reqId, 'info': []}
    # for cluster in clusters:
    #     if time.time() - OverallStartTime > 20:
    #         # If this is taking too long, cut the request short
    #         current_user.clusters_allocated -= (len(clusters) - len(reply['info']))
    #         db.session.commit()
    #         break
    #     reply['info'].append(translate_cluster_for_client(cluster,id,isBounding,taggingLevel,current_user,sendVideo))

    reply = translate_cluster_for_client(clusterInfo,reqId,limit,isBounding,taggingLevel,id,label_description)

    if ((id is None) and (clusters_allocated >= task_size)) or (reply['info'] == []):
        reply['info'].append(Config.FINISHED_CLUSTER)

    if id:
        access = checkSurveyPermission(current_user.id,task.survey_id,'write')
        reply['access'] = access

    if Config.DEBUGGING: app.logger.info("Entire get cluster completed in {}".format(time.time() - OverallStartTime))
    return json.dumps(reply)

@app.route('/getImage')
@login_required
def getImage():
    '''Returns a cluster dictionary with the specified image.'''
    
    id = request.args.get('id', None)
    reqId = request.args.get('reqId', '-99')
    image = db.session.query(Image).get(int(id))

    # if image and (current_user == image.camera.trapgroup.survey.user):
    if image and checkSurveyPermission(current_user.id,image.camera.trapgroup.survey_id,'read'):
        images = [{'id': image.id,
                'url': (image.camera.path + '/' + image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'rating': image.detection_rating,
                'detections': [{'top': detection.top,
                                'bottom': detection.bottom,
                                'left': detection.left,
                                'right': detection.right,
                                'category': detection.category,
                                'individual': '-1',
                                'static': detection.static}
                                for detection in image.detections
                                if ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.status not in Config.DET_IGNORE_STATUSES)) ]}] #and (detection.static == False)

        ground_truths = json.loads(GLOBALS.redisClient.get('ground_truths_'+str(current_user.id)).decode())

        GTtask = ground_truths['ground']
        otherTask = ground_truths['other']

        GTcluster = db.session.query(Cluster).filter(Cluster.images.contains(image)).filter(Cluster.task_id==GTtask).first()
        otherCluster = db.session.query(Cluster).filter(Cluster.images.contains(image)).filter(Cluster.task_id==otherTask).first()

        if len(GTcluster.labels[:])==0:
            groundTruth = ['None']
        else:
            groundTruth = []
            for label in GTcluster.labels:
                groundTruth.append(label.description)

        if len(otherCluster.labels[:])==0:
            cluster_labels = ['None']
        else:
            cluster_labels = []
            for label in otherCluster.labels:
                cluster_labels.append(label.description)

        result = json.dumps({'id': reqId, 'info': {'id': otherCluster.id,'classification': [],'required': [], 'images': images, 'label': cluster_labels, 'tags': [], 'groundTruth': [groundTruth], 'trapGroup': 'None'}})

    else:
        result = json.dumps({'id': reqId, 'info': Config.EMPTY_CLUSTER})

    return result

@app.route('/getKnockCluster/<task_id>/<knockedstatus>/<clusterID>/<index>/<imageIndex>/<T_index>/<F_index>')
@login_required
def getKnockCluster(task_id, knockedstatus, clusterID, index, imageIndex, T_index, F_index):
    '''
    Returns the necessary images for a binary-search knockdown analysis in a cluster-like dictionary. Automatically handles start, 
    and redirects with -101 code on completion.
    
        Parameters:
            task_id (int): The task being analysed
            knockedstatus (str): Whether the image at the chosen indec was knocked down or not
            clusterID (int): The knocked-down cluster being analysed
            index (int): The image index within its whole cluster
            imageIndex (int): The index of the image within the current cluster object
            T_index (int): The highest cluster index where it is known the image was knocked down
            F_index (int): The lowest cluster index where it is known the image was picked up
    '''
    
    task = db.session.query(Task).get(int(task_id))
    # if (task.survey.user==current_user) and ((int(knockedstatus) == 87) or (task.status == 'successInitial')):
    # if not populateMutex(int(task_id)): return json.dumps('error')

    cluster = None
    result = None
    sortedImages = None
    finished = False
    # if task.survey.user==current_user:
    if checkSurveyPermission(current_user.id,task.survey_id,'write') or checkAnnotationPermission(current_user.parent_id,task.id):
        
        GLOBALS.redisClient.set('knockdown_ping_'+str(task_id),datetime.utcnow().timestamp())
        if (int(knockedstatus) == 87) or (task.status == 'successInitial'):
            task.status = 'Knockdown Analysis'
            db.session.commit()
        
        if int(clusterID) != -102:
            # GLOBALS.mutex[int(task_id)]['global'].acquire()
            T_index = int(T_index)
            F_index = int(F_index)
            app.logger.info('GetKnockCluster: Status:{} Index:{} ImageIndex:{}'.format(knockedstatus, index, imageIndex))

            if int(clusterID) != 0: #if it is not zero, then it isn't the first of a new cluster
                cluster = db.session.query(Cluster).get(int(clusterID))
                images = db.session.query(Image).filter(Image.corrected_timestamp!=None).filter(Image.clusters.contains(cluster)).filter(Image.zip_id==None).order_by(Image.corrected_timestamp).all()
                if (int(index) == (len(images)-1)) and (knockedstatus == '1'):
                    #beginning and end were knocked - don't need to do anything
                    if Config.DEBUGGING: app.logger.info('Beginning and end were knocked - doing nothing.')
                    cluster.checked = True
                    db.session.commit()
                elif (int(index) == 0) and (knockedstatus == '0'):
                    #first image was not knocked down - need to recluster the whole thing
                    if Config.DEBUGGING: app.logger.info('First image not knocked - reclustering the whole thing.')
                    # unknock_cluster(cluster)
                    cluster_id = cluster.id
                    cluster.checked = True

                    #deallocate the trapgroup from the user
                    trapgroup = images[0].camera.trapgroup
                    trapgroup.active = False
                    trapgroup.processing = True
                    trapgroup.user_id = None
                    db.session.commit()

                    unknock_cluster.apply_async(kwargs={'image_id':images[0].id, 'label_id':None, 'user_id':None, 'task_id':int(task_id)})
                else:
                    #send next middle image
                    if (int(imageIndex) == 0) and (int(index) != 0):
                        if Config.DEBUGGING: app.logger.info('Single image marked, sending next one.')
                        if knockedstatus == '1':
                            if int(index) > T_index:
                                T_index = int(index)
                        else:
                            if int(index) < F_index:
                                F_index = int(index)
                    else:
                        if Config.DEBUGGING: app.logger.info('Initial cluster marked, sending next middle image.')
                        if len(images) > 6:
                            if knockedstatus == '1':
                                T_index = int(index)
                                F_index = math.floor((int(imageIndex)+1)*0.2*len(images))
                            else:
                                F_index = int(index)
                                T_index = math.floor((int(imageIndex)-1)*0.2*len(images))
                        else:
                            if knockedstatus == '1':
                                T_index = int(index)
                                F_index = int(index)+1
                            else:
                                F_index = int(index)
                                T_index = int(index)-1

                    newIndex = math.floor((T_index + F_index)/2)

                    if (newIndex == T_index) or (newIndex == F_index):
                        #finished with cluster - split up & recluster
                        if Config.DEBUGGING: app.logger.info('Finished with cluster, splitting and reclustering.')
                        #deallocate the trapgroup from the user
                        trapgroup = images[0].camera.trapgroup
                        trapgroup.active = False
                        trapgroup.user_id = None
                        trapgroup.processing = True
                        cluster.checked = True
                        db.session.commit()
                        splitClusterAndUnknock.apply_async(kwargs={'oldClusterID':cluster.id, 'SplitPoint':F_index})
                    else:
                        if Config.DEBUGGING: app.logger.info('Sending index: {}'.format(newIndex))
                        sortedImages = [images[newIndex]]
                        indices = [newIndex]

            if sortedImages == None:
                #pop cluster if new cluster request, sending first and last
                downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
                cluster = db.session.query(Cluster) \
                                        .filter(Cluster.labels.contains(downLabel)) \
                                        .filter(Cluster.task_id == int(task_id)) \
                                        .filter(Cluster.checked == False) \
                                        .distinct().first()

                if cluster != None:
                    images = db.session.query(Image).filter(Image.clusters.contains(cluster)).filter(Image.zip_id==None).order_by(Image.corrected_timestamp).all()

                    if len(images) > 6:
                        index20 = math.floor(0.2*len(images))
                        index40 = math.floor(0.4*len(images))
                        index60 = math.floor(0.6*len(images))
                        index80 = math.floor(0.8*len(images))
                        indices = [0,index20,index40,index60,index80,len(images)-1]
                        sortedImages = [images[0], images[index20], images[index40], images[index60], images[index80], images[-1]]
                    else:
                        indices = [n for n in range(len(images))]
                        sortedImages = images

                    if Config.DEBUGGING: app.logger.info('Sending new knocked-down cluster with image indices: {}'.format(indices))
                    T_index = 0
                    F_index = 0

        if sortedImages != None:
            images = [{'id': image.id,
                    'url': (image.camera.path + '/' + image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'rating': image.detection_rating,
                    'detections': [{'top': detection.top,
                                    'bottom': detection.bottom,
                                    'left': detection.left,
                                    'right': detection.right,
                                    'category': detection.category,
                                    'individual': '-1',
                                    'static': detection.static}
                                    for detection in image.detections
                                    if ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.status not in Config.DET_IGNORE_STATUSES)) ]}
                    for image in sortedImages]

            for n in range(len(images)):
                images[n]['index'] = indices[n]

            cluster_labels = []
            if cluster.labels == []:
                cluster_labels.append('None')
            else:
                for label in cluster.labels:
                    cluster_labels.append(label.description)

            tags = []
            if cluster.tags == []:
                tags.append('None')
            else:
                for tag in cluster.tags:
                    tags.append(tag.description)
                
            if len(sortedImages) > 0:
                trapGroup = sortedImages[0].camera.trapgroup_id
            else:
                trapGroup = 'None'

            result = json.dumps({'T_index': T_index, 'F_index': F_index, 'info': {'id': cluster.id,'classification': [],'required': [], 'images': images, 'label': cluster_labels, 'tags': tags, 'groundTruth': [], 'trapGroup': trapGroup}})

        else:
            # Finished
            app.logger.info('Knocked down analysis complete.')

            task = db.session.query(Task).get(int(task_id))
            queueing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Trapgroup.queueing==True).count()
            processing = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Trapgroup.processing==True).count()

            sq = db.session.query(Cluster) \
                .join(Image, Cluster.images) \
                .join(Camera) \
                .join(Trapgroup) \
                .join(Detection)

            sq = taggingLevelSQ(sq,'-1',False,int(task_id))

            cluster_count = sq.filter(Cluster.task_id == int(task_id)) \
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                    .distinct().count()

            if (cluster_count>0) and (not queueing) and (not processing):
                # The are clusters to annotate and unknock et al are complete - launch
                code = '-101'
                task.tagging_level = '-1'
                task.is_bounding = False
                task.init_complete = False
                task.status = 'PENDING'
                task.survey.status = 'Launched'
                db.session.commit()
                launch_task.apply_async(kwargs={'task_id':task_id})

            elif (not queueing) and (not processing):
                # Completely done - take the task out of a processing state
                code = '-101'
                task.status = 'Processing'
                db.session.commit()
                updateAllStatuses.delay(task_id=task_id,status=True)
            
            else:
                # There is still some background processing going on - leave the task locked out
                code = '-101'
                task.status = 'Processing'
                db.session.commit()

            images = [{'id': code,
                'url': code,
                'rating': code,
                'detections': [{'top': code,
                                'bottom': code,
                                'left': code,
                                'right': code,
                                'category': code,
                                'individual': '-1',
                                'static': code}]
                }]      

            result = json.dumps({'T_index': T_index, 'F_index': F_index, 'info': {'id': code,'classification': [],'required': [], 'images': images, 'label': code, 'tags': code, 'groundTruth': code, 'trapGroup': code}})

    else:
        result = json.dumps('error')

    return result

@app.route('/individualNote')
@login_required
def individualNote():
    '''Submits a note for the specified individual. Returns success/error status.'''

    individualID = request.form['individualID']
    note = request.form['note']

    individual = db.session.query(Individual).get(int(individualID))
    # if individual and ((individual.tasks[0].survey.user==current_user.parent) or (current_user.parent in individual.tasks[0].survey.user.workers)):
    if individual and all(checkAnnotationPermission(current_user.parent_id,task.id) for task in individual.tasks):
        individual.notes = note
        db.session.commit()
        return json.dumps({'status': 'success','message': 'Success.'})

    return json.dumps({'status': 'error','message': 'Could not find individual.'})

@app.route('/getClustersBySpecies/<task_id>/<species>/<tag_id>/<trapgroup_id>/<annotator_id>', methods=['POST'])
@login_required
def getClustersBySpecies(task_id, species, tag_id, trapgroup_id, annotator_id):
    '''Returns a list of cluster IDs for the specified task with the specified species and its child labels. 
    Returns all clusters if species is 0.'''

    task = db.session.query(Task).get(task_id)
    reqId = request.args.get('reqId', None)

    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        # notes = request.args.get('notes', None)
        if 'notes' in request.form:
            notes = ast.literal_eval(request.form['notes'])
        else:
            notes = None

        if 'notesOnly' in request.form:
            notesOnly = ast.literal_eval(request.form['notesOnly'])
        else:
            notesOnly = None

        if 'startDate' in request.form:
            startDate = ast.literal_eval(request.form['startDate'])
        else:
            startDate = None

        if 'endDate' in request.form:
            endDate = ast.literal_eval(request.form['endDate'])
        else:
            endDate = None

        if Config.DEBUGGING: app.logger.info('Get Cluster By species for: task_id:{} species:{} tag_id:{} trapgroup_id:{} annotator_id:{} notes:{} startDate:{} endDate:{}'.format(task_id,species,tag_id,trapgroup_id,annotator_id,notes,startDate,endDate))

        base_query = db.session.query(Cluster.id) \
                            .filter(Cluster.task_id == int(task_id))\
                            .join(Image,Cluster.images)\
                            .outerjoin(Detection)\
                            .outerjoin(Labelgroup)\
                            .outerjoin(Label,Labelgroup.labels)\
                            .filter(Labelgroup.task==task)

        # If they ask for the nothing clusters, we want to serve the empty clusters too
        # if str(species) != str(GLOBALS.nothing_id): base_query = rDets(base_query)
        base_query = rDets(base_query)

        if tag_id != '0':
            tag = db.session.query(Tag).get(int(tag_id))
            base_query = base_query.filter(Labelgroup.tags.contains(tag))

        if trapgroup_id != '0':
            base_query = base_query.join(Camera).join(Trapgroup).filter(Trapgroup.id==trapgroup_id)

        if annotator_id != '0':
            base_query = base_query.join(User, User.id==Cluster.user_id).filter(or_(User.id==annotator_id,User.parent_id==annotator_id))

        if startDate:
            base_query = base_query.filter(Image.corrected_timestamp>=startDate)

        if endDate:
            base_query = base_query.filter(Image.corrected_timestamp<=endDate)

        if notesOnly:
            base_query = base_query.filter(and_(Cluster.notes!='',Cluster.notes!=None))

        if notes:
            searches = re.split('[ ,]',notes)
            for search in searches:
                base_query = base_query.filter(Cluster.notes.contains(search))

        global_ids = []
        label_ids = []
        if (species != '0'):
            label = db.session.query(Label).get(int(species))
            parent_labels = [label]

            if label.task_id==None:
                global_ids.append(label.id)
            else:
                label_ids.append(label.id)

            while parent_labels != []:
                temp_labels = []
                for label in parent_labels:
                    children_labels = db.session.query(Label).filter(Label.parent_id == label.id).filter(Label.task==task).all()
                    if children_labels != []:
                        temp_labels.extend(children_labels)
                        for lab in children_labels:
                            if lab.task_id==None:
                                global_ids.append(lab.id)
                            else:
                                label_ids.append(lab.id)
                parent_labels = temp_labels

        if global_ids or label_ids:
            clusters = base_query.filter(Label.id.in_(label_ids)).order_by(Image.corrected_timestamp).distinct(Cluster.id).all()

            # At scale, filtering the global labels using the .in_(label_ids) approach is too slow - this is faster
            for global_id in global_ids:
                if global_id == GLOBALS.nothing_id:
                    clusters.extend(base_query.filter(or_(Label.id==global_id,Label.id==None,Detection.id==None)).order_by(Image.corrected_timestamp).distinct(Cluster.id).all())
                else:
                    clusters.extend(base_query.filter(Label.id==global_id).order_by(Image.corrected_timestamp).distinct(Cluster.id).all())

            clusters = list(set([r[0] for r in clusters]))
        else:
            clusters = [r[0] for r in base_query.order_by(Image.corrected_timestamp).distinct(Cluster.id).all()]

        if Config.DEBUGGING: app.logger.info(clusters[:50])
        
    else:
        clusters = []

    return json.dumps({'reqID': reqId, 'clusterIDs': clusters})

@app.route('/getTrapgroups', methods=['POST'])
@login_required
def getTrapgroups():
    '''Returns the names and IDs of the trapgroups for the specified tasks.'''

    task_ids = ast.literal_eval(request.form['task_ids'])
    if task_ids:
        if task_ids[0] == '0':
            surveys = surveyPermissionsSQ(db.session.query(Survey.id), current_user.id, 'read').distinct().all()
        else:
            surveys = surveyPermissionsSQ(db.session.query(Survey.id).filter(Survey.tasks.any(Task.id.in_(task_ids))), current_user.id, 'read').distinct().all()
        survey_ids = [r[0] for r in surveys]
    
        names = ['None','All']
        ids = [-1,0]
        trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id.in_(survey_ids)).order_by(Trapgroup.tag).distinct().all()
        for trapgroup in trapgroups:
            names.append(trapgroup.tag)
            ids.append(trapgroup.id)
    return json.dumps({'names':names,'values':ids})

@app.route('/getTrapgroupCoords')
@login_required
def getTrapgroupCoords():
    '''Returns the trapgoup coordinates for the specified survey.'''
    
    next_url = None
    prev_url = None
    reply = []
    survey_id = request.args.get('survey_id', None, type=int)
    page = request.args.get('page', 1, type=int)

    survey = db.session.query(Survey).get(int(survey_id))
    if survey and checkSurveyPermission(current_user.id,survey_id,'read'):
        trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).order_by(Trapgroup.tag).distinct().paginate(page, 10, False)
        for trapgroup in trapgroups.items:
            data = {}
            data['id'] = trapgroup.id
            data['tag'] = trapgroup.tag
            data['latitude'] = trapgroup.latitude
            data['longitude'] = trapgroup.longitude
            data['altitude'] = trapgroup.altitude
            reply.append(data)

        next_url = url_for('getTrapgroupCoords', survey_id=survey_id, page=trapgroups.next_num) if trapgroups.has_next else None
        prev_url = url_for('getTrapgroupCoords', survey_id=survey_id, page=trapgroups.prev_num) if trapgroups.has_prev else None

    return json.dumps({'trapgroups':reply, 'next_url': next_url, 'prev_url': prev_url})

@app.route('/getSurveyClassifications/<survey_id>')
@login_required
def getSurveyClassifications(survey_id):
    '''Returns a list of all classifications in the specified survey.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey_id,'write'):
        classList = db.session.query(Detection.classification)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==int(survey_id))\
                            .filter(func.lower(Detection.classification)!='nothing')\
                            .order_by(Detection.classification)\
                            .distinct().all()
        classList = [r[0] for r in classList if r[0] != None]
    else:
        classList = []
        
    return json.dumps(classList)

@app.route('/getCoords', methods=['POST'])
@login_required
def getCoords():
    '''Returns a list of trapgroup latitudes, longitudes and altitudes for the specified task.'''

    task_ids = ast.literal_eval(request.form['task_ids'])
    if 'site_ids' in request.form:
        site_ids = ast.literal_eval(request.form['site_ids'])
    else:
        site_ids = None
    if 'group_ids' in request.form:
        group_ids = ast.literal_eval(request.form['group_ids'])
    else:
        group_ids = None
    trapgroups = []
    trapgroups_data = []

    if Config.DEBUGGING: app.logger.info('getCoords: task_ids: {} site_ids: {} group_ids: {}'.format(task_ids,site_ids,group_ids))

    if current_user and current_user.is_authenticated:
        if task_ids:
            if task_ids[0] == '0':
                tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').distinct().all()
            else:
                tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()
            task_ids = [r[0] for r in tasks]
            survey_ids = list(set([r[1] for r in tasks]))

            if site_ids and group_ids:
                trapgroups = db.session.query(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude, Trapgroup.altitude)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                        .filter(Task.id.in_(task_ids))\
                                        .filter(Trapgroup.survey_id.in_(survey_ids))\
                                        .filter(or_(Trapgroup.id.in_(site_ids), Sitegroup.id.in_(group_ids)))\
                                        .order_by(Trapgroup.tag)\
                                        .distinct().all()

            elif site_ids:
                trapgroups = db.session.query(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude, Trapgroup.altitude)\
                                            .join(Survey)\
                                            .join(Task)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Trapgroup.survey_id.in_(survey_ids))\
                                            .filter(Trapgroup.id.in_(site_ids))\
                                            .order_by(Trapgroup.tag)\
                                            .distinct().all()

            elif group_ids:
                trapgroups = db.session.query(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude, Trapgroup.altitude)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                        .filter(Task.id.in_(task_ids))\
                                        .filter(Trapgroup.survey_id.in_(survey_ids))\
                                        .filter(Sitegroup.id.in_(group_ids))\
                                        .order_by(Trapgroup.tag)\
                                        .distinct().all()
            else:
                trapgroups = db.session.query(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude, Trapgroup.altitude)\
                                        .join(Survey)\
                                        .join(Task)\
                                        .filter(Task.id.in_(task_ids))\
                                        .filter(Trapgroup.survey_id.in_(survey_ids))\
                                        .order_by(Trapgroup.tag)\
                                        .distinct().all()

            for tag, latitude, longitude, altitude in trapgroups:
                item = {'tag':tag,'latitude':latitude,'longitude':longitude,'altitude':altitude}
                if item not in trapgroups_data:
                    trapgroups_data.append(item)  

    return json.dumps({'trapgroups':trapgroups_data})

@app.route('/getCoordsIndividual/<individual_id>')
@login_required
def getCoordsIndividual(individual_id):
    '''Returns a list of trapgroup latitudes, longitudes and altitudes for the specified individual.'''

    individual = db.session.query(Individual).get(individual_id)
    trapgroups = []
    trapgroups_data = []

    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            trapgroups.extend(task.survey.trapgroups)

    for trapgroup in trapgroups:
        item = {'tag':trapgroup.tag,'latitude':trapgroup.latitude,'longitude':trapgroup.longitude,'altitude':trapgroup.altitude}
        if item not in trapgroups_data:
            trapgroups_data.append(item)      

    return json.dumps({'trapgroups':trapgroups_data})

@app.route('/getTrapgroupCounts', methods=['POST'])
@login_required
def getTrapgroupCounts():
    '''
    Returns the counts of the given species base units for each trapgroup of the specified task.
    
        Parameters:
            task_id (int): The task ID
            species (str): The species ID. 0 returns all species.
            baseUnit (int): The base unit to be counted - images (1), clusters (2), or labelgroups (3)
    '''
    task_ids = ast.literal_eval(request.form['task_ids'])
    species = ast.literal_eval(request.form['species'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    if 'startDate' in request.form:
        startDate = ast.literal_eval(request.form['startDate'])
        endDate = ast.literal_eval(request.form['endDate'])
    else:
        startDate = None
        endDate = None
    if 'sites' in request.form:
        sites = ast.literal_eval(request.form['sites'])
        groups = ast.literal_eval(request.form['groups'])
    else:
        sites = None
        groups = None

    if baseUnit == '4':
        timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
        timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
    else:
        timeToIndependence = None
        timeToIndependenceUnit = None

    if 'normaliseBySite' in request.form:
        normaliseBySite = ast.literal_eval(request.form['normaliseBySite'])
        if normaliseBySite == '1':
            normaliseBySite = True
        else:
            normaliseBySite = False
    else:
        normaliseBySite = False

    if Config.DEBUGGING: app.logger.info('The following parameters were passed to getTrapgroupCounts: task_ids: {}, species: {}, baseUnit: {}, sites: {}, groups: {}, startDate: {}, endDate: {}, timeToIndependence: {}, timeToIndependenceUnit: {}'.format(task_ids, species, baseUnit, sites, groups, startDate, endDate, timeToIndependence, timeToIndependenceUnit))
    data = []
    maxVal = 0
    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()
        task_ids = [t[0] for t in tasks]
        survey_ids = list(set([t[1] for t in tasks]))

        if baseUnit == '1' or baseUnit == '4':
            baseQuery = db.session.query(
                                Image.id,
                                Image.corrected_timestamp,
                                Label.description, 
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '2':
            baseQuery = db.session.query(
                                Cluster.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '3':
            baseQuery = db.session.query(
                                Detection.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        baseQuery = rDets(baseQuery)

        if species != '0':
            labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            # Check checkboxes
            excludeNothing = request.args.get('excludeNothing', None)
            excludeKnocks = request.args.get('excludeKnocks', None)
            excludeVHL = request.args.get('excludeVHL', None)

            label_list = []
            if excludeNothing == 'true':
                label_list.append(GLOBALS.nothing_id)

            if excludeKnocks == 'true':
                label_list.append(GLOBALS.knocked_id)

            if excludeVHL == 'true':
                label = db.session.query(Label).get(GLOBALS.vhl_id)
                label_list.append(label.id)
                for task_id in task_ids:
                    label_list.extend(getChildList(label,int(task_id)))

            if len(label_list) != 0:
                baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        if startDate: baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)

        if endDate: baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)

        if normaliseBySite:
            trapgroups = db.session.query(
                                    Trapgroup.tag, 
                                    Trapgroup.latitude, 
                                    Trapgroup.longitude,
                                    func.count(distinct(func.date(Image.corrected_timestamp)))
                                )\
                                .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                                .join(Image)\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))
        else:
            trapgroups = db.session.query(
                                    Trapgroup.tag,
                                    Trapgroup.latitude,
                                    Trapgroup.longitude
                                )\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))                               

        if sites and sites != '0' and sites != '-1' and groups and groups != '0' and groups != '-1':
            trapgroups = trapgroups.filter(or_(Trapgroup.id.in_(sites), Sitegroup.id.in_(groups)))
        elif sites and sites != '0' and sites != '-1':
            trapgroups = trapgroups.filter(Trapgroup.id.in_(sites))
        elif groups and groups != '0' and groups != '-1':
            trapgroups = trapgroups.filter(Sitegroup.id.in_(groups))

        trapgroups = trapgroups.group_by(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).order_by(Trapgroup.tag).all()

        baseQuery = baseQuery.distinct().all()
        
        df = pd.DataFrame(baseQuery,columns=['id','timestamp','species','tag','latitude','longitude'])
        df.drop_duplicates(subset=['id'],inplace=True)

        if len(df) > 0:
            if timeToIndependence:
                if timeToIndependenceUnit == 's':
                    timeToIndependence = int(timeToIndependence)
                elif timeToIndependenceUnit == 'm':
                    timeToIndependence = int(timeToIndependence) * 60
                elif timeToIndependenceUnit == 'h':
                    timeToIndependence = int(timeToIndependence) * 3600
                timeToIndependence = timedelta(seconds=timeToIndependence)

                df = df.sort_values(by=['species','tag', 'latitude', 'longitude','timestamp'])
                df['timedelta'] = df.groupby(['species','tag','latitude','longitude'])['timestamp'].diff()
                df['timedelta'] = df['timedelta'].fillna(timedelta(seconds=9999999))
                df = df[df['timedelta'] >= timeToIndependence]
                df = df.drop(columns=['timedelta'])

            if normaliseBySite:
                for tag, latitude, longitude, effort in trapgroups:
                    site_count = df[(df['tag']==tag) & (df['latitude']==latitude) & (df['longitude']==longitude)].nunique()['id']
                    count = site_count / effort * 100
                    item = {'lat':latitude,'lng':longitude,'count': float(count),'tag':tag}
                    data.append(item)
                    maxVal = max(maxVal,count)

            else:
                for tag, latitude, longitude in trapgroups:
                    count = df[(df['tag']==tag) & (df['latitude']==latitude) & (df['longitude']==longitude)].nunique()['id']
                    item = {'lat':latitude,'lng':longitude,'count': int(count),'tag':tag}
                    data.append(item)
                    maxVal = max(maxVal,count)

    return json.dumps({'max':int(maxVal),'data':data})

@app.route('/getTrapgroupCountsIndividual/<individual_id>/<baseUnit>', methods=['POST']	)
@login_required
def getTrapgroupCountsIndividual(individual_id,baseUnit):
    '''
    Returns the counts of the given species base units for each trapgroup of the specified task.
    
        Parameters:
            individual_id (int): Individual ID
            baseUnit (int): The base unit to be counted - images (1), clusters (2), or labelgroups (3)
    '''

    data = []
    maxVal = 0
    
    start_date = ast.literal_eval(request.form['start_date'])
    end_date = ast.literal_eval(request.form['end_date'])

    individual = db.session.query(Individual).get(individual_id)

    task_ids = []
    survey_ids = []
    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            task_ids.append(task.id)
            survey_ids.append(task.survey_id)

    if individual and task_ids:
        if int(baseUnit) == 1:
            baseQuery = db.session.query(Image).join(Detection)
        elif int(baseUnit) == 2:
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task_id.in_(task_ids))
        elif int(baseUnit) == 3:
            baseQuery = db.session.query(Detection).join(Image)
        baseQuery = baseQuery.join(Camera).join(Trapgroup)\
                                        .filter(Detection.individuals.contains(individual))\
                                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                        .filter(Detection.static==False)\
                                        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                        .filter(Trapgroup.survey_id.in_(survey_ids))

        if start_date: baseQuery = baseQuery.filter(Image.corrected_timestamp >= start_date)

        if end_date: baseQuery = baseQuery.filter(Image.corrected_timestamp <= end_date)

        trapgroups = [trapgroup for task in individual.tasks for trapgroup in task.survey.trapgroups if task.id in task_ids]

        data_check = {}

        for trapgroup in trapgroups:
            item = {'lat':trapgroup.latitude,'lng':trapgroup.longitude,'count': baseQuery.filter(Camera.trapgroup_id==trapgroup.id).distinct().count(),'tag':trapgroup.tag}

            key = (item['lat'],item['lng'], item['tag'])
            if key not in data_check:
                data_check[key] = item.copy()
                maxVal = max(maxVal,item['count'])
            else:
                data_check[key]['count'] += item['count']
                maxVal = max(maxVal,data_check[key]['count'])

        data = list(data_check.values())

    return json.dumps({'max':maxVal,'data':data})

# @app.route('/assignTag/<clusterID>/<tagID>')
# @login_required
# def assignTag(clusterID, tagID):
#     '''Depricated information tagging ability. Adds given tag to the specified cluster. Returns progress numbers.'''

#     if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

#     num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
#     thetask = current_user.turkcode[0].task
#     cluster = db.session.query(Cluster).filter(Cluster.id == int(clusterID)).first()
#     num2 = thetask.size #+ thetask.test_size

#     if cluster and (int(tagID) != Config.EMPTY_HOTKEY_ID) and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
#         print('Tag Category: {}'.format(db.session.query(Tag).get(int(tagID)).description))
#         num += 1

#         if (num <= thetask.size) or (current_user.admin == True):
#             if cluster != None:
#                 newTag = db.session.query(Tag).get(int(tagID))
#                 if newTag not in cluster.tags:
#                     cluster.tags.append(newTag)

#                 cluster.user_id = int(current_user.id)
#                 cluster.timestamp = datetime.utcnow()
#                 db.session.commit()

#     return json.dumps((num, num2))

# @app.route('/removeTag/<clusterID>/<tagID>')
# @login_required
# def removeTag(clusterID, tagID):
#     '''Depricated informational tagging. Removes the given tag from the specified cluster.'''

#     if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

#     cluster = db.session.query(Cluster).get(int(clusterID))
#     if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
#         tag = db.session.query(Tag).get(int(tagID))
#         if tag in cluster.tags:
#             try:
#                 cluster.tags.remove(tag)
#                 db.session.commit()
#             except:
#                 pass

#     return json.dumps('')

# @app.route('/deleteTags/<clusterID>')
# @login_required
# def deleteTags(clusterID):
#     '''Part of the depricated informational tagging functionality. Deletes all tages from the specified cluster.'''

#     if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

#     cluster = db.session.query(Cluster).get(int(clusterID))
#     if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
#         cluster.tags = []
#         db.session.commit()

#     return json.dumps('')

@app.route('/assignNote', methods=['POST'])
@login_required
def assignNote():
    '''Assigns a note to the given cluster or individual.'''

    try:
        note = ast.literal_eval(request.form['note'])
        typeID = ast.literal_eval(request.form['type'])
        status = 'error'
        if(typeID == "cluster"):
            clusterID = ast.literal_eval(request.form['cluster_id'])
            cluster = db.session.query(Cluster).get(clusterID)
            # if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
            if cluster and (checkAnnotationPermission(current_user.parent_id,cluster.task_id) or checkSurveyPermission(current_user.id,cluster.task.survey_id,'write')):
                if len(note) > 512:
                    note = note[:512]
                cluster.notes = note
                db.session.commit()
                status = 'success'
        else:
            individualID = ast.literal_eval(request.form['individual_id'])
            individual = db.session.query(Individual).get(individualID)
            # if individual and ((current_user.parent in individual.tasks[0].survey.user.workers) or (current_user.parent == individual.tasks[0].survey.user) or (current_user == individual.tasks[0].survey.user)):
            if individual and individual.active and (all(checkAnnotationPermission(current_user.parent_id,task.id) for task in individual.tasks) or all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks)):
                if len(note) > 512:
                    note = note[:512]
                individual.notes = note
                db.session.commit()
                status = 'success'

    except:
        pass

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return json.dumps(status)

@app.route('/assignLabel/<clusterID>', methods=['POST'])
@login_required
def assignLabel(clusterID):
    '''Assigned the specified list of labels to the cluster. Returns progress numbers of an error status.'''

    # if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    try:
        labels = ast.literal_eval(request.form['labels'])
        explore = request.args.get('explore', None)
        reAllocated = False
        newClusters = []
        classifications = None
        session = db.session()

        if Config.DEBUGGING: app.logger.info('Submitted labels: {}'.format(labels))

        # Deal with remove false detections label
        remove_false_detections = False
        if str(GLOBALS.remove_false_detections_id) in labels:
            if Config.DEBUGGING: app.logger.info('Remove false detections request submitted')
            labels.remove(str(GLOBALS.remove_false_detections_id))
            labels.append(str(GLOBALS.nothing_id))
            remove_false_detections = True

        num = session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
        turkcode = current_user.turkcode[0]
        task = turkcode.task
        num2 = task.size + task.test_size
        cluster = session.query(Cluster).get(int(clusterID))
        isBounding = task.is_bounding
        task_id = task.id
        current_user_admin = current_user.admin
        current_user_username = current_user.username

        if 'taggingLevel' in request.form:
            taggingLevel = str(request.form['taggingLevel'])
        else:
            taggingLevel = task.tagging_level

        if turkcode.active:
            turkcode.active = False

        # if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
        if cluster and (checkAnnotationPermission(current_user.parent_id,cluster.task_id) or checkSurveyPermission(current_user.id,cluster.task.survey_id,'write')):
            num += 1

            #Check if image has already been knocked down, if so, ignore new label
            downLabel = session.query(Label).get(GLOBALS.knocked_id)
            if downLabel and (downLabel in cluster.labels):
                pass
            else:
                if (num <= task.size) or (current_user.admin):
                    newLabels = []
                    oldLabels = cluster.labels

                    if '-2' in taggingLevel:
                        cluster.tags = []
                    else:
                        cluster.labels = []

                        # Can't have nothing label alongside other labels
                        if (len(labels) > 1) and (str(GLOBALS.nothing_id) in labels):
                            if Config.DEBUGGING: app.logger.info('Blocked nothing multi label!')
                            labels.remove(GLOBALS.nothing_id)

                    cluster.skipped = False

                    for label_id in labels:
                        if int(label_id)==Config.SKIP_ID:
                            cluster.skipped = True
                            parentLabel = session.query(Label).get(taggingLevel)

                            if ('-2' not in taggingLevel) and (parentLabel not in newLabels):
                                newLabels.append(parentLabel)

                        else:
                            if '-2' in taggingLevel:
                                newLabel = session.query(Tag).get(label_id)
                            else:
                                newLabel = session.query(Label).get(label_id)
                            
                            if newLabel:
                                if newLabel.id == GLOBALS.wrong_id:
                                    newLabels = []
                                    cluster.labels = []
                                    break
                                
                                elif (newLabel not in cluster.labels) and (newLabel not in cluster.tags) and (newLabel not in newLabels):
                                    newLabels.append(newLabel)

                    if '-2' in taggingLevel:
                        cluster.tags.extend(newLabels)
                        cluster.skipped = True
                        if Config.DEBUGGING: app.logger.info('Cluster tags: {}'.format([r.description for r in cluster.tags]))
                    else:
                        cluster.labels.extend(newLabels)
                        if Config.DEBUGGING: app.logger.info('Cluster labels: {}'.format([r.description for r in cluster.labels]))

                    cluster.user_id = current_user.id
                    cluster.examined = True
                    cluster.timestamp = datetime.utcnow()

                    labelgroups = session.query(Labelgroup) \
                                                .join(Detection) \
                                                .join(Image) \
                                                .filter(Image.clusters.contains(cluster)) \
                                                .filter(Labelgroup.task_id==cluster.task_id) \
                                                .distinct().limit(400).all()

                    for labelgroup in labelgroups:
                        if '-2' in taggingLevel:
                            labelgroup.tags = cluster.tags
                        else:
                            labelgroup.labels = cluster.labels

                    # This allows the vast majority of clusters' labelgroups to be updated and just pushes the extreme clases to a celery task to prevent timeouts
                    if len(labelgroups)==400:
                        use_celery_to_update_labelgroups = True
                    else:
                        use_celery_to_update_labelgroups = False

                    if explore:
                        counts = rDets(session.query(Cluster.id,func.count(distinct(Image.id)),func.count(distinct(Labelgroup.id)))\
                                        .join(Image,Cluster.images)
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .filter(Cluster.id==cluster.id)\
                                        .filter(Labelgroup.task_id==cluster.task_id)\
                                        ).group_by(Cluster.id).first()
                        
                        if Config.DEBUGGING: app.logger.info('Counts: {}'.format(counts))

                        if counts:
                            added_labels = set(newLabels) - set(oldLabels)
                            removed_labels = set(oldLabels) - set(newLabels)
                            for label in added_labels:  
                                if label.task_id:
                                    try:
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "cluster_count", 1)
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "image_count", counts[1])
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "sighting_count", counts[2])
                                        GLOBALS.redisClient.hset('label_counts_'+str(label.id), "timestamp", datetime.utcnow().timestamp())
                                    except:
                                        GLOBALS.redisClient.hmset('label_counts_'+str(label.id),{'cluster_count':1,'image_count':counts[1],'sighting_count':counts[2],'timestamp':datetime.utcnow().timestamp()})
                            
                            for label in removed_labels:
                                if label.task_id:
                                    try:
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "cluster_count", -1)
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "image_count", -counts[1])
                                        GLOBALS.redisClient.hincrby('label_counts_'+str(label.id), "sighting_count", -counts[2])
                                        GLOBALS.redisClient.hset('label_counts_'+str(label.id), "timestamp", datetime.utcnow().timestamp())
                                    except:
                                        GLOBALS.redisClient.hmset('label_counts_'+str(label.id),{'cluster_count':-1,'image_count':-counts[1],'sighting_count':-counts[2],'timestamp':datetime.utcnow().timestamp()})
                    
                        #Add task_id to redis for updateAllStatuses
                        GLOBALS.redisClient.sadd('tasks_to_update_status',cluster.task_id)

                    if taggingLevel=='-3':
                        classifications = getClusterClassifications(cluster.id)
                    elif taggingLevel=='-8':
                        classifications = getRelatedClusterLabels(cluster.id)

                    # if taggingLevel=='-6':
                    #     # NOTE: This is not currently used (is for check masked sightings)
                    #     masked_detections = session.query(Detection)\
                    #                             .join(Image)\
                    #                             .filter(Image.clusters.contains(cluster))\
                    #                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    #                             .filter(Detection.static==False)\
                    #                             .filter(Detection.status=='masked')\
                    #                             .all()

                    #     images = []
                    #     for detection in masked_detections:
                    #         detection.status = 'active'
                    #         detection.source = 'user'
                    #         app.logger.info('Detection {} unmasked'.format(detection.id))
                    #         images.append(detection.image)
                    #         labelgroups = session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).all()
                    #         for labelgroup in labelgroups:
                    #             labelgroup.checked = False
                        
                    #     session.commit()

                    #     for image in images:
                    #         image.detection_rating = detection_rating(image)

                    # NOTE: HIDING REMOVE FALSE DETECTIONS FUNCTIONALITY
                    # if remove_false_detections:
                    #     tgs_available = session.query(Trapgroup)\
                    #                             .filter(Trapgroup.survey==task.survey)\
                    #                             .filter(Trapgroup.user_id==None)\
                    #                             .filter(Trapgroup.active==True)\
                    #                             .first()

                    #     removable_detections = session.query(Detection)\
                    #                             .join(Image)\
                    #                             .filter(Image.clusters.contains(cluster))\
                    #                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    #                             .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    #                             .filter(Detection.static==False)\
                    #                             .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top))<0.1)\
                    #                             .first()

                    #     if tgs_available and (not explore) and removable_detections:
                    #         if GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id))==None: GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),0)
                    #         reAllocated = True
                    #         trapgroup = session.query(Trapgroup).join(Camera).join(Image).filter(Image.clusters.contains(cluster)).first()
                    #         survey_id = task.survey_id
                    #         task_size = task.size
                    #         trapgroup.processing = True
                    #         trapgroup.active = False
                    #         trapgroup.user_id = None
                    #         GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),num)

                    #         label_description = None
                    #         if int(taggingLevel) > 0: label_description = session.query(Label).get(int(taggingLevel)).description
                            
                    #         session.commit()
                            
                    #         removeFalseDetections.apply_async(kwargs={'cluster_id':clusterID,'undo':False})

                    #         # Get a new batch of clusters
                    #         # session.close()
                    #         # GLOBALS.mutex[task_id]['global'].acquire()
                    #         # # Open a new session to ensure allocations are up to date after a long wait
                    #         # session = db.session()
                    #         # session.add(current_user)
                    #         # session.refresh(current_user)

                    #         trapgroup = allocate_new_trapgroup(task_id,current_user.id,survey_id,session)
                    #         if trapgroup == None:
                    #             session.close()
                    #             # GLOBALS.mutex[task_id]['global'].release()
                    #             newClusters = []
                    #         else:
                    #             limit = task_size - int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode())
                    #             clusterInfo, max_request = fetch_clusters(taggingLevel,task_id,isBounding,trapgroup.id,session,limit)

                    #             # if len(clusterInfo)==0: current_user.trapgroup = []
                    #             if (len(clusterInfo) <= limit) and not max_request:
                    #                 clusters_allocated = int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode()) + len(clusterInfo)
                    #                 trapgroup.active = False
                    #                 GLOBALS.redisClient.lrem(survey_id,0,trapgroup.id)
                    #             else:
                    #                 clusters_allocated = int(GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id)).decode()) + limit
                    #             GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),clusters_allocated)
                                
                    #             session.commit()
                    #             session.close()
                    #             # GLOBALS.mutex[task_id]['global'].release()

                    #             newClusters = translate_cluster_for_client(clusterInfo,'0',limit,isBounding,taggingLevel,None,label_description)['info']

                    #         if (newClusters==[]) or (clusters_allocated >= task_size):
                    #             newClusters.append(Config.FINISHED_CLUSTER)
                    #     else:
                    #         session.commit()
                    #         session.close()

                    session.commit()

                    if use_celery_to_update_labelgroups: update_labelgroup_labels_tags.apply_async(kwargs={'cluster_id':cluster.id})

                    if explore:
                        individual_check = session.query(Individual.id).join(Detection, Individual.detections).join(Image).join(Cluster, Image.clusters).filter(Cluster.id==cluster.id).filter(Individual.tasks.contains(task)).first()
                        if individual_check:
                            individual_check = individual_check[0]
                            check_individual_detection_mismatch.apply_async(kwargs={'task_id':task_id,'cluster_id':cluster.id})

                    session.close()

        else:
            return {'redirect': url_for('done')}, 278

        if (not current_user_admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(task_id),current_user_username)):
            return {'redirect': url_for('done')}, 278
        else:
            response = {'progress': (num, num2), 'reAllocated': reAllocated, 'newClusters': newClusters, 'classifications': classifications}
            if explore: 
                response['username'] = current_user_username
                response['individual_check'] = individual_check
            return json.dumps(response)

    except:
        return json.dumps('error')

@app.route('/updateprog', methods=['POST'])
@login_required
def updateProgress():
    '''Returns the progress of the current user's batch.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    progress = None
    task = current_user.turkcode[0].task
    if task:
        if '-5' in task.tagging_level:
            individual_id = request.args.get('id', None)
            if individual_id:
                progress = getProgress(individual_id,task.id)
        else:
            num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
            progress = (num, (task.size + task.test_size))
    
    return json.dumps(progress)

@app.route('/getTaggingLevel')
@login_required
def getTaggingLevel():
    '''Returns the tagging level of the current user's allocated task, alongside the name of the label.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    task = current_user.turkcode[0].task
    taggingLevel = task.tagging_level

    wrongStatus = 'false'
    taggingAlgorithm = 'None'
    if (',' not in taggingLevel) and (int(taggingLevel) > 0):
        label = db.session.query(Label).get(int(taggingLevel))
        labelChildren = db.session.query(Label).filter(Label.parent==label).filter(Label.task==task).first()

        if labelChildren:
            taggingLabel = label.description
        else:
            # Allow top-level re-annotation of child categories
            taggingLabel = 'None'
            taggingLevel = '-1'
            wrongStatus = 'true'
    else:
        taggingLabel = 'None'
        if ',' in taggingLevel and ('-4' in taggingLevel or '-5' in taggingLevel):
            tL = taggingLevel.split(',')
            species = tL[1]
            label = db.session.query(Label).filter(Label.task_id==task.id).filter(Label.description==species).first()
            taggingAlgorithm = label.algorithm

    return json.dumps({'taggingLevel':taggingLevel, 'taggingLabel':taggingLabel, 'wrongStatus':wrongStatus, 'taggingAlgorithm':taggingAlgorithm})

@app.route('/initKeys')
@login_required
def initKeys():
    '''Returns the labels and their associated hotkeys for the given task.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    task = current_user.turkcode[0].task

    # if taggingLevel == '-23':
    #     taggingLevel = task.tagging_level

    # if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user) or (current_user == task.survey.user)):
    if task and (checkAnnotationPermission(current_user.parent_id,task.id) or checkSurveyPermission(current_user.id,task.survey_id,'write')):

        addMaskArea = False
        addRemoveFalseDetections = False
        if task.tagging_level == '-1':
            # addRemoveFalseDetections = True
            addMaskArea = True
        else:
            # addRemoveFalseDetections = False
            if (',' not in task.tagging_level) and int(task.tagging_level) > 0 and not task.is_bounding:
                addMaskArea = True

        addSkip = False
        if (',' not in task.tagging_level) and (int(task.tagging_level) > 0):
            labelChildren = db.session.query(Label).filter(Label.parent_id==int(task.tagging_level)).filter(Label.task==task).first()
            if labelChildren==None: addSkip = True

        reply = {}
        labels = db.session.query(Label).filter(Label.task_id==task.id).filter(Label.children.any()).distinct().all()
        labels.append(db.session.query(Label).get(GLOBALS.vhl_id))
        for label in labels:
            reply[str(label.id)] = genInitKeys(str(label.id),task.id,False,addRemoveFalseDetections,addMaskArea)
        reply['-1'] = genInitKeys('-1',task.id,addSkip,addRemoveFalseDetections,addMaskArea)
        reply['-2'] = genInitKeys('-2',task.id,False,addRemoveFalseDetections,addMaskArea)

        return json.dumps(reply)
    else:
        return json.dumps('error')

@app.route('/getSurveys')
@login_required
def getSurveys():
    '''Returns a list of survey names and IDs owned by the current user.'''
    requiredPermission = request.args.get('requiredPermission',None)
    if requiredPermission==None: requiredPermission = 'read'
    surveys = [tuple(row) for row in surveyPermissionsSQ(db.session.query(Survey.id, Survey.name),current_user.id,requiredPermission).distinct().all()]
    return json.dumps(surveys)

@app.route('/getWorkerSurveys')
@login_required
def getWorkerSurveys():
    '''Returns a list of survey names and IDs, owned by the current user, worked on by the specified worker.'''
    
    worker_id = request.args.get('worker_id',None)
    if worker_id and current_user.id == int(worker_id):
        surveys = surveyPermissionsSQ(db.session.query(Survey.id, Survey.name)\
                            .join(Task)\
                            .join(Turkcode)\
                            .join(User)\
                            .filter(User.parent_id==worker_id)\
                            ,current_user.id,'worker').distinct().all()
    elif worker_id and current_user.id != int(worker_id):
        surveys = surveyPermissionsSQ(db.session.query(Survey.id, Survey.name)\
                            .join(Task)\
                            .join(Turkcode)\
                            .join(User)\
                            .filter(User.parent_id==worker_id)\
                            ,current_user.id,'admin').distinct().all()

    surveys = [tuple(row) for row in surveys]
    
    return json.dumps(surveys)

@app.route('/getTasks/<survey_id>')
@login_required
def getTasks(survey_id):
    '''Returns the task names and IDs for the specified survey.'''

    worker_id = request.args.get('worker_id',None)
    if worker_id:
        tasks = [tuple(row) for row in surveyPermissionsSQ(db.session.query(Task.id, Task.name)\
                            .join(Survey)\
                            .join(Turkcode)\
                            .join(User,Turkcode.user_id==User.id)\
                            .filter(User.parent_id==worker_id)\
                            .filter(Survey.id == int(survey_id))\
                            .filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying'))\
                            ,current_user.id,'worker').distinct().all()]
        return json.dumps(tasks)
    else:
        if int(survey_id) == -1:
            # templates
            tasks = [tuple(row) for row in db.session.query(Task.id, Task.name).filter(Task.survey_id==None).distinct().all()]
            # return json.dumps([(-1, 'Southern African')])
        else:
            tasks = [tuple(row) for row in surveyPermissionsSQ(db.session.query(Task.id, Task.name).join(Survey).filter(Survey.id == int(survey_id)).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')),current_user.id,'read').distinct().all()]
        return json.dumps(tasks)

@app.route('/getOtherTasks/<task_id>')
@login_required
def getOtherTasks(task_id):
    '''Returns a list of task names and IDs for the survey of the given task.'''
    task = db.session.query(Task).get(int(task_id))
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        tasks = db.session.query(Task.id, Task.name).filter(Task.survey_id == task.survey_id).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).distinct().all()
        tasks = [tuple(row) for row in tasks]
        return json.dumps(tasks)
    else:
        return json.dumps([])

@app.route('/reviewClassification', methods=['POST'])
@login_required
def reviewClassification():
    '''Endpoint for the review of classifications in the AI check workflow.'''

    num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
    turkcode = current_user.turkcode[0]
    num2 = turkcode.task.size + turkcode.task.test_size

    cluster_labels = []
    cluster_label_ids = []
    classifications = []

    data = json.loads(request.form['data'])
    cluster_id = data['cluster_id']
    overwrite = data['overwrite']
    data = data['data']

    cluster = db.session.query(Cluster).get(cluster_id)
    # if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
    if cluster and (checkAnnotationPermission(current_user.parent_id,cluster.task_id) or checkSurveyPermission(current_user.id,cluster.task.survey_id,'write')):
        if (current_user.admin) or (GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
            if (num < cluster.task.size) or (current_user.admin == True):
                num += 1

                if str(overwrite).lower()=='true':
                    if Config.DEBUGGING: app.logger.info('Overwriting labels for {}'.format(cluster.id))
                    cluster.labels = []

                additional_labels = []
                for item in data:
                    classification = item['label']
                    if Config.DEBUGGING: app.logger.info('classification: {}'.format(classification))
                    action = item['action']

                    if action=='accept':
                        if classification.lower() in ['vehicles/humans/livestock','nothing','unknown']:
                            label = db.session.query(Label).filter(Label.description==classification).first()
                        else:
                            label = db.session.query(Label).filter(Label.description==classification).filter(Label.task==cluster.task).first()

                        if label:
                            # Remove related labels
                            if label.parent:
                                if label.parent in cluster.labels: cluster.labels.remove(label.parent)
                                # family_labels = [label.parent]
                                # family_labels.extend(db.session.query(Label).filter(Label.parent==label.parent).filter(Label.task==cluster.task).all())
                                # for family_label in family_labels:
                                #     if family_label in cluster.labels:
                                #         cluster.labels.remove(family_label)

                            if (label not in additional_labels) and (label not in cluster.labels):
                                additional_labels.append(label)

                # labelgroups = db.session.query(Labelgroup)\
                #                             .join(Detection)\
                #                             .join(Image)\
                #                             .filter(Image.clusters.contains(cluster))\
                #                             .filter(Labelgroup.task==cluster.task)\
                #                             .all()
                
                if (GLOBALS.nothing_id in [r.id for r in cluster.labels]) and additional_labels:
                    cluster.labels.remove(db.session.query(Label).get(GLOBALS.nothing_id))

                cluster.labels.extend(additional_labels)

                # for labelgroup in labelgroups:
                #     labelgroup.labels = cluster.labels
                #     labelgroup.checked = False

                cluster.examined = True
                cluster.user_id = current_user.id
                cluster.timestamp = datetime.utcnow()
                db.session.commit()

                if cluster.task.tagging_level == '-3':
                    classifications = getClusterClassifications(cluster.id)
                elif cluster.task.tagging_level == '-8':
                    classifications = getRelatedClusterLabels(cluster.id)

                if cluster.labels == []:
                    cluster_labels.append('None')
                    cluster_label_ids.append('0')
                else:
                    for label in cluster.labels:
                        cluster_labels.append(label.description)
                        cluster_label_ids.append(str(label.id))

    if Config.DEBUGGING: app.logger.info('{}: {}'.format(cluster.id, cluster.labels))

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return json.dumps({'progress':(num, num2),'labels':cluster_labels,'classifications':classifications,'label_ids':cluster_label_ids})

@app.route('/getAllTaskLabels/<task_id1>/<task_id2>')
@login_required
def getAllTaskLabels(task_id1,task_id2):
    '''Gets all the labels for two tasks, in alphabetical, and parent-grouped order.'''

    labels1 = []
    labels2 = []
    task1 = db.session.query(Task).get(task_id1)
    task2 = db.session.query(Task).get(task_id2)
    # if task1 and task2 and (current_user==task1.survey.user) and (current_user==task2.survey.user):
    if task1 and task2 and checkSurveyPermission(current_user.id,task1.survey_id,'read') and checkSurveyPermission(current_user.id,task2.survey_id,'read'):
        alist = [[GLOBALS.knocked_id,'Knocked Down'],[GLOBALS.nothing_id,'Nothing'],[GLOBALS.unknown_id,'Unknown'],[GLOBALS.vhl_id,'Vehicles/Humans/Livestock']]

        labels1.extend(buildOrderedLabels(None,task_id1))
        labels1.extend(alist)
        labels1.extend(buildOrderedLabels(GLOBALS.vhl_id,task_id1))

        labels2.extend(buildOrderedLabels(None,task_id2))
        labels2.extend(alist)
        labels2.extend(buildOrderedLabels(GLOBALS.vhl_id,task_id2))

        labels1 = [list(item) for item in labels1]
        labels2 = [list(item) for item in labels2]

    return json.dumps({'one':labels1, 'two':labels2})

@app.route('/submitComparison/<groundTruth>/<task_id1>/<task_id2>', methods=['POST'])
@login_required
def submitComparison(groundTruth,task_id1,task_id2):
    '''Submits a comparison between the two specified tasks, and kicks-off the necessary processing.'''

    try:
        translations = request.form['translations']
        task1 = db.session.query(Task).get(int(task_id1))
        task2 = db.session.query(Task).get(int(task_id2))
        if task1 and task2 and checkSurveyPermission(current_user.id,task1.survey_id,'read') and checkSurveyPermission(current_user.id,task2.survey_id,'read'):
            GLOBALS.redisClient.delete('confusions_'+str(current_user.id))
            prepareComparison.delay(translations=translations,groundTruth=groundTruth,task_id1=task_id1,task_id2=task_id2,user_id=str(current_user.id))
            return json.dumps('success')
        else:
            return json.dumps('error')
    except:
        return json.dumps('error')

@app.route('/comparison')
@login_required
def comparison():
    '''Renders the task-comparison page. Also does all necessary calculations for recall, precision etc.'''
    
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if not current_user.admin:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
        else:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))

            confusions = GLOBALS.redisClient.get('confusions_'+str(current_user.id))

            if confusions:
                confusions = json.loads(confusions.decode())
                ground_truths = json.loads(GLOBALS.redisClient.get('ground_truths_'+str(current_user.id)).decode())

                task1 = db.session.query(Task).get(ground_truths['task1'])
                task2 = db.session.query(Task).get(ground_truths['task2'])

                if not checkSurveyPermission(current_user.id,task1.survey_id,'read') or not checkSurveyPermission(current_user.id,task2.survey_id,'read'):
                    return redirect(url_for('index'))

                # Generate some stats
                total_sightings = 0
                matched_sightings = 0
                nothing_sightings = 0
                non_nothing = 0

                for key in confusions:
                    if key != 'multi':
                        for key2 in confusions[key]:
                            total_sightings += len(confusions[key][key2])
                            if key == key2:
                                matched_sightings += len(confusions[key][key2])
                            if ground_truths['task1']==ground_truths['ground']:
                                if key == ground_truths['nothing1']:
                                    nothing_sightings += len(confusions[key][key2])
                                if key2 != ground_truths['nothing2']:
                                    non_nothing += len(confusions[key][key2])
                            else:
                                if key2 == ground_truths['nothing2']:
                                    nothing_sightings += len(confusions[key][key2])
                                if key != ground_truths['nothing1']:
                                    non_nothing += len(confusions[key][key2])

                match_percentage = round((matched_sightings/total_sightings)*100,2)
                wrong_sightings = total_sightings - matched_sightings
                wrong_percentage = round((wrong_sightings/total_sightings)*100,2)

                unknownLabel = db.session.query(Label).get(GLOBALS.unknown_id)
                unknowns = db.session.query(Image).join(Cluster, Image.clusters).filter(Cluster.task_id==ground_truths['other']).filter(Cluster.labels.contains(unknownLabel)).count()

                survey_id = db.session.query(Task).get(ground_truths['other']).survey_id

                animal_sightings = total_sightings - nothing_sightings
                value_percentage = round((animal_sightings/total_sightings)*100,2)
                unknown_percentage = round((unknowns/animal_sightings)*100,2)

                correct_animal_sightings = matched_sightings - len(confusions[ground_truths['nothing1']][ground_truths['nothing2']])

                recall_rate = round((correct_animal_sightings/animal_sightings)*100,2)
                precision = round((correct_animal_sightings/non_nothing)*100,2)

                task1_heading = db.session.query(Task).get(ground_truths['task1']).name
                task2_heading = db.session.query(Task).get(ground_truths['task2']).name

                image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).count()

                MegaDetectorFailures = json.loads(GLOBALS.redisClient.get('megaDetectorMisses_'+str(current_user.id)).decode())['count']
                MegaDetectorFailures_percentage = round((MegaDetectorFailures/wrong_sightings)*100,2)
                EmptyClustered = len(json.loads(GLOBALS.redisClient.get('emptyClustered_'+str(current_user.id)).decode()))
                EmptyClustered_percentage = round((EmptyClustered/image_count)*100,2)

                comparisonLabels = json.loads(GLOBALS.redisClient.get('comparisonLabels_'+str(current_user.id)).decode())

                # Species by species
                species_names = []
                species_recalls = []
                species_precisions = []
                for species in confusions:
                    if species != 'multi':
                        rowCount = 0
                        colCount = 0
                        for key in confusions[species]:
                            rowCount += len(confusions[species][key])
                            colCount += len(confusions[key][species])

                        if ground_truths['task1']==ground_truths['ground']:
                            actual_species_count = rowCount
                            species_count = colCount
                        else:
                            actual_species_count = colCount
                            species_count = rowCount

                        match_count = len(confusions[species][species])

                        if actual_species_count!=0:
                            species_recalls.append(round((match_count/actual_species_count)*100,2))
                        else:
                            species_recalls.append('n/a')

                        if species_count!=0:
                            species_precisions.append(round((match_count/species_count)*100,2))
                        else:
                            species_precisions.append('n/a')

                        species_names.append(comparisonLabels[species])
                        
                return render_template('html/comparison.html', title='Comparison',   total_sightings=total_sightings,
                        matched_sightings=matched_sightings, match_percentage=match_percentage, task1_heading=task1_heading,
                        task2_heading=task2_heading, wrong_sightings=wrong_sightings, wrong_percentage=wrong_percentage,
                        correct_animal_sightings=correct_animal_sightings, animal_sightings=animal_sightings, recall_rate=recall_rate,
                        non_nothing=non_nothing, precision=precision, unknowns=unknowns, value_percentage=value_percentage,
                        unknown_percentage=unknown_percentage,species_names=species_names,species_recalls=species_recalls,
                        species_precisions=species_precisions,MegaDetectorFailures=MegaDetectorFailures,EmptyClustered=EmptyClustered,
                        MegaDetectorFailures_percentage=MegaDetectorFailures_percentage,EmptyClustered_percentage=EmptyClustered_percentage,
                        image_count=image_count, helpFile='comparison_page', bucket=Config.BUCKET, version=Config.VERSION)
            else:
                return render_template("html/block.html",text="Your comparison does not seem to be ready yet. Please refresh the page in a few minutes.", helpFile='block', version=Config.VERSION)
    
@app.route('/getConfusionMatrix')
@login_required
def getConfusionMatrix():
    '''Returns the confusion matrix comparisons for the task-comparison page, for the active comparison.'''

    confusions = GLOBALS.redisClient.get('confusions_'+str(current_user.id))

    if confusions:
        return confusions.decode()
    else:
        return json.dumps('Error')


@app.route('/getConfusionLabels')
@login_required
def getConfusionLabels():
    '''Gets the gouping labels for the task-comparison page.'''

    comparisonLabels = GLOBALS.redisClient.get('comparisonLabels_'+str(current_user.id))
    
    if comparisonLabels:
        comparisonLabels = json.loads(comparisonLabels.decode())
        newDict = {}
        for key in comparisonLabels:
            newDict[key] = {}
            newDict[key]['name'] = comparisonLabels[key]
            newDict[key]['length'] = math.floor(len(comparisonLabels[key])/3)
        return json.dumps(newDict)
    else:
        return json.dumps('Error')

@app.route('/getLabels/<task_id>')
@login_required
def getLabels(task_id):
    '''Returns all the label info for a given task ID.'''

    reply = []
    task = db.session.query(Task).get(task_id)
    # if (int(task_id) == -1) or (task and (current_user==task.survey.user)):
    if task and ((task.survey_id==None) or checkSurveyPermission(current_user.id,task.survey_id,'read')):
        # if int(task_id) == -1: #template
        #     task = db.session.query(Task).filter(Task.name=='template_southern_africa').filter(Task.survey==None).first()
        #     task_id = task.id
        
        tempLabels = db.session.query(Label).filter(Label.task_id == int(task_id)).filter(Label.parent_id==None).all()
        vhl = db.session.query(Label).get(GLOBALS.vhl_id)
        tempLabels.append(vhl)

        labels = []
        for label in tempLabels:
            if label != vhl:
                labels.append(label)
            labelChildren = db.session.query(Label).filter(Label.parent==label).filter(Label.task==task).first()
            if labelChildren:
                labels = addKids(labels, label, int(task_id))

        for label in labels:
            if label.parent == vhl:
                parent = label.parent.description
                parent_id = '-100000'
            elif label.parent != None:
                parent = label.parent.description
                parent_id = label.parent_id
            else:
                parent = 'None'
                parent_id = '-99999'
            reply.append([label.description, label.hotkey, parent, label.id, parent_id])

    return json.dumps(reply)

@app.route('/editTask/<task_id>', methods=['POST'])
@login_required
def editTask(task_id):
    '''Edits the labels of a specified task. Returns a success/error state.'''
    try:
        task = db.session.query(Task).get(task_id)
        app.logger.info('Edit Task: {}'.format(task_id))
        if task and checkSurveyPermission(current_user.id,task.survey_id,'write') and (task.status.lower() in Config.TASK_READY_STATUSES):
            editDict = ast.literal_eval(request.form['editDict'])
            tagsDict = ast.literal_eval(request.form['tagsDict'])
            translationsDict = ast.literal_eval(request.form['translationsDict'])
            deleteAutoLabels = ast.literal_eval(request.form['deleteAutoLabels'])

            # Check if any surveys are busy with a dearchival process
            if task.survey.status == 'Restoring Files':
                status = 'error'
                message = 'Your survey is currently having files restored from archive. Editing an annotation set is not possible during this process. Please wait until the 48 hour restoration period has completed.'
                return json.dumps({'status': status, 'message': message})

            if deleteAutoLabels=='true': 
                deleteAutoLabels = True 
            else: 
                deleteAutoLabels = False

            if 'speciesEditDict' in request.form:
                speciesEditDict = request.form['speciesEditDict']
                speciesDict = ast.literal_eval(speciesEditDict)
            else:
                speciesEditDict = None
                speciesDict = None

            if speciesDict:
                species_tasks = []
                for species in speciesDict:
                    species_tasks.extend(speciesDict[species]['tasks'])
                
                if task_id in species_tasks: species_tasks.remove(task_id) #already checked
                
                species_tasks = list(set(species_tasks))
                available_tasks = []
                for s_tid in species_tasks:
                    s_task = db.session.query(Task).get(s_tid)
                    if s_task and checkSurveyPermission(current_user.id,s_task.survey_id,'write') and (s_task.status.lower() in Config.TASK_READY_STATUSES):
                        available_tasks.append(s_task)
                    else:
                        return json.dumps('error')
                
                available_tasks.append(task)

                for s_task in available_tasks:
                    s_task.status = 'Processing'
                db.session.commit()
                task_args = {'task_id': task_id,'labelChanges': editDict,'tagChanges': tagsDict,'translationChanges': translationsDict,'deleteAutoLabels': deleteAutoLabels,'speciesChanges': speciesDict}
                GLOBALS.redisClient.set('taskEdit_'+str(task_id),json.dumps(task_args))
                handleTaskEdit.delay(task_id=task_id,labelChanges=editDict, tagChanges=tagsDict, translationChanges=translationsDict, deleteAutoLabels=deleteAutoLabels, speciesChanges=speciesDict)

            else:
                task.status='Processing'
                db.session.commit()
                task_args = {'task_id': task_id,'labelChanges': editDict,'tagChanges': tagsDict,'translationChanges': translationsDict,'deleteAutoLabels': deleteAutoLabels,'speciesChanges': None}
                GLOBALS.redisClient.set('taskEdit_'+str(task_id),json.dumps(task_args))
                handleTaskEdit.delay(task_id=task_id,labelChanges=editDict, tagChanges=tagsDict, translationChanges=translationsDict, deleteAutoLabels=deleteAutoLabels)
        else:
            return json.dumps({'status': 'error', 'message': 'An error occurred while editing the task.'})
        return json.dumps({'status': 'success'})
    except:
        return json.dumps({'status': 'error', 'message': 'An error occurred while editing the task.'})

@app.route('/submitTags/<task_id>', methods=['POST'])
@login_required
def submitTags(task_id):
    '''Handles the submission of tags for the specified task. Returns success/error status and then launches task.'''
    
    if Config.DEBUGGING: app.logger.info('Received tags for task {}'.format(task_id))
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)

    # if task and (task.survey.user_id==current_user.id):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
        try:
            deletedTags = ast.literal_eval(request.form['deletedTags'])
            editedTags = ast.literal_eval(request.form['editedTags'])
            newTags = ast.literal_eval(request.form['newTags'])

            for deleted in deletedTags:
                tag = db.session.query(Tag).get(deleted)
                if tag and (tag.task_id==task_id):
                    tag.individuals = []
                    tag.clusters = []
                    db.session.delete(tag)

            for edited in editedTags:
                tag = db.session.query(Tag).get(edited[0])
                if tag and (tag.task_id==task_id):
                    tag.description = edited[1]
                    tag.hotkey = edited[2]

            for new in newTags:
                tag = Tag(description=new[0], hotkey=new[1], task_id=task_id)
                db.session.add(tag)

            task.status = 'PENDING'
            task.is_bounding = False
            task.survey.status = 'Launched'
            db.session.commit()

            app.logger.info('Calling launch_task for task {}'.format(task_id))
            if '-4' in task.tagging_level or '-5' in task.tagging_level:
                restore_images_for_id.apply_async(kwargs={'task_id':task.id,'days':Config.ID_RESTORE_DAYS,'tier':Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})
            elif '-7' in task.tagging_level:
                restore_empty_zips.apply_async(kwargs={'task_id':task.id,'tier':Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})
            else:
                launch_task.apply_async(kwargs={'task_id':task.id})

            return json.dumps({'status': 'success'})
        except:
            return json.dumps({'status': 'error'})
    return json.dumps({'status': 'error'})

@app.route('/editSightings/<image_id>/<task_id>', methods=['POST'])
@login_required
def editSightings(image_id,task_id):
    '''Handles the editing of bounding boxes on the specified image, and labels for the associated labelgroup for the given task.'''

    detDbIDs = {}
    if current_user.admin == False:    
        task_id = current_user.turkcode[0].task_id

    task = db.session.query(Task).get(int(task_id))
    num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()

    if task != None:
        num2 = task.size + task.test_size
    else:
        num2 = 1

    if str(image_id) != '-99':
        image = db.session.query(Image).get(int(image_id))

        # if image and ((current_user.parent in image.camera.trapgroup.survey.user.workers) or (current_user.parent == image.camera.trapgroup.survey.user)):
        if image and (checkAnnotationPermission(current_user.parent_id,task_id)):
            cluster = db.session.query(Cluster).filter(Cluster.task_id==int(task_id)).filter(Cluster.images.contains(image)).first()
            detectionsDict = ast.literal_eval(request.form['detections'])

            if Config.DEBUGGING:
                app.logger.info('{} detections Submitted:'.format(len(detectionsDict)))
                for detID in detectionsDict:
                    app.logger.info('{}: {}'.format(detID,detectionsDict[detID]))

            if (current_user.admin) or (GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
                num_clusters = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
                if (num_clusters < task.size) or (current_user.admin == True):

                    detections = db.session.query(Detection).filter(Detection.image_id==int(image_id)).all()
                    to_remove = []
                    for detection in detections:
                        if str(detection.id) not in detectionsDict.keys():
                            to_remove.append(detection)

                    for detection in to_remove:
                        detection.status = 'deleted'
                        labelgroups = db.session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).all()
                        for labelgroup in labelgroups:
                            labelgroup.checked = True

                    for detID in detectionsDict:

                        if detectionsDict[detID]['label'] in ['Vehicles/Humans/Livestock','Unknown','Nothing']:
                            label = db.session.query(Label).filter(Label.description==detectionsDict[detID]['label']).first()
                        else:
                            label = db.session.query(Label).filter(Label.task_id==int(task_id)).filter(Label.description==detectionsDict[detID]['label']).first()
                            
                        if label:
                            if 'n' in detID:
                                # Add new detection
                                detection = Detection(
                                    top=max(0.0, min(1.0, float(detectionsDict[detID]['top']))),
                                    bottom=max(0.0, min(1.0, float(detectionsDict[detID]['bottom']))),
                                    left=max(0.0, min(1.0, float(detectionsDict[detID]['left']))),
                                    right=max(0.0, min(1.0, float(detectionsDict[detID]['right']))),
                                    score=1,
                                    static=False,
                                    image_id=int(image_id),
                                    category=1,
                                    source='user',
                                    status='added',
                                    classification='nothing'
                                )
                                db.session.add(detection)

                                for tempTask in task.survey.tasks:
                                    labelgroup = Labelgroup(task_id=tempTask.id, detection=detection, checked=True)
                                    db.session.add(labelgroup)
                                    tempCluster = db.session.query(Cluster).filter(Cluster.images.contains(image)).filter(Cluster.task==tempTask).first()
                                    labelgroup.labels = tempCluster.labels

                                labelgroup.labels = [label]
                                labelgroup.tags = cluster.tags

                                #new detection needs a new classification - user generated is probably correct. Will use that.
                                translation = db.session.query(Translation)\
                                                        .filter(Translation.task_id==int(task_id))\
                                                        .filter(Translation.label_id==label.id)\
                                                        .first()

                                if translation:
                                    detection.classification = translation.classification
                                else:
                                    detection.classification = 'nothing'

                                if image.zip_id:
                                    # Empty image getting a detection needs to be copied to the raw folder as well as the other images in the cluster
                                    for img in cluster.images:
                                        img.zip_id = None
                                        image_key = img.camera.path + '/' + img.filename
                                        splits = image_key.split('/')
                                        splits[0] = splits[0] + '-comp'
                                        comp_key = '/'.join(splits)
                                        if Config.DEBUGGING: app.logger.info('Copying {} to {}'.format(image_key,comp_key))
                                        GLOBALS.s3client.copy_object(Bucket=Config.BUCKET, CopySource={'Bucket': Config.BUCKET, 'Key': comp_key}, Key=image_key, StorageClass='DEEP_ARCHIVE')

                                db.session.commit()
                                detDbIDs[detID] = detection.id
                            else:
                                # edit old detection
                                detection = db.session.query(Detection).get(int(detID))
                                detection.top = max(0.0, min(1.0, float(detectionsDict[detID]['top'])))
                                detection.bottom = max(0.0, min(1.0, float(detectionsDict[detID]['bottom'])))
                                detection.left = max(0.0, min(1.0, float(detectionsDict[detID]['left'])))
                                detection.right = max(0.0, min(1.0, float(detectionsDict[detID]['right'])))
                                detection.source='user'
                                detection.status = 'edited'
                                labelgroup = db.session.query(Labelgroup).filter(Labelgroup.detection_id==int(detID)).filter(Labelgroup.task_id==int(task_id)).first()
                                labelgroup.labels = [label]
                                labelgroup.checked = True

                    image.detection_rating = detection_rating(image)
                    db.session.commit()

                clusterDetections = db.session.query(Labelgroup) \
                                            .join(Detection) \
                                            .join(Image) \
                                            .filter(Image.clusters.contains(cluster)) \
                                            .filter(Labelgroup.task_id==int(task_id)) \
                                            .filter(Labelgroup.checked==False) \
                                            .filter(Detection.static==False) \
                                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                            .first()

                if clusterDetections == None:
                    # num += 1

                    detectionLabels = db.session.query(Label) \
                                                .join(Labelgroup, Label.labelgroups) \
                                                .join(Detection) \
                                                .join(Image) \
                                                .filter(Image.clusters.contains(cluster)) \
                                                .filter(Labelgroup.task_id==int(task_id)) \
                                                .filter(Labelgroup.checked==True) \
                                                .filter(Detection.static==False) \
                                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                                .distinct(Label.id).all()
                                            
                    cluster.labels = detectionLabels
                    cluster.user_id = current_user.id
                    cluster.examined = True
                    cluster.timestamp = datetime.utcnow()
                    db.session.commit()
        else:
            return {'redirect': url_for('done')}, 278

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return json.dumps({'detIDs':detDbIDs,'progress':(num, num2)})

@app.route('/done')
@login_required
def done():
    '''Wraps up the current annotation batch. Logs user back into their parent account, and redirects them back to the jobs page.'''

    if (current_user.admin == True) or (current_user.parent_id==None):
        return redirect(url_for('jobs'))

    # already finished
    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        admin_user = current_user.parent
        logout_user()
        login_user(admin_user)
        return redirect(url_for('jobs'))

    turkcode = current_user.turkcode[0]
    task_id = turkcode.task_id
    task = turkcode.task

    # Add time
    turkcode.tagging_time = int((datetime.utcnow() - turkcode.assigned).total_seconds())

    # if ('-4' in task.tagging_level) and (task.survey.status=='indprocessing'):
        # calculate_individual_similarities.delay(task_id=task_id,species=re.split(',',task.tagging_level)[1],user_ids=[current_user.id])
    if '-5' in task.tagging_level:
        #flush allocations
        userIndividuals = [int(r.decode()) for r in GLOBALS.redisClient.lrange('user_individuals_'+str(current_user.id),0,-1)]
        for userIndividual in userIndividuals:
            GLOBALS.redisClient.srem('active_individuals_'+str(task_id),userIndividual)
        GLOBALS.redisClient.delete('user_individuals_'+str(current_user.id))

        userIndSims = [int(r.decode()) for r in GLOBALS.redisClient.lrange('user_indsims_'+str(current_user.id),0,-1)]
        for userIndSim in userIndSims:
            GLOBALS.redisClient.srem('active_indsims_'+str(task_id),userIndSim)
        GLOBALS.redisClient.delete('user_indsims_'+str(current_user.id))

    # current_user.passed = 'cTrue'
    GLOBALS.redisClient.srem('active_jobs_'+str(task_id),turkcode.code)
    GLOBALS.redisClient.delete('clusters_allocated_'+str(current_user.id))
    turkcode.active = False

    for trapgroup in current_user.trapgroup:
        trapgroup.user_id = None
        if trapgroup.active:
            GLOBALS.redisClient.lrem('trapgroups_'+str(task.survey_id),0,trapgroup.id)
            GLOBALS.redisClient.rpush('trapgroups_'+str(task.survey_id),trapgroup.id)

    db.session.commit()

    # GLOBALS.mutex[int(task_id)]['user'].pop(current_user.id, None)

    if current_user.parent_id:
        admin_user = current_user.parent
        logout_user()
        login_user(admin_user)
    
    return redirect(url_for('jobs'))

@app.route('/getSpeciesSelectorBySurvey/<label>')
@login_required
def getSpeciesSelectorBySurvey(label):
    '''Returns label list for populating the species selector.'''

    response = []
    task = current_user.turkcode[0].task

    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        parent_labels = db.session.query(Label).filter(Label.task_id == task.id).filter(Label.parent_id == None).all()
        
        temp = []
        for lab in parent_labels:
            temp.append((lab.id, lab.description))

        special_labels = db.session.query(Label).filter(Label.task_id == None).filter(Label.description != 'Wrong').filter(Label.description != 'Skip').all()
        for lab in special_labels:
            temp.insert(0,(lab.id, lab.description))

        temp.insert(0,(0, 'All'))
        response.append(temp)

        if int(label) != 0:
            root_label = db.session.query(Label).get(int(label))
            nextlab = root_label
            while nextlab.parent_id != None:        
                fellow_labels = db.session.query(Label).filter(Label.task_id==task.id).filter(Label.parent_id == nextlab.parent_id).all()

                temp = []
                for lab in fellow_labels:
                    temp.append((lab.id, lab.description))
                temp.insert(0,(nextlab.parent_id, 'All'))
                response.insert(1, temp)
                nextlab = db.session.query(Label).get(lab.parent_id)

            children = db.session.query(Label).filter(Label.parent_id == root_label.id).filter(Label.task_id==task.id).all()
            if children != []:
                temp = []
                for lab in children:
                    temp.append((lab.id, lab.description))
                temp.insert(0,(root_label.id, 'All'))
                response.append(temp)

    return json.dumps(response)

@app.route('/populateTagSelector')
@login_required
def populateTagSelector():
    '''Returns tag list for populating the tag selector.'''

    response = []
    task = current_user.turkcode[0].task
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        tags = db.session.query(Tag).filter(Tag.task_id == task.id).all()
        response.append((0, 'All'))
        for tag in tags:
            response.append((tag.id, tag.description))

    return json.dumps(response)

@app.route('/getLabelHierarchy/<task_id>')
@login_required
def getLabelHierarchy(task_id):
    '''Returns the label hierarchy for the given task.'''
    
    reply = {}
    if current_user.admin == False:    
        task_id = current_user.turkcode[0].task_id
    
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)
    # if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user)):
    if task and (checkAnnotationPermission(current_user.parent_id,task.id)):
        parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).all()
        parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
        parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
        reply = addChildToDict(parentLabels,reply,task_id)
    return json.dumps(reply)

@app.route('/getTaggingLevels')
@login_required
def getTaggingLevels():
    '''Returns the tagging levels for the task allocated to the current user.'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    parent_labels = []
    task = current_user.turkcode[0].task
    # if task and ((current_user==task.survey.user) or (current_user.parent == task.survey.user) or (current_user.parent in task.survey.user.workers)):
    if task and (checkSurveyPermission(current_user.id,task.survey_id,'read') or checkAnnotationPermission(current_user.parent_id,task.id)):
        parent_labels = db.session.query(Label.id,Label.description).filter(Label.task_id==task.id).filter(Label.children.any()).all()
        parent_labels.append((GLOBALS.vhl_id,'Vehicles/Humans/Livestock'))
        # parent_labels.insert(0,(0, 'All Children Categories'))
        parent_labels.insert(0,(-1, 'All Parent Categories'))
        if '-3' not in task.tagging_level: parent_labels.insert(0,(-2, 'Informational Tags'))

    return json.dumps(parent_labels)

@app.route('/generateExcel/<selectedTask>')
@login_required
def generateExcel(selectedTask):
    '''Requests an Excel-summary of the specified task. Prepares file, and saves it locally for later download. Returns success/error status.'''
    
    task = db.session.query(Task).get(selectedTask)

    # if (task == None) or (task.survey.user != current_user):
    if (task == None) or (not checkSurveyPermission(current_user.id,task.survey_id,'read')):
        return json.dumps({'status':'error',  'message': None})

    # fileName = task.survey.user.folder+'/docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.xlsx'
    # fileName = task.survey.organisation.folder+'/docs/'+task.survey.organisation.name+'_'+current_user.username+'_'+task.survey.name+'_'+task.name+'.xlsx'

    # # Delete old file if exists
    # try:
    #     GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName)
    # except:
    #     pass

    # Check if already requested
    check = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==selectedTask).filter(DownloadRequest.user_id==current_user.id).filter(DownloadRequest.type=='excel').filter(DownloadRequest.status=='Pending').first()
    if check:
        return json.dumps({'status':'error',  'message': 'A download request for this task is already pending. Please wait for the previous request to complete.'})
    
    # Create Download request
    download_request = DownloadRequest(type='excel', user_id=current_user.id, task_id=selectedTask, status='Pending', timestamp=None)
    db.session.add(download_request)
    db.session.commit()

    app.logger.info('Calling generate_excel')
    response = generate_excel.delay(task_id=int(selectedTask), user_name=current_user.username, download_id=download_request.id)

    download_request.celery_id = response.id
    db.session.commit()

    return json.dumps({'status':'success', 'message': None})

@app.route('/generateCSV', methods=['POST'])
@login_required
def generateCSV():
    '''Requests the generation of a csv file for later download with the specified columns and rows. Returns success/error status.'''

    try:
        if 'preformatted' in request.form:
            # The pre formatted csv
            selectedTasks = [int(ast.literal_eval(request.form['preformatted']))]
            level = 'Image'
            columns = ['Site Name', 'Latitude', 'Longitude', 'Timestamp', 'Species', 'Sighting Count', 'Image URL']
            custom_columns = {str(selectedTasks[0]):{}}
            label_type = 'list'
            includes = []
            excludes = []
            start_date = None
            end_date = None
            column_translations = {}

        else:
            selectedTasks = [int(r) for r in ast.literal_eval(request.form['selectedTasks'])]
            level = ast.literal_eval(request.form['level'])
            columns = ast.literal_eval(request.form['columns'])
            custom_columns = ast.literal_eval(request.form['custom_columns'])
            label_type = ast.literal_eval(request.form['label_type'])
            includes = ast.literal_eval(request.form['includes'])
            excludes = ast.literal_eval(request.form['excludes'])
            start_date = ast.literal_eval(request.form['start_date'])
            if start_date == '': start_date = None
            end_date = ast.literal_eval(request.form['end_date'])
            if end_date == '': end_date = None
            column_translations = ast.literal_eval(request.form['column_translations'])

    except:
        return json.dumps({'status':'error',  'message': None})

    for selectedTask in selectedTasks:
        task = db.session.query(Task).get(selectedTask)

        if (task == None) or (not checkSurveyPermission(current_user.id,task.survey_id,'read')):
            return json.dumps({'status':'error',  'message': None})

        if start_date:
            check_start = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Image.timestamp>start_date).first()
            if check_start==None: return json.dumps({'status':'error',  'message':'The date range specified is outside the survey. Please select a date range within the survey.'})
        
        if end_date:
            check_end = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(Image.timestamp<end_date).first()
            if check_end==None: return json.dumps({'status':'error',  'message':'The date range specified is outside the survey. Please select a date range within the survey.'})

    check = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==selectedTasks[0]).filter(DownloadRequest.user_id==current_user.id).filter(DownloadRequest.type=='csv').filter(DownloadRequest.status=='Pending').first()
    if check: return json.dumps({'status':'error',  'message': 'You already have a csv being generated for this annotation set.'})

    # Create Download request
    download_request = DownloadRequest(type='csv', user_id=current_user.id, task_id=selectedTasks[0], status='Pending', timestamp=None)
    db.session.add(download_request)
    db.session.commit()

    app.logger.info('Calling generate_csv_parent: {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}'.format(selectedTasks, level, columns, custom_columns, label_type, includes, excludes, start_date, end_date, column_translations,current_user.username))
    response = generate_csv_parent.apply_async(kwargs={'selectedTasks':selectedTasks, 'selectedLevel':level, 'requestedColumns':columns, 'custom_columns':custom_columns, 'label_type':label_type, 'includes':includes, 'excludes':excludes, 'startDate':start_date, 'endDate':end_date, 'column_translations': column_translations, 'user_name': current_user.username, 'download_id': download_request.id}, queue='default')

    download_request.celery_id = response.id
    db.session.commit()

    return json.dumps({'status':'success', 'message': None})

@app.route('/generateCOCO', methods=['POST'])
@login_required
def generateCOCO():
    '''Requests the generation of a COCO file for later download.'''

    task_id = request.form['task_id']
    task = db.session.query(Task).get(task_id)

    # if (task == None) or (task.survey.user != current_user):
    if (task == None) or (not checkSurveyPermission(current_user.id,task.survey_id,'read')):
        return json.dumps({'status':'error',  'message': None})

    # fileName = task.survey.user.folder+'/docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.json'
    # fileName = task.survey.organisation.folder+'/docs/'+task.survey.organisation.name+'_'+current_user.username+'_'+task.survey.name+'_'+task.name+'.json'

    # # Delete old file if exists
    # try:
    #     GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName)
    # except:
    #     pass

    check = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==task_id).filter(DownloadRequest.user_id==current_user.id).filter(DownloadRequest.type=='coco').filter(DownloadRequest.status=='Pending').first()
    if check:
        return json.dumps({'status':'error',  'message': 'A download request for this task is already pending. Please wait for the previous request to complete.'})

    # Create Download request
    download_request = DownloadRequest(type='coco', user_id=current_user.id, task_id=task_id, status='Pending', timestamp=None)
    db.session.add(download_request)
    db.session.commit()

    response = generate_coco.delay(task_id=task_id, user_name=current_user.username, download_id=download_request.id)

    download_request.celery_id = response.id
    db.session.commit()

    return json.dumps({'status':'success', 'message': None})

@app.route('/getCSVinfo')
@login_required
def getCSVinfo():
    '''Returns the csv options.'''
    return json.dumps({'CSV_INFO': Config.CSV_INFO, 'CSV_DISALLOWED_GLOBALS': Config.CSV_DISALLOWED_GLOBALS})

@app.route('/getSpeciesandIDs/<task_id>', methods=['POST','GET'])
@login_required
def getSpeciesandIDs(task_id):
    '''Returns ordered lists of label names and IDs for a specified task.'''

    if int(task_id) == 0:
        try:
            tasks = ast.literal_eval(request.form['selectedTasks'])
        except:
            return json.dumps('Error')
    else:
        tasks = [int(task_id)]

    final_names = ['All']
    final_ids = [0]
    for task_id in tasks:
        task = db.session.query(Task).get(task_id)
        # if task and (task.survey.user==current_user):
        if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
            names = []
            ids = []
            parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).order_by(Label.description).all()
            parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
            parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))

            for label in parentLabels:
                names.append(label.description)
                ids.append(label.id)
                labelChildren = db.session.query(Label).filter(Label.parent==label).filter(Label.task==task).first()
                if labelChildren:
                    names, ids = addChildLabels(names,ids,label,int(task_id))

            for n in range(len(names)):
                if names[n] not in final_names:
                    final_names.append(names[n])
                    final_ids.append(ids[n])

    return json.dumps({'names':final_names,'ids':final_ids})

@app.route('/checkDownload/<fileType>/<selectedTask>')
@login_required
def checkDownload(fileType,selectedTask):
    '''Checks if the specified download is ready, based on the file type and task ID. Returns 'ready' when download can be initialised.'''

    task = db.session.query(Task).get(selectedTask)

    # if (task == None) or (task.survey.user != current_user):
    if (task == None) or (not checkSurveyPermission(current_user.id,task.survey_id,'read')):
        return json.dumps('error')

    # fileName = task.survey.user.folder+'/docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name
    fileName = task.survey.organisation.folder+'/docs/'+task.survey.organisation.name+'_'+current_user.username+'_'+task.survey.name+'_'+task.name
    if fileType == 'csv':
        fileName += '.csv'
    elif fileType == 'excel':
        fileName += '.xlsx'
    elif fileType == 'export':
        fileName += '.zip'
    elif fileType == 'coco':
        fileName += '.json'

    try:
        check = GLOBALS.s3client.head_object(Bucket=Config.BUCKET,Key=fileName)
        # deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=3600)
        return json.dumps('https://'+Config.BUCKET+'.s3.amazonaws.com/'+fileName.replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'))
    except:
        # file does not exist
        return json.dumps('not ready yet')

# @app.route('/Download/<fileType>/<selectedTask>')
# @login_required
# def Download(fileType,selectedTask):
#     '''Initiates the download of the specified file type for the given task.'''
    
#     task = db.session.query(Task).get(selectedTask)

#     if (task == None) or (task.survey.user != current_user):
#         return json.dumps('error')

#     fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name
#     filename = task.survey.name+'_'+task.name
#     if fileType == 'csv':
#         fileName += '.csv'
#         filename += '.csv'
#     elif fileType == 'excel':
#         fileName += '.xlsx'
#         filename += '.xlsx'
#     elif fileType == 'export':
#         fileName += '.zip'
#         filename += '.zip'
#     elif fileType == 'coco':
#         fileName += '.json'
#         filename += '.json'

#     if os.path.isfile(fileName):
#         deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=600)
#         return send_file('../'+fileName,
#                         attachment_filename=filename,
#                         as_attachment=True,
#                         cache_timeout=-1)
#     else:
#         return json.dumps('error')

@app.route('/undoknockdown/<imageId>/<clusterId>/<label>')
@login_required
def undoknockdown(imageId, clusterId, label):
    '''Undoes the knock-down categorisation of the specified image. The cluster label is replaced with the supplied label.'''

    image = db.session.query(Image).get(int(imageId))
    task = current_user.turkcode[0].task
    # if image and (image.corrected_timestamp) and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user) or (current_user==task.survey.user)) and (task.survey_id == image.camera.trapgroup.survey_id):
    if image and (image.corrected_timestamp) and (checkAnnotationPermission(current_user.parent_id,task.id) or checkSurveyPermission(current_user.id,task.survey_id,'write')) and (task.survey_id == image.camera.trapgroup.survey_id):
        app.logger.info(str(clusterId) + ' undo knock down.')

        db.session.commit()

        if image.camera.trapgroup.processing:
            image.camera.trapgroup.queueing = True
            db.session.commit()
        else:
            image.camera.trapgroup.processing = True
            image.camera.trapgroup.active = False
            image.camera.trapgroup.user_id = None
            db.session.commit()
            app.logger.info('Unknocking cluster for image {}'.format(imageId))
            unknock_cluster.apply_async(kwargs={'image_id':int(imageId), 'label_id':label, 'user_id':current_user.id, 'task_id':current_user.turkcode[0].task_id})
    
    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return ""

@app.route('/knockdown/<imageId>/<clusterId>')
@login_required
def knockdown(imageId, clusterId):
    '''Marks the camera of the specified image as marked down by moving all images to a knocked-down cluster.'''
    
    app.logger.info('Knockdown initiated for image {}'.format(imageId))

    #Check if they have permission to work on this survey
    image = db.session.query(Image).get(imageId)
    # if not (image and ((current_user == image.camera.trapgroup.survey.user) or (current_user.parent in image.camera.trapgroup.survey.user.workers) or (current_user.parent == image.camera.trapgroup.survey.user))):
    if not (image and (checkSurveyPermission(current_user.id,image.camera.trapgroup.survey_id,'write') or checkAnnotationPermission(current_user.parent_id,current_user.turkcode[0].task.id))):
        return {'redirect': url_for('done')}, 278

    taggingLevel = current_user.turkcode[0].task.tagging_level

    if (taggingLevel == '-1') or (taggingLevel == '0'):   
        #Check if image has already been marked knocked down, if so, ignore
        anImage = db.session.query(Image).get(int(imageId))
        aCluster = db.session.query(Cluster).get(int(clusterId))

        if (aCluster == None) or (aCluster.images == []):
            return ""

        task_id = aCluster.task_id

        rootImage = db.session.query(Image) \
                            .join(Camera)\
                            .filter(Image.clusters.contains(aCluster)) \
                            .filter(Camera.cameragroup_id == anImage.camera.cameragroup_id) \
                            .order_by(Image.corrected_timestamp) \
                            .first()
        
        reclusteringTimestamp = db.session.query(Image.corrected_timestamp) \
                            .filter(Image.clusters.contains(aCluster)) \
                            .order_by(Image.corrected_timestamp) \
                            .first()[0]

        #Check if it is a set-up image
        trapgroup = db.session.query(Trapgroup) \
                        .join(Camera) \
                        .join(Image) \
                        .filter(Image.id == imageId).first()

        first_im = db.session.query(Image) \
                        .join(Camera) \
                        .join(Trapgroup) \
                        .filter(Trapgroup.id == trapgroup.id) \
                        .order_by(Image.corrected_timestamp) \
                        .first()

        last_im = db.session.query(Image) \
                        .join(Camera) \
                        .join(Trapgroup) \
                        .filter(Trapgroup.id == trapgroup.id) \
                        .order_by(desc(Image.corrected_timestamp)) \
                        .first()

        if (rootImage.corrected_timestamp==None) or (first_im.corrected_timestamp==None) or ((rootImage.corrected_timestamp - first_im.corrected_timestamp) < timedelta(hours=1)):
            #Still setting up
            if Config.DEBUGGING: app.logger.info('Still setting up.')
            if (current_user.admin) or (GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
                num_clusters = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
                if (num_clusters < aCluster.task.size) or (current_user.admin == True):

                    newLabel = db.session.query(Label).get(GLOBALS.nothing_id)
                    cluster = db.session.query(Cluster).get(int(clusterId))
                    cluster.labels = [newLabel]
                    cluster.user_id = current_user.id
                    cluster.timestamp = datetime.utcnow()
                    cluster.examined = True

                    # Copy labels over to labelgroups
                    labelgroups = db.session.query(Labelgroup) \
                                            .join(Detection) \
                                            .join(Image) \
                                            .filter(Image.clusters.contains(cluster)) \
                                            .filter(Labelgroup.task_id==cluster.task_id) \
                                            .distinct(Labelgroup.id).all()

                    for labelgroup in labelgroups:
                        labelgroup.labels = cluster.labels

                    db.session.commit()

        else:
            if Config.DEBUGGING: app.logger.info('It is really knocked down.')
            num_cluster = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()

            if (num_cluster < db.session.query(Task).get(task_id).size) or (current_user.admin == True):
                #if it is really knocked down
                app.logger.info(aCluster.task.survey.name + ': ' + aCluster.task.name + ' ' + str(clusterId) + ' knocked down.')

                #Check if already knocked down
                downLabel =  db.session.query(Label).get(GLOBALS.knocked_id)

                check = db.session.query(Cluster) \
                                .filter(Cluster.task_id == task_id) \
                                .filter(Cluster.labels.contains(downLabel)) \
                                .filter(Cluster.images.contains(rootImage)) \
                                .count()

                if (check > 0):
                    return ""

                if GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id))==None: GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),0)

                GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),num_cluster)
                db.session.commit()

                if trapgroup.processing:
                    trapgroup.queueing = True
                    db.session.commit()
                else:
                    trapgroup.processing = True
                    trapgroup.active = False
                    trapgroup.user_id = None
                    db.session.commit()
                    finish_knockdown.apply_async(kwargs={'rootImageID':rootImage.id, 'task':task_id, 'current_user_id':current_user.id, 'reclusteringTimestamp':reclusteringTimestamp})

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return ""

@app.route('/getHelp')
@login_required
def getHelp():
    '''Returns the request help information.'''

    helpRequired = request.args.get('req', None)
    if helpRequired:
        return json.dumps(render_template('help/'+helpRequired+'.html'))
    else:
        return json.dumps('Error')

# @app.route('/uploadImageToCloud', methods=['POST'])
# @login_required
# def uploadImageToCloud():
#     '''
#     Uploads the sent image to AWS S3 on behalf of the user to enure they only access their own folder.
#     '''

#     if current_user.admin:

#         if 'surveyName' in request.form:
#             surveyName = request.form['surveyName']
#         else:
#             surveyName = None
        
#         if surveyName and ('image' in request.files):
#             uploaded_file = request.files['image']
#             key = current_user.folder + '/' + surveyName + '/' + uploaded_file.filename
            
#             temp_file = BytesIO()
#             uploaded_file.save(temp_file)
#             temp_file.seek(0)
#             response = GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)
#             hash = response['ETag'][1:-1]
            
#             return json.dumps({'status': 'success', 'hash': hash})

#     return json.dumps({'status': 'error'})

@app.route('/checkNotifications', methods=['POST'])
@login_required
def checkNotifications():
    '''Checks if there are any new global notifications for the user.'''

    allow_global = request.args.get('allow_global', 'true', type=str)
    
    total_unseen = 0
    global_notification = None
    notifcation_contents = {}
    status = 'error'
    if current_user and current_user.is_authenticated and current_user.parent_id == None:
        global_seen_sq = db.session.query(userNotifications.c.notification_id.label('global_notification_id'))\
                            .filter(userNotifications.c.user_id==current_user.id)\
                            .subquery()

        notifications = db.session.query(Notification)\
                    .outerjoin(global_seen_sq, global_seen_sq.c.global_notification_id==Notification.id)\
                    .filter(or_(Notification.user_id==current_user.id, Notification.user_id==None))\
                    .filter(or_(Notification.expires==None,Notification.expires>datetime.utcnow()))\
                    .filter(or_(Notification.seen==None,Notification.seen==False))\
                    .filter(global_seen_sq.c.global_notification_id==None)\
                    .order_by(desc(Notification.id))\
                    .all()

        for notification in notifications:
            seen_notif = False
            if notification.user_id == None:
                if current_user in notification.users_seen:
                    seen_notif = True
                else:
                    seen_notif = False
                    global_notification = notification
            else:
                if notification.seen == None:
                    seen_notif = False
                else:
                    seen_notif = notification.seen

            if seen_notif == False:
                total_unseen += 1

        if global_notification and (allow_global=='true'):
            has_seen = db.session.query(userNotifications).filter(userNotifications.c.notification_id==global_notification.id).filter(userNotifications.c.user_id==current_user.id).first()
            if not has_seen:
                global_notification.users_seen.append(current_user)
                db.session.commit()

                notifcation_contents = {
                    'id': global_notification.id,
                    'contents': global_notification.contents,
                }

        status = 'success'
    
    return json.dumps({'status':status,'total_unseen':total_unseen,'global_notification':notifcation_contents})

@app.route('/dashboard')
@login_required
def dashboard():
    '''Renders dashboard where the stats of the platform can be explored.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.username=='Dashboard':
            organisations = db.session.query(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).distinct().all()
            users = db.session.query(User).filter(~User.username.in_(Config.ADMIN_USERS)).filter(User.admin==True).distinct().all()
            image_count=int(db.session.query(func.sum(Survey.image_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])
            video_count=int(db.session.query(func.sum(Survey.video_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])
            frame_count=int(db.session.query(func.sum(Survey.frame_count)).join(Organisation).filter(~Organisation.name.in_(Config.ADMIN_USERS)).first()[0])
            
            sq = db.session.query(Organisation.id.label('organisation_id'),func.sum(Survey.image_count).label('image_count'),func.sum(Survey.frame_count).label('frame_count')).join(Survey).group_by(Organisation.id).subquery()
            active_organisations = db.session.query(Organisation)\
                                    .join(Survey)\
                                    .join(Task)\
                                    .join(sq,sq.c.organisation_id==Organisation.id)\
                                    .filter(Task.init_complete==True)\
                                    .filter((sq.c.image_count+sq.c.frame_count)>10000)\
                                    .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                    .distinct().count()
            
            latest_statistic = db.session.query(Statistic).filter(Statistic.user_count!=None).order_by(Statistic.timestamp.desc()).first()
            users_added_this_month = len(users)-latest_statistic.user_count
            organisations_added_this_month = len(organisations)-latest_statistic.organisation_count
            images_imported_this_month = image_count-latest_statistic.image_count
            videos_imported_this_month = video_count-latest_statistic.video_count
            frames_imported_this_month = frame_count-latest_statistic.frame_count
            active_organisations_this_month = active_organisations-latest_statistic.active_organisation_count

            image_count = str(round((image_count/1000000),2))+'M'
            video_count = str(round((video_count/1000),2))+'k'
            frame_count = str(round((frame_count/1000000),2))+'M'
            images_imported_this_month = str(round((images_imported_this_month/1000000),2))+'M'
            videos_imported_this_month = str(round((videos_imported_this_month/1000),2))+'k'
            frames_imported_this_month = str(round((frames_imported_this_month/1000000),2))+'M'
            
            startDate = datetime.utcnow().replace(day=1,hour=0,minute=0,second=0,microsecond=0)
            endDate = datetime.utcnow()+timedelta(days=1)
            costs = get_AWS_costs(startDate,endDate)

            unique_logins_24h = db.session.query(User).filter(User.last_ping>datetime.utcnow()-timedelta(days=1)).filter(User.email!=None).filter(~User.username.in_(Config.ADMIN_USERS)).count()
            unique_admin_logins_24h = db.session.query(User).filter(User.last_ping>datetime.utcnow()-timedelta(days=1)).filter(User.admin==True).filter(~User.username.in_(Config.ADMIN_USERS)).count()
            unique_organisation_logins_24h = db.session.query(Organisation)\
                                                .join(UserPermissions)\
                                                .join(User,UserPermissions.user_id==User.id)\
                                                .filter(User.last_ping>datetime.utcnow()-timedelta(days=1))\
                                                .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                .filter(UserPermissions.default!='worker').count()
            
            unique_logins_this_month = db.session.query(User).filter(User.last_ping>startDate).filter(User.email!=None).filter(~User.username.in_(Config.ADMIN_USERS)).count()
            unique_admin_logins_this_month = db.session.query(User).filter(User.last_ping>startDate).filter(User.admin==True).filter(~User.username.in_(Config.ADMIN_USERS)).count()
            unique_organisation_logins_this_month = db.session.query(Organisation)\
                                                .join(UserPermissions)\
                                                .join(User,UserPermissions.user_id==User.id)\
                                                .filter(User.last_ping>startDate)\
                                                .filter(~Organisation.name.in_(Config.ADMIN_USERS))\
                                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                                .filter(UserPermissions.default!='worker').count()

            # Need to add an hour to the start date so as to not grab the first statistic of the month which covers the last day of the previous month
            try:
                average_logins, average_admin_logins, average_organisation_logins = db.session.query(\
                                    func.sum(Statistic.unique_daily_logins)/func.count(Statistic.id),\
                                    func.sum(Statistic.unique_daily_admin_logins)/func.count(Statistic.id),\
                                    func.sum(Statistic.unique_daily_organisation_logins)/func.count(Statistic.id))\
                                    .filter(Statistic.timestamp>(startDate+timedelta(hours=1))).first()
                average_logins = round(float(average_logins),2)
                average_admin_logins = round(float(average_admin_logins),2)
                average_organisation_logins = round(float(average_organisation_logins),2)
            except:
                average_logins = 0
                average_admin_logins = 0
                average_organisation_logins = 0

            factor = monthrange(datetime.utcnow().year,datetime.utcnow().month)[1]/datetime.utcnow().day
            
            return render_template('html/dashboard.html', title='Dashboard', helpFile='dashboard',
                        version=Config.VERSION,
                        user_count = len(users),
                        organisation_count = len(organisations),
                        image_count = image_count,
                        video_count = video_count,
                        frame_count = frame_count,
                        users_added_this_month = users_added_this_month,
                        images_imported_this_month = images_imported_this_month,
                        videos_imported_this_month = videos_imported_this_month,
                        frames_imported_this_month = frames_imported_this_month,
                        active_organisations_this_month = active_organisations_this_month,
                        active_organisations = active_organisations,
                        last_months_server_cost = latest_statistic.server_cost,
                        last_months_storage_cost = latest_statistic.storage_cost,
                        last_months_db_cost = latest_statistic.db_cost,
                        last_months_textract_cost = latest_statistic.textract_cost,
                        last_months_lambda_cost = latest_statistic.lambda_cost,
                        last_months_other_cost = latest_statistic.other_cost,
                        last_months_total_cost = latest_statistic.total_cost,
                        server_cost_this_month = costs['Amazon Elastic Compute Cloud'],
                        storage_cost_this_month = costs['Amazon Simple Storage Service'],
                        db_cost_this_month = costs['Amazon Relational Database Service'],
                        textract_cost_this_month = costs['Amazon Textract'],
                        lambda_cost_this_month = costs['AWS Lambda'],
                        other_cost_this_month = costs['Other'],
                        total_cost_this_month = costs['Total'],
                        server_estimate = round(factor*costs['Amazon Elastic Compute Cloud'],2),
                        storage_estimate = round(factor*costs['Amazon Simple Storage Service'],2),
                        db_estimate = round(factor*costs['Amazon Relational Database Service'],2),
                        textract_estimate = round(factor*costs['Amazon Textract'],2),	
                        lambda_estimate = round(factor*costs['AWS Lambda'],2),
                        other_estimate = round(factor*costs['Other'],2),
                        total_estimate = round(factor*costs['Total'],2),
                        unique_logins_24h = unique_logins_24h,
                        unique_admin_logins_24h = unique_admin_logins_24h,
                        unique_logins_this_month = unique_logins_this_month,
                        unique_admin_logins_this_month = unique_admin_logins_this_month,
                        average_logins = average_logins,
                        average_admin_logins = average_admin_logins,
                        unique_monthly_logins = int(latest_statistic.unique_monthly_logins),
                        unique_monthly_admin_logins = int(latest_statistic.unique_monthly_admin_logins),
                        unique_monthly_organisation_logins = int(latest_statistic.unique_monthly_organisation_logins),
                        average_daily_logins = latest_statistic.average_daily_logins,
                        average_daily_admin_logins = latest_statistic.average_daily_admin_logins,
                        average_daily_organisation_logins = latest_statistic.average_daily_organisation_logins,
                        unique_organisation_logins_24h = unique_organisation_logins_24h,
                        unique_organisation_logins_this_month = unique_organisation_logins_this_month,
                        average_organisation_logins = average_organisation_logins,
                        organisations_added_this_month = organisations_added_this_month
            )
        else:
            if current_user.admin:
                redirect(url_for('surveys'))
            else:
                if current_user.parent_id == None:
                    return redirect(url_for('jobs'))
                else:
                    if current_user.turkcode[0].task.is_bounding:
                        return redirect(url_for('sightings'))
                    elif '-4' in current_user.turkcode[0].task.tagging_level:
                        return redirect(url_for('clusterID'))
                    elif '-5' in current_user.turkcode[0].task.tagging_level:
                        return redirect(url_for('individualID'))
                    else:
                        return redirect(url_for('index'))

@app.route('/getDashboardTrends', methods=['POST'])
@login_required
def getDashboardTrends():
    '''Returns the requested dashboard trends.'''
    
    if current_user.is_authenticated and (current_user.username=='Dashboard'):
        trend = request.form['trend']
        period = request.form['period']

        if trend in ['unique_daily_logins','unique_daily_admin_logins','unique_daily_organisation_logins']:
            # Daily stats
            if period=='max':
                period = 365

            statistics=list(reversed(db.session.query(Statistic).order_by(Statistic.timestamp.desc()).limit(int(period)).all()))
        
        else:
            # Monthly stats
            if period=='max':
                period = 60

            statistics=list(reversed(db.session.query(Statistic).filter(Statistic.user_count!=None).order_by(Statistic.timestamp.desc()).limit(int(period)).all()))

        data = [getattr(statistic,trend) for statistic in statistics if getattr(statistic,trend)!=None]
        labels = [statistic.timestamp.strftime("%Y/%m/%d") for statistic in statistics if getattr(statistic,trend)!=None]

        if 'cost' in trend:
            axis_label='Cost (USD)'
        elif trend=='image_count':
            axis_label='Count (millions)'
            data = [item/1000000 for item in data]
        else:
            axis_label='Count'

        return json.dumps({'status':'success','data':data,'labels':labels,'axis_label':axis_label})
    
    return json.dumps({'status':'error'})

@app.route('/getActiveUserData', methods=['POST'])
@login_required
def getActiveUserData():
    '''Returns the requested dashboard trends.'''
    
    if current_user.is_authenticated and (current_user.username=='Dashboard'):
        page = request.args.get('page', 1, type=int)
        order = request.args.get('order', 'total', type=str)
        users = request.args.get('users', 'active_users', type=str)

        sq = db.session.query(
                                Organisation.id.label('organisation_id'),
                                func.sum(Survey.image_count).label('count'),
                                func.sum(Survey.frame_count).label('frame_count'),
                                func.sum(Survey.video_count).label('video_count'),
                                (func.sum(Survey.image_count)-Organisation.image_count).label('this_month'),
                                (Organisation.image_count-Organisation.previous_image_count).label('last_month'),
                                (func.sum(Survey.video_count)-Organisation.video_count).label('videos_this_month'),
                                (Organisation.video_count-Organisation.previous_video_count).label('videos_last_month'),
                                (func.sum(Survey.frame_count)-Organisation.frame_count).label('frames_this_month'),
                                (Organisation.frame_count-Organisation.previous_frame_count).label('frames_last_month')
                            )\
                            .join(Survey)\
                            .group_by(Organisation.id).subquery()

        active_users = db.session.query(Organisation,sq.c.count,sq.c.this_month,sq.c.last_month,sq.c.videos_this_month,sq.c.videos_last_month,sq.c.frames_this_month,sq.c.frames_last_month,sq.c.frame_count,sq.c.video_count)\
                                .join(sq,sq.c.organisation_id==Organisation.id)\
                                .filter(~Organisation.name.in_(Config.ADMIN_USERS))

        if users=='active_users':
            active_users = active_users.join(Survey)\
                                .join(Task)\
                                .filter(Task.init_complete==True)\
                                .filter((sq.c.count+sq.c.frame_count)>10000)
        
        if order=='total':
            active_users = active_users.order_by(sq.c.count.desc())
        elif order=='this_month':
            active_users = active_users.order_by(sq.c.this_month.desc())
        elif order=='last_month':
            active_users = active_users.order_by(sq.c.last_month.desc())
        elif order=='videos_this_month':
            active_users = active_users.order_by(sq.c.videos_this_month.desc())
        elif order=='videos_last_month':
            active_users = active_users.order_by(sq.c.videos_last_month.desc())
        elif order=='frames_this_month':
            active_users = active_users.order_by(sq.c.frames_this_month.desc())
        elif order=='frames_last_month':
            active_users = active_users.order_by(sq.c.frames_last_month.desc())

        active_users = active_users.distinct().paginate(page, 20, False)

        reply = []
        for item in active_users.items:
            organisation = item[0]
            image_count = int(item[1])
            images_this_month = int(item[2])
            images_last_month = int(item[3])
            videos_this_month = int(item[4])
            videos_last_month = int(item[5])
            frames_this_month = int(item[6])
            frames_last_month = int(item[7])
            frame_count = int(item[8])
            video_count = int(item[9])
            # image_count=int(db.session.query(sq.c.count).filter(sq.c.user_id==user.id).first()[0])

            reply.append({
                'account':              organisation.name,
                'affiliation':          organisation.affiliation,
                'surveys':              len(organisation.surveys[:]),
                'images':               format_count(image_count),
                'videos':               format_count(video_count),
                'frames':               format_count(frame_count),
                'images_this_month':    format_count(images_this_month),
                'images_last_month':    format_count(images_last_month),
                'videos_this_month':    format_count(videos_this_month),
                'videos_last_month':    format_count(videos_last_month),
                'frames_this_month':    format_count(frames_this_month),
                'frames_last_month':    format_count(frames_last_month),
                'regions':              organisation.regions
            })

        next_url = url_for('getActiveUserData', page=active_users.next_num, order=order, users=users) if active_users.has_next else None
        prev_url = url_for('getActiveUserData', page=active_users.prev_num, order=order, users=users) if active_users.has_prev else None

        return json.dumps({'status':'success','data':reply,'next_url':next_url,'prev_url':prev_url})
    
    return json.dumps({'status':'error'})

@app.route('/getAllSites', methods=['POST'])
@login_required
def getAllSites():
    '''Returns the coordinates of all teh sites for the dashboard.'''
    
    if current_user.is_authenticated and (current_user.username=='Dashboard'):
        sites = db.session.query(Trapgroup)\
                    .filter(Trapgroup.latitude!=None)\
                    .filter(Trapgroup.longitude!=None)\
                    .filter(Trapgroup.latitude!=0)\
                    .filter(Trapgroup.longitude!=0)\
                    .distinct().all()

        reply = []
        for site in sites:
            if [site.latitude,site.longitude] not in reply:
                reply.append([site.latitude,site.longitude])

        return json.dumps({'status':'success','data':reply})
    
    return json.dumps({'status':'error'})

@app.route('/getClassifierInfo', methods=['POST'])
@login_required
def getClassifierInfo():
    '''Returns info on all available classifiers.'''
    
    data = []
    next_url = None
    prev_url = None
    if current_user.admin:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '', type=str)
        showCurrent = request.args.get('showCurrent', False, type=str)
        classifiers = db.session.query(Classifier).filter(Classifier.active==True)
        
        searches = re.split('[ ,]',search)
        for search in searches:
            classifiers = classifiers.filter(or_(Classifier.name.contains(search),
                                                Classifier.source.contains(search),
                                                Classifier.region.contains(search),
                                                Classifier.description.contains(search)))

        classifiers = classifiers.order_by(Classifier.name).distinct().paginate(page, 10, False)

        if showCurrent:
            survey = db.session.query(Survey).get(showCurrent)
            if survey.classifier:
                labels = [classification_label.classification for classification_label in survey.classifier.classification_labels if classification_label.classification not in ['nothing','unknown']]
                labels.sort()
                data.append({
                    'id':survey.classifier.id,
                    'name':survey.classifier.name,
                    'source':survey.classifier.source,
                    'region':survey.classifier.region,
                    'description':survey.classifier.description,
                    'version':survey.classifier.version,
                    'labels':', '.join(labels),
                    'active': True
                })
        
        for classifier in classifiers.items:
            if (not showCurrent) or (classifier!=survey.classifier):
                labels = [classification_label.classification for classification_label in classifier.classification_labels if classification_label.classification not in ['nothing','unknown']]
                labels.sort()
                data.append({
                    'id':classifier.id,
                    'name':classifier.name,
                    'source':classifier.source,
                    'region':classifier.region,
                    'description':classifier.description,
                    'version':classifier.version,
                    'labels':', '.join(labels),
                    'active': False
                })

        next_url = url_for('getClassifierInfo', page=classifiers.next_num, search=search) if classifiers.has_next else None
        prev_url = url_for('getClassifierInfo', page=classifiers.prev_num, search=search) if classifiers.has_prev else None

    return json.dumps({'data': data, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/fileHandler/get_presigned_url', methods=['POST'])
@login_required
def get_presigned_url():
    """Returns a presigned URL in order to upload a file directly to S3."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    if Config.DEBUGGING: print('Getting presigned URL')
    
    try:
        survey_id = request.json['survey_id']
        organisation_id, organisation_folder, survey_status = db.session.query(Organisation.id,Organisation.folder,Survey.status).join(Survey).filter(Survey.id==survey_id).first()
        if organisation_id and (survey_status=='Uploading'):
            userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.user_id==current_user.id).first()
            if userPermissions and userPermissions.create:
                if checkUploadUser(current_user.id,survey_id):
                    return  GLOBALS.s3UploadClient.generate_presigned_url(ClientMethod='put_object',
                                                                            Params={'Bucket': Config.BUCKET,
                                                                                    'Key': organisation_folder + '/' + request.json['filename'].strip('/'),
                                                                                    'ContentType': request.json['contentType'],
                                                                                    'Body' : ''},
                                                                            ExpiresIn=604800) # 7 days (the maximum)
    except:
        pass
        
    return 'error'

@app.route('/fileHandler/check_upload_files', methods=['POST'])
@login_required
def check_upload_files():
    """Checks a list of images to see if they have already been uploaded."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    try:
        files = request.json['files']
        survey_id = request.json['survey_id']
        already_uploaded = []
        require_lambda = []
        new_names = {}

        organisation_id, organisation_folder, survey_status = db.session.query(Organisation.id,Organisation.folder,Survey.status).join(Survey).filter(Survey.id==survey_id).first()
        if organisation_id and (survey_status=='Uploading'):
            userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.user_id==current_user.id).first()
            if userPermissions and userPermissions.create:
                if checkUploadUser(current_user.id,survey_id):
                    already_uploaded, require_lambda, new_names = checkFilesExist(files,organisation_folder)
                    return json.dumps((already_uploaded,require_lambda,new_names))
    except:
        pass

    return json.dumps('error')

@app.route('/fileHandler/check_upload_available', methods=['POST'])
@login_required
def check_upload_available():
    """Checks whether an upload is available for a particular task (ie. that no other user has an upload in progress for that survey)."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    try:
        survey_id = request.json['survey_id']
        organisation_id, survey_status = db.session.query(Organisation.id,Survey.status).join(Survey).filter(Survey.id==survey_id).first()
        if organisation_id and (survey_status=='Uploading'):
            userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.user_id==current_user.id).first()
            if userPermissions and userPermissions.create:
                if checkUploadUser(current_user.id,survey_id):
                    return json.dumps('available')
                else:
                    return json.dumps('unavailable')
    except:
        pass
    
    return json.dumps('error')

@app.route('/fileHandler/get_image_info', methods=['POST'])
@login_required
def get_image_info():
    """Returns the labels for the specified image or video and task."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    reply = []
    task_id = request.json['task_id']
    hash = request.json['hash']
    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())
        
        individual_sorted = request.json['individual_sorted']
        species_sorted = request.json['species_sorted']
        flat_structure = request.json['flat_structure']
        include_empties = request.json['include_empties']
        labels = request.json['species']
        include_video = request.json['include_video']
        include_frames = request.json['include_frames']
        fileName = request.json['fileName']

        if include_video and any(ext in fileName.lower() for ext in ['mp4','avi','mov']):
            video = db.session.query(Video)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey==task.survey)\
                            .filter(Video.hash==hash)\
                            .first()
            
            if video:
                video.downloaded = True
                videoPaths, videoLabels, videoTags = get_video_paths_and_labels(video,task,individual_sorted,species_sorted,flat_structure,labels,include_empties)
                videoLabels.extend(videoTags)

                for path in videoPaths:
                    reply.append({'path':'/'.join(path.split('/')[:-1]),'labels':videoLabels,'fileName':path.split('/')[-1]})

                db.session.commit()
        else:
        
            image = db.session.query(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey==task.survey)\
                            .filter(Image.hash==hash)

            if not include_frames:
                image = image.outerjoin(Video).filter(Video.id==None)
            
            image = image.first()

            if image:
                image.downloaded = True
                imagePaths, imageLabels, imageTags = get_image_paths_and_labels(image,task,individual_sorted,species_sorted,flat_structure,labels,include_empties)
                imageLabels.extend(imageTags)

                for path in imagePaths:
                    reply.append({'path':'/'.join(path.split('/')[:-1]),'labels':imageLabels,'fileName':path.split('/')[-1]})

                db.session.commit()

    return json.dumps(reply)

@app.route('/fileHandler/get_required_files', methods=['POST'])
@login_required
def get_required_files():
    """Return the required files and their labels and paths"""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    reply = []
    file_ids = []
    task_id = request.json['task_id']
    include_video = request.json['include_video']
    include_frames = request.json['include_frames']
    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())

        individual_sorted = request.json['individual_sorted']
        species_sorted = request.json['species_sorted']
        flat_structure = request.json['flat_structure']
        include_empties = request.json['include_empties']
        labels = request.json['species']
        raw_files = request.json['raw_files']

        if task.status == 'Processing':
            # Try speed things up while waiting for download to prep
            if '0' in labels:
                localLabels = [r.id for r in task.labels]
                localLabels.append(GLOBALS.vhl_id)
                localLabels.append(GLOBALS.knocked_id)
                localLabels.append(GLOBALS.unknown_id)
            else:
                localLabels = [int(r) for r in labels]

            if include_empties: localLabels.append(GLOBALS.nothing_id)
            
            # images = db.session.query(Image)\
            #                     .join(Cluster,Image.clusters)\
            #                     .join(Label,Cluster.labels)\
            #                     .join(Camera)\
            #                     .join(Trapgroup)\
            #                     .filter(Trapgroup.survey==task.survey)\
            #                     .filter(Cluster.task==task)\
            #                     .filter(Label.id.in_(localLabels))\
            #                     .filter(Image.downloaded==False)\
            #                     .distinct().limit(200).all()

            if include_video:
                videos = db.session.query(Video)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .join(Label,Labelgroup.labels)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .filter(Label.id.in_(localLabels))\
                                    .filter(Video.downloaded==False)\
                                    .distinct().limit(50).all()
                
                # NOTE: WE DO NOT KEEP EMPTY VIDEOS ANYMORE IN S3 (CAN"T BE DOWNLOADED)
                # if videos == [] and include_empties:
                #     sq = rDets(db.session.query(Image.id.label('image_id'))\
                #                         .join(Detection)\
                #                         .join(Camera)\
                #                         .join(Trapgroup)\
                #                         .filter(Trapgroup.survey==task.survey))\
                #                         .subquery()

                #     videos = db.session.query(Video)\
                #                         .join(Camera)\
                #                         .join(Image)\
                #                         .join(sq, sq.c.image_id == Image.id)\
                #                         .filter(Video.downloaded==False)\
                #                         .distinct().limit(50).all()
                                    
            else:
                if include_frames:
                    images = db.session.query(Image)\
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .join(Label,Labelgroup.labels)\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(Label.id.in_(localLabels))\
                                        .filter(Image.downloaded==False)\
                                        .distinct().limit(200).all()
                    
                    if (images==[]) and include_empties:
                        images = db.session.query(Image)\
                                        .join(Cluster,Image.clusters)\
                                        .join(Camera)\
                                        .join(Trapgroup)\
                                        .filter(Trapgroup.survey==task.survey)\
                                        .filter(Cluster.task==task)\
                                        .filter(~Labelgroup.labels.any())\
                                        .filter(Image.downloaded==False)\
                                        .distinct().limit(200).all()
                        
                        if images == []:
                            sq = rDets(db.session.query(Image.id.label('image_id'))\
                                            .join(Detection)\
                                            .join(Camera)\
                                            .join(Trapgroup)\
                                            .filter(Trapgroup.survey==task.survey))\
                                            .subquery()
                            
                            images = db.session.query(Image)\
                                            .join(Camera)\
                                            .join(Trapgroup)\
                                            .filter(Trapgroup.survey==task.survey)\
                                            .outerjoin(sq,sq.c.image_id==Image.id)\
                                            .filter(sq.c.image_id==None)\
                                            .filter(Image.downloaded==False)\
                                            .distinct().all()
                else:
                    images = db.session.query(Image)\
                                        .join(Camera)\
                                        .outerjoin(Video)\
                                        .join(Detection)\
                                        .join(Labelgroup)\
                                        .join(Label,Labelgroup.labels)\
                                        .filter(Labelgroup.task_id==task_id)\
                                        .filter(Label.id.in_(localLabels))\
                                        .filter(Image.downloaded==False)\
                                        .filter(Video.id==None)\
                                        .distinct().limit(200).all()

                    if (images==[]) and include_empties:
                        images = db.session.query(Image)\
                                        .join(Cluster,Image.clusters)\
                                        .join(Camera)\
                                        .outerjoin(Video)\
                                        .join(Trapgroup)\
                                        .filter(Trapgroup.survey==task.survey)\
                                        .filter(Cluster.task==task)\
                                        .filter(~Labelgroup.labels.any())\
                                        .filter(Image.downloaded==False)\
                                        .filter(Video.id==None)\
                                        .distinct().limit(200).all()
                        
                        if images == []:
                            sq = rDets(db.session.query(Image.id.label('image_id'))\
                                            .join(Detection)\
                                            .join(Camera)\
                                            .join(Trapgroup)\
                                            .filter(Trapgroup.survey==task.survey))\
                                            .subquery()
                            
                            images = db.session.query(Image)\
                                            .join(Camera)\
                                            .outerjoin(Video)\
                                            .join(Trapgroup)\
                                            .filter(Trapgroup.survey==task.survey)\
                                            .outerjoin(sq,sq.c.image_id==Image.id)\
                                            .filter(sq.c.image_id==None)\
                                            .filter(Image.downloaded==False)\
                                            .filter(Video.id==None)\
                                            .distinct().all()
                
        else:    
            if include_video:
                videos = db.session.query(Video)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(Trapgroup)\
                                    .filter(Trapgroup.survey==task.survey)\
                                    .filter(Video.downloaded==False)\
                                    .filter(Image.zip_id==None)\
                                    .distinct().limit(50).all() # NOTE: WE DO NOT KEEP EMPTY VIDEOS ANYMORE IN S3 (CAN"T BE DOWNLOADED)
            else:
                if include_frames:
                    images = db.session.query(Image)\
                                    .join(Camera)\
                                    .join(Trapgroup)\
                                    .filter(Trapgroup.survey==task.survey)\
                                    .filter(Image.downloaded==False)\
                                    .distinct().limit(200).all()
                else:
                   images = db.session.query(Image)\
                                    .join(Camera)\
                                    .outerjoin(Video)\
                                    .join(Trapgroup)\
                                    .filter(Trapgroup.survey==task.survey)\
                                    .filter(Image.downloaded==False)\
                                    .filter(Video.id==None)\
                                    .distinct().limit(200).all() 

        if include_video:
            for video in videos:
                videoPaths, videoLabels, videoTags = get_video_paths_and_labels(video,task,individual_sorted,species_sorted,flat_structure,labels, include_empties)
                videoLabels.extend(videoTags)
                file_ids.append(video.id)
                pathSplit  = video.camera.path.split('/',1)
                path = pathSplit[0] + '-comp/' + pathSplit[1].split('_video_images_')[0] + video.filename.rsplit('.', 1)[0] + '.mp4'
                reply.append({'url':'https://'+Config.BUCKET+'.s3.amazonaws.com/'+ path.replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),'paths':videoPaths,'labels':videoLabels})
            db.session.commit()

        else:
            for image in images:
                imagePaths, imageLabels, imageTags = get_image_paths_and_labels(image,task,individual_sorted,species_sorted,flat_structure,labels,include_empties)
                imageLabels.extend(imageTags)
                file_ids.append(image.id)
                if raw_files and not image.zip_id: # If image is empty (zip_id) it will only be in the comp folder
                    reply.append({'url':'https://'+Config.BUCKET+'.s3.amazonaws.com/'+(image.camera.path+'/'+image.filename).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),'paths':imagePaths,'labels':imageLabels, 'hash':image.hash})
                else:
                    pathSplit  = image.camera.path.split('/',1)
                    path = pathSplit[0] + '-comp/' + pathSplit[1] + '/' + image.filename
                    reply.append({'url':'https://'+Config.BUCKET+'.s3.amazonaws.com/'+ path.replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),'paths':imagePaths,'labels':imageLabels, 'hash':image.hash})
            db.session.commit()

    return json.dumps({'ids':file_ids,'requiredFiles':reply})

@app.route('/fileHandler/set_download_status', methods=['POST'])
@login_required
def set_download_status():
    """Set the download status"""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['selectedTask']
    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())

        include_empties = request.json['include_empties']
        labels = request.json['species']
        include_video = request.json['include_video']
        include_frames = request.json['include_frames']

        # Make sure old counts are removed
        GLOBALS.redisClient.delete(str(task.id)+'_filesToDownload')

        # Image downloaded state should always be false, but need to catch dropped uploads
        checkImage = db.session.query(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey==task.survey)\
                        .filter(Image.downloaded==True)\
                        .first()

        checkVideo = db.session.query(Video)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey==task.survey)\
                        .filter(Video.downloaded==True)\
                        .first()

        if checkImage or checkVideo:
            if checkImage:
                resetImageDownloadStatus.delay(task_id=task_id,then_set=True,labels=labels,include_empties=include_empties, include_frames=include_frames)

            if checkVideo:
                resetVideoDownloadStatus.delay(task_id=task_id,then_set=True,labels=labels,include_empties=include_empties, include_frames=include_frames)

            return json.dumps('resetting')
        else:
            setImageDownloadStatus.delay(task_id=task_id,labels=labels,include_empties=include_empties, include_video=include_video, include_frames=include_frames)
            return json.dumps('success')
        
    return json.dumps('error')

@app.route('/fileHandler/check_download_initialised', methods=['POST'])
@login_required
def check_download_initialised():
    """Checks if the download has been initialised."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['selectedTask']
    task = db.session.query(Task).get(task_id)
    reply = {'status': 'ready'}
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())

        filesToDownload = GLOBALS.redisClient.get(str(task.id)+'_filesToDownload')
        if filesToDownload:
            filesToDownload = int(filesToDownload.decode())
            GLOBALS.redisClient.delete(str(task.id)+'_filesToDownload')
            reply['filesToDownload'] = filesToDownload

        if task.status == 'Preparing Download':
            reply['status'] = 'not ready'

    return json.dumps(reply)

@app.route('/fileHandler/mark_images_downloaded', methods=['POST'])
@login_required
def mark_images_downloaded():
    """Marks the specified images or videos as downloaded."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    include_video = request.json['include_video']
    task_id = request.json['task_id']
    if include_video:
        video_ids = request.json['image_ids']
        survey_id = db.session.query(Survey.id).join(Trapgroup).join(Camera).join(Video).filter(Video.id==video_ids[0]).first()[0]

        if survey_id and checkSurveyPermission(current_user.id,survey_id,'read'):
            GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())
            
            videos = db.session.query(Video).filter(Video.id.in_(video_ids)).distinct().all()
            for video in videos:
                video.downloaded = True
            db.session.commit()
    else:
        image_ids = request.json['image_ids']
        survey_id = db.session.query(Survey.id).join(Trapgroup).join(Camera).join(Image).filter(Image.id==image_ids[0]).first()[0]

        if survey_id and checkSurveyPermission(current_user.id,survey_id,'read'):
            GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())

            images = db.session.query(Image).filter(Image.id.in_(image_ids)).distinct().all()
            for image in images:
                image.downloaded = True
            db.session.commit()

    return json.dumps('success')

@app.route('/fileHandler/download_complete', methods=['POST'])
@login_required
def download_complete():
    """Resets the downloaded state of all images of a task."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['task_id']
    task = db.session.query(Task).get(task_id)
    # if task and (task.survey.user==current_user):
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        manageDownload(task_id)
        return json.dumps('success')
    
    return json.dumps('error')

@app.route('/fileHandler/check_download_available', methods=['POST'])
@login_required
def check_download_available():
    """Checks whether a download is available for a particular task (ie. that no other user has a download in progress for that survey)."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['task_id']
    if 'download_request_id' in request.json:
        download_request_id = request.json['download_request_id']
    else:
        download_request_id = None
    task = db.session.query(Task).get(task_id)
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        check = db.session.query(Trapgroup.id).join(Camera).join(Image).outerjoin(Video).filter(Trapgroup.survey_id==task.survey_id).filter(or_(Image.downloaded==True,Video.downloaded==True)).first()
        if download_request_id:
            check2 = db.session.query(DownloadRequest).join(Task).filter(Task.survey_id==task.survey_id).filter(DownloadRequest.type=='file').filter(DownloadRequest.id!=download_request_id).first()
        else:
            check2 = db.session.query(DownloadRequest)\
                                .join(Task)\
                                .filter(Task.survey_id==task.survey_id)\
                                .filter(DownloadRequest.type=='file')\
                                .filter(DownloadRequest.status.in_(['Downloading','Initialising']))\
                                .first()
        if check or check2:
            return json.dumps('unavailable')
        else:
            return json.dumps('available')
    
    return json.dumps('error')

@app.route('/getIndividualIDSurveysTasks', methods=['POST'])
@login_required
def getIndividualIDSurveysTasks():
    '''Returns surveys and tasks available for multi-survey individual ID for the specified species.'''

    species = request.form['species']

    surveys = surveyPermissionsSQ(db.session.query(Survey)\
                        .join(Task)\
                        .join(Label)\
                        .filter(Label.description==species)\
                        .filter(Label.icID_q1_complete==True)\
                        .filter(Label.icID_allowed==True)\
                        .filter(Task.status.in_(Config.TASK_READY_STATUSES))\
                        .filter(Survey.status.in_(Config.SURVEY_READY_STATUSES))\
                        .filter(Survey.status != 'Restoring Files')\
                        ,current_user.id, 'write').distinct().all()

    reply = {}
    for survey in surveys:
        tasks = db.session.query(Task)\
                        .join(Label)\
                        .filter(Label.description==species)\
                        .filter(Label.icID_q1_complete==True)\
                        .filter(Label.icID_allowed==True)\
                        .filter(Task.survey==survey)\
                        .filter(Task.status.in_(Config.TASK_READY_STATUSES))\
                        .filter(Task.name != 'default')\
                        .filter(~Task.name.contains('_o_l_d_'))\
                        .filter(~Task.name.contains('_copying'))\
                        .distinct().all()

        reply[survey.name] = []
        for task in tasks:
            reply[survey.name].append({'task_id':task.id,'name':task.name})

    return json.dumps(reply)

@app.route('/writeInfoToImages/<type_id>/<id>')
@login_required
def writeInfoToImages(type_id,id):
    ''' Writes the info of the individual to its images for a specified individual or 
    for all the individuals associated with a specific task. '''

    species = request.args.get('species', '0', type=str)

    if type_id == 'task':
        task = db.session.query(Task).get(id)
        if task and checkSurveyPermission(current_user.id,task.survey_id,'admin'):
            if species != '0':
                individuals = db.session.query(Individual).join(Task,Individual.tasks).filter(Task.id==id).filter(Individual.species == species).all()
            else:
                individuals = task.individuals

            for individual in individuals:
                images = db.session.query(Image)\
                    .join(Detection)\
                    .filter(Detection.individuals.contains(individual))\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .order_by(Image.corrected_timestamp).all()

                count = 0
                for image in images:
                    count +=1
                    url = image.camera.path + '/' + image.filename

                    splits = url.split('/')
                    splits[0] = splits[0] + '-comp'
                    url_new = '/'.join(splits)    

                    if Config.DEBUGGING: (url_new)

                    s3_response_object = GLOBALS.s3client.get_object(Bucket=Config.BUCKET,Key=url)
                    imageData = s3_response_object['Body'].read()

                    img = PIL.Image.open(io.BytesIO(imageData))

                    tasks_str = ""
                    for task in individual.tasks:
                        # tasks_str += task.survey.name + " " + task.name + "\n"	
                        tasks_str += task.survey.name + " " + task.name + ", "

                    tags_str = ''
                    for tag in individual.tags:
                        # tags_str += tag.description + '\n'
                        tags_str += tag.description + ', '

                    # text =  'ID:' + str(individual.id) + '\n' + \
                    #         'Name: ' + individual.name + '\n' +\
                    #         'Species: ' + individual.species + '\n' +\
                    #         'Tags: \n' + tags_str  + \
                    #         'Surveys & Tasks: \n' + tasks_str + \
                    #         'Image ID: ' + str(image.id) + '\n' + \
                    #         'Image Nr: ' + str(count) + '\n' 

                    text =  'ID:' + str(individual.id) + '  ' + \
                            'Name: ' + individual.name + '  ' +\
                            'Species: ' + individual.species + '  ' +\
                            'Image ID: ' + str(image.id) + '  ' + \
                            'Image Nr: ' + str(count) + '\n' + \
                            'Tags: ' + tags_str  + '\n' +\
                            'Surveys & Tasks: ' + tasks_str + '\n' 
                                                

                    font = ImageFont.truetype('Vera.ttf', 60)

                    draw = ImageDraw.Draw(img)
                    # text_width, text_height = draw.textsize(text, font=font)
                    # x = 2
                    # y = 2
                    x = img.width/11
                    y = 15

                    draw.text((x, y), text, font=font, fill=(255, 0, 0, 1))

                    with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file:
                        img.save(temp_file.name)

                        with wandImage(filename=temp_file.name).convert('jpeg') as img1:
                            # This is required, because if we don't have it ImageMagick gets too clever for it's own good
                            # and saves images with no color content (i.e. fully black image) as grayscale. But this causes
                            # problems for MegaDetector which expects a 3 channel image as input.
                            img1.metadata['colorspace:auto-grayscale'] = 'false'
                            img1.transform(resize='800')

                            # Upload the compressed image to S3
                            GLOBALS.s3client.upload_fileobj(BytesIO(img1.make_blob()), Config.BUCKET, url_new)
                    
                    # Save the original image with text locally for debugging purposes
                    # img.save(str(individual.id) + "_image" + str(count) + "_with_text.jpg")

        return json.dumps('success')
    elif type_id == 'individual':
        individual = db.session.query(Individual).get(id)
        if individual and all(checkSurveyPermission(current_user.id,task.survey_id,'admin') for task in individual.tasks):
            images = db.session.query(Image)\
                    .join(Detection)\
                    .filter(Detection.individuals.contains(individual))\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                    .order_by(Image.corrected_timestamp).all()

            count = 0
            for image in images:
                count +=1
                url = image.camera.path + '/' + image.filename

                splits = url.split('/')
                splits[0] = splits[0] + '-comp'
                url_new = '/'.join(splits)    

                if Config.DEBUGGING: app.logger.info(url_new)

                s3_response_object = GLOBALS.s3client.get_object(Bucket=Config.BUCKET,Key=url)
                imageData = s3_response_object['Body'].read()

                img = PIL.Image.open(io.BytesIO(imageData))

                tasks_str = ""
                for task in individual.tasks:
                    # tasks_str += task.survey.name + " " + task.name + "\n"	
                    tasks_str += task.survey.name + " " + task.name + ", "

                tags_str = ''
                for tag in individual.tags:
                    # tags_str += tag.description + '\n'
                    tags_str += tag.description + ', '

                # text =  'ID:' + str(individual.id) + '\n' + \
                #         'Name: ' + individual.name + '\n' +\
                #         'Species: ' + individual.species + '\n' +\
                #         'Tags: \n' + tags_str  + \
                #         'Surveys & Tasks: \n' + tasks_str + \
                #         'Image ID: ' + str(image.id) + '\n' + \
                #         'Image Nr: ' + str(count) + '\n' 

                text =  'ID:' + str(individual.id) + '  ' + \
                        'Name: ' + individual.name + '  ' +\
                        'Species: ' + individual.species + '  ' +\
                        'Image ID: ' + str(image.id) + '  ' + \
                        'Image Nr: ' + str(count) + '\n' + \
                        'Tags: ' + tags_str  + '\n' +\
                        'Surveys & Tasks: ' + tasks_str + '\n' 
                                              

                font = ImageFont.truetype('Vera.ttf', 60)

                draw = ImageDraw.Draw(img)
                # text_width, text_height = draw.textsize(text, font=font)
                # x = 2
                # y = 2
                x = img.width/11
                y = 15

                draw.text((x, y), text, font=font, fill=(255, 0, 0, 1))

                with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file:
                    img.save(temp_file.name)

                    with wandImage(filename=temp_file.name).convert('jpeg') as img1:
                        # This is required, because if we don't have it ImageMagick gets too clever for it's own good
                        # and saves images with no color content (i.e. fully black image) as grayscale. But this causes
                        # problems for MegaDetector which expects a 3 channel image as input.
                        img1.metadata['colorspace:auto-grayscale'] = 'false'
                        img1.transform(resize='800')

                        # Upload the compressed image to S3
                        GLOBALS.s3client.upload_fileobj(BytesIO(img1.make_blob()), Config.BUCKET, url_new)
                
                # Save the original image with text locally for debugging purposes
                # img.save(str(individual.id) + "_image" + str(count) + "_with_text.jpg")

        return json.dumps('success')
    else:
        return json.dumps('error')
    
@app.route('/getIndividualAssociations/<individual_id>/<order>') 
@login_required
def getIndividualAssociations(individual_id, order):
    ''' Returns the associated individuals for a specific individual '''

    page = request.args.get('page', 1, type=int)
    next_page = None
    prev_page = None 

    individual = db.session.query(Individual).get(individual_id)

    reply = []

    task_ids = []
    survey_ids = []
    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            task_ids.append(task.id)
            survey_ids.append(task.survey_id)

    if individual and individual.active and task_ids:

        clusterSQ = db.session.query(Cluster)\
            .join(Task)\
            .join(Image,Cluster.images)\
            .join(Detection)\
            .filter(Detection.individuals.contains(individual))\
            .filter(Task.id.in_(task_ids))\
            .subquery()

        imageSQ = db.session.query(Image)\
            .join(Detection)\
            .filter(Detection.individuals.contains(individual))\
            .subquery()

        associations = db.session.query(Individual.id,Individual.name,func.count(distinct(Cluster.id)).label('cluster_count'),func.count(distinct(imageSQ.c.id)).label('image_count'))\
            .join(Task,Individual.tasks)\
            .join(Detection,Individual.detections)\
            .join(Image)\
            .join(Cluster,Image.clusters)\
            .join(clusterSQ,clusterSQ.c.id==Cluster.id)\
            .outerjoin(imageSQ,imageSQ.c.id==Image.id)\
            .filter(Task.id.in_(task_ids))\
            .filter(Individual.name!='unidentifiable')\
            .filter(Individual.id!=individual.id)\
            .filter(Individual.active==True)\
            .group_by(Individual.id)

        # Order the associations
        if order == 'a1':
            # Asc Name
            associations = associations.order_by(Individual.name)     
        elif order == 'a2':
            # Asc Cluster Count
            associations = associations.order_by(func.count(distinct(Cluster.id)).asc())        
        elif order == 'a3':
            # Asc Images count
            associations = associations.order_by(func.count(distinct(Image.id)).asc())            
        elif order == 'd1':
            # Desc Name
            associations = associations.order_by(desc(Individual.name))
        elif order == 'd2':
            # Desc Cluster count
            associations = associations.order_by(func.count(distinct(Cluster.id)).desc())  
        elif order == 'd3':
            # Desc Sightings count
            associations = associations.order_by(func.count(distinct(Image.id)).desc())
        else:
            # Default order
            associations = associations.order_by(func.count(distinct(Cluster.id)).desc())

        # Paginate
        associations = associations.paginate(page, 3, False)

        best_detections = calculate_individual_best_detection([individual[0] for individual in associations.items])

        for association in associations.items:

            # Get the best detection for the individual
            best_detection = best_detections.get(association[0], None)
            if not best_detection: continue

            reply.append(
                {
                    'id': association[0],
                    'name': association[1],
                    'cluster_count': association[2],
                    'image_count': association[3],
                    'url': (best_detection['path'] + '/' + best_detection['filename']).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'detection': {
                        'top': best_detection['top'],
                        'left': best_detection['left'],
                        'right': best_detection['right'],
                        'bottom': best_detection['bottom']
                    }
                }
            )

        next_page = associations.next_num if associations.has_next else None
        prev_page = associations.prev_num if associations.has_prev else None

    return json.dumps({'associations': reply, 'next': next_page, 'prev': prev_page})

@app.route('/results')
def results():
    '''Renders the results page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        if not current_user.permissions: return redirect(url_for('landing'))
        return render_template('html/results.html', title='Analysis', helpFile='results_page', bucket=Config.BUCKET, version=Config.VERSION)


@app.route('/getAllLabelsTagsSitesAndGroups', methods=['POST'])
@login_required
def getAllLabelsTagsSitesAndGroups():
    '''Returns all the labels, sites, and tags for the specified tasks.'''
    task_ids = ast.literal_eval(request.form['task_ids'])
    sites_data = []
    sites_ids = []
    unique_sites = {}
    if task_ids and task_ids != '-1':
        if task_ids[0] == '0':
            labels = [r[0] for r in surveyPermissionsSQ(db.session.query(Label.description).join(Task).join(Survey),current_user.id,'read').distinct().all()]
            tags = [r[0] for r in surveyPermissionsSQ(db.session.query(Tag.description).join(Task).join(Survey),current_user.id,'read').distinct().all()]
            sites = surveyPermissionsSQ(db.session.query(Trapgroup.id, Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).join(Survey),current_user.id,'read').order_by(Trapgroup.id).all()
            groups = surveyPermissionsSQ(db.session.query(Sitegroup.id, Sitegroup.name).join(Trapgroup, Sitegroup.trapgroups).join(Survey),current_user.id,'read').distinct().all()
            individual_species = [r[0] for r in surveyPermissionsSQ(db.session.query(Individual.species).join(Task,Individual.tasks).join(Survey),current_user.id,'read').distinct().all()]
        else:
            labels = [r[0] for r in surveyPermissionsSQ(db.session.query(Label.description).join(Task).join(Survey),current_user.id,'read').filter(Task.id.in_(task_ids)).distinct().all()]
            sites = surveyPermissionsSQ(db.session.query(Trapgroup.id, Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).join(Survey).join(Task),current_user.id,'read').filter(Task.id.in_(task_ids)).order_by(Trapgroup.id).all()
            tags = [r[0] for r in surveyPermissionsSQ(db.session.query(Tag.description).join(Task).join(Survey),current_user.id,'read').filter(Task.id.in_(task_ids)).distinct().all()]
            groups = surveyPermissionsSQ(db.session.query(Sitegroup.id, Sitegroup.name).join(Trapgroup, Sitegroup.trapgroups).join(Survey).join(Task),current_user.id,'read').filter(Task.id.in_(task_ids)).distinct().all()
            individual_species = [r[0] for r in surveyPermissionsSQ(db.session.query(Individual.species).join(Task,Individual.tasks).join(Survey),current_user.id,'read').filter(Task.id.in_(task_ids)).distinct().all()]

        for site in sites:
            site_info = {'tag': site.tag, 'latitude': site.latitude, 'longitude': site.longitude}
            combination = (site_info['tag'], site_info['latitude'], site_info['longitude'])

            if combination in unique_sites.keys():
                unique_sites[combination]['ids'].append(site.id)
            else:
                unique_sites[combination] = {'info': site_info, 'ids': [site.id]}

        for item in unique_sites.values():
            sites_data.append(item['info'])
            sites_ids.append(item['ids'])

        group_ids = [r[0] for r in groups]
        group_names = [r[1] for r in groups]

    return json.dumps({'labels': labels, 'sites': sites_data, 'sites_ids': sites_ids, 'tags': tags, 'group_ids': group_ids, 'group_names': group_names, 'individual_species': individual_species})

@app.route('/getLineData', methods=['POST'])
@login_required
def getLineData():
    '''
    Returns the time activity data for the requested species and task.
    
        Parameters:
            task_id (int): The task for which the data is required
            trapgroup (str): The trapgroup for which data is required
            species (str): The species fow which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            timeUnit (str): The desired time unit  day, week, month, or year)
            startDate (str): The start date for the data
            endDate (str): The end date for the data
    '''

    task_ids = ast.literal_eval(request.form['task_ids'])
    species = ast.literal_eval(request.form['species'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    trapgroup = ast.literal_eval(request.form['trapgroup'])
    timeUnit = ast.literal_eval(request.form['timeUnit'])
    timeUnitNumber = int(ast.literal_eval(request.form['timeUnitNumber']))
    group = ast.literal_eval(request.form['group'])
    if 'startDate' in request.form:
        startDate = ast.literal_eval(request.form['startDate'])
        endDate = ast.literal_eval(request.form['endDate'])
    else:
        startDate = None
        endDate = None
    if baseUnit == '4':
        timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
        timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
    else:
        timeToIndependence = None
        timeToIndependenceUnit = None

    if 'normaliseBySite' in request.form:
        normaliseBySite = ast.literal_eval(request.form['normaliseBySite'])
        if normaliseBySite == '1':
            normaliseBySite = True
        else:
            normaliseBySite = False
    else:
        normaliseBySite = False

    if Config.DEBUGGING: app.logger.info('Line data requested for tasks:{} species:{} baseUnit:{} trapgroup:{} timeUnit:{} timeUnitNumber:{} group:{} startDate:{} endDate:{} timeToIndependence:{} timeToIndependenceUnit:{}'.format(task_ids,species,baseUnit,trapgroup,timeUnit,timeUnitNumber,group,startDate,endDate,timeToIndependence,timeToIndependenceUnit))

    data = []
    data_labels = []
    if task_ids:
        if task_ids[0] == '0':
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').distinct().all()
        else:
            tasks = surveyPermissionsSQ(db.session.query(Task.id, Task.survey_id).join(Survey).filter(Task.id.in_(task_ids)), current_user.id, 'read').distinct().all()
        task_ids = [r[0] for r in tasks]
        survey_ids = list(set([r[1] for r in tasks]))

        if baseUnit == '1' or baseUnit == '4':
            baseQuery = db.session.query(
                                Image.id,
                                Image.corrected_timestamp,
                                Label.description, 
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '2':
            baseQuery = db.session.query(
                                Cluster.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '3':
            baseQuery = db.session.query(
                                Detection.id,
                                Image.corrected_timestamp,
                                Label.description,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Image)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        baseQuery = rDets(baseQuery)

        if startDate: 
            baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)
            first_date = startDate
        else:
            first_date = baseQuery.filter(Image.corrected_timestamp != None).order_by(Image.corrected_timestamp).first()
            if first_date:
                first_date = first_date[1]
            else:
                first_date = None

        if endDate: 
            baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)
            last_date = endDate
        else:
            last_date = baseQuery.filter(Image.corrected_timestamp != None).order_by(desc(Image.corrected_timestamp)).first()
            if last_date:
                last_date = last_date[1]
            else:
                last_date = None

        if trapgroup != '0' and trapgroup != '-1':
            if type(trapgroup) == list:
                trap_ids = [int(t) for t in trapgroup]
                baseQuery = baseQuery.filter(Trapgroup.id.in_(trap_ids))
            else:
                baseQuery = baseQuery.filter(Trapgroup.tag==trapgroup)

        if group != '0' and group != '-1':
            baseQuery = baseQuery.filter(Sitegroup.id==int(group))     

        if normaliseBySite:
            trapgroups = db.session.query(
                                    Trapgroup.tag, 
                                    Trapgroup.latitude, 
                                    Trapgroup.longitude,
                                    func.count(distinct(func.date(Image.corrected_timestamp)))
                                )\
                                .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                                .join(Image)\
                                .outerjoin(Sitegroup, Trapgroup.sitegroups)\
                                .filter(Trapgroup.survey_id.in_(survey_ids))

            if trapgroup and trapgroup != '0' and trapgroup != '-1' and group and group != '0' and group != '-1':
                trapgroups = trapgroups.filter(or_(Trapgroup.id.in_(trapgroup), Sitegroup.id.in_(group)))
            elif trapgroup and trapgroup != '0' and trapgroup != '-1':
                trapgroups = trapgroups.filter(Trapgroup.id.in_(trapgroup))
            elif group and group != '0' and group != '-1':
                trapgroups = trapgroups.filter(Sitegroup.id.in_(group))

            trapgroups = trapgroups.group_by(Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).order_by(Trapgroup.tag).all()   

        if species != '0':
            labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            vhl = db.session.query(Label).get(GLOBALS.vhl_id)
            label_list = [GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.knocked_id]
            for task_id in task_ids:
                label_list.extend(getChildList(vhl,int(task_id)))
            baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))


        df = pd.DataFrame(baseQuery,columns=['id','timestamp','species','tag','latitude','longitude'])
        df.drop_duplicates(subset=['id'],inplace=True)

        if len(df) > 0:
            if timeToIndependence:
                if timeToIndependenceUnit == 's':
                    timeToIndependence = int(timeToIndependence)
                elif timeToIndependenceUnit == 'm':
                    timeToIndependence = int(timeToIndependence) * 60
                elif timeToIndependenceUnit == 'h':
                    timeToIndependence = int(timeToIndependence) * 3600
                timeToIndependence = timedelta(seconds=timeToIndependence)

                df = df.sort_values(by=['species','tag', 'latitude', 'longitude','timestamp'])
                df['timedelta'] = df.groupby(['species','tag','latitude','longitude'])['timestamp'].diff()
                df['timedelta'] = df['timedelta'].fillna(timedelta(seconds=9999999))
                df = df[df['timedelta'] >= timeToIndependence]
                df = df.drop(columns=['timedelta'])


            if first_date and last_date:
                first_date = pd.to_datetime(first_date)
                last_date = pd.to_datetime(last_date)
                if first_date == last_date:
                    dates = [first_date]
                else:
                    if timeUnit == '1': # Day
                        first_date = first_date.replace(hour=0, minute=0, second=0, microsecond=0)
                        last_date = last_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                        dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}D')	
                    elif timeUnit == '2': # Month
                        first_date = first_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                        last_day = calendar.monthrange(last_date.year, last_date.month)[1]
                        last_date = last_date.replace(day=last_day, hour=23, minute=59, second=59)
                        dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}MS')
                    elif timeUnit == '3': # Year
                        first_date = first_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                        last_date = last_date.replace(month=12, day=31, hour=23, minute=59, second=59)
                        dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}AS')

                    if len(dates) == 0:
                        dates = [first_date]

                df['timestamp'] = pd.to_datetime(df['timestamp'])

                if normaliseBySite:
                    for i, date in enumerate(dates):
                        trap_data = []
                        for tag,lat,lng,effort in trapgroups:
                            if i < len(dates)-1:
                                species_count = df[(df['timestamp'] >= date) & (df['timestamp'] < dates[i+1]) & (df['tag'] == tag) & (df['latitude'] == lat) & (df['longitude'] == lng)].id.nunique()        
                            else:
                                species_count = df[(df['timestamp'] >= date) & (df['tag'] == tag) & (df['latitude'] == lat) & (df['longitude'] == lng)].id.nunique()
                            count = species_count/effort * 100
                            trap_data.append(count)

                        data.append(round(sum(trap_data)/len(trap_data), 3))
                        if timeUnit == '1':
                            data_labels.append(date.strftime('%d %b %Y'))
                        elif timeUnit == '2':
                            data_labels.append(date.strftime('%b %Y'))
                        elif timeUnit == '3':
                            data_labels.append(date.strftime('%Y'))

                else:     
                    for i, date in enumerate(dates):
                        if i < len(dates)-1:
                            data.append(df[(df['timestamp'] >= date) & (df['timestamp'] < dates[i+1])].id.nunique())
                        else:
                            data.append(df[(df['timestamp'] >= date)].id.nunique())
                        if timeUnit == '1':
                            data_labels.append(date.strftime('%d %b %Y'))
                        elif timeUnit == '2':
                            data_labels.append(date.strftime('%b %Y'))
                        elif timeUnit == '3':
                            data_labels.append(date.strftime('%Y'))

    return json.dumps({'data': data, 'labels': data_labels, 'timeUnit': timeUnit})


@app.route('/getLineDataIndividual', methods=['POST'])
@login_required
def getLineDataIndividual():
    '''
    Returns the time activity data for the requested individual.
    
        Parameters:
            individual_id (int): The individual for which the data is required
            trapgroup (str): The trapgroup for which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            timeUnit (str): The desired time unit  day, week, month, or year)
            startDate (str): The start date for the data
            endDate (str): The end date for the data
    '''

    individual_id = ast.literal_eval(request.form['individual_id'])
    baseUnit = ast.literal_eval(request.form['baseUnit'])
    trapgroup = ast.literal_eval(request.form['trapgroup'])
    timeUnit = ast.literal_eval(request.form['timeUnit'])
    timeUnitNumber = int(ast.literal_eval(request.form['timeUnitNumber']))
    startDate = ast.literal_eval(request.form['startDate'])
    endDate = ast.literal_eval(request.form['endDate'])

    if Config.DEBUGGING: app.logger.info('Line data requested for individual {} {} {} {} {} {}'.format(individual_id,baseUnit,timeUnit,trapgroup,startDate,endDate))

    data = []
    data_labels = []
    individual = db.session.query(Individual).get(individual_id)

    survey_ids = []
    task_ids = []
    for task in individual.tasks:
        if checkSurveyPermission(current_user.id,task.survey_id,'read'):
            survey_ids.append(task.survey_id)
            task_ids.append(task.id)

    if individual and survey_ids:
        if baseUnit == '1':
            baseQuery = db.session.query(
                                Image.id,
                                Image.corrected_timestamp,
                                Label.description
                            )\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '2':
            baseQuery = db.session.query(
                                Cluster.id,
                                Image.corrected_timestamp,
                                Label.description
                            )\
                            .join(Image,Cluster.images)\
                            .join(Detection)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Cluster.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))
        elif baseUnit == '3':
            baseQuery = db.session.query(
                                Detection.id,
                                Image.corrected_timestamp,
                                Label.description
                            )\
                            .join(Image)\
                            .join(Labelgroup)\
                            .join(Label, Labelgroup.labels)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(Labelgroup.task_id.in_(task_ids))\
                            .filter(Trapgroup.survey_id.in_(survey_ids))

        baseQuery = rDets(baseQuery)

        if trapgroup != '0':
            baseQuery = baseQuery.filter(Trapgroup.tag==trapgroup)

        if startDate: 
            baseQuery = baseQuery.filter(Image.corrected_timestamp >= startDate)
            first_date = startDate
        else:
            first_date = baseQuery.filter(Image.corrected_timestamp != None).order_by(Image.corrected_timestamp).first()
            if first_date:
                first_date = first_date[1]
            else:
                first_date = None

        if endDate: 
            baseQuery = baseQuery.filter(Image.corrected_timestamp <= endDate)
            last_date = endDate
        else:
            last_date = baseQuery.filter(Image.corrected_timestamp != None).order_by(desc(Image.corrected_timestamp)).first()
            if last_date:
                last_date = last_date[1]
            else:
                last_date = None

        df = pd.DataFrame(baseQuery,columns=['id','timestamp','species'])
        df.drop_duplicates(subset=['id'],inplace=True)

        if first_date and last_date:
            first_date = pd.to_datetime(first_date)
            last_date = pd.to_datetime(last_date)
            if first_date == last_date:
                dates = [first_date]
            else:
                if timeUnit == '1': # Day
                    first_date = first_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    last_date = last_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                    dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}D')	
                elif timeUnit == '2': # Month
                    first_date = first_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    last_day = calendar.monthrange(last_date.year, last_date.month)[1]
                    last_date = last_date.replace(day=last_day, hour=23, minute=59, second=59)
                    dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}MS')
                elif timeUnit == '3': # Year
                    first_date = first_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    last_date = last_date.replace(month=12, day=31, hour=23, minute=59, second=59)
                    dates = pd.date_range(start=first_date, end=last_date, freq=f'{timeUnitNumber}AS')

                if len(dates) == 0:
                    dates = [first_date]

            df['timestamp'] = pd.to_datetime(df['timestamp'])

            for i, date in enumerate(dates):
                if i < len(dates)-1:
                    data.append(df[(df['timestamp'] >= date) & (df['timestamp'] < dates[i+1])].id.nunique())
                else:
                    data.append(df[(df['timestamp'] >= date)].id.nunique())
                if timeUnit == '1':
                    data_labels.append(date.strftime('%d %b %Y'))
                elif timeUnit == '2':
                    data_labels.append(date.strftime('%b %Y'))
                elif timeUnit == '3':
                    data_labels.append(date.strftime('%Y'))

    return json.dumps({'data': data, 'labels': data_labels})

@app.route('/searchSites', methods=['POST'])
@login_required
def searchSites():
    ''' Search for sites based on a search string and return a list of matching sites '''

    sites_data = []
    sites_ids = []
    unique_sites = {}
    search = ast.literal_eval(request.form['search'])
    advanced = ast.literal_eval(request.form['advanced'])
    task_ids = ast.literal_eval(request.form['task_ids'])

    if task_ids:
        if task_ids[0] == '0':
            sites = surveyPermissionsSQ(db.session.query(Trapgroup.id, Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).join(Survey),current_user.id,'read')
        else:
            sites = surveyPermissionsSQ(db.session.query(Trapgroup.id, Trapgroup.tag, Trapgroup.latitude, Trapgroup.longitude).join(Survey).join(Task).filter(Task.id.in_(task_ids)),current_user.id,'read')

    if Config.DEBUGGING: app.logger.info('Searching for sites matching {} {} for tasks {}'.format(search, advanced, task_ids))

    if advanced == 'true':
        # Regular expression search 
        sites = sites.order_by(Trapgroup.id).distinct().all()
        matching_sites = []
        for site in sites:
            if re.search(search, site[1]):
                matching_sites.append(site)
        sites = matching_sites
    else:
        searches = re.split('[ ,]',search)
        for search in searches:
            sites = sites.filter(Trapgroup.tag.contains(search))               
        sites = sites.order_by(Trapgroup.id).distinct().all()

    for site in sites:
        site_info = {'tag': site[1], 'latitude': site[2], 'longitude': site[3]}
        combination = (site_info['tag'], site_info['latitude'], site_info['longitude'])
        
        if combination in unique_sites.keys():
            unique_sites[combination]['ids'].append(site[0])
        else:
            unique_sites[combination] = {'info': site_info, 'ids': [site[0]]}
    for item in unique_sites.values():
        sites_data.append(item['info'])
        sites_ids.append(item['ids'])

    return json.dumps({'sites': sites_data, 'ids': sites_ids})

@app.route('/saveGroup', methods=['POST'])
@login_required
def saveGroup():
    ''' Save a group of sites '''
    name = ast.literal_eval(request.form['name'])
    description = ast.literal_eval(request.form['description'])
    sites_ids = ast.literal_eval(request.form['sites_ids'])

    if Config.DEBUGGING: app.logger.info('Saving group {} {} {}'.format(name, description, sites_ids))

    status = 'success'
    message = ''
    survey_ids = [r.id for r in db.session.query(Survey.id).join(Trapgroup).filter(Trapgroup.id.in_(sites_ids)).distinct().all()]
    permission = surveyPermissionsSQ(db.session.query(Survey.id).filter(Survey.id.in_(survey_ids)),current_user.id,'write').distinct().all()
    if current_user and current_user.is_authenticated and (len(survey_ids)==len(permission)):
        try:
            check = db.session.query(Sitegroup).join(Trapgroup, Sitegroup.trapgroups).join(Survey).join(Organisation).join(UserPermissions).filter(UserPermissions.user==current_user).filter(Sitegroup.name==name).first()
            if check:
                status = 'error'
                message = 'A group with that name already exists.'
            else:
                group = Sitegroup(name=name, description=description)
                db.session.add(group)
                sites = db.session.query(Trapgroup).filter(Trapgroup.id.in_(sites_ids)).all()
                group.trapgroups = sites
                db.session.commit()
                status = 'success'
                message = 'Group saved successfully.'
        except:
            status = 'error'
            message = 'An error occurred while saving the group.'

    return json.dumps({'status': status, 'message': message})

@app.route('/getGroups', methods=['POST'])
@login_required
def getGroups():
    ''' Get a list of groups '''
    groups = []
    survey_ids = []
    task_ids = ast.literal_eval(request.form['task_ids'])
    if current_user and current_user.is_authenticated:
        if task_ids:
            if task_ids[0] == '0':
                survey_ids = [r[0] for r in surveyPermissionsSQ(db.session.query(Survey.id),current_user.id,'read').distinct().all()]
            else:
                survey_ids = [r[0] for r in surveyPermissionsSQ(db.session.query(Survey.id).join(Task).filter(Task.id.in_(task_ids)),current_user.id,'read').distinct().all()]

        subquery = db.session.query(Sitegroup)\
                        .join(Trapgroup, Sitegroup.trapgroups)\
                        .filter(~Trapgroup.survey_id.in_(survey_ids))\
                        .subquery()

        groupsQuery = db.session.query(
                            Sitegroup.id,
                            Sitegroup.name,
                            Sitegroup.description,
                            Trapgroup.id,
                            Trapgroup.tag,
                            Trapgroup.latitude,
                            Trapgroup.longitude
                        )\
                        .outerjoin(subquery,subquery.c.id==Sitegroup.id)\
                        .join(Trapgroup, Sitegroup.trapgroups)\
                        .filter(subquery.c.id==None)\
                        .filter(Trapgroup.survey_id.in_(survey_ids))\
                        .order_by(Trapgroup.id)\
                        .distinct().all()
        
        groups_df = pd.DataFrame(groupsQuery,columns=['group_id','group_name','group_description','site_id','tag','latitude','longitude'])
        groups_df['ids'] = groups_df.groupby(['group_id','group_name','group_description','tag','latitude','longitude'])['site_id'].transform(lambda x: ','.join(x.astype(str)))
        groups_df.drop_duplicates(subset=['group_id','group_name','group_description','tag','latitude','longitude'],inplace=True)
        groups_df.drop(columns=['site_id'],inplace=True)

        for group_id in groups_df['group_id'].unique():
            group = groups_df[groups_df['group_id']==group_id]
            sites = []
            for index, row in group.iterrows():
                sites.append({'tag': row['tag'], 'latitude': row['latitude'], 'longitude': row['longitude'], 'ids': row['ids']})  
            groups.append({
                'id': int(group_id),
                'name': group['group_name'].iloc[0],
                'description': group['group_description'].iloc[0],
                'sites': sites
            })

    return json.dumps({'groups': groups})

@app.route('/editGroup', methods=['POST'])
@login_required
def editGroup():
    ''' Edit a group of sites '''
    group_id = ast.literal_eval(request.form['group_id'])
    sites_ids = ast.literal_eval(request.form['sites_ids'])
    group_name = ast.literal_eval(request.form['group_name'])
    group_description = ast.literal_eval(request.form['group_description'])

    if Config.DEBUGGING: app.logger.info('Editing group {} {} {} {}'.format(group_id, group_name, group_description, sites_ids))

    survey_ids = [r.id for r in db.session.query(Survey.id).join(Trapgroup).filter(Trapgroup.id.in_(sites_ids)).distinct().all()]
    permission = surveyPermissionsSQ(db.session.query(Survey.id).filter(Survey.id.in_(survey_ids)),current_user.id,'write').distinct().all()
    status = 'success'
    message = ''
    if current_user and current_user.is_authenticated and (len(survey_ids)==len(permission)):
        try:
            group = db.session.query(Sitegroup).get(group_id)
            if group:
                check = db.session.query(Sitegroup).join(Trapgroup, Sitegroup.trapgroups).join(Survey).join(Organisation).join(UserPermissions).filter(UserPermissions.user==current_user).filter(Sitegroup.name==group_name).filter(Sitegroup.id!=group_id).first()
                if check:
                    status = 'error'
                    message = 'A group with that name already exists.'
                else:
                    group.name = group_name
                    group.description = group_description
                    group.trapgroups = []
                    sites = db.session.query(Trapgroup).filter(Trapgroup.id.in_(sites_ids)).all()
                    group.trapgroups = sites
                    db.session.commit()
                    status = 'success'
                    message = 'Group edited successfully.'
            else:
                status = 'error'
                message = 'Group not found.'
        except:
            status = 'error'
            message = 'An error occurred while editing the group.'

    return json.dumps({'status': status, 'message': message})

@app.route('/deleteGroup/<group_id>')
@login_required
def deleteGroup(group_id):
    ''' Delete a group of sites '''
    if current_user and current_user.is_authenticated:
        try:
            group = surveyPermissionsSQ(db.session.query(Sitegroup).join(Trapgroup, Sitegroup.trapgroups).join(Survey),current_user.id,'write').filter(Sitegroup.id==group_id).first()
            if group:
                group.trapgroups = []
                db.session.delete(group)
                db.session.commit()
                status = 'success'
                message = 'Group deleted successfully.'
            else:
                status = 'error'
                message = 'Group not found.'
        except:
            status = 'error'
            message = 'An error occurred while deleting the group.'
    return json.dumps({'status': status, 'message': message})

@app.route('/getSurveysAndTasksForResults')
@login_required
def getSurveysAndTasksForResults():
    ''' Get a list of surveys and tasks for the results page '''

    if current_user and current_user.is_authenticated:
        surveys = surveyPermissionsSQ(db.session.query(
                                    Survey.id,
                                    Survey.name,
                                    Task.id,
                                    Task.name,
                                )\
                                .join(Task)\
                                .filter(~Task.name.contains('_o_l_d_'))\
                                .filter(~Task.name.contains('_copying'))\
                                .filter(Task.name != 'default'),current_user.id,'read')\
                                .order_by(Survey.id, Task.id).all()
        
        survey_data = {}
        task_data = {}
        for item in surveys:
            if item[0] and (item[0] not in survey_data.keys()):
                survey_data[item[0]] = {'id': item[0],
                                        'name': item[1]}

                task_data[item[0]] = [{'id': item[2],
                                        'name': item[3]}]
            else:
                task_data[item[0]].append({'id': item[2],
                                            'name': item[3]})

        survey_data = list(survey_data.values())
    else:
        survey_data = []
        task_data = {}

    return json.dumps({'surveys': survey_data, 'tasks': task_data})

@app.route('/getActivityPattern', methods=['POST'])
@login_required
def getActivityPattern():
    ''' Get the activity pattern for a species '''

    if 'task_ids' in request.form:
        task_ids = ast.literal_eval(request.form['task_ids'])
        species = ast.literal_eval(request.form['species'])
        baseUnit = ast.literal_eval(request.form['baseUnit'])
        trapgroups = ast.literal_eval(request.form['trapgroups'])
        if 'startDate' in request.form:
            startDate = ast.literal_eval(request.form['startDate'])
        else:
            startDate = None
        if 'endDate' in request.form:	
            endDate = ast.literal_eval(request.form['endDate'])
        else:
            endDate = None
        if baseUnit == '4':
            timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
            timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
        else:
            timeToIndependence = None
            timeToIndependenceUnit = None
        unit = ast.literal_eval(request.form['unit'])
        centre = ast.literal_eval(request.form['centre'])
        time = ast.literal_eval(request.form['time'])
        overlap = ast.literal_eval(request.form['overlap'])
        csv = ast.literal_eval(request.form['csv'])
        groups = ast.literal_eval(request.form['groups'])
        if csv == '1':
            csv = True
        else:
            csv = False
        folder = None
        if Config.DEBUGGING: app.logger.info('Activity data requested for {} {} {} {} {} {} {} {} {} {}'.format(task_ids,species,baseUnit,trapgroups,startDate,endDate,unit,centre,time,overlap))
    else:
        task_ids = None
        folder = ast.literal_eval(request.form['folder'])
    
    status = 'FAILURE'
    activity_results = None
    message = None
    celery_result = None
    R_type = 'activity'
    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if task_ids[0] == '0':
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').first()
            else:
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.id.in_(task_ids)), current_user.id, 'read').first()
            if survey:
                folder = survey[1]

                if GLOBALS.redisClient.get('analysis_' + str(current_user.id)):
                    result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
                    try:
                        result_id = result_id.decode()
                        celery.control.revoke(result_id, terminate=True)
                    except:
                        pass
                
                user_id = current_user.id
                bucket = Config.BUCKET
                result = calculate_activity_pattern.apply_async(queue='statistics', kwargs={'task_ids': task_ids, 'species': species, 'baseUnit': baseUnit, 'trapgroups': trapgroups, 'groups': groups, 'startDate': startDate, 'endDate': endDate, 'unit': unit, 'centre': centre, 'time': time, 'overlap': overlap, 'user_id': user_id, 'folder': folder, 'bucket': bucket, 'csv': csv, 'timeToIndependence': timeToIndependence, 'timeToIndependenceUnit': timeToIndependenceUnit})
                GLOBALS.redisClient.set('analysis_' + str(user_id), result.id)
                status = 'PENDING'
        else:
            result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
            if result_id:
                result = calculate_activity_pattern.AsyncResult(result_id)
                status = result.state
                if status == 'SUCCESS':
                    celery_result = result.result
                    if celery_result['status'] == 'SUCCESS':
                        activity_results = celery_result['activity_results']
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                    else:
                        message = celery_result['error']
                        status = 'FAILURE'
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                elif status == 'FAILURE':
                    message = 'Task {} failed'.format(result_id)
                    result.forget()
                    GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                    clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
            else:
                activity_results = None
                message = 'No task ID'
                GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})

    return json.dumps({'status': status, 'activity_results': activity_results, 'message': message, 'folder': folder})


@app.route('/getRScript', methods=['POST'])
@login_required
def getRScript():
    ''' Get the R script for a analysis type'''
    filename = ast.literal_eval(request.form['filename'])

    if Config.DEBUGGING: app.logger.info('R script requested for {}'.format(filename))
    script = ''
    with open('WorkR/R/' + filename + '.R', 'r') as file:
        script = file.read()
        script = script[script.find('library'):]
        
    return json.dumps({'status': 'success', 'script': script})

@app.route('/getResultsSummary', methods=['POST'])
@login_required
def getResultsSummary():
    ''' Get the results summary of your data'''
    if 'task_ids' in request.form:
        task_ids = ast.literal_eval(request.form['task_ids'])
        baseUnit = ast.literal_eval(request.form['baseUnit'])
        sites = ast.literal_eval(request.form['sites'])
        groups = ast.literal_eval(request.form['groups'])
        if 'startDate' in request.form:
            startDate = ast.literal_eval(request.form['startDate'])
        else:
            startDate = None
        if 'endDate' in request.form:	
            endDate = ast.literal_eval(request.form['endDate'])
        else:
            endDate = None
        trapUnit = ast.literal_eval(request.form['trapUnit'])
        if baseUnit == '4':
            timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
            timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
        else:
            timeToIndependence = None
            timeToIndependenceUnit = None
        
        normaliseBySite = ast.literal_eval(request.form['normaliseBySite'])
        if normaliseBySite == '1':
            normaliseBySite = True
        else:
            normaliseBySite = False

        if Config.DEBUGGING: app.logger.info('Results summary for tasks:{} baseUnit:{} sites:{} groups:{} startDate:{} endDate:{} trapUnit:{} timeToIndependence:{} timeToIndependenceUnit:{}'.format(task_ids,baseUnit,sites,groups,startDate,endDate,trapUnit,timeToIndependence,timeToIndependenceUnit))
    else:
        task_ids = None


    status = 'FAILURE'
    summary = None
    celery_result = None
    message = None
    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if GLOBALS.redisClient.get('analysis_' + str(current_user.id)):
                result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
                try:
                    result_id = result_id.decode()
                    celery.control.revoke(result_id, terminate=True)
                except:
                    pass

            user_id = current_user.id
            result = calculate_results_summary.apply_async(kwargs={'task_ids': task_ids, 'baseUnit': baseUnit, 'sites': sites, 'groups': groups,'startDate': startDate, 'endDate': endDate, 'user_id': user_id, 'trapUnit': trapUnit, 'timeToIndependence': timeToIndependence, 'timeToIndependenceUnit': timeToIndependenceUnit, 'normaliseBySite': normaliseBySite})
            GLOBALS.redisClient.set('analysis_' + str(user_id), result.id)
            status = 'PENDING'
        else:
            result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
            if result_id:
                result_id = result_id.decode()
                result = calculate_results_summary.AsyncResult(result_id)
                status = result.state
                if status == 'SUCCESS':
                    celery_result = result.result
                    if celery_result['status'] == 'SUCCESS':
                        summary = celery_result['summary']
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                    else:
                        status = celery_result['status']
                        message = celery_result['error']
                        summary = {}
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                elif status == 'FAILURE':
                    message = 'Task {} failed'.format(result_id)
                    summary = {}
                    result.forget()
                    GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
            else:
                summary = {}
                message = 'No task ID'
                GLOBALS.redisClient.delete('analysis_' + str(current_user.id))

    return json.dumps({'status': status, 'summary': summary, 'message': message})


@app.route('/getOccupancy', methods=['POST'])
@login_required
def getOccupancy():
    ''' Get the occupancy analysis for a species '''
    if 'task_ids' in request.form:
        task_ids = ast.literal_eval(request.form['task_ids'])
        species = ast.literal_eval(request.form['species'])
        baseUnit = ast.literal_eval(request.form['baseUnit'])
        trapgroups = ast.literal_eval(request.form['trapgroups'])
        window = ast.literal_eval(request.form['window'])
        siteCovs = ast.literal_eval(request.form['siteCovs'])
        detCovs = ast.literal_eval(request.form['detCovs'])
        covOptions = ast.literal_eval(request.form['covOptions'])
        groups = ast.literal_eval(request.form['groups'])
        if 'startDate' in request.form:
            startDate = ast.literal_eval(request.form['startDate'])
        else:
            startDate = None
        if 'endDate' in request.form:	
            endDate = ast.literal_eval(request.form['endDate'])
        else:
            endDate = None
        if baseUnit == '4':
            timeToIndependence = ast.literal_eval(request.form['timeToIndependence'])
            timeToIndependenceUnit = ast.literal_eval(request.form['timeToIndependenceUnit'])
        else:
            timeToIndependence = None
            timeToIndependenceUnit = None
        csv = ast.literal_eval(request.form['csv'])
        if csv == '1':
            csv = True
        else:
            csv = False
        
        folder = None

        if Config.DEBUGGING: app.logger.info('Occupancy data requested for tasks:{} species:{} baseUnit:{} trapgroups:{} window:{} siteCovs:{} detCovs:{} covOptions:{} groups:{} startDate:{} endDate:{} csv:{}'.format(task_ids,species,baseUnit,trapgroups,window,siteCovs,detCovs,covOptions,groups,startDate,endDate,csv))
    else:
        task_ids = None
        folder = ast.literal_eval(request.form['folder'])
    
    status = 'FAILURE'
    celery_result = None
    occupancy_results = None
    message = None
    R_type = 'occupancy'
    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if task_ids[0] == '0':
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').first()
            else:
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.id.in_(task_ids)), current_user.id, 'read').first()
            if survey:
                folder = survey[1]

                if GLOBALS.redisClient.get('analysis_' + str(current_user.id)):
                    result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
                    try:
                        result_id = result_id.decode()
                        celery.control.revoke(result_id, terminate=True)
                    except:
                        pass

                user_id = current_user.id
                bucket = Config.BUCKET
                result = calculate_occupancy_analysis.apply_async(queue='statistics', kwargs={'task_ids': task_ids, 'species': species, 'baseUnit': baseUnit, 'trapgroups': trapgroups, 'groups': groups, 'startDate': startDate, 'endDate': endDate, 'window': window, 'siteCovs': siteCovs, 'detCovs': detCovs, 'covOptions': covOptions, 'user_id': user_id, 'folder': folder, 'bucket': bucket, 'csv': csv, 'timeToIndependence': timeToIndependence, 'timeToIndependenceUnit': timeToIndependenceUnit})
                GLOBALS.redisClient.set('analysis_' + str(user_id), result.id)
                status = 'PENDING'
        else:
            result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
            if result_id:
                result = calculate_occupancy_analysis.AsyncResult(result_id)
                status = result.state
                if status == 'SUCCESS':
                    celery_result = result.result
                    if celery_result['status'] == 'SUCCESS':
                        occupancy_results = celery_result['occupancy_results']
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                    else:
                        status = celery_result['status']
                        message = celery_result['error']
                        occupancy_results = {}
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                elif status == 'FAILURE':
                    message = 'Task {} failed'.format(result_id)
                    occupancy_results = {}
                    result.forget()
                    GLOBALS.redisClient.delete('occupancy_analysis_' + str(current_user.id))
                    clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
            else:
                occupancy_results = {}
                message = 'No task ID'
                GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})

    return json.dumps({'status': status, 'results': occupancy_results, 'message': message, 'folder': folder})

@app.route('/getCovariateCSV', methods=['POST'])
@login_required
def getCovariateCSV():
    ''' Converts the covariate data to CSV '''
    siteCovs = ast.literal_eval(request.form['siteCovs'])
    detCovs = ast.literal_eval(request.form['detCovs'])
    task_ids = ast.literal_eval(request.form['task_ids'])
    cov_url = None

    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if task_ids[0] == '0':
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').first()
            else:
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.id.in_(task_ids)), current_user.id, 'read').first()

            if survey:
                folder = survey[1]

                if (len(siteCovs) > 0):
                    site_covs = pd.DataFrame(siteCovs)
                    site_covs = site_covs.rename(columns={'covariate': 'site_id'}).set_index('site_id').transpose()
                    site_covs = site_covs.rename_axis('site_id').reset_index()
                    site_covs = site_covs.rename_axis(None, axis=1)
                else:
                    site_covs = pd.DataFrame()
                    site_covs['site_id'] = None

                if (len(detCovs) > 0):
                    det_covs = pd.DataFrame(detCovs)
                    det_covs = det_covs.rename(columns={'covariate': 'site_id'}).set_index('site_id').transpose()
                    det_covs = det_covs.rename_axis('site_id').reset_index()
                    det_covs = det_covs.rename_axis(None, axis=1)
                else:
                    det_covs = pd.DataFrame()
                    det_covs['site_id'] = None

                covs = pd.merge(site_covs, det_covs, on='site_id', how='outer')

                if (len(covs) > 0):
                    covs[['site_id', 'latitude', 'longitude']] = covs['site_id'].str.split('_', expand=True)

                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    covs.to_csv(temp_file.name, index=False)
                    fileName = folder +'/docs/' + current_user.username + '_Occupancy_Covariates.csv'
                    GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=fileName,Body=temp_file)
                    cov_url = "https://"+ Config.BUCKET + ".s3.amazonaws.com/" + fileName.replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C')

                    # Schedule deletion
                    deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=3600)


    return json.dumps({'cov_url': cov_url})

@app.route('/getSpatialCaptureRecapture', methods=['POST'])
@login_required
def getSpatialCaptureRecapture():
    ''' Get the spatial capture-recapture analysis for a species '''
    if 'task_ids' in request.form:
        task_ids = ast.literal_eval(request.form['task_ids'])
        species = ast.literal_eval(request.form['species'])
        trapgroups = ast.literal_eval(request.form['trapgroups'])
        window = ast.literal_eval(request.form['window'])
        tags = ast.literal_eval(request.form['tags'])
        siteCovs = ast.literal_eval(request.form['siteCovs'])
        covOptions = ast.literal_eval(request.form['covOptions'])
        groups = ast.literal_eval(request.form['groups'])
        if 'startDate' in request.form:
            startDate = ast.literal_eval(request.form['startDate'])
        else:
            startDate = None
        if 'endDate' in request.form:	
            endDate = ast.literal_eval(request.form['endDate'])
        else:
            endDate = None
        csv = ast.literal_eval(request.form['csv'])
        if csv == '1':
            csv = True
        else:
            csv = False

        if 'shapefile' in request.files:
            shapefile_file = request.files['shapefile']
        else:
            shapefile_file = None

        if 'shxfile' in request.files:
            shxfile_file = request.files['shxfile']
        else:
            shxfile_file = None

        if 'polygonGeoJSON' in request.form:
            polygonGeoJSON = ast.literal_eval(request.form['polygonGeoJSON'])
        else:
            polygonGeoJSON = None

        if 'flank' in request.form:
            flank = ast.literal_eval(request.form['flank'])
            if flank in Config.FLANK_DB.keys(): flank = Config.FLANK_DB[flank]
        else:
            flank = None

        folder = None

        if Config.DEBUGGING: app.logger.info('SCR data requested for tasks:{} species:{} trapgroups:{} groups:{} window:{} tags:{} siteCovs:{} covOptions:{} startDate:{} endDate:{} csv:{}'.format(task_ids,species,trapgroups,groups,window,tags,siteCovs,covOptions,startDate,endDate,csv))
    else:
        task_ids = None
        folder = ast.literal_eval(request.form['folder'])
    
    status = 'FAILURE'
    celery_result = None
    scr_results = None
    msg = None
    R_type = 'scr'
    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if task_ids[0] == '0':
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').first()
            else:
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.id.in_(task_ids)), current_user.id, 'read').first()

            if survey:
                folder = survey[1]

                if GLOBALS.redisClient.get('analysis_' + str(current_user.id)):
                    result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
                    try:
                        result_id = result_id.decode()
                        celery.control.revoke(result_id, terminate=True)
                    except:
                        pass

                # check if any indiviuals exist for the species 
                count = db.session.query(Individual).join(Task, Individual.tasks).filter(Task.id.in_(task_ids)).filter(Individual.species==species).count()

                if count == 0:
                    status = 'NO_INDIVIDUALS'
                    msg = 'No individuals found for the species.'	
                else:
                    user_id = current_user.id
                    bucket = Config.BUCKET

                    # save shapefile to user folder
                    if shapefile_file:
                        with tempfile.NamedTemporaryFile(delete=True, suffix='.shp') as temp_file:
                            shapefile_file.save(temp_file.name)
                            fileName = folder +'/docs/' + current_user.username + '_SCR_' + shapefile_file.filename
                            GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=fileName,Body=temp_file)
                            shapefile = fileName
                    else:
                        shapefile = None

                    # save shxfile to user folder
                    if shxfile_file:
                        with tempfile.NamedTemporaryFile(delete=True, suffix='.shx') as temp_file:
                            shxfile_file.save(temp_file.name)
                            fileName = folder + '/docs/' + current_user.username + '_SCR_' + shxfile_file.filename
                            GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=fileName,Body=temp_file)
                            shxfile = fileName
                    else:
                        shxfile = None

                    result = calculate_spatial_capture_recapture.apply_async(kwargs={'task_ids': task_ids, 
                                                                                    'species': species,
                                                                                    'trapgroups': trapgroups, 
                                                                                    'groups': groups, 
                                                                                    'startDate': startDate, 
                                                                                    'endDate': endDate, 
                                                                                    'window': window, 
                                                                                    'tags': tags, 
                                                                                    'siteCovs': siteCovs, 
                                                                                    'covOptions': covOptions,
                                                                                    'user_id': user_id, 
                                                                                    'folder': folder, 
                                                                                    'bucket': bucket, 
                                                                                    'csv': csv, 
                                                                                    'shapefile': shapefile, 
                                                                                    'polygonGeoJSON': polygonGeoJSON, 
                                                                                    'shxfile': shxfile,
                                                                                    'flank': flank}, queue='statistics')
                    GLOBALS.redisClient.set('analysis_' + str(user_id), result.id)
                    status = 'PENDING'
        else:
            result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
            if result_id:
                result = calculate_spatial_capture_recapture.AsyncResult(result_id)
                status = result.state
                if status == 'SUCCESS':
                    celery_result = result.result
                    if celery_result['status'] == 'SUCCESS':
                        scr_results = celery_result['scr_results']
                        if isinstance(scr_results, dict) and 'summary' in scr_results.keys():
                            if 'Flank' in scr_results['summary'][0].keys() and scr_results['summary'][0]['Flank'] != 'All':
                                scr_results['summary'][0]['Flank'] = Config.FLANK_TEXT[scr_results['summary'][0]['Flank']].capitalize()
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                    else:
                        status = celery_result['status']
                        msg = celery_result['error']
                        scr_results = {}
                        result.forget()
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
                elif status == 'FAILURE':
                    msg = 'Task {} failed'.format(result_id)
                    scr_results = {}
                    result.forget()
                    GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                    clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})
            else:
                msg = 'No task id found'
                scr_results = {}
                GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                clean_up_R_results.apply_async(kwargs={'R_type': R_type, 'folder': folder, 'user_name': current_user.username})

    return json.dumps({'status': status, 'results': scr_results, 'message': msg, 'folder': folder})

@app.route('/populateSiteSelector')
@login_required
def populateSiteSelector():
    '''Returns site list for populating the site selector.'''
    response = []
    survey = current_user.turkcode[0].task.survey
    if survey and checkSurveyPermission(current_user.id, survey.id, 'read'):
        sites = db.session.query(Trapgroup.id, Trapgroup.tag).filter(Trapgroup.survey_id==survey.id).all()
        response.append((0, 'All'))
        for site in sites:
            response.append(tuple(site))

    return json.dumps(response)

@app.route('/cancelResults', methods=['POST'])
@login_required
def cancelResults():
    ''' Cancel a results analysis '''
    status = 'FAILURE'
    result_type = ast.literal_eval(request.form['result_type'])
    task_ids = ast.literal_eval(request.form['task_ids'])
    
    if current_user.is_authenticated and current_user.admin:
        if task_ids:
            if task_ids[0] == '0':
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).group_by(Task.survey_id).order_by(Task.id), current_user.id, 'read').first()
            else:
                survey = surveyPermissionsSQ(db.session.query(Survey.id, Organisation.folder).join(Task).filter(Task.id.in_(task_ids)), current_user.id, 'read').first()
            
            if survey:
                folder = survey[1]

                result_id = GLOBALS.redisClient.get('analysis_' + str(current_user.id))
                if result_id:
                    try:
                        result_id = result_id.decode()
                        if result_type == 'summary':
                            celery.control.revoke(result_id, terminate=True)
                        else:
                            celery.control.revoke(result_id, terminate=True)
                            clean_up_R_results.apply_async(kwargs={'R_type': result_type, 'folder': folder, 'user_name': current_user.username})
                        if Config.DEBUGGING: app.logger.info('Revoked task {}'.format(result_id))
                        GLOBALS.redisClient.delete('analysis_' + str(current_user.id))
                        status = 'SUCCESS'
                    except:
                        status = 'FAILURE'
                        pass
                else:
                    status = 'SUCCESS'

    return json.dumps({'status': status})

@app.route('/getGroupSites', methods=['POST'])
@login_required
def getGroupSites():
    ''' Get the sites for a group '''
    sites_data = []
    group_ids = ast.literal_eval(request.form['group_ids'])

    if group_ids == '0':
        survey_ids = []
        permission = []
        group_ids = [r[0] for r in surveyPermissionsSQ(db.session.query(Sitegroup.id).join(Trapgroup, Sitegroup.trapgroups).join(Survey),current_user.id,'read').distinct().all()]
    else:
        survey_ids = [r.id for r in db.session.query(Survey.id).join(Trapgroup).join(Sitegroup,Trapgroup.sitegroups).filter(Sitegroup.id.in_(group_ids)).distinct().all()]
        permission = surveyPermissionsSQ(db.session.query(Survey.id).filter(Survey.id.in_(survey_ids)),current_user.id,'read').distinct().all()

    if current_user and current_user.is_authenticated and (len(survey_ids)==len(permission)):
        sites = db.session.query(
                                Trapgroup.id,
                                Trapgroup.tag,
                                Trapgroup.latitude,
                                Trapgroup.longitude
                            )\
                            .join(Sitegroup, Trapgroup.sitegroups)\
                            .filter(Sitegroup.id.in_(group_ids))

        # Combine sites with the same tag, latitude and longitude and make their ids a comma separated list and rename to ids
        sites_df = pd.DataFrame(sites.order_by(Trapgroup.id).distinct().all(),columns=['id','tag','latitude','longitude'])
        sites_df['ids'] = sites_df.groupby(['tag','latitude','longitude'])['id'].transform(lambda x: ','.join(x.astype(str)))
        sites_df.drop_duplicates(subset=['tag','latitude','longitude'],inplace=True)
        sites_df.drop(columns=['id'],inplace=True)

        sites_data = sites_df.to_dict('records')
        sites_data = list(sites_data)

    return json.dumps({'sites': sites_data})

@app.route('/settings')
def settings():
    '''Renders the settings page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.parent_id == None:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            return render_template('html/settings.html', title='Settings', helpFile='settings_page', bucket=Config.BUCKET, version=Config.VERSION)   
        else:
            if current_user.turkcode[0].task.is_bounding:
                return redirect(url_for('sightings'))
            elif '-4' in current_user.turkcode[0].task.tagging_level:
                return redirect(url_for('clusterID'))
            elif '-5' in current_user.turkcode[0].task.tagging_level:
                return redirect(url_for('individualID'))
            else:
                return redirect(url_for('index'))

@app.route('/getAllLabels')
@login_required
def getAllLabels():
    ''' Get all the labels for a user '''    
    labels = []
    if current_user and current_user.is_authenticated:
        labels = [r[0] for r in surveyPermissionsSQ(db.session.query(Label.description).join(Task).join(Survey),current_user.id,'read').distinct().all()]

    return json.dumps({'labels': labels})

@app.route('/saveIntegrations', methods=['POST'])
@login_required
def saveIntegrations():
    ''' Save the integration details '''
    integrations = ast.literal_eval(request.form['integrations'])

    status = 'FAILURE'
    message = 'Unable to save integrations.'
    new_api_keys = []
    if current_user and current_user.is_authenticated:
        admin_data = db.session.query(Survey.id, Organisation.id).join(Organisation).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').all()
        admin_orgs = list(set([r[1] for r in admin_data]))
        admin_surveys = [r[0] for r in admin_data]

        try:
            # EarthRanger
            earth_ranger_integrations = integrations['earthranger']
            er_deleted = earth_ranger_integrations['deleted']
            er_edited = earth_ranger_integrations['edited']
            er_new = earth_ranger_integrations['new']

            if Config.DEBUGGING: app.logger.info('Earth ranger integrations {}'.format(earth_ranger_integrations))

            for er in er_deleted:
                er_integration = db.session.query(EarthRanger).filter(EarthRanger.id==er).first()
                if er_integration and er_integration.organisation_id in admin_orgs:
                    db.session.delete(er_integration)

            for er in er_edited:
                if int(er['org_id']) in admin_orgs:
                    er_integration = db.session.query(EarthRanger).filter(EarthRanger.id==er['id']).first()
                    if er_integration and er_integration.organisation_id in admin_orgs:
                        er_integration.label = er['species']
                        er_integration.api_key = er['api_key']
                        er_integration.organisation_id = er['org_id']

            for er in er_new:
                if int(er['org_id']) in admin_orgs:
                    check_er = db.session.query(EarthRanger).filter(EarthRanger.organisation_id==er['org_id']).filter(EarthRanger.label==er['species']).filter(EarthRanger.api_key==er['api_key']).first()
                    if not check_er:
                        er_integration = EarthRanger(organisation_id=er['org_id'], api_key=er['api_key'], label=er['species'])
                        db.session.add(er_integration)


            # Live Data
            live_integrations = integrations['live']
            live_deleted = live_integrations['deleted']
            live_new = live_integrations['new']

            if Config.DEBUGGING: app.logger.info('Live integrations {}'.format(live_integrations))

            for live in live_deleted:
                live_integration = db.session.query(APIKey).filter(APIKey.id==live).first()
                if live_integration and live_integration.survey_id in admin_surveys:
                    db.session.delete(live_integration)

            for live in live_new:
                if int(live['survey_id']) in admin_surveys:
                    check = db.session.query(APIKey).filter(APIKey.survey_id==live['survey_id']).first()
                    if not check:
                        keys = generate_api_key(live['survey_id'])
                        api_key = keys['api_key']
                        hashed_key = keys['hashed_key']
                        live_integration = APIKey(api_key=hashed_key, survey_id=live['survey_id'])
                        db.session.add(live_integration)
                        new_api_keys.append({'api_key': api_key, 'survey_id': live['survey_id']})

            db.session.commit()
            status = 'SUCCESS'
            message = 'Integrations saved successfully.'

        except:
            status = 'FAILURE'
            message = 'Unable to save integrations.'

    return json.dumps({'status': status, 'message': message, 'new_api_keys': new_api_keys})

@app.route('/getIntegrations')
@login_required
def getIntegrations():
    ''' Get the Earth Ranger integration details '''

    integrations = []
    if current_user and current_user.is_authenticated:
        earth_ranger_integrations = db.session.query(EarthRanger)\
                                                .join(Organisation)\
                                                .join(UserPermissions)\
                                                .filter(UserPermissions.default=='admin')\
                                                .filter(UserPermissions.user_id==current_user.id)\
                                                .order_by(EarthRanger.id).distinct().all()
        
        er = {}
        for earth_ranger_integration in earth_ranger_integrations:
            api_key = earth_ranger_integration.api_key
            label = earth_ranger_integration.label
            id = earth_ranger_integration.id
            organisation = earth_ranger_integration.organisation_id
            if api_key in er:
                er[api_key]['species'].append(label)
                er[api_key]['ids'].append(id)
            else:
                er[api_key] = {'species': [label], 'ids': [id], 'organisation': organisation}

        for key, value in er.items():
            integrations.append({
                'integration': 'earthranger',
                'api_key': key,
                'species': value['species'],
                'ids': value['ids'],
                'organisation': value['organisation']
            })

        live_integrations = db.session.query(APIKey.id, Survey.id, Survey.name)\
                                            .join(Survey)\
                                            .join(Organisation)\
                                            .join(UserPermissions)\
                                            .filter(UserPermissions.default=='admin')\
                                            .filter(UserPermissions.user_id==current_user.id)\
                                            .order_by(APIKey.id).distinct().all()
        
        for live_integration in live_integrations:
            integrations.append({
                'integration': 'live',
                'id': live_integration[0],
                'survey_id': live_integration[1],
                'survey': live_integration[2]
            })

    return json.dumps({'integrations': integrations})

@app.route('/permissions')
def permissions():
    '''Renders the settings page.'''
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.admin:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            return render_template('html/permissions.html', title='Permissions', helpFile='permissions', bucket=Config.BUCKET, version=Config.VERSION)
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            elif current_user.parent_id != None:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

@app.route('/getUsers')
@login_required
def getUsers():
    ''' Get all the user permissions for an organisation '''
    users = []
    next_users = None
    prev_users = None

    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)
    search = request.args.get('search', '', type=str)

    if current_user and current_user.is_authenticated:
        organisation_ids = [r[0] for r in db.session.query(Organisation.id).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').distinct().all()]
        if len(organisation_ids) > 0:
            user_permissions = db.session.query(
                                                User.id,
                                                User.username,
                                                User.email,
                                                UserPermissions.delete,
                                                UserPermissions.create,
                                                UserPermissions.annotation,
                                                UserPermissions.default,
                                                Organisation.id,
                                                Organisation.name,
                                                Organisation.root_user_id
                                            )\
                                            .join(UserPermissions, User.id==UserPermissions.user_id)\
                                            .join(Organisation)\
                                            .filter(Organisation.id.in_(organisation_ids))\
                                            .filter(User.id!=Organisation.root_user_id)


            searches = re.split('[ ,]',search)
            for search in searches:
                user_permissions = user_permissions.filter(or_(User.username.contains(search),Organisation.name.contains(search)))

            if order == 1:
                user_permissions = user_permissions.order_by(User.username)
            elif order == 2:
                user_permissions = user_permissions.order_by(UserPermissions.id)
            elif order == 3:
                user_permissions = user_permissions.order_by(desc(UserPermissions.id))

            user_permissions = user_permissions.distinct().paginate(page, 6, False)

            users_ids = {}
            for user_permission in user_permissions.items:
                if user_permission[0] in users_ids:
                    users[users_ids[user_permission[0]]]['user_permissions'].append({
                        'delete': user_permission[3],
                        'create': user_permission[4],
                        'annotation': user_permission[5],
                        'default': user_permission[6],
                        'organisation_id': user_permission[7],
                        'organisation': user_permission[8]
                    })

                else:
                    users.append({
                        'id': user_permission[0],
                        'username': user_permission[1],
                        'email': user_permission[2],
                        'user_permissions': [{
                            'delete': user_permission[3],
                            'create': user_permission[4],
                            'annotation': user_permission[5],
                            'default': user_permission[6],
                            'organisation_id': user_permission[7],
                            'organisation': user_permission[8]
                        }]
                    })
                    users_ids[user_permission[0]] = len(users)-1

            next_users = user_permissions.next_num if user_permissions.has_next else None
            prev_users = user_permissions.prev_num if user_permissions.has_prev else None

    return json.dumps({'users':users, 'next': next_users, 'prev': prev_users})


@app.route('/savePermissions', methods=['POST'])
@login_required
def savePermissions():

    permission_type = ast.literal_eval(request.form['permission_type'])
    permission_value = ast.literal_eval(request.form['permission_value'])
    user_id = ast.literal_eval(request.form['user_id'])
    organisation_id = ast.literal_eval(request.form['organisation_id'])

    if Config.DEBUGGING: app.logger.info('Permission type: {} Permission value: {} User id: {} Organisation id: {}'.format(permission_type, permission_value, user_id, organisation_id))

    status = 'FAILURE'
    message = 'Unable to save permissions.'
    permission_order = [None, 'worker', 'hidden', 'read', 'write', 'admin']

    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,organisation_id):
        user_permission = db.session.query(UserPermissions).filter(UserPermissions.user_id==user_id).filter(UserPermissions.organisation_id==organisation_id).first()
        org_name = db.session.query(Organisation.name).filter(Organisation.id==organisation_id).first()[0]
        user_name = db.session.query(User.username).filter(User.id==user_id).first()[0]
        if user_permission:
            user_msg = ''
            org_msg = ''
            old_default = ''
            if permission_type == 'default':
                old_default = user_permission.default
                user_permission.default = permission_value
                user_msg = '<p> Your default permission for organisation {} has been set to {}.'.format(org_name, permission_value)
                org_msg = '<p> The default permission for user {} has been set to {} for organisation {}.'.format(user_name, permission_value, org_name)

                if permission_value == 'admin' or permission_value == 'worker':
                    user_permission_exceptions = db.session.query(SurveyPermissionException).join(Survey).filter(SurveyPermissionException.user_id==user_id).filter(Survey.organisation_id==organisation_id).all()
                    for user_permission_exception in user_permission_exceptions:
                        db.session.delete(user_permission_exception)
            
                if permission_order.index(permission_value) < permission_order.index('write'): 
                    if user_permission.delete:
                        user_permission.delete = False
                        user_msg += ' Your delete permission for organisation {} has been revoked.'.format(org_name)
                        org_msg += ' The delete permission for user {} has been set to False for organisation {}.'.format(user_name, org_name)

                if permission_order.index(permission_value) < permission_order.index('hidden'):
                    if user_permission.create:
                        user_permission.create = False
                        user_msg += ' Your create permission for organisation {} has been revoked.'.format(org_name)
                        org_msg += ' The create permission for user {} has been set to False for organisation {}.'.format(user_name, org_name)

                user_msg += '</p>'
                org_msg += '</p>'

            elif permission_type == 'delete':
                if permission_value == '1':
                    if permission_order.index(user_permission.default) >= permission_order.index('write'):
                        user_permission.delete = True
                        user_msg = '<p> You have been granted delete permission for organisation {}.</p>'.format(org_name)
                        org_msg = '<p> The delete permission for user {} has been set to True for organisation {}.</p>'.format(user_name, org_name)
                else:
                    user_permission.delete = False
                    user_msg = '<p> Your delete permission for organisation {} has been revoked.</p>'.format(org_name)
                    org_msg = '<p> The delete permission for user {} has been set to False for organisation {}.</p>'.format(user_name, org_name)
            elif permission_type == 'create':
                if permission_value == '1':
                    if permission_order.index(user_permission.default) >= permission_order.index('hidden'):
                        user_permission.create = True
                        user_msg = '<p> You have been granted create permission for organisation {}.</p>'.format(org_name)
                        org_msg = '<p> The create permission for user {} has been set to True for organisation {}.</p>'.format(user_name, org_name)
                else:
                    user_permission.create = False
                    user_msg = '<p> Your create permission for organisation {} has been revoked.</p>'.format(org_name)
                    org_msg = '<p> The create permission for user {} has been set to False for organisation {}.</p>'.format(user_name, org_name)
            elif permission_type == 'annotation':
                if permission_value == '1':
                    user_permission.annotation = True
                    user_msg = '<p> You have been granted annotation permission for organisation {}.</p>'.format(org_name)
                    org_msg = '<p> The annotation permission for user {} has been set to True for organisation {}.</p>'.format(user_name, org_name)
                else:
                    user_permission.annotation = False
                    user_msg = '<p> Your annotation permission for organisation {} has been revoked.</p>'.format(org_name) 
                    org_msg = '<p> The annotation permission for user {} has been set to False for organisation {}.</p>'.format(user_name, org_name)

            if user_msg != '':
                notif = Notification(user_id=user_id, contents=user_msg, seen=False)
                db.session.add(notif)

            if org_msg != '':
                org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.default=='admin').filter(User.id!=user_id).distinct().all()]    
                for org_admin in org_admins:
                    notif = Notification(user_id=org_admin, contents=org_msg, seen=False)
                    db.session.add(notif)

            db.session.commit()

            updateUserAdminStatus(user_id)

            if permission_type == 'default':
                if old_default == 'admin' and permission_value != 'admin':
                    removeAdminNotifications(user_id, organisation_id)

            status = 'SUCCESS'
            message = 'Permissions saved successfully.'

    return json.dumps({'status': status, 'message': message})

@app.route('/getDetailedAccess/<user_id>/<org_id>')
@login_required
def getDetailedAccess(user_id, org_id):
    ''' Get the detailed access level for the specified user (id) '''

    detailed_access = []
    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,org_id):

        ss_subquery = db.session.query(SurveyShare.survey_id)\
                                .join(Survey, Survey.id==SurveyShare.survey_id)\
                                .join(Organisation, Organisation.id==Survey.organisation_id)\
                                .join(UserPermissions, UserPermissions.organisation_id==Organisation.id)\
                                .filter(UserPermissions.user_id==user_id)\
                                .filter(SurveyShare.organisation_id==org_id)\
                                .distinct().subquery()
    
        survey_permissions = db.session.query(SurveyPermissionException)\
                                        .join(Survey)\
                                        .outerjoin(SurveyShare)\
                                        .outerjoin(ss_subquery, Survey.id==ss_subquery.c.survey_id)\
                                        .filter(SurveyPermissionException.user_id==user_id)\
                                        .filter(or_(Survey.organisation_id==org_id,and_(ss_subquery.c.survey_id==None, SurveyShare.organisation_id==org_id)))\
                                        .distinct().all()

        for survey_permission in survey_permissions:
            detailed_access.append({
                'id': survey_permission.id,
                'survey_id': survey_permission.survey_id,
                'permission': survey_permission.permission,
                'annotation': survey_permission.annotation
            })

    return json.dumps({'detailed_access':detailed_access})

@app.route('/saveDetailedAccess', methods=['POST'])
@login_required
def saveDetailedAccess():
    '''Saves the submitted permission exceptions.'''

    user_id = ast.literal_eval(request.form['user_id'])
    org_id = ast.literal_eval(request.form['organisation_id'])
    detailed_access = ast.literal_eval(request.form['detailed_access'])

    if Config.DEBUGGING: app.logger.info('User {} permission exception {}.'.format(user_id, detailed_access))

    status = 'FAILURE'
    message = 'Unable to save permission exception.'

    permission_levels = [None, 'worker', 'hidden', 'read', 'write', 'admin']	

    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,org_id) and not checkDefaultAdminPermission(user_id,org_id):
        new_access = detailed_access['new']
        edited_access = detailed_access['edit']
        deleted_access = detailed_access['delete']

        for access in deleted_access:
            db.session.query(SurveyPermissionException).filter(SurveyPermissionException.id==access['id']).filter(SurveyPermissionException.user_id==user_id).delete()

        for access in edited_access:
            if access['annotation'] == '1':
                access['annotation'] = True
            else:
                access['annotation'] = False

            survey_permission = db.session.query(SurveyPermissionException).filter(SurveyPermissionException.id==access['id']).filter(SurveyPermissionException.user_id==user_id).first()
            
            shareCheck = db.session.query(SurveyShare).filter(SurveyShare.survey_id==access['survey_id']).filter(SurveyShare.organisation_id==org_id).first()
            if shareCheck:
                if shareCheck.permission != 'write':
                    if permission_levels.index(access['permission']) > permission_levels.index(shareCheck.permission):
                        access['permission'] = shareCheck.permission
                    access['annotation'] = False

            survey_permission.survey_id = access['survey_id']
            survey_permission.permission = access['permission']
            survey_permission.annotation = access['annotation']

        for access in new_access:
            if access['annotation'] == '1':
                access['annotation'] = True
            else:
                access['annotation'] = False

            shareCheck = db.session.query(SurveyShare).filter(SurveyShare.survey_id==access['survey_id']).filter(SurveyShare.organisation_id==org_id).first()
            if shareCheck:
                if shareCheck.permission != 'write':
                    if permission_levels.index(access['permission']) > permission_levels.index(shareCheck.permission):
                        access['permission'] = shareCheck.permission
                    access['annotation'] = False

            existCheck = db.session.query(SurveyPermissionException).filter(SurveyPermissionException.survey_id==access['survey_id']).filter(SurveyPermissionException.user_id==user_id).first()
            if not existCheck:
                survey_permission = SurveyPermissionException(user_id=user_id, survey_id=access['survey_id'], permission=access['permission'], annotation=access['annotation'])
                db.session.add(survey_permission)

        org_name = db.session.query(Organisation.name).filter(Organisation.id==org_id).first()[0]
        user_name = db.session.query(User.username).filter(User.id==user_id).first()[0]

        user_msg = '<p> Your permission exceptions for organisation {} have been updated.</p>'.format(org_name)
        notif = Notification(user_id=user_id, contents=user_msg, seen=False)
        db.session.add(notif)

        org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.default=='admin').distinct().all()]
        org_msg = '<p> The permission exceptions for user {} have been updated for organisation {}.</p>'.format(user_name, org_name)
        for org_admin in org_admins:
            notif = Notification(user_id=org_admin, contents=org_msg, seen=False)
            db.session.add(notif)

        db.session.commit()

        updateUserAdminStatus(user_id)

        status = 'SUCCESS'
        message = ''

    return json.dumps({'status':status, 'message': message})

@app.route('/getSharedData')
@login_required
def getSharedData():
    ''' Get all the surveys that have been shared with other organisations '''

    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)
    search = request.args.get('search', '', type=str)

    shared_data = []
    prev_data = None 
    next_data = None

    if current_user and current_user.is_authenticated:
        organisation_ids = [r[0] for r in db.session.query(Organisation.id).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').distinct().all()]
        if len(organisation_ids) > 0:
            shareOrganisation = alias(Organisation)

            survey_shares = db.session.query(
                                            SurveyShare.id,
                                            Organisation.id,    
                                            Organisation.name,
                                            User.email,
                                            Survey.id,
                                            Survey.name,
                                            SurveyShare.permission,
                                            shareOrganisation.c.id,
                                            shareOrganisation.c.name
                                        )\
                                        .join(Survey, Survey.id==SurveyShare.survey_id)\
                                        .join(Organisation, Organisation.id==SurveyShare.organisation_id)\
                                        .join(User, User.id==Organisation.root_user_id)\
                                        .join(shareOrganisation, shareOrganisation.c.id==Survey.organisation_id)\
                                        .filter(Survey.organisation_id.in_(organisation_ids))

            searches = re.split('[ ,]',search)
            for search in searches:
                survey_shares = survey_shares.filter(or_(Organisation.name.contains(search),Survey.name.contains(search)))

            if order == 1:
                survey_shares = survey_shares.order_by(Organisation.name)
            elif order == 2:
                survey_shares = survey_shares.order_by(SurveyShare.id)
            elif order == 3:
                survey_shares = survey_shares.order_by(desc(SurveyShare.id))

            survey_shares = survey_shares.distinct().paginate(page, 6, False)

            shared = {}
            for survey_share in survey_shares.items:
                if survey_share[1] in shared.keys():
                    shared[survey_share[1]]['surveys'].append({
                        'id': survey_share[4],
                        'ss_id': survey_share[0],
                        'name': survey_share[5],
                        'permission': survey_share[6],
                        'share_org_id': survey_share[7],
                        'share_org_name': survey_share[8]
                    })
                else:
                    shared[survey_share[1]] = {
                        'org_id': survey_share[1],
                        'organisation': survey_share[2],
                        'email': survey_share[3],
                        'surveys': [{
                            'id': survey_share[4],
                            'ss_id': survey_share[0],
                            'name': survey_share[5],
                            'permission': survey_share[6],
                            'share_org_id': survey_share[7],
                            'share_org_name': survey_share[8]
                        }]
                    }

            shared_data = list(shared.values())

            next_data = survey_shares.next_num if survey_shares.has_next else None
            prev_data = survey_shares.prev_num if survey_shares.has_prev else None

    return json.dumps({'shared_data':shared_data, 'next': next_data, 'prev': prev_data})

@app.route('/getReceivedData')
@login_required
def getReceivedData():
    ''' Get all the surveys that have been shared with the current organisation '''

    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)
    search = request.args.get('search', '', type=str)

    received_surveys = []
    prev_data = None
    next_data = None

    if current_user and current_user.is_authenticated:
        organisation_ids = [r[0] for r in db.session.query(Organisation.id).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').distinct().all()]
        if len(organisation_ids) > 0:
            receivedOrganisation = alias(Organisation)
            survey_shares = db.session.query(
                                            SurveyShare.id,
                                            Organisation.id,    
                                            Organisation.name,
                                            User.email,
                                            Survey.id,
                                            Survey.name,
                                            SurveyShare.permission,
                                            receivedOrganisation.c.id,
                                            receivedOrganisation.c.name
                                        )\
                                        .join(Survey, Survey.id==SurveyShare.survey_id)\
                                        .join(Organisation, Organisation.id==Survey.organisation_id)\
                                        .join(User, User.id==Organisation.root_user_id)\
                                        .join(receivedOrganisation, receivedOrganisation.c.id==SurveyShare.organisation_id)\
                                        .filter(SurveyShare.organisation_id.in_(organisation_ids))

            searches = re.split('[ ,]',search)
            for search in searches:
                survey_shares = survey_shares.filter(or_(Organisation.name.contains(search),Survey.name.contains(search)))

            if order == 1:
                survey_shares = survey_shares.order_by(Organisation.name)
            elif order == 2:
                survey_shares = survey_shares.order_by(SurveyShare.id)
            elif order == 3:
                survey_shares = survey_shares.order_by(desc(SurveyShare.id))

            survey_shares = survey_shares.distinct().paginate(page, 6, False)

            received = {}
            for survey_share in survey_shares.items:
                if survey_share[1] in received:
                    received[survey_share[1]]['surveys'].append({
                        'id': survey_share[4],
                        'ss_id': survey_share[0],
                        'name': survey_share[5],
                        'permission': survey_share[6],
                        'received_org_id': survey_share[7],
                        'received_org_name': survey_share[8]
                    })
                else:
                    received[survey_share[1]] = {
                        'org_id': survey_share[1],
                        'organisation': survey_share[2],
                        'email': survey_share[3],
                        'surveys': [{
                            'id': survey_share[4],
                            'ss_id': survey_share[0],
                            'name': survey_share[5],
                            'permission': survey_share[6],
                            'received_org_id': survey_share[7],
                            'received_org_name': survey_share[8]
                        }]
                    }

            received_surveys = list(received.values())

            next_data = survey_shares.next_num if survey_shares.has_next else None
            prev_data = survey_shares.prev_num if survey_shares.has_prev else None

    return json.dumps({'received_surveys':received_surveys, 'next': next_data, 'prev': prev_data})

@app.route('/saveSharedSurveyPermissions', methods=['POST'])
@login_required
def saveSharedSurveyPermissions():
    ''' Save the permissions for a shared survey '''

    permission_value = ast.literal_eval(request.form['permission_value'])
    survey_share_id = ast.literal_eval(request.form['survey_share_id'])
    org_id = ast.literal_eval(request.form['org_id'])

    status = 'FAILURE'	
    message = 'Unable to save permissions.'

    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,org_id):
        survey_share = db.session.query(SurveyShare).filter(SurveyShare.id==survey_share_id).first()
        rec_org_id = survey_share.organisation_id
        admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id.in_([org_id, rec_org_id])).filter(UserPermissions.default=='admin').distinct().all()]

        if survey_share:
            survey_share.permission = permission_value
            db.session.commit()

            notif_msg = '<p> The permission for shared survey {} has been set to {}.</p>'.format(survey_share.survey.name, permission_value)
            for admin in admins:
                notif = Notification(user_id=admin, contents=notif_msg, seen=False)
                db.session.add(notif)

            # Change all survey permission exceptions that has a higher permission then the new survey share permission to the new survey share permission (excluding users who belong to organisation that shared survey)
            ss_subquery = db.session.query(UserPermissions.user_id).filter(UserPermissions.organisation_id == org_id).subquery()
            survey_permission_exceptions = db.session.query(SurveyPermissionException)\
                            .join(SurveyShare, SurveyShare.survey_id==SurveyPermissionException.survey_id)\
                            .join(UserPermissions,UserPermissions.organisation_id==SurveyShare.organisation_id)\
                            .outerjoin(ss_subquery, ss_subquery.c.user_id==UserPermissions.user_id)\
                            .filter(SurveyShare.id==survey_share_id)\
                            .filter(UserPermissions.organisation_id==rec_org_id)\
                            .filter(SurveyPermissionException.user_id==UserPermissions.user_id)\
                            .filter(ss_subquery.c.user_id==None)\
                            .distinct().all()


            permission_levels = ['worker', 'hidden', 'read', 'write', 'admin']

            for survey_permission_exception in survey_permission_exceptions:
                if permission_levels.index(survey_permission_exception.permission) > permission_levels.index(permission_value):
                    survey_permission_exception.permission = permission_value
                if permission_value != 'write':
                    survey_permission_exception.annotation = False

            db.session.commit()
            
            status = 'SUCCESS'
            message = ''

    return json.dumps({'status': status, 'message': message})

@app.route('/shareSurveys', methods=['POST'])
@login_required
def shareSurveys():
    ''' Shares surveys with organsisations '''

    shared_data = ast.literal_eval(request.form['shared_data'])
    organisation_name = ast.literal_eval(request.form['organisation_name'])
    status = 'FAILURE'
    message =  'Unable to share survey.'

    try:
        if current_user and current_user.is_authenticated:
            organisation = db.session.query(Organisation).filter(Organisation.name==organisation_name).first()
            if not organisation:
                return json.dumps({'status': 'FAILURE', 'message': 'Organisation does not exist.'})
            else:
                survey_id = shared_data['survey_id']
                permission = shared_data['permission']

                share_query = surveyPermissionsSQ(db.session.query(
                                                            Survey.name,
                                                            Organisation.id,
                                                            Organisation.name
                                                        )\
                                                        .filter(Survey.id==survey_id),current_user.id,'admin').distinct().first()

                if len(share_query) == 0:
                    return json.dumps({'status': 'FAILURE', 'message': 'You do not have permission to share this survey.'}) 
                else:
                    survey_name = share_query[0]
                    share_org_name = share_query[2]

                    organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]
                    share_org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==share_query[1]).filter(UserPermissions.default=='admin').all()]

                    check = db.session.query(SurveyShare).filter(SurveyShare.organisation_id==organisation.id).filter(SurveyShare.survey_id==survey_id).first()
                    if check:
                        return json.dumps({'status': 'FAILURE', 'message': 'Survey already shared with organisation.'})

                    token = jwt.encode({'organisation_id': organisation.id, 'survey_id': survey_id, 'permission': permission}, app.config['SECRET_KEY'], algorithm='HS256')
                    url = 'https://'+Config.DNS+'/acceptSurveyShare/'+token + '/'

                    prev_notification = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains('Organisation '+share_org_name+' wants to share survey '+survey_name+' with '+organisation.name+'.')).first()
                    if prev_notification:
                        return json.dumps({'status': 'FAILURE', 'message': 'Survey share request already sent.'})

                    cancel_url = 'https://'+Config.DNS+'/cancelSurveyShare/'+token 

                    for share_org_admin in share_org_admins:
                        pending_notif = '<p> '+share_org_name+' has a pending survey share request to '+organisation.name+' for '+survey_name+'. Do you wish to <a href="'+cancel_url+'">Cancel</a> the request?</p>'
                        notification = Notification(user_id=share_org_admin, contents=pending_notif, seen=False)
                        db.session.add(notification)

                    for organisation_admin in organisation_admins:
                        notification_message = '<p> Organisation '+share_org_name+' wants to share survey '+survey_name+' with '+organisation.name+'. Do you <a href="'+url+'accept">Accept</a> or <a href="'+url+'decline">Decline</a>?'
                        notification = Notification(user_id=organisation_admin, contents=notification_message, seen=False)
                        db.session.add(notification)

                    db.session.commit()

                    status = 'SUCCESS'
                    message = 'A notification has been sent to the organisation. You will be notified once they have accepted the survey share.'
    except:
        pass

    return json.dumps({'status':status, 'message': message})

@app.route('/acceptSurveyShare/<token>/<action>')
@login_required
def acceptSurveyShare(token, action):
    ''' Accepts or declines a survey share '''
    try:

        if current_user and current_user.is_authenticated:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            organisation_id = data['organisation_id']
            survey_id = data['survey_id']
            permission = data['permission']

            if checkDefaultAdminPermission(current_user.id,organisation_id):
            
                organisation = db.session.query(Organisation).get(organisation_id)
                survey = db.session.query(Survey).get(survey_id)
                share_organisation = survey.organisation
                organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]
                share_org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==share_organisation.id).filter(UserPermissions.default=='admin').all()]
                admins = share_org_admins + organisation_admins
                admins = list(set(admins))

                notifications = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains('Organisation '+share_organisation.name+' wants to share survey '+survey.name+' with '+organisation.name+'.')).all()
                for notification in notifications:
                    db.session.delete(notification)

                pending_notifications = db.session.query(Notification).filter(Notification.user_id.in_(share_org_admins)).filter(Notification.contents.contains(share_organisation.name+' has a pending survey share request to '+organisation.name+' for '+survey.name+'.')).all()
                for pending_notification in pending_notifications:
                    db.session.delete(pending_notification)

                if action == 'accept':
                    check = db.session.query(SurveyShare).filter(SurveyShare.organisation_id==organisation.id).filter(SurveyShare.survey_id==survey_id).first()
                    if not check:
                        survey_share = SurveyShare(organisation_id=organisation.id, survey_id=survey_id, permission=permission)
                        db.session.add(survey_share)

                        notif_msg = '<p>'+organisation.name+' has accepted the survey share request from '+share_organisation.name+' for '+survey.name+'.</p>'
                        for admin in admins:
                            notif_share_org = Notification(user_id=admin, contents=notif_msg, seen=False)
                            db.session.add(notif_share_org)

                else:
                    notif_msg = '<p>'+organisation.name+' has declined the survey share request from '+share_organisation.name+' for '+survey.name+'.</p>'
                    for admin in admins:
                        notif_share_org = Notification(user_id=admin, contents=notif_msg, seen=False)
                        db.session.add(notif_share_org)

                db.session.commit()

            else:
                removeAdminNotifications(current_user.id, organisation_id)

    except:
        pass

    return redirect(url_for('surveys'))

@app.route('/cancelSurveyShare/<token>')
@login_required
def cancelSurveyShare(token):
    ''' Cancels a survey share '''
    try:
        if current_user and current_user.is_authenticated:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            organisation_id = data['organisation_id']
            survey_id = data['survey_id']
            organisation = db.session.query(Organisation).get(organisation_id)
            survey = db.session.query(Survey).get(survey_id)
            share_organisation = survey.organisation

            if checkDefaultAdminPermission(current_user.id, share_organisation.id):
                organisation_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==organisation.id).filter(UserPermissions.default=='admin').all()]
                share_org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==share_organisation.id).filter(UserPermissions.default=='admin').all()]

                notifications = db.session.query(Notification).filter(Notification.user_id.in_(organisation_admins)).filter(Notification.contents.contains('Organisation '+share_organisation.name+' wants to share survey '+survey.name+' with '+organisation.name+'.')).all()
                for notification in notifications:
                    db.session.delete(notification)

                pending_notifications = db.session.query(Notification).filter(Notification.user_id.in_(share_org_admins)).filter(Notification.contents.contains(share_organisation.name+' has a pending survey share request to '+organisation.name+' for '+survey.name+'.')).all()
                for pending_notification in pending_notifications:
                    db.session.delete(pending_notification)

                cancel_notif = '<p> '+share_organisation.name+' has cancelled the survey share request to '+organisation.name+' for '+survey.name+'.</p>'
                for share_org_admin in share_org_admins:
                    notif_share_org = Notification(user_id=share_org_admin, contents=cancel_notif, seen=False)
                    db.session.add(notif_share_org)

                db.session.commit()
            
            else:
                removeAdminNotifications(current_user.id, share_organisation.id)

    except:
        pass

    return redirect(url_for('permissions'))

@app.route('/getOrganisations')
@login_required
def getOrganisations():
    ''' Gets all the organisations for the current user ''' 
    create = request.args.get('create', False, type=bool)
    organisations = []
    if current_user and current_user.is_authenticated:
        if create:
            orgs = db.session.query(Organisation.id, Organisation.name).join(UserPermissions).filter(UserPermissions.user_id == current_user.id).filter(UserPermissions.create == True).distinct().all()
        else:
            orgs = db.session.query(Organisation.id, Organisation.name).join(UserPermissions).filter(UserPermissions.user_id == current_user.id).distinct().all()
        for org in orgs:
            organisations.append({
                'id': org[0],
                'name': org[1]
            })

    return json.dumps({'organisations': organisations})

@app.route('/getAdminOrganisations')
@login_required
def getAdminOrganisations():
    ''' Gets all the organisations where the current user is an admin '''

    organisations = []
    include_surveys = request.args.get('include_surveys', False, type=bool)
    if current_user and current_user.is_authenticated:
        if include_surveys:
            surveys = []
            org_data = db.session.query(Survey.id, Survey.name, Organisation.id, Organisation.name).join(Organisation).join(UserPermissions).filter(UserPermissions.user_id == current_user.id).filter(UserPermissions.default == 'admin').distinct().all()
            org_added = []
            for data in org_data:
                surveys.append({
                    'id': data[0],
                    'name': data[1],
                })
                if data[2] not in org_added:
                    organisations.append({
                        'id': data[2],
                        'name': data[3]
                    })
                    org_added.append(data[2])
            
            return json.dumps({'organisations': organisations, 'surveys': surveys})
        else:
            orgs = db.session.query(Organisation.id, Organisation.name).join(UserPermissions).filter(UserPermissions.user_id == current_user.id).filter(UserPermissions.default == 'admin').distinct().all()
            for org in orgs:
                organisations.append({
                    'id': org[0],
                    'name': org[1]
                })

    return json.dumps({'organisations': organisations})
    
@app.route('/removeUserFromOrganisation', methods=['POST'])	
@login_required
def removeUserFromOrganisation():
    ''' Removes a user from an organisation '''

    user_id = ast.literal_eval(request.form['user_id'])
    org_id = ast.literal_eval(request.form['org_id'])

    status = 'FAILURE'
    message = 'Unable to remove user from organisation.'

    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,org_id):
        user_permission = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.user_id==user_id).first()
        db.session.delete(user_permission)

        ss_subquery = db.session.query(SurveyShare.survey_id)\
                                .join(Survey, Survey.id==SurveyShare.survey_id)\
                                .join(Organisation, Organisation.id==Survey.organisation_id)\
                                .join(UserPermissions, UserPermissions.organisation_id==Organisation.id)\
                                .filter(UserPermissions.user_id==user_id)\
                                .filter(SurveyShare.organisation_id==org_id)\
                                .distinct().subquery()
    
        user_exceptions = db.session.query(SurveyPermissionException)\
                                        .join(Survey)\
                                        .outerjoin(SurveyShare)\
                                        .outerjoin(ss_subquery, Survey.id==ss_subquery.c.survey_id)\
                                        .filter(SurveyPermissionException.user_id==user_id)\
                                        .filter(or_(Survey.organisation_id==org_id,and_(ss_subquery.c.survey_id==None, SurveyShare.organisation_id==org_id)))\
                                        .distinct().all()

        for user_exception in user_exceptions:
            db.session.delete(user_exception)

        org_name = db.session.query(Organisation.name).filter(Organisation.id==org_id).first()[0]
        org_admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.default=='admin').all()]

        user_notif = '<p> You have been removed from organisation '+org_name+'.</p>'
        notification = Notification(user_id=user_id, contents=user_notif, seen=False)
        db.session.add(notification)

        admin_notif = '<p> User '+current_user.username+' has been removed from organisation '+org_name+'.</p>'
        for org_admin in org_admins:
            notification = Notification(user_id=org_admin, contents=admin_notif, seen=False)
            db.session.add(notification)

        db.session.commit()

        updateUserAdminStatus(user_id)
        removeAdminNotifications(user_id, org_id)

        status = 'SUCCESS'
        message = 'User removed from organisation successfully.'

    return json.dumps({'status': status, 'message': message})

@app.route('/removeSharedSurvey', methods=['POST'])	
@login_required
def removeSharedSurvey():
    ''' Removes a shared/recieved survey '''
    survey_share_id = ast.literal_eval(request.form['survey_share_id'])

    status = 'FAILURE'
    message = 'Unable to remove shared survey.'

    if current_user and current_user.is_authenticated:
        survey_share = db.session.query(SurveyShare).filter(SurveyShare.id==survey_share_id).first()
        if survey_share:
            received_org = survey_share.organisation
            share_org = survey_share.survey.organisation
            admins = [r[0] for r in db.session.query(User.id).join(UserPermissions).filter(UserPermissions.organisation_id.in_([received_org.id, share_org.id])).filter(UserPermissions.default=='admin').distinct().all()]
            if current_user.id in admins:
                # Remove all survey permission exceptions 
                ss_subquery = db.session.query(UserPermissions.user_id).filter(UserPermissions.organisation_id == share_org.id).subquery()
                survey_permission_exceptions = db.session.query(SurveyPermissionException)\
                                .join(SurveyShare, SurveyShare.survey_id==SurveyPermissionException.survey_id)\
                                .join(UserPermissions,UserPermissions.organisation_id==SurveyShare.organisation_id)\
                                .outerjoin(ss_subquery, ss_subquery.c.user_id==UserPermissions.user_id)\
                                .filter(SurveyShare.id==survey_share.id)\
                                .filter(UserPermissions.organisation_id==received_org.id)\
                                .filter(SurveyPermissionException.user_id==UserPermissions.user_id)\
                                .filter(ss_subquery.c.user_id==None)\
                                .distinct().all()

                for survey_permission_exception in survey_permission_exceptions:
                    db.session.delete(survey_permission_exception)

                # Remove survey share
                db.session.delete(survey_share)
                
                notif_msg = '<p> Survey share for '+survey_share.survey.name+' from '+share_org.name+' to '+received_org.name+' has been removed.</p>'
                for admin in admins:
                    notification = Notification(user_id=admin, contents=notif_msg, seen=False)
                    db.session.add(notification)

                db.session.commit()

                status = 'SUCCESS'
                message = 'User removed from organisation successfully.'

    return json.dumps({'status': status, 'message': message})

@app.route('/getNotifications')
@login_required
def getNotifications():
    ''' Gets all the notifications for the current user '''

    notifications_data = []
    next = None
    prev = None

    page = request.args.get('page', 1, type=int)

    if current_user and current_user.is_authenticated and current_user.parent_id == None:
        notifications = db.session.query(Notification)\
                    .filter(or_(Notification.user_id==current_user.id, Notification.user_id==None))\
                    .filter(or_(Notification.expires==None,Notification.expires>datetime.utcnow()))\
                    .order_by(desc(Notification.id))\
                    .distinct().paginate(page, 8, False)

        for notification in notifications.items:
            seen_notif = False
            if notification.user_id == None:
                if current_user in notification.users_seen:
                    seen_notif = True
                else:
                    seen_notif = False
            else:
                if notification.seen == None:
                    seen_notif = False
                else:
                    seen_notif = notification.seen

            notifications_data.append({
                'id': notification.id,
                'contents': notification.contents,
                'seen': seen_notif,
                'user_id': notification.user_id
            })

        next = notifications.next_num if notifications.has_next else None
        prev = notifications.prev_num if notifications.has_prev else None

    return json.dumps({'notifications': notifications_data, 'next': next, 'prev': prev})

@app.route('/markNotificationSeen/<id>')
@login_required
def markNotificationSeen(id):
    ''' Marks a notification as seen '''

    status = 'FAILURE'
    message = 'Unable to mark notification as seen.'

    if current_user and current_user.is_authenticated and current_user.parent_id == None:
        notification = db.session.query(Notification).get(id)
        if notification:
            if notification.user_id == current_user.id:
                notification.seen = True
            elif notification.user_id == None:
                has_seen = db.session.query(userNotifications).filter(userNotifications.c.notification_id==id).filter(userNotifications.c.user_id==current_user.id).first()
                if not has_seen:
                    notification.users_seen.append(current_user)
            
            db.session.commit()

            status = 'SUCCESS'
            message = ''

    return json.dumps({'status': status, 'message': message})

@app.route('/getOrganisationSurveys/<org_id>')
@login_required
def getOrganisationSurveys(org_id):
    ''' Gets all the surveys for an organisation or the cureent user's organisations where they are admin ''' 
    if current_user and current_user.is_authenticated:
        surveys = surveyPermissionsSQ(db.session.query(Survey.id, Survey.name), current_user.id, 'admin')
        if org_id == '0':
            surveys = surveys.distinct().all()
        else:
            surveys = surveys.filter(Survey.organisation_id==org_id).distinct().all()
        surveys = [tuple(row) for row in surveys]
        return json.dumps(surveys)
    else:
        return json.dumps([])

@app.route('/getOrganisationUsers/<org_id>')	
@login_required
def getOrganisationUsers(org_id):
    ''' Gets all the non admin users for an organisation and exclude current_user '''
    users = []
    if current_user and current_user.is_authenticated:
        users = db.session.query(User.id, User.username, UserPermissions.default).join(UserPermissions).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.default!='admin').filter(User.id!=current_user.id).distinct().all()
        users = [tuple(row) for row in users]
    return json.dumps(users)

@app.route('/populateAnnotatorSelector')
@login_required
def populateAnnotatorSelector():
    '''Returns annotator list for populating the annotator selector.'''

    response = []
    task = current_user.turkcode[0].task
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        users = db.session.query(User).join(Cluster, Cluster.user_id==User.id).filter(Cluster.task_id==task.id).distinct().all()
        for user in users:
            if user.username == 'Admin':
                response.append((user.id, 'AI'))
            elif user.parent_id != None:
                parent = user.parent
                response.append((parent.id, parent.username))
            else:
                response.append((user.id, user.username))

        response = list(set(response))

        response.insert(0, (0, 'All'))

    return json.dumps(response)

@app.route('/populateSpeciesSelector')
@login_required
def populateSpeciesSelector():
    '''Returns species list for populating the species selector.'''
    labels = []
    task = current_user.turkcode[0].task
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        labels = db.session.query(Label.id, Label.description).filter(Label.task_id==task.id).distinct().all()
        global_labels = db.session.query(Label.id, Label.description)\
                                    .filter(Label.task_id == None)\
                                    .filter(Label.description != 'Wrong')\
                                    .filter(Label.description != 'Skip')\
                                    .filter(Label.description != 'Remove False Detections')\
                                    .filter(Label.description != 'Mask Area')\
                                    .all()
        labels.extend(global_labels)
        labels.insert(0, (0, 'All'))
        labels = [tuple(row) for row in labels]
    return json.dumps(labels)

@app.route('/landing')
def landing():
    '''Renders the landing page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if current_user.turkcode[0].task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in current_user.turkcode[0].task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        return render_template('html/landing.html', title='Welcome To TrapTagger!', helpFile='landing', version=Config.VERSION)

@app.route('/getUserSurveysForOrganisation/<user_id>/<org_id>')
@login_required
def getUserSurveysForOrganisation(user_id, org_id):
    ''' Gets all the surveys for a user and organisation (including shared surveys if they do not belong to the organisation that shared them) '''

    surveys = []
    if current_user and current_user.is_authenticated and checkDefaultAdminPermission(current_user.id,org_id):
        org_surveys = db.session.query(Survey.id, Survey.name).filter(Survey.organisation_id==org_id).distinct().all()

        ss_subquery = db.session.query(SurveyShare.survey_id)\
                                        .join(Survey, Survey.id==SurveyShare.survey_id)\
                                        .join(Organisation, Organisation.id==Survey.organisation_id)\
                                        .join(UserPermissions, UserPermissions.organisation_id==Organisation.id)\
                                        .filter(UserPermissions.user_id==user_id)\
                                        .filter(SurveyShare.organisation_id==org_id)\
                                        .distinct().subquery()

        shared_surveys = db.session.query(
                                            Survey.id,  
                                            Survey.name,
                                            SurveyShare.permission
                                        )\
                                        .join(SurveyShare, SurveyShare.survey_id==Survey.id)\
                                        .outerjoin(ss_subquery, ss_subquery.c.survey_id==Survey.id)\
                                        .filter(SurveyShare.organisation_id==org_id)\
                                        .filter(ss_subquery.c.survey_id==None)\
                                        .distinct().all()

        surveys = org_surveys + shared_surveys
        surveys = [tuple(row) for row in surveys]

    return json.dumps(surveys)

@app.route('/getPermissions')
@login_required
def getPermissions():
    ''' Gets all the permissions for the current user'''
    permissions = []
    exceptions = []
    next_permissions = None
    prev_permissions = None
    next_exceptions = None
    prev_exceptions = None

    page_permissions = request.args.get('pm_page', 1, type=int)
    page_exceptions = request.args.get('exc_page', 1, type=int)

    if current_user and current_user.is_authenticated:
        user_permissions = db.session.query(
                                        UserPermissions.id,
                                        UserPermissions.default,
                                        UserPermissions.create,
                                        UserPermissions.delete,
                                        UserPermissions.annotation,
                                        Organisation.name,
                                        Organisation.root_user_id
                                    )\
                                    .join(Organisation)\
                                    .filter(UserPermissions.user_id==current_user.id)\
                                    .order_by(Organisation.name)\
                                    .distinct().paginate(page_permissions, 4, False)

        for user_permission in user_permissions.items:
            permissions.append({
                'id': user_permission[0],
                'organisation': user_permission[5],
                'default': user_permission[1],
                'create': user_permission[2],
                'delete': user_permission[3],
                'annotation': user_permission[4],
                'root': True if user_permission[6] == current_user.id else False
            })

        user_exceptions = db.session.query(
                                        SurveyPermissionException.id,
                                        SurveyPermissionException.permission,
                                        SurveyPermissionException.annotation,
                                        Survey.name,
                                    )\
                                    .join(Survey)\
                                    .filter(SurveyPermissionException.user_id==current_user.id)\
                                    .filter(~and_(or_(SurveyPermissionException.permission=='hidden',SurveyPermissionException.permission=='worker'),SurveyPermissionException.annotation==False))\
                                    .order_by(Survey.name)\
                                    .distinct().paginate(page_exceptions, 4, False)
        
        for user_exception in user_exceptions.items:
            exceptions.append({
                'id': user_exception[0],
                'survey': user_exception[3],
                'permission': user_exception[1],
                'annotation': user_exception[2]
            })

        next_permissions = user_permissions.next_num if user_permissions.has_next else None
        prev_permissions = user_permissions.prev_num if user_permissions.has_prev else None
        next_exceptions = user_exceptions.next_num if user_exceptions.has_next else None
        prev_exceptions = user_exceptions.prev_num if user_exceptions.has_prev else None

    return json.dumps({'exceptions': exceptions, 'permissions': permissions, 'next_permissions': next_permissions, 'prev_permissions': prev_permissions, 'next_exceptions': next_exceptions, 'prev_exceptions': prev_exceptions})

@app.route('/getAccountInfo')
@login_required
def getAccountInfo():
    ''' Gets the current user's account information '''
    
    info = {}
    if current_user and current_user.is_authenticated:
        info['username'] = current_user.username
        info['email'] = current_user.email

        admins = db.session.query(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.default=='admin').distinct().all()
        if len(admins) > 0:
            info['admin'] = True
        else:
            info['admin'] = False

        if current_user.cloud_access != False and current_user.admin:
            info['cloud_access'] = True
            info['organisations'] = []
            organisations = db.session.query(Organisation.name, Organisation.folder).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).distinct().all()
            for organisation in organisations:
                info['organisations'].append({
                    'name': organisation[0],
                    'folder': organisation[1]
                })
        else:
            info['cloud_access'] = False

        if current_user.root_organisation:
            info['root'] = True
        else:
            info['root'] = False

    return json.dumps(info)

@app.route('/saveAccountInfo', methods=['POST'])
@login_required
def saveAccountInfo():
    ''' Saves the current user's account information '''
    username = ast.literal_eval(request.form['username'])
    email = ast.literal_eval(request.form['email'])

    status = 'SUCCESS'
    message = ''

    if current_user and current_user.is_authenticated:
        if current_user.username != username:
            check = db.session.query(User).filter(User.username==username).first()
            folder = username.lower().replace(' ','-').replace('_','-')
            if current_user.root_organisation:
                org_check = db.session.query(Organisation).filter(or_(func.lower(Organisation.name)==username.lower(), Organisation.folder==folder)).filter(Organisation.id!=current_user.root_organisation.id).first()
            else:
                org_check = db.session.query(Organisation).filter(or_(func.lower(Organisation.name)==username.lower(), Organisation.folder==folder)).first()
            disallowed_chars = '"[@!#$%^&*()<>?/\|}{~:]' + "'"
            disallowed = any(r in disallowed_chars for r in username)

            if not check and not org_check and not disallowed and username.lower() not in Config.DISALLOWED_USERNAMES and len(username) > 0 and len(username) < 64:
                current_user.username = username
                if current_user.root_organisation:
                    current_user.root_organisation.name = username

                db.session.commit()
                status = 'SUCCESS'
                message = 'Username updated successfully.'
            else:
                return json.dumps({'status': 'FAILURE', 'message': 'Please use a different username.'})

        if current_user.email != email:
            check = db.session.query(User).filter(User.email==email).first()
            if check:
                return json.dumps({'status': 'FAILURE', 'message': 'Please use a different email address.'})
            else:
                email_token = jwt.encode({'email': email, 'user_id': current_user.id, 'exp': (datetime.utcnow()-datetime(1970,1,1)+timedelta(minutes=30)).total_seconds()}, app.config['SECRET_KEY'], algorithm='HS256')
                url = 'https://'+Config.DNS+'/confirmEmail/'+email_token
                
                send_email('[TrapTagger] Email Verification',
                recipients=[email],
                text_body=render_template('email/emailVerification.txt',username=current_user.username, url=url),
                html_body=render_template('email/emailVerification.html',username=current_user.username, url=url))

                status = 'PENDING'
                message += ' Email confirmation sent to new email address.'

    else:
        status = 'FAILURE'
        message = 'Unable to save account information.'

    return json.dumps({'status': status, 'message': message})

@app.route('/confirmEmail/<token>')
@login_required
def confirmEmail(token):
    ''' Confirms the current user's email address '''
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        email = data['email']
        user_id = data['user_id']
        expiry = data['exp']
        current_time = (datetime.utcnow()-datetime(1970,1,1)).total_seconds()
        if current_time<expiry:
            user = db.session.query(User).get(user_id)
            email_check = db.session.query(User).filter(User.email==email).first()
            if current_user and current_user.is_authenticated and current_user.id == user_id:
                if user and user.email != email and not email_check:
                    user.email = email
                    db.session.commit()
                    flash('Email address changed successfully.')
                else:
                    flash('Unable to confirm email address.')
            else:
                flash('Please login and click the link to confirm email address.')
        else:
            flash('Token expired. Please make a new email-change request.')
    except:
        flash('Unable to confirm email address.')

    return redirect(url_for('settings'))

@app.route('/clearNotifications')
@login_required
def clearNotifications():
    ''' Clears all the notifications for the current user '''
    status = 'FAILURE'
    if current_user and current_user.is_authenticated and current_user.parent_id == None:
        notifications = db.session.query(Notification).filter(Notification.user_id==current_user.id).filter(Notification.seen==False).all()
        for notification in notifications:
            notification.seen = True
        db.session.commit()
        status = 'SUCCESS'

    return json.dumps({'status': status})

@app.route('/maskArea', methods=['POST'])
@login_required
def maskArea():
    ''' Masks an area for a camera '''

    cluster_id = ast.literal_eval(request.form['cluster_id'])
    image_id = ast.literal_eval(request.form['image_id'])
    masks = ast.literal_eval(request.form['masks'])

    if Config.DEBUGGING: app.logger.info('Cluster {} Image {} Masked Areas {}'.format(cluster_id,image_id,masks))

    image = db.session.query(Image).get(image_id)

    if not (image and (checkSurveyPermission(current_user.id,image.camera.trapgroup.survey_id,'write') or checkAnnotationPermission(current_user.parent_id,current_user.turkcode[0].task.id))):
        return {'redirect': url_for('done')}, 278

    taggingLevel = current_user.turkcode[0].task.tagging_level

    if (taggingLevel == '-1') or (taggingLevel == '0') or int(taggingLevel) > 0:
        cluster = db.session.query(Cluster).get(cluster_id)
        if cluster:
            task_id = cluster.task_id

            trapgroup = db.session.query(Trapgroup) \
                            .join(Camera) \
                            .join(Image) \
                            .filter(Image.id == image_id).first()

            if not trapgroup:
                return {'redirect': url_for('done')}, 278


            num_cluster = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
            if (num_cluster < db.session.query(Task).get(task_id).size or current_user.admin):

                if GLOBALS.redisClient.get('clusters_allocated_'+str(current_user.id))==None: GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),0)

                GLOBALS.redisClient.set('clusters_allocated_'+str(current_user.id),num_cluster)

                trapgroup.processing = True
                trapgroup.active = False
                trapgroup.user_id = None

                db.session.commit()

                mask_area.apply_async(kwargs={'image_id': image_id, 'task_id': task_id, 'masks': masks, 'user_id': current_user.parent_id})

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
        return {'redirect': url_for('done')}, 278
    else:
        return ""

# @app.route('/reviewMask', methods=['POST'])
# @login_required
# def reviewMask():
#     ''' Accept/Reject masked detection ''' 
#     # NOTE: This is not currently used (is for check masked sightings)
#     mask_data = ast.literal_eval(request.form['data'])

#     num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
#     turkcode = current_user.turkcode[0]
#     num2 = turkcode.task.size + turkcode.task.test_size

#     cluster_id = mask_data['cluster_id']
#     image_ids = mask_data['image_ids']
#     detection_ids = mask_data['detection_ids']
#     mask = mask_data['mask']

#     if Config.DEBUGGING: app.logger.info('Review mask for cluster {}, images: {}, detections: {}, action: {}'.format(cluster_id,image_ids,detection_ids,mask))

#     cluster = db.session.query(Cluster).get(cluster_id)
#     if cluster and (checkAnnotationPermission(current_user.parent_id,cluster.task_id) or checkSurveyPermission(current_user.id,cluster.task.survey_id,'write')):
#         if (current_user.admin) or (GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
#             if (num < cluster.task.size) or (current_user.admin):
#                 num += 1
        
#                 detections = db.session.query(Detection).join(Image).filter(Image.id.in_(image_ids)).filter(Detection.id.in_(detection_ids)).all()
#                 for detection in detections:
#                     if mask == 'accept':
#                         detection.status = 'masked'
#                         detection.source = 'user'

#                         # labelgroups = db.session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).filter(Labelgroup.task_id==cluster.task_id).all()
#                         labelgroups = db.session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).all()
#                         for labelgroup in labelgroups:
#                             labelgroup.labels = cluster.labels
#                             labelgroup.checked = True

#                         if Config.DEBUGGING: app.logger.info('Detection {} mask accepted'.format(detection.id))

#                     elif mask == 'reject':
#                         detection.status = 'active'
#                         detection.source = 'user'

#                         # labelgroups = db.session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).filter(Labelgroup.task_id==cluster.task_id).all()
#                         labelgroups = db.session.query(Labelgroup).filter(Labelgroup.detection_id==detection.id).all()
#                         for labelgroup in labelgroups:
#                             labelgroup.labels = cluster.labels
#                             labelgroup.checked = False

#                         if Config.DEBUGGING: app.logger.info('Detection {} mask rejected'.format(detection.id))

#                 db.session.commit()

#                 images = db.session.query(Image).filter(Image.id.in_(image_ids)).all()
#                 for image in images:
#                     image.detection_rating = detection_rating(image)
#                 db.session.commit()

#                 cluster.user_id = current_user.id
#                 cluster.examined = True
#                 cluster.timestamp = datetime.utcnow()
#                 db.session.commit()

#         if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)):
#             return {'redirect': url_for('done')}, 278
#         else:
#             return json.dumps({'progress':(num, num2)})
#     else:
#         return {'redirect': url_for('done')}, 278

@app.route('/staticDetectionCheck/<survey_id>')
@login_required
def staticDetectionCheck(survey_id):
    ''' Checks if a static detection check has been done for this survey ''' 
    static_check = False
    if current_user and current_user.is_authenticated:
        if checkSurveyPermission(current_user.id,survey_id,'write'):
            sg_count = db.session.query(Staticgroup).join(Detection).join(Labelgroup).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Detection.static==True).filter(Staticgroup.status=='unknown').count()
            if sg_count == 0:
                static_check = False
            else:
                static_check = True

    return json.dumps({'static_check': static_check})

@app.route('/checkStaticDetections')
@login_required
def checkStaticDetections():
    '''Renders the static detections analysis page for the specified survey.'''
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.admin:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            survey_id = request.args.get('survey', None)
            survey = db.session.query(Survey).get(survey_id)
            if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
                if 'preprocessing' in survey.status.lower() and survey.status.split(',')[2] == 'Available' and survey.status.split(',')[1] in ['Completed','Skipped','N/A']:
                    GLOBALS.redisClient.set('static_check_ping_'+str(survey_id),datetime.utcnow().timestamp())
                    return render_template('html/static_detections.html', title='Static Detections', helpFile='static_detections', bucket=Config.BUCKET, version=Config.VERSION)
                else:
                    return redirect(url_for('surveys'))
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

@app.route('/getStaticDetections/<survey_id>/<reqID>')
@login_required
def getStaticDetections(survey_id, reqID):
    ''' Gets all the static detections for the specified survey '''

    if Config.DEBUGGING: app.logger.info('Get static detections for survey {}'.format(survey_id))
    next_page = None
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if int(reqID) != 0:
            if 'preprocessing' in survey.status.lower():
                survey.status = 'Preprocessing,' + survey.status.split(',')[1] + ',In Progress'
                db.session.commit()

        staticgroup_id = request.args.get('staticgroup_id', None)
        edit = request.args.get('edit', False, type=bool)
        cameragroup_id = request.args.get('cameragroup_id', None)
        page = request.args.get('page', 1, type=int)

        detectionClusters = db.session.query(
                                    Detection.id,
                                    Detection.top,
                                    Detection.bottom,
                                    Detection.left,
                                    Detection.right,
                                    Image.id,
                                    Image.filename,
                                    Camera.id,
                                    Camera.path,
                                    Trapgroup.id,
                                    Staticgroup.id,
                                    Staticgroup.status,
                                    Detection.static,
                                    User.username
                                )\
                                .join(Image, Image.id==Detection.image_id)\
                                .join(Camera, Camera.id==Image.camera_id)\
                                .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                                .join(Staticgroup)\
                                .outerjoin(User, User.id==Staticgroup.user_id)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .order_by(Staticgroup.id,Image.corrected_timestamp,Detection.id)
                                
        if staticgroup_id:
            detectionClusters = detectionClusters.filter(Staticgroup.id==staticgroup_id)

        if cameragroup_id and cameragroup_id != '0':
            detectionClusters = detectionClusters.join(Cameragroup).filter(Cameragroup.id==cameragroup_id)

        if not edit:
            GLOBALS.redisClient.set('static_check_ping_'+str(survey_id),datetime.utcnow().timestamp())
            detectionClusters = detectionClusters.filter(Detection.static==True).filter(Staticgroup.status=='unknown')
        else:
            detectionClusters = detectionClusters.filter(Staticgroup.status.in_(['accepted','rejected','unknown']))

        detectionClusters = detectionClusters.distinct().paginate(page, 10000, False)

        if len(detectionClusters.items) == 0:
            return json.dumps({'static_detections': [{'id': -101}], 'id': reqID})

        staticgroup_detections = {}
        static_detections = []
        staticgroup_keys = {}
        for data in detectionClusters.items:
            if data[10] in staticgroup_detections:
                staticgroup_detections[data[10]].append({
                    'id': data[0],
                    'top': data[1],
                    'bottom': data[2],
                    'left': data[3],
                    'right': data[4],
                    'static': data[12]
                })
            else:
                staticgroup_detections[data[10]] = [{
                    'id': data[0],
                    'top': data[1],
                    'bottom': data[2],
                    'left': data[3],
                    'right': data[4],
                    'static': data[12]
                }]

            if data[10] not in staticgroup_keys:
                static_detections.append({
                    'id': data[10],
                    'images': [{	
                        'id': data[5],
                        'url': (data[8]+'/'+data[6]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                        'detections': []
                    }],
                    'labels': ['None'],
                    'label_ids': ['0'],
                    'tags': ['None'],
                    'tag_ids': ['0'],
                    'required': [],
                    'classification': [],
                    'groundTruth': [],
                    'trapGroup': data[9],
                    'camera': data[7],
                    'camera_path': data[8],
                    'staticgroup_status': data[11],
                    'user': data[13]
                })

                staticgroup_keys[data[10]] = len(static_detections)-1

            else:
                static_detections[staticgroup_keys[data[10]]]['images'].append({
                    'id': data[5],
                    'url': (data[8]+'/'+data[6]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'detections': []
                })
        
        next_page = detectionClusters.next_num if detectionClusters.has_next else None

        return json.dumps({'static_detections': static_detections, 'id': reqID, 'staticgroup_detections': staticgroup_detections, 'next_page': next_page})
    else:
        return {'redirect': url_for('surveys')}, 278

@app.route('/assignStatic', methods=['POST'])
@login_required
def assignStatic():
    ''' Sets the status of a static detection group based on whether user as accepted or rejected the detections as static'''

    survey_id = ast.literal_eval(request.form['survey_id'])
    staticgroup_id = ast.literal_eval(request.form['staticgroup_id'])
    static_status = ast.literal_eval(request.form['static_status'])

    if Config.DEBUGGING: app.logger.info('Assign static detections for survey {}, sitegroup: {}, action: {}'.format(survey_id,staticgroup_id,static_status))

    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if not GLOBALS.redisClient.get('static_check_ping_'+str(survey_id)):
            return {'redirect': url_for('surveys')}, 278
            
        GLOBALS.redisClient.set('static_check_ping_'+str(survey_id),datetime.utcnow().timestamp())

        if 'preprocessing' in survey.status.lower():
            survey.status = 'Preprocessing,' + survey.status.split(',')[1] + ',In Progress'

        if static_status == 'accept_static':
            staticgroup = db.session.query(Staticgroup).get(staticgroup_id)
            staticgroup.status = 'accepted'
            staticgroup.user_id = current_user.id

        elif static_status == 'reject_static':
            staticgroup = db.session.query(Staticgroup).get(staticgroup_id)
            staticgroup.status = 'rejected'
            staticgroup.user_id = current_user.id

        db.session.commit()

        return json.dumps({'status': 'SUCCESS', 'message': ''})
    else:
        return {'redirect': url_for('surveys')}, 278

@app.route('/getSurveyMasks/<survey_id>/<cameragroup_id>')
@login_required
def getSurveyMasks(survey_id, cameragroup_id):
    ''' Gets all the masks for a survey '''
    next_page = None
    masks = []
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        page = request.args.get('page', 1, type=int)
        mask_data = db.session.query(
                                Mask.id,
                                func.ST_AsGeoJSON(Mask.shape),
                                User.username,
                                Cameragroup.id,
                                Cameragroup.name
                            )\
                            .join(Cameragroup,Mask.cameragroup_id==Cameragroup.id)\
                            .join(Camera,Camera.cameragroup_id==Cameragroup.id)\
                            .join(Trapgroup,Trapgroup.id==Camera.trapgroup_id)\
                            .outerjoin(User,User.id==Mask.user_id)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Cameragroup.id==cameragroup_id)\
                            .distinct().all()

        detection_data = db.session.query(
                                    Detection.id,
                                    Detection.top,
                                    Detection.bottom,
                                    Detection.left,
                                    Detection.right,
                                    Image.id,
                                    Image.filename,
                                    Camera.path,
                                    Cameragroup.id
                                )\
                                .join(Image, Image.id==Detection.image_id)\
                                .join(Camera, Camera.id==Image.camera_id)\
                                .join(Cameragroup, Cameragroup.id==Camera.cameragroup_id)\
                                .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(Cameragroup.id==cameragroup_id)\
                                .filter(Detection.status=='masked')\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .filter(Detection.static==False)\
                                .order_by(Cameragroup.id,Image.corrected_timestamp)\
                                .distinct().paginate(page, 10000, False)

        cam_keys = {}
        for data in mask_data:
            if data[3] not in cam_keys:
                cam_keys[data[3]] = len(masks)
                masks.append({
                    'id': data[3],
                    'images': [],
                    'masks': [{
                        'id': data[0],
                        'coords': json.loads(data[1])['coordinates'][0],
                        'user': data[2]
                    }],
                    'cameragroup_name': data[4]
                })
            else:
                cam_idx = cam_keys[data[3]]
                masks[cam_idx]['masks'].append({
                    'id': data[0],
                    'coords': json.loads(data[1])['coordinates'][0],
                    'user': data[2]
                })

        image_keys = {}
        for data in detection_data.items:
            cam_idx = cam_keys[data[8]]
            if data[5] not in image_keys:
                image_keys[data[5]] = len(masks[cam_idx]['images'])
                masks[cam_idx]['images'].append({
                    'id': data[5],
                    'url': (data[7]+'/'+data[6]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'detections': [{
                        'id': data[0],
                        'top': data[1],
                        'bottom': data[2],
                        'left': data[3],
                        'right': data[4]
                    }]
                })
            else:
                image_idx = image_keys[data[5]]
                masks[cam_idx]['images'][image_idx]['detections'].append({
                    'id': data[0],
                    'top': data[1],
                    'bottom': data[2],
                    'left': data[3],
                    'right': data[4]
                })

        # Add an image for masks that did not mask any detections so that it can still be viewed
        if len(detection_data.items) == 0:
            cg_images = db.session.query(
                                    Cameragroup.id,
                                    Camera.path,
                                    Image.id,
                                    Image.filename
                                )\
                                .join(Camera,Camera.cameragroup_id==Cameragroup.id)\
                                .join(Image,Image.camera_id==Camera.id)\
                                .filter(Cameragroup.id==cameragroup_id)\
                                .group_by(Cameragroup.id).distinct().all()
            for cg_image in cg_images:
                cam_idx = cam_keys[cg_image[0]]
                masks[cam_idx]['images'].append({
                    'id': cg_image[2],
                    'url': (cg_image[1]+'/'+cg_image[3]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                    'detections': []
                })

        next_page = detection_data.next_num if detection_data.has_next else None

    return json.dumps({'masks': masks, 'next_page': next_page})

@app.route('/getMaskCameragroups/<survey_id>')
@login_required
def getMaskCameras(survey_id):
    ''' Gets all the cameragroup ids that have masks in a survey '''
    cameragroup_ids = []
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        cameragroups = db.session.query(Mask.cameragroup_id).join(Cameragroup).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).order_by(Mask.cameragroup_id).distinct().all()
        cameragroup_ids = [c[0] for c in cameragroups]

    return json.dumps(cameragroup_ids)

@app.route('/getStaticGroupIDs/<survey_id>')
@login_required
def getStaticGroupIDs(survey_id):
    ''' Gets all the staticgroup ids that have static detections in a survey '''
    staticgroup_ids = []
    survey = db.session.query(Survey).get(survey_id)
    edit = request.args.get('edit', False, type=bool)
    cameragroup_id = request.args.get('cameragroup_id', None)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        staticgroups = db.session.query(Staticgroup.id)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .filter(Trapgroup.survey_id==survey_id)\
        
        if cameragroup_id and cameragroup_id != '0':
            staticgroups = staticgroups.join(Cameragroup).filter(Cameragroup.id==cameragroup_id)

        if not edit:
            GLOBALS.redisClient.set('static_check_ping_'+str(survey_id),datetime.utcnow().timestamp())
            staticgroups = staticgroups.filter(Detection.static==True).filter(Staticgroup.status=='unknown')
        else:
            staticgroups = staticgroups.filter(Staticgroup.status.in_(['accepted','rejected','unknown']))

        staticgroup_ids = [s[0] for s in staticgroups.distinct().all()]

        if len(staticgroup_ids) == 0 and not edit:
            staticgroup_ids = ['-101']

    return json.dumps(staticgroup_ids)

@app.route('/finishStaticDetectionCheck/<survey_id>')
@login_required
def finishStaticDetectionCheck(survey_id):
    ''' Finishes the static detection check for a survey '''
    survey = db.session.query(Survey).get(survey_id)
    save = request.args.get('save', None)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if 'preprocessing' in survey.status.lower():
            if save:
                survey.status = 'Preprocessing,' + survey.status.split(',')[1] + ',Available'
            else:
                if survey.status.split(',')[1] in ['N/A', 'Completed', 'Skipped']:	
                    survey.status = 'Importing'
                    import_survey.delay(survey_id=survey.id,preprocess_done=True)
                else:
                    survey.status = 'Preprocessing,' + survey.status.split(',')[2] + ',Completed'
            db.session.commit()
        GLOBALS.redisClient.delete('static_check_ping_'+str(survey_id))

    return json.dumps('success')

@app.route('/getSurveyStructure')
@login_required
def getSurveyStructure():
    '''Returns a dictionary of the survey's structure (Sites, Cameras, Folders, Image count, Video count, and Frame Count)'''
    
    structure = []
    next_url = None
    prev_url = None
    has_next = False
    has_prev = False
    page = request.args.get('page', 1, type=int)
    page_window = 10
    survey_id = request.args.get('survey_id', None, type=int)
    survey = db.session.query(Survey).get(survey_id)

    if survey and checkSurveyPermission(current_user.id,survey_id,'read'):
        video_subquery = db.session.query(Cameragroup.id, func.SUBSTRING_INDEX(Camera.path, '/_video_images_',1).label('video_path'), func.count(distinct(Image.id)).label('frame_count'), func.count(distinct(Video.id)).label('vid_count'))\
                            .join(Camera, Camera.cameragroup_id==Cameragroup.id)\
                            .join(Image, Image.camera_id==Camera.id)\
                            .join(Video, Video.camera_id==Camera.id)\
                            .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Camera.path.contains('_video_images_'))\
                            .group_by(Cameragroup.id, func.SUBSTRING_INDEX(Camera.path, '/_video_images_',1))\
                            .subquery()

        image_subquery = db.session.query(Cameragroup.id, Camera.path.label('image_path'), func.count(distinct(Image.id)).label('image_count'))\
                            .join(Camera, Camera.cameragroup_id==Cameragroup.id)\
                            .join(Image, Image.camera_id==Camera.id)\
                            .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(~Camera.path.contains('_video_images_'))\
                            .group_by(Cameragroup.id, Camera.id)\
                            .subquery()

        data = db.session.query(Trapgroup.id, Trapgroup.tag, Cameragroup.id, Cameragroup.name, image_subquery.c.image_path, video_subquery.c.video_path, image_subquery.c.image_count, video_subquery.c.vid_count, video_subquery.c.frame_count)\
                            .join(Camera, Camera.trapgroup_id==Trapgroup.id)\
                            .join(Cameragroup, Cameragroup.id==Camera.cameragroup_id)\
                            .outerjoin(image_subquery, image_subquery.c.id==Cameragroup.id)\
                            .outerjoin(video_subquery, video_subquery.c.id==Cameragroup.id)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .order_by(Trapgroup.tag, Cameragroup.name)\
                            .distinct().all()

        folder_counts = {}
        for d in data:
            if d[4]:
                if d[4] in folder_counts:
                    folder_counts[d[4]]['image_count'] = d[6] if d[6] else 0
                else:
                    folder_counts[d[4]] = {'image_count': d[6], 'video_count': 0, 'frame_count': 0, 'site_id': d[0], 'site': d[1], 'camera_id': d[2], 'camera': d[3], 'path': d[4]}
            if d[5]:
                if d[5] in folder_counts:
                    folder_counts[d[5]]['video_count'] = d[7] if d[7] else 0
                    folder_counts[d[5]]['frame_count'] = d[8] if d[8] else 0
                else:
                    folder_counts[d[5]] = {'image_count': 0, 'video_count': d[7], 'frame_count': d[8], 'site_id': d[0], 'site': d[1], 'camera_id': d[2], 'camera': d[3], 'path': d[5]}


        folder_counts = list(folder_counts.values())
        total_data = len(folder_counts)
        folder_counts = folder_counts[(page-1)*page_window:page*page_window]
        site_keys = {}
        camera_keys = {}
        for d in folder_counts:
            if d['site_id'] not in site_keys:
                site_keys[d['site_id']] = len(structure)
                camera_keys[d['camera_id']] = 0
                structure.append({
                    'id': d['site_id'],
                    'site' : d['site'],
                    'nr_folders': 1,
                    'cameras': [{
                        'id': d['camera_id'],
                        'name': d['camera'],
                        'folders': [{
                            'path': d['path'],
                            'image_count': d['image_count'],
                            'video_count': d['video_count'],
                            'frame_count': d['frame_count']
                        }]
                    }]
                })
            else:
                site_idx = site_keys[d['site_id']]
                structure[site_idx]['nr_folders'] += 1
                if d['camera_id'] not in camera_keys:
                    camera_keys[d['camera_id']] = len(structure[site_idx]['cameras'])
                    structure[site_idx]['cameras'].append({
                        'id': d['camera_id'],
                        'name': d['camera'],
                        'folders': [{
                            'path': d['path'],
                            'image_count': d['image_count'],
                            'video_count': d['video_count'],
                            'frame_count': d['frame_count']
                        }]
                    })
                else:
                    camera_idx = camera_keys[d['camera_id']]
                    structure[site_idx]['cameras'][camera_idx]['folders'].append({
                        'path': d['path'],
                        'image_count': d['image_count'],
                        'video_count': d['video_count'],
                        'frame_count': d['frame_count']
                    })

        if total_data > page*page_window:
            has_next = True
        if page > 1:
            has_prev = True

        next_url = url_for('getSurveyStructure', page=page+1, survey_id=survey_id) if has_next else None
        prev_url = url_for('getSurveyStructure', page=page-1, survey_id=survey_id) if has_prev else None

    return json.dumps({'survey': survey_id, 'structure': structure, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getStaticCameragroups/<survey_id>')
@login_required
def getStaticCameragroups(survey_id):
    ''' Gets all the cameragroups that have static detections in a survey '''
    cameragroups = []
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        cameragroups = db.session.query(Cameragroup.id, Cameragroup.name)\
                                .join(Camera, Camera.cameragroup_id==Cameragroup.id)\
                                .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                                .join(Image)\
                                .join(Detection)\
                                .join(Staticgroup)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(Staticgroup.status.in_(['accepted','rejected','unknown']))\
                                .order_by(Cameragroup.name)\
                                .distinct().all()

                                
        for i in range(len(cameragroups)):
            cameragroups[i] = {'id': cameragroups[i][0], 'name': cameragroups[i][1]}
    
    return json.dumps(cameragroups)

@app.route('/checkTimestamps')
@login_required
def checkTimestamps():
    '''Renders the timestamp analysis page for the specified survey.'''
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.admin:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
            if not current_user.permissions: return redirect(url_for('landing'))
            survey_id = request.args.get('survey', None)
            survey = db.session.query(Survey).get(survey_id)
            if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
                if 'preprocessing' in survey.status.lower() and survey.status.split(',')[1] == 'Available' and survey.status.split(',')[2] != 'In Progress':
                    GLOBALS.redisClient.set('timestamp_check_ping_'+str(survey_id),datetime.utcnow().timestamp())
                    return render_template('html/timestamps.html', title='Correct Timestamps', helpFile='timestamp_correction', bucket=Config.BUCKET, version=Config.VERSION)
                else:
                    return redirect(url_for('surveys'))
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if current_user.turkcode[0].task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in current_user.turkcode[0].task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

# @app.route('/getImageIDs/<survey_id>')
# @login_required
# def getImageIDs(survey_id):
#     '''Gets the image IDs for the specified survey who require timestamps correction.''' 
#     image_ids = []
#     survey = db.session.query(Survey).get(survey_id)
#     check_type = request.args.get('type', None)
#     if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
#         # Get all images and first frame of videos that do not have timestamps
#         images = db.session.query(Image.id)\
#                             .join(Camera)\
#                             .join(Trapgroup)\
#                             .filter(Trapgroup.survey_id==survey_id)\
#                             .filter(or_(Image.filename=='frame0.jpg', ~Image.filename.like('frame%')))

#         if check_type:
#             if check_type == 'missing':
#                 images = images.filter(Image.corrected_timestamp==None)
#             elif check_type == 'extracted':
#                 images = images.filter(and_(Image.extracted==True,Image.timestamp==Image.corrected_timestamp))
#             elif check_type == 'edited': 
#                 images = images.filter(or_(
#                                 and_(Image.timestamp==None,Image.corrected_timestamp!=None),
#                                 and_(Image.extracted==True,Image.timestamp!=Image.corrected_timestamp)
#                             ))
#         else:
#             images = images.filter(Image.corrected_timestamp==None)

#         image_ids = [r[0] for r in images.distinct().all()]

#     return json.dumps(image_ids)

@app.route('/getTimestampCameraIDs/<survey_id>', methods=['POST'])
@login_required
def getTimestampCameraIDs(survey_id):
    '''Gets the camera IDs for the specified survey whose images require timestamps correction.''' 
    camera_ids = []
    total_image_count = 0
    image_counts = {}
    survey = db.session.query(Survey).get(survey_id)

    check_type = None
    if 'type' in request.form:
        check_type = ast.literal_eval(request.form['type'])

    trapgroup_id = None
    if 'trapgroup_id' in request.form:
        trapgroup_id = ast.literal_eval(request.form['trapgroup_id'])
        if int(trapgroup_id) == 0: trapgroup_id = None

    camera_id = None
    if 'camera_id' in request.form:
        camera_id = ast.literal_eval(request.form['camera_id'])
        if int(camera_id) == 0: camera_id = None

    species = None
    if 'species' in request.form:
        species = ast.literal_eval(request.form['species'])
        if species == '0': species = None
        
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        # Get all camera ids for images and first frame of videos that do not have timestamps
        cameras = db.session.query(Cameragroup.id)\
                            .join(Camera)\
                            .join(Image)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(Image.filename=='frame0.jpg', ~Image.filename.like('frame%')))

        if check_type:
            if check_type == 'missing':
                cameras = cameras.filter(Image.corrected_timestamp==None)
            elif check_type == 'extracted':
                cameras = cameras.filter(and_(Image.extracted==True,Image.timestamp==Image.corrected_timestamp)).filter(Image.corrected_timestamp!=None)
            elif check_type == 'edited': 
                cameras = cameras.filter(or_(
                                and_(Image.timestamp==None,Image.corrected_timestamp!=None),
                                and_(Image.extracted==True,Image.timestamp!=Image.corrected_timestamp)
                            ))
            # Filter out videos from empty clusters
            cameras = cameras.filter(Image.zip_id==None)
        else:
            cameras = cameras.filter(Image.corrected_timestamp==None).filter(Image.skipped!=True)
            image_counts = {r[0]:r[1] for r in db.session.query(Cameragroup.id, func.count(distinct(Image.id)))\
                                                .join(Camera,Cameragroup.id==Camera.cameragroup_id)\
                                                .join(Trapgroup)\
                                                .join(Image)\
                                                .filter(Trapgroup.survey_id==survey_id)\
                                                .filter(or_(Image.filename=='frame0.jpg', ~Image.filename.like('frame%')))\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Image.skipped!=True)\
                                                .group_by(Cameragroup.id).distinct().all()}
            total_image_count = sum(image_counts.values())

        if trapgroup_id:
            cameras = cameras.filter(Trapgroup.id==trapgroup_id)

        if camera_id:
            cameras = cameras.filter(Cameragroup.id==camera_id)

        if species:
            labels = db.session.query(Label).join(Task).filter(Label.description==species).filter(Task.survey_id==survey_id).distinct().all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            if not labels:
                labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id==None).distinct().all()
                label_list = [l.id for l in labels]
            cameras = cameras.join(Detection).join(Labelgroup).filter(Labelgroup.labels.any(Label.id.in_(label_list)))

        camera_ids = [r[0] for r in cameras.distinct().all()]

        if len(camera_ids) == 0 and 'preprocessing' in survey.status.lower():
            camera_ids = ['-101']

    return json.dumps({'camera_ids': camera_ids, 'total_image_count': total_image_count, 'image_counts': image_counts})

@app.route('/getTimestampImages/<survey_id>/<reqID>', methods=['POST'])
@login_required
def getTimestampImages(survey_id, reqID):
    '''Gets the images for the specified survey whose videos require timestamps correction.'''
    images = []
    next_page = None
    survey = db.session.query(Survey).get(survey_id)
    image_id = request.args.get('image_id', None)
    check_type = request.args.get('type', None)
    camera_id = request.args.get('camera_id', None)
    species = request.args.get('species', None)
    if species and species=='0': species = None
    page = request.args.get('page', 1, type=int)

    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if 'preprocessing' in survey.status.lower():
            GLOBALS.redisClient.set('timestamp_check_ping_'+str(survey_id),datetime.utcnow().timestamp())
            survey.status = 'Preprocessing,In Progress,' + survey.status.split(',')[2]
            db.session.commit()

        image_data = db.session.query(Image.id, Image.filename, Image.corrected_timestamp, Video.filename, Cameragroup.id, Camera.path, Image.extracted_data)\
                                .join(Camera, Camera.id==Image.camera_id)\
                                .join(Cameragroup, Cameragroup.id==Camera.cameragroup_id)\
                                .join(Trapgroup)\
                                .outerjoin(Video, Video.camera_id==Camera.id)\
                                .filter(Trapgroup.survey_id==survey_id)\
                                .filter(or_(Image.filename=='frame0.jpg', ~Image.filename.like('frame%')))
        if check_type:
            if check_type == 'missing':
                image_data = image_data.filter(Image.corrected_timestamp==None)
            elif check_type == 'extracted':
                image_data = image_data.filter(and_(Image.extracted==True,Image.timestamp==Image.corrected_timestamp)).filter(Image.corrected_timestamp!=None)
            elif check_type == 'edited':
                image_data = image_data.filter(or_(
                                and_(Image.timestamp==None,Image.corrected_timestamp!=None),
                                and_(Image.extracted==True,Image.timestamp!=Image.corrected_timestamp)
                            ))
            # Filter out videos from empty clusters
            image_data = image_data.filter(Image.zip_id==None)
        else:  
            image_data = image_data.filter(Image.corrected_timestamp==None).filter(Image.skipped!=True)
            if 'image_ids' in request.form:
                image_ids = ast.literal_eval(request.form['image_ids'])
                image_data = image_data.filter(Image.id.notin_(image_ids))

        if image_id:
            image_data = image_data.filter(Image.id==image_id)

        if camera_id:
            image_data = image_data.filter(Cameragroup.id==camera_id)

        if species:
            labels = db.session.query(Label).join(Task).filter(Label.description==species).filter(Task.survey_id==survey_id).distinct().all()
            label_list = []
            for label in labels:
                label_list.append(label.id)
                label_list.extend(getChildList(label,int(label.task_id)))
            if not labels:
                labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id==None).distinct().all()
                label_list = [l.id for l in labels]
            image_data = image_data.join(Detection).join(Labelgroup).filter(Labelgroup.labels.any(Label.id.in_(label_list)))

        image_data = image_data.distinct().paginate(page,10000,False)

        if len(image_data.items) == 0 and 'preprocessing' in survey.status.lower():
            return json.dumps({'images': [{'id': Config.FINISHED_CLUSTER}], 'id': reqID})

        camera_keys = {}
        for d in image_data.items:
            if d[4] not in camera_keys:
                images.append({
                    'id': d[4],
                    'images': [],
                    'labels': ['None'],
                    'label_ids': ['0'],
                    'tags': ['None'],
                    'tag_ids': ['0'],
                    'required': [],
                    'camera_id': d[4]
                })
                camera_keys[d[4]] = len(images)-1

            images[camera_keys[d[4]]]['images'].append({
                'id': d[0],
                'detections': [],
                'url': (d[5]+'/'+d[1]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'timestamp': d[2].strftime('%Y-%m-%d %H:%M:%S') if d[2] else None,
                'name': d[5].split('/_video_images_/')[0]+'/'+d[3] if d[3] else d[5]+'/'+d[1],
                'extracted_data': d[6]
            })

        next_page = image_data.next_num if image_data.has_next else None

    return json.dumps({'images': images, 'id': reqID, 'next_page': next_page})

@app.route('/submitTimestamp', methods=['POST'])
@login_required
def submitTimestamp():
    '''Submits the corrected timestamp for the specified image.'''

    status = 'error'
    survey_id = ast.literal_eval(request.form['survey_id'])
    image_id = ast.literal_eval(request.form['image_id'])
    if 'timestamp' in request.form:
        timestamp = ast.literal_eval(request.form['timestamp'])
        timestamp_format = ast.literal_eval(request.form['timestamp_format'])
    else:
        timestamp = None
        timestamp_format = None

    if Config.DEBUGGING: app.logger.info('Image ID: {} Timestamp: {} Timestamp Format: {}'.format(image_id, timestamp, timestamp_format))

    survey = db.session.query(Survey).get(survey_id)
    image = db.session.query(Image).get(image_id)
    if survey and image and checkSurveyPermission(current_user.id,survey.id,'write'):

        if not GLOBALS.redisClient.get('timestamp_check_ping_'+str(survey_id)):
            return {'redirect': url_for('surveys')}, 278
            
        GLOBALS.redisClient.set('timestamp_check_ping_'+str(survey_id),datetime.utcnow().timestamp())

        if 'preprocessing' in survey.status.lower():
            survey.status = 'Preprocessing,In Progress,' + survey.status.split(',')[2]

        corrected_timestamp = None
        if timestamp:
            try:
                corrected_timestamp = datetime.strptime(timestamp, timestamp_format)
            except:
                corrected_timestamp = None
        
        if Config.DEBUGGING: app.logger.info('Corrected Timestamp: {}'.format(corrected_timestamp))
        image.corrected_timestamp = corrected_timestamp
        image.skipped = False if corrected_timestamp else True

        # Handle video frames
        if 'frame' in image.filename:
            video = db.session.query(Video).join(Camera).join(Image,Camera.images).filter(Image.id==image.id).first()
            if video:
                index = int(image.filename.split('frame')[1][:-4])
                fps = video.still_rate
                frames = db.session.query(Image).join(Camera).join(Video,Camera.videos).filter(Video.id==video.id).distinct().all()
                if corrected_timestamp:
                    video_timestamp = corrected_timestamp - timedelta(seconds=index/fps)
                    for frame in frames:
                        frame_count = int(frame.filename.split('frame')[1][:-4])
                        frame_timestamp = video_timestamp + timedelta(seconds=frame_count/fps)
                        frame.corrected_timestamp = frame_timestamp
                        frame.skipped = False
                else:
                    for frame in frames:
                        frame.corrected_timestamp = None
                        frame.skipped = True

        db.session.commit()
        status = 'success'

    return json.dumps(status)

@app.route('/finishTimestampCheck/<survey_id>')
@login_required
def finishTimestampCheck(survey_id):
    '''Finishes the timestamp check for the specified survey.'''
    survey = db.session.query(Survey).get(survey_id)
    save = request.args.get('save', None)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if 'preprocessing' in survey.status.lower():
            if save:
                survey.status = 'Preprocessing,Available,' + survey.status.split(',')[2]
            else:
                if survey.status.split(',')[2] in ['N/A', 'Completed', 'Skipped']:	
                    survey.status = 'Importing'
                    import_survey.delay(survey_id=survey.id,preprocess_done=True)
                else:
                    survey.status = 'Preprocessing,Completed,' + survey.status.split(',')[2]
            db.session.commit()
        GLOBALS.redisClient.delete('timestamp_check_ping_'+str(survey_id))
        
    return json.dumps('success')

@app.route('/skipPreprocessing/<survey_id>/<step>')
@login_required
def skipPreprocessing(survey_id,step):
    '''Skips the preprocessing for the specified survey.'''
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if 'preprocessing' in survey.status.lower():
            statusses = survey.status.split(',')
            if step == 'timestamp':
                if statusses[2].lower() in ['completed', 'skipped', 'n/a']:
                    survey.status = 'Importing'
                    import_survey.delay(survey_id=survey.id,preprocess_done=True)
                else:
                    survey.status = 'Preprocessing,Skipped,' + statusses[2]

            elif step == 'static':
                if statusses[1].lower() in ['completed', 'skipped', 'n/a']:
                    survey.status = 'Importing'
                    import_survey.delay(survey_id=survey.id,preprocess_done=True)
                else:
                    survey.status = 'Preprocessing,' + statusses[1] + ',Skipped'

            db.session.commit()
    return json.dumps('success')

@app.route('/skipTimestampCamera/<survey_id>/<cameragroup_id>')
@login_required
def skipTimestampCamera(survey_id,cameragroup_id):
    '''Marks all images with no timestamps for the specified camera as skipped.'''
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'write'):
        if 'preprocessing' in survey.status.lower():
            skipCameraImages.delay(cameragroup_id)

    return json.dumps('success')

@app.route('/getIndividualSpeciesAndTasksForEdit/<task_id>')
@login_required
def getIndividualSpeciesAndTasksForEdit(task_id):
    ''' Gets all the species and tasks for the individual's associated with a task (for task label edit) '''

    species_info = {}
    task = db.session.query(Task).get(task_id)
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read'):
        individuals_sq = db.session.query(Individual.id).join(Task, Individual.tasks).filter(Task.id==task_id).distinct().subquery()

        data = db.session.query(Individual.species, Task.id, Task.name, Survey.name)\
                                .join(Task, Individual.tasks)\
                                .join(Survey, Task.survey_id==Survey.id)\
                                .join(individuals_sq, individuals_sq.c.id==Individual.id)\
                                .distinct().all()

        species = [d[0] for d in data]
        for d in data:
            if d[0] not in species_info:
                species_info[d[0]] = {
                    'tasks': [d[1]],
                    'task_names': [d[3] + ' ' + d[2]]
                }
            else:
                species_info[d[0]]['tasks'].append(d[1])
                species_info[d[0]]['task_names'].append(d[3] + ' ' + d[2])

        parent_ids = []
        for s in set(species):
            parents = getParentLabels(task_id,s,[],addLabel=False)
            if parents:
                parent_ids.extend(parents)

    return json.dumps({'species_info': species_info, 'parent_ids': parent_ids})

@app.route('/getIndividualSurveysTasks')
@login_required
def getIndividualSurveysTasks():
    ''' Gets all the surveys, tasks, and species for the individual's associated with a user that's available for deletion '''

    survey_info = {}
    task_info = {}
    species = []
    if current_user and current_user.is_authenticated:
        data = surveyPermissionsSQ(db.session.query(
                                    Survey.id,
                                    Survey.name,
                                    Task.id,
                                    Task.name,
                                    Individual.species
                                )\
                                .join(Task, Survey.id==Task.survey_id)\
                                .join(Individual, Task.individuals)\
                                .filter(~Task.name.contains('_o_l_d_'))\
                                .filter(~Task.name.contains('_copying'))\
                                .filter(Task.name != 'default'),current_user.id,'write')\
                                .filter(func.lower(Task.status).in_(Config.TASK_READY_STATUSES))\
                                .filter(func.lower(Survey.status).in_(Config.SURVEY_READY_STATUSES))\
                                .filter(Survey.status!='Restoring Files')\
                                .distinct().all()

        for d in data:
            if d[0] not in survey_info:
                survey_info[d[0]] = {
                    'name': d[1],
                    'task_ids': []
                }
            
            if d[2] not in survey_info[d[0]]['task_ids']:
                survey_info[d[0]]['task_ids'].append(d[2])

            if d[2] not in task_info:
                task_info[d[2]] = d[3]

            if d[4] not in species:
                species.append(d[4])

    return json.dumps({'surveys': survey_info, 'tasks': task_info, 'species': species})

@app.route('/deleteIndividuals', methods=['POST'])
@login_required
def deleteIndividuals():
    ''' Deletes all the individuals associated with a task '''

    if current_user and current_user.is_authenticated:
        task_ids = ast.literal_eval(request.form['task_ids'])
        species = ast.literal_eval(request.form['species'])
        tasks = surveyPermissionsSQ(db.session.query(Task)\
                                                .join(Survey)\
                                                .filter(Task.id.in_(task_ids))\
                                                .filter(func.lower(Task.status).in_(Config.TASK_READY_STATUSES))\
                                                .filter(func.lower(Survey.status).in_(Config.SURVEY_READY_STATUSES))\
                                                .filter(Survey.status!='Restoring Files')\
                                                ,current_user.id, 'write').distinct().all()

        if tasks and len(tasks) == len(task_ids):
            for task in tasks:
                task.status = 'Processing'
            db.session.commit()
            delete_individuals.apply_async(kwargs={'task_ids':task_ids, 'species': species})

            return json.dumps({'status': 'success', 'message': 'Individuals are being deleted.'})
    return json.dumps({'status': 'failure', 'message': 'An error occurred while deleting individuals. Please try again.'})

@app.route('/getTimestampSitesCameraAndSpecies/<survey_id>')
@login_required
def getTimestampSitesCameraAndSpecies(survey_id):
    ''' Gets all the sites, cameras, and species for the files in Edit Survey: File Timestamps '''

    sites = []
    cameras = {}
    species = []
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey.id,'read'):
        sites_data = db.session.query(Trapgroup.id, Trapgroup.tag).filter(Trapgroup.survey_id==survey_id).distinct().all()
        for site in sites_data:
            sites.append({'id': site[0], 'name': site[1]})

        cameras_data = db.session.query(Trapgroup.id, Cameragroup.id, Cameragroup.name).join(Camera, Camera.trapgroup_id==Trapgroup.id).join(Cameragroup).filter(Trapgroup.survey_id==survey_id).distinct().all()
        for camera in cameras_data:
            if camera[0] not in cameras:
                cameras[camera[0]] = []
            cameras[camera[0]].append({'id': camera[1], 'name': camera[2]})

        species_data = db.session.query(Label.description).join(Task).filter(Task.survey_id==survey_id).distinct().all()
        global_labels = db.session.query(Label.description)\
                            .filter(Label.task_id == None)\
                            .filter(Label.description != 'Wrong')\
                            .filter(Label.description != 'Skip')\
                            .filter(Label.description != 'Remove False Detections')\
                            .filter(Label.description != 'Mask Area')\
                            .all()
        for s in species_data:
            species.append(s[0])

        for s in global_labels:
            species.append(s[0])

    return json.dumps({'sites': sites, 'cameras':cameras, 'species':species})

@app.route('/editDetectionFlank/<detection_id>/<flank>')
@login_required
def editDetectionFlank(detection_id,flank):
    ''' Edits the flank of a detection '''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278
    
    if Config.DEBUGGING: app.logger.info('Detection ID: {} Flank: {}'.format(detection_id, flank))

    individual_id = request.args.get('individual_id', None)
    if individual_id:
        individual = db.session.query(Individual).get(individual_id)
        task = db.session.query(Task).join(Individual,Task.individuals).filter(Task.sub_tasks.any()).filter(Individual.id==individual_id).distinct().first()
        if not task: task = individual.tasks[0]
    else:
        task = current_user.turkcode[0].task

    tasks = [r for r in task.sub_tasks]
    tasks.append(task)

    detection = db.session.query(Detection).get(detection_id)
    if task and detection and (all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in tasks) or all(checkAnnotationPermission(current_user.parent_id,task.id) for task in tasks)):
        if flank.lower() in Config.FLANK_DB.keys():
            detection.flank = Config.FLANK_DB[flank.lower()]
            db.session.commit()

    new_flank = Config.FLANK_TEXT[detection.flank].capitalize()

    return json.dumps({'id': detection_id, 'flank': new_flank})

@app.route('/ibsHandler/getMatchingKpts/<det_id1>/<det_id2>')
@login_required
def getMatchingKpts(det_id1,det_id2):
    ''' Gets the matching keypoints for two detections '''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    individual_id = request.args.get('individual_id', None)
    if individual_id:
        individual = db.session.query(Individual).get(individual_id)
        task = db.session.query(Task).join(Individual,Task.individuals).filter(Task.sub_tasks.any()).filter(Individual.id==individual_id).distinct().first()
        if not task: task = individual.tasks[0]
    else:
        task = current_user.turkcode[0].task

    tasks = [r for r in task.sub_tasks]
    tasks.append(task)

    results = {
        'kpts': {
            det_id1: [],
            det_id2: []
        },
        'scores': []
    }
    det1 = db.session.query(Detection).get(det_id1)
    det2 = db.session.query(Detection).get(det_id2)

    if Config.DEBUGGING: app.logger.info('Getting matching kpts for Detection 1: {} Detection 2: {}'.format(det_id1, det_id2))

    if det1 and det2 and (all(checkSurveyPermission(current_user.id,task.survey_id,'read') for task in tasks) or all(checkAnnotationPermission(current_user.parent_id,task.id) for task in tasks)):
        det1_aid = det1.aid
        det2_aid = det2.aid
        if det1_aid and det2_aid:
            data = get_featurematches(det1_aid,det2_aid)
            if data:
                aid1 = data[0][0]
                aid2 = data[0][1]
                fm = data[0][2]
                fs = data[0][3]

                kpts1, kpts2 = GLOBALS.ibs.get_annot_kpts([aid1, aid2])
                chip_size1, chip_size2 = GLOBALS.ibs.get_annot_chip_sizes([aid1, aid2])

                kpts1_m = kpts1[fm.T[0]]
                kpts2_m = kpts2[fm.T[1]]

                if det1.aid == aid1:
                    aid1_det = det1
                    aid2_det = det2
                else:
                    aid1_det = det2
                    aid2_det = det1

                kpts_coords1 = calc_kpt_coords(kpts1_m,chip_size1,aid1_det)
                kpts_coords2 = calc_kpt_coords(kpts2_m,chip_size2,aid2_det)

                scores = fs.T[0]

                results = {
                    'kpts': {
                        aid1_det.id: kpts_coords1,
                        aid2_det.id: kpts_coords2
                    },
                    'scores': scores.tolist()
                }

    return json.dumps({'results': results})

# NOTE: We are currenlty not allowing the users to edit a detection flank on the Individuals page and it can only be edited 
#     in a Cluster ID (-4 task). The reason we have disallowed this is because of having to recalculate all detection similarities 
#     and individual similaties associated with the detection whose flank has changed. 
# @app.route('/submitIndividualFlanks', methods=['POST'])
# @login_required
# def submitIndividualFlanks():
#     ''' Edit the flanks of the specified individual's detections. '''
#     status = 'error'
#     individual_id = ast.literal_eval(request.form['individual_id'])
#     flanks = ast.literal_eval(request.form['flanks'])
#     individual = db.session.query(Individual).get(individual_id)
#     if flanks:
#         if individual and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
#             detection_ids = list(flanks.keys())
#             detections = db.session.query(Detection).filter(Detection.id.in_(detection_ids)).all()
#             for detection in detections:
#                 detection.flank = Config.FLANK_DB[flanks[str(detection.id)].lower()]
#             db.session.commit()
#             status = 'success'

#     return json.dumps({'status': status}) 

@app.route('/api/v1/addImage', methods=['POST'])
def addImage():
    ''' Adds an image to a survey '''

    api_key = request.headers.get('apikey')
    try:
        hashed_key = hashlib.md5(api_key.encode()).hexdigest()
    except:
        hashed_key = None
    if hashed_key is None or hashed_key == '':
        return json.dumps({'message': 'Unauthorized access.'}), 401
    live_integration = db.session.query(APIKey).filter(APIKey.api_key==hashed_key).first()
    if live_integration and live_integration.survey_id:
        survey_id = live_integration.survey_id
        survey = db.session.query(Survey).get(survey_id)
        # Get Image & image information 
        try:
            image = request.files.get('image')

            if not image:
                return json.dumps({'message': 'No image provided.'}), 400

            filename = image.filename
            data = request.form.to_dict()

            site = data.get('site')
            latitude = data.get('latitude', 0)
            longitude = data.get('longitude', 0)
            altitude = data.get('altitude', 0)
            camera = data.get('camera')

            # Parse coords
            try:
                latitude = float(latitude)
            except:
                latitude = 0

            try:
                longitude = float(longitude)
            except:
                longitude = 0
            
            try:
                altitude = float(altitude)
            except:
                altitude = 0

            timestamp = data.get('timestamp') #timestamp must be in UTC!
            if timestamp:
                try:
                    timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    if timestamp.year<2000 or timestamp>(datetime.utcnow()+timedelta(hours=14)): timestamp = None
                except:
                    timestamp = None

            if not timestamp:
                # Check if it might be unix integer/epoch time 
                try:
                    timestamp = int(data.get('timestamp'))
                    timestamp = datetime.fromtimestamp(int(timestamp))
                    if timestamp.year<2000 or timestamp>(datetime.utcnow()+timedelta(hours=14)): timestamp = None
                except:
                    timestamp = None

            annotations = data.get('annotations')
            if annotations:
                try:
                    annotations = json.loads(annotations)
                except:
                    annotations = None


            if site is None and (latitude == 0) and (longitude == 0):
                return json.dumps({'message': 'Missing site information.'}), 400

            app.logger.info(f'Filename: {filename} Site: {site} Latitude: {latitude} Longitude: {longitude} Altitude: {altitude} Camera: {camera} Timestamp: {timestamp} Annotations: {annotations}')

            suffix = filename.rsplit('.', 1)[1]
            if suffix.lower() not in ['jpg', 'jpeg', 'png']:
                return json.dumps({'message': 'Invalid image format (only JPG and PNG are supported).'}), 400

            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                if suffix.lower() == 'png':
                    #Convert PNG to JPEG
                    img = PIL.Image.open(image)
                    dpi = img.info.get('dpi')
                    exif = img.info.get('exif')
                    img = img.convert('RGB')
                    try:
                        img.save(temp_file.name, 'JPEG', quality=100, dpi=dpi, exif=exif)
                    except:
                        img.save(temp_file.name, 'JPEG', quality=100)
                    filename = filename.rsplit('.', 1)[0] + '.JPG'
                else:
                    image.save(temp_file.name)

                try:
                    image_hash = generate_raw_image_hash(temp_file.name)

                    if len(filename) > 64:
                        # Use hash if filename is too long
                        filename = image_hash + '.' + filename.rsplit('.', 1)[1]

                    # Check if the image already exists
                    survey_folder = survey.organisation.folder + '/' + survey.folder + '/%'
                    survey_folder = survey_folder.replace('_','\\_')
                    existing_image = db.session.query(Image).join(Camera).filter(Camera.path.like(survey_folder)).filter(Image.hash==image_hash).first()
                    if existing_image:
                        return json.dumps({'message': 'Image already exists.', 'image_id': existing_image.id}), 200
                    else:
                        # Add to the database
                        if site:
                            trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==site).first()
                        else:
                            if latitude and longitude:
                                coordinate_tolerance = 0.00001
                                trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(func.abs(Trapgroup.latitude-latitude) <= coordinate_tolerance).filter(func.abs(Trapgroup.longitude-longitude) <= coordinate_tolerance).first()
                        
                        if not trapgroup:
                            if site:
                                site_name = site
                            else:
                                site_name = generate_site_name(survey_id)
                        else:
                            site_name = trapgroup.tag

                        if camera:
                            camera_path = survey.organisation.folder + '/' + survey.folder + '/' + site_name + '/' + camera
                            comp_path = survey.organisation.folder + '-comp/' + survey.folder + '/' + site_name + '/' + camera
                        else:
                            camera_path = survey.organisation.folder + '/' + survey.folder + '/' + site_name
                            comp_path = survey.organisation.folder + '-comp/' + survey.folder + '/' + site_name

                        # Upload to S3
                        image_key = camera_path + '/' + filename
                        comp_key = comp_path + '/' + filename
                        image_exists = False
                        try:
                            GLOBALS.s3client.head_object(Bucket=Config.BUCKET, Key=image_key)
                            image_exists = True
                        except:
                            image_exists = False

                        if image_exists:
                            filename_split = filename.rsplit('.', 1)
                            dup_filename = filename_split[0] + '_%.' + filename_split[1]
                            dup_filename = dup_filename.replace('_','\\_')
                            image_dup_names = [r[0] for r in db.session.query(Image.filename).join(Camera).filter(Camera.path==camera_path).filter(Image.filename.like(dup_filename)).distinct().all()]
                            image_dup_count = len(image_dup_names)
                            filename = filename_split[0] + '_' + str(image_dup_count+1) + '.' + filename_split[1]
                            while filename in image_dup_names:
                                image_dup_count += 1
                                filename = filename_split[0] + '_' + str(image_dup_count+1) + '.' + filename_split[1]
                            image_key = camera_path + '/' + filename
                            comp_key = comp_path + '/' + filename

                        upload_response = GLOBALS.s3client.put_object(Bucket=Config.BUCKET, Key=image_key, Body=temp_file)
                        etag = upload_response['ETag'][1:-1]

                        # Compress image
                        try:
                            with wandImage(filename=temp_file.name).convert('jpeg') as img:
                                # This is required, because if we don't have it ImageMagick gets too clever for it's own good
                                # and saves images with no color content (i.e. fully black image) as grayscale. But this causes
                                # problems for MegaDetector which expects a 3 channel image as input.
                                img.metadata['colorspace:auto-grayscale'] = 'false'
                                img.transform(resize='800')
                                GLOBALS.s3client.upload_fileobj(BytesIO(img.make_blob()),Config.BUCKET,comp_key)
                        except:
                            return json.dumps({'message': 'Error adding image.'}), 400
                        
                        # Get timestamp from EXIF data if not provided
                        if not timestamp:
                            try:
                                t = pyexifinfo.get_json(temp_file.name)[0]
                                exif_timestamp = None
                                for field in ['EXIF:DateTimeOriginal','MakerNotes:DateTimeOriginal']:
                                    if field in t.keys():
                                        exif_timestamp = datetime.strptime(t[field], '%Y:%m:%d %H:%M:%S')
                                        break
                                if exif_timestamp:
                                    timestamp = exif_timestamp
                            except:
                                pass

                        # Check timestamp is not corrupt
                        if timestamp and (timestamp>(datetime.utcnow()+timedelta(hours=14))): timestamp = None
                        if timestamp and (timestamp.year<2000): timestamp = None

                        # If all else fails, use the current time for the timestamp
                        if timestamp==None: timestamp=datetime.utcnow()

                        # Received timestamp will be in UTC need to convert to local time based on coords - everything falls back to UTC
                        if latitude and longitude: timestamp = timestamp + get_utc_offset(latitude,longitude)

                        if not trapgroup:
                            trapgroup = Trapgroup(survey_id=survey_id, tag=site_name, latitude=latitude, longitude=longitude, altitude=altitude)
                            db.session.add(trapgroup)

                        camera = db.session.query(Camera).filter(Camera.path==camera_path).first()
                        if not camera:
                            camera = Camera(trapgroup=trapgroup, path=camera_path)
                            db.session.add(camera)

                        image = Image(camera=camera, filename=filename, timestamp=timestamp, corrected_timestamp=timestamp, hash=image_hash, etag=etag)
                        db.session.add(image)

                        if annotations:
                            for annotation in annotations:

                                if 'det_score' in annotation:
                                    det_score = annotation['det_score']
                                else:
                                    det_score = 1

                                category = 1
                                source = 'api'
                                status= 'active'

                                if 'top' not in annotation or 'left' not in annotation or 'bottom' not in annotation or 'right' not in annotation:
                                    return json.dumps({'message': 'Incomplete annotation.'}), 400

                                top = max(0.0, min(1.0, float(annotation['top'])))
                                left = max(0.0, min(1.0, float(annotation['left'])))
                                bottom = max(0.0, min(1.0, float(annotation['bottom'])))
                                right = max(0.0, min(1.0, float(annotation['right'])))

                                detection = Detection(image=image, top=top, left=left, bottom=bottom, right=right, score=det_score, category=category, source=source, status=status)
                                db.session.add(detection)

                                species = annotation.get('species', None)
                                if species and species.lower() not in ['skip', 'wrong', 'remove false detections', 'mask area', 'none']:
                                    label = None 
                                    if species.lower() == 'vehicles/humans/livestock':
                                        label = db.session.query(Label).get(GLOBALS.vhl_id)
                                    elif species.lower() == 'knocked down':
                                        label = db.session.query(Label).get(GLOBALS.knocked_id)
                                    elif species.lower() == 'nothing':
                                        label = db.session.query(Label).get(GLOBALS.nothing_id)
                                    elif species.lower() == 'unknown':
                                        label = db.session.query(Label).get(GLOBALS.unknown_id)

                                    task_ids = [r[0] for r in db.session.query(Task.id).join(Survey).filter(Survey.id==survey_id).filter(Task.name!='default').all()]
                                    if not task_ids:
                                        new_task = Task(name='Livestream', survey_id=int(survey_id), status='Ready', tagging_time=0, test_size=0, size=200, parent_classification=False)
                                        db.session.add(new_task)
                                        if not label:
                                            label = Label(description=species, task=new_task, hotkey=generate_hotkey(species))
                                            db.session.add(label)
                                        labelgroup = Labelgroup(detection=detection, labels=[label], task=new_task)
                                        db.session.add(labelgroup)
                                    else:
                                        for task_id in task_ids:
                                            if not label:
                                                label = db.session.query(Label).join(Task).filter(Task.id==task_id).filter(Label.description==species).first()
                                                if not label:
                                                    label = Label(description=species, task_id=task_id, hotkey=generate_hotkey(species, task_id))
                                                    db.session.add(label)
                                            labelgroup = Labelgroup(detection=detection, labels=[label], task_id=task_id)
                                            db.session.add(labelgroup)

                        db.session.commit()

                        return json.dumps({'image_id': image.id, 'message': 'Image added successfully.'}), 200
                except:
                    return json.dumps({'message': 'Error adding image.'}), 400
        except:
            return json.dumps({'message': 'Request error.'}), 400
    else:
        return json.dumps({'message': 'Unauthorized access.'}), 401

@app.route('/api/v1/testSetup', methods=['POST'])
def testSetup():
    ''' Tests whether a clients API is setup correctly '''

    api_key = request.headers.get('apikey')
    try:
        hashed_key = hashlib.md5(api_key.encode()).hexdigest()
    except:
        hashed_key = None
    if hashed_key is None or hashed_key == '':
        return json.dumps({'message': 'Unauthorized access.'}), 401
    live_integration = db.session.query(APIKey).filter(APIKey.api_key==hashed_key).first()
    if live_integration:
        if live_integration.survey_id:
            json.dumps({'message': 'Integration successful.'}), 200
        else:
            return json.dumps({'message': 'No destination survey.'}), 400
    else:
        return json.dumps({'message': 'Unauthorized access.'}), 401

@app.route('/generateNewAPIKey/<integration_id>')
@login_required
def generateNewAPIKey(integration_id):
    ''' Generates a new API key for the specified integration '''
    api_key_info = []
    if current_user and current_user.is_authenticated:
        integration = db.session.query(APIKey).get(integration_id)
        if integration and integration.survey_id and checkSurveyPermission(current_user.id,integration.survey_id,'admin'):
            api_keys = generate_api_key(integration.survey_id)
            api_key = api_keys['api_key']
            hashed_key = api_keys['hashed_key']
            integration.api_key = hashed_key 
            db.session.commit()
            api_key_info.append({
                'api_key': api_key,
                'survey_id': integration.survey_id
            })

    return json.dumps({'api_keys': api_key_info})

@app.route('/getClassificationLabels/<survey_id>')
@login_required
def getClassificationLabels(survey_id):
    ''' Gets the classification labels for the specified survey '''
    classifications = []
    if current_user and current_user.is_authenticated:
        survey = db.session.query(Survey).get(survey_id)
        if survey and survey.classifier and checkSurveyPermission(current_user.id,survey.id,'write'):
            classifications = [r[0] for r in db.session.query(ClassificationLabel.classification).filter(ClassificationLabel.classifier_id==survey.classifier_id).order_by(ClassificationLabel.classification).distinct().all()]

    return json.dumps({'classifications': classifications})

@app.route('/getTaskTranslations/<task_id>')
@login_required
def getTaskTranslations(task_id):
    ''' Gets the translations for the specified task '''	
    translations_data = {}
    parent_classification = False
    if current_user and current_user.is_authenticated:
        task = db.session.query(Task).get(task_id)
        if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
            parent_classification = task.parent_classification
            translations = db.session.query(Translation.id, Translation.classification, Label.id, Label.description, Translation.auto_classify, Label.parent_id).join(Label).filter(Translation.task_id==task_id).distinct().all()
            for translation in translations:
                if not translation[5]:
                    translations_data[translation[1]] = {
                        'id': translation[0],	
                        'label_id': translation[2],
                        'label':  translation[3],
                        'classify': translation[4]
                    }
                else:
                    if translation[1] not in translations_data.keys():
                        translations_data[translation[1]] = {
                            'id': translation[0],
                            'label_id': translation[2],
                            'label':  translation[3],
                            'classify': translation[4]
                        }

    return json.dumps({'translations': translations_data, 'parent_classification': parent_classification})

@app.route('/getTaskTags/<task_id>')
@login_required
def getTaskTags(task_id):
    ''' Gets the tags for the specified task '''
    tag_data = []
    if current_user and current_user.is_authenticated:
        task = db.session.query(Task).get(task_id)
        if task and checkSurveyPermission(current_user.id,task.survey_id,'write'):
            tags = db.session.query(Tag).join(Task).filter(Task.id==task_id).distinct().all()
            for tag in tags:
                tag_data.append({
                    'id': tag.id,	
                    'description': tag.description,
                    'hotkey': tag.hotkey
                })

    return json.dumps({'tags': tag_data})

@app.route('/fileHandler/invoke_lambda', methods=['POST'])
@login_required
def invoke_lambda():
    """Invokes a lambda function to process a file."""
    try:
        if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

        survey_id = request.json['survey_id']
        files = request.json['files']
        organisation_id, organisation_folder, survey_status = db.session.query(Organisation.id,Organisation.folder,Survey.status).join(Survey).filter(Survey.id==survey_id).first()
        if organisation_id and (survey_status=='Uploading'):
            userPermissions = db.session.query(UserPermissions).filter(UserPermissions.organisation_id==organisation_id).filter(UserPermissions.user_id==current_user.id).first()
            if userPermissions and userPermissions.create:
                if checkUploadUser(current_user.id,survey_id):
                    if Config.DEBUGGING: app.logger.info('Invoking lambda function for files: {}'.format(len(files)))
                    image_keys = []
                    video_keys = []

                    for file in files:
                        key = organisation_folder + '/' + file['filename'].strip('/')
                        if file['type'] == 'image':
                            image_keys.append(key)
                        elif file['type'] == 'video':
                            video_keys.append(key)

                    payload = {
                        'bucket': Config.BUCKET,
                        'RDS_HOST': Config.RDS_HOST,
                        'RDS_USER': Config.RDS_USER,
                        'RDS_PASSWORD': Config.RDS_PASSWORD,
                        'RDS_DB_NAME': Config.SQLALCHEMY_DATABASE_NAME,
                        'survey_id': survey_id
                    }

                    invoked_lambdas = 0
                    for batch in chunker(image_keys, 350):
                        payload['keys'] = batch
                        GLOBALS.lambdaClient.invoke(FunctionName=Config.IMAGE_IMPORT_LAMBDA, InvocationType='Event', Payload=json.dumps(payload))
                        invoked_lambdas += 1

                    for batch in chunker(video_keys, 5):
                        payload['keys'] = batch
                        payload['extract_function'] = Config.VIDEO_EXTRACT_LAMBDA
                        GLOBALS.lambdaClient.invoke(FunctionName=Config.VIDEO_IMPORT_LAMBDA, InvocationType='Event', Payload=json.dumps(payload))
                        invoked_lambdas += 1

                    try:
                        GLOBALS.redisClient.incrby('lambda_invoked_'+str(survey_id),invoked_lambdas)
                    except:
                        GLOBALS.redisClient.set('lambda_invoked_'+str(survey_id),invoked_lambdas)

                    return 'success'

    except Exception as e:
        if Config.DEBUGGING: app.logger.info('Error invoking lambda function: {}'.format(e))
        pass
        
    return 'error'

@app.route('/getDownloadRequests')
@login_required
def getDownloadRequests():
    ''' Gets the download requests for the user '''
    download_requests = []
    page = request.args.get('page', 1, type=int)
    next = None
    prev = None
    if current_user and current_user.is_authenticated:
        requests = surveyPermissionsSQ(db.session.query(
                                    DownloadRequest.id, 
                                    DownloadRequest.type, 
                                    DownloadRequest.status, 
                                    DownloadRequest.timestamp, 
                                    Task.id,
                                    Task.name, 
                                    Survey.name, 
                                    Organisation.name, 
                                    Organisation.folder,
                                    Survey.require_launch,
                                    DownloadRequest.name
                                )\
                                .join(Task, DownloadRequest.task_id==Task.id)\
                                .join(Survey)\
                                .filter(DownloadRequest.user_id==current_user.id)\
                                ,current_user.id,'read').order_by(DownloadRequest.id.desc()).distinct().all()
        
        current_download_requests = []
        date_now = datetime.utcnow()
        for d in requests:
            request_id = d[0]
            req_type = d[1]
            status = d[2]
            timestamp = d[3]
            task_id = d[4]
            task_name = d[5]
            survey_name = d[6]
            org_name = d[7]
            org_folder = d[8]
            survey_launch = d[9]
            name = d[10] if d[10] else ''

            req_dict = {
                'id': request_id,
                'status': status,
                'file': '',
                'type': req_type,
                'task_id': task_id,
                'restore': 0,
                'total_restore': 0,
                'expires': None,
                'url': None
            }

            if req_type == 'file':
                file = 'FILES - ' + survey_name + ' ' + task_name
                req_dict['file'] = file

                if status == 'Downloading':
                    current_download_requests.append(req_dict)
                else:
                    if status == 'Restoring Files':
                        if survey_launch:
                            restore_time = math.floor(((Config.RESTORE_TIME-(survey_launch-datetime.now()).total_seconds()) / 3600))
                        else:
                            restore_time = 0
                        req_dict['restore'] = restore_time
                        req_dict['total_restore'] = Config.RESTORE_TIME/3600
                            
                        req_dict['expires'] = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                        download_requests.append(req_dict)
                    elif status == 'Available':
                        if timestamp > date_now:
                            req_dict['expires'] = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                            download_requests.append(req_dict)  
                    else:
                        download_requests.append(req_dict)     
            elif req_type == 'export':
                file = req_type.upper() + ' - ' + survey_name + ' ' + task_name
                req_dict['file'] = file
                if status == 'Restoring Files':
                    if survey_launch:
                        restore_time = math.floor(((Config.RESTORE_TIME-(survey_launch-datetime.now()).total_seconds()) / 3600))
                    else:
                        restore_time = 0
                    req_dict['restore'] = restore_time
                    req_dict['total_restore'] = Config.RESTORE_TIME/3600
                        
                    req_dict['expires'] = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                    download_requests.append(req_dict)
                elif status == 'Available':
                    if timestamp > date_now:
                        req_dict['expires'] = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                        req_dict['url'] = 'https://'+Config.BUCKET+'.s3.amazonaws.com/'+(org_folder+'/docs/'+ org_name+'_'+current_user.username+'_'+survey_name+'_'+task_name +'_' + name + '.'+ Config.RESULT_TYPES[req_type]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C')
                        download_requests.append(req_dict)  
                else:
                    download_requests.append(req_dict)     
            else:
                file = req_type.upper() + ' - ' + survey_name + ' ' + task_name
                req_dict['file'] = file
                if status == 'Available':
                    if timestamp > date_now:
                        req_dict['expires'] = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                        req_dict['url'] = 'https://'+Config.BUCKET+'.s3.amazonaws.com/'+(org_folder+'/docs/'+ org_name+'_'+current_user.username+'_'+survey_name+'_'+task_name +'_' + name + '.'+ Config.RESULT_TYPES[req_type]).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C')
                        download_requests.append(req_dict)
                else:
                    download_requests.append(req_dict)

        download_requests = current_download_requests + download_requests
        count = len(download_requests)
        download_requests = download_requests[(page-1)*6:page*6]
        next = page + 1 if count > page*6 else None
        prev = page - 1 if page > 1 else None

    return json.dumps({'download_requests': download_requests, 'next': next, 'prev': prev})


@app.route('/checkAvailableDownloads')
@login_required
def checkDownloadRequests():
    ''' Checks the number of available downloads for the user '''
    available_downloads = 0
    if current_user and current_user.is_authenticated:
        date_now = datetime.utcnow()
        available_downloads = surveyPermissionsSQ(db.session.query(DownloadRequest.id)\
                                .join(Task, DownloadRequest.task_id==Task.id)\
                                .join(Survey)\
                                .filter(DownloadRequest.user_id==current_user.id)\
                                .filter(DownloadRequest.status=='Available')\
                                .filter(DownloadRequest.timestamp > date_now)\
                                ,current_user.id,'read').distinct().count()

    return json.dumps({'available_downloads': available_downloads})

@app.route('/fileHandler/restore_for_download', methods=['POST'])
@login_required
def restore_for_download():
    """Restores images for download."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['task_id']
    task = db.session.query(Task).get(task_id)
    survey = task.survey
    status = 'error'
    message = 'An error occurred while processing the download request. Please try again.'

    if task and checkSurveyPermission(current_user.id,task.survey_id,'read') and task.status.lower() in Config.TASK_READY_STATUSES and survey.status.lower() in Config.SURVEY_READY_STATUSES:
        individual_sorted = request.json['individual_sorted']
        species_sorted = request.json['species_sorted']
        flat_structure = request.json['flat_structure']
        include_empties = request.json['include_empties']
        species = request.json['species']
        include_video = request.json['include_video']
        include_frames = request.json['include_frames']
        raw_files = request.json['raw_files']
        delete_items = request.json['delete_items']

        app.logger.info('Individual Sorted: {} Species Sorted: {} Flat Structure: {} Include Empties: {} Species: {} Include Video: {} Include Frames: {} Raw Files: {} Delete Items: {}'.format(individual_sorted, species_sorted, flat_structure, include_empties, species, include_video, include_frames, raw_files, delete_items))

        if raw_files or include_video or include_empties:

            check = db.session.query(Trapgroup.id).join(Camera).join(Image).outerjoin(Video).filter(Trapgroup.survey_id==task.survey_id).filter(or_(Image.downloaded==True,Video.downloaded==True)).first()
            check2 = db.session.query(DownloadRequest).join(Task).filter(Task.survey_id==task.survey_id).filter(DownloadRequest.type=='file').first()
            if check or check2:
                status = 'error'
                message = 'A download is already in progress for this survey. Please try again later.'
            elif Config.DISABLE_RESTORE:
                status = 'error'
                message = 'File de-archival is currently not available. Please try again later.'
            else:
                # Check if any surveys are busy with a dearchival process
                if survey.status == 'Restoring Files':
                    status = 'error'
                    message = 'Your survey is currently having files restored from archive. Initiating a new download request that requires file restoration is not possible at this time. Please wait for the current restoration process to complete.'
                    return json.dumps({'status': status, 'message': message})
                
                download_dict = {
                    'individual_sorted': individual_sorted,
                    'species_sorted': species_sorted,
                    'flat_structure': flat_structure,
                    'include_empties': include_empties,
                    'species': species,
                    'include_video': include_video,
                    'include_frames': include_frames,
                    'raw_files': raw_files,
                    'delete_items': delete_items
                }

                GLOBALS.redisClient.set('fileDownloadParams_'+str(task_id)+'_'+str(current_user.id),json.dumps(download_dict))

                new_request = DownloadRequest(user_id=current_user.id, task_id=task_id, type='file', status='Initialising', timestamp=None, name='restore')
                db.session.add(new_request)

                survey.status = 'Processing'
                
                db.session.commit()

                restore_files_for_download.apply_async(kwargs={'task_id': task_id, 'download_request_id': new_request.id, 'download_params': download_dict, 'days': Config.DOWNLOAD_RESTORE_DAYS, 'tier': Config.RESTORE_TIER,'restore_time':Config.RESTORE_TIME})

                status = 'success'
                message = 'Your download request has been initiated. A wait time of 48 hours is required for the download to be prepared. Your request progress can be monitored from the downloads menu. Once ready, you will have 7 to download it before it expires.'
    
    return json.dumps({'status': status, 'message': message})

@app.route('/fileHandler/init_download_after_restore', methods=['POST'])
@login_required
def init_download_after_restore():
    """Gets the download request after the images have been restored."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    download_request_id = request.json['download_request_id']
    download_request = db.session.query(DownloadRequest).get(download_request_id)
    if download_request:
        task_id = download_request.task_id
        task = db.session.query(Task).get(task_id)
        if task and checkSurveyPermission(current_user.id,task.survey_id,'read') and task.status.lower() in Config.TASK_READY_STATUSES:
            try:
                download_dict = GLOBALS.redisClient.get('fileDownloadParams_'+str(task_id)+'_'+str(current_user.id))
                if download_dict:
                    download_dict = json.loads(download_dict)
                    download_dict['task_id'] = task_id
                    download_dict['survey_id'] = task.survey_id
                    download_dict['task_name'] = task.name
                    download_request.status = 'Downloading'
                    db.session.commit()
                    GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())

                    return json.dumps({'status': 'success', 'download_params': download_dict})
            except:
                pass

    return json.dumps({'status': 'error', 'message': 'An error occurred while processing the download request. Please try again.'})

@app.route('/fileHandler/init_download_request', methods=['POST'])
@login_required
def init_download_request():
    """Initialises a download request."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278

    task_id = request.json['task_id']
    task = db.session.query(Task).get(task_id)
    status = 'error'
    if task and checkSurveyPermission(current_user.id,task.survey_id,'read') and task.status.lower() in Config.TASK_READY_STATUSES:
        try:
            GLOBALS.redisClient.set('download_ping_'+str(task_id),datetime.utcnow().timestamp())
            download_request = DownloadRequest(user_id=current_user.id, task_id=task_id, type='file', status='Downloading', timestamp=None)
            db.session.add(download_request)
            db.session.commit()
            status = 'success'
            return json.dumps({'status': status, 'download_id': download_request.id})
        except:
            pass

    return json.dumps({'status': status})

@app.route('/deleteDownloadRequest/<download_request_id>')
@login_required
def deleteDownloadRequest(download_request_id):
    """Deletes a download request."""

    if Config.KILL_FILEHANDLER: return {'redirect': url_for('surveys')}, 278
    
    status = 'error'	
    download_request = db.session.query(DownloadRequest).get(download_request_id)
    if download_request and download_request.user_id == current_user.id and checkSurveyPermission(current_user.id,download_request.task.survey_id,'read'):
        task = download_request.task
        celery_id = download_request.celery_id
        try:
            if celery_id: celery.control.revoke(celery_id, terminate=True)
        except:
            pass
        
        if download_request.type == 'file':
            if download_request.name == 'restore':
                try:
                    download_params = json.loads(GLOBALS.redisClient.get('fileDownloadParams_'+str(download_request.task_id)+'_'+str(download_request.user_id)).decode())
                    if download_params['include_empties']: 
                        check = db.session.query(Task.id).filter(Task.survey_id==task.survey_id).filter(Task.tagging_level=='-7').filter(Task.status.in_(['PROGRESS','PENDING'])).first()
                        if not check:
                            cleanup_empty_restored_images.delay(task_id=task.id)
                except:
                    pass
                GLOBALS.redisClient.delete('fileDownloadParams_'+str(task.id)+'_'+str(current_user.id))

            if download_request.status == 'Downloading':
                GLOBALS.redisClient.delete('download_ping_'+str(task.id))
                resetImageDownloadStatus.delay(task_id=task.id,then_set=False,labels=None,include_empties=None, include_frames=True)
                resetVideoDownloadStatus.delay(task_id=task.id,then_set=False,labels=None,include_empties=None, include_frames=True)
            elif download_request.status == 'Restoring Files':
                survey = task.survey
                if survey.status == 'Restoring Files':
                    survey.status = 'Ready'
                    GLOBALS.redisClient.delete('download_launch_kwargs_'+str(survey.id))
                
        else:
            try:
                fileName = task.survey.organisation.folder+'/docs/' + task.survey.organisation.name+'_'+current_user.username+'_'+task.survey.name+'_'+task.name+'_'+download_request.name+'.'+Config.RESULT_TYPES[download_request.type]
                GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName)
            except:
                pass
            
            if download_request.status == 'Restoring Files':
                survey = task.survey
                if survey.status == 'Restoring Files':
                    survey.status = 'Ready'
                    GLOBALS.redisClient.delete('download_launch_kwargs_'+str(survey.id))

        db.session.delete(download_request)
        db.session.commit()
        status = 'success'

    return json.dumps({'status': status})

@app.route('/cancelRestore/<survey_id>')
@login_required
def cancelRestore(survey_id):
    ''' Cancels the restore process for the specified survey '''
    status = 'error'
    survey = db.session.query(Survey).get(survey_id)
    if survey and checkSurveyPermission(current_user.id,survey_id,'write'):
        survey.status = 'Ready'

        restoring_download_requests = db.session.query(DownloadRequest).join(Task).filter(Task.survey_id==survey_id).filter(DownloadRequest.status=='Restoring Files').all()
        for request in restoring_download_requests:
            GLOBALS.redisClient.delete('fileDownloadParams_'+str(request.task_id)+'_'+str(request.user_id))
            db.session.delete(request)
    

        # Check for -5 multiple tasks:
        try:
            id_kwargs = json.loads(GLOBALS.redisClient.get('id_launch_kwargs_'+str(survey_id)).decode())
            if id_kwargs and 'algorithm' in id_kwargs.keys():
                task_ids = id_kwargs['task_ids']
                surveys = db.session.query(Survey).join(Task).filter(Task.id.in_(task_ids)).filter(Survey.status=='Restoring Files').all()
                for s in surveys:
                    s.status = 'Ready'
        except:
            pass

        redis_keys = ['download_launch_kwargs_'+str(survey_id),'id_launch_kwargs_'+str(survey_id),'empty_launch_kwargs_'+str(survey_id),'edit_launch_kwargs_'+str(survey_id)]
        found = False
        for key in redis_keys:
            try:
                GLOBALS.redisClient.get(key).decode()
                key
                found = True
                break
            except:
                pass

        if not found:
            #Check if it might be a sub task 
            for task in survey.tasks:
                if task.master:
                    master_survey_id = task.master[0].survey_id
                    master_survey_id
                    try:
                        id_kwargs = json.loads(GLOBALS.redisClient.get('id_launch_kwargs_'+str(master_survey_id)).decode())
                        if id_kwargs and 'algorithm' in id_kwargs.keys():
                            task_ids = id_kwargs['task_ids']
                            surveys = db.session.query(Survey).join(Task).filter(Task.id.in_(task_ids)).filter(Survey.status=='Restoring Files').all()
                            for s in surveys:
                                s.status = 'Ready'
                            GLOBALS.redisClient.delete('id_launch_kwargs_'+str(master_survey_id))
                            task.master[0].sub_tasks = []
                            break
                    except:
                        pass

        db.session.commit()

        GLOBALS.redisClient.delete('download_launch_kwargs_'+str(survey.id))
        GLOBALS.redisClient.delete('id_launch_kwargs_'+str(survey.id))
        GLOBALS.redisClient.delete('empty_launch_kwargs_'+str(survey.id))
        GLOBALS.redisClient.delete('edit_launch_kwargs_'+str(survey.id))

        status = 'success'
        
    return json.dumps(status)

@app.route('/getMergeIndividuals', methods=['POST'])
@login_required
def getMergeIndividuals():
    '''Returns a paginated dictionary of all individuals a selected individual can be merged with'''

    individual_id = request.form['individual_id']
    search = ast.literal_eval(request.form['search'])
    order = ast.literal_eval(request.form['order'])
    mutual = False
    if 'mutual' in request.form:
        mutual = True if request.form['mutual'] == 'true' else False
    task_id = None
    if 'task_id' in request.form:
        task_id = ast.literal_eval(request.form['task_id'])
        if task_id is None or int(task_id) < 0: task_id = None
    tag = None
    if 'tag' in request.form:
        tag = ast.literal_eval(request.form['tag'])
        if tag is None or tag in ['0','-1','None','']: tag = None
        
    page = request.args.get('page', 1, type=int)

    if Config.DEBUGGING: app.logger.info('Get merge individuals for individual: {}'.format(individual_id))

    reply = []
    next = None
    prev = None
    nr_pages = 1
    current = 1
    individual = db.session.query(Individual).get(individual_id)
    if individual and individual.active==True and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
        species = individual.species
            
        IndividualTask = alias(Task)
        mutual_tasks = db.session.query(Task.id, Task.survey_id)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.id.in_([t.id for t in individual.tasks]))\
                            .distinct().all()

        mutual_tids = [r[0] for r in mutual_tasks]
        mutual_sids = [r[1] for r in mutual_tasks]
        mutual_sids = list(set(mutual_sids))

        tasks = surveyPermissionsSQ(db.session.query(Task.id)\
                                .join(Survey)\
                                .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                                ,current_user.id,'write')

        if task_id:
            tasks = tasks.filter(Task.id==task_id).distinct().all()
            task_ids = [r[0] for r in tasks]
        elif mutual:
            tasks = tasks.filter(Task.id.in_(mutual_tids)).distinct().all()
            task_ids = [r[0] for r in tasks]
        else:
            exclude_tasks = db.session.query(Task.id)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.survey_id.in_(mutual_sids))\
                            .filter(IndividualTask.c.id.notin_(mutual_tids))\
                            .distinct().subquery()

            tasks = tasks.outerjoin(exclude_tasks, Task.id==exclude_tasks.c.id)\
                            .filter(exclude_tasks.c.id==None)\
                            .distinct().all()

            task_ids = [r[0] for r in tasks]

        individual_filters = and_(
            Individual.name != 'unidentifiable',
            Individual.active == True,
            Individual.species == species,
            Individual.id != individual_id,
        )    

        individuals = db.session.query(Individual.id, Individual.name)\
                            .join(Task,Individual.tasks)\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                            .filter(individual_filters)

        if tag:
            individuals = individuals.filter(Individual.tags.any(Tag.description==tag))

        searches = re.split('[ ,]',search)
        for search in searches:
            individuals = individuals.filter(Individual.name.contains(search))

        if order == 'oSim':
            individuals = individuals.outerjoin(IndSimilarity, or_(
                                and_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==Individual.id),
                                and_(IndSimilarity.individual_2==individual.id,IndSimilarity.individual_1==Individual.id)
                            ))\
                            .order_by(IndSimilarity.score.desc(), Individual.name)
        
        elif order == 'oDist':
            Trapgroup2 = alias(Trapgroup)

            site_ids = [r[1] for r in db.session.query(Individual.id, Camera.trapgroup_id)\
                            .filter(Individual.id==individual_id)\
                            .join(Detection,Individual.detections)\
                            .join(Image)\
                            .join(Camera)
                            .distinct().all()]     
            
            distance_expr = 6371 * func.acos(
                func.cos(func.radians(Trapgroup.latitude)) * 
                func.cos(func.radians(Trapgroup2.c.latitude)) * 
                func.cos(func.radians(Trapgroup2.c.longitude) - func.radians(Trapgroup.longitude)) + 
                func.sin(func.radians(Trapgroup.latitude)) * func.sin(func.radians(Trapgroup2.c.latitude))
            )

            site_distance_sq = db.session.query(Trapgroup.id, func.min(distance_expr).label('min_distance'))\
                            .join(Survey,Trapgroup.survey_id==Survey.id)\
                            .join(Task,Task.survey_id==Survey.id)\
                            .join(Trapgroup2, literal(True))\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Trapgroup2.c.id.in_(site_ids))\
                            .group_by(Trapgroup.id).subquery()

            indiv_sq = db.session.query(Individual.id, func.min(site_distance_sq.c.min_distance).label('min_distance'))\
                            .filter(Individual.tasks.any(Task.id.in_(task_ids)))\
                            .filter(individual_filters)\
                            .join(Detection,Individual.detections)\
                            .join(Image)\
                            .join(Camera)\
                            .join(site_distance_sq, site_distance_sq.c.id==Camera.trapgroup_id)\
                            .group_by(Individual.id).subquery()

            individuals = individuals.outerjoin(indiv_sq, indiv_sq.c.id==Individual.id)\
                            .order_by(indiv_sq.c.min_distance.asc(), Individual.name)
        
        else:
            individuals = individuals.order_by(Individual.name)

        # individuals = individuals.distinct().paginate(page, 12, False)
        individuals = individuals.distinct().group_by(Individual.id).paginate(page, 12, False)

        best_detections = calculate_individual_best_detection([individual[0] for individual in individuals.items])

        for individual in individuals.items:
            id = individual[0]
            name = individual[1]

            # Get the best detection for the individual
            best_detection = best_detections.get(id, None)
            if not best_detection: continue

            reply.append({
                'id': id,
                'name': name,
                'url': (best_detection['path'] + '/' + best_detection['filename']).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'detection': {
                    'top': best_detection['top'],
                    'left': best_detection['left'],
                    'right': best_detection['right'],
                    'bottom': best_detection['bottom']
                }
            })

        next = individuals.next_num if individuals.has_next else None
        prev = individuals.prev_num if individuals.has_prev else None
        nr_pages = individuals.pages
        current = individuals.page

    return json.dumps({'individuals': reply, 'next':next, 'prev':prev, 'nr_pages': nr_pages, 'current': current})

@app.route('/mergeIndividuals', methods=['POST'])
@login_required
def mergeIndividuals():
    '''Merges two individuals together'''

    individual_id1 = ast.literal_eval(request.form['individual_id1'])
    individual_id2 = ast.literal_eval(request.form['individual_id2'])
    name = ast.literal_eval(request.form['name'])
    individual1 = db.session.query(Individual).get(individual_id1)
    individual2 = db.session.query(Individual).get(individual_id2)
    status = 'error'
    msg = 'An error occurred while merging the individuals. Please try again.'
    if individual1 and individual2 and individual1.active==True and individual2.active==True and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual1.tasks) and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual2.tasks):
        
        if not name or name == '' or name.lower() == 'unidentifiable' or any(c in name for c in ['/','\\']): 
            status = 'error'
            msg = "Please enter a valid name for the merged individual."
            return json.dumps({'status': status, 'message': msg})

        tasks = [task.id for task in individual1.tasks]
        tasks.extend([task.id for task in individual2.tasks])
        check = db.session.query(Individual)\
            .join(Task,Individual.tasks)\
            .filter(Individual.species==individual1.species)\
            .filter(Individual.name==name)\
            .filter(Task.id.in_(tasks))\
            .filter(Individual.id != individual1.id)\
            .filter(Individual.id != individual2.id)\
            .first()
        if check:
            status = 'error'
            msg = "Duplicate name detected. Please enter a different name."
            return json.dumps({'status': status, 'message': msg})
        
        individual1.active = False
        individual2.active = False
        db.session.commit()
        
        if Config.DEBUGGING: app.logger.info('Individual {} combined into individual {}'.format(individual2.name,individual1.name))

        if individual2.notes != individual1.notes:
            if individual1.notes==None:
                individual1.notes = individual2.notes
            elif individual2.notes==None:
                pass
            else:
                individual1.notes += individual2.notes

        for child in individual2.children[:]:
            if child not in individual1.children[:]:
                individual1.children.append(child)

        for parent in individual2.parents[:]:
            if parent not in individual1.parents[:]:
                individual1.parents.append(parent)

        for tag in individual2.tags[:]:
            if tag not in individual1.tags[:]:
                individual1.tags.append(tag)

        individual1.detections.extend(individual2.detections)
        individual1.user_id = current_user.id
        individual1.timestamp = datetime.utcnow()
    	
        task_ids = [task.id for task in individual1.tasks]
        task_ids.extend([task.id for task in individual2.tasks])
        individual1.tasks = db.session.query(Task)\
                            .join(Survey)\
                            .join(Trapgroup)\
                            .join(Camera)\
                            .join(Image)\
                            .join(Detection)\
                            .filter(Detection.individuals.contains(individual1))\
                            .filter(Task.id.in_(task_ids))\
                            .distinct().all()

        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual2.id,IndSimilarity.individual_2==individual2.id)).distinct().all()
        for similarity in allSimilarities:
            db.session.delete(similarity)
        individual2.tags = []
        individual2.detections = []
        individual2.children = []
        individual2.parents = []
        individual2.tasks = []
        db.session.delete(individual2)

        individual1.name = name if name else individual1.name
        individual1.active = True
        db.session.commit()

        individuals2 = [r[0] for r in db.session.query(Individual.id)\
                                                    .join(Task,Individual.tasks)\
                                                    .filter(Task.id.in_([task.id for task in individual1.tasks]))\
                                                    .filter(Individual.species==individual1.species)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual1.id)\
                                                    .all()]

        calculate_individual_similarity.delay(individual1=individual1.id,individuals2=individuals2,species=individual1.species)

        status = 'success'
        msg = 'Individuals have been merged successfully.'

        return json.dumps({'status': status, 'message': msg})

    return json.dumps({'status': status, 'message': msg})

@app.route('/mergeDetectionIntoIndividual', methods=['POST'])
@login_required
def mergeDetectionIntoIndividual():
    '''Merges a detection into an individual'''

    detection_id = request.form['detection_id']
    individual_id = request.form['individual_id']
    merge_indiviudal_id = request.form['merge_individual_id']

    detection = db.session.query(Detection).get(detection_id)
    individual = db.session.query(Individual).get(individual_id)
    merge_individual = db.session.query(Individual).get(merge_indiviudal_id)

    if detection and individual and merge_individual and individual.active==True and merge_individual.active==True and  all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks) and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in merge_individual.tasks):
        individual.active = False
        merge_individual.active = False
        db.session.commit()
        if Config.DEBUGGING: app.logger.info('Detection {} merged into individual {}'.format(detection.id,merge_individual.id))

        if detection in individual.detections:
            individual.detections.remove(detection)

        if detection not in merge_individual.detections:
            merge_individual.detections.append(detection)

        task_ids = [task.id for task in individual.tasks]
        task_ids.extend([task.id for task in merge_individual.tasks])

        individual.tasks = db.session.query(Task)\
                                    .join(Survey)\
                                    .join(Trapgroup)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(Detection)\
                                    .filter(Detection.individuals.contains(individual))\
                                    .filter(Task.id.in_(task_ids))\
                                    .distinct().all()

        merge_individual.tasks = db.session.query(Task)\
                                    .join(Survey)\
                                    .join(Trapgroup)\
                                    .join(Camera)\
                                    .join(Image)\
                                    .join(Detection)\
                                    .filter(Detection.individuals.contains(merge_individual))\
                                    .filter(Task.id.in_(task_ids))\
                                    .distinct().all()

        individual.active = True
        merge_individual.active = True
        
        db.session.commit()

        individuals1 = [r[0] for r in db.session.query(Individual.id)\
                                                    .join(Task,Individual.tasks)\
                                                    .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                    .filter(Task.id.in_([task.id for task in individual.tasks]))\
                                                    .filter(Individual.species==individual.species)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id))\
                                                    .all()]
        calculate_individual_similarity.delay(individual1=individual.id,individuals2=individuals1,species=individual.species)
        
        individuals2 = [r[0] for r in db.session.query(Individual.id)\
                                            .join(Task,Individual.tasks)\
                                            .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                            .filter(Task.id.in_([task.id for task in merge_individual.tasks]))\
                                            .filter(Individual.species==merge_individual.species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .filter(Individual.id != merge_individual.id)\
                                            .filter(or_(IndSimilarity.individual_1==merge_individual.id,IndSimilarity.individual_2==merge_individual.id))\
                                            .all()]
        if merge_individual.id in individuals1 and individual.id in individuals2: individuals2.remove(individual.id)
        calculate_individual_similarity.delay(individual1=merge_individual.id,individuals2=individuals2,species=merge_individual.species)

        return json.dumps({'status': 'success'})

    return json.dumps({'status': 'error'})

@app.route('/getMergeTasks/<id>/<id_type>')
@login_required
def getMergeTasks(id,id_type):
    '''Returns a paginated dictionary of all tasks where other individuals can be merged into the selected individual'''
    individual_id = None
    task_id = None
    if id_type == 'individual':
        individual_id = id
    else:
        cluster = db.session.query(Cluster).get(id)
        task_id = cluster.task_id
    
    mutual = request.args.get('mutual', 0, type=int)
    mutual = True if mutual == 1 else False
    task_info = []
    tags = []

    indiv_tids = []
    if individual_id:
        individual = db.session.query(Individual).get(individual_id)
        if individual and individual.active==True and all(checkSurveyPermission(current_user.id,task.survey_id,'write') for task in individual.tasks):
            species = individual.species
            indiv_tids = [task.id for task in individual.tasks]
    elif task_id:
        if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278 
        task = db.session.query(Task).get(task_id)
        if task and checkAnnotationPermission(current_user.parent_id,task.id):
            species = task.tagging_level.split(',')[1]
            indiv_tids = [task_id]

    if indiv_tids:            
        IndividualTask = alias(Task)
        mutual_tasks = db.session.query(Task.id, Survey.id)\
                            .join(Survey)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.id.in_(indiv_tids))\
                            .distinct().all()

        task_ids = [r[0] for r in mutual_tasks]
        survey_ids = [r[1] for r in mutual_tasks]
        survey_ids = list(set(survey_ids))

        if mutual:
            tasks = db.session.query(Task.id, Task.name, Survey.name, Survey.id)\
                                .join(Survey)\
                                .join(Individual,Task.individuals)\
                                .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                                .filter(Individual.species==species)\
                                .filter(Individual.name != 'unidentifiable')\
                                .filter(Task.id.in_(task_ids))
            if individual_id:
                tasks = surveyPermissionsSQ(tasks,current_user.id,'write').distinct().all()
            else:
                tasks = annotationPermissionSQ(tasks,current_user.parent_id).distinct().all()
        else:
            exclude_tasks = db.session.query(Task.id)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.survey_id.in_(survey_ids))\
                            .filter(IndividualTask.c.id.notin_(task_ids))\
                            .distinct().subquery()

            tasks = db.session.query(Task.id, Task.name, Survey.name, Survey.id)\
                                .join(Survey)\
                                .join(Individual,Task.individuals)\
                                .outerjoin(exclude_tasks, Task.id==exclude_tasks.c.id)\
                                .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                                .filter(Individual.species==species)\
                                .filter(Individual.name != 'unidentifiable')\
                                .filter(exclude_tasks.c.id==None)

            if individual_id:
                tasks = surveyPermissionsSQ(tasks,current_user.id,'write').distinct().all()
            else:
                tasks = annotationPermissionSQ(tasks,current_user.parent_id).distinct().all()
                                    
        for task in tasks:
            task_info.append({
                'id': task[0],
                'name': task[2] + ' - ' + task[1],
            })

        tags = [r[0] for r in db.session.query(Tag.description).filter(Tag.task_id.in_([t[0] for t in tasks])).distinct().all()]

    return json.dumps({'tasks': task_info, 'tags': tags})


@app.route('/getKnownIndividuals', methods=['POST'])
@login_required
def getKnownIndividuals():
    '''Returns a paginated dictionary of all individuals a selected individual can be merged with'''

    if (not current_user.admin) and (not GLOBALS.redisClient.sismember('active_jobs_'+str(current_user.turkcode[0].task_id),current_user.username)): return {'redirect': url_for('done')}, 278

    cluster_id = request.form['cluster_id']
    search = ast.literal_eval(request.form['search'])
    order = ast.literal_eval(request.form['order'])
    task_id = None
    if 'task_id' in request.form:
        task_id = ast.literal_eval(request.form['task_id'])
        if task_id is None or int(task_id) < 0: task_id = None
    tag = None
    if 'tag' in request.form:
        tag = ast.literal_eval(request.form['tag'])
        if tag is None or tag in ['0','-1','None','']: tag = None
        
    page = request.args.get('page', 1, type=int)

    reply = []
    next = None
    prev = None
    nr_pages = 1
    current = 1
    cluster = db.session.query(Cluster).get(cluster_id)
    task = cluster.task
    if task and checkAnnotationPermission(current_user.parent_id,task.id):
        species = task.tagging_level.split(',')[1]
            
        IndividualTask = alias(Task)
        mutual_tasks = db.session.query(Task.id, Task.survey_id)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.id==task.id)\
                            .distinct().all()

        mutual_tids = [r[0] for r in mutual_tasks]
        mutual_sids = [r[1] for r in mutual_tasks]
        mutual_sids = list(set(mutual_sids))

        tasks = annotationPermissionSQ(db.session.query(Task.id)\
                                .join(Survey)\
                                .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                                ,current_user.parent_id)

        if task_id:
            tasks = tasks.filter(Task.id==task_id).distinct().all()
            task_ids = [r[0] for r in tasks]
        else:
            exclude_tasks = db.session.query(Task.id)\
                            .join(Individual,Task.individuals)\
                            .join(IndividualTask,Individual.tasks)\
                            .filter(IndividualTask.c.survey_id.in_(mutual_sids))\
                            .filter(IndividualTask.c.id.notin_(mutual_tids))\
                            .distinct().subquery()

            tasks = tasks.outerjoin(exclude_tasks, Task.id==exclude_tasks.c.id)\
                            .filter(exclude_tasks.c.id==None)\
                            .distinct().all()

            task_ids = [r[0] for r in tasks]

        individual_filters = and_(
            Individual.name != 'unidentifiable',
            Individual.active == True,
            Individual.species == species
        )    

        individuals = db.session.query(Individual.id, Individual.name)\
                            .join(Task,Individual.tasks)\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Task.status.in_(['SUCCESS', 'Stopped', 'Ready']))\
                            .filter(individual_filters)

        if tag:
            individuals = individuals.filter(Individual.tags.any(Tag.description==tag))

        searches = re.split('[ ,]',search)
        for search in searches:
            individuals = individuals.filter(Individual.name.contains(search))

        if order == 'oDist':
            Trapgroup2 = alias(Trapgroup)
            site_ids = [r[0] for r in db.session.query(Camera.trapgroup_id).join(Image).join(Cluster,Image.clusters).filter(Cluster.id==cluster_id).distinct().all()] 
            
            distance_expr = 6371 * func.acos(
                func.cos(func.radians(Trapgroup.latitude)) * 
                func.cos(func.radians(Trapgroup2.c.latitude)) * 
                func.cos(func.radians(Trapgroup2.c.longitude) - func.radians(Trapgroup.longitude)) + 
                func.sin(func.radians(Trapgroup.latitude)) * func.sin(func.radians(Trapgroup2.c.latitude))
            )

            site_distance_sq = db.session.query(Trapgroup.id, func.min(distance_expr).label('min_distance'))\
                            .join(Survey,Trapgroup.survey_id==Survey.id)\
                            .join(Task,Task.survey_id==Survey.id)\
                            .join(Trapgroup2, literal(True))\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Trapgroup2.c.id.in_(site_ids))\
                            .group_by(Trapgroup.id).subquery()

            indiv_sq = db.session.query(Individual.id, func.min(site_distance_sq.c.min_distance).label('min_distance'))\
                            .filter(Individual.tasks.any(Task.id.in_(task_ids)))\
                            .filter(individual_filters)\
                            .join(Detection,Individual.detections)\
                            .join(Image)\
                            .join(Camera)\
                            .join(site_distance_sq, site_distance_sq.c.id==Camera.trapgroup_id)\
                            .group_by(Individual.id).subquery()

            individuals = individuals.outerjoin(indiv_sq, indiv_sq.c.id==Individual.id)\
                            .order_by(indiv_sq.c.min_distance.asc(), Individual.name)
        
        else:
            individuals = individuals.order_by(Individual.name)

        # individuals = individuals.distinct().paginate(page, 9, False)
        individuals = individuals.distinct().group_by(Individual.id).paginate(page, 9, False)

        best_detections = calculate_individual_best_detection([individual[0] for individual in individuals.items])

        for individual in individuals.items:
            id = individual[0]
            name = individual[1]

            # Get the best detection for the individual
            best_detection = best_detections.get(id, None)
            if not best_detection: continue

            reply.append({
                'id': id,
                'name': name,
                'url': (best_detection['path'] + '/' + best_detection['filename']).replace('+','%2B').replace('?','%3F').replace('#','%23').replace('\\','%5C'),
                'detection': {
                    'top': best_detection['top'],
                    'left': best_detection['left'],
                    'right': best_detection['right'],
                    'bottom': best_detection['bottom']
                }
            })


        next = individuals.next_num if individuals.has_next else None
        prev = individuals.prev_num if individuals.has_prev else None
        nr_pages = individuals.pages
        current = individuals.page

    return json.dumps({'individuals': reply, 'next':next, 'prev':prev, 'nr_pages': nr_pages, 'current': current})

@app.route('/getSiteCoords')
@login_required
def getSiteCoords():
    '''Returns the coordinates of a site for the map'''

    coords = {}
    task = current_user.turkcode[0].task
    if task and checkAnnotationPermission(current_user.parent_id,task.id):
        sites = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).distinct().all()
        for site in sites:
            coords[site.id] = {
                'latitude': site.latitude,
                'longitude': site.longitude,
                'altitude': site.altitude,
                'tag': site.tag
            }

    return json.dumps(coords)

@app.route('/getFolderFirstFile/<org_id>/<survey_id>/<folder>')
@login_required
def getFolderFirstFile(org_id,survey_id,folder):
    '''Fetches the first file in a specific folder of an organisation's bucket'''
    file = None
    if current_user.is_authenticated:
        org_id = int(org_id) if org_id else None
        survey_id = int(survey_id) if survey_id else None
        if org_id and org_id!=0:
            organisation = db.session.query(Organisation).join(UserPermissions).filter(UserPermissions.user_id==current_user.id).filter(UserPermissions.organisation_id==org_id).filter(UserPermissions.create==True).first()
        elif survey_id and survey_id!=0:
            organisation = db.session.query(Organisation).join(UserPermissions).join(Survey).filter(UserPermissions.user_id==current_user.id).filter(Survey.id==survey_id).filter(UserPermissions.create==True).first()
        else: 
            organisation = None

        if organisation:
            file = find_first_file(Config.BUCKET, organisation.folder +'/'+ folder)
            if file:
                file = '/'.join(file.split('/')[2:-1]) 

    return json.dumps(file)