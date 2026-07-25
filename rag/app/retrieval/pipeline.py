from app.embeddings.embedder import Embedder
from app.vectorstore.qdrant_store import QdrantStore
from app.db.postgres import PostgresStore
from app.retrieval.hyde import HyDEExpander
from app.retrieval.bm25 import BM25Retriever
from app.retrieval.hybrid import HybridRetriever
from app.retrieval.reranker import Reranker
from app.generation.generator import Generator


def query_rag(query: str):
    # =========================
    # SETUP (same as embed.py)
    # =========================
    embedder = Embedder()
    store = QdrantStore()

    pg = PostgresStore()
    doc = pg.get_or_create_document(source="data/sample.pdf")
    chunk_rows = pg.fetch_all_chunks(document_id=doc.id)
    if not chunk_rows:
        raise RuntimeError(
            "No chunks found in Postgres for data/sample.pdf. Run scripts/embed.py first after setting DATABASE_URL."
        )

    # ⚠️ Load texts again (important for BM25)
    # You may store this globally later (optimization)
    bm25_chunks = [{"chunk_id": str(r.id), "text": r.text} for r in chunk_rows]
    bm25 = BM25Retriever(bm25_chunks)
    hybrid = HybridRetriever(store, bm25, embedder)
    reranker = Reranker()
    generator = Generator()

    # =========================
    # HYDE
    # =========================
    hyde = HyDEExpander()
    expanded_query = hyde.expand(query)

    # =========================
    # SEARCH
    # =========================
    results = hybrid.search(expanded_query)

    # Fill missing text for vector results using Postgres
    id_to_text = {str(r.id): r.text for r in chunk_rows}
    for r in results:
        if not r.get("text") and r.get("chunk_id"):
            r["text"] = id_to_text.get(r["chunk_id"])

    results = [r for r in results if r.get("text")]

    # =========================
    # RERANK
    # =========================
    reranked = reranker.rerank(query, results)

    filtered = reranked[:5]

    # =========================
    # CONTEXTS
    # =========================
    contexts = [r["text"] for r in filtered[:5]]

    # =========================
    # GENERATE
    # =========================
    answer = generator.generate(query, contexts)

    return {
        "answer": answer,
        "contexts": contexts   # 🔥 REQUIRED FOR RAGAs
    }