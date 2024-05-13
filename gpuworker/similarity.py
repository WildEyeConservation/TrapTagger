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
# import argparse
# from ScarceNet.lib.config import update_config
# from ScarceNet.lib.config import cfg
# from ScarceNet.lib.models.pose_hrnet_part import get_pose_net

s3client = boto3.client('s3')

init = False
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


def segment_images(batch,sourceBucket):
    """
    Segments the image using Segment Anything (SAM) - Meta AI research, from a bounding box prompt.
    Params:
        - batch (dict): the bacth of images to be segmented including their path, bbox_list, image_id.
        - sourceBucket (str): the source bucket of the images
    Returns the filename in the same folder as where this function is executed from.
    """
    global predictor, init, model

    if not init:
        print('Initializing SAM and Pose Detection models')
        # SAM initialization
        sam_checkpoint = "sam_vit_h_4b8939.pth"
        model_type = "vit_h"
        device = "cuda"
        sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
        sam.to(device=device)
        predictor = SamPredictor(sam)

        # # Pose detection initialization
        # # args = argparse.Namespace(cfg='ScarceNet/experiments/ap10k/hrnet/w32_256x192_adam_lr1e-3.yaml',
        # #                             opts=['OUTPUT_DIR', 'test', 'TEST.MODEL_FILE',
        # #                                 'ScarceNet/output/output_part25_updatev2/model_best.pth', 'MODEL.NAME',
        # #                                 'pose_hrnet_part', 'GPUS', '[0,]'],
        # #                             modelDir='', logDir='', dataDir='', prevModelDir='', animalpose=True, vis=False)
        # args = argparse.Namespace(cfg='ScarceNet/experiments/ap10k/hrnet/w32_256x192_adam_lr1e-3.yaml',
        #                             opts=['OUTPUT_DIR', 'test', 'TEST.MODEL_FILE',
        #                                 'model_best.pth', 'MODEL.NAME',
        #                                 'pose_hrnet_part', 'GPUS', '[0,]'],
        #                             modelDir='', logDir='', dataDir='', prevModelDir='', animalpose=True, vis=False)
        # update_config(cfg, args)
        # cudnn.benchmark = True
        # torch.backends.cudnn.deterministic = False
        # torch.backends.cudnn.enabled = True

        # # checkpoint = torch.load("ScarceNet/output/output_part25_updatev2/model_best.pth")
        # checkpoint = torch.load("model_best.pth")
        # model = get_pose_net(cfg, is_train=False)

        # model.load_state_dict(checkpoint['state_dict'], strict=True)
        # model = torch.nn.DataParallel(model, device_ids=cfg.GPUS).cuda()

        init = True

    segmented_images = {}
    detection_flanks = {}
    for image in batch:
        image_path = image['image_path']
        bbox_dict = image['bbox']
        image_id = image['image_id']
        detection_id = image['detection_id']
        with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
            print('Downloading {} from S3'.format(image_path))
            s3client.download_file(Bucket=sourceBucket, Key=image_path, Filename=temp_file.name)
            image_data = np.array(Image.open(temp_file.name))
            h, w, _ = image_data.shape
            x1, x2, y1, y2 = bbox_dict['left'], bbox_dict['right'], bbox_dict['top'], bbox_dict['bottom']
            bbox = np.array([x1 * w, y1 * h, x2 * w, y2 * h])
            print('Segmenting image')
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
            segmented_images[detection_id] = segmented_image
            # Get flank from the segmented image 
            # Save segmented image for now to s3
            split_path = image_path.split('/')
            split_path[0] += '-comp'
            split_path[-1] = '/_segmented_images_/' + split_path[-1].split('.')[0] + '_' + str(detection_id) + '.JPG'
            seg_img_path = '/'.join(split_path)
            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file_img:
                segmented_image.save(temp_file_img.name)
                print('Uploading segmented image to S3 {}'.format(seg_img_path))
                s3client.put_object(Bucket=sourceBucket, Key=seg_img_path, Body=temp_file_img)
                # flank = get_flank(temp_file_img.name)
                # print('Get flank for detection_id: {} - {}'.format(detection_id, flank))
                # detection_flanks[detection_id] = flank

    return detection_flanks



