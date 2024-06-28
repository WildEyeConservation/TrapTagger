from app.models import * 
from app.routes import * 


# Delete all detSimilarities where the score is 0 or 1
detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.score==0,DetSimilarity.score==1)).limit(5000).all()
while detSimilarities:
    for detSim in detSimilarities:
        db.session.delete(detSim)
    db.session.commit()
    detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.score==0,DetSimilarity.score==1)).limit(5000).all()

print('Finished deleting detSimilarities with score 0 or 1')

# Set label's algorithm to hotspotter or heuristic depending on if the there are any detSimilarities
labels = db.session.query(Label).join(Task).join(Individual,Task.individuals).filter(Label.description==Individual.species).filter(Label.algorithm==None).limit(5000).all()
while labels:
    for label in labels:
        label_sims = db.session.query(DetSimilarity)\
                        .join(Detection,or_(DetSimilarity.detection_1==Detection.id,DetSimilarity.detection_2==Detection.id))\
                        .join(Labelgroup)\
                        .join(Label,Labelgroup.labels)\
                        .filter(Label.id==label.id).first()
        if label_sims:
            label.algorithm = 'hotspotter'
        else:
            label.algorithm = 'heuristic'
    db.session.commit()
    labels = db.session.query(Label).join(Task).join(Individual,Task.individuals).filter(Label.description==Individual.species).filter(Label.algorithm==None).limit(5000).all()

print('Finished setting label algorithms')


# Handle -4 tasks -----------------------------------------
task_data = db.session.query(Task.id,Task.tagging_level).filter(Task.tagging_level.contains('-4')).filter(Task.status=='PROGRESS').all()

# Stop tasks 
results = []
for task in task_data:
    task_id = task[0]
    results.append(stop_task.apply_async(kwargs={'task_id':task_id}))

print('All stop tasks (-4) queued. Waiting...')
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
print('All stop tasks (-4) completed.')

# Delete individuals
results = []
for task in task_data:
    task_id = task[0]
    taggingLevel = task[1]
    tL = re.split(',',taggingLevel)
    species = tL[1]
    results.append(delete_individuals.apply_async(kwargs={'task_ids':[task_id],'species':[species]}))

print('All delete individuals (-4) queued. Waiting...')
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
print('All delete individuals (-4) completed.')


# Relaunch tasks
for task in task_data:
    task_id = task[0]
    launch_task.apply_async(kwargs={'task_id':task_id})


# Handle -5 tasks --------------------------------------------------------------------
task_ids = db.session.query(Task.id).filter(Task.tagging_level.contains('-5')).filter(Task.status=='PROGRESS').all()

# Stop tasks
results = []
for task_id in task_ids:
    results.append(stop_task.apply_async(kwargs={'task_id':task_id}))

print('All stop tasks (-5) queued. Waiting...')
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
print('All stop tasks (-5) completed.')

# Relaunch tasks
for task_id in task_ids:
    launch_task.apply_async(kwargs={'task_id':task_id})

