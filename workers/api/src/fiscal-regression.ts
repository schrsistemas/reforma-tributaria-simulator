import type { KnowledgeEnv } from './fiscal-knowledge.js';

export interface RegressionResult {
  runId: string;
  status: 'PASSED' | 'FAILED' | 'BLOCKED';
  changeId: string;
  checks: Array<{ name: string; status: 'PASSED' | 'FAILED' | 'SKIPPED'; detail?: string }>;
}

export async function runFiscalRegression(env: KnowledgeEnv, changeId: string): Promise<RegressionResult> {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });

  const change = await env.DB.prepare(
    'SELECT id,impact_level,status FROM fiscal_changes WHERE id = ?'
  ).bind(changeId).first<{ id: string; impact_level: string; status: string }>();

  if (!change) throw Object.assign(new Error('FISCAL_CHANGE_NOT_FOUND'), { status: 404 });

  const runId = crypto.randomUUID();
  const checks: RegressionResult['checks'] = [];

  checks.push({
    name: 'change-is-reviewable',
    status: change.status === 'UNDER_REVIEW' || change.status === 'APPROVED' ? 'PASSED' : 'BLOCKED' as 'SKIPPED',
    detail: change.status,
  });

  checks.push({
    name: 'critical-change-requires-explicit-validation',
    status: change.impact_level === 'CRITICAL' ? 'SKIPPED' : 'PASSED',
    detail: change.impact_level === 'CRITICAL' ? 'Explicit validation required.' : 'No critical gate required.',
  });

  const blocked = checks.some(check => check.status === 'SKIPPED');
  return {
    runId,
    status: blocked ? 'BLOCKED' : 'PASSED',
    changeId,
    checks,
  };
}
