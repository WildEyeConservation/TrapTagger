
from app.models import * 
from app.routes import *


# Archive  surveys 
admin_org = db.session.query(Organisation).get(1)
admin_org.archive = False
db.session.commit()

organisations = db.session.query(Organisation).filter(Organisation.id!=1).filter(Organisation.archive==None).all()
for organisation in organisations:
    organisation.archive = True
db.session.commit()

# Stage 1: # Get surveys
statuses = ['Ready', 'Launched', 'Processing']
survey_ids = [r[0] for r in db.session.query(Survey.id)\
                                    .join(Organisation)\
                                    .filter(Organisation.archive==True)\
                                    .filter(Survey.status.in_(statuses))\
                                    .order_by(Survey.id.desc())\
                                    .distinct().all()]

# Stage 2: Set status to processing and task status to 'Pending' & save task info
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