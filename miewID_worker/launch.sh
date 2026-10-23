#!/bin/bash

# Copyright 2026
#
# Launch script for MiewID GPU workers (queue: miewid).
# Sets env vars, launches the docker worker(s), monitors spot interruption
# and idleness, then powers off — same pattern as depthworker/gpuworker.

echo "Initialising!"
NUMGPUS=`nvidia-smi -L | wc -l`

export REDIS_IP=$2
export QUEUE=$3
export SETUP_PERIOD=$4
export IDLE_MULTIPLIER=$5
export AWS_ACCESS_KEY_ID=$6
export AWS_SECRET_ACCESS_KEY=$7
# Optional overrides (AMI defaults live in miewID_worker.config / docker image):
#   MIEWID_MODEL_DIR, SAM_CHECKPOINT, SCARCENET_CHECKPOINT, MIEWID_EMBED_BATCH

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
    -e MIEWID_MODEL_DIR \
    -e SAM_CHECKPOINT \
    -e SCARCENET_CHECKPOINT \
    -e SCARCENET_CFG \
    -e MIEWID_EMBED_BATCH \
    --hostname worker$i@$1 \
    -e WORKER_NAME=$1 \
    -e QUEUE \
    -e WORKER_NUMBER=$i \
    -e CUDA_VISIBLE_DEVICES=$i \
    -v /home/ubuntu/TrapTagger/miewID_worker:/code/miewID_worker \
    -v /home/ubuntu/TrapTagger/ScarceNet:/code/ScarceNet \
    -v /home/ubuntu/TrapTagger/gpuworker/init.py:/code/ScarceNet/lib/models/__init__.py \
    -v /opt/models:/opt/models \
    --gpus all \
    --ipc=host \
    --name miewidworker$i \
    miewid_worker \
    celery -A miewID_worker.worker worker -Q $QUEUE -Ofair --concurrency=1 -l info \
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
      docker exec miewidworker$i python3 miewID_worker/cleanup_worker.py || STATUS=$?
      echo "Cleanup status: "$STATUS
    done
    flag=false
  fi

  if [ $(($(date -u +%s)-$LAUNCH_TIME)) -ge $SETUP_PERIOD ] && [ $((COUNT/$IDLE_MULTIPLIER)) -ge 1 ]; then
    echo "Checking idleness.."
    COUNT=0
    docker exec miewidworker0 bash miewID_worker/celery_worker_monitor.sh || STATUS=$?
    echo "STATUS="$STATUS
    if [ $STATUS == 23 ] || [ $STATUS == 100 ]; then
      IDLE_COUNT=$((IDLE_COUNT+1))
    else
      IDLE_COUNT=0
    fi
    if [ $IDLE_COUNT == 2 ]; then
      echo "Worker idle. Shutting down..."
      for ((i=0;$((i<$NUMGPUS));i++)) do
        docker exec miewidworker$i python3 miewID_worker/cleanup_worker.py || STATUS=$?
        echo "Cleanup status: "$STATUS
      done
      flag=false
    fi
  fi

done

for ((i=0;$((i<$NUMGPUS));i++)) do
  docker stop miewidworker$i
done

echo "Containers shut down. Goodbye."
poweroff
