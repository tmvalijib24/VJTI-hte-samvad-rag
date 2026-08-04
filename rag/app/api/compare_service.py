import logging
import uuid
import numpy as np
import difflib
from typing import Any, Dict, List, Tuple

from app.db.postgres import PostgresStore
from app.vectorstore.qdrant_store import QdrantStore
from app.generation.generator import Generator

logger = logging.getLogger(__name__)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    vec1 = np.array(v1)
    vec2 = np.array(v2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(vec1, vec2) / (norm1 * norm2))

def diff_chunks(text_a: str, text_b: str) -> List[Dict[str, Any]]:
    """
    Perform a word-level diff between text_a and text_b.
    Returns a list of dicts: {"type": "equal"|"insert"|"delete"|"replace", "value": "text segment"}
    """
    words_a = text_a.split()
    words_b = text_b.split()
    matcher = difflib.SequenceMatcher(None, words_a, words_b)
    
    diff_spans = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            diff_spans.append({"type": "equal", "value": " ".join(words_b[j1:j2])})
        elif tag == "replace":
            diff_spans.append({"type": "delete", "value": " ".join(words_a[i1:i2])})
            diff_spans.append({"type": "insert", "value": " ".join(words_b[j1:j2])})
        elif tag == "delete":
            diff_spans.append({"type": "delete", "value": " ".join(words_a[i1:i2])})
        elif tag == "insert":
            diff_spans.append({"type": "insert", "value": " ".join(words_b[j1:j2])})
            
    return diff_spans

def generate_change_summary(diff_spans: List[Dict[str, Any]]) -> str:
    """Generate a quick one-liner describing changes (e.g., deleted words, inserted words)."""
    inserts = [span["value"] for span in diff_spans if span["type"] == "insert" and span["value"].strip()]
    deletes = [span["value"] for span in diff_spans if span["type"] == "delete" and span["value"].strip()]
    
    if not inserts and not deletes:
        return "No significant changes."
        
    summary = []
    if deletes:
        summary.append(f"Removed: '{' '.join(deletes)[:50]}...'")
    if inserts:
        summary.append(f"Added: '{' '.join(inserts)[:50]}...'")
        
    return " | ".join(summary)

def align_and_compare_documents(doc_a_id: str, doc_b_id: str, tenant_id: str = None, threshold: float = 0.75) -> Dict[str, Any]:
    """
    Align chunks from Doc A and Doc B using cosine similarity and diff the matched chunks.
    """
    store = QdrantStore()
    
    # 1. Fetch vectors for both documents
    records_a = store.get_document_vectors(document_id=doc_a_id, tenant_id=tenant_id)
    records_b = store.get_document_vectors(document_id=doc_b_id, tenant_id=tenant_id)
    
    # Map chunk_id (which is the point ID) to vector and text payload
    chunks_a = {str(r.id): {"vector": r.vector, "text": r.payload.get("text", ""), "page": r.payload.get("page_number")} for r in records_a}
    chunks_b = {str(r.id): {"vector": r.vector, "text": r.payload.get("text", ""), "page": r.payload.get("page_number")} for r in records_b}
    
    aligned_pairs = []
    used_b_ids = set()
    changes_count = 0
    
    # Pairwise comparison
    for a_id, a_data in chunks_a.items():
        best_match_id = None
        best_score = -1.0
        
        for b_id, b_data in chunks_b.items():
            if b_id in used_b_ids:
                continue
            
            score = cosine_similarity(a_data["vector"], b_data["vector"])
            if score > best_score:
                best_score = score
                best_match_id = b_id
                
        if best_match_id and best_score >= threshold:
            used_b_ids.add(best_match_id)
            b_data = chunks_b[best_match_id]
            diffs = diff_chunks(a_data["text"], b_data["text"])
            
            # Check if there's any actual difference
            has_changes = any(span["type"] in ["insert", "delete"] for span in diffs)
            if has_changes:
                changes_count += 1
                
            aligned_pairs.append({
                "chunk_id_a": a_id,
                "chunk_id_b": best_match_id,
                "text_a": a_data["text"],
                "text_b": b_data["text"],
                "page_a": a_data["page"],
                "page_b": b_data["page"],
                "similarity": best_score,
                "diff": diffs,
                "summary": generate_change_summary(diffs) if has_changes else "Unchanged"
            })
        else:
            # Unmatched A
            aligned_pairs.append({
                "chunk_id_a": a_id,
                "chunk_id_b": None,
                "text_a": a_data["text"],
                "text_b": None,
                "page_a": a_data["page"],
                "page_b": None,
                "similarity": 0.0,
                "diff": [{"type": "delete", "value": a_data["text"]}],
                "summary": "Section removed"
            })
            changes_count += 1
            
    # Add remaining unmatched B chunks
    for b_id, b_data in chunks_b.items():
        if b_id not in used_b_ids:
            aligned_pairs.append({
                "chunk_id_a": None,
                "chunk_id_b": b_id,
                "text_a": None,
                "text_b": b_data["text"],
                "page_a": None,
                "page_b": b_data["page"],
                "similarity": 0.0,
                "diff": [{"type": "insert", "value": b_data["text"]}],
                "summary": "Section added"
            })
            changes_count += 1
            
    return {
        "aligned_pairs": aligned_pairs,
        "changes_count": changes_count
    }

def explain_change(text_a: str, text_b: str) -> str:
    """
    Use LLM to explain the change between two texts.
    """
    generator = Generator()
    
    prompt = f"""
Please explain the key changes between Version A and Version B of the following text in plain language.
Focus on the material impact (e.g. amounts, dates, eligibility) and keep the explanation concise (1-3 sentences).

Version A:
{text_a or '[None/Deleted]'}

Version B:
{text_b or '[None/Added]'}
"""
    # Using generator.llm directly since Generator may not have a generate_basic
    # Let's inspect Generator to see what methods it has.
    from langchain_core.prompts import PromptTemplate
    
    # We can just run a quick custom chain or direct invoke on the model
    try:
        response = generator.llm.invoke(prompt)
        return response.content if hasattr(response, 'content') else str(response)
    except Exception as e:
        logger.error(f"Error explaining change: {{e}}")
        return "Failed to generate explanation."
