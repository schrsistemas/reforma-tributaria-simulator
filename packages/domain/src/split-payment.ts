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
