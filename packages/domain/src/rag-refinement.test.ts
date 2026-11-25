import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceConfidence,
  insufficientEvidence,
  lexicalScore,
  normalizeForSearch,
  rerank,
  temporalMatch,
  topicsOf,
  sourceTypeOf,
  type RagCandidate,
} from './rag-refinement.ts';

function candidate(overrides: Partial<RagCandidate> = {}): RagCandidate {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    text: 'A apuração do IBS considera o crédito tributário.',
    score: 0.5,
    sourceUrl: 'https://example.gov.br/norma',
    title: 'Norma fiscal',
    publishedAt: '2026-01-01',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    authority: 'Receita Federal',
    sourceType: 'LAW',
    topics: ['IBS', 'crédito tributário'],
    ...overrides,
  };
}

test('normaliza acentos e pontuação para busca lexical', () => {
  assert.equal(normalizeForSearch('Crédito tributário: apuração!'), 'credito tributario apuracao');
  assert.equal(lexicalScore('credito tributario', 'Crédito tributário na apuração'), 1);
});

test('retorna zero quando a consulta não contém tokens pesquisáveis', () => {
  assert.equal(lexicalScore('de e a', 'IBS e CBS'), 0);
});

test('respeita início e fim da vigência na data consultada', () => {
  const item = candidate();
  assert.equal(temporalMatch(item, '2026-01-01'), true);
  assert.equal(temporalMatch(item, '2026-12-31'), true);
  assert.equal(temporalMatch(item, '2027-01-01'), false);
  assert.equal(temporalMatch(item, 'data-invalida'), false);
});

test('prioriza evidência oficial relevante no reranking e mantém ordenação determinística', () => {
  const official = candidate({ id: 'official', authority: 'Receita Federal', sourceType: 'LAW' });
  const generic = candidate({
    id: 'generic',
    authority: 'Blog desconhecido',
    sourceType: 'NEWS',
    text: 'Informações gerais sem detalhamento da regra.',
    score: 0.5,
  });
  const ranked = rerank('IBS crédito tributário', [generic, official]);
  assert.equal(ranked[0].id, 'official');
  assert.ok(ranked[0].score >= ranked[1].score);
});

test('classifica confiança e insuficiência de evidência', () => {
  assert.equal(evidenceConfidence(0.8), 'HIGH');
  assert.equal(evidenceConfidence(0.4), 'MEDIUM');
  assert.equal(evidenceConfidence(0.1), 'LOW');
  assert.equal(insufficientEvidence(0), true);
  assert.equal(insufficientEvidence(1), false);
});

test('lê metadados RAG inválidos sem interromper a consulta', () => {
  assert.equal(sourceTypeOf('{invalid'), undefined);
  assert.equal(topicsOf('{invalid'), undefined);
  assert.deepEqual(topicsOf('{"topics":["IBS",3,"CBS"]}'), ['IBS', 'CBS']);
});

test('não usa horário de captura como início de vigência em consultas históricas', () => {
  const fallback = candidate({
    publishedAt: '2026-06-01T12:00:00.000Z',
    publishedAtSource: 'RETRIEVAL_FALLBACK',
    effectiveFrom: undefined,
    effectiveTo: undefined,
  });
  assert.equal(temporalMatch(fallback, '2026-07-01'), false);
});

test('usa publicação oficial como limite inferior apenas quando a origem é comprovada', () => {
  const officialPublication = candidate({
    publishedAt: '2026-06-01',
    publishedAtSource: 'HTML_META',
    effectiveFrom: undefined,
    effectiveTo: undefined,
  });
  assert.equal(temporalMatch(officialPublication, '2026-05-31'), false);
  assert.equal(temporalMatch(officialPublication, '2026-06-01'), true);
  assert.equal(temporalMatch(officialPublication, '2026-07-01'), true);
});

test('não aceita datas históricas inválidas ou fim de vigência inválido', () => {
  const item = candidate({ effectiveFrom: 'invalid', effectiveTo: undefined });
  assert.equal(temporalMatch(item, '2026-06-01'), false);
});
