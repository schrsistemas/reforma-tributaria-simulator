CREATE TABLE IF NOT EXISTS government_authorities (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'BR',
  jurisdiction_level TEXT NOT NULL CHECK (jurisdiction_level IN ('FEDERAL','STATE','MUNICIPAL')),
  state_code TEXT,
  municipality_code TEXT,
  name TEXT NOT NULL,
  authority_type TEXT NOT NULL,
  official_domain TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_government_authorities_scope ON government_authorities(country_code,jurisdiction_level,state_code,municipality_code);

CREATE TABLE IF NOT EXISTS government_sources (
  id TEXT PRIMARY KEY,
  authority_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  document_types TEXT NOT NULL,
  collector_type TEXT NOT NULL,
  official_url TEXT NOT NULL UNIQUE,
  discovery_url TEXT,
  api_url TEXT,
  rss_url TEXT,
  collection_method TEXT NOT NULL,
  cadence TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  enabled INTEGER NOT NULL DEFAULT 1,
  health_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_checked_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(authority_id) REFERENCES government_authorities(id)
);
CREATE INDEX IF NOT EXISTS idx_government_sources_authority ON government_sources(authority_id,enabled,priority DESC);

CREATE TABLE IF NOT EXISTS regulatory_documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  authority_id TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL,
  state_code TEXT,
  municipality_code TEXT,
  document_type TEXT NOT NULL,
  official_identifier TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  publication_date TEXT,
  effective_date TEXT,
  expiration_date TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  official_url TEXT NOT NULL,
  content_location TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  normalized_hash TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  supersedes_document_id TEXT,
  amends_document_id TEXT,
  revokes_document_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES government_sources(id),
  FOREIGN KEY(authority_id) REFERENCES government_authorities(id)
);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_scope ON regulatory_documents(jurisdiction_level,state_code,municipality_code,publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_identifier ON regulatory_documents(official_identifier);
CREATE UNIQUE INDEX IF NOT EXISTS uq_regulatory_documents_source_hash ON regulatory_documents(source_id,normalized_hash);

CREATE TABLE IF NOT EXISTS regulatory_relationships (
  id TEXT PRIMARY KEY,
  from_document_id TEXT NOT NULL,
  to_document_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'HIGH',
  evidence TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(from_document_id) REFERENCES regulatory_documents(id),
  FOREIGN KEY(to_document_id) REFERENCES regulatory_documents(id)
);
CREATE INDEX IF NOT EXISTS idx_regulatory_relationships_from ON regulatory_relationships(from_document_id,relationship_type);
CREATE INDEX IF NOT EXISTS idx_regulatory_relationships_to ON regulatory_relationships(to_document_id,relationship_type);

CREATE TABLE IF NOT EXISTS collector_health (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  latency_ms INTEGER,
  content_hash TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES government_sources(id)
);
CREATE INDEX IF NOT EXISTS idx_collector_health_source ON collector_health(source_id,checked_at DESC);
