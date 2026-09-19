import type { CreateSimulationCommand, IntegrationHeaders } from '@rts/domain';

export function readIntegrationHeaders(request: Request): IntegrationHeaders {
  const correlationId = request.headers.get('X-Correlation-Id');
  const idempotencyKey = request.headers.get('Idempotency-Key');
  const tenantId = request.headers.get('X-Zynkronyx-Tenant');

  if (!correlationId || !idempotencyKey || !tenantId) {
    throw new Error('Missing integration headers');
  }

  return { correlationId, idempotencyKey, tenantId };
}

export async function readSimulationCommand(request: Request): Promise<CreateSimulationCommand> {
  const body = await request.json() as Partial<CreateSimulationCommand>;

  if (!body.operationId || !body.referenceDate) {
    throw new Error('operationId and referenceDate are required');
  }

  return {
    operationId: body.operationId,
    referenceDate: body.referenceDate,
    ruleSetId: body.ruleSetId,
    ruleSetVersion: body.ruleSetVersion,
    scenarioId: body.scenarioId
  };
}
