BEGIN;

ALTER TABLE fiscal.normative_source_checks
  ADD COLUMN normalized_content_sha256 char(64),
  ADD COLUMN fingerprint_version varchar(40) NOT NULL DEFAULT 'raw-v1';

ALTER TABLE fiscal.normative_source_checks
  ADD CONSTRAINT ck_normative_source_checks_normalized_sha256
  CHECK (normalized_content_sha256 IS NULL OR normalized_content_sha256 ~ '^[a-f0-9]{64}$');

COMMENT ON COLUMN fiscal.normative_source_checks.content_sha256 IS
  'SHA-256 of the exact HTTP response body; retained as immutable raw evidence.';
COMMENT ON COLUMN fiscal.normative_source_checks.normalized_content_sha256 IS
  'SHA-256 of the versioned comparison fingerprint; for HTML this excludes scripts, styles, comments and selected volatile attributes.';
COMMENT ON COLUMN fiscal.normative_source_checks.fingerprint_version IS
  'Algorithm identifier used to compute normalized_content_sha256.';

COMMIT;
