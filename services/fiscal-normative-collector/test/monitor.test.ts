import test from "node:test";
import assert from "node:assert/strict";
import { withNormativeMonitorLock, withArtifactDiscoveryLock, withArtifactCaptureLock, type AdvisoryLockClient } from "../src/monitor.js";

function fakeClient(locked: boolean): {
  client: AdvisoryLockClient;
  statements: string[];
} {
  const statements: string[] = [];
  return {
    statements,
    client: {
      async query<T>(sql: string): Promise<{ rows: T[]; rowCount: number }> {
        statements.push(sql);
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ locked } as T], rowCount: 1 };
        }
        if (sql.includes("pg_advisory_unlock")) {
          return { rows: [{ pg_advisory_unlock: true } as T], rowCount: 1 };
        }
        throw new Error("Unexpected SQL: " + sql);
      }
    }
  };
}

test("runs the monitor task while holding the PostgreSQL advisory lock", async () => {
  const fake = fakeClient(true);
  let executions = 0;
  const result = await withNormativeMonitorLock(fake.client, async () => {
    executions += 1;
    return "completed";
  });

  assert.deepEqual(result, { acquired: true, value: "completed" });
  assert.equal(executions, 1);
  assert.equal(fake.statements.length, 2);
  assert.match(fake.statements[0]!, /pg_try_advisory_lock/);
  assert.match(fake.statements[1]!, /pg_advisory_unlock/);
});

test("skips a concurrent monitor execution without running its task", async () => {
  const fake = fakeClient(false);
  let executions = 0;
  const result = await withNormativeMonitorLock(fake.client, async () => {
    executions += 1;
  });

  assert.deepEqual(result, { acquired: false });
  assert.equal(executions, 0);
  assert.equal(fake.statements.length, 1);
});

test("releases the advisory lock when the monitor task fails", async () => {
  const fake = fakeClient(true);
  await assert.rejects(
    withNormativeMonitorLock(fake.client, async () => {
      throw new Error("simulated database failure");
    }),
    /simulated database failure/
  );

  assert.equal(fake.statements.length, 2);
  assert.match(fake.statements[1]!, /pg_advisory_unlock/);
});

test("uses an independent advisory lock for artifact discovery", async () => {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client: AdvisoryLockClient = {
    async query<T>(sql: string, values?: unknown[]) {
      statements.push({ sql, values });
      return { rows: [{ locked: true } as T], rowCount: 1 };
    }
  };
  const result = await withArtifactDiscoveryLock(client, async () => "discovered");
  assert.deepEqual(result, { acquired: true, value: "discovered" });
  assert.deepEqual(statements[0]!.values, [20261125, 2]);
  assert.deepEqual(statements[1]!.values, [20261125, 2]);
});

test("uses a separate advisory lock for approved artifact capture", async () => {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client: AdvisoryLockClient = {
    async query<T>(sql: string, values?: unknown[]) {
      statements.push({ sql, values });
      return { rows: [{ locked: true } as T], rowCount: 1 };
    }
  };
  const result = await withArtifactCaptureLock(client, async () => "captured");
  assert.deepEqual(result, { acquired: true, value: "captured" });
  assert.deepEqual(statements[0]!.values, [20261125, 3]);
  assert.deepEqual(statements[1]!.values, [20261125, 3]);
});
