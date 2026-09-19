import type { TaxResult } from '@rts/domain';

export interface SimulationRecord {
  id:string; tenantId:string; operationId:string; status:string;
  calculationVersion:string|null; rulesetId:string|null; rulesetVersion:string|null;
  result:TaxResult|null; correlationId:string; createdAt:string; completedAt:string|null;
}

type Row={id:string;tenant_id:string;operation_id:string;status:string;calculation_version:string|null;ruleset_id:string|null;ruleset_version:string|null;result_json:string|null;correlation_id:string;created_at:string;completed_at:string|null};

function map(row:Row):SimulationRecord{
  return {...row,operationId:row.operation_id,tenantId:row.tenant_id,calculationVersion:row.calculation_version,rulesetId:row.ruleset_id,rulesetVersion:row.ruleset_version,result:row.result_json?JSON.parse(row.result_json) as TaxResult:null,correlationId:row.correlation_id,createdAt:row.created_at,completedAt:row.completed_at};
}

export async function findByIdempotency(db:D1Database,tenantId:string,key:string,operation:string){
  const row=await db.prepare('SELECT s.* FROM simulations s JOIN idempotency_keys i ON i.resource_id=s.id WHERE i.tenant_id=? AND i.idempotency_key=? AND i.operation=? LIMIT 1').bind(tenantId,key,operation).first<Row>();
  return row?map(row):null;
}

export async function saveCompleted(db:D1Database,input:{tenantId:string;idempotencyKey:string;operationId:string;calculationVersion:string;rulesetId?:string;rulesetVersion?:string;result:TaxResult;correlationId:string}){
  const id=crypto.randomUUID();
  const now=new Date().toISOString();
  const idem=await db.prepare('INSERT OR IGNORE INTO idempotency_keys(tenant_id,idempotency_key,operation,resource_id,created_at) VALUES(?,?,?,?,?)').bind(input.tenantId,input.idempotencyKey,'SIMULATION',id,now).run();
  if((idem.meta?.changes??0)!==1){
    const existing=await findByIdempotency(db,input.tenantId,input.idempotencyKey,'SIMULATION');
    if(existing) return existing;
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
  await db.prepare('INSERT INTO simulations(id,tenant_id,operation_id,status,calculation_version,ruleset_id,ruleset_version,result_json,correlation_id,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.tenantId,input.operationId,'COMPLETED',input.calculationVersion,input.rulesetId??null,input.rulesetVersion??null,JSON.stringify(input.result),input.correlationId,now,now).run();
  return findByIdempotency(db,input.tenantId,input.idempotencyKey,'SIMULATION');
}

export async function findById(db:D1Database,tenantId:string,id:string){
  const row=await db.prepare('SELECT * FROM simulations WHERE tenant_id=? AND id=?').bind(tenantId,id).first<Row>();
  return row?map(row):null;
}
