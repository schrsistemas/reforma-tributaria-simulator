import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import type { Pool } from "pg";

const JWT_SECRET = "x".repeat(40);
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function fakePool(rows: unknown[] = []): Pool {
  return {
    query: async () => ({ rows, rowCount: rows.length }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => undefined
    }),
    end: async () => undefined
  } as unknown as Pool;
}

function tenantPool(): Pool {
  const client = {
    query: async (sql: string) => {
      if (sql.includes("INSERT INTO fiscal.companies")) {
        return { rows: [{
          id: "33333333-3333-4333-8333-333333333333",
          legal_name: "Empresa de Teste Ltda",
          cnpj: "11222333000181",
          uf: "SC",
          status: "ACTIVE"
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined
  };
  return {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => client,
    end: async () => undefined
  } as unknown as Pool;
}

async function tokenFor(app: Awaited<ReturnType<typeof buildApp>>, roles: string[]): Promise<string> {
  return app.jwt.sign({ sub: USER_ID, tenantId: TENANT_ID, roles });
}

test("liveness endpoint does not require database access", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
  await app.close();
});

test("readiness endpoint checks the database", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().database, "reachable");
  await app.close();
});

test("login validates payload before querying credentials", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { tenantSlug: "x", email: "not-an-email", password: "" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "VALIDATION_ERROR");
  await app.close();
});

test("unknown account receives generic authentication error", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { tenantSlug: "acme", email: "user@example.com", password: "wrong-password" }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "INVALID_CREDENTIALS");
  await app.close();
});

test("protected identity endpoint rejects missing token", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "GET", url: "/v1/me" });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("company creation requires authentication", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "POST", url: "/v1/companies", payload: {} });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("company creation rejects a viewer role", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({
    method: "POST", url: "/v1/companies",
    headers: { authorization: "Bearer " + token },
    payload: { legalName: "Empresa de Teste Ltda", cnpj: "11222333000181", uf: "SC" }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "FORBIDDEN");
  await app.close();
});

test("company creation validates the CNPJ before database access", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "POST", url: "/v1/companies",
    headers: { authorization: "Bearer " + token },
    payload: { legalName: "Empresa de Teste Ltda", cnpj: "00000000000000", uf: "SC" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "VALIDATION_ERROR");
  await app.close();
});

test("company creation stores the tenant-scoped company and audit event", async () => {
  const app = await buildApp({ pool: tenantPool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["OWNER"]);
  const response = await app.inject({
    method: "POST", url: "/v1/companies",
    headers: { authorization: "Bearer " + token },
    payload: { legalName: "Empresa de Teste Ltda", cnpj: "11.222.333/0001-81", uf: "sc" }
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().item.cnpj, "11222333000181");
  assert.equal(response.json().item.uf, "SC");
  await app.close();
});

test("ERP instance creation rejects invalid database engines", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "POST", url: "/v1/erp-instances",
    headers: { authorization: "Bearer " + token },
    payload: { instanceName: "ERP Principal", erpName: "ERP", databaseEngine: "MYSQL" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "VALIDATION_ERROR");
  await app.close();
});

test("normative source catalog requires authentication", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "GET", url: "/v1/normative/sources" });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("normative version endpoint validates the document UUID", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({
    method: "GET", url: "/v1/normative/documents/not-a-uuid/versions",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_DOCUMENT_ID");
  await app.close();
});
