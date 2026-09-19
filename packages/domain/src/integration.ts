export interface IntegrationHeaders {
  correlationId: string;
  idempotencyKey: string;
  tenantId: string;
}

export type FiscalCommandType =
  | 'FISCAL_CALCULATE'
  | 'FISCAL_VALIDATE_DOCUMENT'
  | 'FISCAL_RESOLVE_RULES'
  | 'FISCAL_CREATE_SPLIT_PAYMENT'
  | 'FISCAL_GET_SNAPSHOT';

export type FiscalEventType =
  | 'FISCAL_SIMULATION_COMPLETED'
  | 'FISCAL_RULESET_PUBLISHED'
  | 'FISCAL_DOCUMENT_VALIDATED'
  | 'FISCAL_SPLIT_PAYMENT_CREATED'
  | 'FISCAL_RECONCILIATION_FAILED';

export interface IntegrationEnvelope<TType extends string, TPayload> {
  messageId: string;
  messageType: TType;
  schemaVersion: '1.0';
  occurredAt: string;
  correlationId: string;
  tenantId: string;
  idempotencyKey: string;
  source: string;
  payload: TPayload;
}

export interface CreateSimulationCommand {
  operationId: string;
  referenceDate: string;
  ruleSetId?: string;
  ruleSetVersion?: string;
  scenarioId?: string;
}

export type FiscalCalculateCommand = IntegrationEnvelope<'FISCAL_CALCULATE', CreateSimulationCommand>;

export interface SimulationCompletedPayload {
  simulationId: string;
  operationId: string;
  ruleSetId: string;
  ruleSetVersion: string;
  totalTax: string;
}

export type SimulationCompletedEvent =
  IntegrationEnvelope<'FISCAL_SIMULATION_COMPLETED', SimulationCompletedPayload>;

export interface FiscalRulesetPublishedPayload {
  ruleSetId: string;
  ruleSetVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceSet: string[];
}

export type FiscalRulesetPublishedEvent =
  IntegrationEnvelope<'FISCAL_RULESET_PUBLISHED', FiscalRulesetPublishedPayload>;
