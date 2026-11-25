BEGIN;

CREATE TABLE fiscal.normative_source_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
  check_status varchar(20) NOT NULL
    CHECK (check_status IN ('AVAILABLE','CHANGED','UNAVAILABLE','REJECTED','ERROR')),
  http_status integer,
  content_type varchar(200),
  content_length bigint CHECK (content_length IS NULL OR content_length >= 0),
  etag varchar(500),
  last_modified varchar(200),
  content_sha256 char(64),
  response_ms integer NOT NULL CHECK (response_ms >= 0),
  error_code varchar(80),
  checked_at timestamptz NOT NULL DEFAULT now(),
  CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX ix_normative_source_checks_latest
  ON fiscal.normative_source_checks(source_id, checked_at DESC);

GRANT SELECT, INSERT ON fiscal.normative_source_checks TO fiscal_hub_app;
REVOKE UPDATE, DELETE ON fiscal.normative_source_checks FROM fiscal_hub_app;

COMMIT;
