/**
 * Contratos de seleção de leiaute da NFS-e Nacional.
 *
 * A matriz registra somente releases confirmados por comunicado oficial.
 * Não inferir a implantação de um release a partir da mera publicação de XSD.
 */

export type NfseEnvironment = 'PRODUCTION' | 'RESTRICTED';

export type NfseLayoutId =
  | 'SNNFSE_PRODUCTION_NT004_NT007'
  | 'SNNFSE_RESTRICTED_NT009_1_0_RELEASE_1';

export interface NfseLayoutProfile {
  readonly id: NfseLayoutId;
  readonly environment: NfseEnvironment;
  readonly technicalRelease: string;
  readonly statusAsOf: string;
  readonly ibsCbsPolicy:
    | 'OPTIONAL_OPEN_GROUP'
    | 'REQUIRES_RELEASE_SCHEMA_VALIDATION';
  readonly fiscalEffect: 'VALID_FISCAL_DOCUMENT' | 'NO_FISCAL_EFFECT';
  readonly sourceUrl: string;
}

export const NFSE_LAYOUT_PROFILES: Readonly<Record<NfseEnvironment, NfseLayoutProfile>> = {
  PRODUCTION: {
    id: 'SNNFSE_PRODUCTION_NT004_NT007',
    environment: 'PRODUCTION',
    technicalRelease: 'NT 004 + domínio tpRetPisConfins da NT 007',
    statusAsOf: '2026-11-25',
    ibsCbsPolicy: 'OPTIONAL_OPEN_GROUP',
    fiscalEffect: 'VALID_FISCAL_DOCUMENT',
    sourceUrl: 'https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/',
  },
  RESTRICTED: {
    id: 'SNNFSE_RESTRICTED_NT009_1_0_RELEASE_1',
    environment: 'RESTRICTED',
    technicalRelease: 'NT 009 v1.00 — release 1',
    statusAsOf: '2026-11-25',
    ibsCbsPolicy: 'REQUIRES_RELEASE_SCHEMA_VALIDATION',
    fiscalEffect: 'NO_FISCAL_EFFECT',
    sourceUrl: 'https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/',
  },
} as const;

/**
 * Retorna apenas o perfil oficialmente identificado como implantado no
 * ambiente indicado na data de referência. Releases futuros precisam ser
 * adicionados explicitamente após confirmação do CGNFS-e.
 */
export function resolveNfseLayout(environment: NfseEnvironment): NfseLayoutProfile {
  return NFSE_LAYOUT_PROFILES[environment];
}

export type ProductionIbsCbsAssessment =
  | {
      readonly status: 'OMITTED';
      readonly technicalAcceptance: 'NOT_REJECTED_FOR_OMISSION';
      readonly legalConclusion: 'NOT_EVALUATED';
    }
  | {
      readonly status: 'INCOMPLETE';
      readonly technicalAcceptance: 'LOCAL_REJECTION';
      readonly legalConclusion: 'NOT_EVALUATED';
      readonly reason: 'IBS_CBS_GROUP_REQUIRES_COMPLETE_FIELDS_WHEN_INFORMED';
    }
  | {
      readonly status: 'COMPLETE';
      readonly technicalAcceptance: 'READY_FOR_SCHEMA_AND_BUSINESS_VALIDATION';
      readonly legalConclusion: 'NOT_EVALUATED';
    };

/**
 * Aplica exclusivamente a diretriz técnica de produção comunicada em
 * 29/10/2026. A função não determina se o contribuinte está obrigado a
 * informar IBS/CBS e não interpreta ausência como isenção ou alíquota zero.
 */
export function assessProductionIbsCbsGroup(input: {
  readonly provided: boolean;
  readonly complete?: boolean;
}): ProductionIbsCbsAssessment {
  if (!input.provided) {
    return {
      status: 'OMITTED',
      technicalAcceptance: 'NOT_REJECTED_FOR_OMISSION',
      legalConclusion: 'NOT_EVALUATED',
    };
  }

  if (input.complete !== true) {
    return {
      status: 'INCOMPLETE',
      technicalAcceptance: 'LOCAL_REJECTION',
      legalConclusion: 'NOT_EVALUATED',
      reason: 'IBS_CBS_GROUP_REQUIRES_COMPLETE_FIELDS_WHEN_INFORMED',
    };
  }

  return {
    status: 'COMPLETE',
    technicalAcceptance: 'READY_FOR_SCHEMA_AND_BUSINESS_VALIDATION',
    legalConclusion: 'NOT_EVALUATED',
  };
}
