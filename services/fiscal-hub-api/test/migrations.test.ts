import test from "node:test";
import assert from "node:assert/strict";
import { applyMigrations, normalizeMigrationSql, sortMigrationFiles, type MigrationClient } from "../src/migrations.js";

function fakeClient() {
  const applied = new Map<string, string>();
  const statements: string[] = [];
  let locked = true;
  const client: MigrationClient = {
    async query<T>(sql: string, values?: unknown[]) {
      statements.push(sql);
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked } as T], rowCount: 1 };
      if (sql.includes("pg_advisory_unlock")) return { rows: [{ unlocked: true } as T], rowCount: 1 };
      if (sql.includes("SELECT checksum FROM fiscal_meta.schema_migrations")) {
        const checksum = applied.get(String(values?.[0]));
        return { rows: (checksum ? [{ checksum } as T] : []), rowCount: checksum ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO fiscal_meta.schema_migrations")) {
        applied.set(String(values?.[0]), String(values?.[1]));
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  return { client, applied, statements, setLocked: (value: boolean) => { locked = value; } };
}

const checksum = "a".repeat(64);
const migration = { version: "0001_initial.sql", checksum, sql: "BEGIN;\nCREATE TABLE example(id int);\nCOMMIT;" };

test("strips only the outer transaction wrappers from migration files", () => {
  assert.equal(normalizeMigrationSql("BEGIN;\nSELECT 1;\nCOMMIT;"), "SELECT 1;");
});

test("sorts numbered migrations and rejects duplicate version numbers", () => {
  assert.deepEqual(sortMigrationFiles(["README.md", "0002_second.sql", "0001_first.sql"]), ["0001_first.sql", "0002_second.sql"]);
  assert.throws(() => sortMigrationFiles(["0001_first.sql", "0001_duplicate.sql"]), /DUPLICATE_MIGRATION_VERSION/);
});

test("applies each migration once and skips matching checksums", async () => {
  const fake = fakeClient();
  const first = await applyMigrations(fake.client, [migration]);
  const second = await applyMigrations(fake.client, [migration]);
  assert.deepEqual(first.applied, [migration.version]);
  assert.deepEqual(first.skipped, []);
  assert.deepEqual(second.applied, []);
  assert.deepEqual(second.skipped, [migration.version]);
});

test("rejects a changed migration checksum after it has been applied", async () => {
  const fake = fakeClient();
  await applyMigrations(fake.client, [migration]);
  await assert.rejects(
    applyMigrations(fake.client, [{ ...migration, checksum: "b".repeat(64) }]),
    /MIGRATION_CHECKSUM_MISMATCH/
  );
});

test("does not run migrations when another process holds the migration lock", async () => {
  const fake = fakeClient();
  fake.setLocked(false);
  await assert.rejects(applyMigrations(fake.client, [migration]), /MIGRATION_ALREADY_RUNNING/);
  assert.equal(fake.statements.some(sql => sql.includes("CREATE TABLE example")), false);
});
