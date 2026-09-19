import type { TaxCode } from '@rts/domain';

const ZERO=0n;
function cents(v:string):bigint{if(!/^\d+(\.\d{1,2})?$/.test(v))throw new Error('INVALID_MONEY');const [w,f='']=v.split('.');return BigInt(w)*100n+BigInt((f+'00').slice(0,2));}
function money(v:bigint){return (v/100n).toString()+'.'+(v%100n).toString().padStart(2,'0');}

export async function createSplitPayment(db:D1Database,input:{tenantId:string;paymentId:string;operationId:string;calculationVersion:string;grossAmount:string;taxes:Partial<Record<TaxCode,string>>;correlationId:string;idempotencyKey:string}){
  const existing=await db.prepare('SELECT payment_id,status FROM split_payments WHERE tenant_id=? AND payment_id=?').bind(input.tenantId,input.paymentId).first<{payment_id:string;status:string}>();
  if(existing)return {paymentId:existing.payment_id,status:existing.status,replayed:true};
  const ibs=cents(input.taxes.IBS??'0.00'),cbs=cents(input.taxes.CBS??'0.00'),gross=cents(input.grossAmount);
  if(ibs+cbs>gross)throw new Error('ALLOCATIONS_EXCEED_GROSS_AMOUNT');
  const now=new Date().toISOString(), net=money(gross-ibs-cbs);
  const batch=[
    db.prepare('INSERT INTO split_payments(payment_id,tenant_id,operation_id,calculation_version,gross_amount,supplier_net_amount,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.paymentId,input.tenantId,input.operationId,input.calculationVersion,input.grossAmount,net,(ibs+cbs)>ZERO?'ALLOCATED':'CREATED',input.correlationId,now),
    db.prepare('INSERT INTO split_payment_allocations(payment_id,tax,amount,status,created_at) VALUES(?,?,?,?,?)').bind(input.paymentId,'IBS',money(ibs),ibs>ZERO?'PENDING':'SETTLED',now),
    db.prepare('INSERT INTO split_payment_allocations(payment_id,tax,amount,status,created_at) VALUES(?,?,?,?,?)').bind(input.paymentId,'CBS',money(cbs),cbs>ZERO?'PENDING':'SETTLED',now),
    db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.paymentId,'PAYMENT_CREATED','1.0',input.idempotencyKey,input.correlationId,JSON.stringify(input),now),
    db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.paymentId,'ALLOCATION_CREATED','1.0',input.idempotencyKey+':allocation',input.correlationId,JSON.stringify({IBS:money(ibs),CBS:money(cbs)}),now)
  ];
  await db.batch(batch);
  return {paymentId:input.paymentId,status:(ibs+cbs)>ZERO?'ALLOCATED':'CREATED',replayed:false,grossAmount:input.grossAmount,supplierNetAmount:net};
}
export async function getSplitPayment(db:D1Database,tenantId:string,paymentId:string){
  const payment=await db.prepare('SELECT * FROM split_payments WHERE tenant_id=? AND payment_id=?').bind(tenantId,paymentId).first();
  if(!payment)return null;
  const allocations=await db.prepare('SELECT tax,amount,status,created_at,settled_at FROM split_payment_allocations WHERE payment_id=?').bind(paymentId).all();
  const events=await db.prepare('SELECT event_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at FROM split_payment_events WHERE tenant_id=? AND payment_id=? ORDER BY occurred_at,event_id').bind(tenantId,paymentId).all();
  return {payment,allocations:allocations.results,events:events.results};
}
