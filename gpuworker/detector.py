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

import tempfile
import boto3
import requests
from botocore.exceptions import ClientError

detector=None
s3client = boto3.client('s3')

detectors = {
    'MDv4': {'filename':"MDV4"}, #this will downloaded if needed
    'MDv5a': {'filename':"md_v5a.0.1.pt"},
    'MDv5b': {'filename':"md_v5b.0.1.pt"},
    'MDv1000redwood': {'filename':"md_v1000.0.0-redwood.pt"}
}

def convert_xywh_to_tlbr(bbox):
    """Converts an xywh bounding box to an top, left, bottom, right box."""
    x_min, y_min, width_of_box, height_of_box = bbox
    x_max = x_min + width_of_box
    y_max = y_min + height_of_box
    return [y_min, x_min, y_max, x_max]

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
        from megadetector.visualization import visualization_utils as vis_utils
        global detector
        
        if detector==None:
            print('Initialising')
            from megadetector.detection import run_detector
            detector = run_detector.load_detector(detectors[model]['filename'])

        if pass_images: images = {}

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
                        try:
                            print('Downloading {} from S3'.format(image))
                            url = image
                            s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)
                        except ClientError as e:
                            if e.response['Error']['Code'] == 'InvalidObjectState':
                                print('Object {} is not accessible'.format(image))
                                detections=[{'top':0.0,
                                        'left':0.0,
                                        'bottom':0.0,
                                        'right':0.0,
                                        'category': 0,
                                        'score': 0.0,
                                        'status': 'archive',
                                        'source' : 'error'}]
                            else:
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
                            continue

                    print('Done')
                    img = vis_utils.load_image(temp_file.name)
                    if pass_images: images[url] = img

                print('Generating detections...')
                result = detector.generate_detections_one_image(img, image, detection_threshold=threshold)

                detections=[]
                for detection in result['detections']:
                    bbox = convert_xywh_to_tlbr(detection['bbox'])
                    detections.append(
                                {'top':max(0.0, min(1.0, float(bbox[0]))),
                                'left':max(0.0, min(1.0, float(bbox[1]))),
                                'bottom':max(0.0, min(1.0, float(bbox[2]))),
                                'right':max(0.0, min(1.0, float(bbox[3]))),
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
                                    'status': 'active',
                                    'source' : 'error'}]
            results.append(detections)
    
    if pass_images:
        return results, images
    else:
        return results