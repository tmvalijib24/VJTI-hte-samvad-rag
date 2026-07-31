import logging
import os
import tempfile
from typing import List

import fitz
import pandas as pd
import requests
from PIL import Image
from bs4 import BeautifulSoup
from langchain_core.documents import Document

from app.ocr.ocr_service import extract_text as ocr_extract_text

logger = logging.getLogger(__name__)


class DocumentLoader:

    # ---------------------------------------------------------
    # IMAGE
    # ---------------------------------------------------------
    def load_image(self, path: str) -> List[Document]:
        logger.info("Loading image via OCR: %s", path)

        text = ocr_extract_text(path)

        logger.info(
            "OCR extracted %d characters",
            len(text)
        )

        return [
            Document(
                page_content=text,
                metadata={
                    "source": path,
                    "source_type": "image",
                },
            )
        ]

    # ---------------------------------------------------------
    # PDF
    # ---------------------------------------------------------
    def load_pdf(self, path: str) -> List[Document]:

        docs = []

        try:
            pdf = fitz.open(path)
        except Exception as e:
            raise ValueError(
                f"Invalid PDF: {path}"
            ) from e

        logger.info("Loading PDF: %s", path)

        for page_number, page in enumerate(pdf, start=1):

            logger.info("Processing page %d", page_number)

            # ----------------------------------------
            # First try normal PDF text extraction
            # ----------------------------------------
            text = page.get_text("text").strip()

            if text:

                logger.info(
                    "Page %d contains selectable text.",
                    page_number
                )

            else:

                logger.info(
                    "Page %d is scanned. Running OCR...",
                    page_number
                )

                pix = page.get_pixmap(
                    dpi=300,
                    alpha=False
                )

                with tempfile.NamedTemporaryFile(
                    suffix=".png",
                    delete=False
                ) as tmp:

                    temp_path = tmp.name

                try:

                    pix.save(temp_path)

                    # -------------------------------
                    # Image preprocessing
                    # -------------------------------

                    img = Image.open(temp_path)
                    img.save(temp_path)


                    text = ocr_extract_text(
                        temp_path
                    ).strip()

                finally:

                    if os.path.exists(temp_path):
                        os.remove(temp_path)

            if not text:

                logger.warning(
                    "No text extracted from page %d",
                    page_number
                )

                continue

            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": path,
                        "page": page_number,
                    },
                )
            )

        logger.info(
            "Loaded %d pages from %s",
            len(docs),
            path
        )

        return docs

    # ---------------------------------------------------------
    # TXT
    # ---------------------------------------------------------
    def load_txt(self, path: str) -> List[Document]:

        with open(
            path,
            "r",
            encoding="utf-8"
        ) as f:

            text = f.read()

        return [
            Document(
                page_content=text,
                metadata={
                    "source": path,
                },
            )
        ]

    # ---------------------------------------------------------
    # CSV
    # ---------------------------------------------------------
    def load_csv(self, path: str) -> List[Document]:

        df = pd.read_csv(path)

        docs = []

        for i, row in df.iterrows():

            content = " | ".join(
                str(v)
                for v in row.values
            )

            docs.append(
                Document(
                    page_content=content,
                    metadata={
                        "source": path,
                        "row": i,
                    },
                )
            )

        return docs

    # ---------------------------------------------------------
    # URL
    # ---------------------------------------------------------
    def load_url(self, url: str) -> List[Document]:

        try:

            response = requests.get(
                url,
                timeout=10
            )

            response.raise_for_status()

        except Exception as e:

            raise ValueError(
                f"Failed to fetch URL: {url}"
            ) from e

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        for tag in soup(
            [
                "script",
                "style",
                "noscript",
            ]
        ):
            tag.decompose()

        text = soup.get_text(
            separator="\n"
        )

        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip()
        ]

        cleaned = "\n".join(lines)

        if not cleaned:

            raise ValueError(
                f"No textual content found at {url}"
            )

        return [
            Document(
                page_content=cleaned,
                metadata={
                    "source": url,
                },
            )
        ]