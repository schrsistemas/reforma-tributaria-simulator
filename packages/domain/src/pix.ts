export type PixTransactionStatus = 'CREATED' | 'QR_READY' | 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export interface PixTransaction {
  id: string;
  operationId: string;
  idempotencyKey: string;
  provider: string;
  status: PixTransactionStatus;
  amountMinor: number;
  currency: 'BRL';
  txid: string;
  qrCodeText: string;
  expiresAt: string;
  endToEndId?: string;
  fiscalSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
}

const transitions: Record<PixTransactionStatus, readonly PixTransactionStatus[]> = {
  CREATED: ['QR_READY', 'CANCELLED'],
  QR_READY: ['PENDING', 'EXPIRED', 'CANCELLED'],
  PENDING: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  EXPIRED: [],
  CANCELLED: [],
  REFUNDED: []
};

export function transitionPix(from: PixTransactionStatus, to: PixTransactionStatus): PixTransactionStatus {
  if (!transitions[from].includes(to)) throw new Error(`Invalid Pix transition: ${from} -> ${to}`);
  return to;
}
