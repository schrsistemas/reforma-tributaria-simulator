BEGIN;

-- Migration 0002 grants broad default DML privileges to the runtime role.
-- Remove table-level INSERT/UPDATE/DELETE before granting only the columns
-- required by discovery, human review and approved-artifact capture.
REVOKE INSERT, UPDATE, DELETE
  ON fiscal.normative_artifact_candidates
  FROM fiscal_hub_app;

GRANT INSERT (source_id, source_page_url, artifact_url, link_text, file_extension)
  ON fiscal.normative_artifact_candidates
  TO fiscal_hub_app;

GRANT UPDATE (
  source_page_url,
  link_text,
  file_extension,
  last_seen_at,
  review_status,
  reviewed_at,
  reviewed_by,
  review_note,
  capture_id,
  capture_attempts,
  last_capture_attempt_at,
  last_capture_error
)
  ON fiscal.normative_artifact_candidates
  TO fiscal_hub_app;

COMMIT;
