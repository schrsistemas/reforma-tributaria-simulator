BEGIN;
CREATE SCHEMA IF NOT EXISTS fiscal;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE fiscal.tenants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL,
 slug varchar(100) NOT NULL UNIQUE,
 status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(254) NOT NULL UNIQUE,
 display_name varchar(160) NOT NULL, password_hash text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.tenant_memberships (
 tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id), user_id uuid NOT NULL REFERENCES fiscal.users(id),
 roles text[] NOT NULL DEFAULT ARRAY['VIEWER']::text[], created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE fiscal.companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id),
 legal_name varchar(200) NOT NULL, trade_name varchar(200), cnpj char(14) NOT NULL,
 state_registration varchar(30), municipal_registration varchar(30), uf char(2) NOT NULL CHECK(uf ~ '^[A-Z]{2}$'),
 city_code varchar(10), tax_regime varchar(40), status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,cnpj), UNIQUE(tenant_id,id)
);
CREATE TABLE fiscal.normative_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(150) NOT NULL,
 authority varchar(150) NOT NULL, source_type varchar(40) NOT NULL, jurisdiction varchar(30) NOT NULL,
 uf char(2), official_url text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.normative_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES fiscal.normative_sources(id),
 document_type varchar(40) NOT NULL, document_number varchar(80), title varchar(500) NOT NULL,
 publication_date date, effective_date date, mandatory_date date, official_url text NOT NULL,
 evidence_status varchar(30) NOT NULL CHECK(evidence_status IN ('OFFICIAL','OFFICIAL_DRAFT','SECONDARY','UNVERIFIED')),
 review_status varchar(30) NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','IN_REVIEW','APPROVED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.normative_document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES fiscal.normative_documents(id),
 version_number integer NOT NULL CHECK(version_number > 0), content_hash char(64) NOT NULL,
 storage_key text NOT NULL, extracted_text_key text, captured_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,version_number), UNIQUE(document_id,content_hash)
);
CREATE TABLE fiscal.tax_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_code varchar(100) NOT NULL UNIQUE,
 tax_type varchar(10) NOT NULL CHECK(tax_type IN ('IBS','CBS','IS')),
 description varchar(500) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.tax_rule_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_id uuid NOT NULL REFERENCES fiscal.tax_rules(id),
 version_number integer NOT NULL CHECK(version_number > 0), tax_regime varchar(40),
 document_model varchar(30), operation_code varchar(80), publication_date date,
 valid_from date, valid_until date, mandatory_from date, parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
 rule_status varchar(30) NOT NULL CHECK(rule_status IN ('HYPOTHESIS','PENDING_REVIEW','APPROVED','PUBLISHED','RETIRED')),
 approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_id,version_number),
 CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE TABLE fiscal.rule_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_version_id uuid NOT NULL REFERENCES fiscal.tax_rule_versions(id),
 document_version_id uuid NOT NULL REFERENCES fiscal.normative_document_versions(id),
 page_reference varchar(100), section_reference varchar(200), excerpt text NOT NULL,
 evidence_type varchar(30) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.rule_impacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_version_id uuid NOT NULL REFERENCES fiscal.tax_rule_versions(id),
 impact_type varchar(30) NOT NULL, affected_component varchar(100), description text NOT NULL,
 status varchar(30) NOT NULL DEFAULT 'PENDING', reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fiscal.erp_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id),
 company_id uuid, instance_name varchar(150) NOT NULL, erp_name varchar(100) NOT NULL,
 erp_version varchar(50), database_engine varchar(30) NOT NULL CHECK(database_engine IN ('FIREBIRD','POSTGRESQL','OTHER')),
 connector_version varchar(50), last_sync_at timestamptz, status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,company_id) REFERENCES fiscal.companies(tenant_id,id)
);
CREATE TABLE fiscal.integration_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id),
 erp_instance_id uuid NOT NULL REFERENCES fiscal.erp_instances(id), event_type varchar(100) NOT NULL,
 external_event_id varchar(150) NOT NULL, payload jsonb NOT NULL,
 processing_status varchar(30) NOT NULL DEFAULT 'PENDING'
 CHECK(processing_status IN ('PENDING','PROCESSING','PROCESSED','FAILED','DEAD_LETTER')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz, UNIQUE(erp_instance_id,external_event_id)
);
CREATE TABLE fiscal.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES fiscal.tenants(id),
 actor_user_id uuid REFERENCES fiscal.users(id), event_type varchar(100) NOT NULL,
 entity_type varchar(100) NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 correlation_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_companies_tenant ON fiscal.companies(tenant_id);
CREATE INDEX ix_normative_documents_publication ON fiscal.normative_documents(publication_date DESC NULLS LAST);
CREATE INDEX ix_rule_versions_period ON fiscal.tax_rule_versions(valid_from,valid_until);
CREATE INDEX ix_rule_versions_parameters ON fiscal.tax_rule_versions USING gin(parameters);
CREATE INDEX ix_erp_instances_tenant ON fiscal.erp_instances(tenant_id);
CREATE INDEX ix_integration_events_pending ON fiscal.integration_events(processing_status,received_at);
CREATE INDEX ix_audit_tenant_date ON fiscal.audit_events(tenant_id,created_at DESC);

DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['companies','erp_instances','integration_events','audit_events'] LOOP
  EXECUTE format('ALTER TABLE fiscal.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE fiscal.%I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format(
   'CREATE POLICY tenant_isolation ON fiscal.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',
   table_name
  );
 END LOOP;
END $$;
COMMIT;
