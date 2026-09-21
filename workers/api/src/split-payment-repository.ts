import type { TaxCode } from '@rts/domain';

const ZERO=0n;
const TAXES:TaxCode[]=['IBS','CBS'];

function cents(v:string):bigint{
  if(!/^\d+(\.\d{1,2})?$/.test(v))throw new Error('INVALID_MONEY');
  const [w,f='']=v.split('.');
  return BigInt(w)*100n+BigInt((f+'00').slice(0,2));
}
function money(v:bigint){return (v/100n).toString()+'.'+(v%100n).toString().padStart(2,'0');}

async function hasEventIdempotency(db:D1Database,tenantId:string,paymentId:string,idempotencyKey:string,eventType?:string){
  const row=eventType
    ? await db.prepare('SELECT event_id FROM split_payment_events WHERE tenant_id=? AND payment_id=? AND idempotency_key=? AND event_type=? LIMIT 1').bind(tenantId,paymentId,idempotencyKey,eventType).first()
    : await db.prepare('SELECT event_id FROM split_payment_events WHERE tenant_id=? AND payment_id=? AND idempotency_key=? LIMIT 1').bind(tenantId,paymentId,idempotencyKey).first();
  return Boolean(row);
}

function conflict(code:string){ throw Object.assign(new Error(code),{status:409}); }

async function appendEvent(db:D1Database,input:{tenantId:string;paymentId:string;eventType:string;idempotencyKey:string;correlationId:string;payload:unknown}){
  const now=new Date().toISOString();
  await db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),input.tenantId,input.paymentId,input.eventType,'1.0',input.idempotencyKey,input.correlationId,JSON.stringify(input.payload),now).run();
  return now;
}

export async function createSplitPayment(db:D1Database,input:{tenantId:string;paymentId:string;operationId:string;calculationVersion:string;grossAmount:string;taxes:Partial<Record<TaxCode,string>>;correlationId:string;idempotencyKey:string}){
  const idem=await db.prepare('SELECT payment_id,status FROM split_payments WHERE tenant_id=? AND payment_id=?').bind(input.tenantId,input.paymentId).first<{payment_id:string;status:string}>();
  if(idem)return {paymentId:idem.payment_id,status:idem.status,replayed:true};
  const prior=await db.prepare('SELECT payment_id,status FROM split_payments WHERE tenant_id=? AND payment_id IN (SELECT payment_id FROM split_payment_events WHERE tenant_id=? AND idempotency_key=? AND event_type=?) LIMIT 1').bind(input.tenantId,input.tenantId,input.idempotencyKey,'PAYMENT_CREATED').first<{payment_id:string;status:string}>();
  if(prior) conflict('IDEMPOTENCY_KEY_ALREADY_USED');

  const ibs=cents(input.taxes.IBS??'0.00'),cbs=cents(input.taxes.CBS??'0.00'),gross=cents(input.grossAmount);
  if(ibs+cbs>gross)throw new Error('ALLOCATIONS_EXCEED_GROSS_AMOUNT');
  const now=new Date().toISOString(), net=money(gross-ibs-cbs);
  const status=(ibs+cbs)>ZERO?'ALLOCATED':'CREATED';
  const batch=[
    db.prepare('INSERT INTO split_payments(payment_id,tenant_id,operation_id,calculation_version,gross_amount,supplier_net_amount,status,correlation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.paymentId,input.tenantId,input.operationId,input.calculationVersion,input.grossAmount,net,status,input.correlationId,now),
    ...TAXES.map(tax=>{const amount=tax==='IBS'?ibs:cbs;return db.prepare('INSERT INTO split_payment_allocations(payment_id,tax,amount,status,created_at) VALUES(?,?,?,?,?)').bind(input.paymentId,tax,money(amount),amount>ZERO?'PENDING':'SETTLED',now)}),
    db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.paymentId,'PAYMENT_CREATED','1.0',input.idempotencyKey,input.correlationId,JSON.stringify(input),now),
    db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.paymentId,'ALLOCATION_CREATED','1.0',input.idempotencyKey+':allocation',input.correlationId,JSON.stringify({IBS:money(ibs),CBS:money(cbs)}),now)
  ];
  await db.batch(batch);
  return {paymentId:input.paymentId,status,grossAmount:input.grossAmount,supplierNetAmount:net,replayed:false};
}

export async function getSplitPayment(db:D1Database,tenantId:string,paymentId:string){
  const payment=await db.prepare('SELECT * FROM split_payments WHERE tenant_id=? AND payment_id=?').bind(tenantId,paymentId).first<Record<string,unknown>>();
  if(!payment)return null;
  const allocations=await db.prepare('SELECT tax,amount,status,created_at,settled_at FROM split_payment_allocations WHERE payment_id=?').bind(paymentId).all();
  const events=await db.prepare('SELECT event_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at FROM split_payment_events WHERE tenant_id=? AND payment_id=? ORDER BY occurred_at,event_id').bind(tenantId,paymentId).all();
  return {payment,allocations:allocations.results,events:events.results};
}

export async function settleSplitPayment(db:D1Database,input:{tenantId:string;paymentId:string;tax?:TaxCode;supplier?:boolean;correlationId:string;idempotencyKey:string}){
  const current=await getSplitPayment(db,input.tenantId,input.paymentId);
  if(!current) return null;
  const payment=current.payment as Record<string,unknown>;
  if(String(payment.status)==='REVERSED') throw new Error('SPLIT_PAYMENT_ALREADY_REVERSED');
  if(String(payment.status)==='REJECTED') throw new Error('PAYMENT_REJECTED_CANNOT_SETTLE');
  if(await hasEventIdempotency(db,input.tenantId,input.paymentId,input.idempotencyKey)) return current;

  const now=new Date().toISOString();
  const statements:D1PreparedStatement[]=[];
  if(input.tax){
    if(!TAXES.includes(input.tax)) throw new Error('INVALID_TAX');
    const allocation=(current.allocations as Record<string,unknown>[]).find(x=>String(x.tax)===input.tax);
    if(!allocation) throw new Error('ALLOCATION_NOT_FOUND');
    if(String(allocation.status)==='REVERSED') throw new Error('ALLOCATION_ALREADY_REVERSED');
    if(String(allocation.status)!=='SETTLED'){
      statements.push(
        db.prepare('UPDATE split_payment_allocations SET status=?,settled_at=? WHERE payment_id=? AND tax=? AND status=?')
          .bind('SETTLED',now,input.paymentId,input.tax,'PENDING'),
        db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(),input.tenantId,input.paymentId,'ALLOCATION_SETTLED','1.0',input.idempotencyKey,input.correlationId,JSON.stringify({tax:input.tax,amount:allocation.amount}),now),
      );
    }
  }
  if(input.supplier){
    statements.push(
      db.prepare('UPDATE split_payments SET supplier_settled_at=? WHERE tenant_id=? AND payment_id=? AND status NOT IN (?,?)')
        .bind(now,input.tenantId,input.paymentId,'REVERSED','REJECTED'),
      db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),input.tenantId,input.paymentId,'SUPPLIER_SETTLED','1.0',input.idempotencyKey+':supplier',input.correlationId,JSON.stringify({amount:payment.supplier_net_amount}),now),
    );
  }

  // Compute lifecycle status in the same batch, after the requested updates.
  statements.push(
    db.prepare("UPDATE split_payments SET status = CASE WHEN supplier_settled_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM split_payment_allocations a WHERE a.payment_id=split_payments.payment_id AND a.status<>?) THEN 'SETTLED' WHEN supplier_settled_at IS NOT NULL OR EXISTS (SELECT 1 FROM split_payment_allocations a WHERE a.payment_id=split_payments.payment_id AND a.status='SETTLED') THEN 'PARTIALLY_SETTLED' ELSE 'ALLOCATED' END WHERE tenant_id=? AND payment_id=?")
      .bind('SETTLED',input.tenantId,input.paymentId),
  );
  if(statements.length) await db.batch(statements);
  return getSplitPayment(db,input.tenantId,input.paymentId);
}

export async function reverseSplitPayment(db:D1Database,input:{tenantId:string;paymentId:string;correlationId:string;idempotencyKey:string}){
  const current=await getSplitPayment(db,input.tenantId,input.paymentId);
  if(!current)return null;
  const currentStatus=String((current.payment as Record<string,unknown>).status);
  if(await hasEventIdempotency(db,input.tenantId,input.paymentId,input.idempotencyKey)) return current;
  if(currentStatus==='REVERSED')return current;
  if(currentStatus==='REJECTED')throw new Error('PAYMENT_REJECTED_CANNOT_REVERSE');
  const now=new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE split_payments SET status=? WHERE tenant_id=? AND payment_id=?').bind('REVERSED',input.tenantId,input.paymentId),
    db.prepare('UPDATE split_payment_allocations SET status=?,settled_at=NULL WHERE payment_id=?').bind('REVERSED',input.paymentId),
    db.prepare('INSERT INTO split_payment_events(event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.tenantId,input.paymentId,'ALLOCATION_REVERSED','1.0',input.idempotencyKey,input.correlationId,JSON.stringify({reason:'SIMULATED_REVERSAL'}),now),
  ]);
  return getSplitPayment(db,input.tenantId,input.paymentId);
}

export async function reconcileSplitPayment(db:D1Database,input:{tenantId:string;paymentId:string;correlationId:string;idempotencyKey:string}){
  const current=await getSplitPayment(db,input.tenantId,input.paymentId);
  if(!current)return null;
  if(await hasEventIdempotency(db,input.tenantId,input.paymentId,input.idempotencyKey)) return {balanced:true,replayed:true,payment:current.payment,allocations:current.allocations};
  const p=current.payment as Record<string,unknown>;
  if(String(p.status)==='REJECTED') throw new Error('PAYMENT_REJECTED_CANNOT_RECONCILE');
  const gross=cents(String(p.gross_amount)), net=cents(String(p.supplier_net_amount));
  const allocated=(current.allocations as Record<string,unknown>[]).reduce((sum,row)=>sum+cents(String(row.amount)),ZERO);
  const balanced=allocated+net===gross;
  await appendEvent(db,{tenantId:input.tenantId,paymentId:input.paymentId,eventType:balanced?'RECONCILIATION_PASSED':'RECONCILIATION_FAILED',idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,payload:{grossAmount:money(gross),allocatedTaxes:money(allocated),supplierNetAmount:money(net),difference:money(gross-allocated-net)}});
  return {balanced,grossAmount:money(gross),allocatedTaxes:money(allocated),supplierNetAmount:money(net),difference:money(gross-allocated-net),payment:current.payment,allocations:current.allocations,replayed:false};
}
