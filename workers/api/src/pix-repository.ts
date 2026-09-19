import type { PixTransaction, PixTransactionStatus } from '@rts/domain';
import { transitionPix } from '@rts/domain';

const mapRow=(r:Record<string,unknown>):PixTransaction=>({
 id:String(r.id),operationId:String(r.operation_id),idempotencyKey:String(r.idempotency_key),
 provider:String(r.provider),status:String(r.status) as PixTransactionStatus,amountMinor:Number(r.amount_minor),
 currency:'BRL',txid:String(r.txid),qrCodeText:String(r.qr_code_text),expiresAt:String(r.expires_at),
 endToEndId:r.end_to_end_id?String(r.end_to_end_id):undefined,
 fiscalSnapshotId:r.fiscal_snapshot_id?String(r.fiscal_snapshot_id):undefined,
 createdAt:String(r.created_at),updatedAt:String(r.updated_at)
});
export async function getPix(db:D1Database,tenantId:string,id:string){const r=await db.prepare('SELECT * FROM pix_transactions WHERE tenant_id=? AND id=?').bind(tenantId,id).first<Record<string,unknown>>();return r?mapRow(r):null;}
export async function createPix(db:D1Database,input:{tenantId:string;operationId:string;idempotencyKey:string;amountMinor:number;correlationId:string;provider?:string}){
 const old=await db.prepare('SELECT * FROM pix_transactions WHERE tenant_id=? AND idempotency_key=?').bind(input.tenantId,input.idempotencyKey).first<Record<string,unknown>>();
 if(old)return{transaction:mapRow(old),replayed:true};
 const id=crypto.randomUUID(),txid='SIMPIX'+Date.now().toString(36).toUpperCase(),now=new Date(),expires=new Date(now.getTime()+15*60000).toISOString(),qr='00020101021226820014BR.GOV.BCB.PIX2558simulador.reforma.tributaria520400005303986540'+(input.amountMinor/100).toFixed(2).replace('.','')+'5802BR5916SIMULADOR FISCAL6008JOINVILLE62070503'+txid.slice(-5)+'6304SIMU';
 const t:PixTransaction={id,operationId:input.operationId,idempotencyKey:input.idempotencyKey,provider:input.provider??'SIM-PIX',status:'CREATED',amountMinor:input.amountMinor,currency:'BRL',txid,qrCodeText:qr,expiresAt:expires,createdAt:now.toISOString(),updatedAt:now.toISOString()};
 await db.prepare('INSERT INTO pix_transactions (id,tenant_id,operation_id,idempotency_key,provider,status,amount_minor,currency,txid,qr_code_text,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.tenantId,input.operationId,input.idempotencyKey,t.provider,t.status,t.amountMinor,'BRL',txid,qr,expires,t.createdAt,t.updatedAt).run();
 await db.prepare('INSERT INTO pix_events (id,transaction_id,operation_id,event_type,occurred_at,correlation_id,payload_json) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,input.operationId,'CREATED',now.toISOString(),input.correlationId,JSON.stringify({amountMinor:input.amountMinor,txid})).run();
 return{transaction:t,replayed:false};
}
export async function transitionPixRecord(db:D1Database,tenantId:string,id:string,to:PixTransactionStatus,correlationId:string){
 const current=await getPix(db,tenantId,id);if(!current)return null;const next=transitionPix(current.status,to),now=new Date().toISOString();
 const e2e=next==='PAID'?(current.endToEndId??'E'+Date.now().toString(36).toUpperCase()):current.endToEndId;
 await db.prepare('UPDATE pix_transactions SET status=?,end_to_end_id=?,updated_at=? WHERE tenant_id=? AND id=?').bind(next,e2e??null,now,tenantId,id).run();
 await db.prepare('INSERT INTO pix_events (id,transaction_id,operation_id,event_type,occurred_at,correlation_id,payload_json) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,current.operationId,next,now,correlationId,JSON.stringify({from:current.status,to:next})).run();
 return getPix(db,tenantId,id);
}