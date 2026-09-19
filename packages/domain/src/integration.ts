export interface IntegrationHeaders {
  correlationId: string;
  idempotencyKey: string;
  tenantId: string;
}

export interface CreateSimulationCommand {
  operationId: string;
  referenceDate: string;
  ruleSetId?: string;
  ruleSetVersion?: string;
  scenarioId?: string;
}

export interface SimulationCompletedEvent {
  eventType: 'FISCAL_SIMULATION_COMPLETED';
  schemaVersion: '1.0';
  simulationId: string;
  operationId: string;
  tenantId: string;
  correlationId: string;
  ruleSetId: string;
  ruleSetVersion: string;
  totalTax: string;
  occurredAt: string;
}
