#!/bin/bash

# Copyright 2026
#
# Launch script for depth estimation workers. Sets environmental variables,
# launches the worker container, and monitors idleness / spot interruption.

echo "Initialising!"
NUMGPUS=`nvidia-smi -L | wc -l`

export REDIS_IP=$2
export QUEUE=$3
export SETUP_PERIOD=$4
export IDLE_MULTIPLIER=$5
export AWS_ACCESS_KEY_ID=$6
export AWS_SECRET_ACCESS_KEY=$7

printf \
'REDIS_IP='$REDIS_IP'\n'\
'QUEUE='$QUEUE'\n'\
'SETUP_PERIOD='$SETUP_PERIOD'\n'\
'IDLE_MULTIPLIER='$IDLE_MULTIPLIER'\n'\
'AWS_ACCESS_KEY_ID='$AWS_ACCESS_KEY_ID'\n'\
'AWS_SECRET_ACCESS_KEY='$AWS_SECRET_ACCESS_KEY'\n'

for ((i=0;$((i<$NUMGPUS));i++)) do
  docker run \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e REDIS_IP \
    -e DEPTH_BBOX_AUDIT=0 \
    --hostname worker$i@$1 \
    -e WORKER_NAME=$1 \
    -e QUEUE \
    -e WORKER_NUMBER=$i \
    -e CUDA_VISIBLE_DEVICES=$i \
    -v /home/ubuntu/TrapTagger/depthworker:/code/depthworker \
    -v /home/ubuntu/TrapTagger/depth-estimation-repo:/code/depth-estimation-repo \
    --gpus all \
    --ipc=host \
    --name depthworker$i \
    depth_worker \
    celery -A depthworker.worker worker -Q $QUEUE -Ofair --concurrency=1 -l info \
    > worker$i.log 2>&1 &
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

  echo "Checking spot status..."
  HTTP_CODE=$(curl -H "X-aws-ec2-metadata-token: $AWS_TOKEN" -s -w %{http_code} -o /dev/null http://169.254.169.254/latest/meta-data/spot/instance-action)
  if [[ "$HTTP_CODE" -eq 401 ]] ; then
    echo "Token needs refreshing"
    AWS_TOKEN=`curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 30"`
  elif [[ "$HTTP_CODE" -eq 200 ]] ; then
    echo "Spot instance re-allocated! Shutting down..."
    for ((i=0;$((i<$NUMGPUS));i++)) do
      docker exec depthworker$i python3 depthworker/cleanup_worker.py || STATUS=$?
      echo "Cleanup status: "$STATUS
    done
    flag=false
  fi

  if [ $(($(date -u +%s)-$LAUNCH_TIME)) -ge $SETUP_PERIOD ] && [ $((COUNT/$IDLE_MULTIPLIER)) -ge 1 ]; then
    echo "Checking idleness.."
    COUNT=0
    docker exec depthworker0 bash depthworker/celery_worker_monitor.sh || STATUS=$?
    echo "STATUS="$STATUS
    if [ $STATUS == 23 ] || [ $STATUS == 100 ]; then
      IDLE_COUNT=$((IDLE_COUNT+1))
    else
      IDLE_COUNT=0
    fi
    if [ $IDLE_COUNT == 2 ]; then
      echo "Worker idle. Shutting down..."
      for ((i=0;$((i<$NUMGPUS));i++)) do
        docker exec depthworker$i python3 depthworker/cleanup_worker.py || STATUS=$?
        echo "Cleanup status: "$STATUS
      done
      flag=false
    fi
  fi

done

for ((i=0;$((i<$NUMGPUS));i++)) do
  docker stop depthworker$i
done

echo "Containers shut down. Goodbye."
poweroff
