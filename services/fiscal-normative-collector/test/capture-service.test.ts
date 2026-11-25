import test from "node:test";
import assert from "node:assert/strict";
import { captureAndRecordArtifact } from "../src/capture-service.js";
import type { ArtifactStorage } from "../src/capture.js";

const sourceId = "11111111-1111-4111-8111-111111111111";
const url = "https://www.gov.br/ato.pdf";

function fixture(rowCount: number) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    queries,
    db: {
      query: async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        return { rows: rowCount ? [{ id: "22222222-2222-4222-8222-222222222222" }] : [], rowCount };
      }
    },
    storage: {
      putObject: async (_input: Parameters<ArtifactStorage["putObject"]>[0]) => undefined
    } satisfies ArtifactStorage
  };
}

test("records captured artifact metadata in the database", async () => {
  const f = fixture(1);
  const result = await captureAndRecordArtifact(f.db, sourceId, url, {
    allowedHosts: new Set(["www.gov.br"]),
    storage: f.storage,
    fetcher: async () => new Response("%PDF-1.7 test", {
      status: 200,
      headers: { "content-type": "application/pdf" }
    })
  });
  assert.equal(result.status, "CAPTURED");
  assert.equal(f.queries.length, 1);
  assert.match(f.queries[0]!.sql, /ON CONFLICT \(source_id, content_sha256\) DO NOTHING/);
  assert.equal(f.queries[0]!.values?.[0], sourceId);
});

test("returns DUPLICATE when the same source and content hash already exist", async () => {
  const f = fixture(0);
  const result = await captureAndRecordArtifact(f.db, sourceId, url, {
    allowedHosts: new Set(["www.gov.br"]),
    storage: f.storage,
    fetcher: async () => new Response("%PDF-1.7 test", {
      status: 200,
      headers: { "content-type": "application/pdf" }
    })
  });
  assert.equal(result.status, "DUPLICATE");
});
