# Fiscal Hub API

Node.js 22+, TypeScript, Fastify and PostgreSQL.

## Local setup

1. Install dependencies with pnpm.
2. Copy .env.example to .env and set DATABASE_URL and a random JWT_SECRET of at least 32 characters.
3. Apply migrations 0001 through 0006 to a disposable PostgreSQL database using a dedicated migration-owner account.
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
- GET /v1/normative/sources/:sourceId/checks
- GET /v1/normative/sources/:sourceId/artifacts
- GET /v1/normative/documents
- GET /v1/normative/documents/:documentId/versions

Company creation validates CNPJ check digits and records an audit event. ERP instance creation validates the database engine, scopes the record to the authenticated tenant, and records an audit event. Foreign-key violations prevent associating a company from another tenant.

The normative source registry is global and read-only through this API version. Migration 0004 inserts the initial official source registry. Document versions expose only identifiers, version numbers, content hashes and capture timestamps; internal storage keys are not returned by the public API.

## Initial administrator

Use the provision:admin script only with a migration-owner connection in a controlled environment. Set DATABASE_URL, BOOTSTRAP_TENANT_NAME, BOOTSTRAP_TENANT_SLUG, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD. Passwords must have at least 12 characters. The script creates one tenant, one user and an OWNER/ADMIN membership in one transaction. It does not print credentials. Do not use the application DB role for provisioning.

## Runtime database role

Apply migrations 0001–0006 as the migration owner. Set the fiscal_hub_app password out-of-band with psql \\password fiscal_hub_app, then use that non-owner, NOSUPERUSER, NOBYPASSRLS role in the API DATABASE_URL. See migrations/README.md.

## Database roles

The migration should be applied by a dedicated migration owner. The runtime application role must be a separate LOGIN role with NOSUPERUSER and NOBYPASSRLS, must not own tables, and must receive only the required schema/table privileges. Tenant-owned queries execute inside withTenant so RLS sees the transaction-local tenant context. Audit rows and source-check history and artifact capture metadata are append-only to the runtime role.

## Tests

- pnpm --filter @rts/fiscal-hub-api test
- pnpm --filter @rts/fiscal-hub-api typecheck
- pnpm --filter @rts/fiscal-hub-api build
