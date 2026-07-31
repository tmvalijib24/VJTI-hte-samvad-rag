"""
Reusable OCR service built on PaddleOCR 3.x.

Exposes a single public function:
    extract_text(image_path: str) -> str

The PaddleOCR model is loaded once (singleton) and reused across all
requests. CPU inference is used by default.

PaddleOCR 3.x API changes from 2.x:
  - Constructor no longer accepts use_angle_cls or use_gpu.
  - ocr() no longer accepts the cls keyword argument.
  - Results are now OCRResult objects rather than raw nested lists.
"""

import logging
import os
from threading import Lock

# Disable PaddlePaddle's OneDNN (MKL-DNN) backend before any paddle import.
# On Windows, the OneDNN executor raises:
#   ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]
# Setting this env-var to 0 forces the plain CPU path instead.
os.environ.setdefault("FLAGS_use_mkldnn", "0")

logger = logging.getLogger(__name__)

# Supported image extensions (lowercase, with leading dot)
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def is_image_file(path: str) -> bool:
    """Return True if *path* has a recognised image extension."""
    _, ext = os.path.splitext(path.lower())
    return ext in IMAGE_EXTENSIONS


# ---------------------------------------------------------------------------
# Singleton PaddleOCR instance – loaded lazily on first call
# ---------------------------------------------------------------------------
_ocr_instance = None
_ocr_lock = Lock()


def _get_ocr():
    """Return a shared PaddleOCR instance (thread-safe lazy init)."""
    global _ocr_instance
    if _ocr_instance is not None:
        return _ocr_instance

    with _ocr_lock:
        if _ocr_instance is not None:          # double-check after lock
            return _ocr_instance

        logger.info("Initialising PaddleOCR model (CPU) …")
        from paddleocr import PaddleOCR        # heavy import – keep lazy

        # PaddleOCR 3.x: lang= is still accepted; angle classification is
        # enabled automatically. show_log= was removed in 3.x.
        # enable_mkldnn=False disables the OneDNN backend which crashes on Windows.
        _ocr_instance = PaddleOCR(lang="en", enable_mkldnn=False)
        logger.info("PaddleOCR model ready.")
        return _ocr_instance


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_text(image_path: str) -> str:
    """
    Run OCR on *image_path* and return the concatenated text in
    top-to-bottom reading order.

    Raises
    ------
    FileNotFoundError  – if *image_path* does not exist.
    ValueError         – if the image is corrupt / unreadable or
                         if no text is detected.
    RuntimeError       – on unexpected PaddleOCR failures.
    """
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    _, ext = os.path.splitext(image_path.lower())
    if ext not in IMAGE_EXTENSIONS:
        raise ValueError(
            f"Unsupported image format '{ext}'. "
            f"Supported: {', '.join(sorted(IMAGE_EXTENSIONS))}"
        )

    logger.info("OCR starting for: %s", image_path)
    ocr = _get_ocr()

    try:
        # PaddleOCR 3.x: ocr() / predict() no longer accepts cls=
        result = ocr.ocr(image_path)
    except Exception as exc:
        logger.error("PaddleOCR failed on %s: %s", image_path, exc)
        raise RuntimeError(f"OCR processing failed for {image_path}: {exc}") from exc

    # ------------------------------------------------------------------
    # Parse results.
    #
    # PaddleOCR 3.x returns a list of OCRResult objects (one per page /
    # image).  Each OCRResult supports iteration and yields individual
    # text-line detections.  Each detection exposes:
    #   .bbox  – list of four [x, y] corner points
    #   .text  – recognised string
    #   .score – confidence float
    #
    # We fall back to the legacy nested-list format if the objects don't
    # carry those attributes, so the service stays compatible with both
    # the 2.x and 3.x result shapes.
    # ------------------------------------------------------------------
    lines: list[tuple[float, str]] = []

    if result:
        for page in result:
            if not page:
                continue

            # --- PaddleOCR 3.x dict-like result ---
            if hasattr(page, 'keys') and 'rec_texts' in page and 'dt_polys' in page:
                texts = page.get('rec_texts', [])
                polys = page.get('dt_polys', [])
                
                if texts and polys:
                    for text, poly in zip(texts, polys):
                        text_str = str(text).strip()
                        if text_str and poly is not None and len(poly) > 0:
                            # top_y is usually poly[0][1] (top left y coord)
                            top_y = float(poly[0][1])
                            lines.append((top_y, text_str))
                continue

            # --- PaddleOCR 2.x / legacy list-of-list result ---
            if isinstance(page, list):
                for detection in page:
                    if not detection or len(detection) < 2:
                        continue
                    bbox = detection[0]
                    text_tuple = detection[1]
                    if not text_tuple or not isinstance(text_tuple, (list, tuple)):
                        continue
                    text = str(text_tuple[0]).strip()
                    if text:
                        top_y = float(bbox[0][1])
                        lines.append((top_y, text))

    if not lines:
        raise ValueError(f"No text detected in image: {image_path}")

    # Sort by vertical position (top → bottom) to preserve reading order
    lines.sort(key=lambda t: t[0])
    extracted = "\n".join(text for _, text in lines)

    # Basic cleanup: collapse excessive blank lines
    while "\n\n\n" in extracted:
        extracted = extracted.replace("\n\n\n", "\n\n")
    extracted = extracted.strip()

    logger.info(
        "OCR complete for %s — extracted %d characters across %d lines",
        image_path,
        len(extracted),
        len(lines),
    )

    return extracted
