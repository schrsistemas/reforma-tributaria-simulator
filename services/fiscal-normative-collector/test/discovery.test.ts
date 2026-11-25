import test from "node:test";
import assert from "node:assert/strict";
import { discoverArtifactCandidates } from "../src/discovery.js";

const hosts = new Set(["www.gov.br", "www.nfe.fazenda.gov.br"]);

test("resolves relative links and keeps only supported document extensions", () => {
  const html = `
    <a href="../docs/manual.pdf?download=1#page=2">Manual oficial</a>
    <a href="/schemas/evento.xsd">Esquema XSD</a>
    <a href="/schema.xml">XML</a>
    <a href="/data.json">JSON</a>
    <a href="/noticia">Notícia</a>
  `;
  const found = discoverArtifactCandidates(html, "https://www.gov.br/portal/index.html", hosts);
  assert.deepEqual(found.map(item => item.url), [
    "https://www.gov.br/docs/manual.pdf?download=1",
    "https://www.gov.br/schemas/evento.xsd",
    "https://www.gov.br/schema.xml",
    "https://www.gov.br/data.json"
  ]);
  assert.equal(found[0]?.linkText, "Manual oficial");
});

test("deduplicates canonical URLs and decodes HTML-escaped query strings", () => {
  const html = `
    <a href="/manual.pdf?a=1&amp;b=2#top">Primeiro</a>
    <a href="/manual.pdf?a=1&amp;b=2">Segundo</a>
  `;
  const found = discoverArtifactCandidates(html, "https://www.gov.br/", hosts);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.url, "https://www.gov.br/manual.pdf?a=1&b=2");
  assert.equal(found[0]?.linkText, "Primeiro");
});

test("rejects javascript, data, HTTP, credentials, external hosts and nonstandard ports", () => {
  const html = `
    <a href="javascript:alert(1)">script</a>
    <a href="data:text/plain,x">data</a>
    <a href="http://www.gov.br/a.pdf">http</a>
    <a href="https://user:pass@www.gov.br/a.pdf">credentials</a>
    <a href="https://attacker.example/a.pdf">external</a>
    <a href="https://www.gov.br:8443/a.pdf">port</a>
  `;
  assert.deepEqual(discoverArtifactCandidates(html, "https://www.gov.br/", hosts), []);
});

test("does not accept a source page outside the allowlist", () => {
  assert.deepEqual(
    discoverArtifactCandidates('<a href="/manual.pdf">Manual</a>', "https://attacker.example/", hosts),
    []
  );
});

test("preserves allowed cross-host official links and rejects links without href", () => {
  const html = `
    <a href="https://www.nfe.fazenda.gov.br/portal/exemplo.xml">Leiaute</a>
    <a>Sem destino</a>
  `;
  const found = discoverArtifactCandidates(html, "https://www.gov.br/", hosts);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.url, "https://www.nfe.fazenda.gov.br/portal/exemplo.xml");
});
