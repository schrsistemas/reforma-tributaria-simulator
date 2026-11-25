import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFiscalAgentToolRunner,
  executeFiscalTool,
  FiscalToolExecutionError,
} from './fiscal-tool-runner.js';

function emptyDb() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async all() { return { results: [] }; },
        async first() { return null; },
      };
    },
  } as unknown as D1Database;
}

test('executes pure credit eligibility rules without a database binding', async () => {
  const output = await executeFiscalTool({}, 'fiscal.get_credit_eligibility_rules', {});
  assert.ok(output.result && typeof output.result === 'object');
  assert.ok(Array.isArray((output.result as { rules: unknown[] }).rules));
  assert.deepEqual(output.warnings, []);
});

test('executes deterministic credit eligibility with typed input', async () => {
  const output = await executeFiscalTool({}, 'fiscal.evaluate_credit_eligibility', {
    category: 'GOODS',
    regularTaxpayer: true,
    electronicFiscalDocument: true,
    taxDebtExtinguished: true,
    economicActivityRelated: true,
  });
  assert.ok(output.result && typeof output.result === 'object');
  assert.ok(Array.isArray(output.warnings));
});

test('rejects database-backed tools when D1 is not bound', async () => {
  await assert.rejects(
    executeFiscalTool({}, 'fiscal.search_evidence', { query: 'IBS CBS' }),
    (error: unknown) => error instanceof FiscalToolExecutionError &&
      error.code === 'DATABASE_NOT_BOUND' && error.status === 503,
  );
});

test('returns explicit low-evidence warning for an empty RAG index', async () => {
  const output = await executeFiscalTool({ DB: emptyDb() }, 'fiscal.search_evidence', {
    query: 'Lei Complementar IBS CBS',
  });
  assert.equal((output.result as { confidence: string }).confidence, 'LOW');
  assert.deepEqual(output.warnings, ['EVIDENCE_CONFIDENCE_LOW']);
});

test('returns 404 when a requested RAG document does not exist', async () => {
  await assert.rejects(
    executeFiscalTool({ DB: emptyDb() }, 'fiscal.get_document', { documentId: 'missing-document' }),
    (error: unknown) => error instanceof FiscalToolExecutionError &&
      error.code === 'EVIDENCE_DOCUMENT_NOT_FOUND' && error.status === 404,
  );
});

test('returns a specific error when no published RuleSet covers the date', async () => {
  await assert.rejects(
    executeFiscalTool({ DB: emptyDb() }, 'fiscal.resolve_ruleset', { asOf: '2027-01-01' }),
    (error: unknown) => error instanceof Error && error.message === 'NO_PUBLISHED_RULESET',
  );
});

test('Agent Host adapter preserves tenant and request provenance', async () => {
  const runner = createFiscalAgentToolRunner({});
  const output = await runner.execute('fiscal.get_credit_eligibility_rules', {}, {
    tenantId: 'tenant-01',
    requestId: 'request-01',
    correlationId: 'correlation-01',
    signal: new AbortController().signal,
  });
  const provenance = (output as { provenance: Record<string, string> }).provenance;
  assert.deepEqual(provenance, {
    tenantId: 'tenant-01',
    requestId: 'request-01',
    correlationId: 'correlation-01',
    toolName: 'fiscal.get_credit_eligibility_rules',
  });
});

test('Agent Host adapter refuses already-aborted calls', async () => {
  const runner = createFiscalAgentToolRunner({});
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runner.execute('fiscal.get_credit_eligibility_rules', {}, {
      tenantId: 'tenant-01',
      requestId: 'request-01',
      correlationId: 'correlation-01',
      signal: controller.signal,
    }),
    (error: unknown) => error instanceof FiscalToolExecutionError &&
      error.code === 'AGENT_EXECUTION_ABORTED',
  );
});
