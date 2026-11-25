import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePendingCaptures } from "../src/reconciliation.js";
import type { ArtifactCaptureQuery } from "../src/capture-service.js";
import type { InspectableArtifactStorage } from "../src/reconciliation.js";

const captureId = "22222222-2222-4222-8222-222222222222";
const sourceId = "11111111-1111-4111-8111-111111111111";
const sourceUrl = "https://www.gov.br/ato.pdf";
const sha256 = "a".repeat(64);

function fixture(mode: "FOUND" | "MISSING" | "STORAGE_ERROR" | "MISMATCH") {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const db = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("SELECT id, source_id, source_url")) {
        return {
          rows: [{
            id: captureId,
            source_id: sourceId,
            source_url: sourceUrl,
            content_sha256: sha256,
            storage_key: "normative-artifacts/" + sourceId + "/" + sha256 + ".pdf",
            capture_started_at: "2026-11-25T00:00:00.000Z"
          }],
          rowCount: 1
        };
      }
      if (sql.includes("UPDATE fiscal.normative_artifact_captures")) {
        return { rows: [{ id: captureId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  } as unknown as ArtifactCaptureQuery;
  const storage: InspectableArtifactStorage = {
    putObject: async () => undefined,
    headObject: async () => {
      if (mode === "STORAGE_ERROR") throw new Error("S3 unavailable");
      if (mode === "MISSING") return null;
      if (mode === "MISMATCH") return { sha256: "b".repeat(64), sourceId };
      return { sha256, sourceId };
    }
  };
  return { db, storage, calls };
}

test("finalizes stale PENDING metadata when the matching S3 object exists", async () => {
  const f = fixture("FOUND");
  const result = await reconcilePendingCaptures(f.db, f.storage);
  assert.deepEqual(result, { examined: 1, finalized: 1, retryable: 0, skipped: 0, failed: 0 });
  assert.ok(f.calls.some(call => call.sql.includes("SET capture_status = 'CAPTURED'")));
  assert.ok(f.calls.some(call => call.sql.includes("UPDATE fiscal.normative_artifact_candidates") && call.sql.includes("review_status = 'CAPTURED'")));
  assert.ok(f.calls.some(call => call.sql === "COMMIT"));
});

test("marks a stale capture retryable when the S3 object is missing", async () => {
  const f = fixture("MISSING");
  const result = await reconcilePendingCaptures(f.db, f.storage);
  assert.deepEqual(result, { examined: 1, finalized: 0, retryable: 1, skipped: 0, failed: 0 });
  assert.ok(f.calls.some(call => call.sql.includes("capture_error_code = 'OBJECT_NOT_FOUND'")));
  assert.ok(f.calls.some(call => call.sql.includes("last_capture_error = 'OBJECT_NOT_FOUND'")));
  assert.ok(f.calls.some(call => call.sql === "COMMIT"));
});

test("does not mutate PENDING metadata when storage inspection fails", async () => {
  const f = fixture("STORAGE_ERROR");
  const result = await reconcilePendingCaptures(f.db, f.storage);
  assert.deepEqual(result, { examined: 1, finalized: 0, retryable: 0, skipped: 0, failed: 1 });
  assert.equal(f.calls.some(call => call.sql.includes("UPDATE fiscal.normative_artifact_captures")), false);
});

test("does not finalize an object whose metadata does not match the capture row", async () => {
  const f = fixture("MISMATCH");
  const result = await reconcilePendingCaptures(f.db, f.storage);
  assert.deepEqual(result, { examined: 1, finalized: 0, retryable: 0, skipped: 0, failed: 1 });
  assert.equal(f.calls.some(call => call.sql.includes("UPDATE fiscal.normative_artifact_captures")), false);
});

test("validates reconciliation bounds before querying", async () => {
  const f = fixture("FOUND");
  await assert.rejects(reconcilePendingCaptures(f.db, f.storage, { staleMinutes: 0 }), /INVALID_RECONCILIATION_STALE_MINUTES/);
  await assert.rejects(reconcilePendingCaptures(f.db, f.storage, { batchSize: 501 }), /INVALID_RECONCILIATION_BATCH_SIZE/);
  assert.equal(f.calls.length, 0);
});
