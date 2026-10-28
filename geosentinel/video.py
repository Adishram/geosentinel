"""Local, sampled video detection using pretrained COCO elephant class."""
import base64
from pathlib import Path
from threading import Lock

_LOCK = Lock()
_MODEL = None


def detect(path):
    global _MODEL
    import cv2
    from ultralytics import YOLO
    with _LOCK:
        if _MODEL is None:
            weights = Path(__file__).resolve().parent.parent / 'data' / 'models' / 'yolo11n.pt'
            weights.parent.mkdir(exist_ok=True)
            _MODEL = YOLO(str(weights))
        elephant = next(k for k, v in _MODEL.names.items() if v == 'elephant')
        cap = cv2.VideoCapture(str(path))
        try:
            fps = cap.get(cv2.CAP_PROP_FPS)
            frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if not cap.isOpened() or fps <= 0 or frames <= 0:
                raise ValueError('Video could not be decoded. Upload an MP4 with H.264 video.')
            duration = frames / fps
            if duration > 120:
                raise ValueError('Please upload a clip no longer than 2 minutes.')
            best, hits, checked = None, 0, 0
            for second in range(max(1, int(duration))):
                cap.set(cv2.CAP_PROP_POS_MSEC, second * 1000)
                ok, frame = cap.read()
                if not ok:
                    continue
                checked += 1
                result = _MODEL.predict(frame, classes=[elephant], conf=.6, verbose=False, device='cpu')[0]
                if len(result.boxes):
                    hits += 1
                    confidence = float(result.boxes.conf.max())
                    if best is None or confidence > best[0]:
                        best = (confidence, second, result.plot())
            if not checked:
                raise ValueError('No video frames could be read.')
            image = None
            if best:
                ok, jpg = cv2.imencode('.jpg', best[2])
                if ok:
                    image = 'data:image/jpeg;base64,' + base64.b64encode(jpg).decode()
            return {'detected': best is not None, 'image': image, 'confidence': best[0] if best else None,
                    'timestamp_seconds': best[1] if best else None, 'frames_checked': checked,
                    'positive_frames': hits, 'sample_interval_seconds': 1, 'duration_seconds': duration,
                    'message': 'Elephant detected in uploaded footage.' if best else 'No elephant detected in sampled frames. This does not establish absence.'}
        finally:
            cap.release()
