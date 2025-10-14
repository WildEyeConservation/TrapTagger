from app.models import * 
from app.routes import * 

# --------------------------------------------- Inter Survey Indivs ------------------------------------------------------------

# Find all tasks where inter-survey id has been done 
IndividualTask = alias(Task)
individual_tasks = [r[0] for r in db.session.query(Task.id).join(Individual,Task.individuals).distinct().all()]
grouped_tasks = {}
task_group_key = {}
for task_id in individual_tasks:
    mutual_tasks = [r[0] for r in db.session.query(Task.id)\
                        .join(Individual,Task.individuals)\
                        .join(IndividualTask,Individual.tasks)\
                        .filter(IndividualTask.c.id==task_id)\
                        .distinct().all()]
    if len(mutual_tasks) > 1:
        key = min(mutual_tasks)
        if key not in grouped_tasks:
            tgk = None
            for k in mutual_tasks:
                if k in task_group_key:
                    tgk = task_group_key[k]
                    break
            if tgk:
                key = tgk
            else:
                grouped_tasks[key] = []
        grouped_tasks[key].extend(mutual_tasks)
        grouped_tasks[key] = list(set(grouped_tasks[key]))
        task_group_key[task_id] = key
        for t in mutual_tasks:
            task_group_key[t] = key


for key, group in grouped_tasks.items():
    surveys = db.session.query(Survey).join(Task).filter(Task.id.in_(group)).order_by(Survey.id).distinct().all()
    org_id = surveys[0].organisation_id
    check_orgs = [survey.organisation_id for survey in surveys if survey.organisation_id!=org_id]
    if check_orgs:
        print(f'Skipping group {group} as multiple orgs involved.')
        continue
    survey_names = [survey.name for survey in surveys]
    area_name = os.path.commonprefix(survey_names).strip()
    if area_name == '': area_name = survey_names[0]
    area_name += ' Area'
    print(survey_names)
    print(area_name)
    check = db.session.query(Area).join(Survey).filter(Survey.organisation_id==org_id).filter(Area.name==area_name).first()
    if check:
        area_name = survey_names[0] + ' Area'
    area = Area(name=area_name)
    db.session.add(area)
    for survey in surveys:
        survey.area = area
    for t_id in group:
        # updateIndividualIdStatus(t_id)
        task = db.session.query(Task).get(t_id)
        task.areaID_library = True
    db.session.commit()


print('Updated area for all surveys with inter-survey individuals.')
print(' ')

# ----------------------------------------------- Update indID_allowed for all labels --------------------------------------------------------------

labels = db.session.query(Label).filter(Label.indID_allowed==None).limit(10000).all()
while labels:
    update_values = []
    for label in labels:
        update_values.append({
            'id': label.id,
            'indID_allowed': True
        })
    if update_values:
        db.session.bulk_update_mappings(Label, update_values)
        db.session.commit()
    print(f'Updated {len(labels)} labels to allow indID.')
    labels = db.session.query(Label).filter(Label.indID_allowed==None).limit(10000).all()

print('Updated indID_allowed for all labels.')
print(' ')

# ---------------------------------------------------- Update Start and End Dates --------------------------------------------------------------
survey_ids = [r[0] for r in db.session.query(Survey.id).order_by(Survey.id.desc()).all()]
processed = 0
for survey_id in survey_ids:
    survey = db.session.query(Survey).get(survey_id)
    date_query = db.session.query(func.min(Image.corrected_timestamp), func.max(Image.corrected_timestamp))\
                    .join(Camera)\
                    .join(Trapgroup)\
                    .filter(Trapgroup.survey_id==survey_id)\
                    .filter(Image.corrected_timestamp!=None).first()
    survey.start_date = date_query[0] if date_query else None
    survey.end_date = date_query[1] if date_query else None
    processed += 1
    if processed % 500 == 0:
        db.session.commit()
        print(f'Processed {processed} surveys for start and end date update.')

db.session.commit()

print('Updated start and end dates for all surveys.')
print(' ')


# ---------------------------------------------------- Crop and Dearchive --------------------------------------------------------------
processed = 0
individual_tasks = [r[0] for r in db.session.query(Task.id).join(Individual,Task.individuals).order_by(Task.id.desc()).distinct().all()]
for task_id in individual_tasks:
    dearchive_individual_images.apply_async(kwargs={'task_id':task_id, 'crop':True}, queue='utility')

print('Kicked off dearchival and cropping of images for all individual tasks.')
print(' ')

# -------------------------------------------------------------------------------------------------------------------------------


