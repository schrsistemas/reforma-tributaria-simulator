import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { FiscalOperation, TaxRule, TaxResult } from '@rts/domain';
import { calculateTax } from '@rts/tax-engine';

export interface SimulationWorkflowParams {
  operation:FiscalOperation;
  rules:TaxRule[];
  calculationVersion?:string;
  tenantId:string;
  correlationId:string;
  idempotencyKey:string;
}
export class FiscalSimulationWorkflow extends WorkflowEntrypoint<{},SimulationWorkflowParams>{
  async run(event:WorkflowEvent<SimulationWorkflowParams>,step:WorkflowStep){
    const input=await step.do('validate simulation input',async()=>{
      const p=event.payload;
      if(!p?.operation?.id) throw new Error('operation.id is required');
      if(!Array.isArray(p.rules)||p.rules.length===0) throw new Error('rules are required');
      if(!p.tenantId||!p.correlationId||!p.idempotencyKey) throw new Error('integration metadata is required');
      return p;
    });
    const result=await step.do('calculate fiscal simulation',async()=>{
      const result:TaxResult=calculateTax(input.operation,input.rules,input.calculationVersion??'0.1.0');
      return {operationId:result.operationId,calculationVersion:result.calculationVersion,totalTax:result.totalTax,taxableBase:result.taxableBase,taxes:result.taxes,ruleTrace:result.ruleTrace};
    });
    return {status:'COMPLETED',operationId:result.operationId,calculationVersion:result.calculationVersion,result};
  }
}
