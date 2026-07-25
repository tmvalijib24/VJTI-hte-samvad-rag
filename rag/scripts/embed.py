import sys
import os
import uuid

# Fix import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ingestion.pipeline import IngestionPipeline
from app.embeddings.embedder import Embedder
from app.vectorstore.qdrant_store import QdrantStore
from app.db.postgres import PostgresStore

from app.retrieval.hyde import HyDEExpander
from app.retrieval.bm25 import BM25Retriever
from app.retrieval.hybrid import HybridRetriever
from app.retrieval.reranker import Reranker

from app.generation.generator import Generator


# =========================
# STEP 1: INGEST DOCUMENT
# =========================
pipeline = IngestionPipeline()
docs, raw_page_count = pipeline.ingest_with_stats("data/sample.pdf")

texts = [doc.page_content for doc in docs]

print(f"📄 Raw pages: {raw_page_count}")
print(f"✂️  Chunks created: {len(docs)}")


# =========================
# STEP 2: EMBEDDINGS
# =========================
embedder = Embedder()
vectors = embedder.embed_texts(texts)

print(f"🔢 Total chunks: {len(vectors)}")
print(f"📐 Embedding dim: {len(vectors[0])}")

for chunk in texts:
    if "GDB" in chunk or "gdb" in chunk:
        print("✅ FOUND GDB CHUNK:\n", chunk)

# =========================
# STEP 3: STORE IN QDRANT
# =========================
store = QdrantStore()
store.create_collection()

pg = PostgresStore()
doc = pg.get_or_create_document(source="data/sample.pdf")

chunk_rows = pg.replace_chunks(
    document_id=doc.id,
    chunks=[
        {
            "chunk_index": i,
            "page_number": d.metadata.get("page"),
            "text": d.page_content,
            "metadata": d.metadata,
        }
        for i, d in enumerate(docs)
    ],
)

payloads = [
    {
        "chunk_id": str(row.id),
        "document_id": str(row.document_id),
        "chunk_index": row.chunk_index,
        "page_number": row.page_number,
        "source": doc.source,
    }
    for row in chunk_rows
]

ids = [str(row.id) for row in chunk_rows]
store.upload(vectors=vectors, payloads=payloads, ids=ids)

print("✅ Stored in Qdrant!")


# =========================
# STEP 4: BM25 + HYBRID
# =========================
bm25_chunks = [
    {
        "chunk_id": str(row.id),
        "text": row.text,
        "page_number": row.page_number,
    }
    for row in chunk_rows
]
bm25 = BM25Retriever(bm25_chunks)
hybrid = HybridRetriever(store, bm25, embedder)


# =========================
# STEP 5: RERANKER
# =========================
reranker = Reranker()


# =========================
# STEP 6: QUERY
# =========================
query = "What are sequirity settings ?"

print(f"\n🔍 Query: {query}")

# =========================
# STEP 7: HYDE EXPANSION
# =========================
hyde = HyDEExpander()
expanded_query = hyde.expand(query)

print(f"\n🧠 Expanded Query: {expanded_query}")


# =========================
# STEP 8: HYBRID SEARCH
# =========================
results = hybrid.search(expanded_query)

# Fill missing text for vector results (Qdrant payload no longer stores raw text)
id_to_text = {str(r.id): r.text for r in chunk_rows}
id_to_page = {str(r.id): r.page_number for r in chunk_rows}
for r in results:
    if not r.get("text") and r.get("chunk_id"):
        r["text"] = id_to_text.get(r["chunk_id"])
    if r.get("chunk_id") and not r.get("page_number"):
        r["page_number"] = id_to_page.get(r["chunk_id"])

results = [r for r in results if r.get("text")]

print("\n🔥 Hybrid Results (Before Rerank):\n")

for i, res in enumerate(results[:5]):
    page_info = f" | Page: {res.get('page_number', 'N/A')}" if res.get('page_number') is not None else ""
    print(f"Result {i+1} | Score: {res['score']:.4f}{page_info}")
    print(res["text"][:200])
    print("------")


# =========================
# STEP 9: RERANKING
# =========================
reranked_results = reranker.rerank(expanded_query, results)

# ✅ FILTER ONLY RELEVANT RESULTS
filtered_results = reranked_results[:5]

print("\n🎯 Final Filtered Results:\n")

for i, res in enumerate(filtered_results):
    page_info = f" | Page: {res.get('page_number', 'N/A')}" if res.get('page_number') is not None else ""
    print(f"Result {i+1} | Rerank Score: {res['rerank_score']:.4f}{page_info}")
    print(res["text"][:200])
    print("------")

# =========================
# STEP 10: GENERATE ANSWER
# =========================

generator = Generator()

contexts = [res["text"] for res in filtered_results]

answer = generator.generate(query, contexts)

print("\n🧠 FINAL ANSWER:\n")
print(answer)