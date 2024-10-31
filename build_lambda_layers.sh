#!/bin/bash

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


# Script to build the Lambda layers

echo "Building Lambda layers!"
sudo apt-get install zip -y
sudo apt-get install wget -y
sudo apt-get install python3.9 -y

echo "Building Lambda layer: ffmpeg and ffprobe"

cd lambda_functions

# Get the ffmpeg and ffprobe binaries and extract them
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5
md5sum -c ffmpeg-release-amd64-static.tar.xz.md5
tar -xf ffmpeg-release-amd64-static.tar.xz

# Create a layer for ffmpeg (Create a directory and copy the ffmpeg binary)
mkdir -p ffmpeg/bin
cp ffmpeg-*/ffmpeg ffmpeg/bin/
cd ffmpeg
zip -r ffmpeg.zip .
cd ..

# Create a layer for ffprobe (Create a directory and copy the ffprobe binary)
mkdir -p ffprobe/bin
cp ffmpeg-*/ffprobe ffprobe/bin/
cd ffprobe
zip -r ffprobe.zip .
cd ..

# Copy the zips to lambda_functions dir and clean up
cp ffmpeg/ffmpeg.zip ffmpeg.zip
cp ffprobe/ffprobe.zip ffprobe.zip

rm -rf ffmpeg
rm -rf ffprobe
rm -rf ffmpeg-*

echo "Successfully built ffmpeg and ffprobe Lambda packages!"

echo "Building Lambda layer: OpenCV"

# Build the OpenCV Lambda layer (Create a directory and install OpenCV)
mkdir -p build/python 
python3.9 -m pip install opencv-python-headless -t build/python  # Note: Install python3.9 if not installed
cd build
zip -r opencv.zip .
cd ..

# Copy the zip to lambda_functions dir and clean up
cp build/opencv.zip opencv.zip
rm -rf build

echo "Successfully built OpenCV Lambda package!"

cd ..
echo "Lambda layers built successfully!"