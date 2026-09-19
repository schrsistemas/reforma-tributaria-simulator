import type { TefTransaction, TefTransactionStatus, TefTransactionType } from '@rts/domain';
import { transitionTef } from '@rts/domain';

export interface TefDbEnv { DB?: D1Database; }

interface CreateInput {
  tenantId: string;
  operationId: string;
  idempotencyKey: string;
  provider: string;
  terminalId: string;
  type: TefTransactionType;
  amountMinor: number;
  currency?: 'BRL';
  correlationId: string;
}

const mapRow = (row: Record<string, unknown>): TefTransaction => ({
  id: String(row.id),
  operationId: String(row.operation_id),
  idempotencyKey: String(row.idempotency_key),
  provider: String(row.provider),
  terminalId: String(row.terminal_id),
  type: String(row.transaction_type) as TefTransactionType,
  status: String(row.status) as TefTransactionStatus,
  amountMinor: Number(row.amount_minor),
  currency: String(row.currency) as 'BRL',
  nsu: row.nsu ? String(row.nsu) : undefined,
  authorizationCode: row.authorization_code ? String(row.authorization_code) : undefined,
  externalReference: row.external_reference ? String(row.external_reference) : undefined,
  fiscalSnapshotId: row.fiscal_snapshot_id ? String(row.fiscal_snapshot_id) : undefined,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
});

export async function findTefByIdempotency(db: D1Database, tenantId: string, key: string) {
  const row = await db.prepare('SELECT * FROM tef_transactions WHERE tenant_id = ? AND idempotency_key = ?').bind(tenantId, key).first<Record<string, unknown>>();
  return row ? mapRow(row) : null;
}

export async function getTef(db: D1Database, tenantId: string, id: string) {
  const row = await db.prepare('SELECT * FROM tef_transactions WHERE tenant_id = ? AND id = ?').bind(tenantId, id).first<Record<string, unknown>>();
  return row ? mapRow(row) : null;
}

export async function createTef(db: D1Database, input: CreateInput) {
  const existing = await findTefByIdempotency(db, input.tenantId, input.idempotencyKey);
  if (existing) return { transaction: existing, replayed: true };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const transaction: TefTransaction = {
    id, operationId: input.operationId, idempotencyKey: input.idempotencyKey,
    provider: input.provider, terminalId: input.terminalId, type: input.type,
    status: 'INITIATED', amountMinor: input.amountMinor, currency: input.currency ?? 'BRL',
    createdAt: now, updatedAt: now,
  };

  await db.prepare(`INSERT INTO tef_transactions
    (id, tenant_id, operation_id, idempotency_key, provider, terminal_id, transaction_type, status, amount_minor, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.tenantId, input.operationId, input.idempotencyKey, input.provider, input.terminalId,
      input.type, transaction.status, input.amountMinor, transaction.currency, now, now).run();

  await db.prepare(`INSERT INTO tef_events
    (id, transaction_id, operation_id, event_type, occurred_at, correlation_id, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), id, input.operationId, 'INITIATED', now, input.correlationId, JSON.stringify({ provider: input.provider, terminalId: input.terminalId, amountMinor: input.amountMinor })).run();

  return { transaction, replayed: false };
}

export async function transitionTefRecord(db: D1Database, tenantId: string, id: string, to: TefTransactionStatus, correlationId: string) {
  const current = await getTef(db, tenantId, id);
  if (!current) return null;
  const next = transitionTef(current.status, to);
  const now = new Date().toISOString();
  const nsu = next === 'AUTHORIZED' ? current.nsu ?? `NSU${Date.now().toString().slice(-8)}` : current.nsu;
  const authorizationCode = next === 'AUTHORIZED' ? current.authorizationCode ?? `AUTH${Date.now().toString().slice(-6)}` : current.authorizationCode;
  await db.prepare('UPDATE tef_transactions SET status = ?, nsu = ?, authorization_code = ?, updated_at = ? WHERE tenant_id = ? AND id = ?')
    .bind(next, nsu ?? null, authorizationCode ?? null, now, tenantId, id).run();
  await db.prepare('INSERT INTO tef_events (id, transaction_id, operation_id, event_type, occurred_at, correlation_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, current.operationId, next, now, correlationId, JSON.stringify({ from: current.status, to: next })).run();
  return getTef(db, tenantId, id);
}
