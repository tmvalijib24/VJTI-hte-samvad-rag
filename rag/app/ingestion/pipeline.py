import logging
import os
from typing import List, Tuple

from langchain_core.documents import Document

from app.ingestion.loader import DocumentLoader
from app.ingestion.chunking import Chunker
from app.ocr.ocr_service import IMAGE_EXTENSIONS

logger = logging.getLogger(__name__)


def _has_image_ext(path: str) -> bool:
    """Return True when *path* ends with a recognised image extension."""
    _, ext = os.path.splitext(path.lower())
    return ext in IMAGE_EXTENSIONS


class IngestionPipeline:

    def __init__(self):
        self.loader = DocumentLoader()
        self.chunker = Chunker()

    def ingest(self, path: str) -> List[Document]:
        docs = []

        if path.startswith("http://") or path.startswith("https://"):
            docs = self.loader.load_url(path)

        elif path.endswith(".pdf"):
            docs = self.loader.load_pdf(path)

        elif path.endswith(".txt"):
            docs = self.loader.load_txt(path)

        elif path.endswith(".csv"):
            docs = self.loader.load_csv(path)

        elif _has_image_ext(path):
            logger.info("Image file detected — routing through OCR: %s", path)
            docs = self.loader.load_image(path)

        else:
            raise ValueError("Unsupported file type")

        # Apply chunking
        chunks = self.chunker.chunk(docs)
        logger.info("Chunking complete — %d chunk(s) produced from %s", len(chunks), path)

        return chunks

    def ingest_with_stats(self, path: str) -> Tuple[List[Document], int]:
        """Returns (chunks, raw_page_count) for PDFs."""
        docs = []
        raw_count = 0

        if path.startswith("http://") or path.startswith("https://"):
            docs = self.loader.load_url(path)
            raw_count = 1

        elif path.endswith(".pdf"):
            docs = self.loader.load_pdf(path)
            raw_count = len(docs)

        elif path.endswith(".txt"):
            docs = self.loader.load_txt(path)
            raw_count = 1

        elif path.endswith(".csv"):
            docs = self.loader.load_csv(path)
            raw_count = len(docs)

        elif _has_image_ext(path):
            logger.info("Image file detected — routing through OCR: %s", path)
            docs = self.loader.load_image(path)
            raw_count = 1

        else:
            raise ValueError("Unsupported file type")

        chunks = self.chunker.chunk(docs)
        logger.info("Chunking complete — %d chunk(s) from %s", len(chunks), path)
        return chunks, raw_count