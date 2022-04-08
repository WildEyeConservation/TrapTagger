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

FROM nvidia/cuda:10.1-cudnn7-runtime-ubi7
FROM python:3.6.12
FROM tensorflow/tensorflow:1.15.0-gpu-py3
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git
RUN pip install --upgrade pip
RUN pip install -Iv numpy==1.18.5
RUN pip install torch==1.7.0+cu101 torchvision==0.8.1+cu101 torchaudio==0.7.0 -f https://download.pytorch.org/whl/torch_stable.html
WORKDIR /code
RUN pip install \
    celery\
    humanfriendly\
    jsonpickle\
    matplotlib\
    Pillow\
    requests\
    redis\
    tqdm\
    pandas\
    progressbar2\
    pylint\
    scikit-learn\
    xlrd\
    pillow-simd\
    boto3
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code/CameraTraps