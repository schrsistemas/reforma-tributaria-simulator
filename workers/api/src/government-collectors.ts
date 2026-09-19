import type { CollectorResult, GovernmentSource } from '@rts/domain';

export interface CollectorContext {
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export interface GovernmentCollector {
  readonly type: GovernmentSource['collectorType'];
  supports(source: GovernmentSource): boolean;
  collect(source: GovernmentSource, context?: CollectorContext): Promise<CollectorResult>;
}

export function assertOfficialHttpUrl(source: GovernmentSource): URL {
  const url = new URL(source.officialUrl);
  if (url.protocol !== 'https:') throw new Error('OFFICIAL_SOURCE_MUST_USE_HTTPS');
  return url;
}

export async function fetchOfficialText(source: GovernmentSource, context: CollectorContext = {}): Promise<CollectorResult> {
  const url = assertOfficialHttpUrl(source);
  const fetchImpl = context.fetchImpl ?? fetch;
  const started = Date.now();
  const response = await fetchImpl(url, {
    headers: { 'Accept': 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const content = await response.text();
  const fetchedAt = context.now?.() ?? new Date().toISOString();
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const contentHash = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2,'0')).join('');
  const normalized = content.replace(/\s+/g,' ').trim().toLowerCase();
  const normalizedDigest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  const normalizedHash = Array.from(new Uint8Array(normalizedDigest)).map(x => x.toString(16).padStart(2,'0')).join('');
  return {
    sourceId: source.id,
    fetchedAt,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') ?? undefined,
    contentHash,
    normalizedHash,
    contentLocation: source.officialUrl,
    text: content,
  };
}

export class HttpCollector implements GovernmentCollector {
  readonly type = 'HTML' as const;
  supports(source: GovernmentSource): boolean {
    return source.collectorType === 'HTML' || source.collectorType === 'HTTP_JSON' || source.collectorType === 'HTTP_XML';
  }
  collect(source: GovernmentSource, context?: CollectorContext): Promise<CollectorResult> {
    return fetchOfficialText(source, context);
  }
}
