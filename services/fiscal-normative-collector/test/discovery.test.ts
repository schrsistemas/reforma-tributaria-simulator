import test from "node:test";
import assert from "node:assert/strict";
import { discoverOfficialArtifacts, extractOfficialArtifactLinks } from "../src/discovery.js";
const sourceId = "11111111-1111-4111-8111-111111111111";
const sourceUrl = "https://www.gov.br/sped/documentos";
const allowedHosts = new Set(["www.gov.br", "www.nfe.fazenda.gov.br", "gnre.pe.gov.br"]);

test("extracts approved document links, resolves relative URLs and rejects unapproved hosts", () => {
  const html = '<a href="/manual/nt-2026.pdf#page=2">Nota Técnica 2026</a><a href="../schemas/modelo.xsd">Schema XML</a><a href="https://www.nfe.fazenda.gov.br/portal/layout.json">Layout JSON</a><a href="https://evil.example/manual.pdf">Manual externo</a><a href="javascript:alert(1)">Manual inválido</a><script><a href="/fake.pdf">Ato falso</a></script>';
  const links = extractOfficialArtifactLinks(html, sourceUrl, allowedHosts);
  assert.equal(links.length, 3);
  assert.equal(links[0]!.url, "https://www.gov.br/manual/nt-2026.pdf");
  assert.equal(links[0]!.resourceKind, "PDF");
  assert.equal(links[1]!.resourceKind, "XML");
  assert.equal(links[2]!.resourceKind, "JSON");
});
test("deduplicates links and decodes HTML URL entities", () => {
  const links = extractOfficialArtifactLinks('<a href="/download?a=1&amp;b=2">Manual</a><a href="/download?a=1&amp;b=2#top">Manual repetido</a>', sourceUrl, allowedHosts);
  assert.equal(links.length, 1);
  assert.equal(links[0]!.url, "https://www.gov.br/download?a=1&b=2");
});
test("allows GNRE HTTPS port 444 only on its exact hostname", () => {
  const links = extractOfficialArtifactLinks('<a href="https://gnre.pe.gov.br:444/gnre/manual.pdf">Manual GNRE</a>', sourceUrl, allowedHosts);
  assert.equal(links.length, 1);
});
test("rejects arbitrary non-standard ports", () => {
  assert.equal(extractOfficialArtifactLinks('<a href="https://www.gov.br:8443/manual.pdf">Manual</a>', sourceUrl, allowedHosts).length, 0);
});
test("persists candidates with idempotent upsert", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const result = await discoverOfficialArtifacts({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [], rowCount: 1 }; } }, sourceId, sourceUrl, {
    allowedHosts, fetcher: async () => new Response('<a href="/nt.pdf">Nota Técnica</a><a href="/schema.xsd">Schema</a>', { headers: { "content-type": "text/html; charset=utf-8" } })
  });
  assert.equal(result.status, "DISCOVERED");
  assert.equal(result.linksFound, 2);
  assert.equal(result.candidatesUpserted, 2);
  assert.match(result.pageSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.sql, /ON CONFLICT \(source_id, artifact_url\) DO UPDATE/);
  assert.match(calls[0]!.sql, /review_status <> 'REJECTED'/);
});
test("blocks redirects without persisting candidate links", async () => {
  let called = 0;
  const result = await discoverOfficialArtifacts({ query: async () => { called++; return { rows: [], rowCount: 0 }; } }, sourceId, sourceUrl, {
    allowedHosts, fetcher: async () => new Response(null, { status: 302, headers: { location: "https://evil.example/" } })
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "REDIRECT_BLOCKED");
  assert.equal(called, 0);
});
test("rejects a source outside the exact host allowlist before fetching", async () => {
  let fetched = false;
  const result = await discoverOfficialArtifacts({ query: async () => ({ rows: [], rowCount: 0 }) }, sourceId, "https://evil.example/page", {
    allowedHosts, fetcher: async () => { fetched = true; return new Response(""); }
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(fetched, false);
});
