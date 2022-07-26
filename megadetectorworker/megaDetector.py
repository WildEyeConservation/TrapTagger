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

import os
import json
import numpy as np
from PIL import Image,ImageOps
from celery import Celery
from celery.signals import celeryd_after_setup
import torch
import torch.utils
import torchvision as tv
# from torchvision.datasets.folder import default_loader
import tempfile
import boto3
import requests
import ct_utils
# import base64
# from io import BytesIO

BASE = "/data"
REDIS_IP = os.environ.get('REDIS_IP') or '127.0.0.1'
app = Celery('megaDetector', broker='redis://'+REDIS_IP,backend='redis://'+REDIS_IP,broker_transport_options={'visibility_timeout': 86400},result_expires=86400,task_acks_late=True)
init=False
workername="default"
model_name = 'efficientnet-b1'
model_path = 'classifier.pt'
classifier_init = False
s3client = boto3.client('s3')

# mean/std values from https://pytorch.org/docs/stable/torchvision/models.html
MEANS = np.asarray([0.485, 0.456, 0.406])
STDS = np.asarray([0.229, 0.224, 0.225])

params_dict = {
    # Coefficients:   width,depth,res,dropout
    'efficientnet-b0': (1.0, 1.0, 224, 0.2),
    'efficientnet-b1': (1.0, 1.1, 240, 0.2),
    'efficientnet-b2': (1.1, 1.2, 260, 0.3),
    'efficientnet-b3': (1.2, 1.4, 300, 0.3),
    'efficientnet-b4': (1.4, 1.8, 380, 0.4),
    'efficientnet-b5': (1.6, 2.2, 456, 0.4),
    'efficientnet-b6': (1.8, 2.6, 528, 0.5),
    'efficientnet-b7': (2.0, 3.1, 600, 0.5),
    'efficientnet-b8': (2.2, 3.6, 672, 0.5),
    'efficientnet-l2': (4.3, 5.3, 800, 0.5),
}

detectors = {
    'MDv4': {'filename':"megadetectorworker/md_v4.1.0.pb"},
    'MDv5a': {'filename':"md_v5a.0.0.pt"},
    'MDv5b': {'filename':"md_v5b.0.0.pt"}
}

@celeryd_after_setup.connect
def setup_direct_queue(sender, instance, **kwargs):
    '''Sets the global workername variable, allowing the source of results to be recorded.'''
    global workername
    print("Workername detected as {}".format(sender))
    workername=sender

@app.task()
def infer(batch,sourceBucket,external,model):
    '''
    Runs MegaDetector on the supplied batch of images, returning all detections with a score greater than 0.05. 

        Parameters:
            batch (list): A batch of image keys to be processed.
            sourceBucket (str): The image source - base URL if external, S3 bucket otherwise.
            external (bool): Whether the images are external to S3.
            model (str): The detector to use

        Returns:
            results (list): A list of detections for each image in the batch
    '''

    try:
        print('Recieved batch of {} images.'.format(len(batch)))
        global init,detector #,detection_graph,image_tensor,box,score,clss,tf_session
        if not(init):
            print('Initialising')
            if detectors[model]['filename'].endswith('.pb'):
                from detection.run_tf_detector import TFDetector
                detector = TFDetector(detectors[model]['filename'])
            elif detectors[model]['filename'].endswith('.pt'):
                from detection.pytorch_detector import PTDetector
                detector = PTDetector(detectors[model]['filename'])
            init=True

        if '5' in model:
            results = []
            for image in batch:
                try:
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                        if external:
                            print('Downloading {} from external source.'.format(image))
                            attempts = 0
                            retry = True
                            while retry and (attempts < 10):
                                attempts += 1
                                try:
                                    response = requests.get(sourceBucket+'/'+image, timeout=30)
                                    assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                                    retry = False
                                except:
                                    retry = True
                            with open(temp_file.name, 'wb') as handler:
                                handler.write(response.content)

                        else:
                            print('Downloading {} from S3'.format(image))
                            s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)

                        print('Done')
                        img = Image.open(temp_file.name)

                    print('Generating detections...')
                    result = detector.generate_detections_one_image(img, image, detection_threshold=0.05)

                    detections=[]
                    for detection in result['detections']:
                        bbox = ct_utils.convert_xywh_to_tf(detection['bbox'])
                        detections.append(
                                    {'top':float(bbox[0]),
                                    'left':float(bbox[1]),
                                    'bottom':float(bbox[2]),
                                    'right':float(bbox[3]),
                                    'category':int(detection['category']),
                                    'score': float(detection['conf']),
                                    'source' : model}
                        )

                    if len(detections)==0:
                        print('No detections found...')
                        detections.append( {'top':0.0,
                                            'left':0.0,
                                            'bottom':0.0,
                                            'right':0.0,
                                            'category': 0,
                                            'score': 0.0,
                                            'source' : model})
                
                except:
                    print('Failed to process image {}'.format(image))
                    detections=[{'top':0.0,
                                            'left':0.0,
                                            'bottom':0.0,
                                            'right':0.0,
                                            'category': 0,
                                            'score': 0.0,
                                            'source' : 'error'}]
                
                results.append(detections)

        elif '4' in model:
            ######Local Download
            imstack = []
            for image in batch:
                try:
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                        if external:
                            print('Downloading {} from external source.'.format(image))
                            attempts = 0
                            retry = True
                            while retry and (attempts < 10):
                                attempts += 1
                                try:
                                    response = requests.get(sourceBucket+'/'+image, timeout=30)
                                    assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                                    retry = False
                                except:
                                    retry = True
                            with open(temp_file.name, 'wb') as handler:
                                handler.write(response.content)

                        else:
                            print('Downloading {} from S3'.format(image))
                            s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)

                        print('Done')
                        imstack.append(np.asarray(Image.open(temp_file.name).resize((1024, 600)),np.uint8))
                    
                    print('Added to batch')
                
                except:
                    print('Failed to retrieve image {}'.format(image))
                
            imstack = np.stack(imstack)
            
            ######Blob Approach
            # imstack = np.stack([np.asarray(Image.open(BytesIO(base64.b64decode(b64blob))).resize((1024, 600)),np.uint8) for b64blob in batch])
            
            print('Processing...')
            (box_np, score_np, clss_np) = detector.tf_session.run([detector.box_tensor, detector.score_tensor, detector.class_tensor],feed_dict={detector.image_tensor: imstack})
            print('Done')

            results=[]
            print('Retrieving results...')
            for i,fullname in enumerate(batch):
                print('Next image')
                detections=[]
                for j, scr in enumerate(score_np[i, :]):
                    if scr < 0.05:
                        break
                    detections.append( {'top':float(box_np[i, j, 0]),
                                        'left':float(box_np[i, j, 1]),
                                        'bottom':float(box_np[i, j, 2]),
                                        'right':float(box_np[i, j, 3]),
                                        'category':int(clss_np[i, j]),
                                        'score': float(score_np[i, j]),
                                        'source' : model})
                if len(detections)==0:
                    print('No detections found...')
                    detections.append( {'top':0.0,
                                        'left':0.0,
                                        'bottom':0.0,
                                        'right':0.0,
                                        'category': 0,
                                        'score': 0.0,
                                        'source' : model})
                results.append(detections)
        print('Finished batch')

    except:
        print('Error with batch... returning empty set of detections.')
        results=[]
        for n in range(len(batch)):
            detections=[{'top':0.0,
                                    'left':0.0,
                                    'bottom':0.0,
                                    'right':0.0,
                                    'category': 0,
                                    'score': 0.0,
                                    'source' : 'error'}]
            results.append(detections)
    
    return results

@app.task()
def inferAndClassify(batch):
    '''
    Runs both detection and classification on a batch of images for the API.

        Parameters:
            batch (list): List of image urls to process.

        Returns:
            output (dict): The detections and their classifications in a url-keyed dictionary
    '''

    try:
        global init,detector,detection_graph,image_tensor,box,score,clss,tf_session
        global num_workers, batch_size, img_size, categories, model, device, classifier_init
        
        if not(init):
            print('Initialising Detector')
            from detection.run_tf_detector import TFDetector
            detector = TFDetector("megadetectorworker/md_v4.1.0.pb")
            init=True
        print('Detector Initialised')

        if classifier_init == False:
            print('Initialising Classifier')
            num_workers = 0
            batch_size = 200
            img_size = params_dict[model_name][2]
            
            with open('megadetectorworker/label_index.json', 'r') as f:
                categories = json.load(f)

            # create model
            print('Loading saved model')
            model = torch.jit.load('megadetectorworker/'+model_path)
            model, device, status = prep_device(model)
            print(status)

            classifier_init = True
        print('Classifier Initialised')
    
        output_batch = []
        image_detections = {}
        images = {}
        for imageURL in batch:
            image_detections[imageURL] = []
            try:
                with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                    attempts = 0
                    retry = True
                    while retry and (attempts < 2):
                        attempts += 1
                        try:
                            response = requests.get(imageURL, timeout=5)
                            assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                            retry = False
                        except:
                            retry = True
                    with open(temp_file.name, 'wb') as handler:
                        handler.write(response.content)
                    image = Image.open(temp_file.name)
                output_batch.append(np.asarray(image.resize((1024, 600)), np.uint8))
                images[imageURL] = image
            except:
                print('Failed to retrieve image {}'.format(imageURL))
        
        print('Detecting...')
        (box_np, score_np, clss_np) = detector.tf_session.run([detector.box_tensor, detector.score_tensor, detector.class_tensor],feed_dict={detector.image_tensor: np.stack(output_batch)})
        print('Detection Complete')
        
        index = 0
        detections = {}
        for i,image_id in enumerate(images):
            for j, scr in enumerate(score_np[i, :]):
                if scr < 0.8:
                    break
                detection_id = str(index)
                detections[detection_id] = {'top':float(box_np[i, j, 0]),
                                            'left':float(box_np[i, j, 1]),
                                            'bottom':float(box_np[i, j, 2]),
                                            'right':float(box_np[i, j, 3]),
                                            'category':int(clss_np[i, j]),
                                            'score': float(score_np[i, j]),
                                            'image_id': image_id}
                image_detections[image_id].append(detection_id)
                index += 1

        inferred_batch = {'images': images, 'detections': detections}

        print('Creating data loader')
        loader = create_loader(inferred_batch,img_size,batch_size,num_workers,True)
        print('Classifying...')
        result = run_epoch(model, loader, device=device, categories=categories)
        print('Classification Complete')

        output = []
        for url in batch:
            image_output = {'url': url, 'detections':[]}
            for detID in image_detections[url]:
                image_output['detections'].append({
                    'top': detections[detID]['top'],
                    'left': detections[detID]['left'],
                    'bottom': detections[detID]['bottom'],
                    'right': detections[detID]['right'],
                    'classification': result[detID]['classification'],
                    'score': float(result[detID]['score'])
                })
            output.append(image_output)

        print('Result complete: {}'.format(output))
        return output
    except:
        return 'Error'

@app.task()
def classify(batch):
    '''
    Runs species classification on the supplied batch of images. Returns a classification and associated confidence score for each detection ID.
    
        Parameters:
            batch (dict): Dictionary consisting of image urls, and their detections for processing.

        Returns:
            result (dict): detection-ID-keyed dictionary containing a classification and associated score.
    '''
    
    global num_workers, batch_size, img_size, categories, model, device, classifier_init
    if classifier_init == False:
        num_workers = 0
        batch_size = 200
        img_size = params_dict[model_name][2]
        
        with open('megadetectorworker/label_index.json', 'r') as f:
            categories = json.load(f)

        # create model
        print('Loading saved model')
        model = torch.jit.load('megadetectorworker/'+model_path)
        model, device, status = prep_device(model)
        print(status)

        classifier_init = True

    # create dataset
    if (len(batch['images'])==0) or (len(batch['detection_ids'])==0):
        return {}
    else:
        print('Creating data loader')
        try:
            loader = create_loader(batch,img_size,batch_size,num_workers,False)
            result = run_epoch(model, loader, device=device, categories=categories)
            return result
        except:
            return {}

def run_epoch(model, loader, device, categories):
    '''
    Processes the data in the supplied data loader using the specified classifier model on the specified device. 
    Returns a dictionary of classifications and score for each detection ID.
    '''

    model.eval()
    result = {}
    with torch.no_grad():
        for inputs, img_files in loader:
            try:
                inputs = inputs.to(device, non_blocking=True)
                outputs = model(inputs)
                probs = torch.nn.functional.softmax(outputs, dim=1).cpu().numpy()

                for n in range(len(probs)):
                    index = np.argmax(probs[n])
                    score = str(probs[n][index])
                    classification = categories[str(index)]
                    detection_id = img_files[n]
                    result[detection_id] = {'score': score, 'classification': classification}
                    print('{}: {}@{}'.format(detection_id,classification,score))
            except:
                pass

    return result

def create_loader(batch,img_size,batch_size,num_workers,downloaded):
    '''Returns either a SimpleDataset or a DownloadedDataset depending on the downloaded status variable.'''

    transform = tv.transforms.Compose([
        # resizes smaller edge to img_size
        tv.transforms.Resize(img_size, interpolation=Image.BICUBIC),
        tv.transforms.CenterCrop(img_size),
        tv.transforms.ToTensor(),
        tv.transforms.Normalize(mean=MEANS, std=STDS, inplace=True)
    ])

    if downloaded:
        dataset = DownloadedDataset(batch,transform)
    else:
        detection_ids = batch['detection_ids']
        detections = batch['detections']
        images = batch['images']
        bucket = batch['bucket']
        dataset = SimpleDataset(detection_ids,detections,images,transform,bucket)

    assert len(dataset) > 0
    loader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, num_workers=num_workers,pin_memory=True)
    return loader

class SimpleDataset(torch.utils.data.Dataset):
    """Very simple dataset."""

    def __init__(self, detection_ids,
                 detections,
                 images,
                 transform,
                 bucket):
        """Creates a SimpleDataset."""
        self.detection_ids = detection_ids
        self.detections = detections
        self.images = images
        self.transform = transform
        self.bucket = bucket
        self.ims = {}

    def __getitem__(self, index):
        """
        Returns: tuple, (crop, detection_id)
        """
        detection_id = self.detection_ids[index]
        image_id = self.detections[detection_id]['image_id']

        ###########Local Download appoach
        if image_id not in self.ims.keys():
            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                s3client.download_file(Bucket=self.bucket, Key=self.images[image_id], Filename=temp_file.name)
                img = Image.open(temp_file.name)
            self.ims[image_id] = img
        else:
            img = self.ims[image_id]

        ##########Blob approach
        # img = Image.open(BytesIO(base64.b64decode(self.images[image_id])))

        left = self.detections[detection_id]['left']
        right = self.detections[detection_id]['right']
        top = self.detections[detection_id]['top']
        bottom = self.detections[detection_id]['bottom']

        bbox = [left,top,(right-left),(bottom-top)]
        crop = crop_image(img, bbox)

        if crop == False:
            return None,detection_id
        
        crop = self.transform(crop)
        return crop, detection_id

    def __len__(self):
        return len(self.detection_ids)

class DownloadedDataset(torch.utils.data.Dataset):
    '''A simple dataset that uses already-downloaded images for efficiency.'''

    def __init__(self, batch, transform):
        '''Creates a DownloadedDataset.'''
        self.transform = transform
        self.batch = batch

    def __getitem__(self, index):
        '''Returns: tuple, (crop, index)'''
        detection = self.batch['detections'][str(index)]
        img = self.batch['images'][detection['image_id']]

        left = detection['left']
        right = detection['right']
        top = detection['top']
        bottom = detection['bottom']

        bbox = [left,top,(right-left),(bottom-top)]
        crop = crop_image(img, bbox)
        crop = self.transform(crop)
        
        return crop, str(index)

    def __len__(self):
        return len(self.batch['detections'].keys())

def crop_image(img, bbox_norm):
    '''Crops the supplied image according to the normalised bounding box with the format [left,top,width,height].'''

    img_w, img_h = img.size
    xmin = int(bbox_norm[0] * img_w)
    ymin = int(bbox_norm[1] * img_h)
    box_w = int(bbox_norm[2] * img_w)
    box_h = int(bbox_norm[3] * img_h)

    # expand box width or height to be square, but limit to img size
    box_size = max(box_w, box_h)
    xmin = max(0, min(
        xmin - int((box_size - box_w) / 2),
        img_w - box_w))
    ymin = max(0, min(
        ymin - int((box_size - box_h) / 2),
        img_h - box_h))
    box_w = min(img_w, box_size)
    box_h = min(img_h, box_size)

    if box_w == 0 or box_h == 0:
        return False

    # Image.crop() takes box=[left, upper, right, lower]
    crop = img.crop(box=[xmin, ymin, xmin + box_w, ymin + box_h])

    if box_w != box_h:
        # pad to square using 0s
        crop = ImageOps.pad(crop, size=(box_size, box_size), color=0)

    return crop

def prep_device(model: torch.nn.Module):
    """
    Place model on appropriate device.

    Args:
        model: torch.nn.Module, not already wrapped with DataParallel

    Returns:
        model: torch.nn.Module, model placed on <device>, wrapped with
            DataParallel if more than 1 GPU is found
        device: torch.device, 'cuda:0' if GPU is found, otherwise 'cpu'
    """
    # detect GPU, use all if available
    status = 'torch.version.cuda: {}.'.format(torch.version.cuda)
    if torch.cuda.is_available():
        device = torch.device('cuda:0')
        torch.backends.cudnn.benchmark = True
        device_ids = list(range(torch.cuda.device_count()))
        status += ' Using GPU. {} devices detected.'.format(len(device_ids))
        if len(device_ids) > 1:
            model = torch.nn.DataParallel(model, device_ids=device_ids)
    else:
        status += ' Using CPU.'
        device = torch.device('cpu')
    model.to(device)  # in-place
    return model, device, status
