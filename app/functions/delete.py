'''
Copyright 2026

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
import GLOBALS
from sqlalchemy.sql import func, or_, alias, distinct, and_, literal_column, case
from sqlalchemy import desc, insert, delete, select
import boto3
from config import Config

def chunker1000(seq):
    '''Breaks down the specified sequence into batches of 1000.'''
    size = 1000
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))

def delete_labelgroups(task_id, camera_ids=None, image_ids=None, ids=None):
    '''Deletes labelgroups for a given task ID and optional extra parameters.'''

    labelgroupQ = db.session.query(Labelgroup.id).filter(Labelgroup.task_id==task_id)

    if ids is not None:
        labelgroupQ = labelgroupQ.filter(Labelgroup.id.in_(ids))

    if camera_ids is not None or image_ids is not None:
        labelgroupQ = labelgroupQ.join(Detection).join(Image)
        if camera_ids is not None: labelgroupQ = labelgroupQ.filter(Image.camera_id.in_(camera_ids))
        if image_ids is not None: labelgroupQ = labelgroupQ.filter(Image.id.in_(image_ids))

    labelgroup_subq = labelgroupQ.subquery()

    # Labelgroup labels
    ll = db.session.query(detectionLabels).filter(detectionLabels.c.labelgroup_id.in_(select(labelgroup_subq.c.id))).delete(synchronize_session=False)

    # Labelgroup tags
    lt = db.session.query(detectionTags).filter(detectionTags.c.labelgroup_id.in_(select(labelgroup_subq.c.id))).delete(synchronize_session=False)

    # Delete Labelgroups
    result = db.session.execute(delete(Labelgroup).where(Labelgroup.id.in_(select(labelgroup_subq.c.id))).execution_options(synchronize_session=False))

    db.session.commit()
    app.logger.info(f'detectionLabels: {ll}, detectionTags: {lt}, labelgroups: {result.rowcount} deleted successfully')

    return True

def delete_detections(survey_id, camera_ids=None, image_ids=None, ids=None):
    '''Deletes detections for a given survey ID and optional extra parameters.'''

    detectionQ = db.session.query(Detection.id).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id)
    if ids is not None:
        detectionQ = detectionQ.filter(Detection.id.in_(ids))

    if camera_ids is not None: 
        detectionQ = detectionQ.filter(Camera.id.in_(camera_ids))
    
    if image_ids is not None: 
        detectionQ = detectionQ.filter(Image.id.in_(image_ids))

    det_subq = detectionQ.subquery()
    det_select = select(det_subq.c.id)

    #Delete features
    db.session.query(Feature).filter(Feature.detection_id.in_(det_select)).delete(synchronize_session=False)
    db.session.commit()

    # Handle IndSimilarities (if they were not handled elsewhere)
    inds1 = db.session.query(IndSimilarity).filter(IndSimilarity.detection_1.in_(det_select)).filter(IndSimilarity.score>=0).delete(synchronize_session=False)
    inds2 = db.session.query(IndSimilarity).filter(IndSimilarity.detection_2.in_(det_select)).filter(IndSimilarity.score>=0).delete(synchronize_session=False)
    inds = inds1 + inds2

    indSims1 = db.session.query(IndSimilarity).filter(IndSimilarity.detection_1.in_(det_select)).filter(IndSimilarity.score<0)\
                .update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSims2 = db.session.query(IndSimilarity).filter(IndSimilarity.detection_2.in_(det_select)).filter(IndSimilarity.score<0)\
                .update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSimilarities = indSims1 + indSims2

    db.session.commit()
    app.logger.info(f'IndSimilarities: {inds} deleted, Other IndSimilarities: {indSimilarities} updated successfully')

    #Delete DetSimilarities
    ds1 = db.session.query(DetSimilarity).filter(DetSimilarity.detection_1.in_(det_select)).delete(synchronize_session=False)
    ds2 = db.session.query(DetSimilarity).filter(DetSimilarity.detection_2.in_(det_select)).delete(synchronize_session=False)
    ds = ds1 + ds2
    db.session.commit()
    app.logger.info(f'DetSimilarities: {ds} deleted successfully')

    #Delete detections
    # aid_list = []
    # aid_list = [r[0] for r in db.session.query(Detection.aid).filter(Detection.id.in_(select(det_subq.c.id))).filter(Detection.aid!=None).distinct().all()]

    result = db.session.execute(delete(Detection).where(Detection.id.in_(det_select)).execution_options(synchronize_session=False))

    #Delete WBIA data
    # keep_aid_list = [r[0] for r in db.session.query(Detection.aid, func.count(Detection.id))\
    #     .filter(Detection.aid.in_(aid_list))\
    #     .group_by(Detection.aid)\
    #     .distinct().all() if r[1]>0]
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
    app.logger.info(f'Detections: {result.rowcount} deleted successfully')
    
    # Delete empty staticgroups
    delete_empty_staticgroups()

    return True

def delete_clusters(task_id, empty=False, ids=None):
    '''Deletes clusters for a given task ID and optional parameters.'''

    clusterQ = db.session.query(Cluster.id).filter(Cluster.task_id==task_id)

    if empty:
        clusterQ = clusterQ.filter(~Cluster.images.any())

    if ids is not None:
        clusterQ = clusterQ.filter(Cluster.id.in_(ids))

    cluster_subq = clusterQ.subquery()

    # Earth Ranger IDs
    er = db.session.query(ERangerID).filter(ERangerID.cluster_id.in_(select(cluster_subq.c.id))).delete(synchronize_session=False)

    # Cluster labels table
    cl = db.session.query(labelstable).filter(labelstable.c.cluster_id.in_(select(cluster_subq.c.id))).delete(synchronize_session=False)

    # Cluster tags table
    ct = db.session.query(tags).filter(tags.c.cluster_id.in_(select(cluster_subq.c.id))).delete(synchronize_session=False)

    # Cluster - required images associations table
    cri = db.session.query(requiredimagestable).filter(requiredimagestable.c.cluster_id.in_(select(cluster_subq.c.id))).delete(synchronize_session=False)

    # Cluster - image associations table
    ci = db.session.query(images).filter(images.c.cluster_id.in_(select(cluster_subq.c.id))).delete(synchronize_session=False)

    # Delete Clusters
    result = db.session.execute(delete(Cluster).where(Cluster.id.in_(select(cluster_subq.c.id))).execution_options(synchronize_session=False))

    db.session.commit()
    app.logger.info(f'ERangerID: {er}, labelstable: {cl}, tags: {ct}, requiredimagestable: {cri}, images: {ci}, clusters: {result.rowcount} deleted successfully')

    return True

def delete_images(survey_id, camera_ids=None, ids=None ,empty=False, delete_from_s3=False):
    '''Deletes images for a given survey ID and optional extra parameters.'''

    imageQ = db.session.query(Image.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id)
    if ids is not None:
        imageQ = imageQ.filter(Image.id.in_(ids))

    if camera_ids is not None:
        imageQ = imageQ.filter(Camera.id.in_(camera_ids))

    if empty:
        imageQ = imageQ.filter(~Image.detections.any())
        imageQ = imageQ.filter(~Image.clusters.any())

    image_subq = imageQ.subquery()

    if delete_from_s3:
        imgs = db.session.query(Image.filename, Camera.path).join(Camera).filter(Image.id.in_(select(image_subq.c.id))).distinct().all()
        for filename, path in imgs:
            image_path = path + '/' + filename
            splits = image_path.split('/')
            splits[0] = splits[0] + '-comp'
            image_path_comp = '/'.join(splits)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_path)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_path_comp)
        app.logger.info(f'{len(imgs)} images deleted from S3 successfully.')


    r1 = db.session.query(requiredimagestable).filter(requiredimagestable.c.image_id.in_(select(image_subq.c.id))).delete(synchronize_session=False)

    imagestable = alias(images)
    r2 = db.session.query(imagestable).filter(imagestable.c.image_id.in_(select(image_subq.c.id))).delete(synchronize_session=False)

    app.logger.info(f'required image associations: {r1}, image associations: {r2} deleted successfully.')

    #Delete Images
    result = db.session.execute(delete(Image).where(Image.id.in_(select(image_subq.c.id))).execution_options(synchronize_session=False))
    
    db.session.commit()
    app.logger.info('{} images deleted successfully.'.format(result.rowcount))

    return True

def delete_videos(survey_id, camera_ids=None, ids=None, delete_from_s3=False):
    '''Deletes videos for a given survey ID and optional extra parameters.'''

    videoQ = db.session.query(Video.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id)

    if ids is not None:
        videoQ = videoQ.filter(Video.id.in_(ids))

    if camera_ids is not None:
        videoQ = videoQ.filter(Camera.id.in_(camera_ids))

    video_subq = videoQ.subquery()

    if delete_from_s3:
        videos = db.session.query(Video.filename, Camera.path).join(Camera).filter(Video.id.in_(select(video_subq.c.id))).distinct().all()
        for filename, path in videos:
            # Delete from s3 if specific videos
            cam_path = path.split('/_video_images_')[0]
            video_path = cam_path + '/' + filename
            splits = video_path.split('/')
            splits[0] = splits[0] + '-comp'
            video_path_comp = '/'.join(splits)
            video_path_comp = video_path_comp.rsplit('.', 1)[0] + '.mp4'
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=video_path)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=video_path_comp)
        app.logger.info(f'{len(videos)} videos deleted from S3 successfully.')

    #Delete Videos
    result = db.session.execute(delete(Video).where(Video.id.in_(select(video_subq.c.id))).execution_options(synchronize_session=False))
    
    db.session.commit()
    app.logger.info('{} videos deleted successfully.'.format(result.rowcount))

    return True

def delete_cameras(survey_id, ids=None, empty=False, delete_from_s3=False):
    '''Deletes cameras for a given survey ID and optional extra parameters.'''

    cameraQ = db.session.query(Camera.id).join(Trapgroup).filter(Trapgroup.survey_id==survey_id)
    
    if ids is not None:
        cameraQ = cameraQ.filter(Camera.id.in_(ids))

    if empty:
        cameraQ = cameraQ.filter(~Camera.images.any())
        cameraQ = cameraQ.filter(~Camera.videos.any())

    camera_subq = cameraQ.subquery()
    
    if delete_from_s3:
        camera_paths = [r[0] for r in db.session.query(Camera.path).filter(Camera.id.in_(select(camera_subq.c.id))).distinct().all()]
        s3 = boto3.resource('s3')
        bucketObject = s3.Bucket(Config.BUCKET)
        if Config.DEBUGGING: app.logger.info('Camera paths to delete from S3: {}'.format(camera_paths))
        for camera_path in camera_paths:
            splits = camera_path.split('/')
            splits[0] = splits[0] + '-comp'
            camera_path_comp = '/'.join(splits)

            other_cams = False # Check if other subfolders exist in the same folder
            if '/_video_images_/' not in camera_path:
                other_cams = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id).filter(Camera.path.like(camera_path+'/%')).filter(~Camera.id.in_(select(camera_subq.c.id))).first()
            if other_cams:
                app.logger.info('Other cameras exist in the same folder, deleting individual files only for camera path: {}'.format(camera_path))
                #  Do not want to delete the other subfolders if other cameras exist in the same folder
                objects = list(bucketObject.objects.filter(Prefix=camera_path + '/',Delimiter='/')) if camera_path else []
                for chunk in chunker1000(objects):
                    batch=[{'Key': obj.key} for obj in chunk if obj.key and not obj.key.endswith('/')]
                    if batch:
                        bucketObject.delete_objects(Delete={'Objects': batch})

                objects = list(bucketObject.objects.filter(Prefix=camera_path_comp + '/',Delimiter='/')) if camera_path_comp else []
                for chunk in chunker1000(objects):
                    batch=[{'Key': obj.key} for obj in chunk if obj.key and not obj.key.endswith('/')]
                    if batch:
                        bucketObject.delete_objects(Delete={'Objects': batch})                          
            else:
                if camera_path: bucketObject.objects.filter(Prefix=camera_path + '/').delete()
                if camera_path_comp: bucketObject.objects.filter(Prefix=camera_path_comp + '/').delete()
        app.logger.info('Deleted from S3 successfully: {}'.format(camera_paths))

    # Delete Cameras
    result = db.session.execute(delete(Camera).where(Camera.id.in_(select(camera_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} cameras deleted successfully.'.format(result.rowcount))

    return True

def delete_trapgroups(survey_id, ids=None, empty=False):
    '''Deletes trapgroups for a given survey ID and optional extra parameters.'''

    trapgroupQ = db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id)
    if ids is not None:
        trapgroupQ = trapgroupQ.filter(Trapgroup.id.in_(ids))

    if empty:
        trapgroupQ = trapgroupQ.filter(~Trapgroup.cameras.any())

    trapgroup_subq = trapgroupQ.subquery()

    #Delete siteGroupings 
    sg = db.session.query(siteGroupings).filter(siteGroupings.c.trapgroup_id.in_(select(trapgroup_subq.c.id))).delete(synchronize_session=False)

    #Delete trapgroups
    result = db.session.execute(delete(Trapgroup).where(Trapgroup.id.in_(select(trapgroup_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} trapgroups deleted successfully.'.format(result.rowcount))

    #Delete empty sitegroups
    sitegroup_subq = db.session.query(Sitegroup.id).filter(~Sitegroup.trapgroups.any()).subquery()
    result = db.session.execute(delete(Sitegroup).where(Sitegroup.id.in_(select(sitegroup_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} empty sitegroups deleted successfully and siteGroupings: {}.'.format(result.rowcount, sg))

    return True

def delete_floating_data(survey_id, delete_from_s3=False):
    '''Deletes floating data for a given survey ID.'''

    survey = db.session.query(Survey).get(survey_id)
    survey_folder = survey.organisation.folder+'/'+survey.name+'/%'
    survey_folder = survey_folder.replace('_','\\_')

    if delete_from_s3:
        images = db.session.query(Image, Camera.path).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).all()
        for image, path in images:
            image_key = path + '/' + image.filename
            splits = image_key.split('/')
            splits[0] = splits[0] + '-comp'
            image_comp_key = '/'.join(splits)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_key)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=image_comp_key)
        app.logger.info(f'{len(images)} Floating images deleted from S3 successfully.')

        videos = db.session.query(Video, Camera.path).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).all()
        for video, path in videos:
            video_path = path.split('/_video_images_/')[0]
            video_key = video_path + '/' + video.filename
            splits = video_path.split('/')
            splits[0] = splits[0]+'-comp'
            video_comp_key = '/'.join(splits) + '/' + video.filename.rsplit('.', 1)[0] + '.mp4'
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=video_key)
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=video_comp_key)
        app.logger.info(f'{len(videos)} Floating videos deleted from S3 successfully.')

    #Delete floating images (from unfinished upload)
    floatImage_subq = db.session.query(Image.id).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).subquery()
    result = db.session.execute(delete(Image).where(Image.id.in_(select(floatImage_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} floating images deleted successfully.'.format(result.rowcount))

    #Delete floating videos (from unfinished upload)
    floatVideo_subq = db.session.query(Video.id).join(Camera).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).subquery()
    result = db.session.execute(delete(Video).where(Video.id.in_(select(floatVideo_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} floating videos deleted successfully.'.format(result.rowcount))

    #Delete floating cameras (from unfinished upload)
    floatCamera_subq = db.session.query(Camera.id).filter(Camera.path.like(survey_folder)).filter(Camera.trapgroup_id==None).filter(~Camera.images.any()).filter(~Camera.videos.any()).subquery()
    result = db.session.execute(delete(Camera).where(Camera.id.in_(select(floatCamera_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} floating cameras deleted successfully.'.format(result.rowcount))

    return True

def delete_task_individuals(task_ids, species=None, camera_ids=None, image_ids=None):
    '''Deletes individuals for a given task ID , species and optional camera and image IDs.'''

    app.logger.info('Deleting individuals for task IDs: {}, species: {}, camera IDs: {}, image IDs: {}'.format(task_ids, species, camera_ids, image_ids))

    #Delete Individuals
    if not species:
        species = [r[0] for r in db.session.query(Individual.species).join(Task,Individual.tasks).filter(Task.id.in_(task_ids)).distinct().all()]
    
    update_tasks = []
    area_library_tasks = [r[0] for r in db.session.query(Task.id).filter(Task.areaID_library==True).filter(Task.id.in_(task_ids)).distinct().all()]
    if area_library_tasks:
        area_ids = [r[0] for r in db.session.query(Survey.area_id).join(Task).filter(Task.id.in_(area_library_tasks)).filter(Survey.area_id!=None).distinct().all()]
        if area_ids:
            update_tasks = [r[0] for r in db.session.query(Task.id)\
                                    .join(Survey)\
                                    .filter(Survey.area_id.in_(area_ids))\
                                    .filter(Task.areaID_library==True)\
                                    .filter(Task.id.notin_(area_library_tasks))\
                                    .distinct().all()]

    individualQ = db.session.query(Individual.id).join(Task,Individual.tasks).filter(Task.id.in_(task_ids)).filter(Individual.species.in_(species))
    if camera_ids is not None or image_ids is not None:
        individualQ = individualQ.join(Detection,Individual.detections).join(Image)
        if camera_ids is not None:
            individualQ = individualQ.filter(Image.camera_id.in_(camera_ids))
        if image_ids is not None:
            individualQ = individualQ.filter(Image.id.in_(image_ids))
    survey_ids = [r[0] for r in db.session.query(Task.survey_id).filter(Task.id.in_(task_ids)).distinct().all()]
    detQ = db.session.query(Detection.id).join(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id.in_(survey_ids))
    if camera_ids is not None:
        detQ = detQ.filter(Camera.id.in_(camera_ids))
    if image_ids is not None:
        detQ = detQ.filter(Image.id.in_(image_ids))
    tag_subq = db.session.query(Tag.id).filter(Tag.task_id.in_(task_ids)).subquery()
    individual_subq = individualQ.subquery()
    det_subq = detQ.subquery()

    if Config.DEBUGGING: app.logger.info('Total affected individuals: {}'.format(individualQ.distinct().count()))

    # Handle indSimilarities
    # rS=db.session.query(IndSimilarity)\
    #     .filter(or_(IndSimilarity.individual_1.in_(select(individual_subq.c.id)),IndSimilarity.individual_2.in_(select(individual_subq.c.id))))\
    #     .filter(IndSimilarity.score>=0)\
    #     .delete(synchronize_session=False)
    rS1 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_1.in_(select(individual_subq.c.id))).filter(IndSimilarity.score>=0).delete(synchronize_session=False)
    rS2 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_2.in_(select(individual_subq.c.id))).filter(IndSimilarity.score>=0).delete(synchronize_session=False)
    rS = rS1 + rS2
    db.session.commit()
    if Config.DEBUGGING: app.logger.info('Deleted IndSimilarity: {}'.format(rS))

    # indSimilarities = db.session.query(IndSimilarity)\
    #                             .filter(or_(IndSimilarity.individual_1.in_(select(individual_subq.c.id)),IndSimilarity.individual_2.in_(select(individual_subq.c.id))))\
    #                             .filter(or_(IndSimilarity.detection_1.in_(select(det_subq.c.id)),IndSimilarity.detection_2.in_(select(det_subq.c.id))))\
    #                             .filter(IndSimilarity.score < 0)\
    #                             .distinct().all()

    # for sim in indSimilarities:
    #     sim.detection_1 = None
    #     sim.detection_2 = None
    indSims1 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_1.in_(select(individual_subq.c.id))).filter(IndSimilarity.detection_1.in_(select(det_subq.c.id)))\
                    .filter(IndSimilarity.score<0).update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSims2 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_1.in_(select(individual_subq.c.id))).filter(IndSimilarity.detection_2.in_(select(det_subq.c.id)))\
                    .filter(IndSimilarity.score<0).update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSims3 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_2.in_(select(individual_subq.c.id))).filter(IndSimilarity.detection_1.in_(select(det_subq.c.id)))\
                    .filter(IndSimilarity.score<0).update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSims4 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_2.in_(select(individual_subq.c.id))).filter(IndSimilarity.detection_2.in_(select(det_subq.c.id)))\
                    .filter(IndSimilarity.score<0).update({'detection_1': None, 'detection_2': None}, synchronize_session=False)
    indSimilarities = indSims1 + indSims2 + indSims3 + indSims4

    db.session.commit()
    if Config.DEBUGGING: app.logger.info('Other indSimilarities: {}'.format(indSimilarities))

    # Delete individualTags, individualPrimaryDetections, individualDetections (order is important if joined to detections)
    rT=db.session.query(individualTags).filter(individualTags.c.individual_id.in_(select(individual_subq.c.id))).filter(individualTags.c.tag_id.in_(select(tag_subq.c.id))).delete(synchronize_session=False)
    rPD=db.session.execute(delete(individualPrimaryDetections).where(individualPrimaryDetections.c.individual_id.in_(select(individual_subq.c.id))).where(individualPrimaryDetections.c.detection_id.in_(select(det_subq.c.id))).execution_options(synchronize_session=False))
    rD=db.session.execute(delete(individualDetections).where(individualDetections.c.individual_id.in_(select(individual_subq.c.id))).where(individualDetections.c.detection_id.in_(select(det_subq.c.id))).execution_options(synchronize_session=False))
    if Config.DEBUGGING: app.logger.info('Deleted individualTags: {}, individualPrimaryDetections: {}, individualDetections: {}'.format(rT, rPD.rowcount, rD.rowcount))

    # Empty individuals
    emptyIndividualSQ = db.session.query(Individual.id).join(Task,Individual.tasks).filter(Task.id.in_(task_ids)).filter(Individual.species.in_(species)).filter(~Individual.detections.any())
    emptyIndividual_ids = [r[0] for r in emptyIndividualSQ.distinct().all()]
    for ids_chunk in chunker1000(emptyIndividual_ids):
        rPC = db.session.query(individual_parent_child)\
                .filter(or_(individual_parent_child.c.parent_id.in_(ids_chunk),individual_parent_child.c.child_id.in_(ids_chunk)))\
                .delete(synchronize_session=False)
        if Config.DEBUGGING: app.logger.info('Deleted individual_parent_child: {}'.format(rPC))          

        # rS=db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1.in_(ids_chunk),IndSimilarity.individual_2.in_(ids_chunk))).delete(synchronize_session=False)
        rS1 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_1.in_(ids_chunk)).delete(synchronize_session=False)
        rS2 = db.session.query(IndSimilarity).filter(IndSimilarity.individual_2.in_(ids_chunk)).delete(synchronize_session=False)
        rS = rS1 + rS2
        if Config.DEBUGGING: app.logger.info('Deleted IndSimilarity: {}'.format(rS))

        rIT=db.session.query(individualTasks).filter(individualTasks.c.individual_id.in_(ids_chunk)).delete(synchronize_session=False)
        rI=db.session.query(Individual).filter(Individual.id.in_(ids_chunk)).delete(synchronize_session=False)

        if Config.DEBUGGING: app.logger.info('Deleted individualTasks: {}, Individuals: {}'.format(rIT, rI))

    # Remaining individuals
    for task_id in task_ids:
        task_individuals_sq = db.session.query(Individual.id)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Task.id==task_id)\
                                    .filter(Individual.species.in_(species))\
                                    .join(Detection,Individual.detections)\
                                    .join(Labelgroup)\
                                    .filter(Labelgroup.task_id==task_id)\
                                    .subquery()
        remaining_individuals = [r[0] for r in db.session.query(Individual.id)\
                                    .join(Task,Individual.tasks)\
                                    .filter(Task.id==task_id)\
                                    .filter(Individual.species.in_(species))\
                                    .outerjoin(task_individuals_sq,task_individuals_sq.c.id==Individual.id)\
                                    .filter(task_individuals_sq.c.id==None)\
                                    .distinct().all()]
        for rem_chunk in chunker1000(remaining_individuals):
            rITR=db.session.query(individualTasks).filter(individualTasks.c.individual_id.in_(rem_chunk)).filter(individualTasks.c.task_id==task_id).delete(synchronize_session=False)
            if Config.DEBUGGING: app.logger.info('Deleted Remaining individualTasks: {}'.format(rITR))

    db.session.commit()

    from app.functions.individualID import update_individuals_primary_dets
    from app.functions.globals import updateIndividualIdStatus
    prim_tasks = update_tasks + task_ids
    for s in species:
        if Config.DEBUGGING: app.logger.info('Updating individuals primary detections for species: {} and tasks: {}'.format(s, prim_tasks))
        update_individuals_primary_dets(task_ids=prim_tasks, species=s)

    for tid in update_tasks:
        # Update Area Library Id Status of previous mutual task
        if Config.DEBUGGING: app.logger.info('Updating Area Library Id Status for task: {}'.format(tid))
        updateIndividualIdStatus(tid)

    app.logger.info('Individuals deleted successfully.')
    
    return True

def delete_individuals_helper(individual_ids):
    '''Deletes individuals for a given individual IDs.'''

    # db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1.in_(individual_ids),IndSimilarity.individual_2.in_(individual_ids))).delete(synchronize_session=False)
    db.session.query(IndSimilarity).filter(IndSimilarity.individual_1.in_(individual_ids)).delete(synchronize_session=False)
    db.session.query(IndSimilarity).filter(IndSimilarity.individual_2.in_(individual_ids)).delete(synchronize_session=False)

    db.session.query(individual_parent_child)\
            .filter(or_(individual_parent_child.c.parent_id.in_(individual_ids),individual_parent_child.c.child_id.in_(individual_ids)))\
            .delete(synchronize_session=False)

    db.session.query(individualTags).filter(individualTags.c.individual_id.in_(individual_ids)).delete(synchronize_session=False)

    db.session.query(individualDetections).filter(individualDetections.c.individual_id.in_(individual_ids)).delete(synchronize_session=False)
    db.session.query(individualPrimaryDetections).filter(individualPrimaryDetections.c.individual_id.in_(individual_ids)).delete(synchronize_session=False)

    db.session.query(individualTasks).filter(individualTasks.c.individual_id.in_(individual_ids)).delete(synchronize_session=False)

    db.session.query(Individual).filter(Individual.id.in_(individual_ids)).delete(synchronize_session=False)

    db.session.commit()

    app.logger.info('{} individuals deleted successfully.'.format(len(individual_ids)))

    return True

def delete_zips(survey_id, ids=None, empty=False):
    '''Deletes zips for a given survey ID and optional extra parameters.'''

    survey = db.session.query(Survey).get(survey_id)
    zipQ = db.session.query(Zip.id).filter(Zip.survey_id==survey_id)
    
    if ids is not None:
        zipQ = zipQ.filter(Zip.id.in_(ids))

    if empty:
        zipQ = zipQ.filter(~Zip.images.any())

    #Delete zips 
    zip_ids = [r[0] for r in zipQ.distinct().all()]
    for zip_id in zip_ids:
        zip_key = survey.organisation.folder+'-comp/'+Config.SURVEY_ZIP_FOLDER+'/'+str(zip_id)+'.zip'
        GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=zip_key)
    db.session.query(Zip).filter(Zip.id.in_(zip_ids)).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info('{} zips deleted successfully.'.format(len(zip_ids)))

    return True

def delete_cameragroups(survey_id, empty=False,ids=None):
    '''Deletes cameragroups for a given survey ID and optional extra parameters.'''

    if empty:
        cameragroupQ = db.session.query(Cameragroup.id).filter(~Cameragroup.cameras.any())
    else:
        cameragroupQ = db.session.query(Cameragroup.id).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==survey_id)

    if ids is not None:
        cameragroupQ = cameragroupQ.filter(Cameragroup.id.in_(ids))

    cg_subq = cameragroupQ.subquery()
    mask_subq = db.session.query(Mask.id).join(Cameragroup).filter(Cameragroup.id.in_(select(cg_subq.c.id))).subquery()

    #Delete masks
    result1 = db.session.execute(delete(Mask).where(Mask.id.in_(select(mask_subq.c.id))).execution_options(synchronize_session=False))

    #Delete cameragroups
    result2 = db.session.execute(delete(Cameragroup).where(Cameragroup.id.in_(select(cg_subq.c.id))).execution_options(synchronize_session=False))

    db.session.commit()
    app.logger.info(f'cameragroups: {result2.rowcount}, masks: {result1.rowcount} deleted successfully.')

    return True

def delete_empty_areas():
    '''Deletes empty areas.'''
    area_subq = db.session.query(Area.id).filter(~Area.surveys.any()).subquery()
    result = db.session.execute(delete(Area).where(Area.id.in_(select(area_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} empty areas deleted successfully.'.format(result.rowcount))

    return True

def delete_empty_staticgroups():
    '''Deletes empty staticgroups.'''
    staticgroup_subq = db.session.query(Staticgroup.id).filter(~Staticgroup.detections.any()).subquery()
    result = db.session.execute(delete(Staticgroup).where(Staticgroup.id.in_(select(staticgroup_subq.c.id))).execution_options(synchronize_session=False))
    db.session.commit()
    app.logger.info('{} empty staticgroups deleted successfully.'.format(result.rowcount))

    return True

def delete_tags(task_id, ids=None):
    '''Deletes tags for a given task ID and optional IDs.'''
    tagQ = db.session.query(Tag.id).filter(Tag.task_id==task_id)
    if ids is not None:
        tagQ = tagQ.filter(Tag.id.in_(ids))
    tag_subq = tagQ.subquery()

    clusterTags = alias(tags)
    db.session.query(clusterTags).filter(clusterTags.c.tag_id.in_(select(tag_subq.c.id))).delete(synchronize_session=False)

    db.session.query(detectionTags).filter(detectionTags.c.tag_id.in_(select(tag_subq.c.id))).delete(synchronize_session=False)

    db.session.query(individualTags).filter(individualTags.c.tag_id.in_(select(tag_subq.c.id))).delete(synchronize_session=False)

    tc = db.session.query(Tag).filter(Tag.id.in_(select(tag_subq.c.id))).delete(synchronize_session=False)
    
    db.session.commit()
    app.logger.info('{} tags deleted successfully.'.format(tc))

    return True

def delete_translations(task_ids, ids=None):
    '''Deletes translations for a given task IDs and optional IDs.'''
    translationQ = db.session.query(Translation.id).filter(Translation.task_id.in_(task_ids))
    if ids is not None:
        translationQ = translationQ.filter(Translation.id.in_(ids))
    translation_subq = translationQ.subquery()
    tr = db.session.query(Translation).filter(Translation.id.in_(select(translation_subq.c.id))).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info('{} translations deleted successfully.'.format(tr))
    return True

def delete_task_download_requests(task_id, ids=None):
    '''Deletes download requests for a given task ID.'''
    download_requestQ = db.session.query(DownloadRequest).filter(DownloadRequest.task_id==task_id)
    if ids is not None:
        download_requestQ = download_requestQ.filter(DownloadRequest.id.in_(ids))

    download_requests = download_requestQ.filter(DownloadRequest.status == 'Available').filter(DownloadRequest.type != 'file').all()
    download_requestQ = download_requestQ.subquery()

    for request in download_requests:
        if request.status == 'Available' and request.type != 'file':
            fileName = request.task.survey.organisation.folder+'/docs/'+request.task.survey.organisation.name+'_'+request.user.username+'_'+request.task.survey.name+'_'+request.task.name + '.' + Config.RESULT_TYPES[request.type]
            GLOBALS.s3client.delete_object(Bucket=Config.BUCKET, Key=fileName)

    dr = db.session.query(DownloadRequest).filter(DownloadRequest.id.in_(select(download_requestQ.c.id))).delete(synchronize_session=False)

    db.session.commit()
    app.logger.info('{} download requests deleted successfully.'.format(dr))
    return True

def delete_turkcodes(task_id, include_users=False, extra_params=None):
    '''Deletes turkcodes for a given task ID and optional user ID.'''

    turkcodeQ = db.session.query(Turkcode.id).filter(Turkcode.task_id==task_id)
    
    if extra_params is not None:
        if 'user_id' in extra_params:
            turkcodeQ = turkcodeQ.filter(Turkcode.user_id==extra_params['user_id'])
        if 'active' in extra_params:
            turkcodeQ = turkcodeQ.filter(Turkcode.active==extra_params['active'])

    turkcodeQ = turkcodeQ.subquery()

    if include_users:
        user_ids = [r[0] for r in db.session.query(User.id).join(Turkcode).filter(User.email==None).filter(Turkcode.id.in_(select(turkcodeQ.c.id))).distinct().all()]
        tc = 0
        for chunk in chunker1000(user_ids):
            tc += db.session.query(Turkcode).filter(Turkcode.id.in_(select(turkcodeQ.c.id))).filter(Turkcode.user_id.in_(chunk)).delete(synchronize_session=False)
        tc += db.session.query(Turkcode).filter(Turkcode.id.in_(select(turkcodeQ.c.id))).filter(Turkcode.user_id==None).delete(synchronize_session=False)
    else:
        tc = db.session.query(Turkcode).filter(Turkcode.id.in_(select(turkcodeQ.c.id))).delete(synchronize_session=False)
    app.logger.info(f'{tc} turkcodes deleted successfully.')

    if include_users and user_ids:
        for chunk in chunker1000(user_ids):
            db.session.query(User).filter(User.id.in_(chunk)).delete(synchronize_session=False)
        app.logger.info(f'{len(user_ids)} users deleted successfully.')

    db.session.commit()

    return True

def delete_api_keys(survey_ids,ids=None):
    '''Deletes api keys for a given survey IDs.'''
    api_keyQ = db.session.query(APIKey.id).filter(APIKey.survey_id.in_(survey_ids))
    if ids is not None:
        api_keyQ = api_keyQ.filter(APIKey.id.in_(ids))
    api_key_subq = api_keyQ.subquery()
    r = db.session.query(APIKey).filter(APIKey.id.in_(select(api_key_subq.c.id))).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info(f'{r} api keys deleted successfully.')
    return True

def delete_survey_permission_exceptions(params):
    '''Deletes survey permission exceptions for a given survey ID or IDs.'''
    if not params: return True
    if 'survey_id' in params:
        survey_id = params['survey_id']
        r = db.session.query(SurveyPermissionException).filter(SurveyPermissionException.survey_id==survey_id).delete(synchronize_session=False)
    elif 'ids' in params:
        ids = params['ids']
        r = db.session.query(SurveyPermissionException).filter(SurveyPermissionException.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info(f'{r} survey permission exceptions deleted successfully.')
    return True

def delete_survey_shares(survey_id):
    '''Deletes survey shares for a given survey ID.'''
    r = db.session.query(SurveyShare).filter(SurveyShare.survey_id==survey_id).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info(f'{r} survey shares deleted successfully.')
    return True

def delete_all_task_labels(task_id):
    '''Deletes all labels for a given task ID.'''
    count = 0
    while db.session.query(Label).filter(Label.task_id==task_id).count() != 0:
        labelQ = db.session.query(Label.id).filter(Label.task_id==task_id).filter(~Label.children.any())
        result = db.session.execute(delete(Label).where(Label.id.in_(select(labelQ.subquery().c.id))).execution_options(synchronize_session=False))
        count += result.rowcount
        db.session.commit()
    app.logger.info(f'{count} labels deleted successfully.')
    return True

def delete_notifications(user_ids, contents=None):
    '''Deletes notifications for a given user IDs and optional contents.'''
    notificationQ = db.session.query(Notification.id).filter(Notification.user_id.in_(user_ids))
    if contents is not None:
        notificationQ = notificationQ.filter(Notification.contents.contains(contents))
    notification_subq = notificationQ.subquery()
    r = db.session.query(Notification).filter(Notification.id.in_(select(notification_subq.c.id))).delete(synchronize_session=False)
    db.session.commit()
    app.logger.info(f'{r} notifications deleted successfully.')
    return True