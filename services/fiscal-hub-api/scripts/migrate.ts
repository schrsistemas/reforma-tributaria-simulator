import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { applyMigrations, sortMigrationFiles, type SqlMigration } from "../src/migrations.js";

const connectionString = process.env.MIGRATION_DATABASE_URL?.trim();
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required; the runtime DATABASE_URL is not accepted for migrations");

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const names = sortMigrationFiles(await readdir(migrationsDirectory));
if (names.length === 0) throw new Error("NO_MIGRATIONS_FOUND");

const migrations: SqlMigration[] = await Promise.all(names.map(async version => {
  const sql = await readFile(new URL("../migrations/" + version, import.meta.url), "utf8");
  return {
    version,
    checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
    sql
  };
}));

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 60_000,
  application_name: "fiscal-hub-migration-runner"
});

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await applyMigrations(client, migrations);
    process.stdout.write(JSON.stringify({
      migrationCount: migrations.length,
      applied: result.applied,
      skipped: result.skipped
    }) + "\n");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
