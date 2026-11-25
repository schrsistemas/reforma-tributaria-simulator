import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_LAYOUT_PROFILES,
  resolveNfseLayout,
  assessProductionIbsCbsGroup,
} from './nfse.js';

test('produção seleciona NT 004 acrescida do domínio NT 007', () => {
  const profile = resolveNfseLayout('PRODUCTION');
  assert.equal(profile.id, 'SNNFSE_PRODUCTION_NT004_NT007');
  assert.equal(profile.fiscalEffect, 'VALID_FISCAL_DOCUMENT');
  assert.equal(profile.ibsCbsPolicy, 'OPTIONAL_OPEN_GROUP');
});

test('produção restrita seleciona somente NT 009 v1.00 release 1 confirmado', () => {
  const profile = resolveNfseLayout('RESTRICTED');
  assert.equal(profile.id, 'SNNFSE_RESTRICTED_NT009_1_0_RELEASE_1');
  assert.equal(profile.fiscalEffect, 'NO_FISCAL_EFFECT');
  assert.match(profile.technicalRelease, /release 1/);
});

test('a matriz não presume que NT 009 v1.01 release 2 já esteja implantada', () => {
  assert.equal(Object.keys(NFSE_LAYOUT_PROFILES).length, 2);
  assert.equal(
    NFSE_LAYOUT_PROFILES.RESTRICTED.technicalRelease,
    'NT 009 v1.00 — release 1',
  );
});

test('grupo IBS/CBS omitido não é interpretado como isenção ou alíquota zero', () => {
  assert.deepEqual(assessProductionIbsCbsGroup({ provided: false }), {
    status: 'OMITTED',
    technicalAcceptance: 'NOT_REJECTED_FOR_OMISSION',
    legalConclusion: 'NOT_EVALUATED',
  });
});

test('grupo IBS/CBS informado parcialmente é rejeitado localmente', () => {
  const result = assessProductionIbsCbsGroup({ provided: true, complete: false });
  assert.equal(result.status, 'INCOMPLETE');
  assert.equal(result.technicalAcceptance, 'LOCAL_REJECTION');
});

test('grupo IBS/CBS completo segue para validação de schema e negócio', () => {
  const result = assessProductionIbsCbsGroup({ provided: true, complete: true });
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.technicalAcceptance, 'READY_FOR_SCHEMA_AND_BUSINESS_VALIDATION');
  assert.equal(result.legalConclusion, 'NOT_EVALUATED');
});

test('perfis mantêm a referência oficial usada na classificação', () => {
  for (const profile of Object.values(NFSE_LAYOUT_PROFILES)) {
    assert.match(profile.sourceUrl, /^https:\/\//);
    assert.equal(profile.statusAsOf, '2026-11-25');
  }
});
