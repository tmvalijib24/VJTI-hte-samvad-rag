class Reranker:
    """
    Temporary no-op reranker.

    The multilingual embedding model and hybrid retrieval
    are used without an additional cross-encoder reranker.

    This is useful while the reranker model is being fixed.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        pass

    def rerank(self, query, docs):
        """
        Return documents in the order produced by
        HybridRetriever.
        """

        return docs