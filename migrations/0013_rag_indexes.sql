CREATE INDEX IF NOT EXISTS idx_rag_documents_hash ON rag_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_documents_published ON rag_documents(published_at);
CREATE INDEX IF NOT EXISTS idx_rag_queries_tenant ON rag_queries(tenant_id,created_at);