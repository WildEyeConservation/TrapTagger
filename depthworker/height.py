'''Scale factor, flank, and centimetre measurements for the depth job.

Coordinates passed in are image pixels. Stored keypoints use fractions of the
image width and height. Calibration distance and height are metres.
shoulder_height and back_length are centimetres.
'''

import math

# AP-10K order used by ViTPose animal checkpoints.
AP10K_KEYPOINT_NAMES = (
    'left_eye',
    'right_eye',
    'nose',
    'neck',
    'tail',
    'left_shoulder',
    'left_elbow',
    'left_front_paw',
    'right_shoulder',
    'right_elbow',
    'right_front_paw',
    'left_hip',
    'left_knee',
    'left_back_paw',
    'right_hip',
    'right_knee',
    'right_back_paw',
)

SHOULDER_TOP_NAME = 'shoulder_top'
VITPOSE_SOURCE = 'vitpose_ap10k'

# A model point below this score is treated as missing for measurements.
KEYPOINT_MIN_SCORE = 0.3

LEFT_LEG = ('left_shoulder', 'left_elbow', 'left_front_paw')
RIGHT_LEG = ('right_shoulder', 'right_elbow', 'right_front_paw')

_LEG_PAIRS = (
    ('left_shoulder', 'right_shoulder'),
    ('left_elbow', 'right_elbow'),
    ('left_front_paw', 'right_front_paw'),
    ('left_hip', 'right_hip'),
    ('left_knee', 'right_knee'),
    ('left_back_paw', 'right_back_paw'),
)
_FRONT_NAMES = (
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_front_paw', 'right_front_paw',
)
_BACK_NAMES = (
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_back_paw', 'right_back_paw',
)


def average_scale_factor(calibration_entries):
    '''Mean of h_ref * D_ref / H_ref for calibration images that have a height.

    h_ref is the bounding-box height in pixels. D_ref and H_ref are metres.
    The result is in pixels. Returns None when no image can contribute.
    '''
    values = []
    for entry in calibration_entries or []:
        box = entry.get('bbox_pixels')
        if not box or len(box) < 4:
            continue
        try:
            height_m = float(entry.get('height'))
            distance_m = float(entry.get('known_distance'))
            pixel_height = float(box[3]) - float(box[1])
        except (TypeError, ValueError):
            continue
        if height_m <= 0 or distance_m <= 0 or pixel_height <= 0:
            continue
        values.append(pixel_height * distance_m / height_m)
    if not values:
        return None
    return sum(values) / float(len(values))


def _usable(point):
    if not point:
        return False
    try:
        score = float(point.get('score'))
    except (TypeError, ValueError):
        return False
    return score >= KEYPOINT_MIN_SCORE


def _pixel_distance(a, b):
    return math.hypot(float(a['x']) - float(b['x']), float(a['y']) - float(b['y']))


def _leg_complete(keypoints, names):
    return all(_usable(keypoints.get(name)) for name in names)


def _mean_score(keypoints, names):
    scores = [float(keypoints[name]['score']) for name in names]
    return sum(scores) / float(len(scores))


def choose_leg_side(flank, keypoints):
    '''Return 'left', 'right', or None.

    A stored flank of L or R is used when that side has shoulder, elbow, and
    front paw. Otherwise the other side is used if it is complete. When the
    flank is missing or ambiguous, the complete side with the higher average
    score is used.
    '''
    left_ok = _leg_complete(keypoints, LEFT_LEG)
    right_ok = _leg_complete(keypoints, RIGHT_LEG)
    flank = flank if flank in ('L', 'R', 'A') else None

    if flank == 'L':
        if left_ok:
            return 'left'
        if right_ok:
            return 'right'
        return None
    if flank == 'R':
        if right_ok:
            return 'right'
        if left_ok:
            return 'left'
        return None

    candidates = []
    if left_ok:
        candidates.append(('left', _mean_score(keypoints, LEFT_LEG)))
    if right_ok:
        candidates.append(('right', _mean_score(keypoints, RIGHT_LEG)))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[0][0]


def _x(point):
    try:
        return float(point['x'])
    except (TypeError, ValueError, KeyError):
        return None


def _score(point):
    try:
        return float(point.get('score'))
    except (TypeError, ValueError):
        return None


def estimate_flank(keypoints):
    '''Estimate L, R, or A the same way ScarceNet does.

    Every returned keypoint is used, including low-scoring ones. Tail minus
    neck, and the mean hind-leg x minus the mean front-leg x, are added to
    the left score. Each side then receives the confidence of its shoulder,
    elbow, paw, hip, knee, and back paw. The higher score wins. A tie is ambiguous.
    '''
    scores = {'left': 0.0, 'right': 0.0}
    neck = keypoints.get('neck')
    tail = keypoints.get('tail')
    neck_x = _x(neck) if neck else None
    tail_x = _x(tail) if tail else None
    if neck_x is not None and tail_x is not None:
        scores['left'] += tail_x - neck_x
        front_x = [_x(keypoints.get(name)) for name in _FRONT_NAMES]
        back_x = [_x(keypoints.get(name)) for name in _BACK_NAMES]
        if all(value is not None for value in front_x + back_x):
            scores['left'] += (sum(back_x) / len(back_x)) - (sum(front_x) / len(front_x))

    for left_name, right_name in _LEG_PAIRS:
        left_point = keypoints.get(left_name)
        right_point = keypoints.get(right_name)
        left_score = _score(left_point) if left_point else None
        right_score = _score(right_point) if right_point else None
        if left_score is not None:
            scores['left'] += left_score
        if right_score is not None:
            scores['right'] += right_score

    if scores['left'] > scores['right']:
        return 'L'
    if scores['right'] > scores['left']:
        return 'R'
    return 'A'


def shoulder_top_pixel(mask, shoulder):
    '''Top mask pixel in the shoulder's column, or None.

    mask is a boolean array of shape (height, width), y growing downward.
    '''
    if mask is None or not _usable(shoulder):
        return None
    height, width = mask.shape[:2]
    x = int(round(float(shoulder['x'])))
    if x < 0 or x >= width or height <= 0:
        return None
    column = mask[:, x]
    hits = [index for index, value in enumerate(column) if value]
    if not hits:
        return None
    return {'x': float(x), 'y': float(min(hits)), 'score': None, 'name': SHOULDER_TOP_NAME}


def measure_animal(keypoints, mask, distance_m, scale_factor, flank):
    '''Return centimetre measurements and the keypoint rows to store.

    Either measurement may be missing. pixel length * distance / scale_factor
    is metres; the stored values are centimetres.
    '''
    stored = []
    for name in AP10K_KEYPOINT_NAMES:
        point = keypoints.get(name)
        if point is None:
            continue
        stored.append({
            'name': name,
            'x': point['x'],
            'y': point['y'],
            'score': point.get('score'),
        })

    shoulder_height = None
    shoulder_names = []
    side = choose_leg_side(flank, keypoints)
    if side is not None and scale_factor and distance_m and distance_m > 0 and scale_factor > 0:
        names = LEFT_LEG if side == 'left' else RIGHT_LEG
        shoulder = keypoints.get(names[0])
        elbow = keypoints.get(names[1])
        paw = keypoints.get(names[2])
        top = shoulder_top_pixel(mask, shoulder)
        if top is not None and _usable(elbow) and _usable(paw):
            pixel_length = (
                _pixel_distance(top, shoulder)
                + _pixel_distance(shoulder, elbow)
                + _pixel_distance(elbow, paw)
            )
            shoulder_height = 100.0 * pixel_length * float(distance_m) / float(scale_factor)
            shoulder_names = [SHOULDER_TOP_NAME, names[0], names[1], names[2]]
            stored.append(top)

    back_length = None
    back_names = []
    neck = keypoints.get('neck')
    tail = keypoints.get('tail')
    if (
        _usable(neck) and _usable(tail)
        and scale_factor and distance_m and distance_m > 0 and scale_factor > 0
    ):
        pixel_length = _pixel_distance(neck, tail)
        back_length = 100.0 * pixel_length * float(distance_m) / float(scale_factor)
        back_names = ['neck', 'tail']

    if shoulder_height is not None and shoulder_height <= 0:
        shoulder_height = None
        shoulder_names = []
    if back_length is not None and back_length <= 0:
        back_length = None
        back_names = []

    return {
        'shoulder_height': shoulder_height,
        'shoulder_keypoints': shoulder_names,
        'back_length': back_length,
        'back_keypoints': back_names,
        'keypoints': stored,
    }
