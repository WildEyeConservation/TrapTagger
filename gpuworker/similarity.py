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
from PIL import Image
from segment_anything import sam_model_registry, SamPredictor
import numpy as np
import json
import torch
import torch.backends.cudnn as cudnn
import torchvision.transforms as transforms
import argparse
import time
import os
import utool as ut
import math

s3client = boto3.client('s3')


init_sam = False
init_pose = False
predictor = None
model = None

def get_keypoints(image_path, model):
    """
    Process a single image, return the model's output resized to the original image dimensions.

    Parameters:
    - image_path: path to the image file
    - model: a PyTorch model ready for inference

    Returns: The model's output resized to match the input image's dimensions.
    """
    image = Image.open(image_path).convert('RGB')

    transform = transforms.Compose([
        transforms.Resize((256, 256)),  # Adjust to your model's expected input size
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    image_tensor = transform(image).unsqueeze(0)
    model.eval()
    device = next(model.parameters()).device
    image_tensor = image_tensor.to(device)
    with torch.no_grad():
        output = model(image_tensor)

    return output


def get_flank(image_path: str) -> str:
    """
    Retrieves the flank information using ScarceNet Keypoint detection.
    Method:
    Returns one of: 'right' or 'left'.
    """
    output = get_keypoints(image_path, model)
    a = output[0].squeeze(0)
    image = np.array(Image.open(image_path).convert('RGB'))
    scale = [image.shape[1] / 64, image.shape[0] / 64]
    keypoints = np.array([[(a[i].argmax() - (a[i].argmax() // 64) * 64).cpu().numpy() * scale[0],
                           (a[i].argmax() // 64).cpu().numpy() * scale[1],
                           (a[i].max()).cpu().numpy()] for i in range(a.shape[0])])
    keypoints = {'left_eye': keypoints[0],
                 'right_eye': keypoints[1],
                 'nose': keypoints[2],
                 'neck_base': keypoints[3],
                 'tail_base': keypoints[4],
                 'left_hip_front': keypoints[5],
                 'left_knee_front': keypoints[6],
                 'left_foot_front': keypoints[7],
                 'right_hip_front': keypoints[8],
                 'right_knee_front': keypoints[9],
                 'right_foot_front': keypoints[10],
                 'left_hip_back': keypoints[11],
                 'left_knee_back': keypoints[12],
                 'left_foot_back': keypoints[13],
                 'right_hip_back': keypoints[14],
                 'right_knee_back': keypoints[15],
                 'right_foot_back': keypoints[16]}

    pairs = [
        ('neck_base', 'tail_base'),
        ('left_hip_front', 'right_hip_front'),
        ('left_hip_back', 'right_hip_back'),
        ('left_knee_front', 'right_knee_front'),
        ('left_knee_back', 'right_knee_back'),
        ('left_foot_front', 'right_foot_front'),
        ('left_foot_back', 'right_foot_back')
    ]

    visibility_scores = {'left': 0, 'right': 0}

    for left_kp, right_kp in pairs:
        if left_kp == 'neck_base' and right_kp == 'tail_base':
            visibility_scores['left'] += keypoints['tail_base'][0] - keypoints['neck_base'][0]
            front_x = np.array([keypoints['left_hip_front'][0], keypoints['right_hip_front'][0],
                                keypoints['left_knee_front'][0], keypoints['right_knee_front'][0],
                                keypoints['left_foot_front'][0], keypoints['right_foot_front'][0]])
            back_x = np.array([keypoints['left_hip_back'][0], keypoints['right_hip_back'][0],
                               keypoints['left_knee_back'][0], keypoints['right_knee_back'][0],
                               keypoints['left_foot_back'][0], keypoints['right_foot_back'][0]])
            visibility_scores['left'] += np.mean(back_x) - np.mean(front_x)
            continue

        visibility_scores['left'] += keypoints[left_kp][2]
        visibility_scores['right'] += keypoints[right_kp][2]

    visibility = 'ambiguous'
    if visibility_scores['left'] > visibility_scores['right']:
        visibility = 'left'
    elif visibility_scores['right'] > visibility_scores['left']:
        visibility = 'right'

    return visibility


def process_images(ibs,batch,sourceBucket,species,pose_only=False):
    """
    Segments the image using Segment Anything (SAM) - Meta AI research, from a bounding box prompt. Estimates the flank using ScarceNet Keypoint detection. Adds the 
    segmented image and the detection to the wbia database.
    Params:
        - batch (dict): the bacth of images to be segmented including their path, bbox_list, image_id and detection_id
        - sourceBucket (str): the source bucket of the images
        - species (str): the species of the images
        - pose_only (bool): if True, only the pose detection is performed
    Returns a dictionary containing the flank and the database ID (wbia) for each detection.
    """
    global predictor, model, init_sam, init_pose

    try:
        if not init_sam and not pose_only:
            # SAM initialization
            print('Initializing SAM')
            starttime = time.time()
            sam_checkpoint = "sam_vit_h_4b8939.pth"
            model_type = "vit_h"
            device = "cuda"
            sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
            sam.to(device=device)
            predictor = SamPredictor(sam)
            print('SAM initialized in {} seconds'.format(time.time() - starttime))
            init_sam = True

        if not init_pose:
            # Pose detection initialization
            print('Initializing Pose Detection')
            starttime = time.time()
            from lib.config import update_config
            from lib.config import cfg
            from lib.models.pose_hrnet_part import get_pose_net

            args = argparse.Namespace(cfg='ScarceNet/experiments/ap10k/hrnet/w32_256x192_adam_lr1e-3.yaml',
                                        opts=['OUTPUT_DIR', 'test', 'TEST.MODEL_FILE',
                                            'model_best.pth', 'MODEL.NAME',
                                            'pose_hrnet_part', 'GPUS', '[0,]'],
                                        modelDir='', logDir='', dataDir='', prevModelDir='', animalpose=True, vis=False)
            update_config(cfg, args)
            cudnn.benchmark = True
            torch.backends.cudnn.deterministic = False
            torch.backends.cudnn.enabled = True

            checkpoint = torch.load("model_best.pth")
            model = get_pose_net(cfg, is_train=False)

            model.load_state_dict(checkpoint['state_dict'], strict=True)
            model = torch.nn.DataParallel(model, device_ids=cfg.GPUS).cuda()
            print('Pose Detection initialized in {} seconds'.format(time.time() - starttime))
            init_pose = True

        imFolder = 'HS_images_' + species.replace(' ','_').lower()
        if not os.path.isdir(imFolder):
            os.mkdir(imFolder)

        if not pose_only:
            # Add species (use one species for all detections)
            global_species = 'Hyaena'
            species_nice_list = [global_species]
            species_text_list = [global_species.replace(' ','_').lower()]
            species_code_list = ['SH']
            species_ids = ibs.add_species(species_nice_list, species_text_list, species_code_list)
            hs_label = species_ids[0]

        detection_results = {}
        aid_list = []
        for image in batch:
            try:
                image_path = image['image_path']
                bbox_dict = image['bbox']
                image_id = image['image_id']
                detection_id = image['detection_id']
                with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                    print('Downloading {} from S3'.format(image_path))
                    s3client.download_file(Bucket=sourceBucket, Key=image_path, Filename=temp_file.name)
                    image_data = np.array(Image.open(temp_file.name))
                    h, w, _ = image_data.shape
                    x1, x2, y1, y2 = max(0, min(1, bbox_dict['left'])), max(0, min(1, bbox_dict['right'])), max(0, min(1, bbox_dict['top'])), max(0, min(1, bbox_dict['bottom']))
                    bbox = np.array([x1 * w, y1 * h, x2 * w, y2 * h])

                    if pose_only:
                        # Crop the image to the bounding box
                        cropped_image = Image.fromarray(image_data[int(y1 * h):int(y2 * h), int(x1 * w):int(x2 * w)])
                        filename = imFolder + '/' + str(detection_id) + '.jpg'
                        cropped_image.save(filename)
                    else:
                        print('Segmenting image')
                        starttime = time.time()
                        predictor.set_image(image_data)
                        masks, _, _ = predictor.predict(
                            point_coords=None,
                            point_labels=None,
                            box=bbox[None, :],
                            multimask_output=False,
                        )

                        h, w = masks[0].shape[-2:]
                        mask_image = masks[0].reshape(h, w, 1) * np.array([1., 1., 1.]).reshape(1, 1, -1)
                        segmented_image = (mask_image * image_data).astype('uint8')
                        segmented_image = Image.fromarray(segmented_image[int(y1 * h):int(y2 * h), int(x1 * w):int(x2 * w)])
                        print('Segmentation done in {} seconds'.format(time.time() - starttime))

                        #Save segmented image locally
                        filename = imFolder + '/' + str(detection_id) + '.jpg'
                        segmented_image.save(filename)

                    #Get flank from the segmented image
                    flank = get_flank(filename)
                    print('Get flank for detection_id: {} - {}'.format(detection_id, flank))
                    if flank == 'left':
                        flank = 'L'
                    elif flank == 'right':
                        flank = 'R'
                    else: #ambiguous
                        flank = 'A'

                    if pose_only:
                        detection_results[detection_id] = {
                            'flank': flank
                        }
                    else:
                        #Add image and annotation to the wbia database
                        # gid = ibs.add_images([ut.unixpath(ut.grab_test_imgpath(filename))], auto_localize=False)[0]
                        ut_filename = [ut.unixpath(ut.grab_test_imgpath(filename))]
                        gid = ibs.add_images(ut_filename, auto_localize=False,ensure_loadable=False,ensure_exif=False)[0] # The ensure_loadable and ensure_exif flags are set to False to avoid errors when loading the image (if the image already exist in db but from a differnt path, it will throw an error)
                        ibs.set_image_uris([gid], ut_filename) # Set the image uri to the new path 
                        ibs.set_image_uris_original([gid], ut_filename, overwrite=True)

                        # Annotations
                        left = 0
                        right = 1
                        top = 0
                        bottom = 1
                        imWidth = ibs.get_image_widths(gid)
                        imHeight = ibs.get_image_heights(gid)
                        w = math.floor(imWidth*(right-left))
                        h = math.floor(imHeight*(bottom-top))
                        x = math.floor(imWidth*left)
                        y = math.floor(imHeight*top)

                        aids = ibs.add_annots([gid],bbox_list=[[x, y, w, h]],species_rowid_list=[hs_label])
                        aid = aids[0]
                        aid_list.append(aid)

                        print('Added segmented image and detection (annotation) to the wbia database. Det_id: {}, gid: {} aid: {}'.format(detection_id, gid, aid))

                        detection_results[detection_id] = {
                            'flank': flank,
                            'aid': aid,
                            'gid': gid
                        }
                    
            except Exception as e:
                print('Error processing image: {}'.format(e))
                if 'detection_id' in image and image['detection_id'] in detection_results:
                    del detection_results[image['detection_id']]

        if not pose_only:
            # Calculate image kpts and vecs for hotspotter (automatically done by wbia and added to the database)
            print('Calculating image keypoints and vectors')
            starttime = time.time()
            qreq_ = ibs.new_query_request(aid_list, aid_list)
            qreq_.lazy_preload(verbose=True)
            print('Image keypoints and vectors calculated in {} seconds'.format(time.time() - starttime))

    except:
        print('Error processing images')	
        detection_results = {}


    return detection_results


