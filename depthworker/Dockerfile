# Copyright 2026
# Production depth worker image: TrapTagger depthworker + depth-estimation-repo.
# CUDA 11.8 runtime for onnxruntime-gpu 1.18.x (host NVIDIA driver via --gpus all).

FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /code

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONPATH=/code:/code/depth-estimation-repo

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
      wget \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

COPY depthworker/requirements.txt /code/depthworker/requirements.txt
COPY depthworker/requirements_inference.txt /code/depthworker/requirements_inference.txt

RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir -r /code/depthworker/requirements.txt && \
    python -m pip install --no-cache-dir -r /code/depthworker/requirements_inference.txt

COPY depthworker /code/depthworker
COPY depth-estimation-repo /code/depth-estimation-repo
