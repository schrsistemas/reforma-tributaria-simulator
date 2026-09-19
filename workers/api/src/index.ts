import { executeSimulation, type SimulationRequest } from './simulation.js';
import { resolvePublishedRuleSet } from './rule-catalog.js';
import { findById, saveCompleted } from './simulation-repository.js';

export interface Env {
  VERSION: string;
  DB?: D1Database;
  SIMULATION_WORKFLOW?: WorkflowBinding;
}
interface WorkflowBinding { create(options:{id?:string;params:unknown}):Promise<{id:string;status:string}>; }

const json=(body:unknown,status=200,request?:Request)=>{
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  const correlationId=request?.headers.get('X-Correlation-Id');
  if(correlationId) headers.set('X-Correlation-Id',correlationId);
  return new Response(JSON.stringify(body),{status,headers});
};
function integrationHeaders(request:Request){
  const correlationId=request.headers.get('X-Correlation-Id');
  const idempotencyKey=request.headers.get('Idempotency-Key');
  const tenantId=request.headers.get('X-Zynkronyx-Tenant');
  if(!correlationId||!idempotencyKey||!tenantId) throw Object.assign(new Error('Missing integration headers'),{status:400});
  return {correlationId,idempotencyKey,tenantId};
}
async function readJson(request:Request){
  const length=Number(request.headers.get('content-length')??'0');
  if(length>1_000_000) throw Object.assign(new Error('Payload too large'),{status:413});
  return request.json();
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/health') return json({status:'ok',service:'reforma-tributaria-simulator',version:env.VERSION??'dev'},200,request);
  if(request.method==='GET'&&url.pathname==='/api/v1') return json({service:'reforma-tributaria-simulator',apiVersion:'v1',capabilities:['simulation','tax-engine','split-payment'],execution:{explicitScenario:true,durableWorkflow:Boolean(env.SIMULATION_WORKFLOW)}},200,request);
  if(request.method==='POST'&&url.pathname==='/api/v1/simulations'){
    try{
      const headers=integrationHeaders(request);
      const body=await readJson(request) as SimulationRequest & {executionMode?:string};
      if(body.executionMode==='PRODUCTION'){ const operation=body.operation; if(!operation?.issuedAt) return json({error:'REFERENCE_DATE_REQUIRED'},400,request); const ruleSet=await resolvePublishedRuleSet(env,operation.issuedAt,body.ruleSetId,body.ruleSetVersion); if(!env.DB) return json({error:'DATABASE_NOT_BOUND'},503,request); const existing=await findByIdempotency(env.DB,headers.tenantId,headers.idempotencyKey,'SIMULATION'); if(existing) return json({ok:true,simulationId:existing.id,status:existing.status,ruleSet:{id:existing.rulesetId,version:existing.rulesetVersion},result:existing.result,correlationId:headers.correlationId,replayed:true},200,request); const result=executeSimulation({operation,rules:ruleSet.rules,calculationVersion:ruleSet.version}); const saved=await saveCompleted(env.DB,{tenantId:headers.tenantId,idempotencyKey:headers.idempotencyKey,operationId:operation.id,calculationVersion:result.result.calculationVersion,rulesetId:ruleSet.id,rulesetVersion:ruleSet.version,result:result.result,correlationId:headers.correlationId}); return json({ok:true,simulationId:saved?.id??result.simulationId,status:saved?.status??result.status,ruleSet:{id:ruleSet.id,version:ruleSet.version},result:saved?.result??result.result,correlationId:headers.correlationId,replayed:Boolean(saved&&saved.id!==result.simulationId)},200,request); }
      if(body.executionMode!=='SCENARIO') return json({error:'EXECUTION_MODE_REQUIRED',allowed:['SCENARIO','PRODUCTION']},400,request);
      if(env.SIMULATION_WORKFLOW){
        const instance=await env.SIMULATION_WORKFLOW.create({id:headers.idempotencyKey,params:{...body,tenantId:headers.tenantId,correlationId:headers.correlationId,idempotencyKey:headers.idempotencyKey}});
        return json({ok:true,simulationId:instance.id,status:'QUEUED',correlationId:headers.correlationId},202,request);
      }
      const result=executeSimulation(body);
      return json({ok:true,simulationId:result.simulationId,status:result.status,result:result.result,correlationId:headers.correlationId},200,request);
    }catch(error){
      const status=Number((error as {status?:number}).status)||500;
      return json({ok:false,error:error instanceof Error?error.message:'SIMULATION_FAILED'},status,request);
    }
  }
  if(request.method==='GET'&&url.pathname.startsWith('/api/v1/simulations/')){ try{ const headers=integrationHeaders(request); if(!env.DB) return json({error:'DATABASE_NOT_BOUND'},503,request); const id=url.pathname.split('/').pop()!; const record=await findById(env.DB,headers.tenantId,id); if(!record) return json({error:'SIMULATION_NOT_FOUND'},404,request); return json({ok:true,simulation:record},200,request); }catch(error){ const status=Number((error as {status?:number}).status)||500; return json({ok:false,error:error instanceof Error?error.message:'SIMULATION_LOOKUP_FAILED'},status,request); } }
  return json({error:'NOT_FOUND'},404,request);
}};
