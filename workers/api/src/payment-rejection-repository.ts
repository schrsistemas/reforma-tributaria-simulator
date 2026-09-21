import type {
  PaymentMethodCode,
  PaymentRejectionScenario,
  PaymentRejectionSimulation,
} from '@rts/domain';

interface CreateRejectionInput {
  tenantId: string;
  operationId: string;
  idempotencyKey: string;
  paymentMethodCode: PaymentMethodCode;
  rejectionScenarioId: string;
  amountMinor: number;
  correlationId: string;
  paymentId?: string;
}

function mapScenario(row: Record<string, unknown>): PaymentRejectionScenario {
  return {
    id: String(row.id),
    paymentMethodCode: String(row.payment_method_code) as PaymentMethodCode,
    rejectionCode: String(row.rejection_code),
    title: String(row.title),
    message: String(row.message),
    technicalDetail: row.technical_detail ? String(row.technical_detail) : undefined,
    recoverable: Number(row.recoverable) === 1,
    sourceKind: 'SIMULATION',
    active: Number(row.active) === 1,
  };
}

function mapSimulation(row: Record<string, unknown>): PaymentRejectionSimulation {
  return {
    id: String(row.id),
    operationId: String(row.operation_id),
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    paymentMethodCode: String(row.payment_method_code) as PaymentMethodCode,
    rejectionScenarioId: String(row.rejection_scenario_id),
    rejectionCode: String(row.rejection_code),
    amountMinor: Number(row.amount_minor),
    status: 'REJECTED',
    recoverable: Number(row.recoverable) === 1,
    correlationId: String(row.correlation_id),
    createdAt: String(row.created_at),
  };
}

export async function listPaymentMethods(db: D1Database) {
  const result = await db
    .prepare(
      'SELECT code,name,rail,description FROM payment_methods WHERE active=1 ORDER BY CAST(code AS INTEGER)',
    )
    .all<Record<string, unknown>>();

  return result.results.map((row) => ({
    code: String(row.code),
    name: String(row.name),
    rail: String(row.rail),
    description: String(row.description),
  }));
}

export async function listPaymentRejectionScenarios(
  db: D1Database,
  paymentMethodCode?: string,
) {
  const query = paymentMethodCode
    ? 'SELECT id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind,active FROM payment_rejection_scenarios WHERE active=1 AND payment_method_code=? ORDER BY rejection_code,id'
    : 'SELECT id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind,active FROM payment_rejection_scenarios WHERE active=1 ORDER BY payment_method_code,rejection_code,id';

  const result = paymentMethodCode
    ? await db.prepare(query).bind(paymentMethodCode).all<Record<string, unknown>>()
    : await db.prepare(query).all<Record<string, unknown>>();

  return result.results.map(mapScenario);
}

export async function createPaymentRejectionSimulation(
  db: D1Database,
  input: CreateRejectionInput,
) {
  const existing = await db
    .prepare(
      'SELECT id,operation_id,payment_id,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at FROM payment_rejection_simulations WHERE tenant_id=? AND idempotency_key=?',
    )
    .bind(input.tenantId, input.idempotencyKey)
    .first<Record<string, unknown>>();

  if (existing) {
    return { simulation: mapSimulation(existing), replayed: true };
  }

  const scenario = await db
    .prepare(
      'SELECT id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind,active FROM payment_rejection_scenarios WHERE id=? AND active=1',
    )
    .bind(input.rejectionScenarioId)
    .first<Record<string, unknown>>();

  if (!scenario) {
    throw Object.assign(new Error('PAYMENT_REJECTION_SCENARIO_NOT_FOUND'), { status: 404 });
  }

  if (String(scenario.payment_method_code) !== input.paymentMethodCode) {
    throw Object.assign(new Error('PAYMENT_METHOD_SCENARIO_MISMATCH'), { status: 409 });
  }

  if (input.paymentId) {
    const payment = await db
      .prepare('SELECT payment_id,status FROM split_payments WHERE tenant_id=? AND payment_id=?')
      .bind(input.tenantId, input.paymentId)
      .first<{payment_id:string;status:string}>();

    if (!payment) {
      throw Object.assign(new Error('SPLIT_PAYMENT_NOT_FOUND'), { status: 404 });
    }

    if (payment.status === 'REVERSED') {
      throw Object.assign(new Error('SPLIT_PAYMENT_ALREADY_REVERSED'), { status: 409 });
    }
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO payment_rejection_simulations (id,tenant_id,operation_id,payment_id,idempotency_key,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      input.tenantId,
      input.operationId,
      input.paymentId ?? null,
      input.idempotencyKey,
      input.paymentMethodCode,
      input.rejectionScenarioId,
      String(scenario.rejection_code),
      input.amountMinor,
      'REJECTED',
      Number(scenario.recoverable) === 1 ? 1 : 0,
      input.correlationId,
      createdAt,
    )
    .run();

  const row = await db
    .prepare(
      'SELECT id,operation_id,payment_id,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at FROM payment_rejection_simulations WHERE id=?',
    )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) throw new Error('PAYMENT_REJECTION_SIMULATION_NOT_CREATED');

  if (input.paymentId) {
    const rejectedAt = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE split_payments SET status=?,rejection_code=?,rejection_scenario_id=?,rejected_at=? WHERE tenant_id=? AND payment_id=?')
        .bind('REJECTED', String(scenario.rejection_code), input.rejectionScenarioId, rejectedAt, input.tenantId, input.paymentId),
      db.prepare('INSERT INTO split_payment_events (event_id,tenant_id,payment_id,event_type,schema_version,idempotency_key,correlation_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(
          crypto.randomUUID(),
          input.tenantId,
          input.paymentId,
          'PAYMENT_REJECTED',
          '1.0',
          input.idempotencyKey + ':payment-rejected',
          input.correlationId,
          JSON.stringify({
            operationId: input.operationId,
            rejectionSimulationId: id,
            rejectionCode: String(scenario.rejection_code),
            rejectionScenarioId: input.rejectionScenarioId,
            amountMinor: input.amountMinor,
            paymentMethodCode: input.paymentMethodCode,
            splitPayment: 'NOT_EXECUTED',
          }),
          rejectedAt,
        ),
    ]);
  }

  return { simulation: mapSimulation(row), scenario: mapScenario(scenario), replayed: false };
}

export async function getPaymentRejectionSimulation(
  db: D1Database,
  tenantId: string,
  id: string,
) {
  const row = await db
    .prepare(
      'SELECT id,operation_id,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at FROM payment_rejection_simulations WHERE tenant_id=? AND id=?',
    )
    .bind(tenantId, id)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const scenario = await db
    .prepare(
      'SELECT id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind,active FROM payment_rejection_scenarios WHERE id=?',
    )
    .bind(String(row.rejection_scenario_id))
    .first<Record<string, unknown>>();

  return {
    simulation: mapSimulation(row),
    scenario: scenario ? mapScenario(scenario) : null,
  };
}

export async function listPaymentRejectionSimulations(
  db: D1Database,
  tenantId: string,
  operationId?: string,
  limit = 20,
) {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const query = operationId
    ? 'SELECT id,operation_id,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at FROM payment_rejection_simulations WHERE tenant_id=? AND operation_id=? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT id,operation_id,payment_method_code,rejection_scenario_id,rejection_code,amount_minor,status,recoverable,correlation_id,created_at FROM payment_rejection_simulations WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?';

  const result = operationId
    ? await db.prepare(query).bind(tenantId, operationId, safeLimit).all<Record<string, unknown>>()
    : await db.prepare(query).bind(tenantId, safeLimit).all<Record<string, unknown>>();

  return result.results.map(mapSimulation);
}
