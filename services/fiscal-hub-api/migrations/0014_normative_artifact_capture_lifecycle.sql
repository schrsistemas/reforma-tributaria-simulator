BEGIN;

-- Keep the existing immutable rows while making the in-flight lifecycle explicit.
ALTER TABLE fiscal.normative_artifact_captures
  DROP CONSTRAINT normative_artifact_captures_capture_status_check;

ALTER TABLE fiscal.normative_artifact_captures
  ADD CONSTRAINT normative_artifact_captures_capture_status_check
  CHECK (capture_status IN ('PENDING','CAPTURED','REJECTED','ERROR'));

ALTER TABLE fiscal.normative_artifact_captures
  ALTER COLUMN captured_at DROP NOT NULL,
  ALTER COLUMN captured_at DROP DEFAULT,
  ADD COLUMN capture_error_code varchar(100);

COMMENT ON COLUMN fiscal.normative_artifact_captures.capture_status IS
  'Durable lifecycle: PENDING before object upload, CAPTURED after confirmed upload, ERROR for retryable failures.';
COMMENT ON COLUMN fiscal.normative_artifact_captures.captured_at IS
  'Timestamp set only after the object upload has completed successfully.';
COMMENT ON COLUMN fiscal.normative_artifact_captures.capture_error_code IS
  'Last storage/finalization error code; cleared when the capture reaches CAPTURED.';

REVOKE UPDATE ON fiscal.normative_artifact_captures FROM fiscal_hub_app;
GRANT UPDATE (capture_status, captured_at, capture_error_code)
  ON fiscal.normative_artifact_captures TO fiscal_hub_app;

COMMIT;
