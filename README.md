# 🏛️ HTE-Samvad RAG Engine

### *Instant, Reliable & Grounded Access to Official Administrative Knowledge*

**AI-Powered Question Answering System for the HTE Department** · Built for the VJTI Mumbai Government Hackathon

<p>
  <img src="https://img.shields.io/badge/python-3.10%2B-blue?logo=python&logoColor=white" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white" alt="React + Vite">
  <img src="https://img.shields.io/badge/VectorDB-Qdrant-DC244C?logo=qdrant&logoColor=white" alt="Qdrant">
  <img src="https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/LLM-Groq-F55036?logo=groq&logoColor=white" alt="Groq">
  <img src="https://img.shields.io/badge/eval-RAGAs-8A2BE2" alt="RAGAs">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT">
</p>

---

## 📌 Executive Overview

Government departments like **HTE (Higher & Technical Education)** deal with a sprawling, ever-growing set of circulars, GRs, notices, and reference documents — scattered across PDFs, spreadsheets, plain text, and web pages. Finding the *right* clause in the *right* document currently takes manual search, tribal knowledge, and time officials don't have.

**HTE-Samvad RAG Engine** bridges this gap. It ingests multi-format official documents (**PDF, TXT, CSV, URLs**) into a searchable knowledge base and answers natural-language questions with **zero-hallucination, source-grounded responses** — powered by **Hybrid Search (BM25 + Dense Vector Retrieval)** and **Cross-Encoder Reranking**, so every answer can be traced back to an official document.

> No more digging through hundreds of pages of circulars. Ask a question, get a grounded answer, verify the source — in seconds.

---

## ✨ Key Features

- 📂 **Multi-Format Ingestion** — Bring in official documents from **PDF, TXT, CSV, or a live URL**, all through simple ingestion endpoints.
- 🧠 **Advanced Query Pipeline** — `HyDE Query Expansion → Hybrid Retrieval → Cross-Encoder Reranking → Grounded LLM Generation`, orchestrated end-to-end for every question.
- 💬 **Dual-Chat Modes** — Switch between **Document-Grounded Mode** (`/ask`, answers strictly from ingested sources) and **Basic General AI Chat** (`/chat/basic`, open-domain conversation).
- 🔗 **Verifiable Citations** — Every grounded answer returns **document- and chunk-level source metadata**, so officials can trace claims back to the original circular or file.
- 📊 **Automated RAGAs Evaluation Pipeline** — Continuously measure **Faithfulness**, **Answer Relevancy**, and **Context Recall** against a labeled evaluation set.
- 🗄️ **Dual Storage Architecture** — PostgreSQL for structured metadata & audit trails, Qdrant for high-speed approximate nearest-neighbor (ANN) vector search.
- 🕓 **Session & History Management** — Persistent, per-user chat sessions with full conversation history.

---

## 🏗️ Visual Architecture

### 1. Document Ingestion Flow

```mermaid
graph TD
    A["📥 Source Input<br/>URL / PDF / TXT / CSV"] --> B["Loader<br/>(requests/newspaper3k, pdfplumber, pandas, OCR fallback)"]
    B --> C["Chunker<br/>chunk_size + overlap"]
    C --> D["Embedder<br/>sentence-transformers · all-MiniLM-L6-v2"]
    D --> E[("🗄️ PostgreSQL<br/>documents / chunks metadata")]
    D --> F[("📍 Qdrant<br/>chunk vectors + payload")]
    E -.audit trail.-> G["✅ Document Ready for Q&A"]
    F -.searchable index.-> G
```

### 2. Question Answering Flow

```mermaid
graph TD
    Q["❓ User Question"] --> H["HyDE<br/>Hypothetical Document Embedding"]
    H --> R1["Dense Retrieval<br/>Qdrant ANN / cosine"]
    Q --> R2["Sparse Retrieval<br/>BM25 keyword search"]
    R1 --> M["🔀 Merge via<br/>Reciprocal Rank Fusion (RRF)"]
    R2 --> M
    M --> RR["🎯 Cross-Encoder Reranker<br/>(query, chunk) pairwise scoring"]
    RR --> TK["Top-K Contexts<br/>(3–10 chunks)"]
    TK --> P["Prompt Assembly<br/>system + contexts + question"]
    P --> LLM["🤖 Groq LLM<br/>llama-3.1-8b-instant / gpt-oss-20b"]
    LLM --> ANS["✅ Grounded Answer<br/>+ Inline Citations + Sources"]
    ANS --> DB[("🗄️ PostgreSQL<br/>chat history / sessions")]
```

---

## 🧰 Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI, SQLAlchemy, Pydantic, Python 3.10+ | API orchestration, ORM, request/response validation |
| **Frontend** | React (Vite), Tailwind CSS | Chat workspace UI with citation rendering |
| **Vector Storage** | Qdrant | ANN vector search over chunk embeddings (HNSW index) |
| **Relational DB** | PostgreSQL (Supabase Postgres supported) | Document/chunk metadata, chat sessions, audit trail |
| **Embeddings** | sentence-transformers (`all-MiniLM-L6-v2`) | Converts text to dense semantic vectors |
| **Retrieval** | BM25 + Dense Vector + HyDE + RRF + Cross-Encoder | Hybrid recall with precision reranking |
| **LLM** | Groq (`llama-3.1-8b-instant`, `gpt-oss-20b`) | Grounded answer generation & basic chat |
| **Evaluation** | RAGAs | Faithfulness, Answer Relevancy, Context Recall metrics |

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database (or Supabase Postgres)
- Qdrant server
- Groq API key

### 1. Python Environment Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Frontend Setup (React / Vite)

```bash
cd web
npm install
cd ..
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
# Required for generation / HyDE / basic chat
GROQ_API_KEY=your_groq_api_key

# Required by app/db/postgres.py — use either DATABASE_URL or SUPABASE_DB_URL
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/rag
# SUPABASE_DB_URL=postgresql+psycopg2://...

# Qdrant options (use one style)
QDRANT_URL=http://localhost:6333
# or:
# QDRANT_HOST=localhost
# QDRANT_PORT=6334
```

> 💡 If `QDRANT_URL` is not set, the backend falls back to `QDRANT_HOST` / `QDRANT_PORT`.

### 4. Run Qdrant (Docker)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Run the Backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Run the Frontend

```bash
cd web
npm run dev
```

Open the app at **http://localhost:5173**

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check for the backend service |
| `POST` | `/ingest/url` | Ingest a document from a live URL |
| `POST` | `/ingest/file` | Ingest a file (`PDF`, `TXT`, `CSV`) |
| `POST` | `/ask` | Document-grounded Q&A — runs full retrieval pipeline, returns answer + citations |
| `POST` | `/chat/basic` | Basic general-purpose chat (no document retrieval) |
| `POST` | `/chat/sessions` | Create a new chat session |
| `GET` | `/chat/sessions` | List existing chat sessions |
| `GET` | `/chat/history/{session_id}` | Fetch full message history for a session |

**Example calls:**

```bash
curl -X GET http://localhost:8000/health
```

```bash
curl -X POST http://localhost:8000/ingest/url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"document_id":"YOUR_DOCUMENT_ID","question":"What is this about?","top_k":10}'
```

---

## 🔍 System Deep Dive & Architecture Decisions

<details>
<summary><strong>1. Why RAG? (Solving stale memory & hallucination)</strong></summary>

<br>

Plain LLMs generate text by pattern completion over statistically learned parameters — they have no guaranteed, verifiable, up-to-date external memory. When a prompt lacks grounding, models often **hallucinate**: producing confident but fabricated statements, because they optimize for plausibility, not factual accuracy.

**Retrieval-Augmented Generation (RAG)** anchors generation to real evidence. A retriever first fetches relevant passages from a trusted knowledge store; the LLM then composes an answer *conditioned on that retrieved context*, and can cite exactly where each claim came from.

> Think of the retriever as a researcher pulling official documents, and the LLM as a writer who must cite those documents while drafting the answer.

</details>

<details>
<summary><strong>2. Retrieval Engine Mechanics — HyDE → Hybrid Search → Reranking</strong></summary>

<br>

**Step 1 — HyDE (Hypothetical Document Embeddings)**
Instead of embedding the raw (often short or ambiguous) user question, the LLM first generates a *hypothetical answer* to the question. This synthetic passage is phrased more like the target documents, so its embedding matches relevant chunks far better than the bare question — improving recall, at the cost of one extra LLM call.

**Step 2 — Hybrid Retrieval (Dense + Sparse)**
- **Dense (Qdrant):** The HyDE/question embedding is compared against stored chunk vectors via ANN search (cosine similarity), capturing *semantic* relevance.
- **Sparse (BM25):** A TF-IDF-style ranking function scores chunks by exact term overlap, rewarding matches on proper nouns, IDs, and domain-specific keywords that vector models can underweight.
- **Fusion (RRF):** Both ranked lists are merged using **Reciprocal Rank Fusion** — for each chunk, `score = Σ 1 / (k + rank)` across both lists (k ≈ 60) — boosting chunks that rank highly in *either* method.

**Step 3 — Cross-Encoder Reranking**
Bi-encoders (used for fast retrieval) embed the query and document independently. A **cross-encoder** instead feeds the (question, chunk) pair jointly through a transformer with full cross-attention, producing a much more precise relevance score. It's slower, so it's only applied to the top candidates from hybrid retrieval — trading a small compute cost for a large precision gain.

</details>

<details>
<summary><strong>3. Storage Strategy — PostgreSQL vs. Qdrant</strong></summary>

<br>

| Store | Role |
|---|---|
| **PostgreSQL** | Structured metadata: document source, chunk text, timestamps, uploader, chat sessions/messages. Enables transactions, joins, and full audit trails. |
| **Qdrant** | High-dimensional vector storage with HNSW indexing for fast ANN search, plus lightweight payloads for filtering and source display. |

Relational databases excel at complex queries and data integrity; vector databases excel at approximate nearest-neighbor search at scale. Splitting responsibilities lets each system do what it's best at, rather than compromising on both.

</details>

<details>
<summary><strong>4. Evaluation — RAGAs Metrics</strong></summary>

<br>

RAGAs measures the quality of a RAG pipeline against a labeled test set (questions + ground-truth contexts + reference answers):

- **Faithfulness** — Are the claims in the generated answer actually supported by the retrieved context? (Precision of facts.)
- **Answer Relevancy** — How well does the answer actually address the user's question?
- **Context Recall** — What fraction of the necessary supporting evidence was retrieved among the top contexts?

Run it locally:

```bash
python -m app.evaluation.evaluate
```

</details>

<details>
<summary><strong>5. Two Chat Modes — When to Use Which</strong></summary>

<br>

| Mode | Endpoint | Behavior | Use Case |
|---|---|---|---|
| **Document Mode** | `/ask` | Full retrieval pipeline; answers constrained to retrieved context, returned with sources | Domain-specific, verifiable, official answers |
| **Basic Chat** | `/chat/basic` | Direct LLM conversation, no retrieval | Open-ended conversation, no grounding overhead needed |

</details>

---

## 🛠️ Troubleshooting & Known Limitations

### Common Pitfalls

| Issue | Resolution |
|---|---|
| **Database URL error** | Ensure `DATABASE_URL` or `SUPABASE_DB_URL` is set correctly in `.env`. |
| **Qdrant connection error** | Confirm Qdrant is running (`docker run -p 6333:6333 qdrant/qdrant`) and that `QDRANT_URL`/`QDRANT_HOST`/`QDRANT_PORT` match your setup. |
| **CORS / proxy issues in web app** | Ensure the backend is running on port `8000` and the frontend dev server on port `5173`. |
| **`/ingest/file` rejects a file** | Only `PDF`, `TXT`, and `CSV` are currently supported. |
| **`/ask` returns an error** | Requires a valid `document_id` returned from a prior `/ingest/*` call. |

### Known Limitations

- **Chunking trade-offs** — Small chunks lose surrounding context and inflate index size; large chunks dilute relevance and eat into the reranking/generation token budget.
- **BM25 exact-match behavior** — Struggles with paraphrasing; relies on literal token overlap, so it can miss semantically identical but differently-worded content.
- **OCR dependency** — Scanned (image-based) PDFs require OCR (Tesseract), which is slower and less reliable than native text extraction.
- **HyDE bias risk** — If the LLM imagines an inaccurate hypothetical document, retrieval can be pulled toward irrelevant passages; also adds latency/cost per query.
- **Retrieval gaps** — If a needed document was never ingested, or relevant passages weren't retrieved, the generator may still produce a low-confidence or hallucinated answer despite grounding safeguards.

---

## 📁 Project Structure

```text
rag/
  app/
    api/            # API service orchestration
    db/             # PostgreSQL models/store, Qdrant client
    embeddings/     # Sentence-transformers embedder
    evaluation/     # RAGAs dataset and evaluator
    generation/     # Groq generator
    ingestion/      # URL/PDF/TXT/CSV loader + chunking pipeline
    retrieval/      # BM25, hybrid, HyDE, reranker
    vectorstore/    # Qdrant store wrapper
    main.py         # FastAPI app
  web/              # React + Vite frontend
  scripts/          # Local utility scripts
  data/             # Input data
  storage/uploads/  # Uploaded files
```

---

## 📄 License

Distributed under the **MIT License**.

---

<p align="center">
  Built for the <strong>HTE Department</strong> · VJTI Mumbai Government Hackathon<br>
  <em>"Instant, Reliable & Grounded Access to Official Administrative Knowledge"</em>
</p>
