from fastembed import TextEmbedding
from typing import List
import numpy as np


class Embedder:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        if self._initialized:
            return
        self.model = TextEmbedding(model_name=model_name)
        self._initialized = True

    def embed_texts(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> List[List[float]]:

        embeddings = list(self.model.embed(
            texts,
            batch_size=batch_size
        ))

        return self._normalize(np.array(embeddings))

    def _normalize(self, vectors):
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return (vectors / norms).tolist()