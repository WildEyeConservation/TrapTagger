from app.models import *
from app.routes import *
import os

file_names=[f for f in os.listdir('./templates_and_thresholds')]

for file_name in file_names:
    print('')
    print('Handling {}...'.format(file_name))
    
    if 'template' in file_name:
        template_name=file_name.replace('_template.txt','').replace('_',' ')
        check = db.session.query(Task).filter(Task.name==template_name).filter(Task.survey_id==None).first()
        if check==None:
            print('Template not found. Adding...')
            with open('templates_and_thresholds/'+file_name,'r') as f:
                data=f.read()
            data=data[2:-3].split('],[')
            labels = [item.split(',') for item in data]
            task = Task(name=template_name)
            db.session.add(task)
            label_objects = {'None':None,'VHL':db.session.query(Label).get(GLOBALS.vhl_id)}
            for item in labels:
                if item[0]!='VHL':
                    print('Adding label {} with hotkey {} and parent {}'.format(item[0],item[1],item[2]))
                    label = Label(description=item[0],hotkey=item[1],parent=label_objects[item[2]],task=task)
                    db.session.add(label)
                    label_objects[item[0]]=label
            db.session.commit()
            print('Successfully added template {}'.format(template_name))
        else:
            print('Failed to add template {}: template {} already exists'.format(file_name,template_name))
    
    elif 'thresholds' in file_name:
        classifier_name = file_name.replace('_thresholds.json','').replace('_',' ')
        classifier = db.session.query(Classifier).filter(Classifier.name==classifier_name).first()
        if classifier:
            print('Classifier found. Adding thresholds...')
            classifier_id = classifier.id
            with open('templates_and_thresholds/'+file_name,'r') as f:
                data=json.load(f)
            for classification in data:
                print('Adding threshold {}: {}'.format(classification,data[classification]))
                class_label = db.session.query(ClassificationLabel).filter(ClassificationLabel.classifier_id==classifier_id).filter(ClassificationLabel.classification==classification).first()
                if class_label==None:
                    class_label = ClassificationLabel(classifier_id=classifier_id, classification=classification)
                    db.session.add(class_label)
                class_label.threshold = float(data[classification])
            db.session.commit()
            print('Successfully added thresholds for classifier {}'.format(classifier_name))
        else:
            print('Failed to add thresholds {}: Cannot find classifier {}'.format(file_name,classifier_name))