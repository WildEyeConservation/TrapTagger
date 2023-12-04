#!/bin/bash

# Copyright 2023

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Launch script for the parallel worker. Sets environmental variables, launches the worker, and monitors idleness.
# Cleans up and shuts down the worker in the case of the spot instance being revoked, or the worker being idle.
echo "Initialising!"

export BASE_WORKER_NAME=$1
export QUEUE=$2
export FLASK_APP=/code/TrapTagger.py
export PYTHONPATH=/code
export REDIS_IP=$3
export DATABASE_NAME=$4
export HOST_IP=$5
export DNS=$6
export DATABASE_SERVER=$7
export AWS_ACCESS_KEY_ID=$8
export AWS_SECRET_ACCESS_KEY=$9
export REGION_NAME=${10}
export SECRET_KEY=${11}
export MAIL_USERNAME=${12}
export MAIL_PASSWORD=${13}
export BRANCH=${14}
export SG_ID=${15}
export PUBLIC_SUBNET_ID=${16}
export TOKEN=${17}
export PARALLEL_AMI=${18}
export KEY_NAME=${19}
export SETUP_PERIOD=${20}
export IDLE_MULTIPLIER=${21}
export MAIN_GIT_REPO=${22}
export CONCURRENCY=${23}
export MONITORED_EMAIL_ADDRESS=${24}
export BUCKET=${25}
export IAM_ADMIN_GROUP=${26}
export PRIVATE_SUBNET_ID=${27}
export AWS_S3_DOWNLOAD_ACCESS_KEY_ID=${28}
export AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY=${29}

printf \
'BASE_WORKER_NAME='$BASE_WORKER_NAME'\n'\
'QUEUE='$QUEUE'\n'\
'REDIS_IP='$REDIS_IP'\n'\
'DATABASE_NAME='$DATABASE_NAME'\n'\
'HOST_IP='$HOST_IP'\n'\
'DNS='$DNS'\n'\
'DATABASE_SERVER='$DATABASE_SERVER'\n'\
'AWS_ACCESS_KEY_ID='$AWS_ACCESS_KEY_ID'\n'\
'AWS_SECRET_ACCESS_KEY='$AWS_SECRET_ACCESS_KEY'\n'\
'REGION_NAME='$REGION_NAME'\n'\
'SECRET_KEY='$SECRET_KEY'\n'\
'MAIL_USERNAME='$MAIL_USERNAME'\n'\
'MAIL_PASSWORD='$MAIL_PASSWORD'\n'\
'BRANCH='$BRANCH'\n'\
'SG_ID='$SG_ID'\n'\
'PUBLIC_SUBNET_ID='$PUBLIC_SUBNET_ID'\n'\
'TOKEN='$TOKEN'\n'\
'PARALLEL_AMI='$PARALLEL_AMI'\n'\
'KEY_NAME='$KEY_NAME'\n'\
'SETUP_PERIOD='$SETUP_PERIOD'\n'\
'IDLE_MULTIPLIER='$IDLE_MULTIPLIER'\n'\
'MAIN_GIT_REPO='$MAIN_GIT_REPO'\n'\
'CONCURRENCY='$CONCURRENCY'\n'\
'MONITORED_EMAIL_ADDRESS='$MONITORED_EMAIL_ADDRESS'\n'\
'BUCKET='$BUCKET'\n'\
'IAM_ADMIN_GROUP='$IAM_ADMIN_GROUP'\n'\
'PRIVATE_SUBNET_ID='$PRIVATE_SUBNET_ID'\n'\
'AWS_S3_DOWNLOAD_ACCESS_KEY_ID='$AWS_S3_DOWNLOAD_ACCESS_KEY_ID'\n'\
'AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY='$AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY'\n'

num_procs=$(nproc)
for (( i=1; i<=num_procs; i++ ))
do
  export WORKER_NAME=$BASE_WORKER_NAME${i}
  echo "Starting $WORKER_NAME"
  docker run\
    -e PYTHONPATH\
    -e FLASK_APP\
    -e REDIS_IP\
    -e DATABASE_NAME\
    -e HOST_IP\
    -e DNS\
    -e DATABASE_SERVER\
    -e AWS_ACCESS_KEY_ID\
    -e AWS_SECRET_ACCESS_KEY\
    -e REGION_NAME\
    -e SECRET_KEY\
    -e MAIL_USERNAME\
    -e MAIL_PASSWORD\
    -e BRANCH\
    -e SG_ID\
    -e PUBLIC_SUBNET_ID\
    -e PRIVATE_SUBNET_ID\
    -e TOKEN\
    -e PARALLEL_AMI\
    -e KEY_NAME\
    -e QUEUE\
    -e WORKER_NAME\
    -e MAIN_GIT_REPO\
    -e MONITORED_EMAIL_ADDRESS\
    -e BUCKET\
    -e IAM_ADMIN_GROUP\
    -e AWS_S3_DOWNLOAD_ACCESS_KEY_ID\
    -e AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY\
    -v /home/ubuntu/TrapTagger:/code\
    -v /home/ubuntu/TrapTagger/wildbook-ia/wbia:/code/wbia\
    --name traptagger$i traptagger:1.1.0\
    celery -A app.celery worker -E -n ${WORKER_NAME} -Q ${QUEUE} -Ofair --concurrency=${CONCURRENCY} --loglevel=info\
    > worker$i.log 2>&1 &
done

# docker-compose -f /home/ubuntu/TrapTagger/parallel-docker-compose.yml up > worker.log 2>&1 &
LAUNCH_TIME="$(date -u +%s)"
echo "Containers launched"

AWS_TOKEN=`curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
echo "Token recieved"
flag=true
COUNT=0
IDLE_COUNT=0

while $flag; do
  sleep 5
  COUNT=$((COUNT+1))

  # Spot instance check
  echo "Checking spot status..."
  HTTP_CODE=$(curl -H "X-aws-ec2-metadata-token: $AWS_TOKEN" -s -w %{http_code} -o /dev/null http://169.254.169.254/latest/meta-data/spot/instance-action)
  if [[ "$HTTP_CODE" -eq 401 ]] ; then
    # Refreshing Authentication Token
    echo "Token needs refreshing"
    AWS_TOKEN=`curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 30"`
  elif [[ "$HTTP_CODE" -eq 200 ]] ; then
    # Spot instance has been re-allocated
    echo "Spot instance re-allocated! Shutting down..."
    for container in $(docker ps --format "{{.Names}}")
    do
      docker exec $container python3 cleanup_worker.py || STATUS=$?
      echo "$container cleanup status: "$STATUS
    done
    flag=false
  fi

  # Idleness check - after initial set-up period
  if [ $(($(date -u +%s)-$LAUNCH_TIME)) -ge $SETUP_PERIOD ] && [ $((COUNT/$IDLE_MULTIPLIER)) -ge 1 ]; then
    echo "Checking idleness.."
    COUNT=0
    OVERALL_STATUS=0
    for (( i=1; i<=num_procs; i++ ))
    do
      export WORKER_NAME=$BASE_WORKER_NAME${i}
      docker exec traptagger1 bash celery_worker_monitor.sh ${WORKER_NAME} || STATUS=$?
      echo "$WORKER_NAME STATUS="$STATUS
      if [ $STATUS == 50 ]; then
        OVERALL_STATUS=50
      fi
    done
    if [ $OVERALL_STATUS == 50 ]; then
      IDLE_COUNT=0
    else
      # Worker is idle or is in an error state
      IDLE_COUNT=$((IDLE_COUNT+1))
    fi
    if [ $IDLE_COUNT == 2 ]; then
      echo "Worker idle. Shutting down..."
      for container in $(docker ps --format "{{.Names}}")
      do
        docker exec $container python3 cleanup_worker.py || STATUS=$?
        echo "$container cleanup status: "$STATUS
      done
      flag=false
    fi
  fi

done

#Shut everything down
for container in $(docker ps --format "{{.Names}}")
do
  docker stop $container
done
echo "Containers shut down. Goodbye."
poweroff