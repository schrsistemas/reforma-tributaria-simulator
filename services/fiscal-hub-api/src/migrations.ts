export interface MigrationClient {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface SqlMigration {
  version: string;
  checksum: string;
  sql: string;
}
export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export function normalizeMigrationSql(sql: string): string {
  const normalized = sql
    .replace(/^\s*BEGIN\s*;\s*/i, "")
    .replace(/\s*COMMIT\s*;\s*$/i, "")
    .trim();
  if (!normalized) throw new Error("EMPTY_MIGRATION");
  if (/^\s*(?:BEGIN|COMMIT)\s*;/i.test(normalized) || /;\s*(?:BEGIN|COMMIT)\s*;\s*$/i.test(normalized)) {
    throw new Error("NESTED_MIGRATION_TRANSACTION");
  }
  return normalized;
}

export function sortMigrationFiles(names: string[]): string[] {
  const files = names.filter(name => /^\d{4}_[a-z0-9_]+\.sql$/i.test(name)).sort((a, b) => a.localeCompare(b));
  const versions = new Set<string>();
  for (const file of files) {
    const version = file.slice(0, 4);
    if (versions.has(version)) throw new Error("DUPLICATE_MIGRATION_VERSION:" + version);
    versions.add(version);
  }
  return files;
}

/**
 * Applies checksum-pinned SQL migrations transactionally. The session advisory
 * lock serializes concurrent deploys; the metadata schema is inaccessible to
 * the normal fiscal_hub_app role.
 */
export async function applyMigrations(client: MigrationClient, migrations: SqlMigration[]): Promise<MigrationRunResult> {
  await client.query("CREATE SCHEMA IF NOT EXISTS fiscal_meta");
  await client.query("REVOKE ALL ON SCHEMA fiscal_meta FROM PUBLIC");
  await client.query(`CREATE TABLE IF NOT EXISTS fiscal_meta.schema_migrations (
    version varchar(255) PRIMARY KEY,
    checksum char(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const lock = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS locked",
    [20261125, 4]
  );
  if (lock.rows[0]?.locked !== true) throw new Error("MIGRATION_ALREADY_RUNNING");

  const result: MigrationRunResult = { applied: [], skipped: [] };
  try {
    for (const migration of migrations) {
      if (!/^\d{4}_[a-z0-9_]+\.sql$/i.test(migration.version)) {
        throw new Error("INVALID_MIGRATION_VERSION:" + migration.version);
      }
      if (!/^[a-f0-9]{64}$/.test(migration.checksum)) {
        throw new Error("INVALID_MIGRATION_CHECKSUM:" + migration.version);
      }
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM fiscal_meta.schema_migrations WHERE version = $1",
        [migration.version]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== migration.checksum) {
          throw new Error("MIGRATION_CHECKSUM_MISMATCH:" + migration.version);
        }
        result.skipped.push(migration.version);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(normalizeMigrationSql(migration.sql));
        await client.query(
          "INSERT INTO fiscal_meta.schema_migrations (version, checksum) VALUES ($1,$2)",
          [migration.version, migration.checksum]
        );
        await client.query("COMMIT");
        result.applied.push(migration.version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return result;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1, $2)", [20261125, 4]);
  }
}
