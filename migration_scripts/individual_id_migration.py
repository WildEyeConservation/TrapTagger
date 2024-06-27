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


#TODO Just check this 
# Stop and relaunch current active -4 tasks
tasks = db.session.query(Task.id, Task.tagging_level).filter(Task.tagging_level.contains('-4')).filter(Task.status=='PROGRESS').all()
for task in tasks:
    task_id = task[0]
    taggingLevel = task[1]
    # stop task
    stop_task(task_id)
    # delete individuals 
    tL = re.split(',',taggingLevel)
    species = tL[1]
    delete_individuals([task_id],[species])
    # relaunch task
    launch_task.apply_async(kwargs={'task_id':task_id})
