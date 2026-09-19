CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  calculation_version TEXT,
  ruleset_id TEXT,
  ruleset_version TEXT,
  result_json TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_simulations_tenant_created ON simulations (tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS rule_sets (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_set_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(id,version)
);

CREATE TABLE IF NOT EXISTS tax_rules (
  id TEXT PRIMARY KEY,
  ruleset_id TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  tax TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  rate_percent TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  FOREIGN KEY(ruleset_id,ruleset_version) REFERENCES rule_sets(id,version)
);
CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup ON tax_rules(ruleset_id,ruleset_version,tax,valid_from);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(tenant_id,idempotency_key,operation)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
