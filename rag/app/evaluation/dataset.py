from datasets import Dataset

def get_dataset():
    data = {
        "question": [
            "What are proxy settings?",
        ],
        "ground_truth": [
            "Proxy settings configure how a browser communicates with the internet via an intermediary server, specifying IP, port, and type of proxy (HTTP, SOCKS, DNS)."
        ]
    }

    return Dataset.from_dict(data)