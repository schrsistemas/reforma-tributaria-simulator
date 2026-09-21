export type SplitPaymentInstrument =
  | 'CARD'
  | 'PIX'
  | 'BOLETO'
  | 'TRANSFER'
  | 'TEF'
  | 'OTHER';

export type SplitPaymentSettlementMode = 'STANDARD' | 'SIMPLIFIED';

export interface SplitPaymentTaxAmounts {
  IBS?: string;
  CBS?: string;
}

export interface SplitPaymentContext {
  paymentInstrument: SplitPaymentInstrument;
  settlementMode: SplitPaymentSettlementMode;
  fiscalDocumentId?: string;
  paymentTransactionId?: string;
  taxesAlreadyExtinguished?: SplitPaymentTaxAmounts;
}

export const SPLIT_PAYMENT_INSTRUMENTS: readonly SplitPaymentInstrument[] = [
  'CARD',
  'PIX',
  'BOLETO',
  'TRANSFER',
  'TEF',
  'OTHER',
];

export const SPLIT_PAYMENT_SETTLEMENT_MODES: readonly SplitPaymentSettlementMode[] = [
  'STANDARD',
  'SIMPLIFIED',
];

export const SPLIT_PAYMENT_EVENT_TYPES = [
  'PAYMENT_CREATED',
  'PAYMENT_LINKED_TO_FISCAL_DOCUMENT',
  'PAYMENT_LIQUIDATION_STARTED',
  'IBS_SEGREGATED',
  'CBS_SEGREGATED',
  'IBS_COLLECTED',
  'CBS_COLLECTED',
  'SUPPLIER_FUNDS_RELEASED',
  'ALLOCATION_SETTLED',
  'SUPPLIER_SETTLED',
  'ALLOCATION_REVERSED',
  'RECONCILIATION_PASSED',
  'RECONCILIATION_FAILED',
] as const;

export type SplitPaymentEventType = typeof SPLIT_PAYMENT_EVENT_TYPES[number];

export function isSplitPaymentInstrument(value: unknown): value is SplitPaymentInstrument {
  return typeof value === 'string' && SPLIT_PAYMENT_INSTRUMENTS.includes(value as SplitPaymentInstrument);
}

export function isSplitPaymentSettlementMode(value: unknown): value is SplitPaymentSettlementMode {
  return typeof value === 'string' && SPLIT_PAYMENT_SETTLEMENT_MODES.includes(value as SplitPaymentSettlementMode);
}

export interface SplitPaymentCalculation {
  grossAmount: string;
  taxDebits: Required<SplitPaymentTaxAmounts>;
  taxesAlreadyExtinguished: Required<SplitPaymentTaxAmounts>;
  segregatedTaxes: Required<SplitPaymentTaxAmounts>;
  supplierNetAmount: string;
}

function splitCents(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('INVALID_MONEY');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function splitMoney(value: bigint): string {
  return (value / 100n).toString() + '.' + (value % 100n).toString().padStart(2, '0');
}

/**
 * Calculates the amount available for segregation in the standard procedure.
 * Already-extinguished tax debt is deducted from the fiscal debit; the function
 * deliberately does not invent simplified-procedure percentages.
 */
export function calculateSplitPaymentAmounts(input: {
  grossAmount: string;
  taxDebits: SplitPaymentTaxAmounts;
  taxesAlreadyExtinguished?: SplitPaymentTaxAmounts;
}): SplitPaymentCalculation {
  const gross = splitCents(input.grossAmount);
  const ibsDebit = splitCents(input.taxDebits.IBS ?? '0.00');
  const cbsDebit = splitCents(input.taxDebits.CBS ?? '0.00');
  const ibsExtinguished = splitCents(input.taxesAlreadyExtinguished?.IBS ?? '0.00');
  const cbsExtinguished = splitCents(input.taxesAlreadyExtinguished?.CBS ?? '0.00');

  if (ibsExtinguished > ibsDebit || cbsExtinguished > cbsDebit) {
    throw new Error('EXTINGUISHED_TAX_EXCEEDS_TAX_DEBIT');
  }

  const ibs = ibsDebit - ibsExtinguished;
  const cbs = cbsDebit - cbsExtinguished;
  if (ibs + cbs > gross) throw new Error('ALLOCATIONS_EXCEED_GROSS_AMOUNT');

  return {
    grossAmount: splitMoney(gross),
    taxDebits: { IBS: splitMoney(ibsDebit), CBS: splitMoney(cbsDebit) },
    taxesAlreadyExtinguished: { IBS: splitMoney(ibsExtinguished), CBS: splitMoney(cbsExtinguished) },
    segregatedTaxes: { IBS: splitMoney(ibs), CBS: splitMoney(cbs) },
    supplierNetAmount: splitMoney(gross - ibs - cbs),
  };
}
