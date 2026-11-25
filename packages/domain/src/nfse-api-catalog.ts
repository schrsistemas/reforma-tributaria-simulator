/**
 * Catálogo oficial dos serviços da NFS-e Nacional por ambiente.
 *
 * Os endereços abaixo são os hosts/base paths publicados pelo portal oficial.
 * Não declarar paths de operação aqui: eles devem ser lidos dos OpenAPI
 * correspondentes, pois ADN, SEFIN e parametrização são APIs distintas.
 */

import type { NfseEnvironment } from './nfse.js';

export type NfseApiService =
  | 'ADN_CONTRIBUTORS'
  | 'SEFIN_NATIONAL'
  | 'MUNICIPAL_PARAMETERS';

export interface NfseApiProfile {
  readonly service: NfseApiService;
  readonly environment: NfseEnvironment;
  readonly baseUrl: string;
  readonly documentationUrl: string;
  readonly responsibility: string;
}

const PRODUCTION_API_PROFILES: Readonly<Record<NfseApiService, NfseApiProfile>> = {
  ADN_CONTRIBUTORS: {
    service: 'ADN_CONTRIBUTORS',
    environment: 'PRODUCTION',
    baseUrl: 'https://adn.nfse.gov.br',
    documentationUrl: 'https://adn.nfse.gov.br/contribuintes/docs/index.html',
    responsibility: 'Distribuição e consulta de documentos fiscais de serviço do ADN',
  },
  SEFIN_NATIONAL: {
    service: 'SEFIN_NATIONAL',
    environment: 'PRODUCTION',
    baseUrl: 'https://sefin.nfse.gov.br/SefinNacional',
    documentationUrl: 'https://sefin.nfse.gov.br/SefinNacional/docs/index',
    responsibility: 'Recepção da DPS e geração/consulta da NFS-e pela SEFIN Nacional',
  },
  MUNICIPAL_PARAMETERS: {
    service: 'MUNICIPAL_PARAMETERS',
    environment: 'PRODUCTION',
    baseUrl: 'https://adn.nfse.gov.br/parametrizacao',
    documentationUrl: 'https://adn.nfse.gov.br/parametrizacao/docs/index.html',
    responsibility: 'Consulta de parâmetros municipais necessários à composição da DPS',
  },
};

const RESTRICTED_API_PROFILES: Readonly<Record<NfseApiService, NfseApiProfile>> = {
  ADN_CONTRIBUTORS: {
    service: 'ADN_CONTRIBUTORS',
    environment: 'RESTRICTED',
    baseUrl: 'https://adn.producaorestrita.nfse.gov.br',
    documentationUrl: 'https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html',
    responsibility: 'Distribuição e consulta de documentos fiscais de serviço do ADN em testes',
  },
  SEFIN_NATIONAL: {
    service: 'SEFIN_NATIONAL',
    environment: 'RESTRICTED',
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional',
    documentationUrl: 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index',
    responsibility: 'Recepção da DPS e geração/consulta da NFS-e em ambiente de testes',
  },
  MUNICIPAL_PARAMETERS: {
    service: 'MUNICIPAL_PARAMETERS',
    environment: 'RESTRICTED',
    baseUrl: 'https://adn.producaorestrita.nfse.gov.br/parametrizacao',
    documentationUrl: 'https://adn.producaorestrita.nfse.gov.br/parametrizacao/docs/index.html',
    responsibility: 'Consulta de parâmetros municipais em ambiente de testes',
  },
};

export const NFSE_API_CATALOG: Readonly<
  Record<NfseEnvironment, Readonly<Record<NfseApiService, NfseApiProfile>>>
> = {
  PRODUCTION: PRODUCTION_API_PROFILES,
  RESTRICTED: RESTRICTED_API_PROFILES,
};

export function resolveNfseApiProfile(
  environment: NfseEnvironment,
  service: NfseApiService,
): NfseApiProfile {
  return NFSE_API_CATALOG[environment][service];
}
