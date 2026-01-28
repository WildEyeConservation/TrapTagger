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
FROM nvidia/cuda:10.2.89-cudnn8-runtime-ubuntu20.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

RUN python -m pip install --upgrade pip setuptools wheel

WORKDIR /code

RUN pip install torch==2.2.1+cu102 torchvision==0.17.1+cu102 torchaudio==2.2.1+cu102 --index-url https://download.pytorch.org/whl/cu102

RUN pip install \
    ultralytics==8.4.7\
    celery==5.4.0\
    Pillow==10.3.0\
    redis==5.0.4\
    boto3==1.34.116\
    opencv-python==4.9.0.80\
    PyYAML==6.0.1\
    numpy==1.26.4

ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code