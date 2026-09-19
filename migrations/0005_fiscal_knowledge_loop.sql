CREATE TABLE IF NOT EXISTS fiscal_sources (
  id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  official_url TEXT NOT NULL UNIQUE,
  collection_method TEXT NOT NULL,
  cadence TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  last_success_at TEXT,
  last_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fiscal_evidence (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  published_at TEXT,
  official_identifier TEXT,
  title TEXT,
  canonical_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  normalized_hash TEXT NOT NULL,
  content_location TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES fiscal_sources(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_evidence_source_hash
  ON fiscal_evidence(source_id,normalized_hash);

CREATE INDEX IF NOT EXISTS idx_fiscal_evidence_source_retrieved
  ON fiscal_evidence(source_id,retrieved_at DESC);

CREATE TABLE IF NOT EXISTS fiscal_changes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  previous_evidence_id TEXT,
  current_evidence_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  change_type TEXT NOT NULL,
  impact_level TEXT NOT NULL,
  diff_location TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES fiscal_sources(id),
  FOREIGN KEY(previous_evidence_id) REFERENCES fiscal_evidence(id),
  FOREIGN KEY(current_evidence_id) REFERENCES fiscal_evidence(id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_changes_status
  ON fiscal_changes(status,impact_level,detected_at DESC);

CREATE TABLE IF NOT EXISTS fiscal_interpretations (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  classification TEXT NOT NULL,
  review_status TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(evidence_id) REFERENCES fiscal_evidence(id)
);

CREATE TABLE IF NOT EXISTS fiscal_rule_candidates (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  rule_set_id TEXT,
  change_reason TEXT NOT NULL,
  impact_level TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  candidate_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(evidence_id) REFERENCES fiscal_evidence(id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_rule_candidates_review
  ON fiscal_rule_candidates(validation_status,impact_level,created_at DESC);

CREATE TABLE IF NOT EXISTS fiscal_publication_events (
  id TEXT PRIMARY KEY,
  rule_set_id TEXT NOT NULL,
  rule_set_version TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL,
  validation_run_id TEXT NOT NULL,
  approval_reference TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiscal_publications_ruleset
  ON fiscal_publication_events(rule_set_id,rule_set_version,published_at DESC);
