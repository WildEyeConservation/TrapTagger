
from app.models import * 
from app.routes import *


# Archive  surveys 
statuses = ['Uploading', 'Deleting', 'Failed']
survey_ids = [r[0] for r in db.session.query(Survey.id)\
                                    .join(Organisation)\
                                    .filter(Organisation.name.notin_(['Admin']))\
                                    .filter(Survey.status.notin_(statuses))\
                                    .filter(~Survey.status.contains('Preprocessing'))\
                                    .distinct().all()]

for survey_id in survey_ids:
    archive_survey_and_update_counts.delay(survey_id=survey_id)