import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { runSplitPayment, type SplitPaymentInput } from './split-payment.js';

export class SplitPaymentWorkflow extends WorkflowEntrypoint<{},SplitPaymentInput>{
  async run(event:WorkflowEvent<SplitPaymentInput>,step:WorkflowStep){
    const input=await step.do('validate split payment',async()=>{
      const p=event.payload;
      if(!p.tenantId||!p.paymentId||!p.operationId||!p.idempotencyKey||!p.correlationId) throw new Error('integration metadata is required');
      return p;
    });
    const allocation=await step.do('calculate allocation',async()=>runSplitPayment(input));
    return allocation;
  }
}
