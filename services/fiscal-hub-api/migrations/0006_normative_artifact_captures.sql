BEGIN;

CREATE TABLE fiscal.normative_artifact_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
  source_url text NOT NULL,
  content_type varchar(200) NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length > 0),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  storage_key text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  capture_status varchar(20) NOT NULL DEFAULT 'CAPTURED'
    CHECK (capture_status IN ('CAPTURED','REJECTED','ERROR')),
  UNIQUE(source_id, content_sha256)
);

CREATE INDEX ix_normative_artifact_captures_latest
  ON fiscal.normative_artifact_captures(source_id, captured_at DESC);

GRANT SELECT, INSERT ON fiscal.normative_artifact_captures TO fiscal_hub_app;
REVOKE UPDATE, DELETE ON fiscal.normative_artifact_captures FROM fiscal_hub_app;

COMMIT;
