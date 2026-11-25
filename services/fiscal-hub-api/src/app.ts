import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import type { Pool } from "pg";
import { verifyPassword } from "./auth.js";
import { withTenant } from "./db.js";

const loginSchema = z.object({
  tenantSlug: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(1).max(256)
});

export interface BuildAppOptions {
  pool: Pool;
  jwtSecret: string;
  corsOrigin?: string;
  logger?: boolean;
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
    sign: { issuer: "fiscal-intelligence-hub", audience: "fiscal-hub-api", expiresIn: "15m" },
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
    try {
      await request.jwtVerify();
      const claims = request.user as { sub: string; tenantId: string; roles: string[] };
      return reply.send({ userId: claims.sub, tenantId: claims.tenantId, roles: claims.roles });
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.get("/v1/companies", async (request, reply) => {
    let tenantId: string;
    try {
      await request.jwtVerify();
      tenantId = (request.user as { tenantId: string }).tenantId;
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    try {
      const rows = await withTenant(options.pool, tenantId, async client => {
        const result = await client.query(
          "SELECT id, legal_name, trade_name, cnpj, uf, status, created_at FROM fiscal.companies ORDER BY legal_name"
        );
        return result.rows;
      });
      return reply.send({ items: rows });
    } catch (error) {
      request.log.error({ err: error }, "company listing failed");
      return reply.code(500).send({ error: "COMPANY_LIST_FAILED" });
    }
  });

  app.get("/v1/normative/documents", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
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
