# PostgreSQL migrations

Apply migrations in numeric order with a dedicated migration-owner account:

1. 0001_fiscal_hub_core.sql
2. 0002_runtime_role.sql
3. 0003_integrity_constraints.sql
4. 0004_seed_normative_sources.sql
5. 0005_normative_source_checks.sql
6. 0006_normative_artifact_captures.sql
7. 0007_nfse_specific_normative_sources.sql
8. 0008_normative_source_fingerprints.sql
9. 0009_transport_and_fiscal_document_sources.sql
10. 0010_normative_artifact_candidates.sql
11. 0011_normative_artifact_candidate_privileges.sql

The runtime role must not own these objects and must remain NOSUPERUSER/NOBYPASSRLS. Set its password out-of-band after applying migration 0002.

Migration 0003 closes a tenant-integrity gap in the ERP event relationship, validates stored CNPJ and SHA-256 formats, adds query indexes, and makes audit rows append-only to the runtime role.

Migration 0004 seeds the initial federal and national source registry. It stores source registry entries only; it does not scrape, interpret or approve legal content.

Migration 0005 creates append-only check history for the Node.js source monitor and grants the runtime role SELECT/INSERT while explicitly revoking UPDATE/DELETE.

Migration 0006 creates append-only metadata for captured official artifacts. Binary objects are stored separately in an S3-compatible object store.

Migration 0007 adds specific NFS-e Via documentation, XSD, API-directory and official communication URLs. It also registers FAQ v1.5 as reference guidance, not as a normative act.

Migration 0008 adds versioned content fingerprints to source checks while retaining the raw response SHA-256 as immutable evidence.

Migration 0010 stores allowlisted document-link candidates discovered from official HTML pages. Candidates are `PENDING` until human review. Migration 0011 removes the broad table-level INSERT/UPDATE/DELETE privileges inherited from migration 0002 and grants only the insert/update columns needed by discovery, human review and capture. SELECT remains available; DELETE and unrestricted updates are not granted.

Migration 0009 expands the registry to the SPED official index and the CT-e/CT-e OS, MDF-e, NF-e/NFC-e, GNRE and ANTT CIOT portals. CIOT is registered as an ANTT transport-regulatory source, not as a fiscal document. GNRE is registered as a tax-collection portal. The SPED index also covers related DF-e families such as BP-e, BP-e TM, NFCom, NF3e, DC-e, GTV-e, NFAg, NFGas and DeRE. The migration is idempotent by official URL and updates the existing NF-e portal entry to include NFC-e.

Always validate migrations against a disposable PostgreSQL database before production. Run `pnpm --filter @rts/fiscal-hub-api migrate` with `MIGRATION_DATABASE_URL` set to the migration-owner connection. The runner applies each file transactionally, serializes concurrent runs with a PostgreSQL advisory lock and records a SHA-256 checksum in `fiscal_meta.schema_migrations`. A changed checksum for an applied migration stops execution. Migrations are never run automatically at API startup.

Migration 0010 creates the source-linked artifact discovery queue. Migration 0011 hardens the runtime role's candidate-table privileges. Candidates are deduplicated by source and canonical artifact URL, retain their original extension and discovery timestamps, and remain `PENDING` until human review. OWNER/ADMIN decisions are audited. Rediscovery never resets `APPROVED`, `REJECTED` or `CAPTURED` states. It does not trigger artifact capture or RuleSet publication.

The capture worker selects only `APPROVED` candidates. It records each attempt, leaves failures retryable, links the immutable artifact capture ID and changes status to `CAPTURED` only after the storage and metadata steps succeed. The S3-compatible object store must be provisioned before running it.
