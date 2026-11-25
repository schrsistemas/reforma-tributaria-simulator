import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import vercelHandler from "../src/app.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";

const JWT_SECRET = "x".repeat(40);
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "99999999-9999-4999-8999-999999999999";
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

async function tokenFor(app: Awaited<ReturnType<typeof buildApp>>, roles: string[], tenantId = TENANT_ID): Promise<string> {
  return app.jwt.sign({ sub: USER_ID, tenantId, roles });
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

test("normative source check history requires authentication", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/sources/11111111-1111-4111-8111-111111111111/checks"
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("normative source check history validates the source UUID", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/sources/not-a-uuid/checks",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_SOURCE_ID");
  await app.close();
});

test("normative artifact history requires authentication", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/sources/11111111-1111-4111-8111-111111111111/artifacts"
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("normative artifact history validates the source UUID", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/sources/not-a-uuid/artifacts",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_SOURCE_ID");
  await app.close();
});


function candidatePool(): Pool {
  const candidate = {
    id: "44444444-4444-4444-8444-444444444444",
    source_id: "11111111-1111-4111-8111-111111111111",
    artifact_url: "https://www.gov.br/ato.pdf",
    link_text: "Ato normativo",
    file_extension: "pdf",
    review_status: "APPROVED",
    reviewed_by: USER_ID
  };
  const client = {
    query: async (sql: string) => sql.includes("UPDATE fiscal.normative_artifact_candidates")
      ? { rows: [candidate], rowCount: 1 } : { rows: [], rowCount: 0 },
    release: () => undefined
  };
  return {
    query: async (sql: string) => sql.includes("FROM fiscal.normative_artifact_candidates c")
      ? { rows: [candidate], rowCount: 1 } : { rows: [], rowCount: 0 },
    connect: async () => client,
    end: async () => undefined
  } as unknown as Pool;
}

test("artifact candidate queue requires authentication", async () => {
  const app = await buildApp({ pool: fakePool(), jwtSecret: JWT_SECRET });
  const response = await app.inject({ method: "GET", url: "/v1/normative/artifact-candidates" });
  assert.equal(response.statusCode, 401);
  await app.close();
});
test("artifact candidate queue validates status filters", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({ method: "GET", url: "/v1/normative/artifact-candidates?status=INVALID", headers: { authorization: "Bearer " + token } });
  assert.equal(response.statusCode, 400);
  await app.close();
});
test("artifact candidate queue lists candidates to authenticated users", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({ method: "GET", url: "/v1/normative/artifact-candidates?status=PENDING&limit=25", headers: { authorization: "Bearer " + token } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  await app.close();
});
test("artifact candidate review rejects viewer role", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["VIEWER"]);
  const response = await app.inject({ method: "POST", url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/review", headers: { authorization: "Bearer " + token }, payload: { decision: "APPROVE" } });
  assert.equal(response.statusCode, 403);
  await app.close();
});
test("artifact candidate review validates explicit decisions", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET, normativeReviewTenantId: TENANT_ID });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({ method: "POST", url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/review", headers: { authorization: "Bearer " + token }, payload: { decision: "CAPTURE_NOW" } });
  assert.equal(response.statusCode, 400);
  await app.close();
});
test("artifact candidate review audits an administrator decision", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET, normativeReviewTenantId: TENANT_ID });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({ method: "POST", url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/review", headers: { authorization: "Bearer " + token }, payload: { decision: "APPROVE", note: "Documento oficial conferido." } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().item.review_status, "APPROVED");
  await app.close();
});

test("global normative review is disabled when no reviewer tenant is configured", async () => {
  const app = await buildApp({ pool: candidatePool(), jwtSecret: JWT_SECRET });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "POST",
    url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/review",
    headers: { authorization: "Bearer " + token },
    payload: { decision: "APPROVE" }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("tenant administrators outside the designated reviewer tenant cannot change global candidates", async () => {
  const app = await buildApp({
    pool: candidatePool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"], OTHER_TENANT_ID);
  const response = await app.inject({
    method: "POST",
    url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/review",
    headers: { authorization: "Bearer " + token },
    payload: { decision: "APPROVE" }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});


test("Vercel liveness handler works without production configuration", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalJwtSecret = process.env.JWT_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;

  const response = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(body?: string) { this.body = body ?? ""; }
  };

  try {
    await vercelHandler(
      { url: "/health/live" } as IncomingMessage,
      response as unknown as ServerResponse
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      ok: true,
      service: "fiscal-hub-api"
    });
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});

test("Vercel readiness returns 503 while PostgreSQL configuration is absent", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalJwtSecret = process.env.JWT_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;

  const response = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(body?: string) { this.body = body ?? ""; }
  };

  try {
    await vercelHandler(
      { url: "/health/ready" } as IncomingMessage,
      response as unknown as ServerResponse
    );
    assert.equal(response.statusCode, 503);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      database: "unconfigured"
    });
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});


function reviewHistoryPool(): Pool {
  const historyRow = {
    id: "55555555-5555-4555-8555-555555555555",
    candidate_id: "44444444-4444-4444-8444-444444444444",
    actor_user_id: USER_ID,
    previous_status: "PENDING",
    decision: "APPROVED",
    note: "Documento oficial conferido.",
    decided_at: "2026-11-25T14:00:00.000Z"
  };
  const client = {
    query: async (sql: string) => {
      if (sql.includes("FROM fiscal.normative_artifact_candidate_reviews")) {
        return { rows: [historyRow], rowCount: 1 };
      }
      if (sql.includes("UPDATE fiscal.normative_artifact_candidates")) {
        return { rows: [{
          id: historyRow.candidate_id,
          source_id: "11111111-1111-4111-8111-111111111111",
          artifact_url: "https://www.gov.br/ato.pdf",
          link_text: "Ato normativo",
          file_extension: "pdf",
          review_status: "APPROVED",
          reviewed_by: USER_ID
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

test("artifact candidate review history requires authentication", async () => {
  const app = await buildApp({
    pool: reviewHistoryPool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/reviews"
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("artifact candidate review history is restricted to the designated reviewer tenant", async () => {
  const app = await buildApp({
    pool: reviewHistoryPool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"], OTHER_TENANT_ID);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/reviews",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("artifact candidate review history returns immutable decision records", async () => {
  const app = await buildApp({
    pool: reviewHistoryPool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/artifact-candidates/44444444-4444-4444-8444-444444444444/reviews",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].decision, "APPROVED");
  assert.equal(response.json().items[0].previous_status, "PENDING");
  await app.close();
});

test("artifact candidate review history validates candidate UUID", async () => {
  const app = await buildApp({
    pool: reviewHistoryPool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/artifact-candidates/not-a-uuid/reviews",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_CANDIDATE_ID");
  await app.close();
});


test("collector run history requires authentication", async () => {
  const app = await buildApp({
    pool: fakePool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const response = await app.inject({ method: "GET", url: "/v1/normative/collector-runs" });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("collector run history is restricted to the designated reviewer tenant", async () => {
  const app = await buildApp({
    pool: fakePool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"], OTHER_TENANT_ID);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/collector-runs",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("collector run history validates filters and returns operational records", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return {
        rows: [{
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          worker_name: "SOURCE_MONITOR",
          run_status: "SUCCEEDED",
          counters: { checked: 9, changed: 1, errors: 0 }
        }],
        rowCount: 1
      };
    },
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => undefined }),
    end: async () => undefined
  } as unknown as Pool;
  const app = await buildApp({
    pool,
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"]);
  const invalid = await app.inject({
    method: "GET",
    url: "/v1/normative/collector-runs?worker=INVALID",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(invalid.statusCode, 400);

  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/collector-runs?worker=SOURCE_MONITOR&status=SUCCEEDED&limit=10",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items[0].counters.checked, 9);
  assert.deepEqual(calls[0]!.values, ["SOURCE_MONITOR", "SUCCEEDED", 10]);
  await app.close();
});


test("collector diagnostics requires the designated reviewer tenant", async () => {
  const app = await buildApp({
    pool: fakePool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"], OTHER_TENANT_ID);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/diagnostics",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("collector diagnostics aggregates worker, queue and capture health", async () => {
  const diagnosticRow = {
    workers: [
      {
        worker: "SOURCE_MONITOR",
        latestStatus: "SUCCEEDED",
        latestCounters: { checked: 8, changed: 1, errors: 0 },
        consecutiveFailures: 0
      },
      {
        worker: "ARTIFACT_DISCOVERY",
        latestStatus: "FAILED",
        latestCounters: { checked: 6, discovered: 2, errors: 1 },
        consecutiveFailures: 2
      },
      {
        worker: "ARTIFACT_CAPTURE",
        latestStatus: "NEVER_RUN",
        latestCounters: {},
        consecutiveFailures: 0
      }
    ],
    candidates: { pending: 4, approved: 2, rejected: 1, captured: 3 },
    captures: { pending: 1, captured: 3, errors: 1, stalePending: 1 },
    integrity: {
      candidatesWithoutCapturedMetadata: 1,
      capturedMetadataWithoutCandidate: 0
    },
    stale_runs: 1
  };
  const pool = {
    query: async (sql: string) => sql.includes("WITH worker_names")
      ? { rows: [diagnosticRow], rowCount: 1 }
      : { rows: [], rowCount: 0 },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => undefined
    }),
    end: async () => undefined
  } as unknown as Pool;
  const app = await buildApp({
    pool,
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["OWNER"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/diagnostics?staleRunMinutes=45&staleCaptureMinutes=20",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "DEGRADED");
  assert.equal(response.json().staleRuns, 1);
  assert.equal(response.json().workers.length, 3);
  assert.equal(response.json().captures.stalePending, 1);
  assert.equal(response.json().integrity.candidatesWithoutCapturedMetadata, 1);
  assert.equal(response.json().storageObjectVerification, "NOT_CHECKED");
  await app.close();
});

test("collector diagnostics validates threshold bounds", async () => {
  const app = await buildApp({
    pool: fakePool(),
    jwtSecret: JWT_SECRET,
    normativeReviewTenantId: TENANT_ID
  });
  const token = await tokenFor(app, ["ADMIN"]);
  const response = await app.inject({
    method: "GET",
    url: "/v1/normative/diagnostics?staleRunMinutes=0",
    headers: { authorization: "Bearer " + token }
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});
