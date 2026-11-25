BEGIN;

-- An ERP event must belong to the same tenant as its ERP instance.
ALTER TABLE fiscal.erp_instances
  ADD CONSTRAINT uq_erp_instances_tenant_id UNIQUE (tenant_id, id);

ALTER TABLE fiscal.integration_events
  ADD CONSTRAINT fk_integration_events_tenant_erp
  FOREIGN KEY (tenant_id, erp_instance_id)
  REFERENCES fiscal.erp_instances (tenant_id, id);

-- Reject malformed CNPJ values even when data is inserted outside the HTTP API.
ALTER TABLE fiscal.companies
  ADD CONSTRAINT ck_companies_cnpj_digits CHECK (cnpj ~ '^[0-9]{14}$');

-- A captured document version must have a real SHA-256 hexadecimal digest.
ALTER TABLE fiscal.normative_document_versions
  ADD CONSTRAINT ck_normative_version_sha256 CHECK (content_hash ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX uq_normative_document_source_number
  ON fiscal.normative_documents(source_id, document_type, document_number)
  WHERE document_number IS NOT NULL;

CREATE INDEX ix_normative_versions_document_captured
  ON fiscal.normative_document_versions(document_id, captured_at DESC);

CREATE INDEX ix_rule_evidence_rule_version
  ON fiscal.rule_evidence(rule_version_id);

CREATE INDEX ix_rule_impacts_rule_status
  ON fiscal.rule_impacts(rule_version_id, status);

-- Audit rows are append-only for the runtime API role.
REVOKE UPDATE, DELETE ON fiscal.audit_events FROM fiscal_hub_app;

COMMIT;
