from app.models import *
from app.routes import *
users = db.session.query(User).filter(User.admin == True).all()
for user in users:
    organisation = Organisation(name=user.username, root_user_id=user.id, affiliation=user.affiliation, regions=user.regions, folder=user.folder, cloud_access=user.cloud_access, image_count=user.image_count, previous_image_count=user.previous_image_count)
    db.session.add(organisation)
    for survey in user.surveys:
        survey.organisation_id = organisation.id
    user.surveys = []
    userPermissions = UserPermissions(organisation_id=organisation.id, user_id=user.id, delete=True, create=True, annotation=True, default='write')
    db.session.add(userPermissions)
    for worker in user.workers:
        userPermissions = UserPermissions(organisation_id=organisation.id, user_id=worker.id, delete=False, create=False, annotation=True, default='worker')
        db.session.add(userPermissions)
    db.session.commit()