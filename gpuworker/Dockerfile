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

FROM nvidia/cuda:11.4.1-cudnn8-runtime-ubi8
FROM python:3.8.12
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git 
RUN apt-get install ffmpeg libsm6 libxext6 postgresql -y
RUN apt-get install wget
RUN apt-get install unzip
RUN pip install --upgrade pip
RUN pip3 install torch torchvision torchaudio
WORKDIR /code
RUN wget "https://github.com/microsoft/CameraTraps/releases/download/v5.0/md_v5a.0.0.pt"
RUN wget "https://github.com/microsoft/CameraTraps/releases/download/v5.0/md_v5b.0.0.pt"
RUN wget "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
RUN git clone https://github.com/ultralytics/yolov5.git && cd yolov5 && git checkout 2e10909
RUN mkdir CameraTraps
RUN cp -r yolov5/utils CameraTraps/utils
RUN cp -r yolov5/models CameraTraps/models
RUN git clone https://github.com/chaneyddtt/ScarceNet.git && cd ScarceNet && git checkout df4fa6b
RUN pip install gdown
ENV PATH="$HOME/.local/bin:$PATH"
RUN gdown https://drive.google.com/uc?id=1MQGyyf1MQjETRG_CRBMEfrV0IFiis_ZQ
RUN unzip -p ScarceNet_final_models.zip ScarceNet_final_models/output_part25_updatev2/model_best.pth > model_best.pth
RUN rm ScarceNet_final_models.zip
RUN pip install \
    celery==5.4.0\
    -e git+https://github.com/facebookresearch/segment-anything.git@6fdee8f2727f4506cfbbe553e23b895e27956588#egg=segment-anything\
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
    numpy==1.19.3\
    wbia-pyflann==3.3.0\
    wbia-pyhesaff==3.0.2\
    wbia-utool==3.4.0\
    wbia-vtool==3.3.0\
    SQLAlchemy==1.4.50\
    psycopg2-binary==2.9.5\
    Deprecated==1.2.12\
    Flask==1.1.1\
    Jinja2==3.0.3\
    itsdangerous==2.0.1\
    Werkzeug==0.16.0\
    lockfile==0.12.2\
    oauthlib==3.2.0\
    requests_oauthlib==1.3.1\
    simplejson==3.17.3\
    tornado==6.1\
    pynmea2==1.18.0\
    pyzmq==22.1.0\
    ultralytics==8.4.7
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code:/code/CameraTraps:/code/ScarceNet