BEGIN;

-- A dedicated timestamp makes abandoned uploads distinguishable from active ones.
ALTER TABLE fiscal.normative_artifact_captures
  ADD COLUMN capture_started_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN fiscal.normative_artifact_captures.capture_started_at IS
  'Timestamp when the current PENDING attempt began; used to reconcile interrupted uploads.';

REVOKE UPDATE ON fiscal.normative_artifact_captures FROM fiscal_hub_app;
GRANT UPDATE (capture_status, captured_at, capture_error_code, capture_started_at)
  ON fiscal.normative_artifact_captures TO fiscal_hub_app;

COMMIT;
