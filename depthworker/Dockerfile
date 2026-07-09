# Copyright 2026
# Skeleton depth worker image (CPU). Add CUDA + depth repo deps when integrating real model.

FROM python:3.10.13

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /code

COPY requirements.txt /code/depthworker/requirements.txt
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --upgrade pip && \
    pip install -r /code/depthworker/requirements.txt

# Bake package layout; dev compose will bind-mount over this
COPY . /code/depthworker/

ENV PYTHONPATH=/code