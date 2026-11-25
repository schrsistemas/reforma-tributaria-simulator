export interface RagCandidate {
  id: string;
  documentId: string;
  text: string;
  score: number;
  sourceUrl: string;
  title: string;
  publishedAt?: string;
  publishedAtSource?: string;
  effectiveFrom?: string;
  effectiveFromSource?: string;
  effectiveTo?: string;
  authority?: string;
  sourceType?: string;
  jurisdiction?: string;
  topics?: string[];
}

export function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string) {
  return normalizeForSearch(value).split(' ').filter((x) => x.length > 2);
}

export function lexicalScore(query: string, text: string) {
  const q = tokenize(query);
  const t = new Set(tokenize(text));
  if (!q.length) return 0;

  let exact = 0;
  for (const w of q) {
    if (t.has(w)) exact++;
  }

  return exact / q.length;
}

export function sourcePriority(authority?: string, sourceType?: string) {
  const a = normalizeForSearch(authority ?? '');
  const s = normalizeForSearch(sourceType ?? '');

  let score = 0;
  if (/receita federal|comite gestor|cgibs|planalto|ministerio da fazenda/.test(a)) score += 0.15;
  if (/law|regulation|technical note|guidance|lei|regulamento|nota tecnica|orientacao/.test(s)) score += 0.05;
  if (/news|faq|noticia/.test(s)) score -= 0.08;

  return Math.max(-0.15, Math.min(0.2, score));
}

export function topicScore(query: string, topics?: string[]) {
  if (!topics?.length) return 0;

  const q = new Set(tokenize(query));
  const t = new Set(topics.flatMap(tokenize));

  let hit = 0;
  for (const w of q) {
    if (t.has(w)) hit++;
  }

  return q.size ? Math.min(0.12, 0.12 * hit / q.size) : 0;
}

export function rerank(query: string, candidates: RagCandidate[]) {
  return candidates
    .map((c) => ({
      ...c,
      score: Math.max(
        0,
        Math.min(
          1,
          c.score * 0.55 +
            lexicalScore(query, c.text) * 0.25 +
            sourcePriority(c.authority, c.sourceType) +
            topicScore(query, c.topics),
        ),
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')) ||
        a.id.localeCompare(b.id),
    );
}

export function temporalMatch(c: RagCandidate, asOf?: string) {
  if (!asOf) return true;

  const requestedDate = Date.parse(asOf);
  if (!Number.isFinite(requestedDate)) return false;

  // Publication is not commencement of legal effect. Brazilian norms may
  // have vacatio legis or a separately defined effective date. Historical
  // retrieval therefore requires an explicitly sourced effectiveFrom.
  if (!['EXPLICIT_TEXT', 'PUBLICATION_DATE_CLAUSE'].includes(c.effectiveFromSource ?? '')) {
    return false;
  }
  if (!c.effectiveFrom) return false;

  const from = Date.parse(c.effectiveFrom);
  const to = c.effectiveTo ? Date.parse(c.effectiveTo) : Number.POSITIVE_INFINITY;
  return Number.isFinite(from) && requestedDate >= from && requestedDate <= to;
}

export function effectiveToSourceOf(metadataJson?: string) {
  try {
    const x = JSON.parse(metadataJson ?? '{}') as Record<string, unknown>;
    return typeof x.effectiveToSource === 'string' ? x.effectiveToSource : undefined;
  } catch {
    return undefined;
  }
}

export function effectiveFromSourceOf(metadataJson?: string) {
  try {
    const x = JSON.parse(metadataJson ?? '{}') as Record<string, unknown>;
    return typeof x.effectiveFromSource === 'string' ? x.effectiveFromSource : undefined;
  } catch {
    return undefined;
  }
}

export function publishedAtSourceOf(metadataJson?: string) {
  try {
    const x = JSON.parse(metadataJson ?? '{}') as Record<string, unknown>;
    return typeof x.publishedAtSource === 'string' ? x.publishedAtSource : undefined;
  } catch {
    return undefined;
  }
}

export function sourceTypeOf(metadataJson?: string) {
  try {
    const x = JSON.parse(metadataJson ?? '{}') as Record<string, unknown>;
    return typeof x.sourceType === 'string' ? x.sourceType : undefined;
  } catch {
    return undefined;
  }
}

export function topicsOf(metadataJson?: string) {
  try {
    const x = JSON.parse(metadataJson ?? '{}') as Record<string, unknown>;
    return Array.isArray(x.topics)
      ? x.topics.filter((v): v is string => typeof v === 'string')
      : undefined;
  } catch {
    return undefined;
  }
}

export function insufficientEvidence(hits: number) {
  return hits === 0;
}

export function evidenceConfidence(score: number) {
  return score >= 0.65 ? 'HIGH' : score >= 0.30 ? 'MEDIUM' : 'LOW';
}
