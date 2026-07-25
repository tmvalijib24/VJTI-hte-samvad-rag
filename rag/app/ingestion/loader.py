import fitz
import pandas as pd
import requests
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from typing import List


class DocumentLoader:

    def load_pdf(self, path: str) -> List[Document]:
        docs = []
        try:
            pdf = fitz.open(path)
        except Exception as e:
            raise ValueError(f"Invalid or corrupted PDF: {path}") from e

        for i, page in enumerate(pdf):
            text = page.get_text()
            if text.strip():  # avoid empty pages
                docs.append(
                    Document(
                        page_content=text,
                        metadata={"source": path, "page": i}
                    )
                )
        return docs

    def load_txt(self, path: str) -> List[Document]:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()

        return [Document(page_content=text, metadata={"source": path})]

    def load_csv(self, path: str) -> List[Document]:
        df = pd.read_csv(path)
        docs = []

        for i, row in df.iterrows():
            content = " | ".join([str(v) for v in row.values])
            docs.append(
                Document(
                    page_content=content,
                    metadata={"source": path, "row": i}
                )
            )
        return docs

    def load_url(self, url: str) -> List[Document]:
        """Load and clean text content from a single web page URL."""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except Exception as e:
            raise ValueError(f"Failed to fetch URL: {url}") from e

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove non-content elements
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        text = soup.get_text(separator="\n")
        # Basic cleanup: strip blank lines and extra spaces
        lines = [line.strip() for line in text.splitlines()]
        non_empty_lines = [line for line in lines if line]
        cleaned_text = "\n".join(non_empty_lines).strip()

        if not cleaned_text:
            raise ValueError(f"No textual content found at URL: {url}")

        return [
            Document(
                page_content=cleaned_text,
                metadata={"source": url},
            )
        ]