from app.models import * 
from app.routes import * 


# Delete all detSimilarities where the score is 0 or 1
print('Deleting detSimilarities with score 0 or 1'	)
detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.score==0,DetSimilarity.score==1)).limit(5000).all()
while detSimilarities:
    for detSim in detSimilarities:
        db.session.delete(detSim)
    db.session.commit()
    detSimilarities = db.session.query(DetSimilarity).filter(or_(DetSimilarity.score==0,DetSimilarity.score==1)).limit(5000).all()

print('Done!')

# Set label's algorithm to hotspotter or heuristic depending on if the there are any detSimilarities
print('Setting label algorithms')
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

print('Done!')


# Set icID_q1_complete to True for applicable labels
print('Setting icID_q1_complete for labels with icID_allowed set to True')
labels = db.session.query(Label).filter(Label.icID_allowed==True).filter(Label.icID_q1_complete==None).limit(5000).all()
while labels:
    for label in labels:
        if label.icID_count==0:
            label.icID_q1_complete = True
        else:
            label.icID_q1_complete = False
        label.icID_count = checkForIdWork([label.task_id],label.description,0) #NOTE: NOT SURE ABOUT THIS 
    db.session.commit()
    labels = db.session.query(Label).filter(Label.icID_allowed==True).filter(Label.icID_q1_complete==None).limit(5000).all()

print('Done!')

# Set icID_q1_complete to False for all labels
print('Setting icID_q1_complete to False for all labels where it is None')
labels = db.session.query(Label).filter(Label.icID_q1_complete==None).limit(5000).all()
while labels:
    for label in labels:
        label.icID_q1_complete = False
    db.session.commit()
    labels = db.session.query(Label).filter(Label.icID_q1_complete==None).limit(5000).all()

print('Done!')


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
print('Relaunching -4 tasks')
for task in task_data:
    task_id = task[0]
    launch_task.apply_async(kwargs={'task_id':task_id})


# Handle -5 tasks --------------------------------------------------------------------
task_ids = db.session.query(Task.id).filter(Task.tagging_level.contains('-5')).filter(Task.status=='PROGRESS').filter(~Task.sub_tasks.any()).all()

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
print('Relaunching -5 tasks')
for task_id in task_ids:
    launch_task.apply_async(kwargs={'task_id':task_id})



# Handle -5 tasks with sub tasks --------------------------------------------------------------------
task_ids = db.session.query(Task.id).filter(Task.tagging_level.contains('-5')).filter(Task.status=='PROGRESS').filter(Task.sub_tasks.any()).all()

# Stop tasks
results = []
task_sub_tasks = {}
for task_id in task_ids:
    task = db.session.query(Task).get(task_id)
    task_sub_tasks[task_id] = [sub_task.id for sub_task in task.sub_tasks]
    results.append(stop_task.apply_async(kwargs={'task_id':task_id}))

print('All stop tasks (-5 multi) queued. Waiting...')
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
print('All stop tasks (-5 multi) completed.')

# Relaunch tasks
print('Relaunching -5 multi tasks')
for task_id in task_ids:
    sub_tasks = db.session.query(Task).filter(Task.id.in_(task_sub_tasks[task_id])).all()
    task = db.session.query(Task).get(task_id)
    task.sub_tasks = [s for s in sub_tasks]
    tL = task.tagging_level.split(',')
    tL[2] = tL[2] + ',100'
    task.tagging_level = ','.join(tL)
    db.session.commit()
    launch_task.apply_async(kwargs={'task_id':task_id})  # Calculate detection similarities has already been calculated 