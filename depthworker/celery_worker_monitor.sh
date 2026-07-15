#!/bin/bash

# Copyright 2026
#
# Script for monitoring the local depth worker's status.
# 50 -> busy
# 23 -> idle
# 100 -> error state
{
  RESPONSE=$(celery -A depthworker.worker inspect -d celery@worker$WORKER_NUMBER@$WORKER_NAME active)
} || {
  exit 100
}
PATTERN="celery@worker'"$WORKER_NUMBER@$WORKER_NAME"': OK"$'\n'"    - empty -"
if grep -q "$PATTERN" <<< "$RESPONSE"; then
  exit 23
fi
exit 50
