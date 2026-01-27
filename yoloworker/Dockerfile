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

FROM nvidia/cuda:10.2-cudnn8-runtime
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
        git \
        python3.8 \
        python3.8-dev \
        python3-pip \
        ffmpeg \
        libsm6 \
        libxext6 && \
    rm -rf /var/lib/apt/lists/*
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.8 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1
RUN pip install --upgrade pip
RUN pip install torch==1.8.2+cu102 torchvision==0.9.2+cu102 torchaudio==0.8.2 -f https://download.pytorch.org/whl/torch_stable.html
WORKDIR /code
RUN pip install \
    ultralytics==8.0.20 \
    celery==5.2.7 \
    redis==4.6.0 \
    boto3==1.26.165 \
    requests==2.28.2 \
    tqdm==4.65.0 \
    pillow==9.5.0 \
    opencv-python==4.6.0.66 \
    numpy==1.21.6 \
    pandas==1.3.5 \
    scikit-learn==1.0.2 \
    scikit-image==0.19.3 \
    matplotlib==3.5.3 \
    PyYAML==6.0 \
    yacs==0.1.8
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code