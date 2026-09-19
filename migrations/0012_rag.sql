CREATE TABLE IF NOT EXISTS rag_documents (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL, title TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 published_at TEXT NOT NULL, effective_from TEXT, effective_to TEXT, source_url TEXT NOT NULL,
 content_hash TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_effective ON rag_documents(effective_from,effective_to);
CREATE TABLE IF NOT EXISTS rag_chunks (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ordinal INTEGER NOT NULL, text TEXT NOT NULL,
 token_count INTEGER NOT NULL, embedding_ref TEXT, metadata_json TEXT NOT NULL,
 FOREIGN KEY(document_id) REFERENCES rag_documents(id)
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id,ordinal);
CREATE TABLE IF NOT EXISTS rag_queries (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, query_text TEXT NOT NULL, as_of TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_answers (
 id TEXT PRIMARY KEY, query_id TEXT NOT NULL, answer_text TEXT NOT NULL, confidence TEXT NOT NULL,
 grounded INTEGER NOT NULL, citations_json TEXT NOT NULL, created_at TEXT NOT NULL,
 FOREIGN KEY(query_id) REFERENCES rag_queries(id)
);