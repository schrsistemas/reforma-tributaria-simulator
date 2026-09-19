CREATE TABLE IF NOT EXISTS split_payments (
  payment_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  gross_amount TEXT NOT NULL,
  supplier_net_amount TEXT NOT NULL,
  status TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS split_payment_allocations (
  payment_id TEXT NOT NULL,
  tax TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  PRIMARY KEY(payment_id,tax),
  FOREIGN KEY(payment_id) REFERENCES split_payments(payment_id)
);

CREATE TABLE IF NOT EXISTS split_payment_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_split_payment_event_idem
  ON split_payment_events(tenant_id,idempotency_key,event_type);

CREATE INDEX IF NOT EXISTS idx_split_payment_events_payment
  ON split_payment_events(payment_id,occurred_at);
