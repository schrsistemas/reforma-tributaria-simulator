import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument, chunkLegalDocument, hashDocument, normalizeDocumentText, extractOfficialDates } from './rag-ingestion.js';

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
  const html = `<html><head><meta property="article:published_time" content="2026-01-15T10:00:00Z"></head><body>Lei Complementar nº 214/2025. Esta norma entra em vigor em 01/03/2026.</body></html>`;
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-01-15',
    publishedAtSource: 'HTML_META',
    effectiveFrom: '2026-03-01',
    effectiveFromSource: 'EXPLICIT_TEXT',
    effectiveTo: undefined,
    effectiveToSource: 'UNKNOWN',
  });
});

test('uses publication date as effective date only for explicit publication clause', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","datePublished":"2026-02-10"}</script><p>Lei Complementar nº 214/2025. Esta lei entra em vigor na data de sua publicação.</p>`;
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-02-10',
    publishedAtSource: 'JSON_LD',
    effectiveFrom: '2026-02-10',
    effectiveFromSource: 'PUBLICATION_DATE_CLAUSE',
    effectiveTo: undefined,
    effectiveToSource: 'UNKNOWN',
  });
});

test('does not infer legal dates from arbitrary page dates or invalid dates', () => {
  const html = '<html><body>Atualizado em 12/02/2026. Entra em vigor em 31/02/2026.</body></html>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAtSource: 'RETRIEVAL_FALLBACK',
    effectiveFromSource: 'UNKNOWN',
    effectiveToSource: 'UNKNOWN',
  });
});

test('recognizes explicit ISO publication date text and Brazilian effective date', () => {
  const html = '<p>Lei Complementar nº 214/2025. Publicado em 2026-04-02. Produz efeitos a partir de 15/04/2026.</p>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: '2026-04-02',
    publishedAtSource: 'EXPLICIT_TEXT',
    effectiveFrom: '2026-04-15',
    effectiveFromSource: 'EXPLICIT_TEXT',
    effectiveTo: undefined,
    effectiveToSource: 'UNKNOWN',
  });
});

test('extracts end of effectiveness only from explicit validity wording', () => {
  const html = '<p>Lei Complementar nº 214/2025. Vigência até 31/12/2026.</p>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAt: undefined,
    publishedAtSource: 'RETRIEVAL_FALLBACK',
    effectiveFromSource: 'UNKNOWN',
    effectiveTo: '2026-12-31',
    effectiveToSource: 'EXPLICIT_TEXT',
  });
});

test('does not assign dates from a page listing multiple legal instruments', () => {
  const html = '<p>Lei nº 1/2025 publicada em 01/01/2025.</p><p>Lei nº 2/2025 publicada em 02/02/2025.</p>';
  assert.deepEqual(extractOfficialDates(html), {
    publishedAtSource: 'RETRIEVAL_FALLBACK',
    effectiveFromSource: 'UNKNOWN',
    effectiveToSource: 'UNKNOWN',
  });
});


test('keeps articles and their caput in separate semantic chunks', () => {
  const chunks = chunkLegalDocument([
    'Art. 1º Esta Lei institui o sistema.',
    'Art. 2º Esta Lei define as competências.',
  ].join('\n'));
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].units[0].article, 'Art. 1º');
  assert.equal(chunks[1].units[0].article, 'Art. 2º');
  assert.ok(chunks.every((chunk) => chunk.structure === 'LEGAL'));
});

test('separates paragraphs, roman items and lettered subitems', () => {
  const chunks = chunkLegalDocument([
    'Art. 1º Texto do caput.',
    '§ 1º Texto do parágrafo.',
    'I - Texto do inciso.',
    'a) Texto da alínea.',
  ].join('\n'));
  assert.deepEqual(chunks.map((chunk) => chunk.units[0].type), [
    'ARTICLE_CAPUT', 'PARAGRAPH', 'ITEM', 'ALINEA',
  ]);
  assert.ok(chunks.every((chunk) => chunk.units[0].article === 'Art. 1º'));
  assert.equal(chunks[1].units[0].paragraph, '§ 1º');
  assert.equal(chunks[2].units[0].item, 'I');
  assert.equal(chunks[3].units[0].alinea, 'a');
});

test('keeps annex tables grouped and separate from legal prose', () => {
  const chunks = chunkLegalDocument([
    'ANEXO I',
    'Código | Descrição',
    '001 | Serviço A',
    '002 | Serviço B',
    'Art. 1º Regra posterior.',
  ].join('\n'));
  assert.equal(chunks[0].units[0].type, 'ANNEX');
  assert.equal(chunks[1].units[0].type, 'TABLE');
  assert.equal(chunks[1].text.split('\n').length, 3);
  assert.equal(chunks[2].units[0].type, 'ARTICLE_CAPUT');
});

test('uses character fallback for documents without legal structure', () => {
  const chunks = chunkLegalDocument('Manual operacional\nProcedimento de consulta\nEtapa final', 12, 2);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.structure === 'FALLBACK'));
  assert.ok(chunks.every((chunk) => chunk.units[0].type === 'FALLBACK'));
});

test('splits oversized legal devices without crossing their article boundary', () => {
  const chunks = chunkLegalDocument(
    'Art. 7º ' + 'texto normativo '.repeat(12) + '\nArt. 8º Texto independente.',
    50,
    10,
  );
  const articleSeven = chunks.filter((chunk) => chunk.units[0].article === 'Art. 7º');
  const articleEight = chunks.filter((chunk) => chunk.units[0].article === 'Art. 8º');
  assert.ok(articleSeven.length > 1);
  assert.equal(articleEight.length, 1);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 50));
});


test('parses HTML block tags and preserves table row boundaries', () => {
  const html = [
    '<html><body>',
    '<h2>CAPÍTULO I</h2>',
    '<p><strong>Art. 1º</strong> Texto inicial.</p>',
    '<p>&sect; 1º Texto do parágrafo.</p>',
    '<table><tr><th>Código</th><th>Descrição</th></tr>',
    '<tr><td>001</td><td>Serviço A</td></tr></table>',
    '</body></html>',
  ].join('');
  const chunks = chunkLegalDocument(html);
  assert.ok(chunks.some((chunk) => chunk.units[0].type === 'ARTICLE_CAPUT'));
  assert.ok(chunks.some((chunk) => chunk.units[0].type === 'PARAGRAPH'));
  const table = chunks.find((chunk) => chunk.units[0].type === 'TABLE');
  assert.ok(table);
  assert.match(table.text, /Código\s+\|\s+Descrição/);
  assert.match(table.text, /001\s+\|\s+Serviço A/);
});

test('does not treat isolated roman numbering as sufficient legal structure', () => {
  const chunks = chunkLegalDocument('I - Introdução\nII - Procedimento\nIII - Encerramento');
  assert.ok(chunks.every((chunk) => chunk.structure === 'FALLBACK'));
});
