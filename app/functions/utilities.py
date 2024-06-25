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
from app.functions.globals import *
import GLOBALS
from sqlalchemy.sql import func, or_, and_, alias
from sqlalchemy import desc, extract
from config import Config
import traceback
from celery.result import allow_join_result
import cv2
from PIL import Image as pilImage

@celery.task(bind=True,max_retries=5)
def copy_task_trapgroup(self,trapgroup_id,old_task_id,new_task_id):
    '''Creates a copy of the old task for new task and the given trapgroup, for the same survey.'''

    try:
        #set up label translations
        label_translations = {}
        oldLabels = db.session.query(Label).filter(Label.task_id==old_task_id).distinct().all()
        for oldLabel in oldLabels:
            newLabel = db.session.query(Label).filter(Label.task_id==new_task_id).filter(Label.description==oldLabel.description).first()
            label_translations[oldLabel] = newLabel
        
        globalLabels = db.session.query(Label).filter(Label.task_id==None).distinct().all()
        for globalLabel in globalLabels:
            label_translations[globalLabel] = globalLabel

        #set up tag translations
        tag_translations = {}
        oldTags = db.session.query(Tag).filter(Tag.task_id==old_task_id).distinct().all()
        for oldTag in oldTags:
            newTag = db.session.query(Tag).filter(Tag.task_id==new_task_id).filter(Tag.description==oldTag.description).first()
            tag_translations[oldTag] = newTag

        #copy clusters
        oldClusters = db.session.query(Cluster).join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Cluster.task_id==old_task_id).distinct().all()
        for oldCluster in oldClusters:
            newCluster = Cluster(
                user_id = oldCluster.user_id,
                task_id = new_task_id,
                timestamp = oldCluster.timestamp,
                notes = oldCluster.notes,
                checked = oldCluster.checked,
                classification = oldCluster.classification
            )
            db.session.add(newCluster)
            newCluster.images = oldCluster.images
            newCluster.tags = [tag_translations[oldTag] for oldTag in oldCluster.tags]
            newCluster.labels = [label_translations[oldLabel] for oldLabel in oldCluster.labels]
        
        #copy labelgroups
        oldLabelgroups = db.session.query(Labelgroup).join(Detection).join(Image).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).filter(Labelgroup.task_id==old_task_id).distinct().all()
        for oldLabelgroup in oldLabelgroups:
            newLabelgroup = Labelgroup(
                checked = oldLabelgroup.checked,
                detection_id = oldLabelgroup.detection_id,
                task_id = new_task_id
            )
            db.session.add(newLabelgroup)
            newLabelgroup.tags = [tag_translations[oldTag] for oldTag in oldLabelgroup.tags]
            newLabelgroup.labels = [label_translations[oldLabel] for oldLabel in oldLabelgroup.labels]

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
def copy_task_to_same_survey(self,old_task_id,new_name,copy_individuals=False):
    '''Creates a copy of the old task to a new task with the given name for the same survey.'''

    try:
        oldTask = db.session.query(Task).get(old_task_id)

        if (oldTask.status!='Copying') and ((oldTask.survey.status.lower() not in Config.SURVEY_READY_STATUSES) or (True in [(task.status.lower() not in Config.TASK_READY_STATUSES) for task in oldTask.survey.tasks])): return False

        oldTask.status = 'Copying'
        db.session.commit()
        newTask = db.session.query(Task).filter(Task.name==new_name).filter(Task.survey_id==oldTask.survey_id).first()

        if not newTask:    
            #create new task
            newTask = Task(
                name = new_name,
                survey_id = oldTask.survey_id,
                tagging_level = oldTask.tagging_level,
                test_size = oldTask.test_size,
                size = oldTask.size,
                status = oldTask.status,
                tagging_time = oldTask.tagging_time,
                complete = oldTask.complete,
                init_complete = oldTask.init_complete,
                is_bounding = oldTask.is_bounding,
                parent_classification = oldTask.parent_classification,
                ai_check_complete = oldTask.ai_check_complete,
                jobs_finished = oldTask.jobs_finished,
                current_name = oldTask.current_name,
                class_check_count = oldTask.class_check_count,
                unchecked_multi_count = oldTask.unchecked_multi_count,
                unlabelled_animal_cluster_count = oldTask.unlabelled_animal_cluster_count,
                vhl_count = oldTask.vhl_count,
                infoless_count = oldTask.infoless_count,
                infoless_vhl_count = oldTask.infoless_vhl_count,
                vhl_bounding_count = oldTask.vhl_bounding_count,
                potential_vhl_clusters = oldTask.potential_vhl_clusters,
                vhl_image_count = oldTask.vhl_image_count,
                vhl_sighting_count = oldTask.vhl_sighting_count,
                cluster_count = oldTask.cluster_count,
                clusters_remaining = oldTask.clusters_remaining
            )
            db.session.add(newTask)

            # copy labels
            label_translations = {}
            globalLabels = db.session.query(Label).filter(Label.task_id==None).distinct().all()
            for globalLabel in globalLabels:
                label_translations[globalLabel] = globalLabel

            for oldLabel in oldTask.labels:
                newLabel = Label(
                    description = oldLabel.description,
                    hotkey = oldLabel.hotkey,
                    complete = oldLabel.complete,
                    icID_allowed = oldLabel.icID_allowed,
                    icID_count = oldLabel.icID_count,
                    cluster_count = oldLabel.cluster_count,
                    bounding_count = oldLabel.bounding_count,
                    info_tag_count = oldLabel.info_tag_count,
                    potential_clusters = oldLabel.potential_clusters,
                    image_count = oldLabel.image_count,
                    sighting_count = oldLabel.sighting_count,
                    unidentified_count = oldLabel.unidentified_count,
                    task = newTask
                )
                db.session.add(newLabel)
                label_translations[oldLabel] = newLabel

            # copy label hierarchy
            for oldLabel in oldTask.labels:
                if oldLabel.parent:
                    label_translations[oldLabel].parent = label_translations[oldLabel.parent]

            # copy translations
            for oldTranslation in oldTask.translations:
                newTranslation = Translation(
                    classification = oldTranslation.classification,
                    auto_classify = oldTranslation.auto_classify,
                    label = label_translations[oldTranslation.label],
                    task = newTask
                )
                db.session.add(newTranslation)

            # copy tags
            tag_translations = {}
            for oldTag in oldTask.tags:
                newTag = Tag(
                    description = oldTag.description,
                    hotkey = oldTag.hotkey,
                    task = newTask
                )
                db.session.add(newTag)
                tag_translations[oldTag] = newTag

            db.session.commit()

        new_task_id = newTask.id

        #copy individuals
        if copy_individuals:
            check = db.session.query(Individual).filter(Individual.tasks.contains(newTask)).first()
            if not check:
                oldIndividuals = db.session.query(Individual).filter(Individual.tasks.contains(oldTask)).distinct().all()
                for oldIndividual in oldIndividuals:
                    newIndividual = Individual(
                        name = oldIndividual.name,
                        notes = oldIndividual.notes,
                        active = oldIndividual.active,
                        species = oldIndividual.species,
                        user_id = oldIndividual.user_id,
                        timestamp = oldIndividual.timestamp
                    )
                    db.session.add(newIndividual)
                    newIndividual.tags = [tag_translations[oldTag] for oldTag in oldIndividual.tags]
                    newIndividual.tasks = [newTask]
                    newIndividual.detections = db.session.query(Detection)\
                                                            .join(Image)\
                                                            .join(Camera)\
                                                            .join(Trapgroup).filter(Trapgroup.survey_id==newTask.survey_id)\
                                                            .filter(Detection.id.in_([r.id for r in oldIndividual.detections]))\
                                                            .distinct().all()
                db.session.commit()
        
        results = []
        for trapgroup in oldTask.survey.trapgroups:
            check = db.session.query(Cluster).join(Image,Cluster.images).join(Camera).filter(Camera.trapgroup==trapgroup).filter(Cluster.task==newTask).first()
            if not check:
                results.append(copy_task_trapgroup.apply_async(kwargs={'trapgroup_id': trapgroup.id,'old_task_id': old_task_id,'new_task_id': new_task_id},queue='default'))

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

        oldTask = db.session.query(Task).get(old_task_id)
        oldTask.status = 'Ready'
        newTask = db.session.query(Task).get(new_task_id)
        newTask.status = 'Ready'
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
def copy_trapgroup(self,old_trapgroup_id,old_survey_id,new_survey_id,task_translations,copy_individuals):
    '''Copies the specified trapgroup and all its tasks to the specified new survey.'''

    try:
        task_translations_copy = task_translations.copy()
        task_translations = {}
        for key in task_translations_copy:
            task_translations[int(key)] = int(task_translations_copy[key])

        newSurvey = db.session.query(Survey).get(new_survey_id)
        oldSurvey = db.session.query(Survey).get(old_survey_id)
        oldTrapgroup = db.session.query(Trapgroup).get(old_trapgroup_id)

        # setup translations:
        label_translations = {}
        oldLabels = db.session.query(Label).join(Task).filter(Task.survey_id==old_survey_id).distinct().all()
        globalLabels = db.session.query(Label).filter(Label.task_id==None).distinct().all()
        for globalLabel in globalLabels:
            label_translations[globalLabel] = globalLabel
        for oldLabel in oldLabels:
            newLabel = db.session.query(Label).filter(Label.description==oldLabel.description).filter(Label.task_id==task_translations[oldLabel.task_id]).first()
            label_translations[oldLabel] = newLabel

        tag_translations = {}
        oldTags = db.session.query(Tag).join(Task).filter(Task.survey_id==old_survey_id).distinct().all()
        for oldTag in oldTags:
            newTag = db.session.query(Tag).filter(Tag.description==oldTag.description).filter(Tag.task_id==task_translations[oldTag.task_id]).first()
            tag_translations[oldTag] = newTag

        #copy cameragroups
        cameragroup_translations = {}
        oldCameragroups = db.session.query(Cameragroup).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==old_survey_id).distinct().all()
        for oldCameragroup in oldCameragroups:
            newCameragroup = Cameragroup(
                name = oldCameragroup.name
            )
            db.session.add(newCameragroup)
            #copy masks
            for oldMask in oldCameragroup.masks:
                newMask = Mask(
                    shape = oldMask.shape,
                    cameragroup = newCameragroup,
                    user_id = oldMask.user_id
                )
                db.session.add(newMask)
            cameragroup_translations[oldCameragroup] = newCameragroup

        #copy staticgroups
        staticgroup_translations = {}
        oldStaticgroups = db.session.query(Staticgroup).join(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==old_survey_id).distinct().all()
        for oldStaticgroup in oldStaticgroups:
            newStaticgroup = Staticgroup(
                status = oldStaticgroup.status,
                user_id = oldStaticgroup.user_id
            )
            db.session.add(newStaticgroup)
            staticgroup_translations[oldStaticgroup] = newStaticgroup

        # copy trapgroup
        newTrapgroup = Trapgroup(
            survey_id = new_survey_id,
            tag = oldTrapgroup.tag,
            longitude = oldTrapgroup.longitude,
            latitude = oldTrapgroup.latitude,
            altitude = oldTrapgroup.altitude
        )
        db.session.add(newTrapgroup)

        #copy cameras
        for oldCamera in oldTrapgroup.cameras:
            newCamera = Camera(
                path = oldCamera.path.replace(oldSurvey.organisation.folder, newSurvey.organisation.folder),
                trapgroup = newTrapgroup
            )
            db.session.add(newCamera)

            #link cameragroup
            oldCameragroup = oldCamera.cameragroup
            if oldCameragroup in cameragroup_translations:
                newCameragroup = cameragroup_translations[oldCameragroup]
                if newCameragroup:
                    newCameragroup.cameras.append(newCamera)

            #copy videos
            for oldVideo in oldCamera.videos:
                newVideo = Video(
                    filename = oldVideo.filename,
                    hash = oldVideo.hash,
                    camera = newCamera,
                    extracted_text = oldVideo.extracted_text,
                    fps = oldVideo.fps,
                    frame_count = oldVideo.frame_count
                )
                db.session.add(newVideo)

            #copy images
            for oldImage in oldCamera.images:
                newImage = Image(
                    filename = oldImage.filename,
                    timestamp = oldImage.timestamp,
                    corrected_timestamp = oldImage.corrected_timestamp,
                    detection_rating = oldImage.detection_rating,
                    etag = oldImage.etag,
                    hash = oldImage.hash,
                    extracted_data = oldImage.extracted_data,
                    camera = newCamera,
                    skipped = oldImage.skipped,
                    extracted = oldImage.extracted
                )
                db.session.add(newImage)

                #copy detections
                for oldDetection in oldImage.detections:
                    newDetection = Detection(
                        image = newImage,
                        category = oldDetection.category,
                        source = oldDetection.source,
                        status = oldDetection.status,
                        top = oldDetection.top,
                        left = oldDetection.left,
                        right = oldDetection.right,
                        bottom = oldDetection.bottom,
                        score = oldDetection.score,
                        static = oldDetection.static,
                        classification = oldDetection.classification,
                        class_score = oldDetection.class_score
                    )
                    db.session.add(newDetection)

                    #copy labelgroups
                    for oldLabelgroup in oldDetection.labelgroups:
                        newLabelgroup = Labelgroup(
                            checked = oldLabelgroup.checked,
                            detection = newDetection,
                            task_id = task_translations[oldLabelgroup.task_id]
                        )
                        newLabelgroup.tags = [tag_translations[oldTag] for oldTag in oldLabelgroup.tags]
                        newLabelgroup.labels = [label_translations[oldLabel] for oldLabel in oldLabelgroup.labels]

                    #copy individuals
                    if copy_individuals:
                        for oldIndividual in oldDetection.individuals:
                            for task in oldIndividual.tasks:
                                if task.id in task_translations:
                                    new_task = task_translations[task.id]
                                    break
                            newIndividual = db.session.query(Individual).join(Task,Individual.tasks).filter(Task.id==new_task).filter(Individual.name==oldIndividual.name).filter(Individual.species==oldIndividual.species).first()
                            
                            if not newIndividual:
                                newIndividual = Individual(
                                    name = oldIndividual.name,
                                    notes = oldIndividual.notes,
                                    active = oldIndividual.active,
                                    species = oldIndividual.species,
                                    user_id = oldIndividual.user_id,
                                    timestamp = oldIndividual.timestamp
                                )
                                db.session.add(newIndividual)
                                newIndividual.tags = [tag_translations[oldTag] for oldTag in oldIndividual.tags]
                                newIndividual.tasks = [db.session.query(Task).get(new_task)]

                            newIndividual.detections.append(newDetection)

                    #link staticgroup
                    if oldDetection.staticgroup:
                        oldStaticgroup = oldDetection.staticgroup
                        if oldStaticgroup in staticgroup_translations:
                            newStaticgroup = staticgroup_translations[oldStaticgroup]
                            if newStaticgroup:
                                newStaticgroup.detections.append(newDetection)

        #copy clusters
        oldClusters = db.session.query(Cluster)\
                                .join(Image,Cluster.images)\
                                .join(Camera)\
                                .filter(Camera.trapgroup==oldTrapgroup)\
                                .distinct().all()
        for oldCluster in oldClusters:
            newCluster = Cluster(
                user_id = oldCluster.user_id,
                task_id = task_translations[oldCluster.task_id],
                timestamp = oldCluster.timestamp,
                notes = oldCluster.notes,
                checked = oldCluster.checked,
                classification = oldCluster.classification
            )
            db.session.add(newCluster)
            old_image_paths = list(set(['/'.join(image.camera.path.split('/')[1:]) for image in oldCluster.images]))
            newCluster.images = db.session.query(Image)\
                                        .join(Camera)\
                                        .filter(Camera.trapgroup==newTrapgroup)\
                                        .filter(Image.filename.in_([image.filename for image in oldCluster.images]))\
                                        .filter(or_((Camera.path.contains(path)) for path in old_image_paths))\
                                        .distinct().all()
            newCluster.tags = [tag_translations[oldTag] for oldTag in oldCluster.tags]
            newCluster.labels = [label_translations[oldLabel] for oldLabel in oldCluster.labels]

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
def copy_survey(self,old_survey_id,organisation_id,new_name=None,copy_individuals=False):
    '''Copies the specified survey to a new organisation'''

    try:
        oldSurvey = db.session.query(Survey).get(old_survey_id)
        
        if (oldSurvey.status!='Copying') and ((oldSurvey.status.lower() not in Config.SURVEY_READY_STATUSES) or (True in [(task.status.lower() not in Config.TASK_READY_STATUSES) for task in oldSurvey.tasks])): return False

        oldSurvey.status='Copying'
        db.session.commit()

        newOrganisation = db.session.query(Organisation).get(organisation_id)
        if not new_name: new_name = oldSurvey.name

        newSurvey = db.session.query(Survey).filter(Survey.name==new_name).filter(Survey.organisation==newOrganisation).first()
        if not newSurvey:
            newOrganisation_folder = newOrganisation.folder
            oldSurvey_organisation_folder = oldSurvey.organisation.folder
            db.session.close() # The copy process can take a long time

            #copy folders: normal & compressed
            folders = []
            paths = [r[0] for r in db.session.query(Camera.path).join(Trapgroup).filter(Trapgroup.survey_id==old_survey_id).distinct().all()]
            for path in paths:
                if '_video_images_' in path: # Need to add parent folder for cases where the folder only contained videos otherwise it won't copy the videos
                    video_path = path.split('/_video_images_')[0]
                    if video_path not in folders: 
                        folders.append(video_path)
                        folders.append(video_path.replace(oldSurvey_organisation_folder,oldSurvey_organisation_folder+'-comp'))
                folders.append(path)
                folders.append(path.replace(oldSurvey_organisation_folder,oldSurvey_organisation_folder+'-comp'))

            folders = list(set(folders))
            results = []
            for folder in folders:
                results.append(copy_s3_folder.apply_async(kwargs={'source_folder':folder,'destination_folder':folder.replace(oldSurvey_organisation_folder,newOrganisation_folder)},queue='default'))

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
                        
            # Re-init the db session now that the long copy is finished
            oldSurvey = db.session.query(Survey).get(old_survey_id)

            #create new survey
            newSurvey = Survey(
                name = new_name,
                description = oldSurvey.description,
                trapgroup_code = oldSurvey.trapgroup_code,
                status = 'Copying',
                image_count = oldSurvey.image_count,
                frame_count = oldSurvey.frame_count,
                video_count = oldSurvey.video_count,
                ignore_small_detections = oldSurvey.ignore_small_detections,
                sky_masked = oldSurvey.sky_masked,
                correct_timestamps = oldSurvey.correct_timestamps,
                classifier_id = oldSurvey.classifier_id,
                organisation_id = organisation_id
            )
            db.session.add(newSurvey)
            db.session.commit()

        new_survey_id = newSurvey.id

        # copy tasks
        task_translations = {}
        for oldTask in oldSurvey.tasks:
            newTask = db.session.query(Task).filter(Task.name==oldTask.name).filter(Task.survey_id==newSurvey.id).first()

            if not newTask:    
                #create new task
                newTask = Task(
                    name = oldTask.name,
                    survey_id = new_survey_id,
                    tagging_level = oldTask.tagging_level,
                    test_size = oldTask.test_size,
                    size = oldTask.size,
                    status = oldTask.status,
                    tagging_time = oldTask.tagging_time,
                    complete = oldTask.complete,
                    init_complete = oldTask.init_complete,
                    is_bounding = oldTask.is_bounding,
                    parent_classification = oldTask.parent_classification,
                    ai_check_complete = oldTask.ai_check_complete,
                    jobs_finished = oldTask.jobs_finished,
                    current_name = oldTask.current_name,
                    class_check_count = oldTask.class_check_count,
                    unchecked_multi_count = oldTask.unchecked_multi_count,
                    unlabelled_animal_cluster_count = oldTask.unlabelled_animal_cluster_count,
                    vhl_count = oldTask.vhl_count,
                    infoless_count = oldTask.infoless_count,
                    infoless_vhl_count = oldTask.infoless_vhl_count,
                    vhl_bounding_count = oldTask.vhl_bounding_count,
                    potential_vhl_clusters = oldTask.potential_vhl_clusters,
                    vhl_image_count = oldTask.vhl_image_count,
                    vhl_sighting_count = oldTask.vhl_sighting_count,
                    cluster_count = oldTask.cluster_count,
                    clusters_remaining = oldTask.clusters_remaining
                )
                db.session.add(newTask)

                # copy labels
                label_translations = {}
                globalLabels = db.session.query(Label).filter(Label.task_id==None).distinct().all()
                for globalLabel in globalLabels:
                    label_translations[globalLabel] = globalLabel
                
                for oldLabel in oldTask.labels:
                    newLabel = Label(
                        description = oldLabel.description,
                        hotkey = oldLabel.hotkey,
                        complete = oldLabel.complete,
                        icID_allowed = oldLabel.icID_allowed,
                        icID_count = oldLabel.icID_count,
                        cluster_count = oldLabel.cluster_count,
                        bounding_count = oldLabel.bounding_count,
                        info_tag_count = oldLabel.info_tag_count,
                        potential_clusters = oldLabel.potential_clusters,
                        image_count = oldLabel.image_count,
                        sighting_count = oldLabel.sighting_count,
                        unidentified_count = oldLabel.unidentified_count,
                        task = newTask
                    )
                    db.session.add(newLabel)
                    label_translations[oldLabel] = newLabel

                # copy label hierarchy
                for oldLabel in oldTask.labels:
                    if oldLabel.parent:
                        label_translations[oldLabel].parent = label_translations[oldLabel.parent]

                # copy translations
                for oldTranslation in oldTask.translations:
                    newTranslation = Translation(
                        classification = oldTranslation.classification,
                        auto_classify = oldTranslation.auto_classify,
                        label = label_translations[oldTranslation.label],
                        task = newTask
                    )
                    db.session.add(newTranslation)

                # copy tags
                tag_translations = {}
                for oldTag in oldTask.tags:
                    newTag = Tag(
                        description = oldTag.description,
                        hotkey = oldTag.hotkey,
                        task = newTask
                    )
                    db.session.add(newTag)
                    tag_translations[oldTag] = newTag

                db.session.commit()

            task_translations[oldTask.id] = newTask.id
        
        #copy trapgroups
        results = []
        for oldTrapgroup in oldSurvey.trapgroups:
            checkTrapgroup = db.session.query(Trapgroup).filter(Trapgroup.survey==newSurvey).filter(Trapgroup.tag==oldTrapgroup.tag).first()

            if not checkTrapgroup:
                results.append(copy_trapgroup.apply_async(kwargs={'old_trapgroup_id':oldTrapgroup.id,'old_survey_id':old_survey_id,'new_survey_id':new_survey_id,'task_translations':task_translations,'copy_individuals':copy_individuals},queue='default'))

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

        newSurvey = db.session.query(Survey).get(new_survey_id)
        newSurvey.status = 'Ready'
        oldSurvey = db.session.query(Survey).get(old_survey_id)
        oldSurvey.status = 'Ready'
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
def copy_s3_folder(self,source_folder,destination_folder):
    '''Copies the contents of an S3 folder from the source to the destination.'''

    try:
        paginator = GLOBALS.s3client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(Bucket=Config.BUCKET,Prefix=source_folder)
        for page in page_iterator:
            for obj in page['Contents']:
                key = obj['Key']
                dest_key = key.replace(source_folder, destination_folder)
                GLOBALS.s3client.copy_object(Bucket=Config.BUCKET, 
                                            CopySource=Config.BUCKET+'/'+key, 
                                            Key=dest_key)

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

def print_survey_summary(survey,survey_name,task_name=None):
    ''' Helper function for inspect_organistaion_surveys that prints the rows for the table'''
    
    admin = db.session.query(User).filter(User.username=='Admin').first()
    
    if task_name:
        task = db.session.query(Task).filter(Task.survey==survey).filter(Task.name==task_name).first()
    else:
        task = survey.tasks[-1]
    
    sq = db.session.query(Cluster.id.label('cluster_id'),func.count(Image.id).label('count'))\
                    .join(Image,Cluster.images)\
                    .filter(Cluster.task==task)\
                    .group_by(Cluster.id).subquery()
    av_cluster_count = float(db.session.query(func.sum(sq.c.count)/func.count(distinct(Cluster.id)))\
                    .filter(Cluster.task==task)\
                    .join(sq,sq.c.cluster_id==Cluster.id)\
                    .first()[0])

    clusters_ai_annot = db.session.query(Cluster)\
                    .filter(Cluster.user==admin)\
                    .filter(Cluster.task==task)\
                    .distinct().count()
    
    total_clusters = db.session.query(Cluster).filter(Cluster.task==task).distinct().count()
    non_empty_clusters = rDets(db.session.query(Cluster).join(Image,Cluster.images).join(Detection).filter(Cluster.task==task)).distinct().count()
    empty_clusters = total_clusters - non_empty_clusters
    perc_ai_annotated = round((clusters_ai_annot/non_empty_clusters)*100,2)
    perc_class_MD_annotated = round(((clusters_ai_annot+empty_clusters)/total_clusters)*100,2)

    det_count = rDets(db.session.query(Detection).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey==survey)).distinct().count()
    dets_above_thresh = rDets(db.session.query(Detection)\
                    .join(Image).join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey==survey)\
                    .filter(Detection.class_score>survey.classifier.threshold))\
                    .distinct().count()
    
    night_images = db.session.query(Image)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey==survey)\
                    .filter(or_(extract('hour',Image.corrected_timestamp)<6,extract('hour',Image.corrected_timestamp)>=18))\
                    .distinct().count()
    
    sq = rDets(db.session.query(Image.id.label('image_id'),func.count(distinct(Detection.classification)).label('count'))\
                    .join(Detection)\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey==survey)\
                    .filter(Detection.class_score>survey.classifier.threshold))\
                    .group_by(Image.id).subquery()
    
    average_classes_per_image = float(db.session.query(func.sum(sq.c.count)/func.count(distinct(Image.id)))\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey==survey)\
                    .join(sq,sq.c.image_id==Image.id)\
                    .first()[0])
    
    print('{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}'.format(
                    survey_name,20,
                    survey.image_count,8,
                    total_clusters,10,
                    av_cluster_count,20,
                    round(det_count/survey.image_count,2),13,
                    average_classes_per_image,16,
                    perc_ai_annotated,26,
                    perc_class_MD_annotated,22,
                    round(100*(dets_above_thresh/det_count),2),27,
                    round(100*(night_images/survey.image_count),2),16
    ))

def inspect_organisation_surveys(organisation_id):
    '''Prints the details of all an organisations surveys to help determine classification performance.'''
    
    organisation = db.session.query(Organisation).get(organisation_id)
    
    print('{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}{:{}}'.format(
                    'survey',20,
                    '  images',8,
                    '  clusters',10,
                    '  av. images/cluster',20,
                    '  av. dets/im',13,
                    '  av. classes/im',16,
                    '  % animal clusters class.',26,
                    '  % clusters annotated',22,
                    '  % dets above class thresh',27,
                    '  % night images',16
    ))
    
    print_survey_summary(db.session.query(Survey).get(3),'Reference 1','Classifier')
    print_survey_summary(db.session.query(Survey).get(4),'Reference 2','Classifier2.1')
    
    for survey in organisation.surveys:
        print_survey_summary(survey,survey.name)


@celery.task(bind=True,max_retries=5)
def process_db_static_detections(self,camera_id):
    try:
        queryTemplate1="""
            SELECT 
                    id1 AS detectionID,
                    id2 AS matchID
            FROM
                (SELECT 
                    det1.id AS id1,
                    det2.id AS id2,
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
                    ({})
                    AND image1.camera_id = {}
                    AND image1.id IN ({})
                    AND image2.id IN ({})
                    AND det1.static = 1
                    AND det2.static = 1
                    ) AS sq1
            WHERE
                area1 < 0.1
                AND sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.7 
        """
        imcount = db.session.query(Image).filter(Image.camera_id==camera_id).distinct().count()
        detections = [r[0] for r in db.session.query(Detection.id)\
                                            .join(Image)\
                                            .filter(Image.camera_id==camera_id)\
                                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                                            .filter(Detection.static==True)\
                                            .order_by(Image.corrected_timestamp)\
                                            .distinct().all()]
        
        static_detections = []
        static_groups = {}
        max_grouping = 7000
        for chunk in chunker(detections,max_grouping):
            if (len(chunk)<max_grouping) and (len(detections)>max_grouping):
                chunk = detections[-max_grouping:]
            images = db.session.query(Image).join(Detection).filter(Detection.id.in_(chunk)).distinct().all()
            im_ids = ','.join([str(r.id) for r in images])
            for det_id,matchid in db.session.execute(queryTemplate1.format('OR'.join([ ' (det1.source = "{}" AND det1.score > {}) '.format(model,Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS]),camera_id,im_ids,im_ids)):
                if det_id not in static_groups:
                    static_groups[det_id] = []
                static_groups[det_id].append(matchid)

        for det_id,matches in static_groups.items():
            group = [det_id]
            group.extend(matches)
            matchcount = len(group)
            if matchcount>3 and matchcount/imcount>0.3 and any(d not in static_detections for d in group):
                static_detections.extend(group)
                # Check if staticgroup exists with any of the detections
                detections = db.session.query(Detection).filter(Detection.id.in_(group)).all()
                staticgroups = db.session.query(Staticgroup).filter(Staticgroup.detections.any(Detection.id.in_(group))).all()
                if staticgroups:
                    if len(staticgroups) == 1:
                        # Add detections to the existing static group if there is only one and the detections are not already in the group
                        staticgroup = staticgroups[0]
                        group_detections = list(set(staticgroup.detections + detections))
                        staticgroup.detections = group_detections
                    else:
                        # Create a new static group if there are multiple static groups (with all detections)
                        group_detections = []
                        for sg in staticgroups:
                            group_detections.extend(sg.detections)
                            db.session.delete(sg)
                        group_detections = list(set(group_detections + detections))
                        new_group = Staticgroup(status='accepted',detections=group_detections)
                        db.session.add(new_group)
                else:
                    staticgroup = Staticgroup(status='accepted', detections=detections)
                    db.session.add(staticgroup)


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
def process_leftover_static_detections(self,camera_id):
    try:
        #Process static detections that are not in a static group
        iou_thresh = 0.5
        staticgroups = db.session.query(Staticgroup).join(Detection).join(Image).filter(Image.camera_id==camera_id).filter(Detection.static==True).distinct().all()
        detections = db.session.query(Detection).join(Image).filter(Image.camera_id==camera_id).filter(Detection.static==True).filter(Detection.staticgroup_id==None).distinct().limit(1000).all()
        
        while detections:
            for detection in detections:
                for staticgroup in staticgroups:
                    comparison_detection = staticgroup.detections[0]
                    intersection = max((min(detection.right,comparison_detection.right) - max(detection.left,comparison_detection.left)),0) * max((min(detection.bottom,comparison_detection.bottom) - max(detection.top,comparison_detection.top)),0)
                    area1 = (detection.right - detection.left) * (detection.bottom - detection.top)
                    area2 = (comparison_detection.right - comparison_detection.left) * (comparison_detection.bottom - comparison_detection.top)
                    iou = intersection / (area1 + area2 - intersection)
                    if iou > iou_thresh:
                        staticgroup.detections.append(detection)
                        break

                if not detection.staticgroup:
                    staticgroup = Staticgroup(status='accepted', detections=[detection])
                    db.session.add(staticgroup)
                    staticgroups.append(staticgroup)

            db.session.commit()

            detections = db.session.query(Detection).join(Image).filter(Image.camera_id==camera_id).filter(Detection.static==True).filter(Detection.staticgroup_id==None).distinct().limit(1000).all()

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
def process_videos(self,trapgroup_id):

    try:
        videos = db.session.query(Video).join(Camera).filter(Camera.trapgroup_id==trapgroup_id).distinct().all()
        for video in videos:
            key = [video.camera.path.split('/')[0]+'-comp']
            key.extend(video.camera.path.split('/')[1:])
            key = '/'.join(key).split('_video_images_')[0] + video.filename.split('.')[0] + '.mp4'
            
            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                GLOBALS.s3client.download_file(Bucket='traptagger', Key=key, Filename=temp_file.name)
                vdo = cv2.VideoCapture(temp_file.name)
            
            video_fps = vdo.get(cv2.CAP_PROP_FPS)
            video_frames = vdo.get(cv2.CAP_PROP_FRAME_COUNT)
            video.still_rate=get_still_rate_old(video_fps,video_frames)

        db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.close()

    return True

def get_still_rate_old(video_fps,video_frames):
    '''Returns the rate at which still should be extracted.'''
    max_frames = 50     # Maximum number of frames to extract
    fps_default = 1     # Default fps to extract frames at (frame per second)
    frames_default_fps = math.ceil(video_frames / video_fps) * fps_default
    return min(max_frames / frames_default_fps, fps_default)

@celery.task(bind=True,max_retries=5,ignore_result=True)
def crop_training_images_parallel(self,key,source_bucket,dest_bucket):
    '''Parallel function for cropping detections contained in the csv in S3.'''

    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=dest_bucket, Key=key, Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)

        for image_key in df['path'].unique():
            try:
                with tempfile.NamedTemporaryFile(delete=True, suffix='.jpg') as temp_file:
                    GLOBALS.s3client.download_file(Bucket=source_bucket, Key=image_key, Filename=temp_file.name)
                    with pilImage.open(temp_file.name) as img:
                        img.load()

                if img.mode != 'RGB': img = img.convert(mode='RGB')

                for index, row in df[df['path']==image_key].iterrows():
                    dest_key = str(row['detection_id'])+'.jpg'
                    bbox = [row['left'],row['top'],(row['right']-row['left']),(row['bottom']-row['top'])]
                    save_crop(img, bbox_norm=bbox, square_crop=True, bucket=dest_bucket, key=dest_key)

                    # try:
                    #     check = GLOBALS.s3client.head_object(Bucket=dest_bucket,Key=dest_key)
                    # except:
                    #     # file does not exist
                    #     bbox = [row['left'],row['top'],(row['right']-row['left']),(row['bottom']-row['top'])]
                    #     save_crop(img, bbox_norm=bbox, square_crop=True, bucket=dest_bucket, key=dest_key)
            
            except:
                app.logger.info('Error processing {}'.format(image_key))

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.close()

    return True

def crop_training_images(key,source_bucket,dest_bucket,parallelisation):
    '''
    Root funciton for the parallel cropping of training data.
    
    NOTE: Make sure to use previous csvs to to filter new csvs to prevent duplication of cropping effort.
    '''

    with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
        GLOBALS.s3client.download_file(Bucket=dest_bucket, Key=key, Filename=temp_file.name)
        df = pd.read_csv(temp_file.name)

    results = []
    detection_count = len(df)
    grouping = math.ceil(detection_count/parallelisation)
    for index in range(0,detection_count,grouping):
        df_temp = df.iloc[index:index+grouping]
        temp_key = key.replace('.csv','')+'_'+str(index)+'.csv'
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            df_temp.to_csv(temp_file.name,index=False)
            GLOBALS.s3client.put_object(Bucket=dest_bucket,Key=temp_key,Body=temp_file)
        results.append(crop_training_images_parallel.apply_async(kwargs={'key':temp_key,'source_bucket':source_bucket,'dest_bucket':dest_bucket}))

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