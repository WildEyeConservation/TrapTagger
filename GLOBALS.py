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

confusions = {}
emptyClustered = {}
megaDetectorMisses = {}
load_testers = 0
s3client = None
s3UploadClient = None
lock = None
nothing_id = 1
knocked_id = 2
wrong_id = 3
unknown_id = 4
vhl_id = 6
remove_false_detections_id = 7
mask_area_id = 8
results_queue = []
redisClient = None
ibs = None
lambdaClient = None
sqsClient = None
sqsQueueUrl = None