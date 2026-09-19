import type { FiscalOperation, TaxResult, TaxRule } from '@rts/domain';
import { calculateTax } from '@rts/tax-engine';

export interface SimulationRequest {
  operation: FiscalOperation;
  rules: TaxRule[];
  calculationVersion?: string;
}

export interface SimulationAccepted {
  simulationId: string;
  status: 'COMPLETED';
  result: TaxResult;
}

export function executeSimulation(input: SimulationRequest): SimulationAccepted {
  if (!input.operation?.id) throw new Error('operation.id is required');
  if (!Array.isArray(input.rules) || input.rules.length === 0) throw new Error('rules are required for explicit scenario execution');
  const simulationId=crypto.randomUUID();
  const result=calculateTax(input.operation,input.rules,input.calculationVersion??'0.1.0');
  return {simulationId,status:'COMPLETED',result};
}
