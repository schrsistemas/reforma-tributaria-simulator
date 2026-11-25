-- Track whether an end-of-effectiveness date was explicitly extracted.
ALTER TABLE rag_documents ADD COLUMN effective_to_source TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';
