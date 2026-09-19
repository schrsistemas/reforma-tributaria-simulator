CREATE TABLE IF NOT EXISTS payment_records (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, operation_id TEXT NOT NULL, method TEXT NOT NULL,
 status TEXT NOT NULL, amount_minor INTEGER NOT NULL, fee_minor INTEGER NOT NULL DEFAULT 0,
 net_minor INTEGER NOT NULL, provider TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_records_tenant_operation ON payment_records(tenant_id,operation_id);
CREATE TABLE IF NOT EXISTS legal_documents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, document_type TEXT NOT NULL, version TEXT NOT NULL,
 status TEXT NOT NULL, effective_at TEXT NOT NULL, content_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lgpd_processing_records (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, purpose TEXT NOT NULL, data_category TEXT NOT NULL,
 role TEXT NOT NULL, legal_basis TEXT NOT NULL, retention_days INTEGER NOT NULL, processor TEXT
);
CREATE TABLE IF NOT EXISTS lgpd_consents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, subject_reference TEXT NOT NULL, purpose TEXT NOT NULL,
 version TEXT NOT NULL, granted INTEGER NOT NULL, recorded_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS mei_profiles (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, fictitious_name TEXT NOT NULL, occupation_code TEXT NOT NULL,
 annual_revenue REAL NOT NULL DEFAULT 0, employees INTEGER NOT NULL DEFAULT 0, municipality TEXT NOT NULL, state TEXT NOT NULL
);