from app.models import * 
from app.routes import * 

# Update textract , other costs & server costs
statistics = db.session.query(Statistic).filter(Statistic.total_cost != None).all()
# Cant get costs further than 14 months back
cutoff_date = datetime.now() - timedelta(days=30*13)
cutoff_date = cutoff_date.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
for statistic in statistics:
    startDate = (statistic.timestamp - timedelta(days=10)).replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    endDate = statistic.timestamp.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    if startDate < cutoff_date:
        statistic.textract_cost = 0
        statistic.other_cost = 0
    else:
        costs = get_AWS_costs(startDate,endDate)
        statistic.textract_cost=costs['Amazon Textract']
        statistic.other_cost=costs['Other']
        statistic.server_cost=costs['Amazon Elastic Compute Cloud']

db.session.commit()





