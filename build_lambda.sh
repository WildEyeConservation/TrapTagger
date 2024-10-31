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

# Launch script to update lambda functions code. Packages the code and updates the lambda functions.

echo "Updating Lambda functions!"
# Install zip
sudo apt-get install zip -y

cd lambda_functions
for dir in importImage importVideo extractVideo; do
    echo "Building Lambda function Code: $dir"
    cd $dir
    # Create a package directory and install the requirements
    mkdir -p package
    
    # Check if dir importImage
    if [ $dir == "importImage" ]; then
        pip install --platform manylinux2014_x86_64 --target=package --implementation cp --python-version 3.12 --only-binary=:all: --upgrade -r requirements.txt
    else 
        pip install --platform manylinux2014_x86_64 --target=package --implementation cp --python-version 3.9 --only-binary=:all: --upgrade -r requirements.txt
    fi

    # Check if zip file exists and remove it
    if [ -f lambda_function.zip ]; then
        rm lambda_function.zip
    fi
    
    # Zip the package and the lambda function
    cd package
    zip -r ../lambda_function.zip .
    cd ..
    zip lambda_function.zip lambda_function.py

    # Clean up the package directory
    rm -rf package
    cd ..

    echo "Successfully built Lambda function Code: $dir"
done
cd ..