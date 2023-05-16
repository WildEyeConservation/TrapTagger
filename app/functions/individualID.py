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
from app.functions.globals import coordinateDistance, retryTime
import GLOBALS
import time
from sqlalchemy.sql import func, or_, and_
from sqlalchemy.sql.expression import cast
from sqlalchemy import desc
import random
import re
import math
from config import Config
import os
from multiprocessing.pool import ThreadPool as Pool
import traceback
import sqlalchemy as sa
import shutil

@celery.task(bind=True,max_retries=29,ignore_result=True)
def calculate_detection_similarities(self,task_ids,species,algorithm):
    '''
    Celery task for calculating the similarity between detections for individual ID purposes.

        Parameters:
            task_ids (list): Tasks for which the calculation must take place
            species (str): The species for which the individual ID is being performed
            algorithm (str): The selected algorithm
    '''

    try:
        OverallStartTime = time.time()
        if len(task_ids)==1:
            task = db.session.query(Task).get(task_ids[0])
        else:
            task = db.session.query(Task).filter(Task.id.in_(task_ids)).filter(Task.sub_tasks.any()).first()
        task.survey.status = 'processing'
        db.session.commit()
        # label = db.session.query(Label).filter(Label.description==species).filter(Label.task==task).first()

        rootQuery = db.session.query(Detection.id)\
                            .join(Labelgroup)\
                            .join(Task)\
                            .join(Label,Labelgroup.labels)\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Label.description==species)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                            .filter(Detection.static == False) \
                            .filter(~Detection.status.in_(['deleted','hidden']))
                    
        sq = rootQuery.subquery()
        sq2 = rootQuery.subquery()
        queryDetections = [r[0] for r in rootQuery.distinct().all()]

        # Ensure that we only do this when we need to
        calculation_needed = False
        for detection in queryDetections:
            count = db.session.query(DetSimilarity)\
                        .filter(or_(DetSimilarity.detection_1==detection,DetSimilarity.detection_2==detection))\
                        .join(sq,DetSimilarity.detection_1==sq.c.id)\
                        .join(sq2,DetSimilarity.detection_2==sq2.c.id)\
                        .distinct().count()
            if count<(len(queryDetections)-1):
                calculation_needed = True
                break

        if calculation_needed:

            # Delete old detSims
            db.session.query(DetSimilarity)\
                        .join(sq,DetSimilarity.detection_1==sq.c.id)\
                        .join(sq2,DetSimilarity.detection_2==sq2.c.id)\
                        .delete(synchronize_session=False)

            if algorithm == 'hotspotter':
                # Wbia is only imported here to prevent its version of mysql interfering with flask migrate
                # Also suppressing deprication warning since wbia's utool seems to be an issue
                # this means we need to use python 3.9 or lower
                import warnings
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=DeprecationWarning)
                    from wbia import opendb
                    import utool as ut
                    from wbia.algo.hots.pipeline import request_wbia_query_L0

                startTime = time.time()
                labelName = species.replace(' ','_').lower()
                dbName = 'hots_' + task.survey.name.replace(' ','_').lower() + '_' + task.name.replace(' ','_').lower() + '_' + labelName
                imFolder = dbName + '_images'

                if os.path.isdir(dbName):
                    shutil.rmtree(dbName, ignore_errors=True)
                if os.path.isdir(imFolder):
                    shutil.rmtree(imFolder, ignore_errors=True)

                os.mkdir(imFolder)

                # Create new DB
                ibs = opendb(dbdir=dbName,allow_newdir=True)

                # Add species
                species_nice_list = [species]
                species_text_list = [labelName]
                species_code_list = ['SH']
                species_ids = ibs.add_species(species_nice_list, species_text_list, species_code_list)
                hs_label = species_ids[0]

                # get the data from the db efficiently
                data = db.session.query(Detection.id,Detection.left,Detection.right,Detection.top,Detection.bottom,Image.id,Image.filename,Camera.path)\
                                    .join(Image,Detection.image_id==Image.id)\
                                    .join(Camera,Image.camera_id==Camera.id)\
                                    .join(Labelgroup,Labelgroup.detection_id==Detection.id)\
                                    .join(Task,Labelgroup.task_id==Task.id)\
                                    .join(Label,Labelgroup.labels)\
                                    .filter(Task.id.in_(task_ids))\
                                    .filter(Label.description==species)\
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .distinct().all()

                # Import images
                aid_list = []
                aid_Translation = {}
                det_Translation = {}
                gid_Translation = {}
                for item in data:
                    image_id = item[5]

                    if image_id not in gid_Translation.keys():
                        #Download & import image
                        path = item[-1]
                        filename = item[-2]
                        key = path+'/'+filename
                        filename = imFolder + '/' + str(image_id) + '.jpg'
                        GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=key, Filename=filename)
                        gid = ibs.add_images([ut.unixpath(ut.grab_test_imgpath(filename))], auto_localize=False)[0]
                        gid_Translation[image_id] = gid

                    # Annotations
                    gid = gid_Translation[image_id]
                    detection_id = item[0]
                    left = item[1]
                    right = item[2]
                    top = item[3]
                    bottom = item[4]

                    imWidth = ibs.get_image_widths(gid)
                    imHeight = ibs.get_image_heights(gid)
                    w = math.floor(imWidth*(right-left))
                    h = math.floor(imHeight*(bottom-top))
                    x = math.floor(imWidth*left)
                    y = math.floor(imHeight*top)

                    aids = ibs.add_annots([gid],bbox_list=[[x, y, w, h]],species_rowid_list=[hs_label])
                    aid_list.extend(aids)

                    aid = aids[0]
                    aid_Translation[detection_id] = aid
                    det_Translation[aid] = detection_id

                endTime = time.time()
                app.logger.info("Hotspotter DB set up in {}".format(endTime - startTime))
                
                # Run Hotspotter
                # quaid_list = query ids
                # daid_list = database ids
                qaid_list = []
                for detection in queryDetections:
                    aid = aid_Translation[detection]
                    qaid_list.append(aid)

                daid_list = aid_list.copy()
                qreq_ = ibs.new_query_request(qaid_list, daid_list)
                cm_list = request_wbia_query_L0(ibs, qreq_)

                # Digest results
                for cm in cm_list:
                    startTime = time.time()
                    detection1_id = det_Translation[cm.qaid]
                    covered_detections = []
                    for n in range(len(cm.daid_list)):
                        score = cm.score_list[n]
                        aid2 = cm.daid_list[n]
                        detection2_id = det_Translation[aid2]
                        covered_detections.append(detection2_id)

                        # detSimilarity = db.session.query(DetSimilarity).filter(\
                        #                             or_(\
                        #                                 and_(\
                        #                                     DetSimilarity.detection_1==detection1_id,\
                        #                                     DetSimilarity.detection_2==detection2_id),\
                        #                                 and_(\
                        #                                     DetSimilarity.detection_1==detection2_id,\
                        #                                     DetSimilarity.detection_2==detection1_id)\
                        #                             )).first()

                        # if detSimilarity == None:
                        detSimilarity = DetSimilarity(detection_1=detection1_id, detection_2=detection2_id, score=float(score))
                        db.session.add(detSimilarity)

                        # detSimilarity.score = float(score)

                    non_covered_detections = [r[0] for r in db.session.query(Detection.id)\
                                                    .join(Labelgroup)\
                                                    .join(Task)\
                                                    .join(Label,Labelgroup.labels)\
                                                    .filter(Task.id.in_(task_ids))\
                                                    .filter(Label.description==species)\
                                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                                    .filter(Detection.static == False) \
                                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                                    .filter(~Detection.id.in_(covered_detections))\
                                                    .filter(Detection.id!=detection1_id)\
                                                    .distinct().all()]

                    for non_covered in non_covered_detections:
                        # detSimilarity = db.session.query(DetSimilarity).filter(\
                        #                                 or_(\
                        #                                     and_(\
                        #                                         DetSimilarity.detection_1==detection1_id,\
                        #                                         DetSimilarity.detection_2==non_covered.id),\
                        #                                     and_(\
                        #                                         DetSimilarity.detection_1==non_covered.id,\
                        #                                         DetSimilarity.detection_2==detection1_id)\
                        #                                 )).first()

                        # if detSimilarity == None:
                        detSimilarity = DetSimilarity(detection_1=detection1_id, detection_2=non_covered, score=0)
                        db.session.add(detSimilarity)

                        # if detSimilarity.score == None:
                        #     detSimilarity.score = 0

                    # db.session.commit()
                    endTime = time.time()
                    app.logger.info("Hotspotter run for detection {} in {}s".format(detection1_id,endTime - startTime))

                # Delete images & db
                shutil.rmtree(dbName, ignore_errors=True)
                shutil.rmtree(imFolder, ignore_errors=True)

            elif algorithm == 'none':
                allDetections = queryDetections.copy()

                for queryDetection in queryDetections:
                    allDetections.remove(queryDetection)
                    for detection in allDetections:
                        # detSimilarity = db.session.query(DetSimilarity).filter(\
                        #                                 or_(\
                        #                                     and_(\
                        #                                         DetSimilarity.detection_1==queryDetection,\
                        #                                         DetSimilarity.detection_2==detection),\
                        #                                     and_(\
                        #                                         DetSimilarity.detection_1==detection,\
                        #                                         DetSimilarity.detection_2==queryDetection)\
                        #                                 )).first()

                        # if detSimilarity == None:
                        detSimilarity = DetSimilarity(detection_1=queryDetection, detection_2=detection, score=1)
                        db.session.add(detSimilarity)

                        # detSimilarity.score = 1

        endTime = time.time()
        app.logger.info("Hotspotter run completed in {}s".format(endTime - OverallStartTime))

        if len(task_ids)==1:
            user_ids = [r[0] for r in db.session.query(User.id)\
                                                .join(Individual, Individual.user_id==User.id)\
                                                .join(Task,Individual.tasks)\
                                                .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                                .filter(Task.id.in_(task_ids))\
                                                .filter(Individual.species==species)\
                                                .filter(IndSimilarity.score==None)\
                                                .filter(or_(User.passed=='cTrue',User.username=='Admin'))\
                                                .distinct().all()]
        else:
            user_ids = []

        task.survey.status = 'indprocessing'
        db.session.commit()

        calculate_individual_similarities.delay(task_id=task.id,species=species,user_ids=user_ids)

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
def calculate_individual_similarity(self,individual1,individuals2,parameters=None):
    '''
    Calculates the similarity between a single individual, and a list of individuals.

        Parameters:
            individual1 (int): Single individual
            individuals2 (list): IDs of multiple individuals
            parameters (dict): Optional list of weights
    '''
    
    try:
        # startTime = datetime.utcnow()

        if type(individual1) == int:
            celeryTask = True
        else:
            celeryTask = False

        if parameters == None:
            parameters = {}
            parameters["territorySize"] = 15 #km
            parameters["maxTime"] = 30 #days
            parameters["tagWeight"] = 0.1
            parameters["matchWeight"] = 2
            parameters["mismatchWeight"] = 1
            parameters['distanceWeight'] = 0.3
            parameters['timeWeight'] = 0.3
            parameters['iouWeight'] = 0.5

        territorySize = parameters["territorySize"]
        distanceNormFactor = 1/(1.5*territorySize)
        distanceWeight = parameters['distanceWeight']

        maxTime = parameters["maxTime"]
        timeNormFactor = 1/(maxTime*24*3600)
        timeWeight = parameters['timeWeight']

        tagWeight = parameters["tagWeight"]
        matchWeight = parameters["matchWeight"]
        mismatchWeight = parameters["mismatchWeight"]

        iouWeight = parameters['iouWeight']

        if celeryTask:
            individual1 = db.session.query(Individual).get(individual1)
            individuals2 = db.session.query(Individual).filter(Individual.id.in_(individuals2)).all()

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

        Det1 = alias(Detection)
        Det2 = alias(Detection)
        Image1 = alias(Image)
        Image2 = alias(Image)
        Camera1 = alias(Camera)
        Camera2 = alias(Camera)
        Trapgroup1 = alias(Trapgroup)
        Trapgroup2 = alias(Trapgroup)
        individualDetections1 = alias(individualDetections)
        individualDetections2 = alias(individualDetections)

        for individual2 in individuals2:
            if individual2 != individual1:
                max_det1 = None
                max_det2 = None
                similarity = db.session.query(IndSimilarity).filter(\
                                or_(\
                                    and_(\
                                        IndSimilarity.individual_1==individual1.id,\
                                        IndSimilarity.individual_2==individual2.id),\
                                    and_(\
                                        IndSimilarity.individual_1==individual2.id,\
                                        IndSimilarity.individual_2==individual1.id)\
                                )).first()

                if similarity==None:
                    similarity = IndSimilarity(individual_1=individual1.id, individual_2=individual2.id)
                    db.session.add(similarity)
                    # db.session.commit()
                else:
                    # If similarity has already been rejected etc., then skip
                    # -2500 suggestion unidentifiable
                    # -2000 rejected
                    # -1000 share an image
                    # -1500 family
                    if similarity.score and (similarity.score < 0): continue

                if individual2 in family:
                    max_similarity = -1500
                else:
                    testImage = db.session.query(Image)\
                                            .join(Det1, Det1.c.image_id==Image.id)\
                                            .join(Det2, Det2.c.image_id==Image.id)\
                                            .filter(Det1.individuals.contains(individual1))\
                                            .filter(Det2.individuals.contains(individual2))\
                                            .first()

                    if testImage:
                        # Individuals share an image
                        max_similarity = -1000
                    else:
                        tagScore = 0
                        for tag in individual1.tags[:]:
                            if tag in individual2.tags[:]:
                                tagScore += matchWeight
                            else:
                                tagScore -= mismatchWeight
                        for tag in individual2.tags[:]:
                            if tag not in individual1.tags[:]:
                                tagScore -= mismatchWeight

                        detSimilarities = db.session.query(DetSimilarity.score,
                                    Det1.c.id,Det1.c.left,Det1.c.right,Det1.c.top,Det1.c.bottom,Image1.c.camera_id,Image1.c.corrected_timestamp,Trapgroup1.c.latitude,Trapgroup1.c.longitude,
                                    Det2.c.id,Det2.c.left,Det2.c.right,Det2.c.top,Det2.c.bottom,Image2.c.camera_id,Image2.c.corrected_timestamp,Trapgroup2.c.latitude,Trapgroup2.c.longitude)\
                                                .join(Det1, Det1.c.id==DetSimilarity.detection_1)\
                                                .join(Det2, Det2.c.id==DetSimilarity.detection_2)\
                                                .join(Image1, Image1.c.id==Det1.c.image_id)\
                                                .join(Image2, Image2.c.id==Det2.c.image_id)\
                                                .join(Camera1, Camera1.c.id==Image1.c.camera_id)\
                                                .join(Camera2, Camera2.c.id==Image2.c.camera_id)\
                                                .join(Trapgroup1, Trapgroup1.c.id==Camera1.c.trapgroup_id)\
                                                .join(Trapgroup2, Trapgroup2.c.id==Camera2.c.trapgroup_id)\
                                                .join(individualDetections1, individualDetections1.c.detection_id==Det1.c.id)\
                                                .join(individualDetections2, individualDetections2.c.detection_id==Det2.c.id)\
                                                .filter(DetSimilarity.score>0)\
                                                .filter(
                                                    or_(
                                                        and_(individualDetections1.c.individual_id==individual1.id,individualDetections2.c.individual_id==individual2.id),
                                                        and_(individualDetections1.c.individual_id==individual2.id,individualDetections2.c.individual_id==individual1.id)
                                                    )
                                                ).distinct().all()

                        max_similarity = 0
                        for detSimilarity in detSimilarities:
                            detSimScore = detSimilarity[0]
                            det1 = {
                                'id': detSimilarity[1],
                                'left': detSimilarity[2],
                                'right': detSimilarity[3],
                                'top': detSimilarity[4],
                                'bottom': detSimilarity[5]
                            }
                            image1 = {
                                'camera_id': detSimilarity[6],
                                'corrected_timestamp': detSimilarity[7]
                            }
                            trapgroup1 = {
                                'latitude': detSimilarity[8],
                                'longitude': detSimilarity[9]
                            }
                            det2 = {
                                'id': detSimilarity[10],
                                'left': detSimilarity[11],
                                'right': detSimilarity[12],
                                'top': detSimilarity[13],
                                'bottom': detSimilarity[14]
                            }
                            image2 = {
                                'camera_id': detSimilarity[15],
                                'corrected_timestamp': detSimilarity[16]
                            }
                            trapgroup2 = {
                                'latitude': detSimilarity[17],
                                'longitude': detSimilarity[18]
                            }

                            iou_factor = 1
                            if image1['camera_id']==image2['camera_id']:
                                intersection_left = max(det1['left'],det2['left'])
                                intersection_right = min(det1['right'],det2['right'])
                                intersection_top = max(det1['top'],det2['top'])
                                intersection_bottom = min(det1['bottom'],det2['bottom'])

                                if (intersection_right>intersection_left) and (intersection_bottom>intersection_top):
                                    intersection_area = (intersection_right-intersection_left)*(intersection_bottom-intersection_top)
                                    detection1_area = (det1['right']-det1['left'])*(det1['bottom']-det1['top'])
                                    detection2_area = (det2['right']-det2['left'])*(det2['bottom']-det2['top'])
                                    union_area = detection1_area + detection2_area - intersection_area
                                    iou = intersection_area/union_area
                                    iou_factor = (1-(iouWeight*iou))**2
                            
                            if trapgroup1['latitude'] == trapgroup1['longitude'] == 0:
                                distanceScore = 1
                            else:
                                distance = coordinateDistance(trapgroup1['latitude'], trapgroup1['longitude'], trapgroup2['latitude'], trapgroup2['longitude'])
                                distanceScore = 1 + distanceWeight - (distanceWeight*distanceNormFactor*distance)
                                if distanceScore < 1: distanceScore=1

                            if image1['corrected_timestamp'] and image2['corrected_timestamp']:
                                time = abs((image1['corrected_timestamp']-image2['corrected_timestamp']).total_seconds())
                            else:
                                time = 0
                            timeScore = 1 + timeWeight - (timeWeight*timeNormFactor*time)
                            if timeScore < 1: timeScore=1

                            adjusted_score = iou_factor * distanceScore * timeScore * (1 + (tagWeight*tagScore)) * detSimScore

                            if adjusted_score > max_similarity:
                                max_similarity = adjusted_score
                                max_det1 = det1['id']
                                max_det2 = det2['id']

                similarity.score = max_similarity
                if similarity.individual_1==individual1.id:
                    similarity.detection_1 = max_det1
                    similarity.detection_2 = max_det2
                else:
                    similarity.detection_1 = max_det2
                    similarity.detection_2 = max_det1       

                # db.session.commit()
        # endTime = datetime.utcnow()
        # app.logger.info('Finished Calculating Individual Similarity in {}s'.format((endTime - startTime).total_seconds()))

        # #Ensure there are no duplicate indsims due to race condition
        # sq1 = db.session.query(Individual.id.label('indID'),func.count(IndSimilarity.score).label('count'))\
        #                     .join(IndSimilarity, Individual.id==IndSimilarity.individual_1)\
        #                     .filter(IndSimilarity.individual_2==individual1.id)\
        #                     .group_by(Individual.id)\
        #                     .subquery()
		
        # sq2 = db.session.query(Individual.id.label('indID'),func.count(IndSimilarity.score).label('count'))\
        #         .join(IndSimilarity, Individual.id==IndSimilarity.individual_2)\
        #         .filter(IndSimilarity.individual_1==individual1.id)\
        #         .group_by(Individual.id)\
        #         .subquery()

        # duplicates = db.session.query(Individual)\
        #         .outerjoin(sq1,sq1.c.indID==Individual.id)\
        #         .outerjoin(sq2,sq2.c.indID==Individual.id)\
        #         .filter(or_(\
        #             (sq1.c.count+sq2.c.count)>1,\
        #             sq1.c.count>1,\
        #             sq2.c.count>1))\
        #         .distinct().all()

        # for duplicate in duplicates:
        #     indsims = db.session.query(IndSimilarity)\
        #                     .filter(or_(\
        #                         and_(IndSimilarity.individual_1==individual1.id,IndSimilarity.individual_2==duplicate.id),\
        #                         and_(IndSimilarity.individual_1==duplicate.id,IndSimilarity.individual_2==individual1.id)))\
        #                     .distinct().all()
        #     for indsim in indsims[1:]:
        #         db.session.delete(indsim)
        
        if celeryTask:
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
def calculate_individual_similarities(self,task_id,species,user_ids):
    '''
    Celery task for calculating the individual similarities between all individuals generated by the specified users, against all others with the same label from the same task.

    Parameters:
        task_id (int): The task for which individual similarities must be calculated
        species (str): The species for which individual similarities must be calculated
        user_ids (int): The users whose individuals must hae their similarities calculated
    '''
    
    try:
        OverallStartTime = time.time()

        task = db.session.query(Task).get(task_id)
        task.survey.status = 'indprocessing'
        db.session.commit()

        task_ids = [r.id for r in task.sub_tasks]
        task_ids.append(task.id)

        individuals1 = db.session.query(Individual)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name!='unidentifiable')

        # Don't need to do this for multi-task individual ID because all the individuals are already defined and we want to 
        # calculate similarities between all of them
        if len(task_ids)==1: individuals1 = individuals1.filter(Individual.user_id.in_(user_ids))\

        individuals1 = individuals1.all()

        individuals2 = db.session.query(Individual)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .all()

        app.logger.info('Individual similarities are being calculated for {} individuals'.format(len(individuals1)))

        # pool = Pool(processes=4)
        for individual1 in individuals1:
            if individual1 in individuals2: individuals2.remove(individual1)
            if individuals2:
                # pool.apply_async(calculate_individual_similarity,(individual1,individuals2.copy()))
                calculate_individual_similarity(individual1,individuals2.copy())
        # pool.close()
        # pool.join()

        endTime = time.time()
        app.logger.info("All individual similarities completed in {}".format(endTime - OverallStartTime))

        task = db.session.query(Task).get(task_id)
        app.logger.info("Task status: {}".format(task.status))
        if task.sub_tasks and ('-5' in task.tagging_level):
            from app.functions.annotation import launch_task
            task.survey.status = 'Launched'
            db.session.commit()
            launch_task.apply_async(kwargs={'task_id':task_id})
        elif task.status != 'PROGRESS':
            #Check if complete
            incompleteIndividuals = db.session.query(Individual)\
                                            .join(Task,Individual.tasks)\
                                            .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .filter(IndSimilarity.score==None)\
                                            .distinct().count()

            app.logger.info("incompleteIndividuals: {}".format(incompleteIndividuals))    

            if (incompleteIndividuals == 0) or (task.status=='Stopped'):
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

def generateUniqueName(task_id,species,name_type):
    '''Returns a unique name for an individual of the type requested for the specified task and species.'''

    task = db.session.query(Task).get(task_id)

    if name_type == 'w':
        check = 1
        while check != 0:
            name = random.choice(Config.COLOURS) + ' ' + random.choice(Config.ADJECTIVES) + ' ' + random.choice(Config.NOUNS)
            check = db.session.query(Individual)\
                        .filter(Individual.name==name)\
                        .filter(Individual.species==species)\
                        .filter(Individual.tasks.contains(task))\
                        .count()
    else:
        if task.current_name:
            name = str(int(task.current_name)+1)
        else:
            count = db.session.query(Individual)\
                            .filter(Individual.species==species)\
                            .filter(Individual.tasks.contains(task))\
                            .order_by(desc(cast(Individual.name, sa.Integer)))\
                            .first()
            if count and count.name.isnumeric():
                name = str(int(count.name)+1)
            else:
                name = '1'
        task.current_name = name
        db.session.commit()
    return name

def handleIndividualUndo(indSimilarity,individual1,individual2,task_id):
    '''
    Handles the undoing of a user's last action based on the info recieved.

        Parameters:
            indSimilarity (IndSimilarity): The individual similarity object between the two individuals
            individual1 (Individual): The first individual
            individual2 (Individual): The second individual
            task_id (int): The current task
    '''

    if indSimilarity and (indSimilarity.skipped == True):
        app.logger.info('Undoing Skip')
        indSimilarity.skipped = False
    elif indSimilarity and (indSimilarity.score == -2000):
        app.logger.info('Undoing Reject')
        indSimilarity.score = indSimilarity.old_score
    else:
        if individual2.active==False:
            app.logger.info('Undoing Accept')
            individual2.active = True

            for detection in individual2.detections:
                individual1.detections.remove(detection)

            # Handle multi-tasks
            task = db.session.query(Task).get(task_id)
            task_ids = [r.id for r in task.sub_tasks]
            task_ids.append(task.id)

            individual1.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.individuals.contains(individual1))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()

            individual2.tasks = db.session.query(Task)\
                                        .join(Survey)\
                                        .join(Trapgroup)\
                                        .join(Camera)\
                                        .join(Image)\
                                        .join(Detection)\
                                        .filter(Detection.individuals.contains(individual2))\
                                        .filter(Task.id.in_(task_ids))\
                                        .distinct().all()

            ####################################################
            #TODO: This could be improved - not very efficient, but will do the job for now

            if individual1.name != 'unidentifiable':

                if individual2.notes not in ['',None]:
                    if individual1.notes == individual2.notes:
                        individual1.notes = None
                    else:
                        individual1.notes = re.split(individual2.notes,individual1.notes)[0]
                
                for child in individual2.children:
                    # lazy check
                    remove_child = True
                    for parent in child.parents:
                        if parent != individual1:
                            if parent.detections[0] in individual1.detections:
                                remove_child = False
                                break
                                        
                    if remove_child and (child in individual1.children):
                        individual1.children.remove(child)

                for parent in individual2.parents:
                    # lazy check
                    remove_parent = True
                    for child in parent.children:
                        if child != individual1:
                            if child.detections[0] in individual1.detections:
                                remove_parent = False
                                break

                    if remove_parent and (parent in individual1.parents):
                        individual1.parents.remove(parent)

                for tag in individual2.tags:
                    # lazy check
                    remove_tag = True
                    for individual in tag.individuals:
                        if individual != individual1:
                            if individual.detections[0] in individual1.detections:
                                remove_tag = False
                                break

                    if remove_tag and (tag in individual1.tags):
                        individual1.tags.remove(tag)

            ###########################################################

            allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual1.id,IndSimilarity.individual_2==individual1.id)).distinct().all()
            for similarity in allSimilarities:
                similarity.score = similarity.old_score

                maxSim = None
                maxVal = 0
                for detection1 in individual1.detections:
                    for detection2 in individual2.detections:
                        detSim = db.session.query(DetSimilarity).filter(
                            or_(
                                and_(
                                    DetSimilarity.detection_1==detection1.id,
                                    DetSimilarity.detection_2==detection2.id),
                                and_(
                                    DetSimilarity.detection_1==detection2.id,
                                    DetSimilarity.detection_2==detection1.id)
                            )
                        ).first()

                        if detSim.score >= maxVal:
                            maxVal = detSim.score
                            maxSim = detSim

                if maxSim:
                    similarity.detection_1 = maxSim.detection_1
                    similarity.detection_2 = maxSim.detection_2
                elif detSim:
                    similarity.detection_1 = detSim.detection_1
                    similarity.detection_2 = detSim.detection_2

    db.session.commit()
    return True
    
def cleanUpIndividuals(task_id):
    '''Cleans up all inactive individuals for the stipulated task.'''
    task = db.session.query(Task).get(task_id)
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    individuals = db.session.query(Individual)\
                        .join(Task,Individual.tasks)\
                        .filter(Task.id.in_(task_ids))\
                        .filter(Individual.active==False)\
                        .all()

    for individual in individuals:
        allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
        for similarity in allSimilarities:
            db.session.delete(similarity)
        individual.tags = []
        individual.detections = []
        individual.children = []
        individual.parents = []
        individual.tasks = []
        db.session.delete(individual)
    db.session.commit()

    return True

def getProgress(individual_id,task_id):
    '''Gets the progress of inter-cluster ID for the specified individual.'''
    individual = db.session.query(Individual).get(individual_id)
    task = db.session.query(Task).get(task_id)
    tL = re.split(',',task.tagging_level)
    task_ids = [r.id for r in task.sub_tasks]
    task_ids.append(task.id)
    
    inactiveIndividuals = [r[0] for r in db.session.query(Individual.id)\
                                .join(Task,Individual.tasks)\
                                .filter(Task.id.in_(task_ids))\
                                .filter(Individual.species==individual.species)\
                                .filter(Individual.active==False)\
                                .filter(Individual.name!='unidentifiable')\
                                .all()]

    # Skipped and accepted
    completed = db.session.query(IndSimilarity)\
                                .filter(or_(IndSimilarity.individual_1==int(individual_id),IndSimilarity.individual_2==int(individual_id)))\
                                .filter(IndSimilarity.score>=tL[2])\
                                .filter(or_(
                                    IndSimilarity.skipped == True,
                                    IndSimilarity.individual_1.in_(inactiveIndividuals),
                                    IndSimilarity.individual_2.in_(inactiveIndividuals)
                                ))\
                                .distinct().count()

    # Rejected
    completed += db.session.query(IndSimilarity)\
                                .filter(or_(IndSimilarity.individual_1==int(individual_id),IndSimilarity.individual_2==int(individual_id)))\
                                .filter(IndSimilarity.score == -2000)\
                                .distinct().count()

    total = db.session.query(IndSimilarity)\
                                .filter(or_(IndSimilarity.individual_1==int(individual_id),IndSimilarity.individual_2==int(individual_id)))\
                                .filter(or_(
                                    IndSimilarity.score>=tL[2],
                                    IndSimilarity.score == -2000
                                ))\
                                .distinct().count()

    return (completed, total)
