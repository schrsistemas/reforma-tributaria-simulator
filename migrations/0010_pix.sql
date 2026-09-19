-- Pix is a fully simulated payment rail. No real Pix transaction is created.
CREATE TABLE IF NOT EXISTS pix_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED','QR_READY','PENDING','PAID','EXPIRED','CANCELLED','REFUNDED')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  txid TEXT NOT NULL UNIQUE,
  qr_code_text TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  end_to_end_id TEXT,
  fiscal_snapshot_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pix_tenant_operation ON pix_transactions(tenant_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_pix_status ON pix_transactions(status);
CREATE TABLE IF NOT EXISTS pix_events (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(transaction_id) REFERENCES pix_transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_pix_events_transaction ON pix_events(transaction_id, occurred_at);
