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

# 🏛️ HTE-Samvad RAG Engine

### *Instant, Reliable & Grounded Access to Official Administrative Knowledge*

**AI-powered question answering system for the HTE Department** built for the VJTI Mumbai Government Hackathon.

<p>
  <img src="https://camo.githubusercontent.com/629436a6802e7ac32a847d0887585634ccf768c75901f1bb547bba090e528df/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f707974686f6e2d332e31302532422d626c75653f6c6f676f3d707974686f6e266c6f676f436f6c6f723d7768697465" alt="Python 3.10+">
  <img src="https://camo.githubusercontent.com/d1b96a79e5af4cdc992f282f835f51c5f93deb27ae407839cf62857a71c45aa7/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f466173744150492d6261636b656e642d3030393638383f6c6f676f3d66617374617069266c6f676f436f6c6f723d7768697465" alt="FastAPI">
  <img src="https://camo.githubusercontent.com/af959aded4e6a0039a2049bb7d263a9b0165f44ec7cf3cbb818a48fc580e18af/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f52656163742d566974652d3631444146423f6c6f676f3d7265616374266c6f676f436f6c6f723d7768697465" alt="React + Vite">
  <img src="https://camo.githubusercontent.com/ee267b05d1c512c971777685f7c0ddd383359d8d4698d2706f19274be73b691e/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f566563746f7244422d516472616e742d4443323434433f6c6f676f3d716472616e74266c6f676f436f6c6f723d7768697465" alt="Qdrant">
  <img src="https://camo.githubusercontent.com/35d640dc6ef347f2f94c70f5da11333aebf6f5d43fa50a9e112b24ea19b06567/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f44422d506f737467726553514c2d3431363945313f6c6f676f3d706f737467726573716c266c6f676f436f6c6f723d7768697465" alt="PostgreSQL">
  <img src="https://camo.githubusercontent.com/86a6ced842d126ee99bf7f1ef0d99c41d5959dc8cc05cc9235321da05f134ea7/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4c4c4d2d47726f712d4635353033363f6c6f676f3d67726f71266c6f676f436f6c6f723d7768697465" alt="Groq">
  <img src="https://camo.githubusercontent.com/7ee63b2904dc2af8a83b22a0df53d3495728d2002a439fb9b5f647bfeefb902c/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6576616c2d52414741732d384132424532" alt="RAGAs">
  <img src="https://camo.githubusercontent.com/f8df3091bbe1149f398a5369b2c39e896766f9f6efba3477c63e9b4aa940ef14/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6c6963656e73652d4d49542d677265656e" alt="License: MIT">
</p>

---

## What This Project Does

HTE-Samvad is a retrieval-augmented generation system for official, administrative, and policy documents. It lets users upload documents or ingest a URL, then ask natural-language questions and receive answers that are grounded in the ingested source material.

The backend splits documents into chunks, generates embeddings, stores structured metadata in PostgreSQL, stores vectors in Qdrant, and then uses hybrid retrieval plus reranking to find the best evidence before generating a response with Groq. The frontend provides an authenticated chat workspace for uploading documents, browsing them, starting chat sessions, and switching between document-grounded Q&A and general chat.

In short, this project helps departments turn long, scattered official content into a searchable and citeable knowledge base.

---

## Core Capabilities

- Upload PDFs, text files, CSVs, and supported image files for OCR-based ingestion.
- Ingest content directly from a URL.
- Ask questions against one or more selected documents.
- Get source-backed responses with document and chunk metadata.
- Use a separate basic chat mode for general conversations without document retrieval.
- Create, rename, list, and delete chat sessions.
- Persist document, chat, and user state in a multi-tenant backend.
- Rate limit authentication and RAG endpoints to protect the service from abuse.
- Evaluate retrieval quality with RAGAs.

---

## How It Works

### Ingestion Flow

```mermaid
graph TD
    A["Source input\nPDF / TXT / CSV / Image / URL"] --> B["Loader + OCR fallback"]
    B --> C["Chunking pipeline"]
    C --> D["Embeddings"]
    D --> E[("PostgreSQL\nDocuments, chunks, sessions")]
    D --> F[("Qdrant\nVectors + tenant payloads")]
    E --> G["Ready for retrieval"]
    F --> G
```

### Question Answering Flow

```mermaid
graph TD
    Q["User question"] --> H["HyDE query expansion"]
    H --> D1["Dense search in Qdrant"]
    Q --> S1["Sparse BM25 search"]
    D1 --> M["Hybrid merge / fusion"]
    S1 --> M
    M --> R["Cross-encoder reranking"]
    R --> K["Top-k evidence chunks"]
    K --> P["Prompt assembly"]
    P --> L["Groq LLM generation"]
    L --> A["Grounded answer + sources"]
```

The main retrieval path is built to reduce hallucinations. The system first expands the query with HyDE, then combines dense vector search with BM25 keyword search, then reranks the candidate chunks before passing only the best context to the LLM.

---

## Tech Stack

| Area | Technology | Role |
|---|---|---|
| Backend | FastAPI, Pydantic | API layer, validation, request handling |
| Auth | JWT-based auth helpers | Register, login, refresh, current-user lookup |
| Storage | PostgreSQL | Users, documents, chunks, sessions, message history |
| Vector Search | Qdrant | Semantic retrieval over chunk embeddings |
| Retrieval | BM25, HyDE, hybrid fusion, reranking | Candidate generation and precision ranking |
| LLM | Groq | Document-grounded and basic chat generation |
| Embeddings | sentence-transformers | Dense vector generation for chunks and queries |
| OCR / Ingestion | File loader + OCR service | Handle scanned and image-based inputs |
| Frontend | React + Vite | Authenticated chat and document workflow UI |
| Evaluation | RAGAs | Retrieval quality and answer quality checks |

---

## Repository Layout

The application code lives in the `rag/` folder.

```text
rag/
├── app/                # FastAPI backend
│   ├── api/            # RAG orchestration and chat logic
│   ├── auth/           # JWT and password helpers
│   ├── core/           # Config, logging, rate limiting
│   ├── db/             # PostgreSQL and Qdrant access layers
│   ├── embeddings/     # Embedding generation
│   ├── evaluation/     # RAGAs dataset and evaluation runner
│   ├── generation/     # Groq prompt and answer generation
│   ├── ingestion/      # Loading, chunking, pipeline orchestration
│   ├── ocr/            # OCR helpers for image/scanned inputs
│   ├── retrieval/      # BM25, hybrid retrieval, HyDE, reranking
│   └── vectorstore/    # Qdrant collection and vector operations
├── scripts/            # Ingestion, querying, and migration scripts
├── storage/uploads/    # Temporary uploaded files
└── web/                # React + Vite frontend
```

---

## Key User Flows

### 1. Authentication

Users can register and log in through the frontend. The backend issues an access token and refresh token pair, and the frontend stores them locally to keep the session active.

### 2. Document Upload and Ingestion

Users can upload one or more supported files or ingest content from a URL. Uploaded files are saved temporarily, then processed asynchronously. For files that need OCR, the ingestion path supports image handling as part of the document pipeline.

### 3. Document-Grounded Q&A

Users select one or more documents, ask a question, and the system retrieves relevant chunks from the current tenant only. The answer includes source metadata so the user can verify where the response came from.

### 4. Basic Chat

If the user does not want document grounding, they can use basic chat. This mode goes directly to the LLM without document retrieval.

### 5. Session Management

Chat sessions are stored per user and can be listed, renamed, deleted, or resumed. Document-mode sessions stay linked to their selected document set.

---

## API Overview

All protected endpoints require a Bearer token.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/auth/register` | Create a user and return tokens |
| `POST` | `/auth/login` | Authenticate an existing user |
| `POST` | `/auth/refresh` | Refresh access tokens |
| `POST` | `/ingest/url` | Ingest one URL or a list of URLs |
| `POST` | `/ingest/file` | Upload and ingest files |
| `GET` | `/documents` | List the current user’s documents |
| `DELETE` | `/documents/{document_id}` | Delete a document and its related data |
| `POST` | `/ask` | Ask a grounded question over documents |
| `POST` | `/chat/basic` | Ask a general-purpose chat message |
| `POST` | `/chat/sessions` | Create a chat session |
| `GET` | `/chat/sessions` | List chat sessions |
| `GET` | `/chat/history/{session_id}` | Fetch a session’s message history |
| `PATCH` | `/chat/sessions/{session_id}` | Rename a chat session |
| `DELETE` | `/chat/sessions/{session_id}` | Delete a chat session |

### Example Requests

```bash
curl -X GET http://localhost:8000/health
```

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"name@example.com","password":"your-password"}'
```

```bash
curl -X POST http://localhost:8000/ask \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_id":"YOUR_DOCUMENT_ID","question":"What is this about?","top_k":10}'
```

---

## Security and Multitenancy

This project is designed for per-user isolation.

- PostgreSQL queries are filtered by the current user.
- Qdrant vectors are tagged with a tenant identifier and searched with tenant filters.
- Chat sessions, documents, and chunks are stored per user.
- Rate limiting is applied to ingestion, question answering, and basic chat endpoints.

This means one user cannot read another user’s documents, chat history, or vector results through normal API usage.

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database or Supabase Postgres
- Qdrant instance
- Groq API key

### 1. Backend Environment

From the project root:

```bash
cd rag
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Frontend Environment

```bash
cd web
npm install
```

### 3. Environment Variables

Create a `.env` file inside `rag/`:

```env
GROQ_API_KEY=your_groq_api_key

DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/rag
# or
# SUPABASE_DB_URL=postgresql+psycopg2://...

QDRANT_URL=http://localhost:6333
# or
# QDRANT_HOST=localhost
# QDRANT_PORT=6334

VITE_API_URL=http://localhost:8000
```

### 4. Start Qdrant

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Run the Backend

```bash
cd rag
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Run the Frontend

```bash
cd rag/web
npm run dev
```

Open the app at `http://localhost:5173`.

---

## Evaluation

The repository includes an evaluation pipeline for RAG quality. It is intended to measure how well the retriever and generator behave against a labeled dataset.

Run it from the backend directory:

```bash
cd rag
python -m app.evaluation.evaluate
```

The main metrics are:

- Faithfulness
- Answer relevancy
- Context recall

---

## Why This Architecture

This project uses RAG because official knowledge changes over time and must remain traceable. A plain LLM can answer fluently, but not reliably from the latest official records. By adding retrieval, reranking, and citations, the system keeps answers closer to the source material and easier to verify.

PostgreSQL handles structured data like users, sessions, and document metadata. Qdrant handles semantic search over chunk embeddings. That separation keeps each storage layer focused on the job it does best.

---

## Troubleshooting

- If uploads fail, verify the backend can create `storage/uploads/` and that the file type is supported.
- If document-grounded answers are empty, confirm the document was ingested successfully and that the user is querying their own tenant data.
- If the frontend cannot reach the backend, check `VITE_API_URL` and CORS settings.
- If the app cannot connect to Qdrant or PostgreSQL, verify the connection URLs in `.env`.

---

## Summary

HTE-Samvad RAG Engine turns official HTE documents into a searchable, secure, multi-user question answering system. It supports ingestion, OCR-assisted document processing, hybrid retrieval, grounded answer generation, chat sessions, and per-user isolation across the full stack.
