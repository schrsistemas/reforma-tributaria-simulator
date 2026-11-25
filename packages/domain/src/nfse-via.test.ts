import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFSE_VIA_TECHNICAL_PROFILE,
  assessNfseViaManifestationSelection,
  assessNfseViaSubmission,
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
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.transportProtocol, 'HTTPS_MUTUAL_TLS');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.tlsVersionPolicy, 'MANUAL_CONFLICT_TLS_1_2_PLUS_VS_TLS_1_0_TO_1_2');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.runtimeTlsMinimum, 'NOT_VERIFIED');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.apiMessageFormat, 'JSON');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.documentFormat, 'XML_1_0_UTF8');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.documentSignature, 'XMLDSIG_ENVELOPED');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.signatureAlgorithm, 'RSA_SHA256');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.digestAlgorithm, 'SHA256');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.canonicalizationAlgorithm, 'C14N');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.certificateAuthority, 'ICP_BRASIL');
  assert.deepEqual(NFSE_VIA_TECHNICAL_PROFILE.certificateTypes, ['A1', 'A3']);
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.certificateUsage, 'E_CNPJ_E_APLICACAO');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.compressionFormat, 'GZIP_BASE64');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.processingMode, 'ASYNCHRONOUS');
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.receiptImpliesAuthorization, false);
  assert.equal(NFSE_VIA_TECHNICAL_PROFILE.apiGuideUrl, 'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/manuais-e-anexos/anexo-ii-guia-para-utilizacao-das-apis-v-1-02.pdf');
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

test('recepção positiva sem resultado final permanece pendente', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'RECEIVED',
    processing: 'NOT_AVAILABLE',
  }), {
    status: 'RECEIVED_PENDING_PROCESSING',
    documentAuthorized: false,
  });
});

test('recepção positiva com processamento pendente não autoriza documento', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'RECEIVED',
    processing: 'PENDING',
  }), {
    status: 'RECEIVED_PENDING_PROCESSING',
    documentAuthorized: false,
  });
});

test('somente resultado final positivo do processamento autoriza documento', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'RECEIVED',
    processing: 'ACCEPTED',
  }), {
    status: 'DOCUMENT_ACCEPTED',
    documentAuthorized: true,
  });
});

test('resultado final negativo do processamento rejeita documento', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'RECEIVED',
    processing: 'REJECTED',
  }), {
    status: 'DOCUMENT_REJECTED',
    documentAuthorized: false,
  });
});

test('rejeição na recepção não é confundida com rejeição fiscal posterior', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'REJECTED',
    processing: 'NOT_AVAILABLE',
  }), {
    status: 'TRANSMISSION_REJECTED',
    documentAuthorized: false,
  });
});

test('resposta de processamento sem recepção positiva é inconsistente', () => {
  assert.deepEqual(assessNfseViaSubmission({
    receipt: 'REJECTED',
    processing: 'ACCEPTED',
  }), {
    status: 'INCONSISTENT_RESPONSE',
    documentAuthorized: false,
    reason: 'PROCESSING_RESULT_WITHOUT_SUCCESSFUL_RECEIPT',
  });
});
