from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import shutil
import uuid
from typing import Optional

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
    url: str = Field(..., min_length=8)


class AskRequest(BaseModel):
    document_id: str
    question: str = Field(..., min_length=1)
    top_k: int = Field(10, ge=1, le=20)
    session_id: Optional[str] = None


class BasicChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = None


class ChatSessionCreateRequest(BaseModel):
    mode: str = Field(..., min_length=4)
    document_id: Optional[str] = None


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
    """Ingest a document from URL with multi-tenant isolation and rate limiting."""
    try:
        res = ingest_and_index(str(user.id), req.url)
        return {
            "document_id": res.document_id,
            "source": res.source,
            "raw_count": res.raw_count,
            "chunk_count": res.chunk_count,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/ingest/file")
@limiter.limit(RATE_LIMIT_INGEST)
async def ingest_file(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Ingest a document from file upload with multi-tenant isolation and rate limiting."""
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in {".pdf", ".txt", ".csv"}:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, TXT, or CSV.")

    os.makedirs("storage/uploads", exist_ok=True)
    saved_path = os.path.join("storage", "uploads", f"{uuid.uuid4().hex}{ext}")

    try:
        with open(saved_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.") from e
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    try:
        res = ingest_and_index(str(user.id), saved_path)
        return {
            "document_id": res.document_id,
            "source": res.source,
            "raw_count": res.raw_count,
            "chunk_count": res.chunk_count,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/ask")
@limiter.limit(RATE_LIMIT_ASK)
def ask(req: AskRequest, request: Request, user: User = Depends(get_current_user)):
    """Answer a question about a user's document with multi-tenant isolation and rate limiting."""
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
            if session_row.mode != "document":
                raise HTTPException(status_code=400, detail="session_id is not a document-mode chat")

        doc_uuid = uuid.UUID(req.document_id)
        if session_row and session_row.document_id and session_row.document_id != doc_uuid:
            raise HTTPException(status_code=400, detail="session document_id does not match request document_id")
        if not session_row:
            session_row = pg.create_chat_session(
                user_id=user.id,
                mode="document",
                document_id=doc_uuid,
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

        result = answer_question(
            user_id=str(user.id),
            document_id=req.document_id,
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

    document_uuid = None
    if req.document_id:
        try:
            document_uuid = uuid.UUID(req.document_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid document_id") from e

    pg = PostgresStore()
    row = pg.create_chat_session(user_id=user.id, mode=mode, document_id=document_uuid)
    return {
        "id": str(row.id),
        "mode": row.mode,
        "document_id": str(row.document_id) if row.document_id else None,
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
    return {
        "sessions": [
            {
                "id": str(r.id),
                "mode": r.mode,
                "document_id": str(r.document_id) if r.document_id else None,
                "title": r.title,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
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

    rows = pg.list_chat_messages(user_id=user.id, session_id=sid, limit=limit)
    return {
        "session": {
            "id": str(session_row.id),
            "mode": session_row.mode,
            "document_id": str(session_row.document_id) if session_row.document_id else None,
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
