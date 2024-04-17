FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubi8
FROM python:3.10.13
ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /code
COPY requirements.txt .
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y  git\
                        bzip2\
                        ca-certificates\
                        openssl\
                        sqlite3\
                        tk
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV PYTHONPATH=/code
