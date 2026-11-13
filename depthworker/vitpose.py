'''ViTPose-B AP-10K keypoints.

Weights are the easy_ViTPose checkpoint vitpose-b-ap10k.pth. The default
path is /opt/models/vitpose/vitpose-b-ap10k.pth, overridable with
VITPOSE_WEIGHTS.

Inference: the detection
crop is the whole animal, it is padded to a 3/4 aspect ratio, ImageNet
normalized, resized to 192x256, and decoded with UDP. Keypoints are returned
in the original full-image pixel grid.
'''

import os
import sys

import cv2
import numpy as np
from PIL import Image

from depthworker.height import AP10K_KEYPOINT_NAMES

_EASY_ROOT = os.path.join(os.path.dirname(__file__), 'third_party', 'easy_ViTPose')
if _EASY_ROOT not in sys.path:
    sys.path.insert(0, _EASY_ROOT)

DEFAULT_WEIGHTS = '/opt/models/vitpose/vitpose-b-ap10k.pth'
# easy_ViTPose data_cfg image_size is [width, height].
_MODEL_INPUT_WH = (192, 256)
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def weights_path():
    return os.environ.get('VITPOSE_WEIGHTS') or DEFAULT_WEIGHTS


class ViTPose:
    '''Lazy loader. predict() raises if the checkpoint is not on the machine.'''

    def __init__(self, model_path=None):
        self.model_path = model_path or weights_path()
        self._model = None
        self._device = None

    def _ensure_loaded(self):
        if self._model is not None:
            return
        if not os.path.isfile(self.model_path):
            raise FileNotFoundError(
                'ViTPose weights not found at {}. Place vitpose-b-ap10k.pth there '
                'before running height estimation.'.format(self.model_path)
            )
        import torch
        from vit_models.model import ViTPose as EasyViTPose
        from vit_utils.util import dyn_model_import

        model_cfg = dyn_model_import('ap10k', 'b')
        model = EasyViTPose(model_cfg)
        try:
            ckpt = torch.load(self.model_path, map_location='cpu', weights_only=True)
        except TypeError:
            ckpt = torch.load(self.model_path, map_location='cpu')
        if isinstance(ckpt, dict) and 'state_dict' in ckpt:
            ckpt = ckpt['state_dict']
        model.load_state_dict(ckpt)
        self._device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.eval()
        model.to(self._device)
        self._model = model

    def close(self):
        self._model = None
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

    def predict(self, image_path, bbox_pixels):
        '''Return full-image pixel keypoints for one box [xmin, ymin, xmax, ymax].

        Each item is {name, x, y, score}. A failed or empty crop returns [].
        '''
        self._ensure_loaded()
        image = np.array(Image.open(image_path).convert('RGB'))
        height, width = image.shape[:2]
        x1 = int(np.clip(round(float(bbox_pixels[0])), 0, max(0, width - 1)))
        y1 = int(np.clip(round(float(bbox_pixels[1])), 0, max(0, height - 1)))
        x2 = int(np.clip(round(float(bbox_pixels[2])), 0, width))
        y2 = int(np.clip(round(float(bbox_pixels[3])), 0, height))
        if x2 <= x1 or y2 <= y1:
            return []
        crop = image[y1:y2, x1:x2]
        if crop.size == 0 or crop.shape[0] == 0 or crop.shape[1] == 0:
            return []

        from vit_utils.inference import pad_image
        from vit_utils.top_down_eval import keypoints_from_heatmaps

        padded, (left_pad, top_pad) = pad_image(crop, 3 / 4)
        keypoints = self._infer_crop(padded, keypoints_from_heatmaps)[0]
        # postprocess stores (y, x, score) in the padded crop, matching easy_ViTPose.
        ys = keypoints[:, 0] - top_pad + y1
        xs = keypoints[:, 1] - left_pad + x1
        scores = keypoints[:, 2]
        points = []
        count = min(len(AP10K_KEYPOINT_NAMES), len(xs))
        for index in range(count):
            points.append({
                'name': AP10K_KEYPOINT_NAMES[index],
                'x': float(xs[index]),
                'y': float(ys[index]),
                'score': float(scores[index]),
            })
        return points

    def _infer_crop(self, img, keypoints_from_heatmaps):
        import torch
        org_h, org_w = img.shape[:2]
        resized = cv2.resize(img, _MODEL_INPUT_WH, interpolation=cv2.INTER_LINEAR) / 255.0
        normalized = ((resized - _MEAN) / _STD).transpose(2, 0, 1)[None].astype(np.float32)
        tensor = torch.from_numpy(normalized).to(self._device)
        with torch.no_grad():
            heatmaps = self._model(tensor).detach().cpu().numpy()
        points, prob = keypoints_from_heatmaps(
            heatmaps=heatmaps,
            center=np.array([[org_w // 2, org_h // 2]]),
            scale=np.array([[org_w, org_h]]),
            unbiased=True,
            use_udp=True,
        )
        return np.concatenate([points[:, :, ::-1], prob], axis=2)
