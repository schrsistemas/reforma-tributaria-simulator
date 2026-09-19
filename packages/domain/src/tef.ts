export type TefTransactionType = 'SALE' | 'REFUND' | 'CANCELLATION' | 'REVERSAL';

export type TefTransactionStatus =
  | 'INITIATED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'SETTLED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'TIMEOUT'
  | 'DUPLICATED';

export interface TefTransaction {
  id: string;
  operationId: string;
  idempotencyKey: string;
  provider: string;
  terminalId: string;
  type: TefTransactionType;
  status: TefTransactionStatus;
  amountMinor: number;
  currency: 'BRL';
  nsu?: string;
  authorizationCode?: string;
  externalReference?: string;
  fiscalSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface TefCommand {
  transactionId: string;
  idempotencyKey: string;
  requestedAt: string;
}

export interface TefEvent {
  id: string;
  transactionId: string;
  operationId: string;
  type: 'INITIATED' | 'AUTHORIZATION_REQUESTED' | 'AUTHORIZED' | 'DECLINED' | 'CAPTURED' | 'SETTLED' | 'CANCELLED' | 'REVERSED' | 'TIMEOUT';
  occurredAt: string;
  correlationId: string;
  payload: Record<string, string | number | boolean>;
}

const transitions: Record<TefTransactionStatus, readonly TefTransactionStatus[]> = {
  INITIATED: ['AUTHORIZING', 'CANCELLED', 'TIMEOUT'],
  AUTHORIZING: ['AUTHORIZED', 'DECLINED', 'TIMEOUT', 'CANCELLED'],
  AUTHORIZED: ['CAPTURED', 'CANCELLED', 'REVERSED'],
  CAPTURED: ['SETTLED', 'REVERSED'],
  SETTLED: ['REVERSED'],
  DECLINED: [],
  CANCELLED: [],
  REVERSED: [],
  TIMEOUT: [],
  DUPLICATED: []
};

export function canTransitionTef(from: TefTransactionStatus, to: TefTransactionStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionTef(from: TefTransactionStatus, to: TefTransactionStatus): TefTransactionStatus {
  if (!canTransitionTef(from, to)) {
    throw new Error(`Invalid TEF transition: ${from} -> ${to}`);
  }
  return to;
}

export function tefStatusIsTerminal(status: TefTransactionStatus): boolean {
  return transitions[status].length === 0;
}
