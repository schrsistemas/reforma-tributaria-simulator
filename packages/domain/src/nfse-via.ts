/**
 * Perfil documental da NFS-e Via e da manifestação do adquirente.
 *
 * Este módulo registra somente os elementos explicitamente publicados na
 * NT 010. Não define XML, endpoints ou payloads de API não extraídos dos
 * artefatos oficiais (OpenAPI/XSD).
 */

export type NfseViaEnvironment = 'PRODUCTION' | 'RESTRICTED';

export interface NfseViaTechnicalProfile {
  readonly technicalNote: 'NT 010';
  readonly technicalNoteVersion: '1.00';
  readonly nfseViaLayoutVersion: '1.01';
  readonly buyerManifestationEventVersion: '1.00';
  readonly noChargePaymentModalityCode: '6';
  readonly restrictedAvailableFrom: '2026-10-05';
  readonly productionAvailableFrom: '2026-10-19';
  readonly runtimeVerification: 'NOT_PROBED';
  readonly documentationUrl: string;
}

export const NFSE_VIA_TECHNICAL_PROFILE: NfseViaTechnicalProfile = {
  technicalNote: 'NT 010',
  technicalNoteVersion: '1.00',
  nfseViaLayoutVersion: '1.01',
  buyerManifestationEventVersion: '1.00',
  noChargePaymentModalityCode: '6',
  restrictedAvailableFrom: '2026-10-05',
  productionAvailableFrom: '2026-10-19',
  runtimeVerification: 'NOT_PROBED',
  documentationUrl: 'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica',
} as const;

export type NfseViaManifestationKind = 'ACCEPT' | 'REJECT';

export type NfseViaManifestationAssessment =
  | {
      readonly status: 'ACCEPT';
      readonly selected: 'ACCEPT';
      readonly valid: true;
    }
  | {
      readonly status: 'REJECT';
      readonly selected: 'REJECT';
      readonly valid: true;
    }
  | {
      readonly status: 'MISSING';
      readonly selected: null;
      readonly valid: false;
      readonly reason: 'SELECT_EXACTLY_ONE_MANIFESTATION';
    }
  | {
      readonly status: 'CONFLICT';
      readonly selected: null;
      readonly valid: false;
      readonly reason: 'ACCEPT_AND_REJECT_ARE_MUTUALLY_EXCLUSIVE';
    };

/**
 * Valida a seleção funcional da manifestação antes de montar qualquer XML.
 * A função não representa o formato do evento nem substitui validação XSD.
 */
export function assessNfseViaManifestationSelection(input: {
  readonly accept: boolean;
  readonly reject: boolean;
}): NfseViaManifestationAssessment {
  if (input.accept && input.reject) {
    return {
      status: 'CONFLICT',
      selected: null,
      valid: false,
      reason: 'ACCEPT_AND_REJECT_ARE_MUTUALLY_EXCLUSIVE',
    };
  }

  if (!input.accept && !input.reject) {
    return {
      status: 'MISSING',
      selected: null,
      valid: false,
      reason: 'SELECT_EXACTLY_ONE_MANIFESTATION',
    };
  }

  if (input.accept) {
    return { status: 'ACCEPT', selected: 'ACCEPT', valid: true };
  }

  return { status: 'REJECT', selected: 'REJECT', valid: true };
}
