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
        exists = False
        try:
            if hasattr(self.client, "collection_exists"):
                exists = bool(self.client.collection_exists(collection_name=self.collection_name))
            else:
                self.client.get_collection(collection_name=self.collection_name)
                exists = True
        except Exception:
            exists = False

        if not exists:
            try:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,  # embedding dimension
                        distance=Distance.COSINE
                    )
                )
            except Exception as e:
                # Another request may have created it concurrently
                msg = str(e).lower()
                if "already exists" not in msg and "409" not in msg:
                    raise

        # Always ensure payload indexes exist (needed for filtered search on existing collections)
        self._ensure_payload_indexes()

    def _ensure_payload_indexes(self):
        for field_name, field_schema in (
            ("tenant_id", PayloadSchemaType.KEYWORD),
            ("document_id", PayloadSchemaType.KEYWORD),
        ):
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=field_schema,
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

    def search(self, query_vector, top_k=3, tenant_id: str = None, document_ids: list = None):
        from qdrant_client.models import FieldCondition, MatchValue, MatchAny, Filter

        self._ensure_collection()

        must_conditions = []
        if tenant_id:
            must_conditions.append(
                FieldCondition(
                    key="tenant_id",
                    match=MatchValue(value=tenant_id)
                )
            )

        if document_ids:
            must_conditions.append(
                FieldCondition(
                    key="document_id",
                    match=MatchAny(any=[str(d) for d in document_ids])
                )
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        results = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k
        ).points

        return results

    def get_document_vectors(self, document_id: str, tenant_id: str = None):
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        self._ensure_collection()
        
        must_conditions = [FieldCondition(key="document_id", match=MatchValue(value=document_id))]
        if tenant_id:
            must_conditions.append(FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)))
            
        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=Filter(must=must_conditions),
            with_vectors=True,
            limit=10000
        )
        return records

    def delete_document(self, tenant_id: str, document_id: str):
        from qdrant_client.models import FieldCondition, MatchValue, Filter
        self._ensure_collection()
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
                    FieldCondition(key="document_id", match=MatchValue(value=document_id))
                ]
            )
        )