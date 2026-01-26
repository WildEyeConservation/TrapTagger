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

FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubi8
FROM python:3.8.12
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git 
RUN apt-get install ffmpeg libsm6 libxext6 -y
RUN pip install --upgrade pip
RUN pip install torch==2.2.0+cu118 torchvision==0.17.1+cu118 torchaudio==2.2.0+cu118 --index-url https://download.pytorch.org/whl/cu118
RUN pip install ultralytics==8.4.7
WORKDIR /code
RUN pip install \
    celery==5.4.0\
    humanfriendly==10.0\
    jsonpickle==3.0.4\
    matplotlib==3.3.0\
    Pillow==10.3.0\
    requests==2.32.3\
    redis==5.0.4\
    tqdm==4.66.4\
    pandas==1.1.4\
    progressbar2==4.4.2\
    pylint==3.2.2\
    scikit-image==0.18.3\
    scikit-learn==1.0.1\
    xlrd==2.0.1\
    pillow-simd==9.0.0.post1\
    boto3==1.34.116\
    opencv-python==4.9.0.80\
    PyYAML==6.0.1\
    seaborn==0.9.0\
    yacs==0.1.8\
    numpy==1.19.3
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code