import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import type { Pool } from "pg";

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

test("liveness endpoint does not require database access", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: "x".repeat(40) });
  const response = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
  await app.close();
});

test("readiness endpoint checks the database", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: "x".repeat(40) });
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().database, "reachable");
  await app.close();
});

test("login validates payload before querying credentials", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: "x".repeat(40) });
  const response = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { tenantSlug: "x", email: "not-an-email", password: "" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "VALIDATION_ERROR");
  await app.close();
});

test("unknown account receives generic authentication error", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: "x".repeat(40) });
  const response = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { tenantSlug: "acme", email: "user@example.com", password: "wrong-password" }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "INVALID_CREDENTIALS");
  await app.close();
});

test("protected identity endpoint rejects missing token", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: "x".repeat(40) });
  const response = await app.inject({ method: "GET", url: "/v1/me" });
  assert.equal(response.statusCode, 401);
  await app.close();
});
