import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import type { Pool } from "pg";
import { verifyPassword } from "./auth.js";
import { createPool, withTenant } from "./db.js";

const loginSchema = z.object({
  tenantSlug: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(1).max(256)
});

function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, char, index) => total + Number(char) * weights[index]!, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(String(first) + String(second));
}

const companySchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).nullable().optional(),
  cnpj: z.string().transform(value => value.replace(/\D/g, "")).refine(isValidCnpj, "CNPJ inválido"),
  stateRegistration: z.string().trim().max(30).nullable().optional(),
  municipalRegistration: z.string().trim().max(30).nullable().optional(),
  uf: z.string().regex(/^[A-Za-z]{2}$/).transform(value => value.toUpperCase()),
  cityCode: z.string().trim().max(10).nullable().optional(),
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "IMUNE_ISENTA", "OUTRO"]).nullable().optional()
});

const erpSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  instanceName: z.string().trim().min(2).max(150),
  erpName: z.string().trim().min(2).max(100),
  erpVersion: z.string().trim().max(50).nullable().optional(),
  databaseEngine: z.enum(["FIREBIRD", "POSTGRESQL", "OTHER"]),
  connectorVersion: z.string().trim().max(50).nullable().optional()
});
const artifactCandidateListSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CAPTURED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
const artifactCandidateReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional()
});
const collectorRunListSchema = z.object({
  worker: z.enum(["SOURCE_MONITOR", "ARTIFACT_DISCOVERY", "ARTIFACT_CAPTURE"]).optional(),
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
const collectorDiagnosticsSchema = z.object({
  staleRunMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  staleCaptureMinutes: z.coerce.number().int().min(1).max(1440).default(15)
});

type Claims = { sub: string; tenantId: string; roles: string[] };

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<Claims | null> {
  try {
    await request.jwtVerify();
    const claims = request.user as Claims;
    if (!claims.sub || !claims.tenantId || !Array.isArray(claims.roles)) {
      reply.code(401).send({ error: "UNAUTHORIZED" });
      return null;
    }
    return claims;
  } catch {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
}

function canManageTenant(claims: Claims): boolean {
  return claims.roles.includes("OWNER") || claims.roles.includes("ADMIN");
}

export interface BuildAppOptions {
  pool: Pool;
  jwtSecret: string;
  corsOrigin?: string;
  logger?: boolean;
  /** Tenant authorized to review the shared global normative catalog. */
  normativeReviewTenantId?: string;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: false, bodyLimit: 1_048_576, requestTimeout: 15_000 });
  await app.register(helmet);
  await app.register(cors, {
    origin: options.corsOrigin ?? false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-correlation-id"]
  });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(jwt, {
    secret: options.jwtSecret,
    sign: { iss: "fiscal-intelligence-hub", aud: "fiscal-hub-api", expiresIn: "15m" },
    verify: { allowedIss: "fiscal-intelligence-hub", allowedAud: "fiscal-hub-api" }
  });

  app.get("/health/live", async () => ({ ok: true, service: "fiscal-hub-api" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await options.pool.query("SELECT 1");
      return { ok: true, database: "reachable" };
    } catch {
      return reply.code(503).send({ ok: false, database: "unavailable" });
    }
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    const { tenantSlug, email, password } = parsed.data;
    const result = await options.pool.query<{
      user_id: string; tenant_id: string; password_hash: string; roles: string[];
      user_status: string; tenant_status: string;
    }>(
      `SELECT u.id AS user_id, t.id AS tenant_id, u.password_hash,
              m.roles, u.status AS user_status, t.status AS tenant_status
         FROM fiscal.users u
         JOIN fiscal.tenant_memberships m ON m.user_id = u.id
         JOIN fiscal.tenants t ON t.id = m.tenant_id
        WHERE t.slug = $1 AND lower(u.email) = lower($2)
        LIMIT 1`,
      [tenantSlug, email]
    );
    const account = result.rows[0];
    const valid = account ? account.user_status === "ACTIVE" &&
      account.tenant_status === "ACTIVE" && await verifyPassword(password, account.password_hash) : false;
    if (!valid || !account) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

    const accessToken = await reply.jwtSign({ sub: account.user_id, tenantId: account.tenant_id, roles: account.roles });
    await withTenant(options.pool, account.tenant_id, async client => {
      await client.query(
        `INSERT INTO fiscal.audit_events
           (tenant_id, actor_user_id, event_type, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'AUTH_LOGIN', 'USER', $2, jsonb_build_object('method', 'password'))`,
        [account.tenant_id, account.user_id]
      );
      return [];
    });
    return reply.send({ accessToken, tokenType: "Bearer", expiresIn: 900, tenantId: account.tenant_id, roles: account.roles });
  });

  app.get("/v1/me", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    return reply.send({ userId: claims.sub, tenantId: claims.tenantId, roles: claims.roles });
  });

  app.get("/v1/companies", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    try {
      const rows = await withTenant(options.pool, claims.tenantId, async client => {
        const result = await client.query(
          "SELECT id, legal_name, trade_name, cnpj, uf, status, created_at FROM fiscal.companies ORDER BY legal_name LIMIT 200"
        );
        return result.rows;
      });
      return reply.send({ items: rows });
    } catch (error) {
      request.log.error({ err: error }, "company listing failed");
      return reply.code(500).send({ error: "COMPANY_LIST_FAILED" });
    }
  });

  app.post("/v1/companies", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims)) return reply.code(403).send({ error: "FORBIDDEN" });
    const parsed = companySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    const company = parsed.data;
    try {
      const rows = await withTenant(options.pool, claims.tenantId, async client => {
        const inserted = await client.query(
          `INSERT INTO fiscal.companies
             (tenant_id, legal_name, trade_name, cnpj, state_registration, municipal_registration, uf, city_code, tax_regime)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id, legal_name, trade_name, cnpj, uf, city_code, tax_regime, status, created_at`,
          [claims.tenantId, company.legalName, company.tradeName ?? null, company.cnpj,
           company.stateRegistration ?? null, company.municipalRegistration ?? null, company.uf,
           company.cityCode ?? null, company.taxRegime ?? null]
        );
        const created = inserted.rows[0]!;
        await client.query(
          `INSERT INTO fiscal.audit_events
             (tenant_id, actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1,$2,'COMPANY_CREATED','COMPANY',$3,$4::jsonb)`,
          [claims.tenantId, claims.sub, created.id, JSON.stringify({ cnpj: company.cnpj, uf: company.uf })]
        );
        return [created];
      });
      return reply.code(201).send({ item: rows[0] });
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") return reply.code(409).send({ error: "COMPANY_CNPJ_ALREADY_EXISTS" });
      request.log.error({ err: error }, "company creation failed");
      return reply.code(500).send({ error: "COMPANY_CREATE_FAILED" });
    }
  });

  app.get("/v1/erp-instances", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    try {
      const rows = await withTenant(options.pool, claims.tenantId, async client => {
        const result = await client.query(
          `SELECT id, company_id, instance_name, erp_name, erp_version, database_engine,
                  connector_version, last_sync_at, status, created_at
             FROM fiscal.erp_instances ORDER BY instance_name LIMIT 200`
        );
        return result.rows;
      });
      return reply.send({ items: rows });
    } catch (error) {
      request.log.error({ err: error }, "ERP instance listing failed");
      return reply.code(500).send({ error: "ERP_INSTANCE_LIST_FAILED" });
    }
  });

  app.post("/v1/erp-instances", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims)) return reply.code(403).send({ error: "FORBIDDEN" });
    const parsed = erpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    const erp = parsed.data;
    try {
      const rows = await withTenant(options.pool, claims.tenantId, async client => {
        const inserted = await client.query(
          `INSERT INTO fiscal.erp_instances
             (tenant_id, company_id, instance_name, erp_name, erp_version, database_engine, connector_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, company_id, instance_name, erp_name, erp_version, database_engine,
                     connector_version, last_sync_at, status, created_at`,
          [claims.tenantId, erp.companyId ?? null, erp.instanceName, erp.erpName, erp.erpVersion ?? null,
           erp.databaseEngine, erp.connectorVersion ?? null]
        );
        const created = inserted.rows[0]!;
        await client.query(
          `INSERT INTO fiscal.audit_events
             (tenant_id, actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1,$2,'ERP_INSTANCE_CREATED','ERP_INSTANCE',$3,$4::jsonb)`,
          [claims.tenantId, claims.sub, created.id, JSON.stringify({ databaseEngine: erp.databaseEngine, erpName: erp.erpName })]
        );
        return [created];
      });
      return reply.code(201).send({ item: rows[0] });
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23503") return reply.code(400).send({ error: "COMPANY_NOT_FOUND_IN_TENANT" });
      request.log.error({ err: error }, "ERP instance creation failed");
      return reply.code(500).send({ error: "ERP_INSTANCE_CREATE_FAILED" });
    }
  });

  app.get("/v1/normative/sources", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    try {
      const result = await options.pool.query(
        `SELECT id, name, authority, source_type, jurisdiction, uf, official_url, active, created_at
           FROM fiscal.normative_sources
          WHERE active = true
          ORDER BY authority, name LIMIT 200`
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative source listing failed");
      return reply.code(500).send({ error: "NORMATIVE_SOURCE_LIST_FAILED" });
    }
  });



  app.get("/v1/normative/collector-runs", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims) || !options.normativeReviewTenantId ||
        claims.tenantId !== options.normativeReviewTenantId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const parsed = collectorRunListSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    try {
      const result = await options.pool.query(
        `SELECT id, worker_name, run_status, started_at, finished_at,
                duration_ms, counters, failure_code
           FROM fiscal.normative_collector_runs
          WHERE ($1::varchar IS NULL OR worker_name = $1)
            AND ($2::varchar IS NULL OR run_status = $2)
          ORDER BY started_at DESC
          LIMIT $3`,
        [parsed.data.worker ?? null, parsed.data.status ?? null, parsed.data.limit]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative collector run history failed");
      return reply.code(500).send({ error: "NORMATIVE_COLLECTOR_RUNS_LIST_FAILED" });
    }
  });

  app.get("/v1/normative/diagnostics", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims) || !options.normativeReviewTenantId ||
        claims.tenantId !== options.normativeReviewTenantId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const parsed = collectorDiagnosticsSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    try {
      const result = await options.pool.query(
        `WITH worker_names(worker_name) AS (
           VALUES ('SOURCE_MONITOR'), ('ARTIFACT_DISCOVERY'), ('ARTIFACT_CAPTURE')
         ),
         latest_runs AS (
           SELECT DISTINCT ON (worker_name)
                  worker_name, run_status, started_at, finished_at, duration_ms,
                  counters, failure_code
             FROM fiscal.normative_collector_runs
            ORDER BY worker_name, started_at DESC
         ),
         worker_health AS (
           SELECT names.worker_name,
                  latest.run_status AS latest_status,
                  latest.started_at AS latest_started_at,
                  latest.finished_at AS latest_finished_at,
                  latest.duration_ms AS latest_duration_ms,
                  latest.counters AS latest_counters,
                  latest.failure_code AS latest_failure_code,
                  COALESCE((
                    SELECT count(*)::integer
                      FROM fiscal.normative_collector_runs failed
                     WHERE failed.worker_name = names.worker_name
                       AND failed.run_status = 'FAILED'
                       AND failed.started_at > COALESCE((
                         SELECT max(success.started_at)
                           FROM fiscal.normative_collector_runs success
                          WHERE success.worker_name = names.worker_name
                            AND success.run_status = 'SUCCEEDED'
                       ), '-infinity'::timestamptz)
                  ), 0) AS consecutive_failures
             FROM worker_names names
             LEFT JOIN latest_runs latest USING (worker_name)
         ),
         candidate_counts AS (
           SELECT count(*) FILTER (WHERE review_status = 'PENDING')::integer AS pending,
                  count(*) FILTER (WHERE review_status = 'APPROVED')::integer AS approved,
                  count(*) FILTER (WHERE review_status = 'REJECTED')::integer AS rejected,
                  count(*) FILTER (WHERE review_status = 'CAPTURED')::integer AS captured
             FROM fiscal.normative_artifact_candidates
         ),
         capture_counts AS (
           SELECT count(*) FILTER (WHERE capture_status = 'PENDING')::integer AS pending,
                  count(*) FILTER (WHERE capture_status = 'CAPTURED')::integer AS captured,
                  count(*) FILTER (WHERE capture_status = 'ERROR')::integer AS errors,
                  count(*) FILTER (
                    WHERE capture_status = 'PENDING'
                      AND capture_started_at < now() - ($2::integer * interval '1 minute')
                  )::integer AS stale_pending
             FROM fiscal.normative_artifact_captures
         ),
         integrity_counts AS (
           SELECT
             (SELECT count(*)::integer
                FROM fiscal.normative_artifact_candidates candidate
               WHERE candidate.review_status = 'CAPTURED'
                 AND NOT EXISTS (
                   SELECT 1 FROM fiscal.normative_artifact_captures capture
                    WHERE capture.id = candidate.capture_id
                      AND capture.capture_status = 'CAPTURED'
                 )) AS candidates_without_captured_object_metadata,
             (SELECT count(*)::integer
                FROM fiscal.normative_artifact_captures capture
               WHERE capture.capture_status = 'CAPTURED'
                 AND NOT EXISTS (
                   SELECT 1 FROM fiscal.normative_artifact_candidates candidate
                    WHERE candidate.capture_id = capture.id
                      AND candidate.review_status = 'CAPTURED'
                 )) AS captured_metadata_without_candidate
         )
         SELECT
           (SELECT jsonb_agg(jsonb_build_object(
              'worker', worker_name,
              'latestStatus', COALESCE(latest_status, 'NEVER_RUN'),
              'latestStartedAt', latest_started_at,
              'latestFinishedAt', latest_finished_at,
              'latestDurationMs', latest_duration_ms,
              'latestCounters', COALESCE(latest_counters, '{}'::jsonb),
              'latestFailureCode', latest_failure_code,
              'consecutiveFailures', consecutive_failures
            ) ORDER BY worker_name) FROM worker_health) AS workers,
           (SELECT jsonb_build_object(
              'pending', pending, 'approved', approved,
              'rejected', rejected, 'captured', captured
            ) FROM candidate_counts) AS candidates,
           (SELECT jsonb_build_object(
              'pending', pending, 'captured', captured,
              'errors', errors, 'stalePending', stale_pending
            ) FROM capture_counts) AS captures,
           (SELECT jsonb_build_object(
              'candidatesWithoutCapturedMetadata', candidates_without_captured_object_metadata,
              'capturedMetadataWithoutCandidate', captured_metadata_without_candidate
            ) FROM integrity_counts) AS integrity,
           (SELECT count(*)::integer
              FROM fiscal.normative_collector_runs
             WHERE run_status = 'RUNNING'
               AND started_at < now() - ($1::integer * interval '1 minute')) AS stale_runs`,
        [parsed.data.staleRunMinutes, parsed.data.staleCaptureMinutes]
      );
      const diagnostics = result.rows[0] ?? {};
      const workers = (diagnostics.workers ?? []) as Array<{
        latestStatus: string; consecutiveFailures: number;
      }>;
      const candidates = diagnostics.candidates ?? {};
      const captures = diagnostics.captures ?? {};
      const integrity = diagnostics.integrity ?? {};
      const degraded =
        Number(diagnostics.stale_runs ?? 0) > 0 ||
        workers.some(worker => worker.latestStatus === "FAILED" || Number(worker.consecutiveFailures) > 0) ||
        Number(captures.stalePending ?? 0) > 0 ||
        Number(captures.errors ?? 0) > 0 ||
        Number(integrity.candidatesWithoutCapturedMetadata ?? 0) > 0 ||
        Number(integrity.capturedMetadataWithoutCandidate ?? 0) > 0;
      return reply.send({
        status: degraded ? "DEGRADED" : "HEALTHY",
        thresholds: parsed.data,
        staleRuns: Number(diagnostics.stale_runs ?? 0),
        workers,
        candidates,
        captures,
        integrity,
        storageObjectVerification: "NOT_CHECKED"
      });
    } catch (error) {
      request.log.error({ err: error }, "normative collector diagnostics failed");
      return reply.code(500).send({ error: "NORMATIVE_COLLECTOR_DIAGNOSTICS_FAILED" });
    }
  });

  app.get("/v1/normative/artifact-candidates", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    const parsed = artifactCandidateListSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    try {
      const result = await options.pool.query(
        `SELECT c.id, c.source_id, s.name AS source_name, c.source_page_url,
                c.artifact_url, c.link_text, c.file_extension, c.review_status,
                c.first_discovered_at, c.last_seen_at, c.reviewed_at, c.reviewed_by,
                c.review_note, c.capture_id, c.capture_attempts,
                c.last_capture_attempt_at, c.last_capture_error
           FROM fiscal.normative_artifact_candidates c
           JOIN fiscal.normative_sources s ON s.id = c.source_id
          WHERE ($1::varchar IS NULL OR c.review_status = $1)
          ORDER BY c.first_discovered_at DESC
          LIMIT $2`,
        [parsed.data.status ?? null, parsed.data.limit]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative artifact candidate listing failed");
      return reply.code(500).send({ error: "NORMATIVE_ARTIFACT_CANDIDATES_LIST_FAILED" });
    }
  });

  app.post("/v1/normative/artifact-candidates/:candidateId/review", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims) || !options.normativeReviewTenantId ||
        claims.tenantId !== options.normativeReviewTenantId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const params = z.object({ candidateId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_CANDIDATE_ID" });
    const parsed = artifactCandidateReviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR" });
    const decision = parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    try {
      const updated = await withTenant(options.pool, claims.tenantId, async client => {
        const result = await client.query(
          `UPDATE fiscal.normative_artifact_candidates
              SET review_status = $2, reviewed_at = now(), reviewed_by = $3, review_note = $4
            WHERE id = $1 AND review_status = 'PENDING'
            RETURNING id, source_id, artifact_url, link_text, file_extension,
                      review_status, reviewed_at, reviewed_by, review_note`,
          [params.data.candidateId, decision, claims.sub, parsed.data.note ?? null]
        );
        if (result.rows[0]) {
          await client.query(
            `INSERT INTO fiscal.normative_artifact_candidate_reviews
               (tenant_id, candidate_id, actor_user_id, previous_status, decision, note)
             VALUES ($1, $2, $3, 'PENDING', $4, $5)`,
            [claims.tenantId, params.data.candidateId, claims.sub, decision, parsed.data.note ?? null]
          );
          await client.query(
            `INSERT INTO fiscal.audit_events
               (tenant_id, actor_user_id, event_type, entity_type, entity_id, metadata)
             VALUES ($1,$2,'NORMATIVE_ARTIFACT_CANDIDATE_REVIEWED',
                     'NORMATIVE_ARTIFACT_CANDIDATE',$3,$4::jsonb)`,
            [claims.tenantId, claims.sub, params.data.candidateId,
             JSON.stringify({ decision, note: parsed.data.note ?? null })]
          );
        }
        return result.rows;
      });
      if (!updated[0]) {
        const existing = await options.pool.query<{ review_status: string }>(
          "SELECT review_status FROM fiscal.normative_artifact_candidates WHERE id = $1",
          [params.data.candidateId]
        );
        if (!existing.rows[0]) return reply.code(404).send({ error: "ARTIFACT_CANDIDATE_NOT_FOUND" });
        return reply.code(409).send({ error: "ARTIFACT_CANDIDATE_ALREADY_REVIEWED", reviewStatus: existing.rows[0].review_status });
      }
      return reply.send({ item: updated[0] });
    } catch (error) {
      request.log.error({ err: error }, "normative artifact candidate review failed");
      return reply.code(500).send({ error: "NORMATIVE_ARTIFACT_CANDIDATE_REVIEW_FAILED" });
    }
  });


  app.get("/v1/normative/artifact-candidates/:candidateId/reviews", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    if (!canManageTenant(claims) || !options.normativeReviewTenantId ||
        claims.tenantId !== options.normativeReviewTenantId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const params = z.object({ candidateId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_CANDIDATE_ID" });
    try {
      const rows = await withTenant(options.pool, claims.tenantId, async client => {
        const result = await client.query(
          `SELECT id, candidate_id, actor_user_id, previous_status, decision, note, decided_at
             FROM fiscal.normative_artifact_candidate_reviews
            WHERE candidate_id = $1
            ORDER BY decided_at DESC
            LIMIT 50`,
          [params.data.candidateId]
        );
        return result.rows;
      });
      return reply.send({ items: rows });
    } catch (error) {
      request.log.error({ err: error }, "normative artifact candidate review history failed");
      return reply.code(500).send({ error: "NORMATIVE_ARTIFACT_CANDIDATE_REVIEW_HISTORY_FAILED" });
    }
  });

  app.get("/v1/normative/sources/:sourceId/candidates", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    const params = z.object({ sourceId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_SOURCE_ID" });
    const query = z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CAPTURED"]).optional()
    }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "INVALID_REVIEW_STATUS" });
    try {
      const result = await options.pool.query(
        `SELECT id, source_id, source_page_url, artifact_url, link_text, file_extension,
                review_status, first_discovered_at, last_seen_at, reviewed_at,
                reviewed_by, review_note, capture_id, capture_attempts,
                last_capture_attempt_at, last_capture_error
           FROM fiscal.normative_artifact_candidates
          WHERE source_id = $1 AND ($2::varchar IS NULL OR review_status = $2)
          ORDER BY first_discovered_at DESC
          LIMIT 200`,
        [params.data.sourceId, query.data.status ?? null]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative artifact candidate listing failed");
      return reply.code(500).send({ error: "NORMATIVE_ARTIFACT_CANDIDATES_LIST_FAILED" });
    }
  });

  app.get("/v1/normative/sources/:sourceId/checks", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    const params = z.object({ sourceId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_SOURCE_ID" });
    try {
      const result = await options.pool.query(
        `SELECT c.id, c.source_id, c.check_status, c.http_status, c.content_type,
                c.content_length, c.etag, c.last_modified, c.content_sha256,
                c.normalized_content_sha256, c.fingerprint_version,
                c.response_ms, c.error_code, c.checked_at
           FROM fiscal.normative_source_checks c
          WHERE c.source_id = $1
          ORDER BY c.checked_at DESC
          LIMIT 50`,
        [params.data.sourceId]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative source check history failed");
      return reply.code(500).send({ error: "NORMATIVE_SOURCE_CHECKS_LIST_FAILED" });
    }
  });


  app.get("/v1/normative/sources/:sourceId/artifacts", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    const params = z.object({ sourceId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_SOURCE_ID" });
    try {
      const result = await options.pool.query(
        `SELECT id, source_id, source_url, content_type, byte_length,
                content_sha256, captured_at, capture_status
           FROM fiscal.normative_artifact_captures
          WHERE source_id = $1
          ORDER BY captured_at DESC
          LIMIT 100`,
        [params.data.sourceId]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative artifact history failed");
      return reply.code(500).send({ error: "NORMATIVE_ARTIFACTS_LIST_FAILED" });
    }
  });

  app.get("/v1/normative/documents/:documentId/versions", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    const params = z.object({ documentId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    try {
      const result = await options.pool.query(
        `SELECT v.id, v.document_id, v.version_number, v.content_hash, v.captured_at
           FROM fiscal.normative_document_versions v
          WHERE v.document_id = $1
          ORDER BY v.version_number DESC`,
        [params.data.documentId]
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative version listing failed");
      return reply.code(500).send({ error: "NORMATIVE_VERSION_LIST_FAILED" });
    }
  });

  app.get("/v1/normative/documents", async (request, reply) => {
    const claims = await authenticate(request, reply);
    if (!claims) return;
    try {
      const result = await options.pool.query(
        `SELECT d.id, s.name AS source_name, d.document_type, d.document_number,
                d.title, d.publication_date, d.effective_date, d.mandatory_date,
                d.official_url, d.evidence_status, d.review_status
           FROM fiscal.normative_documents d
           JOIN fiscal.normative_sources s ON s.id = d.source_id
          ORDER BY d.publication_date DESC NULLS LAST, d.created_at DESC LIMIT 100`
      );
      return reply.send({ items: result.rows });
    } catch (error) {
      request.log.error({ err: error }, "normative document listing failed");
      return reply.code(500).send({ error: "NORMATIVE_DOCUMENT_LIST_FAILED" });
    }
  });

  return app;
}


/**
 * Vercel Node.js function entrypoint.
 *
 * Fastify remains independently constructible through buildApp() for local
 * execution and tests. On Vercel, the function instance and PostgreSQL pool
 * are cached across warm invocations; no TCP listener is opened.
 */
let vercelAppPromise: Promise<FastifyInstance> | undefined;

export default async function vercelHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const pathname = (request.url ?? "/").split("?")[0] ?? "/";

  // Liveness must remain available even before production secrets and
  // PostgreSQL have been provisioned.
  if (pathname === "/health/live") {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: true, service: "fiscal-hub-api" }));
    return;
  }

  // Do not let missing deployment configuration become an opaque 500.
  // Readiness reports the dependency as unconfigured; application routes
  // remain unavailable until both required settings are present.
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    response.statusCode = 503;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(
      pathname === "/health/ready"
        ? { ok: false, database: "unconfigured" }
        : { error: "SERVICE_NOT_CONFIGURED" }
    ));
    return;
  }

  if (!vercelAppPromise) {
    const config = loadConfig();
    const pool = createPool(config.DATABASE_URL);
    vercelAppPromise = buildApp({
      pool,
      jwtSecret: config.JWT_SECRET,
      corsOrigin: config.CORS_ORIGIN,
      logger: true,
      normativeReviewTenantId: config.NORMATIVE_REVIEW_TENANT_ID
    }).then(async app => {
      app.addHook("onClose", async () => {
        await pool.end();
      });
      await app.ready();
      return app;
    }).catch(async error => {
      vercelAppPromise = undefined;
      await pool.end();
      throw error;
    });
  }

  const app = await vercelAppPromise;
  app.server.emit("request", request, response);
}
