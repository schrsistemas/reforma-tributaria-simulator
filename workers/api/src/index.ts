import { executeSimulation, type SimulationRequest } from './simulation.js';

export interface Env {
  VERSION: string;
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
      if(body.executionMode==='PRODUCTION') return json({error:'RULE_CATALOG_NOT_BOUND',message:'Production execution requires the published RuleSet catalog binding.'},503,request);
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
  return json({error:'NOT_FOUND'},404,request);
}};
