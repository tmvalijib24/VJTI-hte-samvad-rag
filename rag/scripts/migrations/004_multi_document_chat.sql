-- Support multi-document chat sessions.
-- Creates a join table chat_session_documents to link chat sessions with multiple documents.

BEGIN;

CREATE TABLE IF NOT EXISTS chat_session_documents (
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_session_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_session_documents_session ON chat_session_documents(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_documents_document ON chat_session_documents(document_id);

COMMIT;
