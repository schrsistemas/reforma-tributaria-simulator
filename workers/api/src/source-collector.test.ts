import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFiscalSource } from './source-collector.js';

function createDatabase(sourceLastHash: string | null = null) {
  const statements: string[] = [];
  const source = {
    id: 'source-1',
    authority: 'Receita Federal',
    name: 'Fonte fiscal oficial',
    source_type: 'LAW',
    official_url: 'https://example.gov.br/legislacao',
    collection_method: 'HTTP',
    cadence: 'DAILY',
    enabled: 1,
    last_checked_at: null,
    last_success_at: null,
    last_hash: sourceLastHash,
  };

  const db = {
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind(..._values: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM fiscal_sources WHERE id = ?')) return source;
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, statements };
}

test('collector captures official source and persists evidence metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html> legislação fiscal </html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  try {
    const { db, statements } = createDatabase();
    const result = await collectFiscalSource({ DB: db }, 'source-1');

    assert.equal(result.sourceId, 'source-1');
    assert.equal(result.status, 'CREATED');
    assert.match(result.contentHash, /^[a-f0-9]{64}$/);
    assert.match(result.normalizedHash, /^[a-f0-9]{64}$/);
    assert.match(result.contentLocation ?? '', /^memory:\/\/source-1-/);
    assert.ok(statements.some((sql) => sql.includes('INSERT OR IGNORE INTO fiscal_evidence')));
    assert.ok(statements.some((sql) => sql.includes('UPDATE fiscal_sources SET last_checked_at')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collector rejects non-successful upstream responses and records failed check', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });

  try {
    const { db, statements } = createDatabase();
    await assert.rejects(
      () => collectFiscalSource({ DB: db }, 'source-1'),
      /SOURCE_HTTP_503/,
    );
    assert.ok(statements.some((sql) => sql.includes('UPDATE fiscal_sources SET last_checked_at = ?, updated_at = ?')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
