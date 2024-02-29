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

import torch
from llava.constants import IMAGE_TOKEN_INDEX, DEFAULT_IMAGE_TOKEN, DEFAULT_IM_START_TOKEN, DEFAULT_IM_END_TOKEN
from llava.conversation import conv_templates
from llava.model.builder import load_pretrained_model
from llava.utils import disable_torch_init
from llava.mm_utils import process_images, tokenizer_image_token, get_model_name_from_path
from PIL import Image
import requests
from io import BytesIO
from transformers import TextStreamer
import boto3
import tempfile

model_path='liuhaotian/llava-v1.6-34b'
# model_path='liuhaotian/llava-v1.6-mistral-7b'
load_4bit = True
load_8bit = False
temperature = 0.2
max_new_tokens = 512
s3client = boto3.client('s3')

def load_image(image,sourceBucket,external):
    '''Loads the image from the given file or URL.'''

    try:
        with tempfile.NamedTemporaryFile(delete=True, suffix='.JPG') as temp_file:
            if external:
                print('Downloading {} from external source.'.format(image))
                attempts = 0
                retry = True
                while retry and (attempts < 10):
                    attempts += 1
                    try:
                        if sourceBucket!='':
                            url = sourceBucket+'/'+image
                        else:
                            url = image
                        response = requests.get(url, timeout=30)
                        assert (response.status_code==200) and ('image' in response.headers['content-type'].lower())
                        retry = False
                    except:
                        retry = True
                with open(temp_file.name, 'wb') as handler:
                    handler.write(response.content)

            else:
                print('Downloading {} from S3'.format(image))
                s3client.download_file(Bucket=sourceBucket, Key=image, Filename=temp_file.name)

            print('Done')
            image = Image.open(temp_file.name).convert('RGB')
    
    except:
        print('Failed to retrieve image {}'.format(image))
    
    return image

def init():
    '''Initializes the model and other variables.'''

    disable_torch_init()
    model_name = get_model_name_from_path(model_path)
    tokenizer, model, image_processor, context_len = load_pretrained_model(model_path, None, model_name, load_8bit, load_4bit, device='cuda')
    
    if "llama-2" in model_name.lower():
        conv_mode = "llava_llama_2"
    elif "mistral" in model_name.lower():
        conv_mode = "mistral_instruct"
    elif "v1.6-34b" in model_name.lower():
        conv_mode = "chatml_direct"
    elif "v1" in model_name.lower():
        conv_mode = "llava_v1"
    elif "mpt" in model_name.lower():
        conv_mode = "mpt"
    else:
        conv_mode = "llava_v0"

    return model,tokenizer,image_processor,context_len,conv_mode

def infer(image,sourceBucket,external,prompt,model,tokenizer,image_processor,context_len,conv_mode):
    '''Generates a response to the given prompt and image.'''

    # prep image
    image = load_image(image,sourceBucket,external)
    image_size = image.size
    image_tensor = process_images([image], image_processor, model.config)
    if type(image_tensor) is list:
        image_tensor = [image.to(model.device, dtype=torch.float16) for image in image_tensor]
    else:
        image_tensor = image_tensor.to(model.device, dtype=torch.float16)
    
    # prep prompt
    conv = conv_templates[conv_mode].copy()
    if image is not None:
        # first message
        if model.config.mm_use_im_start_end:
            prompt = DEFAULT_IM_START_TOKEN + DEFAULT_IMAGE_TOKEN + DEFAULT_IM_END_TOKEN + '\n' + prompt
        else:
            prompt = DEFAULT_IMAGE_TOKEN + '\n' + prompt
        conv.append_message(conv.roles[0], prompt)
        image = None
    else:
        # later messages
        conv.append_message(conv.roles[0], prompt)
    conv.append_message(conv.roles[1], None)
    prompt = conv.get_prompt()
    
    # process
    input_ids = tokenizer_image_token(prompt, tokenizer, IMAGE_TOKEN_INDEX, return_tensors='pt').unsqueeze(0).to(model.device)
    streamer = TextStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
    with torch.inference_mode():
        output_ids = model.generate(
            input_ids,
            images=image_tensor,
            image_sizes=[image_size],
            do_sample=True if temperature > 0 else False,
            temperature=temperature,
            max_new_tokens=max_new_tokens,
            streamer=streamer,
            use_cache=True)
    
    return tokenizer.decode(output_ids[0]).split('<|startoftext|>')[1].split('<|im_end|>')[0].strip()
    # return tokenizer.decode(output_ids[0]).split('<s>')[1].split('</s>')[0].strip()
