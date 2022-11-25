#!/bin/bash

# Copyright 2022

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

export WORKER_NAME=$1
export QUEUE=$2
export FLASK_APP=/code/TrapTagger.py
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
'WORKER_NAME='$WORKER_NAME'\n'\
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

docker-compose -f /home/ubuntu/TrapTagger/parallel-docker-compose.yml up > worker.log 2>&1 &
LAUNCH_TIME="$(date -u +%s)"
echo "Container launched"

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
    docker exec parallel_worker python3 cleanup_worker.py || STATUS=$?
    echo "Cleanup status: "$STATUS
    flag=false
  fi

  # Idleness check - after initial set-up period
  if [ $(($(date -u +%s)-$LAUNCH_TIME)) -ge $SETUP_PERIOD ] && [ $((COUNT/$IDLE_MULTIPLIER)) -ge 1 ]; then
    echo "Checking idleness.."
    COUNT=0
    docker exec parallel_worker bash celery_worker_monitor.sh || STATUS=$?
    echo "STATUS="$STATUS
    if [ $STATUS == 23 ] || [ $STATUS == 100 ]; then
      # Worker is idle or is in an error state
      IDLE_COUNT=$((IDLE_COUNT+1))
    else
      IDLE_COUNT=0
    fi
    if [ $IDLE_COUNT == 2 ]; then
      echo "Worker idle. Shutting down..."
      docker exec parallel_worker python3 cleanup_worker.py || STATUS=$?
      echo "Cleanup status: "$STATUS
      flag=false
    fi
  fi

done

docker-compose -f /home/ubuntu/TrapTagger/parallel-docker-compose.yml down
echo "Container shut down. Goodbye."
poweroff