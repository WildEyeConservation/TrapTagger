from app import app, db, celery
from app.models import *
from app.functions.globals import *
import GLOBALS
from sqlalchemy.sql import func, or_, and_, alias
from sqlalchemy import desc
from config import Config
import traceback

def surveyPermissionsSQ(sq,user_id,requiredPermission):
    '''Adds the necessary SQLAlchemy filters to check if a user has the required permission for a survey.'''
    allPermissions = ['read','write']
    requiredPermissions = allPermissions[allPermissions.index(requiredPermission):]
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    return sq.join(Organisation,Survey.organisation_id==Organisation.id)\
                .join(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
                .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
                .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
                .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
                .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
                .filter(or_(
                    # Organisation member has default permission
                    and_(UserPermissions.user_id==user_id,UserPermissions.default.in_(requiredPermissions),SurveyPermissionException.id==None),
                    # Share organisation member has default permission
                    and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.default.in_(requiredPermissions),SurveyShare.permission.in_(requiredPermissions),SurveyPermissionException.id==None),
                    # There is an exception for the survey (organisation member or share organisation)
                    and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.permission.in_(requiredPermissions))
                ))

def checkSurveyPermission(user_id,survey_id,requiredPermission):
    '''Adds the necessary SQLAlchemy filters to check if a user has the required permission for a survey.'''
    allPermissions = ['read','write']
    requiredPermissions = allPermissions[allPermissions.index(requiredPermission):]
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    check = db.session.query(Survey)\
                .join(Organisation,Survey.organisation_id==Organisation.id)\
                .join(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
                .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
                .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
                .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
                .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
                .filter(Survey.id==survey_id)\
                .filter(or_(
                    # Organisation member has default permission
                    and_(UserPermissions.user_id==user_id,UserPermissions.default.in_(requiredPermissions),SurveyPermissionException.id==None),
                    # Share organisation member has default permission
                    and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.default.in_(requiredPermissions),SurveyShare.permission.in_(requiredPermissions),SurveyPermissionException.id==None),
                    # There is an exception for the survey (organisation member or share organisation)
                    and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.permission.in_(requiredPermissions))
                )).first()
    return bool(check)

def annotationPermissionSQ(sq,user_id):
    '''Adds the necessary SQLAlchemy filters to check if a user has annotation permission for a task.'''
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    return sq.join(Organisation,Organisation.id==Survey.organisation_id)\
            .outerjoin(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
            .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
            .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
            .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
            .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
            .filter(or_(
                # Organisation member has annotation permission
                and_(UserPermissions.user_id==user_id,UserPermissions.annotation==True,SurveyPermissionException.id==None),
                # Share organisation member has annotation permission
                and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.annotation==True,SurveyShare.permission=='write',SurveyPermissionException.id==None),
                # There is an exception for the survey (organisation member or share organisation)
                and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.annotation==True)
            ))

def checkAnnotationPermission(user_id,task_id):
    '''Checks if a user has annotation permission for a given task.'''
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    check = db.session.query(Task)\
            .join(Survey,Survey.id==Task.survey_id)\
            .join(Organisation,Organisation.id==Survey.organisation_id)\
            .outerjoin(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
            .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
            .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
            .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
            .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
            .filter(Task.id==task_id)\
            .filter(or_(
                # Organisation member has annotation permission
                and_(UserPermissions.user_id==user_id,UserPermissions.annotation==True,SurveyPermissionException.id==None),
                # Share organisation member has annotation permission
                and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.annotation==True,SurveyShare.permission=='write',SurveyPermissionException.id==None),
                # There is an exception for the survey (organisation member or share organisation)
                and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.annotation==True)
            )).first()
    return bool(check)