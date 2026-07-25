import os
import uuid
from datetime import datetime
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


load_dotenv()


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
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

    def get_or_create_document(self, *, user_id: uuid.UUID, source: str, title: Optional[str] = None, content_hash: Optional[str] = None) -> Document:
        with self.session() as s:
            existing = s.execute(
                select(Document).where(
                    (Document.user_id == user_id) & (Document.source == source)
                ).limit(1)
            ).scalar_one_or_none()
            if existing:
                return existing

            doc = Document(user_id=user_id, source=source, title=title, content_hash=content_hash)
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

    def create_user(self, *, email: str, password_hash: str, full_name: Optional[str] = None) -> User:
        with self.session() as s:
            user = User(email=email, password_hash=password_hash, full_name=full_name)
            s.add(user)
            s.commit()
            s.refresh(user)
            return user

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
