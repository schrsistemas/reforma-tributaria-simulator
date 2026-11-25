import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument, hashDocument, normalizeDocumentText, extractOfficialDates } from './rag-ingestion.js';

test('normalizes line endings, whitespace and excessive blank lines', () => {
  assert.equal(
    normalizeDocumentText('  Art. 1\r\n\r\n\r\n  texto   legal  '),
    'Art. 1\n\n texto legal',
  );
});

test('returns no chunks for empty normalized input', () => {
  assert.deepEqual(chunkDocument('  \n  '), []);
});

test('splits content with bounded overlap and preserves every character', () => {
  const chunks = chunkDocument('0123456789', 4, 2);
  assert.deepEqual(chunks, ['0123', '2345', '4567', '6789']);
  assert.ok(chunks.every((chunk) => chunk.length <= 4));
});

test('normalizes invalid chunk limits and prevents excessive overlap', () => {
  const chunks = chunkDocument('abcdefghijklmnopqrst', 4, 1000);
  assert.ok(chunks.length <= 10);
  assert.ok(chunks.every((chunk) => chunk.length <= 4));
  assert.equal(chunks[0], 'abcd');
  assert.equal(chunks.at(-1), 'qrst');
});

test('falls back to defaults for non-finite chunk limits', () => {
  const chunks = chunkDocument('a'.repeat(2000), Number.NaN, Number.POSITIVE_INFINITY);
  assert.equal(chunks[0].length, 1800);
  assert.equal(chunks.at(-1)?.length, 450);
});

test('hash is stable for equivalent normalized text', async () => {
  assert.equal(
    await hashDocument('Art. 1\r\ntexto   legal'),
    await hashDocument('Art. 1\ntexto legal'),
  );
});

test('extracts publication and effective dates only from explicit legal metadata', () => {
  const html = `<html><head><meta property="article:published_time" content="2026-01-15T10:00:00Z"></head><body>Esta norma entra em vigor em 01/03/2026.</body></html>`;
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-01-15',
    publishedAtSource: 'HTML_META',
    effectiveFrom: '2026-03-01',
    effectiveFromSource: 'EXPLICIT_TEXT',
  });
});

test('uses publication date as effective date only for explicit publication clause', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","datePublished":"2026-02-10"}</script><p>Esta lei entra em vigor na data de sua publicação.</p>`;
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-02-10',
    publishedAtSource: 'JSON_LD',
    effectiveFrom: '2026-02-10',
    effectiveFromSource: 'PUBLICATION_DATE_CLAUSE',
  });
});

test('does not infer legal dates from arbitrary page dates or invalid dates', () => {
  const html = '<html><body>Atualizado em 12/02/2026. Entra em vigor em 31/02/2026.</body></html>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAtSource: 'RETRIEVAL_FALLBACK',
    effectiveFromSource: 'UNKNOWN',
  });
});

test('recognizes explicit ISO publication date text and Brazilian effective date', () => {
  const html = '<p>Publicado em 2026-04-02. Produz efeitos a partir de 15/04/2026.</p>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-04-02',
    publishedAtSource: 'EXPLICIT_TEXT',
    effectiveFrom: '2026-04-15',
    effectiveFromSource: 'EXPLICIT_TEXT',
  });
});
