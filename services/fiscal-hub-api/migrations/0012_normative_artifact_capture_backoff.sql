BEGIN;

ALTER TABLE fiscal.normative_artifact_candidates
  ADD COLUMN next_capture_attempt_at timestamptz;

COMMENT ON COLUMN fiscal.normative_artifact_candidates.next_capture_attempt_at IS
  'Next eligible retry time; failures use exponential backoff from 1 minute up to 24 hours.';

CREATE INDEX ix_normative_artifact_candidates_capture_retry
  ON fiscal.normative_artifact_candidates(next_capture_attempt_at, reviewed_at)
  WHERE review_status = 'APPROVED' AND capture_id IS NULL;

GRANT UPDATE (next_capture_attempt_at)
  ON fiscal.normative_artifact_candidates
  TO fiscal_hub_app;

COMMIT;
