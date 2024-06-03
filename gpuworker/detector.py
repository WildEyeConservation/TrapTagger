'''
Copyright 2023

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

import numpy as np
from PIL import Image
import tempfile
import boto3
import requests

init=False
detector=None
ct_utils=None
s3client = boto3.client('s3')

detectors = {
    'MDv4': {'filename':"gpuworker/md_v4.1.0.pb"},
    'MDv5a': {'filename':"md_v5a.0.0.pt"},
    'MDv5b': {'filename':"md_v5b.0.0.pt"}
}

def infer(batch,sourceBucket,external,model,threshold=0.05,pass_images=False):
    '''
    Runs MegaDetector on the supplied batch of images, returning all detections with a score greater than the supplied threshold. 

        Parameters:
            batch (list): A batch of image keys to be processed.
            sourceBucket (str): The image source - base URL if external, S3 bucket otherwise.
            external (bool): Whether the images are external to S3.
            model (str): The detector to use
            threshold (float): The minimum detection threshold to return detections for
            pass_images (bool): Whether to pass on the image objects for classification

        Returns:
            results (list): A list of detections for each image in the batch
    '''

    try:
        print('Recieved batch of {} images.'.format(len(batch)))
        global init,detector,ct_utils
        if not(init):
            print('Initialising')
            import ct_utils
            if detectors[model]['filename'].endswith('.pb'):
                from detection.run_tf_detector import TFDetector
                detector = TFDetector(detectors[model]['filename'])
            elif detectors[model]['filename'].endswith('.pt'):
                from detection.pytorch_detector import PTDetector
                detector = PTDetector(detectors[model]['filename'])
            init=True

        if pass_images: images = {}

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
                                    if sourceBucket!='':
                                        url = sourceBucket+'/'+image
                                    else:
                                        url = image
                                    response = requests.get(url, timeout=30)
                                    assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                                    retry = False
                                except:
                                    retry = True
                            with open(temp_file.name, 'wb') as handler:
                                handler.write(response.content)

                        else:
                            print('Downloading {} from S3'.format(image))
                            url = image
                            s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)

                        print('Done')
                        img = Image.open(temp_file.name)
                        if pass_images: images[url] = img

                    print('Generating detections...')
                    result = detector.generate_detections_one_image(img, image, detection_threshold=threshold)

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
                                    'status': 'active',
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
                                            'status': 'active',
                                            'source' : model})
                
                except:
                    print('Failed to process image {}'.format(image))
                    detections=[{'top':0.0,
                                            'left':0.0,
                                            'bottom':0.0,
                                            'right':0.0,
                                            'category': 0,
                                            'score': 0.0,
                                            'status': 'active',
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
                                    if sourceBucket!='':
                                        url = sourceBucket+'/'+image
                                    else:
                                        url = image
                                    response = requests.get(url, timeout=30)
                                    assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                                    retry = False
                                except:
                                    retry = True
                            with open(temp_file.name, 'wb') as handler:
                                handler.write(response.content)

                        else:
                            print('Downloading {} from S3'.format(image))
                            url = image
                            s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)

                        print('Done')
                        img = Image.open(temp_file.name)
                        if pass_images: images[url] = img
                        imstack.append(np.asarray(img.resize((1024, 600)),np.uint8))
                    
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
                    if scr < threshold:
                        break
                    detections.append( {'top':float(box_np[i, j, 0]),
                                        'left':float(box_np[i, j, 1]),
                                        'bottom':float(box_np[i, j, 2]),
                                        'right':float(box_np[i, j, 3]),
                                        'category':int(clss_np[i, j]),
                                        'score': float(score_np[i, j]),
                                        'status': 'active',
                                        'source' : model})
                if len(detections)==0:
                    print('No detections found...')
                    detections.append( {'top':0.0,
                                        'left':0.0,
                                        'bottom':0.0,
                                        'right':0.0,
                                        'category': 0,
                                        'score': 0.0,
                                        'status': 'active',
                                        'source' : model})
                results.append(detections)
        print('Finished batch')

    except Exception as e:
        print('Error with batch... returning empty set of detections.')
        print(e)
        results=[]
        for n in range(len(batch)):
            detections=[{'top':0.0,
                                    'left':0.0,
                                    'bottom':0.0,
                                    'right':0.0,
                                    'category': 0,
                                    'score': 0.0,
                                    'status': 'active',
                                    'source' : 'error'}]
            results.append(detections)
    
    if pass_images:
        return results, images
    else:
        return results