'''Pre-flight validation and viewable-area helpers for spaceNtime TTE abundance.'''

import math

import numpy as np
from scipy.optimize import minimize_scalar
from sqlalchemy.sql import func, or_, and_, distinct

import GLOBALS
from app import db
from app.models import *
from app.functions.globals import getChildList
from config import Config

TTE_MIN_DISTANCE_COUNT = 20


def _apply_distance_site_filters(query, trapgroups, groups):
    '''Applies trapgroup / sitegroup filters used by TTE detection queries.'''
    if trapgroups != '0' and trapgroups != '-1' and groups != '0' and groups != '-1':
        return query.filter(or_(Trapgroup.id.in_(trapgroups), Sitegroup.id.in_(groups)))
    if trapgroups != '0' and trapgroups != '-1':
        return query.filter(Trapgroup.id.in_(trapgroups))
    if groups != '0' and groups != '-1':
        return query.filter(Sitegroup.id.in_(groups))
    return query


def _species_label_ids(task_ids, species):
    if isinstance(species, str):
        species = [species]
    labels = db.session.query(Label).filter(Label.description.in_(species)).filter(Label.task_id.in_(task_ids)).all()
    label_list = []
    for label in labels:
        label_list.append(label.id)
        label_list.extend(getChildList(label, int(label.task_id)))
    return label_list


def _apply_tte_detection_filters(detectionQuery, task_ids, species, trapgroups, groups, startDate, endDate):
    detectionQuery = detectionQuery.filter(Labelgroup.task_id.in_(task_ids))

    if startDate:
        detectionQuery = detectionQuery.filter(Image.corrected_timestamp >= startDate)
    if endDate:
        detectionQuery = detectionQuery.filter(Image.corrected_timestamp <= endDate)

    if species and species != '0':
        label_list = _species_label_ids(task_ids, species)
        detectionQuery = detectionQuery.filter(Labelgroup.labels.any(Label.id.in_(label_list)))
    else:
        vhl = db.session.query(Label).get(GLOBALS.vhl_id)
        label_list = [GLOBALS.vhl_id, GLOBALS.nothing_id, GLOBALS.knocked_id]
        for task_id in task_ids:
            label_list.extend(getChildList(vhl, int(task_id)))
        detectionQuery = detectionQuery.filter(~Labelgroup.labels.any(Label.id.in_(label_list)))

    detectionQuery = _apply_distance_site_filters(detectionQuery, trapgroups, groups)
    return detectionQuery


def count_space_ntime_tte_detections(task_ids, survey_ids, species, trapgroups, groups, startDate, endDate, require_distance=False):
    if not task_ids or not survey_ids:
        return 0

    detectionQuery = db.session.query(func.count(distinct(Detection.id)))\
        .join(Image)\
        .join(Camera)\
        .join(Trapgroup)\
        .join(Labelgroup)\
        .join(Label, Labelgroup.labels)\
        .outerjoin(Sitegroup, Trapgroup.sitegroups)\
        .filter(Trapgroup.survey_id.in_(survey_ids))\
        .filter(Image.corrected_timestamp != None)\
        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
        .filter(or_(and_(Detection.source == model, Detection.score > Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
        .filter(Detection.static == False)

    if require_distance:
        detectionQuery = detectionQuery.filter(Detection.distance != None)

    detectionQuery = _apply_tte_detection_filters(
        detectionQuery, task_ids, species, trapgroups, groups, startDate, endDate
    )
    return int(detectionQuery.scalar() or 0)


def preflight_space_ntime_tte(task_ids, survey_ids, species, trapgroups, groups, startDate, endDate, area_mode):
    n_detections = count_space_ntime_tte_detections(
        task_ids, survey_ids, species, trapgroups, groups, startDate, endDate, require_distance=False
    )
    if n_detections == 0:
        return False, 'No species detections found for the selected filters.'

    if area_mode == 'fov':
        n_with_distance = count_space_ntime_tte_detections(
            task_ids, survey_ids, species, trapgroups, groups, startDate, endDate, require_distance=True
        )
        if n_with_distance == 0:
            return False, 'Field-of-view mode requires detection distances to derive effective detection radius and viewable area. Enter viewable area directly or add distance values to detections.'

    return True, None


def fetch_tte_distances(task_ids, survey_ids, species, trapgroups, groups, startDate, endDate):
    '''Returns positive Detection.distance values for TTE filters (species includes children).'''
    if not task_ids or not survey_ids or not species or species in ('0', '-1'):
        return []

    detectionQuery = db.session.query(Detection.id, Detection.distance)\
        .join(Image)\
        .join(Camera)\
        .join(Trapgroup)\
        .join(Labelgroup)\
        .join(Label, Labelgroup.labels)\
        .outerjoin(Sitegroup, Trapgroup.sitegroups)\
        .filter(Trapgroup.survey_id.in_(survey_ids))\
        .filter(Image.corrected_timestamp != None)\
        .filter(~Detection.status.in_(Config.DET_IGNORE_STATUSES))\
        .filter(or_(and_(Detection.source == model, Detection.score > Config.DETECTOR_THRESHOLDS[model]) for model in Config.DETECTOR_THRESHOLDS))\
        .filter(Detection.static == False)\
        .filter(Detection.distance != None)\
        .filter(Detection.distance > 0)

    detectionQuery = _apply_tte_detection_filters(
        detectionQuery, task_ids, species, trapgroups, groups, startDate, endDate
    )
    return [float(r[1]) for r in detectionQuery.distinct().all()]


def fit_half_normal_point_edd(distances):
    '''
    Fits a half-normal point-transect detection function and returns effective
    detection distance EDD = w * sqrt(P_a), with w = max observed distance.
    '''
    x = np.asarray(distances, dtype=float)
    x = x[np.isfinite(x) & (x > 0)]
    if x.size == 0:
        return None

    w = float(np.max(x))
    if w <= 0:
        return None

    n = int(x.size)
    sumsq = float(np.sum(x * x))

    def nll(sigma):
        if sigma <= 0:
            return np.inf
        s2 = sigma * sigma
        z = (w * w) / (2.0 * s2)
        if z > 700:
            one_m_e = 1.0
        else:
            one_m_e = 1.0 - math.exp(-z)
        if one_m_e <= 0:
            return np.inf
        return n * math.log(s2) + sumsq / (2.0 * s2) + n * math.log(one_m_e)

    fit = minimize_scalar(
        nll,
        bounds=(max(w / 100.0, 1e-6), max(w * 20.0, 1e-3)),
        method='bounded',
    )
    if not fit.success or fit.x is None:
        return None

    sigma = float(fit.x)
    s2 = sigma * sigma
    pa = (2.0 * s2 / (w * w)) * (1.0 - math.exp(-(w * w) / (2.0 * s2)))
    if pa <= 0:
        return None
    return w * math.sqrt(pa)


def compute_tte_viewable_area_from_fov(fov_degrees, distances):
    '''
    Derives EDD from a half-normal point model and sector viewable area (m²).
    Theta is the supplied camera field of view in degrees.
    '''
    if fov_degrees is None:
        return None, None
    try:
        fov = float(fov_degrees)
    except (TypeError, ValueError):
        return None, None
    if fov <= 0 or fov > 360:
        return None, None

    edd = fit_half_normal_point_edd(distances)
    if edd is None or edd <= 0:
        return None, None
    area = (fov / 360.0) * math.pi * (edd ** 2)
    return edd, area


def generate_tte_viewable_area(task_ids, survey_ids, species, trapgroups, groups, startDate, endDate, fov_degrees):
    '''
    Returns (ok, payload_or_message). On success payload has n_distances, edd_m, viewable_area_m2.
    '''
    if not species or species in ('0', '-1') or (isinstance(species, (list, tuple)) and (not species or species[0] in ('0', '-1'))):
        return False, 'Please select a species before generating viewable area.'

    if fov_degrees is None:
        return False, 'Please enter a valid camera field of view between 0 and 360 degrees.'
    try:
        fov = float(fov_degrees)
    except (TypeError, ValueError):
        return False, 'Please enter a valid camera field of view between 0 and 360 degrees.'
    if fov <= 0 or fov > 360:
        return False, 'Please enter a valid camera field of view between 0 and 360 degrees.'

    distances = fetch_tte_distances(
        task_ids, survey_ids, species, trapgroups, groups, startDate, endDate
    )
    n_distances = len(distances)
    if n_distances < TTE_MIN_DISTANCE_COUNT:
        return False, (
            'This species has {} detection distance{}. At least {} distances are required to generate viewable area.'.format(
                n_distances,
                '' if n_distances == 1 else 's',
                TTE_MIN_DISTANCE_COUNT,
            )
        )

    edd, area = compute_tte_viewable_area_from_fov(fov, distances)
    if edd is None or area is None or area <= 0:
        return False, 'Could not derive viewable area from field of view and detection distances.'

    return True, {
        'n_distances': n_distances,
        'effective_detection_radius_m': edd,
        'viewable_area_m2': area,
        'fov_degrees': fov,
    }
