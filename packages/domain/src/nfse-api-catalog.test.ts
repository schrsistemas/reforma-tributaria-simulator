import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_API_CATALOG,
  resolveNfseApiProfile,
} from './nfse-api-catalog.ts';

test('catálogo mantém APIs ADN, SEFIN e parâmetros municipais separadas', () => {
  assert.deepEqual(
    Object.keys(NFSE_API_CATALOG.PRODUCTION).sort(),
    ['ADN_CONTRIBUTORS', 'MUNICIPAL_PARAMETERS', 'SEFIN_NATIONAL'],
  );
});

test('emissão é direcionada à SEFIN e não ao endpoint de distribuição do ADN', () => {
  const sefin = resolveNfseApiProfile('PRODUCTION', 'SEFIN_NATIONAL');
  const adn = resolveNfseApiProfile('PRODUCTION', 'ADN_CONTRIBUTORS');
  assert.match(sefin.baseUrl, /sefin\.nfse\.gov\.br/);
  assert.match(sefin.responsibility, /Recepção da DPS/);
  assert.notEqual(sefin.baseUrl, adn.baseUrl);
});

test('produção restrita utiliza exclusivamente hosts de homologação', () => {
  for (const profile of Object.values(NFSE_API_CATALOG.RESTRICTED)) {
    assert.match(profile.baseUrl, /producaorestrita\.nfse\.gov\.br/);
    assert.equal(profile.environment, 'RESTRICTED');
  }
});

test('produção utiliza hosts oficiais sem sufixo de produção restrita', () => {
  for (const profile of Object.values(NFSE_API_CATALOG.PRODUCTION)) {
    assert.doesNotMatch(profile.baseUrl, /producaorestrita/);
    assert.equal(profile.environment, 'PRODUCTION');
  }
});

test('todos os perfis possuem documentação oficial HTTPS', () => {
  for (const env of Object.values(NFSE_API_CATALOG)) {
    for (const profile of Object.values(env)) {
      assert.match(profile.documentationUrl, /^https:\/\//);
      assert.match(profile.baseUrl, /^https:\/\//);
    }
  }
});
