# Cloudflare deployment

## Authentication and deployment

Production deployment uses GitHub Actions and protected GitHub Environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The repository never contains credential values. Deploy success confirms that the Worker script was accepted by Cloudflare; it does not prove that optional bindings or persistence resources are provisioned.

## Worker secrets

The current GitHub Actions deployment passes only the Cloudflare account ID and API token to Wrangler. It does not provision application authentication secrets. Configure these directly in the target Cloudflare account from `workers/api` before exposing authenticated business routes:

```bash
npx wrangler secret put INTEGRATION_TOKEN
npx wrangler secret put INTEGRATION_TENANT_ID
```

Use a high-entropy token and the exact tenant identifier authorized for that token. These are separate Worker secrets; do not put their values in `wrangler.toml`, source files, GitHub commits, or deployment logs. After configuring them, verify `GET /ready` and confirm the `integrationAuth` and `tenantBinding` dependencies are true. The current implementation supports one tenant per configured token.

## Runtime bindings

The current `workers/api/wrangler.toml` intentionally leaves account-specific resources unbound. Before enabling persisted production operations, provision resources in the intended Cloudflare account and add their real identifiers to the Worker configuration:

| Binding | Required for | Current repository state |
|---|---|---|
| `DB` (D1) | Rule catalog, simulation snapshots, RAG metadata, payment and TEF/Pix records, source registry and scheduled collection | Not bound |
| `EVIDENCE_BUCKET` (R2) | Binary evidence/document archive | Not bound |
| `SIMULATION_WORKFLOW` | Durable asynchronous scenario execution | Workflow script is deployed separately; API binding is commented out |

Apply the SQL migrations in `migrations/` to the target D1 database in ascending order. Confirm the database name, database ID, migration history and backup/restore plan before enabling the binding. Never copy a placeholder ID into production configuration.

R2 and Workflows are optional capabilities, but their absence must remain visible to operators. D1 is required for production paths that persist fiscal state; without it those endpoints return `503 DATABASE_NOT_BOUND`.

## Health and readiness

- `GET /health` is a liveness check. It confirms that the Worker process responds; it does not assert that persistence is available.
- `GET /ready` is a readiness check. It returns HTTP 200 and `status: ready` only when D1, `INTEGRATION_TOKEN` and `INTEGRATION_TENANT_ID` are configured. If any is missing it returns HTTP 503 and `status: degraded`, with the missing dependency and affected capability names.
- `GET /api/v1` exposes the runtime persistence and readiness summary for diagnostics.

A successful GitHub deployment is not equivalent to a ready fiscal API. Production monitoring should check both `/health` and `/ready`.

## Tenant identity and authentication boundary

The API currently supports **one tenant per integration token**. Configure `INTEGRATION_TOKEN` and `INTEGRATION_TENANT_ID` for the same authorized integration. All authenticated routes reject a missing tenant binding with HTTP 503 and reject a mismatched `X-Zynkronyx-Tenant` header with HTTP 403. The tenant header is caller-supplied metadata and is only accepted when it matches the server-side binding. Do not share this token across independent tenants. Multi-tenant credential mapping (per-tenant credentials or signed tokens with verified tenant claims) is a separate future feature, not implemented by this single-tenant binding. Validate cross-tenant denial with integration tests before onboarding multiple tenants.

## Deployment and capacity checklist

1. Confirm D1, R2 and Workflow resources exist in the intended account and region.
2. Apply and verify migrations in order; retain a recoverable backup before schema changes.
3. Bind only provisioned resources using their actual Cloudflare IDs/names.
4. Configure the official Simple Nacional endpoints as HTTPS Worker variables/secrets only after verifying the authoritative deployment URLs.
5. Validate `/health`, `/ready`, authenticated tenant isolation and idempotent replay.
6. Measure p50/p95/p99 latency, D1 query duration, Worker CPU, request volume, error rates, 429/5xx, scheduled collection duration and Workflow backlog.
7. Load-test only isolated test resources. Do not infer user/device capacity from a successful build or a single smoke test.

## Current operational status

The CI deploy workflow can publish the API and Workflow scripts while the D1/R2 bindings remain absent. In that state:
- liveness can be healthy;
- readiness is degraded;
- database-backed features are unavailable;
- binary evidence archival is unavailable;
- durable scenario execution is unavailable unless the API Workflow binding is configured.

Do not describe the API as fully production-ready until required bindings, migrations, authentication, tenant isolation and representative load tests have been verified.
