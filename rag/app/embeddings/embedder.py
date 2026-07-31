import os
from pathlib import Path
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.llm_config import get_embedding_model


def _project_cache_dir() -> Path:
    """
    Returns the local cache directory for the embedding model.

    You can override this using:
        EMBEDDING_CACHE_PATH=/some/path
    """

    env = os.getenv("EMBEDDING_CACHE_PATH")

    if env:
        return Path(env)

    return (
        Path(__file__)
        .resolve()
        .parents[2]
        / ".embedding_cache"
    )


class Embedder:
    """
    Multilingual sentence embedding model.

    Default model:
        sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

    Supports multilingual semantic embeddings including:
        - English
        - Marathi
        - Hindi
        - Hinglish
        - Other supported languages

    Embedding dimension:
        384

    The same model is used for:
        1. Document embeddings during ingestion
        2. Query embeddings during retrieval

    Embeddings are L2-normalized, which works well with
    cosine similarity in Qdrant.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        """
        Singleton pattern.

        Ensures that the embedding model is loaded only once
        within the application process.
        """

        if cls._instance is None:
            cls._instance = super().__new__(cls)

            cls._instance._initialized = False

        return cls._instance

    def __init__(self, model_name: str | None = None):

        # Prevent loading the model multiple times
        if self._initialized:
            return

        # Get model from:
        # 1. Explicit model_name
        # 2. EMBEDDING_MODEL environment variable
        # 3. Default model in llm_config.py
        self.model_name = (
            model_name
            or get_embedding_model()
        )

        # Get local cache directory
        cache_dir = _project_cache_dir()

        cache_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        # Configure Hugging Face cache
        os.environ.setdefault(
            "HF_HOME",
            str(cache_dir)
        )

        os.environ.setdefault(
            "SENTENCE_TRANSFORMERS_HOME",
            str(cache_dir)
        )

        print(
            f"[Embedder] Loading model: "
            f"{self.model_name}"
        )

        print(
            f"[Embedder] Cache directory: "
            f"{cache_dir}"
        )

        try:

            self.model = SentenceTransformer(
                self.model_name,
                cache_folder=str(cache_dir)
            )

        except Exception as e:

            raise RuntimeError(
                f"Failed to load embedding model "
                f"'{self.model_name}'. "
                f"Details: {e}"
            ) from e

        # Automatically detect embedding dimension
        self.dimension = (
            self.model
            .get_sentence_embedding_dimension()
        )

        if self.dimension is None:

            raise RuntimeError(
                "Could not determine embedding dimension."
            )

        print(
            "[Embedder] Model loaded successfully."
        )

        print(
            f"[Embedder] Embedding dimension: "
            f"{self.dimension}"
        )

        self._initialized = True

    def embed_texts(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> List[List[float]]:
        """
        Convert a list of texts into normalized embeddings.

        Example:

            texts = [
                "What is artificial intelligence?",
                "कृत्रिम बुद्धिमत्ता म्हणजे काय?"
            ]

            vectors = embedder.embed_texts(texts)

        Returns:

            List[List[float]]

        For paraphrase-multilingual-MiniLM-L12-v2:

            len(vectors) == len(texts)
            len(vectors[0]) == 384
        """

        if not texts:
            return []

        # Remove accidental None values
        texts = [
            str(text)
            for text in texts
            if text is not None
        ]

        if not texts:
            return []

        vectors = self.model.encode(
            texts,

            # Process in batches
            batch_size=batch_size,

            # Return NumPy array
            convert_to_numpy=True,

            # L2 normalize embeddings
            #
            # This is important because your Qdrant
            # collection uses cosine similarity.
            normalize_embeddings=True,

            # Disable tqdm progress bar
            show_progress_bar=False
        )

        # Ensure Qdrant receives float32 vectors
        vectors = np.asarray(
            vectors,
            dtype=np.float32
        )

        return vectors.tolist()

    def get_dimension(self) -> int:
        """
        Return embedding vector dimension.

        For:
            paraphrase-multilingual-MiniLM-L12-v2

        Returns:
            384
        """

        return self.dimension