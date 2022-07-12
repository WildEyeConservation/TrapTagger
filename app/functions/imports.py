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
# from app.functions.admin import delete_task, reclusterAfterTimestampChange
from app.functions.globals import detection_rating, randomString, updateTaskCompletionStatus, updateLabelCompletionStatus, updateIndividualIdStatus, retryTime, chunker, save_crops, list_all, classifyTask
import GLOBALS
from sqlalchemy.sql import func, or_, distinct
from sqlalchemy import desc
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
from megadetectorworker.megaDetector import infer, classify
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
    cluster.classification = single_cluster_classification(cluster)
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

def findImID(survey_id,fullPath):
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
    image = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.path==path).filter(Image.filename==filename).first()
    if image == None:
        return np.nan
    else:
        return image.id

@celery.task(bind=True,max_retries=29,ignore_result=True)
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
        if os.path.isfile(filePath):
            df = pd.read_csv(filePath)

            df['image_id'] = df.apply(lambda x: findImID(survey_id,x.filename), axis=1)
            df = df[df['image_id'].notna()]
            del df['filename']

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

            localsession=db.session()
            df.apply(lambda x: clusterAndLabel(localsession,task_id,user_id,x.image_id,x.labels), axis=1)
            # localsession.commit()

            sq = localsession.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task_id==task_id).subquery()
            images = localsession.query(Image).outerjoin(sq, sq.c.id==Image.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(sq.c.id==None).all()

            for image in images:
                cluster = Cluster(task_id=task_id)
                localsession.add(cluster)
                cluster.images = [image]
                cluster.classification = single_cluster_classification(cluster)
            
            localsession.commit()
            os.remove(filePath)

        # # Classify clusters
        task = db.session.query(Task).get(task_id)
        # pool = Pool(processes=4)
        # for trapgroup in task.survey.trapgroups:
        #     pool.apply_async(classifyTrapgroup,(task.id,trapgroup.id))
        # pool.close()
        # pool.join()

        task.status = 'Ready'
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

def importKML(survey_id):
    '''Import kml file for specified survey. Looks for matching trapgroup tags and placemark names. Overwrites old coordinates.'''
    
    survey = db.session.query(Survey).get(survey_id)
    bucketName = survey.user.bucket
    key = 'kmlFiles/' + survey.name + '.kml'
    
    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.kml') as temp_file:
            GLOBALS.s3client.download_file(Bucket=bucketName, Key=key, Filename=temp_file.name)

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

def recluster_large_clusters(task_id,updateClassifications,reClusters = None):
    '''
    Reclusters all clusters with over 50 images, by more strictly defining clusters based on classifications. Failing that, clusters are simply limited to 50 images.

        Parameters:
            task_id (int): Task for which the reclustering should be performed
            updateClassifications (bool): Whether the new clusters should be species classified or not
            reClusters (list): An optional list of clusters that should be reclustered instead of all clusters over 50 images in length

        Returns:
            removedClusters (list): List of cluster IDs that have been removed
            newClusters (list): List of cluster IDs that have been added
    '''
    
    downLabel = db.session.query(Label).get(GLOBALS.knocked_id)

    subq = db.session.query(Cluster.id.label('clusterID'),func.count(distinct(Image.id)).label('imCount'))\
                .join(Image,Cluster.images)\
                .filter(Cluster.task_id==task_id)\
                .group_by(Cluster.id)\
                .subquery()
                
    clusters = db.session.query(Cluster)\
                .join(subq,subq.c.clusterID==Cluster.id)\
                .filter(Cluster.task_id==task_id)\
                .filter(subq.c.imCount>50)\
                .filter(~Cluster.labels.contains(downLabel))

    if reClusters != None:
        clusters = clusters.filter(Cluster.id.in_(reClusters))

    clusters = clusters.all()

    removedClusters = [cluster.id for cluster in clusters]
    newClusters = []

    for cluster in clusters:
        currCluster = None
        images = db.session.query(Image).filter(Image.clusters.contains(cluster)).order_by(Image.corrected_timestamp).all()
        cameras = db.session.query(Camera).join(Image).filter(Image.clusters.contains(cluster)).distinct().all()
        cameras = [str(camera.id) for camera in cameras]
        prevLabels = {}
        for cam in cameras:
            prevLabels[cam] = []
                
        for image in images:
            detections = db.session.query(Detection)\
                                .filter(Detection.image_id==image.id)\
                                .filter(Detection.score>0.8)\
                                .filter(Detection.static==False)\
                                .filter(~Detection.status.in_(['deleted','hidden']))\
                                .all()

            if len(detections) == 0:
                species = ['nothing']
            else:
                species = []
                for detection in detections:
                    if (detection.class_score > Config.CLASS_SCORE) and (detection.classification != 'nothing'):
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
                    currCluster.classification = single_cluster_classification(currCluster)
                currCluster = Cluster(task_id=task_id)
                db.session.add(currCluster)
                newClusters.append(currCluster)
                prevLabels = {}
                for cam in cameras:
                    prevLabels[cam] = []

            currCluster.images.append(image)
            prevLabels[str(image.camera_id)] = species

        if currCluster and updateClassifications:
            currCluster.classification = single_cluster_classification(currCluster)

        cluster.images = []
        db.session.delete(cluster)
        db.session.commit()

    return removedClusters,[cluster.id for cluster in newClusters]

@celery.task(bind=True,max_retries=29)
def cluster_trapgroup(self,trapgroup_id):
    '''Clusters the specified trapgroup. Handles pre-existing clusters cleanly, reusing labels etc where possible.'''
    
    try:
        trapgroup = db.session.query(Trapgroup).get(trapgroup_id)
        survey = trapgroup.survey

        #Check if trapgroup has already been clustered
        if (db.session.query(Cluster).join(Image, Cluster.images).join(Camera).filter(Camera.trapgroup==trapgroup).first()):

            #Clustering an already-clustered survey, trying to preserve labels etc.
            downLabel = db.session.query(Label).get(GLOBALS.knocked_id)
            for task in survey.tasks:
                sq = db.session.query(Image.id).join(Cluster, Image.clusters).filter(Cluster.task==task).subquery()
                images = db.session.query(Image)\
                                .outerjoin(sq, sq.c.id==Image.id)\
                                .join(Camera)\
                                .filter(Camera.trapgroup==trapgroup)\
                                .filter(sq.c.id==None)\
                                .order_by(Image.corrected_timestamp)\
                                .distinct().all()
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

                        detections = db.session.query(Detection).filter(Detection.image_id==image.id).all()
                        for detection in detections:
                            labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                            db.session.add(labelgroup)

                    elif len(potentialClusters) == 1:
                        potentialClusters[0].images.append(image)

                        detections = db.session.query(Detection).filter(Detection.image_id==image.id).all()
                        for detection in detections:
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

                                detections = db.session.query(Detection).filter(Detection.image_id==image.id).all()
                                for detection in detections:
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

                            detections = db.session.query(Detection).filter(Detection.image_id==image.id).all()
                            for detection in detections:
                                labelgroup = Labelgroup(detection_id=detection.id,task_id=task.id,checked=False)
                                db.session.add(labelgroup)

                            for im in potentialClusters[0].images:
                                labelgroups = db.session.query(Labelgroup).join(Detection).filter(Detection.image_id==im.id).filter(Labelgroup.task_id==task.id).all()
                                for labelgroup in labelgroups:
                                    labelgroup.labels = potentialClusters[0].labels
                                    labelgroup.tags = potentialClusters[0].tags
            db.session.commit()

        else:
            #Clustering with a clean slate
            images = db.session.query(Image).join(Camera).filter(Camera.trapgroup == trapgroup).order_by(Image.corrected_timestamp).all()
            prev = None
            if images != []:
                for image in images:
                    timestamp = image.corrected_timestamp
                    if not (prev) or ((timestamp - prev).total_seconds() > 60):
                        if prev is not None:
                            for cluster in clusters:
                                cluster.images=imList
                        clusters = []
                        for task in survey.tasks:
                            cluster = Cluster(task_id=task.id)
                            db.session.add(cluster)
                            clusters.append(cluster)
                        imList = []
                    prev = timestamp
                    imList.append(image)
                for cluster in clusters:
                    cluster.images=imList
            db.session.commit()

            # add task detection labels
            for task in survey.tasks:
                for camera in trapgroup.cameras:
                    detections = db.session.query(Detection).join(Image).filter(Image.camera_id==camera.id).all()
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

def cluster_survey(survey_id,queue='parallel'):
    '''Cluster the specified survey. Automatically handles additional images vs. initial clustering. Returns the default task id for the survey.'''
    
    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Clustering'
    db.session.commit()
    task = db.session.query(Task).filter(Task.survey==survey).filter(Task.name=='default').first()
    if task != None:
        for surveyTask in survey.tasks:
            surveyTask.complete = False
        db.session.commit()
    else:
        task = Task(name='default', survey_id=survey.id, tagging_level='-1', test_size=0, status='Ready')
        db.session.add(task)
        db.session.commit()

    results = []
    for trapgroup in survey.trapgroups:
        results.append(cluster_trapgroup.apply_async(kwargs={'trapgroup_id':trapgroup.id},queue=queue))

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
    
@celery.task(bind=True,max_retries=29)
def processCameraStaticDetections(self,camera_id,imcount):
    '''Checks all the detections associated with a given camera ID to see if they are static or not.'''

    try:
        ###### Single query approach
        queryTemplate1="""
            SELECT 
                    id1 AS detectionID,
                    COUNT(*) AS matchCount
            FROM
                (SELECT 
                    det1.id AS id1,
                    GREATEST(LEAST(det1.right, det2.right) - GREATEST(det1.left, det2.left), 0) * 
                    GREATEST(LEAST(det1.bottom, det2.bottom) - GREATEST(det1.top, det2.top), 0) AS intersection,
                    (det1.right - det1.left) * (det1.bottom - det1.top) AS area1,
                    (det2.right - det2.left) * (det2.bottom - det2.top) AS area2
                FROM
                    detection AS det1
                    JOIN detection AS det2
                    JOIN image AS image1
                    JOIN image AS image2
                ON 
                    image1.camera_id = image2.camera_id
                    AND image1.id = det1.image_id
                    AND image2.id = det2.image_id
                    AND image1.id != image2.id 
                WHERE
                    det1.score > 0.8 
                    AND image1.camera_id = {}
                    AND det1.id IN ({})
                    AND det2.id IN ({})
                    ) AS sq1
            WHERE
                area1 < 0.1
                    AND sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.7 GROUP BY id1
        """

        detections = [r.id for r in db.session.query(Detection)\
                                            .join(Image)\
                                            .filter(Image.camera_id==camera_id)\
                                            .filter(Detection.score>0.5)\
                                            .order_by(Image.corrected_timestamp)\
                                            .distinct().all()]

        for chunk in chunker(detections,10000):
            if (len(chunk)<10000) and (len(detections)>10000):
                chunk = detections[-10000:]
            det_ids = ','.join([str(r) for r in chunk])
            for det_id,matchcount in db.session.execute(queryTemplate1.format(camera_id,det_ids,det_ids)):
                if matchcount>3 and matchcount/imcount>0.3:
                    detection = db.session.query(Detection).get(det_id)
                    detection.static = True
            db.session.commit()

        ###### individual detection approach
        # sq = db.session.query(Detection.id.label('detID'),((Detection.right - Detection.left) * (Detection.bottom - Detection.top)).label('area')).join(Image).filter(Image.camera_id==camera_id).subquery()
        # detections = [r.id for r in db.session.query(Detection)\
        #                                     .join(Image)\
        #                                     .join(sq,sq.c.detID==Detection.id)\
        #                                     .filter(sq.c.area<0.1)\
        #                                     .filter(Image.camera_id==camera_id)\
        #                                     .filter(Detection.score>0.8)\
        #                                     .distinct().all()]
        # pool = Pool(processes=4)
        # for chunk in chunker(detections,200):
        #     pool.apply_async(checkDetectionStaticStatus,(imcount,chunk))
        # pool.close()
        # pool.join()

        detections = db.session.query(Detection).join(Image).filter(Image.camera_id == camera_id) \
                                                            .filter(Detection.static == None)\
                                                            .distinct().all()
        for detection in detections:
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

def processStaticDetections(survey):
    '''Identify static detections for a survey based on IOU and percentage of images of a camera containing a detection.'''

    detections = db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey.id).filter(Detection.static==True).all()
    for detection in detections:
        detection.static = False
    db.session.commit()

    results = []
    for camera_id, imcount in db.session.query(Image.camera_id, func.count(distinct(Image.id))).join('camera', 'trapgroup').filter(Trapgroup.survey_id == survey.id).group_by(Image.camera_id):
        results.append(processCameraStaticDetections.apply_async(kwargs={'camera_id':camera_id,'imcount':imcount},queue='parallel'))
    
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

def removeHumans(task_id):
    '''Marks clusters from specified as containing humans if the majority of their detections are classified as non-animal by MegaDetector.'''

    admin = db.session.query(User).filter(User.username == 'Admin').first()
    human_label = db.session.query(Label).get(GLOBALS.vhl_id)

    results = db.session.query(func.count(Detection.category),
                                  func.count(func.nullif(Detection.category, 1)),Cluster.id)\
                                  .join('image', 'clusters')\
                                  .filter(Detection.score>0.8)\
                                  .filter(Detection.static==False)\
                                  .filter(~Detection.status.in_(['deleted','hidden']))\
                                  .filter(~Cluster.labels.any())\
                                  .filter(Cluster.task_id==task_id)\
                                  .group_by(Cluster)

    clusters_to_label=[cluster_id for total_dets,non_animal_dets,cluster_id in results if (non_animal_dets/total_dets>0.5)]
    for chunk in chunker(clusters_to_label,500):
        clusters = [db.session.query(Cluster).get(id) for id in chunk]
        for cluster in clusters:
            cluster.labels = [human_label]
            cluster.user_id = admin.id
            cluster.timestamp = datetime.utcnow()

            labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task_id==task_id).all()
            for labelgroup in labelgroups:
                labelgroup.labels = [human_label]
        db.session.commit()

def setupDatabase():
    '''Adds compulsory labels and admin user to the databse on first start up.'''
    
    if db.session.query(User).filter(User.username=='Admin').first()==None:
        user = User(username = 'Admin', passed = 'pending', admin=True)
        user.set_password(Config.SECRET_KEY)
        db.session.add(user)
    
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

    db.session.commit()

def batch_images(camera_id,filenames,sourceBucket,dirpath,destBucket,survey_id,pipeline,external):
    ''' Helper function for importImages that batches images and adds them to the queue to be run through the detector. '''

    try:

        warnings.filterwarnings('error')
        #TODO : The line above is to treat warnings as errors, this is necesary because when wand cannot read or can only
        # partially read a corrupted image, it issues a warning rather than a error. In order to trap these cases and keep
        # them out of the DB, I need to treat them as errors. However this exposes a ResourceWarning caused by pyexifinfo's
        # failure to properly close the Popen object that it uses to read the output of exiftool. The line below just
        # suppresses this back down to warning level, but ideally we should go fix this inside pyexifinfo itself or use an
        # alternative exif API.
        warnings.filterwarnings('ignore',category=ResourceWarning)

        batch = []
        images = []
        for filename in filenames:
            hash = None
            if not pipeline: hash = GLOBALS.s3client.head_object(Bucket=sourceBucket,Key=os.path.join(dirpath, filename))['ETag'][1:-1]
            if pipeline or ((db.session.query(Image).filter(Image.camera_id==camera_id).filter(Image.filename==filename).first()==None) and (db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Image.hash==hash).first()==None)):
                with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                    if not pipeline:
                        print('Downloading {}'.format(filename))
                        GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=os.path.join(dirpath, filename), Filename=temp_file.name)
                        
                        try:
                            print('Extracting time stamp from {}'.format(filename))
                            t = pyexifinfo.get_json(temp_file.name)[0]
                            timestamp = None
                            for field in ['EXIF:DateTimeOriginal','MakerNotes:DateTimeOriginal']:
                                if field in t.keys():
                                    timestamp = datetime.strptime(t[field], '%Y:%m:%d %H:%M:%S')
                                    break
                            assert timestamp
                        except (KeyError, ValueError):
                            app.logger.info("Skipping {} could not extract timestamp...".format(dirpath+'/'+filename))
                            continue
                    else:
                        # don't need to download the image or even extract a timestamp if pipelining
                        timestamp = None
                    
                    try:
                        if not pipeline:
                            # don't compress and upload the image if its a training-data pipeline
                            print('Compressing {}'.format(filename))
                            with wandImage(filename=temp_file.name).convert('jpeg') as img:
                                # This is required, because if we don't have it ImageMagick gets too clever for it's own good
                                # and saves images with no color content (i.e. fully black image) as grayscale. But this causes
                                # problems for MegaDetector which expects a 3 channel image as input.
                                img.metadata['colorspace:auto-grayscale'] = 'false'
                                img.transform(resize='800')
                                if not pipeline:
                                    print('Uploading {}'.format(filename))
                                    GLOBALS.s3client.upload_fileobj(BytesIO(img.make_blob()),destBucket, dirpath + '/' + filename)
                                # bio=BytesIO(img.make_blob())
                                # b64blob=base64.b64encode(bio.getvalue()).decode()

                        ########Blob Approach
                        #The wandImage approach seems lossy, and the double resize seems dangerous
                        # with open(temp_file.name, "rb") as f:
                        #     bio = BytesIO(f.read())
                        # b64blob=base64.b64encode(bio.getvalue()).decode()
                        # batch.append(b64blob)

                        #########Local Download
                        batch.append(dirpath + '/' + filename)

                        image = {'filename':filename, 'timestamp':timestamp, 'corrected_timestamp':timestamp, 'camera_id':camera_id, 'hash':hash}
                        images.append(image)
                        
                    except (ValueError):
                        app.logger.info("Skipping {} because it appears to be corrupt".format(filename))
                        continue
        
        if batch:
            print('Acquiring lock')
            GLOBALS.lock.acquire()
            print('Queueing batch')
            GLOBALS.results_queue.append((images, infer.apply_async(kwargs={'batch': batch,'sourceBucket':sourceBucket,'external':external}, queue='celery', routing_key='celery.infer')))
            GLOBALS.lock.release()
            print('Lock released')

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29)
def importImages(self,batch,csv,pipeline,external,min_area):
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
                lower_index (int): The lower index of images from the folder to be imported
                upper_index (int): The upper index of images from the folder to be imported
    '''
    
    try:
        #Prep bacthes
        GLOBALS.results_queue = []
        pool = Pool(processes=4)
        isjpeg = re.compile('\.jpe?g$', re.I)
        print('Received importImages task with {} batches.'.format(len(batch)))
        for item in batch:
            sourceBucket = item['sourceBucket']
            dirpath = item['dirpath']
            trapgroup_id = item['trapgroup_id']
            survey_id = item['survey_id']
            destBucket = item['destBucket']

            if csv:
                # Allows for the fetching of images according to a csv eg. for collecting Snapshot Safari data for training
                key = item['key']
                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    GLOBALS.s3client.download_file(Bucket=destBucket, Key=key, Filename=temp_file.name)
                    df = pd.read_csv(temp_file.name)
                jpegs = list(df['filename'].unique())

            else:
                lower_index = item['lower_index']
                upper_index = item['upper_index']
                folders,filenames = list_all(sourceBucket,dirpath+'/')
                jpegs = list(filter(isjpeg.search, filenames))
                jpegs = jpegs[int(lower_index):int(upper_index)]
            
            print("Starting import of batch for {} with {} images.".format(dirpath,len(jpegs)))
            camera = Camera.get_or_create(db.session, trapgroup_id, dirpath)
            db.session.commit()
            camera_id = camera.id
                
            for filenames in chunker(jpegs,4):
                pool.apply_async(batch_images,(camera_id,filenames,sourceBucket,dirpath,destBucket,survey_id,pipeline,external))

        pool.close()
        pool.join()

        # Fetch the results
        print('{} batch results to fetch'.format(len(GLOBALS.results_queue)))
        counter = 0
        db.session.remove()
        GLOBALS.lock.acquire()
        with allow_join_result():
            for images, result in GLOBALS.results_queue:
                try:
                    counter += 1
                    print('Fetching result {}'.format(counter))
                    starttime = datetime.utcnow()
                    response = result.get()
                    print('Fetched result {} after {}.'.format(counter,datetime.utcnow()-starttime))

                    for img, detections in zip(images, response):
                        try:
                            image = Image(**img)
                            db.session.add(image)
                            image.detections = [Detection(**detection) for detection in detections]
                            for detection in image.detections:
                                detection.status='active'
                                db.session.add(detection)
                        
                        except Exception:
                            app.logger.info(' ')
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(traceback.format_exc())
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(' ')
                            db.session.rollback()
                    
                    # Commit every 400 images (100 batches) to speed up result fetching
                    if counter%100==0:
                        db.session.query(Survey).get(survey_id).image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().count()
                        db.session.commit()
                
                except Exception:
                    app.logger.info(' ')
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(traceback.format_exc())
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(' ')
                    db.session.rollback()
                
                result.forget()
        GLOBALS.lock.release()

        #Commit the last batch
        db.session.query(Survey).get(survey_id).image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().count()
        db.session.commit()
            
        # If we are piplining some training data, we need to save the crops
        if pipeline:
            print('Pipelining data')
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
                    lower_index = item['lower_index']
                    upper_index = item['upper_index']
                    folders,filenames = list_all(sourceBucket,dirpath+'/')
                    jpegs = list(filter(isjpeg.search, filenames))
                    jpegs = jpegs[int(lower_index):int(upper_index)]

                images = db.session.query(Image).join(Camera).filter(Camera.path==dirpath).filter(Image.filename.in_(jpegs)).distinct().all()
                for image in images:
                    pool.apply_async(save_crops,(image.id,sourceBucket,min_area,destBucket,external,True))

            print('All jobs queued.')
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

def classifier_batching(chunk,sourceBucket):
    ''' Helper function for runClassifier that batches images and queues them for the classifier. '''

    try:
        batch = {'bucket': sourceBucket, 'detection_ids': [], 'detections': {}, 'images': {}}
        for image_id in chunk:

            try:
                detections = db.session.query(Detection)\
                                    .filter(Detection.image_id==int(image_id))\
                                    .filter(Detection.score>0.8)\
                                    .filter(Detection.static==False)\
                                    .filter(~Detection.status.in_(['deleted','hidden']))\
                                    .filter(Detection.left!=Detection.right)\
                                    .filter(Detection.top!=Detection.bottom)\
                                    .all()

                ######################Blob approach
                # with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                #     GLOBALS.s3client.download_file(Bucket=sourceBucket, Key=os.path.join(detections[0].image.camera.path, detections[0].image.filename), Filename=temp_file.name)

                #     try:
                #         with open(temp_file.name, "rb") as f:
                #             bio = BytesIO(f.read())
                #         b64blob=base64.b64encode(bio.getvalue()).decode()
                #     except:
                #         continue

                # batch['images'][str(image_id)] = b64blob

                ######################Download on worker approach
                if len(detections) > 0:
                    batch['images'][str(image_id)] = os.path.join(detections[0].image.camera.path, detections[0].image.filename)

                for detection in detections:
                    detection_id = str(detection.id)
                    batch['detection_ids'].append(detection_id)
                    batch['detections'][detection_id] = {'image_id': str(image_id), 'left': detection.left, 'right': detection.right, 'top': detection.top, 'bottom': detection.bottom}

            except:
                app.logger.info(' ')
                app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                app.logger.info(traceback.format_exc())
                app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                app.logger.info(' ')

        if len(batch['images'].keys()) >= 0:
            GLOBALS.lock.acquire()
            GLOBALS.results_queue.append(classify.apply_async(kwargs={'batch': batch}, queue='classification', routing_key='classification.classify'))
            GLOBALS.lock.release()

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29)
def runClassifier(self,lower_index,upper_index,sourceBucket,batch_size,survey_id):
    '''
    Run species classification on a trapgroup.

        Parameters:
            trapgroup_id (int): trapgroup to be processed
            sourceBucket (str): AWS S3 bucket where images are kept
            batch_size (int): The batch size.
    '''
    
    try:
        images = [r.id for r in db.session.query(Image)\
                        .join(Detection)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Detection.score>0.8)\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .order_by(Image.id).distinct().all()]

        batch = images[lower_index:upper_index]

        GLOBALS.results_queue = []
        pool = Pool(processes=4)
        for chunk in chunker(batch,batch_size):
            pool.apply_async(classifier_batching,(chunk,sourceBucket))
        pool.close()
        pool.join()
        print('{} results to fetch'.format(len(GLOBALS.results_queue)))

        counter = 0
        db.session.remove()
        GLOBALS.lock.acquire()
        with allow_join_result():
            for result in GLOBALS.results_queue:
                try:
                    counter += 1
                    print('Fetching result {}'.format(counter))
                    starttime = datetime.utcnow()
                    response = result.get()
                    print('Fetched result {} after {}.'.format(counter,datetime.utcnow()-starttime))

                    for detection_id in response.keys():
                        try:
                            detection = db.session.query(Detection).get(int(detection_id))
                            detection.class_score = float(response[detection_id]['score'])
                            detection.classification = response[detection_id]['classification']
                        
                        except Exception:
                            app.logger.info(' ')
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(traceback.format_exc())
                            app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            app.logger.info(' ')

                    # Commit every 1000 images to prevent long locks on the database
                    # if counter%5==0: db.session.commit()
                    db.session.commit()
                
                except Exception:
                    app.logger.info(' ')
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(traceback.format_exc())
                    app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    app.logger.info(' ')

                result.forget()
        GLOBALS.lock.release()
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

def s3traverse(bucket,prefix):
    """
    s3 traverse implements a traversal of a s3 bucket broadly interface compatible with os.walk. A delimiter of / is assumed
    
        Parameters:
            bucket (str): The name of the S3 bucket to be traversed
            prefix (str): The common prefix to start the traversal at.(Excluding the training /)
    
        Returns:
            See os.walk docs
    """

    prefixes,contents = list_all(bucket,prefix+'/')
    yield prefix,prefixes,contents
    for prefix in [prefix+'/'+pf for pf in prefixes]:
        for prefix,prefixes,contents in s3traverse(bucket,prefix):
            yield prefix, prefixes, contents

def delete_duplicate_images(images):
    '''Helper function for remove_duplicate_images that deletes the specified image objects and their detections from the database.'''
    for image in images:
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
            
    duplicates = db.session.query(Image.hash).join(sq,sq.c.hash==Image.hash).filter(sq.c.count>1).distinct().all()

    for hash in duplicates:
        images = db.session.query(Image)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(Image.hash==hash[0])\
                    .distinct().all()
        delete_duplicate_images(images[1:])

    #delete any empty cameras
    cameras = db.session.query(Camera).join(Trapgroup).filter(~Camera.images.any()).filter(Trapgroup.survey_id==survey_id).all()
    for camera in cameras:
        db.session.delete(camera)
    db.session.commit()

    #delete any empty trapgroups
    trapgroups = db.session.query(Trapgroup).filter(~Trapgroup.cameras.any()).filter(Trapgroup.survey_id==survey_id).all()
    for trapgroup in trapgroups:
        db.session.delete(trapgroup)
    db.session.commit()

    #Delete any empty clusters
    clusters = db.session.query(Cluster).join(Task).filter(Task.survey_id==survey_id).filter(~Cluster.images.any()).all()
    for cluster in clusters:
        cluster.labels = []
        cluster.tags = []
        cluster.required_images = []
        db.session.delete(cluster)
    db.session.commit()

    #Delete any empty individuals
    individuals = db.session.query(Individual).join(Task).filter(Task.survey_id==survey_id).filter(~Individual.detections.any()).all()
    for individual in individuals:
        individual.children = []
        individual.tags = []
    db.session.commit()

    for individual in individuals:
        indSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
        for indSimilarity in indSimilarities:
            db.session.delete(indSimilarity)
        db.session.delete(individual)
    db.session.commit()
    db.session.remove()
    
    return True

def import_folder(s3Folder, tag, name, sourceBucket,destinationBucket,user_id,pipeline,min_area,exclusions,processes=4):
    '''
    Import all images from an AWS S3 folder. Handles re-import of a folder cleanly.

        Parameters:
            s3Folder (str): folder name to import
            tag (str): Regular expression used to indentify trapgroups
            name (str): Survey name
            sourceBucket (str): Bucket from which import takes place
            destinationBucket (str): Bucket where compressed images are stored
            user_id (int): User doing the import
            pipeline (bool): Whether import is to pipeline training data (only crops will be saved)
            min_area (float): The minimum area detection to crop if pipelining
            exclusions (list): A list of folders to exclude
            processes (int): Optional number of threads used for the import
    '''
    
    isjpeg = re.compile('\.jpe?g$', re.I)
    localsession=db.session()
    survey = Survey.get_or_create(localsession,name=name,user_id=user_id,trapgroup_code=tag)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True
    localsession.commit()
    sid=survey.id
    tag = re.compile(tag)

    results = []
    batch_count = 0
    batch = []
    chunk_size = round(Config.QUEUES['parallel']['bin_size']/8)
    for dirpath, folders, filenames in s3traverse(sourceBucket, s3Folder):
        jpegs = list(filter(isjpeg.search, filenames))
        
        if len(jpegs) and not any(exclusion in dirpath for exclusion in exclusions):
            tags = tag.findall(dirpath)
            
            if len(tags) > 0:
                trapgroup = Trapgroup.get_or_create(localsession, tags[0], sid)
                survey.images_processing += len(jpegs)
                localsession.commit()
                tid=trapgroup.id

                #Break folders down into chunks to prevent overly-large folders causing issues
                # for chunk in chunker(jpegs,round(Config.QUEUES['parallel']['bin_size']/8)):
                number_of_chunks = math.ceil(len(jpegs)/chunk_size)
                for n in range(number_of_chunks):
                    batch.append({'sourceBucket':sourceBucket,
                                    'dirpath':dirpath,
                                    'lower_index': n*chunk_size,
                                    'upper_index': (n+1)*chunk_size,
                                    'trapgroup_id':tid,
                                    'survey_id':sid,
                                    'destBucket':destinationBucket})

                    if n < number_of_chunks-1:
                        batch_count += chunk_size
                    else:
                        batch_count += len(jpegs) - (n*chunk_size)

                    if (batch_count / ((Config.QUEUES['parallel']['bin_size']/4)*random.uniform(0.5, 1.5)) ) >= 1:
                        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':pipeline,'external':False,'min_area':min_area},queue='parallel'))
                        app.logger.info('Queued batch with {} images'.format(batch_count))
                        batch_count = 0
                        batch = []

                    # # Once a large survey has saturated the queue, simply add batches at previous batches are finished to reduce memory saturation
                    # if (len(results)) >= (2*Config.MAX_PARALLEL):
                    #     survey.processing_initialised = False
                    #     localsession.commit()
                    #     result = results.pop(0)
                    #     db.session.remove()
                    #     with allow_join_result():
                    #         try:
                    #             result.get()
                    #         except Exception:
                    #             app.logger.info(' ')
                    #             app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    #             app.logger.info(traceback.format_exc())
                    #             app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                    #             app.logger.info(' ')
                    #         result.forget()
            else:
                app.logger.info('{}: failed to import path {}. No tag found.'.format(name,dirpath))

    if batch_count!=0:
        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':False,'pipeline':pipeline,'external':False,'min_area':min_area},queue='parallel'))

    survey.processing_initialised = False
    localsession.commit()
    localsession.close()
    
    #Wait for import to complete
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

    # Remove any duplicate images that made their way into the database due to the parallel import process.
    remove_duplicate_images(sid)

def pipeline_csv(df,surveyName,tgcode,source,external,min_area,destBucket,exclusions):
    '''
    Imports a survey of images for classifier training purposes. Saves only the detection crops.

        Parameters:
            df (dataframe): The Pandas dataframe being imported
            surveyName (str): The name for the survey
            tgcode (str): The regular expression trapgroup code
            source (str): The base URL where the images are to be sourced from if external is true, a regular S3 bucket name if otherwise
            external (bool): Whether the images are sourced from a site external to S3
            min_area (float): The minimum detection size to be cropped 
            destBucket (str): The bucket where the crops must be saved
            exclusions (list): List of folders to exclude from the import
    '''

    # Create survey
    localsession=db.session()
    admin = localsession.query(User).filter(User.username=='Admin').first()
    survey = Survey.get_or_create(localsession,name=surveyName,user_id=admin.id,trapgroup_code=tgcode)
    survey.status = 'Importing'
    survey.images_processing = 0
    survey.processing_initialised = True
    localsession.commit()
    survey_id=survey.id
    tgcode = re.compile(tgcode)

    results = []
    batch_count = 0
    batch = []
    chunk_size = round(Config.QUEUES['parallel']['bin_size']/8)
    for dirpath in df['dirpath'].unique():
        tags = tgcode.findall(dirpath)

        if len(tags) and not any(exclusion in dirpath for exclusion in exclusions):
            tag = tags[0]

            current_df = df.loc[df['dirpath'] == dirpath]
            current_df.reset_index(drop=True,inplace=True)
            number_of_images = len(current_df)
            
            trapgroup = Trapgroup.get_or_create(localsession, tag, survey_id)
            survey.images_processing += number_of_images
            localsession.commit()
            trapgroup_id=trapgroup.id

            #Break folders down into chunks to prevent overly-large folders causing issues
            number_of_chunks = math.ceil(number_of_images/chunk_size)
            for n in range(number_of_chunks):
                lower_index = n*chunk_size
                upper_index = ((n+1)*chunk_size)-1
                chunked_df = current_df.loc[lower_index:upper_index]

                # key = 'pipelineCSVs/' + surveyName + '_' + dirpath.replace('/','_') + '_' + str(lower_index) + '_' + str(upper_index) + '.csv'
                key = 'pipelineCSVs/' + surveyName + '_' + randomString(20) + '_' + str(lower_index) + '_' + str(upper_index) + '.csv'
                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    chunked_df.to_csv(temp_file.name,index=False)
                    GLOBALS.s3client.put_object(Bucket=destBucket,Key=key,Body=temp_file)

                batch.append({'sourceBucket':source,
                                'dirpath':dirpath,
                                # 'jpegs':chunk,
                                'key': key,
                                'lower_index': n*chunk_size,
                                'upper_index': (n+1)*chunk_size,
                                'trapgroup_id':trapgroup_id,
                                'survey_id':survey_id,
                                'destBucket':destBucket})

                if n < number_of_chunks-1:
                    batch_count += chunk_size
                else:
                    batch_count += number_of_images - (n*chunk_size)

                if (batch_count / ((Config.QUEUES['parallel']['bin_size']/4)*random.uniform(0.5, 1.5)) ) >= 1:
                    results.append(importImages.apply_async(kwargs={'batch':batch,'csv':True,'pipeline':True,'external':external,'min_area':min_area},queue='parallel'))
                    app.logger.info('Queued batch with {} images'.format(batch_count))
                    batch_count = 0
                    batch = []

    if batch_count!=0:
        results.append(importImages.apply_async(kwargs={'batch':batch,'csv':True,'pipeline':True,'external':external,'min_area':min_area},queue='parallel'))

    survey.processing_initialised = False
    localsession.commit()
    localsession.close()
    
    #Wait for import to complete
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

    # Remove any duplicate images that made their way into the database due to the parallel import process.
    remove_duplicate_images(survey_id)

def classifyCluster(cluster,classifications,dimensionSQ):
    '''
    Returns the species contained in a single cluster.

        Parameters:
            cluster (Cluster): Cluster object to be classified
            classifications (list): List of all classifications in a survey
            dimensionSQ (SQLAlchemy subquery): Subquery of detection area

        Returns:
            clusterClass (str): The species contained in the cluster
    '''

    max_count = 0
    clusterClass = ''

    for classification in classifications:
        detectionCount = db.session.query(Detection) \
                            .join(Image) \
                            .join(dimensionSQ, dimensionSQ.c.detID==Detection.id) \
                            .filter(Image.clusters.contains(cluster)) \
                            .filter(Detection.class_score>Config.CLASS_SCORE) \
                            .filter(Detection.score > 0.8) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                            .filter(dimensionSQ.c.area > Config.DET_AREA) \
                            .filter(Detection.classification==classification) \
                            .distinct(Detection.id).count()

        if detectionCount > max_count:
            max_count = detectionCount
            clusterClass = classification

    if max_count == 0:
        clusterClass = 'nothing'

    return clusterClass

@celery.task(bind=True,max_retries=29)
def classifyTrapgroup(self,task_id,trapgroup_id):
    '''
    Classifies the species contained in each cluster in a trapgroup for a given task.

        Parameters:
            task_id (int): Task to be processed
            trapgroup_id (int): Trapgroup to be processed
    '''

    try:
        dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                                .join(Image) \
                                .join(Camera) \
                                .join(Trapgroup) \
                                .filter(Trapgroup.id==trapgroup_id) \
                                .subquery()

        clusters = db.session.query(Cluster).join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Cluster.task_id==task_id).distinct().all()
        for chunk in chunker(clusters,500):
            for cluster in chunk:
                classifications = db.session.query(Detection.classification)\
                                            .join(Image)\
                                            .filter(Detection.class_score>Config.CLASS_SCORE) \
                                            .filter(Detection.score > 0.8) \
                                            .filter(Detection.static == False) \
                                            .filter(~Detection.status.in_(['deleted','hidden'])) \
                                            .filter(Image.clusters.contains(cluster))\
                                            .distinct().all()
                classifications = [r[0] for r in classifications if r[0]!=None]
                cluster.classification = classifyCluster(cluster,classifications,dimensionSQ)
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

def single_cluster_classification(cluster):
    '''Runs classifyCluster on a given cluster. Includes required dimensionSQ.'''

    classifications = db.session.query(Detection.classification)\
                                .join(Image)\
                                .filter(Detection.class_score>Config.CLASS_SCORE) \
                                .filter(Detection.score > 0.8) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .filter(Image.clusters.contains(cluster))\
                                .distinct().all()
    classifications = [r[0] for r in classifications if r[0]!=None]

    dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                            .join(Image) \
                            .filter(Image.clusters.contains(cluster)) \
                            .subquery()

    return classifyCluster(cluster,classifications,dimensionSQ)

def updateDetectionRatings(images):
    '''Helper function for updateTrapgroupDetectionRatings that allows that function to update the detection ratings of images in parallel.'''

    try:
        images = db.session.query(Image).filter(Image.id.in_(images)).distinct().all()
        for image in images:
            image.detection_rating = detection_rating(image)
        db.session.commit()
    
    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()
    
    return True

@celery.task(bind=True,max_retries=29)
def updateTrapgroupDetectionRatings(self,trapgroup_id):
    '''Updates detection ratings for all images in a trapgroup.'''
    try:
        images = [r.id for r in db.session.query(Image)\
                        .join(Camera)\
                        .filter(Camera.trapgroup_id==trapgroup_id)\
                        .all()]
        pool = Pool(processes=4)
        for chunk in chunker(images,500):
            pool.apply_async(updateDetectionRatings,(chunk,))
        pool.close()
        pool.join()

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
    for trapgroup in db.session.query(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().all():
        results.append(updateTrapgroupDetectionRatings.apply_async(kwargs={'trapgroup_id':trapgroup.id},queue='parallel'))
    
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

def classifySurvey(survey_id,sourceBucket,batch_size=200,processes=4):
    '''
    Runs the classifier on the survey, and then updates cluster classifications.

        Parameters:
            survey_id (int): Survey to process
            sourceBucket (str): AWS S3 Bucket where images are located
            batch_size (int): Optional batch size to use for species classifier. Default is 200.
            processes (int): Optional number of threads to use. Default is 4.
    '''

    results = []
    survey = db.session.query(Survey).get(survey_id)
    # survey.images_processing = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
    survey.processing_initialised = True
    db.session.commit()

    images = db.session.query(Image)\
                        .join(Detection)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Detection.score>0.8)\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .distinct().count()

    chunk_size = round(Config.QUEUES['parallel']['bin_size']/2)
    number_of_chunks = math.ceil(images/chunk_size)

    # for chunk in chunker(images,round(Config.QUEUES['parallel']['bin_size']/2)):
    for n in range(number_of_chunks):
        results.append(runClassifier.apply_async(kwargs={'lower_index':n*chunk_size,'upper_index':(n+1)*chunk_size,'sourceBucket':sourceBucket,'batch_size':batch_size,'survey_id':survey_id},queue='parallel'))

    survey.processing_initialised = False
    db.session.commit()

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

    detections = db.session.query(Detection)\
                            .join(Image)\
                            .join(Camera)\
                            .join(Trapgroup)\
                            .filter(Trapgroup.survey_id==survey_id)\
                            .filter(Detection.score>0.8)\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .filter(or_(Detection.left==Detection.right,Detection.top==Detection.bottom))\
                            .all()

    for chunk in chunker(detections,1000):
        for detection in chunk:
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

    survey = db.session.query(Survey).get(survey_id)
    survey.classifier_version = Config.LATEST_CLASSIFIER
    db.session.commit()
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
            images = db.session.query(Image).filter(Image.camera_id==camera.id).all()
            for chunk in chunker(images,500):
                for image in chunk:
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
            images = db.session.query(Image).filter(Image.camera_id==camera.id).all()
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
                print('Group {} too long: {}'.format(group,finish-start))
                max = timedelta(seconds=0)
                point = None
                prev = images[0].corrected_timestamp
                for image in images[1:]:
                    delta = image.corrected_timestamp-prev
                    if delta > max:
                        max = delta
                        point = image
                    prev = image.corrected_timestamp
                print('Being split at {}'.format(point.corrected_timestamp))

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
                            print('Added new camera for trapgroup {}, for path {}'.format(trapgroup.id,newCam.path))

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

                print('Cameras {} need to be adjusted by {}'.format(groups[group],delta))
                for chunk in chunker(images,500):
                    for image in chunk:
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


@celery.task(bind=True,max_retries=29,ignore_result=True)
def import_survey(self,s3Folder,surveyName,tag,user_id,correctTimestamps,processes=4):
    '''
    Celery task for the importing of surveys. Includes all necessary processes such as animal detection, species classification etc. Handles added images cleanly.

        Parameters:
            s3Folder (str): The folder on the user's AWS S3 bucket where the images much be imported from
            surveyName (str): The name of the survey
            tag (str): The trapgroup regular expression code used to identify trapgroups in the folder structure
            user_id (int): The user to which the survey will belong
            correctTimestamps (bool): Whether or not the system should attempt to correct the relative timestamps of the cameras in each trapgroup
            processes (int): Optional number of threads to use. Default is 4
    '''
    
    try:
        app.logger.info("Importing survey {}".format(surveyName))

        if (db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.user_id==user_id).first()):
            addingImages = True
        else:
            addingImages = False

        sourceBucket = db.session.query(User).get(user_id).bucket+'-raw'
        destBucket = db.session.query(User).get(user_id).bucket
        import_folder(s3Folder, tag, surveyName,sourceBucket,destBucket,user_id,False,None,[],processes)
        survey = db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.user_id==user_id).first()
        survey_id = survey.id
        survey.correct_timestamps = correctTimestamps
        survey.image_count = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).distinct().count()
        db.session.commit()
        skip = False
        if correctTimestamps:
            survey.status='Correcting Timestamps'
            db.session.commit()
            correct_timestamps(survey_id)
            if addingImages:
                from app.functions.admin import reclusterAfterTimestampChange
                reclusterAfterTimestampChange(survey_id)
                skip = True
        if not skip:
            task_id=cluster_survey(survey_id)
            survey = db.session.query(Survey).get(survey_id)
        survey.status='Removing Static Detections'
        db.session.commit()
        processStaticDetections(survey)
        survey = db.session.query(Survey).get(survey_id)
        survey.status='Removing Humans'
        db.session.commit()
        removeHumans(task_id)
        survey.status='Importing Coordinates'
        db.session.commit()
        importKML(survey.id)
        survey.status='Classifying'
        db.session.commit()
        classifySurvey(survey_id=survey_id,sourceBucket=destBucket)
        survey = db.session.query(Survey).get(survey_id)
        survey.status='Re-Clustering'
        db.session.commit()
        recluster_large_clusters(task_id,True)
        survey.status='Calculating Scores'
        db.session.commit()
        updateSurveyDetectionRatings(survey_id=survey_id)
        survey = db.session.query(Survey).get(survey_id)

        if addingImages:
            for task in survey.tasks:
                if task.name != 'default':
                    classifyTask(task.id)
                    updateTaskCompletionStatus(task.id)
                    updateLabelCompletionStatus(task.id)
                    updateIndividualIdStatus(task.id)

        survey.status = 'Ready'
        survey.images_processing = 0
        db.session.commit()
        app.logger.info("Finished importing survey {}".format(surveyName))

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

def extract_label(path,filename,species,translations,survey_id):
    '''Helper function for extract_dirpath_labels that extracts the label for an individual row of the dataframe.'''
    label = db.session.query(Label).get(translations[species])
    image = db.session.query(Image)\
                        .join(Camera)\
                        .join(Trapgroup)\
                        .filter(Trapgroup.survey_id==survey_id)\
                        .filter(Camera.path==path)\
                        .filter(Image.filename==filename)\
                        .first()
    if label and image:
        image.clusters[0].labels = [label]
        labelgroups = db.session.query(Labelgroup)\
                            .join(Detection)\
                            .filter(Detection.image_id==image.id)\
                            .distinct().all()
        for labelgroup in labelgroups:
            labelgroup.labels = [label]
        db.session.commit()
    return True

@celery.task(bind=True,max_retries=29,ignore_result=False)
def extract_dirpath_labels(self,key,translations,survey_id,destBucket):
    '''Helper function for pipeline_survey that extracts the labels for a supplied dataframe.'''
    
    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=destBucket, Key=key, Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)
        df.apply(lambda x: extract_label(x.dirpath,x.filename,x.species,translations,survey_id), axis=1)
    
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

@celery.task(bind=True,max_retries=29,ignore_result=False)
def pipeline_cluster_camera(self,camera_id,task_id):
    '''Helper function to parallelise pipeline clustering'''

    try:
        images = db.session.query(Image).filter(Image.camera_id==camera_id).distinct().all()
        for image in images:
            image.detection_rating = 1
            cluster = Cluster(task_id=task_id)
            db.session.add(cluster)
            cluster.images = [image]
            for detection in image.detections:
                labelgroup = Labelgroup(detection_id=detection.id,task_id=task_id,checked=False)
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

@celery.task(bind=True,max_retries=29,ignore_result=True)
def pipeline_survey(self,surveyName,bucketName,dataSource,fileAttached,trapgroupCode,min_area,exclusions,sourceBucket):
    '''
    Celery task for processing pre-annotated data. Creates a survey etc. as normal, but does not classify the data, nor bother to 
    cluster it. Additionally saves crops instead of compressed images. Has two operational modes:

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
    '''
    
    try:
        app.logger.info("Pipelining survey {}".format(surveyName))
        admin = db.session.query(User).filter(User.username=='Admin').first()
        user_id = admin.id

        if fileAttached:
            fileName = 'csvFiles/' + surveyName + '.csv'
            df = pd.read_csv(fileName)

            # Works on the assumption that multi-labels are handled with duplicate image rows - remove all of these
            df = df.drop_duplicates(subset=['filepath'], keep=False)

            # Remove all empty images including humans
            empty_names = ['empty','nothing','unknown','none','fire','blank','human','null']
            df = df[~df['species'].str.contains('|'.join(empty_names), case=False)]

            # Remove all extra info
            df = df[['filepath','species']]

            #extract the dirpaths & filenames
            df['filename'] = df.apply(lambda x: re.split('/',x.filepath)[-1], axis=1)
            df['dirpath'] = df.apply(lambda x: os.path.join(*re.split('/',x.filepath)[:-1]), axis=1)
            # df['dirpath'] = df.apply(lambda x: re.split(x.filename,x.filepath)[0][:-1], axis=1)
            del df['filepath']

            # Start importing these
            pipeline_csv(df,surveyName,trapgroupCode,dataSource,True,min_area,bucketName,exclusions)

        else:
            #import from S3 folder
            import_folder(dataSource,trapgroupCode,surveyName,sourceBucket,bucketName,admin.id,True,min_area,exclusions,4)

        # Cluster survey
        survey = db.session.query(Survey).filter(Survey.name==surveyName).filter(Survey.user_id==user_id).first()
        survey.status = 'Clustering'
        db.session.commit()
        survey_id = survey.id

        if fileAttached:
            task = Task(name='import', survey_id=survey_id, tagging_level='-1', test_size=0, status='Ready')
        else:
            task = Task(name='default', survey_id=survey_id, tagging_level='-1', test_size=0, status='Ready')
        db.session.add(task)
        db.session.commit()
        task_id=task.id

        results = []
        for camera in db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).distinct().all():
            results.append(pipeline_cluster_camera.apply_async(kwargs={'camera_id':camera.id,'task_id':task.id},queue='parallel'))

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

        # Extract labels:
        if fileAttached:
            survey = db.session.query(Survey).get(survey_id)
            survey.status = 'Extracting Labels'
            db.session.commit()

            # Create labels
            translations = {}
            for species in df['species'].unique():
                label = Label(description=species,hotkey=None,parent_id=None,task_id=task_id,complete=True)
                db.session.add(label)
                db.session.commit()
                translations[species] = label.id

            # Run the folders in parallel
            results = []
            for dirpath in df['dirpath'].unique():
                dirpathDF = df.loc[df['dirpath'] == dirpath]
                key = 'pipelineCSVs/' + surveyName + '_' + dirpath.replace('/','_') + '.csv'
                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    dirpathDF.to_csv(temp_file.name,index=False)
                    GLOBALS.s3client.put_object(Bucket=bucketName,Key=key,Body=temp_file)
                results.append(extract_dirpath_labels.apply_async(kwargs={'key':key,'translations':translations,'survey_id':survey_id,'destBucket':bucketName},queue='parallel'))

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
        survey.status='Removing Static Detections'
        db.session.commit()
        processStaticDetections(survey)

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