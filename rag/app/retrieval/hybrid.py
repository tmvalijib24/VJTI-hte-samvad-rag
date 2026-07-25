class HybridRetriever:
    def __init__(self, vector_store, bm25_retriever, embedder, alpha=0.5):
        self.vector_store = vector_store
        self.bm25 = bm25_retriever
        self.embedder = embedder
        self.alpha = alpha

    def search(self, query, top_k=3, tenant_id: str = None):
        # Vector search - pass tenant_id for multi-tenant isolation
        q_vec = self.embedder.embed_texts([query])[0]
        vector_results = self.vector_store.search(q_vec, top_k*2, tenant_id=tenant_id)

        # BM25 search
        bm25_results = self.bm25.search(query, top_k*2)

        # Normalize vector scores
        max_vec_score = max([r.score for r in vector_results] or [1])
        combined = []

        for r in vector_results:
            payload = getattr(r, "payload", {}) or {}
            combined.append({
                "chunk_id": payload.get("chunk_id"),
                "text": payload.get("text"),
                "page_number": payload.get("page_number"),
                "score": self.alpha * (r.score / max_vec_score)
            })

        # Normalize BM25 scores (dict-based)
        max_bm25_score = max([r.get("score", 1) for r in bm25_results] or [1])
        for r in bm25_results:
            combined.append({
                "chunk_id": r.get("chunk_id"),
                "text": r["text"],
                "score": (1 - self.alpha) * (r.get("score", 1) / max_bm25_score)
            })

        # Remove duplicates
        seen = set()
        unique = []
        for r in combined:
            key = r.get("chunk_id") or r.get("text")
            if key not in seen:
                unique.append(r)
                seen.add(key)

        # Sort by combined normalized score
        unique = sorted(unique, key=lambda x: x["score"], reverse=True)

        return unique[:top_k]