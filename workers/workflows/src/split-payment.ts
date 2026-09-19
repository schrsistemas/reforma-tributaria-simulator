import type { TaxCode } from '@rts/domain';

export interface SplitPaymentInput {
  tenantId:string;
  operationId:string;
  paymentId:string;
  calculationVersion:string;
  grossAmount:string;
  allocations:Partial<Record<TaxCode,string>>;
  correlationId:string;
  idempotencyKey:string;
}

export interface SplitPaymentResult {
  paymentId:string;
  status:'CREATED'|'ALLOCATED'|'SETTLED'|'FAILED';
  calculationVersion:string;
  grossAmount:string;
  allocatedTax:string;
  supplierNetAmount:string;
}

function cents(value:string):bigint {
  if(!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid monetary amount');
  const [whole,fraction='']=value.split('.');
  return BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
}
function money(value:bigint):string {
  return (value/100n).toString()+'.'+(value%100n).toString().padStart(2,'0');
}

export async function runSplitPayment(input:SplitPaymentInput):Promise<SplitPaymentResult>{
  const gross=cents(input.grossAmount);
  const ibs=cents(input.allocations.IBS??'0');
  const cbs=cents(input.allocations.CBS??'0');
  const allocated=ibs+cbs;
  if(allocated<0n||allocated>gross) throw new Error('ALLOCATIONS_EXCEED_GROSS_AMOUNT');
  return {
    paymentId:input.paymentId,
    status:allocated>0n?'ALLOCATED':'CREATED',
    calculationVersion:input.calculationVersion,
    grossAmount:input.grossAmount,
    allocatedTax:money(allocated),
    supplierNetAmount:money(gross-allocated)
  };
}
