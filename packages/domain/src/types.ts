export type TaxCode='IBS'|'CBS';
export type DecimalString=string;
export type RoundingMode='HALF_UP'|'HALF_EVEN'|'DOWN'|'UP';

export interface RoundingPolicy {
  scale:number;
  mode:RoundingMode;
}
export interface FiscalOperation {
  id:string;
  issuedAt:string;
  grossAmount:DecimalString;
  currency:'BRL';
  items:FiscalItem[];
  payment?:PaymentReference;
}
export interface FiscalItem {
  id:string;
  description:string;
  quantity:DecimalString;
  unitPrice:string;
  ncm?:string;
  cfop?:string;
  taxProfile:TaxProfile;
}
export interface TaxProfile {
  regime:string;
  classification?:string;
  reductionPercent?:DecimalString;
}
export interface TaxRule {
  id:string;
  tax:TaxCode;
  validFrom:string;
  validTo?:string;
  ratePercent:DecimalString;
  source:string;
  version:string;
  rounding?:RoundingPolicy;
}
export interface TaxResult {
  operationId:string;
  calculationVersion:string;
  taxes:Record<TaxCode,TaxAmount>;
  totalTax:DecimalString;
  taxableBase:DecimalString;
  ruleTrace:RuleTrace[];
  roundingPolicy:RoundingPolicy;
}
export interface TaxAmount { base:DecimalString; ratePercent:DecimalString; amount:DecimalString; }
export interface RuleTrace { ruleId:string; tax:TaxCode; source:string; version:string; }
export interface PaymentReference { transactionId:string; grossAmount:DecimalString; installments:number; }
export interface SplitAllocation { paymentId:string; tax:TaxCode; amount:DecimalString; status:'PENDING'|'SETTLED'|'REVERSED'; }
