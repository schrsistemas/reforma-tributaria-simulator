import { Pool, type PoolClient } from "pg";
import { discoverOfficialArtifacts } from "./discovery.js";
import { withArtifactDiscoveryLock } from "./monitor.js";
import { withWorkerRun } from "./run-ledger.js";

const databaseUrl = process.env.DATABASE_URL;
const allowedHosts = new Set((process.env.FISCAL_SOURCE_ALLOWED_HOSTS ?? "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean));
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (allowedHosts.size === 0) throw new Error("FISCAL_SOURCE_ALLOWED_HOSTS must contain approved hostnames");

const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000, statement_timeout: 20_000, application_name: "fiscal-normative-artifact-discovery" });

async function runDiscovery(client: PoolClient): Promise<{ checked: number; discovered: number; errors: number }> {
  const sources = await client.query<{ id: string; name: string; official_url: string }>(
    "SELECT id, name, official_url FROM fiscal.normative_sources WHERE active = true ORDER BY name"
  );
  let checked = 0;
  let discovered = 0;
  let errors = 0;
  for (const source of sources.rows) {
    const result = await discoverOfficialArtifacts(client, source.id, source.official_url, { allowedHosts });
    checked += 1;
    discovered += result.candidatesUpserted;
    if (result.status === "ERROR" || result.status === "UNAVAILABLE") errors += 1;
    process.stdout.write(JSON.stringify({
      sourceId: source.id, source: source.name, status: result.status,
      linksFound: result.linksFound, candidatesUpserted: result.candidatesUpserted,
      pageSha256: result.pageSha256, httpStatus: result.httpStatus, errorCode: result.errorCode
    }) + "\n");
  }
  const summary = { checked, discovered, errors };
  process.stdout.write(JSON.stringify({ summary }) + "\n");
  if (errors > 0) process.exitCode = 1;
  return summary;
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const lock = await withArtifactDiscoveryLock(client, () =>
      withWorkerRun(client, "ARTIFACT_DISCOVERY", () => runDiscovery(client), result => result.errors > 0)
    );
    if (!lock.acquired) {
      process.stdout.write(JSON.stringify({ skipped: true, reason: "DISCOVERY_ALREADY_RUNNING" }) + "\n");
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
