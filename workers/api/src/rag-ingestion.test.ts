import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument, hashDocument, normalizeDocumentText } from './rag-ingestion.js';

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
  assert.deepEqual(chunks, ['0123', '23', '4567', '67', '89']);
  assert.ok(chunks.every((chunk) => chunk.length <= 4));
});

test('normalizes invalid chunk limits and prevents excessive overlap', () => {
  const chunks = chunkDocument('abcdefghijklmnopqrst', 4, 1000);
  assert.ok(chunks.length <= 10);
  assert.ok(chunks.every((chunk) => chunk.length <= 4));
  assert.equal(chunks[0], 'abcd');
  assert.equal(chunks.at(-1), 'st');
});

test('falls back to defaults for non-finite chunk limits', () => {
  const chunks = chunkDocument('a'.repeat(2000), Number.NaN, Number.POSITIVE_INFINITY);
  assert.equal(chunks[0].length, 1800);
  assert.equal(chunks.at(-1)?.length, 200);
});

test('hash is stable for equivalent normalized text', async () => {
  assert.equal(
    await hashDocument('Art. 1\r\ntexto   legal'),
    await hashDocument('Art. 1\ntexto legal'),
  );
});
