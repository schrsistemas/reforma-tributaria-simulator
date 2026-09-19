import type { DecimalString, TaxCode } from './types.js';

export type LedgerEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_LINKED'
  | 'ALLOCATION_CREATED'
  | 'ALLOCATION_SETTLED'
  | 'SUPPLIER_SETTLED'
  | 'ALLOCATION_REVERSED'
  | 'RECONCILIATION_PASSED'
  | 'RECONCILIATION_FAILED';

export interface LedgerEvent {
  eventId: string;
  eventType: LedgerEventType;
  schemaVersion: string;
  occurredAt: string;
  correlationId: string;
  idempotencyKey: string;
  aggregateId: string;
}

export interface TaxAllocation {
  tax: TaxCode;
  amount: DecimalString;
}

export interface PaymentSettlement {
  paymentId: string;
  operationId: string;
  calculationVersion: string;
  grossAmount: DecimalString;
  allocations: TaxAllocation[];
  supplierNetAmount: DecimalString;
}
