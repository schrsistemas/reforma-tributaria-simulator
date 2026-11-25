import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_IBS_CBS_OBLIGATION_CALENDAR,
  resolveNfseIbsCbsObligation,
} from './nfse-obligation-calendar.ts';

test('serviços gerais fora das exceções mantêm datas distintas por regime', () => {
  assert.equal(
    resolveNfseIbsCbsObligation('ISS_SERVICES_OUTSIDE_EXCEPTIONS', 'GENERAL').startsOn,
    '2026-10-01',
  );
  assert.equal(
    resolveNfseIbsCbsObligation('ISS_SERVICES_OUTSIDE_EXCEPTIONS', 'SIMPLES_NACIONAL').startsOn,
    '2027-01-01',
  );
});

test('hipóteses de janeiro de 2027 estão registradas para os dois regimes', () => {
  const categories = [
    'INTANGIBLE_GOODS_OUTSIDE_LC116',
    'CONDOMINIUM_REVENUE',
    'LEASES_AND_ASSIGNMENTS',
    'RESIDUAL_SERVICES',
  ] as const;

  for (const category of categories) {
    for (const regime of ['GENERAL', 'SIMPLES_NACIONAL'] as const) {
      assert.equal(resolveNfseIbsCbsObligation(category, regime).startsOn, '2027-01-01');
    }
  }
});

test('plataformas digitais e subitens específicos iniciam em março de 2027', () => {
  const categories = [
    'DIGITAL_PLATFORMS',
    'LC116_SUBITEMS_1_03_1_05_1_09',
    'LC116_SUBITEM_16_01',
  ] as const;

  for (const category of categories) {
    for (const regime of ['GENERAL', 'SIMPLES_NACIONAL'] as const) {
      assert.equal(resolveNfseIbsCbsObligation(category, regime).startsOn, '2027-03-01');
    }
  }
});

test('todas as entradas mantêm referência normativa oficial', () => {
  assert.equal(NFSE_IBS_CBS_OBLIGATION_CALENDAR.length, 16);
  for (const item of NFSE_IBS_CBS_OBLIGATION_CALENDAR) {
    assert.match(item.sourceUrl, /^https:\/\/www\.gov\.br\/nfse\//);
    assert.ok(item.legalSummary.length > 0);
  }
});
