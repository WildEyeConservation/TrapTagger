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
from sqlalchemy import desc
from config import Config
import traceback
from celery.result import allow_join_result

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
                    llava_data = oldImage.llava_data,
                    camera = newCamera
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
                folders.append(path)
                folders.append(path.replace(oldSurvey_organisation_folder,oldSurvey_organisation_folder+'-comp'))

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