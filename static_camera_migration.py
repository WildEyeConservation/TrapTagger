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


# Create static groups
camera_ids = [r[0] for r in db.session.query(Camera.id).join(Image).join(Detection).filter(Detection.static==True).outerjoin(Video).filter(Video.id==None).distinct().all()]
for camera_id in camera_ids:
    process_db_static_detections(camera_id)


# Process leftover static detections
camera_ids = [r[0] for r in db.session.query(Camera.id).join(Image).join(Detection).filter(Detection.static==True).filter(Detection.staticgroup_id==None).distinct().all()]
for camera_id in camera_ids:
    process_leftover_static_detections(camera_id)


# Get empty static groups and delete them
staticgroups = db.session.query(Staticgroup).filter(~Staticgroup.detections.any()).all()
for staticgroup in staticgroups:
    db.session.delete(staticgroup)

db.session.commit()


# Set skipped and extracted to False for all images
images = db.session.query(Image).filter(or_(Image.skipped==None,Image.extracted==None)).limit(5000).all()
while images:
    for image in images:
        image.skipped = False
        image.extracted = False
    db.session.commit()
    images = db.session.query(Image).filter(or_(Image.skipped==None,Image.extracted==None)).limit(5000).all()


print('Extracting video FPS & Frames')
results = []
trapgroup_ids = [r[0] for r in db.session.query(Trapgroup.id).join(Camera).filter(Camera.videos.any()).distinct().all()]
print('{} trapgroups to process...'.format(len(trapgroup_ids)))
for trapgroup_id in trapgroup_ids:
    results.append(process_videos.apply_async(kwargs={'trapgroup_id':trapgroup_id},queue='default'))

print('All trapgroups queued. Waiting...')

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

print('Done!')

count = 0
print('Extracting timestamps...')
survey_ids = [r[0] for r in db.session.query(Survey.id).join(Trapgroup).join(Camera).join(Image).filter(Image.timestamp==None).distinct().all()]
print('{} surveys to process'.format(len(survey_ids)))
for survey_id in survey_ids:
    extract_missing_timestamps(survey_id,True)
    count+=1
    print('{}/{} surveys processed'.format(count,len(survey_ids)))