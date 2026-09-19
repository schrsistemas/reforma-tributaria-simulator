export interface SplitPaymentInput {
  operationId: string;
  paymentId: string;
  calculationVersion: string;
  idempotencyKey: string;
}

export interface SplitPaymentResult {
  paymentId: string;
  status: 'CREATED' | 'ALLOCATED' | 'SETTLED' | 'FAILED';
  calculationVersion: string;
}

export async function runSplitPayment(input: SplitPaymentInput): Promise<SplitPaymentResult> {
  return {
    paymentId: input.paymentId,
    status: 'CREATED',
    calculationVersion: input.calculationVersion
  };
}
