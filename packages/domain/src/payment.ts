export type PaymentMethod = 'PIX' | 'TEF' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'BOLETO' | 'TRANSFER';
export type PaymentStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'SETTLED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK' | 'REJECTED';
export interface PaymentInstrument { method: PaymentMethod; provider: string; terminalId?: string; installments?: number; }
export interface PaymentRecord { id:string; tenantId:string; operationId:string; method:PaymentMethod; status:PaymentStatus; amountMinor:number; feeMinor:number; netMinor:number; provider:string; createdAt:string; updatedAt:string; }
export const paymentTransitions:Record<PaymentStatus,readonly PaymentStatus[]>={CREATED:['AUTHORIZED','CANCELLED','REJECTED'],AUTHORIZED:['CAPTURED','CANCELLED','REJECTED'],CAPTURED:['SETTLED','REFUNDED','CHARGEBACK'],SETTLED:['REFUNDED','CHARGEBACK'],CANCELLED:[],REFUNDED:[],CHARGEBACK:[],REJECTED:[]};
