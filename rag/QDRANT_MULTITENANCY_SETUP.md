# Qdrant Multi-Tenancy Setup - Collection Configuration

This document shows the complete Qdrant collection setup code with tenant_id indexing for multi-tenant data isolation.

## Collection Creation with Tenant Index

### Complete Code

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PayloadSchemaType
)

class QdrantStore:
    def __init__(self):
        # Connection setup
        url = os.getenv("QDRANT_URL")
        if url:
            self.client = QdrantClient(url=url)
        else:
            host = os.getenv("QDRANT_HOST", "localhost")
            port = int(os.getenv("QDRANT_PORT", "6334"))
            self.client = QdrantClient(host=host, port=port)
        self.collection_name = "documents"

    def create_collection(self):
        """Create Qdrant collection with tenant_id payload indexing."""
        
        # Step 1: Recreate collection with vector configuration
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=384,  # Size of embedding vectors
                distance=Distance.COSINE  # Distance metric
            )
        )
        
        # Step 2: Create payload index on tenant_id for fast filtering
        self.client.create_payload_index(
            collection_name=self.collection_name,
            field_name="tenant_id",
            field_schema=PayloadSchemaType.UUID
        )
        
        print(f"✅ Collection '{self.collection_name}' created with tenant_id index")
```

---

## Vector Upload with Tenant ID

### Uploading Vectors with tenant_id in Payload

```python
def upload(self, vectors, payloads=None, ids=None, texts=None, tenant_id: str = None):
    """
    Upload vectors to Qdrant with tenant_id in payload.
    
    Args:
        vectors: List of embedding vectors (384-dimensional)
        payloads: List of payload dictionaries with metadata
        ids: Vector IDs
        texts: Optional fallback texts
        tenant_id: User ID / tenant identifier (UUID string)
    """
    points = []

    # Initialize payloads if not provided
    if payloads is None:
        payloads = []
        if texts is None:
            texts = []
        for text in texts:
            payloads.append({"text": text})

    # Default IDs if not provided
    if ids is None:
        ids = list(range(len(vectors)))

    # Build point list with tenant_id added to each payload
    for point_id, vec, payload in zip(ids, vectors, payloads):
        # CRITICAL: Add tenant_id to every payload for multi-tenant isolation
        if tenant_id:
            payload["tenant_id"] = tenant_id
        
        points.append({
            "id": point_id,
            "vector": vec,
            "payload": payload
        })

    # Upsert all points to Qdrant
    self.client.upsert(
        collection_name=self.collection_name,
        points=points
    )
    
    print(f"✅ Uploaded {len(points)} vectors for tenant {tenant_id}")
```

### Example Payload Structure

```python
# Each vector in Qdrant includes this payload:
{
    "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
    "document_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "chunk_index": 0,
    "page_number": 1,
    "source": "https://example.com/document.pdf",
    "text": "This is the chunk text...",
    
    # ← CRITICAL for multi-tenancy
    "tenant_id": "7c8e09a1-b2c3-4d5e-b6c7-8d9e0f1a2b3c"
}
```

---

## Tenant-Scoped Search Query

### Search with Tenant Filtering

```python
def search(self, query_vector, top_k=3, tenant_id: str = None):
    """
    Search Qdrant for similar vectors, filtered by tenant_id.
    
    Args:
        query_vector: Embedding vector to search for (384-dim)
        top_k: Number of results to return
        tenant_id: Current user's ID / tenant identifier
        
    Returns:
        List of matching points with payloads
    """
    from qdrant_client.models import FieldCondition, MatchValue, Filter
    
    # Step 1: Build tenant filter
    query_filter = None
    if tenant_id:
        query_filter = Filter(
            must=[
                # Only return vectors where tenant_id matches
                FieldCondition(
                    key="tenant_id",
                    match=MatchValue(value=tenant_id)
                )
            ]
        )
    
    # Step 2: Execute search with filter
    results = self.client.query_points(
        collection_name=self.collection_name,
        query=query_vector,
        query_filter=query_filter,  # ← CRITICAL filter
        limit=top_k
    ).points

    return results
```

---

## Filter Structure Explained

### Single Tenant Filter (Current Implementation)
```python
# Only return vectors where tenant_id == current_user_id
Filter(
    must=[
        FieldCondition(
            key="tenant_id",
            match=MatchValue(value="7c8e09a1-b2c3-4d5e-b6c7-8d9e0f1a2b3c")
        )
    ]
)
```

### Complex Filter Examples (Future Use)

**Multiple Tenant IDs (for shared access)**
```python
Filter(
    must=[
        FieldCondition(
            key="tenant_id",
            match=MatchAny(any=["tenant1", "tenant2", "tenant3"])
        )
    ]
)
```

**Tenant + Document Constraint**
```python
Filter(
    must=[
        FieldCondition(
            key="tenant_id",
            match=MatchValue(value="tenant_uuid")
        ),
        FieldCondition(
            key="document_id",
            match=MatchValue(value="document_uuid")
        )
    ]
)
```

**Tenant + Page Number Range**
```python
Filter(
    must=[
        FieldCondition(
            key="tenant_id",
            match=MatchValue(value="tenant_uuid")
        ),
        FieldCondition(
            key="page_number",
            match=MatchRange(gte=1, lte=10)
        )
    ]
)
```

---

## Integration with RAG Service

### End-to-End Flow

```python
# In app/api/rag_service.py

def ingest_and_index(user_id: str, source: str):
    """Ingest document with tenant scoping."""
    user_uuid = uuid.UUID(user_id)
    
    # ... process document, create chunks, embed ...
    
    store = QdrantStore()
    store.create_collection()  # Create with tenant index
    
    # Upload vectors with tenant_id
    store.upload(
        vectors=vectors,
        payloads=payloads,
        ids=ids,
        tenant_id=str(user_uuid)  # ← Tenant scoping
    )


def answer_question(*, user_id: str, document_id: str, question: str):
    """Answer question with tenant-scoped retrieval."""
    user_uuid = uuid.UUID(user_id)
    
    # ... setup retriever ...
    
    # Search Qdrant with tenant filter
    results = hybrid.search(
        expanded_query,
        tenant_id=str(user_uuid)  # ← Only user's vectors returned
    )
```

---

## Payload Index Performance

### Index Creation Overhead
```python
# First time: ~100-500ms for creating index
self.client.create_payload_index(
    collection_name="documents",
    field_name="tenant_id",
    field_schema=PayloadSchemaType.UUID
)
```

### Query Performance Impact
- **Without index**: Full collection scan (O(n))
- **With index**: Fast lookup by tenant_id (O(log n))

Example: 1M vectors
- Unindexed search: ~500-1000ms
- Indexed search: ~10-50ms (50-100x faster!)

---

## Configuration in Code

### Hardcoded vs Environment Variables

```python
# app/vectorstore/qdrant_store.py

# Vector size is hardcoded (must match your embedder)
VectorParams(
    size=384,  # Must match Embedder output dimension
    distance=Distance.COSINE  # Can also use EUCLIDEAN, MANHATTAN
)

# Distance metric options:
# - COSINE: Best for embeddings (normalized vectors)
# - EUCLIDEAN: L2 distance
# - MANHATTAN: L1 distance
# - SQUARED_EUCLIDEAN: Squared L2 distance
```

### Connection Configuration

```python
# Uses environment variables, falls back to localhost
url = os.getenv("QDRANT_URL")  
# or
host = os.getenv("QDRANT_HOST", "localhost")
port = int(os.getenv("QDRANT_PORT", "6334"))
```

---

## Testing the Setup

### Verify Collection was Created

```bash
# From Python REPL
from app.vectorstore.qdrant_store import QdrantStore

store = QdrantStore()
store.create_collection()

# Check collection exists
info = store.client.get_collection("documents")
print(f"Collection: {info.config.name}")
print(f"Vector size: {info.config.params.vectors.size}")
print(f"Points count: {info.points_count}")
```

### Upload and Search Test

```python
import numpy as np

# Create a test vector (384 dimensions)
test_vector = np.random.rand(384).tolist()

# Upload with tenant_id
store.upload(
    vectors=[test_vector],
    payloads=[{"text": "Test chunk"}],
    ids=["test-id-1"],
    tenant_id="test-user-id"
)

# Search with tenant filter
results = store.search(
    query_vector=test_vector,
    top_k=1,
    tenant_id="test-user-id"
)

print(f"Found {len(results)} results")
for r in results:
    print(f"  - ID: {r.id}, Score: {r.score}")
```

---

## Troubleshooting

### Tenant ID Not Filtering

**Problem**: Searching without tenant_id filter returns results from all users

**Solution**: Always pass `tenant_id` to search():
```python
# ❌ Wrong
results = store.search(query_vector, top_k=3)

# ✅ Correct
results = store.search(query_vector, top_k=3, tenant_id=current_user_id)
```

### Index Not Created

**Problem**: `create_payload_index()` fails silently

**Check**:
```python
# Verify index exists
indexes = store.client.get_collection("documents").payload_schema
print(indexes.fields)  # Should show tenant_id
```

### Slow Searches

**Problem**: Searches are still slow despite indexing

**Solution**:
1. Ensure collection is created once, not recreated each time
2. Check Qdrant is not on disk (use in-memory or persistent)
3. Monitor Qdrant logs for slow queries

### UUID Mismatch

**Problem**: PayloadSchemaType.UUID but storing strings

**Solution**: Ensure UUID consistency:
```python
# Always pass UUID as string
tenant_id: str = str(uuid.UUID(user_id))  # ✅ Correct
```

---

✅ **Qdrant collection is now fully multi-tenant aware and indexed for performance!**
