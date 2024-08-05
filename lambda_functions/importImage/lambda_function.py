'''
Copyright 2023

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

import boto3
import os 
import json 
import pymysql
from PIL import Image as PilImage
import hashlib
import piexif
from datetime import datetime
import io

s3 = boto3.client('s3')

def lambda_handler(event, context):
    '''Updates the image in the database with metadata & compresses the image.'''

    bucket = event['bucket']
    key = event['key']
    conn = pymysql.connect(host=event['RDS_HOST'], user=event['RDS_USER'], password=event['RDS_PASSWORD'], db=event['RDS_DB_NAME'], port=3306, connect_timeout=5)
    cursor = conn.cursor()

    # Download the file from S3
    download_path = '/tmp/' + key.split('/')[-1]
    s3.download_file(Bucket=bucket, Key=key, Filename=download_path)
            
    # Generate hash
    try:
        hash = generate_raw_image_hash(download_path)
    except:
        s3.delete_object(Bucket=bucket, Key=key)
        os.remove(download_path)
        conn.close()
        return {
            'statusCode': 200,
            'body': 'Image corrupted.'
        }

    # Check if another image with the same hash exists in db from the same survey
    survey_folder = '/'.join(key.split('/')[:2]) + '/%'
    existing_query = '''
        SELECT image.id FROM image
        JOIN camera ON image.camera_id = camera.id 
        WHERE image.hash = %s AND camera.path LIKE %s
    '''
    cursor.execute(existing_query, (hash, survey_folder))
    rows = cursor.fetchall()

    if len(rows) > 0:
        return {
            'statusCode': 200,
            'body': 'Image already exists in the database.'
        }
    else:
        # Get Timestamp with pyexif 
        try:
            exif_data = piexif.load(download_path)
            timestamp = None
            if exif_data['Exif']:
                for tag in exif_data['Exif']:
                    if tag == 36867 or tag == 36868:
                        timestamp = datetime.strptime(exif_data['Exif'][tag].decode('utf-8'), '%Y:%m:%d %H:%M:%S')
                        break
            if timestamp is None:
                # Try and find in MakerNotes
                if exif_data['MakerNotes']:
                    for tag in exif_data['MakerNotes']:
                        if tag == 36867 or tag == 36868:
                            timestamp = datetime.strptime(exif_data['MakerNotes'][tag].decode('utf-8'), '%Y:%m:%d %H:%M:%S')
                            break
            
            # Remove GPS data from the image 
            try: 
                if exif_data['GPS']:
                    exif_data['GPS'] = {}
                    exif_bytes = piexif.dump(exif_data)
                    piexif.insert(exif_bytes, download_path)
            except:
                pass
        except:
            timestamp = None

        
        # Compression
        img = PilImage.open(download_path)
        compressed_path = '/tmp/compressed_' + key.split('/')[-1]
        img = img.resize((800, 800*img.height//img.width))
        img.save(compressed_path)

        # Upload the compressed file to S3
        splits = key.split('/')
        splits[0] = splits[0]+'-comp'
        comp_key = '/'.join(splits)
        s3.upload_file(Bucket=bucket, Key=comp_key, Filename=compressed_path)

        # Add to database
        splits = key.split('/')
        image_filename = splits[-1]
        camera_path = '/'.join(splits[:-1]) 

        camera_query = 'SELECT id FROM camera WHERE path = %s'
        cursor.execute(camera_query, (camera_path))
        camera = cursor.fetchone()
        if camera is None:
            insert_camera_query = 'INSERT INTO camera (path) VALUES (%s)'
            cursor.execute(insert_camera_query, (camera_path))
            conn.commit()
            cursor.execute(camera_query, (camera_path))
            camera = cursor.fetchone()
        camera_id = camera[0]

        etag = s3.head_object(Bucket=bucket, Key=key)['ETag'][1:-1]
        insert_query = 'INSERT INTO image (filename,timestamp,corrected_timestamp,camera_id,hash,etag,detection_rating,downloaded,skipped,extracted) VALUES (%s,%s,%s,%s,%s,%s,0,0,0,0)'
        cursor.execute(insert_query, (image_filename, timestamp, timestamp, camera_id, hash, etag))
        conn.commit()
    
    os.remove(download_path)
    conn.close()        

    return {
        'statusCode': 200,
        'body': 'Image compressed and imported successfully.'
    }


def generate_raw_image_hash(filename):
    '''Generates a hash of an image with no EXIF data in a format compatable with the front end or generates a hash of a video.'''
    
    if filename.endswith('.AVI') or filename.endswith('.MP4') or filename.endswith('.avi') or filename.endswith('.mp4') or filename.endswith('.mov') or filename.endswith('.MOV'):
        hash = hashlib.md5(open(filename, "rb").read()).hexdigest()
    else:
        output=io.BytesIO()
        with open(filename, "rb") as f:
            piexif.insert(piexif.dump({'0th': {}, '1st': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, 'thumbnail': None}),f.read(),output)
            hash = hashlib.md5(output.getbuffer()).hexdigest()
        
    return hash
