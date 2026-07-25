from fastembed.rerank.cross_encoder import TextCrossEncoder


class Reranker:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.model = TextCrossEncoder(model_name="Xenova/ms-marco-MiniLM-L-6-v2")
        self._initialized = True

    def rerank(self, query, docs):
        texts = [doc["text"] for doc in docs]
        scores = list(self.model.rerank(query, texts))

        for i in range(len(docs)):
            docs[i]["rerank_score"] = scores[i]

        docs = sorted(docs, key=lambda x: x["rerank_score"], reverse=True)
        return docs