from typing import Dict, List

# 👉 IMPORT YOUR EXISTING RETRIEVAL + LLM PIPELINE
# ⚠️ CHANGE THIS IMPORT BASED ON YOUR PROJECT
from app.retrieval.pipeline import query_rag # <-- YOU MUST HAVE THIS


def rag_pipeline(question: str) -> Dict:
    """
    This function connects your RAG system to RAGAs
    """

    # 🔥 Call your existing RAG function
    result = query_rag(question)

    # ✅ EXPECTED FORMAT FROM YOUR FUNCTION:
    # result = {
    #     "answer": "...",
    #     "contexts": ["chunk1", "chunk2"]
    # }

    answer = result["answer"]
    contexts = result["contexts"]

    # ⚠️ Ensure contexts is LIST
    if isinstance(contexts, str):
        contexts = [contexts]

    return {
        "answer": answer,
        "contexts": contexts
    }