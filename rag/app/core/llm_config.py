import os

# Llama 3.3 70B handles Marathi (Devanagari), Hinglish, and English well on Groq.
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

# Multilingual MiniLM keeps the same 384-dim vectors as the previous English model,
# so the Qdrant collection size stays compatible. Re-ingest docs after switching.
DEFAULT_EMBEDDING_MODEL = (
    "sentence-transformers/"
    "paraphrase-multilingual-MiniLM-L12-v2"
)
LANGUAGE_MATCH_RULES = """
Language rules (critical):
- Mirror the user's question language exactly.
- If the question is in English → answer in English.
- If the question is in Marathi (मराठी / Devanagari) → answer in Marathi.
- If the question is in Hinglish (Hindi/Marathi words written in Latin script mixed with English) → answer in the same Hinglish style.
- Do NOT translate the user's language unless they ask you to.
- Citations like [1] stay as-is in every language.
- If the answer is not in the context, reply with a short "not found" message in the SAME language as the question
  (English: "Not found in context" / Marathi: "संदर्भात सापडले नाही" / Hinglish: "Context mein nahi mila").
""".strip()


def get_groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()


def get_embedding_model() -> str:
    return (os.getenv("EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL).strip()
