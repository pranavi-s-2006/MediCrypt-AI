"""
agents/ocr_agent.py
-------------------
TrOCR-based OCR agent supporting JPEG, PNG, and PDF inputs.

PDF flow:  bytes → utils.pdf_converter → PIL Images → TrOCR per page → joined text
Image flow: bytes → PIL Image → compress → TrOCR → text

All errors are caught and returned as structured dicts so the caller
(patient_routes / ai_routes) can always inspect status without crashing.
"""

import io
import logging
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from config import settings
import torch

from utils.pdf_converter import convert_pdf_to_images

logger = logging.getLogger(__name__)

# ── Model singleton ────────────────────────────────────────
_processor: TrOCRProcessor | None               = None
_model:     VisionEncoderDecoderModel | None    = None

MAX_IMAGE_DIM = 1024    # pixels — longest side before TrOCR
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".pdf"}


def _load_model() -> None:
    global _processor, _model
    if _processor is None:
        logger.info("Loading TrOCR model: %s", settings.OCR_MODEL)
        _processor = TrOCRProcessor.from_pretrained(settings.OCR_MODEL)
        _model     = VisionEncoderDecoderModel.from_pretrained(settings.OCR_MODEL)
        _model.eval()
        logger.info("TrOCR model loaded")


def _compress(image: Image.Image) -> Image.Image:
    """Down-scale so longest side ≤ MAX_IMAGE_DIM (Lanczos)."""
    w, h = image.size
    if max(w, h) <= MAX_IMAGE_DIM:
        return image
    scale = MAX_IMAGE_DIM / max(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    logger.info("Compressing image %dx%d → %dx%d", w, h, new_w, new_h)
    return image.resize((new_w, new_h), Image.LANCZOS)


def _run_trocr(image: Image.Image) -> str:
    """Run TrOCR on a single RGB PIL Image and return raw text."""
    _load_model()
    image        = image.convert("RGB")
    image        = _compress(image)
    pixel_values = _processor(images=image, return_tensors="pt").pixel_values
    with torch.no_grad():
        ids = _model.generate(pixel_values, max_new_tokens=512)
    text = _processor.batch_decode(ids, skip_special_tokens=True)[0]
    logger.info("TrOCR decoded %d characters", len(text))
    return text


def _is_pdf(data: bytes) -> bool:
    return data[:4] == b"%PDF"


# ── Public entry point ─────────────────────────────────────

async def extract_text_from_image(image_bytes: bytes) -> str:
    """
    OCR entry point.

    Parameters
    ----------
    image_bytes : raw bytes of JPG / PNG / PDF

    Returns
    -------
    str — extracted text (may be empty string if nothing recognised)

    Raises
    ------
    RuntimeError  — with a human-readable message on unrecoverable failure
                    (callers should catch this and set status = OCR_FAILED)
    """
    if _is_pdf(image_bytes):
        return await _ocr_pdf(image_bytes)
    else:
        return await _ocr_image(image_bytes)


async def _ocr_pdf(pdf_bytes: bytes) -> str:
    logger.info("OCR: PDF received (%d bytes)", len(pdf_bytes))

    result = convert_pdf_to_images(pdf_bytes)

    if result["status"] != "ok":
        # convert_pdf_to_images already logged; surface a clean RuntimeError
        raise RuntimeError(result["message"])

    images: list[Image.Image] = result["images"]
    logger.info("OCR: %d page image(s) ready, starting TrOCR", len(images))

    page_texts: list[str] = []
    for idx, img in enumerate(images):
        logger.info("OCR: processing page %d/%d", idx + 1, len(images))
        text = _run_trocr(img)
        page_texts.append(text)
        logger.info("OCR: page %d complete — %d chars", idx + 1, len(text))

    combined = "\n\n--- Page Break ---\n\n".join(t for t in page_texts if t.strip())
    logger.info("OCR: PDF processing complete — total %d chars", len(combined))
    return combined


async def _ocr_image(image_bytes: bytes) -> str:
    logger.info("OCR: image received (%d bytes)", len(image_bytes))
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise RuntimeError(f"Cannot open image: {exc}") from exc

    logger.info("OCR: image opened (%s, %dx%d), starting TrOCR", image.format, *image.size)
    text = _run_trocr(image)
    logger.info("OCR: image processing complete — %d chars", len(text))
    return text
