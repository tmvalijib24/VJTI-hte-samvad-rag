import logging

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    Request,
)

from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
import os
import shutil
import uuid
from typing import Optional, List

from app.ocr.ocr_service import IMAGE_EXTENSIONS

logger = logging.getLogger(__name__)

# Configure root logger so our messages are visible on the console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from app.auth.security import (
    ACCESS_TOKEN_MINUTES,
    REFRESH_TOKEN_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.api.rag_service import answer_basic_message, answer_question, ingest_and_index
from app.db.postgres import PostgresStore, User
from app.core.rate_limiter import limiter, RATE_LIMIT_ASK, RATE_LIMIT_INGEST, RATE_LIMIT_CHAT


app = FastAPI(title="RAG API")

# Apply rate limiter middleware globally
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://rag-nexus-nu.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestUrlRequest(BaseModel):
    url: Optional[str] = None
    urls: Optional[List[str]] = None


class AskRequest(BaseModel):
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    question: str = Field(..., min_length=1)
    top_k: int = Field(10, ge=1, le=20)
    session_id: Optional[str] = None


class BasicChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = None


class ChatSessionCreateRequest(BaseModel):
    mode: str = Field(..., min_length=4)
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None


class ChatSessionUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class AuthRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)
    full_name: str | None = Field(default=None, min_length=1)


class AuthLoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class AuthRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20)


def _token_payload(user: User):
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
        },
        "access_token": create_access_token(user),
        "refresh_token": create_refresh_token(user),
        "token_type": "bearer",
        "access_expires_in": ACCESS_TOKEN_MINUTES * 60,
        "refresh_expires_in": REFRESH_TOKEN_DAYS * 24 * 60 * 60,
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/auth/register")
def register(req: AuthRegisterRequest):
    pg = PostgresStore()
    email = req.email.strip().lower()
    existing = pg.get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = pg.create_user(
        email=email,
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip() if req.full_name else None,
    )
    return _token_payload(user)


@app.post("/auth/login")
def login(req: AuthLoginRequest):
    pg = PostgresStore()
    user = pg.get_user_by_email(req.email.strip().lower())
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_payload(user)


@app.post("/auth/refresh")
def refresh(req: AuthRefreshRequest):
    payload = decode_token(req.refresh_token)
    if payload.get("token_type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    pg = PostgresStore()
    user = pg.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return _token_payload(user)


@app.post("/ingest/url")
@limiter.limit(RATE_LIMIT_INGEST)
def ingest_url(req: IngestUrlRequest, request: Request, user: User = Depends(get_current_user)):
    """Ingest document(s) from URL(s) with multi-tenant isolation and rate limiting."""
    try:
        urls = req.urls if req.urls else ([req.url] if req.url else [])
        if not urls:
            raise HTTPException(status_code=400, detail="Either url or urls must be provided.")
        results = []
        for url in urls:
            res = ingest_and_index(str(user.id), url, title=url)
            results.append({
                "document_id": res.document_id,
                "source": res.source,
                "raw_count": res.raw_count,
                "chunk_count": res.chunk_count,
            })
        if req.urls:
            return {"results": results}
        else:
            return results[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


MAX_BULK_UPLOAD_FILES = 5


async def _save_upload_file(upload_file: UploadFile, destination: str) -> None:
    chunk_size = 1024 * 1024
    with open(destination, "wb") as out_file:
        while True:
            chunk = await upload_file.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)


def _process_ingest_file(user_id: str, saved_path: str, title: str) -> None:
    try:
        ingest_and_index(user_id, saved_path, title=title)
    except Exception as e:
        print(f"Background ingest failed for {title}: {e}")


@app.post("/ingest/file")
@limiter.limit(RATE_LIMIT_INGEST)
async def ingest_file(
    background_tasks: BackgroundTasks,
    request: Request,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
):
    """Ingest one or more documents from file upload with multi-tenant isolation and rate limiting."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")
    if len(files) > MAX_BULK_UPLOAD_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_BULK_UPLOAD_FILES} files per upload request.",
        )

    results = []
    pg = PostgresStore()
    for file in files:
        filename = file.filename or ""
        _, ext = os.path.splitext(filename.lower())
        allowed_extensions = {".pdf", ".txt", ".csv"} | IMAGE_EXTENSIONS
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for {filename}. "
                       f"Supported: PDF, TXT, CSV, or images ({', '.join(sorted(IMAGE_EXTENSIONS))}).",
            )

        os.makedirs("storage/uploads", exist_ok=True)
        saved_path = os.path.join("storage", "uploads", f"{uuid.uuid4().hex}{ext}")

        try:
            await _save_upload_file(file, saved_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file {filename}.") from e
        finally:
            try:
                file.file.close()
            except Exception:
                pass

            try:
                logger.info("Received uploaded file: %s (ext=%s)", filename, ext)

                # Create the document row immediately so the UI gets an ID.
                doc_row = pg.get_or_create_document(
                    user_id=user.id,
                    source=saved_path,
                    title=filename,
                )

                # OCR + multilingual ingestion happens in the background.
                background_tasks.add_task(
                    _process_ingest_file,
                    str(user.id),
                    saved_path,
                    filename,
                )

                logger.info(
                    "Queued background ingestion for %s (document_id=%s)",
                    filename,
                    doc_row.id,
                )

                results.append(
                    {
                        "document_id": str(doc_row.id),
                        "source": filename,
                        "status": "processing",
                    }
                )

            except Exception as e:
                logger.error("Ingestion failed for %s: %s", filename, e)
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to ingest file {filename}: {str(e)}",
                ) from e

    return {"results": results, "status": "processing"}


@app.get("/documents")
def list_documents(user: User = Depends(get_current_user)):
    """List all documents uploaded by the current user."""
    pg = PostgresStore()
    docs = pg.list_documents(user_id=user.id)
    return {
        "documents": [
            {
                "id": str(d.id),
                "source": d.source,
                "title": d.title or os.path.basename(d.source),
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]
    }


@app.delete("/documents/{document_id}")
def delete_document(document_id: str, user: User = Depends(get_current_user)):
    """Delete a document, its database chunks, and Qdrant vectors."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid document_id") from e

    pg = PostgresStore()
    # Delete from PostgreSQL (cascades to chunks)
    deleted = pg.delete_document(user_id=user.id, document_id=doc_uuid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from Qdrant vector store
    from app.vectorstore.qdrant_store import QdrantStore
    store = QdrantStore()
    store.delete_document(tenant_id=str(user.id), document_id=document_id)

    return {"ok": True}


@app.post("/ask")
@limiter.limit(RATE_LIMIT_ASK)
def ask(req: AskRequest, request: Request, user: User = Depends(get_current_user)):
    """Answer a question about user's documents with multi-tenant isolation and rate limiting."""
    try:
        pg = PostgresStore()

        # Parse document UUIDs
        doc_uuids = []
        if req.document_ids:
            doc_uuids = [uuid.UUID(d) for d in req.document_ids if d]
        elif req.document_id:
            doc_uuids = [uuid.UUID(req.document_id)]

        session_row = None
        if req.session_id:
            try:
                sid = uuid.UUID(req.session_id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail="Invalid session_id") from e
            session_row = pg.get_chat_session(user_id=user.id, session_id=sid)
            if not session_row:
                raise HTTPException(status_code=404, detail="Chat session not found")
            if session_row.mode != "document":
                raise HTTPException(status_code=400, detail="session_id is not a document-mode chat")

        if not session_row:
            session_row = pg.create_chat_session(
                user_id=user.id,
                mode="document",
                document_id=doc_uuids[0] if doc_uuids else None,
                title=req.question[:120],
            )

        prior = pg.list_chat_messages(user_id=user.id, session_id=session_row.id, limit=20)
        chat_history = [{"role": m.role, "content": m.content} for m in prior]

        pg.append_chat_message(
            user_id=user.id,
            session_id=session_row.id,
            role="user",
            content=req.question,
        )

        # Prefer request document_ids; otherwise fall back to session links
        if doc_uuids:
            pg.link_session_documents(session_id=session_row.id, document_ids=doc_uuids)
        else:
            doc_uuids = pg.get_session_document_ids(session_id=session_row.id)

        result = answer_question(
            user_id=str(user.id),
            document_ids=[str(d) for d in doc_uuids],
            question=req.question,
            top_k=req.top_k,
            chat_history=chat_history,
        )

        pg.append_chat_message(
            user_id=user.id,
            session_id=session_row.id,
            role="assistant",
            content=result["answer"],
            sources=result.get("sources", []),
        )

        result["session_id"] = str(session_row.id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/chat/basic")
@limiter.limit(RATE_LIMIT_CHAT)
def chat_basic(req: BasicChatRequest, request: Request, user: User = Depends(get_current_user)):
    """Basic chat without document context, with rate limiting."""
    try:
        pg = PostgresStore()

        session_row = None
        if req.session_id:
            try:
                sid = uuid.UUID(req.session_id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail="Invalid session_id") from e
            session_row = pg.get_chat_session(user_id=user.id, session_id=sid)
            if not session_row:
                raise HTTPException(status_code=404, detail="Chat session not found")
            if session_row.mode != "basic":
                raise HTTPException(status_code=400, detail="session_id is not a basic-mode chat")

        if not session_row:
            session_row = pg.create_chat_session(user_id=user.id, mode="basic", title=req.message[:120])

        prior = pg.list_chat_messages(user_id=user.id, session_id=session_row.id, limit=20)
        chat_history = [{"role": m.role, "content": m.content} for m in prior]

        pg.append_chat_message(
            user_id=user.id,
            session_id=session_row.id,
            role="user",
            content=req.message,
        )

        answer = answer_basic_message(req.message, chat_history=chat_history)

        pg.append_chat_message(
            user_id=user.id,
            session_id=session_row.id,
            role="assistant",
            content=answer,
        )

        return {"answer": answer, "sources": [], "session_id": str(session_row.id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/chat/sessions")
def create_chat_session(req: ChatSessionCreateRequest, user: User = Depends(get_current_user)):
    mode = (req.mode or "").strip().lower()
    if mode not in {"basic", "document"}:
        raise HTTPException(status_code=400, detail="mode must be 'basic' or 'document'")

    doc_uuids: List[uuid.UUID] = []
    if req.document_ids:
        try:
            doc_uuids = [uuid.UUID(d) for d in req.document_ids if d]
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid document_ids") from e
    elif req.document_id:
        try:
            doc_uuids = [uuid.UUID(req.document_id)]
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid document_id") from e

    document_uuid = doc_uuids[0] if doc_uuids else None

    pg = PostgresStore()
    row = pg.create_chat_session(user_id=user.id, mode=mode, document_id=document_uuid)

    if doc_uuids:
        pg.link_session_documents(session_id=row.id, document_ids=doc_uuids)

    return {
        "id": str(row.id),
        "mode": row.mode,
        "document_id": str(row.document_id) if row.document_id else None,
        "document_ids": [str(d) for d in doc_uuids],
        "title": row.title,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@app.get("/chat/sessions")
def list_chat_sessions(mode: Optional[str] = None, document_id: Optional[str] = None, limit: int = 30, user: User = Depends(get_current_user)):
    document_uuid = None
    if document_id:
        try:
            document_uuid = uuid.UUID(document_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid document_id") from e

    pg = PostgresStore()
    rows = pg.list_chat_sessions(user_id=user.id, mode=mode, document_id=document_uuid, limit=limit)
    
    sessions_list = []
    for r in rows:
        linked_docs = pg.get_session_document_ids(session_id=r.id)
        sessions_list.append({
            "id": str(r.id),
            "mode": r.mode,
            "document_id": str(r.document_id) if r.document_id else None,
            "document_ids": [str(d) for d in linked_docs],
            "title": r.title,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })

    return {
        "sessions": sessions_list
    }


@app.get("/chat/history/{session_id}")
def get_chat_history(session_id: str, limit: int = 200, user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid session_id") from e

    pg = PostgresStore()
    session_row = pg.get_chat_session(user_id=user.id, session_id=sid)
    if not session_row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    linked_docs = pg.get_session_document_ids(session_id=sid)
    rows = pg.list_chat_messages(user_id=user.id, session_id=sid, limit=limit)
    return {
        "session": {
            "id": str(session_row.id),
            "mode": session_row.mode,
            "document_id": str(session_row.document_id) if session_row.document_id else None,
            "document_ids": [str(d) for d in linked_docs],
            "title": session_row.title,
            "created_at": session_row.created_at.isoformat() if session_row.created_at else None,
            "updated_at": session_row.updated_at.isoformat() if session_row.updated_at else None,
        },
        "messages": [
            {
                "id": str(r.id),
                "role": r.role,
                "content": r.content,
                "sources": r.sources or [],
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@app.patch("/chat/sessions/{session_id}")
def rename_chat_session(session_id: str, req: ChatSessionUpdateRequest, user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid session_id") from e

    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title cannot be empty")

    pg = PostgresStore()
    row = pg.update_chat_session_title(user_id=user.id, session_id=sid, title=title)
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {
        "id": str(row.id),
        "mode": row.mode,
        "document_id": str(row.document_id) if row.document_id else None,
        "title": row.title,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@app.delete("/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid session_id") from e

    pg = PostgresStore()
    deleted = pg.delete_chat_session(user_id=user.id, session_id=sid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {"ok": True}
