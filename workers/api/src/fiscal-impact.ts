import type { KnowledgeEnv } from './fiscal-knowledge.js';

export interface FiscalImpact {
  changeId: string;
  sourceId: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedRuleSets: Array<{ id: string; version: string }>;
  affectedScenarios: string[];
  reasons: string[];
}

interface ChangeRow {
  id: string;
  source_id: string;
  impact_level: FiscalImpact['impactLevel'];
}

interface RuleSetRow {
  id: string;
  version: string;
}

export async function analyzeFiscalImpact(env: KnowledgeEnv, changeId: string): Promise<FiscalImpact> {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });

  const change = await env.DB.prepare(
    'SELECT id,source_id,impact_level FROM fiscal_changes WHERE id = ?'
  ).bind(changeId).first<ChangeRow>();

  if (!change) throw Object.assign(new Error('FISCAL_CHANGE_NOT_FOUND'), { status: 404 });

  const ruleSets = await env.DB.prepare(
    'SELECT id,version FROM rule_sets WHERE status IN (\'PUBLISHED\',\'VALIDATED\') ORDER BY id,version'
  ).all<RuleSetRow>();

  const reasons: string[] = ['Source content changed and requires impact review.'];
  if (change.impact_level === 'HIGH' || change.impact_level === 'CRITICAL') {
    reasons.push('Change level requires explicit validation before publication.');
  }

  return {
    changeId: change.id,
    sourceId: change.source_id,
    impactLevel: change.impact_level,
    affectedRuleSets: ruleSets.results.map(row => ({ id: row.id, version: row.version })),
    affectedScenarios: [],
    reasons,
  };
}
