import test from "node:test";
import assert from "node:assert/strict";
import { captureAndRecordArtifact } from "../src/capture-service.js";
import type { ArtifactStorage } from "../src/capture.js";

const sourceId = "11111111-1111-4111-8111-111111111111";
const url = "https://www.gov.br/ato.pdf";
const captureId = "22222222-2222-4222-8222-222222222222";

function fixture(initialStatus: "NONE" | "CAPTURED" | "ERROR" = "NONE", uploadFails = false) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  let status = initialStatus;
  const db = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO fiscal.normative_artifact_captures")) {
        if (status !== "NONE") return { rows: [], rowCount: 0 };
        status = "PENDING";
        return { rows: [{ id: captureId, capture_status: status, storage_key: values?.[5] }], rowCount: 1 };
      }
      if (sql.includes("SELECT id, capture_status, storage_key")) {
        return { rows: status === "NONE" ? [] : [{ id: captureId, capture_status: status, storage_key: queries.find(q => q.sql.includes("INSERT INTO"))?.values?.[5] }], rowCount: status === "NONE" ? 0 : 1 };
      }
      if (sql.includes("SET source_url")) {
        status = "PENDING";
        return { rows: [{ id: captureId, capture_status: status, storage_key: values?.[4] }], rowCount: 1 };
      }
      if (sql.includes("SET capture_status = 'CAPTURED'")) {
        status = "CAPTURED";
        return { rows: [{ id: captureId }], rowCount: 1 };
      }
      if (sql.includes("SET capture_status = 'ERROR'")) {
        status = "ERROR";
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  const uploads: string[] = [];
  const storage: ArtifactStorage = {
    putObject: async input => {
      uploads.push(input.key);
      if (uploadFails) throw new Error("S3 unavailable");
    }
  };
  return { db, storage, queries, uploads, getStatus: () => status };
}

const options = (storage: ArtifactStorage) => ({
  allowedHosts: new Set(["www.gov.br"]),
  storage,
  fetcher: async () => new Response("%PDF-1.7 test", {
    status: 200,
    headers: { "content-type": "application/pdf" }
  })
});

test("persists PENDING metadata before uploading and marks CAPTURED after upload", async () => {
  const f = fixture();
  const result = await captureAndRecordArtifact(f.db, sourceId, url, options(f.storage));
  assert.equal(result.status, "CAPTURED");
  assert.equal(result.captureId, captureId);
  assert.equal(f.queries[0]?.sql.includes("VALUES ($1,$2,$3,$4,$5,$6,'PENDING',NULL)"), true);
  assert.equal(f.queries.findIndex(q => q.sql.includes("SET capture_status = 'CAPTURED'")) > f.queries.findIndex(q => q.sql.includes("INSERT INTO")), true);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.getStatus(), "CAPTURED");
});

test("reuses ERROR metadata and retries upload with the deterministic object key", async () => {
  const f = fixture("ERROR");
  const result = await captureAndRecordArtifact(f.db, sourceId, url, options(f.storage));
  assert.equal(result.status, "CAPTURED");
  assert.equal(result.captureId, captureId);
  assert.ok(f.queries.some(q => q.sql.includes("SET source_url") && q.sql.includes("capture_status = 'PENDING'")));
  assert.equal(f.uploads.length, 1);
});

test("records storage failure as ERROR without losing the durable capture row", async () => {
  const f = fixture("NONE", true);
  const result = await captureAndRecordArtifact(f.db, sourceId, url, options(f.storage));
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "STORAGE_UPLOAD_FAILED");
  assert.equal(result.captureId, captureId);
  assert.equal(f.getStatus(), "ERROR");
});

test("does not upload when the content hash is already CAPTURED", async () => {
  const f = fixture("CAPTURED");
  const result = await captureAndRecordArtifact(f.db, sourceId, url, options(f.storage));
  assert.equal(result.status, "DUPLICATE");
  assert.equal(result.captureId, captureId);
  assert.equal(f.uploads.length, 0);
});
