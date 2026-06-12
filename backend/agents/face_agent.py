"""
Face agent — insightface (ArcFace ONNX) + OpenCV.

No TensorFlow. No dlib. Works on Python 3.14.

Strategy:
  • register_face()  — detect face, extract 512-d ArcFace embedding, return as list
  • verify_face()    — extract embedding from probe, cosine-compare against stored embedding
  • Only the numeric embedding is stored in MongoDB — never the raw photo.

insightface auto-downloads buffalo_sc (~300 MB) on first call to prepare().
buffalo_sc  = detection (RetinaFace ONNX) + recognition (ArcFace ONNX).
"""
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import logging
import threading

logger = logging.getLogger(__name__)

COSINE_THRESHOLD = 0.40   # distance <= threshold → match  (ArcFace cosine, lower = more similar)

# Singleton — model loads once, reused across requests
_app: FaceAnalysis | None = None
_lock = threading.Lock()


def _get_app() -> FaceAnalysis:
    global _app
    if _app is None:
        with _lock:
            if _app is None:
                logger.info("Loading insightface buffalo_sc model (first call)…")
                app = FaceAnalysis(
                    name="buffalo_sc",         # lightweight: det_500m + w600k_r50 (ArcFace)
                    providers=["CPUExecutionProvider"],
                )
                app.prepare(ctx_id=0, det_size=(640, 640))
                _app = app
                logger.info("insightface model ready.")
    return _app


def _decode(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image. Please upload a valid JPG or PNG.")
    return img


def _extract_embedding(img_bgr: np.ndarray) -> np.ndarray:
    """
    Detect faces and return the ArcFace 512-d embedding of the largest face.
    Raises ValueError if no face is detected.
    """
    app   = _get_app()
    faces = app.get(img_bgr)
    if not faces:
        raise ValueError("No face detected. Please use a clear, well-lit, front-facing photo.")
    # Pick the largest bounding box (most prominent face)
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.embedding   # shape (512,), float32


def register_face(image_bytes: bytes) -> list[float]:
    """
    Validate photo and extract ArcFace embedding.
    Returns the 512-d embedding as a plain Python list (JSON-serialisable).
    Raises ValueError with a user-friendly message on failure.
    """
    img = _decode(image_bytes)
    emb = _extract_embedding(img)
    return emb.tolist()


def verify_face(probe_bytes: bytes, stored_embedding: list[float]) -> tuple[bool, float]:
    """
    Compare a webcam probe image against a stored ArcFace embedding.
    Returns (matched: bool, distance: float).
    distance is cosine distance in [0, 2]; lower = more similar.
    """
    img       = _decode(probe_bytes)
    probe_emb = _extract_embedding(img)

    stored = np.array(stored_embedding, dtype=np.float32)

    # Cosine distance = 1 − cosine_similarity
    probe_n  = probe_emb  / (np.linalg.norm(probe_emb)  + 1e-10)
    stored_n = stored     / (np.linalg.norm(stored)      + 1e-10)
    distance = float(1.0 - np.dot(probe_n, stored_n))

    matched = distance <= COSINE_THRESHOLD
    return matched, distance
