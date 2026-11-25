import test from "node:test";
import assert from "node:assert/strict";
import { inspectSource } from "../src/checker.js";

const source = {
  id: "source-1",
  name: "Official test portal",
  official_url: "https://www.gov.br/example"
};
const allowedHosts = new Set(["www.gov.br"]);

test("accepts an approved HTTPS source and returns a SHA-256", async () => {
  const response = new Response("<html>official portal</html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", etag: '"v1"' }
  });
  const result = await inspectSource(source, null, {
    allowedHosts,
    fetcher: async () => response
  });
  assert.equal(result.status, "AVAILABLE");
  assert.match(result.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(result.etag, '"v1"');
});

test("detects content changes using the previous SHA-256", async () => {
  const response = new Response("changed", { status: 200, headers: { "content-type": "text/html" } });
  const result = await inspectSource(source, "0".repeat(64), {
    allowedHosts,
    fetcher: async () => response
  });
  assert.equal(result.status, "CHANGED");
});

test("rejects a host outside the allowlist without making a request", async () => {
  let called = false;
  const result = await inspectSource(
    { ...source, official_url: "https://example.com/" },
    null,
    { allowedHosts, fetcher: async () => { called = true; return new Response("no"); } }
  );
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "HOST_NOT_ALLOWED");
  assert.equal(called, false);
});

test("rejects redirects to prevent host allowlist bypass", async () => {
  const response = new Response(null, { status: 302, headers: { location: "https://attacker.example/" } });
  const result = await inspectSource(source, null, {
    allowedHosts,
    fetcher: async () => response
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "REDIRECT_BLOCKED");
});

test("rejects responses larger than the configured limit", async () => {
  const response = new Response("123456789", {
    status: 200,
    headers: { "content-type": "text/html", "content-length": "9" }
  });
  const result = await inspectSource(source, null, {
    allowedHosts,
    maxBytes: 4,
    fetcher: async () => response
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "RESPONSE_TOO_LARGE");
});

test("records unavailable HTTP responses without treating them as content changes", async () => {
  const result = await inspectSource(source, null, {
    allowedHosts,
    fetcher: async () => new Response("not found", { status: 404 })
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.errorCode, "HTTP_404");
});
