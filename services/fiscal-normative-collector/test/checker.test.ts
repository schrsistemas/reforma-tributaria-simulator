import test from "node:test";
import assert from "node:assert/strict";
import { inspectSource, normalizeHtmlForFingerprint } from "../src/checker.js";

const source = {
  id: "source-1",
  name: "Official test portal",
  official_url: "https://www.gov.br/example"
};
const allowedHosts = new Set(["www.gov.br"]);

test("accepts an approved HTTPS source and returns raw and normalized SHA-256", async () => {
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
  assert.match(result.normalizedContentSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(result.etag, '"v1"');
  assert.equal(result.fingerprintVersion, "html-content-v1");
});

test("ignores scripts, styles, comments and volatile attributes but preserves links and text", () => {
  const first = normalizeHtmlForFingerprint(
    '<html class="a" id="page"><script>window.random=1</script><style>.a{color:red}</style><!-- timestamp --><body><h1>Official</h1><a href="/Doc">Manual</a></body></html>'
  );
  const second = normalizeHtmlForFingerprint(
    '<html class="b" id="other"><script>window.random=2</script><style>.b{color:blue}</style><!-- changed --><body><h1>Official</h1><a href="/Doc">Manual</a></body></html>'
  );
  assert.equal(first, second);
  assert.notEqual(first, normalizeHtmlForFingerprint(
    '<html><body><h1>Updated Official</h1><a href="/Doc">Manual</a></body></html>'
  ));
  assert.notEqual(first, normalizeHtmlForFingerprint(
    '<html><body><h1>Official</h1><a href="/doc">Manual</a></body></html>'
  ));
});

test("does not report CHANGED for dynamic HTML chrome when normalized content is stable", async () => {
  const html = '<html class="layout-a"><script>var stamp=1</script><body><h1>Manual v1.02</h1></body></html>';
  const previous = await inspectSource(source, null, {
    allowedHosts,
    fetcher: async () => new Response(html, { headers: { "content-type": "text/html" } })
  });
  const current = await inspectSource(source, previous.normalizedContentSha256, {
    allowedHosts,
    fetcher: async () => new Response(
      '<html class="layout-b"><script>var stamp=2</script><body><h1>Manual v1.02</h1></body></html>',
      { headers: { "content-type": "text/html" } }
    )
  });
  assert.notEqual(previous.contentSha256, current.contentSha256);
  assert.equal(previous.normalizedContentSha256, current.normalizedContentSha256);
  assert.equal(current.status, "AVAILABLE");
});

test("detects actual document text change using normalized HTML fingerprint", async () => {
  const previous = await inspectSource(source, null, {
    allowedHosts,
    fetcher: async () => new Response("<main><h1>Manual v1.02</h1></main>", {
      headers: { "content-type": "text/html" }
    })
  });
  const current = await inspectSource(source, previous.normalizedContentSha256, {
    allowedHosts,
    fetcher: async () => new Response("<main><h1>Manual v1.03</h1></main>", {
      headers: { "content-type": "text/html" }
    })
  });
  assert.equal(current.status, "CHANGED");
});

test("detects content changes for non-HTML documents using raw SHA-256", async () => {
  const response = new Response("%PDF-1.7 sample", {
    status: 200,
    headers: { "content-type": "application/pdf" }
  });
  const result = await inspectSource(source, "0".repeat(64), {
    allowedHosts,
    fetcher: async () => response
  });
  assert.equal(result.status, "CHANGED");
  assert.equal(result.contentSha256, result.normalizedContentSha256);
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
