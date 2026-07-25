import uuid
from dataclasses import dataclass
from typing import Any, Dict, List

from app.db.postgres import PostgresStore
from app.embeddings.embedder import Embedder
from app.generation.generator import Generator
from app.ingestion.pipeline import IngestionPipeline
from app.retrieval.bm25 import BM25Retriever
from app.retrieval.hybrid import HybridRetriever
from app.retrieval.hyde import HyDEExpander
from app.retrieval.reranker import Reranker
from app.vectorstore.qdrant_store import QdrantStore


@dataclass(frozen=True)
class IngestResult:
    document_id: str
    source: str
    raw_count: int
    chunk_count: int


def _json_number(value: Any):
    """Convert numpy/scalar numeric types to JSON-safe Python numbers."""
    if value is None:
        return None
    try:
        # numpy scalars have .item()
        item = value.item  # type: ignore[attr-defined]
    except Exception:
        item = None
    if callable(item):
        try:
            return value.item()
        except Exception:
            pass
    # Fall back to float/int where possible
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except Exception:
        return None


def answer_basic_message(message: str, chat_history: List[Dict[str, str]] | None = None) -> str:
    """Use Groq free model for general basic chat mode."""
    prompt = (message or "").strip()
    if not prompt:
        return "Please type a message."

    generator = Generator()
    return generator.generate_basic(prompt, chat_history=chat_history)


def ingest_and_index(user_id: str, source: str) -> IngestResult:
    """
    Ingest a local file path or URL, chunk it, embed it,
    store chunks in Postgres and vectors in Qdrant.
    All data is tagged with tenant_id for multi-tenant isolation.
    """
    user_uuid = uuid.UUID(user_id)
    
    pipeline = IngestionPipeline()
    docs, raw_count = pipeline.ingest_with_stats(source)
    texts = [d.page_content for d in docs]

    embedder = Embedder()
    vectors = embedder.embed_texts(texts)

    store = QdrantStore()
    store.create_collection()

    pg = PostgresStore()
    doc_row = pg.get_or_create_document(user_id=user_uuid, source=source)

    chunk_rows = pg.replace_chunks(
        user_id=user_uuid,
        document_id=doc_row.id,
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
            "source": doc_row.source,
        }
        for row in chunk_rows
    ]
    ids = [str(row.id) for row in chunk_rows]
    # Pass tenant_id (user_id) to upload - it will be added to every payload
    store.upload(vectors=vectors, payloads=payloads, ids=ids, tenant_id=str(user_uuid))

    return IngestResult(
        document_id=str(doc_row.id),
        source=doc_row.source,
        raw_count=raw_count,
        chunk_count=len(chunk_rows),
    )


def answer_question(
    *,
    user_id: str,
    document_id: str,
    question: str,
    top_k: int = 5,
    chat_history: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """
    Run retrieval + generation for a single document.
    Returns answer + sources suitable for UI citations.
    All queries are scoped to the current user (tenant).
    """
    user_uuid = uuid.UUID(user_id)
    doc_uuid = uuid.UUID(document_id)

    embedder = Embedder()
    store = QdrantStore()
    pg = PostgresStore()

    chunk_rows = pg.fetch_all_chunks(user_id=user_uuid, document_id=doc_uuid)
    if not chunk_rows:
        raise RuntimeError("No chunks found for this document_id. Ingest first.")

    bm25_chunks = [{"chunk_id": str(r.id), "text": r.text, "page_number": r.page_number} for r in chunk_rows]
    bm25 = BM25Retriever(bm25_chunks)
    hybrid = HybridRetriever(store, bm25, embedder)
    reranker = Reranker()
    generator = Generator()

    hyde = HyDEExpander()
    expanded_query = hyde.expand(question)

    # Pass tenant_id to hybrid search for multi-tenant isolation in Qdrant
    results = hybrid.search(expanded_query, tenant_id=str(user_uuid))

    # Fill missing text/page using Postgres rows
    id_to_row = {str(r.id): r for r in chunk_rows}
    for r in results:
        cid = r.get("chunk_id")
        if cid and (not r.get("text")):
            row = id_to_row.get(cid)
            if row:
                r["text"] = row.text
        if cid and (r.get("page_number") is None):
            row = id_to_row.get(cid)
            if row:
                r["page_number"] = row.page_number

    results = [r for r in results if r.get("text")]

    reranked = reranker.rerank(question, results)
    selected = reranked[: max(1, int(top_k))]

    sources = [
        {
            "chunk_id": r.get("chunk_id"),
            "score": _json_number(r.get("score")),
            "rerank_score": _json_number(r.get("rerank_score")),
            "page_number": r.get("page_number"),
            "source": (id_to_row.get(r.get("chunk_id", "")).meta.get("source") if r.get("chunk_id") in id_to_row else None),
            "text": r.get("text"),
        }
        for r in selected
    ]

    # Provide the generator with labeled context blocks so it can cite them as [1], [2], ...
    context_blocks: List[str] = []
    for i, s in enumerate(sources, start=1):
        src = s.get("source") or "unknown"
        page = s.get("page_number")
        header = f"[{i}] source={src}" + (f" page={page}" if page is not None else "")
        context_blocks.append(f"{header}\n{s.get('text') or ''}".strip())

    answer = generator.generate(question, context_blocks, chat_history=chat_history)

    return {
        "answer": answer,
        "sources": sources,
    }
