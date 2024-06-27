from app.models import *
from app.routes import *
users = db.session.query(User).filter(User.admin == True).all()
for user in users:
    organisation = Organisation(name=user.username, root_user_id=user.id, affiliation=user.affiliation, regions=user.regions, folder=user.folder, cloud_access=user.cloud_access, image_count=user.image_count, previous_image_count=user.previous_image_count)
    db.session.add(organisation)
    db.session.commit()
    for survey in user.surveys:
        survey.organisation_id = organisation.id
    user.surveys = []
    userPermissions = UserPermissions(organisation_id=organisation.id, user_id=user.id, delete=True, create=True, annotation=True, default='admin')
    db.session.add(userPermissions)
    for worker in user.workers:
        userPermissions = UserPermissions(organisation_id=organisation.id, user_id=worker.id, delete=False, create=False, annotation=True, default='worker')
        db.session.add(userPermissions)
    db.session.commit()
statistics = db.session.query(Statistic).all()
for statistic in statistics:
    statistic.organisation_count = statistic.user_count
    statistic.unique_daily_organisation_logins = statistic.unique_daily_admin_logins
    statistic.average_daily_organisation_logins = statistic.average_daily_admin_logins
    statistic.unique_monthly_organisation_logins = statistic.unique_monthly_admin_logins
db.session.commit()
images = db.session.query(Image).filter(Image.downloaded==True).limit(5000).all()
while images:
    for image in images:
        image.downloaded = False
    db.session.commit()
    images = db.session.query(Image).filter(Image.downloaded==True).limit(5000).all()
videos = db.session.query(Video).filter(Video.downloaded==True).limit(5000).all()
while videos:
    for video in videos:
        video.downloaded = False
    db.session.commit()
    videos = db.session.query(Video).filter(Video.downloaded==True).limit(5000).all()