export type PaymentMethodCode = '15' | '17' | '18' | '20' | '23' | '24';

export type PaymentMethodRail = 'BOLETO' | 'PIX' | 'TED' | 'TEF';

export interface PaymentMethodDefinition {
  code: PaymentMethodCode;
  name: string;
  rail: PaymentMethodRail;
  description: string;
}

export interface PaymentRejectionScenario {
  id: string;
  paymentMethodCode: PaymentMethodCode;
  rejectionCode: string;
  title: string;
  message: string;
  technicalDetail?: string;
  recoverable: boolean;
  sourceKind: 'SIMULATION';
  active: boolean;
}

export interface PaymentRejectionSimulation {
  id: string;
  operationId: string;
  paymentMethodCode: PaymentMethodCode;
  rejectionScenarioId: string;
  rejectionCode: string;
  amountMinor: number;
  status: 'REJECTED';
  recoverable: boolean;
  correlationId: string;
  createdAt: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodDefinition[] = [
  { code: '15', name: 'Boleto', rail: 'BOLETO', description: 'Boleto bancário' },
  { code: '17', name: 'Pix QR Code dinâmico', rail: 'PIX', description: 'Pix via QR Code dinâmico' },
  { code: '18', name: 'TED', rail: 'TED', description: 'Transferência Eletrônica Disponível' },
  { code: '20', name: 'Pix chave / QR estático', rail: 'PIX', description: 'Pix por chave ou QR Code estático' },
  { code: '23', name: 'Pix automático', rail: 'PIX', description: 'Pix automático' },
  { code: '24', name: 'TEF / Book Transfer', rail: 'TEF', description: 'TEF ou book transfer' },
];

export function getPaymentMethod(code: string): PaymentMethodDefinition | undefined {
  return PAYMENT_METHODS.find((item) => item.code === code);
}
