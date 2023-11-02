from app.models import *
from app.routes import *
# active trapgroups (probably want something on a permanent loop)
survey = db.session.query(Survey).get(1874)
for trapgroup in survey.trapgroups:
    trapgroup.active = True
db.session.commit()
# Normal cluster tasks
for task_id in [3755]:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.labels = []
    db.session.commit()
# sub - species
for task_id in [3758]:
    task = db.session.query(Task).get(task_id)
    parent_label = db.session.query(Label).get(task.tagging_level)
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.labels = [parent_label]
        labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task_id==task_id).all()
        for labelgroup in labelgroups:
            labelgroup.labels = [parent_label]
    db.session.commit()
# AI check
for task_id in [3760]:
    elephant = db.session.query(Label).filter(Label.task_id==task_id).filter(Laberl.description=='elephant').first()
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.labels = [elephant]
    db.session.commit()
# info tagging
for task_id in [3762]:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.tags = []
    db.session.commit()
# Bounding
for task_id in [3763,3765]:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task_id==task_id).all()
        for labelgroup in labelgroups:
            labelgroup.labels = cluster.labels
            labelgroup.examined = False
    db.session.commit()
# intra-cluster ID
for task_id in [3766]:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
    individuals = db.session.query(Individual).join(Task,Individual.tasks).filter(Task.id==task_id).filter(Individual.user_id!=1).all()
    for individual in individuals:
        individual.detections = []
        individual.tags = []
        individual.tasks = []
        indSimilarities = db.session.query(IndSimilarity).filter(or_(IndSimilarity.individual_1==individual.id,IndSimilarity.individual_2==individual.id)).all()
        for indSimilarity in indSimilarities:
            db.session.delete(indSimilarity)
        db.session.delete(individual)
    db.session.commit()
# inter-cluster ID
for task_id in [3767]:
    #combinations & unidentifiable
    inactive_individuals = db.session.query(Individual).join(Task,Individual.tasks).filter(Task.id==task_id).filter(Individual.active==False).distinct().all()
    for individual2 in inactive_individuals:
        individual1s = db.session.query(Individual).join(Detection,Individual.detections).join(Task,Individual.tasks).filter(Task.id==task_id).filter(Detection.id.in_([r.id for r in individual2.detections])).filter(Individual.id!=individual2.id).distinct().all()
        for individual1 in individual1s:
            handleIndividualUndo(None,individual1,individual2,task_id)
    #rejections
    rejections = db.session.query(IndSimilarity).join(Individual,IndSimilarity.individual_1==Individual.id).join(Task,Individual.tasks).filter(IndSimilarity.score==-2000).filter(Task.id==task_id).distinct().all()
    for rejection in rejections:
        rejection.score = rejection.old_score
    #skips
    skips = db.session.query(IndSimilarity).join(Individual,IndSimilarity.individual_1==Individual.id).join(Task,Individual.tasks).filter(IndSimilarity.skipped==True).filter(Task.id==task_id).distinct().all()
    for skip in skips:
        skip.skipped = False
    #dissociate - just dont
    db.session.commit()