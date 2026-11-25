import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_VIA_TECHNICAL_PROFILE,
  assessNfseViaManifestationSelection,
} from './nfse-via.ts';

test('perfil NFS-e Via registra versões e datas oficiais da NT 010', () => {
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.technicalNote, 'NT 010');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.technicalNoteVersion, '1.00');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.nfseViaLayoutVersion, '1.01');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.buyerManifestationEventVersion, '1.00');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.manualVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.concessionairesParameterGuideVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.apiGuideVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.homologatorGuideVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.rnAdnLayoutVersion, '1.00.05');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.municipalityApiGuideVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.buyerManifestationGuideVersion, '1.02');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.manualsAndAnnexesUrl, 'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/manuais-e-anexos');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.officialEnvironmentLinksUrl, 'https://www.gov.br/nfse/pt-br/nfs-e-via/links');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.noChargePaymentModalityCode, '6');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.restrictedAvailableFrom, '2026-10-05');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.productionAvailableFrom, '2026-10-19');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.runtimeVerification, 'NOT_PROBED');
});

test('manifestação de aceite é válida quando selecionada isoladamente', () => {
  assert.deepEqual(assessNfseViaManifestationSelection({ accept: true, reject: false }), {
    status: 'ACCEPT',
    selected: 'ACCEPT',
    valid: true,
  });
});

test('manifestação de rejeição é válida quando selecionada isoladamente', () => {
  assert.deepEqual(assessNfseViaManifestationSelection({ accept: false, reject: true }), {
    status: 'REJECT',
    selected: 'REJECT',
    valid: true,
  });
});

test('manifestação simultânea de aceite e rejeição é bloqueada', () => {
  assert.deepEqual(assessNfseViaManifestationSelection({ accept: true, reject: true }), {
    status: 'CONFLICT',
    selected: null,
    valid: false,
    reason: 'ACCEPT_AND_REJECT_ARE_MUTUALLY_EXCLUSIVE',
  });
});

test('manifestação sem escolha é bloqueada', () => {
  assert.deepEqual(assessNfseViaManifestationSelection({ accept: false, reject: false }), {
    status: 'MISSING',
    selected: null,
    valid: false,
    reason: 'SELECT_EXACTLY_ONE_MANIFESTATION',
  });
});
