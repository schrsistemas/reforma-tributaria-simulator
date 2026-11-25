/**
 * Catálogo oficial dos Swagger e referências da NFS-e Via.
 *
 * URLs reproduzidas da página oficial de links da NFS-e Via.
 * A presença de um Swagger no catálogo não significa que o contrato tenha
 * sido importado, autenticado ou validado em runtime.
 */

import type { NfseViaEnvironment } from './nfse-via.js';

export type NfseViaApiService =
  | 'RECEIPT_AND_BUYER_MANIFESTATION'
  | 'CONCESSIONAIRE_EFFECTIVE_RATE'
  | 'MUNICIPALITY';

export interface NfseViaApiProfile {
  readonly service: NfseViaApiService;
  readonly environment: NfseViaEnvironment;
  readonly referenceUrl: string;
  readonly referenceKind: 'SWAGGER' | 'OFFICIAL_ENDPOINT';
  readonly runtimeVerification: 'NOT_PROBED';
}

const PRODUCTION: Readonly<Record<NfseViaApiService, NfseViaApiProfile>> = {
  RECEIPT_AND_BUYER_MANIFESTATION: {
    service: 'RECEIPT_AND_BUYER_MANIFESTATION',
    environment: 'PRODUCTION',
    referenceUrl: 'https://certificado.api.via.nfse.gov.br/recepcao/swagger/index.html',
    referenceKind: 'SWAGGER',
    runtimeVerification: 'NOT_PROBED',
  },
  CONCESSIONAIRE_EFFECTIVE_RATE: {
    service: 'CONCESSIONAIRE_EFFECTIVE_RATE',
    environment: 'PRODUCTION',
    referenceUrl: 'https://certificado.api.via.nfse.gov.br/concessionarias/swagger/index.html',
    referenceKind: 'SWAGGER',
    runtimeVerification: 'NOT_PROBED',
  },
  MUNICIPALITY: {
    service: 'MUNICIPALITY',
    environment: 'PRODUCTION',
    referenceUrl: 'https://certificado.api.via.nfse.gov.br/municipio/aliquotas/municipio',
    referenceKind: 'OFFICIAL_ENDPOINT',
    runtimeVerification: 'NOT_PROBED',
  },
};

const RESTRICTED: Readonly<Record<NfseViaApiService, NfseViaApiProfile>> = {
  RECEIPT_AND_BUYER_MANIFESTATION: {
    service: 'RECEIPT_AND_BUYER_MANIFESTATION',
    environment: 'RESTRICTED',
    referenceUrl: 'https://producaorestrita.certificado.api.via.nfse.gov.br/recepcao/swagger/index.html',
    referenceKind: 'SWAGGER',
    runtimeVerification: 'NOT_PROBED',
  },
  CONCESSIONAIRE_EFFECTIVE_RATE: {
    service: 'CONCESSIONAIRE_EFFECTIVE_RATE',
    environment: 'RESTRICTED',
    referenceUrl: 'https://producaorestrita.certificado.api.via.nfse.gov.br/concessionarias/swagger/index.html',
    referenceKind: 'SWAGGER',
    runtimeVerification: 'NOT_PROBED',
  },
  MUNICIPALITY: {
    service: 'MUNICIPALITY',
    environment: 'RESTRICTED',
    referenceUrl: 'https://producaorestrita.certificado.api.via.nfse.gov.br/municipio/swagger/index.html',
    referenceKind: 'SWAGGER',
    runtimeVerification: 'NOT_PROBED',
  },
};

export const NFSE_VIA_API_CATALOG: Readonly<
  Record<NfseViaEnvironment, Readonly<Record<NfseViaApiService, NfseViaApiProfile>>>
> = {
  PRODUCTION,
  RESTRICTED,
};

export function resolveNfseViaApiProfile(
  environment: NfseViaEnvironment,
  service: NfseViaApiService,
): NfseViaApiProfile {
  return NFSE_VIA_API_CATALOG[environment][service];
}
