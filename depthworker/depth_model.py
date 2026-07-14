import tempfile
import shutil
import os
import json
import boto3
from PIL import Image

s3_client = boto3.client('s3')

def infer(cameragroup_id, cam_name, calibration_items, trap_items, sourceBucket, external=False):
    '''
    Runs depth estimation for one cameragroup: stages calibration and trap images,
    runs the depth model, and returns estimated distances per detection.

    Parameters:
        cameragroup_id (int): Cameragroup ID for this job.
        cam_name (str): Camera/cameragroup name used in the transects folder path.
        calibration_items (list): Calibration image dicts with image_path, bbox,
            and known_distance (or distance).
        trap_items (list): Trap detection dicts with detection_id, image_path, bbox.
        sourceBucket (str): S3 bucket to download images from.
        external (bool): Whether images are external to S3 (not implemented).

    Returns:
        results (dict): {str(detection_id): {'distance': float|None, 'error': str|None}}

    Note:
        calibration_items[]: image_path, bbox, known_distance or distance
        trap_items[]: detection_id, image_path, bbox
    '''
    job_root = tempfile.mkdtemp(prefix='depth_job_')
    try:
        cam_dir = _cam_job_dir(job_root, cam_name)
        cal_dir, det_dir = _stage_paths(cam_dir)
        manifest = _download_and_build_manifest(
            cameragroup_id, cam_name, cal_dir, det_dir, calibration_items, trap_items, sourceBucket, external
        )
        if manifest is None:
            return {
                str(t['detection_id']): {'distance': None, 'error': 'staging_failed'}
                for t in trap_items
            }

        return _run_depth_repo_stub(cam_dir, manifest)
    finally:
        shutil.rmtree(job_root, ignore_errors=True)

def _sanitize_cam_name(cam_name):
    '''
    Returns a filesystem-safe version of cam_name for use in directory paths.
    '''
    safe = cam_name.replace(' ', '_')
    for ch in ['/', '\\', ':']:
        safe = safe.replace(ch, '_')
    return safe

def _cam_job_dir(job_root, cam_name):
    '''
    Creates and returns job_root/transects/{sanitized_cam_name}/.
    '''
    cam_dir = os.path.join(job_root, 'transects', _sanitize_cam_name(cam_name))
    os.makedirs(cam_dir, exist_ok=True)
    return cam_dir

def _stage_paths(cam_dir):
    '''
    Creates calibration_frames/ and detection_frames/ under cam_dir.
    Returns (cal_dir, det_dir).
    '''
    cal_dir = os.path.join(cam_dir, 'calibration_frames')
    det_dir = os.path.join(cam_dir, 'detection_frames')
    os.makedirs(cal_dir, exist_ok=True)
    os.makedirs(det_dir, exist_ok=True)
    return cal_dir, det_dir

def _comp_fallback_key(image_key):
    '''
    Returns an alternate S3 key using the {org}-comp/ prefix when the primary key fails.
    '''
    splits = image_key.split('/')
    splits[0] = splits[0] + '-comp'
    return '/'.join(splits)

def _download_image(sourceBucket, image_key, dest_path, external=False):
    '''
    Downloads an image from S3 to dest_path. Tries the primary key, then the -comp fallback.
    Returns True on success, False on failure.
    '''
    try:
        s3_client.download_file(Bucket=sourceBucket, Key=image_key, Filename=dest_path)
        return True
    except Exception:
        try:
            s3_client.download_file(Bucket=sourceBucket, Key=_comp_fallback_key(image_key), Filename=dest_path)
            return True
        except Exception:
            print('Failed to download {}'.format(image_key))
            return False

def _bbox_to_pixels(bbox, width, height):
    '''
    Converts a normalized bbox dict (top, left, bottom, right in [0, 1])
    to pixel coordinates [x1, y1, x2, y2] for the given image dimensions.
    '''
    left = max(0.0, min(1.0, float(bbox['left'])))
    right = max(0.0, min(1.0, float(bbox['right'])))
    top = max(0.0, min(1.0, float(bbox['top'])))
    bottom = max(0.0, min(1.0, float(bbox['bottom'])))
    return [
        int(left * width),
        int(top * height),
        int(right * width),
        int(bottom * height),
    ]

def _download_and_build_manifest(cameragroup_id, cam_name, cal_dir, det_dir, calibration_items, trap_items, sourceBucket, external):
    '''
    Downloads calibration and trap images into cal_dir and det_dir, builds manifest
    metadata (paths, pixel bboxes), and writes manifest.json under cam_dir.

    Returns:
        manifest (dict) on success, or None if no calibration images could be staged.
'''
    manifest = {
        "cameragroup_id": cameragroup_id,
        "cam_name": cam_name,
        'calibration': [],
        'trap': []
    }
    for item in calibration_items:
        distance = item.get('known_distance', item.get('distance'))
        if distance is None:
            continue
        bbox = item.get('bbox') or {}
        if any(bbox.get(k) is None for k in ('top', 'left', 'bottom', 'right')):
            continue
        dest_path = os.path.join(cal_dir, '{}.jpg'.format(distance))
        
        ok = _download_image(sourceBucket, item['image_path'], dest_path, external)
        if not ok:
            continue
        with Image.open(dest_path) as img:
            width, height = img.size
        manifest['calibration'].append({
            "known_distance": distance,
            "relative_path": os.path.join('calibration_frames', '{}.jpg'.format(distance)),
            "bbox_pixels": _bbox_to_pixels(item['bbox'], width, height)
            })
    if not manifest['calibration']:
        return None
    
    for item in trap_items:
        dest_path = os.path.join(det_dir, '{}.jpg'.format(item['detection_id']))
        ok = _download_image(sourceBucket, item['image_path'], dest_path, external)
        if not ok:
            manifest['trap'].append({'detection_id': item['detection_id'], 'download_ok': False})
        else:
            with Image.open(dest_path) as img:
                width, height = img.size
            manifest['trap'].append({
                "detection_id": item['detection_id'],
                "relative_path": os.path.join('detection_frames', '{}.jpg'.format(item['detection_id'])),
                "bbox_pixels": _bbox_to_pixels(item['bbox'], width, height),
                "download_ok": True
                })

    manifest_path = os.path.join(os.path.dirname(cal_dir), 'manifest.json')  # inside cam_dir
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    return manifest

def _run_depth_repo_stub(cam_dir, manifest):
    '''
    Mock function simulating the running of the dpeth repo
    '''
    results = {}
    cal_distances = [c['known_distance'] for c in manifest['calibration']]
    ref = sum(cal_distances) / len(cal_distances) if cal_distances else 0
    for trap in manifest['trap']:
        det_id = str(trap['detection_id'])
        if trap.get('download_ok', True):
            results[det_id] = {'distance': round(ref * 0.95, 4), 'error': None}
        else:
            results[det_id] = {'distance': None, 'error': 's3_download_failed'}
    return results




