/**
 * Contratos de seleção de leiaute da NFS-e Nacional.
 *
 * A matriz distingue o release comunicado como implantado do XSD mais novo
 * publicado para homologação. Publicação de schema não prova implantação
 * nem aceitação pelo runtime de um serviço.
 */

export type NfseEnvironment = 'PRODUCTION' | 'RESTRICTED';

export type NfseLayoutId =
  | 'SNNFSE_PRODUCTION_NT004_NT007'
  | 'SNNFSE_RESTRICTED_NT009_1_00_RELEASE_1';

export interface NfseLayoutProfile {
  readonly id: NfseLayoutId;
  readonly environment: NfseEnvironment;
  /** Release que o comunicado oficial identifica como implantado no ambiente. */
  readonly technicalRelease: string;
  /** Schema mais recente publicado para o ambiente, quando difere do release ativo comunicado. */
  readonly publishedSchema?: string;
  readonly statusAsOf: string;
  readonly ibsCbsPolicy:
    | 'OPTIONAL_OPEN_GROUP'
    | 'REQUIRES_RELEASE_SCHEMA_VALIDATION';
  readonly fiscalEffect: 'VALID_FISCAL_DOCUMENT' | 'NO_FISCAL_EFFECT';
  readonly runtimeVerification: 'NOT_PROBED' | 'CONFIRMED';
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
    runtimeVerification: 'NOT_PROBED',
    sourceUrl: 'https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/',
  },
  RESTRICTED: {
    id: 'SNNFSE_RESTRICTED_NT009_1_00_RELEASE_1',
    environment: 'RESTRICTED',
    technicalRelease: 'NT 009 v1.0 — release 1, conforme comunicado oficial publicado em 29/10/2026',
    publishedSchema: 'NT 009 v1.01 — XSD PRODREST publicado em 20/10/2026; release 2 ainda não comunicado como implantado',
    statusAsOf: '2026-11-25',
    ibsCbsPolicy: 'REQUIRES_RELEASE_SCHEMA_VALIDATION',
    fiscalEffect: 'NO_FISCAL_EFFECT',
    sourceUrl: 'https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/',
    runtimeVerification: 'NOT_PROBED',
  },
} as const;

/**
 * Retorna o perfil documental comunicado para o ambiente. A disponibilidade
 * do runtime deve ser verificada separadamente; runtimeVerification não é
 * promovido para CONFIRMED sem uma chamada de saúde/contrato bem-sucedida.
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
