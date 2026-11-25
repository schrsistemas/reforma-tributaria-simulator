import { Pool, type PoolClient } from "pg";
import { inspectSource, type NormativeSource } from "./checker.js";
import { withNormativeMonitorLock } from "./monitor.js";

const databaseUrl = process.env.DATABASE_URL;
const allowedHosts = new Set(
  (process.env.FISCAL_SOURCE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)
);
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (allowedHosts.size === 0) throw new Error("FISCAL_SOURCE_ALLOWED_HOSTS must contain approved hostnames");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 20_000,
  application_name: "fiscal-normative-source-monitor"
});

async function runChecks(client: PoolClient): Promise<void> {
  const sources = await client.query<NormativeSource>(
    "SELECT id, name, official_url FROM fiscal.normative_sources WHERE active = true ORDER BY name"
  );
  let checked = 0;
  let changed = 0;
  let errors = 0;

  for (const source of sources.rows) {
    const previous = await client.query<{ content_sha256: string | null }>(
      "SELECT content_sha256 FROM fiscal.normative_source_checks WHERE source_id = $1 AND content_sha256 IS NOT NULL ORDER BY checked_at DESC LIMIT 1",
      [source.id]
    );
    const snapshot = await inspectSource(source, previous.rows[0]?.content_sha256 ?? null, { allowedHosts });
    await client.query(
      "INSERT INTO fiscal.normative_source_checks (source_id, check_status, http_status, content_type, content_length, etag, last_modified, content_sha256, response_ms, error_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [source.id, snapshot.status, snapshot.httpStatus, snapshot.contentType, snapshot.contentLength,
       snapshot.etag, snapshot.lastModified, snapshot.contentSha256, snapshot.responseMs, snapshot.errorCode]
    );
    checked += 1;
    if (snapshot.status === "CHANGED") changed += 1;
    if (snapshot.status === "ERROR" || snapshot.status === "UNAVAILABLE") errors += 1;
    process.stdout.write(JSON.stringify({
      sourceId: source.id,
      source: source.name,
      status: snapshot.status,
      httpStatus: snapshot.httpStatus,
      responseMs: snapshot.responseMs,
      contentSha256: snapshot.contentSha256,
      errorCode: snapshot.errorCode
    }) + "\n");
  }
  process.stdout.write(JSON.stringify({ summary: { checked, changed, errors } }) + "\n");
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const lock = await withNormativeMonitorLock(client, () => runChecks(client));
    if (!lock.acquired) {
      process.stdout.write(JSON.stringify({
        skipped: true,
        reason: "MONITOR_ALREADY_RUNNING"
      }) + "\n");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
