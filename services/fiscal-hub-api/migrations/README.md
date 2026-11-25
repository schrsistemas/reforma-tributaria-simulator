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
12. 0012_normative_artifact_capture_backoff.sql
13. 0013_normative_artifact_candidate_reviews.sql
14. 0014_normative_artifact_capture_lifecycle.sql
15. 0015_normative_artifact_capture_reconciliation.sql
14. 0014_normative_artifact_capture_lifecycle.sql

The runtime role must not own these objects and must remain NOSUPERUSER/NOBYPASSRLS. Set its password out-of-band after applying migration 0002.

Migration 0003 closes a tenant-integrity gap in the ERP event relationship, validates stored CNPJ and SHA-256 formats, adds query indexes, and makes audit rows append-only to the runtime role.
Migration 0004 seeds the initial federal and national source registry. It stores source registry entries only; it does not scrape, interpret or approve legal content.
Migration 0005 creates append-only check history for the Node.js source monitor and grants the runtime role SELECT/INSERT while explicitly revoking UPDATE/DELETE.
Migration 0006 creates metadata for captured official artifacts. Binary objects are stored separately in an S3-compatible object store.
Migration 0010 creates the source-linked artifact discovery queue. Migration 0011 hardens the runtime role's candidate-table privileges. Candidates are deduplicated by source and canonical artifact URL, retain their original extension and discovery timestamps, and remain PENDING until human review.
Migration 0012 enables exponential retry backoff from 1 minute up to 24 hours.
Migration 0013 creates append-only review-decision history for approved/rejected artifact candidates.
Migration 0014 introduces the durable artifact-capture lifecycle. Metadata is inserted as PENDING before the object upload; only a confirmed upload transitions it to CAPTURED and sets captured_at. Upload failures become ERROR and remain retryable. Runtime UPDATE is limited to lifecycle columns; storage keys and content hashes remain immutable through the application role.

Always validate migrations against a disposable PostgreSQL database before production. Run pnpm --filter @rts/fiscal-hub-api migrate with MIGRATION_DATABASE_URL set to the dedicated migration-owner connection. The runner refuses to fall back to DATABASE_URL, applies each file transactionally, serializes concurrent runs with an advisory lock and records a SHA-256 checksum. A changed checksum for an applied migration stops execution. Migrations are never run automatically at API startup.

Migration 0015 adds capture_started_at to identify abandoned PENDING uploads. The capture worker checks stale rows with S3 HeadObject before processing new approvals. Matching objects are finalized and linked to their candidate transactionally; missing objects are marked ERROR and the candidate receives exponential retry scheduling. Storage inspection errors and metadata mismatches are left untouched for investigation. No object deletion is performed by reconciliation.
