'''
Copyright 2022

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

from app import app, db, celery
from app.models import *
from app.functions.globals import retryTime, list_all, chunker, batch_crops
import GLOBALS
from flask_login import current_user
from sqlalchemy.sql import alias, func, or_, and_
import re
import math
import ast
import boto3
from config import Config
import os
from multiprocessing.pool import ThreadPool as Pool
import tempfile
import traceback
import piexif
from iptcinfo3 import IPTCInfo
import shutil
from openpyxl import Workbook
from openpyxl.styles.borders import Border, Side
from openpyxl.styles import PatternFill, Font
import pandas as pd
import json
import io
from celery.result import allow_join_result

def translate(labels, dictionary):
    '''
    Helper function for prepareComparison. Translates label IDs to index numbers.

        Parameters:
            labels (list): list of label IDs for translation
            dictionary (dict): dictionary that translates IDs to index numbers

        Returns:
            newLabels (list): list of label indexes
    '''
    
    newLabels = []
    for label in labels:
        if str(label) == 'nan':
            pass
        else:
            newLabel = dictionary[str(math.trunc(label))]
            if newLabel not in newLabels:
                newLabels.append(newLabel)

    if newLabels == []:
        newLabels = [dictionary['None']]

    return newLabels

def compareLabels(user_id,image_id,labels1,labels2,nothing_label1,nothing_label2,ground_truth,detection,detection_source):
    '''
    Helper function for prepareComparison. Compares the labels on an image-by-image basis, and populates the comparison global variables.

        Parameters:
            user_id (int): The user requesting th comparison
            image_id (int): The image for which the comparison is performed
            labels1 (list): List of label indices for the image from task 1
            labels2 (list): List of label indices for the image from task 2
            nothing_label1 (str): Index of the nothing label category of task 1
            nothing_label2 (str): Index of the nothing label category of task 2
            ground_truth (int): The ground truth task in the comparison
            detection (floar): Detection confidence threshold
            detection_source (list): The source of the detections
    '''
    
    matches = []
    for label in labels1:
        if label in labels2:
            GLOBALS.confusions[user_id][label][label].append(image_id)
            matches.append(label)

    for match in matches:
        labels1.remove(match)
        labels2.remove(match)

    # MegaDetector misses
    if ground_truth == 1:
        if (nothing_label2 in labels2) and (nothing_label1 not in labels1) and (detection<=Config.DETECTOR_THRESHOLDS[detection_source[0]]):
            GLOBALS.MegaDetectorMisses[user_id]['image_ids'].append(image_id)
            GLOBALS.MegaDetectorMisses[user_id]['count'] += len(labels1)
    else:
        if (nothing_label1 in labels1) and (nothing_label2 not in labels2) and (detection<=Config.DETECTOR_THRESHOLDS[detection_source[0]]):
            GLOBALS.MegaDetectorMisses[user_id]['image_ids'].append(image_id)
            GLOBALS.MegaDetectorMisses[user_id]['count'] += len(labels2)

    if (len(labels1) != 0) or ((len(labels2) != 0)):
        if (len(labels1) > 1) or ((len(labels2) > 1)):
            if labels1 == [nothing_label1]:
                for label in labels2:
                    GLOBALS.confusions[user_id][nothing_label1][label].append(image_id)
            elif labels2 == [nothing_label2]:
                for label in labels1:
                    GLOBALS.confusions[user_id][label][nothing_label2].append(image_id)
            else:
                GLOBALS.confusions[user_id]['multi'].append(image_id)
        else:
            if len(labels1) == 0:
                GLOBALS.confusions[user_id][nothing_label1][labels2[0]].append(image_id)
            elif len(labels2) == 0:
                GLOBALS.confusions[user_id][labels1[0]][nothing_label2].append(image_id)
            else:
                GLOBALS.confusions[user_id][labels1[0]][labels2[0]].append(image_id)

    return True

def findEmptyClustered(user_id,image_id,cluster_labels,image_labels,nothing_label):
    '''
    Helper function for prepareComparison. Finds empty images that have been clustered into non-empty clusters and populates comparison globals.

        Parameters:
            user_id (int): The user for which the comparison is being prepared
            image_id (int): The image being checked
            cluster_labels (list): The cluster labels
            image_labels (list): The label indices for the image
            nothing_label (str): Index of the nothing label category
    '''
    
    if (len(cluster_labels)>1) and (nothing_label in cluster_labels) and (nothing_label in image_labels):
        GLOBALS.emptyClustered[user_id].append(image_id)
    return True

def prepareComparison(translations,groundTruth,task_id1,task_id2,user_id):
    '''
    Prepares the requested task comparison for a survey by populating the comparison globals.

        Parameters:
            translations (str): Raw translation string from user
            groundTruth (int): ID of task being used as the ground truth
            task_id1 (int): First task for comparison purposes
            task_id2 (int): Second task for comparison purposes
            user_id (int): User that requested the comparison
    '''
    
    app.logger.info('Preparing comparison.')
    task_id1 = int(task_id1)
    task_id2 = int(task_id2)
    task1 = db.session.query(Task).get(task_id1)
    survey_id = task1.survey_id
    translations = translations.replace('*****', '/')
    translations = ast.literal_eval(translations)

    GLOBALS.ground_truths[str(current_user.id)] = {}
    GLOBALS.ground_truths[str(current_user.id)]['ground'] = int(groundTruth)
    GLOBALS.ground_truths[str(current_user.id)]['task1'] = int(task_id1)
    GLOBALS.ground_truths[str(current_user.id)]['task2'] = int(task_id2)

    if int(groundTruth) == int(task_id1):
        GLOBALS.ground_truths[str(current_user.id)]['other'] = int(task_id2)
        ground_truth = 1
    else:
        GLOBALS.ground_truths[str(current_user.id)]['other'] = int(task_id1)
        ground_truth = 2

    task1Translation = {}
    task2Translation = {}
    newLabels = {}
    index = 1
    for key in translations:
        newLabels[str(index)] = key
        for labelID in translations[key][str(task_id1)]:
            task1Translation[str(labelID)] = str(index)
        for labelID in translations[key][str(task_id2)]:
            task2Translation[str(labelID)] = str(index)
        index += 1

    GLOBALS.comparisonLabels[user_id] = newLabels
    
    task1Translation['None'] = task1Translation[str(GLOBALS.nothing_id)]
    task2Translation['None'] = task2Translation[str(GLOBALS.nothing_id)]

    GLOBALS.ground_truths[str(current_user.id)]['nothing1'] = task1Translation[str(GLOBALS.nothing_id)]
    GLOBALS.ground_truths[str(current_user.id)]['nothing2'] = task2Translation[str(GLOBALS.nothing_id)]

    # detection-label based
    sq1 = db.session.query(Image.id.label('image_id1'),Label.id.label('label_id1'))\
                    .join(Detection)\
                    .join(Labelgroup)\
                    .join(Label, Labelgroup.labels)\
                    .filter(Labelgroup.task_id==task_id1)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(['deleted','hidden']))\
                    .subquery()
    sq2 = db.session.query(Image.id.label('image_id2'),Label.id.label('label_id2'))\
                    .join(Detection)\
                    .join(Labelgroup)\
                    .join(Label, Labelgroup.labels)\
                    .filter(Labelgroup.task_id==task_id2)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static==False)\
                    .filter(~Detection.status.in_(['deleted','hidden']))\
                    .subquery()

    if ground_truth == 1:
        df = pd.read_sql(db.session.query( \
                        Image.id.label('image_id'), \
                        sq1.c.label_id1.label('label_id1'), \
                        sq2.c.label_id2.label('label_id2'),\
                        Cluster.id.label('cluster_id'), \
                        Detection.score.label('detections'),
                        Detection.source.label('detection_source')) \
                        .outerjoin(sq1, sq1.c.image_id1==Image.id) \
                        .outerjoin(sq2, sq2.c.image_id2==Image.id) \
                        .outerjoin(Detection, Detection.image_id==Image.id) \
                        .join(Camera,Image.camera_id==Camera.id) \
                        .join(Trapgroup,Camera.trapgroup_id==Trapgroup.id) \
                        .join(Cluster, Image.clusters) \
                        .filter(Trapgroup.survey_id==survey_id) \
                        .filter(Cluster.task_id==task_id2) \
                        .statement,db.session.bind)
    else:
        df = pd.read_sql(db.session.query( \
                        Image.id.label('image_id'), \
                        sq1.c.label_id1.label('label_id1'), \
                        sq2.c.label_id2.label('label_id2'),\
                        Cluster.id.label('cluster_id'), \
                        Detection.score.label('detections'),
                        Detection.source.label('detection_source')) \
                        .outerjoin(sq1, sq1.c.image_id1==Image.id) \
                        .outerjoin(sq2, sq2.c.image_id2==Image.id) \
                        .outerjoin(Detection, Detection.image_id==Image.id) \
                        .join(Camera,Image.camera_id==Camera.id) \
                        .join(Trapgroup,Camera.trapgroup_id==Trapgroup.id) \
                        .join(Cluster, Image.clusters) \
                        .filter(Trapgroup.survey_id==survey_id) \
                        .filter(Cluster.task_id==task_id1) \
                        .statement,db.session.bind)

    df = df.groupby('image_id').agg(lambda x: tuple(set(x))).reset_index()

    df['detection'] = df['detections'].apply(max)
    df['cluster_detection'] = df.groupby('cluster_id')['detection'].transform(max)
    del df['detections']
    del df['detection']

    df['task1_labels'] = df.apply(lambda x: translate(x.label_id1, task1Translation), axis=1)
    df['task2_labels'] = df.apply(lambda x: translate(x.label_id2, task2Translation), axis=1)

    del df['label_id1']
    del df['label_id2']

    confusion_matrix = {}
    confusion_matrix['multi'] = []
    for i in range(1,index):
        confusion_matrix[str(i)] = {}
        for n in range(1,index):
            confusion_matrix[str(i)][str(n)] = []

    GLOBALS.confusions[user_id] = confusion_matrix

    GLOBALS.MegaDetectorMisses[user_id] = {}
    GLOBALS.MegaDetectorMisses[user_id]['image_ids'] = []
    GLOBALS.MegaDetectorMisses[user_id]['count'] = 0

    nothing_label1 = task1Translation['None']
    nothing_label2 = task2Translation['None']
    df.apply(lambda x: compareLabels(user_id,x.image_id,x.task1_labels,x.task2_labels,nothing_label1,nothing_label2,ground_truth,x.cluster_detection,x.detection_source), axis=1)

    # Find error souces:
    # empty-clustered
    GLOBALS.emptyClustered[user_id] = []
    if ground_truth == 1:
        df['cluster_labels1'] = df.groupby('cluster_id')['task1_labels'].transform(sum)
        df['cluster_labels'] = df.apply(lambda x: set(x.cluster_labels1), axis=1)
        del df['cluster_labels1']
        df.apply(lambda x: findEmptyClustered(user_id,x.image_id,x.cluster_labels,x.task1_labels,nothing_label1), axis=1)
    else:
        df['cluster_labels1'] = df.groupby('cluster_id')['task2_labels'].transform(sum)
        df['cluster_labels'] = df.apply(lambda x: set(x.cluster_labels1), axis=1)
        del df['cluster_labels1']
        df.apply(lambda x: findEmptyClustered(user_id,x.image_id,x.cluster_labels,x.task2_labels,nothing_label2), axis=1)

    return True

def create_full_path(path,filename):
    '''Helper function for create_task_dataframe that returns the concatonated input.'''
    return path+'/'+filename


def drop_nones(label_set):
    '''Helper function for create_task_dataframe that removes the None label from a list of labels if necessary.'''
    if (len(label_set) > 1) and ('None' in label_set):
        label_set.remove('None')
    return label_set

def create_task_dataframe(task_id,detection_count_levels,label_levels,url_levels,individual_levels,tag_levels,include,exclude):
    '''
    Returns an all-encompassing dataframe for a task, subject to the parameter selections.

        Parameters:
            task_id (int): Task for which dataframe has been requested
            detection_count_levels (list): The levels of abstration for which detections counts are required
            label_levels (list): The levels of abstration for which a list of labels is required
            url_levels (list): The levels of abstraction for which urls are required
            individual_levels (list): The levels of abstration for which individual lists are required
            tag_levels (list): The levels of abstration for which a list of tags is required
            include (list): The label ids to include
            exclude (list): The label ids to exclude

        Returns:
            df (pd.dataframe): task dataframe
    '''

    query = db.session.query( \
                Image.id.label('image_id'),\
                Image.filename.label('image_name'), \
                Image.corrected_timestamp.label('timestamp'), \
                Image.timestamp.label('original_timestamp'), \
                Detection.id.label('detection'), \
                Individual.name.label('individual'), \
                Individual.active.label('individual_active'), \
                Individual.task_id.label('individual_task_id'), \
                Cluster.notes.label('notes'), \
                Cluster.id.label('cluster'), \
                Label.description.label('label'), \
                Tag.description.label('tag'), \
                Camera.id.label('camera'), \
                Camera.path.label('file_path'), \
                Trapgroup.id.label('trapgroup_id'), \
                Trapgroup.tag.label('trapgroup'), \
                Trapgroup.latitude.label('latitude'), \
                Trapgroup.longitude.label('longitude'), \
                Trapgroup.altitude.label('altitude'), \
                Survey.id.label('survey_id'), \
                Survey.name.label('survey'), \
                Survey.description.label('survey_description')) \
                .join(Image,Cluster.images) \
                .join(Detection,Detection.image_id==Image.id) \
                .join(Individual,Detection.individuals,isouter=True) \
                .join(Labelgroup,Labelgroup.detection_id==Detection.id) \
                .join(Label,Labelgroup.labels,isouter=True) \
                .join(Tag,Labelgroup.tags,isouter=True) \
                .join(Camera,Image.camera_id==Camera.id) \
                .join(Trapgroup,Camera.trapgroup_id==Trapgroup.id) \
                .join(Survey,Trapgroup.survey_id==Survey.id) \
                .filter(Cluster.task_id==task_id) \
                .filter(Labelgroup.task_id==task_id) \
                .filter(Detection.static==False) \
                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                .filter(~Detection.status.in_(['deleted','hidden']))

    if len(include) != 0:
        query = query.filter(Label.id.in_(include))

    if len(exclude) != 0:
        query = query.filter(~Label.id.in_(exclude))

    if GLOBALS.nothing_id in exclude:
        query = query.filter(Labelgroup.labels.any())

    df = pd.read_sql(query.statement,db.session.bind)
    task = db.session.query(Task).get(task_id)

    if (len(include) == 0) and (GLOBALS.nothing_id not in exclude):
        covered_images = df['image_id'].unique()
        covered_images = [int(r) for r in covered_images]
        missing_images = db.session.query(Image).join(Camera).join(Trapgroup).filter(Trapgroup.survey_id==task.survey_id).filter(~Image.id.in_(covered_images))
        if len(exclude) != 0:
            exclude_images = db.session.query(Image).join(Cluster,Image.clusters).join(Label,Cluster.labels).filter(Cluster.task_id==task_id).filter(Label.id.in_(exclude)).distinct().all()
            missing_images = missing_images.filter(~Image.id.in_([r.id for r in exclude_images]))
        missing_images = missing_images.distinct().all()
        missing_images = [r.id for r in missing_images]

        if len(missing_images) != 0:
            #This includes all the images with no detections
            df2 = pd.read_sql(db.session.query( \
                            Image.id.label('image_id'),\
                            Image.filename.label('image_name'), \
                            Image.corrected_timestamp.label('timestamp'), \
                            Image.timestamp.label('original_timestamp'), \
                            Detection.id.label('detection'), \
                            Cluster.notes.label('notes'), \
                            Cluster.id.label('cluster'), \
                            Camera.id.label('camera'), \
                            Camera.path.label('file_path'), \
                            Trapgroup.id.label('trapgroup_id'), \
                            Trapgroup.tag.label('trapgroup'), \
                            Trapgroup.latitude.label('latitude'), \
                            Trapgroup.longitude.label('longitude'), \
                            Trapgroup.altitude.label('altitude'), \
                            Survey.id.label('survey_id'), \
                            Survey.name.label('survey'), \
                            Survey.description.label('survey_description')) \
                            .join(Image,Cluster.images) \
                            .join(Detection,Detection.image_id==Image.id) \
                            .join(Camera,Image.camera_id==Camera.id) \
                            .join(Trapgroup,Camera.trapgroup_id==Trapgroup.id) \
                            .join(Survey,Trapgroup.survey_id==Survey.id) \
                            .filter(Image.id.in_(missing_images)) \
                            .filter(Cluster.task_id==task_id) \
                            .statement,db.session.bind)

            df2['label'] = 'None'
            df2['tag'] = 'None'
            df2['individual'] = 'None'
            df = pd.concat([df,df2]).reset_index()

    #Combine file paths
    df['image'] = df.apply(lambda x: create_full_path(x.file_path, x.image_name), axis=1)

    #Remove nulls
    df.fillna('None', inplace=True)

    #Remove inactive individuals and those from other tasks
    df = df[(df['individual']=='None') | ((df['individual']!='None') & (df['individual_task_id']==task_id) & (df['individual_active']==True))]

    #Replace nothings
    df['label'] = df['label'].replace({'Nothing': 'None'}, regex=True)

    #Add capture ID
    df.sort_values(by=['survey', 'trapgroup', 'camera', 'timestamp'], inplace=True, ascending=True)
    df['capture'] = df.drop_duplicates(subset=['camera','timestamp']).groupby('camera').cumcount()+1
    df['capture'].fillna(0, inplace=True)
    df['capture'] = df.groupby(['camera','timestamp'])['capture'].transform('max')
    df = df.astype({"capture": int})

    #Add unique capture ID for labels
    df['unique_capture'] = df.apply(lambda x: create_full_path(str(x.camera), str(x.capture)), axis=1)

    #Species counts
    animal_exclusions = ['None','Nothing','Vehicles/Humans/Livestock','Knocked Down']
    labels = db.session.query(Label).filter(Label.task_id==task_id).all()
    labels.append(db.session.query(Label).get(GLOBALS.vhl_id))
    labels.append(db.session.query(Label).get(GLOBALS.unknown_id))
    for level in detection_count_levels:
        level_name = level
        if level == 'capture':
            level = 'unique_capture'
        for label in labels:
            if level in ['cluster','unique_capture']:
                # Gives a minimum number of animals in the cluster/capture
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'] = df.groupby(level)['image_'+label.description.replace(' ','_').lower()+'_count'].transform('max')
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'].fillna(0, inplace=True)
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'] = df.groupby(level)[level_name+'_'+label.description.replace(' ','_').lower()+'_count'].transform('max')
            else:
                # Gives the total count of the detections over the level
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'] = df[df['label']==label.description].groupby(level)['detection'].transform('nunique')
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'].fillna(0, inplace=True)
                df[level_name+'_'+label.description.replace(' ','_').lower()+'_count'] = df.groupby(level)[level_name+'_'+label.description.replace(' ','_').lower()+'_count'].transform('max')
        df[level_name+'_animal_count'] = df[~df.label.isin(animal_exclusions)].groupby(level)[level].transform('count')
        df[level_name+'_animal_count'].fillna(0, inplace=True)
        df[level_name+'_animal_count'] = df.groupby(level)[level_name+'_animal_count'].transform('max')

    #Combine multiple individuals
    for level in individual_levels:
        level_name = level
        if level == 'capture':
            level = 'unique_capture'
        df = df.join(df.groupby(level)['individual'].apply(set).to_frame(level_name+'_individuals_temp'), on=level)
        df[level_name+'_individuals'] = df.apply(lambda x: drop_nones(x[level_name+'_individuals_temp']), axis=1)
        del df[level_name+'_individuals_temp']

    #Combine multiple labels
    for level in label_levels:
        level_name = level
        if level == 'capture':
            level = 'unique_capture'
        df = df.join(df.groupby(level)['label'].apply(set).to_frame(level_name+'_labels_temp'), on=level)
        df[level_name+'_labels'] = df.apply(lambda x: drop_nones(x[level_name+'_labels_temp']), axis=1)
        del df[level_name+'_labels_temp']

    #Combine multiple tags
    for level in tag_levels:
        level_name = level
        if level == 'capture':
            level = 'unique_capture'
        df = df.join(df.groupby(level)['tag'].apply(set).to_frame(level_name+'_tags_temp'), on=level)
        df[level_name+'_tags'] = df.apply(lambda x: drop_nones(x[level_name+'_tags_temp']), axis=1)
        del df[level_name+'_tags_temp']
    
    #Drop suplicate images
    df = df.drop_duplicates(subset=['image'], keep='first').reset_index()

    #Generate necessary urls
    rootUrl = 'https://' + Config.DNS + '/imageViewer?type='
    for level in url_levels:
        level_name = level
        if (level == 'capture') or (level == 'image'):
            level = 'image_id'
        elif level=='trapgroup':
            level = 'trapgroup_id'
        elif level=='survey':
            level = 'survey_id'
        levelRootUrl = rootUrl + level_name + '&id='
        df[level_name+'_url'] = df.apply(lambda x: levelRootUrl+str(x[level]), axis=1)

    # Rename image_id column as id for access to unique IDs
    df.rename(columns={'image_id':'id'},inplace=True)

    #Drop unnecessary columns
    del df['file_path']
    del df['image_name']
    del df['label']
    del df['tag']
    # del df['image_id']
    del df['trapgroup_id']
    del df['survey_id']
    del df['individual']

    #Add image counts
    df['capture_image_count'] = df.groupby('unique_capture')['unique_capture'].transform('count')
    df['cluster_image_count'] = df.groupby('cluster')['cluster'].transform('count')
    df['camera_image_count'] = df.groupby('camera')['camera'].transform('count')
    df['trapgroup_image_count'] = df.groupby('trapgroup')['trapgroup'].transform('count')
    df['survey_image_count'] = df.groupby('survey')['survey'].transform('count')

    # df.sort_values(by=['survey', 'trapgroup', 'camera', 'timestamp'], inplace=True, ascending=True)

    return df

def addChildrenLabels(currentIndex,columns,parentLabels,allLevel,selectedTasks):
    '''
    Helper function for generate_csv. Adds the children labels to the dataframe column list, in the correct order.

        Parameters:
            currentIndex (int): The index of the column list were the child label columns need to be added
            columns (list): The column list into which the child label columsn must be added
            parentLabels (list): The list of labels names that must be added to the column list alongside their children
            allLevel (str): The level of abstration for which species counts are being added
            selectedTasks (list): The task IDs for which the csv has been requested

        Returns:
            currentIndex (int): The last index where columns were inserted
            columns (list): The updated version of the column list
    '''
    
    Parent = alias(Label)

    for parentLabel in parentLabels:

        column = allLevel+'_'+parentLabel.replace(' ','_').lower()+'_count'
        if column not in columns:
            columns.insert(currentIndex,column)
        currentIndex += 1

        childrenLabels =    [ r[0] for r in 
                                db.session.query(Label.description)\
                                .join(Parent,Parent.c.id==Label.parent_id)\
                                .filter(Label.task_id.in_(selectedTasks))\
                                .filter(Parent.c.description==parentLabel)\
                                .all()
                            ]

        if childrenLabels:
            currentIndex, columns = addChildrenLabels(currentIndex,columns,childrenLabels,allLevel,selectedTasks)

    return currentIndex, columns

def handle_custom_columns(columns,row,custom_split):
    '''
    Helper function for generate_csv. Returns the custom column value for a row of data.

        Parameters:
            columns (list): The column names of the row of data
            row (dictionary): The row of data itself
            custom_split (list): The custom column information list

        Returns:
            output (string): The custom column value for the input row.
    '''
	
    output = ''
    for item in custom_split:
        if item in columns:
            output += str(row[item])
        else:
            output += str(item)
    return output

def combine_list(list):
    reply='['
    for item in list:
        reply += str(item)+';'
    reply = reply[:-1]
    reply += ']'
    return reply

@celery.task(bind=True,max_retries=1,ignore_result=True)
def generate_csv(self,selectedTasks, selectedLevel, requestedColumns, custom_columns, label_type, includes, excludes):
    '''
    Celery task for generating a csv file. Locally saves a csv file for the requested tasks, with the requested column and row information.

        Paramters:
            selectedTasks (list): List of task IDs for which a csv is required
            selectedLevel (string): The level of abstration each row in the csv is to represent (image, cluster, camera etc.)
            requestedColumns (list): List of columns for the csv, in the order in which they are required
            custom_columns (list): List of the descriptions of custom columns requested in the csv
            label_type (str): The type of labelling scheme to be uses - row, column or list
            includes (list): List of label names that should included
            excludes (list): List of label names that should excluded
    '''
    
    try:
        task = db.session.query(Task).get(selectedTasks[0])
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name

        if selectedLevel == 'capture':
            selectedLevel = 'unique_capture'

        allLevels = []
        detection_count_levels = ['image']
        label_levels = []
        tag_levels = []
        url_levels = []
        individual_levels = []
        sighting_count_levels = []
        for column in requestedColumns:
            if 'sighting_count' in column:
                level = re.split('_sighting_count',column)[0]
                if level not in sighting_count_levels:
                    sighting_count_levels.append(level)
                if level not in label_levels:
                    label_levels.append(level)
                if level not in detection_count_levels:
                    detection_count_levels.append(level)
            elif '_count' in column:
                level = re.split('_.+_count',column)[0]
                if level not in detection_count_levels:
                    detection_count_levels.append(level)
                if '_all_count' in column:
                    allLevels.append(re.split('_all_count',column)[0])
            elif '_labels' in column:
                level = re.split('_labels',column)[0]
                if level not in label_levels:
                    label_levels.append(re.split('_labels',column)[0])
            elif '_tags' in column:
                tag_levels.append(re.split('_tags',column)[0])
            elif '_url' in column:
                url_levels.append(re.split('_url',column)[0])
            elif '_individuals' in column:
                individual_levels.append(re.split('_individuals',column)[0])

        # Generate include an exclude lists
        include = [r.id for r in db.session.query(Label).filter(Label.task_id.in_(selectedTasks)).filter(Label.description.in_(includes)).distinct().all()]
        include.extend([r.id for r in db.session.query(Label).filter(Label.task_id==None).filter(Label.description.in_(includes)).distinct().all()])
        exclude = [r.id for r in db.session.query(Label).filter(Label.task_id.in_(selectedTasks)).filter(Label.description.in_(excludes)).distinct().all()]
        exclude.extend([r.id for r in db.session.query(Label).filter(Label.task_id==None).filter(Label.description.in_(excludes)).distinct().all()])

        outputDF = None
        for task_id in selectedTasks:
            df = create_task_dataframe(task_id,detection_count_levels,label_levels,url_levels,individual_levels,tag_levels,include,exclude)

            # Generate custom columns
            for custom_name in custom_columns[str(task_id)]:
                custom = custom_columns[str(task_id)][custom_name]
                custom_split = [r for r in re.split('%%%%',custom) if r != '']
                df[custom_name] = df.apply(lambda x: handle_custom_columns(df.columns,x,custom_split), axis=1)

            df = df.drop_duplicates(subset=[selectedLevel], keep='first')

            if outputDF is not None:
                outputDF = pd.concat([outputDF, df], ignore_index=True)
                outputDF.fillna(0, inplace=True)
            else:
                outputDF = df

        for allLevel in allLevels:
            column = allLevel+'_all_count'
            currentIndex = requestedColumns.index(column)
            parentLabels = [r[0] for r in db.session.query(Label.description).filter(Label.task_id.in_(selectedTasks)).filter(Label.parent_id == None).distinct().all()]
            parentLabels.append('Vehicles/Humans/Livestock')
            parentLabels.append('Unknown')
            currentIndex, requestedColumns = addChildrenLabels(currentIndex,requestedColumns,parentLabels,allLevel,selectedTasks)
            requestedColumns.remove(column)

        for label_level in label_levels:
            if label_type=='column':
                label_list = []
                label_list2 = []
                for i in range(outputDF[label_level+'_labels'].apply(len).max()):
                    label_list.append(label_level+'_label_'+str(i+1))
                    label_list2.append(label_level+'_sighting_count_'+str(i+1))
                outputDF[label_list] = pd.DataFrame(outputDF[label_level+'_labels'].tolist(), index=outputDF.index)
                del outputDF[label_level+'_labels']
                for heading in label_list:
                    if label_level+'_labels' in requestedColumns:
                        requestedColumns.insert(requestedColumns.index(label_level+'_labels'), heading)
                if label_level in sighting_count_levels:
                    for heading in label_list2:
                        if label_level+'_labels' in requestedColumns:
                            requestedColumns.insert(requestedColumns.index(label_level+'_labels'), heading)
                        else:
                            requestedColumns.append(heading)
                    for n in range(len(label_list2)):
                        outputDF[label_list2[n]] = outputDF.apply(lambda x: x[label_level+'_'+x[label_list[n]].lower().replace(' ','_')+'_count'] if (x[label_list[n]] not in [None, 'None','Knocked Down']) else 0, axis=1)
                if label_level+'_labels' in requestedColumns: requestedColumns.remove(label_level+'_labels')
                if label_level+'_sighting_count' in requestedColumns: requestedColumns.remove(label_level+'_sighting_count')
                outputDF.fillna('None', inplace=True)
            elif label_type=='row':
                outputDF[label_level+'_labels'] = outputDF.apply(lambda x: list(x[label_level+'_labels']), axis=1)
                outputDF = outputDF.explode(label_level+'_labels')
                if label_level in sighting_count_levels:
                    outputDF[label_level+'_sighting_count'] = outputDF.apply(lambda x: x[label_level+'_'+x[label_level+'_labels'].lower().replace(' ','_')+'_count'] if (x[label_level+'_labels'] not in [None, 'None','Knocked Down']) else 0, axis=1)
            elif label_type=='list':
                if label_level in sighting_count_levels:
                    outputDF[label_level+'_sighting_count'] = outputDF.apply(lambda x: [x[label_level+'_'+label.lower().replace(' ','_')+'_count'] for label in x[label_level+'_labels']], axis=1)
                    outputDF[label_level+'_sighting_count'] = outputDF.apply(lambda x: combine_list(x[label_level+'_sighting_count']), axis=1)
                outputDF[label_level+'_labels'] = outputDF.apply(lambda x: combine_list(x[label_level+'_labels']), axis=1)

        for tag_level in tag_levels:
            if label_type=='column':
                tag_list = []
                for i in range(outputDF[tag_level+'_tags'].apply(len).max()):
                    tag_list.append(tag_level+'_tag_'+str(i+1))
                outputDF[tag_list] = pd.DataFrame(outputDF[tag_level+'_tags'].tolist(), index=outputDF.index)
                del outputDF[tag_level+'_tags']
                for heading in tag_list:
                    requestedColumns.insert(requestedColumns.index(tag_level+'_tags'), heading)
                requestedColumns.remove(tag_level+'_tags')
                outputDF.fillna('None', inplace=True)
            elif label_type=='row':
                outputDF[tag_level+'_tags'] = outputDF.apply(lambda x: list(x[tag_level+'_tags']), axis=1)
                outputDF = outputDF.explode(tag_level+'_tags')
            elif label_type=='list':
                outputDF[tag_level+'_tags'] = outputDF.apply(lambda x: combine_list(x[tag_level+'_tags']), axis=1)

        for individual_level in individual_levels:
            individual_list = []
            for i in range(outputDF[individual_level+'_individuals'].apply(len).max()):
                individual_list.append(individual_level+'_individual_'+str(i+1))
            outputDF[individual_list] = pd.DataFrame(outputDF[individual_level+'_individuals'].tolist(), index=outputDF.index)
            del outputDF[individual_level+'_individuals']
            for heading in individual_list:
                requestedColumns.insert(requestedColumns.index(individual_level+'_individuals'), heading)
            requestedColumns.remove(individual_level+'_individuals')
            outputDF.fillna('None', inplace=True)

        outputDF = outputDF[requestedColumns]

        # Trapgroups now called sites:
        changes = {}
        for column in outputDF.columns:
            if 'trapgroup' in column:
                changes[column] = column.replace('trapgroup','site')
        if len(changes) != 0:
            outputDF.rename(columns=changes,inplace=True)

        if os.path.isfile(fileName+'_writing.csv'):
            try:
                os.remove(fileName+'_writing.csv')
            except:
                pass

        if os.path.isfile(fileName+'.csv'):
            try:
                os.remove(fileName+'.csv')
            except:
                pass

        os.makedirs('docs', exist_ok=True)
        outputDF.to_csv(fileName+'_writing.csv',index=False,date_format="%Y-%m-%d %H:%M:%S")
        os.rename(fileName+'_writing.csv', fileName+'.csv')

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def generate_wildbook_export(self,task_id, data):
    '''
    Celery task for generating the WildBook export format. Saves export in zip file locally.

        Parameters:
            task_id (int): The task for which the export is required
            data (dict): The required data for the export - species, genus, epithet, wildbookid
    '''
    
    try:
        os.makedirs('docs', exist_ok=True)
        task = db.session.query(Task).get(task_id)
        fileName = 'docs/'+task.survey.user.username+'_'+task.survey.name+'_'+task.name

        if os.path.isfile(fileName+'.zip'):
            try:
                os.remove(fileName+'.zip')
            except:
                pass

        bucketName = task.survey.user.bucket + '-raw'
        tempFolderName = fileName+'_temp'
        species = db.session.query(Label).get(int(data['species']))

        df = pd.read_sql(db.session.query( \
                        Detection.id.label('detection'), \
                        Camera.path.label('path'), \
                        Camera.id.label('camera_id'), \
                        Image.filename.label('filename'), \
                        Image.corrected_timestamp.label('timestamp'), \
                        Trapgroup.latitude.label('Encounter.decimalLatitude'), \
                        Trapgroup.longitude.label('Encounter.decimalLongitude')) \
                        .join(Image, Image.id==Detection.image_id) \
                        .join(Camera, Camera.id==Image.camera_id) \
                        .join(Trapgroup, Trapgroup.id==Camera.trapgroup_id) \
                        .join(Labelgroup, Labelgroup.detection_id==Detection.id) \
                        .filter(Labelgroup.task_id==task_id) \
                        .filter(Labelgroup.labels.contains(species)) \
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                        .filter(Detection.static == False) \
                        .filter(~Detection.status.in_(['deleted','hidden'])) \
                        .statement,db.session.bind)

        df['Encounter.genus'] = data['genus'][:1].upper() + data['genus'][1:].lower()
        df['Encounter.specificEpithet'] = data['epithet'].lower()
        df['Encounter.submitterID'] = data['wildbookid']

        df['Encounter.year'] = df.apply(lambda x: x.timestamp.year, axis=1)
        df['Encounter.month'] = df.apply(lambda x: x.timestamp.month, axis=1)
        df['Encounter.day'] = df.apply(lambda x: x.timestamp.day, axis=1)
        df['Encounter.hour'] = df.apply(lambda x: x.timestamp.hour, axis=1)
        df['Encounter.minutes'] = df.apply(lambda x: x.timestamp.minute, axis=1)

        df['Encounter.mediaAsset0'] = df.apply(lambda x: (str(x.camera_id)+'_'+x.filename).replace('(','_').replace(')','_'), axis=1)
        df = df.drop_duplicates(subset=['Encounter.mediaAsset0'], keep='first').reset_index()

        del df['timestamp']
        del df['detection']
        del df['camera_id']
        del df['index']

        if os.path.isdir(tempFolderName):
            shutil.rmtree(tempFolderName)
        os.makedirs(tempFolderName, exist_ok=True)

        for n in range((math.ceil(len(df)/1000))):
            subsetFolder = tempFolderName+'/'+str(n+1)
            os.makedirs(subsetFolder, exist_ok=True)
            tempDF = df.loc[n*1000:(n+1)*1000-1]

            tempDF.apply(lambda x: GLOBALS.s3client.download_file(
                Bucket=bucketName, 
                Key=(x['path']+'/'+x['filename']), 
                Filename=(subsetFolder+'/'+x['Encounter.mediaAsset0'])
            ), axis=1)

            del tempDF['path']
            del tempDF['filename']
            tempDF.to_csv(subsetFolder+'/metadata.csv',index=False)

        shutil.make_archive(tempFolderName, 'zip', tempFolderName)
        os.rename(tempFolderName+'.zip', fileName+'.zip')
        shutil.rmtree(tempFolderName)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def deleteFile(self,fileName):
    '''
    Celery task that periodically checks for and attempts to delete specified file. Used to cleanup files after successful download.

        Parameters:
            filename (str): The path of the file to be deleted
    '''
    
    try:
        if os.path.isfile(fileName):
            try:
                os.remove(fileName)
            except:
                deleteFile.apply_async(kwargs={'fileName': fileName}, countdown=300)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

def num_to_excel_col(n):
    '''Converts a numerical column index into an Excel format column.'''
    if n < 1:
        raise ValueError("Number must be positive")
    result = ""
    while True:
        if n > 26:
            n, r = divmod(n - 1, 26)
            result = chr(r + ord('A')) + result
        else:
            return chr(n + ord('A') - 1) + result


def child_headings(task_id, label, currentCol, speciesColumns, sheet):
    '''
    Helper function for generate_excel. Generates the species columns for the excel file in the correct order.

        Parameters:
            task_id (int): The task for which the Excel file is being prepared
            label (Label): The label for which child labels must be added
            currentCol (int): Column index
            speciesColumns (list): The species columns list
            sheet (openpyxl.sheet): The Excel sheet object beiong written to

        Returns:
            currentCol (int): The updated index
            speciesColumns (list): The updated species column list
            sheet (openpyxl.sheet): The updated Excel sheet objec
    '''
    
    children = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent==label).all()
    for child in children:
        currentColumn = num_to_excel_col(currentCol)
        speciesColumns[child.description] = currentColumn
        currentColumn += '3'
        sheet[currentColumn] = child.description
        sheet[currentColumn].border = Border(bottom=Side(style='thin'))
        currentCol += 1

        childChildren = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent==child).all()
        if len(childChildren) > 0:
            sheet[currentColumn[:-1]+'2'] = label.description
            sheet[currentColumn] = 'Unknown'
            sheet[currentColumn].border = Border(left=Side(style='thin'), bottom=Side(style='thin'))
            currentCol, speciesColumns, sheet = child_headings(task_id, child, currentCol, speciesColumns, sheet)
    return currentCol, speciesColumns, sheet


@celery.task(bind=True,max_retries=29,ignore_result=True)
def generate_excel(self,task_id):
    '''Celery task for generating an Excel summary of a specified task. Saves the file locally for download.'''
    try:
        app.logger.info('generate_excel commenced')
        task = db.session.query(Task).get(task_id)
        survey = task.survey
        user = survey.user

        right_border = Border(right=Side(style='thin'))
        left_border = Border(left=Side(style='thin'))
        top_border = Border(top=Side(style='thin'))
        bottom_border = Border(bottom=Side(style='thin'))

        greyFill = PatternFill(start_color='DCDCDC',
                        end_color='DCDCDC',
                        fill_type='solid')

        whiteFill = PatternFill(start_color='FFFFFF',
                        end_color='FFFFFF',
                        fill_type='solid')

        workbook = Workbook()
        sheet = workbook.active

        #Headings
        sheet["A1"] = survey.name
        sheet["A1"].font = Font(size = "18", bold=True)
        sheet.row_dimensions[1].height = 25
        # sheet.merge_cells('A1:E1')
        sheet["B2"] = 'Co-ordinates'
        sheet["A3"] = 'Trap'
        sheet["A3"].border = bottom_border
        sheet["B3"] = 'Longitude'
        sheet["B3"].border = Border(left=Side(style='thin'), bottom=Side(style='thin'))
        sheet["C3"] = 'Latitude'
        sheet["C3"].border = bottom_border
        sheet["D3"] = 'Altitude'
        sheet["D3"].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))
        sheet["E3"] = 'Card No.'
        sheet["E3"].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))
        sheet["F3"] = 'Total Clusters'
        sheet["F3"].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))

        speciesColumns = {}
        currentCol = 7
        parentLabels = db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.parent.has()).all()
        vhl = db.session.query(Label).get(GLOBALS.vhl_id)
        parentLabels.append(vhl)
        for label in parentLabels:
            currentColumn = num_to_excel_col(currentCol)
            speciesColumns[label.description] = currentColumn
            currentColumn += '3'
            sheet[currentColumn] = label.description
            sheet[currentColumn].border = bottom_border
            currentCol += 1

            children = db.session.query(Label).filter(Label.task_id==task_id).filter(Label.parent==label).all()
            if len(children)>0:
                sheet[currentColumn[:-1]+'2'] = label.description
                sheet[currentColumn] = 'Unknown'
                sheet[currentColumn].border = Border(left=Side(style='thin'), bottom=Side(style='thin'))
                currentCol, speciesColumns, sheet = child_headings(task_id, label, currentCol, speciesColumns, sheet)

        finalColumn = currentColumn[:-1]
        print(speciesColumns)

        #Generate Rows
        cameras = db.session.query(Camera).join(Trapgroup).filter(Trapgroup.survey==survey).all()
        labels = db.session.query(Label).filter(Label.task_id==task_id).all()
        labels.append(vhl)
        trapgroupsCompleted = []
        currentRow = 4
        currentFill = whiteFill
        for camera in cameras:
            if camera.trapgroup.tag not in trapgroupsCompleted:
                sheet["A"+str(currentRow)] = camera.trapgroup.tag
                sheet["B"+str(currentRow)] = camera.trapgroup.longitude
                sheet["C"+str(currentRow)] = camera.trapgroup.latitude
                sheet["D"+str(currentRow)] = camera.trapgroup.altitude
                trapgroupsCompleted.append(camera.trapgroup.tag)
                if currentFill == greyFill:
                    currentFill = whiteFill
                else:
                    currentFill = greyFill
            sheet["A"+str(currentRow)].fill = currentFill
            sheet["B"+str(currentRow)].fill = currentFill
            sheet["B"+str(currentRow)].border = Border(left=Side(style='thin'))
            sheet["C"+str(currentRow)].fill = currentFill
            sheet["D"+str(currentRow)].fill = currentFill
            sheet["D"+str(currentRow)].border = Border(right=Side(style='thin'))

            for item in re.split('/',camera.path):
                if camera.trapgroup.tag in item:
                    sheet["E"+str(currentRow)] = item
            sheet["E"+str(currentRow)].fill = currentFill
            sheet["E"+str(currentRow)].border = right_border

            sheet["F"+str(currentRow)] = db.session.query(Cluster) \
                                                .join(Image, Cluster.images) \
                                                .filter(Cluster.task_id==task_id) \
                                                .filter(Image.camera_id==camera.id) \
                                                .distinct(Cluster.id) \
                                                .count()
            sheet["F"+str(currentRow)].fill = currentFill
            sheet["F"+str(currentRow)].border = Border(right=Side(style='thin'))
            
            for label in labels:
                clusterCount = db.session.query(Cluster) \
                                    .join(Image, Cluster.images) \
                                    .filter(Cluster.task_id==task_id) \
                                    .filter(Cluster.labels.contains(label)) \
                                    .filter(Image.camera_id==camera.id) \
                                    .distinct(Cluster.id) \
                                    .count()

                if clusterCount > 0:
                    sheet[speciesColumns[label.description]+str(currentRow)] = clusterCount

                if len(label.children[:])>0:
                    sheet[speciesColumns[label.description]+str(currentRow)].border = left_border

                sheet[speciesColumns[label.description]+str(currentRow)].fill = currentFill

            sheet[finalColumn+str(currentRow)].border = Border(right=Side(style='thin'))
            currentRow += 1

        sheet['A'+str(currentRow)].border = Border(top=Side(style='thin'))
        sheet['B'+str(currentRow)].border = Border(top=Side(style='thin'))
        sheet['C'+str(currentRow)].border = Border(top=Side(style='thin'))
        sheet['D'+str(currentRow)].border = Border(top=Side(style='thin'))
        sheet['E'+str(currentRow)].border = Border(top=Side(style='thin'))
        sheet['F'+str(currentRow)].border = Border(top=Side(style='thin'))
        for label in labels:
            sheet[speciesColumns[label.description]+str(currentRow)].border = Border(top=Side(style='thin'))
            sheet[speciesColumns[label.description]+str(currentRow)].fill = whiteFill
            sheet[speciesColumns[label.description]+str(currentRow+3)].fill = whiteFill
            sheet[speciesColumns[label.description]+str(currentRow+6)].fill = whiteFill
            sheet[speciesColumns[label.description]+str(currentRow+7)].fill = whiteFill
            sheet[speciesColumns[label.description]+'1'].fill = whiteFill
            sheet[speciesColumns[label.description]+'2'].fill = whiteFill
            sheet[speciesColumns[label.description]+'3'].fill = whiteFill

        for item in ['A','B','C','D','E','F']:
            sheet[item+str(currentRow)].fill = whiteFill
            sheet[item+str(currentRow+3)].fill = whiteFill
            sheet[item+str(currentRow+6)].fill = whiteFill
            sheet[item+str(currentRow+7)].fill = whiteFill
            sheet[item+'1'].fill = whiteFill
            sheet[item+'2'].fill = whiteFill
            sheet[item+'3'].fill = whiteFill

        sheet[finalColumn+str(currentRow-1)].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))

        #Generate Totals
        currentRow += 1
        sheet["A"+str(currentRow)] = 'Totals'
        sheet["A"+str(currentRow)].border = Border(right=Side(style='thin'), left=Side(style='thin'), top=Side(style='thin'))
        sheet["A"+str(currentRow)].fill = greyFill
        sheet.merge_cells('A'+str(currentRow)+':E'+str(currentRow))
        sheet["A"+str(currentRow+1)] = 'Percentage'
        sheet["A"+str(currentRow+1)].border = Border(right=Side(style='thin'), left=Side(style='thin'), bottom=Side(style='thin'))
        sheet["A"+str(currentRow+1)].fill = whiteFill
        sheet.merge_cells('A'+str(currentRow+1)+':E'+str(currentRow+1))
        totalCount = db.session.query(Cluster).filter(Cluster.task_id==task_id).distinct(Cluster.id).count()
        sheet["F"+str(currentRow)] = totalCount
        sheet["F"+str(currentRow)].border = top_border
        sheet["F"+str(currentRow)].fill = greyFill
        sheet["F"+str(currentRow+1)].border = bottom_border
        sheet["F"+str(currentRow+1)].fill = whiteFill
        for label in labels:
            clusterCount = db.session.query(Cluster) \
                                    .join(Image, Cluster.images) \
                                    .filter(Cluster.task_id==task_id) \
                                    .filter(Cluster.labels.contains(label)) \
                                    .distinct(Cluster.id) \
                                    .count()

            sheet[speciesColumns[label.description]+str(currentRow)] = clusterCount
            sheet[speciesColumns[label.description]+str(currentRow)].border = top_border
            sheet[speciesColumns[label.description]+str(currentRow)].fill = greyFill
            sheet[speciesColumns[label.description]+str(currentRow+1)] = round((clusterCount/totalCount)*100,2)
            sheet[speciesColumns[label.description]+str(currentRow+1)].border = bottom_border
            sheet[speciesColumns[label.description]+str(currentRow+1)].fill = whiteFill

            if len(label.children[:])>0:
                sheet[speciesColumns[label.description]+str(currentRow)].border = Border(left=Side(style='thin'), top=Side(style='thin'))
                sheet[speciesColumns[label.description]+str(currentRow+1)].border = Border(left=Side(style='thin'), bottom=Side(style='thin'))

        sheet[finalColumn+str(currentRow)].border = Border(right=Side(style='thin'), top=Side(style='thin'))
        sheet[finalColumn+str(currentRow+1)].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))

        #Generate Category Totals
        currentRow += 3
        sheet["A"+str(currentRow)] = 'Category Totals'
        sheet["A"+str(currentRow)].border = Border(right=Side(style='thin'), left=Side(style='thin'), top=Side(style='thin'))
        sheet["A"+str(currentRow)].fill = greyFill
        sheet.merge_cells('A'+str(currentRow)+':E'+str(currentRow))
        sheet["A"+str(currentRow+1)] = 'Category Percentages'
        sheet["A"+str(currentRow+1)].border = Border(right=Side(style='thin'), left=Side(style='thin'), bottom=Side(style='thin'))
        sheet["A"+str(currentRow+1)].fill = whiteFill
        sheet.merge_cells('A'+str(currentRow+1)+':E'+str(currentRow+1))
        parentLabels.append(vhl)
        sheet["F"+str(currentRow)].border = top_border
        sheet["F"+str(currentRow)].fill = greyFill
        sheet["F"+str(currentRow+1)].border = bottom_border
        sheet["F"+str(currentRow+1)].fill = whiteFill
        for label in parentLabels:
            count = 0
            count += db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .filter(Cluster.task_id==task_id) \
                            .filter(Cluster.labels.contains(label)) \
                            .distinct(Cluster.id) \
                            .count()

            for child in label.children:
                count += db.session.query(Cluster) \
                            .join(Image, Cluster.images) \
                            .filter(Cluster.task_id==task_id) \
                            .filter(Cluster.labels.contains(child)) \
                            .distinct(Cluster.id) \
                            .count()

            sheet[speciesColumns[label.description]+str(currentRow)] = count
            sheet[speciesColumns[label.description]+str(currentRow+1)] = round((count/totalCount)*100,2)

        for label in labels:
            sheet[speciesColumns[label.description]+str(currentRow)].border = top_border
            sheet[speciesColumns[label.description]+str(currentRow)].fill = greyFill
            sheet[speciesColumns[label.description]+str(currentRow+1)].border = bottom_border
            sheet[speciesColumns[label.description]+str(currentRow+1)].fill = whiteFill

            if len(label.children[:])>0:
                sheet[speciesColumns[label.description]+str(currentRow)].border = Border(left=Side(style='thin'), top=Side(style='thin'))
                sheet[speciesColumns[label.description]+str(currentRow+1)].border = Border(left=Side(style='thin'), bottom=Side(style='thin'))

        sheet[finalColumn+str(currentRow)].border = Border(right=Side(style='thin'), top=Side(style='thin'))
        sheet[finalColumn+str(currentRow+1)].border = Border(right=Side(style='thin'), bottom=Side(style='thin'))

        fileName = 'docs/'+user.username+'_'+survey.name+'_'+task.name+'.xlsx'

        if os.path.isfile(fileName):
            try:
                os.remove(fileName)
            except:
                pass

        workbook.save(filename=fileName)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return None

def prepare_exif_image(image_id,task_id,species_sorted,bucket,flat_structure,individual_sorted,surveyName,labels):
    '''
    Processes a single image for exif download by downloading the file locally, editing its metadata (without opening it) and saving it 
    to a Downloads folder in the user's bucket. Labels are saved in the user comment exif data, xpkeyword data and the IPTC keywords.
    
        Parameters:
            image_id (int): The image to process
            task_id (int): The task whose labels must be used
            species_sorted (bool): Whether the dataset should be sorted into species folders
            bucket (str): The bucket where the image should be uploaded
            flat_structure (bool): Whether the folder structure should be flattened
            individual_sorted (bool): Wether to sort the data by individuals
            surveyName (str): The name of the survey associated with the image
            labels (list): The requested label ids
    '''
    try:
        image = db.session.query(Image).get(image_id)
        splitPath = re.split('/',image.camera.path)
        sourceKey = image.camera.path + '/' + image.filename

        imageLabels = db.session.query(Label)\
                            .join(Labelgroup,Label.labelgroups)\
                            .join(Detection)\
                            .filter(Detection.image==image)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .filter(Labelgroup.task_id==task_id)\
                            .distinct().order_by(Label.description).all()

        imageTags = db.session.query(Tag)\
                            .join(Labelgroup,Tag.labelgroups)\
                            .join(Detection)\
                            .filter(Detection.image==image)\
                            .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                            .filter(Detection.static==False)\
                            .filter(~Detection.status.in_(['deleted','hidden']))\
                            .filter(Labelgroup.task_id==task_id)\
                            .distinct().order_by(Tag.description).all()

        destinationKeys = []
        baseName = image.camera.trapgroup.tag + '_' + image.corrected_timestamp.strftime("%Y%m%d_%H%M%S")
        for label in imageLabels:
            individuals = [None]
            if individual_sorted:
                individuals = db.session.query(Individual)\
                                    .join(Detection,Individual.detections)\
                                    .filter(Detection.image_id==image_id)\
                                    .filter(Individual.task_id==task_id)\
                                    .filter(Individual.label_id==label.id)\
                                    .filter(Individual.active==True)\
                                    .distinct().all()
                if len(individuals)==0: individuals = [None]
            for individual in individuals:
                if not (species_sorted and (label.id not in labels)):
                    destinationKey = 'Downloads/' + surveyName
                    if species_sorted:  destinationKey += '/' + label.description
                    if individual and individual_sorted: destinationKey += '/' + individual.name
                    if flat_structure:
                        filename = baseName
                        for imageLabel in imageLabels: filename += '_' + imageLabel.description.replace(' ','_')
                        filename += '_' + str(image.id) + '.jpg'
                        destinationKey += '/' + filename
                    else:
                        for split in splitPath: destinationKey += '/' + split
                        destinationKey += '/' +image.filename
                    destinationKeys.append(destinationKey)

        # with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
        # GLOBALS.s3client.download_file(Bucket=bucket, Key=sourceKey, Filename=temp_file.name)

        s3_response_object = GLOBALS.s3client.get_object(Bucket=bucket,Key=sourceKey)
        imageData = s3_response_object['Body'].read()

        exifData = b'ASCII\x00\x00\x00'
        xpKeywordData = ''
        # IPTCData = []
        imageLabels.extend(imageTags)
        for label in imageLabels:
            xpKeywordData += label.description
            exifData += label.description.encode()
            # IPTCData.append(label.description.encode())
            if label != imageLabels[-1]:
                xpKeywordData += ','
                exifData += b', '

        # EXIF
        try:
            try:
                exif_dict = piexif.load(imageData)
                exif_bytes = piexif.dump(exif_dict)
            except:
                # If exif data is corrupt, then just overwite it entirely
                exif_dict={'0th':{},'Exif':{}}
            exif_dict['Exif'][37510] = exifData #write the data to the user comment exif data
            exif_dict['Exif'][36867] = image.corrected_timestamp.strftime("%Y/%m/%d %H:%M:%S").encode() #created on 
            exif_dict['Exif'][36868] = image.corrected_timestamp.strftime("%Y/%m/%d %H:%M:%S").encode()
            exif_dict['0th'][40094] = xpKeywordData.encode('utf-16')
            exif_bytes = piexif.dump(exif_dict)
            output=io.BytesIO()
            piexif.insert(exif_bytes,imageData,output) #insert new exif data without opening & re-saving image
        except:
            # Rather ensure that the image is there, without exif data than the opposite.
            pass

        # # IPTC
        # try:
        #     info = IPTCInfo(temp_file.name)
        #     info['keywords'] = IPTCData
        #     info.save()
        # except:
        #     # Rather ensure image is there
        #     pass

        for destinationKey in destinationKeys:
            GLOBALS.s3client.put_object(Body=output,Bucket=bucket,Key=destinationKey)
            # GLOBALS.s3client.upload_file(Filename=temp_file.name, Bucket=bucket, Key=destinationKey)

    except Exception:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29)
def prepare_exif_batch(self,image_ids,task_id,species_sorted,bucket,flat_structure,individual_sorted,surveyName,labels):
    ''' Prepares a batch of exif images, allowing for parallelisation across instances. 
    
        Parameters:
            image_ids (list): The batch of images to process
            task_id (int): The task whose labels must be used
            species_sorted (bool): Whether the dataset should be sorted into species folders
            bucket (str): The bucket where the image should be uploaded
            flat_structure (bool): Whether the folder structure should be flattened
            individual_sorted (bool): Whether the images should be sorted by individuals
            surveyName (str): The name of the survey associated with the image
            labels (list): The requested label ids
    '''

    try:
        for image_id in image_ids:
            prepare_exif_image(image_id,task_id,species_sorted,bucket,flat_structure,individual_sorted,surveyName,labels)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def prepare_exif(self,task_id,species,species_sorted,flat_structure,individual_sorted):
    '''
    Celery task for preparing an exif dataset download. Triggers the threaded processing of images.

        Parameters:
            task_id (int): The task for which exif dataset is needed
            species (list): The species for download
            species_sorted (bool): Whether the dataset should be sorted into species folders
            flat_structure (bool): Whether the folder structure should be flattened
            individual_sorted (bool): Whether the data should be sorted by identified individuals (where possible)
    '''
    try:
        app.logger.info('prepare_exif started for task {}'.format(task_id))
        task = db.session.query(Task).get(task_id)
        task.survey.status = 'Processing'
        db.session.commit()
        bucket = task.survey.user.bucket + '-raw'
        surveyName = task.survey.name

        # Delete previous
        s3 = boto3.resource('s3')
        bucketObject = s3.Bucket(bucket)
        bucketObject.objects.filter(Prefix='Downloads/'+surveyName+'/').delete()
        
        if '0' in species:
            labels = db.session.query(Label).filter(Label.task_id==task_id).distinct().all()
            labels.append(db.session.query(Label).get(GLOBALS.vhl_id))
        else:
            labels = db.session.query(Label).filter(Label.id.in_(species)).distinct().all()

        images = db.session.query(Image)\
                        .join(Detection)\
                        .join(Labelgroup)\
                        .join(Label,Labelgroup.labels)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static==False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .filter(Labelgroup.task_id==task.id)\
                        .filter(Label.id.in_([r.id for r in labels]))\
                        .distinct().all()

        results = []
        for batch in chunker(images,5000):
            results.append(prepare_exif_batch.apply_async(kwargs={  'image_ids':[r.id for r in batch],
                                                                    'task_id':task_id,
                                                                    'species_sorted':species_sorted,
                                                                    'bucket':bucket,
                                                                    'flat_structure':flat_structure,
                                                                    'individual_sorted':individual_sorted,
                                                                    'surveyName': surveyName,
                                                                    'labels': [r.id for r in labels]},queue='parallel'))

        #Wait for processing to complete
        # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
        # See https://github.com/celery/celery/issues/4480
        db.session.remove()
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

        db.session.query(Task).get(task_id).survey.status = 'Ready'
        db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def generate_training_csv(self,tasks,destBucket,min_area):
    '''
    Generates a csv file for classification trainingg purposes.

        Parameters:
            tasks (list): A list of task IDs for which a file should be created
            destBucket (str): The destination bucket for image crops
            min_area (float): The minimum normalised size of detection crops
    '''

    try:
        outputDF = None
        for task_id in tasks:
            task = db.session.query(Task).get(task_id)

            dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                                    .join(Image) \
                                    .join(Camera) \
                                    .join(Trapgroup) \
                                    .filter(Trapgroup.survey_id==task.survey_id) \
                                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                    .filter(Detection.static == False) \
                                    .filter(~Detection.status.in_(['deleted','hidden'])) \
                                    .subquery()

            # we want to include all child-level labels
            labels = db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.children.any()).all()

            df = pd.read_sql(db.session.query(\
                        Detection.id.label('detection_id'),\
                        Detection.score.label('confidence'),\
                        Image.id.label('image_id'),\
                        Image.filename.label('filename'),\
                        Camera.path.label('dirpath'),\
                        Trapgroup.tag.label('location'),\
                        Survey.name.label('dataset'),\
                        Label.description.label('label'))\
                        .join(Image,Detection.image_id==Image.id)\
                        .join(Camera,Camera.id==Image.camera_id)\
                        .join(Trapgroup,Trapgroup.id==Camera.trapgroup_id)\
                        .join(Survey,Survey.id==Trapgroup.survey_id)\
                        .join(Labelgroup,Labelgroup.detection_id==Detection.id)\
                        .join(Label,Labelgroup.labels)\
                        .join(dimensionSQ,dimensionSQ.c.detID==Detection.id)\
                        .filter(Labelgroup.task_id==task_id)\
                        .filter(Label.id.in_([r.id for r in labels]))\
                        .filter(dimensionSQ.c.area > min_area)\
                        .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                        .filter(Detection.static == False)\
                        .filter(~Detection.status.in_(['deleted','hidden']))\
                        .statement,db.session.bind)

            # Drop detections
            df = df.drop_duplicates(subset=['detection_id'], keep=False)

            # Build crop names
            df['path'] = df.apply(lambda x: x.dirpath+'/'+x.filename[:-4]+'_'+str(x.detection_id)+'.jpg', axis=1)

            # Set the dataset_class to the label value
            df['dataset_class'] = df['label']

            # Check if you need to crop the images
            try:              
                key = df.iloc[0]['path']
                check = GLOBALS.s3client.head_object(Bucket=destBucket,Key=key)
            
            except:
                # Crop does not exist - must crop the images
                crop_survey_images.apply_async(kwargs={'task_id':task_id,'min_area':min_area,'destBucket':destBucket},queue='parallel')
                task.survey.images_processing = len(df)
                # task.survey.status='Processing'
                db.session.commit()

            # Order columns and remove superfluous ones
            df = df[['path','dataset','location','dataset_class','confidence','label']]

            # convert all labels to lower case
            df['label'] = df.apply(lambda x: x.label.lower(), axis=1)
            df['dataset_class'] = df.apply(lambda x: x.dataset_class.lower(), axis=1)

            # Add to output
            if outputDF is not None:
                outputDF = pd.concat([outputDF, df], ignore_index=True)
                outputDF.fillna(0, inplace=True)
            else:
                outputDF = df

        # Write output to S3
        user = task.survey.user.username
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            outputDF.to_csv(temp_file.name,index=False)
            GLOBALS.s3client.put_object(Bucket=destBucket,Key='classification_ds/'+user+'_classification_ds.csv',Body=temp_file)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def crop_survey_images(self,task_id,min_area,destBucket):
    '''
    Helper task for generate_training_csv that allows the image-cropping process to be parallelised.

    Parameters:
        task_id (int): The task you are using to crop the associated survey
        min_area (float): The minimum detection area to crop
        destBucket (str): The bucket where the cropped images must be stored
    '''

    try:
        task = db.session.query(Task).get(task_id)

        dimensionSQ = db.session.query(Detection.id.label('detID'),((Detection.right-Detection.left)*(Detection.bottom-Detection.top)).label('area')) \
                                .join(Image) \
                                .join(Camera) \
                                .join(Trapgroup) \
                                .filter(Trapgroup.survey_id==task.survey_id) \
                                .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS)) \
                                .filter(Detection.static == False) \
                                .filter(~Detection.status.in_(['deleted','hidden'])) \
                                .subquery()

        # we want to include all child-level labels
        labels = db.session.query(Label).filter(Label.task_id==task_id).filter(~Label.children.any()).all()

        df = pd.read_sql(db.session.query(\
                    Detection.id.label('detection_id'),\
                    Detection.score.label('confidence'),\
                    Image.id.label('image_id'),\
                    Image.filename.label('filename'),\
                    Camera.path.label('dirpath'),\
                    Trapgroup.tag.label('location'),\
                    Survey.name.label('dataset'),\
                    Label.description.label('label'))\
                    .join(Image,Detection.image_id==Image.id)\
                    .join(Camera,Camera.id==Image.camera_id)\
                    .join(Trapgroup,Trapgroup.id==Camera.trapgroup_id)\
                    .join(Survey,Survey.id==Trapgroup.survey_id)\
                    .join(Labelgroup,Labelgroup.detection_id==Detection.id)\
                    .join(Label,Labelgroup.labels)\
                    .join(dimensionSQ,dimensionSQ.c.detID==Detection.id)\
                    .filter(Labelgroup.task_id==task_id)\
                    .filter(Label.id.in_([r.id for r in labels]))\
                    .filter(dimensionSQ.c.area > min_area)\
                    .filter(or_(and_(Detection.source==model,Detection.score>Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
                    .filter(Detection.static == False)\
                    .filter(~Detection.status.in_(['deleted','hidden']))\
                    .statement,db.session.bind)

        # Drop detections
        df = df.drop_duplicates(subset=['detection_id'], keep=False)

        sourceBucket = task.survey.user.bucket+'-raw'

        results = []
        for chunk in chunker(df['image_id'].unique(),10000):
            results.append(batch_crops.apply_async(kwargs={'image_ids':chunk,'source':sourceBucket,'min_area':min_area,'destBucket':destBucket,'external':False,'update_image_info':False},queue='default'))

        # Using locking here as a workaround. Looks like celery result fetching is not threadsafe.
        # See https://github.com/celery/celery/issues/4480
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

        task.survey.images_processing = 0
        # task.survey.status='Ready'
        db.session.commit()

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True

@celery.task(bind=True,max_retries=29,ignore_result=True)
def generate_classification_ds(self,sourceBucket):
    '''Searches for all the classification_ds files in the source bucket, combines them, and uploades the result to the bucket.'''

    try:
        outputDF = None
        folders,filenames = list_all(sourceBucket,'classification_ds/')
        for filename in filenames:
            if filename != 'classification_ds.csv':
                with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
                    GLOBALS.s3client.download_file(Bucket=sourceBucket, Key='classification_ds/'+filename, Filename=temp_file.name)
                    df = pd.read_csv(temp_file.name)

                # Add to output
                if outputDF is not None:
                    outputDF = pd.concat([outputDF, df], ignore_index=True)
                    outputDF.fillna(0, inplace=True)
                else:
                    outputDF = df

        # Write output to S3
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            outputDF.to_csv(temp_file.name,index=False)
            GLOBALS.s3client.put_object(Bucket=sourceBucket,Key='classification_ds/classification_ds.csv',Body=temp_file)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True


@celery.task(bind=True,max_retries=29,ignore_result=True)
def generate_label_spec(self,sourceBucket,translations):
    '''
    Generates a label spec file for classifier training purposes based on the supplied translations. 
    Saves the resulting file in the source bucket.
    '''

    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.csv') as temp_file:
            GLOBALS.s3client.download_file(Bucket=sourceBucket, Key='classification_ds/classification_ds.csv', Filename=temp_file.name)
            df = pd.read_csv(temp_file.name)

        # Generate Label Spec
        label_spec = {}
        for label in translations:
            label_spec[label] = {'dataset_labels':{}}
            for dataset in df['dataset'].unique():
                label_spec[label]['dataset_labels'][dataset] = []
                labels = df[df['dataset']==dataset]['label'].unique()

                for translation in translations[label]:
                    if translation in labels:
                        label_spec[label]['dataset_labels'][dataset].append(translation)

        with tempfile.NamedTemporaryFile(delete=True, suffix='.json') as temp_file:
            temp_file.write(json.dumps(label_spec))
            GLOBALS.s3client.put_object(Bucket=sourceBucket,Key='label_spec.json',Body=temp_file)

        # Generate accompanying label index
        index = 0
        label_index = {}
        for label in translations:
            label_index[index] = label
            index += 1

        with tempfile.NamedTemporaryFile(delete=True, suffix='.json') as temp_file:
            temp_file.write(json.dumps(label_index))
            GLOBALS.s3client.put_object(Bucket=sourceBucket,Key='label_index.json',Body=temp_file)

    except Exception as exc:
        app.logger.info(' ')
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(traceback.format_exc())
        app.logger.info('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        app.logger.info(' ')
        self.retry(exc=exc, countdown= retryTime(self.request.retries))

    finally:
        db.session.remove()

    return True
