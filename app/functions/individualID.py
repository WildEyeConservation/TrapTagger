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
from app.functions.globals import coordinateDistance, retryTime, rDets, updateIndividualIdStatus, chunker
import GLOBALS
import time
from sqlalchemy.sql import func, or_, and_, alias, distinct
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
from celery.result import allow_join_result
from gpuworker.worker import segment_and_pose
import pandas as pd

# @celery.task(bind=True,max_retries=5,ignore_result=True)
# def calculate_detection_similarities(self,task_ids,species,algorithm):
#     '''
#     Celery task for calculating the similarity between detections for individual ID purposes.

#         Parameters:
#             task_ids (list): Tasks for which the calculation must take place
#             species (str): The species for which the individual ID is being performed
#             algorithm (str): The selected algorithm
#     '''

#     try:
#         OverallStartTime = time.time()
#         if len(task_ids)==1:
#             task = db.session.query(Task).get(task_ids[0])
#         else:
#             task = db.session.query(Task).filter(Task.id.in_(task_ids)).filter(Task.sub_tasks.any()).first()
#         task.survey.status = 'processing'
#         db.session.commit()
#         # label = db.session.query(Label).filter(Label.description==species).filter(Label.task==task).first()

#         rootQuery = db.session.query(Detection.id)\
#                             .join(Labelgroup)\
#                             .join(Task)\
#                             .join(Label,Labelgroup.labels)\
#                             .filter(Task.id.in_(task_ids))\
#                             .filter(Label.description==species)\
#                             .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                             .filter(Detection.static == False) \
#                             .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))
                    
#         sq = rootQuery.subquery()
#         sq2 = rootQuery.subquery()
#         queryDetections = [r[0] for r in rootQuery.distinct().all()]

#         # Ensure that we only do this when we need to
#         calculation_needed = False
#         for detection in queryDetections:
#             count = db.session.query(DetSimilarity)\
#                         .filter(or_(DetSimilarity.detection_1==detection,DetSimilarity.detection_2==detection))\
#                         .join(sq,DetSimilarity.detection_1==sq.c.id)\
#                         .join(sq2,DetSimilarity.detection_2==sq2.c.id)\
#                         .distinct().count()
#             if count<(len(queryDetections)-1):
#                 calculation_needed = True
#                 break

#         if calculation_needed:

#             # # Delete old detSims
#             # destims = db.session.query(DetSimilarity)\
#             #             .join(sq,DetSimilarity.detection_1==sq.c.id)\
#             #             .join(sq2,DetSimilarity.detection_2==sq2.c.id)\
#             #             .all()

#             # for destim in destims:
#             #     db.session.delete(destim)

#             if algorithm == 'hotspotter':
#                 # Wbia is only imported here to prevent its version of mysql interfering with flask migrate
#                 # Also suppressing deprication warning since wbia's utool seems to be an issue
#                 # this means we need to use python 3.9 or lower
#                 import warnings
#                 with warnings.catch_warnings():
#                     warnings.filterwarnings("ignore", category=DeprecationWarning)
#                     from wbia import opendb
#                     import utool as ut
#                     from wbia.algo.hots.pipeline import request_wbia_query_L0

#                 startTime = time.time()
#                 labelName = species.replace(' ','_').lower()
#                 dbName = 'hots_' + task.survey.name.replace(' ','_').lower() + '_' + task.name.replace(' ','_').lower() + '_' + labelName
#                 imFolder = dbName + '_images'

#                 if os.path.isdir(dbName):
#                     shutil.rmtree(dbName, ignore_errors=True)
#                 if os.path.isdir(imFolder):
#                     shutil.rmtree(imFolder, ignore_errors=True)

#                 os.mkdir(imFolder)

#                 # Create new DB
#                 ibs = opendb(dbdir=dbName,allow_newdir=True)

#                 # Add species
#                 species_nice_list = [species]
#                 species_text_list = [labelName]
#                 species_code_list = ['SH']
#                 species_ids = ibs.add_species(species_nice_list, species_text_list, species_code_list)
#                 hs_label = species_ids[0]

#                 # get the data from the db efficiently
#                 data = db.session.query(Detection.id,Detection.left,Detection.right,Detection.top,Detection.bottom,Image.id,Image.filename,Camera.path)\
#                                     .join(Image,Detection.image_id==Image.id)\
#                                     .join(Camera,Image.camera_id==Camera.id)\
#                                     .join(Labelgroup,Labelgroup.detection_id==Detection.id)\
#                                     .join(Task,Labelgroup.task_id==Task.id)\
#                                     .join(Label,Labelgroup.labels)\
#                                     .filter(Task.id.in_(task_ids))\
#                                     .filter(Label.description==species)\
#                                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                                     .filter(Detection.static == False) \
#                                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
#                                     .distinct().all()

#                 # Import images
#                 aid_list = []
#                 aid_Translation = {}
#                 det_Translation = {}
#                 gid_Translation = {}
#                 for item in data:
#                     image_id = item[5]

#                     if image_id not in gid_Translation.keys():
#                         #Download & import image
#                         path = item[-1]
#                         filename = item[-2]
#                         key = path+'/'+filename
#                         filename = imFolder + '/' + str(image_id) + '.jpg'
#                         GLOBALS.s3client.download_file(Bucket=Config.BUCKET, Key=key, Filename=filename)
#                         gid = ibs.add_images([ut.unixpath(ut.grab_test_imgpath(filename))], auto_localize=False)[0]
#                         gid_Translation[image_id] = gid

#                     # Annotations
#                     gid = gid_Translation[image_id]
#                     detection_id = item[0]
#                     left = item[1]
#                     right = item[2]
#                     top = item[3]
#                     bottom = item[4]

#                     imWidth = ibs.get_image_widths(gid)
#                     imHeight = ibs.get_image_heights(gid)
#                     w = math.floor(imWidth*(right-left))
#                     h = math.floor(imHeight*(bottom-top))
#                     x = math.floor(imWidth*left)
#                     y = math.floor(imHeight*top)

#                     aids = ibs.add_annots([gid],bbox_list=[[x, y, w, h]],species_rowid_list=[hs_label])
#                     aid_list.extend(aids)

#                     aid = aids[0]
#                     aid_Translation[detection_id] = aid
#                     det_Translation[aid] = detection_id

#                 endTime = time.time()
#                 if Config.DEBUGGING: app.logger.info("Hotspotter DB set up in {}".format(endTime - startTime))
                
#                 # Run Hotspotter
#                 # quaid_list = query ids
#                 # daid_list = database ids
#                 qaid_list = []
#                 for detection in queryDetections:
#                     aid = aid_Translation[detection]
#                     qaid_list.append(aid)

#                 daid_list = aid_list.copy()
#                 qreq_ = ibs.new_query_request(qaid_list, daid_list)
#                 cm_list = request_wbia_query_L0(ibs, qreq_)

#                 # Digest results
#                 for cm in cm_list:
#                     startTime = time.time()
#                     detection1_id = det_Translation[cm.qaid]
#                     covered_detections = []
#                     for n in range(len(cm.daid_list)):
#                         score = cm.score_list[n]
#                         aid2 = cm.daid_list[n]
#                         detection2_id = det_Translation[aid2]
#                         covered_detections.append(detection2_id)

#                         detSimilarity = db.session.query(DetSimilarity).filter(\
#                                                     or_(\
#                                                         and_(\
#                                                             DetSimilarity.detection_1==detection1_id,\
#                                                             DetSimilarity.detection_2==detection2_id),\
#                                                         and_(\
#                                                             DetSimilarity.detection_1==detection2_id,\
#                                                             DetSimilarity.detection_2==detection1_id)\
#                                                     )).first()

#                         if detSimilarity == None:
#                             detSimilarity = DetSimilarity(detection_1=detection1_id, detection_2=detection2_id)
#                             db.session.add(detSimilarity)

#                         detSimilarity.score = float(score)

#                     non_covered_detections = [r[0] for r in db.session.query(Detection.id)\
#                                                     .join(Labelgroup)\
#                                                     .join(Task)\
#                                                     .join(Label,Labelgroup.labels)\
#                                                     .filter(Task.id.in_(task_ids))\
#                                                     .filter(Label.description==species)\
#                                                     .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
#                                                     .filter(Detection.static == False) \
#                                                     .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES)) \
#                                                     .filter(~Detection.id.in_(covered_detections))\
#                                                     .filter(Detection.id!=detection1_id)\
#                                                     .distinct().all()]

#                     for non_covered in non_covered_detections:
#                         detSimilarity = db.session.query(DetSimilarity).filter(\
#                                                         or_(\
#                                                             and_(\
#                                                                 DetSimilarity.detection_1==detection1_id,\
#                                                                 DetSimilarity.detection_2==non_covered),\
#                                                             and_(\
#                                                                 DetSimilarity.detection_1==non_covered,\
#                                                                 DetSimilarity.detection_2==detection1_id)\
#                                                         )).first()

#                         if detSimilarity == None:
#                             detSimilarity = DetSimilarity(detection_1=detection1_id, detection_2=non_covered)
#                             db.session.add(detSimilarity)

#                         if detSimilarity.score == None:
#                             detSimilarity.score = 0

#                     # db.session.commit()
#                     if Config.DEBUGGING: app.logger.info("Hotspotter run for detection {} in {}s".format(detection1_id,time.time() - startTime))

#                 # Delete images & db
#                 shutil.rmtree(dbName, ignore_errors=True)
#                 shutil.rmtree(imFolder, ignore_errors=True)

#             elif algorithm == 'none':
#                 allDetections = queryDetections.copy()

#                 for queryDetection in queryDetections:
#                     allDetections.remove(queryDetection)
#                     for detection in allDetections:
#                         detSimilarity = db.session.query(DetSimilarity).filter(\
#                                                         or_(\
#                                                             and_(\
#                                                                 DetSimilarity.detection_1==queryDetection,\
#                                                                 DetSimilarity.detection_2==detection),\
#                                                             and_(\
#                                                                 DetSimilarity.detection_1==detection,\
#                                                                 DetSimilarity.detection_2==queryDetection)\
#                                                         )).first()

#                         if detSimilarity == None:
#                             detSimilarity = DetSimilarity(detection_1=queryDetection, detection_2=detection)
#                             db.session.add(detSimilarity)

#                         detSimilarity.score = 1

#         app.logger.info("Hotspotter run completed in {}s".format(time.time() - OverallStartTime))

#         # if len(task_ids)==1:
#         #     active_jobs = [r.decode() for r in GLOBALS.redisClient.smembers('active_jobs_'+str(task_ids[0]))]
#         #     user_ids = [r[0] for r in db.session.query(User.id)\
#         #                                         .join(Individual, Individual.user_id==User.id)\
#         #                                         .join(Task,Individual.tasks)\
#         #                                         .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
#         #                                         .filter(Task.id.in_(task_ids))\
#         #                                         .filter(Individual.species==species)\
#         #                                         .filter(IndSimilarity.score==None)\
#         #                                         .filter(~User.username.in_(active_jobs))\
#         #                                         .distinct().all()]
#         # else:
#         #     user_ids = None

#         # task.survey.status = 'indprocessing'
#         # db.session.commit()

#         # calculate_individual_similarities.delay(task_id=task.id,species=species,user_ids=user_ids)

#         db.session.commit()
#         task = db.session.query(Task).get(task_ids[0])
#         if task.status not in ['PROGRESS','PENDING'] or (len(task_ids)>1 and ('-5' in task.tagging_level)):
#             task.survey.status = 'indprocessing'
#             db.session.commit()
#             calculate_individual_similarities.delay(task_id=task.id,species=species)
#         else:
#             task.survey.status = 'Launched'
#             db.session.commit()

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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def calculate_detection_similarities(self,task_ids,species,algorithm):
    '''
    Celery task for calculating the similarity between detections for individual ID purposes.

        Parameters:
            task_ids (list): Tasks for which the calculation must take place
            species (str): The species for which the individual ID is being performed
            algorithm (str): The selected algorithm
    '''

    try:

        if algorithm == 'hotspotter':

            if len(task_ids)==1:
                task = db.session.query(Task).get(task_ids[0])
            else:
                task = db.session.query(Task).filter(Task.id.in_(task_ids)).filter(Task.sub_tasks.any()).first()
            task.survey.status = 'processing'
            db.session.commit()

            process_detections_for_individual_id(task_ids,species)

            base_detection_query = rDets(db.session.query(Detection.id)\
                                            .join(Labelgroup)\
                                            .join(Label,Labelgroup.labels)\
                                            .filter(Label.description==species))\
                                            .filter(Detection.aid!=None)
            results = []
            ambiguous_flank = Config.FLANK_DB['ambiguous']
            flanks = [flank for flank in  Config.FLANK_DB.values() if flank != None and flank != ambiguous_flank]
            flanks = [ambiguous_flank] + flanks # Ensure ambiguous flank is processed first
            processed_dets_ambiguous = {task_id1: {task_id2: [] for task_id2 in task_ids} for task_id1 in task_ids}
            batch = []
            count_in_batch = 0
            for flank in flanks:
                if flank == ambiguous_flank: 
                    required_flanks = flanks
                else:
                    required_flanks = [flank,ambiguous_flank]
                new_dets = {}
                processed_dets = {}
                for task_1 in task_ids:
                    new_dets[task_1] = {}
                    processed_dets[task_1] = {}
                    for task_2 in task_ids:
                        # Get new detections from task 1 that have no detection similarities with detections of the required flank from task 2
                        task2_dets = rDets(db.session.query(Detection.id)\
                                            .join(Labelgroup)\
                                            .join(Label,Labelgroup.labels)\
                                            .filter(Labelgroup.task_id==task_2)\
                                            .filter(Label.description==species)\
                                            .filter(Detection.flank.in_(required_flanks)))\
                                            .filter(Detection.aid!=None)\
                                            .subquery()
                        sim_dets1 = db.session.query(DetSimilarity.detection_1.label('id'))\
                                            .join(task2_dets, task2_dets.c.id==DetSimilarity.detection_2)\
                                            .distinct()
                        sim_dets2 = db.session.query(DetSimilarity.detection_2.label('id'))\
                                            .join(task2_dets, task2_dets.c.id==DetSimilarity.detection_1)\
                                            .distinct()
                        sim_dets = sim_dets1.union(sim_dets2).subquery()
                        new_dets[task_1][task_2] = [r[0] for r in base_detection_query\
                                                        .outerjoin(sim_dets, Detection.id==sim_dets.c.id)\
                                                        .filter(Labelgroup.task_id==task_1)\
                                                        .filter(Detection.flank==flank)\
                                                        .filter(sim_dets.c.id==None)\
                                                        .distinct().all()]
                        processed_dets[task_1][task_2] = []

                for task_1 in task_ids:
                    for task_2 in new_dets[task_1]:
                        # Calculate similarity between new detections from task 1 and detections from task 2 that have not been processed
                        dets_1 = new_dets[task_1][task_2]  
                        if dets_1:                          
                            dets_2 = [r[0] for r in base_detection_query\
                                                    .filter(Labelgroup.task_id==task_2)\
                                                    .filter(Detection.flank.in_(required_flanks))\
                                                    .distinct().all()]
                            
                            if flank == ambiguous_flank:
                                processed_dets_ambiguous[task_1][task_2] = new_dets[task_1][task_2]
                            else:
                                if processed_dets_ambiguous[task_1][task_2]:
                                    dets_2 = list(set(dets_2) - set(processed_dets_ambiguous[task_1][task_2]))
                                if processed_dets_ambiguous[task_2][task_1]:
                                    dets_2 = list(set(dets_2) - set(processed_dets_ambiguous[task_2][task_1]))
                            
                            if processed_dets[task_2][task_1]:
                                dets_2 = list(set(dets_2) - set(processed_dets[task_2][task_1]))
                            else:
                                processed_dets[task_1][task_2] = new_dets[task_1][task_2]        

                            for det_1 in dets_1:
                                if det_1 in dets_2: dets_2.remove(det_1)
                                if dets_2:
                                    if len(dets_2) > 5000:
                                        for chunk in chunker(dets_2,5000):
                                            results.append(calculate_hotspotter_similarity.apply_async(kwargs={'batch': [{'query_ids': [det_1], 'db_ids': chunk}]}, queue='parallel'))
                                    else:
                                        if (count_in_batch + len(dets_2)) > 5000:
                                            results.append(calculate_hotspotter_similarity.apply_async(kwargs={'batch': batch}, queue='parallel'))
                                            batch = []
                                            count_in_batch = 0
                                        
                                        batch.append({
                                            'query_ids': [det_1],
                                            'db_ids': dets_2.copy()
                                        })
                                        count_in_batch += len(dets_2)
                                        
            if batch:
                results.append(calculate_hotspotter_similarity.apply_async(kwargs={'batch': batch}, queue='parallel'))

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

        labels = db.session.query(Label).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).all()
        for label in labels:
            if algorithm == 'none': 
                label.algorithm = 'heuristic'
            else:
                label.algorithm = algorithm

        task = db.session.query(Task).get(task_ids[0])
        task.survey.status = 'indprocessing'
        calculate_individual_similarities.delay(task_id=task.id,species=species)
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
def calculate_individual_similarity(self,individual1,individuals2,species,parameters=None):
    '''
    Calculates the similarity between a single individual, and a list of individuals.

        Parameters:
            individual1 (int): Single individual
            individuals2 (list): IDs of multiple individuals
            parameters (dict): Optional list of weights
    '''
    
    try:

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

        individual1 = db.session.query(Individual).get(individual1)
        individuals2 = db.session.query(Individual).filter(Individual.id.in_(individuals2)).all()

        task_ids = [t.id for t in individual1.tasks]
        algorithm = db.session.query(Label.algorithm).filter(Label.description==species).filter(Label.task_id.in_(task_ids)).first()[0]

        # # Find all family
        # family = []
        # children = db.session.query(Individual).filter(Individual.parent==individual1).all()
        # while children != []:
        #     family.extend(children)
        #     temp = []
        #     for child in children:
        #         temp.extend(db.session.query(Individual).filter(Individual.parent==child).all())
        #     children = temp

        # # siblings
        # parents = db.session.query(Individual).filter(Individual.children.contains(individual1)).all()
        # for parent in parents:
        #     family.extend(db.session.query(Individual).filter(Individual.parent==parent).filter(Individual!=individual1).all())

        # while parents != []:
        #     family.extend(parents)
        #     temp = []
        #     for parent in parents:
        #         temp.extend(db.session.query(Individual).filter(Individual.children.contains(parent)).all())
        #     parents = temp

        # family = list(set(family))

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
            if individual1 and individual2 != individual1:
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

                # if individual2 in family:
                #     max_similarity = -1500
                # else:
                if True:
                    testImage = db.session.query(Image)\
                                            .join(Det1, Det1.c.image_id==Image.id)\
                                            .join(Det2, Det2.c.image_id==Image.id)\
                                            .join(individualDetections1,individualDetections1.c.detection_id==Det1.c.id)\
                                            .join(individualDetections2,individualDetections2.c.detection_id==Det2.c.id)\
                                            .filter(individualDetections1.c.individual_id==individual1.id)\
                                            .filter(individualDetections2.c.individual_id==individual2.id)\
                                            .first()

                    if testImage:
                        # Individuals share an image
                        max_similarity = -1000
                    else:
                        tagScore = 0
                        individual1_tags = db.session.query(Tag).filter(Tag.individuals.contains(individual1)).all()
                        individual2_tags = db.session.query(Tag).filter(Tag.individuals.contains(individual2)).all()
                        for tag in individual1_tags:
                            if tag in individual2_tags:
                                tagScore += matchWeight
                            else:
                                tagScore -= mismatchWeight
                        for tag in individual2_tags:
                            if tag not in individual1_tags:
                                tagScore -= mismatchWeight

                        if algorithm == 'hotspotter':
                            detSimilarities = db.session.query(DetSimilarity.score,
                                        Det1.c.id,Det1.c.left,Det1.c.right,Det1.c.top,Det1.c.bottom,Det1.c.flank,Image1.c.camera_id,Image1.c.corrected_timestamp,Trapgroup1.c.latitude,Trapgroup1.c.longitude,
                                        Det2.c.id,Det2.c.left,Det2.c.right,Det2.c.top,Det2.c.bottom,Det2.c.flank,Image2.c.camera_id,Image2.c.corrected_timestamp,Trapgroup2.c.latitude,Trapgroup2.c.longitude)\
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
                        else:
                            detections1 = db.session.query(Detection.id, Detection.left, Detection.right, Detection.top, Detection.bottom, Detection.flank,Image.camera_id, Image.corrected_timestamp, Trapgroup.latitude, Trapgroup.longitude)\
                                                .join(individualDetections1, individualDetections1.c.detection_id==Detection.id)\
                                                .join(Image, Image.id==Detection.image_id)\
                                                .join(Camera, Camera.id==Image.camera_id)\
                                                .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                                                .filter(individualDetections1.c.individual_id==individual1.id).all()

                            detections2 = db.session.query(Detection.id, Detection.left, Detection.right, Detection.top, Detection.bottom, Detection.flank,Image.camera_id, Image.corrected_timestamp, Trapgroup.latitude, Trapgroup.longitude)\
                                                .join(individualDetections2, individualDetections2.c.detection_id==Detection.id)\
                                                .join(Image, Image.id==Detection.image_id)\
                                                .join(Camera, Camera.id==Image.camera_id)\
                                                .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id)\
                                                .filter(individualDetections2.c.individual_id==individual2.id).all()
                            
                            detSimilarities = []
                            for det1 in detections1:
                                for det2 in detections2:
                                    detSimilarities.append((1,det1[0],det1[1],det1[2],det1[3],det1[4],det1[5],det1[6],det1[7],det1[8],det1[9],det2[0],det2[1],det2[2],det2[3],det2[4],det2[5],det2[6],det2[7],det2[8],det2[9]))

                        max_similarity = 0
                        for detSimilarity in detSimilarities:
                            detSimScore = detSimilarity[0]
                            det1 = {
                                'id': detSimilarity[1],
                                'left': detSimilarity[2],
                                'right': detSimilarity[3],
                                'top': detSimilarity[4],
                                'bottom': detSimilarity[5],
                                'flank': detSimilarity[6]
                            }
                            image1 = {
                                'camera_id': detSimilarity[7],
                                'corrected_timestamp': detSimilarity[8]
                            }
                            trapgroup1 = {
                                'latitude': detSimilarity[9],
                                'longitude': detSimilarity[10]
                            }
                            det2 = {
                                'id': detSimilarity[11],
                                'left': detSimilarity[12],
                                'right': detSimilarity[13],
                                'top': detSimilarity[14],
                                'bottom': detSimilarity[15],
                                'flank': detSimilarity[16]
                            }
                            image2 = {
                                'camera_id': detSimilarity[17],
                                'corrected_timestamp': detSimilarity[18]
                            }
                            trapgroup2 = {
                                'latitude': detSimilarity[19],
                                'longitude': detSimilarity[20]
                            }

                            iou_factor = 1
                            # if image1['camera_id']==image2['camera_id']:
                            #     intersection_left = max(det1['left'],det2['left'])
                            #     intersection_right = min(det1['right'],det2['right'])
                            #     intersection_top = max(det1['top'],det2['top'])
                            #     intersection_bottom = min(det1['bottom'],det2['bottom'])

                            #     if (intersection_right>intersection_left) and (intersection_bottom>intersection_top):
                            #         intersection_area = (intersection_right-intersection_left)*(intersection_bottom-intersection_top)
                            #         detection1_area = (det1['right']-det1['left'])*(det1['bottom']-det1['top'])
                            #         detection2_area = (det2['right']-det2['left'])*(det2['bottom']-det2['top'])
                            #         union_area = detection1_area + detection2_area - intersection_area
                            #         iou = intersection_area/union_area
                            #         iou_factor = (1-(iouWeight*iou))**2
                            
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

                            #TODO: ADJUST THE SCORE BASED ON DETECTION FLANKS 

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
def calculate_individual_similarities(self,task_id,species):
    '''
    Celery task for calculating the individual similarities between all individuals generated by the specified users, against all others with the same label from the same task.

    Parameters:
        task_id (int): The task for which individual similarities must be calculated
        species (str): The species for which individual similarities must be calculated
    '''
    
    try:
        OverallStartTime = time.time()

        task = db.session.query(Task).get(task_id)
        if task.survey.status != 'indprocessing':	
            task.survey.status = 'indprocessing'
            db.session.commit()

        task_ids = [r.id for r in task.sub_tasks]
        task_ids.append(task.id)

        individuals1 = [r[0] for r in db.session.query(Individual.id)\
                                            .join(Task,Individual.tasks)\
                                            .filter(Task.id.in_(task_ids))\
                                            .filter(Individual.species==species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .all()]

        individuals2 = individuals1.copy()

        app.logger.info('Individual similarities are being calculated for tasks: {}, species: {}, nr individuals: {}'.format(task_ids,species,len(individuals1)))

        total_individual_count = len(individuals2)

        # task.survey.images_processing = total_individual_count
        # db.session.commit()

        results = []
        if total_individual_count > 1:
            for individual1 in individuals1:
                if individual1 in individuals2: individuals2.remove(individual1)
                if individuals2:
                    results.append(calculate_individual_similarity.apply_async(kwargs={'individual1':individual1,'individuals2':individuals2,'species':species},queue='parallel'))
            
        #Wait for processing to complete
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

        endTime = time.time()
        app.logger.info("All individual similarities completed in {}".format(endTime - OverallStartTime))

        task = db.session.query(Task).get(task_id)
        # task.survey.images_processing = 0
        if task.sub_tasks and ('-5' in task.tagging_level):
            from app.functions.annotation import launch_task
            task.survey.status = 'Launched'
            db.session.commit()
            launch_task.apply_async(kwargs={'task_id':task_id})
        elif task.status != 'PROGRESS' and task.status != 'PENDING':
            from app.functions.annotation import launch_task
            updateIndividualIdStatus(task_id)
            task.survey.status = 'Launched'
            task.status = 'PENDING'
            task.tagging_level = '-5,'+species+',-1'
            db.session.commit()
            launch_task.apply_async(kwargs={'task_id':task_id})
        else:
            task.survey.status = 'Launched'
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

# @celery.task(bind=True,max_retries=5,ignore_result=True)
# def calculate_individual_similarities(self,task_id,species,user_ids):
#     '''
#     Celery task for calculating the individual similarities between all individuals generated by the specified users, against all others with the same label from the same task.

#     Parameters:
#         task_id (int): The task for which individual similarities must be calculated
#         species (str): The species for which individual similarities must be calculated
#         user_ids (int): The users whose individuals must hae their similarities calculated
#     '''
    
#     try:
#         OverallStartTime = time.time()

#         session = db.session()

#         task = session.query(Task).get(task_id)
#         task.survey.status = 'indprocessing'
#         session.commit()

#         task_ids = [r.id for r in task.sub_tasks]
#         task_ids.append(task.id)

#         individuals1 = session.query(Individual)\
#                                             .join(Task,Individual.tasks)\
#                                             .filter(Task.id.in_(task_ids))\
#                                             .filter(Individual.species==species)\
#                                             .filter(Individual.name!='unidentifiable')

#         # Don't need to do this for multi-task individual ID because all the individuals are already defined and we want to 
#         # calculate similarities between all of them
#         if (len(task_ids)==1) and user_ids: individuals1 = individuals1.filter(Individual.user_id.in_(user_ids))

#         individuals1 = individuals1.all()

#         individuals2 = session.query(Individual)\
#                                             .join(Task,Individual.tasks)\
#                                             .filter(Task.id.in_(task_ids))\
#                                             .filter(Individual.species==species)\
#                                             .filter(Individual.name!='unidentifiable')\
#                                             .all()

#         app.logger.info('Individual similarities are being calculated for {} individuals'.format(len(individuals1)))

#         total_individual_count = len(individuals2)

#         if total_individual_count > 1:
#             # This is a hack - do not touch
#             # Without this, the first individual in the list is not processed
#             if individuals1: calculate_individual_similarity(individuals1[0],[],session)

#             # pool = Pool(processes=4)
#             for individual1 in individuals1:
#                 if individual1 in individuals2: individuals2.remove(individual1)
#                 if individuals2:
#                     # pool.apply_async(calculate_individual_similarity,(individual1,individuals2.copy()))
#                     calculate_individual_similarity(individual1,individuals2,session)
#             # pool.close()
#             # pool.join()

#         endTime = time.time()
#         app.logger.info("All individual similarities completed in {}".format(endTime - OverallStartTime))

#         task = session.query(Task).get(task_id)
#         app.logger.info("Task status: {}".format(task.status))
#         if task.sub_tasks and ('-5' in task.tagging_level):
#             from app.functions.annotation import launch_task
#             task.survey.status = 'Launched'
#             session.commit()
#             launch_task.apply_async(kwargs={'task_id':task_id})
#         elif task.status != 'PROGRESS':
#             #Check if complete
#             session.commit()
            
#             incompleteIndividuals = session.query(Individual)\
#                                             .join(Task,Individual.tasks)\
#                                             .outerjoin(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
#                                             .filter(Task.id.in_(task_ids))\
#                                             .filter(Individual.species==species)\
#                                             .filter(Individual.name!='unidentifiable')\
#                                             .filter(IndSimilarity.score==None)\
#                                             .distinct().count()

#             if Config.DEBUGGING: app.logger.info("incompleteIndividuals: {}".format(incompleteIndividuals))    

#             if (incompleteIndividuals == 0) or (task.status=='Stopped') or (total_individual_count==1):
#                 task.survey.status = 'Ready'
#                 session.commit()
#         else:
#             session.commit()

#     except Exception as exc:
#         app.logger.info(' ')
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(traceback.format_exc())
#         app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
#         app.logger.info(' ')
#         self.retry(exc=exc, countdown= retryTime(self.request.retries))

#     finally:
#         session.close()

#     return True

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
        if Config.DEBUGGING: app.logger.info('Undoing Skip')
        indSimilarity.skipped = False
    elif indSimilarity and (indSimilarity.score == -2000):
        if Config.DEBUGGING: app.logger.info('Undoing Reject')
        indSimilarity.score = indSimilarity.old_score
    else:
        if individual2.active==False:
            if Config.DEBUGGING: app.logger.info('Undoing Accept')
            individual2.active = True

            for detection in individual2.detections:
                individual1.detections.remove(detection)

            # Handle multi-tasks
            task = db.session.query(Task).get(task_id)
            task_ids = [r.id for r in task.sub_tasks]
            task_ids.append(task.id)
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

                        if detSim and detSim.score >= maxVal:
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

@celery.task(bind=True,max_retries=5,ignore_result=True)
def check_individual_detection_mismatch(self,task_id,cluster_id=None):
    ''' Checks for any detections whose labels differ from the their individuals' species'''
    
    try:
        task = db.session.query(Task).get(task_id)
        
        # Get all detections whose labels differ from their individuals' species and remove them from the individuals
        data = rDets(db.session.query(Detection.id, Label.description, Individual.id, Individual.species)\
                                .join(Individual,Detection.individuals)\
                                .join(Labelgroup)\
                                .join(Label, Labelgroup.labels)\
                                .filter(Labelgroup.task_id==task_id)\
                                .filter(Individual.species!=Label.description)\
                                .filter(Individual.tasks.contains(task))\
                                )

        if cluster_id:
            data = data.join(Image).join(Cluster,Image.clusters).filter(Cluster.id==cluster_id)

        data = data.distinct().all()

        individuals_data = {}
        individuals_species = {}
        wbia_detections = []
        for d in data:
            if d[2] not in individuals_data.keys():
                individuals_data[d[2]] = [d[0]]
                individuals_species[d[2]] = d[3]
            else:
                individuals_data[d[2]].append(d[0])
            detection = db.session.query(Detection).get(d[0])
            individual = db.session.query(Individual).get(d[2])
            if detection in individual.detections:
                individual.detections.remove(detection)
                # wbia_detections.append(detection)


        # Delete individuals with no detections
        individuals = db.session.query(Individual)\
                                .outerjoin(Detection, Individual.detections)\
                                .filter(Detection.id==None)\
                                .filter(Individual.tasks.contains(task))\
                                .filter(Individual.name!='unidentifiable')\
                                .all()

        for individual in individuals:
            allSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).distinct().all()
            for similarity in allSimilarities:
                db.session.delete(similarity)

            individual.detections = []
            individual.tags = []
            individual.children = []
            individual.parents = []
            individual.tasks = []
            db.session.delete(individual)
            del individuals_data[individual.id]
            

        # Clean up WBIA data & Detection similarities if they are not associated with any other individual for other tasks 
        # aid_list = []
        # for detection in wbia_detections:
        #     if not detection.individuals:
        #         if detection.aid: aid_list.append(detection.aid)
        #         detection.aid = None
        #         detSims = db.session.query(DetSimilarity).filter(or_(DetSimilarity.detection_1==detection.id,DetSimilarity.detection_2==detection.id)).all()
        #         for detSim in detSims:
        #             db.session.delete(detSim)

        
        # keep_aid_list = [r[0] for r in db.session.query(Detection.aid, func.count(Detection.id))\
        #                     .filter(Detection.aid.in_(aid_list))\
        #                     .group_by(Detection.aid)\
        #                     .distinct().all() if r[1]>0]
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

        # Recalculate similarities where removed detections were used
        individuals_check = []
        for individual_id in individuals_data:
            det_ids = individuals_data[individual_id]
            species = individuals_species[individual_id]
            individuals1 = [r[0] for r in db.session.query(Individual.id)\
                                            .join(Task,Individual.tasks)\
                                            .join(IndSimilarity, or_(IndSimilarity.individual_1==Individual.id,IndSimilarity.individual_2==Individual.id))\
                                            .filter(Task.id==task_id)\
                                            .filter(Individual.species==individual.species)\
                                            .filter(Individual.name!='unidentifiable')\
                                            .filter(Individual.id != individual_id)\
                                            .filter(Individual.id.notin_(individuals_check))\
                                            .filter(or_(IndSimilarity.individual_1==individual_id,IndSimilarity.individual_2==individual_id))\
                                            .filter(or_(IndSimilarity.detection_1.in_(det_ids),IndSimilarity.detection_2.in_(det_ids)))\
                                            .all()]

            if len(individuals1) > 0:
                individuals_check.append(individual_id)
                calculate_individual_similarity.delay(individual1=individual_id,individuals2=individuals1,species=species)

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

def process_detections_for_individual_id(task_ids,species,pose_only=False):
    '''
    Task for processing detections for individual ID purposes. This task is used to segment images and perform pose estimation. It is also used
    to add the images to the Hotspotter (wbia db) database and calcualte the keypoints for the detections to be used in the similarity calculation.

        Parameters:
            task_id (int): The task for which the detections are being processed
            species (str): The species for which the individual ID is being performed
            pose_only (bool): If True, only the pose is calculated
    '''

    try:

        app.logger.info('Process detections for individual ID for task_ids: {}, species: {}'.format(task_ids,species))
        starttime = time.time()

        data = rDets(db.session.query(Detection.id,Detection.left,Detection.right,Detection.top,Detection.bottom,Image.id,Image.filename,Camera.path)\
                            .join(Image,Detection.image_id==Image.id)\
                            .join(Camera,Image.camera_id==Camera.id)\
                            .join(Labelgroup,Labelgroup.detection_id==Detection.id)\
                            .join(Task,Labelgroup.task_id==Task.id)\
                            .join(Label,Labelgroup.labels)\
                            .filter(Task.id.in_(task_ids))\
                            .filter(Label.description==species))
        
        if pose_only:
            data = data.filter(Detection.flank==None)
        else:
            data = data.filter(or_(Detection.aid==None,Detection.flank==None))

        data = data.distinct().all()

        det_data = []
        for d in data:
            det_data.append({
                'detection_id': d[0],
                'image_id': d[5],
                'bbox': {
                    'left': d[1],
                    'right': d[2],
                    'top': d[3],
                    'bottom': d[4]
                },
                'image_path': d[7] + '/' + d[6]
            })

        results = []
        for batch in chunker(det_data,500):
            results.append(segment_and_pose.apply_async(kwargs={'batch': batch, 'sourceBucket': Config.BUCKET, 'species': species, 'pose_only':pose_only}, queue='similarity', routing_key='similarity.segment_and_pose'))
            

        GLOBALS.lock.acquire()
        with allow_join_result():
            for result in results:
                try:
                    response = result.get()
                    detections = db.session.query(Detection).filter(Detection.id.in_(response.keys())).all()
                    for detection in detections:
                        try:
                            if detection.flank is None:
                                detection.flank = response[str(detection.id)]['flank']
                            if not pose_only:
                                detection.aid = response[str(detection.id)]['aid']
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

        app.logger.info('Finished processing detections for individual ID in {}s'.format(time.time()-starttime))

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    return True


@celery.task(bind=True,max_retries=5)
def calculate_hotspotter_similarity(self,batch):
    '''
    Celery task for calculating the similarity between detections using Hotspotter.

        Parameters:
            batch (list): List of detection IDs for which the similarity must be calculated. It includes the following:
            - query_ids (list): Detection IDs for the query wbia aids
            - db_ids (list): Detection IDs for the database wbia aids
    '''

    try:
        starttime = time.time()
        from wbia.algo.hots.pipeline import request_wbia_query_L0

        if GLOBALS.ibs is None:
            from wbia import opendb
            GLOBALS.ibs = opendb(db=Config.WBIA_DB_NAME,dbdir=Config.WBIA_DIR+'_'+Config.WORKER_NAME,allow_newdir=True)

        det_ids = []
        for item in batch:
            det_ids.extend(item['query_ids'])
            det_ids.extend(item['db_ids'])
        det_ids = list(set(det_ids))
        det_data = db.session.query(Detection.id,Detection.aid).filter(Detection.id.in_(det_ids)).filter(Detection.aid!=None).all()
        det_translation = {}
        aid_translation = {}
        for d in det_data:
            det_translation[d[1]] = d[0]
            aid_translation[d[0]] = d[1]

        for item in batch:
            query_ids = item['query_ids']
            db_ids = item['db_ids']
            qaid_list = [aid_translation[d] for d in query_ids if d in aid_translation.keys()]
            daid_list = [aid_translation[d] for d in db_ids if d in aid_translation.keys()]

            if not qaid_list or not daid_list:
                return True

            qreq_ = GLOBALS.ibs.new_query_request(qaid_list, daid_list)
            cm_list = request_wbia_query_L0(GLOBALS.ibs, qreq_)

            tblname = 'featurematches'
            colnames = ('annot_rowid1', 'annot_rowid2', 'fm', 'fs')
            superkey_paramx = [0, 1]

            def get_rowid_from_superkey(aid1_list, aid2_list):
                # Check if the data already exists
                row_ids1 = GLOBALS.ibs.db.get_where_eq('featurematches', ('fm_rowid',), zip(aid1_list, aid2_list), ['annot_rowid1', 'annot_rowid2'])
                row_ids2 = GLOBALS.ibs.db.get_where_eq('featurematches', ('fm_rowid',), zip(aid2_list, aid1_list), ['annot_rowid1', 'annot_rowid2'])
                row_ids1 = [r for r in row_ids1 if r is not None]
                row_ids2 = [r for r in row_ids2 if r is not None] # Have to remove None from list otherwise it will add the data even if there is other rows with the same superkey
                row_ids = row_ids1 + row_ids2
                if len(row_ids) == 0:
                    row_ids = [None]
                return row_ids


            for cm in cm_list:
                aid1 = cm.qaid
                detection1_id = det_translation[aid1]
                for n in range(len(cm.daid_list)):
                    aid2 = int(cm.daid_list[n])
                    detection2_id = det_translation[aid2]
                    score = float(cm.score_list[n])
                    if score > 0:
                        fm = cm.fm_list[n]
                        fs = cm.fsv_list[n]
                        params_iter = [(aid1, aid2, fm, fs)]
                        rowid_list = GLOBALS.ibs.db.add_cleanly(tblname, colnames, params_iter, get_rowid_from_superkey, superkey_paramx)

                        detSimilarity = db.session.query(DetSimilarity).filter(\
                                                    or_(\
                                                        and_(\
                                                            DetSimilarity.detection_1==detection1_id,\
                                                            DetSimilarity.detection_2==detection2_id),\
                                                        and_(\
                                                            DetSimilarity.detection_1==detection2_id,\
                                                            DetSimilarity.detection_2==detection1_id)\
                                                    )).first()

                        if detSimilarity == None:
                            detSimilarity = DetSimilarity(detection_1=detection1_id, detection_2=detection2_id)
                            db.session.add(detSimilarity)

                        detSimilarity.score = float(score)

            #Get flann dir and remove it
            flann_cachedir = GLOBALS.ibs.get_flann_cachedir()
            nnindexer = qreq_.indexer
            if nnindexer:
                noquery = True
                flann_cfgstr = nnindexer.get_cfgstr(noquery)
                flann_path = flann_cachedir + '/flann' + flann_cfgstr + '.flann'
                if os.path.exists(flann_path):
                    os.remove(flann_path)

        db.session.commit()
        app.logger.info('Finished calculating hotspotter similarity in {}s'.format(time.time()-starttime))

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

def calc_kpt_coords(kpts,chip_size,detection):
    ''' Calculates the coordinates of the keypoints in the original image based on the keypoints in the chip image.'''

    kpts_coords = []
    for kpt in kpts:
        xc = kpt[0]/chip_size[0]
        yc = kpt[1]/chip_size[1]
        x = detection.left + (xc*(detection.right-detection.left))
        y = detection.top + (yc*(detection.bottom-detection.top))
        kpts_coords.append([x,y])

    return kpts_coords

def get_featurematches(aid1,aid2):
    ''' Gets the feature matches between two detections (annotations).'''

    tblname = 'featurematches'
    colnames = ('annot_rowid1', 'annot_rowid2', 'fm', 'fs')
    params_iter = [{'aid1': aid1, 'aid2': aid2}]
    where_clause = '(annot_rowid1= :aid1 AND annot_rowid2= :aid2) OR (annot_rowid2= :aid1 AND annot_rowid1= :aid2)'
    data = GLOBALS.ibs.db.get_where(tblname, colnames, params_iter, where_clause)
    data = [d for d in data if d is not None]

    return data