from typing import List, Tuple
from langchain_core.documents import Document
from app.ingestion.loader import DocumentLoader
from app.ingestion.chunking import Chunker


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

        else:
            raise ValueError("Unsupported file type")

        # Apply chunking
        chunks = self.chunker.chunk(docs)

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

        else:
            raise ValueError("Unsupported file type")

        chunks = self.chunker.chunk(docs)
        return chunks, raw_count