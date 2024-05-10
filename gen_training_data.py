from app.models import *
from app.routes import *
print('')

#Get a list of all available regions
regions = []
original_regions = db.session.query(Organisation.regions).filter(Organisation.regions!=None).filter(or_(Organisation.image_count>2000,Organisation.video_count>100)).distinct().all()
for item in original_regions:
	sub_regions = item[0].lower().split(',')
	for region in sub_regions:
		regions.append(region.strip())
regions = list(set(regions))
regions.sort()

# display the list of regions & ask user to input desired regions or jump ahead to below
response = 'n'
while response != 'y':
	desired_regions = []
	print('Which of the following regions would you like? Enter "y" for the desired ones and skip the undesired ones by submitting anything else.')
	for region in regions:
		response = input(region+' ')
		if response == 'y': desired_regions.append(region)
	print('Selected regions: {}'.format(desired_regions))
	response = input('Do you wish to continue? (y/n) ')

golden_surveys = [3,4] #abu & quenie
# task_preferences = ['wildcru','import']
task_exclusions = []
# desired_regions = ['finland','norway','spain','france','ukraine','bulgaria','portugal','italy']
organisations = []
for desired_region in desired_regions:
	organisations.extend(db.session.query(Organisation).filter(Organisation.regions.contains(desired_region)).filter(or_(Organisation.image_count>2000,Organisation.video_count>100)).distinct().all())
organisations = list(set(organisations))
surveys = db.session.query(Survey)\
				.filter(Survey.organisation_id.in_([r.id for r in organisations]))\
				.filter(~Survey.id.in_(golden_surveys))\
				.distinct().all()
problem_surveys = []
chosen_tasks = []
for survey in surveys:
	tasks = db.session.query(Task).filter(Task.survey==survey).filter(Task.name!='default').filter(~Task.name.contains('o_l_d')).filter(~Task.name.in_(task_exclusions)).distinct().all()
	if len(tasks)==0:
		problem_surveys.append(survey)
	elif len(tasks)==1:
		# If there is only on candidate task, use that
		chosen_tasks.append(tasks[0])
	else:
		# Otherwise we need to start looking for the 'best' option
		tasks = db.session.query(Task).filter(Task.init_complete==True).filter(Task.survey==survey).filter(Task.name!='default').filter(~Task.name.contains('o_l_d')).filter(~Task.name.in_(task_exclusions)).distinct().all()
		if len(tasks)==1:
			chosen_tasks.append(tasks[0])
		elif len(tasks)>1:
			# find most completed init_complete task
			best_task = tasks[0]
			max_metric = db.session.query(Cluster).join(Label,Cluster.labels).filter(Cluster.task==tasks[0]).filter(~Label.children.any()).distinct().count()
			for task in tasks[1:]:
				metric = db.session.query(Cluster).join(Label,Cluster.labels).filter(Cluster.task==task).filter(~Label.children.any()).distinct().count()
				if metric > max_metric:
					best_task = task
					max_metric = metric
			chosen_tasks.append(best_task)
		else:
			# none init complete, need to find most complete
			tasks = db.session.query(Task).filter(Task.survey==survey).filter(Task.name!='default').filter(~Task.name.contains('o_l_d')).filter(~Task.name.in_(task_exclusions)).distinct().all()
			best_task = tasks[0]
			max_metric = db.session.query(Cluster).filter(Cluster.task==tasks[0]).filter(Cluster.labels.any()).distinct().count()
			for task in tasks[1:]:
				metric = db.session.query(Cluster).filter(Cluster.task==task).filter(Cluster.labels.any()).distinct().count()
				if metric > max_metric:
					best_task = task
					max_metric = metric
			chosen_tasks.append(best_task)

# print out the surveys and task and ask user if happy, then proceed
organised_data = {}
for task in chosen_tasks:
	organisation = task.survey.organisation.name
	if organisation not in organised_data.keys(): organised_data[organisation] = []
	organised_data[organisation].append(task)

print('')
print('Here is the selected training data:')
for organisation in organised_data:
	print(organisation)
	for task in organised_data[organisation]:
		print('{:{}}{}'.format(task.survey.name,70,task.name))
	print('')

response = input('Do you wish to proceed? (y/n) ')

if response == 'y':
	bucket = input('What is your crops bucket? ')
	print('Generating csv...')
	key = generate_training_csv(tasks=[r.id for r in chosen_tasks],destBucket=bucket,min_area=0.005)
	print('All done! You can find the classification_ds in traptagger-crops under the name: {}'.format(key))

	response = input('Do you want to generate translations now? (y/n) ')
	if response == 'y':
		with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
			GLOBALS.s3client.download_file(Bucket=bucket, Key=key, Filename=temp_file.name)
			df = pd.read_csv(temp_file.name)
		
		labels = df['dataset_class'].unique()
		labels = [label.lower().strip() for label in labels if type(label)==str]
		labels.sort()

		print('\n{}\n'.format(labels))
		
		print('Please type in the desired translations. If you wish to keep the label, enter nothing. If you would like to drop a label, type n.')
		translations = {}
		for label in labels:
			response = input(label+' ')
			if response=='': response = label
			if response!='n':
				translations[label] = response
		
		df = df.drop_duplicates(subset=['path'], keep=False).reset_index()
		df = df.drop_duplicates(subset=['hash'], keep='first').reset_index()
		df['label'] = df.apply(lambda x: translations[x.dataset_class.lower().strip()] if x.dataset_class in translations.keys() else 'unknown', axis=1)
		df.dropna(inplace=True)

		response = input('Do you wish to drop the unknown labels? (y/n) ')
		if response == 'y':
			index = df[df['label']=='unknown'].index
			df.drop(index , inplace=True)

		response = input('Do you wish to drop detections below a confidence threshold? (y/n) ')
		if response =='y':
			threshold = None
			while type(threshold) != float:
				try:
					threshold = float(input('Threshold: '))
				except:
					pass
			index = df[(df['confidence']<threshold) & (df['label']!='nothing')].index
			df.drop(index , inplace=True)

		print('\nHere are your label counts:\n{}\n'.format(df['label'].value_counts()))

		response = input('Do you wish to handle the labels below a count threshold? (y/n) ')
		if response == 'y':
			threshold = None
			while type(threshold) != int:
				try:
					threshold = int(input('Threshold: '))
				except:
					pass
			response = input('Do you want to drop (d) the labels, or label them as unknown (u)? ')
			labels = df['label'].unique()
			if response == 'd':
				for label in labels:
					if len(df[df['label']==label]) < threshold:
						df = df[df['label']!=label]
			elif response == 'u':
				for label in labels:
					if len(df[df['label']==label]) < threshold:
						df.loc[df.label==label,'label'] = 'unknown'

		with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
			df.to_csv(temp_file.name,index=False)
			GLOBALS.s3client.put_object(Bucket=bucket,Key=key,Body=temp_file)

		with tempfile.NamedTemporaryFile(delete=True, suffix='.json') as temp_file:
			json.dumps(translations, temp_file)
			filename = key.split('/')[-1].split('.')[0] + '_translations.json'
			key = '/'.join(key.split('/')[:-1])+'/'+filename
			GLOBALS.s3client.put_object(Bucket=bucket,Key=key,Body=temp_file)

		print('All done! Your csv has been translated, and the translations file has been saved to {}'.format(key))
		print('\nHere are the final results:\n{}\n'.format(df['label'].value_counts()))
else:
	print('Aborted')
