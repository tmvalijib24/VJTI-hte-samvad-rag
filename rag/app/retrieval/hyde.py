from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

class HyDEExpander:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

    def expand(self, query: str) -> str:
        prompt = f"""
You are an AI that rewrites user queries into a short, focused passage suitable for document retrieval.

- Keep it concise (3-5 sentences max).  
- Include only factual or likely content that could appear in a document.  
- Avoid long explanations, personal opinions, or overly general text.  
- Include key entities, book titles, or technical terms if relevant.  

Query:
{query}

Expanded Passage:
"""

        try:
            response = self.client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            expanded_text = response.choices[0].message.content.strip()

            # print("\n🧠 HyDE Expanded Query:\n", expanded_text)

            return expanded_text

        except Exception as e:
            print("HyDE Error:", e)
            return query  # fallback