import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_VIA_API_CATALOG,
  resolveNfseViaApiProfile,
} from './nfse-via-api-catalog.ts';

test('catálogo NFS-e Via mantém Swagger de recepção separados por ambiente', () => {
  assert.equal(
    resolveNfseViaApiProfile('PRODUCTION', 'RECEIPT_AND_BUYER_MANIFESTATION').referenceUrl,
    'https://certificado.api.via.nfse.gov.br/recepcao/swagger/index.html',
  );
  assert.equal(
    resolveNfseViaApiProfile('RESTRICTED', 'RECEIPT_AND_BUYER_MANIFESTATION').referenceUrl,
    'https://producaorestrita.certificado.api.via.nfse.gov.br/recepcao/swagger/index.html',
  );
});

test('catálogo NFS-e Via registra Swagger de alíquota efetiva nos dois ambientes', () => {
  assert.equal(
    NFSE_VIA_API_CATALOG.PRODUCTION.CONCESSIONAIRE_EFFECTIVE_RATE.referenceKind,
    'SWAGGER',
  );
  assert.equal(
    NFSE_VIA_API_CATALOG.RESTRICTED.CONCESSIONAIRE_EFFECTIVE_RATE.referenceKind,
    'SWAGGER',
  );
});

test('catálogo não declara probe de runtime concluído', () => {
  for (const environment of ['PRODUCTION', 'RESTRICTED'] as const) {
    for (const profile of Object.values(NFSE_VIA_API_CATALOG[environment])) {
      assert.equal(profile.runtimeVerification, 'NOT_PROBED');
    }
  }
});
