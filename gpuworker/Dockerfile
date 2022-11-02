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
RUN rm /etc/apt/sources.list.d/cuda.list
RUN rm /etc/apt/sources.list.d/nvidia-ml.list
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git
RUN apt-get install ffmpeg libsm6 libxext6  -y
RUN apt-get install wget
RUN pip install --upgrade pip
RUN pip install -Iv numpy==1.18.5
RUN pip3 install torch torchvision torchaudio
WORKDIR /code
RUN wget "https://github.com/microsoft/CameraTraps/releases/download/v5.0/md_v5a.0.0.pt"
RUN wget "https://github.com/microsoft/CameraTraps/releases/download/v5.0/md_v5b.0.0.pt"
RUN git clone https://github.com/ultralytics/yolov5.git
RUN mkdir CameraTraps
RUN cp -r yolov5/utils CameraTraps/utils
RUN cp -r yolov5/models CameraTraps/models
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
    boto3\
    opencv-python\
    PyYAML\
    seaborn
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code/CameraTraps