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

# Script for monitoring the local worker's status.
# 50 -> busy
# 23 -> idle
# 100 -> error state
{
  RESPONSE=$(celery -A gpuworker.worker inspect -d celery@worker$WORKER_NUMBER@$WORKER_NAME active)
} || {
  exit 100
}
if grep -q "empty" <<< "$RESPONSE"; then
  exit 23
fi
exit 50
