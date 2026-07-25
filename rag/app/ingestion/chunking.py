from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


class Chunker:

    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,       # 🔥 increased from 200
            chunk_overlap=150,    # 🔥 increased from 50
            separators=["\n\n", "\n", ".", " ", ""]
        )

    def chunk(self, docs: List[Document]) -> List[Document]:
        chunks = []

        for doc in docs:
            split_texts = self.splitter.split_text(doc.page_content)

            for text in split_texts:
                chunks.append(
                    Document(
                        page_content=text,
                        metadata=doc.metadata
                    )
                )

        return self.add_chunk_ids(chunks)

    def add_chunk_ids(self, chunks: List[Document]) -> List[Document]:
        for idx, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = idx
        return chunks