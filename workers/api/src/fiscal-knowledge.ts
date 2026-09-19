export interface FiscalSource {
  id: string;
  authority: string;
  name: string;
  sourceType: string;
  officialUrl: string;
  collectionMethod: string;
  cadence: string;
  enabled: boolean;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastHash?: string;
}

interface SourceRow {
  id: string;
  authority: string;
  name: string;
  source_type: string;
  official_url: string;
  collection_method: string;
  cadence: string;
  enabled: number;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_hash: string | null;
}

export interface KnowledgeEnv {
  DB?: D1Database;
}

function mapSource(row: SourceRow): FiscalSource {
  return {
    id: row.id,
    authority: row.authority,
    name: row.name,
    sourceType: row.source_type,
    officialUrl: row.official_url,
    collectionMethod: row.collection_method,
    cadence: row.cadence,
    enabled: row.enabled === 1,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastHash: row.last_hash ?? undefined,
  };
}

export async function listFiscalSources(env: KnowledgeEnv): Promise<FiscalSource[]> {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });
  const rows = await env.DB.prepare(
    'SELECT id,authority,name,source_type,official_url,collection_method,cadence,enabled,last_checked_at,last_success_at,last_hash FROM fiscal_sources WHERE enabled = 1 ORDER BY authority,name'
  ).all<SourceRow>();
  return rows.results.map(mapSource);
}

export async function getFiscalSource(env: KnowledgeEnv, sourceId: string): Promise<FiscalSource | null> {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });
  const row = await env.DB.prepare(
    'SELECT id,authority,name,source_type,official_url,collection_method,cadence,enabled,last_checked_at,last_success_at,last_hash FROM fiscal_sources WHERE id = ?'
  ).bind(sourceId).first<SourceRow>();
  return row ? mapSource(row) : null;
}

export async function touchSourceCheck(
  env: KnowledgeEnv,
  sourceId: string,
  checkedAt: string,
  success: boolean,
  contentHash?: string,
): Promise<void> {
  if (!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'), { status: 503 });
  if (success) {
    await env.DB.prepare(
      'UPDATE fiscal_sources SET last_checked_at = ?, last_success_at = ?, last_hash = COALESCE(?, last_hash), updated_at = ? WHERE id = ?'
    ).bind(checkedAt, checkedAt, contentHash ?? null, checkedAt, sourceId).run();
    return;
  }
  await env.DB.prepare(
    'UPDATE fiscal_sources SET last_checked_at = ?, updated_at = ? WHERE id = ?'
  ).bind(checkedAt, checkedAt, sourceId).run();
}
