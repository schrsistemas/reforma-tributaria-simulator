import { getFiscalSource, touchSourceCheck, type KnowledgeEnv } from './fiscal-knowledge.js';

export interface EvidenceEnv extends KnowledgeEnv {
  EVIDENCE_BUCKET?: R2Bucket;
}

export interface CollectedEvidence {
  sourceId: string;
  contentHash: string;
  normalizedHash: string;
  retrievedAt: string;
  status: 'UNCHANGED' | 'CHANGED' | 'CREATED';
  contentLocation?: string;
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export async function collectFiscalSource(env: EvidenceEnv, sourceId: string): Promise<CollectedEvidence> {
  const source = await getFiscalSource(env, sourceId);
  if (!source || !source.enabled) throw Object.assign(new Error('FISCAL_SOURCE_NOT_FOUND_OR_DISABLED'), { status: 404 });

  const retrievedAt = new Date().toISOString();

  try {
    const response = await fetch(source.officialUrl, {
      headers: { accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
      redirect: 'follow',
    });

    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const contentHash = await sha256Hex(buffer);
    const normalizedHash = await sha256Hex(new TextEncoder().encode(normalize(text)));

    let status: CollectedEvidence['status'] = source.lastHash === normalizedHash ? 'UNCHANGED' : (source.lastHash ? 'CHANGED' : 'CREATED');

    if (env.DB) {
      const evidenceId = `${source.id}-${normalizedHash.slice(0, 16)}`;
      let contentLocation = `memory://${evidenceId}`;

      if (env.EVIDENCE_BUCKET) {
        contentLocation = `r2://evidence/${source.id}/${evidenceId}`;
        await env.EVIDENCE_BUCKET.put(`evidence/${source.id}/${evidenceId}`, buffer, {
          httpMetadata: { contentType: response.headers.get('content-type') ?? 'application/octet-stream' },
        });
      }

      await env.DB.prepare(
        'INSERT OR IGNORE INTO fiscal_evidence (id,source_id,retrieved_at,canonical_url,content_hash,normalized_hash,content_location,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(evidenceId, source.id, retrievedAt, source.officialUrl, contentHash, normalizedHash, contentLocation, status === 'CHANGED' ? 'CHANGED' : 'FETCHED', retrievedAt).run();

      await touchSourceCheck(env, source.id, retrievedAt, true, normalizedHash);
    }

    return { sourceId: source.id, contentHash, normalizedHash, retrievedAt, status };
  } catch (error) {
    if (env.DB) await touchSourceCheck(env, source.id, retrievedAt, false);
    throw error;
  }
}
