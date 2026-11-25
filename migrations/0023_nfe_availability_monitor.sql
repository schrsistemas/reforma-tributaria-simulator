-- Immutable snapshots of the official national NF-e availability panel.
CREATE TABLE IF NOT EXISTS nfe_availability_checks (
  id TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_last_checked_at TEXT,
  source_version TEXT,
  status_json TEXT NOT NULL,
  recognized_indicators INTEGER NOT NULL DEFAULT 0,
  unknown_indicators INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nfe_availability_checks_checked_at
  ON nfe_availability_checks(checked_at DESC);
