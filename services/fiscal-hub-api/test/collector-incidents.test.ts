import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { evaluateCollectorIncidents } from "../src/collector-incidents.js";

const INCIDENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function incidentPool(conditionRows: Array<Record<string, unknown>>) {
  let state: "OPEN" | "RESOLVED" | null = null;
  let id: string | null = null;
  const events: string[] = [];
  const statements: string[] = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      statements.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" ||
          sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 0 };
      if (sql.includes("WITH worker_names")) return { rows: conditionRows, rowCount: conditionRows.length };
      if (sql.includes("SELECT id, status FROM fiscal.normative_collector_incidents")) {
        return { rows: state && id ? [{ id, status: state }] : [], rowCount: state ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO fiscal.normative_collector_incidents")) {
        if (!id) id = INCIDENT_ID;
        state = "OPEN";
        return { rows: [{ id }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO fiscal.normative_collector_incident_events")) {
        events.push(String(values[1]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("UPDATE fiscal.normative_collector_incidents")) {
        const activeKeys = values[0] as string[];
        if (state === "OPEN" && (!id || !activeKeys.includes("worker:SOURCE_MONITOR:FAILED"))) {
          state = "RESOLVED";
          return { rows: [{ id: id! }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, events, statements, getState: () => state };
}

const failedWorker = {
  incident_key: "worker:SOURCE_MONITOR:FAILED",
  incident_type: "WORKER_FAILED",
  severity: "CRITICAL",
  summary: "Latest collector worker execution failed",
  metadata: { worker: "SOURCE_MONITOR", failureCode: "SOURCE_TIMEOUT" }
};

test("collector incident evaluation opens and deduplicates an active incident", async () => {
  const fake = incidentPool([failedWorker]);
  const first = await evaluateCollectorIncidents(fake.pool);
  const second = await evaluateCollectorIncidents(fake.pool);
  assert.deepEqual(first, { opened: 1, updated: 0, reopened: 0, resolved: 0, active: 1 });
  assert.deepEqual(second, { opened: 0, updated: 1, reopened: 0, resolved: 0, active: 1 });
  assert.deepEqual(fake.events, ["OPENED", "UPDATED"]);
  assert.equal(fake.getState(), "OPEN");
  assert.equal(fake.statements.filter(sql => sql.includes("pg_advisory_xact_lock")).length, 2);
});

test("collector incident evaluation resolves an incident after its condition clears", async () => {
  const fake = incidentPool([failedWorker]);
  await evaluateCollectorIncidents(fake.pool);
  const resolved = await evaluateCollectorIncidents(fake.pool, 30, 15);
  assert.equal(resolved.resolved, 1);
  assert.deepEqual(fake.events, ["OPENED", "RESOLVED"]);
  assert.equal(fake.getState(), "RESOLVED");
});
