import type { RagAnswer, RagHit, FiscalEvidence } from '@rts/domain';
import {
  lexicalScore,
  rerank,
  temporalMatch,
  sourceTypeOf,
  topicsOf,
  evidenceConfidence,
  type RagCandidate,
} from '@rts/domain';

export async function searchRag(
  db: D1Database,
  query: string,
  topK = 5,
  asOf?: string,
  sourceType?: string,
  jurisdiction?: string,
): Promise<RagAnswer> {
  const limit = Math.max(1, Math.min(topK, 10));

  const rows = await db
    .prepare(
      'SELECT c.id chunk_id,c.document_id,c.text,c.metadata_json,d.title,d.jurisdiction,d.source_url,d.published_at,d.effective_from,d.effective_to,d.version,d.content_hash,s.authority ' +
        'FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id LEFT JOIN fiscal_sources s ON s.id=d.source_id ' +
        'WHERE (? IS NULL OR d.jurisdiction=?) ORDER BY d.published_at DESC LIMIT 2000',
    )
    .bind(jurisdiction ?? null, jurisdiction ?? null)
    .all<Record<string, unknown>>();

  const candidates: RagCandidate[] = rows.results
    .map((r) => ({
      id: String(r.chunk_id),
      documentId: String(r.document_id),
      text: String(r.text),
      score: lexicalScore(query, String(r.text)),
      sourceUrl: String(r.source_url),
      title: String(r.title),
      publishedAt: String(r.published_at ?? ''),
      effectiveFrom: r.effective_from ? String(r.effective_from) : undefined,
      effectiveTo: r.effective_to ? String(r.effective_to) : undefined,
      authority: r.authority ? String(r.authority) : undefined,
      sourceType: sourceTypeOf(r.metadata_json ? String(r.metadata_json) : undefined),
      jurisdiction: r.jurisdiction ? String(r.jurisdiction) : undefined,
      topics: topicsOf(r.metadata_json ? String(r.metadata_json) : undefined),
    }))
    .filter(
      (candidate) =>
        candidate.score > 0 &&
        temporalMatch(candidate, asOf) &&
        (!sourceType || candidate.sourceType === sourceType),
    );

  const ranked = rerank(query, candidates).slice(0, limit);

  const hits: RagHit[] = ranked.map((x) => {
    const sourceRow = rows.results.find((r) => String(r.chunk_id) === x.id) as
      | Record<string, unknown>
      | undefined;

    const evidence: FiscalEvidence = {
      documentId: x.documentId,
      chunkId: x.id,
      authority: x.authority ?? 'UNKNOWN',
      url: x.sourceUrl,
      publishedAt: x.publishedAt,
      effectiveFrom: x.effectiveFrom,
      effectiveTo: x.effectiveTo,
      version: String(sourceRow?.version ?? 'UNKNOWN'),
      contentHash: String(sourceRow?.content_hash ?? 'UNKNOWN'),
      evidenceLevel: 'PRIMARY',
    };

    return {
      chunkId: x.id,
      documentId: x.documentId,
      score: x.score,
      text: x.text,
      evidence,
    };
  });

  const confidence =
    hits.length === 0 ? 'LOW' : evidenceConfidence(hits[0].score);
  const grounded = hits.length > 0;
  const answer = grounded
    ? `Evidências recuperadas para: "${query}". A resposta deve ser construída exclusivamente a partir das fontes recuperadas e respeitar a vigência indicada.`
    : 'Não há evidência suficiente no índice RAG para responder com segurança.';

  return {
    answer,
    hits,
    confidence,
    grounded,
    generatedAt: new Date().toISOString(),
  };
}

export async function getRagDocument(
  db: D1Database,
  documentId: string,
) {
  const row = await db
    .prepare(
      'SELECT id,title,source_url,published_at,effective_from,effective_to,version,content_hash,source_id,jurisdiction FROM rag_documents WHERE id=?',
    )
    .bind(documentId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const chunks = await db
    .prepare(
      'SELECT id,ordinal,text,metadata_json FROM rag_chunks WHERE document_id=? ORDER BY ordinal',
    )
    .bind(documentId)
    .all<Record<string, unknown>>();

  return {
    documentId: String(row.id),
    title: String(row.title),
    sourceUrl: String(row.source_url),
    publishedAt: String(row.published_at ?? ''),
    effectiveFrom: row.effective_from
      ? String(row.effective_from)
      : undefined,
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    version: String(row.version),
    contentHash: String(row.content_hash),
    sourceId: String(row.source_id),
    jurisdiction: String(row.jurisdiction ?? ''),
    chunks: chunks.results.map((x) => ({
      chunkId: String(x.id),
      ordinal: Number(x.ordinal),
      text: String(x.text),
      metadata: JSON.parse(String(x.metadata_json ?? '{}')),
    })),
  };
}
