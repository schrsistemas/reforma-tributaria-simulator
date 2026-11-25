import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareSkillRuntime,
  SKILL_INSTRUCTIONS,
  SkillRuntimeError,
} from './skill-runtime.js';

const metadata = {
  requestId: 'request-test-001',
  correlationId: 'correlation-test-001',
};

test('prepares real IBS/CBS skill bundle with transitive dependencies', () => {
  const result = prepareSkillRuntime({
    query: 'Analisar IBS e CBS e calcular a transição',
    context: {
      operationDate: '2027-01-01',
      jurisdiction: 'BR',
      taxpayer: { regime: 'REGULAR' },
    },
  }, metadata);

  assert.equal(result.status, 'PREPARED');
  assert.equal(result.execution, 'NOT_EXECUTED');
  assert.equal(result.nextStep, 'HOST_AGENT_EXECUTION_REQUIRED');
  assert.ok(result.instructions.some(item => item.id === 'tributario-orchestrator'));
  assert.ok(result.instructions.some(item => item.id === 'ibs-cbs-transicao'));
  assert.ok(result.instructions.some(item => item.id === 'evidencia-legislacao-rag'));
  assert.ok(result.instructions.every(item => item.content.length > 0 && item.blobSha.length > 0));
  assert.ok(result.authorizedToolNames.includes('fiscal.search_evidence'));
  assert.ok(result.authorizedToolNames.includes('fiscal.calculate'));
  assert.deepEqual(result.context, {
    operationDate: '2027-01-01',
    jurisdiction: 'BR',
    taxpayer: { regime: 'REGULAR' },
  });
});

test('loads exactly the orchestrator instruction for unmatched requests', () => {
  const result = prepareSkillRuntime({
    query: 'tema sem gatilho fiscal reconhecido',
  }, metadata);

  assert.equal(result.status, 'NO_MATCH');
  assert.deepEqual(result.instructions.map(item => item.id), ['tributario-orchestrator']);
  assert.deepEqual(result.authorizedToolNames, []);
});

test('loads multiple domain instructions without duplicate dependencies', () => {
  const result = prepareSkillRuntime({
    query: 'Validar NF-e XML e analisar IBS CBS Split Payment',
  }, metadata);

  const ids = result.instructions.map(item => item.id);
  assert.ok(ids.includes('documentos-fiscais'));
  assert.ok(ids.includes('ibs-cbs-transicao'));
  assert.ok(ids.includes('split-payment'));
  assert.equal(ids.filter(id => id === 'evidencia-legislacao-rag').length, 1);
  assert.equal(new Set(result.authorizedToolNames).size, result.authorizedToolNames.length);
});

test('rejects non-object fiscal context', () => {
  assert.throws(
    () => prepareSkillRuntime({ query: 'IBS', context: [] as unknown as Record<string, unknown> }, metadata),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_CONTEXT_MUST_BE_OBJECT',
  );
});

test('rejects fiscal context larger than 64 KiB', () => {
  assert.throws(
    () => prepareSkillRuntime({ query: 'IBS', context: { payload: 'x'.repeat(65 * 1024) } }, metadata),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_CONTEXT_TOO_LARGE',
  );
});

test('rejects overlong query and missing correlation metadata', () => {
  assert.throws(
    () => prepareSkillRuntime({ query: 'x'.repeat(4001) }, metadata),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_QUERY_TOO_LONG',
  );
  assert.throws(
    () => prepareSkillRuntime({ query: 'IBS' }, { requestId: '', correlationId: '' }),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_RUNTIME_CORRELATION_REQUIRED',
  );
});

test('rejects a selected skill without a bundled instruction', () => {
  const modules = { ...SKILL_INSTRUCTIONS.modules };
  delete modules['ibs-cbs-transicao'];

  assert.throws(
    () => prepareSkillRuntime(
      { query: 'IBS CBS' },
      metadata,
      undefined,
      { ...SKILL_INSTRUCTIONS, modules },
    ),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_INSTRUCTION_NOT_BUNDLED:ibs-cbs-transicao',
  );
});

test('rejects instruction path mismatch', () => {
  const modules = {
    ...SKILL_INSTRUCTIONS.modules,
    'ibs-cbs-transicao': {
      ...SKILL_INSTRUCTIONS.modules['ibs-cbs-transicao'],
      path: 'skills/incorrect/SKILL.md',
    },
  };

  assert.throws(
    () => prepareSkillRuntime(
      { query: 'IBS CBS' },
      metadata,
      undefined,
      { ...SKILL_INSTRUCTIONS, modules },
    ),
    (error: unknown) => error instanceof SkillRuntimeError && error.code === 'SKILL_INSTRUCTION_PATH_MISMATCH:ibs-cbs-transicao',
  );
});

test('preserves bundle and source metadata for reproducibility', () => {
  const result = prepareSkillRuntime({ query: 'Imposto Seletivo' }, metadata);
  const selected = result.instructions.find(item => item.id === 'imposto-seletivo');
  assert.ok(selected);
  assert.equal(selected.path, 'skills/imposto-seletivo/SKILL.md');
  assert.equal(selected.blobSha, SKILL_INSTRUCTIONS.modules['imposto-seletivo'].blobSha);
  assert.ok(selected.content.includes('Imposto Seletivo'));
});
