BEGIN;

CREATE TABLE fiscal.normative_artifact_candidate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id),
  candidate_id uuid NOT NULL REFERENCES fiscal.normative_artifact_candidates(id),
  actor_user_id uuid NOT NULL REFERENCES fiscal.users(id),
  previous_status varchar(16) NOT NULL CHECK (previous_status = 'PENDING'),
  decision varchar(16) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  note varchar(1000),
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_normative_candidate_reviews_candidate
  ON fiscal.normative_artifact_candidate_reviews(candidate_id, decided_at DESC);
CREATE INDEX ix_normative_candidate_reviews_tenant
  ON fiscal.normative_artifact_candidate_reviews(tenant_id, decided_at DESC);

ALTER TABLE fiscal.normative_artifact_candidate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal.normative_artifact_candidate_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation
  ON fiscal.normative_artifact_candidate_reviews
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE INSERT, UPDATE, DELETE
  ON fiscal.normative_artifact_candidate_reviews
  FROM fiscal_hub_app;
GRANT SELECT, INSERT
  ON fiscal.normative_artifact_candidate_reviews
  TO fiscal_hub_app;

COMMIT;
