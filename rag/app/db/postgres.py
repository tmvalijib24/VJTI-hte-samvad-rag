import os
import uuid
from datetime import date, datetime
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv
from sqlalchemy import Boolean, Date, JSON, DateTime, ForeignKey, Integer, String, Text, create_engine, select, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


load_dotenv()

USER_ROLES = {"system_admin", "legal_reviewer", "desk_officer"}
DOCUMENT_STATUSES = {"pending_review", "approved", "rejected"}


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending_review", index=True)
    department: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    chunks: Mapped[List["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    document: Mapped[Document] = relationship(back_populates="chunks")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="desk_officer", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    messages: Mapped[List["ChatMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class ChatSessionDocument(Base):
    __tablename__ = "chat_session_documents"

    chat_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), primary_key=True)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    target_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    detail: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


def _get_database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("DATABASE_URL (or SUPABASE_DB_URL) is not set")
    return url


def get_engine():
    return create_engine(_get_database_url(), pool_pre_ping=True)


SessionLocal = sessionmaker(bind=get_engine(), class_=Session, autoflush=False, autocommit=False)

_db_init_lock = Lock()
_db_initialized = False


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    _ensure_schema(engine)


def _ensure_schema(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'desk_officer'"))
        conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("UPDATE users SET role = 'desk_officer' WHERE role IS NULL OR role NOT IN ('system_admin', 'legal_reviewer', 'desk_officer')"))
        conn.execute(text("DO $$ BEGIN IF EXISTS (SELECT 1 FROM users) AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'system_admin') THEN UPDATE users SET role = 'system_admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1); END IF; END $$;"))

        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS status VARCHAR(20)"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS department VARCHAR"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS document_number VARCHAR"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS document_date DATE"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS category VARCHAR"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS language VARCHAR"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS reviewed_by UUID"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS review_notes TEXT"))
        conn.execute(text("UPDATE documents SET status = 'approved' WHERE status IS NULL OR status NOT IN ('pending_review', 'approved', 'rejected')"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ALTER COLUMN status SET DEFAULT 'pending_review'"))
        conn.execute(text("ALTER TABLE IF EXISTS documents ALTER COLUMN status SET NOT NULL"))

        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY, actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL, target_type VARCHAR(80) NULL, target_id VARCHAR(80) NULL, detail JSON NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)"))


def _ensure_db_initialized() -> None:
    global _db_initialized
    if _db_initialized:
        return
    with _db_init_lock:
        if _db_initialized:
            return
        init_db()
        _db_initialized = True


class PostgresStore:
    def __init__(self):
        _ensure_db_initialized()

    def session(self) -> Session:
        return SessionLocal()

    def get_or_create_document(self, *, user_id: uuid.UUID, source: str, title: Optional[str] = None, content_hash: Optional[str] = None, status: str = "pending_review") -> Document:
        with self.session() as s:
            existing = s.execute(
                select(Document).where(
                    (Document.user_id == user_id) & (Document.source == source)
                ).limit(1)
            ).scalar_one_or_none()
            if existing:
                if existing.status not in DOCUMENT_STATUSES:
                    existing.status = "pending_review"
                    s.commit()
                return existing

            doc = Document(user_id=user_id, source=source, title=title, content_hash=content_hash, status=status if status in DOCUMENT_STATUSES else "pending_review")
            s.add(doc)
            s.commit()
            s.refresh(doc)
            return doc

    def replace_chunks(self, *, user_id: uuid.UUID, document_id: uuid.UUID, chunks: List[Dict[str, Any]]) -> List[Chunk]:
        with self.session() as s:
            s.query(Chunk).filter(
                (Chunk.user_id == user_id) & (Chunk.document_id == document_id)
            ).delete()
            rows: List[Chunk] = []
            for c in chunks:
                row = Chunk(
                    user_id=user_id,
                    document_id=document_id,
                    chunk_index=int(c["chunk_index"]),
                    page_number=c.get("page_number"),
                    text=c["text"],
                    meta=c.get("metadata", {}),
                )
                s.add(row)
                rows.append(row)
            s.commit()
            for r in rows:
                s.refresh(r)
            return rows

    def fetch_chunks_by_ids(self, user_id: uuid.UUID, chunk_ids: Iterable[str]) -> List[Chunk]:
        ids = [uuid.UUID(x) for x in chunk_ids]
        if not ids:
            return []
        with self.session() as s:
            return list(s.execute(
                select(Chunk).where(
                    (Chunk.user_id == user_id) & (Chunk.id.in_(ids))
                )
            ).scalars().all())

    def fetch_all_chunk_texts(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> List[str]:
        with self.session() as s:
            rows = s.execute(
                select(Chunk.text).where(
                    (Chunk.user_id == user_id) & (Chunk.document_id == document_id)
                ).order_by(Chunk.chunk_index.asc())
            ).all()
            return [r[0] for r in rows]

    def fetch_all_chunks(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> List[Chunk]:
        with self.session() as s:
            return list(
                s.execute(
                    select(Chunk).where(
                        (Chunk.user_id == user_id) & (Chunk.document_id == document_id)
                    ).order_by(Chunk.chunk_index.asc())
                )
                .scalars()
                .all()
            )

    def get_user_by_email(self, email: str) -> Optional[User]:
        with self.session() as s:
            return s.execute(select(User).where(User.email == email).limit(1)).scalar_one_or_none()

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        with self.session() as s:
            try:
                uid = uuid.UUID(user_id)
            except ValueError:
                return None
            return s.execute(select(User).where(User.id == uid).limit(1)).scalar_one_or_none()

    def create_user(self, *, email: str, password_hash: str, full_name: Optional[str] = None, role: str = "desk_officer", is_active: bool = True) -> User:
        with self.session() as s:
            if role not in USER_ROLES:
                role = "desk_officer"
            if role == "desk_officer":
                has_users = s.execute(select(User.id).limit(1)).first() is not None
                if not has_users:
                    role = "system_admin"
            user = User(email=email, password_hash=password_hash, full_name=full_name, role=role, is_active=is_active)
            s.add(user)
            s.commit()
            s.refresh(user)
            return user

    def list_users(self, *, limit: int = 100) -> List[User]:
        with self.session() as s:
            return list(s.execute(select(User).order_by(User.created_at.asc()).limit(max(1, min(500, int(limit))))).scalars().all())

    def update_user(self, *, user_id: uuid.UUID, role: Optional[str] = None, is_active: Optional[bool] = None, full_name: Optional[str] = None) -> Optional[User]:
        with self.session() as s:
            row = s.execute(select(User).where(User.id == user_id).limit(1)).scalar_one_or_none()
            if not row:
                return None
            if role is not None and role in USER_ROLES:
                row.role = role
            if is_active is not None:
                row.is_active = bool(is_active)
            if full_name is not None:
                row.full_name = full_name
            s.commit()
            s.refresh(row)
            return row

    def create_audit_log(self, *, action: str, actor_user_id: Optional[uuid.UUID] = None, target_type: Optional[str] = None, target_id: Optional[str] = None, detail: Optional[Dict[str, Any]] = None) -> AuditLog:
        with self.session() as s:
            row = AuditLog(actor_user_id=actor_user_id, action=action, target_type=target_type, target_id=target_id, detail=detail)
            s.add(row)
            s.commit()
            s.refresh(row)
            return row

    def list_audit_logs(self, *, limit: int = 100) -> List[AuditLog]:
        with self.session() as s:
            return list(s.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(max(1, min(500, int(limit))))).scalars().all())

    def get_document(self, *, document_id: uuid.UUID) -> Optional[Document]:
        with self.session() as s:
            return s.execute(select(Document).where(Document.id == document_id).limit(1)).scalar_one_or_none()

    def update_document_metadata(self, *, document_id: uuid.UUID, title: Optional[str] = None, department: Optional[str] = None, document_number: Optional[str] = None, document_date: Optional[date] = None, category: Optional[str] = None, language: Optional[str] = None) -> Optional[Document]:
        with self.session() as s:
            doc = s.execute(select(Document).where(Document.id == document_id).limit(1)).scalar_one_or_none()
            if not doc:
                return None
            if title is not None:
                doc.title = title
            if department is not None:
                doc.department = department
            if document_number is not None:
                doc.document_number = document_number
            if document_date is not None:
                doc.document_date = document_date
            if category is not None:
                doc.category = category
            if language is not None:
                doc.language = language
            s.commit()
            s.refresh(doc)
            return doc

    def set_document_review_state(self, *, document_id: uuid.UUID, status: str, reviewed_by: Optional[uuid.UUID] = None, review_notes: Optional[str] = None) -> Optional[Document]:
        if status not in DOCUMENT_STATUSES:
            raise ValueError("Invalid document status")
        with self.session() as s:
            doc = s.execute(select(Document).where(Document.id == document_id).limit(1)).scalar_one_or_none()
            if not doc:
                return None
            doc.status = status
            doc.reviewed_by = reviewed_by
            doc.reviewed_at = datetime.utcnow()
            doc.review_notes = review_notes
            s.commit()
            s.refresh(doc)
            return doc

    def create_chat_session(
        self,
        *,
        user_id: uuid.UUID,
        mode: str,
        document_id: Optional[uuid.UUID] = None,
        title: Optional[str] = None,
    ) -> ChatSession:
        with self.session() as s:
            row = ChatSession(user_id=user_id, mode=mode, document_id=document_id, title=title)
            s.add(row)
            s.commit()
            s.refresh(row)
            return row

    def get_chat_session(self, *, user_id: uuid.UUID, session_id: uuid.UUID) -> Optional[ChatSession]:
        with self.session() as s:
            return s.execute(
                select(ChatSession).where(
                    (ChatSession.user_id == user_id) & (ChatSession.id == session_id)
                ).limit(1)
            ).scalar_one_or_none()

    def list_chat_sessions(
        self,
        *,
        user_id: uuid.UUID,
        mode: Optional[str] = None,
        document_id: Optional[uuid.UUID] = None,
        limit: int = 30,
    ) -> List[ChatSession]:
        with self.session() as s:
            stmt = select(ChatSession).where(ChatSession.user_id == user_id)
            if mode:
                stmt = stmt.where(ChatSession.mode == mode)
            if document_id is not None:
                stmt = stmt.where(ChatSession.document_id == document_id)
            stmt = stmt.order_by(ChatSession.updated_at.desc()).limit(max(1, min(100, int(limit))))
            return list(s.execute(stmt).scalars().all())

    def list_chat_messages(self, *, user_id: uuid.UUID, session_id: uuid.UUID, limit: int = 200) -> List[ChatMessage]:
        with self.session() as s:
            return list(
                s.execute(
                    select(ChatMessage).where(
                        (ChatMessage.user_id == user_id) & (ChatMessage.session_id == session_id)
                    ).order_by(ChatMessage.created_at.asc()).limit(max(1, min(500, int(limit))))
                ).scalars().all()
            )

    def append_chat_message(
        self,
        *,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> ChatMessage:
        with self.session() as s:
            session_row = s.execute(
                select(ChatSession).where(
                    (ChatSession.user_id == user_id) & (ChatSession.id == session_id)
                ).limit(1)
            ).scalar_one_or_none()
            if not session_row:
                raise RuntimeError("Chat session not found")

            row = ChatMessage(
                session_id=session_id,
                user_id=user_id,
                role=role,
                content=content,
                sources=sources,
            )
            s.add(row)
            session_row.updated_at = datetime.utcnow()
            s.commit()
            s.refresh(row)
            return row

    def update_chat_session_title(
        self,
        *,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        title: str,
    ) -> Optional[ChatSession]:
        with self.session() as s:
            session_row = s.execute(
                select(ChatSession).where(
                    (ChatSession.user_id == user_id) & (ChatSession.id == session_id)
                ).limit(1)
            ).scalar_one_or_none()
            if not session_row:
                return None

            session_row.title = title
            session_row.updated_at = datetime.utcnow()
            s.commit()
            s.refresh(session_row)
            return session_row

    def delete_chat_session(self, *, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
        with self.session() as s:
            session_row = s.execute(
                select(ChatSession).where(
                    (ChatSession.user_id == user_id) & (ChatSession.id == session_id)
                ).limit(1)
            ).scalar_one_or_none()
            if not session_row:
                return False

            s.delete(session_row)
            s.commit()
            return True

    def list_documents(self, *, user_id: uuid.UUID, role: str = "desk_officer", include_unapproved: bool = False, scope_all: bool = False) -> List[Document]:
        with self.session() as s:
            stmt = select(Document)
            if not scope_all:
                stmt = stmt.where(Document.user_id == user_id)
            if not include_unapproved:
                stmt = stmt.where(Document.status == "approved")
            stmt = stmt.order_by(Document.created_at.desc())
            return list(s.execute(stmt).scalars().all())

    def get_documents_by_ids(self, *, user_id: uuid.UUID, document_ids: List[uuid.UUID], role: str = "desk_officer", include_unapproved: bool = False, scope_all: bool = False) -> List[Document]:
        if not document_ids:
            return []
        with self.session() as s:
            stmt = select(Document).where(Document.id.in_(document_ids))
            if not scope_all:
                stmt = stmt.where(Document.user_id == user_id)
            if not include_unapproved:
                stmt = stmt.where(Document.status == "approved")
            return list(s.execute(stmt).scalars().all())

    def delete_document(self, *, user_id: uuid.UUID, document_id: uuid.UUID, scope_all: bool = False) -> bool:
        with self.session() as s:
            stmt = select(Document).where(Document.id == document_id)
            if not scope_all:
                stmt = stmt.where(Document.user_id == user_id)
            doc = s.execute(stmt.limit(1)).scalar_one_or_none()
            if not doc:
                return False
            s.delete(doc)
            s.commit()
            return True

    def fetch_chunks_by_document_ids(self, *, user_id: uuid.UUID, document_ids: List[uuid.UUID], scope_all: bool = False) -> List[Chunk]:
        if not document_ids:
            return []
        with self.session() as s:
            return list(
                s.execute(
                    select(Chunk)
                    .where(Chunk.document_id.in_(document_ids))
                    .where(True if scope_all else (Chunk.user_id == user_id))
                    .order_by(Chunk.document_id.asc(), Chunk.chunk_index.asc())
                )
                .scalars()
                .all()
            )

    def link_session_documents(self, *, session_id: uuid.UUID, document_ids: List[uuid.UUID]) -> None:
        with self.session() as s:
            s.query(ChatSessionDocument).filter(ChatSessionDocument.chat_session_id == session_id).delete()
            for doc_id in document_ids:
                link = ChatSessionDocument(chat_session_id=session_id, document_id=doc_id)
                s.add(link)
            s.commit()

    def get_session_document_ids(self, *, session_id: uuid.UUID) -> List[uuid.UUID]:
        with self.session() as s:
            rows = s.execute(
                select(ChatSessionDocument.document_id).where(ChatSessionDocument.chat_session_id == session_id)
            ).all()
            return [r[0] for r in rows]
