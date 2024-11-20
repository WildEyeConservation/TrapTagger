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
# from app.functions.admin import setup_new_survey_permissions
from app.functions.globals import detection_rating, randomString, updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, retryTime,\
                                 chunker, save_crops, list_all, classifyTask, all_equal, taggingLevelSQ, generate_raw_image_hash, updateAllStatuses, setup_new_survey_permissions
from app.functions.annotation import launch_task
import GLOBALS
from sqlalchemy.sql import func, or_, distinct, and_
from sqlalchemy import desc
from sqlalchemy import exc as sa_exc
from datetime import datetime, timedelta
import re
import math
from config import Config
import os
from multiprocessing.pool import ThreadPool as Pool
import base64
import tempfile
import traceback
import warnings
from io import BytesIO
import pyexifinfo
from wand.image import Image as wandImage
from gpuworker.worker import detection, classify
from llavaworker.worker import llava_infer
from celery.result import allow_join_result
import numpy as np
from pykml import parser as kmlparser
import operator
from dateutil.relativedelta import relativedelta
import pandas as pd
import boto3
import time
import requests
import random
import cv2
import piexif
import ffmpeg
import json
from dateutil.parser import parse as dateutil_parse
import zipfile

def clusterAndLabel(localsession,task_id,user_id,image_id,labels):
    '''
    Helper function for importCSV. Creates a labelled, single-image cluster for the specified image and task.

        Parameters:
            localsession: SQLAlchemy session
            task_id (int): Task for which cluster should be created
            user_id (int): User to which the cluster should be associated
            image_id (int): Single image for the cluster
            labels (list): Label IDs to associate with cluster
    '''
    
    cluster = Cluster(task_id=task_id,user_id=user_id)
    localsession.add(cluster)
    cluster.images = [localsession.query(Image).get(image_id)]
    cluster.classification = classifyCluster(cluster)
    detections = localsession.query(Detection).filter(Detection.image_id==image_id).all()
    labelgroups = []
    for detection in detections:
        labelgroup = Labelgroup(detection_id=detection.id,task_id=task_id,checked=False)
        localsession.add(labelgroup)
        labelgroups.append(labelgroup)
    for label in labels:
        if label != -1:
            theLabel = localsession.query(Label).get(label)
            cluster.labels.append(theLabel)
            cluster.timestamp = datetime.utcnow()
            for labelgroup in labelgroups:
                labelgroup.labels.append(theLabel)

def findImID(survey_id,fullPath,isVideo):
    '''
    ImportCSV helper function. Returns image ID for the given path, or NAN if the image cannot be found.

        Parameters:
            survey_id (int): Survey to search for the image
            fullPath (str): The full path for the image file

        Returns:
            image_id (int): The image ID associated with the image. Returns NAN if image cannot be found.
    '''
    
    filename = re.split('/',fullPath)[-1]
    # path = re.split(filename,fullPath)[0][:-1]
    path = os.path.join(*re.split('/',fullPath)[:-1])
    if list(filter(isVideo.search, [filename])):
        images = db.session.query(Image).join(Camera).join(Trapgroup).join(Video).filter(Trapgroup.survey_id==survey_id).filter(Camera.path.contains(path)).filter(Video.filename==filename).distinct().all()
    else:
        images = [db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.path.contains(path)).filter(Image.filename==filename).first()]
    if images:
        return [image.id for image in images]
    else:
        return np.nan


@celery.task(bind=True,max_retries=5,ignore_result=True)
def importCSV(self,survey_id,task_id,filePath,user_id):
    '''
    Celery task for importing a csv file.

        Parameters:
            survey_id (int): Survey for which the csv is being imported
            task_id (int): The task into which the csv is being imported
            filePath (str): The file path for the csv
            user_id: The user who owns the csv
    '''
    try:
        localsession=db.session()

        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=filePath, Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)

        if df:
            isVideo = re.compile('(\.avi$)|(\.mp4$)|(\.mov$)', re.I)
            df.drop_duplicates(subset=['filepath'], keep=True, inplace=True)
            df['image_id'] = df.apply(lambda x: findImID(survey_id,x.filename,isVideo), axis=1)
            df = df[df['image_id'].notna()]
            del df['filename']
            df=df.explode('image_id')

            labelColumns = []
            for column in df:
                if 'label' in column.lower():
                    labelColumns.append(column)

            labels = pd.unique(df[labelColumns].values.ravel('K'))
            labels = [x for x in labels if str(x) != 'nan']

            labelIDs = {}
            for labelName in labels:
                if labelName.lower() == 'nothing':
                    labelIDs[labelName] = GLOBALS.nothing_id
                elif labelName.lower() == 'knocked down':
                    labelIDs[labelName] = GLOBALS.knocked_id
                elif labelName.lower() == 'wrong':
                    labelIDs[labelName] = -1
                elif labelName.lower() == 'unknown':
                    labelIDs[labelName] = GLOBALS.unknown_id
                elif labelName.lower() == 'skip':
                    labelIDs[labelName] = -1
                elif labelName.lower() == 'vehicles/humans/livestock':
                    labelIDs[labelName] = GLOBALS.vhl_id
                else:
                    label = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.description==labelName).first()

                    if label==None:
                        label = Label(description=labelName,hotkey=None,parent_id=None,task_id=task_id,complete=True)
                        db.session.add(label)
                        db.session.commit()

                    labelIDs[labelName]=label.id

            df['labelstemp']= df[labelColumns].values.tolist()
            df['labels'] = df.apply(lambda x: [labelIDs[r] for r in x.labelstemp if str(r) != 'nan'], axis=1)
            del df['labelstemp']
            for column in labelColumns: del df[column]

            df.apply(lambda x: clusterAndLabel(localsession,task_id,user_id,x.image_id,x.labels), axis=1)
            # localsession.commit()

            sq = localsession.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task_id==task_id).subquery()
            images = localsession.query(Image).outerjoin(sq, sq.c.id==Image.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(sq.c.id==None).all()

            for image in images:
                cluster = Cluster(task_id=task_id)
                localsession.add(cluster)
                cluster.images = [image]
                cluster.classification = classifyCluster(cluster)
            
            localsession.commit()

        # # Classify clusters
        task = localsession.query(Task).get(task_id)
        # pool = Pool(processes=4)
        # for trapgroup in task.survey.trapgroups:
        #     pool.apply_async(classifyTrapgroup,(task.id,trapgroup.id))
        # pool.close()
        # pool.join()

        task.status = 'Ready'
        task.survey.status = 'Ready'
        localsession.commit()

        try:
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=filePath)
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
        localsession.remove()

    return True

def importKML(survey_id):
    '''Import kml file for specified survey. Looks for matching trapgroup tags and placemark names. Overwrites old coordinates.'''
    
    survey = db.session.query(Survey).get(survey_id)
    key = survey.organisation.folder + '-comp/kmlFiles/' + survey.name + '.kml'
    
    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
            GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=key, Filename=temp_file.name)

            with open(temp_file.name) as f:
                kmlData = kmlparser.parse(f).getroot()

            for trap in kmlData.Document.Folder.Placemark:
                try:
                    options = []
                    for trapgroup in survey.trapgroups:
                        if trapgroup.tag in trap.name.text:
                            options.append(trapgroup)
                    if len(options) == 1:
                        trapgroup = options[0]
                    else:
                        trapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Trapgroup.tag==trap.name.text).first()
                    if trapgroup != None:
                        try:
                            coords = trap.Point.coordinates.text.split(',')
                            trapgroup.longitude = float(coords[0])
                            trapgroup.latitude = float(coords[1])
                            if len(coords) > 2:
                                trapgroup.altitude = float(coords[2])
                            else:
                                trapgroup.altitude = 0
                        except:
                            pass
                except:
                    pass
            db.session.commit()
    except:
        pass

    return True

@celery.task(bind=True,max_retries=5,ignore_result=True)
def recluster_large_clusters(self,task,updateClassifications,trapgroup_id=None,reClusters=None):
    '''
    Reclusters all clusters with over 50 images, by more strictly defining clusters based on classifications. Failing that, clusters are simply limited to 50 images.

        Parameters:
            task_id (int): Task for which the reclustering should be performed
            updateClassifications (bool): Whether the new clusters should be species classified or not
            reClusters (list): An optional list of clusters that should be reclustered instead of all clusters over 50 images in length

        Returns:
            newClusters (list): List of cluster IDs that have been added
    '''

    try:
        task = db.session.query(Task).get(task)
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

        if reClusters==None:

            subq = db.session.query(Cluster.id.label('clusterID'),func.count(distinct(Image.id)).label('imCount'))\
                        .join(Image,Cluster.images)\
                        .filter(Cluster.task==task)\
                        .group_by(Cluster.id)\
                        .subquery()
            
            # Handle already-labelled clusters
            clusters = db.session.query(Cluster)\
                        .join(subq,subq.c.clusterID==Cluster.id)\
                        .filter(Cluster.task==task)\
                        .filter(subq.c.imCount>50)\
                        .filter(~Cluster.labels.contains(downLabel))\
                        .filter(Cluster.labels.any())

            if trapgroup_id:
                clusters = clusters.join(Image,Cluster.images)\
                        .join(Camera)\
                        .filter(Camera.trapgroup_id==trapgroup_id)

            clusters = clusters.distinct().all()

            for cluster in clusters:
                images = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).distinct().all()
                
                for n in range(math.ceil(len(images)/50)):
                    newCluster = Cluster(task=task)
                    db.session.add(newCluster)
                    newCluster.labels=cluster.labels
                    start_index = (n)*50
                    
                    if n==math.ceil(len(images)/50)-1:
                        newCluster.images = images[start_index:]
                    else:
                        end_index = (n+1)*50
                        newCluster.images = images[start_index:end_index]

                    if updateClassifications:
                        newCluster.classification = classifyCluster(newCluster)

                cluster.labels = []
                cluster.tags = []
                cluster.images = []
                cluster.required_images = []
                db.session.delete(cluster)
                # db.session.commit()
            
            # db.session.commit()
                    
            clusters = db.session.query(Cluster)\
                        .join(subq,subq.c.clusterID==Cluster.id)\
                        .filter(Cluster.task==task)\
                        .filter(subq.c.imCount>50)\
                        .filter(~Cluster.labels.any())
            
            if trapgroup_id:
                clusters = clusters.join(Image,Cluster.images)\
                        .join(Camera)\
                        .filter(Camera.trapgroup_id==trapgroup_id)

            clusters = clusters.distinct().all()

        else:
            clusters = db.db.session.query(Cluster).filter(Cluster.id.in_(reClusters)).all()

        classifier_id = task.survey.classifier_id
        newClusters = []

        class_threshold = {}
        classifierLabels = db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier_id==classifier_id).all()
        for classifierLabel in classifierLabels:
            class_threshold[classifierLabel.classification] = classifierLabel.threshold

        for cluster in clusters:
            currCluster = None
            images = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).all()
            cameras = [str(r[0]) for r in db.session.query(Cameragroup.id).join(Camera).join(Image).filter(Image.clusters.contains(cluster)).distinct().all()]

            prevLabels = {}
            for cam in cameras:
                prevLabels[cam] = []
                    
            for image in images:
                detections = db.session.query(Detection)\
                                    .filter(Detection.image_id==image.id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.static==False)\
                                    .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                    .all()

                if len(detections) == 0:
                    species = ['nothing']
                else:
                    species = []
                    for detection in detections:
                        if (detection.class_score > class_threshold[detection.classification]) and (detection.classification != 'nothing'):
                            species.append(detection.classification)
                        else:
                            species.append('unknown')
                    species = list(set(species))

                newClusterRequired = True

                for cam in prevLabels.keys():
                    for label in prevLabels[cam]:
                        if label in species:
                            newClusterRequired = False
                            break

                if currCluster and (len(currCluster.images[:]) >= 50):
                    newClusterRequired = True

                if newClusterRequired:
                    if currCluster and updateClassifications:
                        currCluster.classification = classifyCluster(currCluster)
                    currCluster = Cluster(task=task)
                    db.session.add(currCluster)
                    newClusters.append(currCluster)
                    prevLabels = {}
                    for cam in cameras:
                        prevLabels[cam] = []

                currCluster.images.append(image)
                prevLabels[str(image.camera.cameragroup_id)] = species

            if currCluster and updateClassifications:
                currCluster.classification = classifyCluster(currCluster)

            cluster.images = []
            db.session.delete(cluster)
        
        db.session.commit()
        newClusters = [r.id for r in newClusters]

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return newClusters

@celery.task(bind=True,max_retries=5)
def cluster_trapgroup(self,trapgroup_id,force=False):
    '''Clusters the specified trapgroup. Handles pre-existing clusters cleanly, reusing labels etc where possible.'''
    
    try:
        downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        survey = trapgroup.survey

        #Check if trapgroup has already been clustered
        previouslyClustered = db.session.query(Cluster).join(Image, Cluster.images).join(Camera).filter(Camera.trapgroup==trapgroup).first()

        # Timestampless images from videos should still be grouped together
        for task in survey.tasks:
            sq = db.session.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task==task).subquery()
            videos = db.session.query(Video)\
                        .join(Camera)\
                        .join(Image)\
                        .outerjoin(sq, sq.c.id==Image.id)\
                        .filter(Camera.trapgroup==trapgroup)\
                        .filter(Image.corrected_timestamp==None)\
                        .filter(sq.c.id==None)\
                        .filter(Image.detections.any())\
                        .distinct().all()
            
            # for chunk in chunker(videos,100):
            for video in videos:
                cluster = Cluster(task_id=task.id)
                db.session.add(cluster)
                cluster.images = video.camera.images
                for img in video.camera.images:
                    if not img.corrected_timestamp and not img.skipped:   # Mark as skipped if not already to prevent reprocessing of timestampless images
                        img.skipped = True
            # db.session.commit()

        # Handle the rest of the images without timestamps
        for task in survey.tasks:
            sq = db.session.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task==task).subquery()
            images = db.session.query(Image)\
                        .outerjoin(sq, sq.c.id==Image.id)\
                        .join(Camera)\
                        .filter(Camera.trapgroup==trapgroup)\
                        .filter(Image.corrected_timestamp==None)\
                        .filter(sq.c.id==None)\
                        .filter(Image.detections.any())\
                        .all()

            # for chunk in chunker(images,1000):
            for image in images:
                cluster = Cluster(task_id=task.id)
                db.session.add(cluster)
                cluster.images.append(image)
                if not image.skipped: image.skipped = True   # Mark as skipped if not already to prevent reprocessing of timestampless images
            # db.session.commit()

        if previouslyClustered and not force:
            #Clustering an already-clustered survey, trying to preserve labels etc.
            for task in survey.tasks:
                sq = db.session.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task==task).subquery()
                images = db.session.query(Image)\
                                .outerjoin(sq, sq.c.id==Image.id)\
                                .join(Camera)\
                                .filter(Camera.trapgroup==trapgroup)\
                                .filter(sq.c.id==None)\
                                .filter(Image.detections.any())\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()
                # for chunk in chunker(images,1000):
                for image in images:
                    potentialClusters = db.session.query(Cluster) \
                                                .join(Image, Cluster.images) \
                                                .join(Camera) \
                                                .filter(Cluster.task==task) \
                                                .filter(Camera.trapgroup==trapgroup) \
                                                .filter(Image.corrected_timestamp>=image.corrected_timestamp-timedelta(seconds=60)) \
                                                .filter(Image.corrected_timestamp<=image.corrected_timestamp+timedelta(seconds=60)) \
                                                .distinct(Cluster.id) \
                                                .all()

                    if len(potentialClusters) == 0:
                        cluster = Cluster(task_id=task.id)
                        db.session.add(cluster)
                        image.clusters.append(cluster)

                        sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
                        image_detections = db.session.query(Detection).outerjoin(sq,sq.c.id==Detection.id).filter(Detection.image_id==image.id).filter(sq.c.id==None).all()
                        for detection in image_detections:
                            labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                            db.session.add(labelgroup)

                    elif len(potentialClusters) == 1:
                        potentialClusters[0].images.append(image)

                        sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
                        image_detections = db.session.query(Detection).outerjoin(sq,sq.c.id==Detection.id).filter(Detection.image_id==image.id).filter(sq.c.id==None).all()
                        for detection in image_detections:
                            labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                            db.session.add(labelgroup)
                            labelgroup.labels = potentialClusters[0].labels
                            labelgroup.tags = potentialClusters[0].tags

                    else:
                        sq = db.session.query(Image) \
                                    .join(Cluster,Image.clusters) \
                                    .filter(Cluster.task == task) \
                                    .filter(Cluster.labels.contains(downLabel)) \
                                    .filter(Image.camera==image.camera)
                        
                        knockTest = sq.order_by(Image.corrected_timestamp).first()
                        allocated = False
                        if knockTest:
                            if (knockTest.corrected_timestamp <= image.corrected_timestamp) and (sq.order_by(desc(Image.corrected_timestamp)).first().corrected_timestamp >= image.corrected_timestamp):
                                image.clusters.append(db.session.query(Cluster).filter(Cluster.task==task).filter(Cluster.images.contains(knockTest)).first())
                                allocated = True

                                sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
                                image_detections = db.session.query(Detection).outerjoin(sq,sq.c.id==Detection.id).filter(Detection.image_id==image.id).filter(sq.c.id==None).all()
                                for detection in image_detections:
                                    labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                                    db.session.add(labelgroup)
                                    labelgroup.labels = [downLabel]

                        if allocated == False:
                            potentialClusters = db.session.query(Cluster) \
                                                .join(Image, Cluster.images) \
                                                .join(Camera) \
                                                .filter(Cluster.task==task) \
                                                .filter(Camera.trapgroup==trapgroup) \
                                                .filter(~Cluster.labels.contains(downLabel)) \
                                                .filter(Image.corrected_timestamp>=image.corrected_timestamp-timedelta(seconds=60)) \
                                                .filter(Image.corrected_timestamp<=image.corrected_timestamp+timedelta(seconds=60)) \
                                                .all()
                            
                            if all_equal([cluster.labels[:] for cluster in potentialClusters]):
                                # Only combine clusters if they have the same labels - prevents issues caused by timelapses
                                potentialClusters[0].images.append(image)
                                for cluster in potentialClusters[1:]:
                                    potentialClusters[0].images.extend(cluster.images)
                                    for label in cluster.labels:
                                        if label not in potentialClusters[0].labels[:]:
                                            potentialClusters[0].labels.append(label)
                                    for tag in cluster.tags:
                                        if tag not in potentialClusters[0].tags[:]:
                                            potentialClusters[0].tags.append(tag)
                                    db.session.delete(cluster)
                                potentialClusters[0].timestamp = datetime.utcnow()

                                sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
                                image_detections = db.session.query(Detection).outerjoin(sq,sq.c.id==Detection.id).filter(Detection.image_id==image.id).filter(sq.c.id==None).all()
                                for detection in image_detections:
                                    labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                                    db.session.add(labelgroup)

                                for im in potentialClusters[0].images:
                                    labelgroups = db.session.query(Labelgroup).join(Detection).filter(Detection.image_id==im.id).filter(Labelgroup.task_id==task.id).all()
                                    for labelgroup in labelgroups:
                                        labelgroup.labels = potentialClusters[0].labels
                                        labelgroup.tags = potentialClusters[0].tags

                            else:
                                cluster = Cluster(task_id=task.id)
                                db.session.add(cluster)
                                image.clusters.append(cluster)

                                sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
                                image_detections = db.session.query(Detection).outerjoin(sq,sq.c.id==Detection.id).filter(Detection.image_id==image.id).filter(sq.c.id==None).all()
                                for detection in image_detections:
                                    labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                                    db.session.add(labelgroup)

                # db.session.commit()

        else:
            #Clustering with a clean slate
            if not force:
                images = db.session.query(Image).join(Camera).filter(Camera.trapgroup == trapgroup).filter(Image.corrected_timestamp!=None).filter(Image.detections.any()).order_by(Image.corrected_timestamp).all()

            for task in survey.tasks:
                if force:
                    # If we are re-clustering after a timestamp change, we want to leave the knock-downs
                    images = db.session.query(Image)\
                                    .join(Camera)\
                                    .join(Detection)\
                                    .join(Labelgroup)\
                                    .filter(Labelgroup.task==task)\
                                    .filter(~Labelgroup.labels.contains(downLabel))\
                                    .filter(Camera.trapgroup == trapgroup)\
                                    .filter(Image.corrected_timestamp!=None)\
                                    .order_by(Image.corrected_timestamp).distinct().all()
                
                prev = None
                if images != []:
                    for image in images:
                        timestamp = image.corrected_timestamp
                        if not (prev) or ((timestamp - prev).total_seconds() > 60):
                            if prev is not None:
                                cluster.images=imList
                            cluster = Cluster(task_id=task.id)
                            db.session.add(cluster)
                            imList = []
                        prev = timestamp
                        imList.append(image)
                    cluster.images=imList
                # db.session.commit()

            # # add task detection labels
            # for task in survey.tasks:
            #     for camera in trapgroup.cameras:
            #         detections = db.session.query(Detection).join(Image).filter(Image.camera_id==camera.id).all()
            #         for detection in detections:
            #             labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
            #             db.session.add(labelgroup)
            #         # db.session.commit()

        # handle labelgroups
        for task in survey.tasks:
            sq = db.session.query(Detection.id).join(Labelgroup).filter(Labelgroup.task_id==task.id).subquery()
            detections = db.session.query(Detection).join(Image).join(Camera).outerjoin(sq,sq.c.id==Detection.id).filter(Camera.trapgroup==trapgroup).filter(sq.c.id==None).all()
            for detection in detections:
                labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                db.session.add(labelgroup)

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

def cluster_survey(survey_id,queue='parallel',force=False,trapgroup_ids=None):
    '''Cluster the specified survey. Automatically handles additional images vs. initial clustering. Returns the default task id for the survey.'''
    
    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Clustering'

    task = db.session.query(Task).filter(Task.survey==survey).filter(Task.name=='default').first()
    if task != None:
        for surveyTask in survey.tasks:
            surveyTask.complete = False
    else:
        task = Task(name='default', survey_id=survey.id, tagging_level='-1', test_size=0, status='Ready')
        db.session.add(task)

    db.session.commit()

    if trapgroup_ids == None:
        trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).all()]

    results = []
    for trapgroup_id in trapgroup_ids:
        results.append(cluster_trapgroup.apply_async(kwargs={'trapgroup_id':trapgroup_id,'force':force},queue=queue))

    task_id = task.id

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

    return task_id

# def checkDetectionStaticStatus(imcount,detection_ids):
#     '''Checks each detection in the given batch to se if it is static or not.'''
    
#     try:
#         queryTemplate="""
#             SELECT
#                 id1 AS detID,
#                 COUNT(*) AS matchCount
#             FROM
#                 (SELECT 
#                     det1.id AS id1,
#                     GREATEST(LEAST(det1.right, det2.right) - GREATEST(det1.left, det2.left), 0) * 
#                     GREATEST(LEAST(det1.bottom, det2.bottom) - GREATEST(det1.top, det2.top), 0) AS intersection,
#                     (det1.right - det1.left) * (det1.bottom - det1.top) AS area1,
#                     (det2.right - det2.left) * (det2.bottom - det2.top) AS area2
#                 FROM
#                     detection AS det1
#                     JOIN detection AS det2
#                     JOIN image AS image1
#                     JOIN image AS image2
#                 ON
#                     image1.camera_id = image2.camera_id
#                     AND image1.id = det1.image_id
#                     AND image2.id = det2.image_id
#                     AND image1.id != image2.id 
#                 WHERE
#                     det1.id IN ({})
#                 ) AS sq1
#             WHERE
#                 sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.7
#             GROUP BY
#                 id1
#         """
#         for detID, matchcount in db.session.execute(queryTemplate.format(','.join([str(r) for r in detection_ids]))):
#             if matchcount>3 and matchcount/imcount>0.3:
#                 detection = db.session.query(Detection).get(detID)
#                 detection.static = True
#         db.session.commit()

#     except Exception:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')

#     finally:
#         db.session.remove()

#     return True

# @celery.task(bind=True,max_retries=5)
# def processCameraStaticDetections(self,cameragroup_id):
#     '''Checks all the detections associated with a given camera ID to see if they are static or not.'''
#     try:
#         ###### Single query approach
#         queryTemplate1="""
#             SELECT 
#                     id1 AS detectionID,
#                     id2 as matchID
#             FROM
#                 (SELECT 
#                     det1.id AS id1,
#                     det2.id AS id2,
#                     GREATEST(LEAST(det1.right, det2.right) - GREATEST(det1.left, det2.left), 0) * 
#                     GREATEST(LEAST(det1.bottom, det2.bottom) - GREATEST(det1.top, det2.top), 0) AS intersection,
#                     (det1.right - det1.left) * (det1.bottom - det1.top) AS area1,
#                     (det2.right - det2.left) * (det2.bottom - det2.top) AS area2
#                 FROM
#                     detection AS det1
#                     JOIN detection AS det2
#                 ON
#                     det1.image_id != det2.image_id
#                 WHERE
#                     det1.id IN ({})
#                     AND det2.id IN ({})
#                     ) AS sq1
#             WHERE
#                 (sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > {} AND sq1.area1 <= 0.05) 
#                 OR (sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > {}  AND sq1.area1 > 0.05 AND sq1.area1 <= 0.1)
#                 OR (sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > {}  AND sq1.area1 > 0.1 AND sq1.area1 <= 0.3)
#                 OR (sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > {}  AND sq1.area1 > 0.3 AND sq1.area1 <= 0.5)
#                 OR (sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > {}  AND sq1.area1 > 0.5 AND sq1.area1 <= 0.9)
#         """

#         dets = [r[0] for r in db.session.query(Detection.id)\
#                                             .join(Image)\
#                                             .join(Camera)\
#                                             .filter(~Image.clusters.any())\
#                                             .filter(Camera.cameragroup_id==cameragroup_id)\
#                                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                             .order_by(Image.corrected_timestamp)\
#                                             .distinct().all()]

#         final_static_groups = []
#         static_detections = []
#         grouping = 5000
#         overlap = 500
#         for i in range(0,len(dets),grouping):
#             static_groups = {}
#             chunk = dets[i:i+grouping+overlap]
#             if (len(chunk)<(grouping+overlap)) and (len(dets)>grouping):
#                 chunk = dets[-grouping-overlap:]
            
#             det_ids = ','.join([str(r) for r in chunk])
#             for det_id,match_id in db.session.execute(queryTemplate1.format(det_ids,det_ids,Config.STATIC_IOU5,Config.STATIC_IOU10,Config.STATIC_IOU30,Config.STATIC_IOU50,Config.STATIC_IOU90)):
#                 if det_id not in static_groups:
#                     static_groups[det_id] = []
#                 static_groups[det_id].append(match_id)

#             # Threshold for match percentage based on number of images
#             image_count = db.session.query(Image).join(Detection).filter(Detection.id.in_(chunk)).distinct().count()
#             if image_count > 100:
#                 match_percentage = round(Config.STATIC_PERCENTAGE / math.log(image_count, 10), 2)
#             else:
#                 match_percentage = Config.STATIC_PERCENTAGE

#             # Process static groups
#             for det_id, match_ids in static_groups.items():
#                 group = match_ids
#                 group.append(det_id)
#                 if len(match_ids)>Config.STATIC_MATCHCOUNT and len(match_ids)/image_count>=match_percentage and any([d_id not in static_detections for d_id in group]):
#                     static_detections.extend(group)

#                     found = False
#                     for item in final_static_groups:
#                         if any([d_id in item for d_id in group]):
#                             item.extend(group)
#                             item = list(set(item))
#                             found = True
#                             break

#                     if not found: final_static_groups.append(group)

def IOU(bbox1,bbox2):
    '''Calculates IOU between two bounding boxes'''
    intersection = max(min(bbox1['right'],bbox2['right']) - max(bbox1['left'],bbox2['left']),0) * max(min(bbox1['bottom'],bbox2['bottom']) - max(bbox1['top'],bbox2['top']),0)
    return intersection / (bbox1['area'] + bbox2['area'] - intersection)

def calc_det_iou(detection_id,df):
    ''' Calculates the IOUs for a detection against the specified dataframe '''

    detection = df[df['detection_id']==detection_id].iloc[0]
    df.drop(df[df['detection_id']==detection_id].index,inplace=True)
    
    df = df[
        (df['left']<detection['right']) &
        (df['right']>detection['left']) &
        (df['bottom']>detection['top']) &
        (df['top']<detection['bottom'])
    ]
    
    if len(df) == 0: return []
    
    df['iou'] = df.apply(lambda x: IOU(detection,x), axis=1)

    if detection['area'] <= 0.05:
        threshold = Config.STATIC_IOU5
    elif detection['area'] <= 0.1:
        threshold = Config.STATIC_IOU10
    elif detection['area'] <= 0.3:
        threshold = Config.STATIC_IOU30
    elif detection['area'] <= 0.5:
        threshold = Config.STATIC_IOU50
    elif detection['area'] <= 0.9:
        threshold = Config.STATIC_IOU90
    else:
        return []

    return list(df[df['iou']>threshold]['detection_id'])

def compare_static_groups(df,group1,group2):
    '''Compares two groups of static detections to see if they should be combined.'''

    # if there is no overlap at all, we can abandon the comparison immediately
    if IOU(df[df['detection_id']==group1[0]].iloc[0],df[df['detection_id']==group2[0]].iloc[0])<(Config.STATIC_IOU5/2): return False
    
    # we only want to compare a limited combination of detections - comparing everything gets out of hand too quickly
    if len(group1) > 100: group1 = random.sample(group1,100)
    for detection1 in group1:
        detection = df[df['detection_id']==detection1].iloc[0]
        df2 = df[df['detection_id'].isin(group2)].copy()
        df2 = df2[
            (df2['left']<detection['right']) &
            (df2['right']>detection['left']) &
            (df2['bottom']>detection['top']) &
            (df2['top']<detection['bottom'])
        ]

        if len(df2) == 0:
            continue
        elif len(df2)>100:
            df2 = df2.sample(100)

        df2['iou'] = df2.apply(lambda x: IOU(detection,x), axis=1)

        if detection['area'] <= 0.05:
            threshold = Config.STATIC_IOU5
        elif detection['area'] <= 0.1:
            threshold = Config.STATIC_IOU10
        elif detection['area'] <= 0.3:
            threshold = Config.STATIC_IOU30
        elif detection['area'] <= 0.5:
            threshold = Config.STATIC_IOU50
        elif detection['area'] <= 0.9:
            threshold = Config.STATIC_IOU90
        else:
            continue

        if len(df2[df2['iou']>threshold]) > 0: return True

    return False

@celery.task(bind=True,max_retries=5)
def processStaticWindow(self,cameragroup_id,index,grouping):

    try:
        static_groups = []

        #Single db query to be efficient
        df = pd.read_sql(db.session.query(
                            Detection.id.label('detection_id'),
                            Detection.left.label('left'),
                            Detection.right.label('right'),
                            Detection.top.label('top'),
                            Detection.bottom.label('bottom'),
                            Image.id.label('image_id')
                        )\
                        .join(Image)\
                        .join(Camera)\
                        .filter(Camera.cameragroup_id==cameragroup_id)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .order_by(Detection.id)\
                        .statement,db.session.bind)

        #close session to prevent any lock ups (wont need it for quite some time)
        db.session.remove()

        df = df.iloc[index:index+grouping]
        df['area'] = df.apply(lambda x: (x.right - x.left) * (x.bottom - x.top), axis=1)

        image_count = len(df['image_id'].unique())
        if image_count > 100:
            match_percentage = round(Config.STATIC_PERCENTAGE / math.log(image_count, 10), 2)
        else:
            match_percentage = Config.STATIC_PERCENTAGE
            
        for detection_id in list(df['detection_id']):

            new_df = df.copy()
            for group in static_groups:
                if detection_id in group:
                    new_df = new_df[~(new_df['detection_id'].isin(group) & (new_df['detection_id']!=detection_id))]
                    break

            if len(new_df) == 0: continue

            group = calc_det_iou(detection_id,new_df)

            # This allows the df to become smaller over the loop (no need to recalculate IOUs from the opposite side)
            df.drop(df[df['detection_id']==detection_id].index,inplace=True)
            group.append(detection_id)
            
            if (len(group)>Config.STATIC_MATCHCOUNT) and (len(group)/image_count>=match_percentage):
                found = False
                for item in static_groups:
                    if any([d_id in item for d_id in group]):
                        item.extend(group)
                        item = list(set(item))
                        found = True
                        break
                if not found: static_groups.append(group)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))
    
    finally:
        db.session.remove()

    return {'index':index,'static_groups':static_groups}
    
@celery.task(bind=True,max_retries=5)
def processCameraStaticDetections(self,cameragroup_id):
    '''Checks all the detections associated with a given camera ID to see if they are static or not.'''
    try:
        
        total_images = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .filter(Camera.cameragroup_id==cameragroup_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .distinct().count()
        db.session.remove()

        if total_images>0:
            # Divide detections into max 4k detection windows to avoid ON^2 growth
            grouping = math.ceil(total_images/math.ceil(total_images/4000))
            results = []
            for i in range(0,total_images,grouping):
                results.append(processStaticWindow.apply_async(kwargs={'cameragroup_id':cameragroup_id,'index':i,'grouping':grouping},queue='parallel_2'))

            static_groups = {}
            GLOBALS.lock.acquire()
            with allow_join_result():
                for result in results:
                    try:
                        response = result.get()
                        static_groups[response['index']] = response['static_groups']
                    except Exception:
                        app.logger.info(' ')
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(traceback.format_exc())
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(' ')
                    result.forget()
            GLOBALS.lock.release()

            df = pd.read_sql(db.session.query(
                                        Detection.id.label('detection_id'),
                                        Detection.left.label('left'),
                                        Detection.right.label('right'),
                                        Detection.top.label('top'),
                                        Detection.bottom.label('bottom'),
                                        Image.id.label('image_id')
                                    )\
                                    .join(Image)\
                                    .join(Camera)\
                                    .filter(Camera.cameragroup_id==cameragroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .order_by(Detection.id)\
                                    .statement,db.session.bind)

            df['area'] = df.apply(lambda x: (x.right - x.left) * (x.bottom - x.top), axis=1)

            # Now we need to combine the groups across the windows
            final_static_groups = static_groups[0].copy()
            for index in static_groups:
                if index!=0:
                    temp_final_static_groups = final_static_groups.copy()
                    temp_static_groups = static_groups[index].copy()

                    # first try single detection matching to reduce pool size
                    for group1 in temp_static_groups:
                        for group2 in temp_final_static_groups:
                            detection = df[df['detection_id']==group1[0]].iloc[0]
                            area = detection['area']
                            if area <= 0.05:
                                threshold = Config.STATIC_IOU5
                            elif area <= 0.1:
                                threshold = Config.STATIC_IOU10
                            elif area <= 0.3:
                                threshold = Config.STATIC_IOU30
                            elif area <= 0.5:
                                threshold = Config.STATIC_IOU50
                            elif area <= 0.9:
                                threshold = Config.STATIC_IOU90
                            else:
                                continue

                            if IOU(detection,df[df['detection_id']==group2[0]].iloc[0])>threshold:
                                # match
                                for group in final_static_groups:
                                    if set(group)==set(group2):
                                        group.extend(group1)
                                        break
                                temp_static_groups.remove(group1)
                                temp_final_static_groups.remove(group2)
                                break

                    # now more-exhaustively check the remaining groups (which are likely to be non-matches)
                    for group1 in temp_static_groups:
                        found = False

                        for group2 in temp_final_static_groups:
                            if compare_static_groups(df,group1,group2):
                                #combine
                                for group in final_static_groups:
                                    if set(group)==set(group2):
                                        group.extend(group1)
                                        found = True
                                        break
                                temp_final_static_groups.remove(group2)
                                break

                        if not found: final_static_groups.append(group1)

            static_detections = []
            for group in final_static_groups:
                static_detections.extend(group)
                detections = db.session.query(Detection).filter(Detection.id.in_(group)).distinct().all()
                staticgroups = db.session.query(Staticgroup).filter(Staticgroup.detections.any(Detection.id.in_(group))).distinct().all()
                if staticgroups:
                    if len(staticgroups) == 1:
                        # Add detections to the existing static group if there is only one and the detections are not already in the group
                        staticgroup = staticgroups[0]
                        group_detections = list(set(staticgroup.detections + detections))
                        staticgroup.detections = group_detections
                        if staticgroup.status == 'rejected':
                            for detection in group_detections:
                                detection.static = False
                        else:
                            for detection in group_detections:
                                detection.static = True
                    else:
                        # Create a new static group if there are multiple static groups (with all detections)
                        group_detections = []
                        for sg in staticgroups:
                            group_detections.extend(sg.detections)
                            db.session.delete(sg)
                        group_detections = list(set(group_detections + detections))
                        new_group = Staticgroup(status='unknown',detections=group_detections)
                        db.session.add(new_group)
                        for detection in group_detections:
                            detection.static = True
                else:
                    staticgroup = Staticgroup(status='unknown', detections=detections)
                    db.session.add(staticgroup)
                    for detection in detections:
                        detection.static = True

            static_detections = list(set(static_detections))
            sq = db.session.query(Detection).filter(Detection.id.in_(static_detections)).subquery()
            detections = db.session.query(Detection)\
                                        .join(Image)\
                                        .join(Camera)\
                                        .outerjoin(sq,sq.c.id==Detection.id)\
                                        .filter(~Image.clusters.any())\
                                        .filter(Camera.cameragroup_id==cameragroup_id)\
                                        .filter(sq.c.id==None)\
                                        .all()
            for detection in detections:
                detection.static = False
                detection.staticgroup = None

            # Get empty static groups and delete them
            staticgroups = db.session.query(Staticgroup).filter(~Staticgroup.detections.any()).all()
            for staticgroup in staticgroups:
                db.session.delete(staticgroup)

            ##### Update Masked Status ########
            # Mask detections
            polygon = func.ST_GeomFromText(func.concat('POLYGON((',
                                Detection.left, ' ', Detection.top, ', ',
                                Detection.left, ' ', Detection.bottom, ', ',
                                Detection.right, ' ', Detection.bottom, ', ',
                                Detection.right, ' ', Detection.top, ', ',
                                Detection.left, ' ', Detection.top, '))'), 32734)

            mask_query = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .join(Cameragroup)\
                                    .join(Mask)\
                                    .filter(~Image.clusters.any())\
                                    .filter(Cameragroup.id==cameragroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.source!='user')\
                                    .filter(func.ST_Contains(Mask.shape, polygon))

            detections = mask_query.filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)).distinct().all()

            for detection in detections:
                detection.status = 'masked'

            # Unmask detections
            masked_detections = mask_query.filter(Detection.status=='masked').subquery()

            detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .outerjoin(masked_detections, masked_detections.c.id==Detection.id)\
                                    .filter(~Image.clusters.any())\
                                    .filter(Camera.cameragroup_id==cameragroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.status=='masked')\
                                    .filter(masked_detections.c.id==None)\
                                    .distinct().all()

            for detection in detections:
                detection.status = 'active'

            db.session.commit()

            ###### individual detection approach
            # sq = db.session.query(Detection.id.label('detID'),((Detection.right - Detection.left) * (Detection.bottom - Detection.top)).label('area')).join(Image).filter(Image.camera_id==camera_id).subquery()
            # detections = [r.id for r in db.session.query(Detection)\
            #                                     .join(Image)\
            #                                     .join(sq,sq.c.detID==Detection.id)\
            #                                     .filter(sq.c.area<0.1)\
            #                                     .filter(Image.camera_id==camera_id)\
            #                                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
            #                                     .distinct().all()]
            # pool = Pool(processes=4)
            # for chunk in chunker(detections,200):
            #     pool.apply_async(checkDetectionStaticStatus,(imcount,chunk))
            # pool.close()
            # pool.join()

            # detections = db.session.query(Detection).join(Image).filter(Image.camera_id == camera_id) \
            #                                                     .filter(Detection.static == None)\
            #                                                     .distinct().all()
            # for detection in detections:
            #     detection.static = False
            # db.session.commit()

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

def processStaticDetections(survey_id):
    '''Identify static detections for a survey based on IOU and percentage of images of a camera containing a detection.'''

    # detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Detection.static==True).all()
    # for detection in detections:
    #     detection.static = False
    # db.session.commit()

    # Process static detections (only do this for cameragroups with new images - those with no clusters)
    results = []
    cameragroup_ids = [r[0] for r in db.session.query(Cameragroup.id).join(Camera).join(Trapgroup).join(Image).filter(~Image.clusters.any()).filter(Trapgroup.survey_id==survey_id).distinct().all()]
    for cameragroup_id in cameragroup_ids:
        results.append(processCameraStaticDetections.apply_async(kwargs={'cameragroup_id':cameragroup_id},queue='parallel'))
    
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

    return True

def removeHumans(task_id,trapgroup_ids=None):
    '''Marks clusters from specified as containing humans if the majority of their detections are classified as non-animal by MegaDetector.'''

    admin = db.session.query(User.id).filter(User.username == 'Admin').first()
    human_label = db.session.query(Label).get(GLOBALS.vhl_id)

    sq = db.session.query(func.count(Detection.category).label('total_dets'),
                                func.count(func.nullif(Detection.category, 1)).label('non_animal_dets'),Cluster.id.label('cluster_id'))\
                                .join('image', 'clusters')\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .filter(Detection.static==False)\
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                                .filter(~Cluster.labels.any())\
                                .filter(Cluster.task_id==task_id)\
                                .group_by(Cluster)\
                                .subquery()
    
    clusters = db.session.query(Cluster)\
                                .join(sq,sq.c.cluster_id==Cluster.id)\
                                .filter(sq.c.non_animal_dets/sq.c.total_dets>0.5)

    if trapgroup_ids: clusters = clusters.join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup_id.in_(trapgroup_ids)).distinct()

    clusters = clusters.all()

    labelgroups = db.session.query(Labelgroup)\
                                .join(Detection)\
                                .join(Image)\
                                .join(Cluster,Image.clusters)\
                                .join(sq,sq.c.cluster_id==Cluster.id)\
                                .filter(sq.c.non_animal_dets/sq.c.total_dets>0.5)\
                                .filter(Labelgroup.task_id==task_id)

    if trapgroup_ids: labelgroups = labelgroups.join(Camera).filter(Camera.trapgroup_id.in_(trapgroup_ids))

    labelgroups = labelgroups.distinct().all()

    for cluster in clusters:
        cluster.labels = [human_label]
        cluster.user_id = admin.id
        cluster.timestamp = datetime.utcnow()

    for labelgroup in labelgroups:
        labelgroup.labels = [human_label]

    db.session.commit()

    return True

def setupDatabase():
    '''Adds compulsory labels and admin user to the databse on first start up.'''
    
    if db.session.query(User).filter(User.username=='Admin').first()==None:
        user = User(username = 'Admin', passed = 'pending', admin=True)
        user.set_password(Config.SECRET_KEY)
        db.session.add(user)

    if db.session.query(User).filter(User.username=='Dashboard').first()==None:
        user = User(username = 'Dashboard', passed = 'pending', admin=True)
        user.set_password(Config.SECRET_KEY)
        db.session.add(user)

    if db.session.query(User).filter(User.username=='API').first()==None:
        user = User(username = 'API', passed = 'pending', admin=True)
        user.set_password(Config.SECRET_KEY)
        db.session.add(user)
    
    if db.session.query(Label).filter(Label.description=='Remove False Detections').first()==None:
        nothing = Label(description='Remove False Detections', hotkey='-')
        db.session.add(nothing)

    if db.session.query(Label).filter(Label.description=='Nothing').first()==None:
        nothing = Label(description='Nothing', hotkey='n')
        db.session.add(nothing)

    if db.session.query(Label).filter(Label.description=='Knocked Down').first()==None:
        knockdown = Label(description='Knocked Down', hotkey='q')
        db.session.add(knockdown)

    if db.session.query(Label).filter(Label.description=='Wrong').first()==None:
        wrong = Label(description='Wrong', hotkey='9')
        db.session.add(wrong)

    if db.session.query(Label).filter(Label.description=='Unknown').first()==None:
        unkown = Label(description='Unknown', hotkey='u')
        db.session.add(unkown)

    if db.session.query(Label).filter(Label.description=='Vehicles/Humans/Livestock').first()==None:
        vehicles = Label(description='Vehicles/Humans/Livestock', hotkey='v')
        db.session.add(vehicles)

    if db.session.query(Label).filter(Label.description=='Mask Area').first()==None:
        mask = Label(description='Mask Area', hotkey='-')
        db.session.add(mask)

    if db.session.query(Classifier).filter(Classifier.name=='MegaDetector').first()==None:
        classifier = Classifier(name='MegaDetector',
                                source='Microsoft',
                                region='Global',
                                active=True,
                                threshold=0.1,
                                description='Basic classification of vehicles, humans, and animals. The default choice for biomes without a dedicated classifier.')
        db.session.add(classifier)

    megadetector = db.session.query(Classifier).filter(Classifier.name=='MegaDetector').first()
    if not megadetector.classification_labels:
        if db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier==megadetector).filter(ClassificationLabel.classification=='animal').first() is None:
            animal_class = ClassificationLabel(classifier=megadetector, classification='animal')
            db.session.add(animal_class)

        if db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier==megadetector).filter(ClassificationLabel.classification=='vehicle').first() is None:
            vehicle_class = ClassificationLabel(classifier=megadetector, classification='vehicle')
            db.session.add(vehicle_class)

        if db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier==megadetector).filter(ClassificationLabel.classification=='human').first() is None:
            human_class = ClassificationLabel(classifier=megadetector, classification='human')
            db.session.add(human_class)

    # if db.session.query(Task).filter(Task.name=='Southern Africa').first()==None:
    #     task = Task(name='Southern Africa')
    #     db.session.add(task)


    # sa_id = db.session.query(Task).filter(Task.name=='Southern Africa').filter(Task.survey==None).first().id

    # if db.session.query(Label).filter(Label.description=='Lion').filter(Label.task_id==sa_id).first()==None:
    #     lion = Label(description='Lion', hotkey='1', task_id=sa_id)
    #     db.session.add(lion)

    # if db.session.query(Label).filter(Label.description=='Leopard').filter(Label.task_id==sa_id).first()==None:
    #     leopard = Label(description='Leopard', hotkey='2',task_id=sa_id)
    #     db.session.add(leopard)

    # if db.session.query(Label).filter(Label.description=='Cheetah').filter(Label.task_id==sa_id).first()==None:
    #     cheetah = Label(description='Cheetah', hotkey='c', task_id=sa_id)
    #     db.session.add(cheetah)

    # if db.session.query(Label).filter(Label.description=='Wild Dog').filter(Label.task_id==sa_id).first()==None:
    #     wilddog = Label(description='Wild Dog', hotkey='3', task_id=sa_id)
    #     db.session.add(wilddog)

    # if db.session.query(Label).filter(Label.description=='Elephant').filter(Label.task_id==sa_id).first()==None:
    #     elephant = Label(description='Elephant', hotkey='e', task_id=sa_id)
    #     db.session.add(elephant)

    # if db.session.query(Label).filter(Label.description=='Hippo').filter(Label.task_id==sa_id).first()==None:
    #     hippo = Label(description='Hippo', hotkey='4', task_id=sa_id)
    #     db.session.add(hippo)

    # if db.session.query(Label).filter(Label.description=='Giraffe').filter(Label.task_id==sa_id).first()==None:
    #     giraffe = Label(description='Giraffe', hotkey='g', task_id=sa_id)
    #     db.session.add(giraffe)

    # if db.session.query(Label).filter(Label.description=='Buffalo').filter(Label.task_id==sa_id).first()==None:
    #     buffalo = Label(description='Buffalo', hotkey='5', task_id=sa_id)
    #     db.session.add(buffalo)

    # if db.session.query(Label).filter(Label.description=='Zebra').filter(Label.task_id==sa_id).first()==None:
    #     zebra = Label(description='Zebra', hotkey='z', task_id=sa_id)
    #     db.session.add(zebra)

    # if db.session.query(Label).filter(Label.description=='Small & Medium Cats').filter(Label.task_id==sa_id).first()==None:
    #     smc = Label(description='Small & Medium Cats', hotkey='6', task_id=sa_id)
    #     db.session.add(smc)

    # smc_id = db.session.query(Label).filter(Label.description=='Small & Medium Cats').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Wildcat').filter(Label.task_id==sa_id).first()==None:
    #     wildcat = Label(description='Wildcat', hotkey='w', parent_id=smc_id, task_id=sa_id)
    #     db.session.add(wildcat)

    # if db.session.query(Label).filter(Label.description=='Civet').filter(Label.task_id==sa_id).first()==None:
    #     civet = Label(description='Civet', hotkey='1', parent_id=smc_id, task_id=sa_id)
    #     db.session.add(civet)

    # if db.session.query(Label).filter(Label.description=='L-spotted Genet').filter(Label.task_id==sa_id).first()==None:
    #     genet = Label(description='L-spotted Genet', hotkey='g', parent_id=smc_id, task_id=sa_id)
    #     db.session.add(genet)

    # if db.session.query(Label).filter(Label.description=='Caracal').filter(Label.task_id==sa_id).first()==None:
    #     caracal = Label(description='Caracal', hotkey='2', parent_id=smc_id, task_id=sa_id)
    #     db.session.add(caracal)

    # if db.session.query(Label).filter(Label.description=='Serval').filter(Label.task_id==sa_id).first()==None:
    #     serval = Label(description='Serval', hotkey='s', parent_id=smc_id, task_id=sa_id)
    #     db.session.add(serval)

    # if db.session.query(Label).filter(Label.description=='Hyeana').filter(Label.task_id==sa_id).first()==None:
    #     hyena = Label(description='Hyeana', hotkey='7', task_id=sa_id)
    #     db.session.add(hyena)

    # hyena_id = db.session.query(Label).filter(Label.description=='Hyeana').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Aardwolf').filter(Label.task_id==sa_id).first()==None:
    #     awolf = Label(description='Aardwolf', hotkey='a', parent_id=hyena_id, task_id=sa_id)
    #     db.session.add(awolf)

    # if db.session.query(Label).filter(Label.description=='Spotted hyeana').filter(Label.task_id==sa_id).first()==None:
    #     spothyena = Label(description='Spotted hyeana', hotkey='s', parent_id=hyena_id, task_id=sa_id)
    #     db.session.add(spothyena)

    # if db.session.query(Label).filter(Label.description=='Brown hyeana').filter(Label.task_id==sa_id).first()==None:
    #     bhyena = Label(description='Brown hyeana', hotkey='b', parent_id=hyena_id, task_id=sa_id)
    #     db.session.add(bhyena)

    # if db.session.query(Label).filter(Label.description=='Jackal').filter(Label.task_id==sa_id).first()==None:
    #     jacal = Label(description='Jackal', hotkey='j', task_id=sa_id)
    #     db.session.add(jacal)

    # jackal_id = db.session.query(Label).filter(Label.description=='Jackal').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Black-backed jackal').filter(Label.task_id==sa_id).first()==None:
    #     bjac = Label(description='Black-backed jackal', hotkey='b', parent_id=jackal_id, task_id=sa_id)
    #     db.session.add(bjac)

    # if db.session.query(Label).filter(Label.description=='Side-striped jackal').filter(Label.task_id==sa_id).first()==None:
    #     sjac = Label(description='Side-striped jackal', hotkey='s', parent_id=jackal_id, task_id=sa_id)
    #     db.session.add(sjac)

    # if db.session.query(Label).filter(Label.description=='Mongoose').filter(Label.task_id==sa_id).first()==None:
    #     mongoose = Label(description='Mongoose', hotkey='m', task_id=sa_id)
    #     db.session.add(mongoose)

    # mongoose_id = db.session.query(Label).filter(Label.description=='Mongoose').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='White-tailed mongoose').filter(Label.task_id==sa_id).first()==None:
    #     wtmongoose = Label(description='White-tailed mongoose', hotkey='w', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(wtmongoose)

    # if db.session.query(Label).filter(Label.description=='Selous mongoose').filter(Label.task_id==sa_id).first()==None:
    #     semongoose = Label(description='Selous mongoose', hotkey='1', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(semongoose)

    # if db.session.query(Label).filter(Label.description=="Meller's mongoose").filter(Label.task_id==sa_id).first()==None:
    #     memong = Label(description="Meller's mongoose", hotkey='m', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(memong)

    # if db.session.query(Label).filter(Label.description=='Bushy-tailed mongoose').filter(Label.task_id==sa_id).first()==None:
    #     btmongoose = Label(description='Bushy-tailed mongoose', hotkey='2', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(btmongoose)

    # if db.session.query(Label).filter(Label.description=='Slender mongoose').filter(Label.task_id==sa_id).first()==None:
    #     slmongoose = Label(description='Slender mongoose', hotkey='3', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(slmongoose)

    # if db.session.query(Label).filter(Label.description=='Dwarf mongoose').filter(Label.task_id==sa_id).first()==None:
    #     dwmongoose = Label(description='Dwarf mongoose', hotkey='d', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(dwmongoose)

    # if db.session.query(Label).filter(Label.description=='Banded mongoose').filter(Label.task_id==sa_id).first()==None:
    #     bandedmongoose = Label(description='Banded mongoose', hotkey='4', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(bandedmongoose)

    # if db.session.query(Label).filter(Label.description=='Yellow mongoose').filter(Label.task_id==sa_id).first()==None:
    #     ymongoose = Label(description='Yellow mongoose', hotkey='y', parent_id=mongoose_id, task_id=sa_id)
    #     db.session.add(ymongoose)

    # if db.session.query(Label).filter(Label.description=='Pig').filter(Label.task_id==sa_id).first()==None:
    #     pig = Label(description='Pig', hotkey='8', task_id=sa_id)
    #     db.session.add(pig)

    # pig_id = db.session.query(Label).filter(Label.description=='Pig').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Warthog').filter(Label.task_id==sa_id).first()==None:
    #     warthog = Label(description='Warthog', hotkey='w', parent_id=pig_id, task_id=sa_id)
    #     db.session.add(warthog)

    # if db.session.query(Label).filter(Label.description=='Bushpig').filter(Label.task_id==sa_id).first()==None:
    #     bushpig = Label(description='Bushpig', hotkey='b', parent_id=pig_id, task_id=sa_id)
    #     db.session.add(bushpig)

    # if db.session.query(Label).filter(Label.description=='Antelope').filter(Label.task_id==sa_id).first()==None:
    #     antelope = Label(description='Antelope', hotkey='a', task_id=sa_id)
    #     db.session.add(antelope)

    # antelope_id = db.session.query(Label).filter(Label.description=='Antelope').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Eland').filter(Label.task_id==sa_id).first()==None:
    #     eland = Label(description='Eland', hotkey='e', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(eland)

    # if db.session.query(Label).filter(Label.description=='Roan').filter(Label.task_id==sa_id).first()==None:
    #     roan = Label(description='Roan', hotkey='1', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(roan)

    # if db.session.query(Label).filter(Label.description=='Sable').filter(Label.task_id==sa_id).first()==None:
    #     sable = Label(description='Sable', hotkey='2', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(sable)

    # if db.session.query(Label).filter(Label.description=='Kudu').filter(Label.task_id==sa_id).first()==None:
    #     kudu = Label(description='Kudu', hotkey='3', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(kudu)

    # if db.session.query(Label).filter(Label.description=='Tsessebe').filter(Label.task_id==sa_id).first()==None:
    #     tsessebe = Label(description='Tsessebe', hotkey='t', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(tsessebe)

    # if db.session.query(Label).filter(Label.description=='Wildebeest').filter(Label.task_id==sa_id).first()==None:
    #     wildebeest = Label(description='Wildebeest', hotkey='w', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(wildebeest)

    # if db.session.query(Label).filter(Label.description=='Impala').filter(Label.task_id==sa_id).first()==None:
    #     impala = Label(description='Impala', hotkey='i', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(impala)

    # if db.session.query(Label).filter(Label.description=='Reedbuck').filter(Label.task_id==sa_id).first()==None:
    #     Reedbuck = Label(description='Reedbuck', hotkey='4', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Reedbuck)

    # if db.session.query(Label).filter(Label.description=='Bushbuck').filter(Label.task_id==sa_id).first()==None:
    #     Bushbuck = Label(description='Bushbuck', hotkey='b', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Bushbuck)

    # if db.session.query(Label).filter(Label.description=='Duiker').filter(Label.task_id==sa_id).first()==None:
    #     Duiker = Label(description='Duiker', hotkey='d', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Duiker)

    # if db.session.query(Label).filter(Label.description=='Klipspringer').filter(Label.task_id==sa_id).first()==None:
    #     Klipspringer = Label(description='Klipspringer', hotkey='5', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Klipspringer)

    # if db.session.query(Label).filter(Label.description=='Steenbok').filter(Label.task_id==sa_id).first()==None:
    #     Steenbok = Label(description='Steenbok', hotkey='6', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Steenbok)

    # if db.session.query(Label).filter(Label.description=='Sitatunga').filter(Label.task_id==sa_id).first()==None:
    #     Sitatunga = Label(description='Sitatunga', hotkey='7', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Sitatunga)

    # if db.session.query(Label).filter(Label.description=='Lechwe').filter(Label.task_id==sa_id).first()==None:
    #     Lechwe = Label(description='Lechwe', hotkey='l', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Lechwe)

    # if db.session.query(Label).filter(Label.description=='Waterbuck').filter(Label.task_id==sa_id).first()==None:
    #     Waterbuck = Label(description='Waterbuck', hotkey='8', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Waterbuck)

    # if db.session.query(Label).filter(Label.description=='Sharpes grysbok').filter(Label.task_id==sa_id).first()==None:
    #     grysbok = Label(description='Sharpes grysbok', hotkey='g', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(grysbok)

    # if db.session.query(Label).filter(Label.description=='Gemsbok').filter(Label.task_id==sa_id).first()==None:
    #     Gemsbok = Label(description='Gemsbok', hotkey='m', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Gemsbok)

    # if db.session.query(Label).filter(Label.description=='Red Hartebeest').filter(Label.task_id==sa_id).first()==None:
    #     Hartebeest = Label(description='Red Hartebeest', hotkey='r', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Hartebeest)

    # if db.session.query(Label).filter(Label.description=='Springbok').filter(Label.task_id==sa_id).first()==None:
    #     Springbok = Label(description='Springbok', hotkey='s', parent_id = antelope_id, task_id=sa_id)
    #     db.session.add(Springbok)

    # if db.session.query(Label).filter(Label.description=='Primate').filter(Label.task_id==sa_id).first()==None:
    #     primate = Label(description='Primate', hotkey='p', task_id=sa_id)
    #     db.session.add(primate)

    # primate_id = db.session.query(Label).filter(Label.description=='Primate').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Baboon').filter(Label.task_id==sa_id).first()==None:
    #     Baboon = Label(description='Baboon', hotkey='b', parent_id = primate_id, task_id=sa_id)
    #     db.session.add(Baboon)

    # if db.session.query(Label).filter(Label.description=='Monkey').filter(Label.task_id==sa_id).first()==None:
    #     Monkey = Label(description='Monkey', hotkey='m', parent_id = primate_id, task_id=sa_id)
    #     db.session.add(Monkey)

    # if db.session.query(Label).filter(Label.description=='Lesser Galago').filter(Label.task_id==sa_id).first()==None:
    #     Galago = Label(description='Lesser Galago', hotkey='g', parent_id = primate_id, task_id=sa_id)
    #     db.session.add(Galago)

    # if db.session.query(Label).filter(Label.description=='Bird').filter(Label.task_id==sa_id).first()==None:
    #     bird = Label(description='Bird', hotkey='9', task_id=sa_id)
    #     db.session.add(bird)

    # bird_id = db.session.query(Label).filter(Label.description=='Bird').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Secretary bird').filter(Label.task_id==sa_id).first()==None:
    #     Secretarybird = Label(description='Secretary bird', hotkey='1', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Secretarybird)

    # if db.session.query(Label).filter(Label.description=='Ground Hornbill').filter(Label.task_id==sa_id).first()==None:
    #     GroundHornbill = Label(description='Ground Hornbill', hotkey='2', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(GroundHornbill)

    # if db.session.query(Label).filter(Label.description=='White Stork').filter(Label.task_id==sa_id).first()==None:
    #     WhiteStork = Label(description='White Stork', hotkey='w', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(WhiteStork)

    # if db.session.query(Label).filter(Label.description=='Saddle-billed Stork').filter(Label.task_id==sa_id).first()==None:
    #     SaddlebilledStork = Label(description='Saddle-billed Stork', hotkey='3', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(SaddlebilledStork)

    # if db.session.query(Label).filter(Label.description=="Abdim's Stork").filter(Label.task_id==sa_id).first()==None:
    #     abdim = Label(description="Abdim's Stork", hotkey='a', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(abdim)

    # if db.session.query(Label).filter(Label.description=='Koorhaan').filter(Label.task_id==sa_id).first()==None:
    #     Koorhaan = Label(description='Koorhaan', hotkey='k', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Koorhaan)

    # if db.session.query(Label).filter(Label.description=='Guineafowl').filter(Label.task_id==sa_id).first()==None:
    #     Guineafowl = Label(description='Guineafowl', hotkey='g', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Guineafowl)

    # if db.session.query(Label).filter(Label.description=='Spurfowl Francolin').filter(Label.task_id==sa_id).first()==None:
    #     SpurfowlFrancolin = Label(description='Spurfowl Francolin', hotkey='f', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(SpurfowlFrancolin)

    # if db.session.query(Label).filter(Label.description=='Ostrich').filter(Label.task_id==sa_id).first()==None:
    #     Ostrich = Label(description='Ostrich', hotkey='o', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Ostrich)

    # if db.session.query(Label).filter(Label.description=='Bat').filter(Label.task_id==sa_id).first()==None:
    #     Bat = Label(description='Bat', hotkey='b', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Bat)

    # if db.session.query(Label).filter(Label.description=='Other bird').filter(Label.task_id==sa_id).first()==None:
    #     Otherbird = Label(description='Other bird', hotkey='4', parent_id = bird_id, task_id=sa_id)
    #     db.session.add(Otherbird)

    # if db.session.query(Label).filter(Label.description=='Sundry').filter(Label.task_id==sa_id).first()==None:
    #     sundry = Label(description='Sundry', hotkey=' ', task_id=sa_id)
    #     db.session.add(sundry)

    # sundry_id = db.session.query(Label).filter(Label.description=='Sundry').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='Bat-eared Fox').filter(Label.task_id==sa_id).first()==None:
    #     BatearedFox = Label(description='Bat-eared Fox', hotkey='b', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(BatearedFox)

    # if db.session.query(Label).filter(Label.description=='Ratel').filter(Label.task_id==sa_id).first()==None:
    #     Ratel = Label(description='Ratel', hotkey='r', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(Ratel)

    # if db.session.query(Label).filter(Label.description=='Striped Polecat').filter(Label.task_id==sa_id).first()==None:
    #     StripedPolecat = Label(description='Striped Polecat', hotkey='1', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(StripedPolecat)

    # if db.session.query(Label).filter(Label.description=='Aardvark').filter(Label.task_id==sa_id).first()==None:
    #     Aardvark = Label(description='Aardvark', hotkey='a', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(Aardvark)

    # if db.session.query(Label).filter(Label.description=='Porcupine').filter(Label.task_id==sa_id).first()==None:
    #     Porcupine = Label(description='Porcupine', hotkey='p', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(Porcupine)

    # if db.session.query(Label).filter(Label.description=='Springhare').filter(Label.task_id==sa_id).first()==None:
    #     Springhare = Label(description='Springhare', hotkey='2', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(Springhare)

    # if db.session.query(Label).filter(Label.description=='Scrub Hare').filter(Label.task_id==sa_id).first()==None:
    #     ScrubHare = Label(description='Scrub Hare', hotkey='3', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(ScrubHare)

    # if db.session.query(Label).filter(Label.description=='Cane Rat').filter(Label.task_id==sa_id).first()==None:
    #     CaneRat = Label(description='Cane Rat', hotkey='4', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(CaneRat)

    # if db.session.query(Label).filter(Label.description=='Other Sundry').filter(Label.task_id==sa_id).first()==None:
    #     OtherSundry = Label(description='Other Sundry', hotkey=' ', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(OtherSundry)

    # if db.session.query(Label).filter(Label.description=='Cape Fox').filter(Label.task_id==sa_id).first()==None:
    #     CapeFox = Label(description='Cape Fox', hotkey='5', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(CapeFox)

    # if db.session.query(Label).filter(Label.description=='Otter').filter(Label.task_id==sa_id).first()==None:
    #     Otter = Label(description='Otter', hotkey='o', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(Otter)

    # if db.session.query(Label).filter(Label.description=='Pangolin').filter(Label.task_id==sa_id).first()==None:
    #     pangolin = Label(description='Pangolin', hotkey='6', parent_id = sundry_id, task_id=sa_id)
    #     db.session.add(pangolin)

    # if db.session.query(Label).filter(Label.description=='Rhinoceros').filter(Label.task_id==sa_id).first()==None:
    #     Rhinoceros = Label(description='Rhinoceros', hotkey='r', task_id=sa_id)
    #     db.session.add(Rhinoceros)

    # rhino_id = db.session.query(Label).filter(Label.description=='Rhinoceros').filter(Label.task_id==sa_id).first().id

    # if db.session.query(Label).filter(Label.description=='White Rhino').filter(Label.task_id==sa_id).first()==None:
    #     WhiteRhino = Label(description='White Rhino', hotkey='w', parent_id = rhino_id, task_id=sa_id)
    #     db.session.add(WhiteRhino)

    # if db.session.query(Label).filter(Label.description=='Black Rhino').filter(Label.task_id==sa_id).first()==None:
    #     BlackRhino = Label(description='Black Rhino', hotkey='b', parent_id = rhino_id, task_id=sa_id)
    #     db.session.add(BlackRhino)


    db.session.commit()

def batch_images(camera_id,filenames,sourceBucket,dirpath,destBucket,survey_id,pipeline,external,lock,remove_gps,live=False):
    ''' Helper function for importImages that batches images and adds them to the queue to be run through the detector. '''

    try:

        # Only filter the wand warnings as errors
        warnings.filterwarnings(action='error', module='wand')

        # warnings.filterwarnings('error')
        #TODO : The line above is to treat warnings as errors, this is necesary because when wand cannot read or can only
        # partially read a corrupted image, it issues a warning rather than a error. In order to trap these cases and keep
        # them out of the DB, I need to treat them as errors. However this exposes a ResourceWarning caused by pyexifinfo's
        # failure to properly close the Popen object that it uses to read the output of exiftool. The line below just
        # suppresses this back down to warning level, but ideally we should go fix this inside pyexifinfo itself or use an
        # alternative exif API.
        # warnings.filterwarnings('ignore',category=ResourceWarning)

        splits = dirpath.split('/')
        splits[0] = splits[0]+'-comp'
        newpath = '/'.join(splits)

        batch = []
        images = []
        for filename in filenames:
            if live:
                image_id = filename['id']
                filename = filename['filename']  
            hash = None
            etag = None
            if not pipeline: etag = GLOBALS.s3client.head_object(Bucket=sourceBucket,Key=os.path.join(dirpath, filename))['ETag'][1:-1]
            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                if not pipeline and not live:
                    print('Downloading {}'.format(filename))
                    try:
                        GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=os.path.join(dirpath, filename), Filename=temp_file.name)
                    except:
                        app.logger.info("Skipping {} could not download...".format(dirpath+'/'+filename))
                        continue

                    try:
                        hash = generate_raw_image_hash(temp_file.name)
                        assert hash
                    except:
                        app.logger.info("Skipping {} could not generate hash...".format(dirpath+'/'+filename))
                        continue
                    
                    try:
                        if Config.DEBUGGING: print('Extracting time stamp from {}'.format(filename))
                        t = pyexifinfo.get_json(temp_file.name)[0]
                        timestamp = None
                        for field in ['EXIF:DateTimeOriginal','MakerNotes:DateTimeOriginal']:
                            if field in t.keys():
                                timestamp = datetime.strptime(t[field], '%Y:%m:%d %H:%M:%S')
                                break
                        # assert timestamp

                        # Check timestamp is not corrupt
                        if timestamp and (timestamp>datetime.utcnow()): timestamp == None
                        if timestamp and (timestamp.year<2000): timestamp == None

                    except:
                        if Config.DEBUGGING: app.logger.info("Skipping {} could not extract timestamp...".format(dirpath+'/'+filename))
                        continue
                    
                    if remove_gps:
                        # Remove GPS data from the image & upload it 
                        try:
                            exif_data = piexif.load(temp_file.name)
                            if exif_data['GPS']:
                                exif_data['GPS'] = {}
                                exif_bytes = piexif.dump(exif_data)     # NOTE: Some cameras (Bushnell) has EXIF data that is not formatted correctly and causes the dump to fail 
                                piexif.insert(exif_bytes, temp_file.name)
                                GLOBALS.s3client.upload_file(Filename=temp_file.name, Bucket=sourceBucket, Key=os.path.join(dirpath, filename))
                        except:
                            if Config.DEBUGGING: app.logger.info("Skipping {} could not remove GPS data...".format(dirpath+'/'+filename))
                            pass

                else:
                    # don't need to download the image or even extract a timestamp if pipelining
                    timestamp = None
                
                if not pipeline and not live:
                    # don't compress and upload the image if its a training-data pipeline
                    if Config.DEBUGGING: print('Compressing {}'.format(filename))
                    
                    # Wand does not appear to be thread safe
                    lock.acquire()
                    try:
                        with wandImage(filename=temp_file.name).convert('jpeg') as img:
                            # This is required, because if we don't have it ImageMagick gets too clever for it's own good
                            # and saves images with no color content (i.e. fully black image) as grayscale. But this causes
                            # problems for MegaDetector which expects a 3 channel image as input.
                            img.metadata['colorspace:auto-grayscale'] = 'false'
                            img.transform(resize='800')
                            if not pipeline:
                                print('Uploading {}'.format(filename))
                                GLOBALS.s3client.upload_fileobj(BytesIO(img.make_blob()),destBucket, newpath + '/' + filename)
                            # bio=BytesIO(img.make_blob())
                            # b64blob=base64.b64encode(bio.getvalue()).decode()
                    except:
                        app.logger.info("Skipping {} because it appears to be corrupt".format(filename))
                        continue
                    finally:
                        lock.release()

                ########Blob Approach
                #The wandImage approach seems lossy, and the double resize seems dangerous
                # try:
                #     with open(temp_file.name, "rb") as f:
                #         bio = BytesIO(f.read())
                #     b64blob=base64.b64encode(bio.getvalue()).decode()
                #     batch.append(b64blob)
                # except:
                #     app.logger.info("Skipping {} because it appears to be corrupt".format(filename))
                #     continue

                #########Local Download
                batch.append(dirpath + '/' + filename)

                image = {'filename':filename, 'timestamp':timestamp, 'corrected_timestamp':timestamp, 'camera_id':camera_id, 'hash':hash, 'etag':etag}
                if live:
                    image['id'] = image_id
                images.append(image)
        
        if batch:
            if Config.DEBUGGING: print('Acquiring lock')
            GLOBALS.lock.acquire()
            print('Queueing batch')
            GLOBALS.results_queue.append((images, detection.apply_async(kwargs={'batch': batch,'sourceBucket':sourceBucket,'external':external,'model':Config.DETECTOR}, queue='celery', routing_key='celery.detection')))
            GLOBALS.lock.release()
            if Config.DEBUGGING: print('Lock released')

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    return True

@celery.task(bind=True,max_retries=5)
def importImages(self,batch,csv,pipeline,external,min_area,remove_gps,label_source=None,live=False):
    '''
    Imports all specified images from a directory path under a single camera object in the database. Ignores duplicate image hashes, and duplicate image paths (from previous imports).

        Parameters:
            csv (bool): Whether the import is coming from a csv or not - a csv can be used when pipelining training data
            pipeline (bool): Whether this is a training-data pipeline - if it is, image-detection crops are save instead of compressed images
            external (bool): Whether the data is stored in a S3 bucket or externally elsewhere
            min_area (float): The minimum size crop to be saved if pipelining training data
            batch (list): a list of image batches with the following dictionary keys:
                sourceBucket (str): Image source - base URL if external, AWS S3 bucket name otherwise
                dirpath (str): The directory path to be imported
                trapgroup_id (int): The trapgroup to which the camera belongs
                survey_id (int): The survey for which the images are being imported
                destBucket (str): The destination for the compressed images
                filenames (list): List of filenames to be processed
            remove_gps (bool): Whether to remove GPS data from the images
            label_source (str): The exif field where labels are to be extracted from
            live (bool): Whether the images were added live or not. (If true the images exist in db but have not been processed)
    '''
    
    try:
        #Prep bacthes
        GLOBALS.results_queue = []
        pool = Pool(processes=4)
        isjpeg = re.compile('(\.jpe?g$)|(_jpe?g$)', re.I)
        print('Received importImages task with {} batches.'.format(len(batch)))
        for item in batch:
            sourceBucket = item['sourceBucket']
            dirpath = item['dirpath']
            trapgroup_id = item['trapgroup_id']
            survey_id = item['survey_id']
            destBucket = item['destBucket']
            camera_id = item['camera_id']

            if csv:
                # Allows for the fetching of images according to a csv eg. for collecting Snapshot Safari data for training
                key = item['key']
                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    GLOBALS.s3client.download_file(Bucket=destBucket, Key=key, Filename=temp_file.name)
                    df = pd.read_csv(temp_file.name)
                jpegs = list(df['filename'].unique())

            else:
                jpegs = item['filenames']
            
            print("Starting import of batch for {} with {} images.".format(dirpath,len(jpegs)))
                
            for filenames in chunker(jpegs,100):
                pool.apply_async(batch_images,(camera_id,filenames,sourceBucket,dirpath,destBucket,survey_id,pipeline,external,GLOBALS.lock,remove_gps,live))

        pool.close()
        pool.join()

        # Fetch the results
        if Config.DEBUGGING: print('{} batch results to fetch'.format(len(GLOBALS.results_queue)))
        counter = 0
        GLOBALS.lock.acquire()
        with allow_join_result():
            for images, result in GLOBALS.results_queue:
                try:
                    counter += 1
                    if Config.DEBUGGING: print('Fetching result {}'.format(counter))
                    starttime = datetime.utcnow()
                    response = result.get()
                    if Config.DEBUGGING: print('Fetched result {} after {}.'.format(counter,datetime.utcnow()-starttime))

                    for img, detections in zip(images, response):
                        try:
                            if live:
                                image = db.session.query(Image).get(img['id'])
                                if image:
                                    if not image.detections:
                                        image.detections = [Detection(**detection) for detection in detections]
                                        for detection in image.detections:
                                            db.session.add(detection)
                            else:
                                image = Image(**img)
                                db.session.add(image)
                                image.detections = [Detection(**detection) for detection in detections]
                                for detection in image.detections:
                                    db.session.add(detection)
                        
                        except Exception:
                            app.logger.info(' ')
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(traceback.format_exc())
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(' ')
                            # db.session.rollback()
                    
                    # # Commit every 400 images (2 batches) to speed up result fetching
                    # if counter%2==0:
                    #     db.session.query(Survey).get(survey_id).image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().count()
                    #     db.session.commit()
                
                except Exception:
                    app.logger.info(' ')
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(traceback.format_exc())
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(' ')
                    # db.session.rollback()
                
                result.forget()
        GLOBALS.lock.release()

        #Commit the last batch & increase count
        db.session.query(Survey).get(survey_id).image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().count()
        db.session.commit()
            
        # If we are piplining some training data, we need to save the crops
        if pipeline:
            if Config.DEBUGGING: print('Pipelining data')
            if label_source:
                task = db.session.query(Task).filter(Task.survey_id==survey_id).filter(Task.name=='import').first()
                task_id = task.id
            else:
                task_id = None
            pool = Pool(processes=4)
            for item in batch:
                sourceBucket = item['sourceBucket']
                dirpath = item['dirpath']
                destBucket = item['destBucket']

                if csv:
                    key = item['key']
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                        GLOBALS.s3client.download_file(Bucket=destBucket, Key=key, Filename=temp_file.name)
                        GLOBALS.s3client.delete_object(Bucket=destBucket, Key=key)
                        df = pd.read_csv(temp_file.name)
                    jpegs = list(df['filename'].unique())

                else:
                    jpegs = item['filenames']

                images = db.session.query(Image).join(Camera).filter(Camera.path==dirpath).filter(Image.filename.in_(jpegs)).distinct().all()
                for image in images:
                    pool.apply_async(save_crops,(image.id,sourceBucket,min_area,destBucket,external,True,label_source,task_id))

            if Config.DEBUGGING: print('All jobs queued.')
            pool.close()
            pool.join()

        print('importImages job complete.')

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

# def classifier_batching(chunk,sourceBucket,classifier):
#     ''' Helper function for runClassifier that batches images and queues them for the classifier. '''

#     try:

#         if classifier=='MegaDetector':
#             detections = db.session.query(Detection)\
#                                     .join(Image)\
#                                     .filter(Image.id.in_(chunk))\
#                                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                     .filter(Detection.static==False)\
#                                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                                     .filter(Detection.left!=Detection.right)\
#                                     .filter(Detection.top!=Detection.bottom)\
#                                     .distinct().all()

#             for detection in detections:
#                 if detection.category==1:
#                     detection.classification = 'animal'
#                 elif detection.category==2:
#                     detection.classification = 'human'
#                 elif detection.category==3:
#                     detection.classification = 'vehicle'
#                 detection.class_score = detection.score
#             db.session.commit()
#             db.session.remove()

#         else:
#             batch = {'bucket': sourceBucket, 'detection_ids': [], 'detections': {}, 'images': {}}
            
#             # for image_id in chunk:
#             #     try:
#             #         detections = db.session.query(Detection)\
#             #                             .filter(Detection.image_id==int(image_id))\
#             #                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#             #                             .filter(Detection.static==False)\
#             #                             .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#             #                             .filter(Detection.left!=Detection.right)\
#             #                             .filter(Detection.top!=Detection.bottom)\
#             #                             .all()

#             #         ######################Blob approach
#             #         # with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
#             #         #     GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=os.path.join(detections[0].image.camera.path, detections[0].image.filename), Filename=temp_file.name)

#             #         #     try:
#             #         #         with open(temp_file.name, "rb") as f:
#             #         #             bio = BytesIO(f.read())
#             #         #         b64blob=base64.b64encode(bio.getvalue()).decode()
#             #         #     except:
#             #         #         continue

#             #         # batch['images'][str(image_id)] = b64blob

#             #         ######################Download on worker approach
#             #         if len(detections) > 0:
#             #             splits = detections[0].image.camera.path.split('/')
#             #             splits[0] = splits[0]+'-comp'
#             #             newpath = '/'.join(splits)
#             #             batch['images'][str(image_id)] = os.path.join(newpath, detections[0].image.filename)

#             #     except:
#             #         app.logger.info(' ')
#             #         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#             #         app.logger.info(traceback.format_exc())
#             #         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#             #         app.logger.info(' ')

#             detections = db.session.query(Detection.id,Detection.left,Detection.right,Detection.top,Detection.bottom,Image.id,Image.filename,Camera.path)\
#                                 .join(Image,Image.id==Detection.image_id)\
#                                 .join(Camera)\
#                                 .filter(Image.id.in_(chunk))\
#                                 .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
#                                 .filter(Detection.static==False)\
#                                 .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
#                                 .filter(Detection.left!=Detection.right)\
#                                 .filter(Detection.top!=Detection.bottom)\
#                                 .all()

#             db.session.remove()

#             for detection in detections:
#                 try:
#                     image_id = str(detection[5])
#                     if image_id not in batch['images'].keys():
#                         splits = detection[7].split('/')
#                         splits[0] = splits[0]+'-comp'
#                         newpath = '/'.join(splits)
#                         batch['images'][image_id] = os.path.join(newpath, detection[6])
#                     detection_id = str(detection[0])
#                     batch['detection_ids'].append(detection_id)
#                     batch['detections'][detection_id] = {'image_id': image_id, 'left': detection[1], 'right': detection[2], 'top': detection[3], 'bottom': detection[4]}
#                 except:
#                     app.logger.info(' ')
#                     app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#                     app.logger.info(traceback.format_exc())
#                     app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#                     app.logger.info(' ')

#             if len(batch['images'].keys()) >= 0:
#                 GLOBALS.lock.acquire()
#                 GLOBALS.results_queue.append(classify.apply_async(kwargs={'batch': batch}, queue=classifier, routing_key='classification.classify'))
#                 GLOBALS.lock.release()

#     except Exception:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')

#     # finally:
#     #     db.session.remove()

#     return True

@celery.task(bind=True,max_retries=5)
def runClassifier(self,lower_index,upper_index,sourceBucket,batch_size,cameragroup_ids,classifier_id):
    '''
    Run species classification on a trapgroup.

        Parameters:
            trapgroup_id (int): trapgroup to be processed
            sourceBucket (str): AWS S3 bucket where images are kept
            batch_size (int): The batch size.
    '''
    
    try:
        cam_folders = [r[0] for r in db.session.query(Camera.path).filter(Camera.cameragroup_id.in_(cameragroup_ids)).distinct().all()]
        unarchived_files = []
        for s3Folder in cam_folders:
            for dirpath, folder, filenames in s3traverse(sourceBucket,s3Folder,include_restored=True):
                unarchived_files.extend([dirpath+'/'+filename for filename in filenames])

        images = db.session.query(Image.id, Image.filename, Camera.path)\
                        .join(Detection)\
                        .join(Camera)\
                        .filter(Camera.cameragroup_id.in_(cameragroup_ids))\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .order_by(Image.id).distinct().all()

        image_batch = images[lower_index:upper_index]
        batch = [image[0] for image in image_batch if image[2]+'/'+image[1] in unarchived_files]

        classifier = db.session.query(Classifier).get(classifier_id)
        if classifier == None: return False

        if classifier.name=='MegaDetector':
            detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .filter(Image.id.in_(batch))\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .filter(Detection.left!=Detection.right)\
                                    .filter(Detection.top!=Detection.bottom)\
                                    .distinct().all()

            for detection in detections:
                if detection.category==1:
                    detection.classification = 'animal'
                elif detection.category==2:
                    detection.classification = 'human'
                elif detection.category==3:
                    detection.classification = 'vehicle'
                detection.class_score = detection.score
            db.session.commit()
            db.session.remove()

        else:
            classifier_queue = classifier.queue
            GLOBALS.results_queue = []

            detections = db.session.query(Detection.id,Detection.left,Detection.right,Detection.top,Detection.bottom,Image.id,Image.filename,Camera.path)\
                                .join(Image,Image.id==Detection.image_id)\
                                .join(Camera)\
                                .filter(Image.id.in_(batch))\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .filter(Detection.left!=Detection.right)\
                                .filter(Detection.top!=Detection.bottom)\
                                .all()

            for chunk in chunker(detections, batch_size):
                batch = {'bucket': sourceBucket, 'detection_ids': [], 'detections': {}, 'images': {}}
                for detection in chunk:
                    try:
                        image_id = str(detection[5])
                        if image_id not in batch['images'].keys():
                            batch['images'][image_id] = detection[7] + '/' + detection[6]
                        detection_id = str(detection[0])
                        batch['detection_ids'].append(detection_id)
                        batch['detections'][detection_id] = {'image_id': image_id, 'left': detection[1], 'right': detection[2], 'top': detection[3], 'bottom': detection[4]}
                    except:
                        app.logger.info(' ')
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(traceback.format_exc())
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(' ')

                if len(batch['images'].keys()) >= 0:
                    # GLOBALS.lock.acquire()
                    GLOBALS.results_queue.append(classify.apply_async(kwargs={'batch': batch}, queue=classifier_queue, routing_key='classification.classify'))
                    # GLOBALS.lock.release()

            if Config.DEBUGGING: print('{} results to fetch'.format(len(GLOBALS.results_queue)))

            counter = 0
            GLOBALS.lock.acquire()
            with allow_join_result():
                for result in GLOBALS.results_queue:
                    try:
                        counter += 1
                        if Config.DEBUGGING: print('Fetching result {}'.format(counter))
                        starttime = datetime.utcnow()
                        response = result.get()
                        if Config.DEBUGGING: print('Fetched result {} after {}.'.format(counter,datetime.utcnow()-starttime))

                        detections = db.session.query(Detection).filter(Detection.id.in_(list(response.keys()))).all()
                        for detection in detections:
                            try:
                                detection.class_score = float(response[str(detection.id)]['score'])
                                detection.classification = response[str(detection.id)]['classification']
                            except Exception:
                                app.logger.info(' ')
                                app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                app.logger.info(traceback.format_exc())
                                app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                app.logger.info(' ')
                    
                    except Exception:
                        app.logger.info(' ')
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(traceback.format_exc())
                        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        app.logger.info(' ')

                    result.forget()
            GLOBALS.lock.release()
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

def s3traverse(bucket,prefix,include_size=False,include_restored=False,include_all=False):
    """
    s3 traverse implements a traversal of a s3 bucket broadly interface compatible with os.walk. A delimiter of / is assumed
    
        Parameters:
            bucket (str): The name of the S3 bucket to be traversed
            prefix (str): The common prefix to start the traversal at.(Excluding the training /)
            include_size (bool): Whether to include the size of the objects in the traversal
            include_restored (bool): Whether to include the restored objects in the traversal
            include_all (bool): Whether to include all objects in the traversal
    
        Returns:
            See os.walk docs
    """

    prefixes,contents = list_all(bucket,prefix+'/',include_size,include_restored,include_all)
    yield prefix,prefixes,contents
    for prefix in [prefix+'/'+pf for pf in prefixes]:
        for prefix,prefixes,contents in s3traverse(bucket,prefix,include_size,include_restored,include_all):
            yield prefix, prefixes, contents

def delete_duplicate_videos(videos,skip):
    '''
    Helper function for remove_duplicate_videos that deletes the specified video objects and their detections from the database.
    Skip is a boolean that indicates whether the frame deletion will be skipped.
    '''

    # Delete the new imports rather than the old ones
    candidateVideos = db.session.query(Video).join(Camera).outerjoin(Image).filter(or_(~Image.clusters.any(),Image.id==None)).filter(Video.id.in_(videos)).order_by(Video.id).distinct().all()
    
    if len(candidateVideos) == len(videos):
        # all are unclustered/unimported - delete all but one
        candidateVideos = candidateVideos[1:]

    elif len(candidateVideos) < (len(videos)-1):
        # some are clustered/imported
        importedVideos = db.session.query(Video).join(Camera).outerjoin(Image).filter(or_(Image.clusters.any(),Image.id!=None)).filter(Video.id.in_(videos)).order_by(Video.id).distinct().all()
        candidateVideos.extend(importedVideos[1:])

    for video in candidateVideos:
        if not skip:
            # delete frames
            s3 = boto3.resource('s3')
            bucketObject = s3.Bucket(Config.BUCKET)
            bucketObject.objects.filter(Prefix=video.camera.path).delete()

            # Delete comp video
            splits = video.camera.path.split('/_video_images_/')
            video_name = splits[-1].split('.')[0]
            path_splits = splits[0].split('/')
            path_splits[0] = path_splits[0]+'-comp'
            video_key = '/'.join(path_splits) + '/' +  video_name + '.mp4'
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET,Key=video_key)

        # delete from db (frames shoudln't be imported yet, but just in case)
        for image in video.camera.images:
            for detection in image.detections:

                for labelgroup in detection.labelgroups:
                    labelgroup.labels = []
                    labelgroup.tags = []
                    db.session.delete(labelgroup)
                
                detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.detection_1==detection.id,DetSimilarity.detection_2==detection.id)).all()
                for detSimilarity in detSimilarities:
                    db.session.delete(detSimilarity)
                
                detection.individuals = []
                db.session.delete(detection)
            
            image.clusters = []
            db.session.delete(image)

        db.session.delete(video.camera)
        db.session.delete(video)
    
    return True


def delete_duplicate_images(images):
    '''Helper function for remove_duplicate_images that deletes the specified image objects and their detections from the database.'''

    # If adding images - delete the new imports rather than the old ones
    candidateImages = db.session.query(Image).filter(~Image.clusters.any()).filter(Image.id.in_([r.id for r in images])).order_by(Image.id).distinct().all()
    
    if len(candidateImages) == len(images):
        # all are unclustered - delete all but one
        candidateImages = candidateImages[1:]

    elif len(candidateImages) < (len(images)-1):
        # some are clustered
        clusteredImages = db.session.query(Image).filter(Image.clusters.any()).filter(Image.id.in_([r.id for r in images])).order_by(Image.id).distinct().all()
        candidateImages.extend(clusteredImages[1:])
    
    for image in candidateImages:
        for detection in image.detections:

            for labelgroup in detection.labelgroups:
                labelgroup.labels = []
                labelgroup.tags = []
                db.session.delete(labelgroup)
            
            detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.detection_1==detection.id,DetSimilarity.detection_2==detection.id)).all()
            for detSimilarity in detSimilarities:
                db.session.delete(detSimilarity)
            
            detection.individuals = []
            db.session.delete(detection)
        
        image.clusters = []
        db.session.delete(image)
    
    db.session.commit()
    
    return True

def remove_duplicate_videos(survey_id):
    '''Removes all duplicate videos by hash in the database. Required after import was parallelised.'''

    # First delete duplicate videos with duplicate paths. This shouldn't happen unless there is a simultaneous import
    # But if it does happen we want to catch it. In such cases, we don't want to delete the associated frames.
    # Moreover, this must happen first because otherwise these duplicates will be removed in the following routine, 
    # and the frames will be removed.
    sq = db.session.query(Camera.path.label('path'),func.count(distinct(Camera.id)).label('count'))\
                        .join(Video)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .group_by(Camera.path)\
                        .subquery()
                        
    duplicates = db.session.query(Camera.path)\
                        .join(Video)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .join(sq,sq.c.path==Camera.path)\
                        .filter(sq.c.count>1)\
                        .all()

    for path in duplicates:
        videos = [r[0] for r in db.session.query(Video.id)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(Camera.path==path[0])\
                    .all()]
        delete_duplicate_videos(videos,True)

    # Next, remove according to hashes and remove the frames at the same time so that they aren't imported in the image import routine
    sq = db.session.query(Video.hash.label('hash'),func.count(distinct(Video.id)).label('count'))\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .group_by(Video.hash)\
                    .subquery()

    duplicates = db.session.query(Video.hash)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .join(sq,sq.c.hash==Video.hash)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(sq.c.count>1)\
                    .filter(Video.hash!=None)\
                    .distinct().all()

    for hash in duplicates:
        videos = [r[0] for r in db.session.query(Video.id)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(Video.hash==hash[0])\
                    .all()]
        delete_duplicate_videos(videos,False)

    db.session.commit()
    db.session.remove()
    return True

def remove_duplicate_images(survey_id):
    '''Removes all duplicate images by hash in the survey. Required after import was parallelised.'''
    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Removing Duplicate Images'
    db.session.commit()

    sq = db.session.query(Image.hash.label('hash'),func.count(distinct(Image.id)).label('count'))\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .group_by(Image.hash)\
                    .subquery()
            
    duplicates = db.session.query(Image.hash).join(sq,sq.c.hash==Image.hash).filter(sq.c.count>1).filter(Image.hash!=None).distinct().all()

    for hash in duplicates:
        images = db.session.query(Image)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(Image.hash==hash[0])\
                    .distinct().all()
        delete_duplicate_images(images)

    # delete any empty clusters
    clusters = db.session.query(Cluster).join(Task).filter(Task.survey_id==survey_id).filter(~Cluster.images.any()).all()
    for cluster in clusters:
        cluster.labels = []
        cluster.tags = []
        cluster.required_images = []
        db.session.delete(cluster)

    #delete any empty cameras
    cameras = db.session.query(Camera).join(Trapgroup).filter(~Camera.images.any()).filter(Trapgroup.survey_id==survey_id).all()
    for camera in cameras:
        db.session.delete(camera)
    # db.session.commit()

    #delete any empty trapgroups
    trapgroups = db.session.query(Trapgroup).filter(~Trapgroup.cameras.any()).filter(Trapgroup.survey_id==survey_id).all()
    for trapgroup in trapgroups:
        trapgroup.sitegroups = []
        db.session.delete(trapgroup)
    # db.session.commit()

    db.session.commit()
    db.session.remove()
    
    return True

def import_folder(s3Folder, survey_id, sourceBucket,destinationBucket,pipeline,min_area,exclusions,processes=4,label_source=None):
    '''
    Import all images from an AWS S3 folder. Handles re-import of a folder cleanly.

        Parameters:
            s3Folder (str): folder name to import
            survey_id (int): The ID of the survey to be processed
            sourceBucket (str): Bucket from which import takes place
            destinationBucket (str): Bucket where compressed images are stored
            pipeline (bool): Whether import is to pipeline training data (only crops will be saved)
            min_area (float): The minimum area detection to crop if pipelining
            exclusions (list): A list of folders to exclude
            processes (int): Optional number of threads used for the import
            label_source (str): Exif field where labels should be extracted from
    '''
    
    isVideo = re.compile('(\.avi$)|(\.mp4$)|(\.mov$)', re.I)
    isjpeg = re.compile('(\.jpe?g$)|(_jpe?g$)', re.I)
    
    localsession=db.session()
    survey = localsession.query(Survey).get(survey_id)
    # survey = Survey.get_or_create(localsession,name=name,organisation_id=organisation_id,trapgroup_code=tag)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True

    localsession.commit()
    sid=survey.id
    tag = survey.trapgroup_code
    tag = re.compile(tag)

    # Handle videos first so that their frames can be imported like normal images
    results = []
    for dirpath, folders, filenames in s3traverse(sourceBucket, s3Folder):
        videos = list(filter(isVideo.search, filenames))
        jpegs = list(filter(isjpeg.search, filenames))
        if (len(jpegs) or len(videos)) and not any(exclusion in dirpath for exclusion in exclusions):
            if '/_video_images_/' in dirpath:
                tags = tag.search(dirpath.replace(survey.name+'/','').split('/_video_images_/')[0])
            else:
                tags = tag.search(dirpath.replace(survey.name+'/',''))
            if tags:
                camera_name = extract_camera_name(survey.camera_code,survey.trapgroup_code,survey.name,tags.group(),dirpath)
                if camera_name:
                    trapgroup = Trapgroup.get_or_create(localsession, tags.group(), sid)
                    survey.images_processing += len(jpegs)
                    localsession.commit()

                    already_processed = [r[0] for r in localsession.query(Video.filename)\
                                                .join(Camera)\
                                                .filter(Camera.trapgroup_id==trapgroup.id)\
                                                .filter(Camera.path.contains(dirpath+'/_video_images_/'))\
                                                .all()]

                    to_process = [video for video in videos if video not in already_processed]

                    for batch in chunker(to_process,500):
                        results.append(process_video_batch.apply_async(kwargs={'dirpath':dirpath,'batch':batch,'bucket':sourceBucket, 'trapgroup_id': trapgroup.id},queue='parallel'))
                        app.logger.info('Processing video batch: '.format(len(batch)))

    # survey.processing_initialised = False
    # localsession.commit()
    localsession.close()

    app.logger.info('Waiting for video processing to complete')
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
    app.logger.info('Video processing complete')

    #check for any duplicates
    if not pipeline: remove_duplicate_videos(sid)

    # Now handle images
    localsession=db.session()
    survey = db.session.query(Survey).get(sid)
    results = []
    batch_count = 0
    batch = []
    # chunk_size = round(Config.QUEUES['parallel']['rate']/4)
    chunk_size = round(10000/4)
    remove_gps = False
    any_gps = False
    for dirpath, folders, filenames in s3traverse(sourceBucket, s3Folder):
        jpegs = list(filter(isjpeg.search, filenames))
        
        if len(jpegs) and not any(exclusion in dirpath for exclusion in exclusions):
            if '/_video_images_/' in dirpath:
                tags = tag.search(dirpath.replace(survey.name+'/','').split('/_video_images_/')[0])
            else:
                tags = tag.search(dirpath.replace(survey.name+'/',''))
            
            if tags:
                camera_name = extract_camera_name(survey.camera_code,survey.trapgroup_code,survey.name,tags.group(),dirpath)
                
                if camera_name:
                    trapgroup = Trapgroup.get_or_create(localsession, tags.group(), sid)
                    # survey.images_processing += len(jpegs)
                    # localsession.commit()
                    camera = Camera.get_or_create(localsession, trapgroup.id, dirpath)

                    # Check if GPS data is available
                    gps_file = jpegs[0]
                    gps_key = os.path.join(dirpath,gps_file)
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                        try:
                            GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=gps_key, Filename=temp_file.name)
                            exif_data = piexif.load(temp_file.name)
                            if exif_data['GPS']:
                                any_gps = True
                                remove_gps = True
                                if trapgroup.latitude == 0 and trapgroup.longitude == 0 and trapgroup.altitude == 0:
                                    # Try and extract latitude and longitude and altitude
                                    try:
                                        gps_keys = exif_data['GPS'].keys()

                                        if piexif.GPSIFD.GPSLatitude in gps_keys:
                                            lat = exif_data['GPS'][piexif.GPSIFD.GPSLatitude]
                                            trapgroup.latitude = lat[0][0]/lat[0][1] + lat[1][0]/lat[1][1]/60 + lat[2][0]/lat[2][1]/3600
                                            if piexif.GPSIFD.GPSLatitudeRef in gps_keys:
                                                lat_ref = exif_data['GPS'][piexif.GPSIFD.GPSLatitudeRef]
                                                if lat_ref == b'S': trapgroup.latitude = -trapgroup.latitude

                                        if piexif.GPSIFD.GPSLongitude in gps_keys:
                                            lon = exif_data['GPS'][piexif.GPSIFD.GPSLongitude]
                                            trapgroup.longitude = lon[0][0]/lon[0][1] + lon[1][0]/lon[1][1]/60 + lon[2][0]/lon[2][1]/3600
                                            if piexif.GPSIFD.GPSLongitudeRef in gps_keys:
                                                lon_ref = exif_data['GPS'][piexif.GPSIFD.GPSLongitudeRef]
                                                if lon_ref == b'W': trapgroup.longitude = -trapgroup.longitude
        
                                        if piexif.GPSIFD.GPSAltitude in gps_keys:
                                            alt = exif_data['GPS'][piexif.GPSIFD.GPSAltitude]
                                            trapgroup.altitude = alt[0]/alt[1]
                                            if piexif.GPSIFD.GPSAltitudeRef in gps_keys:
                                                alt_ref = exif_data['GPS'][piexif.GPSIFD.GPSAltitudeRef]
                                                if alt_ref == 1: trapgroup.altitude = -trapgroup.altitude

                                        if Config.DEBUGGING: app.logger.info('Extracted GPS data from {}'.format(gps_key))	    
                                    except:
                                        pass
                            else:
                                remove_gps = False
                        except:
                            pass

                    localsession.commit()
                    tid=trapgroup.id

                    already_processed = [r[0] for r in localsession.query(Image.filename)\
                                                .filter(Image.camera==camera)\
                                                .all()]

                    to_process = [filename for filename in jpegs if filename not in already_processed]

                    #Break folders down into chunks to prevent overly-large folders causing issues
                    for chunk in chunker(to_process,chunk_size):
                        batch.append({'sourceBucket':sourceBucket,
                                        'dirpath':dirpath,
                                        'filenames': chunk,
                                        'trapgroup_id':tid,
                                        'camera_id': camera.id,
                                        'survey_id':sid,
                                        'destBucket':destinationBucket})

                        batch_count += len(chunk)

                        # if (batch_count / (((Config.QUEUES['parallel']['rate'])*random.uniform(0.5, 1.5))/2) ) >= 1:
                        if (batch_count / (((10000)*random.uniform(0.5, 1.5))/2) ) >= 1:
                            results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':pipeline,'external':False,'min_area':min_area,'remove_gps':remove_gps,'label_source':label_source},queue='parallel'))
                            app.logger.info('Queued batch with {} images'.format(batch_count))
                            batch_count = 0
                            batch = []

            else:
                app.logger.info('{}: failed to import path {}. No tag found.'.format(survey_id,dirpath))

    if batch_count!=0:
        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':pipeline,'external':False,'min_area':min_area, 'remove_gps':any_gps,'label_source':label_source},queue='parallel'))

    survey.processing_initialised = False
    localsession.commit()
    localsession.close()
    
    #Wait for import to complete
    # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
    # See https://github.com/celery/celery/issues/4480
    app.logger.info('Waiting for image processing to complete')
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
    app.logger.info('Image processing complete')

    # Remove any duplicate images that made their way into the database due to the parallel import process.
    if not pipeline: remove_duplicate_images(sid)

# def pipeline_csv(df,surveyName,tgcode,source,external,min_area,destBucket,exclusions,label_source):
#     '''
#     Imports a survey of images for classifier training purposes. Saves only the detection crops.

#         Parameters:
#             df (dataframe): The Pandas dataframe being imported
#             surveyName (str): The name for the survey
#             tgcode (str): The regular expression trapgroup code
#             source (str): The base URL where the images are to be sourced from if external is true, a regular S3 bucket name if otherwise
#             external (bool): Whether the images are sourced from a site external to S3
#             min_area (float): The minimum detection size to be cropped 
#             destBucket (str): The bucket where the crops must be saved
#             exclusions (list): List of folders to exclude from the import
#             label_source (str): The exif field wfrom which labels should be extracted
#     '''

#     # Create survey
#     localsession=db.session()
#     admin = localsession.query(User).filter(User.username=='Admin').first()
#     survey = Survey.get_or_create(localsession,name=surveyName,user_id=admin.id,trapgroup_code=tgcode)
#     survey.status = 'Importing'
#     survey.images_processing = 0
#     survey.processing_initialised = True
#     localsession.commit()
#     survey_id=survey.id
#     tgcode = re.compile(tgcode)

#     results = []
#     batch_count = 0
#     batch = []
#     chunk_size = round(Config.QUEUES['parallel']['rate']/8)
#     for dirpath in df['dirpath'].unique():
#         tags = tgcode.findall(dirpath.replace(survey.name+'/',''))

#         if len(tags) and not any(exclusion in dirpath for exclusion in exclusions):
#             tag = tags[0]

#             current_df = df.loc[df['dirpath'] == dirpath]
#             current_df.reset_index(drop=True,inplace=True)
#             number_of_images = len(current_df)
            
#             trapgroup = Trapgroup.get_or_create(localsession, tag, survey_id)
#             survey.images_processing += number_of_images
#             localsession.commit()
#             camera = Camera.get_or_create(localsession, trapgroup.id, dirpath)
#             localsession.commit()
#             trapgroup_id=trapgroup.id
#             camera_id=camera.id

#             #Break folders down into chunks to prevent overly-large folders causing issues
#             number_of_chunks = math.ceil(number_of_images/chunk_size)
#             for n in range(number_of_chunks):
#                 lower_index = n*chunk_size
#                 upper_index = ((n+1)*chunk_size)-1
#                 chunked_df = current_df.loc[lower_index:upper_index]

#                 # key = 'pipelineCSVs/' + surveyName + '_' + dirpath.replace('/','_') + '_' + str(lower_index) + '_' + str(upper_index) + '.csv'
#                 key = 'pipelineCSVs/' + surveyName + '_' + randomString(20) + '_' + str(lower_index) + '_' + str(upper_index) + '.csv'
#                 with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
#                     chunked_df.to_csv(temp_file.name,index=False)
#                     GLOBALS.s3client.put_object(Bucket=destBucket,Key=key,Body=temp_file)

#                 batch.append({'sourceBucket':source,
#                                 'dirpath':dirpath,
#                                 # 'jpegs':chunk,
#                                 'key': key,
#                                 'lower_index': n*chunk_size,
#                                 'upper_index': (n+1)*chunk_size,
#                                 'trapgroup_id':trapgroup_id,
#                                 'camera_id':camera_id,
#                                 'survey_id':survey_id,
#                                 'destBucket':destBucket})

#                 if n < number_of_chunks-1:
#                     batch_count += chunk_size
#                 else:
#                     batch_count += number_of_images - (n*chunk_size)

#                 if (batch_count / (((Config.QUEUES['parallel']['rate'])*random.uniform(0.5, 1.5))/4) ) >= 1:
#                     results.append(importImages.apply_async(kwargs={'batch':batch,'csv':True,'pipeline':True,'external':external,'min_area':min_area,'label_source':label_source},queue='parallel'))
#                     app.logger.info('Queued batch with {} images'.format(batch_count))
#                     batch_count = 0
#                     batch = []

#     if batch_count!=0:
#         results.append(importImages.apply_async(kwargs={'batch':batch,'csv':True,'pipeline':True,'external':external,'min_area':min_area,'label_source':label_source},queue='parallel'))

#     survey.processing_initialised = False
#     localsession.commit()
#     localsession.close()
    
#     #Wait for import to complete
#     # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
#     # See https://github.com/celery/celery/issues/4480
#     GLOBALS.lock.acquire()
#     with allow_join_result():
#         for result in results:
#             try:
#                 result.get()
#             except Exception:
#                 app.logger.info(' ')
#                 app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#                 app.logger.info(traceback.format_exc())
#                 app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#                 app.logger.info(' ')
#             result.forget()
#     GLOBALS.lock.release()

#     # Remove any duplicate images that made their way into the database due to the parallel import process.
#     remove_duplicate_images(survey_id)

def pipeline_csv(df,survey_id,tag,exclusions,source,destBucket,min_area,external,label_source):
    isjpeg = re.compile('(\.jpe?g$)|(_jpe?g$)', re.I)
    
    localsession=db.session()
    survey = localsession.query(Survey).get(survey_id)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True
    localsession.commit()
    tag = re.compile(tag)

    # Now handle images
    results = []
    batch_count = 0
    batch = []
    # chunk_size = round(Config.QUEUES['parallel']['rate']/4)
    chunk_size = round(10000/4)
    # for dirpath, folders, filenames in s3traverse(sourceBucket, s3Folder):
    for dirpath in df['dirpath'].unique():
        filenames = df[df['dirpath']==dirpath]['filename'].unique()
        jpegs = list(filter(isjpeg.search, filenames))
        
        if len(jpegs) and not any(exclusion in dirpath for exclusion in exclusions):
            tags = tag.search(dirpath.replace(survey.name+'/',''))
            
            if tags:
                trapgroup = Trapgroup.get_or_create(localsession, tags.group(), survey_id)
                survey.images_processing += len(jpegs)
                localsession.commit()
                camera = Camera.get_or_create(localsession, trapgroup.id, dirpath)
                localsession.commit()
                trapgroup_id=trapgroup.id

                #Break folders down into chunks to prevent overly-large folders causing issues
                for chunk in chunker(jpegs,chunk_size):
                    batch.append({'sourceBucket':source,
                                    'dirpath':dirpath,
                                    'filenames': chunk,
                                    'trapgroup_id':trapgroup_id,
                                    'camera_id': camera.id,
                                    'survey_id':survey_id,
                                    'destBucket':destBucket})

                    batch_count += len(chunk)

                    # if (batch_count / (((Config.QUEUES['parallel']['rate'])*random.uniform(0.5, 1.5))/2) ) >= 1:
                    if (batch_count / (((10000)*random.uniform(0.5, 1.5))/2) ) >= 1:
                        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':True,'external':external,'min_area':min_area,'remove_gps':False,'label_source':label_source},queue='parallel'))
                        app.logger.info('Queued batch with {} images'.format(batch_count))
                        batch_count = 0
                        batch = []

            else:
                app.logger.info('{}: failed to import path {}. No tag found.'.format(name,dirpath))

    if batch_count!=0:
        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':True,'external':external,'min_area':min_area,'remove_gps':False,'label_source':label_source},queue='parallel'))

    survey.processing_initialised = False
    localsession.commit()
    localsession.close()
    
    #Wait for import to complete
    # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
    # See https://github.com/celery/celery/issues/4480
    app.logger.info('Waiting for image processing to complete')
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
    app.logger.info('Image processing complete')

    # Remove any duplicate images that made their way into the database due to the parallel import process.
    remove_duplicate_images(survey_id)

def classifyCluster(cluster):
    '''
    Returns the species contained in a single cluster.

        Parameters:
            cluster (Cluster): Cluster object to be classified

        Returns:
            clusterClass (str): The species contained in the cluster
    '''
    
    try:
        classifier_id = db.session.query(Classifier.id).join(Survey).join(Task).filter(Task.id==cluster.task_id).first()[0]
        classification, count = db.session.query(Label.description,func.count(distinct(Detection.id)))\
                                .join(Translation)\
                                .join(Detection,Detection.classification==Translation.classification)\
                                .join(Image)\
                                .join(ClassificationLabel,ClassificationLabel.classification==Detection.classification) \
                                .filter(ClassificationLabel.classifier_id==classifier_id) \
                                .filter(Detection.class_score>ClassificationLabel.threshold) \
                                .filter(Translation.task==cluster.task)\
                                .filter(Image.clusters.contains(cluster))\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
                                .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
                                .group_by(Label.id)\
                                .order_by(func.count(distinct(Detection.id)).desc())\
                                .first()

        # classification, count = db.session.query(Label.description,func.count(distinct(Detection.id)))\
        #                         .join(Translation)\
        #                         .join(Detection,Detection.classification==Translation.classification)\
        #                         .join(Image)\
        #                         .join(Camera)\
        #                         .join(Trapgroup)\
        #                         .join(Survey)\
        #                         .join(Classifier)\
        #                         .filter(Translation.task==cluster.task)\
        #                         .filter(Image.clusters.contains(cluster))\
        #                         .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
        #                         .filter(Detection.static == False) \
        #                         .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
        #                         .filter(((Detection.right-Detection.left)*(Detection.bottom-Detection.top)) > Config.DET_AREA)\
        #                         .filter(Detection.class_score>Classifier.threshold) \
        #                         .group_by(Label.id)\
        #                         .order_by(func.count(distinct(Detection.id)).desc())\
        #                         .first()
    
        if count > 0:
            return classification
    
    except:
        pass
    
    return 'nothing'

@celery.task(bind=True,max_retries=5)
def classifyTrapgroup(self,task_id,trapgroup_id):
    '''
    Classifies the species contained in each cluster in a trapgroup for a given task.

        Parameters:
            task_id (int): Task to be processed
            trapgroup_id (int): Trapgroup to be processed
    '''

    try:
        clusters = db.session.query(Cluster).join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Cluster.task_id==task_id).distinct().all()
        # for chunk in chunker(clusters,500):
        for cluster in clusters:
            cluster.classification = classifyCluster(cluster)
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

# def updateDetectionRatings(images):
#     '''Helper function for updateTrapgroupDetectionRatings that allows that function to update the detection ratings of images in parallel.'''

#     try:
#         images = db.session.query(Image).filter(Image.id.in_(images)).distinct().all()
#         for image in images:
#             image.detection_rating = detection_rating(image)
#         db.session.commit()
    
#     except Exception:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')

#     finally:
#         db.session.remove()
    
#     return True

@celery.task(bind=True,max_retries=5)
def updateTrapgroupDetectionRatings(self,trapgroup_id):
    '''Updates detection ratings for all images in a trapgroup.'''
    try:

        images = db.session.query(Image)\
                        .join(Camera)\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .all()

        for image in images:
            image.detection_rating = detection_rating(image)
            
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

def updateSurveyDetectionRatings(survey_id):
    '''
    Updates detection ratings for all images in a survey.

        Parameters:
            survey_id (int): Survey to process
            processes (int): Optional number of threads to use. Defaults to 4.
    '''
    
    results = []
    for trapgroup_id in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).distinct().all():
        results.append(updateTrapgroupDetectionRatings.apply_async(kwargs={'trapgroup_id':trapgroup_id[0]},queue='parallel'))
    
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

    return True

def classifySurvey(survey_id,sourceBucket,classifier_id=None,batch_size=200,processes=4):
    '''
    Runs the classifier on the survey, and then updates cluster classifications.

        Parameters:
            survey_id (int): Survey to process
            sourceBucket (str): AWS S3 Bucket where images are located
            batch_size (int): Optional batch size to use for species classifier. Default is 200.
            classifier_id (int): The classifier to use
            processes (int): Optional number of threads to use. Default is 4.
    '''

    results = []
    survey = db.session.query(Survey).get(survey_id)

    if classifier_id == None: classifier_id = survey.classifier_id

    # survey.images_processing = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
    survey.classifier_id = classifier_id
    survey.processing_initialised = True
    db.session.commit()

    cameragroups = db.session.query(Cameragroup.id, func.count(distinct(Image.id)))\
                            .join(Camera, Camera.cameragroup_id==Cameragroup.id)\
                            .join(Trapgroup)\
                            .join(Image, Image.camera_id==Camera.id)\
                            .join(Detection)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .group_by(Cameragroup.id)\
                            .all()

    # chunk_size = round(Config.QUEUES['parallel']['rate']/4)
    chunk_size = round(10000/4)
    current_size = 0
    cameragroup_ids = []
    for item in cameragroups:
        if item[1] >= chunk_size:
            number_of_chunks = math.ceil(item[1]/chunk_size)
            for n in range(number_of_chunks):
                results.append(runClassifier.apply_async(kwargs={'lower_index':n*chunk_size,'upper_index':(n+1)*chunk_size,'sourceBucket':sourceBucket,'batch_size':batch_size,'cameragroup_ids':[item[0]],'classifier_id':classifier_id},queue='parallel'))
        else:
            if current_size + item[1] > chunk_size:
                results.append(runClassifier.apply_async(kwargs={'lower_index':0,'upper_index':chunk_size,'sourceBucket':sourceBucket,'batch_size':batch_size,'cameragroup_ids':cameragroup_ids,'classifier_id':classifier_id},queue='parallel'))
                cameragroup_ids = []
                current_size = 0
            cameragroup_ids.append(item[0])
            current_size += item[1]

    if len(cameragroup_ids) > 0:
        results.append(runClassifier.apply_async(kwargs={'lower_index':0,'upper_index':chunk_size,'sourceBucket':sourceBucket,'batch_size':batch_size,'cameragroup_ids':cameragroup_ids,'classifier_id':classifier_id},queue='parallel'))

    survey.processing_initialised = False
    db.session.commit()
    db.session.remove()

    # Wait for processing to finish
    # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
    # See https://github.com/celery/celery/issues/4480
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

    detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
                            .filter(or_(Detection.left==Detection.right,Detection.top==Detection.bottom))\
                            .all()

    # for chunk in chunker(detections,1000):
    for detection in detections:
        detection.classification = 'nothing'
    db.session.commit()

    #Update cluster classifications
    results = []
    survey = db.session.query(Survey).get(survey_id)
    for task in survey.tasks:
        for trapgroup in survey.trapgroups:
            results.append(classifyTrapgroup.apply_async(kwargs={'task_id':task.id,'trapgroup_id':trapgroup.id},queue='parallel'))

    # Wait for processing to finish
    # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
    # See https://github.com/celery/celery/issues/4480
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

    # survey = db.session.query(Survey).get(survey_id)
    # classifier = db.session.query(Classifier).filter(Classifier.name==classifier).first()
    # survey.classifier = classifier
    # db.session.commit()

    #Also update the number of clusters requiring a classification check
    survey = db.session.query(Survey).get(survey_id)
    for task in survey.tasks:
        count = db.session.query(Cluster).filter(Cluster.task_id==task.id)
        count = taggingLevelSQ(count,'-3',False,task.id)
        task.class_check_count = count.distinct().count()
    task.ai_check_complete = False
    db.session.commit()
    db.session.remove()

    return True

def findValue(dictionary,minMax):
    '''
    Helper function for correct_timestamps. Finds min/max start/end dates from a dictionary of date occurances.

        Parameters:
            dictionary (dict): Dates and their occurance counts
            minMax (str): Selects whether to return a minimum or a maximum

        Reurns:
            Min/max value
    '''
    
    possibleValues = []
    maxCount = max(dictionary.items(), key=operator.itemgetter(1))[1]
    count = max(dictionary.items(), key=operator.itemgetter(1))[1]
    while (count/maxCount) > 0.8:
        value = max(dictionary.items(), key=operator.itemgetter(1))[0]
        possibleValues.append(value)
        dictionary.pop(value)
        if len(dictionary.keys()) != 0:
            count = max(dictionary.items(), key=operator.itemgetter(1))[1]
        else:
            count = -99
    if minMax=='min':
        output = min(possibleValues)
    else:
        output = max(possibleValues)
    return output

def reject_outliers(data, m = 2.):
    '''Helper function for correct_timestamps. Removes outliers from an input np.array.'''

    d = np.abs(data - np.median(data))
    mdev = np.median(d)
    s = d/mdev if mdev else 0.
    return data[s<m]

def adjustTimestamps(trapgroup_id,data):
    '''
    Helper function for correct_timestamps. Adjusts all image timestamps from a trapgroup based on the supplied camer-by-camera adjustment data.

        Parameters:
            trapgroup_id (int): Trapgroup to adjust
            data (dict): Timestamp adjustments on a per-camera basis
    '''

    trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
    for camera in trapgroup.cameras:
        if camera.id in data.keys():
            adjustment = data[camera.id]
            images = db.session.query(Image).filter(Image.camera_id==camera.id).filter(Image.timestamp!=None).all()
            # for chunk in chunker(images,500):
            for image in images:
                image.corrected_timestamp += adjustment
            db.session.commit()

def resetTimestamps(trapgroup_id,data):
    '''
    Helper function for correct_timestamps. Does the opposite of adjustTimestamps by removing the supplied timestamp adjustments from all cameras in a trapgroup.

        Parameters:
            trapgroup_id (int): Trapgroup to adjust
            data (dict): Timestamp adjustments on a per-camera basis
    '''

    trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
    for camera in trapgroup.cameras:
        if camera.id in data.keys():
            adjustment = data[camera.id]
            images = db.session.query(Image).filter(Image.camera_id==camera.id).filter(Image.timestamp!=None).all()
            for image in images:
                image.corrected_timestamp -= adjustment
    db.session.commit()

def incrementCombination(combination,n,delta,max):
    '''Helper function for correct_timestamps. Helps build timestamp-shift array based in the time delta and max delta supplied. '''

    combination[n] += delta
    status = True
    if combination[n] > max:
        combination[n] = 0
        if (n+1) != (len(combination)-1):
            combination, status = incrementCombination(combination,n+1,delta,max)
        else:
            return combination, False
    return combination, status

def calculateCameraOverlapScore(task_id,cameras):
    '''
    Helper function for correct_timestamps. Returns an overlap score that indicates how well the species-sightings line up between a list of cameras.

        Parameters:
            task_id (int): Reference task to use
            cameras (list): List of cameras being tested

        Returns:
            score (int): Score indicating overlap
    '''
    
    score = 0
    downLabel =  db.session.query(Label).get(GLOBALS.knocked_id)
    clusters = db.session.query(Cluster).join(Image,Cluster.images).join(Camera).filter(Camera.id.in_(cameras)).filter(Cluster.task_id==task_id).filter(~Cluster.labels.contains(downLabel)).all()
    # print('debug: {}'.format(db.session.query(Cluster).filter(Cluster.task_id==task_id).filter(~Cluster.images.any()).count()))
    for cluster in clusters:
        start = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).first()
        finish = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(desc(Image.corrected_timestamp)).first()
        overlaps = db.session.query(Cluster)\
                            .join(Image,Cluster.images)\
                            .join(Camera)\
                            .filter(Camera.id.in_(cameras))\
                            .filter(Camera.id!=cluster.images[0].camera_id)\
                            .filter(Cluster.task_id==task_id)\
                            .filter(Image.corrected_timestamp>=(start.corrected_timestamp-timedelta(minutes=1)))\
                            .filter(Image.corrected_timestamp<=(finish.corrected_timestamp+timedelta(minutes=1)))\
                            .filter(~Cluster.labels.contains(downLabel))\
                            .distinct().all()
        for overlap in overlaps:
            if overlap.classification==cluster.classification:
                score += 1
            else:
                score -= 1
    return score

def get_groups(trapgroup):
    '''Returns grouped cameras for a requested trapgroup, where in theory each group should be a group of folders relating to a single actual camera.'''

    groups = {}
    for camera in trapgroup.cameras:
        folder = None
        split = re.split(trapgroup.survey.trapgroup_code,camera.path)
        if len(split) > 1:
            folder = trapgroup.tag+re.split('/',split[-1])[0]
            if folder not in groups.keys():
                groups[folder] = [camera.id]
            else:
                groups[folder].append(camera.id)
    return groups

def create_reference_task(survey_id):
    '''
    Helper function for correct_timestamps. Creates a reference task for timestamp-adjustment purposes where each camera is clustered on its own.

        Parameters:
            survey_id (int): Requested survey

        Returns:
            task_id (int): ID of created reference task
    '''
    
    task = Task(name='reference', survey_id=survey_id, tagging_level='-1', test_size=0)
    db.session.add(task)
    db.session.commit()
    task_id = task.id
    survey = task.survey
    for trapgroup in survey.trapgroups:
        for camera in trapgroup.cameras:
            images = db.session.query(Image).filter(Image.camera == camera).order_by(Image.corrected_timestamp).all()
            prev = None
            if images != []:
                for image in images:
                    timestamp = image.corrected_timestamp
                    if not (prev) or ((timestamp - prev).total_seconds() > 60):
                        if prev is not None:
                            cluster.images=imList
                        cluster = Cluster(task_id=task.id)
                        db.session.add(cluster)
                        imList = []
                    prev = timestamp
                    imList.append(image)
                cluster.images = imList
    db.session.commit()

    for trapgroup in survey.trapgroups:
        for camera in trapgroup.cameras:
            detections = db.session.query(Detection).join(Image).filter(Image.camera_id==camera.id).all()
            for detection in detections:
                labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                db.session.add(labelgroup)
            db.session.commit()

    pool = Pool(processes=4)
    for trapgroup in survey.trapgroups:
        pool.apply_async(classifyTrapgroup,(task_id,trapgroup.id))
    pool.close()
    pool.join()

    return task_id

def digest_clusters(orderedClusters,limit=3600):
    '''Helper function for correct_timestamps. Digests clusters into a list format where each pair of clusters is represented by a dictionary of characteristics 
    including the time difference between their midpoints, their respective lengths, and classified species.'''

    digestedClusters = []
    orderedClusters2 = orderedClusters.copy()

    for cluster1 in orderedClusters:
        first1 = db.session.query(Image).filter(Image.clusters.contains(cluster1)).order_by(Image.corrected_timestamp).first()
        last1 = db.session.query(Image).filter(Image.clusters.contains(cluster1)).order_by(desc(Image.corrected_timestamp)).first()
        midpoint1 = ((last1.corrected_timestamp-first1.corrected_timestamp)/2) + first1.corrected_timestamp
        orderedClusters2.remove(cluster1)

        for cluster2 in orderedClusters2:
            first2 = db.session.query(Image).filter(Image.clusters.contains(cluster2)).order_by(Image.corrected_timestamp).first()
            last2 = db.session.query(Image).filter(Image.clusters.contains(cluster2)).order_by(desc(Image.corrected_timestamp)).first()
            midpoint2 = ((last2.corrected_timestamp-first2.corrected_timestamp)/2) + first2.corrected_timestamp
            delta = (midpoint2-midpoint1).total_seconds()

            if delta > limit:
                data = {'delta': delta,
                        'length1': (last1.corrected_timestamp-first1.corrected_timestamp).total_seconds(),
                        'length2': (last2.corrected_timestamp-first2.corrected_timestamp).total_seconds(),
                        'species1': cluster1.classification, 'species2': cluster2.classification,
                        'timestamp': midpoint1}
                digestedClusters.append(data)

    return digestedClusters

def find_matches(digestedClusters1,digestedClusters2,deltaLimit=360,lengthLimit=120):
    '''
    Helper function for correct_timestamps. Finds matches between two lists of cluster digest pairs, based on their species and time delta, and overall length.
    
        Parameters:
            digestedClusters1 (list): List of cluster pair digests
            digestedClusters2 (list): List of cluster pair digests
            deltaLimit (int): The maximum delta, in seconds, in midpoint time deltas allowed for a match. Default is 360.
            lengthLimit (int): The maximum delta, in seconds, in cluster lengths allowed for a match. Default is 120.

        Returns:
            matches (list): A list of timestamp adjustments that result in matches.
    '''
    
    matches = []
    for digest1 in digestedClusters1:
        for digest2 in digestedClusters2:
            if (digest1['species1']==digest2['species1']) and (digest1['species2']==digest2['species2']):
                if (digest1['delta']-deltaLimit)<=digest2['delta']<=(digest1['delta']+deltaLimit):
                    if digest1['length1'] != 0:
                        test1 = (digest1['length1']-lengthLimit)<=digest2['length1']<=(digest1['length1']+lengthLimit)
                    elif digest2['length1'] != 0:
                        test1 = (digest2['length1']-lengthLimit)<=digest1['length1']<=(digest2['length1']+lengthLimit)
                    else:
                        test1 = True
                    if digest1['length2'] != 0:
                        test2 = (digest1['length2']-lengthLimit)<=digest2['length2']<=(digest1['length2']+lengthLimit)
                    elif digest2['length2'] != 0:
                        test2 = (digest2['length2']-lengthLimit)<=digest1['length2']<=(digest2['length2']+lengthLimit)
                    else:
                        test2 = True
                    if test1 and test2:
                        adjustment = (digest1['timestamp'] - digest2['timestamp']).total_seconds()
                        matches.append(adjustment)
    return matches

def correct_timestamps(survey_id,setup_time=31):
    '''
    Attempts to automatically correct the relative timestamps of camera pairs so that their clusters line up better, based on the species contain therein.

        Parameters:
            survey_id (int): Survey to process
            setup_time (int): Estimated number of days to setup or take down the survey. Default is 31.
    '''

    survey = db.session.query(Survey).get(survey_id)
    overallStart = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).order_by(Image.corrected_timestamp).first()
    startDate = {}
    finishDate = {}

    #Determine survey period
    for trapgroup in survey.trapgroups:
        groups = get_groups(trapgroup)
        for group in groups:
            start = db.session.query(Image).filter(Image.camera_id.in_(groups[group])).order_by(Image.corrected_timestamp).first()
            finish = db.session.query(Image).filter(Image.camera_id.in_(groups[group])).order_by(desc(Image.corrected_timestamp)).first()
            if start:
                start = (start.corrected_timestamp-overallStart.corrected_timestamp).days
                finish = (finish.corrected_timestamp-overallStart.corrected_timestamp).days
                if start not in startDate.keys():
                    startDate[start] = 1
                else:
                    startDate[start] += 1
                if finish not in finishDate.keys():
                    finishDate[finish] = 1
                else:
                    finishDate[finish] += 1

    surveyStart = (overallStart.corrected_timestamp+timedelta(days=findValue(startDate,'min'))-timedelta(days=setup_time)).replace(hour=0,minute=0,second=0)
    surveyFinish = (overallStart.corrected_timestamp+timedelta(days=findValue(finishDate,'max'))+timedelta(days=setup_time)).replace(hour=23,minute=59,second=59)
    surveyLength = surveyFinish-surveyStart
    surveyMidpoint = (surveyLength/2)+surveyStart

    #Basic group adjustment
    all_groups = {}
    for trapgroup in survey.trapgroups:
        groups = get_groups(trapgroup)
        newGroups = {}

        #split too long groups
        for group in groups:
            images = db.session.query(Image).filter(Image.camera_id.in_(groups[group])).order_by(Image.corrected_timestamp).all()
            start = images[0].corrected_timestamp
            finish = images[-1].corrected_timestamp

            if (finish-start)>surveyLength:
                if Config.DEBUGGING: print('Group {} too long: {}'.format(group,finish-start))
                max = timedelta(seconds=0)
                point = None
                prev = images[0].corrected_timestamp
                for image in images[1:]:
                    delta = image.corrected_timestamp-prev
                    if delta > max:
                        max = delta
                        point = image
                    prev = image.corrected_timestamp
                if Config.DEBUGGING: print('Being split at {}'.format(point.corrected_timestamp))

                if point != None:
                    to_remove = []
                    for camID in groups[group]:
                        oldCam = db.session.query(Camera).get(camID)
                        oldCam.flagged = True
                        images = db.session.query(Image).filter(Image.camera_id==camID).filter(Image.corrected_timestamp>=point.corrected_timestamp).order_by(Image.corrected_timestamp).all()
                        if images != []:
                            for image in images:
                                oldCam.images.remove(image)
                            newCam = Camera(path=oldCam.path,trapgroup_id=trapgroup.id,flagged=True)
                            db.session.add(newCam)
                            newCam.images = images
                            folder = None
                            for item in re.split('/',oldCam.path):
                                if trapgroup.tag in item:
                                    folder = item
                                    break
                            folder += '_modified'
                            if (folder) not in newGroups.keys():
                                newGroups[folder] = [newCam]
                            else:
                                newGroups[folder].append(newCam)
                            if len(oldCam.images[:]) == 0:
                                to_remove.append(oldCam.id)
                                db.session.delete(oldCam)
                            if Config.DEBUGGING: print('Added new camera for trapgroup {}, for path {}'.format(trapgroup.id,newCam.path))

                    for camId in to_remove:
                        groups[group].remove(camId)

                    db.session.commit()
        
        for newGroup in newGroups:
            groups[newGroup] = [r.id for r in newGroups[newGroup]]
        all_groups[trapgroup.id] = groups

        # Simple timestmap asjustment to get cameras into ballpark
        for group in groups:
            images = db.session.query(Image).filter(Image.camera_id.in_(groups[group])).order_by(Image.corrected_timestamp).all()
            start = images[0].corrected_timestamp
            finish = images[-1].corrected_timestamp
            groupMidpoint = ((finish-start)/2)+start

            if not (surveyStart <= start <= surveyFinish):
                yearDelta = surveyMidpoint.year-groupMidpoint.year
                delta = relativedelta(years=yearDelta)
                
                if not (surveyStart <= (start+delta) <= surveyFinish):
                    monthDelta = surveyMidpoint.month-groupMidpoint.month
                    delta = relativedelta(years=yearDelta,months=monthDelta)

                    if (not (surveyStart <= (start+delta) <= surveyFinish)) and (monthDelta != 0):
                        dayDelta = surveyMidpoint.day-groupMidpoint.day
                        delta = relativedelta(years=yearDelta,months=monthDelta,days=dayDelta)

                if Config.DEBUGGING: print('Cameras {} need to be adjusted by {}'.format(groups[group],delta))
                # for chunk in chunker(images,500):
                for image in images:
                    image.corrected_timestamp += delta
                db.session.commit()

    task_id = create_reference_task(survey_id)

    # Find cluster classification matches
    overall_deltas = {}
    for trapgroup in survey.trapgroups:
        groups = all_groups[trapgroup.id]
        trapgroup_id = trapgroup.id

        results = []
        camList1 = list(groups.keys())
        camList2 = camList1.copy()
        for camera1 in camList1:
            camList2.remove(camera1)
            for camera2 in camList2:
                all_adjustments = {}
                for camID in groups[camera1]:
                    all_adjustments[camID] = 0
                for camID in groups[camera2]:
                    all_adjustments[camID] = 0
                
                first1 = db.session.query(Image).filter(Image.camera_id.in_(groups[camera1])).order_by(Image.corrected_timestamp).first()
                last1 = db.session.query(Image).filter(Image.camera_id.in_(groups[camera1])).order_by(desc(Image.corrected_timestamp)).first()
                if first1 and last1:
                    length1 = last1.corrected_timestamp-first1.corrected_timestamp
                else:
                    length1 = timedelta(seconds=0)
                
                first2 = db.session.query(Image).filter(Image.camera_id.in_(groups[camera2])).order_by(Image.corrected_timestamp).first()
                last2 = db.session.query(Image).filter(Image.camera_id.in_(groups[camera2])).order_by(desc(Image.corrected_timestamp)).first()
                if first2 and last2:
                    length2 = last2.corrected_timestamp-first2.corrected_timestamp
                else:
                    length2 = timedelta(seconds=0)
                
                if (length1==timedelta(seconds=0)) or (length2==timedelta(seconds=0)):
                    limit1=5
                    limit2=5
                else:
                    if length1 >= length2:
                        limit1 = math.floor(length1/length2)*5
                        limit2 = 5
                    else:
                        limit1 = 5
                        limit2 = math.floor(length2/length1)*5
                
                imCount = db.session.query(Cluster.id.label('clusterID'),func.count(distinct(Image.id)).label('count')).join(Image,Cluster.images).filter(Cluster.task_id==task_id).group_by(Cluster.id).subquery()
                clusters1 = db.session.query(Cluster)\
                                    .join(Image,Cluster.images)\
                                    .join(imCount,imCount.c.clusterID==Cluster.id)\
                                    .filter(Image.camera_id.in_(groups[camera1]))\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(~Cluster.classification.in_(['nothing','humans','vehicles']))\
                                    .filter(imCount.c.count>0)\
                                    .order_by(desc(imCount.c.count))\
                                    .distinct().limit(limit1).all()
                clusters2 = db.session.query(Cluster)\
                                    .join(Image,Cluster.images)\
                                    .join(imCount,imCount.c.clusterID==Cluster.id)\
                                    .filter(Image.camera_id.in_(groups[camera2]))\
                                    .filter(Cluster.task_id==task_id)\
                                    .filter(~Cluster.classification.in_(['nothing','humans','vehicles']))\
                                    .filter(imCount.c.count>0)\
                                    .order_by(desc(imCount.c.count))\
                                    .distinct().limit(limit2).all()
                db.session.rollback()

                orderedClusters1 = db.session.query(Cluster).join(Image,Cluster.images).filter(Cluster.id.in_([r.id for r in clusters1])).order_by(Image.corrected_timestamp).distinct().all()
                orderedClusters2 = db.session.query(Cluster).join(Image,Cluster.images).filter(Cluster.id.in_([r.id for r in clusters2])).order_by(Image.corrected_timestamp).distinct().all()
                
                digestedClusters1 = digest_clusters(orderedClusters1)
                digestedClusters2 = digest_clusters(orderedClusters2)
                matches = find_matches(digestedClusters1,digestedClusters2)
                
                if len(matches) != 0:

                    # find total adjustment
                    if len(matches) == 1:
                        total_adjustment = matches[0]
                    else:
                        total_adjustment = 0
                        matches = reject_outliers(np.array(matches)).tolist()
                        if type(matches[0]) == list:
                            matches = matches[0]
                        for adjustment in matches:
                            total_adjustment += adjustment
                        total_adjustment = total_adjustment/len(matches)

                    for camID in groups[camera2]:
                        all_adjustments[camID] = total_adjustment

                    # Find all combinations
                    delta = 0.5 #min
                    max = 4 #min
                    combination = [-4,0]
                    combinations = [combination.copy()]
                    finished = False
                    while not finished:
                        combination, status = incrementCombination(combination,0,delta,max)
                        if status:
                            combinations.append(combination.copy())
                        else:
                            finished = True

                    allData = []
                    for combination in combinations:
                        data = {}
                        index = 0
                        for folder in [camera1,camera2]:
                            for camID in groups[folder]:
                                data[camID] = timedelta(seconds=((combination[index]*60)+all_adjustments[camID]))
                            index += 1
                        allData.append(data)

                    #Find optimal adjustment
                    allCams = groups[camera1]
                    allCams.extend(groups[camera2])
                    max = calculateCameraOverlapScore(task_id,allCams)
                    result = {}
                    for camID in allCams:
                        result[camID] = timedelta(seconds=(0))

                    for data in allData:
                        adjustTimestamps(trapgroup_id,data)
                        score = calculateCameraOverlapScore(task_id,allCams)
                        if score > max:
                            max = score
                            result = data
                        resetTimestamps(trapgroup_id,data)
                    results.append({'camera1': camera1, 'camera2': camera2, 'delta2': (result[groups[camera2][0]]-result[groups[camera1][0]]).total_seconds() })

        temp_delta = {}
        for folder in camList1:
            temp_delta[folder] = 0

        for camera1 in camList1:
            for result in results:
                if result['camera1']==camera1:
                    if temp_delta[result['camera2']] == 0:
                        temp_delta[result['camera2']] = temp_delta[result['camera1']] + result['delta2']
                    else:
                        temp_delta[result['camera2']] = (temp_delta[result['camera2']] + (temp_delta[result['camera1']] + result['delta2']))/2

        for folder in groups:
            for camID in groups[folder]:
                overall_deltas[camID] = temp_delta[folder]

    data = {}
    for cameraID in overall_deltas.keys():
        data[cameraID] = timedelta(seconds=overall_deltas[cameraID])

    for trapgroup in survey.trapgroups:
        adjustTimestamps(trapgroup.id,data)

    from app.functions.admin import delete_task
    delete_task(task_id)

    return True


@celery.task(bind=True,max_retries=5,ignore_result=True)
def import_survey(self,survey_id,preprocess_done=False,live=False,launch_id=None,used_lambda=False):
    '''
    Celery task for the importing of surveys. Includes all necessary processes such as animal detection, species classification etc. Handles added images cleanly.

        Parameters:
            survey_id (int): The ID of the survey to be processed
            preprocess_done (bool): Whether or not the survey has already been preprocessed
            live (bool): Whether or not the data being imported was added live
            launch_id (id): The ID of the task that needs to be launched after the survey is imported
            used_lambda (bool): Whether or not to AWS Lambda was used in the upload process
    '''
    
    try:
        app.logger.info("Importing survey {}".format(survey_id))
        processes=4

        survey = db.session.query(Survey).get(survey_id)
        if (survey and survey.status.lower() in ['launched', 'processing', 'indprocessing', 'deleting', 'prepping task']) or not survey:
            return True

        survey.images_processing = survey.image_count + survey.video_count 
        db.session.commit()

        # First half import -> always performed
        if not preprocess_done:

            if used_lambda:
                process_folder(survey.organisation.folder+'/'+survey.folder, survey_id,Config.BUCKET)
            elif live:
                import_live_data(survey_id)
            else:
                import_folder(survey.organisation.folder+'/'+survey.folder, survey_id,Config.BUCKET,Config.BUCKET,False,None,[],processes)
            
            survey = db.session.query(Survey).get(survey_id)
            survey_id = survey.id
            survey.image_count = db.session.query(Image).join(Camera).join(Trapgroup).outerjoin(Video).filter(Trapgroup.survey==survey).filter(Video.id==None).distinct().count()
            survey.video_count = db.session.query(Video).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
            survey.frame_count = db.session.query(Image).join(Camera).join(Trapgroup).join(Video).filter(Trapgroup.survey==survey).distinct().count()
            survey.status = 'Extracting Timestamps'
            db.session.commit()

            extract_missing_timestamps(survey_id)
            timestamp_check = db.session.query(Image.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Image.corrected_timestamp==None).filter(Image.skipped!=True).first()

            survey = db.session.query(Survey).get(survey_id)
            survey.status='Processing Cameras'
            db.session.commit()
            if live:
                processCameras(survey_id, survey.trapgroup_code, None)
            else:
                processCameras(survey_id, survey.trapgroup_code, survey.camera_code)
            survey = db.session.query(Survey).get(survey_id)

            static_check = None
            if not live:
                survey.status='Identifying Static Detections'
                db.session.commit()
                processStaticDetections(survey_id)
                survey = db.session.query(Survey).get(survey_id)
                static_check = db.session.query(Staticgroup.id).join(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Staticgroup.status=='unknown').first()

            survey.status='Importing Coordinates'
            db.session.commit()
            importKML(survey.id)

        # Second half import -> performed after preprocessing. Also performed if there is no preprocessing required (which is also the case for live surveys)
        if preprocess_done or not (timestamp_check or static_check) or live:
            task_id=cluster_survey(survey_id)
            survey = db.session.query(Survey).get(survey_id)

            survey.status='Processing Static Detections'
            db.session.commit()
            wrapUpStaticDetectionCheck(survey_id)
            survey = db.session.query(Survey).get(survey_id)

            survey.status='Removing Humans'
            db.session.commit()
            removeHumans(task_id)

            survey.status='Classifying'
            db.session.commit()
            classifySurvey(survey_id=survey_id,sourceBucket=Config.BUCKET)

            survey = db.session.query(Survey).get(survey_id)
            survey.status='Re-Clustering'
            db.session.commit()
            recluster_survey(survey_id)

            survey = db.session.query(Survey).get(survey_id)
            survey.status='Calculating Scores'
            db.session.commit()
            updateSurveyDetectionRatings(survey_id=survey_id)

            task_ids = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).filter(Task.name!='default').all()]
            for task_id in task_ids:
                classifyTask(task_id)
                updateAllStatuses(task_id=task_id)

            survey = db.session.query(Survey).get(survey_id)
            if survey.organisation.archive != False:
                archive_survey(survey_id)

            survey = db.session.query(Survey).get(survey_id)
            survey.status = 'Ready'
            survey.images_processing = 0
            if live:
                survey.image_count = db.session.query(Image).join(Camera).join(Trapgroup).outerjoin(Video).filter(Trapgroup.survey_id==survey_id).filter(Image.clusters.any()).filter(Video.id==None).distinct().count()
            db.session.commit()
            app.logger.info("Finished importing survey {}".format(survey_id))

            GLOBALS.redisClient.delete('lambda_invoked_'+str(survey_id))
            GLOBALS.redisClient.delete('lambda_completed_'+str(survey_id))
            GLOBALS.redisClient.delete('upload_complete_'+str(survey_id))

            if launch_id:
                task = db.session.query(Task).get(launch_id)
                task.status = 'PENDING'
                task.survey.status = 'Launched'
                for sub_task in task.sub_tasks:
                    sub_task.status = 'Processing'
                    sub_task.survey.status = 'Launched'
                db.session.commit()
                launch_task.delay(task_id=launch_id)

        else:
            # Pre-prcocessing is required
            survey_status = "Preprocessing,"

            if timestamp_check:
                survey_status += "Available,"
            else:
                survey_status += "N/A,"
            if static_check:
                survey_status += "Available"
            else:
                survey_status += "N/A"

            survey = db.session.query(Survey).get(survey_id)
            survey.status = survey_status
            survey.images_processing = 0
            db.session.commit()
            app.logger.info("Finished importing survey {}. Preprocessing required.".format(survey_id))

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

# def extract_label(path,filename,species,translations,survey_id):
#     '''Helper function for extract_dirpath_labels that extracts the label for an individual row of the dataframe.'''
#     label = translations[species]
#     image = db.session.query(Image)\
#                         .join(Camera)\
#                         .join(Trapgroup)\
#                         .filter(Trapgroup.survey_id==survey_id)\
#                         .filter(Camera.path==path)\
#                         .filter(Image.filename==filename)\
#                         .first()
#     if label and image:
#         image.clusters[0].labels = [label]
#         labelgroups = db.session.query(Labelgroup)\
#                             .join(Detection)\
#                             .filter(Detection.image_id==image.id)\
#                             .distinct().all()
#         for labelgroup in labelgroups:
#             labelgroup.labels = [label]
#     return True

@celery.task(bind=True,max_retries=5,ignore_result=False)
def extract_dirpath_labels(self,label_id,dirpath,filenames,task_id,survey_id):
    '''Helper function for pipeline_survey that extracts the labels for a supplied dataframe.'''
    
    try:
        label = db.session.query(Label).get(label_id)

        images = db.session.query(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Camera.path==dirpath)\
                        .filter(Image.filename.in_(filenames))\
                        .distinct().all()

        for image in images:
            image.detection_rating = 1
            cluster = Cluster(task_id=task_id)
            db.session.add(cluster)
            cluster.images = [image]
            cluster.labels = [label]

        detection_ids = [r[0] for r in db.session.query(Detection.id)\
                        .join(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Camera.path==dirpath)\
                        .filter(Image.filename.in_(filenames))\
                        .distinct().all()]
        
        for detection_id in detection_ids:
            labelgroup = Labelgroup(detection_id=detection_id,task_id=task_id,checked=False)
            db.session.add(labelgroup)
            labelgroup.labels = [label]

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

# @celery.task(bind=True,max_retries=5,ignore_result=False)
# def extract_dirpath_labels(self,key,translations,survey_id,destBucket):
#     '''Helper function for pipeline_survey that extracts the labels for a supplied dataframe.'''
    
#     try:
#         with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
#             GLOBALS.s3client.download_file(Bucket=destBucket, Key=key, Filename=temp_file.name)
#             df = pd.read_csv(temp_file.name)
#         for key in translations:
#             label = db.session.query(Label).get(translations[key])
#             translations[key] = label
#         df.apply(lambda x: extract_label(x.dirpath,x.filename,x.species,translations,survey_id), axis=1)
#         db.session.commit()
#         GLOBALS.s3client.delete_object(Bucket=destBucket, Key=key)
    
#     except Exception as exc:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')
#         self.retry(exc=exc, countdown= retryTime(self.request.retries))

#     finally:
#         db.session.remove()

#     return True

@celery.task(bind=True,max_retries=5,ignore_result=False)
def pipeline_cluster_camera(self,camera_id,task_id):
    '''Helper function to parallelise pipeline clustering'''

    try:
        images = db.session.query(Image).filter(Image.camera_id==camera_id).distinct().all()
        for image in images:
            image.detection_rating = 1
            cluster = Cluster(task_id=task_id)
            db.session.add(cluster)
            cluster.images = [image]
            detection_ids = [r[0] for r in db.session.query(Detection.id).filter(Detection.image_id==image.id).all()]
            for detection_id in detection_ids:
                labelgroup = Labelgroup(detection_id=detection_id,task_id=task_id,checked=False)
                db.session.add(labelgroup)
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
def pipeline_survey(self,surveyName,bucketName,dataSource,fileAttached,trapgroupCode,min_area,exclusions,sourceBucket,label_source):
    '''
    Celery task for processing pre-annotated data. Creates a survey etc. as normal, but does not classify the data, nor bother to 
    cluster it. Additionally saves crops instead of compressed images.

        Parameters:
            surveyName (str): The desired survey name
            bucketName (str): The bucket where the crops must be saved
            dataSource (str): The endpoint where the data should be collected from. Should be an S3 folder if no csv is attached
            fileAttached (bool): Determines the import mode:
                True: import follows a csv file, pulling the specified non-empty, single-labelled images from an external source. 
                        only needs two columns: filepath, species
                False: import walks through the specified folder inside the specified bucket, and imports those images.
            trapgroupCode (str): regular expression to identify trapgroups
            min_area (float): The minimum area detection to crop
            exclusions (list): A list of folders to exclude
            sourceBucket (str): The bucket where the folder should be found if no csv file was attached
            label_source (str): The metadata field where labels are to be extracted from
    '''
    
    try:
        app.logger.info("Pipelining survey {}".format(surveyName))
        admin = db.session.query(Organisation).filter(Organisation.name=='Admin').first()
        organisation_id = admin.id

        localsession=db.session()
        survey = Survey.get_or_create(localsession,name=surveyName,organisation_id=organisation_id,trapgroup_code=trapgroupCode)
        survey.status = 'Importing'
        localsession.commit()
        survey_id = survey.id

        if fileAttached or label_source:
            task = Task(name='import', survey_id=survey.id, tagging_level='-1', test_size=0, status='Ready')
        else:
            task = Task(name='default', survey_id=survey.id, tagging_level='-1', test_size=0, status='Ready')
        localsession.add(task)

        localsession.commit()
        task_id=task.id
        localsession.close()

        if fileAttached:
            fileName = 'csvFiles/' + surveyName + '.csv'
            with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                GLOBALS.s3client.download_file(Bucket=bucketName, Key=fileName, Filename=temp_file.name)
                df = pd.read_csv(temp_file.name)

            # Works on the assumption that multi-labels are handled with duplicate image rows - remove all of these
            df = df.drop_duplicates(subset=['filepath'], keep=False)

            # Remove all empty images including humans
            empty_names = ['unknown','none','fire','blank','human','null']
            df = df[~df['species'].str.contains('|'.join(empty_names), case=False)]

            # Remove all extra info
            df = df[['filepath','species']]

            #extract the dirpaths & filenames
            df['filename'] = df.apply(lambda x: re.split('/',x.filepath)[-1], axis=1)
            df['dirpath'] = df.apply(lambda x: os.path.join(*re.split('/',x.filepath)[:-1]), axis=1)
            # df['dirpath'] = df.apply(lambda x: re.split(x.filename,x.filepath)[0][:-1], axis=1)
            del df['filepath']

            # Start importing these
            # pipeline_csv(df,surveyName,trapgroupCode,dataSource,True,min_area,bucketName,exclusions,label_source)
            pipeline_csv(df,survey_id,trapgroupCode,exclusions,dataSource,bucketName,min_area,True,label_source)

        else:
            #import from S3 folder
            import_folder(dataSource,survey_id,sourceBucket,bucketName,True,min_area,exclusions,4,label_source)

        survey = db.session.query(Survey).get(survey_id)
        survey.status='Identifying Static Detections'
        db.session.commit()
        processStaticDetections(survey_id)

        # if labels extracted from metadata, there are already labelled clusters
        if not label_source:

            if not fileAttached:
                # Cluster survey
                survey = db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.organisation_id==organisation_id).first()
                survey.status = 'Clustering'
                db.session.commit()
                results = []
                camera_ids = [r[0] for r in db.session.query(Camera.id).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().all()]
                db.session.remove()
                for camera_id in camera_ids:
                    results.append(pipeline_cluster_camera.apply_async(kwargs={'camera_id':camera_id,'task_id':task_id},queue='parallel'))

                # Wait for processing to finish
                # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
                # See https://github.com/celery/celery/issues/4480
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

            else:
                # Extract labels:
                survey = db.session.query(Survey).get(survey_id)
                survey.status = 'Extracting Labels'
                db.session.commit()

                # Create labels
                translations = {}
                for species in df['species'].unique():
                    if species.lower() in ['nothing','empty','blank']:
                        label = db.session.query(Label).get(GLOBALS.nothing_id)
                    else:
                        label = Label(description=species,hotkey=None,parent_id=None,task_id=task_id,complete=True)
                        db.session.add(label)
                        db.session.commit()
                    translations[species] = label.id

                # Run the folders in parallel
                results = []
                for dirpath in df['dirpath'].unique():
                    # dirpathDF = df.loc[df['dirpath'] == dirpath]
                    # key = 'pipelineCSVs/' + surveyName + '_' + dirpath.replace('/','_') + '.csv'
                    # with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    #     dirpathDF.to_csv(temp_file.name,index=False)
                    #     GLOBALS.s3client.put_object(Bucket=bucketName,Key=key,Body=temp_file)
                    for species in df[df['dirpath'] == dirpath]['species'].unique():
                        filenames = list(df[(df['dirpath'] == dirpath) & (df['species']==species)]['filename'].unique())
                        results.append(extract_dirpath_labels.apply_async(kwargs={'label_id':translations[species],'dirpath':dirpath,'filenames':filenames,'task_id':task_id,'survey_id':survey_id},queue='parallel'))

                # Wait for processing to finish
                # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
                # See https://github.com/celery/celery/issues/4480
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

        survey = db.session.query(Survey).get(survey_id)
        survey.status = 'Ready'
        survey.images_processing = 0
        db.session.commit()
        app.logger.info("Finished importing survey {}".format(surveyName))

        # Delete the csv when finished
        if fileAttached:
            fileName = 'csvFiles/' + surveyName + '.csv'
            if os.path.isfile(fileName):
                try:
                    os.remove(fileName)
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

def validate_csv(stream,survey_id):
    '''Validates a given stream of a csv file by checking its format, and whether it has any images that match the specified survey.'''
    
    csvdata = stream.read()
    stream.seek(0)
    csvdata = csvdata.decode('utf-8')
    headings = re.split('\n',csvdata)[0]
    first = re.split('\n',csvdata)[1]
    if ('filename' in re.split(',',headings)) and ('label' in headings.lower()):
        index = 0
        for column in re.split(',',headings):
            if column == 'filename':
                break
            else:
                index += 1

        fullPath = re.split(',',first)[index]
        filename = re.split('/',fullPath)[-1]
        # path = re.split(filename,fullPath)[0][:-1]
        path = os.path.join(*re.split('/',fullPath)[:-1])
        image = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.path==path).filter(Image.filename==filename).first()

        if image: return True

    return False

@celery.task(bind=True,max_retries=5)
def process_video_batch(self,dirpath,batch,bucket,trapgroup_id):
    '''Celery wrapper for extract_images_from_video'''
    try:
        localsession=db.session()
        for filename in batch:
            extract_images_from_video(localsession, dirpath+'/'+filename, bucket, trapgroup_id)
        localsession.commit()

        # only delete files after db commit #indempotency
        filenames = [r[0] for r in localsession.query(Video.filename).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Video.filename.in_(batch)).distinct().all()]
        for filename in filenames:
            GLOBALS.s3client.delete_object(Bucket=bucket, Key=dirpath+'/'+filename)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        localsession.close()

    return True

def get_still_rate(video_fps,video_frames):
    '''Returns the rate at which still should be extracted.'''
    max_frames = 30     # Maximum number of frames to extract
    fps_default = 1     # Default fps to extract frames at (frame per second)
    video_duration = math.ceil(video_frames / video_fps)
    return min((max_frames-1) / video_duration, fps_default)  

def extract_images_from_video(localsession, sourceKey, bucketName, trapgroup_id):
    ''' Downloads video from bucket and extracts images from it. The images are then uploaded to the bucket. '''

    try:
        splits = sourceKey.rsplit('/', 1)
        video_path = splits[0]
        video_name = splits[-1].split('.')[0]
        video_type = '.' + splits[-1].split('.')[-1]
        filename = sourceKey.split('/')[-1]
        split_path = splits[0].split('/')
        split_path[0] = split_path[0] + '-comp'
        comp_video_path = '/'.join(split_path)
        video_hash = None

        # we have already checked if the cameras and videos exist
        camera = Camera(trapgroup_id=trapgroup_id, path=video_path+'/_video_images_/'+video_name)
        localsession.add(camera)

        # Download video
        with tempfile.NamedTemporaryFile(delete=True, suffix=video_type) as temp_file:
            try:
                GLOBALS.s3client.download_file(Bucket=bucketName, Key=sourceKey, Filename=temp_file.name)
            except:
                app.logger.info('Could not download video {}'.format(sourceKey))
                return True
            
            # Get video timestamp 
            try:
                video_timestamp = ffmpeg.probe(temp_file.name)['streams'][0]['tags']['creation_time']
            except:                             
                video_timestamp = None

            if not video_timestamp:
                try:
                    video_timestamp = ffmpeg.probe(temp_file.name)['format']['tags']['creation_time']
                except:
                    video_timestamp = None

            if video_timestamp:
                try:
                    video_timestamp = datetime.strptime(video_timestamp, '%Y-%m-%dT%H:%M:%S.%fZ')
                except:
                    try:
                        video_timestamp = datetime.strptime(video_timestamp, '%Y-%m-%d %H:%M:%S')
                    except:
                        video_timestamp = None

            # Extract images
            video = cv2.VideoCapture(temp_file.name)
            video_fps = video.get(cv2.CAP_PROP_FPS)
            video_frames = video.get(cv2.CAP_PROP_FRAME_COUNT)

            fps = get_still_rate(video_fps,video_frames)
            
            ret, frame = video.read()
            count = 0
            count_frame = 0
            frame_rate = math.ceil(video_fps / fps)
            assert ret==True #need this to catch metadata issues
            while ret:
                if count % frame_rate == 0:
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file_img:
                        cv2.imwrite(temp_file_img.name, frame)
                        # Timestamp
                        if video_timestamp:
                            image_timestamp = video_timestamp + timedelta(seconds=count_frame/fps)
                            exif_time = image_timestamp.strftime('%Y:%m:%d %H:%M:%S')
                            exif_dict = {"Exif":{piexif.ExifIFD.DateTimeOriginal: exif_time}}
                            exif_bytes = piexif.dump(exif_dict)
                            # Write exif data to image
                            piexif.insert(exif_bytes, temp_file_img.name)

                        # Upload image to bucket
                        image_key = video_path + '/_video_images_/' +  video_name + '/frame%d.jpg' % count_frame
                        GLOBALS.s3client.put_object(Bucket=bucketName,Key=image_key,Body=temp_file_img)
                        count_frame += 1
                ret, frame = video.read()
                count += 1

            video.release()
            cv2.destroyAllWindows()

            # Convert and compress video
            input_video = ffmpeg.input(temp_file.name)
            try:
                probe = ffmpeg.probe(temp_file.name)
                video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
                width = int(video_stream['width'])
                height = int(video_stream['height'])
            except:
                width = None
                height = None

            with tempfile.NamedTemporaryFile(delete=True, suffix='.mp4') as temp_file_out:
                # Compress video
                if width and height and width > 854 and height > 480:
                    output_video = ffmpeg.output(input_video, temp_file_out.name, crf=30, preset='veryfast', s='854:480', pix_fmt='yuv420p')
                else:
                    output_video = ffmpeg.output(input_video, temp_file_out.name, crf=30, preset='veryfast', pix_fmt='yuv420p')
                output_video.run(overwrite_output=True)

                # Upload video to compressed bucket
                video_key = comp_video_path + '/' +  video_name + '.mp4'
                GLOBALS.s3client.put_object(Bucket=bucketName,Key=video_key,Body=temp_file_out)

            # Calculate hash 
            video_hash = generate_raw_image_hash(temp_file.name)

        video = Video(camera=camera, filename=filename, hash=video_hash, still_rate=fps)
        localsession.add(video)

    except:
        app.logger.info('Skipping video {} as it appears to be corrupt.'.format(sourceKey))

    return True

@celery.task(bind=True,max_retries=5)
def batchCropping(self,images,source,min_area,destBucket,external,update_image_info,label_source=None,task_id=None,check=False):   
    try:
        for image_id in images:
            save_crops(image_id,source,min_area,destBucket,external,update_image_info,label_source,task_id,check)

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

def convertBBox(api_box):
    '''Function for converting MD format bboxes to our format'''
    x_min, y_min, width_of_box, height_of_box = api_box
    x_max = x_min + width_of_box
    y_max = y_min + height_of_box
    return [max(0, min(1, y_min)), max(0, min(1, x_min)), max(0, min(1, y_max)), max(0, min(1, x_max))]

def commitAndCrop(images,source,min_area,destBucket,external,update_image_info,check=False):
    '''Helper function for pipelineLILA that commits the db and then kicks off image cropping'''
    db.session.commit()
    batchCropping.apply_async(kwargs={'images': [r.id for r in images],'source':source,'min_area':min_area,'destBucket':destBucket,'external':external,'update_image_info':update_image_info,'label_source':None,'task_id':None,'check':check},queue='default')
    return []

@celery.task(bind=True,ignore_result=True)
def pipelineLILA(self,dets_filename,images_filename,survey_name,tgcode_str,source,min_area,destBucket):
    '''Makes use of the MegaDetector results on LILA to pipeline trianing data.'''
    try:
        skip_labels = ['unknown','none','fire','human','null','nothinghere','ignore']
        external = True
        update_image_info=True
        tgcode = re.compile(tgcode_str)

        with tempfile.NamedTemporaryFile(delete=True, suffix='.json') as temp_file:
            GLOBALS.s3client.download_file(Bucket=destBucket, Key=dets_filename, Filename=temp_file.name)
            with open(temp_file.name) as f:
                json_data = json.load(f)

        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=destBucket, Key=images_filename, Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)

        if 'filename' in df.columns:
            df = df.rename(columns={'filename': 'filepath','common_name': 'species'})

        survey = Survey(name=survey_name,organisation_id=1,trapgroup_code=tgcode_str,status='Importing')
        db.session.add(survey)
        task = Task(name='import', survey=survey, tagging_level='-1', test_size=0, status='Ready')
        db.session.add(task)
        db.session.commit()
        task_id=task.id
        survey_id=survey.id

        label_translations = {}
        for description in df['species'].unique():
            if description.lower() not in skip_labels:
                if description.lower() in ['nothing','empty','blank']:
                    label = db.session.query(Label).get(GLOBALS.nothing_id)
                elif description.lower() in ['human']:
                    label = db.session.query(Label).get(GLOBALS.vhl_id)
                else:
                    label = Label(description=description,task=task)
                    db.session.add(label)
                label_translations[description] = label
        db.session.commit()

        count = 0
        images = []
        trapgroups = {}
        dirpath_cam_translations = {}
        for item in json_data['images']:
            if len(df[df['filepath']==item['file']]) == 1:
                tags = tgcode.search(item['file'])
                if tags:
                    tag = tags.group()
                    species = [r for r in df[df['filepath']==item['file']]['species'].unique() if r.lower() not in skip_labels]
                    if species:
                        dirpath = '/'.join(item['file'].split('/')[:-1])
                        filename = item['file'].split('/')[-1]
                        if tag not in trapgroups.keys():
                            trapgroup = Trapgroup(survey_id=survey_id,tag=tag)
                            db.session.add(trapgroup)
                            images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info)
                            trapgroups[tag] = trapgroup.id
                        trapgroup_id = trapgroups[tag]
                        if dirpath not in dirpath_cam_translations.keys():
                            camera = Camera(path=dirpath,trapgroup_id=trapgroup_id)
                            db.session.add(camera)
                            images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info)
                            dirpath_cam_translations[dirpath] = camera.id
                        camera_id = dirpath_cam_translations[dirpath]
                        image = Image(camera_id=camera_id,filename=filename)
                        cluster = Cluster(task_id=task_id)
                        db.session.add(image)
                        db.session.add(cluster)
                        cluster.images = [image]
                        for specie in species:
                            cluster.labels.append(label_translations[specie])
                        images.append(image)
                        for det in item['detections']:
                            top, left, bottom, right = convertBBox(det['bbox'])
                            detection = Detection(image=image,top=top,left=left,bottom=bottom,right=right,score=det['conf'],category=det['category'],source='MDv5b')
                            db.session.add(detection)
                            labelgroup = Labelgroup(task_id=task_id,detection=detection)
                            db.session.add(labelgroup)
                            for specie in species:
                                labelgroup.labels.append(label_translations[specie])
                        count += 1
                        if count%100==0: print(count)
        images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info)

        survey = db.session.query(Survey).get(survey_id)
        survey.status='Ready'
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

@celery.task(bind=True,ignore_result=True)
def pipelineLILA2(self,dets_filename,images_filename,survey_name,tgcode_str,source,min_area,destBucket):
    '''Makes use of the MegaDetector results on LILA to pipeline trianing data.'''
    try:
        skip_labels = ['unknown','none','fire','human','null','nothinghere','ignore']
        external = True
        update_image_info=True
        tgcode = re.compile(tgcode_str)

        with tempfile.NamedTemporaryFile(delete=True, suffix='.json') as temp_file:
            GLOBALS.s3client.download_file(Bucket=destBucket, Key=dets_filename, Filename=temp_file.name)
            with open(temp_file.name) as f:
                json_data = json.load(f)

        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=destBucket, Key=images_filename, Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)

        if 'filename' in df.columns:
            df = df.rename(columns={'filename': 'filepath','common_name': 'species'})

        # survey = Survey(name=survey_name,user_id=1,trapgroup_code=tgcode_str,status='Importing')
        # db.session.add(survey)
        # task = Task(name='import', survey=survey, tagging_level='-1', test_size=0, status='Ready')
        # db.session.add(task)
        # db.session.commit()
        # TODO: Check  this
        survey = db.session.query(Survey).filter(Survey.organisation_id==1).filter(Survey.name==survey_name).first()
        task = survey.tasks[0]
        task_id=task.id
        survey_id=survey.id

        label_translations = {}
        for description in df['species'].unique():
            if description.lower() not in skip_labels:
                if description.lower() in ['nothing','empty','blank']:
                    label = db.session.query(Label).get(GLOBALS.nothing_id)
                elif description.lower() in ['human']:
                    label = db.session.query(Label).get(GLOBALS.vhl_id)
                else:
                    # label = Label(description=description,task=task)
                    # db.session.add(label)
                    label = db.session.query(Label).filter(Label.task==task).filter(Label.description==description).first()
                label_translations[description] = label
        # db.session.commit()

        trapgroups = {}
        for trapgroup in survey.trapgroups:
            trapgroups[trapgroup.tag] = trapgroup.id

        dirpath_cam_translations = {}
        for camera in db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().all():
            dirpath_cam_translations[camera.path] = camera.id

        count = 0
        images = []
        # trapgroups = {}
        # dirpath_cam_translations = {}
        for item in json_data['images']:
            if len(df[df['filepath']==item['file']]) == 1:
                tags = tgcode.search(item['file'])
                if tags:
                    tag = tags.group()
                    species = [r for r in df[df['filepath']==item['file']]['species'].unique() if r.lower() not in skip_labels]
                    if species:
                        dirpath = '/'.join(item['file'].split('/')[:-1])
                        filename = item['file'].split('/')[-1]
                        if tag not in trapgroups.keys():
                            trapgroup = Trapgroup(survey_id=survey_id,tag=tag)
                            db.session.add(trapgroup)
                            images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info,True)
                            trapgroups[tag] = trapgroup.id
                        trapgroup_id = trapgroups[tag]
                        if dirpath not in dirpath_cam_translations.keys():
                            camera = Camera(path=dirpath,trapgroup_id=trapgroup_id)
                            db.session.add(camera)
                            images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info,True)
                            dirpath_cam_translations[dirpath] = camera.id
                        camera_id = dirpath_cam_translations[dirpath]
                        image = db.session.query(Image).filter(Image.camera_id==camera_id).filter(Image.filename==filename).first()
                        if image==None:
                            image = Image(camera_id=camera_id,filename=filename)
                            cluster = Cluster(task_id=task_id)
                            db.session.add(image)
                            db.session.add(cluster)
                            cluster.images = [image]
                            for specie in species:
                                cluster.labels.append(label_translations[specie])
                            for det in item['detections']:
                                top, left, bottom, right = convertBBox(det['bbox'])
                                detection = Detection(image=image,top=top,left=left,bottom=bottom,right=right,score=det['conf'],category=det['category'],source='MDv5b',status='active')
                                db.session.add(detection)
                                labelgroup = Labelgroup(task_id=task_id,detection=detection)
                                db.session.add(labelgroup)
                                for specie in species:
                                    labelgroup.labels.append(label_translations[specie])
                        images.append(image)
                        count += 1
                        if count%100==0: print(count)
        images = commitAndCrop(images,source,min_area,destBucket,external,update_image_info,True)

        survey = db.session.query(Survey).get(survey_id)
        survey.status='Ready'
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

def processCameras(survey_id, trapgroup_code, camera_code, queue='parallel'):
    ''' Processes all cameras in a survey without a cameragroup, extracting the camera code from the path and creating a cameragroup for each unique code.'''
    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).all()]

    results = []
    for trapgroup_id in trapgroup_ids:
        results.append(group_cameras.apply_async(kwargs={'trapgroup_id':trapgroup_id, 'camera_code': camera_code, 'trapgroup_code': trapgroup_code},queue=queue))

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

    # Find empty cameragroups
    empty_cameragroups = db.session.query(Cameragroup).filter(~Cameragroup.cameras.any()).all()
    for empty_cameragroup in empty_cameragroups:
        empty_cameragroup.masks = []
        db.session.delete(empty_cameragroup)

    # Find masks without a cameragroup
    masks = db.session.query(Mask).filter(Mask.cameragroup_id==None).all()
    for mask in masks:
        db.session.delete(mask)

    db.session.commit()
    db.session.remove()

    return True

@celery.task(bind=True,max_retries=5)
def group_cameras(self,trapgroup_id,camera_code,trapgroup_code):
    ''' Groups cameras into cameragroups based on the camera code (Camera identifier or Bottom-level Folder)'''
    try:
        cameras = db.session.query(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Camera.cameragroup_id==None).all()
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        survey_name = trapgroup.survey.name
        camera_name = None

        for camera in cameras:
            camera_name = extract_camera_name(camera_code,trapgroup_code,survey_name,trapgroup.tag,camera.path)
            if camera_name:
                if not camera.cameragroup:
                    if not camera_code and not '_video_images_' in camera.path:
                        # If no camera code, and not a video only look for existing cameragroups from videos otherwise create a new one
                        existing_cameragroups = db.session.query(Cameragroup).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Cameragroup.name==camera_name).filter(Camera.path.contains('_video_images_')).all()
                    else:
                        existing_cameragroups = db.session.query(Cameragroup).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Cameragroup.name==camera_name).all()
                    
                    if existing_cameragroups:
                        if len(existing_cameragroups) == 1:
                            existing_cameragroup = existing_cameragroups[0]
                            existing_cameragroup.cameras.append(camera)
                        else:
                            all_cameras = []
                            all_masks = []
                            for existing_cameragroup in existing_cameragroups:
                                all_cameras.extend(existing_cameragroup.cameras)
                                all_masks.extend(existing_cameragroup.masks)
                                db.session.delete(existing_cameragroup)
                            all_cameras.append(camera)
                            all_cameras = list(set(all_cameras))
                            camera_group = Cameragroup(name=camera_name,cameras=all_cameras,masks=all_masks)
                            db.session.add(camera_group)
                    else:
                        camera_group = Cameragroup(name=camera_name,cameras=[camera],masks=[])
                        db.session.add(camera_group)

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

def extract_camera_name(camera_code,trapgroup_code,survey_name,trapgroup_tag,path):
    '''Extracts the camera name from the given path.'''

    if camera_code:
        # Identifier

        same_as_site = False
        if camera_code == trapgroup_code:
            same_as_site = True

        if same_as_site:
            camera_code = re.compile(camera_code)
            tags = camera_code.search(path.replace(survey_name,''))
            camera_name = tags.group() if tags else None
        
        else:
            # If cam identifier not the same as the site identifier, remove the site identifier from the camera path
            camera_code = re.compile(camera_code)
            tags = camera_code.search(path.replace(survey_name,'').replace(trapgroup_tag,''))
            camera_name = tags.group() if tags else None

    else:
        # Folder
        if '_video_images_' in path:
            # If video, use the folder above the video_images folder
            camera_name = path.split('/_video_images_')[0].split('/')[-1]
        else:
            camera_name = path.split('/')[-1]

    return camera_name

@celery.task(bind=True,max_retries=5)
def run_llava(self,image_ids,prompt):
    '''Processes the specified images with LLaVA using the given prompt and saves the result in the images table.'''

    try:
        images = [r[0] for r in db.session.query(Camera.path+'/'+Image.filename)\
                                        .join(Camera)\
                                        .filter(Image.id.in_(image_ids))\
                                        .distinct().all()]
        db.session.close()

        results = []
        for batch in chunker(images,100):
            results.append(llava_infer.apply_async(kwargs={'batch':batch, 'sourceBucket':Config.BUCKET, 'prompt': prompt, 'external': False},queue='llava'))

        GLOBALS.lock.acquire()
        with allow_join_result():
            for result in results:
                try:
                    response = result.get()

                    data = db.session.query(Camera.path+'/'+Image.filename,Image)\
                                    .join(Camera,Image.camera_id==Camera.id)\
                                    .filter((Camera.path+'/'+Image.filename).in_(list(response.keys())))\
                                    .distinct().all()
                    
                    lookup = {}
                    for item in data:
                        lookup[item[0]] = item[1]
                    
                    for file_path in response:
                        try:
                            image = lookup[file_path]
                            image.extracted_data = response[file_path]
                        except:
                            pass

                except Exception:
                    app.logger.info(' ')
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(traceback.format_exc())
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(' ')

                result.forget()

        GLOBALS.lock.release()

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

def clean_extracted_timestamp(text,dayfirst):
    '''Function that tries to clean up the messy extracted timestamps'''
    try:
        final_candidates = []
        disallowed_characters = ['°'] #allows us to remove number information like temperature
        terms_for_removal = [r'[0-9.,]+.?in[Hh]g',r'[0-9.,]+.?[°cCfF]'] # Temp & pressure trip up the parsing
        for term in terms_for_removal:
            finds = re.findall(term, text)
            for find in finds:
                text = text.replace(find,'')
        candidates = re.findall("[0-9]+[^0-9a-zA-Z]+[0-9]+[^0-9a-zA-Z]*[0-9]*", text)
        for candidate in candidates:
            if any(disallowed_character in candidate for disallowed_character in disallowed_characters): continue
            try:
                timestamp = dateutil_parse(candidate.replace(' ',''),fuzzy=True,dayfirst=dayfirst,default=datetime(year=2024,month=1,day=1))
                if timestamp.year<2000: continue
                if timestamp>=datetime.utcnow(): continue
                final_candidates.append(candidate.replace(' ',''))
            except:
                continue
        if len(final_candidates)==0: return text
        timestamp = ' '.join(final_candidates)
        if 'PM' in text: timestamp += ' PM'
        if 'AM' in text.replace('CAMERA','').replace('CAM',''): timestamp += ' AM' #we need to prevent the AM match in CAMERA
        return timestamp
    except:
        return text

@celery.task(bind=True,max_retries=5)
def get_timestamps(self,trapgroup_id,index=None):
    '''Videos have a poorly defined metadata standard. In order to get their timestamps consistently, we need to visually strip them from their frames. This can also be used to extract timestamps from images.'''

    try:
        starttime = time.time()
        textractClient = boto3.client('textract', region_name=Config.AWS_REGION)

        if index != None:  # Videos
            data = db.session.query(Camera.path+'/'+Image.filename,Image,Video)\
                                .join(Camera,Image.camera_id==Camera.id)\
                                .join(Video,Camera.videos)\
                                .filter(Image.filename.contains('frame'+str(index)))\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(Image.corrected_timestamp==None)\
                                .filter(Image.skipped!=True)\
                                .group_by(Video.id).distinct().all()
        else:  # Images
            data = db.session.query(Camera.path+'/'+Image.filename,Image)\
                                .join(Camera,Image.camera_id==Camera.id)\
                                .filter(~Camera.videos.any())\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(Image.corrected_timestamp==None)\
                                .filter(Image.skipped!=True)\
                                .group_by(Image.id).distinct().all()

        # Queue async requests
        job_ids = {}
        for item in data:
            path = item[0]
            image = item[1]

            retry = True
            retry_rate = 1
            while retry:
                try:
                    response = textractClient.start_document_text_detection(
                        DocumentLocation={
                            'S3Object': {
                                'Bucket': Config.BUCKET,
                                'Name': path
                            }
                        }
                    )
                    job_ids[image.id] = response['JobId']
                    retry = False
                except:
                    # AWS limits the number of simultaneous documents to ~150
                    print('retrying...')
                    retry_rate = 2*retry_rate
                    time.sleep(retry_rate)

        # Fetch results (which are stored a week)
        for item in data:
            image = item[1]
            status = 'PENDING'

            # Wait for completion
            while status != 'SUCCEEDED':
                response = textractClient.get_document_text_detection(
                    JobId=job_ids[image.id]
                )
                status = response['JobStatus']
                if status == 'FAILED': break 
                if status != 'SUCCEEDED': time.sleep(2)
            
            if status == 'FAILED': continue
            # Combine all text blocks - we want to try and preserve left-to-right order
            temp_text = {}
            for block in response['Blocks']:
                if block['BlockType']=='LINE':
                    temp_text[float(block['Geometry']['BoundingBox']['Left'])] = block['Text']
            temp_text = {k: v for k, v in sorted(temp_text.items(), key=lambda item: item[0])}
            text = [temp_text[key] for key in temp_text]
            text = ' '.join(text)

            # Save extracted text
            if index != None:
                video = item[2]
                video.extracted_text = text
            else:
                image.extracted_data = text

        # Determine dayFirst (default to True)
        # TODO: should probably only do this in the centre quartile
        dayfirst = True
        ordered_tests = []
        if index != None:
            tests = [r[0] for r in db.session.query(Video.extracted_text).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).distinct().all()]
        else:
            tests = [r[0] for r in db.session.query(Image.extracted_data).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).distinct().all()]
        for n in range(math.floor(len(tests)/2)):
            ordered_tests.append(tests[n])
            ordered_tests.append(tests[-n])

        for test in ordered_tests:
            try:
                timestamp = dateutil_parse(clean_extracted_timestamp(test,dayfirst),fuzzy=True,dayfirst=True,default=datetime.utcnow()+timedelta(days=365))
                if (timestamp.year<2000) or (timestamp>=datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)): continue #dateutil_parse uses todays date if there is only a time - need to filter this out
                if timestamp.day>12:
                    if len(test.split(str(timestamp.day))[0]) < len(test.split(str(timestamp.month))[0]):
                        dayfirst = True
                    else:
                        dayfirst = False
                    break
            except:
                pass

        # Search for outliers - starting with fetching previously processed timestamps
        dates = []
        if index != None:
            old_timestamps = [r[0] for r in db.session.query(Image.timestamp)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(Camera.videos.any())\
                                .filter(Image.filename.contains('frame'+str(index)))\
                                .filter(Image.timestamp != None)\
                                .distinct().all()]
        else:
            old_timestamps = [r[0] for r in db.session.query(Image.timestamp)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(~Camera.videos.any())\
                                .filter(Image.timestamp != None)\
                                .distinct().all()]
            
        for timestamp in old_timestamps:
            try:
                dates.append(pd.Timestamp(timestamp))
            except:
                pass

        # Search for outliers - now pre-process the current lot of timestamps
        parsed_timestamps = {}
        for item in data:
            if index != None:
                extracted_text = item[2].extracted_text
                item_id = item[2].id
            else:
                extracted_text = item[1].extracted_data
                item_id = item[1].id
            try:
                timestamp = dateutil_parse(clean_extracted_timestamp(extracted_text,dayfirst),fuzzy=True,dayfirst=dayfirst,default=datetime.utcnow()+timedelta(days=365))
                if (timestamp.year<2000) or (timestamp>=datetime.utcnow().replace(hour=0,minute=0,second=0,microsecond=0)): continue #dateutil_parse uses todays date if there is only a time - need to filter this out
                dates.append(pd.Timestamp(timestamp)) # this needs to be first - if it fails there is something wrong with the date and it should be dropped
                parsed_timestamps[item_id] = timestamp
            except:
                pass

        # Search for outliers - find the 98 percent quantiles for reference
        df = pd.DataFrame({'DATE': dates})
        IQR = df['DATE'].quantile(0.75) - df['DATE'].quantile(0.25)
        lower_limit = df['DATE'].quantile(0.25) - 1.5*IQR
        upper_limit = df['DATE'].quantile(0.75) + 1.5*IQR

        # Parse timestamp
        for item in data:
            if index != None:
                video = item[2]
                try:
                    timestamp = parsed_timestamps[video.id]

                    if upper_limit >= timestamp >= lower_limit:
                        fps = video.still_rate
                        video_timestamp = timestamp - timedelta(seconds=index/fps)

                        frames = db.session.query(Image).join(Camera).join(Video,Camera.videos).filter(Video.id==video.id).distinct().all()
                        for frame in frames:
                            frame_count = int(frame.filename.split('frame')[1][:-4])
                            frame_timestamp = video_timestamp + timedelta(seconds=frame_count/fps)
                            frame.timestamp = frame_timestamp
                            frame.corrected_timestamp = frame_timestamp
                            frame.extracted = True
                except:
                    pass
            else:
                image = item[1]
                try:
                    timestamp = parsed_timestamps[image.id]
                    if upper_limit >= timestamp >= lower_limit:
                        image.timestamp = timestamp
                        image.corrected_timestamp = timestamp
                        image.extracted = True
                except:
                    pass
        
        db.session.commit()
        app.logger.info('Timestamp extraction for trapgroup {} took {}s for {} {}'.format(trapgroup_id,time.time()-starttime,len(data),'videos' if index != None else 'images'))

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()

    return True

def extract_missing_timestamps(survey_id):
    '''Kicks off all the celery tasks for extracting timestamps from the videos/images in the given survey that doesn't have timestamps.'''

    # Process Videos
    starttime = time.time()
    index = 0
    trapgroup_ids = True
    while trapgroup_ids and index<=20:
        trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id)\
                                                .join(Camera)\
                                                .join(Image)\
                                                .filter(Trapgroup.survey_id==survey_id)\
                                                .filter(Camera.videos.any())\
                                                .filter(Image.filename.contains('frame'+str(index)))\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Image.skipped!=True)\
                                                .distinct().all()]
        for trapgroup_id in trapgroup_ids:
            get_timestamps(trapgroup_id,index)
        index += 4

    app.logger.info('All videos processed for survey {} in {}s after {} iterations'.format(survey_id,time.time()-starttime,(index/3)+1))

    # Process Images
    starttime = time.time()
    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id)\
                                                .join(Camera)\
                                                .join(Image)\
                                                .filter(Trapgroup.survey_id==survey_id)\
                                                .filter(~Camera.videos.any())\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Image.skipped!=True)\
                                                .distinct().all()]
    for trapgroup_id in trapgroup_ids:
        get_timestamps(trapgroup_id)

    app.logger.info('All images processed for survey {} in {}s'.format(survey_id,time.time()-starttime))

    # We can't parallelise this (timestamp extraction) at this stage - there is a maximum of 100 simultanrous async requests to AWS Textract 


    # Extrapolate Video timestamps
    camera_data = db.session.query(Cameragroup.id,func.SUBSTRING_INDEX(Camera.path, '/_video_images_',1))\
                                                .join(Camera)\
                                                .join(Image)\
                                                .join(Trapgroup)\
                                                .filter(Trapgroup.survey_id==survey_id)\
                                                .filter(Camera.videos.any())\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Image.skipped!=True)\
                                                .distinct().all()


    # Extrapolate Image timestamps
    camera_ids = [r[0] for r in db.session.query(Camera.id)\
                                                .join(Image)\
                                                .join(Trapgroup)\
                                                .filter(Trapgroup.survey_id==survey_id)\
                                                .filter(Image.corrected_timestamp==None)\
                                                .filter(Image.skipped!=True)\
                                                .filter(~Camera.videos.any())\
                                                .distinct().all()]
                                            

    results = []
    for cg_id, path in camera_data:
        results.append(extrapolate_timestamps.apply_async(kwargs={'camera_id':cg_id,'folder':path},queue='parallel'))

    for camera_id in camera_ids:
        results.append(extrapolate_timestamps.apply_async(kwargs={'camera_id':camera_id,'folder':None},queue='parallel'))

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

    return True

def wrapUpStaticDetectionCheck(survey_id):
    '''Wraps up the static status for detections after the static detections have been reviewed in the Preprocessing stage.'''	

    results = []
    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).join(Camera).join(Image).join(Detection).join(Staticgroup).filter(Trapgroup.survey_id==survey_id).distinct().all()]
    for trapgroup_id in trapgroup_ids:
        results.append(updateTrapgroupStaticDetections.apply_async(kwargs={'trapgroup_id':trapgroup_id},queue='parallel'))
    
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

    return True

@celery.task(bind=True,max_retries=5)
def updateTrapgroupStaticDetections(self,trapgroup_id):
    ''' Updates the static status for detections in a trapgroup after the static detections have been reviewed in the Preprocessing stage.'''
    try:
        static_detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .join(Staticgroup)\
                                    .filter(Camera.trapgroup_id==trapgroup_id)\
                                    .filter(or_(Staticgroup.status=='accepted',Staticgroup.status=='unknown'))\
                                    .filter(Detection.static!=True)\
                                    .distinct().all()

        for detection in static_detections:
            detection.static = True

        rejected_detections = db.session.query(Detection)\
                                    .join(Image)\
                                    .join(Camera)\
                                    .join(Staticgroup)\
                                    .filter(Camera.trapgroup_id==trapgroup_id)\
                                    .filter(Staticgroup.status=='rejected')\
                                    .filter(Detection.static!=False)\
                                    .distinct().all()

        for detection in rejected_detections:
            detection.static = False

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

@celery.task(bind=True,max_retries=5)
def extrapolate_timestamps(self,camera_id,folder=None):
    '''Extrapolates timestamp data from other extracted data for images where the extracted timestamp is missing'''
    try:
        if folder: #Videos
            images = db.session.query(Image,Video.id,Video.filename,Video.still_rate)\
                                .join(Camera, Camera.id==Image.camera_id)\
                                .join(Video)\
                                .filter(Camera.cameragroup_id==camera_id)\
                                .filter(Camera.path.contains(folder))\
                                .filter(Image.corrected_timestamp==None)\
                                .filter(Image.filename.contains('frame0'))\
                                .order_by(Video.filename)\
                                .distinct().all()

            timestamp_images = db.session.query(Video.filename,Image.corrected_timestamp)\
                                        .join(Camera, Camera.id==Video.camera_id)\
                                        .join(Image)\
                                        .filter(Camera.cameragroup_id==camera_id)\
                                        .filter(Camera.path.contains(folder))\
                                        .filter(Image.corrected_timestamp!=None)\
                                        .filter(Image.filename.contains('frame0'))\
                                        .order_by(Video.filename)\
                                        .distinct().all()
        else: #Images
            images = db.session.query(Image)\
                                .filter(Image.camera_id==camera_id)\
                                .filter(Image.corrected_timestamp==None)\
                                .order_by(Image.filename)\
                                .distinct().all()

            timestamp_images = db.session.query(Image.filename,Image.corrected_timestamp)\
                                        .filter(Image.camera_id==camera_id)\
                                        .filter(Image.corrected_timestamp!=None)\
                                        .order_by(Image.filename)\
                                        .distinct().all()

        timestamp_map = {filename: timestamp for filename, timestamp in timestamp_images}

        # Extrapolate timestamps
        # Find the closest images before and after the missing timestamp and get as much information as possible
        for image in images:
            try:
                img = image[0] if folder else image
                img.extracted_data = ''

                # Find closest images with timestamps
                image_filename = image[2] if folder else image.filename
                before = max((filename for filename in timestamp_map.keys() if filename < image_filename), key=lambda x: x, default=None)
                after = min((filename for filename in timestamp_map.keys() if filename > image_filename), key=lambda x: x, default=None)

                # Extrapolate timestamp
                if before and after:
                    before_time = timestamp_map[before]
                    after_time = timestamp_map[after]
                    time_diff = after_time - before_time

                    if time_diff.total_seconds() == 0:
                        # If the two timestamps are the same, just use that
                        if folder:
                            video_timestamp = before_time
                            fps = image[3]
                            frames = db.session.query(Image).join(Camera).join(Video,Camera.videos).filter(Video.id==image[1]).distinct().all()
                            for frame in frames:
                                frame_count = int(frame.filename.split('frame')[1][:-4])
                                frame_timestamp = video_timestamp + timedelta(seconds=frame_count/fps)
                                frame.timestamp = frame_timestamp
                                frame.corrected_timestamp = frame_timestamp
                                frame.extracted = True
                        else:
                            image.timestamp = before_time
                            image.corrected_timestamp = before_time
                            image.extracted = True
                    else:
                        # Extrapolate timestamp to prepopulate the timestamp 
                        timestamp = ''
                        if before_time.year == after_time.year:
                            timestamp += str(before_time.year)
                            if before_time.month == after_time.month:
                                timestamp += ','+str(before_time.month)
                                if before_time.day == after_time.day:
                                    timestamp += ','+str(before_time.day)
                                    if before_time.hour == after_time.hour:
                                        timestamp += ','+str(before_time.hour)
                                        if before_time.minute == after_time.minute:
                                            timestamp += ','+str(before_time.minute)
                                            if before_time.second == after_time.second:
                                                timestamp += ','+str(before_time.second)
                        if timestamp:
                            if folder:
                                image[0].extracted_data = timestamp
                            else:
                                image.extracted_data = timestamp
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

def recluster_survey(survey_id):
    '''Celery wrapper for parallising recluster_large_clusters on the the task and trapgroup levels.'''

    task_ids = [r[0] for r in db.session.query(Task.id).filter(Task.survey_id==survey_id).distinct().all()]
    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).distinct().all()]

    results = []
    for task_id in task_ids:
        for trapgroup_id in trapgroup_ids:
            results.append(recluster_large_clusters.apply_async(args=[task_id,True,trapgroup_id],queue='parallel'))
    
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

    return True

def import_live_data(survey_id):
    '''Imports live data for the given survey.'''

    results = []
    batch_count = 0
    batch = []
    chunk_size = round(10000/4)
    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True
    db.session.commit()

    cameras = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().all()
    for camera in cameras:
        to_process = [{'id': r[0], 'filename': r[1]} for r in db.session.query(Image.id, Image.filename).filter(Image.camera_id==camera.id).filter(~Image.detections.any()).distinct().all()]
        survey.images_processing += len(to_process)
        #Break folders down into chunks to prevent overly-large folders causing issues
        for chunk in chunker(to_process,chunk_size):
            batch.append({'sourceBucket':Config.BUCKET,
                            'dirpath':camera.path,
                            'filenames': chunk,
                            'trapgroup_id':camera.trapgroup_id,
                            'camera_id': camera.id,
                            'survey_id': survey_id,
                            'destBucket':Config.BUCKET,
                        })

            batch_count += len(chunk)

            if (batch_count / (((10000)*random.uniform(0.5, 1.5))/2) ) >= 1:
                results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':False,'external':False,'min_area':None,'remove_gps':False,'label_source':None,'live':True},queue='parallel'))
                app.logger.info('Queued batch with {} images'.format(batch_count))
                batch_count = 0
                batch = []


    if batch_count!=0:
        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':False,'external':False,'min_area':None, 'remove_gps':False,'label_source':None,'live':True},queue='parallel'))


    survey.processing_initialised = False
    db.session.commit()
    db.session.close()
    
    #Wait for import to complete
    # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
    # See https://github.com/celery/celery/issues/4480
    app.logger.info('Waiting for image processing to complete')
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
    app.logger.info('Image (Live) processing complete')

    # Remove any duplicate images that made their way into the database due to the parallel import process.
    remove_duplicate_images(survey_id)

    return True


def upload_zip(zip_folder, zip_file, survey_id, session):
    '''Uploads a zip file to S3 and then archives it to Deep Archive'''
    try:
        retry = True
        retry_attempts = 0
        retry_rate = 1
        new_zip = Zip(survey_id=survey_id)
        session.add(new_zip)
        session.commit()
        zip_key = zip_folder + '/' + str(new_zip.id) + '.zip'
        while retry and retry_attempts < 5:
            try:
                # NOTE: It is cheaper to upload to Standard and then copy to Deep Archive then to upload directly to Deep Archive because of multipart upload costs
                GLOBALS.s3client.upload_file(Bucket=Config.BUCKET, Key=zip_key, Filename=zip_file)
                GLOBALS.s3client.copy_object(Bucket=Config.BUCKET, Key=zip_key, CopySource={'Bucket': Config.BUCKET, 'Key': zip_key}, StorageClass='DEEP_ARCHIVE')
                retry = False
            except:
                retry_attempts += 1
                retry_rate = 2*retry_rate
                time.sleep(retry_rate)

        if retry:
            session.delete(new_zip)
            session.commit()
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=zip_key)
            return None
        else:
            return new_zip.id
    except:
        return None

@celery.task(bind=True,max_retries=5)
def archive_empty_images(self,trapgroup_id):
    ''' Archives empty images from a trapgroup that have not been archived yet. It zips them up and uploads them to the survey folder and deletes the original images.'''
    try:
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        camera_paths = list(set([cam.path for cam in trapgroup.cameras])) 
        survey_id = trapgroup.survey_id
        zip_folder = trapgroup.survey.organisation.folder + '-comp/' + Config.SURVEY_ZIP_FOLDER 
        session = db.session()

        # Get all unarchived files
        unarchived_files = []
        unarchived_file_sizes = []
        for cam_path in camera_paths:
            splits = cam_path.split('/')
            splits[0] = splits[0]+'-comp'
            comp_path = '/'.join(splits)
            for dirpath, folders, filenames in s3traverse(Config.BUCKET, comp_path, include_size=True):
                for filename in filenames:
                    unarchived_files.append(dirpath+'/'+filename[0])
                    unarchived_file_sizes.append(filename[1])

        # Get all images from empty clusters that have not been archived and zip them together
        cluster_sq = session.query(Cluster.id)\
                                .join(Image, Cluster.images)\
                                .join(Detection)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .distinct().subquery()             


        image_data = session.query(Image, Camera.path)\
                            .join(Camera, Image.camera_id==Camera.id)\
                            .join(Cluster, Image.clusters)\
                            .outerjoin(cluster_sq, cluster_sq.c.id==Cluster.id)\
                            .filter(Camera.trapgroup_id==trapgroup_id)\
                            .filter(cluster_sq.c.id==None)\
                            .filter(Image.zip_id==None)\
                            .distinct().all()

        images = []
        for item in image_data:
            image_key = item[1] + '/' + item[0].filename
            splits = image_key.split('/')
            splits[0] = splits[0]+'-comp'
            comp_image_key = '/'.join(splits)
            if comp_image_key in unarchived_files:
                index = unarchived_files.index(comp_image_key)
                images.append((item[0], comp_image_key, unarchived_file_sizes[index]))

        if images:
            size_limit = 1.5*(2**30) # size limit is 1.5GB (available on worker)
            counter = 0
            current_zip_size = 0
            zipped_images = []
            for image in images:
                if current_zip_size + image[2] > size_limit:
                    if zipf: zipf.close()
                    zip_id = upload_zip(zip_folder, site_zip, survey_id, session)
                    if zip_id:
                        # Delete raw & comp images
                        for img, key in zipped_images:
                            img.zip_id = zip_id
                            comp_image_key = key
                            image_key = comp_image_key.replace('-comp','')
                            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=comp_image_key)
                            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_key)
                        session.commit()
                    os.remove(site_zip)
                    counter += 1
                    current_zip_size = 0
                    zipped_images = []

                if current_zip_size == 0:
                    if counter == 0:
                        site_zip = str(trapgroup.id) + '.zip'
                    else:
                        site_zip = str(trapgroup.id) + '_' + str(counter) + '.zip'
                    zipf = zipfile.ZipFile(site_zip, 'w', allowZip64=True)

                image_id = image[0].id
                comp_image_key = image[1]
                image_size = image[2]
                image_fn = str(image_id) + '.jpg'
                GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=comp_image_key, Filename=image_fn)
                zipf.write(image_fn)
                os.remove(image_fn)
                current_zip_size += image_size
                zipped_images.append((image[0], comp_image_key))


            if current_zip_size > 0:
                if zipf: zipf.close()
                zip_id = upload_zip(zip_folder, site_zip, survey_id, session)
                if zip_id:
                    # Delete raw & comp images
                    for img, key in zipped_images:
                        img.zip_id = zip_id
                        comp_image_key = key
                        image_key = comp_image_key.replace('-comp','')
                        GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=comp_image_key)
                        GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_key)
                    session.commit()
                os.remove(site_zip)

                                   
    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        session.close()

    return True

@celery.task(bind=True,max_retries=5)
def archive_images(self,trapgroup_id):
    ''' Archive all raw images from clusters containing images that has at least one detection above the threshold'''
    try:
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        camera_paths = list(set([cam.path for cam in trapgroup.cameras])) 

        # Get all unarchived files
        unarchived_files = []
        for cam_path in camera_paths:
            for dirpath, folders, filenames in s3traverse(Config.BUCKET, cam_path):
                unarchived_files.extend([dirpath+'/'+filename for filename in filenames])

        # Get all images from non-empty clusters that have not been archived and archive them
        cluster_sq = db.session.query(Cluster.id)\
                                .join(Image, Cluster.images)\
                                .join(Detection)\
                                .join(Camera)\
                                .filter(Camera.trapgroup_id==trapgroup_id)\
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                .distinct().subquery()


        images = db.session.query(Image.id, Image.filename, Camera.path)\
                            .join(Camera, Image.camera_id==Camera.id)\
                            .join(Cluster, Image.clusters)\
                            .join(cluster_sq, cluster_sq.c.id==Cluster.id)\
                            .filter(Camera.trapgroup_id==trapgroup_id)\
                            .filter(cluster_sq.c.id!=None)\
                            .distinct().all()

        for image in images:     
            image_key = image[2] + '/' + image[1]
            if image_key in unarchived_files:
                copy_source = {
                    'Bucket': Config.BUCKET,
                    'Key': image_key
                }
                GLOBALS.s3client.copy_object(Bucket=Config.BUCKET, Key=image_key, CopySource=copy_source, StorageClass='DEEP_ARCHIVE')
                     

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

@celery.task(bind=True,max_retries=5)
def archive_videos(self,cameragroup_id):
    ''' Archive all non-empty compressed videos from a cameragroup that have not been archived yet and delete the empty compressed videos'''
    try:
        cameragroup = db.session.query(Cameragroup).get(cameragroup_id)
        video_paths = []
        for camera in cameragroup.cameras:
            if camera.videos:
                video_path = camera.path.split('/_video_images_')[0]
                splits = video_path.split('/')
                splits[0] = splits[0]+'-comp'
                comp_video_path = '/'.join(splits)
                if comp_video_path not in video_paths:
                    video_paths.append(comp_video_path)

        unarchived_files = []
        for path in video_paths:
            for dirpath, folders, filenames in s3traverse(Config.BUCKET, path):
                unarchived_files.extend([dirpath+'/'+filename for filename in filenames if filename.endswith('.mp4')])


        cam_sq = db.session.query(Camera.id)\
                                    .join(Image)\
                                    .join(Detection)\
                                    .filter(Camera.videos.any())\
                                    .filter(Camera.cameragroup_id==cameragroup_id)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                    .subquery()

        videos = db.session.query(Video.id,Video.filename,Camera.path)\
                            .join(Camera)\
                            .join(cam_sq, cam_sq.c.id==Camera.id)\
                            .filter(Camera.cameragroup_id==cameragroup_id)\
                            .filter(cam_sq.c.id!=None)\
                            .distinct().all()

        empty_videos = db.session.query(Video.id,Video.filename,Camera.path)\
                        .join(Camera)\
                        .outerjoin(cam_sq, cam_sq.c.id==Camera.id)\
                        .filter(Camera.cameragroup_id==cameragroup_id)\
                        .filter(cam_sq.c.id==None)\
                        .distinct().all()
        
        for video in videos:
            video_path = video[2].split('/_video_images_/')[0]
            splits = video_path.split('/')
            splits[0] = splits[0]+'-comp'
            video_key = '/'.join(splits) + '/' + video[1].split('.')[0] + '.mp4'
            if video_key in unarchived_files:
                copy_source = {
                    'Bucket': Config.BUCKET,
                    'Key': video_key
                }
                GLOBALS.s3client.copy_object(Bucket=Config.BUCKET, Key=video_key, CopySource=copy_source, StorageClass='DEEP_ARCHIVE')
            # Delete raw video
            raw_video_key = video_path + '/' + video[1]
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=raw_video_key)

        
        for video in empty_videos:
            video_path = video[2].split('/_video_images_/')[0]
            splits = video_path.split('/')
            splits[0] = splits[0]+'-comp'
            video_key = '/'.join(splits) + '/' + video[1].split('.')[0] + '.mp4'
            if video_key in unarchived_files:
                GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=video_key)
            # Delete raw video
            raw_video_key = video_path + '/' + video[1]
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=raw_video_key)


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

def archive_survey(survey_id):
    ''' 
    Moves the following date to Glacier Deep Archive storage in S3:
        - Raw animal Images 
        - Compressed videos
        - Compressed empty images which are zipped together. (Raw & comp empty images are deleted)
    '''

    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).distinct().all()]
    cameragroup_ids = [r[0] for r in db.session.query(Cameragroup.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.videos.any()).distinct().all()]

    # Compressed Videos
    video_results = []
    for cameragroup_id in cameragroup_ids:
        video_results.append(archive_videos.apply_async(kwargs={'cameragroup_id':cameragroup_id},queue='parallel'))

    #Wait for processing to complete
    db.session.remove()
    GLOBALS.lock.acquire()
    with allow_join_result():
        for result in video_results:
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


    # Empty Images
    empty_results = []
    for trapgroup_id in trapgroup_ids:
        empty_results.append(archive_empty_images.apply_async(kwargs={'trapgroup_id':trapgroup_id},queue='parallel'))

    #Wait for processing to complete
    db.session.remove()
    GLOBALS.lock.acquire()
    with allow_join_result():
        for result in empty_results:
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


    # Raw Animal Images
    image_results = []
    for trapgroup_id in trapgroup_ids:
        image_results.append(archive_images.apply_async(kwargs={'trapgroup_id':trapgroup_id},queue='parallel'))

    #Wait for processing to complete
    db.session.remove()
    GLOBALS.lock.acquire()
    with allow_join_result():
        for result in image_results:
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

    return True

def process_folder(s3Folder, survey_id, sourceBucket):
    '''
    Import all images from an AWS S3 folder. Handles re-import of a folder cleanly.

        Parameters:
            s3Folder (str): folder name to import
            survey_id (int): The ID of the survey to be processed
            sourceBucket (str): Bucket from which import takes place
    '''
    
    localsession=db.session()
    survey = localsession.query(Survey).get(survey_id)
    # survey = Survey.get_or_create(localsession,name=name,organisation_id=organisation_id,trapgroup_code=tag)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True

    localsession.commit()
    sid=survey.id
    tag = survey.trapgroup_code
    tag = re.compile(tag)

    # Create trapgroups for each camera & batch images for detection
    results = []
    batch_count = 0
    batch = []
    chunk_size = round(10000/4)
    s3Folder = s3Folder.replace('_','\\_')
    cameras = localsession.query(Camera).filter(Camera.path.like(s3Folder+'/%')).distinct().all()
    for camera in cameras:
        if '/_video_images_/' in camera.path:
            tags = tag.search(camera.path.replace(survey.name+'/','').split('/_video_images_/')[0])
        else:
            tags = tag.search(camera.path.replace(survey.name+'/',''))
        
        if tags:
            camera_name = extract_camera_name(survey.camera_code,survey.trapgroup_code,survey.name,tags.group(),camera.path)
            if camera_name:
                trapgroup = Trapgroup.get_or_create(localsession, tags.group(), sid)
                camera.trapgroup = trapgroup

                images_to_process = [{'id': r[0], 'filename': r[1]} for r in localsession.query(Image.id,Image.filename).filter(Image.camera==camera).filter(~Image.detections.any()).filter(Image.hash!=None).all()]
                survey.images_processing += len(images_to_process)

                if images_to_process and trapgroup.latitude == 0 and trapgroup.longitude == 0 and trapgroup.altitude == 0:
                    # Try and extract latitude and longitude and altitude
                    try:
                        gps_file = images_to_process[0]['filename']
                        gps_key = os.path.join(camera.path,gps_file)
                        with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                            GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=gps_key, Filename=temp_file.name)
                            exif_data = piexif.load(temp_file.name)
                            if exif_data['GPS']:
                                gps_keys = exif_data['GPS'].keys()
                                if piexif.GPSIFD.GPSLatitude in gps_keys:
                                    lat = exif_data['GPS'][piexif.GPSIFD.GPSLatitude]
                                    trapgroup.latitude = lat[0][0]/lat[0][1] + lat[1][0]/lat[1][1]/60 + lat[2][0]/lat[2][1]/3600
                                    if piexif.GPSIFD.GPSLatitudeRef in gps_keys:
                                        lat_ref = exif_data['GPS'][piexif.GPSIFD.GPSLatitudeRef]
                                        if lat_ref == b'S': trapgroup.latitude = -trapgroup.latitude
                                if piexif.GPSIFD.GPSLongitude in gps_keys:
                                    lon = exif_data['GPS'][piexif.GPSIFD.GPSLongitude]
                                    trapgroup.longitude = lon[0][0]/lon[0][1] + lon[1][0]/lon[1][1]/60 + lon[2][0]/lon[2][1]/3600
                                    if piexif.GPSIFD.GPSLongitudeRef in gps_keys:
                                        lon_ref = exif_data['GPS'][piexif.GPSIFD.GPSLongitudeRef]
                                        if lon_ref == b'W': trapgroup.longitude = -trapgroup.longitude
                                if piexif.GPSIFD.GPSAltitude in gps_keys:
                                    alt = exif_data['GPS'][piexif.GPSIFD.GPSAltitude]
                                    trapgroup.altitude = alt[0]/alt[1]
                                    if piexif.GPSIFD.GPSAltitudeRef in gps_keys:
                                        alt_ref = exif_data['GPS'][piexif.GPSIFD.GPSAltitudeRef]
                                        if alt_ref == 1: trapgroup.altitude = -trapgroup.altitude
                                if Config.DEBUGGING: app.logger.info('Extracted GPS data from {}'.format(gps_key))	    
                    except:
                        pass

                localsession.commit()

                #Break folders down into chunks to prevent overly-large folders causing issues
                for chunk in chunker(images_to_process,chunk_size):
                    batch.append({'images': chunk,'dirpath': camera.path})
                    batch_count += len(chunk)

                    if (batch_count / (((10000)*random.uniform(0.5, 1.5))/2) ) >= 1:
                        results.append(generateDetections.apply_async(kwargs={'batch':batch, 'sourceBucket':sourceBucket},queue='parallel'))
                        app.logger.info('Queued batch with {} images'.format(batch_count))
                        batch_count = 0
                        batch = []


    if batch_count!=0:
        results.append(generateDetections.apply_async(kwargs={'batch':batch, 'sourceBucket':sourceBucket},queue='parallel'))

    survey.processing_initialised = False
    localsession.commit()
    localsession.close()
    
    #Wait for import to complete
    app.logger.info('Waiting for image processing to complete')
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
    app.logger.info('Image processing complete')



    # Cleanup images, videos & cameras from lambda imports
    remove_duplicate_videos(sid)
    remove_duplicate_images(sid)
    handle_duplicate_cameras(sid)

    return True

def handle_duplicate_cameras(survey_id):
    '''Handles duplicate cameras in a survey by merging them into a single camera object.'''

    sq = db.session.query(Camera.path.label('path'),func.count(distinct(Camera.id)).label('count'))\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .group_by(Camera.path)\
                        .subquery()
                        
    duplicates = db.session.query(Camera.path)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .join(sq,sq.c.path==Camera.path)\
                        .filter(sq.c.count>1)\
                        .all()

    for path in duplicates:
        cameras = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.path==path).distinct().all()
        if len(cameras) == 1: continue
        camera = cameras[0]
        duplicate_cameras = cameras[1:]
        for duplicate in duplicate_cameras:
            for image in duplicate.images:
                image.camera_id = camera.id
            for video in duplicate.videos:
                video.camera_id = camera.id
            db.session.delete(duplicate)
        db.session.commit()

    return True
    

@celery.task(bind=True,max_retries=5)
def generateDetections(self,batch, sourceBucket):
    '''
    Generates detections for a batch of images. 
    '''
    try:
        #Prep bacthes
        GLOBALS.results_queue = []
        pool = Pool(processes=4)
        print('Received generateDetections task with {} batches.'.format(len(batch)))
        for item in batch:
            dirpath = item['dirpath']
            jpegs = item['images']
            
            print("Generating detctions for {} with batch of {} images.".format(dirpath,len(jpegs)))
                
            for image_data in chunker(jpegs,100):
                pool.apply_async(batch_images_for_detection_only, args=(image_data,sourceBucket,dirpath))

        pool.close()
        pool.join()

        # Fetch the results
        if Config.DEBUGGING: print('{} batch results to fetch'.format(len(GLOBALS.results_queue)))
        counter = 0
        GLOBALS.lock.acquire()
        with allow_join_result():
            for images, result in GLOBALS.results_queue:
                try:
                    counter += 1
                    if Config.DEBUGGING: print('Fetching result {}'.format(counter))
                    starttime = datetime.utcnow()
                    response = result.get()
                    if Config.DEBUGGING: print('Fetched result {} after {}.'.format(counter,datetime.utcnow()-starttime))

                    for img, detections in zip(images, response):
                        try:
                            image = db.session.query(Image).get(img['id'])
                            image.detections = [Detection(**detection) for detection in detections]
                            for detection in image.detections:
                                db.session.add(detection)
                        
                        except Exception:
                            app.logger.info(' ')
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(traceback.format_exc())
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(' ')
                            # db.session.rollback()
                
                except Exception:
                    app.logger.info(' ')
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(traceback.format_exc())
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(' ')
                    # db.session.rollback()
                
                result.forget()
        GLOBALS.lock.release()

        #Commit the last batch
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

def batch_images_for_detection_only(image_data,sourceBucket,dirpath,external=False):
    ''' Helper function that batches images and adds them to the queue to be run through the detector. '''
    try:
        batch = []
        images = []
        for image in image_data:
            batch.append(dirpath + '/' + image['filename'])
            images.append(image)
        
        if batch:
            if Config.DEBUGGING: print('Acquiring lock')
            GLOBALS.lock.acquire()
            print('Queueing batch')
            GLOBALS.results_queue.append((images, detection.apply_async(kwargs={'batch': batch,'sourceBucket':sourceBucket,'external':external,'model':Config.DETECTOR}, queue='celery', routing_key='celery.detection')))
            GLOBALS.lock.release()
            if Config.DEBUGGING: print('Lock released')

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    return True
