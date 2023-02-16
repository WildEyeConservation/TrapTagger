![WildEye Conservation Logo](https://wildeyeconservation.org/wp-content/uploads/2021/03/Wild-Eye-Logo-Web.png)

# TrapTagger: AI-Powered Camera-Trap Imagery Processing

# Table of Contents

1. [Overview](#overview)
2. [Who](#who)
3. [Acknowledgement](#acknowledgement)
4. [Partners](#partners)
5. [Setup](#setup)
6. [Using the Site](#using-the-site)
7. [Updates](#updates)
8. [Load Testing](#load-testing)
9. [Species-Classifier Training](#species-classifier-training)
10. [License](#license)
11. [Contact](#contact)

# Overview

Camera traps are an invaluable tool for analysing wildlife populations. However, the sheer amount of data they generate can be overwhelming – to annotate, organise, and analyse. That’s where TrapTagger comes in: A powerful web-based application that leverages the latest artificial intelligence technologies to massively reduce your workload, allowing you to focus on what’s important – your research.

TrapTagger allows for a hybridised approach between automatic AI classifications and manual annotations with an efficient, and user-friendly interface. It has been developed in close collaboration with the University of Oxford’s Wildlife Conservation Research Unit (WildCRU) through 3rd party philanthropic funding. Together, we have gone back into their archives to annotate, manage, and organise more than 30 surveys conducted over the past decade, totalling in excess of 1 million images from a number of wildlife reserves throughout Southern Africa. With this dataset, we were able to train a state-of-the-art species classifier that can accurately identify 55 different Southern African species, thus making the journey much easier for any ecologists who wish to follow in their footsteps.

This repo allows you to set up an instance of TrapTagger for your own use. However, should you not be technically inclined, or wish to get started right away, you can sign up for a free account [here](https://traptagger.co.uk). Additionally, you can read more about TrapTagger [here](https://wildeyeconservation.org/traptagger/), or find all applicable documentation [here](https://wildeyeconservation.org/documentation/).

# Who

This repo is maintained by [WildEye Conservation](https://wildeyeconservation.org/) - an organisation dedicated to using technology, and machine vision in particular, to further the conservation and protection of wildlife.

# Acknowledgement

You are welcome to use this software free of charge. In return we only ask that you acknowledge the use of TrapTagger wherever appropriate in your work. We are also always excited to hear where our work is being used, so please let us know if you are using our software.

# Partners

![WildCRU Logo](https://wildeyeconservation.org/wp-content/uploads/2021/04/wildcru.png)

TrapTagger was developed in conjunction with the Wildlife Conservation Research Unit (WildCRU), which forms part of Oxford University's Department of Zoology.

# Setup

TrapTagger has been setup to be operated on Amazon Web Services (AWS). However, it can easily be modified to operate locally or on any other cloud computing services. In all cases, the specific instance used is up to your descretion, depending on the load you expect. Suggested instances will be provided throughout.

## AWS

First off, you must create an AWS account, and set up a number of instances. All instances should be within a single region. Select your region in the top right-hand corner in the web console. Note that most of the recommended instances do come with a monetary cost.

### Server

To create a server for your instance of TrapTagger, navigate to EC2 on the AWS web console and do the following:

- Launch a new instance by clicking on the appropriate button on the home page
- Give your instance a name
- Optionally add informational tags (but this is not necessary) 
- Next you must select an AMI image
    - Any operating system will work if you are comfortable working with it, but an Ubuntu 20.04 AMI is recommended if you are following these instructions
    - Simply scroll down the quick start options and take the first Ubuntu 20.04 AMI
    - 64-bit (x86) should be selected
- Select an instance type
    - This is the performance characteristics of your server
    - Select an instance based on the load you expect to encounter
    - t2.xlarge is recommended
- Create a key pair
    - Select to create a new key pair
    - Leave the default type
    - Give it a name
    - Download it
- Set the storage to 40GB
- Edit network settings
    - Create security group
    - Optionallly give it a name and description
    - Add the following security group rules:

        |Type       |Port   |Source                                                          |
        |-----------|-------|----------------------------------------------------------------|
        |SSH        |22     |anywhere                                                        |
        |HTTP       |80     |anywhere                                                        |
        |HTTPS      |443    |anywhere                                                        |

- View summary
- Click launch instance


Once your server has launched:

- Navigate to your EC2 instances page in the console
- Select your instance
- Find and save these values for later:
    - Subnet ID
    - Private IPv4 address
    - Public IPv4 address
    - Public IPv4 DNS
- Navigate to your instance's security tab
- Follow the link to your security group
- Save your security group and VPC IDs for later use
- Select edit inbound rules
- Add two rules

    |Type        |Port   |Source                                                          |
    |------------|-------|----------------------------------------------------------------|
    |Custom TCP  |6379   |Custom (Enter your security group ID into the search box)       |
    |MYSQL/Aurora|3306   |Custom (Enter your security group ID into the search box)       |

- Save rules

### Virtual Private Cloud (VPC)

For security reasons, one wants to ensure that third-party classifiers do not have access to the internet. This is achived using your VPC by creating two different subnets - a private one without internet access and a public one with access. 

- Open the AWS console. 
- Select the subnets option in the side tab and view the list of subnets. 
- Choose the subnet from the list that is the same as your subnet ID from your server as your public subnet
- Give the subnet a useful name 
- Save the name and ID of the subnet for later
- Choose another subnet from the list as your private subnet
- Give the subnet a useful name
- Save the name and ID of the subnet for later

If there are not enough default subnets created, create a new subnet:
- Click the create subnet button
- Select the VPC where you launched your server above
- Give this private subnet a useful name
- Choose a IPv4 CIDR block (that uses a variation of the IP address of your VPC)
- Click create subnet
- Save the name and ID of this subnet for later

You now need to control what access those subnets have. This is done with route tables. Your default route table should (by default) route your default subnet to the VPC's internet gateway. This means you need to create a new route table for your private subnet that does not route it to the internet:

- Navigate to the route tables in the VPC console
- Click create new route table
- Give this new private route table a useful name
- Select the VPC where you launched the server
- Click create
- Select your new private route table you created
- Select the subnet associations tab
- Click edit subnet associations
- Find and select your private subnet and save the association
- Select your default route table (it should be the only other one associated with your VPC)
- Open the subnet associations tab and click on the edit associations button
- Find and select your default subnet (public subnet) where you created your server
- Save this association

Lastly, your instances typically connect to other AWS services through the internet, so in order for your classifiers in your private subnet to access your images in S3, you need to set up a private gateway to S3:

- Navigate to the Endpoints section in your VPC console
- Click create endpoint
- Give this enpoint a useful name
- Select the 'AWS services' service category
- Search for the S3 service and select the only gateway option
- Select your VPC
- Select your private route table and a 'full access' policy
- Create endpoint

### Database

Open the RDS service on your AWS console, and create a new database. Use the following settings:

- Engine type: Amazon Aurora
- Edition: MySQL-compatible
- Version: Latest
- Choose your own identifier, username and password
- Instance configuration: Serverless (if not available choose a version that has the serverless option)
- Leave the default capacity settings
- Set the VPC, subnet, and security group to the ones associated with your server (the security group might be by name rather than ID)
- Leave all other settings to their default

Once you have created your instance, select it to see your database endpoint. Save this for later user - this forms the basis of your DATABASE_SERVER environmental variable. If more than one endpoint available, save the endpoint of the writer instance.

### Domain

If you would like to have the application hosted at a proper domain - as opposed to an AWS server IP address - you will need to purchase a domain and point it to your server. This 
will also allow you to get an SSL certificate for the site, preventing security warnings from your internet browser. It is recommended you do this through AWS Route 53. Open this 
service on the web console and do the following:

- Enter your desired domain name in the box appearing under the 'Register Domain' heading and click 'check'
- Continue trying domains until you find an available one you like
- Purchase the domain by adding it to your cart, clicking continue, and following any further instructions
- Next, navigate to 'Hosted Zones'
- Click on your purchased domain
- Click on create record
- Set the 'Value' field to the Public IPv4 address of your server
- Leave the other default settings

    - Routing policy: Simple
    - Record type: A
    - TTL: 300

- Create record

### S3-only IAM Users

In order to prevent third-party classifier images from causing harm, these should be restricted to only be able to get objects from S3 (images to classify) and nothing else. Additionally, user should upload their images with images signed by an IAM user that only has permissions to put objects into the TrapTagger bucket. Both of these are achieved by creating an IAM user and associated credentials with those permissions. This is done as follows (perform this action twice - once for each use case: upload and dowload only):

- Go to the IAM User console
- Select users in the side tab
- Select add users
- Give your S3-only user a useful name
- Click next on each page until you get to the review stage
- Click create user
- Search for your user by username and select your user
- Navigate to the security credentials tab
- Click create access key
- Select the use case of the access key 
- Give description tag (optional)
- Click create access key and save the access key and secret access key for later

### Bucket

TrapTagger uses an AWS S3 bucket to store user data. Each user will get two folders in this bucket - one that they can access with the same name as their account, and one that contains all the compressed versions of their images. In order to set up your bucket:

- Go to the AWS S3 console in your browser
- Click 'create bucket'
- Give that bucket a useful name and save it for later
- Select your desired AWS region 
- Unselect the 'Block all public access' option and click 'create bucket'
- Select your newly created bucket and select the permissions tab
- Set the bucket policy to the following, replacing:

    - yourDomain with your site domain
    - bucketName with your bucket name
    - rootUserARN with the user ARN of your root user
    - S3DownloadUserARN with the user ARN of your download-only S3 user
    - S3UploadUserARN with the user ARN of your upload-only S3 user
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Root Permissions",
            "Effect": "Allow",
            "Principal": {
                "AWS": "rootUserARN"
            },
            "Action": "s3:*",
            "Resource": "arn:aws:s3:::bucketName/*"
        },
        {
            "Sid": "Allow get requests from domain",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::bucketName/*",
            "Condition": {
                "StringLike": {
                    "aws:Referer": [
                        "https://yourDomain/*"
                    ]
                }
            }
        },
        {
            "Sid": "Classifier Worker Permissions",
            "Effect": "Allow",
            "Principal": {
                "AWS": "S3DownloadUserARN"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::bucketName/*"
        }
        ,
        {
            "Sid": "Uploader Permissions",
            "Effect": "Allow",
            "Principal": {
                "AWS": "S3UploadUserARN"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::bucketName/*"
        }
    ]
}
```
- Set the CORS policy to the following:
```
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "HEAD",
            "POST",
            "GET",
            "PUT",
            "DELETE"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length",
            "Content-Type",
            "Connection",
            "Date",
            "Server",
            "x-amz-delete-marker",
            "x-amz-id-2",
            "x-amz-request-id",
            "x-amz-version-id"
        ]
    }
]
```

### User Group

In order to manage the access permissions of you admin users, you must create a user group. Here you will give your users access to a folder that matched their username into which they can upload images.

- Go to the AWS IAM web console
- Select 'policies' on the left-hand menu
- Select 'create policy'
- Select the JSON editor and enter the following, replacing 'bucketName' with your bucket name:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowFolderAccess",
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": "arn:aws:s3:::bucketName/${aws:username}/*"
        },
        {
            "Sid": "AllowBucketListing",
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::bucketName",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "${aws:username}/*"
                }
            }
        }
    ]
}
```
- Click next (add tags)
- Give the policy a useful name
- Click create policy
- Select 'user groups' on the left-hand menu
- Click 'create group'
- Give your user group a useful name, and save it for later
- Search for and select the policy you just created and click 'create group'

## System Email Support

In order for users to be added, or for them to be able to reset their passwords etc. you need an email functionality set up. If you have your own email server, you can simply set the MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USERNAME, and MAIL_PASSWORD variables in the config file.

If you do not have your own email server, the recommended quick and easy solution is to set up a Gmail account to send your emails. Just note that the emails from this account will often end up being filtered as spam when you first receive emails from it. Once you mark them as not being spam, they should start appearing in your inbox as normal. The instructions for setting up your Gmail account are as follows:

- Log out of your current Google account
- Sign up for a new Google account
- Follow these instructions to generate an app password: https://support.google.com/accounts/answer/185833
- Set your MAIL_USERNAME and MAIL_PASSWORD environmental variable values to your new email address and app password respectively
- The rest of the config file is set up for Gmail by default

## Server Setup

All setup here is performed on your AWS server instance in order to get it ready to run the application.

### SSH

In order to work with your server, you must ssh into it via your terminal:

- Open a terminal
- Navigate to your downloads folder
- Change the permissions for your newly downloaded private key file using `chmod 400 yourKeyPair.pem`
- Enter the command `ssh -i ~/Downloads/yourKeyPair.pem ubuntu@yourInstancePublicDNS`
- Be sure to replace
    - `~/Downloads/yourKeyPair.pem` with the location of your private key file that you downloaded
    - `yourInstancePublicDNS` with the public IPv4 DNS of your instances that you saved earlier

### Code Repository

You must download this code to your server:

- Clone this repository `git clone https://github.com/WildEyeConservation/TrapTagger`
- Navigate to the newly-added TrapTagger folder
- Clone the submodules using the following command `git submodule update --init`

### Docker

Docker forms a type of virtual environment in which the application runs, and includes all the necessary software required for it to run properly. You must first install and set Docker up before being able to run the application:

- Install Docker using the following command `sudo apt install docker-compose`
- Set up your Docker privileges
    - Run the command `sudo groupadd docker`
    - Run the command `sudo usermod -aG docker $USER`
    - Run the Command `newgrp docker`
- Build the image locally by issuing the `sudo docker-compose build` command.
    - This will prepare the environment in which the software runs by downloading and installing the necessary depenencies.
    - Note that this process can take a while. Once this process has been completed, it won't have to be completed again.

### Environment Variables

You need to set a number of environment variables in order to set a number of parameters in the application. An easy way to do this is to keep these variables in a script such as 
env_variables.sh, and then simply set them using the command `. env_variables.sh` before running the Docker container. The list of required variables is as follows:

- DATABASE_NAME:                        The name of your database.
- HOST_IP:                              The private IPv4 address of your server instance.
- DNS:                                  The domain name where the site is being hosted. Use your public IPv4 DNS of your server if you haven't purchased a domain.
- DATABASE_SERVER:                      The server where the database is being hosted, including your username and password. ie. mysql+pymysql://username:password@database endpoint
- AWS_ACCESS_KEY_ID:                    Your AWS ID.
- AWS_SECRET_ACCESS_KEY:                Your AWS secret access key.
- REGION_NAME:                          The region in which you are hosting the site. eg. us-west-2
- SECRET_KEY:                           A secret key.
- MAIL_USERNAME:                        The email address of your admin email account.
- MAIL_PASSWORD:                        The password of your admin email account.
- BRANCH:                               The branch of the code you want used on the parallel instances. Default is master.
- PARALLEL_AMI:                         The AMI ID for the Parallel Worker image - use our publically available one (ami-0ba42ea98124dd0a1)
- SG_ID:                                The ID of your security group.
- PUBLIC_SUBNET_ID:                     The ID of your public subnet
- PRIVATE_SUBNET_ID:                    The ID of your private subnet
- TOKEN:                                A secret token key.
- KEY_NAME:                             The name of the private key file you use on your EC2 instances. (without the .pem)
- QUEUE:                                The queue name for the local worker - set to default for your server instance.
- WORKER_NAME:                          The worker name for the local worker - set to traptagger_worker for your server instance.
- MAIN_GIT_REPO:                        The repository for the main application.
- MONITORED_EMAIL_ADDRESS:              A monitored email address for user enquiries and questions.
- BUCKET:                               The name of your bucket that you created for your images to be stored.
- DB_CLUSTER_NAME:                      The name of your aurora db instance.
- IAM_ADMIN_GROUP:                      The name of the user group you created.
- AWS_S3_DOWNLOAD_ACCESS_KEY_ID:        The AWS ID of your S3-only IAM user
- AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY:    The AWS secret access key for your S3-only IAM user
- AWS_S3_UPLOAD_ACCESS_KEY_ID:          The AWS ID of your S3-only IAM user
- AWS_S3_UPLOAD_SECRET_ACCESS_KEY:      The AWS secret access key for your S3-only IAM user

### SSL Certificate

In order to run the site securely over https, you must encrypt all your web trafic with SSL. This requires an SSL certificate. You are able to run the site using either freely-obtained Let's Encrypt certificate (if you have a domain name), or a self-signed certificate. The latter results in a security warning in most browsers and is only advisable whilst you are playing around with the site, or if you do not wish to purchase a domain name.

#### Self-Signed Certificates

Follow these steps:

- ssh into your server (process described above)
- navigate to the TrapTagger folder
- Enter the command `sudo mkdir certs`
- Enter the command `sudo apt update`
- Enter the command `sudo apt install python3-pip`
- Install openssl with the command `pip install pyopenssl`.
- Generate your own certificate with the command `openssl req -x509 -newkey rsa:4096 -nodes -out certs/fullchain.pem -keyout certs/privkey.pem -days 365` and follow all instructions
- Edit the docker-compose file to use the commented-out Nginx setup
- Edit the nginx configuration file to use this certificate by commenting out the default ssl_certificate and ssl_certificate_key values, and instead using the ones for self-signed certificates below them

#### Let's Encrypt

Simply follow the instructions on how to use [certbot](https://certbot.eff.org/) by selecting Nginx and your server operating system in the dropdown menus. Once you have your certificates, edit the Nginx config file to find the certificate in the correct place by replacing 'domain' term with your domain name (eg. traptagger.co.uk).

## Running the Application

- Start the application with the command `docker-compose up`.
- You can stop the process by first entering `docker stop flask` and subsequently `docker-compose down`. The first command will reschedule any long-running tasks to be performed once the application is up and running again.
- Please note the first time you start the application, you must do so in initial setup mode. This is achieved by setting the INITIAL_SETUP variable in the config file to True. This will allow the application to initialise your database. Once it has done so, you can reset the application with initial setup mode switched off.

# Using the Site

You must begin by creating yourself an admin account. This is done by visiting the welcome page of the website. There you will find an enquiry form - fill in your desired username as the enquiring organisation, and your email address. When you submit the form, the enquiry will be sent to your 
administration email address with a link. If you click on this link, your account will be created for you, and the credentials emailed to your enquiring 
email address. You can then use this information to log into the site, and begin processing images. The proceedure for adding other admin users is the same.

Annotators can create their own worker accounts by going to the login page, and clicking on associated link there, and following the instructions.

Usage of the site is fully documented in the help files. You can read these in the app/templates/help folder, however it preferable to simply read the 
help files in situ by clicking on the help buttons on the top right-hand corner of each page, or window. The help file delivered there will be the one 
pertinent to the current page or window, and should cover any questions you might have.

Additionally, there is a annotation tutorial that is automatically served to each user when they pick up their first annotation job.

# Updates

TrapTagger is under constant development. In order to keep you instance up to date, you must pull the latest version from its repository from time to time.

- ssh into your server
- Navigate to the traptagger directory
- Enter the command `git pull`
- Check that your Nginx settings are still correct
- Load your environmental variables
- Enter the command `docker stop flask`
- Enter the command `docker-compose down`
- Enter the command `docker-compose up`
- Your instance will then be updated, and will automatically make any updates to your database schema as needed
- You may have to hard refresh your browser (ctrl+F5) to get it to fetch the new client-side code and see the changes

# Load Testing

Once you have the site set up, you can test the load-carrying ability of your selected instances by using the supplied locustfile.

## Setup

Begin by installing locust by using the command `pip install locust`. Thereafter, ensure that your DNS enviromental variable is set correctly, and that the LOAD_TESTING variable in the config file is set to true. Don't forget to set it back to false when you have finished load testing - otherwise you are leaving a back door into your system open. Also, make sure to set the OGANISATION_ID and LABEL_ID variables in the locustfile itself to the accoutn you will be using, and the label you would like your workers to spam the system with. A global label like vehicles/humans/livestock is recommended.

## Run

Once setup is complete, you must log into the site as the organisation you specified in the previous step and launch at least one task. Multiple tasks, and larger ones are recommended to really give the system a test.

You can then run the load-testing script with the command `locust --headless`. You can then add more simulated workers using the 'w' key. You can add 10 with 'W'. Similarly, you can reduce the number of workers using 's' and 'S'. It is then recommended that you take a few jobs yourself to test how responsive the system is at a given load.

# Species-Classifier Training

You can easily train your own bespoke species classifier for your particular biome. This can be performed usinng your own data that you have processed through TrapTagger, or data external to the system. The files necessary for training can be generated through a couple admin-only interfaces - meaning that you must be logged in with the admin account in order to access these forms.

In order to train a species classifier, you need three things: a set of images cropped to only contain the animals, a csv file of annotations, and some label-translation json files:

## Image Cropping

In order to generate your cropped images, you must typically run them through a detector, and then crop them according to the bounding boxes generated. This process is automated inside the TrapTagger environment to take advantage of the parallelisation available, and differs according to the source of your data. Helpfully, this process results in all your crops being stored together in a single bucket, and all the annotations stored in your database just like any other survey. Additionally, where possible, this process results in you storing the minimum amount of data, by only storing the cropped images, for example.

### External Cloud-Hosted Data

There are many examples of publicly available annotated image libraries such as those found on Lila - like Snapshot Serengeti. These are typically hosted on cloud storage, with the annotations stored in csv files. You can process these data sets using the data pipeline form accessible on the /dataPipeline endpoint. The form comes with instructions and should be fairly self-explanatory. However, some points are highlighted here. Essentially, you need to provide an annotations csv that contains two columns: filepath, and species. The system then fetches the image from the specified data-source URL, processes it, crops it, and stores the species label in the database. Additionally, it also uses a site identifier to differentiate camera sites - which helps split the data by location, and stop the classifier from learning species distributions in particular habitats.

### Self-Hosted Pre-Annotated Data

If you have access to historical pre-annotated data, there is no need to run it through the species classifier, or keep a set of compressed duplicates of the images. As such, you can also process these datasets through the /dataPipeline for as well. The process is similar to the above, but with the difference being that you instead provide an S3 bucket and the folder where the images are stored. The system will then walk through those images, process them, and save the information in the database. Additionally, you can specify a typed-out list of exclusions - folders with these terms will be ignored. For example, the list "['thumb']" will exclude all the thumbnail images stored in a thumbs folder.

You must separately provide an annotations csv for this import type through the add-task functionality as you would normally do for a survey. The proceedure for this and the associated file format is covered in the help files.

### TrapTagger-Annotated Data

One of the major souces of training data will be data that was manually annotated through TrapTagger. This is handled separately in the next step.

## Annotations csv

Once you have a set of cropped images, you will need to generate a set of annotations to accompany them. This process is the same regardless of the source of your data since the annotations are derived from the surveys in your database. You must visit the training csv form at /trainingCSV and select which user you would like to generate a csv for. Note that any of the data processed in the previous step will appear under the admin user. You can then select which surveys and associated tasks you would like to include in the training data, alongside some other self-explanatory parameters. The generated csv files will be stored under the "classification_ds" folder in your stipulated S3 bucket. The individual-level files will be combined in the next step automatically, so there is no need to access them directly.

Note that in this step, the system will check to see if the crops already exist for each specified survey, and initiate the cropping process if they do not. This is they way that images are cropped for TrapTagger-annotated surveys.

## Label Translations

Lastly, you must create some label-translation files. This step will allow you to combine various spellings, misspellings, and naming conventions under a single training label. Moreover, it will allow you to combine various labels under a new label allowing you to, for example, combine a number of different bird species under a single bird label in the case that you have insufficient data to train an individual-bird-species classifier.

On this form, you must first click the "request" button. The system will then check to see if you have a global training csv. If you do not, it will then proceed to combine all your user-level files into a single global label. Wait a few minutes for this process to complete. You must then click the "request" button again to request all the different-spelt labels in your data set, and these will then appear on the form. You can then manually exclude labels based on the number of training examples you have of that label, and provide them with a "desired label" that they should be labelled with by the classifier. You can then submit your form, and the resultant label specification files will be saved in your specified S3 bucket along with the global training csv.

## Training Data

A summary of the resultant training data is as follows:

- Crops stored in your specified S3 bucket
- Annotations csv stored in the same bucket under classification_ds/classification_ds.csv
- Label-translation file under label_spec.json
- Label-index file under label_index.json

You can then use this data to train your own species classifier. We recommend using Microsoft's MegaDetector project as a starting point. You can find the project and all training instructions [here](https://github.com/microsoft/CameraTraps/tree/main/classification).

# License

This repository is licensed with the Apache License 2.0. We only ask that you let us know if you are using our software - in whole or in part - as it is the only way for use to know the extent of 
its usage.

# Contact

Please feel free to contact us with any queries or feedback you may have at nicholas@wildeyeconservation.org.