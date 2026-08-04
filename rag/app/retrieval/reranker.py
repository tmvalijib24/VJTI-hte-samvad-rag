from sentence_transformers import CrossEncoder

class Reranker:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # Initialize model only once
            cls._instance.model = CrossEncoder('BAAI/bge-reranker-v2-m3')
        return cls._instance

    def __init__(self):
        pass

    def rerank(self, query, docs):
        if not docs:
            return docs

        pairs = [[query, doc['text']] for doc in docs]
        scores = self.model.predict(pairs)
        
        for doc, score in zip(docs, scores):
            doc['rerank_score'] = float(score)
            
        docs.sort(key=lambda x: x['rerank_score'], reverse=True)
        return docs