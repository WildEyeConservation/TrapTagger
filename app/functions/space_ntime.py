'''Pre-flight validation for spaceNtime TTE abundance analyses.'''

from sqlalchemy.sql import func, or_, and_, distinct

import GLOBALS
from app import db
from app.models import *
from app.functions.globals import getChildList
from config import Config


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
