'''
Copyright 2026

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


import torch
from PIL import Image, ImageOps, ImageFile
from ultralytics import YOLO
import boto3
import tempfile
import numpy as np

ImageFile.LOAD_TRUNCATED_IMAGES = True
s3client = boto3.client('s3')

classifier_init = False
model = None
model_path = 'yolo_classifier.pt'
batch_size = 100


def crop_image(img, bbox_norm):
    '''Crops the supplied image according to the normalised bounding box with the format [left,top,width,height].'''

    try:
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
    except:
        return False

    return crop


class SimpleYoloDataset(torch.utils.data.Dataset):
    """Very simple yolo dataset."""

    def __init__(self, detection_ids,
                 detections,
                 images,
                 bucket):
        """Creates a SimpleYoloDataset."""
        self.detection_ids = detection_ids
        self.detections = detections
        self.images = images
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
            try:
                with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                    s3client.download_file(Bucket=self.bucket, Key=self.images[image_id], Filename=temp_file.name)
                    print('Downloaded successfuly')
                    img = Image.open(temp_file.name)
                    print('Image opened')
            except:
                try:
                    splits = self.images[image_id].split('/')
                    splits[0] = splits[0]+'-comp'
                    newpath = '/'.join(splits)
                    with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                        s3client.download_file(Bucket=self.bucket, Key=newpath, Filename=temp_file.name)
                        print('Downloaded comp image successfuly')
                        img = Image.open(temp_file.name)
                        print('Image opened')
                except:
                    print('Failed to download image.')
                    return None,detection_id

            self.ims[image_id] = img
        else:
            img = self.ims[image_id]
            print('Image already exists locally.')

        detection = self.detections[detection_id]
        left = detection['left']
        right = detection['right']
        top = detection['top']
        bottom = detection['bottom']
        bbox = [left,top,(right-left),(bottom-top)]
        print('Cropping {}'.format(bbox))
        crop = crop_image(img, bbox)
        print('Cropped successfully!')

        if crop == False:
            return None,detection_id
        
        return crop, detection_id

    def __len__(self):
        return len(self.detection_ids)

def infer(batch):
    '''
    Runs species classification with yolo model on the supplied batch of images. Returns a classification and associated confidence score for each detection ID.
    
        Parameters:
            batch (dict): Dictionary consisting of image urls, and their detections for processing.

        Returns:
            result (dict): detection-ID-keyed dictionary containing a classification and associated score.
    '''
    global classifier_init
    global model

    if not classifier_init:
        print('Loading model from {}'.format(model_path))
        model = YOLO('yoloworker/' + model_path)
        classifier_init = True

    if len(batch['images']) == 0 or len(batch['detection_ids']) == 0:
        print("Empty batch received, returning empty result.")
        return {}

    # Create dataset and dataloader
    dataset = SimpleYoloDataset(batch['detection_ids'], batch['detections'], batch['images'], batch['bucket'])
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, collate_fn=collate_fn)

    result = {}

    for crops, det_ids in dataloader:
        if len(crops) == 0:
            continue

        # Run YOLOv11 classification (handles preprocessing + GPU batching)
        results_list = model.predict(crops, device='cuda', batch_size=len(crops), verbose=False)

        for i, res in enumerate(results_list):
            probs = res.probs.cpu().numpy()  # softmax probabilities
            class_idx = int(np.argmax(probs))
            score = float(probs[class_idx])
            detection_id = det_ids[i]
            result[detection_id] = {'classification': str(class_idx), 'score': str(score)}

    return result


def collate_fn(batch):
    batch = [x for x in batch if x[0] is not None and x[0] is not None]
    if len(batch) == 0:
        return [], []
    crops, det_ids = zip(*batch)
    return list(crops), list(det_ids)