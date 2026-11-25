import { Pool, type PoolClient } from "pg";
import { S3ArtifactStorage } from "./s3-storage.js";
import { captureApprovedArtifacts } from "./capture-approved.js";
import { withArtifactCaptureLock } from "./monitor.js";
import { reconcilePendingCaptures } from "./reconciliation.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

const databaseUrl = required("DATABASE_URL");
const allowedHosts = new Set(
  required("FISCAL_SOURCE_ALLOWED_HOSTS").split(",").map(host => host.trim().toLowerCase()).filter(Boolean)
);
const region = required("S3_REGION");
const bucket = required("S3_BUCKET");
const accessKeyId = required("S3_ACCESS_KEY_ID");
const secretAccessKey = required("S3_SECRET_ACCESS_KEY");
const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
const forcePathStyleRaw = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
if (forcePathStyleRaw && forcePathStyleRaw !== "true" && forcePathStyleRaw !== "false") {
  throw new Error("S3_FORCE_PATH_STYLE must be true or false");
}
const batchSize = Number(process.env.FISCAL_CAPTURE_BATCH_SIZE ?? "25");
const reconciliationStaleMinutes = Number(process.env.FISCAL_CAPTURE_RECONCILE_STALE_MINUTES ?? "15");
if (!Number.isInteger(reconciliationStaleMinutes) || reconciliationStaleMinutes < 1 || reconciliationStaleMinutes > 1440) {
  throw new Error("FISCAL_CAPTURE_RECONCILE_STALE_MINUTES must be an integer between 1 and 1440");
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
  throw new Error("FISCAL_CAPTURE_BATCH_SIZE must be an integer between 1 and 200");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  application_name: "fiscal-normative-approved-artifact-capture"
});
const storage = new S3ArtifactStorage({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  ...(forcePathStyleRaw ? { forcePathStyle: forcePathStyleRaw === "true" } : {})
});

async function run(client: PoolClient): Promise<void> {
  const reconciliation = await reconcilePendingCaptures(client, storage, {
    staleMinutes: reconciliationStaleMinutes,
    batchSize: Math.min(500, batchSize * 4)
  });
  const summary = await captureApprovedArtifacts(client, {
    allowedHosts,
    storage,
    batchSize
  });
  process.stdout.write(JSON.stringify({ reconciliation, summary }) + "\n");
  if (summary.failed > 0 || reconciliation.failed > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const lock = await withArtifactCaptureLock(client, () => run(client));
    if (!lock.acquired) {
      process.stdout.write(JSON.stringify({ skipped: true, reason: "ARTIFACT_CAPTURE_ALREADY_RUNNING" }) + "\n");
    }
  } finally {
    client.release();
    await storage.close();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
