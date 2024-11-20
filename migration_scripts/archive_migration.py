
from app.models import * 
from app.routes import *


# Archive  surveys 

# Stage 1: # Get surveys
statuses = ['Ready', 'Launched', 'Processing']
survey_ids = [r[0] for r in db.session.query(Survey.id)\
                                    .join(Organisation)\
                                    .filter(Organisation.name.notin_(['Admin']))\
                                    .filter(Survey.status.in_(statuses))\
                                    .order_by(Survey.id.desc())\
                                    .distinct().all()]

# Stage 2: Set status to processing and task status to 'Stopped' & save task info
stopped_tasks = {}
for survey_id in survey_ids:
    survey = db.session.query(Survey).get(survey_id)
    survey.status = 'Processing'
    task = db.session.query(Task).filter(Task.survey_id == survey_id).filter(Task.status == 'PROGRESS').first()
    if task:
        task.status = 'PENDING'
        stopped_tasks[survey_id] = task.id

filename = 'stopped_tasks.json'
# Save stopped tasks
with open(filename, 'w') as f:
    json.dump(stopped_tasks, f)

db.session.commit()


# Stage 3: Fire up instances
fire_up_instances('utility', 5)
fire_up_instances('utility_2', 25)

# Stage 4: Kick of archival
for survey_id in survey_ids:
    archive_survey_and_update_counts.apply_async(kwargs={'survey_id': survey_id, 'filename':filename}, queue='utility')

