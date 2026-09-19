export type TaxCode = 'IBS' | 'CBS';
export type DecimalString = string;

export interface FiscalOperation {
  id: string;
  issuedAt: string;
  grossAmount: DecimalString;
  currency: 'BRL';
  items: FiscalItem[];
  payment?: PaymentReference;
}

export interface FiscalItem {
  id: string;
  description: string;
  quantity: DecimalString;
  unitPrice: DecimalString;
  ncm?: string;
  cfop?: string;
  taxProfile: TaxProfile;
}

export interface TaxProfile {
  regime: string;
  classification?: string;
  reductionPercent?: DecimalString;
}

export interface TaxRule {
  id: string;
  tax: TaxCode;
  validFrom: string;
  validTo?: string;
  ratePercent: DecimalString;
  source: string;
  version: string;
}

export interface TaxResult {
  operationId: string;
  calculationVersion: string;
  taxes: Record<TaxCode, TaxAmount>;
  totalTax: DecimalString;
  taxableBase: DecimalString;
  ruleTrace: RuleTrace[];
}

export interface TaxAmount {
  base: DecimalString;
  ratePercent: DecimalString;
  amount: DecimalString;
}

export interface RuleTrace {
  ruleId: string;
  tax: TaxCode;
  source: string;
  version: string;
}

export interface PaymentReference {
  transactionId: string;
  grossAmount: DecimalString;
  installments: number;
}

export interface SplitAllocation {
  paymentId: string;
  tax: TaxCode;
  amount: DecimalString;
  status: 'PENDING' | 'SETTLED' | 'REVERSED';
}
