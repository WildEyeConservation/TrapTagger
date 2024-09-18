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