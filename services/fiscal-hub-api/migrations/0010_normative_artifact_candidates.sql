BEGIN;

CREATE TABLE fiscal.normative_artifact_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
  source_page_url text NOT NULL,
  artifact_url text NOT NULL,
  link_text varchar(300) NOT NULL DEFAULT '',
  file_extension varchar(8) NOT NULL CHECK (file_extension IN ('pdf','xsd','xml','json')),
  review_status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING','APPROVED','REJECTED','CAPTURED')),
  first_discovered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES fiscal.users(id),
  review_note varchar(1000),
  capture_id uuid REFERENCES fiscal.normative_artifact_captures(id),
  capture_attempts integer NOT NULL DEFAULT 0 CHECK (capture_attempts >= 0),
  last_capture_attempt_at timestamptz,
  last_capture_error varchar(100),
  UNIQUE(source_id, artifact_url),
  CHECK (artifact_url ~ '^https://'),
  CHECK (review_status <> 'CAPTURED' OR capture_id IS NOT NULL),
  CHECK (
    (review_status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR
    (review_status IN ('APPROVED','REJECTED','CAPTURED') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE INDEX ix_normative_artifact_candidates_review
  ON fiscal.normative_artifact_candidates(review_status, first_discovered_at DESC);
CREATE INDEX ix_normative_artifact_candidates_source
  ON fiscal.normative_artifact_candidates(source_id, last_seen_at DESC);

GRANT SELECT, INSERT ON fiscal.normative_artifact_candidates TO fiscal_hub_app;
GRANT UPDATE (source_page_url, link_text, file_extension, last_seen_at,
              review_status, reviewed_at, reviewed_by, review_note, capture_id,
              capture_attempts, last_capture_attempt_at, last_capture_error)
  ON fiscal.normative_artifact_candidates TO fiscal_hub_app;

COMMIT;
