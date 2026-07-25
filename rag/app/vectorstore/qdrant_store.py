import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PayloadSchemaType


class QdrantStore:
    def __init__(self):
        url = os.getenv("QDRANT_URL")
        if url:
            api_key = os.getenv("QDRANT_API_KEY")
            self.client = QdrantClient(url=url, api_key=api_key)
        else:
            host = os.getenv("QDRANT_HOST", "localhost")
            port = int(os.getenv("QDRANT_PORT", "6334"))
            self.client = QdrantClient(host=host, port=port)
        self.collection_name = "documents"

    def create_collection(self):
        """Create the collection if it does not already exist."""
        self._ensure_collection()

    def _ensure_collection(self):
        try:
            self.client.get_collection(collection_name=self.collection_name)
            return
        except Exception:
            pass

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=384,  # embedding dimension
                distance=Distance.COSINE
            )
        )

        # Create payload index on tenant_id for fast filtering during multi-tenant searches
        try:
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="tenant_id",
                field_schema=PayloadSchemaType.UUID
            )
        except Exception:
            pass

    def upload(self, vectors, payloads=None, ids=None, texts=None, tenant_id: str = None):
        self._ensure_collection()
        points = []

        if payloads is None:
            payloads = []
            if texts is None:
                texts = []
            for text in texts:
                payloads.append({"text": text})

        if ids is None:
            ids = list(range(len(vectors)))

        for point_id, vec, payload in zip(ids, vectors, payloads):
            # Add tenant_id to every payload for multi-tenant isolation
            if tenant_id:
                payload["tenant_id"] = tenant_id
            points.append({
                "id": point_id,
                "vector": vec,
                "payload": payload
            })

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def search(self, query_vector, top_k=3, tenant_id: str = None):
        from qdrant_client.models import FieldCondition, MatchValue, Filter

        self._ensure_collection()

        # Build filter for tenant_id to ensure multi-tenant isolation
        query_filter = None
        if tenant_id:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="tenant_id",
                        match=MatchValue(value=tenant_id)
                    )
                ]
            )

        results = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k
        ).points

        return results