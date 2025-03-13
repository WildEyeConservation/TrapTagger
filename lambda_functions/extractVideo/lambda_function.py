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
import math
import cv2
import piexif
import io
import hashlib
import pymysql
from datetime import datetime, timedelta
import json

s3 = boto3.client('s3')

def lambda_handler(event, context):
    '''Extracts frames from a video and uploads them to the bucket.'''

    bucket = event['bucket']
    batch = event['batch']

    conn = pymysql.connect(host=event['RDS_HOST'], user=event['RDS_USER'], password=event['RDS_PASSWORD'], db=event['RDS_DB_NAME'], port=3306, connect_timeout=5)
    cursor = conn.cursor()
    processed = 0
    extracted = 0
    download_path = None
    for b in batch:
        try:
            if context.get_remaining_time_in_millis() < 180000:
                conn.commit()
                conn.close()
                payload = event
                payload['batch'] = batch[processed:]
                lambda_client = boto3.client('lambda')
                lambda_client.invoke(FunctionName=context.function_name, InvocationType='Event', Payload=json.dumps(payload))
                print('Lambda invoked with remaining batch for survey_id - {}'.format(event['survey_id']))
                print('Extracted: {}/{}'.format(extracted, len(batch)))
                return {
                    'status': 'success',
                    'processed': processed,
                    'extracted': extracted,
                    'total': len(batch),
                    'survey_id': event['survey_id'],
                    'reinvoked': True
                }


            key = b['key']
            camera_id = b['camera_id']
            video_timestamp = b['timestamp']

            if video_timestamp:
                video_timestamp = datetime.strptime(video_timestamp, '%Y-%m-%d %H:%M:%S')

            splits = key.rsplit('/', 1)
            video_path = splits[0]
            video_name = splits[-1].rsplit('.', 1)[0]
            filename = key.split('/')[-1]
            camera_path = video_path + '/_video_images_/' + video_name

            # Download the file from S3
            download_path = '/tmp/' + filename
            s3.download_file(Bucket=bucket, Key=key, Filename=download_path)
                    
            # Extract video frames
            try:
                video = cv2.VideoCapture(download_path)
                video_fps = video.get(cv2.CAP_PROP_FPS)
                video_frames = video.get(cv2.CAP_PROP_FRAME_COUNT)
                fps = get_still_rate(video_fps,video_frames)
                ret, frame = video.read()
                count = 0
                count_frame = 0
                frame_rate = math.ceil(video_fps / fps)
                assert ret==True #need this to catch metadata issues
                while ret:
                    if count % frame_rate == 0:
                        frame_fn = '/tmp/frame%d.jpg' % count
                        cv2.imwrite(frame_fn, frame)

                        # Timestamp
                        if video_timestamp:
                            image_timestamp = video_timestamp + timedelta(seconds=count/video_fps)
                            exif_time = image_timestamp.strftime('%Y:%m:%d %H:%M:%S')
                            exif_dict = {"Exif":{piexif.ExifIFD.DateTimeOriginal: exif_time}}
                            exif_bytes = piexif.dump(exif_dict)
                            # Write exif data to image
                            piexif.insert(exif_bytes, frame_fn)
                        else:
                            image_timestamp = None
                        
                        # Generate hash
                        hash = generate_raw_image_hash(frame_fn)

                        # Check if image already exists
                        existing_query = 'SELECT image.id FROM image join camera on image.camera_id = camera.id WHERE image.hash = %s AND camera.path = %s'
                        cursor.execute(existing_query, (hash, camera_path))
                        f = cursor.fetchone()
                        if f:
                            print('Image already exists in the database.')
                            os.remove(frame_fn)
                            count_frame += 1
                            ret, frame = video.read()
                            count += 1
                            continue

                        # Upload image to bucket
                        image_filename = 'frame%d.jpg' % count_frame
                        image_key = camera_path + '/' + image_filename
                        s3.upload_file(Filename=frame_fn, Bucket=bucket, Key=image_key)
                        
                        # Compression
                        img = cv2.imread(frame_fn)
                        compressed_path = '/tmp/compressed_' + image_filename
                        img = cv2.resize(img, (800, 800*img.shape[0]//img.shape[1]))
                        cv2.imwrite(compressed_path, img)

                        # Upload the compressed file to S3
                        splits = image_key.split('/')
                        splits[0] = splits[0]+'-comp'
                        comp_image_key = '/'.join(splits)
                        s3.upload_file(Bucket=bucket, Key=comp_image_key, Filename=compressed_path)
                        
                        etag = s3.head_object(Bucket=bucket, Key=image_key)['ETag'][1:-1]
                        insert_query = 'INSERT INTO image (filename,timestamp,corrected_timestamp,camera_id,hash,etag,detection_rating,downloaded,skipped,extracted) VALUES (%s,%s,%s,%s,%s,%s,0,0,0,0)'
                        cursor.execute(insert_query, (image_filename, image_timestamp, image_timestamp, camera_id, hash, etag))
                        
                        count_frame += 1
                        os.remove(frame_fn)
                        os.remove(compressed_path)
                    ret, frame = video.read()
                    count += 1

                video.release()
                os.remove(download_path)
                processed+=1
                extracted+=1

            except:
                print('Frame extraction failed - {}'.format(key))
                processed+=1
                os.remove(download_path)
                continue

        except:
            print('Frame extraction failed for video - {}'.format(key))
            processed+=1
            if download_path and os.path.exists(download_path): os.remove(download_path)
            continue

    conn.commit()
    conn.close()

    print('Frames extracted and uploaded to S3 for survey_id - {}'.format(event['survey_id']))
    print('Extracted: {}/{}'.format(extracted, len(batch)))

    return {
        'status': 'success',
        'extracted': extracted,
        'total': len(batch),
        'survey_id': event['survey_id'],
        'reinvoked': event['reinvoked'] if 'reinvoked' in event.keys() else False
    }


def get_still_rate(video_fps,video_frames):
    '''Returns the rate at which still should be extracted.'''
    max_frames = 30     # Maximum number of frames to extract
    fps_default = 1     # Default fps to extract frames at (frame per second)
    video_duration = math.ceil(video_frames / video_fps)
    return min((max_frames-1) / video_duration, fps_default)  

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
