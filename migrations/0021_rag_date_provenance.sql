-- Preserve the provenance of dates used by the fiscal RAG index.
-- published_at may fall back to retrieval time when the source exposes no
-- explicit publication date; consumers must inspect the source column.
ALTER TABLE rag_documents ADD COLUMN published_at_source TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';
ALTER TABLE rag_documents ADD COLUMN effective_from_source TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';
