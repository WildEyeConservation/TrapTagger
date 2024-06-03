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

# Launch script for the megadetector workers. Sets environmental variables, launches the workers, and monitors idleness.
# Cleans up and shuts down the workers in the case of the spot instance being revoked, or the workers being idle.
echo "Initialising!"
NUMGPUS=`nvidia-smi -L | wc -l`

export REDIS_IP=$2
export QUEUE=$3
export SETUP_PERIOD=$4
export IDLE_MULTIPLIER=$5
export AWS_ACCESS_KEY_ID=$6
export AWS_SECRET_ACCESS_KEY=$7
export WBIA_DB_NAME=$8
export WBIA_DB_SERVER=$9
export WBIA_DIR=${10}

printf \
'REDIS_IP='$REDIS_IP'\n'\
'QUEUE='$QUEUE'\n'\
'SETUP_PERIOD='$SETUP_PERIOD'\n'\
'IDLE_MULTIPLIER='$IDLE_MULTIPLIER'\n'\
'AWS_ACCESS_KEY_ID='$AWS_ACCESS_KEY_ID'\n'\
'AWS_SECRET_ACCESS_KEY='$AWS_SECRET_ACCESS_KEY'\n'\
'WBIA_DB_NAME='$WBIA_DB_NAME'\n'\
'WBIA_DB_SERVER='$WBIA_DB_SERVER'\n'\
'WBIA_DIR='$WBIA_DIR'\n'

for ((i=0;$((i<$NUMGPUS));i++)) do
  docker run -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e REDIS_IP --hostname worker$i@$1 -e WORKER_NAME=$1 -e QUEUE -e WORKER_NUMBER=$i -e CUDA_VISIBLE_DEVICES=$i -e WBIA_DB_NAME -e WBIA_DB_SERVER -e WBIA_DIR -v /home/ubuntu/TrapTagger/gpuworker:/code/gpuworker -v /home/ubuntu/TrapTagger/CameraTraps/detection:/code/CameraTraps/detection -v /home/ubuntu/TrapTagger/CameraTraps/data_management:/code/CameraTraps/data_management -v /home/ubuntu/TrapTagger/CameraTraps/visualization:/code/CameraTraps/visualization -v /home/ubuntu/TrapTagger/CameraTraps/ct_utils.py:/code/CameraTraps/ct_utils.py -v /home/ubuntu/TrapTagger/gpuworker/init.py:/code/ScarceNet/lib/models/__init__.py -v /home/ubuntu/TrapTagger/wildbook-ia/wbia:/code/wbia --gpus all --ipc=host --name gpuworker$i gpu_worker celery -A gpuworker.worker worker -Q $QUEUE -Ofair --concurrency=1 -l info > worker$i.log 2>&1 &
  echo "Docker container launched!"
done

LAUNCH_TIME="$(date -u +%s)"
AWS_TOKEN=`curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
echo "Token recieved."
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
    for ((i=0;$((i<$NUMGPUS));i++)) do
      docker exec gpuworker$i python3 gpuworker/cleanup_worker.py || STATUS=$?
      echo "Cleanup status: "$STATUS
    done
    flag=false
  fi

  # Idleness check - after initial set-up period
  if [ $(($(date -u +%s)-$LAUNCH_TIME)) -ge $SETUP_PERIOD ] && [ $((COUNT/$IDLE_MULTIPLIER)) -ge 1 ]; then
    echo "Checking idleness.."
    COUNT=0
    docker exec gpuworker0 bash gpuworker/celery_worker_monitor.sh || STATUS=$?
    echo "STATUS="$STATUS
    if [ $STATUS == 23 ] || [ $STATUS == 100 ]; then
      # Worker is idle or is in an error state
      IDLE_COUNT=$((IDLE_COUNT+1))
    else
      IDLE_COUNT=0
    fi
    if [ $IDLE_COUNT == 2 ]; then
      echo "Worker idle. Shutting down..."
      for ((i=0;$((i<$NUMGPUS));i++)) do
        docker exec gpuworker$i python3 gpuworker/cleanup_worker.py || STATUS=$?
        echo "Cleanup status: "$STATUS
      done
      flag=false
    fi
  fi

done

for ((i=0;$((i<$NUMGPUS));i++)) do
  docker stop gpuworker$i
done

echo "Containers shut down. Goodbye."
poweroff