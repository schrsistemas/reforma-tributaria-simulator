import type { GovernmentSource } from '@rts/domain';
import type { GovernmentCollector } from './government-collectors.js';
import { HttpCollector } from './government-collectors.js';
import { listGovernmentSources } from './government-source-repository.js';

interface Env { DB?: D1Database; }
const collectors: GovernmentCollector[] = [new HttpCollector()];
function resolveCollector(source: GovernmentSource): GovernmentCollector {
  const collector = collectors.find(candidate => candidate.supports(source));
  if (!collector) throw new Error(`COLLECTOR_NOT_IMPLEMENTED_${source.collectorType}`);
  return collector;
}

export async function collectGovernmentSource(env: Env, source: GovernmentSource) {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const result = await resolveCollector(source).collect(source);
    const latencyMs = Date.now() - started;
    await env.DB.prepare("UPDATE government_sources SET health_status='HEALTHY', last_checked_at=?, last_success_at=?, last_failure_at=NULL, last_hash=?, updated_at=? WHERE id=?").bind(result.fetchedAt, result.fetchedAt, result.normalizedHash, checkedAt, source.id).run();
    await env.DB.prepare("INSERT INTO collector_health (id,source_id,checked_at,status,http_status,latency_ms,content_hash,error_code,error_message,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), source.id, checkedAt, 'HEALTHY', result.httpStatus ?? null, latencyMs, result.contentHash, null, null, checkedAt).run();
    return { ok: true, sourceId: source.id, result, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : 'COLLECTION_FAILED';
    await env.DB.prepare("UPDATE government_sources SET health_status='FAILED', last_checked_at=?, last_failure_at=?, updated_at=? WHERE id=?").bind(checkedAt, checkedAt, checkedAt, source.id).run();
    await env.DB.prepare("INSERT INTO collector_health (id,source_id,checked_at,status,http_status,latency_ms,content_hash,error_code,error_message,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), source.id, checkedAt, 'FAILED', null, latencyMs, null, message, message, checkedAt).run();
    throw error;
  }
}

export async function collectEnabledGovernmentSources(env: Env) {
  const sources = await listGovernmentSources(env);
  const results: Array<{ sourceId: string; ok: boolean; error?: string }> = [];
  for (const source of sources) {
    try { await collectGovernmentSource(env, source); results.push({ sourceId: source.id, ok: true }); }
    catch (error) { results.push({ sourceId: source.id, ok: false, error: error instanceof Error ? error.message : 'COLLECTION_FAILED' }); }
  }
  return results;
}