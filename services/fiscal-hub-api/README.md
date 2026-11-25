# Fiscal Hub API

Node.js 22.x, pnpm 10.34.9 through Corepack, TypeScript, Fastify and PostgreSQL. The Vercel project uses `ENABLE_EXPERIMENTAL_COREPACK=1` so the root `packageManager` pin is honored.

## Local setup

1. Install dependencies with pnpm.
2. Copy .env.example to .env and set DATABASE_URL and a random JWT_SECRET of at least 32 characters. Set NORMATIVE_REVIEW_TENANT_ID to the UUID of the dedicated operator tenant allowed to approve/reject candidates in the shared global normative catalog; if unset, review endpoints fail closed with HTTP 403.
3. Set MIGRATION_DATABASE_URL to a dedicated migration-owner connection and run `pnpm --filter @rts/fiscal-hub-api migrate` against a disposable PostgreSQL database first. The runner applies migrations 0001–0016 in numeric order and records checksums in `fiscal_meta.schema_migrations`.
4. Set the fiscal_hub_app password out-of-band and configure DATABASE_URL with that non-owner role.
5. Provision the first tenant and administrator with the controlled provision:admin command.
6. Run pnpm --filter @rts/fiscal-hub-api dev.

## Routes

- GET /health/live
- GET /health/ready
- POST /v1/auth/login
- GET /v1/me
- GET /v1/companies
- POST /v1/companies (OWNER or ADMIN)
- GET /v1/erp-instances
- POST /v1/erp-instances (OWNER or ADMIN)
- GET /v1/normative/sources
- GET /v1/normative/collector-runs (OWNER/ADMIN of NORMATIVE_REVIEW_TENANT_ID)
- GET /v1/normative/diagnostics (OWNER/ADMIN of NORMATIVE_REVIEW_TENANT_ID)
- POST /v1/normative/incidents/evaluate (OWNER/ADMIN of NORMATIVE_REVIEW_TENANT_ID; evaluates and persists the current incident snapshot)
- GET /v1/normative/incidents (OWNER/ADMIN of NORMATIVE_REVIEW_TENANT_ID; filter by OPEN/RESOLVED and WARNING/CRITICAL)
- GET /v1/normative/incidents/:incidentId/events (append-only incident lifecycle history)
- GET /v1/normative/artifact-candidates
- POST /v1/normative/artifact-candidates/:candidateId/review (OWNER or ADMIN of NORMATIVE_REVIEW_TENANT_ID)
- GET /v1/normative/artifact-candidates/:candidateId/reviews (OWNER or ADMIN of NORMATIVE_REVIEW_TENANT_ID)
- GET /v1/normative/sources/:sourceId/candidates
- GET /v1/normative/sources/:sourceId/checks
- GET /v1/normative/sources/:sourceId/artifacts
- GET /v1/normative/documents
- GET /v1/normative/documents/:documentId/versions

Company creation validates CNPJ check digits and records an audit event. ERP instance creation validates the database engine, scopes the record to the authenticated tenant, and records an audit event. Foreign-key violations prevent associating a company from another tenant.

The normative source registry is global and read-only through this API version. Migrations 0004–0009 maintain the official source registry. Migration 0010 creates the artifact candidate review queue. Migration 0013 adds an immutable, tenant-scoped decision history; each decision is persisted in the same transaction as the candidate status change and audit event. Migration 0014 adds the durable PENDING/CAPTURED/ERROR lifecycle for artifact storage and restricts runtime updates to lifecycle columns. Migration 0015 timestamps pending attempts for recovery of interrupted uploads. Migration 0016 adds the global worker execution ledger (status, timestamps, duration and JSON counters); its history endpoint is restricted to the designated normative-review tenant. The migration runner stores immutable version/checksum records in the separate `fiscal_meta` schema; checksum drift aborts rather than silently reapplying modified SQL. Document versions expose only identifiers, version numbers, content hashes and capture timestamps; internal storage keys are not returned by the public API.

## Initial administrator

Use the provision:admin script only with a migration-owner connection in a controlled environment. Set MIGRATION_DATABASE_URL, BOOTSTRAP_TENANT_NAME, BOOTSTRAP_TENANT_SLUG, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD. Passwords must have at least 12 characters. The script creates one tenant, one user and an OWNER/ADMIN membership in one transaction. It does not print credentials. Do not use the application DB role for provisioning.

## Runtime database role

Apply migrations 0001–0016 with `MIGRATION_DATABASE_URL` as the migration owner. Never run the migration command using the restricted runtime role. Set the fiscal_hub_app password out-of-band with psql \\password fiscal_hub_app, then use that non-owner, NOSUPERUSER, NOBYPASSRLS role in the API DATABASE_URL. See migrations/README.md.

## Database roles

The migration should be applied by a dedicated migration owner. The runtime application role must be a separate LOGIN role with NOSUPERUSER and NOBYPASSRLS, must not own tables, and must receive only the required schema/table privileges. Tenant-owned queries execute inside withTenant so RLS sees the transaction-local tenant context. Audit rows and source-check history and artifact capture metadata are append-only to the runtime role.

## Tests

- pnpm --filter @rts/fiscal-hub-api test
- pnpm --filter @rts/fiscal-hub-api typecheck
- pnpm --filter @rts/fiscal-hub-api build

 
## Normative collector diagnostics

`GET /v1/normative/diagnostics` returns a consolidated operational view of the three workers, artifact candidate queue, capture lifecycle and PostgreSQL metadata relationships. Access is limited to OWNER/ADMIN members of `NORMATIVE_REVIEW_TENANT_ID`.

Optional query parameters:
- `staleRunMinutes`: 1–1440, default 30; RUNNING worker executions older than this threshold are counted as stale.
- `staleCaptureMinutes`: 1–1440, default 15; PENDING capture metadata older than this threshold is counted as stale.

The response is `DEGRADED` when a worker has failed or never run, there are consecutive failures, stale runs/captures, capture errors, or candidate/capture metadata inconsistencies. The endpoint explicitly reports `storageObjectVerification: NOT_CHECKED`: it checks PostgreSQL relationships only and does not claim that an S3/R2 object physically exists. Object verification remains the capture reconciliation worker's responsibility through `HeadObject`.


## Collector incidents

The operator can invoke `POST /v1/normative/incidents/evaluate` with optional JSON body
`{"staleRunMinutes":30,"staleCaptureMinutes":15}`. Evaluation is serialized with a PostgreSQL
transaction advisory lock and reconciles the active incident snapshot: identical conditions
reuse the same incident key, recurring observations increment the occurrence counter, cleared
conditions transition to RESOLVED, and a later recurrence reopens the same incident. Every
OPENED, UPDATED, REOPENED and RESOLVED transition is appended to
`fiscal.normative_collector_incident_events`.

Use `GET /v1/normative/incidents?status=OPEN&limit=50` to inspect current incidents and
`GET /v1/normative/incidents/:incidentId/events` for lifecycle history. Both routes and
evaluation are restricted to OWNER/ADMIN of `NORMATIVE_REVIEW_TENANT_ID`. Evaluation is
explicitly triggered; no scheduled evaluator or external notification channel is configured.
