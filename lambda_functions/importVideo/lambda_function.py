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
import hashlib
from datetime import datetime
import ffmpeg
import math


s3 = boto3.client('s3')

def lambda_handler(event, context):
    '''Updates the video in the database with the hash, still rate, and extracted text & compresses the video.'''

    bucket = event['bucket']
    keys = event['keys']
    extract_function = event['extract_function']

    conn = pymysql.connect(host=event['RDS_HOST'], user=event['RDS_USER'], password=event['RDS_PASSWORD'], db=event['RDS_DB_NAME'], port=3306, connect_timeout=5)
    cursor = conn.cursor()
    imported = 0
    processed=0
    extract_batch = []
    for key in keys:
        try:
            if context.get_remaining_time_in_millis() < 30000:
                conn.commit()
                conn.close()
                payload = event
                payload['keys'] = keys[processed:]
                lambda_client = boto3.client('lambda')
                lambda_client.invoke(FunctionName=context.function_name, InvocationType='Event', Payload=json.dumps(payload))
                invoked = False
                if extract_batch:
                    payload['batch'] = extract_batch
                    payload['reinvoked'] = True
                    del payload['keys']
                    lambda_client.invoke(FunctionName=extract_function, InvocationType='Event', Payload=json.dumps(payload))
                    invoked = True

                print('Lambda invoked with remaining keys.')
                return {
                    'status': 'success',
                    'processed': processed,
                    'imported': imported,
                    'total': len(keys),
                    'survey_id': event['survey_id'],
                    'invoked': invoked,
                    'reinvoked': True
                }

            splits = key.rsplit('/', 1)
            video_path = splits[0]
            video_name = splits[-1].split('.')[0]
            filename = key.split('/')[-1]
            split_path = splits[0].split('/')
            split_path[0] = split_path[0] + '-comp'
            comp_video_path = '/'.join(split_path)
            hash = None

            # Download the file from S3
            download_path = '/tmp/' + filename
            s3.download_file(Bucket=bucket, Key=key, Filename=download_path)
                  
            # Generate hash
            try:
                hash = generate_raw_image_hash(download_path)
            except:
                print('Video corrupted - {}'.format(key))
                s3.delete_object(Bucket=bucket, Key=key)
                os.remove(download_path)
                processed+=1
                continue

            # Check if another video with the same hash exists in db from the same survey
            survey_folder = '/'.join(key.split('/')[:2]) + '/%'
            existing_query = '''
                SELECT video.id FROM video
                JOIN camera ON video.camera_id = camera.id 
                WHERE video.hash = %s AND camera.path LIKE %s
            '''
            cursor.execute(existing_query, (hash, survey_folder))
            video = cursor.fetchone()

            if video:
                print('Video already exists in the database - {}'.format(key))
                os.remove(download_path)
                processed+=1
                continue

            try:
                # Video Metadata
                probe = ffmpeg.probe(download_path)
                try:
                    video_timestamp = probe['streams'][0]['tags']['creation_time']
                except:                             
                    video_timestamp = None
                if not video_timestamp:
                    try:
                        video_timestamp = ffmpeg.probe(download_path)['format']['tags']['creation_time']
                    except:
                        video_timestamp = None
                if video_timestamp:
                    try:
                        video_timestamp = datetime.strptime(video_timestamp, '%Y-%m-%dT%H:%M:%S.%fZ')
                    except:
                        try:
                            video_timestamp = datetime.strptime(video_timestamp, '%Y-%m-%d %H:%M:%S')
                        except:
                            video_timestamp = None

                try:
                    video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
                    width = int(video_stream['width'])
                    height = int(video_stream['height'])
                except:
                    width = None
                    height = None

                try:
                    video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
                    video_fps = int(video_stream['r_frame_rate'].split('/')[0]) / int(video_stream['r_frame_rate'].split('/')[1])
                    video_frames = int(video_stream['nb_frames'])
                    still_rate = get_still_rate(video_fps,video_frames)
                except:
                    video_fps = None
                    video_frames = None
                    still_rate = None
                
                # Compress Video
                input_video = ffmpeg.input(download_path)
                compressed_path = '/tmp/comp_' + video_name + '.mp4'
                if width and height and width > 854 and height > 480:
                    output_video = ffmpeg.output(input_video, compressed_path, crf=30, preset='veryfast', s='854:480', pix_fmt='yuv420p')
                else:
                    output_video = ffmpeg.output(input_video, compressed_path, crf=30, preset='veryfast', pix_fmt='yuv420p')
                output_video.run(overwrite_output=True)

                # Upload video to compressed bucket
                comp_video_key = comp_video_path + '/' +  video_name + '.mp4'
                s3.upload_file(Filename=compressed_path, Bucket=bucket, Key=comp_video_key)
                os.remove(compressed_path)

                #Add to database
                camera_path = video_path+'/_video_images_/'+video_name
                insert_query = 'INSERT INTO camera (path) VALUES (%s)'
                cursor.execute(insert_query, (camera_path))
                conn.commit()
                camera_query = 'SELECT id FROM camera WHERE path = %s'
                cursor.execute(camera_query, (camera_path))
                camera = cursor.fetchone()
                camera_id = camera[0]

                insert_query = 'INSERT INTO video (filename, hash, still_rate, camera_id, downloaded) VALUES (%s, %s, %s, %s, 0)'
                cursor.execute(insert_query, (filename, hash, still_rate, camera_id))

                extract_batch.append({'key': key, 'camera_id': camera_id, 'timestamp': datetime.strftime(video_timestamp, '%Y-%m-%d %H:%M:%S') if video_timestamp else None})

                os.remove(download_path)
                processed+=1
                imported+= 1

            except Exception as e:
                print(e)
                print('Video corrupted or metadata missing - {}'.format(key))
                os.remove(download_path)
                if os.path.exists(compressed_path): os.remove(compressed_path)
                processed+=1
                continue

        except Exception as e:
            print(e)
            print('Video import failed - {}'.format(key))
            if os.path.exists(download_path): os.remove(download_path)
            if os.path.exists(compressed_path): os.remove(compressed_path)
            processed+=1
            continue
        
    conn.commit()
    conn.close()       

    invoked = False
    if extract_batch:
        payload = event
        payload['batch'] = extract_batch
        del payload['keys']
        lambda_client = boto3.client('lambda')
        lambda_client.invoke(FunctionName=extract_function, InvocationType='Event', Payload=json.dumps(payload))
        print('Invoked lambda to extract frames from videos.')
        invoked = True
    
    print('Videos compressed and imported successfully.')

    return {
        'status': 'success',
        'imported': imported,
        'total': len(keys),
        'survey_id': event['survey_id'],
        'invoked': invoked,
        'reinvoked': False
    }


def generate_raw_image_hash(filename):
    '''Generates a hash of an image with no EXIF data in a format compatable with the front end or generates a hash of a video.''' 
    hash = None
    if filename.endswith('.AVI') or filename.endswith('.MP4') or filename.endswith('.avi') or filename.endswith('.mp4') or filename.endswith('.mov') or filename.endswith('.MOV'):
        hash = hashlib.md5(open(filename, "rb").read()).hexdigest()
    
    return hash


def get_still_rate(video_fps,video_frames):
    '''Returns the rate at which still should be extracted.'''
    max_frames = 30     # Maximum number of frames to extract
    fps_default = 1     # Default fps to extract frames at (frame per second)
    video_duration = math.ceil(video_frames / video_fps)
    return min((max_frames-1) / video_duration, fps_default)  

