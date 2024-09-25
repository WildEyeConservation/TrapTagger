from app.models import * 
from app.routes import * 

# Note: Update script as needed (e.g. path to txt file)
# This script is used to populate the ClassificationLabel table in the database
# It reads from the txt file and adds the classification labels to the database - The format of the txt file should be one label per line with no empty lines

classifiers = db.session.query(Classifier).filter(Classifier.active==True).all()
for classifier in classifiers:
    txt_file = 'classifier_labels/' + classifier.name + '.txt'
    with open(txt_file, 'r') as file:
        lines = file.readlines()
        for line in lines:
            value = line.strip()
            if value and value != '':
                if db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier_id==classifier.id).filter(ClassificationLabel.classification==value).first() is None:
                    class_label = ClassificationLabel(classifier_id=classifier.id, classification=value)
                    db.session.add(class_label)


db.session.commit()



# Update missing classification translations

classifier_ids = [r[0] for r in db.session.query(Classifier.id).all()]
for classifier_id in classifier_ids:
    print('Classifier:', classifier_id)
    classifications = [r[0] for r in db.session.query(ClassificationLabel.classification).filter(ClassificationLabel.classifier_id==classifier_id).all()]
    task_ids = [r[0] for r in db.session.query(Task.id).join(Survey).filter(Survey.classifier_id==classifier_id).filter(Task.name != 'default').filter(~Task.name.contains('_o_l_d_')).filter(~Task.name.contains('_copying')).distinct().all()]
    for task_id in task_ids:
        translations = [r[0] for r in db.session.query(Translation.classification).filter(Translation.task_id==task_id).all()]
        translations.extend(['nothing','unknown'])
        for classification in classifications:
            if classification not in translations:
                translation = Translation(task_id=task_id, classification=classification, auto_classify=False, label_id=GLOBALS.nothing_id)
                db.session.add(translation)

db.session.commit()

