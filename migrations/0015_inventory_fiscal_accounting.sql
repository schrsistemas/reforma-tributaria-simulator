CREATE TABLE IF NOT EXISTS inventory_items (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, sku TEXT NOT NULL, barcode TEXT, description TEXT NOT NULL,
 ncm TEXT, unit TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, average_cost_minor INTEGER NOT NULL DEFAULT 0, location TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_sku_tenant ON inventory_items(tenant_id,sku);
CREATE TABLE IF NOT EXISTS stock_movements (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, item_id TEXT NOT NULL, movement_type TEXT NOT NULL,
 quantity REAL NOT NULL, unit_cost_minor INTEGER, document_id TEXT, operation_id TEXT, occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements(item_id,occurred_at);
CREATE TABLE IF NOT EXISTS fiscal_documents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, document_type TEXT NOT NULL, access_key TEXT,
 document_number TEXT, series TEXT, issuer_document TEXT NOT NULL, recipient_document TEXT,
 issued_at TEXT NOT NULL, total_minor INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
 xml_hash TEXT, xml_location TEXT
);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_date ON fiscal_documents(tenant_id,issued_at);
CREATE TABLE IF NOT EXISTS fiscal_files (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, file_kind TEXT NOT NULL, period TEXT NOT NULL,
 file_name TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fiscal_files_tenant_period ON fiscal_files(tenant_id,period);
CREATE TABLE IF NOT EXISTS accounting_entries (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, document_id TEXT, account_debit TEXT NOT NULL,
 account_credit TEXT NOT NULL, amount_minor INTEGER NOT NULL, competence TEXT NOT NULL,
 description TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_tenant_competence ON accounting_entries(tenant_id,competence);