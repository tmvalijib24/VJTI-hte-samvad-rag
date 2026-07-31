"""
Reusable OCR service built on PaddleOCR 3.x.

Supports:
    - Marathi (Devanagari)
    - English
    - Mixed Marathi + English documents

Exposes:
    extract_text(image_path: str) -> str

The PaddleOCR model is loaded once (singleton)
and reused across requests.
"""

import logging
import os
from threading import Lock


# Disable OneDNN backend
os.environ.setdefault("FLAGS_use_mkldnn", "0")


logger = logging.getLogger(__name__)


# Supported file extensions
IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".gif",
    ".heic",
    ".heif",
}


def is_image_file(path: str) -> bool:
    """
    Check if file extension is supported.
    """
    _, ext = os.path.splitext(path.lower())
    return ext in IMAGE_EXTENSIONS



# ---------------------------------------------------------
# Singleton PaddleOCR instance
# ---------------------------------------------------------

_ocr_instance = None
_ocr_lock = Lock()



def _get_ocr():
    """
    Initialize PaddleOCR once and reuse it.
    """

    global _ocr_instance


    if _ocr_instance is not None:
        return _ocr_instance


    with _ocr_lock:

        if _ocr_instance is not None:
            return _ocr_instance


        logger.info("Initializing PaddleOCR model...")


        from paddleocr import PaddleOCR


        _ocr_instance = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="devanagari_PP-OCRv5_mobile_rec",

            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
)


        logger.info("PaddleOCR model loaded successfully.")


        return _ocr_instance




# ---------------------------------------------------------
# Public OCR function
# ---------------------------------------------------------


def extract_text(image_path: str) -> str:
    """
    Extract text from image.

    Args:
        image_path:
            Path of image file

    Returns:
        Extracted text string

    Raises:
        FileNotFoundError
        ValueError
        RuntimeError
    """


    # Validate file exists

    if not os.path.isfile(image_path):

        raise FileNotFoundError(
            f"Image file not found: {image_path}"
        )


    # Validate extension

    _, ext = os.path.splitext(image_path.lower())


    if ext not in IMAGE_EXTENSIONS:

        raise ValueError(
            f"Unsupported image format: {ext}"
        )


    logger.info(
        "Starting OCR for %s",
        image_path
    )


    ocr = _get_ocr()



    # Run OCR

    try:

        # PaddleOCR 3.x API
        result = ocr.predict(image_path)


    except Exception as exc:

        logger.exception(
            "OCR failed"
        )

        raise RuntimeError(
            f"OCR failed: {exc}"
        ) from exc




    # -----------------------------------------------------
    # Parse PaddleOCR 3.x result
    # -----------------------------------------------------

    lines = []



    for page in result:


        if not page:
            continue



        # PaddleOCR 3.x OCRResult

        if hasattr(page, "keys") and "rec_texts" in page:


            texts = page["rec_texts"]

            polys = page["rec_polys"]



            for text, poly in zip(texts, polys):


                text = str(text).strip()



                if text:

                    # vertical position
                    top_y = float(poly[0][1])


                    lines.append(
                        (top_y, text)
                    )




    if not lines:


        raise ValueError(
            f"No text detected in image: {image_path}"
        )



    # Sort text top-to-bottom

    lines.sort(
        key=lambda x: x[0]
    )



    extracted_text = "\n".join(
        text
        for _, text in lines
    )



    # Cleanup

    extracted_text = extracted_text.strip()



    while "\n\n\n" in extracted_text:

        extracted_text = extracted_text.replace(
            "\n\n\n",
            "\n\n"
        )



    logger.info(
        "OCR completed. Characters: %d Lines: %d",
        len(extracted_text),
        len(lines),
    )


    return extracted_text