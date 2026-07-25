import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


from app.ingestion.loader import DocumentLoader
from app.ingestion.chunking import Chunker

if __name__ == "__main__":
    loader = DocumentLoader()
    chunker = Chunker()

    raw_docs = loader.load_pdf("data/sample.pdf")
    chunks = chunker.hybrid_chunk(raw_docs)

    print(f"Raw pages: {len(raw_docs)}")
    print(f"Total chunks: {len(chunks)}")

    print("\nSample chunk:\n")
    print(chunks[0].page_content[:200])

    for i in range(3):
        print(f"\n--- Chunk {i} ---")
        print(chunks[i].page_content[:200])