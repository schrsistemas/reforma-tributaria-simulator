import test from "node:test";
import assert from "node:assert/strict";
import { withWorkerRun, type RunLedgerClient } from "../src/run-ledger.js";

function ledgerClient(failUpdate = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO fiscal.normative_collector_runs")) {
        return { rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }], rowCount: 1 };
      }
      if (failUpdate && sql.includes("UPDATE fiscal.normative_collector_runs")) {
        throw new Error("database unavailable");
      }
      return { rows: [], rowCount: 1 };
    }
  };
}

test("worker ledger records successful runs and JSON counters", async () => {
  const client = ledgerClient();
  const result = await withWorkerRun(client as unknown as RunLedgerClient, "SOURCE_MONITOR", async () => ({
    checked: 12, changed: 2, errors: 0
  }));
  assert.deepEqual(result, { checked: 12, changed: 2, errors: 0 });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[0]!.sql, /RUNNING/);
  assert.match(client.calls[1]!.sql, /SUCCEEDED/);
  assert.equal(client.calls[1]!.values?.[0], "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(client.calls[1]!.values?.[1], "SUCCEEDED");
  assert.equal(client.calls[1]!.values?.[2], JSON.stringify({ checked: 12, changed: 2, errors: 0 }));
});

test("worker ledger marks failed runs without persisting exception details", async () => {
  const client = ledgerClient();
  await assert.rejects(withWorkerRun(client as unknown as RunLedgerClient, "ARTIFACT_CAPTURE", async () => {
    throw new Error("secret endpoint and credentials");
  }), /secret endpoint and credentials/);
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1]!.sql, /FAILED/);
  assert.match(client.calls[1]!.sql, /WORKER_FAILED/);
  assert.equal(JSON.stringify(client.calls[1]!.values).includes("credentials"), false);
});

test("worker ledger preserves the original error if failure bookkeeping also fails", async () => {
  const client = ledgerClient(true);
  await assert.rejects(withWorkerRun(client as unknown as RunLedgerClient, "ARTIFACT_DISCOVERY", async () => {
    throw new Error("original worker failure");
  }), /original worker failure/);
});

test("worker ledger records partial execution errors as FAILED with counters", async () => {
  const client = ledgerClient();
  await withWorkerRun(client as unknown as RunLedgerClient, "ARTIFACT_DISCOVERY", async () => ({
    checked: 10, discovered: 4, errors: 2
  }), result => result.errors > 0);
  assert.equal(client.calls[1]!.values?.[1], "FAILED");
  assert.equal(client.calls[1]!.values?.[2], JSON.stringify({
    checked: 10, discovered: 4, errors: 2
  }));
});
