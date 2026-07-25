# RAGNexus - Hybrid RAG API + Web Chat

Full-stack Retrieval-Augmented Generation project with:
- FastAPI backend for ingestion and Q&A
- React (Vite) frontend for chat UI
- Hybrid retrieval (vector + BM25) with HyDE query expansion
- Cross-encoder reranking
- Optional RAGAs evaluation

## What is implemented

- Ingest from URL, PDF, TXT, and CSV
- Store document/chunk metadata in PostgreSQL
- Store embeddings in Qdrant
- Query pipeline:
  HyDE expansion -> hybrid retrieval -> rerank -> grounded answer generation
- Basic non-document chat mode using Groq
- Frontend chat workspace with source citations

## Architecture

Document flow:

Source (URL/file) -> Loader -> Chunker -> Embeddings
-> PostgreSQL (documents/chunks) + Qdrant (vectors)

Question flow (document mode):

Question -> HyDE -> Hybrid Retriever (Qdrant + BM25)
-> Cross-Encoder Reranker -> Top contexts -> Groq LLM -> Answer + Sources

## Tech stack

- Backend: FastAPI, SQLAlchemy
- Vector DB: Qdrant
- Relational DB: PostgreSQL (Supabase Postgres also supported)
- Retrieval: BM25 + dense vector search + HyDE + reranker
- LLM: Groq (openai/gpt-oss-20b)
- Frontend: React + Vite

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database
- Qdrant server
- Groq API key

## Setup

### 1) Python dependencies

From project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Frontend dependencies

```bash
cd web
npm install
cd ..
```

### 3) Environment variables

Create a .env file in the project root:

```env
# Required for generation/HyDE/basic chat
GROQ_API_KEY=your_groq_api_key

# Required by app/db/postgres.py
# Use either DATABASE_URL or SUPABASE_DB_URL
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/rag
# SUPABASE_DB_URL=postgresql+psycopg2://...

# Qdrant options (use one style)
QDRANT_URL=http://localhost:6333
# or:
# QDRANT_HOST=localhost
# QDRANT_PORT=6334
```

Notes:
- If you run Qdrant with Docker default port mapping (6333), set QDRANT_URL to http://localhost:6333.
- If QDRANT_URL is not set, backend falls back to QDRANT_HOST/QDRANT_PORT.

### 4) Run Qdrant (Docker)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5) Run backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6) Run frontend

```bash
cd web
npm run dev
```

Open the app at http://localhost:5173

## API endpoints

- GET /health
- POST /ingest/url
- POST /ingest/file
- POST /ask
- POST /chat/basic
- POST /chat/sessions
- GET /chat/sessions
- GET /chat/history/{session_id}

Example calls:

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

## Evaluation (optional)

Run RAGAs evaluation:

```bash
python -m app.evaluation.evaluate
```

Default metrics used:
- faithfulness
- answer_relevancy
- context_recall

## Project structure

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

## Current behavior notes

- /ingest/file accepts only PDF, TXT, CSV.
- /ask requires a valid document_id returned by an ingest endpoint.
- In document mode, answers are constrained by retrieved context and returned with sources.
- Basic chat mode does not use document retrieval.
- Chat history is persisted per user in PostgreSQL and scoped by chat session.

## Troubleshooting

- Database URL error:
  Set DATABASE_URL or SUPABASE_DB_URL in .env.
- Qdrant connection error:
  Ensure Qdrant is running and URL/host/port match your config.
- CORS/proxy issues in web:
  Ensure backend is running on port 8000 and frontend on 5173.

## Deep Dive: RAGNexus —

**1. What is RAG and why does it exist?**
- **Definition:** Retrieval-Augmented Generation (RAG) is a pattern that combines a retrieval system (search over a knowledge store) with a generative model (an LLM). The retriever finds relevant documents or passages and the generator composes an answer conditioned on that retrieved context.
- **Why plain LLMs are not enough:** LLMs are impressive at pattern completion but do not have a guaranteed, up-to-date, or verifiable external memory. Their parameters encode statistical patterns from training data, which can be stale or incomplete.
- **Hallucination:** Hallucination refers to a model producing confident but incorrect or fabricated statements. Because generative models optimize for plausibility, not factual accuracy, they can invent facts when the prompt lacks grounding.
- **How RAG helps:** By conditioning the LLM on retrieved documents that contain evidence, RAG anchors the generation to factual context. The LLM can cite sources and be constrained to use the provided context, greatly reducing hallucination and improving verifiability.
- **Fundamental idea (analogy):** Think of the retriever as a researcher who fetches relevant documents and the LLM as a writer that composes an answer using those documents as references.

**2. Document Ingestion Pipeline — step by step**
- **Submission (URL or upload):** The ingestion endpoint accepts a URL or uploaded file. The backend queues or synchronously processes the input: download (for URL), extract raw text, split into chunks, compute embeddings, persist metadata and vectors.
- **Loaders by type:**
  - **URL:** HTTP GET the page, optionally render JavaScript (headless browser) or use heuristics to extract the article (readability). Libraries: `requests`, `newspaper3k`, `readability-lxml`, `playwright` for JS-heavy pages.
  - **PDF:** Use `pdfplumber`, `PyPDF2`, or `pdfminer.six` for text extraction. For scanned PDFs, use OCR (Tesseract via `pytesseract`).
  - **TXT:** Plain read; minimal processing (normalize whitespace, encoding). 
  - **CSV:** Parse rows (pandas/csv). Treat long text columns as documents or create per-row documents with structured metadata (e.g., filename, row_id, column_name).
- **Chunking:**
  - **What:** Splitting long documents into smaller passages (chunks) before embedding.
  - **Why:** Embedding models have an input size limit and retrieval works on passage-level relevance. Smaller chunks allow retrieval to return the most relevant passage rather than an entire, noisy document.
  - **Chunk size & overlap:** `chunk_size` (e.g., 500 tokens or 250–1000 chars) and `overlap` (e.g., 50–100 chars) control granularity and context continuity. Overlap prevents losing context at chunk boundaries; too large chunks dilute focus, too small chunks lose coherence.
- **Embeddings:**
  - **Definition:** Embeddings convert text into fixed-length numerical vectors representing semantic content.
  - **How sentence-transformers works:** A bi-encoder architecture (a transformer that pools token representations) produces a vector per text. The `all-MiniLM-L6-v2` model is a distilled, efficient transformer that maps similar semantics to nearby vectors in cosine space.
  - **Under the hood:** Tokenize text → transformer layers → pooling (mean / CLS) → optional projection to lower dimension → L2-normalize. Training objective often uses contrastive or triplet losses to bring semantically similar texts closer.
- **Storage split (Postgres vs Qdrant):**
  - **PostgreSQL:** Stores structured metadata (original source URL/path, document_id, chunk_id, chunk text, timestamps, upload user, file MIME, custom tags). Useful for querying, transactions, joins, and persistence.
  - **Qdrant:** Optimized vector store for nearest-neighbor search. Stores high-dimensional vectors and lightweight payloads (metadata necessary for ranking or displaying sources). Qdrant is built for fast ANN indexing and vector similarity queries.
  - **Why both:** Relational DBs are better for complex queries, integrity, and ACID guarantees. Vector DBs provide efficient approximate nearest neighbor (ANN) search. Splitting responsibilities leverages each system’s strengths.
- **Qdrant collections & storage:**
  - **Collection:** A logical container for vectors, roughly like a table. You create a collection (e.g., `ragnexus_chunks`) with a chosen vector size and distance metric.
  - **Storage & indexing:** Qdrant stores vectors and payloads and builds indexes (HNSW by default) for fast ANN search. It supports filtering by payload fields to scope searches and can persist to disk or use memory-mapped files.

**3. Question Answering Pipeline — step by step**
- **User submits question:** Frontend sends the question (and session context) to the `/ask` endpoint. Backend starts retrieval, reranking, and generation.
- **HyDE (Hypothetical Document Embeddings):**
  - **What:** HyDE asks the LLM to imagine (generate) a hypothetical answer or expansion of the query, then embeds that synthetic text.
  - **Why:** The hypothetical answer often contains phrases and context that reflect how relevant documents would address the question. Embeddings of HyDE output match document embeddings better than raw questions, improving recall for short or ambiguous queries.
  - **Cost/Tradeoff:** Adds an LLM call before retrieval (latency and cost) but often yields better results, especially for sparse or keyword-lean queries.
- **Dense vector search (Qdrant):**
  - **Process:** Compute query vector (from HyDE or question) → Qdrant ANN query → returns nearest vectors with distances/scores and optional payloads.
  - **Similarity metrics:** Qdrant supports cosine, dot product (cosine-compatible when vectors normalized), and Euclidean. For embeddings like sentence-transformers, cosine similarity (or inner product with normalized vectors) is common.
- **BM25 (keyword retrieval):**
  - **Idea:** BM25 is a term-frequency / inverse document frequency (TF-IDF) based ranking function. It scores documents based on query term matches, term frequency, document length normalization, and IDF weighting.
  - **Why it's different:** BM25 matches exact tokens and benefits from exact keywords, proper nouns, or domain terms that vector models might deem less significant.
  - **Mechanics:** BM25 score is sum over query terms of IDF * ((k1 + 1) * tf) / (tf + k1 * (1 - b + b * dl/avgdl)), with tunable `k1` and `b`.
- **Hybrid retrieval:**
  - **Why hybrid:** Vector search finds semantically relevant passages; BM25 finds exact lexical matches. Combining both increases recall and robustness.
  - **Combining strategies:** Common approaches: concatenate candidate lists and deduplicate, score-rescale-and-sum, or use Reciprocal Rank Fusion (RRF) to combine ranked lists.
  - **Reciprocal Rank Fusion (RRF):** For each document, sum 1 / (k + rank) across ranking sources (k is a small constant like 60). Documents appearing highly in either list get boosted.
- **Cross-Encoder reranker:**
  - **Bi-encoder vs Cross-encoder:** Bi-encoder independently embeds query and document to compute similarity quickly (fast retrieval). Cross-encoder takes query+document as a single input and runs full attention across both, producing a more precise relevance score but is slower.
  - **Why rerank:** Initial retrieval trades quality for speed. A cross-encoder reranker can re-score top candidates more accurately, improving final answer relevance.
  - **What it does:** For each (question, chunk) pair, the cross-encoder produces a relevance score (often via a classification head or regression). It captures fine-grained interactions between question tokens and chunk tokens.
- **Top-K contexts → prompt assembly:**
  - **Selection:** After reranking, take top K chunks (e.g., 3–10) balancing token budget and coverage.
  - **Formatting:** Include a short system instruction, the curated contexts with source identifiers, and the user question. Use clear separators and optionally annotate each context with its source (URL, doc_id, page, chunk index).
  - **Example prompt structure:**
    - System: role + instructions (e.g., "Answer using only the provided contexts. Cite sources inline.")
    - Contexts: [1] ...text... (source A)
    - User question: "..."
- **Groq LLM input & generation:**
  - **What Groq receives:** The assembled prompt (system + contexts + user question) and parameters (temperature, max tokens, stop sequences).
  - **System prompt tone:** Instruct to base answers strictly on context, use citations (e.g., [source_id]), and return a short summary plus citation list.
  - **Grounded answer & citations:** The LLM extracts relevant facts from contexts, composes the answer, and annotates sentences or claims with source references. The backend then returns answer + structured sources for UI display.

**4. The two chat modes**
- **Document mode (`/ask`):** Uses the full retrieval pipeline described above. Use when you want answers grounded in ingested documents.
- **Basic chat mode (`/chat/basic`):** Direct LLM conversation without retrieval; the LLM answers based on its pre-trained knowledge and any conversation context provided in the prompt.
- **When to use each:** Use document mode for domain-specific, up-to-date, or verifiable answers. Use basic chat for open-ended conversation or when retrieval overhead is unnecessary.
- **How basic chat works:** The frontend sends messages and optional system instructions; the backend builds a conversational prompt and calls Groq directly, possibly including recent chat history but no retrieved contexts.

**5. Session and history management**
- **Storage:** Chat sessions and messages are stored in PostgreSQL tables (sessions, messages). Each message row includes session_id, sender (user/assistant/system), text, timestamp, and optional metadata (source references).
- **Session ID:** A UUID generated when creating a session. It is returned to the client and used for subsequent requests to append/retrieve messages.
- **Retrieval/display:** The frontend requests `/chat/history/{session_id}` to fetch messages. Backend queries messages ordered by timestamp, reconstructs display-friendly objects, and includes source metadata as needed.

**6. The FastAPI backend**
- **Request handling:** FastAPI maps paths to Python async functions (endpoints). It validates input (Pydantic models), executes logic (ingest, retrieve, generate), and returns JSON responses.
- **SQLAlchemy:** ORM used to define models, sessions, and queries. It translates Python model operations into SQL for PostgreSQL, managing connections and transactions.
- **Pydantic:** Data validation and serialization layer. Input payloads are validated against Pydantic models, ensuring types and constraints before processing.
- **Orchestration for `/ask`:** Steps: validate request → fetch session context → compute HyDE expansion → query Qdrant + BM25 → merge candidates → rerank with cross-encoder → assemble prompt → call Groq → store message and sources → return response.

**7. The React frontend**
- **Communication:** Frontend uses `fetch` or `axios` to call FastAPI endpoints (CORS enabled). It sends JSON requests and renders JSON responses.
- **Citations display:** The UI maps source identifiers returned with the answer to clickable inline elements or footnotes, showing source metadata (title, URL, chunk preview). Clicking a citation can open the original source.
- **Session management on frontend:** The app stores the `session_id` in localStorage or in component state; when the user creates a new chat, the id is stored and attached to subsequent messages.

**8. RAGAs evaluation**
- **What is RAGAs:** A dataset and evaluation methodology for RAG systems that measures faithfulness and utility of generated answers to ground truth context.
- **Metrics:**
  - **Faithfulness:** Whether generated claims are supported by provided source documents (precision of facts).
  - **Answer relevancy:** How relevant/useful the answer is to the user’s question (often human-judged or measured via similarity to reference answers).
  - **Context recall:** Fraction of necessary supporting evidence items retrieved among the top contexts.
- **Running evaluation:** Use a labeled test set (questions + ground-truth contexts + reference answers). For each question: run the retrieval+generation pipeline, compare generated answer vs references using automatic metrics plus human annotation for faithfulness. Aggregate results.

**9. Why each architectural decision was made**
- **HyDE:** Often improves recall for short/ambiguous queries by generating a target-like pseudo-document that matches document semantics better than the raw query.
- **Hybrid retrieval:** Combines semantic matching with lexical precision — covers more edge cases (dates, ids, rare names).
- **Cross-encoder reranker:** Improves precision by modeling token-level interactions between query and candidate context at the cost of compute on a small set of candidates.
- **Qdrant vs pgvector:** Qdrant provides production-grade vector indexing, filtering, scalable ANN algorithms (HNSW), and convenient payload filters; pgvector is simpler within Postgres but has different scaling/ops tradeoffs.
- **Groq vs OpenAI:** Choice may be cost, latency, privacy, or API guarantees; Groq’s `llama-3.1-8b-instant` provides a production-grade model with desired behavior and pricing.
- **all-MiniLM-L6-v2:** Small, fast, and effective for semantic embeddings. It provides a solid tradeoff between speed/cost and retrieval quality for many use cases.

**10. Limitations & failure modes**
- **When RAG fails:** If the needed information wasn’t ingested, or if retrieval missed relevant passages, the generator can still hallucinate or provide low-quality answers.
- **When answer not in docs:** The LLM may either admit uncertainty (if prompted to) or hallucinate. Proper system prompts and answer policies (e.g., "If unsupported, say I don't know") mitigate risk.
- **HyDE weaknesses:** HyDE can introduce bias—if the LLM imagines incorrect hypothetical docs, retrieval may surface irrelevant passages. It also increases latency/cost.
- **BM25 weaknesses:** Struggles with paraphrases and semantic similarity; relies on token overlap and suffers when queries use different phrasing than documents.
- **Chunk size tradeoffs:** Too small → lose context and increase index size/latency. Too large → dilute relevance and blow token budgets for reranking and generation.
- **Improvements:** Fine-tune retrievers or rerankers on domain data, use supervised re-ranking datasets, add confidence calibration, and expand evaluation with human studies.

---
