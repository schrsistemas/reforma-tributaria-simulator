# Fiscal Hub API

Node.js 22+, TypeScript, Fastify and PostgreSQL.

## Local setup

1. Install workspace dependencies with pnpm.
2. Copy .env.example to .env and set DATABASE_URL and a random JWT_SECRET of at least 32 characters.
3. Apply migrations/0001_fiscal_hub_core.sql and migrations/0002_runtime_role.sql to a disposable PostgreSQL database using a dedicated migration-owner account.
4. Run pnpm --filter @rts/fiscal-hub-api dev.

## Routes

- GET /health/live
- GET /health/ready
- POST /v1/auth/login
- GET /v1/me
- GET /v1/companies
- GET /v1/normative/documents

Login body: tenantSlug, email, password. Access tokens expire after 15 minutes.

## Provisioning

No default tenant, user, or password is created. Provisioning must be done by a controlled administrative procedure. The application DB role must not own tables and must not have BYPASSRLS.

## Tests

pnpm --filter @rts/fiscal-hub-api test
pnpm --filter @rts/fiscal-hub-api typecheck
pnpm --filter @rts/fiscal-hub-api build
