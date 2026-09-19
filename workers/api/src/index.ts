import { executeSimulation, type SimulationRequest } from './simulation.js';
import { resolvePublishedRuleSet } from './rule-catalog.js';
import { findById, saveCompleted } from './simulation-repository.js';
import { createSplitPayment, getSplitPayment } from './split-payment-repository.js';
import { listFiscalSources, getFiscalSource } from './fiscal-knowledge.js';
import { collectFiscalSource } from './source-collector.js';

export interface Env {
  VERSION: string;
  DB?: D1Database;
  SIMULATION_WORKFLOW?: WorkflowBinding;
  INTEGRATION_TOKEN?: string;
  EVIDENCE_BUCKET?: R2Bucket;
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
  if(!correlationId||!tenantId) throw Object.assign(new Error('Missing integration headers'),{status:400});
  return {correlationId,idempotencyKey,tenantId};
}

function authenticate(request:Request,env:Env){
  if(!env.INTEGRATION_TOKEN) throw Object.assign(new Error('INTEGRATION_AUTH_NOT_CONFIGURED'),{status:503});
  const authorization=request.headers.get('Authorization');
  if(authorization!==`Bearer ${env.INTEGRATION_TOKEN}`) throw Object.assign(new Error('UNAUTHORIZED'),{status:401});
}

async function readJson(request:Request){
  const length=Number(request.headers.get('content-length')??'0');
  if(length>1_000_000) throw Object.assign(new Error('Payload too large'),{status:413});
  return request.json();
}

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  // HTTP API remains separate from the scheduled collector. The collector never
  // receives an external request without authentication.
  if(request.method==='GET'&&url.pathname==='/health') return json({status:'ok',service:'reforma-tributaria-simulator',version:env.VERSION??'dev'},200,request);
  if(request.method==='GET'&&url.pathname==='/api/v1') return json({service:'reforma-tributaria-simulator',apiVersion:'v1',capabilities:['simulation','tax-engine','split-payment','fiscal-knowledge'],execution:{explicitScenario:true,durableWorkflow:Boolean(env.SIMULATION_WORKFLOW)}},200,request);
  try { authenticate(request,env); } catch(error) { const status=Number((error as {status?:number}).status)||500; return json({ok:false,error:error instanceof Error?error.message:'AUTHENTICATION_FAILED'},status,request); }

  if(request.method==='GET'&&url.pathname==='/api/v1/fiscal-sources'){
    try {
      integrationHeaders(request);
      return json({ok:true,sources:await listFiscalSources(env)},200,request);
    } catch(error) {
      const status=Number((error as {status?:number}).status)||500;
      return json({ok:false,error:error instanceof Error?error.message:'SOURCE_REGISTRY_FAILED'},status,request);
    }
  }

  if(request.method==='GET'&&url.pathname.startsWith('/api/v1/fiscal-sources/')){
    try {
      integrationHeaders(request);
      const sourceId=decodeURIComponent(url.pathname.split('/').pop()!);
      const source=await getFiscalSource(env,sourceId);
      if(!source)return json({error:'FISCAL_SOURCE_NOT_FOUND'},404,request);
      return json({ok:true,source},200,request);
    } catch(error) {
      const status=Number((error as {status?:number}).status)||500;
      return json({ok:false,error:error instanceof Error?error.message:'SOURCE_REGISTRY_FAILED'},status,request);
    }
  }

  if(request.method==='POST'&&url.pathname==='/api/v1/simulations'){
    try{
      const headers=integrationHeaders(request);
      const body=await readJson(request) as SimulationRequest & {executionMode?:string};
      if(!headers.idempotencyKey) return json({error:'IDEMPOTENCY_KEY_REQUIRED'},400,request);
      if(body.executionMode==='PRODUCTION'){
        const operation=body.operation;
        if(!operation?.issuedAt) return json({error:'REFERENCE_DATE_REQUIRED'},400,request);
        const ruleSet=await resolvePublishedRuleSet(env,operation.issuedAt,body.ruleSetId,body.ruleSetVersion);
        if(!env.DB) return json({error:'DATABASE_NOT_BOUND'},503,request);
        const existing=await findByIdempotency(env.DB,headers.tenantId,headers.idempotencyKey,'SIMULATION');
        if(existing) return json({ok:true,simulationId:existing.id,status:existing.status,ruleSet:{id:existing.rulesetId,version:existing.rulesetVersion},result:existing.result,correlationId:headers.correlationId,replayed:true},200,request);
        const result=executeSimulation({operation,rules:ruleSet.rules,calculationVersion:ruleSet.version});
        const saved=await saveCompleted(env.DB,{tenantId:headers.tenantId,idempotencyKey:headers.idempotencyKey,operationId:operation.id,calculationVersion:result.result.calculationVersion,rulesetId:ruleSet.id,rulesetVersion:ruleSet.version,result:result.result,correlationId:headers.correlationId});
        return json({ok:true,simulationId:saved?.id??result.simulationId,status:saved?.status??result.status,ruleSet:{id:ruleSet.id,version:ruleSet.version},result:saved?.result??result.result,correlationId:headers.correlationId,replayed:false},200,request);
      }
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

  if(request.method==='POST'&&url.pathname==='/api/v1/split-payments'){
    try{const headers=integrationHeaders(request);if(!headers.idempotencyKey)return json({error:'IDEMPOTENCY_KEY_REQUIRED'},400,request);if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);const body=await readJson(request) as {paymentId:string;operationId:string;calculationVersion:string;grossAmount:string;taxes:{IBS?:string;CBS?:string},
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    if (!env.DB) return;
    const sources = await listFiscalSources(env);
    for (const source of sources) {
      try {
        await collectFiscalSource({ DB: env.DB, EVIDENCE_BUCKET: env.EVIDENCE_BUCKET }, source.id);
      } catch {
        // A single unavailable source must not prevent other sources from being collected.
      }
    }
  },
};if(!body.paymentId||!body.operationId||!body.grossAmount)return json({error:'PAYMENT_FIELDS_REQUIRED'},400,request);const result=await createSplitPayment(env.DB,{...body,tenantId:headers.tenantId,correlationId:headers.correlationId,idempotencyKey:headers.idempotencyKey,taxes:body.taxes??{}});return json({ok:true,...result,correlationId:headers.correlationId},result.replayed?200:201,request)}catch(error){const status=Number((error as {status?:number}).status)||400;return json({ok:false,error:error instanceof Error?error.message:'SPLIT_PAYMENT_FAILED'},status,request)}}
  if(request.method==='GET'&&url.pathname.startsWith('/api/v1/split-payments/')){try{const headers=integrationHeaders(request);if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);const id=url.pathname.split('/').pop()!;const result=await getSplitPayment(env.DB,headers.tenantId,id);if(!result)return json({error:'SPLIT_PAYMENT_NOT_FOUND'},404,request);return json({ok:true,...result},200,request)}catch(error){const status=Number((error as {status?:number}).status)||500;return json({ok:false,error:error instanceof Error?error.message:'SPLIT_PAYMENT_LOOKUP_FAILED'},status,request)}}
  if(request.method==='GET'&&url.pathname.startsWith('/api/v1/simulations/')){try{const headers=integrationHeaders(request);if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);const id=url.pathname.split('/').pop()!;const record=await findById(env.DB,headers.tenantId,id);if(!record)return json({error:'SIMULATION_NOT_FOUND'},404,request);return json({ok:true,simulation:record},200,request)}catch(error){const status=Number((error as {status?:number}).status)||500;return json({ok:false,error:error instanceof Error?error.message:'SIMULATION_LOOKUP_FAILED'},status,request)}}
  return json({error:'NOT_FOUND'},404,request);
}};
