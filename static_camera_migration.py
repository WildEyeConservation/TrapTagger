# Description: This script will create camera groups and static groups for all surveys. 

from app.models import *
from app.routes import *

#TODO: THIS STILL NEEDS TO BE COMPLETED (STATIC)
# Create camera groups
survey_ids = [r[0] for r in db.session.query(Survey.id).all()]
for survey_id in survey_ids:
    survey = db.session.query(Survey).get(survey_id)
    survey_name = survey.name
    survey_tag = survey.trapgroup_code
    camera_code = None
    trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).filter(Trapgroup.survey_id==survey_id).distinct().all()]
    for trapgroup_id in trapgroup_ids:
        group_cameras(trapgroup_id, camera_code, survey_name, survey_tag)
    db.session.commit()



# Create static groups
def process_db_static_detections(cameragroup_id):
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
                JOIN camera AS camera1
                JOIN camera AS camera2
            ON 
                camera1.cameragroup_id = camera2.cameragroup_id
                AND camera1.id = image1.camera_id
                AND camera2.id = image2.camera_id
                AND image1.id = det1.image_id
                AND image2.id = det2.image_id
                AND image1.id != image2.id 
            WHERE
                ({}) 
                AND camera1.cameragroup_id = {}
                AND image1.id IN ({})
                AND image2.id IN ({})
                AND det1.static = 1
                AND det2.static = 1
                ) AS sq1
        WHERE
            area1 < 0.1
            AND sq1.intersection / (sq1.area1 + sq1.area2 - sq1.intersection) > 0.7 
    """
    imcount = db.session.query(Image).join(Camera).filter(Camera.cameragroup_id==cameragroup_id).filter(~Camera.path.contains('_video_images_')).distinct().count()
    detections = [r[0] for r in db.session.query(Detection.id)\
                                        .join(Image)\
                                        .join(Camera)\
                                        .filter(Camera.cameragroup_id==cameragroup_id)\
                                        .filter(~Camera.path.contains('_video_images_'))\
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
        for det_id,matchid in db.session.execute(queryTemplate1.format('OR'.join([ ' (det1.source = "{}" AND det1.score > {}) '.format(model,Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS]),cameragroup_id,im_ids,im_ids)):
            if det_id not in static_groups:
                static_groups[det_id] = []
            static_groups[det_id].append(matchid)
    for det_id,matches in static_groups.items():
        group = [det_id]
        group.extend(matches)
        matchcount = len(matches)
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
    # Check if there is any static detections that are not in a static group
    detections = db.session.query(Detection).join(Image).join(Camera).filter(Camera.cameragroup_id==cameragroup_id).filter(Detection.static==True).filter(Detection.staticgroup_id==None).all()
    for detection in detections:
        staticgroup = Staticgroup(status='accepted', detections=[detection])
        db.session.add(staticgroup)
    db.session.commit()



# Create static groups
cameragroup_ids = [r[0] for r in db.session.query(Cameragroup.id).join(Camera).join(Image).join(Detection).filter(Detection.static==True).distinct().all()]
for cameragroup_id in cameragroup_ids:
    process_db_static_detections(cameragroup_id)


# Get empty static groups and delete them
staticgroups = db.session.query(Staticgroup).filter(~Staticgroup.detections.any()).all()
for staticgroup in staticgroups:
    db.session.delete(staticgroup)

db.session.commit()