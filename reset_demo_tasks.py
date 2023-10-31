from app.models import *
from app.routes import *
# active trapgroups (probably want something on a permanent loop)
survey = db.session.query(Survey).get()
for trapgroup in survey.trapgroups:
    trapgroup.active = True
db.session.commit()
# Normal cluster tasks
for task_id in []:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.labels = []
    db.session.commit()
# sub - species
for task_id in []:
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
for task_id in []:
    elephant = db.session.query(Label).filter(Label.task_id==task_id).filter(Laberl.description=='elephant').first()
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.labels = [elephant]
    db.session.commit()
# info tagging
for task_id in []:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        cluster.tags = []
    db.session.commit()
# Bounding
for task_id in []:
    clusters = db.session.query(Cluster).filter(Cluster.timestamp>=datetime.utcnow()-timedelta(hours=2)).filter(Cluster.task_id==task_id).filter(Cluster.examined==True).all()
    for cluster in clusters:
        cluster.examined = False
        labelgroups = db.session.query(Labelgroup).join(Detection).join(Image).filter(Image.clusters.contains(cluster)).filter(Labelgroup.task_id==task_id).all()
        for labelgroup in labelgroups:
            labelgroup.labels = cluster.labels
            labelgroup.examined = False
    db.session.commit()
# intra-cluster ID
for task_id in []:
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
for task_id in []: