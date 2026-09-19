-- TEF is the simulated payment rail. Fiscal calculation remains owned by the Fiscal Domain.
CREATE TABLE IF NOT EXISTS tef_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SALE','REFUND','CANCELLATION','REVERSAL')),
  status TEXT NOT NULL CHECK (status IN ('INITIATED','AUTHORIZING','AUTHORIZED','CAPTURED','SETTLED','DECLINED','CANCELLED','REVERSED','TIMEOUT','DUPLICATED')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  nsu TEXT,
  authorization_code TEXT,
  external_reference TEXT,
  fiscal_snapshot_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tef_transactions_tenant_operation ON tef_transactions(tenant_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_tef_transactions_operation ON tef_transactions(operation_id);
CREATE INDEX IF NOT EXISTS idx_tef_transactions_status ON tef_transactions(status);
CREATE INDEX IF NOT EXISTS idx_tef_transactions_snapshot ON tef_transactions(fiscal_snapshot_id);

CREATE TABLE IF NOT EXISTS tef_events (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(transaction_id) REFERENCES tef_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_tef_events_transaction ON tef_events(transaction_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_tef_events_correlation ON tef_events(correlation_id);
