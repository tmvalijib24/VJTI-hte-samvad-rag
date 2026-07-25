from dotenv import load_dotenv

load_dotenv()

from groq import Groq
import os

class Generator:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

    def generate(self, query, contexts, chat_history=None):
        context_text = "\n\n".join(contexts)
        history_text = ""
        if chat_history:
            history_lines = []
            for m in chat_history:
                role = (m.get("role") or "user").lower()
                content = (m.get("content") or "").strip()
                if content:
                    history_lines.append(f"{role}: {content}")
            if history_lines:
                history_text = "\n\nConversation history:\n" + "\n".join(history_lines)

        prompt = f"""
You are a strict RAG system answering questions from provided excerpts.

Rules:
1. Use ONLY the provided context excerpts. Do not use outside knowledge.
2. If the answer is not present, reply exactly: Not found in context
3. Write complete, well-formed sentences (no fragments).
4. Prefer bullet points for "benefits", "features", "steps", etc. If the context contains a bullet list, extract ALL items from that list.
5. Add citations using bracketed excerpt numbers like [1] or [2][3].
6. Every factual claim must have at least one citation.

Context excerpts:
{context_text}
{history_text}

Question:
{query}

Answer (with citations):
"""

        
        response = self.client.chat.completions.create(
            model="openai/gpt-oss-20b",   # ✅ fast + free
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return response.choices[0].message.content

    def generate_basic(self, message, chat_history=None):
        """General-purpose chat for non-document mode using Groq free model."""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a concise, friendly assistant. "
                    "Answer general questions clearly."
                ),
            },
        ]

        if chat_history:
            for item in chat_history:
                role = item.get("role")
                content = (item.get("content") or "").strip()
                if role in {"user", "assistant"} and content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        response = self.client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=messages,
        )

        return response.choices[0].message.content