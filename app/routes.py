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
import GLOBALS
import json
from flask import render_template, redirect, url_for, flash, request, send_from_directory, send_file
from flask_login import current_user, login_user, logout_user, login_required
from app.forms import LoginForm, NewSurveyForm, EnquiryForm, ResetPasswordForm, RequestPasswordChangeForm
from werkzeug.urls import url_parse
from app.forms import RegistrationForm
import time
from sqlalchemy.sql import func, or_, alias, and_, distinct
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

GLOBALS.s3client = boto3.client('s3')
GLOBALS.lock = Lock()

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

    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    tL = re.split(',',task.tagging_level)
    name = generateUniqueName(task.id,int(tL[1]),tL[2])
    return json.dumps(name)

@app.route('/releaseTask/<task_id>')
@login_required
def releaseTask(task_id):
    '''Releases a reserved task by setting it's status to stopped.'''

    task = db.session.query(Task).get(task_id)
    if task and (task.survey.user_id==current_user.id):
        task.status = 'Stopped'
        task.survey.status = 'Ready'
        db.session.commit()
    return json.dumps('success')

@app.route('/launchTask/<task_id>/<taskSize>/<taggingLevel>/<isBounding>', methods=['POST'])
@login_required
def launchTask(task_id, taskSize, taggingLevel, isBounding):
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
    
    task = db.session.query(Task).get(task_id)
    message = 'Task not ready to be launched.'

    if (task==None) or (taskSize in ['','none','null']) or (taggingLevel.lower() in ['','none','null']):
        message = 'An unexpected error has occurred. Please check your form and try again.'
        return json.dumps({'message': message, 'status': 'Error'})

    if (task.status.lower() in Config.TASK_READY_STATUSES) and (task.survey.user_id==current_user.id):
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
        untranslated = []
        translations = db.session.query(Translation).filter(Translation.task_id==int(task_id)).all()
        translations = [translation.classification for translation in translations]

        untranslated_prior = db.session.query(Detection.classification)\
                                .join(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .filter(Trapgroup.survey_id==task.survey_id)\
                                .filter(~Detection.classification.in_(translations))\
                                .distinct().all()

        untranslated_prior = [r[0] for r in untranslated_prior if r[0] != None]

        if len(untranslated_prior) != 0:
            #Attempt to auto-translate
            for classification in untranslated_prior:
                if classification.lower() not in ['knocked down','nothing','vehicles/humans/livestock','unknown']:
                    species = db.session.query(Label).filter(Label.task_id==int(task_id)).filter(func.lower(Label.description)==func.lower(classification)).first()
                else:
                    species = db.session.query(Label).filter(func.lower(Label.description)==func.lower(classification)).first()

                if species:
                    translation = Translation(classification=classification, label_id=species.id, task_id=int(task_id))
                    db.session.add(translation)
                else:
                    untranslated.append(classification)
            db.session.commit()

            if len(untranslated) != 0:
                translations = db.session.query(Translation)\
                                        .join(Label)\
                                        .filter(Label.children.any())\
                                        .filter(Label.description != 'Vehicles/Humans/Livestock')\
                                        .filter(Label.description != 'Nothing')\
                                        .filter(Label.description != 'Unknown')\
                                        .filter(Translation.task_id==int(task_id)).all()
                for translation in translations:
                    if not checkChildTranslations(translation.label):
                        for child in translation.label.children:
                            createChildTranslations(translation.classification,int(task_id),child)    
                db.session.commit()

        task.size = taskSize
        task.tagging_level = taggingLevel
        task.is_bounding = isBounding
        db.session.commit()

        if any(level in taggingLevel for level in ['-4','-2']):
            tags = db.session.query(Tag.description,Tag.hotkey,Tag.id).filter(Tag.task_id==int(task_id)).order_by(Tag.description).all()
            checkAndRelease.apply_async(kwargs={'task_id': task_id},countdown=300, queue='priority', priority=9)
            return json.dumps({'status': 'tags', 'tags': tags})

        elif len(untranslated) == 0:
            launch_task.apply_async(kwargs={'task_id':task_id})
            return json.dumps({'status': 'Success'})

        else:
            labels = ['Nothing (Ignore)','Vehicles/Humans/Livestock']
            labels.extend([label.description for label in db.session.query(Label).filter(Label.task_id==int(task_id)).order_by(Label.description).all()])
            checkAndRelease.apply_async(kwargs={'task_id': task_id},countdown=300, queue='priority', priority=9)
            return json.dumps({'status': 'untranslated','untranslated':untranslated,'labels':labels})

    return json.dumps({'message': message, 'status': 'Error'})

@app.route('/MturkStatus/<task_id>')
@login_required
def MturkStatus(task_id):
    '''Returns a dictionary status of a requested task: state, hitsCompleted, hitsActive and id.'''
    if current_user.admin:
        task = db.session.query(Task).get(int(task_id))

        jobs_finished = db.session.query(Turkcode)\
                                .join(User, User.username==Turkcode.user_id)\
                                .filter(User.parent_id!=None)\
                                .filter(Turkcode.task_id==int(task_id))\
                                .filter(Turkcode.tagging_time!=None)\
                                .distinct().count()

        jobs_finished = jobs_finished - task.jobs_finished
        jobs_active = db.session.query(Turkcode).filter(Turkcode.task_id==int(task_id)).filter(Turkcode.active==True).count()

        response = {
            'state': task.status,
            'hitsCompleted': jobs_finished,
            'hitsActive': jobs_active,
            'id': task_id
        }

        return json.dumps(response)

    else:
        return redirect(url_for('jobs'))

@app.route('/updateTaskProgressBar/<tskd>')
@login_required
def updateTaskProgressBar(tskd):
    '''Returns a dictionary of data required to update a given task's progress bar.'''
    
    if current_user.admin or (current_user.parent_id == None):
        task_id = int(tskd)
        task = db.session.query(Task).get(task_id)
        taggingLevel = task.tagging_level

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

            remaining = db.session.query(Individual)\
                            .outerjoin(sq1,sq1.c.indID1==Individual.id)\
                            .outerjoin(sq2,sq2.c.indID2==Individual.id)\
                            .join(Detection,Individual.detections)\
                            .filter(Individual.active==True)\
                            .filter(Individual.task_id==task_id)\
                            .filter(Individual.label_id==label.id)\
                            .filter(Individual.name!='unidentifiable')\
                            .filter(or_(sq1.c.count1>0, sq2.c.count2>0))\
                            .distinct().count()

            total = db.session.query(Individual)\
                            .join(Detection,Individual.detections)\
                            .filter(Individual.active==True)\
                            .filter(Individual.task_id==task_id)\
                            .filter(Individual.label_id==label.id)\
                            .filter(Individual.name!='unidentifiable')\
                            .distinct().count()
        else:
            if (',' not in taggingLevel) and (int(taggingLevel) > 0):
                label = db.session.query(Label).get(int(taggingLevel))
                names = [label.description]
                ids = [label.id]
                names, ids = addChildLabels(names,ids,label,task_id)
                total = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.any(Label.id.in_(ids))).count()
            else:
                total = db.session.query(Cluster).filter(Cluster.task_id==task_id).count()

            remaining = db.session.query(Cluster)\
                            .filter(Cluster.task_id == task_id)\
                            .filter(Cluster.examined==False)\
                            .distinct().count()

        completed = total-remaining

        if '-5' in taggingLevel:
            remaining = str(remaining) + ' individuals remaining.'
        else:
            remaining = str(remaining) + ' clusters remaining.'

        jobsCompleted = db.session.query(Turkcode)\
                                .join(User, User.username==Turkcode.user_id)\
                                .filter(User.parent_id!=None)\
                                .filter(Turkcode.task_id==int(task_id))\
                                .filter(Turkcode.tagging_time!=None)\
                                .distinct().count()

        jobsCompleted = jobsCompleted - task.jobs_finished
        jobsAvailable = db.session.query(Turkcode).filter(Turkcode.task_id==task_id).filter(Turkcode.active==True).count()

        return json.dumps({'completed':completed, 'total':total, 'remaining':remaining, 'id':task_id, 'jobsCompleted':jobsCompleted, 'jobsAvailable':jobsAvailable})

    return redirect(url_for('jobs'))

@app.route('/takeJob/<task_id>')
@login_required
def takeJob(task_id):
    '''Returns an available job code and associated endpoint for a given task.'''

    task = db.session.query(Task).get(int(task_id))

    if task and (task.status=='PROGRESS') and ((current_user in task.survey.user.workers) or (current_user == task.survey.user)):

        if (len(current_user.children[:]) == 0) and (not task.is_bounding) and (',' not in task.tagging_level) and (not Config.LOAD_TESTING):
            endpoint = '/tutorial/'
        else:
            endpoint = '/dotask/'

        if not populateMutex(int(task_id)): return json.dumps({'status':'inactive'})
        GLOBALS.mutex[int(task_id)]['job'].acquire()
        db.session.commit()

        job = db.session.query(Turkcode).filter(Turkcode.active==True).filter(Turkcode.task_id==int(task_id)).first()

        if job == None:
            GLOBALS.mutex[int(task_id)]['job'].release()
            return json.dumps({'status':'error'})

        job.active = False
        job.assigned = datetime.utcnow()
        db.session.commit()
        GLOBALS.mutex[int(task_id)]['job'].release()

        return json.dumps({'status':'success','code':endpoint+job.user_id})
    else:
        return json.dumps({'status':'inactive'})

@app.route('/getIndividuals/<task_id>/<species_id>')
@login_required
def getIndividuals(task_id,species_id):
    '''Returns a paginated dictionary of all individuals associated with a specified label and task, including the individual names, ID, and best image.'''
    
    reply = []
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)

    if task and (task.survey.user==current_user):
        page = request.args.get('page', 1, type=int)
        
        if int(species_id)==0:
            individuals = db.session.query(Individual).filter(Individual.task_id==task_id).filter(Individual.name!='unidentifiable').filter(Individual.active==True).order_by(Individual.name).paginate(page, 8, False)
        else:
            individuals = db.session.query(Individual).filter(Individual.task_id==task_id).filter(Individual.name!='unidentifiable').filter(Individual.active==True).filter(Individual.label_id==int(species_id)).order_by(Individual.name).paginate(page, 8, False)

        for individual in individuals.items:
            image = db.session.query(Image)\
                            .join(Detection)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .order_by(desc(Image.detection_rating)).first()
            reply.append({
                            'id': individual.id,
                            'name': individual.name,
                            'url': image.camera.path + '/' + image.filename
                        })

        next = individuals.next_num if individuals.has_next else None
        prev = individuals.prev_num if individuals.has_prev else None

        return json.dumps({'individuals': reply, 'next':next, 'prev':prev})

    return json.dumps('error')

@app.route('/deleteIndividual/<individual_id>')
@login_required
def deleteIndividual(individual_id):
    '''Deletes the requested individual and returns a success or error status.'''

    individual_id = int(individual_id)
    individual = db.session.query(Individual).get(individual_id)

    if individual and (individual.task.survey.user==current_user):
        task_id = individual.task_id
        label_id = individual.label_id

        for detection in individual.detections:
            newIndividual = Individual( name=generateUniqueName(task_id,label_id,'n'),
                                        task_id=task_id,
                                        label_id=label_id,
                                        user_id=current_user.id,
                                        timestamp=datetime.utcnow())

            db.session.add(newIndividual)
            newIndividual.detections.append(detection)
            db.session.commit()

            individuals = [r.id for r in db.session.query(Individual)\
                                                    .filter(Individual.task_id==task_id)\
                                                    .filter(Individual.label_id==label_id)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .filter(Individual.id != newIndividual.id)\
                                                    .all()]

            calculate_individual_similarity.delay(individual1=newIndividual.id,individuals2=individuals)

        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:
            db.session.delete(similarity)

        individual.detections = []
        individual.tags = []
        individual.children = []
        individual.parents = []
        db.session.delete(individual)
        db.session.commit()

        return json.dumps('success')

    return json.dumps('error')

@app.route('/getIndividual/<individual_id>')
@login_required
def getIndividual(individual_id):
    '''Returns a dictionary of all images associated with the specified individual with the following info: ID, URL, timestamp, trapgroup, and detections.'''
    
    reply = []
    individual_id = int(individual_id)
    individual = db.session.query(Individual).get(individual_id)

    if individual and (individual.task.survey.user==current_user):
        images = db.session.query(Image)\
                            .join(Detection)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .order_by(desc(Image.detection_rating)).all()

        for image in images:
            detection = db.session.query(Detection)\
                            .filter(Detection.image_id==image.id)\
                            .filter(Detection.individuals.contains(individual))\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .first()

            reply.append({
                            'id': image.id,
                            'url': image.camera.path + '/' + image.filename,
                            'timestamp': image.corrected_timestamp.strftime("%Y/%m/%d %H:%M:%S"), 
                            'trapgroup': image.camera.trapgroup.tag,
                            'detections': [
                                {
                                    'id': detection.id,
                                    'static': detection.static,
                                    'top': detection.top,
                                    'left': detection.left,
                                    'right': detection.right,
                                    'bottom': detection.bottom
                                }
                            ]
                        })

    return json.dumps(reply)

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

    if survey and (survey.user==current_user):

        trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).order_by(Trapgroup.tag).distinct().paginate(page, 5, False)

        for trapgroup in trapgroups.items:
            data = {'tag': trapgroup.tag, 'cameras': []}
            # groups = get_groups(trapgroup)
            # for group in groups:
            for camera in trapgroup.cameras:
                first = db.session.query(Image).filter(Image.camera==camera).order_by(Image.corrected_timestamp).first()
                data['cameras'].append({    'id': camera.id,
                                            'folder': camera.path,
                                            'timestamp': first.timestamp.strftime("%Y/%m/%d %H:%M:%S"),
                                            'corrected_timestamp': first.corrected_timestamp.strftime("%Y/%m/%d %H:%M:%S")})
            reply.append(data)

        next_url = url_for('getCameraStamps', page=trapgroups.next_num, survey_id=survey_id) if trapgroups.has_next else None
        prev_url = url_for('getCameraStamps', page=trapgroups.prev_num, survey_id=survey_id) if trapgroups.has_prev else None

    return json.dumps({'survey': survey_id, 'data': reply, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getTaggingLevelsbyTask/<task_id>/<task_type>')
@login_required
def getTaggingLevelsbyTask(task_id,task_type):
    '''Returns the available tagging levels and label-completion info for the specified task and tagging type.'''

    admin=db.session.query(User).filter(User.username=='Admin').first()
    task_id = int(task_id)

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
                count = checkForIdWork(task_id,label,0)
                if count==0:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')
            else:
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

                count = db.session.query(Cluster)\
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
                                    .distinct().first()

                if count==0:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')
            
            texts.append(label.description)
            values.append(label.id)

    elif task_type=='AIcheck':
        values = ['-3']
        disabled = 'true'
        task = db.session.query(Task).get(task_id)

        if task.class_check_count == None: updateLabelCompletionStatus(task_id)
        check = task.class_check_count

        texts = ['Comparison ('+str(check)+')']

        if check>0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

    elif task_type=='differentiation':
        disabled = 'true'

        subq = db.session.query(labelstable.c.cluster_id.label('clusterID'), func.count(distinct(labelstable.c.label_id)).label('labelCount')) \
                        .join(Cluster,Cluster.id==labelstable.c.cluster_id) \
                        .filter(Cluster.task_id==task_id) \
                        .group_by(labelstable.c.cluster_id) \
                        .subquery()
        uncheckedMulti = db.session.query(Cluster) \
                        .join(Image,Cluster.images) \
                        .join(Detection) \
                        .join(Labelgroup) \
                        .join(subq, subq.c.clusterID==Cluster.id) \
                        .filter(Labelgroup.task_id==task_id) \
                        .filter(Labelgroup.checked==False) \
                        .filter(Cluster.task_id==task_id) \
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static==False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .filter(subq.c.labelCount>1).distinct().count()

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

        labels = db.session.query(Label).filter(Label.task_id==task_id).all()
        labels.append(db.session.query(Label).get(GLOBALS.vhl_id))    

        for label in labels:
            if label.bounding_count == None: updateLabelCompletionStatus(task_id)

            if label.bounding_count==0:
                colours.append('#0A7850')
            else:
                colours.append('#000000')
            
            texts.append(label.description+' ('+str(label.bounding_count)+')')
            values.append(label.id)

    elif task_type=='clusterTag':
        check = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.any()).filter(Cluster.user_id!=admin.id).first()
        if check == None:
            disabled = 'true'
        else:
            disabled = 'false'

        check = db.session.query(Cluster)\
                        .join(Image, Cluster.images)\
                        .join(Detection)\
                        .filter(Cluster.task_id==int(task_id))\
                        .filter(~Cluster.labels.any())\
                        .filter(Detection.static==False)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .distinct().count()

        if check != 0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']
        texts = ['Top-level ('+str(check)+')']
        values = ['-1']

        if disabled == 'false':
            labels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.children.any()).all()
            for label in labels:
                if label.complete==True:
                    colours.append('#0A7850')
                else:
                    colours.append('#000000')

                if label.cluster_count == None: updateLabelCompletionStatus(task_id)
                
                texts.append(label.description+' ('+str(label.cluster_count)+')')
                values.append(label.id)

            #VHL
            label = db.session.query(Label).get(GLOBALS.vhl_id)
            count = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(label)).distinct().count()
            texts.append(label.description+' ('+str(count)+')')
            values.append(label.id)

    elif task_type=='infoTag':
        disabled = 'false'
        
        check = db.session.query(Cluster)\
                        .join(Image, Cluster.images)\
                        .join(Detection)\
                        .filter(Cluster.task_id==int(task_id))\
                        .filter(Cluster.labels.any())\
                        .filter(~Cluster.tags.any())\
                        .filter(Detection.static==False)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .distinct().count()
        if check != 0:
            colours = ['#000000']
        else:
            colours = ['#0A7850']

        texts = ['All ('+str(check)+')']
        values = ['-2']
        labels = db.session.query(Label).filter(Label.task_id==task_id).distinct().all()
        for label in labels:
            if label.info_tag_count == None: updateLabelCompletionStatus(task_id)

            if label.info_tag_count != 0:
                colours.append('#000000')
            else:
                colours.append('#0A7850')
            
            texts.append(label.description+' ('+str(label.info_tag_count)+')')
            values.append('-2,'+str(label.id))

        # VHL
        label = db.session.query(Label).get(GLOBALS.vhl_id)
        count = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(label)).filter(~Cluster.tags.any()).distinct().count()
        texts.append(label.description+' ('+str(count)+')')
        values.append('-2,'+str(label.id))

    return json.dumps({'texts': texts, 'values': values, 'disabled':disabled, 'colours':colours})

@app.route('/stopTask/<task_id>')
@login_required
def stopTask(task_id):
    '''Stops the specified task and does all necessary clean up. Returns success on completion, error otherwise.'''

    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user==current_user) and (task.status.lower() not in Config.TASK_READY_STATUSES):
        stop_task.apply_async(kwargs={'task_id':task_id})
        return json.dumps('success')

    return json.dumps('error')

@app.route('/deleteTask/<task_id>')
@login_required
def deleteTask(task_id):
    '''Deletes the specified task. Returns a success/error status and associated message.'''

    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)
    if (task!=None) and (task.survey.user_id==current_user.id):
        if task.status.lower() not in Config.TASK_READY_STATUSES:
            status = 'error'
            message = 'The task is currently in use. Please stop it first.'
        else:  
            task.status = 'Deleting'
            db.session.commit()
            status = 'success'
            message = ''

            app.logger.info('Deleting task.')
            delete_task.delay(task_id=task_id)
    else:
        status = 'error'
        message = 'The task cannot be found.'

    return json.dumps({'status': status, 'message': message})

@app.route('/deleteSurvey/<surveyName>')
@login_required
def deleteSurvey(surveyName):
    '''Deletes the survey belonging to the current user with the specified name and all associated tasks. Returns a success/error status and associated message.'''

    status = 'success'
    message = ''

    survey = db.session.query(Survey).filter(Survey.user_id==current_user.id).filter(Survey.name==surveyName).first()
    if (survey!=None) and (survey.user==current_user):
        survey_id = survey.id
        tasks = db.session.query(Task).filter(Task.survey_id==survey_id).all()

        #Check that survey is not in use
        if survey.status.lower() in Config.SURVEY_READY_STATUSES:
            pass
        else:
            status = 'error'
            message = 'The survey is currently being uploaded to. Please cancel this before deleting it.'

        if status != 'error':
            for task in tasks:
                if task.status.lower() not in Config.TASK_READY_STATUSES:
                    status = 'error'
                    message = 'A task from this survey is currently launched. Please stop it before deleting this survey.'
        
        if status != 'error':
            delete_survey.delay(survey_id=survey_id)

            for task in tasks:
                task.status = 'Deleting'
            survey.status = 'Deleting'
            db.session.commit()
    else:
        status = 'error'
        message = 'Could not find survey.'

    return json.dumps({'status': status, 'message': message})

@app.route('/deleteImages/<surveyName>')
@login_required
def deleteImages(surveyName):
    '''Deletes all images associated with a survey belonging to the user with the specified name.'''

    survey = db.session.query(Survey).filter(Survey.user_id==current_user.id).filter(Survey.name==surveyName).first()
    if survey:
        survey.status = 'Cancelled'
        db.session.commit()
        delete_images(surveyName,survey.user.folder)
    return json.dumps('')

@app.route('/updateSurveyStatus/<surveyName>/<status>')
@login_required
def updateSurveyStatus(surveyName, status):
    '''Updates the status of the survey belonging to the requester with the specified name with the specified status.'''

    survey = db.session.query(Survey).filter(Survey.user_id==current_user.id).filter(Survey.name==surveyName).first()
    if survey and (survey.user==current_user):
        survey.status = status
        db.session.commit()
        if status == 'Complete':
            import_survey.delay(s3Folder=surveyName,surveyName=survey.name,tag=survey.trapgroup_code,user_id=current_user.id,correctTimestamps=survey.correct_timestamps,classifier=survey.classifier.name)
    return json.dumps('')

@app.route('/checkSightingEditStatus/<task_id>/<species>')
@login_required
def checkSightingEditStatus(task_id, species):
    '''Checks if a species has had its bounding boxes checked/edited for the specified task. Returns a warning status and associated message if it hasn't.'''

    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)
    status = 'success'
    message = ''

    if task and task.survey.user==current_user:
        subq = db.session.query(labelstable.c.cluster_id.label('clusterID'), func.count(distinct(labelstable.c.label_id)).label('labelCount')) \
                        .join(Cluster,Cluster.id==labelstable.c.cluster_id) \
                        .filter(Cluster.task_id==task_id) \
                        .group_by(labelstable.c.cluster_id) \
                        .subquery()

        test1 = db.session.query(Labelgroup) \
                        .join(Detection) \
                        .join(Image) \
                        .join(Cluster, Image.clusters) \
                        .join(subq, subq.c.clusterID==Cluster.id) \
                        .filter(Labelgroup.task_id==task_id) \
                        .filter(Cluster.task_id==task_id) \
                        .filter(Labelgroup.checked==False) \
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static==False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .filter(subq.c.labelCount>1).first()

        if test1:
            status = 'warning'
            message = 'WARNING: You have selected a detection-based count, but you have yet to correct the sightings for the mutiple-label clusters in this task. As such, the count presented will be of reduced accuracy.'
        else:
            test2 = db.session.query(Labelgroup) \
                            .join(Detection) \
                            .filter(Labelgroup.task_id==task_id) \
                            .filter(Labelgroup.checked==False) \
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .filter(Detection.static==False)

            if species not in ['All','None','']:
                label = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.description==species).first()
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

        reqImages = []
        if view_type=='image':
            image = db.session.query(Image).get(int(id_no))
            if image and ((image.camera.trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = [image]

        elif view_type=='capture':
            image = db.session.query(Image).get(int(id_no))
            if image and ((image.camera.trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = db.session.query(Image)\
                                .filter(Image.camera_id==image.camera_id)\
                                .filter(Image.corrected_timestamp==image.corrected_timestamp)\
                                .distinct().all()

        elif view_type=='cluster':
            cluster = db.session.query(Cluster).get(int(id_no))
            if cluster and ((cluster.task.survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).distinct().all()

        elif view_type=='camera':
            camera = db.session.query(Camera).get(int(id_no))
            if camera and ((camera.trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = db.session.query(Image)\
                                .filter(Image.camera==camera)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        elif view_type=='trapgroup':
            trapgroup = db.session.query(Trapgroup).get(int(id_no))
            if trapgroup and ((trapgroup.survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = db.session.query(Image)\
                                .join(Camera)\
                                .filter(Camera.trapgroup==trapgroup)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        elif view_type=='survey':
            survey = db.session.query(Survey).get(int(id_no))
            if survey and ((survey.user==current_user) or (current_user.id==admin.id)):
                reqImages = db.session.query(Image)\
                                .join(Camera)\
                                .join(Trapgroup)\
                                .filter(Trapgroup.survey==survey)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()

        if comparisonsurvey:
            check = db.session.query(Survey).get(comparisonsurvey)

        if (len(reqImages) == 0) or (comparisonsurvey and ((check.user!=current_user) and (current_user.id!=admin.id))):
            return render_template("html/block.html",text="You do not have permission to view this item.", helpFile='block', version=Config.VERSION)

        images = [{'id': image.id,
                'url': image.camera.path + '/' + image.filename,
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
                                        (detection.status not in ['deleted','hidden']) and 
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
                                        (detection.status not in ['deleted','hidden']) and 
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

    if current_user.admin:
        surveyName = request.form['surveyName']
        newSurveyDescription = request.form['newSurveyDescription']
        newSurveyTGCode = request.form['newSurveyTGCode']
        newSurveyS3Folder = request.form['newSurveyS3Folder']
        checkbox = request.form['checkbox']
        correctTimestamps = request.form['correctTimestamps']
        classifier = request.form['classifier']

        if 'kml' in request.files:
            uploaded_file = request.files['kml']
            fileAttached = True
        else:
            fileAttached = False

        if checkbox=='false':
            newSurveyTGCode = newSurveyTGCode+'[0-9]+'

        if correctTimestamps=='true':
            correctTimestamps=True
        else:
            correctTimestamps=False

        if newSurveyDescription == 'None':
            newSurveyDescription = ''

        for item in notAllowed:
            if item in surveyName:
                status = 'error'
                message = 'Survey name cannot contain slashes or special characters.'

        test = db.session.query(Survey).filter(Survey.user_id==current_user.id).filter(Survey.name==surveyName).first()
        if test != None:
            status = 'error'
            message = 'Survey name already in use.' 

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

        if status == 'success':

            if fileAttached:
                key = current_user.folder + '-comp/kmlFiles/' + surveyName + '.kml'
                with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
                    uploaded_file.save(temp_file.name)
                    GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)

            if newSurveyS3Folder=='none':
                classifier = db.session.query(Classifier).filter(Classifier.name==classifier).first()
                newSurvey = Survey(name=surveyName, description=newSurveyDescription, trapgroup_code=newSurveyTGCode, user_id=current_user.id, status='uploading', correct_timestamps=correctTimestamps, classifier_id=classifier.id)
                db.session.add(newSurvey)
                db.session.commit()
            else:
                import_survey.delay(s3Folder=newSurveyS3Folder,surveyName=surveyName,tag=newSurveyTGCode,user_id=current_user.id,correctTimestamps=correctTimestamps,classifier=classifier)

        return json.dumps({'status': status, 'message': message})

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

        if surveyName and bucketName and dataSource and trapgroupCode and min_area:
            if 'csv' in request.files:
                uploaded_file = request.files['csv']
                fileAttached = True
            else:
                fileAttached = False

            test = db.session.query(Survey).filter(Survey.user_id==current_user.id).filter(Survey.name==surveyName).first()
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

                pipeline_survey.delay(surveyName=surveyName,bucketName=bucketName,dataSource=dataSource,fileAttached=fileAttached,
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

    if 'task_id' in request.form:
        task_id = request.form['task_id']
    else:
        task_id = None

    if current_user.is_authenticated and current_user.admin:
        if 'revoke_id' in request.form:
            try:
                celery.control.revoke(request.form['revoke_id'], terminate=True)
            except:
                pass

        if task_id:
            if task_id == 'none':
                tgCode = request.form['tgCode']
                folder = request.form['folder']
                task = findTrapgroupTags.apply_async(kwargs={'tgCode':tgCode,'folder':folder,'user_id':current_user.id})
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
    
    folders = []
    if current_user.is_authenticated and current_user.admin:
        folders = list_all(Config.BUCKET,current_user.folder+'/')[0]
        if 'Downloads' in folders: folders.remove('Downloads')

    return json.dumps(folders)

@app.route('/getSurveysAndTasksByUser/<user_id>')
@login_required
def getSurveysAndTasksByUser(user_id):
    '''Allows the admin to get a list of all surveys and associated tasks for a specified user.'''

    reply=[]
    admin = db.session.query(User).filter(User.username=='Admin').first()
    if current_user==admin:
        surveys = db.session.query(Survey).filter(Survey.user_id==int(user_id)).distinct().all()
        
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
    if survey and survey.user==current_user:
        reply = {'smallDetections': str(survey.ignore_small_detections),'skyMask': str(survey.sky_masked)}
    return json.dumps(reply)

@app.route('/getSurveyTGcode/<surveyName>')
@login_required
def getSurveyTGcode(surveyName):
    '''Returns the trapgroup code for the survey belonging to the current user with the specified name.'''

    survey = db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.user_id==current_user.id).first()
    if survey and (survey.user==current_user):
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
    surveyName = request.form['surveyName']
    ignore_small_detections = request.form['ignore_small_detections']
    sky_masked = request.form['sky_masked']

    survey = db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.user_id==current_user.id).first()

    if survey and (survey.user==current_user):
        if 'classifier' in request.form:
            classifier = request.form['classifier']
            if survey.classifier.name != classifier:
                re_classify_survey.delay(survey_id=survey.id,classifier=classifier)

        elif ignore_small_detections!='none':
            # Checks for the case that you switch both off
            edge='false'
            if (ignore_small_detections=='false') and (sky_masked=='false'):
                if (survey.ignore_small_detections==True) and (survey.sky_masked==True):
                    edge = True

            if str(survey.ignore_small_detections).lower() != ignore_small_detections:
                hideSmallDetections.delay(survey_id=survey.id,ignore_small_detections=ignore_small_detections,edge=edge)

            if str(survey.sky_masked).lower() != sky_masked:
                maskSky.delay(survey_id=survey.id,sky_masked=sky_masked,edge=edge)

        elif 'timestamps' in request.form:
            survey.status = 'Processing'
            db.session.commit()
            timestamps = ast.literal_eval(request.form['timestamps'])
            changeTimestamps.delay(survey_id=survey.id,timestamps=timestamps)
        
        elif 'coordData' in request.form:
            coordData = ast.literal_eval(request.form['coordData'])
            updateCoords.delay(survey_id=survey.id,coordData=coordData)
        
        else:
            if 'kml' in request.files:
                uploaded_file = request.files['kml']
                fileAttached = True
            else:
                fileAttached = False

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

            if status == 'success':
                newSurveyTGCode = request.form['newSurveyTGCode']
                newSurveyS3Folder = request.form['newSurveyS3Folder']
                checkbox = request.form['checkbox']

                if fileAttached:
                    key = current_user.folder + '-comp/kmlFiles/' + surveyName + '.kml'
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
                        uploaded_file.save(temp_file.name)
                        GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)

                if newSurveyTGCode!=' ':
                    if checkbox=='false':
                        newSurveyTGCode = newSurveyTGCode+'[0-9]+'

                    survey.trapgroup_code=newSurveyTGCode
                    db.session.commit()
                    
                    if newSurveyS3Folder!='none':
                        import_survey.delay(s3Folder=newSurveyS3Folder,surveyName=surveyName,tag=newSurveyTGCode,user_id=current_user.id,correctTimestamps=survey.correct_timestamps,classifier=None)
                else:
                    if fileAttached:
                        importKML(survey.id)

    return json.dumps({'status': status, 'message': message})

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    '''Returns the form for worker signup, and handles its submission.'''

    if current_user.is_authenticated:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        elif current_user.admin:
            return redirect(url_for('surveys'))
        elif current_user.parent_id == None:
            return redirect(url_for('jobs'))
        elif db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
                    sender=app.config['ADMINS'][0],
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
        username = info['username']
        email = info['email']

        if username.lower() not in Config.DISALLOWED_USERNAMES:
            check = db.session.query(User).filter(or_(User.username==username,User.email==email)).first()

            if check==None:
                password = info['password']
                user = User(username=username, email=email, admin=False)
                user.set_password(password)
                db.session.add(user)
                turkcode = Turkcode(user_id=username, active=False, tagging_time=0)
                db.session.add(turkcode)
                db.session.commit()
                login_user(user, remember=False)
                return redirect(url_for('jobs', _external=True))
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

@app.route('/getPolarData/<task_id>/<trapgroup_id>/<species_id>/<baseUnit>/<reqID>')
@login_required
def getPolarData(task_id, trapgroup_id, species_id, baseUnit, reqID):
    '''
    Returns the time-of-day activity data for the requested species and task.
    
        Parameters:
            task_id (int): The task for which the data is required
            trapgroup_id (int): The trapgroup for which data is required
            species_id (int): The species fow which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            reqID (int): The request identifier
    '''

    reply = []
    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user==current_user):
        if baseUnit == '1':
            baseQuery = db.session.query(Image).join(Detection).join(Labelgroup)
        elif baseUnit == '2':
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).join(Labelgroup)
        elif baseUnit == '3':
            baseQuery = db.session.query(Labelgroup).join(Detection).join(Image)
        baseQuery = baseQuery.join(Camera).join(Trapgroup).filter(Labelgroup.task_id==task_id).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(Detection.static==False).filter(~Detection.status.in_(['deleted','hidden']))

        if trapgroup_id == '0':
            baseQuery = baseQuery.filter(Trapgroup.survey_id==task.survey_id)
        else:
            baseQuery = baseQuery.filter(Trapgroup.id==int(trapgroup_id))

        if species_id != '0':
            label = db.session.query(Label).get(int(species_id))
            label_list = [label.id]
            label_list.extend(getChildList(label,int(task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            vhl = db.session.query(Label).get(GLOBALS.vhl_id)
            label_list = [GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.knocked_id]
            label_list.extend(getChildList(vhl,int(task_id)))
            baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        for n in range(24):
            count = baseQuery.filter(extract('hour',Image.corrected_timestamp)==n).distinct().count()
            reply.append(count)

    return json.dumps({'reqID':reqID, 'data':reply})

@app.route('/getBarData/<task_id>/<species_id>/<baseUnit>/<axis>')
@login_required
def getBarData(task_id, species_id, baseUnit, axis):
    '''
    Returns the bar graph data for the requested species and task.

        Parameters:
            task_id (int): The task for which the data is required
            species_id (int): The species fow which data is required
            baseUnit (str): The desired base unit (image, cluster, or labelgroup)
            axis (str): The type of count - either a survey or trapgroup count
    '''

    reply = []
    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user==current_user):
        if baseUnit == '1':
            baseQuery = db.session.query(Image).join(Detection).join(Labelgroup)
        elif baseUnit == '2':
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).join(Labelgroup).filter(Cluster.task_id==int(task_id))
        elif baseUnit == '3':
            baseQuery = db.session.query(Labelgroup).join(Detection).join(Image)
        baseQuery = baseQuery.join(Camera).join(Trapgroup).filter(Labelgroup.task_id==task_id).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(Detection.static==False).filter(~Detection.status.in_(['deleted','hidden']))

        if species_id != '0':
            label = db.session.query(Label).get(int(species_id))
            label_list = [label.id]
            label_list.extend(getChildList(label,int(task_id)))
            baseQuery = baseQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
        else:
            vhl = db.session.query(Label).get(GLOBALS.vhl_id)
            label_list = [GLOBALS.vhl_id,GLOBALS.nothing_id,GLOBALS.knocked_id]
            label_list.extend(getChildList(vhl,int(task_id)))
            baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        if axis == '1': #survey count
            count = baseQuery.distinct().count()
            reply = [count]

        elif axis == '2': #Trapgroup count
            for trapgroup in db.session.query(Task).get(int(task_id)).survey.trapgroups[:]:
                count = baseQuery.filter(Trapgroup.id==trapgroup.id).distinct().count()
                reply.append(count)

    return json.dumps(reply)

@app.route('/setAdminTask/<task>')
@login_required
def setAdminTask(task):
    '''Sets the current user's active task to the specified one.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    if current_user.admin == True:
        turkcode = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first()
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
    
    reply = {}
    if (task!=None) and (task.survey.user_id==current_user.id) and (task.survey.image_count<=25000):

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
                'Status',
                'Potential Clusters'
            ],
            'Informational Tagging': [
                'Tagged'
            ],
            'Sighting Correction': [
                'Checked Sightings'
            ],
            'Individual ID': [
                'Cluster-Level',
                'Inter-Cluster'
            ]
        }

        if init:
            labels = {}
            parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).order_by(Label.description).all()
            parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
            parentLabels.append(db.session.query(Label).get(GLOBALS.knocked_id))
            parentLabels.append(db.session.query(Label).get(GLOBALS.nothing_id))
            parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
            for label in parentLabels:
                childLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).all()
                labels[label.id] = addChildToDict(childLabels,{},task_id,True,False)

            reply = {'status':'success','labels':labels,'headings':headings}

        if label_id:
            admin=db.session.query(User).filter(User.username=='Admin').first()
            label = db.session.query(Label).get(int(label_id))
            reply['status'] = 'success'
            reply['label'] = label.description
            reply['Summary'] = {}
            reply['Species Annotation'] = {}
            reply['AI Check'] = {}
            reply['Informational Tagging'] = {}
            reply['Sighting Correction'] = {}
            reply['Individual ID'] = {}
            
            cluster_count = db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(label)).count()
            
            #check if one of its child labels in the survey
            names = []
            ids = []
            if len(label.children[:])>0:
                names, ids = addChildLabels(names,ids,label,task_id)
            test2 = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.any(Label.id.in_(ids))).first()

            if test2 or (cluster_count != 0):
                reply['Summary']['Clusters'] = cluster_count
                reply['Summary']['Images'] = db.session.query(Image).join(Cluster, Image.clusters).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(label)).distinct().count()
                reply['Summary']['Sightings'] = db.session.query(Labelgroup).join(Detection).filter(Labelgroup.task_id==task_id).filter(Labelgroup.labels.contains(label)).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(Detection.static==False).filter(~Detection.status.in_(['deleted','hidden'])).distinct().count()
                reply['Summary']['Individuals'] = db.session.query(Individual).filter(Individual.task==task).filter(Individual.label==label).distinct().count()

                # Checked Sightings
                if reply['Summary']['Sightings'] != 0:
                    checked_detections = db.session.query(Labelgroup).join(Detection).filter(Labelgroup.task_id==task_id).filter(Labelgroup.labels.contains(label)).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(Detection.static==False).filter(~Detection.status.in_(['deleted','hidden'])).filter(Labelgroup.checked==True).distinct().count()
                    checked_perc = round((checked_detections/reply['Summary']['Sightings'])*100,2)
                    reply['Sighting Correction']['Checked Sightings'] = str(checked_detections) + '/' + str(reply['Summary']['Sightings']) + ' (' + str(checked_perc) + '%)'
                else:
                    reply['Sighting Correction']['Checked Sightings'] = '-'

                # Species Annotation Status
                childCount = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==label.id).distinct().count()
                if childCount==0:
                    initial_not_complete = db.session.query(Cluster)\
                                                .join(Image,Cluster.images)\
                                                .join(Detection)\
                                                .filter(Cluster.task_id==int(task_id))\
                                                .filter(~Cluster.labels.any())\
                                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                                .filter(Detection.static==False)\
                                                .filter(~Detection.status.in_(['deleted','hidden']))\
                                                .first()

                    initial_tagged = db.session.query(Cluster)\
                                                .join(Image,Cluster.images)\
                                                .join(Detection)\
                                                .filter(Cluster.task_id==int(task_id))\
                                                .filter(Cluster.labels.any())\
                                                .filter(Cluster.user_id!=admin.id)\
                                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                                .filter(Detection.static==False)\
                                                .filter(~Detection.status.in_(['deleted','hidden']))\
                                                .first()

                    if initial_not_complete:
                        reply['Species Annotation']['Complete'] = 'No'
                    else:
                        reply['Species Annotation']['Complete'] = 'Yes'
                    if initial_tagged:
                        reply['Species Annotation']['Tagged'] = 'Yes'
                    else:
                        reply['Species Annotation']['Tagged'] = 'No'

                else:
                    test1 = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.labels.contains(label)).first()
                    test3 = db.session.query(Cluster).filter(Cluster.task_id==task.id).filter(Cluster.user_id!=admin.id).filter(Cluster.labels.any(Label.id.in_(ids))).first()

                    if test1:
                        reply['Species Annotation']['Complete'] = 'No'
                    else:
                        reply['Species Annotation']['Complete'] = 'Yes'

                    if test3:
                        reply['Species Annotation']['Tagged'] = 'Yes'
                    else:
                        reply['Species Annotation']['Tagged'] = 'No'

                # Informational Tagging
                if db.session.query(Cluster).filter(Cluster.task==task).filter(Cluster.labels.contains(label)).filter(Cluster.tags.any()).first():
                    reply['Informational Tagging']['Tagged'] = 'Yes'
                else:
                    reply['Informational Tagging']['Tagged'] = 'No'

                # AI Check
                # correct_clusters = db.session.query(Cluster)\
                #                             .join(Label, Cluster.labels)\
                #                             .join(Translation)\
                #                             .filter(Cluster.task_id==task_id)\
                #                             .filter(Translation.task_id==task_id)\
                #                             .filter(Cluster.classification==Translation.classification)\
                #                             .distinct().all()

                # correct_clusters.extend(
                #     db.session.query(Cluster)\
                #                 .join(Translation,Translation.classification==Cluster.classification)\
                #                 .filter(Cluster.task_id==task_id)\
                #                 .filter(Translation.task_id==task_id)\
                #                 .filter(Translation.label_id==GLOBALS.nothing_id)\
                #                 .distinct().all()
                # )

                # correct_clusters.extend(db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(func.lower(Cluster.classification)=='nothing').all())
                # correct_clusters.extend(db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(Cluster.labels.contains(db.session.query(Label).get(GLOBALS.knocked_id))).all())
                # correct_clusters = [r.id for r in correct_clusters]
                ids.append(label.id)

                if task.ai_check_complete:
                    reply['AI Check']['Status'] = 'Checked'
                else:
                    reply['AI Check']['Status'] = 'Not Checked'

                sq = db.session.query(Cluster)\
                                .join(Translation,Cluster.classification==Translation.classification)\
                                .filter(Translation.label_id==label_id)\
                                .filter(Cluster.task==task)

                sq = taggingLevelSQ(sq,'-3',False,task_id)

                reply['AI Check']['Potential Clusters'] = sq.distinct().count() 

                # Individual ID
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
                                    .first()

                count = checkForIdWork(task_id,label,0)

                if len(identified) == 0:
                    reply['Individual ID']['Cluster-Level'] = '-'
                    reply['Individual ID']['Inter-Cluster'] = '-'
                elif unidentified:
                    reply['Individual ID']['Cluster-Level'] = 'Incomplete'
                    reply['Individual ID']['Inter-Cluster'] = 'Incomplete'
                else:
                    reply['Individual ID']['Cluster-Level'] = 'Complete'
                    if count == 0:
                        reply['Individual ID']['Inter-Cluster'] = 'Complete'
                    else:
                        reply['Individual ID']['Inter-Cluster'] = 'Incomplete'

            else:
                # No clusters of this species - just return canned reply for speed
                reply['Summary']['Clusters'] = '-'
                reply['Summary']['Images'] = '-'
                reply['Summary']['Sightings'] = '-'
                reply['Summary']['Individuals'] = '-'
                reply['Species Annotation']['Complete'] = '-'
                reply['Species Annotation']['Tagged'] = '-'
                reply['AI Check']['Status'] = '-'
                reply['AI Check']['Potential Clusters'] = '-'
                reply['Informational Tagging']['Tagged'] = '-'
                reply['Sighting Correction']['Checked Sightings'] = '-'
                reply['Individual ID']['Cluster-Level'] = '-'
                reply['Individual ID']['Inter-Cluster'] = '-'
    else:
        reply = {'status':'error','message':'Your survey is too large for this functionality. Please try again after the next update'}

    return json.dumps(reply)

@app.route('/dotask/<username>')
@login_required
def dotask(username):
    '''Allocates the specified job to the current user, logging them into a tmp user profile to perform the work.'''

    turkcode = db.session.query(Turkcode).filter(Turkcode.user_id==username).first()
    if turkcode and (username.lower() not in Config.DISALLOWED_USERNAMES) and ((current_user in turkcode.task.survey.user.workers) or (current_user == turkcode.task.survey.user)):
        user = db.session.query(User).filter(User.username==username).first()
        
        if user is None:
            user=User(username=username, passed='pending', admin=False, parent_id=current_user.id, last_ping=datetime.utcnow())
            db.session.add(user)
            db.session.commit()
        else:
            if current_user != user:
                return redirect(url_for('jobs'))
                    
        logout_user()
        login_user(user)

        if not populateMutex(turkcode.task_id,user.id): return redirect(url_for('jobs'))

        if '-4' in turkcode.task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in turkcode.task.tagging_level:
            return redirect(url_for('individualID'))
        elif turkcode.task.is_bounding:
            return redirect(url_for('sightings'))
        else:
            return redirect(url_for('index'))
    else:
        return render_template("html/block.html",text="Invalid URL.", helpFile='block', version=Config.VERSION)

@app.route('/createAccount/<token>')
def createAccount(token):
    '''Creates a new account based on the recieved token.'''
    
    try:
        info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

    if ('organisation' in info.keys()) and (info['organisation'].lower() not in Config.DISALLOWED_USERNAMES):
        folder = info['organisation'].lower().replace(' ','-').replace('_','-')
        check = db.session.query(User).filter(or_(
            func.lower(User.username)==info['organisation'].lower(),
            User.folder==folder,
            User.email==info['email']
        )).first()
        
        if (check == None) and (len(folder) <= 64):
            newUser = User(username=info['organisation'], email=info['email'], admin=True, passed='pending', folder=folder)
            newTurkcode = Turkcode(user_id=info['organisation'], active=False, tagging_time=0)
            newPassword = randomString()
            newUser.set_password(newPassword)
            notifications = db.session.query(Notification)\
                                    .filter(or_(Notification.expires==None,Notification.expires<datetime.utcnow()))\
                                    .distinct().all()
            db.session.add(newUser)
            db.session.add(newTurkcode)
            newUser.notifications = notifications
            db.session.commit()

            #Create all the necessary AWS stuff
            s3UserName, s3Password = create_new_aws_user(folder)

            url1 = 'https://'+Config.DNS+'/login'
            url2 = 'https://'+Config.DNS+'/requestPasswordChange'

            send_email('[TrapTagger] Account Information',
                sender=app.config['ADMINS'][0],
                recipients=[info['email']],
                text_body=render_template('email/enquirySuccess.txt',
                    organisation=info['organisation'], password=newPassword, s3UserName=s3UserName, bucket_name=folder, s3Password=s3Password, url1=url1, url2=url2, email_address=Config.MONITORED_EMAIL_ADDRESS),
                html_body=render_template('email/enquirySuccess.html',
                    organisation=info['organisation'], password=newPassword, s3UserName=s3UserName, bucket_name=folder, s3Password=s3Password, url1=url1, url2=url2, email_address=Config.MONITORED_EMAIL_ADDRESS))

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
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
                    sender=app.config['ADMINS'][0],
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
        if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    elif current_user.admin and (current_user.username=='Dashboard'):
        return redirect(url_for('dashboard'))
    else:
        return render_template('html/tutorial.html', helpFile='tutorial', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/index')
def index():
    '''Renders the annotation/tagging template.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.admin:
        if current_user.username=='Dashboard':
            return redirect(url_for('dashboard'))
        else:
            return redirect(url_for('surveys'))
    elif current_user.parent_id == None:
        return redirect(url_for('jobs'))
    elif db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
        return redirect(url_for('clusterID'))
    elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
        return redirect(url_for('individualID'))
    else:
        if current_user.passed in ['cTrue', 'cFalse', 'true', 'false']:
                return redirect(url_for('done'))
        return render_template('html/index.html', title='TrapTagger', helpFile='annotation', bucket=Config.BUCKET, version=Config.VERSION)

@app.route('/jobs')
def jobs():
    '''Renders the jobs page.'''

    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    elif current_user.parent_id != None:
        if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
            return redirect(url_for('sightings'))
        elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
            return redirect(url_for('clusterID'))
        elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
            return redirect(url_for('individualID'))
        else:
            return redirect(url_for('index'))
    else:
        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))
        return render_template('html/jobs.html', title='Jobs', helpFile='jobs_page', version=Config.VERSION)

@app.route('/register', methods=['GET', 'POST'])
def register():
    '''Renders the admin account registration page.'''
    
    if current_user.is_authenticated:
        if current_user.admin:
            if current_user.username=='Dashboard':
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
    else:
        enquiryForm = EnquiryForm()
        if enquiryForm.validate_on_submit():
            if enquiryForm.info.data == '':
                folder = enquiryForm.organisation.data.lower().replace(' ','-').replace('_','-')

                check = db.session.query(User).filter(or_(
                    func.lower(User.username)==enquiryForm.organisation.data.lower(),
                    User.folder==folder
                )).first()

                disallowed_chars = '"[@!#$%^&*()<>?/\|}{~:]' + "'"
                disallowed = any(r in disallowed_chars for r in enquiryForm.organisation.data)

                if (check == None) and (len(folder) <= 64) and not disallowed:
                    send_enquiry_email(enquiryForm.organisation.data,enquiryForm.email.data,enquiryForm.description.data)
                    flash('Enquiry submitted.')
                    return redirect(url_for('register'))
                elif disallowed:
                    flash('Your organisation name cannot contain special characters.')
                elif len(folder) <= 64:
                    flash('Your organisation name is too long.')
                else:
                    flash('Invalid organsiation name. Please try again.')
            else:
                flash('Enquiry (not) submitted.')
                return redirect(url_for('register'))
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
            user_data = []
            users = db.session.query(User).filter(User.admin==True).order_by(User.username).distinct().all()
            for user in users:
                user_data.append({'id': str(user.id), 'username': user.username})
            return render_template('html/trainingCSV.html', title='Training CSV', user_data=user_data, helpFile='training_csv', version=Config.VERSION)
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
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))

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
    elif not db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
        return redirect(url_for('index'))
    elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
        return redirect(url_for('clusterID'))
    elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
    elif db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
    elif db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
        return redirect(url_for('sightings'))
    elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
#                 if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
#                     return redirect(url_for('sightings'))
#                 elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
#                     return redirect(url_for('clusterID'))
#                 elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
        if not current_user.admin:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))

        if current_user.username=='Dashboard': return redirect(url_for('dashboard'))

        return render_template('html/workers.html', title='Workers', helpFile='workers', version=Config.VERSION)

@app.route('/getTaskCompletionStatus/<task_id>')
@login_required
def getTaskCompletionStatus(task_id):
    '''Returns whether the specified task has had all initial-level clusters tagged.'''

    task = db.session.query(Task).get(task_id)
    if task and (task.survey.user==current_user):

        check = db.session.query(Cluster)\
                        .join(Image,Cluster.images)\
                        .join(Detection)\
                        .filter(Cluster.task_id==int(task_id))\
                        .filter(~Cluster.labels.any())\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .first()

        if check:
            return json.dumps(str(False))
        else:
            return json.dumps(str(True))
    
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
    
    if survey.user == current_user:

        for task in tasks:
            if worker_id:
                workers = [db.session.query(User).get(worker_id)]
            else:
                childWorker = alias(User)
                workers = db.session.query(User)\
                                    .join(childWorker, childWorker.c.parent_id==User.id)\
                                    .join(Turkcode, childWorker.c.username==Turkcode.user_id)\
                                    .filter(Turkcode.task_id==task.id)\
                                    .distinct().all()

            reply = []
            for worker in workers:
                info = {}
                info['batchCount'] = db.session.query(User)\
                                            .join(Turkcode, Turkcode.user_id==User.username)\
                                            .filter(User.parent_id==worker.id)\
                                            .filter(or_(User.passed=='cTrue',User.passed=='cFalse'))\
                                            .filter(Turkcode.task_id==task.id)\
                                            .distinct().count()

                turkcodes = db.session.query(Turkcode)\
                                    .join(User, User.username==Turkcode.user_id)\
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
            headings = {'batchCount': 'Batches Campleted', 'taggingTime': 'Tagging Time (h)'}
        else:
            headings = {'username': 'User', 'batchCount': 'Batches Campleted', 'taggingTime': 'Tagging Time (h)'}

        return json.dumps({'headings': headings, 'data': reply})

    return json.dumps("error")

@app.route('/getHomeSurveys')
@login_required
def getHomeSurveys():
    '''Returns a paginated list of all surveys and their associated tasks for the current user.'''
    
    if current_user.admin:
        page = request.args.get('page', 1, type=int)
        order = request.args.get('order', 5, type=int)
        search = request.args.get('search', '', type=str)

        surveys = db.session.query(Survey).outerjoin(Task).filter(Survey.user_id==current_user.id)

        searches = re.split('[ ,]',search)
        for search in searches:
            surveys = surveys.filter(or_(Survey.name.contains(search),Task.name.contains(search)))

        if order == 1:
            #Survey date
            surveys = surveys.join(Trapgroup).join(Camera).join(Image).order_by(Image.corrected_timestamp)
        elif order == 2:
            #Survey add date
            surveys = surveys.order_by(Survey.id)
        elif order == 3:
            #Alphabetical
            surveys = surveys.order_by(Survey.name)
        elif order == 4:
            #Survey date descending
            surveys = surveys.join(Trapgroup).join(Camera).join(Image).order_by(desc(Image.corrected_timestamp))
        elif order == 5:
            #Add date descending
            surveys = surveys.order_by(desc(Survey.id))

        surveys = surveys.distinct().paginate(page, 5, False)

        survey_list = []
        for survey in surveys.items:
            survey_dict = {}
            survey_dict['id'] = survey.id
            survey_dict['name'] = survey.name
            survey_dict['description'] = survey.description
            survey_dict['numTrapgroups'] = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey.id).count()
            if survey.image_count == None:
                survey.image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey.id).distinct().count()
            survey_dict['numImages'] = survey.image_count

            
            if survey.status in ['indprocessing']:
                survey_dict['status'] = 'processing'
            else:
                survey_dict['status'] = survey.status

            disabledLaunch='false'
            for task in survey.tasks:
                if task.status.lower() not in Config.TASK_READY_STATUSES:
                    disabledLaunch='true'
                    break

            task_info = []
            for task in survey.tasks:
                if (task.name != 'default') and ('_o_l_d_' not in task.name) and ('_copying' not in task.name):
                    task_dict = {}
                    task_dict['id'] = task.id
                    task_dict['name'] = task.name
                    task_dict['status'] = task.status
                    task_dict['disabledLaunch'] = disabledLaunch
                    task_dict['complete'] = task.complete

                    task_info.append(task_dict)
            survey_dict['tasks'] = task_info

            survey_list.append(survey_dict)

        next_url = url_for('getHomeSurveys', page=surveys.next_num, order=order) if surveys.has_next else None
        prev_url = url_for('getHomeSurveys', page=surveys.prev_num, order=order) if surveys.has_prev else None

        current_user.last_ping = datetime.utcnow()
        db.session.commit()

        return json.dumps({'surveys': survey_list, 'next_url':next_url, 'prev_url':prev_url})
    
    else:
        return redirect(url_for('jobs'))

@app.route('/getJobs')
@login_required
def getJobs():
    '''Returns a paginated list of available jobs available to the current user.'''
    
    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 5, type=int)
    search = request.args.get('search', '', type=str)

    quals = [r.id for r in current_user.qualifications]
    if current_user.admin:
        quals.append(current_user.id)

    tasks = db.session.query(Task).join(Survey).filter(Survey.user_id.in_(quals)).filter(Task.status=='PROGRESS')

    searches = re.split('[ ,]',search)
    for search in searches:
        tasks = tasks.filter(or_(Survey.name.contains(search),Task.name.contains(search)))

    if order == 1:
        #Survey date
        # tasks = tasks.join(Trapgroup).join(Camera).join(Image).order_by(Image.corrected_timestamp)
        tasks = tasks.join(Cluster).join(Image,Cluster.images).order_by(Image.corrected_timestamp)
    elif order == 2:
        #Survey add date
        tasks = tasks.order_by(Survey.id)
    elif order == 3:
        #Alphabetical
        tasks = tasks.order_by(Survey.name)
    elif order == 4:
        #Survey date descending
        # tasks = tasks.join(Trapgroup).join(Camera).join(Image).order_by(desc(Image.corrected_timestamp))
        tasks = tasks.join(Cluster).join(Image,Cluster.images).order_by(desc(Image.corrected_timestamp))
    elif order == 5:
        #Add date descending
        tasks = tasks.order_by(desc(Survey.id))

    tasks = tasks.paginate(page, 5, False)

    task_list = []
    for task in tasks.items:
        task_dict = {}
        task_dict['id'] = task.id
        task_dict['name'] = task.survey.name
        task_list.append(task_dict)

    next_url = url_for('getJobs', page=tasks.next_num, order=order) if tasks.has_next else None
    prev_url = url_for('getJobs', page=tasks.prev_num, order=order) if tasks.has_prev else None

    current_user.last_ping = datetime.utcnow()
    db.session.commit()

    return json.dumps({'jobs': task_list, 'next_url':next_url, 'prev_url':prev_url})

@app.route('/getWorkers')
@login_required
def getWorkers():
    '''Returns a paginated list of workers for the current user.'''
    
    page = request.args.get('page', 1, type=int)
    order = request.args.get('order', 1, type=int)
    search = request.args.get('search', '', type=str)

    worker_ids = [r.id for r in current_user.workers]
    worker_ids.append(current_user.id)
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

    workers = workers.paginate(page, 5, False)

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
                                                .join(User,User.username==Turkcode.user_id)\
                                                .filter(User.parent_id==worker.id)\
                                                .distinct().count()
        
        if worker.id==current_user.id:
            worker_dict['isOwner'] = 'true'
        else:
            worker_dict['isOwner'] = 'false'

        turkcodes = db.session.query(Turkcode)\
                            .join(User, User.username==Turkcode.user_id)\
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
    message = 'Could not find worker with that email address. Please check the address, or ask them to sign up for a worker account.'

    try:
        inviteEmail = request.form['inviteEmail']
        if inviteEmail and current_user.admin:
            worker = db.session.query(User).filter(User.email==inviteEmail).first()
            if worker:
                if worker in current_user.workers:
                    message = 'That worker already works for you.'
                else:
                    token = jwt.encode(
                            {'user_id': current_user.id, 'worker_id': worker.id},
                            app.config['SECRET_KEY'], algorithm='HS256')

                    url = 'https://'+Config.DNS+'/acceptInvitation/'+token

                    send_email('[TrapTagger] Invitation',
                            sender=app.config['ADMINS'][0],
                            recipients=[worker.email],
                            text_body=render_template('email/workerInvitation.txt',workername=worker.username, username=current_user.username, url=url),
                            html_body=render_template('email/workerInvitation.html',workername=worker.username, username=current_user.username, url=url))
                    
                    status = 'Success'
                    message = 'Invitation sent.'
    except:
        pass

    return json.dumps({'status': status, 'message':message})

@app.route('/acceptInvitation/<token>')
@login_required
def acceptInvitation(token):
    '''Accepts a worker's invitation to annotate for a user based on the supplied token.'''

    try:
        info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = info['user_id']
        worker_id = info['worker_id']

        user = db.session.query(User).get(user_id)
        worker = db.session.query(User).get(worker_id)

        user.workers.append(worker)
        db.session.commit()

    except:
        return render_template("html/block.html",text="Error.", helpFile='block', version=Config.VERSION)

    return render_template("html/block.html",text="Invitation accepted.", helpFile='block', version=Config.VERSION)

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

@app.route('/RequestExif', methods=['POST'])
@login_required
def RequestExif():
    '''
    Initiates the generation of an exif dataset for download. Returns a success/error status.
    
        Parameters:
            task_id (int): The task for which exif dataset is needed
            species (list): The species for download
            species_sorted (str): Whether the dataset should be sorted into species folders
            flat_structure (str): Whether the folder structure should be flattened
    '''

    task_id = request.form['task']
    species = ast.literal_eval(request.form['species'])
    species_sorted = ast.literal_eval(request.form['species_sorted'])
    flat_structure = ast.literal_eval(request.form['flat_structure'])
    individual_sorted = ast.literal_eval(request.form['individual_sorted'])

    if species_sorted.lower()=='true':
        species_sorted = True
    else:
        species_sorted = False

    if flat_structure.lower()=='true':
        flat_structure = True
    else:
        flat_structure = False

    if individual_sorted.lower()=='true':
        individual_sorted = True
    else:
        individual_sorted = False

    task = db.session.query(Task).get(task_id)
    if task and (task.survey.user==current_user) and (task.status.lower() in Config.TASK_READY_STATUSES):
        app.logger.info('exif request made: {}, {}, {}, {}, {}'.format(task_id,species,species_sorted,flat_structure,individual_sorted))
        prepare_exif.delay(task_id=task_id,species=species,species_sorted=species_sorted,flat_structure=flat_structure,individual_sorted=individual_sorted)
        return json.dumps('Success')

    return json.dumps('Error')

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
    if task and (task.survey.user==current_user):
        app.logger.info('export request made: {}, {}, {}'.format(task_id,exportType,data))

        if exportType == 'WildBook':
            generate_wildbook_export.delay(task_id=task_id,data=data)

        return json.dumps('Success')

    return json.dumps('Error')

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

        check = db.session.query(Task).filter(Task.survey_id==int(survey_id)).filter(Task.name==info[0]).first()

        if (check == None) and (db.session.query(Survey).get(int(survey_id)).user_id==current_user.id) and ('_o_l_d_' not in info[0].lower()) and ('_copying' not in info[0].lower()) and (info[0].lower() != 'default'):
            newTask = Task(name=info[0], survey_id=int(survey_id), status='Prepping', tagging_time=0, test_size=0, size=200, parent_classification=parentLabel)
            db.session.add(newTask)
            dbSurvey = db.session.query(Survey).get(int(survey_id))
            dbSurvey.status = 'Prepping Task'
            db.session.commit()
            newTask_id = newTask.id
            
            generateLabels(info[1], newTask_id)
            prepTask.delay(newTask_id=newTask_id, survey_id=survey_id, includes=includes, translation=translation)

        return json.dumps('success')
    except:
        return json.dumps('error')

@app.route('/editTranslations/<task_id>', methods=['POST'])
@login_required
def editTranslations(task_id):
    '''Endpoint for editing translations. Launches task upon completion and returns success/error status.'''

    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user==current_user):
        translation = request.form['translation']
        translation = ast.literal_eval(translation)
        edit_translations(int(task_id), translation)

        # prepare lower level translations
        translations = db.session.query(Translation)\
                                .join(Label)\
                                .filter(Label.children.any())\
                                .filter(Label.description != 'Vehicles/Humans/Livestock')\
                                .filter(Label.description != 'Nothing')\
                                .filter(Label.description != 'Unknown')\
                                .filter(Translation.task_id==int(task_id)).all()
        for translation in translations:
            if not checkChildTranslations(translation.label):
                for child in translation.label.children:
                    createChildTranslations(translation.classification,int(task_id),child)    
        db.session.commit()

        task.status = 'PENDING'
        task.is_bounding = False
        task.survey.status = 'Launched'
        db.session.commit()

        launch_task.apply_async(kwargs={'task_id':task_id})

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

    if survey and (survey.user==current_user):
        survey_name = survey.name
        filePath = 'import/'+current_user.username+'/'+survey_name+'_'+taskName+'.csv'

        uploaded_file = request.files['csv']
        if uploaded_file.filename != '':
            if os.path.splitext(uploaded_file.filename)[1].lower() == '.csv':
                if validate_csv(uploaded_file.stream,survey_id):
                    if not os.path.isdir('import/'+current_user.username):
                        os.makedirs('import/'+current_user.username)

                    uploaded_file.save(filePath)

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
            task_id = request.args.get('task', None)
            if task_id:
                task = db.session.query(Task).get(task_id)
                if task and (task.survey.user==current_user) and (task.status.lower() in Config.TASK_READY_STATUSES) and (task.survey.status.lower() in Config.SURVEY_READY_STATUSES):
                    task.tagging_level = '-1'
                    db.session.commit()
                    return render_template('html/explore.html', title='Explore', helpFile='explore', bucket=Config.BUCKET, version=Config.VERSION)
            return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
            task_id = request.args.get('task', None)
            task = db.session.query(Task).get(task_id)
            if task and (task.survey.user==current_user):
                return render_template('html/knockdown.html', title='Knockdowns', helpFile='knockdown_analysis', bucket=Config.BUCKET, version=Config.VERSION)
            else:
                return redirect(url_for('surveys'))
        else:
            if current_user.parent_id == None:
                return redirect(url_for('jobs'))
            else:
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
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
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
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
                next_page = url_for('jobs', _external=True)
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
                user = User(username=username, admin=False)
                user.set_password(randomString())
                db.session.add(user)
                turkcode = Turkcode(user_id=username, active=False, tagging_time=0)
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

@app.route('/get_available_task/<user_id>')
def get_available_task(user_id):
    '''Returns a random task ID from the currently active tasks for load-testing purposes. Only active when Config.LOAD_TESTING is true.'''

    if Config.LOAD_TESTING:
        task = db.session.query(Task).join(Survey).filter(Survey.user_id==int(user_id)).filter(Task.status=='PROGRESS').order_by(func.rand()).first()
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

    if current_user.is_authenticated:
        if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
            return {'redirect': url_for('done')}, 278
        else:
            current_user.last_ping = datetime.utcnow()
            db.session.commit()
            if current_user.parent:
                app.logger.info('Ping received from {} ({})'.format(current_user.parent.username,current_user.id))
            return json.dumps('success')
    return json.dumps('error')

@app.route('/skipSuggestion/<individual_1>/<individual_2>')
@login_required
def skipSuggestion(individual_1,individual_2):
    '''Skips the individual ID suggestion, removing the IndSimilarity from the session until relaunch. Returns success/error status and progress numbers.'''
    
    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Individual.task_id==individual1.task_id)\
                                .filter(Individual.label_id==individual1.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Individual.task_id==individual2.task_id)\
                                .filter(Individual.label_id==individual2.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    if (individual1 and individual2) and (individual1.task_id==task.id) and (individual2.task_id==task.id) and (individual1 != individual2) and ((current_user.parent in individual1.task.survey.user.workers) or (current_user.parent == individual1.task.survey.user)):

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
            return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1))})
    return json.dumps({'status': 'error'})

@app.route('/undoPreviousSuggestion/<individual_1>/<individual_2>')
@login_required
def undoPreviousSuggestion(individual_1,individual_2):
    '''Undoes the previous action for the two speciefied individual IDs. Returns error/success status, progress numbers and the current images associated with the first individual.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))
    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size
    
    if (individual1 and individual2) and (individual1.task_id==task.id) and (individual2.task_id==task.id) and ((current_user.parent in individual1.task.survey.user.workers) or (current_user.parent == individual1.task.survey.user)):
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
            handleIndividualUndo(indSimilarity,individual1,individual2)

            db.session.commit()
            sortedImages = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(individual1)).order_by(Image.corrected_timestamp).all()

            images = []
            for image in sortedImages:
                output = {'id': image.id,
                        'url': image.camera.path + '/' + image.filename,
                        'timestamp': (image.corrected_timestamp-datetime(1970,1,1)).total_seconds(),
                        'camera': image.camera_id,
                        'rating': image.detection_rating,
                        'latitude': image.camera.trapgroup.latitude,
                        'longitude': image.camera.trapgroup.longitude,
                        'detections': []}

                detection = db.session.query(Detection)\
                                    .filter(Detection.image_id==image.id)\
                                    .filter(Detection.individuals.contains(individual1))\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(~Detection.status.in_(['deleted','hidden']))\
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

            return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1)), 'images': images, 'id': individual1.id})

    return json.dumps({'status': 'error'})

@app.route('/dissociateDetection/<detection_id>')
@login_required
def dissociateDetection(detection_id):
    '''Dissociates the specified detection from either its current individual or the specified one. The detection will be allocated to a new individual, 
    and all necessary individual similarities recalculated. Returns a success/error status.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual_id = request.args.get('individual_id', None)
    if individual_id:
        individual = db.session.query(Individual).get(individual_id)
        task = individual.task
    else:
        task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task

    detection = db.session.query(Detection).get(detection_id)

    if task and detection and (detection.image.camera.trapgroup.survey==task.survey) and ((current_user==task.survey.user) or (current_user.parent in detection.image.camera.trapgroup.survey.user.workers) or (current_user.parent == detection.image.camera.trapgroup.survey.user)):

        if not individual_id:
            individual = db.session.query(Individual)\
                                    .filter(Individual.task_id==task.id)\
                                    .filter(Individual.detections.contains(detection))\
                                    .filter(Individual.active==True)\
                                    .first()
        
        label_id = individual.label_id

        if individual and (detection in individual.detections[:]):
            individual.detections.remove(detection)

        newIndividual = Individual( name=generateUniqueName(task.id,label_id,'n'),
                                    task_id=task.id,
                                    label_id=label_id,
                                    user_id=current_user.id,
                                    timestamp=datetime.utcnow())

        db.session.add(newIndividual)
        newIndividual.detections.append(detection)
        db.session.commit()

        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:
            similarity.old_score = similarity.score
        db.session.commit()

        individuals1 = [r.id for r in db.session.query(Individual)\
                                                    .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                    .filter(Individual.task_id==task.id)\
                                                    .filter(Individual.label_id==label_id)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .filter(Individual.id != newIndividual.id)\
                                                    .filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id))\
                                                    .filter(or_(IndSimilarity.detection_1==int(detection_id),IndSimilarity.detection_2==int(detection_id)))\
                                                    .all()]

        individuals2 = [r.id for r in db.session.query(Individual)\
                                                    .filter(Individual.task_id==task.id)\
                                                    .filter(Individual.label_id==label_id)\
                                                    .filter(Individual.name!='unidentifiable')\
                                                    .filter(Individual.id != individual.id)\
                                                    .all()]

        calculate_individual_similarity.delay(individual1=individual.id,individuals2=individuals1)
        calculate_individual_similarity.delay(individual1=newIndividual.id,individuals2=individuals2)

        newIndSimilarity = IndSimilarity(individual_1=individual.id, individual_2=newIndividual.id, score=0)
        db.session.add(newIndSimilarity)
        db.session.commit()

        return json.dumps({'status': 'success'})

    return json.dumps({'status': 'error'})

@app.route('/reAssociateDetection/<detection_id>/<individual_id>')
@login_required
def reAssociateDetection(detection_id,individual_id):
    '''Re-associates the detection with the specified individual ID, undoing a dissociate action. Restores all necessary similarity scores, and returns success/error status.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    detection = db.session.query(Detection).get(detection_id)
    individual = db.session.query(Individual).get(individual_id)
    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task

    if detection and (detection.image.camera.trapgroup.survey==task.survey) and individual and (individual.task==task) and ((current_user.parent in individual.task.survey.user.workers) or (current_user.parent == individual.task.survey.user)):

        oldIndividual = db.session.query(Individual)\
                                .filter(Individual.task_id==task.id)\
                                .filter(Individual.detections.contains(detection))\
                                .filter(Individual.active==True)\
                                .first()

        if oldIndividual and (detection in oldIndividual.detections[:]):
            oldIndividual.detections.remove(detection)

            if len(oldIndividual.detections[:]) == 0:
                oldIndividual.active = False

            individual.detections.append(detection)

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

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual = db.session.query(Individual).get(int(individual_id))
    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    if individual and individual.active and (individual.task_id==task.id) and ((current_user.parent in individual.task.survey.user.workers) or (current_user.parent == individual.task.survey.user)):
        unidentifiable = db.session.query(Individual).filter(Individual.task_id==task.id).filter(Individual.label_id==individual.label_id).filter(Individual.name=='unidentifiable').first()
        unidentifiable.detections.extend(individual.detections)

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

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Individual.task_id==individual1.task_id)\
                                .filter(Individual.label_id==individual1.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Individual.task_id==individual2.task_id)\
                                .filter(Individual.label_id==individual2.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    if (individual1 and individual2) and (individual1.task_id==task.id) and (individual2.task_id==task.id) and (individual1 != individual2) and ((current_user.parent in individual1.task.survey.user.workers) or (current_user.parent == individual1.task.survey.user)):

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
        
        return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1))})
    return json.dumps({'status': 'error'})

@app.route('/rejectSuggestion/<individual_1>/<individual_2>')
@login_required
def rejectSuggestion(individual_1,individual_2):
    '''Rejects the suggestion that the two specified individuals are the same, removing their similarity from circulation. 
    Returns success/error status and progress numbers.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual1 = db.session.query(Individual).get(int(individual_1))
    individual2 = db.session.query(Individual).get(int(individual_2))

    if individual1.active != True:
        individual1 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual1.detections[0]))\
                                .filter(Individual.task_id==individual1.task_id)\
                                .filter(Individual.label_id==individual1.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    if individual2.active != True:
        individual2 = db.session.query(Individual)\
                                .filter(Individual.detections.contains(individual2.detections[0]))\
                                .filter(Individual.task_id==individual2.task_id)\
                                .filter(Individual.label_id==individual2.label_id)\
                                .filter(Individual.active==True)\
                                .first()

    task = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task
    # num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    # num2 = task.size + task.test_size

    if (individual1 and individual2) and (individual1.task_id==task.id) and (individual2.task_id==task.id) and (individual1 != individual2) and ((current_user.parent in individual1.task.survey.user.workers) or (current_user.parent == individual1.task.survey.user)):

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

        return json.dumps({'status': 'success', 'progress': getProgress(int(individual_1))})
    return json.dumps({'status': 'error'})

@app.route('/getSuggestion/<individual_id>')
@login_required
def getSuggestion(individual_id):
    '''Gets the next suggested match for the specified individual. Returns a suggestion dictionary.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    suggestionID = request.args.get('suggestion', None)
    task_id = db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.id
    individual1 = db.session.query(Individual).get(int(individual_id))
    reply = {}

    if individual1 and (individual1.task_id==task_id) and ((current_user.parent in individual1.task.survey.user.workers) or (current_user.parent == individual1.task.survey.user)):
        if not populateMutex(task_id): return json.dumps('error')

        GLOBALS.mutex[task_id]['global'].acquire()

        if suggestionID:
            suggestion = db.session.query(IndSimilarity).filter(\
                                        or_(\
                                            and_(\
                                                IndSimilarity.individual_1==int(individual_id),\
                                                IndSimilarity.individual_2==int(suggestionID)),\
                                            and_(\
                                                IndSimilarity.individual_1==int(suggestionID),\
                                                IndSimilarity.individual_2==int(individual_id))\
                                        )).first()
        else:
            if individual1 and individual1.active:
                tL = re.split(',',individual1.task.tagging_level)

                inactiveIndividuals = db.session.query(Individual)\
                                                .filter(Individual.task_id==task_id)\
                                                .filter(Individual.label_id==individual1.label_id)\
                                                .filter(Individual.active==False)\
                                                .filter(Individual.name!='unidentifiable')\
                                                .all()
                inactiveIndividuals = [r.id for r in inactiveIndividuals]

                activeIndividuals = db.session.query(Individual)\
                                                .filter(Individual.task_id==task_id)\
                                                .filter(Individual.label_id==individual1.label_id)\
                                                .filter(Individual.allocated!=None)\
                                                .filter(Individual.allocated!=current_user.id)\
                                                .filter(Individual.name!='unidentifiable')\
                                                .all()

                activeIndividuals = [r.id for r in activeIndividuals]                                            

                suggestion = db.session.query(IndSimilarity)\
                                    .filter(or_(IndSimilarity.individual_1==int(individual_id),IndSimilarity.individual_2==int(individual_id)))\
                                    .filter(IndSimilarity.score>=tL[2])\
                                    .filter(IndSimilarity.skipped==False)\
                                    .filter(~IndSimilarity.individual_1.in_(inactiveIndividuals))\
                                    .filter(~IndSimilarity.individual_2.in_(inactiveIndividuals))\
                                    .filter(~IndSimilarity.individual_1.in_(activeIndividuals))\
                                    .filter(~IndSimilarity.individual_2.in_(activeIndividuals))\
                                    .filter(IndSimilarity.allocated==None)\
                                    .order_by(desc(IndSimilarity.score))\
                                    .first()
            else:
                suggestion = None

        if suggestion==None:
            GLOBALS.mutex[task_id]['global'].release()
            reply = {'id': '-876'}
        else:

            if suggestion.individual_1==int(individual_id):
                individual = db.session.query(Individual).get(suggestion.individual_2)
            else:
                individual = db.session.query(Individual).get(suggestion.individual_1)

            bufferCount = db.session.query(IndSimilarity).filter(IndSimilarity.allocated==current_user.id).count()
            if bufferCount >= 3:
                remInds = db.session.query(IndSimilarity)\
                                .filter(IndSimilarity.allocated==current_user.id)\
                                .order_by(IndSimilarity.allocation_timestamp).limit(bufferCount-2).all()
                for remInd in remInds:
                    remInd.allocated = None
                    remInd.allocation_timestamp = None

            suggestion.allocated = current_user.id
            suggestion.allocation_timestamp = datetime.utcnow()
            db.session.commit()

            GLOBALS.mutex[task_id]['global'].release()

            sortedImages = db.session.query(Image).join(Detection).filter(Detection.individuals.contains(individual)).all()

            images = [{'id': image.id,
                    'url': image.camera.path + '/' + image.filename,
                    'timestamp': (image.corrected_timestamp-datetime(1970,1,1)).total_seconds(),
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
                                    'static': detection.static}
                                    for detection in image.detections if (
                                            (detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and 
                                            (detection.status not in ['deleted','hidden']) and 
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
                                        if detection1.image.camera==detection2.image.camera:
                                            intersection_left = max(detection1.left,detection2.left)
                                            intersection_right = min(detection1.right,detection2.right)
                                            intersection_top = max(detection1.top,detection2.top)
                                            intersection_bottom = min(detection1.bottom,detection2.bottom)
            
                                            if (intersection_right>intersection_left) and (intersection_bottom>intersection_top):
                                                intersection_area = (intersection_right-intersection_left)*(intersection_bottom-intersection_top)
                                                detection1_area = (detection1.right-detection1.left)*(detection1.bottom-detection1.top)
                                                detection2_area = (detection2.right-detection2.left)*(detection2.bottom-detection2.top)
                                                union_area = detection1_area + detection2_area - intersection_area
                                                iou = intersection_area/union_area
                                                iou_factor = iouWeight*((1-iou)**2)

                                        distance = coordinateDistance(detection1.image.camera.trapgroup.latitude, detection1.image.camera.trapgroup.longitude, detection2.image.camera.trapgroup.latitude, detection2.image.camera.trapgroup.longitude)
                                        time = abs((detection1.image.corrected_timestamp-detection2.image.corrected_timestamp).total_seconds())
                                        
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

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    individual = db.session.query(Individual).get(individual_id)

    if individual and ((current_user.parent in individual.task.survey.user.workers) or (current_user.parent == individual.task.survey.user) or (current_user == individual.task.survey.user)):
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

        return json.dumps({'id': individual_id, 'name': individual.name, 'tags': [tag.description for tag in individual.tags], 'notes': individual.notes, 'children': [child.id for child in individual.children], 'family': family})
    else:
        return json.dumps('error')

@app.route('/prepNewIndividual')
@login_required
def prepNewIndividual():
    '''Returns the individual tags for the users current task.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278
    
    reply = []
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
    
    if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user)):
        for tag in task.tags:
            reply.append({'tag': tag.description, 'hotkey': tag.hotkey})

    return json.dumps(reply)

@app.route('/submitIndividuals', methods=['POST'])
@login_required
def submitIndividuals():
    '''Submits all the individuals for a specified cluster, for the current species. Returns success/error status, progress numbers, and a dictionary for translating 
    the user-generated IDs into database IDs. Alternatively returns error status and a list of problem names in the case of duplicates.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    success = False
    try:
        task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
        task_id = task.id
        translations = {}
        individuals = ast.literal_eval(request.form['individuals'])
        tL = re.split(',',task.tagging_level)
        label_id = int(tL[1])
        unidentifiable = db.session.query(Individual).filter(Individual.task_id==task_id).filter(Individual.label_id==label_id).filter(Individual.name=='unidentifiable').first()

        detection = db.session.query(Detection).get(individuals[list(individuals.keys())[0]]['detections'][0])
        if detection and ((current_user.parent in detection.image.camera.trapgroup.survey.user.workers) or (current_user.parent == detection.image.camera.trapgroup.survey.user)):
            # First check names:
            problemNames = []
            for individualID in individuals:
                if individuals[individualID]['name'].lower() != 'unidentifiable':
                    check = db.session.query(Individual)

                    if 'n' not in individualID:
                        check = check.filter(Individual.id!=int(individualID))

                    check = check.filter(Individual.label_id==label_id)\
                                        .filter(Individual.name==individuals[individualID]['name'])\
                                        .filter(Individual.task_id==task_id)\
                                        .first()
                    
                    if check:
                        problemNames.append(individuals[individualID]['name'])

            if len(problemNames) > 0:
                return json.dumps({'status': 'error','message': 'There are duplicate names.', 'data': problemNames})
                    
            for individualID in individuals:

                if individuals[individualID]['name'] == 'unidentifiable':
                    individual = unidentifiable
                else:
                    if 'n' not in individualID:
                        # Modify individuals
                        individual = db.session.query(Individual).get(int(individualID))
                        individual.user_id = current_user.id

                    else:
                        # Create new individual
                        name = individuals[individualID]['name']

                        check = db.session.query(Individual)\
                                            .filter(Individual.label_id==label_id)\
                                            .filter(Individual.name==name)\
                                            .filter(Individual.task_id==task_id)\
                                            .first()

                        if check:
                            name = generateUniqueName(task_id,label_id,tL[2])

                        individual = Individual(
                            name = name,
                            label_id = label_id,
                            task_id = task_id,
                            user_id = current_user.id
                        )
                        db.session.add(individual)

                    individual.tags = [db.session.query(Tag).filter(Tag.description==tag).filter(Tag.task_id==task_id).first() for tag in individuals[individualID]['tags']]
                    individual.notes = individuals[individualID]['notes']

                for detID in individuals[individualID]['detections']:
                    det = db.session.query(Detection).get(detID)

                    indivs = db.session.query(Individual).filter(Individual.detections.contains(det))\
                                                        .filter(Individual.task_id==task_id)\
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

            cluster = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task_id==task_id).filter(Detection.id==individuals[individualID]['detections'][0]).first()
            cluster.user_id = current_user.id
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

@app.route('/getCluster')
@login_required
def get_clusters():
    '''Returns the next clusters for annotation, based on the current user, their assigned task, and its associated tagging level.'''

    OverallStartTime = time.time()
    id = request.args.get('id', None)
    reqId = request.args.get('reqId', None)
    
    if reqId is None:
        reqId = '-99'

    if id is None:
        if current_user.admin == True:    
            task_id = request.args.get('task', None)
            if task_id is None:
                return {'redirect': url_for('done')}, 278
        else:
            if current_user.parent_id==None:
                return {'redirect': url_for('done')}, 278
            else:
                task_id = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task_id
    else:
        cluster = db.session.query(Cluster).get(id)
        task_id = cluster.task_id
    
    task = None
    try:
        task = db.session.query(Task).get(task_id)
    except:
        return {'redirect': url_for('done')}, 278
    
    if (task == None) or ((current_user.parent not in task.survey.user.workers) and (current_user.parent != task.survey.user) and (current_user != task.survey.user)):
        return {'redirect': url_for('done')}, 278

    if current_user.admin == True:
        num = 0
    elif '-5' in task.tagging_level:
        num = db.session.query(Individual).filter(Individual.user_id==current_user.id).count()
    else:
        num = db.session.query(Cluster).filter(Cluster.user==current_user).count()

    if (num >= (task.size + task.test_size)) or (current_user.passed in ['cFalse','false','cTrue']):    
        return {'redirect': url_for('done')}, 278

    if (id is None) and (not populateMutex(int(task_id),current_user.id)): return json.dumps('error')

    isBounding = task.is_bounding
    taggingLevel = task.tagging_level

    if id:
        clusters = [cluster]
    else:
        GLOBALS.mutex[int(task_id)]['global'].acquire()
        db.session.commit()

        trapgroup = allocate_new_trapgroup(int(task_id),current_user.id)
        if trapgroup == None:
            GLOBALS.mutex[int(task_id)]['global'].release()
            return json.dumps({'id': reqId, 'info': [Config.FINISHED_CLUSTER]})
        GLOBALS.mutex[int(task_id)]['global'].release()

        GLOBALS.mutex[int(task_id)]['user'][current_user.id].acquire()
        limit = task.size - current_user.clusters_allocated
        clusters = fetch_clusters(taggingLevel,task_id,isBounding,trapgroup.id,limit)
        current_user.clusters_allocated += len(clusters)
        db.session.commit()
        GLOBALS.mutex[int(task_id)]['user'][current_user.id].release()

    if clusters == []:
        current_user.trapgroup = []
        db.session.commit()
        return json.dumps({'id': reqId, 'info': [Config.FINISHED_CLUSTER]})

    reply = {'id': reqId, 'info': []}
    for cluster in clusters:
        reply['info'].append(translate_cluster_for_client(cluster,id,isBounding,taggingLevel,current_user))

    if (id is None) and (current_user.clusters_allocated >= task.size):
        reply['info'].append(Config.FINISHED_CLUSTER)

    OverallEndTime = time.time()
    print("Entire get cluster completed in {}".format(OverallEndTime - OverallStartTime))
    return json.dumps(reply)

@app.route('/getImage')
@login_required
def getImage():
    '''Returns a cluster dictionary with the specified image.'''
    
    id = request.args.get('id', None)
    reqId = request.args.get('reqId', '-99')
    image = db.session.query(Image).get(int(id))

    if image and (current_user == image.camera.trapgroup.survey.user):
        images = [{'id': image.id,
                'url': image.camera.path + '/' + image.filename,
                'rating': image.detection_rating,
                'detections': [{'top': detection.top,
                                'bottom': detection.bottom,
                                'left': detection.left,
                                'right': detection.right,
                                'category': detection.category,
                                'individual': '-1',
                                'static': detection.static}
                                for detection in image.detections
                                if ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.status not in ['deleted','hidden'])) ]}] #and (detection.static == False)

        GTtask = GLOBALS.ground_truths[str(current_user.id)]['ground']
        otherTask = GLOBALS.ground_truths[str(current_user.id)]['other']

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
    if (task.survey.user==current_user) and ((int(knockedstatus) == 87) or (task.status == 'successInitial')):
        task.status = 'Knockdown Analysis'
        db.session.commit()

    if not populateMutex(int(task_id)): return json.dumps('error')

    cluster = None
    result = None
    sortedImages = None
    finished = False
    if task.survey.user==current_user:
        if int(clusterID) != -102:
            GLOBALS.mutex[int(task_id)]['global'].acquire()
            T_index = int(T_index)
            F_index = int(F_index)
            app.logger.info('GetKnockCluster: Status:{} Index:{} ImageIndex:{}'.format(knockedstatus, index, imageIndex))

            if int(clusterID) != 0: #if it is not zero, then it isn't the first of a new cluster
                cluster = db.session.query(Cluster).get(int(clusterID))
                images = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).all()
                if (int(index) == (len(images)-1)) and (knockedstatus == '1'):
                    #beginning and end were knocked - don't need to do anything
                    app.logger.info('Beginning and end were knocked - doing nothing.')
                    cluster.checked = True
                    db.session.commit()
                elif (int(index) == 0) and (knockedstatus == '0'):
                    #first image was not knocked down - need to recluster the whole thing
                    app.logger.info('First image not knocked - reclustering the whole thing.')
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
                        app.logger.info('Single image marked, sending next one.')
                        if knockedstatus == '1':
                            if int(index) > T_index:
                                T_index = int(index)
                        else:
                            if int(index) < F_index:
                                F_index = int(index)
                    else:
                        app.logger.info('Initial cluster marked, sending next middle image.')
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
                        app.logger.info('Finished with cluster, splitting and reclustering.')
                        #deallocate the trapgroup from the user
                        trapgroup = images[0].camera.trapgroup
                        trapgroup.active = False
                        trapgroup.user_id = None
                        trapgroup.processing = True
                        cluster.checked = True
                        db.session.commit()
                        splitClusterAndUnknock.apply_async(kwargs={'oldClusterID':cluster.id, 'SplitPoint':F_index})
                    else:
                        app.logger.info('Sending index: {}'.format(newIndex))
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
                    images = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).all()

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

                    app.logger.info('Sending new knocked-down cluster with image indices: {}'.format(indices))
                    T_index = 0
                    F_index = 0

        if sortedImages != None:
            images = [{'id': image.id,
                    'url': image.camera.path + '/' + image.filename,
                    'rating': image.detection_rating,
                    'detections': [{'top': detection.top,
                                    'bottom': detection.bottom,
                                    'left': detection.left,
                                    'right': detection.right,
                                    'category': detection.category,
                                    'individual': '-1',
                                    'static': detection.static}
                                    for detection in image.detections
                                    if ((detection.score>Config.DETECTOR_THRESHOLDS[detection.source]) and (detection.status not in ['deleted','hidden'])) ]}
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

            taggingLevel = '-1'
            isBounding = False

            sq = db.session.query(Cluster) \
                .join(Image, Cluster.images) \
                .join(Camera) \
                .join(Trapgroup) \
                .join(Detection)

            sq = taggingLevelSQ(sq,taggingLevel,isBounding,int(task_id))

            cluster_count = sq.filter(Cluster.task_id == int(task_id)) \
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .distinct().count()

            finished = False
            if cluster_count>0:
                # Launch & return task for dotask
                code = '-101'
                task.tagging_level = taggingLevel
                task.is_bounding = isBounding
                task.status = 'PENDING'
                task.survey.status = 'Launched'
                db.session.commit()
                launch_task.apply_async(kwargs={'task_id':task_id})
                # if task.status=='PROGRESS':
                #     code = '-100'
                # else:
                #     code = '-102'
                #     if task.status != 'PENDING':
                #         task.tagging_level = taggingLevel
                #         task.is_bounding = isBounding
                #         task.status = 'PENDING'
                #         task.survey.status = 'Launched'
                #         db.session.commit()
                #         launch_task.apply_async(kwargs={'task_id':task_id})

            elif (queueing==0) and (processing==0):
                # Completely done
                code = '-101'
                task.status = 'SUCCESS'
                db.session.commit()
                finished = True
            
            else:
                # Wait for processing
                code = '-102'

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

            # checkQueueingProcessing.apply_async(kwargs={'task_id': task.id}, countdown=30, queue='priority', priority=9)

        if int(clusterID) != -102: GLOBALS.mutex[int(task_id)]['global'].release()

        if finished:
            GLOBALS.mutex.pop(int(task_id), None)

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
    if individual and ((individual.task.survey.user==current_user.parent) or (current_user.parent in individual.task.survey.user.workers)):
        individual.notes = note
        db.session.commit()
        return json.dumps({'status': 'success','message': 'Success.'})

    return json.dumps({'status': 'error','message': 'Could not find individual.'})

@app.route('/getClustersBySpecies/<task_id>/<species>/<tag_id>')
@login_required
def getClustersBySpecies(task_id, species, tag_id):
    '''Returns a list of cluster IDs for the specified task with the specified species and its child labels. 
    Returns all clusters if species is 0.'''

    task = db.session.query(Task).get(task_id)

    if task and (current_user == task.survey.user):
        clusters = db.session.query(Cluster.id) \
                            .filter(Cluster.task_id == int(task_id))

        if (species != '0'):
            label_ids = [int(species)]
            parent_labels = [db.session.query(Label).get(int(species))]
            while parent_labels != []:
                temp_labels = []
                for label in parent_labels:
                    children_labels = db.session.query(Label).filter(Label.parent_id == label.id).all()
                    if children_labels != []:
                        temp_labels.extend(children_labels)
                        for lab in children_labels:
                            label_ids.append(lab.id)
                parent_labels = temp_labels

            clusters = clusters.filter(Cluster.labels.any(Label.id.in_(label_ids)))

        if tag_id != '0':
            tag = db.session.query(Tag).get(int(tag_id))
            clusters = clusters.filter(Cluster.tags.contains(tag))

        clusters = clusters.distinct().all()
    else:
        clusters = []

    return json.dumps(list(set(clusters)))

@app.route('/getTrapgroups/<task_id>')
@login_required
def getTrapgroups(task_id):
    '''Returns the names and IDs of the trapgroups for the specified task.'''
    
    task = db.session.query(Task).get(int(task_id))
    names = ['None','All']
    ids = [-1,0]
    if task and (task.survey.user==current_user):
        trapgroups = db.session.query(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).order_by(Trapgroup.tag).all()
        for trapgroup in trapgroups:
            names.append(trapgroup.tag)
            ids.append(trapgroup.id)
    return json.dumps({'names':names,'values':ids})

@app.route('/getTrapgroupCoords/<survey_id>')
@login_required
def getTrapgroupCoords(survey_id):
    '''Returns the trapgoup coordinates for the specified survey.'''
    
    reply = []
    survey = db.session.query(Survey).get(int(survey_id))
    if (survey and survey.user==current_user):
        for trapgroup in db.session.query(Trapgroup).filter(Trapgroup.survey==survey).order_by(Trapgroup.tag).distinct().all():
            data = {}
            data['tag'] = trapgroup.tag
            data['latitude'] = trapgroup.latitude
            data['longitude'] = trapgroup.longitude
            data['altitude'] = trapgroup.altitude
            reply.append(data)

    return json.dumps(reply)

@app.route('/getSurveyClassifications/<survey_id>')
@login_required
def getSurveyClassifications(survey_id):
    '''Returns a list of all classifications in the specified survey.'''

    survey = db.session.query(Survey).get(survey_id)
    if survey and (survey.user == current_user):
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

@app.route('/getCoords/<task_id>')
@login_required
def getCoords(task_id):
    '''Returns a list of trapgroup latitudes, longitudes and altitudes for the specified task.'''

    trapgroups = []
    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user == current_user):
        for trapgroup in task.survey.trapgroups[:]:
            item = {'name':trapgroup.tag,'latitude':trapgroup.latitude,'longitude':trapgroup.longitude,'altitude':trapgroup.altitude}
            trapgroups.append(item)

    return json.dumps({'trapgroups':trapgroups})

@app.route('/getTrapgroupCounts/<task_id>/<species>/<baseUnit>')
@login_required
def getTrapgroupCounts(task_id,species,baseUnit):
    '''
    Returns the counts of the given species base units for each trapgroup of the specified task.
    
        Parameters:
            task_id (int): The task ID
            species (str): The species ID. 0 returns all species.
            baseUnit (int): The base unit to be counted - images (1), clusters (2), or labelgroups (3)
    '''

    data = []
    maxVal = 0
    task = db.session.query(Task).get(task_id)
    if task and (current_user == task.survey.user):
        if int(baseUnit) == 1:
            baseQuery = db.session.query(Image).join(Detection).join(Labelgroup)
        elif int(baseUnit) == 2:
            baseQuery = db.session.query(Cluster).join(Image,Cluster.images).join(Detection).join(Labelgroup)
        elif int(baseUnit) == 3:
            baseQuery = db.session.query(Labelgroup).join(Detection).join(Image)
        baseQuery = baseQuery.join(Camera).filter(Labelgroup.task_id==task_id).filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)).filter(Detection.static==False).filter(~Detection.status.in_(['deleted','hidden']))

        if species != '0':
            label = db.session.query(Label).get(int(species))
            label_list = [label.id]
            label_list.extend(getChildList(label,int(task_id)))
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
                label_list.extend(getChildList(label,int(task_id)))

            if len(label_list) != 0:
                baseQuery = baseQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

        for trapgroup in task.survey.trapgroups[:]:
            item = {'lat':trapgroup.latitude,'lng':trapgroup.longitude,'count': baseQuery.filter(Camera.trapgroup_id==trapgroup.id).distinct().count(),'tag':trapgroup.tag}
            if item['count'] > maxVal:
                maxVal = item['count']
            data.append(item)

    return json.dumps({'max':maxVal,'data':data})

# @app.route('/assignTag/<clusterID>/<tagID>')
# @login_required
# def assignTag(clusterID, tagID):
#     '''Depricated information tagging ability. Adds given tag to the specified cluster. Returns progress numbers.'''

#     if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
#         return {'redirect': url_for('done')}, 278

#     num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
#     thetask = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
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

#     if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
#         return {'redirect': url_for('done')}, 278

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

#     if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
#         return {'redirect': url_for('done')}, 278

#     cluster = db.session.query(Cluster).get(int(clusterID))
#     if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
#         cluster.tags = []
#         db.session.commit()

#     return json.dumps('')

@app.route('/assignNote/<clusterID>/<note>')
@login_required
def assignNote(clusterID, note):
    '''Assigns a note to the given cluster.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    cluster = db.session.query(Cluster).get(clusterID)
    if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
        if len(note) > 512:
            note = note[:512]
        cluster.notes = note
        db.session.commit()

    return json.dumps('')

@app.route('/assignLabel/<clusterID>', methods=['POST'])
@login_required
def assignLabel(clusterID):
    '''Assigned the specified list of labels to the cluster. Returns progress numbers of an error status.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    try:
        labels = ast.literal_eval(request.form['labels'])
        explore = request.args.get('explore', None)
        reAllocated = False
        newClusters = []
        classifications = None

        num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
        turkcode = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first()
        task = turkcode.task
        num2 = task.size + task.test_size
        cluster = db.session.query(Cluster).get(int(clusterID))
        isBounding = task.is_bounding

        if 'taggingLevel' in request.form:
            taggingLevel = str(request.form['taggingLevel'])
        else:
            taggingLevel = task.tagging_level

        if turkcode.active:
            turkcode.active = False

        if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
            num += 1

            #Check if image has already been knocked down, if so, ignore new label
            downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
            if downLabel and (downLabel in cluster.labels):
                pass
            else:
                if (num <= task.size) or (current_user.admin == True):
                    newLabels = []
                         
                    if '-2' in taggingLevel:
                        cluster.tags = []
                    else:
                        # Can't have nothing label alongside other labels
                        if (len(labels) > 1) and (str(GLOBALS.nothing_id) in labels):
                            app.logger.info('Blocked nothing multi label!')
                            labels.remove(GLOBALS.nothing_id)

                        if (GLOBALS.nothing_id in [r.id for r in cluster.labels]) and (str(GLOBALS.nothing_id) not in labels):
                            reAllocated = True
                            trapgroup = cluster.images[0].camera.trapgroup
                            trapgroup.processing = True
                            trapgroup.active = False
                            trapgroup.user_id = None
                            current_user.clusters_allocated = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
                            db.session.commit()
                            removeFalseDetections.apply_async(kwargs={'cluster_id':clusterID,'undo':True})
                            
                        cluster.labels = []

                    if cluster.skipped:
                        cluster.skipped = False

                    for label_id in labels:
                        if int(label_id)==Config.SKIP_ID:
                            cluster.skipped = True
                            parentLabel = db.session.query(Label).get(taggingLevel)

                            if ('-2' not in taggingLevel) and (parentLabel not in newLabels):
                                newLabels.append(parentLabel)

                        else:
                            if '-2' in taggingLevel:
                                newLabel = db.session.query(Tag).get(label_id)
                            else:
                                newLabel = db.session.query(Label).get(label_id)
                            
                            if newLabel:
                                if newLabel.id == GLOBALS.wrong_id:
                                    newLabels = []
                                    cluster.labels = []
                                    break
                                
                                else:
                                    if newLabel.id == GLOBALS.nothing_id:

                                        # sq = db.session.query(Cluster) \
                                        #     .join(Image, Cluster.images) \
                                        #     .join(Detection)

                                        # sq = taggingLevelSQ(sq,taggingLevel,isBounding,cluster.task_id)

                                        # clusters_remaining = sq.filter(Cluster.task_id == cluster.task_id) \
                                        #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        #                         .filter(Detection.static == False) \
                                        #                         .filter(~Detection.status.in_(['deleted','hidden'])) \
                                        #                         .distinct().count()

                                        tgs_available = db.session.query(Trapgroup)\
                                                                .filter(Trapgroup.survey==task.survey)\
                                                                .filter(Trapgroup.user_id==None)\
                                                                .filter(Trapgroup.active==True)\
                                                                .first()

                                        sq = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                                                                .join(Image) \
                                                                .filter(Image.clusters.contains(cluster))\
                                                                .subquery()

                                        removable_detections = db.session.query(Detection)\
                                                                .join(Image)\
                                                                .join(sq,sq.c.detID==Detection.id)\
                                                                .filter(Image.clusters.contains(cluster))\
                                                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                                                .filter(~Detection.status.in_(['deleted','hidden']))\
                                                                .filter(Detection.static==False)\
                                                                .filter(sq.c.area<0.1)\
                                                                .first()

                                        # sq = db.session.query(Trapgroup)\
                                        #                         .join(Camera)\
                                        #                         .join(Image)\
                                        #                         .join(Detection)\
                                        #                         .join(Cluster,Image.clusters)

                                        # sq = taggingLevelSQ(sq,taggingLevel,isBounding,cluster.task_id)

                                        # tgs_available = sq.filter(Cluster.task_id == cluster.task_id) \
                                        #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                        #                         .filter(Detection.static == False) \
                                        #                         .filter(~Detection.status.in_(['deleted','hidden'])) \
                                        #                         .filter(Trapgroup.user_id==None)\
                                        #                         .filter(Trapgroup.processing==False)\
                                        #                         .filter(Trapgroup.queueing==False)\
                                        #                         .distinct().count()

                                        if tgs_available and (not explore) and removable_detections:
                                            reAllocated = True
                                            trapgroup = cluster.images[0].camera.trapgroup
                                            trapgroup.processing = True
                                            trapgroup.active = False
                                            trapgroup.user_id = None
                                            current_user.clusters_allocated = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
                                            db.session.commit()
                                            removeFalseDetections.apply_async(kwargs={'cluster_id':clusterID,'undo':False})

                                            # Get a new batch of clusters
                                            GLOBALS.mutex[task.id]['global'].acquire()
                                            db.session.commit()
                                            trapgroup = allocate_new_trapgroup(task.id,current_user.id)
                                            GLOBALS.mutex[task.id]['global'].release()

                                            if trapgroup == None:
                                                clusters = []
                                            else:
                                                GLOBALS.mutex[task.id]['user'][current_user.id].acquire()
                                                limit = task.size - current_user.clusters_allocated
                                                clusters = fetch_clusters(taggingLevel,task.id,isBounding,trapgroup.id,limit)
                                                current_user.clusters_allocated += len(clusters)
                                                db.session.commit()
                                                GLOBALS.mutex[task.id]['user'][current_user.id].release()
                                            
                                            if clusters == []:
                                                current_user.trapgroup = []
                                                db.session.commit()
                                                newClusters = [Config.FINISHED_CLUSTER]

                                            else:
                                                newClusters = []
                                                for cluster in clusters:
                                                    newClusters.append(translate_cluster_for_client(cluster,id,isBounding,taggingLevel,current_user))

                                                if current_user.clusters_allocated >= task.size:
                                                    newClusters.append(Config.FINISHED_CLUSTER)

                                    if (newLabel not in cluster.labels) and (newLabel not in cluster.tags) and (newLabel not in newLabels):
                                        newLabels.append(newLabel)

                    if '-2' in taggingLevel:
                        cluster.tags.extend(newLabels)
                        cluster.skipped = True
                    else:
                        cluster.labels.extend(newLabels)
                        if Config.DEBUGGING: app.logger.info('Cluster labels: {}'.format([r.description for r in cluster.labels]))

                    cluster.user_id = current_user.id
                    cluster.examined = True
                    cluster.timestamp = datetime.utcnow()

                    # Copy labels over to labelgroups
                    labelgroups = db.session.query(Labelgroup) \
                                            .join(Detection) \
                                            .join(Image) \
                                            .filter(Image.clusters.contains(cluster)) \
                                            .filter(Labelgroup.task_id==task.id) \
                                            .distinct().all()

                    for labelgroup in labelgroups:
                        if '-2' in taggingLevel:
                            labelgroup.tags = cluster.tags
                        else:
                            labelgroup.labels = cluster.labels

                    db.session.commit()

                    if taggingLevel=='-3': classifications = getClusterClassifications(cluster.id)

        return json.dumps({'progress': (num, num2), 'reAllocated': reAllocated, 'newClusters': newClusters, 'classifications': classifications})

    except:
        return json.dumps('error')

@app.route('/updateprog', methods=['POST'])
@login_required
def updateProgress():
    '''Returns the progress of the current user's batch.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    progress = None
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
    if task:
        if '-5' in task.tagging_level:
            individual_id = request.args.get('id', None)
            if individual_id:
                progress = getProgress(individual_id)
        else:
            num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
            progress = (num, (task.size + task.test_size))
    
    return json.dumps(progress)

@app.route('/getTaggingLevel')
@login_required
def getTaggingLevel():
    '''Returns the tagging level of the current user's allocated task, alongside the name of the label.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    taggingLevel = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task.tagging_level

    if (',' not in taggingLevel) and (int(taggingLevel) > 0):
        taggingLabel = db.session.query(Label).get(int(taggingLevel)).description
    else:
        taggingLabel = 'None'

    return json.dumps({'taggingLevel':taggingLevel, 'taggingLabel':taggingLabel})

@app.route('/initKeys')
@login_required
def initKeys():
    '''Returns the labels and their associated hotkeys for the given task.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task

    # if taggingLevel == '-23':
    #     taggingLevel = task.tagging_level

    if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user) or (current_user == task.survey.user)):

        reply = {}
        labels = db.session.query(Label).filter(Label.task_id==task.id).filter(Label.children.any()).distinct().all()
        labels.append(db.session.query(Label).get(GLOBALS.vhl_id))
        for label in labels:
            reply[str(label.id)] = genInitKeys(str(label.id),task.id)
        reply['-1'] = genInitKeys('-1',task.id)
        reply['-2'] = genInitKeys('-2',task.id)

        return json.dumps(reply)
    else:
        return json.dumps('error')


@app.route('/getSurveys')
@login_required
def getSurvey():
    '''Returns a list of survey names and IDs owned by the current user.'''
    return json.dumps(db.session.query(Survey.id, Survey.name).filter(Survey.user_id == current_user.id).all())

@app.route('/getWorkerSurveys')
@login_required
def getWorkerSurveys():
    '''Returns a list of survey names and IDs, owned by the current user, worked on by the specified worker.'''
    
    worker_id = request.args.get('worker_id',None)
    if worker_id:
        surveys = db.session.query(Survey.id, Survey.name)\
                            .join(Task)\
                            .join(Turkcode)\
                            .join(User,User.username==Turkcode.user_id)\
                            .filter(User.parent_id==worker_id)\
                            .filter(Survey.user_id == current_user.id)\
                            .distinct().all()
    
    return json.dumps(surveys)

@app.route('/getTasks/<survey_id>')
@login_required
def getTasks(survey_id):
    '''Returns the task names and IDs for the specified survey.'''

    worker_id = request.args.get('worker_id',None)

    if worker_id:
        tasks = db.session.query(Task.id, Task.name)\
                            .join(Survey)\
                            .join(Turkcode)\
                            .join(User,User.username==Turkcode.user_id)\
                            .filter(User.parent_id==worker_id)\
                            .filter(Survey.user_id == current_user.id)\
                            .filter(Survey.id == int(survey_id))\
                            .filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying'))\
                            .distinct().all()
        return json.dumps(tasks)
    else:
        if int(survey_id) == -1:
            return json.dumps([(-1, 'Southern African')])
        else:
            return json.dumps(db.session.query(Task.id, Task.name).join(Survey).filter(Survey.id == int(survey_id)).filter(Survey.user==current_user).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).all())

@app.route('/getOtherTasks/<task_id>')
@login_required
def getOtherTasks(task_id):
    '''Returns a list of task names and IDs for the survey of the given task.'''
    task = db.session.query(Task).get(int(task_id))
    if task and (task.survey.user==current_user):
        return json.dumps(db.session.query(Task.id, Task.name).filter(Task.survey_id == task.survey_id).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).all())
    else:
        return json.dumps([])

@app.route('/reviewClassification', methods=['POST'])
@login_required
def reviewClassification():

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()
    turkcode = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first()
    num2 = turkcode.task.size + turkcode.task.test_size

    cluster_labels = []
    cluster_label_ids = []
    classifications = []

    data = json.loads(request.form['data'])
    cluster_id = data['cluster_id']
    overwrite = data['overwrite']
    data = data['data']

    cluster = db.session.query(Cluster).get(cluster_id)
    if cluster and ((current_user.parent in cluster.task.survey.user.workers) or (current_user.parent == cluster.task.survey.user) or (current_user == cluster.task.survey.user)):
        if (current_user.passed != 'false') and (current_user.passed != 'cFalse'):
            if (num < cluster.task.size) or (current_user.admin == True):
                num += 1

                if overwrite:
                    cluster.labels = []

                additional_labels = []
                for item in data:
                    classification = item['label']
                    action = item['action']

                    if action=='accept':
                        if classification.lower() in ['vehicles/humans/livestock','nothing','unknown']:
                            label = db.session.query(Label).filter(Label.description==classification).first()
                        else:
                            label = db.session.query(Label).filter(Label.description==classification).filter(Label.task==cluster.task).first()

                        if label:
                            # Remove related labels
                            if label.parent:
                                family_labels = [label.parent]
                                family_labels.extend(label.parent.children)
                                for family_label in family_labels:
                                    if family_label in cluster.labels:
                                        cluster.labels.remove(family_label)

                            if (label not in additional_labels) and (label not in cluster.labels):
                                additional_labels.append(label)

                labelgroups = db.session.query(Labelgroup)\
                                            .join(Detection)\
                                            .join(Image)\
                                            .filter(Image.clusters.contains(cluster))\
                                            .filter(Labelgroup.task==cluster.task)\
                                            .all()

                cluster.labels.extend(additional_labels)

                for labelgroup in labelgroups:
                    labelgroup.labels = cluster.labels
                    labelgroup.checked = False

                cluster.examined = True
                cluster.user_id == current_user.id
                db.session.commit()

                classifications = getClusterClassifications(cluster.id)

                if cluster.labels == []:
                    cluster_labels.append('None')
                    cluster_label_ids.append('0')
                else:
                    for label in cluster.labels:
                        cluster_labels.append(label.description)
                        cluster_label_ids.append(str(label.id))

    if Config.DEBUGGING: app.logger.info('{}: {}'.format(cluster.id, cluster.labels))

    return json.dumps({'progress':(num, num2),'labels':cluster_labels,'classifications':classifications,'label_ids':cluster_label_ids})

@app.route('/getAllTaskLabels/<task_id1>/<task_id2>')
@login_required
def getAllTaskLabels(task_id1,task_id2):
    '''Gets all the labels for two tasks, in alphabetical, and parent-grouped order.'''

    labels1 = []
    labels2 = []
    task1 = db.session.query(Task).get(task_id1)
    task2 = db.session.query(Task).get(task_id2)
    if task1 and task2 and (current_user==task1.survey.user) and (current_user==task2.survey.user):
        alist = [[GLOBALS.knocked_id,'Knocked Down'],[GLOBALS.nothing_id,'Nothing'],[GLOBALS.unknown_id,'Unknown'],[GLOBALS.vhl_id,'Vehicles/Humans/Livestock']]

        labels1.extend(buildOrderedLabels(None,task_id1))
        labels1.extend(alist)
        labels1.extend(buildOrderedLabels(GLOBALS.vhl_id,task_id1))

        labels2.extend(buildOrderedLabels(None,task_id2))
        labels2.extend(alist)
        labels2.extend(buildOrderedLabels(GLOBALS.vhl_id,task_id2))

    return json.dumps({'one':labels1, 'two':labels2})

@app.route('/submitComparison/<groundTruth>/<task_id1>/<task_id2>', methods=['POST'])
@login_required
def submitComparison(groundTruth,task_id1,task_id2):
    '''Submits a comparison between the two specified tasks, and kicks-off the necessary processing.'''

    try:
        translations = request.form['translations']
        task1 = db.session.query(Task).get(int(task_id1))
        task2 = db.session.query(Task).get(int(task_id2))
        if task1 and task2 and (task1.survey.user_id==current_user.id) and (task2.survey.user_id==current_user.id):
            prepareComparison(translations,groundTruth,task_id1,task_id2,str(current_user.id))
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
                if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                    return redirect(url_for('sightings'))
                elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('clusterID'))
                elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                    return redirect(url_for('individualID'))
                else:
                    return redirect(url_for('index'))
        else:
            if current_user.username=='Dashboard': return redirect(url_for('dashboard'))

            if str(current_user.id) in GLOBALS.confusions.keys():

                # Generate some stats
                total_sightings = 0
                matched_sightings = 0
                nothing_sightings = 0
                non_nothing = 0

                for key in GLOBALS.confusions[str(current_user.id)]:
                    if key != 'multi':
                        for key2 in GLOBALS.confusions[str(current_user.id)][key]:
                            total_sightings += len(GLOBALS.confusions[str(current_user.id)][key][key2])
                            if key == key2:
                                matched_sightings += len(GLOBALS.confusions[str(current_user.id)][key][key2])
                            if GLOBALS.ground_truths[str(current_user.id)]['task1']==GLOBALS.ground_truths[str(current_user.id)]['ground']:
                                if key == GLOBALS.ground_truths[str(current_user.id)]['nothing1']:
                                    nothing_sightings += len(GLOBALS.confusions[str(current_user.id)][key][key2])
                                if key2 != GLOBALS.ground_truths[str(current_user.id)]['nothing2']:
                                    non_nothing += len(GLOBALS.confusions[str(current_user.id)][key][key2])
                            else:
                                if key2 == GLOBALS.ground_truths[str(current_user.id)]['nothing2']:
                                    nothing_sightings += len(GLOBALS.confusions[str(current_user.id)][key][key2])
                                if key != GLOBALS.ground_truths[str(current_user.id)]['nothing1']:
                                    non_nothing += len(GLOBALS.confusions[str(current_user.id)][key][key2])

                match_percentage = round((matched_sightings/total_sightings)*100,2)
                wrong_sightings = total_sightings - matched_sightings
                wrong_percentage = round((wrong_sightings/total_sightings)*100,2)

                unknownLabel = db.session.query(Label).get(GLOBALS.unknown_id)
                unknowns = db.session.query(Image).join(Cluster, Image.clusters).filter(Cluster.task_id==GLOBALS.ground_truths[str(current_user.id)]['other']).filter(Cluster.labels.contains(unknownLabel)).count()

                survey_id = db.session.query(Task).get(GLOBALS.ground_truths[str(current_user.id)]['other']).survey_id

                animal_sightings = total_sightings - nothing_sightings
                value_percentage = round((animal_sightings/total_sightings)*100,2)
                unknown_percentage = round((unknowns/animal_sightings)*100,2)

                correct_animal_sightings = matched_sightings - len(GLOBALS.confusions[str(current_user.id)][GLOBALS.ground_truths[str(current_user.id)]['nothing1']][GLOBALS.ground_truths[str(current_user.id)]['nothing2']])

                recall_rate = round((correct_animal_sightings/animal_sightings)*100,2)
                precision = round((correct_animal_sightings/non_nothing)*100,2)

                task1_heading = db.session.query(Task).get(GLOBALS.ground_truths[str(current_user.id)]['task1']).name
                task2_heading = db.session.query(Task).get(GLOBALS.ground_truths[str(current_user.id)]['task2']).name

                image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).count()

                MegaDetectorFailures = GLOBALS.MegaDetectorMisses[str(current_user.id)]['count']
                MegaDetectorFailures_percentage = round((MegaDetectorFailures/wrong_sightings)*100,2)
                EmptyClustered = len(GLOBALS.emptyClustered[str(current_user.id)])
                EmptyClustered_percentage = round((EmptyClustered/image_count)*100,2)

                # Species by species
                species_names = []
                species_recalls = []
                species_precisions = []
                for species in GLOBALS.confusions[str(current_user.id)]:
                    if species != 'multi':
                        rowCount = 0
                        colCount = 0
                        for key in GLOBALS.confusions[str(current_user.id)][species]:
                            rowCount += len(GLOBALS.confusions[str(current_user.id)][species][key])
                            colCount += len(GLOBALS.confusions[str(current_user.id)][key][species])

                        if GLOBALS.ground_truths[str(current_user.id)]['task1']==GLOBALS.ground_truths[str(current_user.id)]['ground']:
                            actual_species_count = rowCount
                            species_count = colCount
                        else:
                            actual_species_count = colCount
                            species_count = rowCount

                        match_count = len(GLOBALS.confusions[str(current_user.id)][species][species])

                        if actual_species_count!=0:
                            species_recalls.append(round((match_count/actual_species_count)*100,2))
                        else:
                            species_recalls.append('n/a')

                        if species_count!=0:
                            species_precisions.append(round((match_count/species_count)*100,2))
                        else:
                            species_precisions.append('n/a')

                        species_names.append(GLOBALS.comparisonLabels[str(current_user.id)][species])
                        
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
                return render_template("html/block.html",text="Your comparison session has expired. Please request a new comparison.", helpFile='block', version=Config.VERSION)
    
@app.route('/getConfusionMatrix')
@login_required
def getConfusionMatrix():
    '''Returns the confusion matrix comparisons for the task-comparison page, for the active comparison.'''

    if str(current_user.id) in GLOBALS.confusions.keys():
        return json.dumps(GLOBALS.confusions[str(current_user.id)])
    else:
        return json.dumps('Error')


@app.route('/getConfusionLabels')
@login_required
def getConfusionLabels():
    '''Gets the gouping labels for the task-comparison page.'''
    
    if str(current_user.id) in GLOBALS.comparisonLabels.keys():
        newDict = {}
        for key in GLOBALS.comparisonLabels[str(current_user.id)]:
            newDict[key] = {}
            newDict[key]['name'] = GLOBALS.comparisonLabels[str(current_user.id)][key]
            newDict[key]['length'] = math.floor(len(GLOBALS.comparisonLabels[str(current_user.id)][key])/3)
        return json.dumps(newDict)
    else:
        return json.dumps('Error')

@app.route('/getLabels/<task_id>')
@login_required
def getLabels(task_id):
    '''Returns all the label info for a given task ID.'''

    reply = []
    task = db.session.query(Task).get(task_id)
    if (int(task_id) == -1) or (task and (current_user==task.survey.user)):
        if int(task_id) == -1: #template
            task_id = db.session.query(Task).filter(Task.name=='template_southern_africa').filter(Task.survey==None).first().id
        
        tempLabels = db.session.query(Label).filter(Label.task_id == int(task_id)).filter(Label.parent_id==None).all()
        vhl = db.session.query(Label).get(GLOBALS.vhl_id)
        tempLabels.append(vhl)

        labels = []
        for label in tempLabels:
            if label != vhl:
                labels.append(label)
            if len(label.children[:]) != 0:
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
        if task and (current_user == task.survey.user):
            editDict = request.form['editDict']
            handleTaskEdit.delay(task_id=task_id,changes=editDict,user_id=current_user.id)
        return json.dumps('success')
    except:
        return json.dumps('error')

@app.route('/submitTags/<task_id>', methods=['POST'])
@login_required
def submitTags(task_id):
    '''Handles the submission of tags for the specified task. Returns success/error status and then launches task.'''
    
    app.logger.info('Received tags for task {}'.format(task_id))
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)

    if task and (task.survey.user_id==current_user.id):
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
            launch_task.apply_async(kwargs={'task_id':task_id})

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
        task_id = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task_id

    task = db.session.query(Task).get(int(task_id))
    num = db.session.query(Cluster).filter(Cluster.user_id==current_user.id).count()

    if task != None:
        num2 = task.size + task.test_size
    else:
        num2 = 1

    if str(image_id) != '-99':
        image = db.session.query(Image).get(int(image_id))

        if image and ((current_user.parent in image.camera.trapgroup.survey.user.workers) or (current_user.parent == image.camera.trapgroup.survey.user)):
            cluster = db.session.query(Cluster).filter(Cluster.task_id==int(task_id)).filter(Cluster.images.contains(image)).first()
            detectionsDict = ast.literal_eval(request.form['detections'])

            if (current_user.passed != 'false') and (current_user.passed != 'cFalse'):
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

                        if detectionsDict[detID]['label'] in ['Vehicles/Humans/Livestock','Unknown']:
                            label = db.session.query(Label).filter(Label.description==detectionsDict[detID]['label']).first()
                        else:
                            label = db.session.query(Label).filter(Label.task_id==int(task_id)).filter(Label.description==detectionsDict[detID]['label']).first()
                            
                        if label:
                            if 'n' in detID:
                                # Add new detection
                                detection = Detection(
                                    top=detectionsDict[detID]['top'],
                                    bottom=detectionsDict[detID]['bottom'],
                                    left=detectionsDict[detID]['left'],
                                    right=detectionsDict[detID]['right'],
                                    score=1,
                                    static=False,
                                    image_id=int(image_id),
                                    category=1,
                                    source='user',
                                    status='added',
                                    classification='nothing'
                                )
                                db.session.add(detection)
                                labelgroup = Labelgroup(task_id=int(task_id), detection=detection, checked=True)
                                db.session.add(labelgroup)
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

                                db.session.commit()
                                detDbIDs[detID] = detection.id
                            else:
                                # edit old detection
                                detection = db.session.query(Detection).get(int(detID))
                                detection.top = detectionsDict[detID]['top']
                                detection.bottom = detectionsDict[detID]['bottom']
                                detection.left = detectionsDict[detID]['left']
                                detection.right = detectionsDict[detID]['right']
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
                                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                                            .first()

                if clusterDetections == None:
                    num += 1

                    detectionLabels = db.session.query(Label) \
                                                .join(Labelgroup, Label.labelgroups) \
                                                .join(Detection) \
                                                .join(Image) \
                                                .filter(Image.clusters.contains(cluster)) \
                                                .filter(Labelgroup.task_id==int(task_id)) \
                                                .filter(Labelgroup.checked==True) \
                                                .filter(Detection.static==False) \
                                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                                .distinct(Label.id).all()
                                            
                    cluster.labels = detectionLabels
                    cluster.user_id = current_user.id
                    cluster.examined = True
                    cluster.timestamp = datetime.utcnow()
                    db.session.commit()

    return json.dumps({'detIDs':detDbIDs,'progress':(num, num2)})

@app.route('/done')
@login_required
def done():
    '''Wraps up the current annotation batch. Logs user back into their parent account, and redirects them back to the jobs page.'''

    if (current_user.admin == True) or (current_user.parent_id==None):
        return redirect(url_for('jobs'))

    # already finished
    if (current_user.passed == 'cTrue') or (current_user.passed == 'cFalse'):
        admin_user = current_user.parent
        logout_user()
        login_user(admin_user)
        return redirect(url_for('jobs'))

    turkcode = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first()
    task_id = turkcode.task_id
    task = turkcode.task

    # Add time
    turkcode.tagging_time = int((datetime.utcnow() - turkcode.assigned).total_seconds())

    if ('-4' in task.tagging_level) and (task.survey.status=='indprocessing'):
        calculate_individual_similarities.delay(task_id=task_id,label_id=int(re.split(',',task.tagging_level)[1]),user_ids=[current_user.id])
    elif '-5' in task.tagging_level:
        #flush allocations
        allocateds = db.session.query(IndSimilarity).filter(IndSimilarity.allocated==current_user.id).all()
        for allocated in allocateds:
            allocated.allocated = None
            allocated.allocation_timestamp = None

        allocateds = db.session.query(Individual).filter(Individual.allocated==current_user.id).all()
        for allocated in allocateds:
            allocated.allocated = None
            allocated.allocation_timestamp = None

    current_user.passed = 'cTrue'
    turkcode.active = False

    for trapgroup in current_user.trapgroup:
        trapgroup.user_id = None
    db.session.commit()

    GLOBALS.mutex[int(task_id)]['user'].pop(current_user.id, None)

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
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task

    if task and (current_user==task.survey.user):
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
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task

    if task and (current_user==task.survey.user):
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
        task_id = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task_id
    
    task_id = int(task_id)
    task = db.session.query(Task).get(task_id)
    if task and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user)):
        parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).all()
        parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))
        parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
        reply = addChildToDict(parentLabels,reply,task_id)
    return json.dumps(reply)

@app.route('/getTaggingLevels')
@login_required
def getTaggingLevels():
    '''Returns the tagging levels for the task allocated to the current user.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    parent_labels = []
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
    if task and ((current_user==task.survey.user) or (current_user.parent == task.survey.user) or (current_user.parent in task.survey.user.workers)):
        parent_labels = db.session.query(Label.id,Label.description).filter(Label.task_id==task.id).filter(Label.children.any()).all()
        parent_labels.append((GLOBALS.vhl_id,'Vehicles/Humans/Livestock'))
        parent_labels.insert(0,(0, 'All Children Categories'))
        parent_labels.insert(0,(-1, 'All Parent Categories'))
        if '-3' not in task.tagging_level: parent_labels.insert(0,(-2, 'Informational Tags'))

    return json.dumps(parent_labels)

@app.route('/generateExcel/<selectedTask>')
@login_required
def generateExcel(selectedTask):
    '''Requests an Excel-summary of the specified task. Prepares file, and saves it locally for later download. Returns success/error status.'''
    
    task = db.session.query(Task).get(selectedTask)

    if (task == None) or (task.survey.user != current_user):
        return json.dumps('error')

    fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.xlsx'
    if os.path.isfile(fileName):
        try:
            os.remove(fileName)
        except:
            pass

    app.logger.info('Calling generate_excel')
    generate_excel.delay(task_id=int(selectedTask))

    return json.dumps('success')

@app.route('/generateCSV', methods=['POST'])
@login_required
def generateCSV():
    '''Requests the generation of a csv file for later download with the specified columns and rows. Returns success/error status.'''

    try:
        if 'preformatted' in request.form:
            # The pre formatted csv
            selectedTasks = [int(ast.literal_eval(request.form['preformatted']))]
            level = 'image'
            columns = ['trapgroup', 'latitude', 'longitude', 'timestamp', 'image_labels', 'image_sighting_count', 'image_url']
            custom_columns = {selectedTasks[0]:{}}
            label_type = 'column'
            includes = []
            excludes = []
        else:
            selectedTasks = [int(r) for r in ast.literal_eval(request.form['selectedTasks'])]
            level = ast.literal_eval(request.form['level'])
            columns = ast.literal_eval(request.form['columns'])
            custom_columns = ast.literal_eval(request.form['custom_columns'])
            label_type = ast.literal_eval(request.form['label_type'])
            includes = ast.literal_eval(request.form['includes'])
            excludes = ast.literal_eval(request.form['excludes'])
    except:
        return json.dumps('error')

    for selectedTask in selectedTasks:
        task = db.session.query(Task).get(selectedTask)
        if (task == None) or (task.survey.user != current_user):
            return json.dumps('error')

    task = db.session.query(Task).get(selectedTasks[0])
    fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.csv'
    if os.path.isfile(fileName):
        try:
            os.remove(fileName)
        except:
            pass

    app.logger.info('Calling generate_csv: {}, {}, {}, {}'.format(selectedTasks, level, columns, custom_columns))
    generate_csv.delay(selectedTasks=selectedTasks, selectedLevel=level, requestedColumns=columns, custom_columns=custom_columns, label_type=label_type, includes=includes, excludes=excludes)

    return json.dumps('success')

@app.route('/getCSVinfo')
@login_required
def getCSVinfo():
    '''Returns the csv options.'''
    return json.dumps(Config.CSV_INFO)

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
        if task and (task.survey.user==current_user):
            names = []
            ids = []
            parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent_id==None).order_by(Label.description).all()
            parentLabels.append(db.session.query(Label).get(GLOBALS.unknown_id))
            parentLabels.append(db.session.query(Label).get(GLOBALS.vhl_id))

            for label in parentLabels:
                names.append(label.description)
                ids.append(label.id)
                if len(label.children[:])>0:
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

    if (task == None) or (task.survey.user != current_user):
        return json.dumps('error')

    if fileType == 'csv':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.csv'
    elif fileType == 'excel':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.xlsx'
    elif fileType == 'export':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.zip'

    if os.path.isfile(fileName):
        return json.dumps('ready')
    else:
        return json.dumps('not ready yet')


@app.route('/Download/<fileType>/<selectedTask>')
@login_required
def Download(fileType,selectedTask):
    '''Initiates the download of the specified file type for the given task.'''
    
    task = db.session.query(Task).get(selectedTask)

    if (task == None) or (task.survey.user != current_user):
        return json.dumps('error')

    if fileType == 'csv':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.csv'
        filename = task.survey.name+'_'+task.name+'.csv'
    elif fileType == 'excel':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.xlsx'
        filename = task.survey.name+'_'+task.name+'.xlsx'
    elif fileType == 'export':
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name+'.zip'
        filename = task.survey.name+'_'+task.name+'.zip'

    if os.path.isfile(fileName):
        deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=600)
        return send_file('../'+fileName,
                        attachment_filename=filename,
                        as_attachment=True,
                        cache_timeout=-1)
    else:
        return json.dumps('error')

@app.route('/undoknockdown/<imageId>/<clusterId>/<label>')
@login_required
def undoknockdown(imageId, clusterId, label):
    '''Undoes the knock-down categorisation of the specified image. The cluster label is replaced with the supplied label.'''

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    image = db.session.query(Image).get(int(imageId))
    task = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task
    if image and ((current_user.parent in task.survey.user.workers) or (current_user.parent == task.survey.user) or (current_user==task.survey.user)) and (task.survey_id == image.camera.trapgroup.survey_id):
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
            unknock_cluster.apply_async(kwargs={'image_id':int(imageId), 'label_id':label, 'user_id':current_user.id, 'task_id':db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task_id})

    return ""

@app.route('/knockdown/<imageId>/<clusterId>')
@login_required
def knockdown(imageId, clusterId):
    '''Marks the camera of the specified image as marked down by moving all images to a knocked-down cluster.'''
    
    app.logger.info('Knockdown initiated for image {}'.format(imageId))

    if (current_user.passed == 'false') or (current_user.passed == 'cFalse'):
        return {'redirect': url_for('done')}, 278

    #Check if they have permission to work on this survey
    image = db.session.query(Image).get(imageId)
    if not (image and ((current_user == image.camera.trapgroup.survey.user) or (current_user.parent in image.camera.trapgroup.survey.user.workers) or (current_user.parent == image.camera.trapgroup.survey.user))):
        return {'redirect': url_for('done')}, 278

    taggingLevel = db.session.query(Turkcode).filter(Turkcode.user_id == current_user.username).first().task.tagging_level

    if (taggingLevel == '-1') or (taggingLevel == '0'):   
        #Check if image has already been marked knocked down, if so, ignore
        anImage = db.session.query(Image).get(int(imageId))
        aCluster = db.session.query(Cluster).get(int(clusterId))

        if (aCluster == None) or (aCluster.images == []):
            return ""

        task_id = aCluster.task_id

        rootImage = db.session.query(Image) \
                            .filter(Image.clusters.contains(aCluster)) \
                            .filter(Image.camera_id == anImage.camera_id) \
                            .order_by(Image.corrected_timestamp) \
                            .first()

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

        if ((rootImage.corrected_timestamp - first_im.corrected_timestamp) < timedelta(hours=2)) or ((last_im.corrected_timestamp - rootImage.corrected_timestamp) < timedelta(hours=2)):
            #Still setting up
            print('Still setting up or being taken down.')
            if (current_user.passed != 'false') and (current_user.passed != 'cFalse'):
                num_clusters = db.session.query(Cluster).filter(Cluster.user_id == current_user.id).count()
                if (num_clusters < aCluster.task.size) or (current_user.admin == True):

                    newLabel = db.session.query(Label).get(GLOBALS.nothing_id)
                    cluster = db.session.query(Cluster).get(int(clusterId))
                    cluster.labels = [newLabel]
                    cluster.user_id = current_user.id
                    cluster.timestamp = datetime.utcnow()

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
            print('It is really knocked down.')
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

                current_user.clusters_allocated = num_cluster
                db.session.commit()

                if trapgroup.processing:
                    trapgroup.queueing = True
                    db.session.commit()
                else:
                    trapgroup.processing = True
                    trapgroup.active = False
                    trapgroup.user_id = None
                    db.session.commit()
                    finish_knockdown.apply_async(kwargs={'rootImageID':rootImage.id, 'task_id':task_id, 'current_user_id':current_user.id})

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

@app.route('/uploadImageToCloud', methods=['POST'])
@login_required
def uploadImageToCloud():
    '''
    Uploads the sent image to AWS S3 on behalf of the user to enure they only access their own folder.
    '''

    if current_user.admin:

        if 'surveyName' in request.form:
            surveyName = request.form['surveyName']
        else:
            surveyName = None
        
        if surveyName and ('image' in request.files):
            uploaded_file = request.files['image']
            key = current_user.folder + '/' + surveyName + '/' + uploaded_file.filename
            
            temp_file = BytesIO()
            uploaded_file.save(temp_file)
            temp_file.seek(0)
            response = GLOBALS.s3client.put_object(Bucket=Config.BUCKET,Key=key,Body=temp_file)
            hash = response['ETag'][1:-1]
            
            return json.dumps({'status': 'success', 'hash': hash})

    return json.dumps({'status': 'error'})

@app.route('/checkNotifications', methods=['POST'])
@login_required
def checkNotifications():
    '''Checks if there are any new notifications for the user.'''
    
    if current_user.admin:
        notification = db.session.query(Notification)\
                            .filter(~Notification.users.contains(current_user))\
                            .filter(or_(Notification.expires==None,Notification.expires>datetime.utcnow()))\
                            .order_by(Notification.id)\
                            .first()
        if notification:
            notification.users.append(current_user)
            db.session.commit()
            return json.dumps({'status':'success','content':notification.contents})
    
    return json.dumps({'status':'error'})

@app.route('/dashboard')
@login_required
def dashboard():
    '''Renders dashboard where the stats of the platform can be explored.'''
    
    if not current_user.is_authenticated:
        return redirect(url_for('login_page'))
    else:
        if current_user.username=='Dashboard':
            users = db.session.query(User).filter(~User.username.in_(Config.ADMIN_USERS)).filter(User.admin==True).distinct().all()
            image_count=0
            for user in users:
                for survey in user.surveys:
                    image_count+=survey.image_count
            
            sq = db.session.query(User.id.label('user_id'),func.sum(Survey.image_count).label('count')).join(Survey).group_by(User.id).subquery()
            active_users = db.session.query(User)\
                                    .join(Survey)\
                                    .join(Task)\
                                    .join(sq,sq.c.user_id==User.id)\
                                    .filter(Task.init_complete==True)\
                                    .filter(sq.c.count>10000)\
                                    .filter(~User.username.in_(Config.ADMIN_USERS))\
                                    .distinct().count()
            
            latest_statistic = db.session.query(Statistic).order_by(Statistic.timestamp.desc()).first()
            users_added_this_month = len(users)-latest_statistic.user_count
            images_imported_this_month = image_count-latest_statistic.image_count
            active_users_this_month = active_users-latest_statistic.active_user_count

            image_count = str(round((image_count/1000000),2))+'M'
            images_imported_this_month = str(round((images_imported_this_month/1000000),2))+'M'
            
            startDate = datetime.utcnow().replace(day=1)
            endDate = datetime.utcnow()
            costs = get_AWS_costs(startDate,endDate)

            factor = monthrange(datetime.utcnow().year,datetime.utcnow().month)[1]/datetime.utcnow().day
            
            return render_template('html/dashboard.html', title='Dashboard', helpFile='dashboard',
                        version=Config.VERSION,
                        user_count = len(users),
                        image_count = image_count,
                        users_added_this_month = users_added_this_month,
                        images_imported_this_month = images_imported_this_month,
                        active_users_this_month = active_users_this_month,
                        active_users = active_users,
                        last_months_server_cost = latest_statistic.server_cost,
                        last_months_storage_cost = latest_statistic.storage_cost,
                        last_months_db_cost = latest_statistic.db_cost,
                        last_months_total_cost = latest_statistic.total_cost,
                        server_cost_this_month = costs['Amazon Elastic Compute Cloud - Compute'],
                        storage_cost_this_month = costs['Amazon Simple Storage Service'],
                        db_cost_this_month = costs['Amazon Relational Database Service'],
                        total_cost_this_month = costs['Total'],
                        server_estimate = round(factor*costs['Amazon Elastic Compute Cloud - Compute'],2),
                        storage_estimate = round(factor*costs['Amazon Simple Storage Service'],2),
                        db_estimate = round(factor*costs['Amazon Relational Database Service'],2),
                        total_estimate = round(factor*costs['Total'],2),
            )
        else:
            if current_user.admin:
                redirect(url_for('surveys'))
            else:
                if current_user.parent_id == None:
                    return redirect(url_for('jobs'))
                else:
                    if db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.is_bounding:
                        return redirect(url_for('sightings'))
                    elif '-4' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                        return redirect(url_for('clusterID'))
                    elif '-5' in db.session.query(Turkcode).filter(Turkcode.user_id==current_user.username).first().task.tagging_level:
                        return redirect(url_for('individualID'))
                    else:
                        return redirect(url_for('index'))

@app.route('/getDashboardTrends', methods=['POST'])
@login_required
def getDashboardTrends():
    '''Returns the requested dashboard trends.'''
    
    if current_user.username=='Dashboard':
        trend = request.form['trend']
        period = request.form['period']

        if period=='max':
            period = 60

        statistics=list(reversed(db.session.query(Statistic).order_by(Statistic.timestamp.desc()).limit(int(period)).all()))
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
    
    if current_user.username=='Dashboard':
        page = request.args.get('page', 1, type=int)

        sq = db.session.query(User.id.label('user_id'),func.sum(Survey.image_count).label('count')).join(Survey).group_by(User.id).subquery()
        active_users = db.session.query(User)\
                                .join(Survey)\
                                .join(Task)\
                                .join(sq,sq.c.user_id==User.id)\
                                .filter(Task.init_complete==True)\
                                .filter(sq.c.count>10000)\
                                .filter(~User.username.in_(Config.ADMIN_USERS))\
                                .order_by(sq.c.count.desc())\
                                .distinct().paginate(page, 20, False)

        reply = []
        for user in active_users.items:
            image_count=int(db.session.query(sq.c.count).filter(sq.c.user_id==user.id).first()[0])
            if image_count>=1000000:
                image_count = str(round((image_count/1000000),2))+'M'
            else:
                image_count = str(image_count)[:-3]+' '+str(image_count)[-3:]
            reply.append({
                'account':      user.username,
                'affiliation':  user.affiliation,
                'surveys':      len(user.surveys[:]),
                'images':       image_count,
                'regions':      user.regions
            })

        next_url = url_for('getActiveUserData', page=active_users.next_num) if active_users.has_next else None
        prev_url = url_for('getActiveUserData', page=active_users.prev_num) if active_users.has_prev else None

        return json.dumps({'status':'success','data':reply,'next_url':next_url,'prev_url':prev_url})
    
    return json.dumps({'status':'error'})

@app.route('/getAllSites', methods=['POST'])
@login_required
def getAllSites():
    '''Returns the coordinates of all teh sites for the dashboard.'''
    
    if current_user.username=='Dashboard':
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

        classifiers = classifiers.distinct().order_by(Classifier.name).paginate(page, 10, False)

        if showCurrent:
            survey = db.session.query(Survey).get(showCurrent)
            if survey.classifier:
                data.append({
                    'name':survey.classifier.name,
                    'source':survey.classifier.source,
                    'region':survey.classifier.region,
                    'description':survey.classifier.description,
                    'active': True
                })
        
        for classifier in classifiers.items:
            if (not showCurrent) or (classifier!=survey.classifier):
                data.append({
                    'name':classifier.name,
                    'source':classifier.source,
                    'region':classifier.region,
                    'description':classifier.description,
                    'active': False
                })

        next_url = url_for('getClassifierInfo', page=classifiers.next_num, search=search) if classifiers.has_next else None
        prev_url = url_for('getClassifierInfo', page=classifiers.prev_num, search=search) if classifiers.has_prev else None

    return json.dumps({'data': data, 'next_url':next_url, 'prev_url':prev_url})

