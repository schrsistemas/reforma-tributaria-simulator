BEGIN;
CREATE TABLE fiscal.normative_artifact_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
  source_page_url text NOT NULL,
  candidate_url text NOT NULL,
  link_text varchar(500) NOT NULL DEFAULT '',
  resource_kind varchar(20) NOT NULL DEFAULT 'UNKNOWN' CHECK (resource_kind IN ('PDF','HTML','XML','JSON','UNKNOWN')),
  review_status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (review_status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES fiscal.users(id),
  review_note varchar(1000),
  capture_id uuid REFERENCES fiscal.normative_artifact_captures(id),
  UNIQUE (source_id, candidate_url),
  CHECK ((review_status = 'PENDING_REVIEW' AND reviewed_at IS NULL AND reviewed_by IS NULL)
      OR (review_status IN ('APPROVED','REJECTED') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX ix_normative_artifact_candidates_review ON fiscal.normative_artifact_candidates(review_status, first_seen_at DESC);
CREATE INDEX ix_normative_artifact_candidates_source ON fiscal.normative_artifact_candidates(source_id, last_seen_at DESC);
GRANT SELECT, INSERT ON fiscal.normative_artifact_candidates TO fiscal_hub_app;
GRANT UPDATE (source_page_url, link_text, resource_kind, last_seen_at, review_status, reviewed_at, reviewed_by, review_note, capture_id)
  ON fiscal.normative_artifact_candidates TO fiscal_hub_app;
COMMIT;
