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

from flask.globals import request
from locust import HttpUser, TaskSet, task, between
from config import Config
from random import randrange
import logging
import time
import warnings
warnings.filterwarnings("ignore")
ORGANISATION_ID = '1'
LABEL_ID = 1

class TagBatch(TaskSet):
    '''
    Batch-tagging class for locust. Emulates a user tagging by taking a job from a randomly assigned active task, recieves clusters, 
    and starts assigning the specified label to each.
    '''

    wait_time = between(1,2)
    host = 'https://'+Config.DNS
    
    def on_start(self):
        '''Initiales the tagging of a batch be getting a job, and initialises all variables.'''

        self.username = self.client.get('/get_username').json()
        reply = self.client.get('/get_available_task/'+ORGANISATION_ID).json()
        if reply == 'inactive':
            logging.info('{}: No tasks launched. Stopping.'.format(self.username))
            # self.environment.runner.quit()
            time.sleep(36000)
        else:
            logging.info('Received task {}'.format(reply))
        self.task_id = reply
        self.label_id = LABEL_ID
        self.client.verify = False
        reply = self.client.get('/takeJob/'+str(self.task_id), name="/takeJob").json()
        if reply['status'] == 'success':
            self.client.get(reply['code'], name="/dotask")
            self.clusters = []
            self.clisterIdList = []
            self.clusterIndex = 0
            self.call_count = 0
            self.awaiting_clusters = False
            self.ping()
            self.update_clusters()
        elif reply['status'] == 'inactive':
            logging.info('{}: Task {} finished. Stopping.'.format(self.username,self.task_id))
            # self.environment.runner.quit()
            time.sleep(36000)
        else:
            logging.info('{}: No job available for task {}. Sleeping.'.format(self.username,self.task_id))
            time.sleep(30)
            self.interrupt()

    def update_clusters(self):
        '''Requests more clusters from the server if the user is getting close to the end of their queue.'''

        required = 5-(len(self.clusters)-(self.clusterIndex+1))
        if (required > 0) and (not self.awaiting_clusters):
                self.awaiting_clusters = True
                reply = self.client.get('/getCluster?task=0&reqId='+str(randrange(100000)), name="/getCluster")
                try:
                    reply = reply.json()
                    if 'info' in reply.keys():
                        newClusters = reply['info']
                        for newCluster in newClusters:
                            if (newCluster['id'] not in self.clisterIdList) or (str(newCluster['id']) == '-101'):
                                self.clisterIdList.append(newCluster['id'])
                                self.clusters.append(newCluster)
                        self.awaiting_clusters = False
                    elif 'redirect' in reply.keys():
                        logging.info('{}: Batch done!'.format(self.username))
                        self.client.get(reply['redirect'])
                        self.interrupt()
                    else:
                        logging.info('{}: Unexpected /getCluster response: {}'.format(self.username,reply))
                        self.awaiting_clusters = False
                except:
                    logging.info('{}: Unexpected /getCluster response: {}'.format(self.username,reply))
                    self.awaiting_clusters = False

    def ping(self):
        '''Pings the server to let it know the user is active.'''
        self.client.get('/ping')

    @task()
    def label_cluster(self):
        '''Labels the next cluster. Updates the cluster queue and pings the server every now and then.'''

        self.call_count += 1
        if (self.call_count % 3) == 0:
            self.update_clusters()
        if (self.call_count % 20) == 0:
            self.ping()
        if self.clusterIndex < len(self.clusters):
            if self.clusters[self.clusterIndex]['id'] == '-99':
                logging.info('{}: -99 encountered.'.format(self.username))
            elif self.clusters[self.clusterIndex]['id'] == '-101':
                logging.info('{}: Batch done!'.format(self.username))
                self.client.get('/done')
                self.interrupt()
            else:
                self.client.post(
                    "/assignLabel/" + str(self.clusters[self.clusterIndex]['id']),
                    data={"labels": str([self.label_id])},
                    name="/assignLabel"
                )
            self.clusterIndex += 1
        else:
            logging.info('{}: Failed to assign label: no clusters available.'.format(self.username))


class Tagger(HttpUser):
    '''The user class emulatting somebody tagging clusters.'''
    wait_time = between(15,30)
    host = 'https://'+Config.DNS

    def on_start(self):
        '''Requests a user, and logs in.'''
        self.client.verify = False
        self.client.post('/load_login/'+ORGANISATION_ID)

    tasks = {
        TagBatch: 1
    }
