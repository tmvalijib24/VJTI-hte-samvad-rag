import logging
import os
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

logger = logging.getLogger(__name__)


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


def ingest_and_index(user_id: str, source: str, title: str | None = None) -> IngestResult:
    """
    Ingest a local file path or URL, chunk it, embed it,
    store chunks in Postgres and vectors in Qdrant.
    All data is tagged with tenant_id for multi-tenant isolation.
    """
    user_uuid = uuid.UUID(user_id)
    
    logger.info("Starting ingestion for user=%s source=%s", user_id, source)

    pipeline = IngestionPipeline()
    docs, raw_count = pipeline.ingest_with_stats(source)
    texts = [d.page_content for d in docs]
    logger.info("Ingestion produced %d chunk(s), raw_count=%d", len(docs), raw_count)

    embedder = Embedder()
    logger.info("Generating embeddings for %d text(s) …", len(texts))
    vectors = embedder.embed_texts(texts)
    logger.info("Embeddings generated successfully")

    store = QdrantStore()
    store.create_collection()

    pg = PostgresStore()
    doc_row = pg.get_or_create_document(user_id=user_uuid, source=source, title=title)

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

    display_source = doc_row.title or os.path.basename(doc_row.source) or doc_row.source
    payloads = [
        {
            "chunk_id": str(row.id),
            "document_id": str(row.document_id),
            "chunk_index": row.chunk_index,
            "page_number": row.page_number,
            "source": display_source,
        }
        for row in chunk_rows
    ]
    ids = [str(row.id) for row in chunk_rows]
    # Pass tenant_id (user_id) to upload - it will be added to every payload
    logger.info("Uploading %d vector(s) to Qdrant for tenant=%s …", len(vectors), user_uuid)
    store.upload(vectors=vectors, payloads=payloads, ids=ids, tenant_id=str(user_uuid))
    logger.info("Vectors stored successfully in Qdrant")

    return IngestResult(
        document_id=str(doc_row.id),
        source=doc_row.source,
        raw_count=raw_count,
        chunk_count=len(chunk_rows),
    )


def answer_question(
    *,
    user_id: str,
    document_id: str | None = None,
    document_ids: List[str] | str | None = None,
    question: str,
    top_k: int = 5,
    chat_history: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """
    Run retrieval + generation for one or more documents.
    Returns answer + sources suitable for UI citations.
    All queries are scoped to the current user (tenant).
    """
    user_uuid = uuid.UUID(user_id)
    
    # Parse document IDs
    doc_uuids: List[uuid.UUID] = []
    if document_ids:
        if isinstance(document_ids, str):
            doc_uuids = [uuid.UUID(document_ids)]
        else:
            doc_uuids = [uuid.UUID(d) for d in document_ids if d]
    elif document_id:
        doc_uuids = [uuid.UUID(document_id)]

    embedder = Embedder()
    store = QdrantStore()
    pg = PostgresStore()

    if doc_uuids:
        chunk_rows = pg.fetch_chunks_by_document_ids(user_id=user_uuid, document_ids=doc_uuids)
    else:
        # Default to searching all user's documents if none specified
        docs = pg.list_documents(user_id=user_uuid)
        doc_uuids = [d.id for d in docs]
        chunk_rows = pg.fetch_chunks_by_document_ids(user_id=user_uuid, document_ids=doc_uuids)

    if not chunk_rows:
        raise RuntimeError("No chunks found. Ingest document(s) first.")

    bm25_chunks = [{"chunk_id": str(r.id), "text": r.text, "page_number": r.page_number} for r in chunk_rows]
    bm25 = BM25Retriever(bm25_chunks)
    hybrid = HybridRetriever(store, bm25, embedder)
    reranker = Reranker()
    generator = Generator()

    hyde = HyDEExpander()
    expanded_query = hyde.expand(question)

    # Pass tenant_id and document list to hybrid search for multi-tenant and multi-document filtering
    results = hybrid.search(expanded_query, tenant_id=str(user_uuid), document_ids=doc_uuids)

    # Fill missing text/page using Postgres rows and resolve document display names
    id_to_row = {str(r.id): r for r in chunk_rows}
    docs = pg.get_documents_by_ids(user_id=user_uuid, document_ids=doc_uuids)
    doc_by_id = {
        str(d.id): (d.title or os.path.basename(d.source) or d.source)
        for d in docs
    }

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

    sources = []
    for r in selected:
        cid = r.get("chunk_id")
        row = id_to_row.get(cid or "")
        display_source = None
        if row:
            display_source = doc_by_id.get(str(row.document_id))
        if not display_source:
            display_source = (row.meta.get("source") if row and row.meta else None) or "unknown"
        sources.append(
            {
                "chunk_id": cid,
                "document_id": str(row.document_id) if row else None,
                "score": _json_number(r.get("score")),
                "rerank_score": _json_number(r.get("rerank_score")),
                "page_number": r.get("page_number"),
                "source": display_source,
                "text": r.get("text"),
            }
        )

    # Provide the generator with labeled context blocks so it can cite them as [1], [2], ...
    context_blocks: List[str] = []
    for i, s in enumerate(sources, start=1):
        src = s.get("source") or "unknown"
        page = s.get("page_number")
        header = f"[{i}] {src}" + (f" (Page {page})" if page is not None else "")
        context_blocks.append(f"{header}\n{s.get('text') or ''}".strip())

    answer = generator.generate(question, context_blocks, chat_history=chat_history)

    return {
        "answer": answer,
        "sources": sources,
    }
