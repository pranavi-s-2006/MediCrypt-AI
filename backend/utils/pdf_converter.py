"""
utils/pdf_converter.py
----------------------
Converts PDF bytes to a list of PIL Images using PyMuPDF (fitz).

Usage:
    from utils.pdf_converter import convert_pdf_to_images

    result = convert_pdf_to_images(pdf_bytes)
    if result["status"] == "ok":
        images = result["images"]   # list[PIL.Image.Image]
    else:
        print(result["message"])    # human-readable error, never raises

Returns a dict so callers can always inspect status without try/except.
"""

import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)

MAX_PAGES  = 2      # only first N pages are processed
ZOOM       = 2.0    # render scale — higher = better quality for OCR


def convert_pdf_to_images(pdf_bytes: bytes) -> dict:
    """
    Convert up to MAX_PAGES pages of a PDF to RGB PIL Images.

    Returns:
        {"status": "ok",    "images": [PIL.Image, ...], "page_count": int}
      or
        {"status": "error", "message": str, "images": []}
    """
    # ── Guard: PyMuPDF available? ─────────────────────────
    try:
        import fitz  # PyMuPDF
    except ImportError:
        msg = (
            "PDF processing library (PyMuPDF) is not installed. "
            "Run:  pip install pymupdf"
        )
        logger.error(msg)
        return {"status": "error", "message": msg, "images": []}

    # ── Guard: valid PDF magic bytes ──────────────────────
    if pdf_bytes[:4] != b"%PDF":
        msg = "File does not appear to be a valid PDF (missing %PDF header)."
        logger.warning(msg)
        return {"status": "error", "message": msg, "images": []}

    # ── Convert pages ─────────────────────────────────────
    images: list[Image.Image] = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_to_process = min(total_pages, MAX_PAGES)

        logger.info(
            "PDF converter: %d total pages, processing first %d",
            total_pages, pages_to_process,
        )

        mat = fitz.Matrix(ZOOM, ZOOM)

        for page_num in range(pages_to_process):
            page = doc[page_num]
            pix  = page.get_pixmap(matrix=mat, alpha=False)
            img  = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
            logger.info(
                "  Page %d/%d converted → %dx%d px",
                page_num + 1, pages_to_process, pix.width, pix.height,
            )

        doc.close()

    except Exception as exc:
        msg = f"PDF conversion failed: {exc}"
        logger.error(msg, exc_info=True)
        return {"status": "error", "message": msg, "images": []}

    if not images:
        return {
            "status": "error",
            "message": "PDF has no renderable pages.",
            "images": [],
        }

    logger.info("PDF converter: %d image(s) ready for OCR", len(images))
    return {"status": "ok", "images": images, "page_count": len(images)}
