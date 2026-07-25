-- Multi-tenancy migration for existing databases.
-- Adds user_id to documents/chunks, backfills existing rows, then enforces FK + NOT NULL.

BEGIN;

-- Ensure at least one user exists for backfill.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users LIMIT 1) THEN
    RAISE EXCEPTION 'users table has no rows; create at least one user before running this migration';
  END IF;
END $$;

-- 1) Add columns as nullable first (safe for existing rows)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Backfill existing rows to first user (or your chosen tenant strategy)
UPDATE documents
SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

UPDATE chunks c
SET user_id = d.user_id
FROM documents d
WHERE c.document_id = d.id
  AND c.user_id IS NULL;

-- 3) Enforce constraints after backfill
ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE chunks ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_user_id_fkey,
  ADD CONSTRAINT documents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chunks
  DROP CONSTRAINT IF EXISTS chunks_user_id_fkey,
  ADD CONSTRAINT chunks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4) Add indexes for tenant-filtered query performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user_document ON chunks(user_id, document_id);

COMMIT;
