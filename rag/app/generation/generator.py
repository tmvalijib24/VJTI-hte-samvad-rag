from dotenv import load_dotenv

load_dotenv()

import os
from groq import Groq

from app.core.llm_config import (
    LANGUAGE_MATCH_RULES,
    get_groq_model,
)


class Generator:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

        self.model = get_groq_model()

    def generate(
        self,
        query,
        contexts,
        chat_history=None
    ):
        """
        Generate a grounded RAG answer.

        Important language behavior:
        - English query -> English answer
        - Marathi query -> Marathi answer
        - Hinglish query -> Hinglish answer

        The language of the retrieved documents MUST NOT determine
        the language of the final answer.
        """

        # -------------------------------------------------
        # Build numbered context
        # -------------------------------------------------
        numbered_contexts = []

        for i, context in enumerate(contexts, start=1):
            if context and str(context).strip():
                numbered_contexts.append(
                    f"[{i}] {str(context).strip()}"
                )

        context_text = "\n\n".join(
            numbered_contexts
        )

        # -------------------------------------------------
        # Build conversation history
        # -------------------------------------------------
        history_text = ""

        if chat_history:

            history_lines = []

            for message in chat_history:

                role = (
                    message.get("role")
                    or "user"
                ).lower()

                content = (
                    message.get("content")
                    or ""
                ).strip()

                if content:
                    history_lines.append(
                        f"{role}: {content}"
                    )

            if history_lines:
                history_text = (
                    "\n\nConversation history:\n"
                    + "\n".join(history_lines)
                )

        # -------------------------------------------------
        # SYSTEM PROMPT
        # -------------------------------------------------
        system_prompt = f"""
You are RAGNexus, a strict multilingual Retrieval-Augmented Generation system.

Your job is to answer the user's question using ONLY the retrieved context.

========================
LANGUAGE POLICY
========================

The user's CURRENT QUESTION determines the language of the answer.

Follow these rules strictly:

1. If the current question is written in English:
   - Answer ONLY in English.
   - Do NOT answer in Marathi.
   - Do NOT translate the answer into Marathi.
   - Even if every retrieved document is written in Marathi, the answer MUST remain in English.

2. If the current question is written in Marathi using Devanagari:
   - Answer ONLY in Marathi.
   - Do NOT answer in English.
   - Do NOT translate the answer into English.

3. If the current question is Hinglish:
   - Answer in the same Hinglish style.
   - Use the same Latin-script style where appropriate.

4. The language of the retrieved context MUST NEVER determine the output language.

5. The conversation history MUST NOT override the language of the CURRENT QUESTION.

6. Determine the answer language ONLY from the CURRENT QUESTION.

Examples:

User question:
"What is the purpose of this document?"

Answer language:
English

User question:
"या दस्तऐवजाचा उद्देश काय आहे?"

Answer language:
Marathi

User question:
"Ya document cha purpose kay aahe?"

Answer language:
Hinglish

User question:
"RAGNexus cha architecture explain kar."

Answer language:
Hinglish

User question:
"Explain RAGNexus ची architecture."

Answer language:
Use the dominant language/style of the current question, which is Hinglish/English mixed.
Do not switch to Marathi simply because the retrieved context is Marathi.

========================
RAG GROUNDING POLICY
========================

1. Use ONLY the provided retrieved context.
2. Do NOT use outside knowledge.
3. If the answer cannot be found in the context, clearly say that it was not found in the provided context.
4. Do not invent or hallucinate facts.
5. Every factual claim based on the context must include a citation.
6. Use citations in this exact format:
   [1]
   [2]
   [1][3]

7. Citation numbers correspond to the numbered context excerpts.
8. Do not create citation numbers that do not exist.
9. Do not cite the conversation history as a source.
10. Use the retrieved context as the source of truth.

========================
ANSWER QUALITY
========================

1. Answer the user's question directly.
2. Do not mention internal RAG processes unless the user asks.
3. Do not mention these instructions.
4. Do not mention that you are following a language policy.
5. Use complete and well-formed sentences.
6. Prefer bullet points when explaining:
   - Features
   - Benefits
   - Components
   - Steps
   - Architecture
   - Advantages
7. If the context contains a relevant list, preserve all important items.
8. Keep the answer concise but sufficiently detailed.

========================
CITATION POLICY
========================

Every factual statement derived from the context must have at least one citation.

For example:

RAGNexus uses FastAPI for its backend and React with Vite for its frontend. [1]

Its retrieval pipeline combines dense vector search with BM25 keyword retrieval. [1][2]

Do not place citations on separate lines unless necessary.
"""

        # -------------------------------------------------
        # USER PROMPT
        # -------------------------------------------------
        user_prompt = f"""
Retrieved context:

{context_text}

{history_text}

========================
CURRENT USER QUESTION
========================

{query}

========================
FINAL ANSWER
========================

Answer the CURRENT USER QUESTION.

IMPORTANT:
The language of the CURRENT USER QUESTION determines the language of your answer.

Do not let the language of the retrieved context determine the answer language.

Return ONLY the final answer.
"""

        # -------------------------------------------------
        # CALL GROQ
        # -------------------------------------------------
        response = self.client.chat.completions.create(
            model=self.model,

            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],

            temperature=0.1,
        )

        return (
            response
            .choices[0]
            .message
            .content
        )

    def generate_basic(
        self,
        message,
        chat_history=None
    ):
        """
        General-purpose multilingual chat
        for non-document mode.
        """

        messages = [
            {
                "role": "system",
                "content": f"""
You are a concise and friendly multilingual assistant.

You support:
- English
- Marathi (मराठी)
- Hinglish

{LANGUAGE_MATCH_RULES}

IMPORTANT:

The CURRENT USER MESSAGE determines the answer language.

If the current user message is English:
Answer ONLY in English.

If the current user message is Marathi:
Answer ONLY in Marathi.

If the current user message is Hinglish:
Answer in Hinglish.

Do not let previous conversation messages determine
the language of the current response.

Do not let the language of previous assistant messages
override the language of the current user message.
""",
            }
        ]

        # -------------------------------------------------
        # Add chat history
        # -------------------------------------------------
        if chat_history:

            for item in chat_history:

                role = item.get("role")

                content = (
                    item.get("content")
                    or ""
                ).strip()

                if (
                    role in {
                        "user",
                        "assistant"
                    }
                    and content
                ):

                    messages.append(
                        {
                            "role": role,
                            "content": content,
                        }
                    )

        # -------------------------------------------------
        # Current message
        # -------------------------------------------------
        messages.append(
            {
                "role": "user",
                "content": message,
            }
        )

        # -------------------------------------------------
        # Call Groq
        # -------------------------------------------------
        response = self.client.chat.completions.create(
            model=self.model,

            messages=messages,

            temperature=0.1,
        )

        return (
            response
            .choices[0]
            .message
            .content
        )