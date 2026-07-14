# Copyright 2026
# Depth worker image: TrapTagger depthworker + pinned depth-estimation-repo submodule.

FROM python:3.10.13

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /code

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      libgl1 \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      wget \
    && rm -rf /var/lib/apt/lists/*

COPY depthworker/requirements.txt /code/depthworker/requirements.txt
COPY depth-estimation-repo/requirements_v2.txt /code/depth-estimation-repo/requirements_v2.txt

RUN pip install --upgrade pip && \
    pip install -r /code/depthworker/requirements.txt && \
    pip install -r /code/depth-estimation-repo/requirements_v2.txt

COPY depthworker /code/depthworker
COPY depth-estimation-repo /code/depth-estimation-repo

ENV PYTHONPATH=/code:/code/depth-estimation-repo
