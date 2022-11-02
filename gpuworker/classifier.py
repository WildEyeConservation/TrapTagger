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

import json
import numpy as np
from PIL import Image,ImageOps
import torch
import torch.utils
import torchvision as tv
import tempfile
import boto3

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

model_name = 'efficientnet-b1'
model_path = 'classifier.pt'
num_workers = 0
batch_size = 200
img_size = params_dict[model_name][2]
s3client = boto3.client('s3')

with open('gpuworker/label_index.json', 'r') as f:
            categories = json.load(f)

def infer(batch):
    '''
    Runs species classification on the supplied batch of images. Returns a classification and associated confidence score for each detection ID.
    
        Parameters:
            batch (dict): Dictionary consisting of image urls, and their detections for processing.

        Returns:
            result (dict): detection-ID-keyed dictionary containing a classification and associated score.
    '''
    
    global model, device, classifier_init
    if classifier_init == False:
        print('Loading saved model')
        model = torch.jit.load('gpuworker/'+model_path)
        model, device, status = prep_device(model)
        print(status)

        classifier_init = True

    # create dataset
    if (len(batch['images'])==0) or (len(batch['detection_ids'])==0):
        print('Received empty batch. Returning empty response.')
        return {}
    else:
        print('Creating data loader...')
        try:
            loader = create_loader(batch,img_size,batch_size,num_workers)
        except:
            print('Failed to create data loader. Returning empty response.')
            return {}

        print('Running Classification...')
        try:
            result = run_epoch(model, loader, device=device, categories=categories)
            return result
        except:
            print('Failed to run classification. Returning empty response.')
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

def create_loader(batch,img_size,batch_size,num_workers):
    '''Returns either a SimpleDataset or a DownloadedDataset depending on the batch contents.'''

    transform = tv.transforms.Compose([
        # resizes smaller edge to img_size
        tv.transforms.Resize(img_size, interpolation=Image.BICUBIC),
        tv.transforms.CenterCrop(img_size),
        tv.transforms.ToTensor(),
        tv.transforms.Normalize(mean=MEANS, std=STDS, inplace=True)
    ])

    if type(batch['images'][next(iter(batch['images']))]) == str:
        detection_ids = batch['detection_ids']
        detections = batch['detections']
        images = batch['images']
        bucket = batch['bucket']
        dataset = SimpleDataset(detection_ids,detections,images,transform,bucket)
    else:
        dataset = DownloadedDataset(batch,transform)

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

        print('fetching {} from {}'.format(self.images[image_id],self.bucket))

        ###########Local Download appoach
        if image_id not in self.ims.keys():
            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                s3client.download_file(Bucket=self.bucket, Key=self.images[image_id], Filename=temp_file.name)
                print('Downloaded successfuly')
                img = Image.open(temp_file.name)
                print('Image opened')
            self.ims[image_id] = img
        else:
            img = self.ims[image_id]
            print('Image already exists locally.')

        ##########Blob approach
        # img = Image.open(BytesIO(base64.b64decode(self.images[image_id])))

        left = self.detections[detection_id]['left']
        right = self.detections[detection_id]['right']
        top = self.detections[detection_id]['top']
        bottom = self.detections[detection_id]['bottom']

        bbox = [left,top,(right-left),(bottom-top)]
        print('Cropping {}'.format(bbox))
        crop = crop_image(img, bbox)
        print('Cropped successfully!')

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
