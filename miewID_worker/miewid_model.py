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

'''
Core inference for miewid_prepare (contract miewid_prepare@v1):

  For each detection in the Celery batch:
    1. Download the camera-trap image from S3 (fallback to -comp key)
    2. SAM-segment using the MegaDetector bbox, crop to that box
    3. ScarceNet pose → flank L/R/A
    4. MiewID embed the chip (batched) → 2152-d L2-normalized vector

  Returns {str(detection_id): {'flank': 'L'|'R'|'A', 'embedding': [float, ...]}}
  Failed detections are omitted (same pattern as gpuworker/similarity.py).
'''

import argparse
import os
import tempfile
import time

import boto3
import numpy as np
import torch
import torch.backends.cudnn as cudnn
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
from segment_anything import SamPredictor, sam_model_registry
from transformers import AutoModel

from miewID_worker.config import Config

s3client = boto3.client('s3')

# Lazily initialised globals (one load per worker process)
_init_sam = False
_init_pose = False
_init_miewid = False
_sam_predictor = None
_pose_model = None
_miewid_model = None

_miewid_preprocess = transforms.Compose([
    transforms.Resize((440, 440)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _ensure_sam():
    global _init_sam, _sam_predictor
    if _init_sam:
        return
    print('Initializing SAM from {}'.format(Config.SAM_CHECKPOINT))
    starttime = time.time()
    sam = sam_model_registry['vit_h'](checkpoint=Config.SAM_CHECKPOINT)
    sam.to(device='cuda')
    _sam_predictor = SamPredictor(sam)
    _init_sam = True
    print('SAM initialized in {:.1f}s'.format(time.time() - starttime))


def _ensure_pose():
    global _init_pose, _pose_model
    if _init_pose:
        return
    print('Initializing ScarceNet pose from {}'.format(Config.SCARCENET_CHECKPOINT))
    starttime = time.time()
    from lib.config import cfg, update_config
    from lib.models.pose_hrnet_part import get_pose_net

    args = argparse.Namespace(
        cfg=Config.SCARCENET_CFG,
        opts=[
            'OUTPUT_DIR', 'test',
            'TEST.MODEL_FILE', Config.SCARCENET_CHECKPOINT,
            'MODEL.NAME', 'pose_hrnet_part',
            'GPUS', '[0,]',
        ],
        modelDir='', logDir='', dataDir='', prevModelDir='',
        animalpose=True, vis=False,
    )
    update_config(cfg, args)
    cudnn.benchmark = True
    torch.backends.cudnn.deterministic = False
    torch.backends.cudnn.enabled = True

    checkpoint = torch.load(Config.SCARCENET_CHECKPOINT, map_location='cpu')
    pose = get_pose_net(cfg, is_train=False)
    pose.load_state_dict(checkpoint['state_dict'], strict=True)
    _pose_model = torch.nn.DataParallel(pose, device_ids=cfg.GPUS).cuda()
    _init_pose = True
    print('Pose initialized in {:.1f}s'.format(time.time() - starttime))


def _ensure_miewid():
    global _init_miewid, _miewid_model
    if _init_miewid:
        return
    print('Initializing MiewID from {}'.format(Config.MIEWID_MODEL_DIR))
    starttime = time.time()
    model = AutoModel.from_pretrained(
        Config.MIEWID_MODEL_DIR,
        trust_remote_code=True,
        local_files_only=True,
        low_cpu_mem_usage=False,
    )
    _miewid_model = model.cuda().eval()
    _init_miewid = True
    print('MiewID initialized in {:.1f}s'.format(time.time() - starttime))


def _download_image(source_bucket, image_path, dest_path):
    '''Download raw key, then fall back to org-comp/… like gpuworker/similarity.'''
    try:
        s3client.download_file(Bucket=source_bucket, Key=image_path, Filename=dest_path)
        return True
    except Exception:
        print('Error downloading {} from S3'.format(image_path))
        try:
            splits = image_path.split('/')
            splits[0] = splits[0] + '-comp'
            comp_path = '/'.join(splits)
            print('Downloading {} from S3'.format(comp_path))
            s3client.download_file(Bucket=source_bucket, Key=comp_path, Filename=dest_path)
            return True
        except Exception:
            print('Error downloading {} from S3'.format(comp_path))
            return False


def _get_flank(image_path):
    '''
    ScarceNet keypoint flank estimate.
    Returns 'left', 'right', or 'ambiguous' (same logic as gpuworker/similarity.py).
    '''
    image = Image.open(image_path).convert('RGB')
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    image_tensor = transform(image).unsqueeze(0)
    device = next(_pose_model.parameters()).device
    image_tensor = image_tensor.to(device)
    _pose_model.eval()
    with torch.no_grad():
        output = _pose_model(image_tensor)

    a = output[0].squeeze(0)
    arr = np.array(image)
    scale = [arr.shape[1] / 64, arr.shape[0] / 64]
    keypoints = np.array([
        [
            (a[i].argmax() - (a[i].argmax() // 64) * 64).cpu().numpy() * scale[0],
            (a[i].argmax() // 64).cpu().numpy() * scale[1],
            (a[i].max()).cpu().numpy(),
        ]
        for i in range(a.shape[0])
    ])
    keypoints = {
        'left_eye': keypoints[0],
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
        'right_foot_back': keypoints[16],
    }

    pairs = [
        ('neck_base', 'tail_base'),
        ('left_hip_front', 'right_hip_front'),
        ('left_hip_back', 'right_hip_back'),
        ('left_knee_front', 'right_knee_front'),
        ('left_knee_back', 'right_knee_back'),
        ('left_foot_front', 'right_foot_front'),
        ('left_foot_back', 'right_foot_back'),
    ]

    visibility_scores = {'left': 0, 'right': 0}
    for left_kp, right_kp in pairs:
        if left_kp == 'neck_base' and right_kp == 'tail_base':
            visibility_scores['left'] += keypoints['tail_base'][0] - keypoints['neck_base'][0]
            front_x = np.array([
                keypoints['left_hip_front'][0], keypoints['right_hip_front'][0],
                keypoints['left_knee_front'][0], keypoints['right_knee_front'][0],
                keypoints['left_foot_front'][0], keypoints['right_foot_front'][0],
            ])
            back_x = np.array([
                keypoints['left_hip_back'][0], keypoints['right_hip_back'][0],
                keypoints['left_knee_back'][0], keypoints['right_knee_back'][0],
                keypoints['left_foot_back'][0], keypoints['right_foot_back'][0],
            ])
            visibility_scores['left'] += np.mean(back_x) - np.mean(front_x)
            continue
        visibility_scores['left'] += keypoints[left_kp][2]
        visibility_scores['right'] += keypoints[right_kp][2]

    if visibility_scores['left'] > visibility_scores['right']:
        return 'left'
    if visibility_scores['right'] > visibility_scores['left']:
        return 'right'
    return 'ambiguous'


def _flank_to_db(flank_text):
    if flank_text == 'left':
        return 'L'
    if flank_text == 'right':
        return 'R'
    return 'A'


def _embed_chips(chip_paths):
    '''
    Embed a list of local JPEG/PNG chip paths with MiewID.
    Returns a list of 2152-d Python float lists (L2-normalized), same order.
    '''
    _ensure_miewid()
    embeddings = [None] * len(chip_paths)
    batch_size = max(1, Config.MIEWID_EMBED_BATCH)

    for start in range(0, len(chip_paths), batch_size):
        chunk_paths = chip_paths[start:start + batch_size]
        tensors = []
        for path in chunk_paths:
            img = Image.open(path).convert('RGB')
            tensors.append(_miewid_preprocess(img))
        batch = torch.stack(tensors).cuda()
        with torch.no_grad():
            out = _miewid_model(batch)
            if isinstance(out, (tuple, list)):
                out = out[0]
            out = F.normalize(out.float(), p=2, dim=-1)
        for i, vec in enumerate(out.cpu()):
            embeddings[start + i] = vec.tolist()

    return embeddings


def process_batch(batch, source_bucket, species):
    '''
    Run the full miewid_prepare pipeline on one Celery batch.

        Parameters:
            batch (list): Items with detection_id, image_id, bbox, image_path
            source_bucket (str): S3 bucket name
            species (str): Species label (used for temp folder naming / logs)

        Returns:
            dict: {str(detection_id): {'flank': str, 'embedding': list[float]}}
    '''
    _ensure_sam()
    _ensure_pose()
    _ensure_miewid()

    work_dir = 'miewid_chips_' + species.replace(' ', '_').lower()
    if not os.path.isdir(work_dir):
        os.mkdir(work_dir)

    # Pass 1: download → SAM → flank → save chip; collect successful rows
    pending = []  # list of (detection_id_str, flank, chip_path)
    for item in batch:
        detection_id = item.get('detection_id')
        try:
            image_path = item['image_path']
            bbox_dict = item['bbox']
            det_key = str(detection_id)

            with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
                print('Downloading {}'.format(image_path))
                if not _download_image(source_bucket, image_path, temp_file.name):
                    continue

                image_data = np.array(Image.open(temp_file.name))
                h, w, _ = image_data.shape
                x1 = max(0, min(1, bbox_dict['left']))
                x2 = max(0, min(1, bbox_dict['right']))
                y1 = max(0, min(1, bbox_dict['top']))
                y2 = max(0, min(1, bbox_dict['bottom']))
                bbox = np.array([x1 * w, y1 * h, x2 * w, y2 * h])

                print('Segmenting detection {}'.format(det_key))
                starttime = time.time()
                _sam_predictor.set_image(image_data)
                masks, _, _ = _sam_predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=bbox[None, :],
                    multimask_output=False,
                )
                mh, mw = masks[0].shape[-2:]
                mask_image = masks[0].reshape(mh, mw, 1) * np.array([1., 1., 1.]).reshape(1, 1, -1)
                segmented = (mask_image * image_data).astype('uint8')
                chip = Image.fromarray(
                    segmented[int(y1 * h):int(y2 * h), int(x1 * w):int(x2 * w)]
                )
                print('Segmentation done in {:.2f}s'.format(time.time() - starttime))

                chip_path = os.path.join(work_dir, '{}.jpg'.format(det_key))
                chip.save(chip_path)

                flank_text = _get_flank(chip_path)
                flank = _flank_to_db(flank_text)
                print('Flank for detection {}: {} -> {}'.format(det_key, flank_text, flank))
                pending.append((det_key, flank, chip_path))

        except Exception as e:
            print('Error processing detection {}: {}'.format(detection_id, e))
            continue

    if not pending:
        return {}

    # Pass 2: batch-embed all successful chips
    print('Embedding {} chips (batch size {})'.format(len(pending), Config.MIEWID_EMBED_BATCH))
    starttime = time.time()
    embeddings = _embed_chips([chip_path for _, _, chip_path in pending])
    print('Embedding done in {:.2f}s'.format(time.time() - starttime))

    results = {}
    for (det_key, flank, chip_path), embedding in zip(pending, embeddings):
        results[det_key] = {
            'flank': flank,
            'embedding': embedding,
        }
        try:
            os.remove(chip_path)
        except OSError:
            pass

    return results
