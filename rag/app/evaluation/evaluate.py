import os
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_recall
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

from app.evaluation.dataset import get_dataset
from app.evaluation.rag_wrapper import rag_pipeline


# 🔥 GROQ LLM
llm = ChatGroq(
    model="openai/gpt-oss-20b",
    groq_api_key=os.getenv("GROQ_API_KEY")
)

# 🆓 FREE LOCAL EMBEDDINGS (no API key needed)
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def build_dataset():
    dataset = get_dataset()

    answers = []
    contexts = []

    for question in dataset["question"]:
        result = rag_pipeline(question)

        answers.append(result["answer"])
        contexts.append(result["contexts"])

    dataset = dataset.add_column("answer", answers)
    dataset = dataset.add_column("contexts", contexts)

    return dataset


def run():
    dataset = build_dataset()

    result = evaluate(
        dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_recall
        ],
        llm=llm,
        embeddings=embeddings
    )

    print(result)


if __name__ == "__main__":
    run()