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
    allPermissions = ['hidden','read','write','admin']
    requiredPermissions = allPermissions[allPermissions.index(requiredPermission):]
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    return sq.join(Organisation,Survey.organisation_id==Organisation.id)\
                .outerjoin(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
                .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
                .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
                .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
                .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
                .filter(or_(
                    # Organisation member has default permission
                    and_(UserPermissions.user_id==user_id,UserPermissions.default.in_(requiredPermissions),or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                    # Share organisation member has default permission
                    and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.default.in_(requiredPermissions),SurveyShare.permission.in_(requiredPermissions),or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                    # There is an exception for the survey (organisation member or share organisation)
                    and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.permission.in_(requiredPermissions))
                ))

def checkSurveyPermission(user_id,survey_id,requiredPermission):
    '''Adds the necessary SQLAlchemy filters to check if a user has the required permission for a survey.'''
    allPermissions = ['hidden','read','write','admin']
    requiredPermissions = allPermissions[allPermissions.index(requiredPermission):]
    ShareOrganisation = alias(Organisation)
    ShareUserPermissions = alias(UserPermissions)
    check = db.session.query(Survey)\
                .join(Organisation,Survey.organisation_id==Organisation.id)\
                .outerjoin(UserPermissions,UserPermissions.organisation_id==Organisation.id)\
                .outerjoin(SurveyShare,SurveyShare.survey_id==Survey.id)\
                .outerjoin(ShareOrganisation,ShareOrganisation.c.id==SurveyShare.organisation_id)\
                .outerjoin(ShareUserPermissions,ShareUserPermissions.c.organisation_id==ShareOrganisation.c.id)\
                .outerjoin(SurveyPermissionException,SurveyPermissionException.survey_id==Survey.id)\
                .filter(Survey.id==survey_id)\
                .filter(or_(
                    # Organisation member has default permission
                    and_(UserPermissions.user_id==user_id,UserPermissions.default.in_(requiredPermissions),or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                    # Share organisation member has default permission
                    and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.default.in_(requiredPermissions),SurveyShare.permission.in_(requiredPermissions),or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
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
                and_(UserPermissions.user_id==user_id,UserPermissions.annotation==True,or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                # Share organisation member has annotation permission
                and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.annotation==True,SurveyShare.permission=='write',or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
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
                and_(UserPermissions.user_id==user_id,UserPermissions.annotation==True,or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                # Share organisation member has annotation permission
                and_(ShareUserPermissions.c.user_id==user_id,ShareUserPermissions.c.annotation==True,SurveyShare.permission=='write',or_(SurveyPermissionException.id==None,SurveyPermissionException.user_id!=user_id)),
                # There is an exception for the survey (organisation member or share organisation)
                and_(SurveyPermissionException.user_id==user_id,SurveyPermissionException.annotation==True)
            )).first()
    return bool(check)

def updateUserAdminStatus(user_id):
    '''Updates a user's admin status based on their permissions.'''
    user = db.session.query(User).get(user_id)
    if user:
        user_permissions = db.session.query(UserPermissions).filter(UserPermissions.user_id==user_id).filter(UserPermissions.default != 'worker').count()
        if user_permissions > 0:
            user.admin = True
        else:
            user.admin = False

        db.session.commit()

    return True

def removeAdminNotifications(user_id, organisation_id):
    '''Removes all admin type notifications for a user in an organisation.'''

    organisation_name = db.session.query(Organisation.name).filter(Organisation.id==organisation_id).first()[0]
    user_default = db.session.query(UserPermissions.default).filter(UserPermissions.user_id==user_id).filter(UserPermissions.organisation_id==organisation_id).first()[0]

    if not user_default or user_default != 'admin':
        notif_contents = [
            organisation_name +' has a pending survey share request to ',   # Survey share request  (sender)
            ' with '+organisation_name+'. Do you',                          # Survey share request  (receiver)
            ' has been invited to join '+organisation_name+'.']             # Pending worker invite (sender)

        for notif_content in notif_contents:
            notifications = db.session.query(Notification).filter(Notification.user_id==user_id).filter(Notification.contents.contains(notif_content)).all()

            for notification in notifications:
                db.session.delete(notification)

        db.session.commit()

    return True

def checkDefaultAdminPermission(user_id, organisation_id):
    '''Checks if a user has admin permission for an organisation.'''

    user_default = db.session.query(UserPermissions.default).filter(UserPermissions.user_id==user_id).filter(UserPermissions.organisation_id==organisation_id).first()[0]

    if user_default and user_default == 'admin':
        return True
    else:
        return False
    