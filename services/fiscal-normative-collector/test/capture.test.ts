import test from "node:test";
import assert from "node:assert/strict";
import { captureOfficialArtifact } from "../src/capture.js";
import type { ArtifactStorage } from "../src/capture.js";

const sourceId = "11111111-1111-4111-8111-111111111111";
const allowedHosts = new Set(["www.gov.br"]);

function storageSpy() {
  const objects: Array<{ key: string; body: Uint8Array; contentType: string; metadata: Record<string, string> }> = [];
  const storage: ArtifactStorage = { putObject: async input => { objects.push(input); } };
  return { storage, objects };
}

test("captures an approved PDF and stores it by immutable content hash", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://www.gov.br/ato.pdf", {
    allowedHosts, storage,
    fetcher: async () => new Response("%PDF-1.7 test", { status: 200, headers: { "content-type": "application/pdf" } })
  });
  assert.equal(result.status, "CAPTURED");
  assert.equal(result.contentType, "application/pdf");
  assert.match(result.sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(objects.length, 1);
  assert.equal(objects[0]!.key, result.objectKey);
  assert.equal(objects[0]!.metadata.sha256, result.sha256);
});

test("rejects a hostname outside the allowlist without fetching", async () => {
  const { storage, objects } = storageSpy();
  let called = false;
  const result = await captureOfficialArtifact(sourceId, "https://example.com/ato.pdf", {
    allowedHosts, storage,
    fetcher: async () => { called = true; return new Response("no"); }
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "ARTIFACT_HOST_NOT_ALLOWED");
  assert.equal(called, false);
  assert.equal(objects.length, 0);
});

test("blocks redirects rather than following an untrusted destination", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://www.gov.br/redirect", {
    allowedHosts, storage,
    fetcher: async () => new Response(null, { status: 302, headers: { location: "https://attacker.example/file.pdf" } })
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "REDIRECT_BLOCKED");
  assert.equal(objects.length, 0);
});

test("rejects unsupported response content types", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://www.gov.br/download", {
    allowedHosts, storage,
    fetcher: async () => new Response("binary", { status: 200, headers: { "content-type": "application/octet-stream" } })
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "UNSUPPORTED_CONTENT_TYPE");
  assert.equal(objects.length, 0);
});

test("rejects oversized content before storing", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://www.gov.br/large.pdf", {
    allowedHosts, storage, maxBytes: 4,
    fetcher: async () => new Response("123456789", {
      status: 200, headers: { "content-type": "application/pdf", "content-length": "9" }
    })
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "ARTIFACT_TOO_LARGE");
  assert.equal(objects.length, 0);
});

test("rejects non-HTTPS URLs", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "http://www.gov.br/ato.pdf", { allowedHosts, storage });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "ARTIFACT_HOST_NOT_ALLOWED");
  assert.equal(objects.length, 0);
});

test("rejects a PDF response without a PDF signature", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://www.gov.br/fake.pdf", {
    allowedHosts, storage,
    fetcher: async () => new Response("<html>not a PDF</html>", {
      status: 200, headers: { "content-type": "application/pdf" }
    })
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "PDF_SIGNATURE_INVALID");
  assert.equal(objects.length, 0);
});

test("rejects invalid source identifiers before making a request", async () => {
  const { storage, objects } = storageSpy();
  let called = false;
  const result = await captureOfficialArtifact("invalid-id", "https://www.gov.br/ato.pdf", {
    allowedHosts, storage,
    fetcher: async () => { called = true; return new Response("%PDF-1.7"); }
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "INVALID_SOURCE_ID");
  assert.equal(called, false);
  assert.equal(objects.length, 0);
});

test("captures a GNRE PDF over its official HTTPS port 444", async () => {
  const { storage, objects } = storageSpy();
  const result = await captureOfficialArtifact(sourceId, "https://gnre.pe.gov.br:444/gnre/manual.pdf", {
    allowedHosts: new Set(["gnre.pe.gov.br"]),
    storage,
    fetcher: async () => new Response("%PDF-1.7 GNRE", { status: 200, headers: { "content-type": "application/pdf" } })
  });
  assert.equal(result.status, "CAPTURED");
  assert.equal(objects.length, 1);
});
