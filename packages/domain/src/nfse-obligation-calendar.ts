/**
 * Calendário documental da obrigatoriedade de emissão da NFS-e com IBS/CBS.
 *
 * As datas refletem o comunicado do CGNFS-e de 13/11/2026 sobre o Ato
 * Conjunto RFB/CGIBS nº 7/2026. O módulo não classifica operações:
 * o chamador deve informar a categoria jurídica já apurada.
 */

export type NfseTaxRegime = 'GENERAL' | 'SIMPLES_NACIONAL';

export type NfseObligationCategory =
  | 'ISS_SERVICES_OUTSIDE_EXCEPTIONS'
  | 'INTANGIBLE_GOODS_OUTSIDE_LC116'
  | 'CONDOMINIUM_REVENUE'
  | 'LEASES_AND_ASSIGNMENTS'
  | 'RESIDUAL_SERVICES'
  | 'DIGITAL_PLATFORMS'
  | 'LC116_SUBITEMS_1_03_1_05_1_09'
  | 'LC116_SUBITEM_16_01';

export interface NfseIbsCbsObligationEntry {
  readonly category: NfseObligationCategory;
  readonly taxRegime: NfseTaxRegime;
  readonly startsOn: string;
  readonly legalSummary: string;
  readonly sourceUrl: string;
}

const SOURCE_URL =
  'https://www.gov.br/nfse/pt-br/noticias/cgnfs-e-informa-ato-conjunto-rfb-cgibs-no-7-2026-atualiza-o-cronograma-de-obrigatoriedade-de-emissao-da-nfs-e-para-ibs-e-cbs/';

function entry(
  category: NfseObligationCategory,
  taxRegime: NfseTaxRegime,
  startsOn: string,
  legalSummary: string,
): NfseIbsCbsObligationEntry {
  return { category, taxRegime, startsOn, legalSummary, sourceUrl: SOURCE_URL };
}

const GENERAL_ISS_SUMMARY =
  'Serviços sujeitos ao ISS da LC 116/2003 não abrangidos pelas hipóteses específicas escalonadas.';
const JANUARY_SUMMARY =
  'Hipótese escalonada para início da obrigatoriedade em 1º de janeiro de 2027.';
const MARCH_SUMMARY =
  'Hipótese escalonada para início da obrigatoriedade em 1º de março de 2027.';

export const NFSE_IBS_CBS_OBLIGATION_CALENDAR: readonly NfseIbsCbsObligationEntry[] = [
  entry(
    'ISS_SERVICES_OUTSIDE_EXCEPTIONS',
    'GENERAL',
    '2026-10-01',
    GENERAL_ISS_SUMMARY,
  ),
  entry(
    'ISS_SERVICES_OUTSIDE_EXCEPTIONS',
    'SIMPLES_NACIONAL',
    '2027-01-01',
    'Para optantes do Simples Nacional, hipótese enquadrada no escalonamento das alíneas d a h do inciso III.',
  ),
  ...(['GENERAL', 'SIMPLES_NACIONAL'] as const).flatMap((taxRegime) => [
    entry(
      'INTANGIBLE_GOODS_OUTSIDE_LC116',
      taxRegime,
      '2027-01-01',
      'Fornecimento de bens imateriais fora da lista da LC 116/2003 e não sujeito ao ICMS, inclusive nas imunidades indicadas no ato.',
    ),
    entry(
      'CONDOMINIUM_REVENUE',
      taxRegime,
      '2027-01-01',
      JANUARY_SUMMARY + ' Inclui taxas, valores condominiais e outras receitas do condomínio edilício.',
    ),
    entry(
      'LEASES_AND_ASSIGNMENTS',
      taxRegime,
      '2027-01-01',
      'Locações de bens móveis e locações, cessões onerosas e arrendamentos de bens imóveis, observadas as ressalvas do ato.',
    ),
    entry(
      'RESIDUAL_SERVICES',
      taxRegime,
      '2027-01-01',
      JANUARY_SUMMARY + ' Serviços não enquadrados nas demais hipóteses específicas.',
    ),
    entry(
      'DIGITAL_PLATFORMS',
      taxRegime,
      '2027-03-01',
      MARCH_SUMMARY + ' Serviços promovidos ou intermediados por plataformas digitais nos termos do art. 22 da LC 214/2025.',
    ),
    entry(
      'LC116_SUBITEMS_1_03_1_05_1_09',
      taxRegime,
      '2027-03-01',
      MARCH_SUMMARY + ' Subitens 1.03, 1.05 e 1.09 da lista anexa à LC 116/2003.',
    ),
    entry(
      'LC116_SUBITEM_16_01',
      taxRegime,
      '2027-03-01',
      MARCH_SUMMARY + ' Subitem 16.01 da lista anexa à LC 116/2003.',
    ),
  ]),
] as const;

/**
 * Retorna a data oficial da categoria/regime informados.
 * Não tenta inferir categoria, regime ou enquadramento tributário.
 */
export function resolveNfseIbsCbsObligation(
  category: NfseObligationCategory,
  taxRegime: NfseTaxRegime,
): NfseIbsCbsObligationEntry {
  const result = NFSE_IBS_CBS_OBLIGATION_CALENDAR.find(
    (item) => item.category === category && item.taxRegime === taxRegime,
  );

  if (!result) {
    throw new Error(
      `No NFS-e IBS/CBS obligation date for category "${category}" and regime "${taxRegime}".`,
    );
  }

  return result;
}
