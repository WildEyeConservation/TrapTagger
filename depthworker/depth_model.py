import json
import os
import shutil
import sys
import tempfile
import time

import boto3
from PIL import Image

s3_client = boto3.client('s3')

_DEPTH_REPO = os.path.abspath(
  os.path.join(os.path.dirname(__file__), '..', 'depth-estimation-repo')
)
if os.path.isdir(_DEPTH_REPO) and _DEPTH_REPO not in sys.path:
  sys.path.insert(0, _DEPTH_REPO)

# Sibling cameragroup cal-cache dirs older than this are removed (orphans from
# multi-instance runs where the last batch never ran on this worker).
_CAL_CACHE_MAX_AGE_SECONDS = int(os.environ.get('DEPTH_CAL_CACHE_MAX_AGE_SECONDS') or 36)


def _trap_download_chunk_size():
  '''Internal trap download/inference chunk size for one Celery depth job.'''
  try:
    return max(1, int(os.environ.get('DEPTH_TRAP_DOWNLOAD_CHUNK_SIZE') or 2))
  except (TypeError, ValueError):
    return 200


def infer(
  cameragroup_id,
  cam_name,
  calibration_items,
  trap_items,
  sourceBucket,
  external=False,
  survey_id=None,
  batch_index=1,
  batch_count=1,
):
  '''
  Runs depth estimation for one cameragroup: stages calibration once, then
  downloads/infers trap images in chunks (default 200), cleaning local trap
  frames between chunks while keeping calibration staged for the whole job.

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
  '''
  job_root = tempfile.mkdtemp(prefix='depth_job_')
  session = None
  try:
    os.makedirs(os.path.join(job_root, 'results'), exist_ok=True)
    transect_id = _sanitize_cam_name(cam_name)
    transect_dir = _cam_job_dir(job_root, cam_name)
    cal_dir, det_dir = _stage_paths(transect_dir)
    use_cal_cache = batch_count > 1 and survey_id is not None
    calib_cache_path = (
      _calib_cache_path(survey_id, cameragroup_id) if use_cal_cache else None
    )
    cached_calib_path = None

    if use_cal_cache:
      _cleanup_stale_sibling_cal_caches(survey_id, cameragroup_id)

    if use_cal_cache and batch_index == 1:
      _clear_cal_cache(survey_id, cameragroup_id)
    elif use_cal_cache and batch_index > 1:
      if _restore_cal_frames(cal_dir, survey_id, cameragroup_id):
        print(
          'Restored calibration images from cache for cameragroup {} (batch {}/{})'.format(
            cameragroup_id, batch_index, batch_count,
          )
        )

    calibration_entries = _download_calibration(
      cal_dir,
      calibration_items,
      sourceBucket,
      external,
    )
    if not calibration_entries:
      return {
        str(t['detection_id']): {'distance': None, 'error': 'staging_failed'}
        for t in trap_items
      }

    _write_manifest(
      transect_dir,
      cameragroup_id,
      cam_name,
      calibration_entries,
      [],
    )

    if use_cal_cache and batch_index > 1:
      if calib_cache_path and os.path.isfile(calib_cache_path):
        cached_calib_path = calib_cache_path
        print(
          'Will reuse cached calibration state for cameragroup {} (batch {}/{})'.format(
            cameragroup_id, batch_index, batch_count,
          )
        )
      elif _restore_cal_masks(transect_dir, survey_id, cameragroup_id):
        print(
          'Restored calibration masks from cache for cameragroup {} (batch {}/{})'.format(
            cameragroup_id, batch_index, batch_count,
          )
        )
      else:
        print(
          'Cal cache miss for cameragroup {} (batch {}/{}); will run full calibration'.format(
            cameragroup_id, batch_index, batch_count,
          )
        )

    from traptagger_api import (
      estimate_transect_traps,
      prepare_transect_session,
      release_transect_session,
      traptagger_default_config,
    )

    if use_cal_cache and batch_index == 1:
      os.makedirs(_cal_cache_root(survey_id, cameragroup_id), exist_ok=True)

    collect_bbox_audit = os.environ.get('DEPTH_BBOX_AUDIT', '0') == '1'
    session = prepare_transect_session(
      job_root,
      transect_id,
      config=traptagger_default_config(),
      collect_bbox_audit=collect_bbox_audit,
      cached_calib_path=cached_calib_path,
      calib_cache_path=calib_cache_path if batch_index == 1 else None,
    )

    if use_cal_cache and batch_index == 1:
      _save_cal_frames(transect_dir, survey_id, cameragroup_id)
      _save_cal_masks(transect_dir, survey_id, cameragroup_id)

    chunk_size = _trap_download_chunk_size()
    all_results = {}
    for chunk_start in range(0, len(trap_items), chunk_size):
      chunk = trap_items[chunk_start:chunk_start + chunk_size]
      trap_entries = _download_traps(det_dir, chunk, sourceBucket, external)
      _write_manifest(
        transect_dir,
        cameragroup_id,
        cam_name,
        calibration_entries,
        trap_entries,
      )
      print(
        'Depth infer chunk {}-{} of {} traps for cameragroup {} (batch {}/{})'.format(
          chunk_start + 1,
          chunk_start + len(chunk),
          len(trap_items),
          cameragroup_id,
          batch_index,
          batch_count,
        )
      )
      all_results.update(estimate_transect_traps(session))
      _clear_detection_frames(det_dir)

    if use_cal_cache and batch_index == batch_count:
      _clear_cal_cache(survey_id, cameragroup_id)

    if collect_bbox_audit:
      _write_bbox_audit(
        session.get('bbox_audit') or {},
        survey_id,
        cameragroup_id,
        batch_index=batch_index,
        batch_count=batch_count,
      )
    return all_results
  finally:
    # Always unload SAM/DPT ORT sessions so VRAM does not leak across Celery tasks.
    if session is not None:
      try:
        from traptagger_api import release_transect_session
        release_transect_session(session)
      except Exception as e:
        print('Failed to release depth session GPU resources: {}'.format(e))
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
      s3_client.download_file(
        Bucket=sourceBucket,
        Key=_comp_fallback_key(image_key),
        Filename=dest_path,
      )
      return True
    except Exception:
      print('Failed to download {}'.format(image_key))
      return False


def _bbox_to_pixels(bbox, width, height):
  '''
  Converts a normalized bbox dict (top, left, bottom, right in [0, 1])
  to pixel coordinates [xmin, ymin, xmax, ymax] for the given image dimensions.
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


def _bbox_has_coords(bbox):
  '''True if bbox dict has all normalized coordinates set.'''
  return not any(bbox.get(k) is None for k in ('top', 'left', 'bottom', 'right'))


def _download_calibration(cal_dir, calibration_items, sourceBucket, external):
  '''
  Downloads calibration images into cal_dir and returns manifest calibration entries.
  '''
  calibration = []
  for item in calibration_items:
    # known_distance comes from CalibrationImage.distance (DB), not the S3 basename.
    # Stage locally as <distance>.jpg for the depth-estimation repo layout.
    distance = item.get('known_distance', item.get('distance'))
    if distance is None:
      continue
    bbox = item.get('bbox') or {}
    if any(bbox.get(k) is None for k in ('top', 'left', 'bottom', 'right')):
      continue
    dest_path = os.path.join(cal_dir, '{}.jpg'.format(distance))

    if os.path.isfile(dest_path):
      ok = True
    else:
      ok = _download_image(sourceBucket, item['image_path'], dest_path, external)
    if not ok:
      continue
    with Image.open(dest_path) as img:
      width, height = img.size
    calibration.append({
      'known_distance': distance,
      'relative_path': os.path.join('calibration_frames', '{}.jpg'.format(distance)),
      'bbox_pixels': _bbox_to_pixels(item['bbox'], width, height),
    })
  return calibration


def _download_traps(det_dir, trap_items, sourceBucket, external):
  '''
  Downloads trap images into det_dir and returns manifest trap entries.
  '''
  traps = []
  for item in trap_items:
    bbox = item.get('bbox') or {}
    if not _bbox_has_coords(bbox):
      traps.append({
        'detection_id': item['detection_id'],
        'download_ok': True,
      })
      continue

    dest_path = os.path.join(det_dir, '{}.jpg'.format(item['detection_id']))
    ok = _download_image(sourceBucket, item['image_path'], dest_path, external)
    if not ok:
      traps.append({
        'detection_id': item['detection_id'],
        'download_ok': False,
      })
    else:
      with Image.open(dest_path) as img:
        width, height = img.size
      traps.append({
        'detection_id': item['detection_id'],
        'relative_path': os.path.join(
          'detection_frames',
          '{}.jpg'.format(item['detection_id']),
        ),
        'bbox_pixels': _bbox_to_pixels(item['bbox'], width, height),
        'download_ok': True,
      })
  return traps


def _write_manifest(transect_dir, cameragroup_id, cam_name, calibration, traps):
  '''Writes manifest.json for the current calibration + trap staging.'''
  manifest = {
    'cameragroup_id': cameragroup_id,
    'cam_name': cam_name,
    'calibration': calibration,
    'trap': traps,
  }
  manifest_path = os.path.join(transect_dir, 'manifest.json')
  with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=2)
  return manifest


def _clear_detection_frames(det_dir):
  '''Removes downloaded trap images after a chunk finishes inference.'''
  if not os.path.isdir(det_dir):
    return
  for name in os.listdir(det_dir):
    path = os.path.join(det_dir, name)
    try:
      if os.path.isfile(path) or os.path.islink(path):
        os.unlink(path)
      elif os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
    except OSError:
      pass


def _survey_cache_dir(survey_id):
  return os.path.join(os.path.dirname(__file__), 'cal_cache', str(survey_id))


def _cal_cache_root(survey_id, cameragroup_id):
  return os.path.join(_survey_cache_dir(survey_id), str(cameragroup_id))


def _cal_cache_masks_dir(survey_id, cameragroup_id):
  return os.path.join(_cal_cache_root(survey_id, cameragroup_id), 'calibration_frames_masks')


def _cal_cache_frames_dir(survey_id, cameragroup_id):
  return os.path.join(_cal_cache_root(survey_id, cameragroup_id), 'calibration_frames')


def _calib_cache_path(survey_id, cameragroup_id):
  return os.path.join(_cal_cache_root(survey_id, cameragroup_id), 'calib_state.npz')


def _clear_cal_cache(survey_id, cameragroup_id):
  shutil.rmtree(_cal_cache_root(survey_id, cameragroup_id), ignore_errors=True)
  try:
    os.rmdir(_survey_cache_dir(survey_id))
  except OSError:
    pass


def _cal_cache_dir_mtime(cache_dir):
  '''
  Best-effort age signal for a cameragroup cal-cache directory.
  Prefer calib_state.npz mtime when present; otherwise the directory mtime.
  '''
  state_path = os.path.join(cache_dir, 'calib_state.npz')
  try:
    if os.path.isfile(state_path):
      return os.path.getmtime(state_path)
    return os.path.getmtime(cache_dir)
  except OSError:
    return None


def _cleanup_stale_sibling_cal_caches(
  survey_id,
  cameragroup_id,
  max_age_seconds=_CAL_CACHE_MAX_AGE_SECONDS,
):
  '''
  Delete other cameragroup cache dirs under this survey that are older than
  max_age_seconds. Never removes the current cameragroup's cache.
  '''
  survey_dir = _survey_cache_dir(survey_id)
  if not os.path.isdir(survey_dir):
    return

  keep_name = str(cameragroup_id)
  now = time.time()
  try:
    entries = os.listdir(survey_dir)
  except OSError:
    return

  for name in entries:
    if name == keep_name:
      continue
    path = os.path.join(survey_dir, name)
    if not os.path.isdir(path):
      continue
    mtime = _cal_cache_dir_mtime(path)
    if mtime is None:
      continue
    age = now - mtime
    if age < max_age_seconds:
      continue
    print(
      'Removing stale cal cache for cameragroup {} (survey {}, age {:.0f}s)'.format(
        name, survey_id, age,
      )
    )
    shutil.rmtree(path, ignore_errors=True)

  try:
    os.rmdir(survey_dir)
  except OSError:
    pass


def _restore_cal_masks(transect_dir, survey_id, cameragroup_id):
  cache_masks = _cal_cache_masks_dir(survey_id, cameragroup_id)
  if not os.path.isdir(cache_masks):
    return False
  dest = os.path.join(transect_dir, 'calibration_frames_masks')
  shutil.copytree(cache_masks, dest, dirs_exist_ok=True)
  return True


def _restore_cal_frames(cal_dir, survey_id, cameragroup_id):
  cache_frames = _cal_cache_frames_dir(survey_id, cameragroup_id)
  if not os.path.isdir(cache_frames):
    return False
  shutil.copytree(cache_frames, cal_dir, dirs_exist_ok=True)
  return True


def _save_cal_masks(transect_dir, survey_id, cameragroup_id):
  src = os.path.join(transect_dir, 'calibration_frames_masks')
  if not os.path.isdir(src):
    return
  dest = _cal_cache_masks_dir(survey_id, cameragroup_id)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  if os.path.isdir(dest):
    shutil.rmtree(dest)
  shutil.copytree(src, dest)


def _save_cal_frames(transect_dir, survey_id, cameragroup_id):
  src = os.path.join(transect_dir, 'calibration_frames')
  if not os.path.isdir(src) or not os.listdir(src):
    return
  dest = _cal_cache_frames_dir(survey_id, cameragroup_id)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  if os.path.isdir(dest):
    shutil.rmtree(dest)
  shutil.copytree(src, dest)


def _write_bbox_audit(audit, survey_id, cameragroup_id, batch_index=1, batch_count=1):
  '''
  Writes bbox audit JSON to depthworker/bbox_audit/{survey_id}/{cameragroup_id}.json
  when DEPTH_BBOX_AUDIT=1.
  '''
  if survey_id is None:
    survey_id = 'unknown'
  audit_dir = os.path.join(
    os.path.dirname(__file__),
    'bbox_audit',
    str(survey_id),
  )
  os.makedirs(audit_dir, exist_ok=True)
  out_path = os.path.join(audit_dir, '{}.json'.format(cameragroup_id))

  for trap in audit.get('trap', []):
    trap['batch_index'] = batch_index

  batch_run = {
    'batch_index': batch_index,
    'batch_count': batch_count,
    'trap_count': len(audit.get('trap', [])),
  }

  if batch_index > 1 and os.path.isfile(out_path):
    with open(out_path) as f:
      existing = json.load(f)
    existing.setdefault('trap', []).extend(audit.get('trap', []))
    existing.setdefault('batch_runs', []).append(batch_run)
    audit = existing
  else:
    audit['batch_index'] = batch_index
    audit['batch_count'] = batch_count
    audit['batch_runs'] = [batch_run]

  audit['survey_id'] = survey_id
  with open(out_path, 'w') as f:
    json.dump(audit, f, indent=2)
  print('Wrote bbox audit to {} (batch {}/{})'.format(out_path, batch_index, batch_count))
