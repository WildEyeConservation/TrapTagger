
from app.models import * 
from app.routes import *

filename = 'stopped_tasks.json'
# Save stopped tasks
with open(filename, 'r') as f:
    stopped_tasks = json.load(f)

statuses = ['Processing']
survey_ids = [r[0] for r in db.session.query(Survey.id)\
                                    .join(Organisation)\
                                    .filter(Organisation.archive==True)\
                                    .filter(Survey.status.in_(statuses))\
                                    .order_by(Survey.id.desc())\
                                    .distinct().all()]

# Stage 3: Fire up instances
fire_up_instances('utility', 5)
fire_up_instances('utility_2', 60)

# Stage 4: Kick of archival
for survey_id in survey_ids:
    task_id = stopped_tasks.get(str(survey_id))
    archive_survey_and_update_counts.apply_async(kwargs={'survey_id': survey_id, 'launch_id':task_id}, queue='utility')

