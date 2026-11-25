import test from "node:test";
import assert from "node:assert/strict";
import { captureApprovedArtifacts } from "../src/capture-approved.js";
import type { ArtifactStorage } from "../src/capture.js";

const sourceId = "11111111-1111-4111-8111-111111111111";
const candidateId = "33333333-3333-4333-8333-333333333333";
const captureId = "22222222-2222-4222-8222-222222222222";

function fixture(fetchStatus = 200) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const db = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("SELECT id, source_id, artifact_url")) {
        return { rows: [{ id: candidateId, source_id: sourceId, artifact_url: "https://www.gov.br/ato.pdf" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO fiscal.normative_artifact_captures")) {
        return { rows: [{ id: captureId }], rowCount: 1 };
      }
      if (sql.includes("UPDATE fiscal.normative_artifact_candidates") && sql.includes("review_status = 'CAPTURED'")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  };
  const storage: ArtifactStorage = { putObject: async () => undefined };
  const fetcher: typeof fetch = async () => new Response(
    fetchStatus === 200 ? "%PDF-1.7 approved" : "not found",
    { status: fetchStatus, headers: { "content-type": "application/pdf" } }
  );
  return { db, storage, fetcher, calls };
}

test("captures only approved candidates and links the immutable capture id", async () => {
  const f = fixture();
  const summary = await captureApprovedArtifacts(f.db, {
    allowedHosts: new Set(["www.gov.br"]),
    storage: f.storage,
    fetcher: f.fetcher
  });
  assert.deepEqual(summary, { selected: 1, captured: 1, duplicates: 0, failed: 0 });
  const update = f.calls.find(call => call.sql.includes("review_status = 'CAPTURED'"));
  assert.equal(update?.values?.[0], candidateId);
  assert.equal(update?.values?.[1], captureId);
  assert.match(update?.sql ?? "", /capture_attempts = capture_attempts \+ 1/);
  assert.match(update?.sql ?? "", /last_capture_attempt_at = now\(\)/);
});

test("keeps failed candidates approved and records retry metadata", async () => {
  const f = fixture(404);
  const summary = await captureApprovedArtifacts(f.db, {
    allowedHosts: new Set(["www.gov.br"]),
    storage: f.storage,
    fetcher: f.fetcher
  });
  assert.deepEqual(summary, { selected: 1, captured: 0, duplicates: 0, failed: 1 });
  const update = f.calls.find(call => call.sql.includes("capture_attempts = capture_attempts + 1"));
  assert.equal(update?.values?.[0], candidateId);
  assert.equal(update?.values?.[1], "HTTP_404");
});
