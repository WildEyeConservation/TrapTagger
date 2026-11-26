'''Scale factor, flank, and centimetre measurements for the depth job.

Coordinates passed in are image pixels. Stored keypoints use fractions of the
image width and height. Calibration distance and height are metres.
shoulder_height, back_length, and tail_height are centimetres.
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
LEFT_HIND = ('left_hip', 'left_knee', 'left_back_paw')
RIGHT_HIND = ('right_hip', 'right_knee', 'right_back_paw')

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
    # A person-placed/edited point is always trusted, even if an old model
    # score was left on the row.
    if point.get('source') in ('user', 'user_edited'):
        return True
    score = point.get('score')
    # Missing score means a person placed/edited the point.
    if score is None or score == '':
        return True
    try:
        score = float(score)
    except (TypeError, ValueError):
        return True
    return score >= KEYPOINT_MIN_SCORE


def _pixel_distance(a, b):
    return math.hypot(float(a['x']) - float(b['x']), float(a['y']) - float(b['y']))


def _leg_complete(keypoints, names):
    return all(_usable(keypoints.get(name)) for name in names)


def _mean_score(keypoints, names):
    scores = [float(keypoints[name]['score']) for name in names]
    return sum(scores) / float(len(scores))


def choose_leg_side(flank, keypoints, left_names=LEFT_LEG, right_names=RIGHT_LEG):
    '''Return 'left', 'right', or None for a front- or hind-leg triplet.

    A stored flank of L or R is used when that side has all three points.
    Otherwise the other side is used if it is complete. When the flank is
    missing or ambiguous, the complete side with the higher average score is used.
    '''
    left_ok = _leg_complete(keypoints, left_names)
    right_ok = _leg_complete(keypoints, right_names)
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
        candidates.append(('left', _mean_score(keypoints, left_names)))
    if right_ok:
        candidates.append(('right', _mean_score(keypoints, right_names)))
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
    return mask_top_pixel(mask, shoulder)


def mask_top_pixel(mask, anchor):
    '''Top mask pixel in the anchor point's column, or None.

    mask is a boolean array of shape (height, width), y growing downward.
    '''
    if mask is None or not _usable(anchor):
        return None
    height, width = mask.shape[:2]
    x = int(round(float(anchor['x'])))
    if x < 0 or x >= width or height <= 0:
        return None
    column = mask[:, x]
    hits = [index for index, value in enumerate(column) if value]
    if not hits:
        return None
    return {'x': float(x), 'y': float(min(hits)), 'score': None}


def measurements_from_stored_points(points, flank, distance_m, scale_factor, width, height):
    '''Centimetre measurements from stored fraction keypoints.

    points are fractions of the image. width and height are the image pixels
    those fractions belong to. A missing score is treated as usable, because
    a person placed the point. A missing required point returns None for that
    measurement. Invalid distance, scale factor, or image size returns None
    for all three, and the caller decides whether that clears the stored values.
    '''
    keypoints = {}
    for point in points or []:
        name = point.get('name')
        if not name:
            continue
        try:
            x = float(point['x']) * float(width)
            y = float(point['y']) * float(height)
        except (TypeError, ValueError, KeyError):
            continue
        score = point.get('score')
        if score is None:
            score = 1.0
        keypoints[name] = {
            'name': name,
            'x': x,
            'y': y,
            'score': score,
            'source': point.get('source'),
        }

    shoulder_height = None
    back_length = None
    tail_height = None
    try:
        distance_m = float(distance_m)
        scale_factor = float(scale_factor)
        width = float(width)
        height = float(height)
    except (TypeError, ValueError):
        return None, None, None
    width = abs(width)
    height = abs(height)
    if distance_m <= 0 or scale_factor <= 0 or width <= 0 or height <= 0:
        return None, None, None

    side = choose_leg_side(flank, keypoints, LEFT_LEG, RIGHT_LEG)
    if side is not None:
        names = LEFT_LEG if side == 'left' else RIGHT_LEG
        shoulder = keypoints.get(names[0])
        elbow = keypoints.get(names[1])
        paw = keypoints.get(names[2])
        top = keypoints.get(SHOULDER_TOP_NAME)
        if top is not None and _usable(shoulder) and _usable(elbow) and _usable(paw):
            pixel_length = (
                _pixel_distance(top, shoulder)
                + _pixel_distance(shoulder, elbow)
                + _pixel_distance(elbow, paw)
            )
            value = 100.0 * pixel_length * distance_m / scale_factor
            if value > 0:
                shoulder_height = value

    top = keypoints.get(SHOULDER_TOP_NAME)
    tail = keypoints.get('tail')
    if _usable(top) and _usable(tail):
        pixel_length = _pixel_distance(top, tail)
        value = 100.0 * pixel_length * distance_m / scale_factor
        if value > 0:
            back_length = value

    # Tail height uses the AP-10K tail point as the chain top (no extrapolated point).
    hind_side = choose_leg_side(flank, keypoints, LEFT_HIND, RIGHT_HIND)
    if hind_side is not None:
        names = LEFT_HIND if hind_side == 'left' else RIGHT_HIND
        hip = keypoints.get(names[0])
        knee = keypoints.get(names[1])
        paw = keypoints.get(names[2])
        if _usable(tail) and _usable(hip) and _usable(knee) and _usable(paw):
            pixel_length = (
                _pixel_distance(tail, hip)
                + _pixel_distance(hip, knee)
                + _pixel_distance(knee, paw)
            )
            value = 100.0 * pixel_length * distance_m / scale_factor
            if value > 0:
                tail_height = value

    return shoulder_height, back_length, tail_height


def measure_animal(
    keypoints,
    mask,
    distance_m,
    scale_factor,
    flank,
    compute_shoulder=True,
    compute_back=True,
    compute_tail=True,
):
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

    scale_ok = bool(scale_factor and distance_m and distance_m > 0 and scale_factor > 0)
    shoulder_height = None
    shoulder_names = []
    back_length = None
    back_names = []
    # Back length runs shoulder_top → tail, so derive the mask top whenever either
    # shoulder height or back length is requested.
    side = (
        choose_leg_side(flank, keypoints, LEFT_LEG, RIGHT_LEG)
        if (compute_shoulder or compute_back) else None
    )
    top = None
    shoulder = None
    elbow = None
    paw = None
    names = None
    if side is not None and scale_ok:
        names = LEFT_LEG if side == 'left' else RIGHT_LEG
        shoulder = keypoints.get(names[0])
        elbow = keypoints.get(names[1])
        paw = keypoints.get(names[2])
        top = mask_top_pixel(mask, shoulder)
        if top is not None:
            top = dict(top)
            top['name'] = SHOULDER_TOP_NAME

    top_stored = False
    if (
        compute_shoulder
        and top is not None
        and names is not None
        and _usable(elbow) and _usable(paw)
        and scale_ok
    ):
        pixel_length = (
            _pixel_distance(top, shoulder)
            + _pixel_distance(shoulder, elbow)
            + _pixel_distance(elbow, paw)
        )
        shoulder_height = 100.0 * pixel_length * float(distance_m) / float(scale_factor)
        shoulder_names = [SHOULDER_TOP_NAME, names[0], names[1], names[2]]
        stored.append(top)
        top_stored = True

    tail = keypoints.get('tail')
    if compute_back and top is not None and _usable(tail) and scale_ok:
        pixel_length = _pixel_distance(top, tail)
        back_length = 100.0 * pixel_length * float(distance_m) / float(scale_factor)
        back_names = [SHOULDER_TOP_NAME, 'tail']
        if not top_stored:
            stored.append(top)
            top_stored = True

    tail_height = None
    tail_names = []
    hind_side = choose_leg_side(flank, keypoints, LEFT_HIND, RIGHT_HIND) if compute_tail else None
    if hind_side is not None and scale_ok:
        names = LEFT_HIND if hind_side == 'left' else RIGHT_HIND
        hip = keypoints.get(names[0])
        knee = keypoints.get(names[1])
        paw = keypoints.get(names[2])
        if _usable(tail) and _usable(hip) and _usable(knee) and _usable(paw):
            pixel_length = (
                _pixel_distance(tail, hip)
                + _pixel_distance(hip, knee)
                + _pixel_distance(knee, paw)
            )
            tail_height = 100.0 * pixel_length * float(distance_m) / float(scale_factor)
            tail_names = ['tail', names[0], names[1], names[2]]

    if shoulder_height is not None and shoulder_height <= 0:
        shoulder_height = None
        shoulder_names = []
    if back_length is not None and back_length <= 0:
        back_length = None
        back_names = []
    if tail_height is not None and tail_height <= 0:
        tail_height = None
        tail_names = []

    return {
        'shoulder_height': shoulder_height,
        'shoulder_keypoints': shoulder_names,
        'back_length': back_length,
        'back_keypoints': back_names,
        'tail_height': tail_height,
        'tail_keypoints': tail_names,
        'keypoints': stored,
    }
