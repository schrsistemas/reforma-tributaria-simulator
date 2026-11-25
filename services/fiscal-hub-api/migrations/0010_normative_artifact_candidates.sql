BEGIN;

CREATE TABLE fiscal.normative_artifact_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
  artifact_url text NOT NULL,
  link_text varchar(300) NOT NULL DEFAULT '',
  file_extension varchar(8) NOT NULL
    CHECK (file_extension IN ('pdf','xsd','xml','json')),
  review_status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING','APPROVED','REJECTED','CAPTURED')),
  first_discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, artifact_url),
  CHECK (artifact_url ~ '^https://')
);

CREATE INDEX ix_normative_artifact_candidates_review
  ON fiscal.normative_artifact_candidates(review_status, first_discovered_at DESC);

CREATE INDEX ix_normative_artifact_candidates_source
  ON fiscal.normative_artifact_candidates(source_id, first_discovered_at DESC);

GRANT SELECT, INSERT ON fiscal.normative_artifact_candidates TO fiscal_hub_app;
REVOKE UPDATE, DELETE ON fiscal.normative_artifact_candidates FROM fiscal_hub_app;

COMMIT;
