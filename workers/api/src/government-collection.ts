import type { GovernmentSource } from '@rts/domain';
import type { GovernmentCollector } from './government-collectors.js';
import { HttpCollector } from './government-collectors.js';
import { listGovernmentSources } from './government-source-repository.js';
import { hashDocument, chunkDocument } from './rag-ingestion.js';

interface Env { DB?: D1Database; }
const collectors: GovernmentCollector[] = [new HttpCollector()];
function resolveCollector(source: GovernmentSource): GovernmentCollector {
  const collector = collectors.find(candidate => candidate.supports(source));
  if (!collector) throw new Error(`COLLECTOR_NOT_IMPLEMENTED_${source.collectorType}`);
  return collector;
}


async function ingestGovernmentEvidence(env: Env, source: GovernmentSource, result: { text?: string; fetchedAt: string }) {
  if (!env.DB || !result.text) return { ingested: false, reason: 'NO_TEXT' };
  const contentHash = await hashDocument(result.text);
  const existing = await env.DB.prepare('SELECT id,content_hash FROM rag_documents WHERE source_id=? ORDER BY published_at DESC LIMIT 1').bind(source.id).first<{id:string;content_hash:string}>();
  if (existing?.content_hash === contentHash) return { ingested: false, reason: 'UNCHANGED', documentId: existing.id };
  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO rag_documents (id,source_id,title,jurisdiction,published_at,source_url,content_hash,version,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(documentId,source.id,source.name,source.jurisdictionLevel,result.fetchedAt,source.url,contentHash,'AUTO-'+contentHash.slice(0,12),now).run();
  const chunks = chunkDocument(result.text);
  for (let i=0;i<chunks.length;i++) {
    await env.DB.prepare('INSERT INTO rag_chunks (id,document_id,ordinal,text,token_count,metadata_json) VALUES (?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),documentId,i,chunks[i],chunks[i].split(/\s+/).length,JSON.stringify({sourceId:source.id,ordinal:i})).run();
  }
  return { ingested: true, documentId, chunkCount: chunks.length };
}

export async function collectGovernmentSource(env: Env, source: GovernmentSource) {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const result = await resolveCollector(source).collect(source);
    const latencyMs = Date.now() - started;
    await env.DB.prepare("UPDATE government_sources SET health_status='HEALTHY', last_checked_at=?, last_success_at=?, last_failure_at=NULL, last_hash=?, updated_at=? WHERE id=?").bind(result.fetchedAt, result.fetchedAt, result.normalizedHash, checkedAt, source.id).run();
    const rag = await ingestGovernmentEvidence(env, source, { text: result.text, fetchedAt: result.fetchedAt });
    await env.DB.prepare("INSERT INTO collector_health (id,source_id,checked_at,status,http_status,latency_ms,content_hash,error_code,error_message,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), source.id, checkedAt, 'HEALTHY', result.httpStatus ?? null, latencyMs, result.contentHash, null, null, checkedAt).run();
    return { ok: true, sourceId: source.id, result, rag, latencyMs };
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