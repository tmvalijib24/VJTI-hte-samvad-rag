from groq import Groq
import os
from dotenv import load_dotenv

from app.core.llm_config import get_groq_model

load_dotenv()


class HyDEExpander:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )
        self.model = get_groq_model()

    def expand(self, query: str) -> str:
        prompt = f"""
You rewrite user queries into a short, focused passage suitable for multilingual document retrieval
(English, Marathi / मराठी, and Hinglish).

Rules:
- Keep it concise (3-5 sentences max).
- Include only factual or likely content that could appear in a document.
- Avoid long explanations, personal opinions, or overly general text.
- Include key entities, book titles, or technical terms if relevant.
- CRITICAL: Write the expanded passage in the SAME language/script as the query
  (English → English, Marathi Devanagari → Marathi, Hinglish → Hinglish).
- If the query mixes scripts or languages, preserve that mix.

Query:
{query}

Expanded Passage:
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            expanded_text = response.choices[0].message.content.strip()
            return expanded_text

        except Exception as e:
            print("HyDE Error:", e)
            return query  # fallback
