# Copyright 2026
# MiewID GPU worker image: CUDA runtime + Python deps.
# Model weights (SAM, ScarceNet, miewid-msv3) are expected under /opt/models on the AMI
# and mounted at launch. ScarceNet source is mounted from the TrapTagger checkout.

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /code

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONPATH=/code:/code/ScarceNet \
    MIEWID_MODEL_DIR=/opt/models/miewid-msv3-4f1d7f2b \
    SAM_CHECKPOINT=/opt/models/sam_vit_h_4b8939.pth \
    SCARCENET_CHECKPOINT=/opt/models/model_best.pth

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-dev \
      ca-certificates \
      libgl1 \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      git \
      wget \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

COPY miewID_worker/requirements.txt /code/miewID_worker/requirements.txt

RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir \
      torch torchvision --index-url https://download.pytorch.org/whl/cu124 && \
    python -m pip install --no-cache-dir -r /code/miewID_worker/requirements.txt && \
    python -m pip install --no-cache-dir \
      -e git+https://github.com/facebookresearch/segment-anything.git@6fdee8f2727f4506cfbbe553e23b895e27956588#egg=segment-anything

# Worker code is bind-mounted at launch for easy updates; copy a stub so the
# image still has the package layout if run without a mount.
COPY miewID_worker /code/miewID_worker
