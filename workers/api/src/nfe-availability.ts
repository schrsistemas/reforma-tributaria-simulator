/**
 * Leitura conservadora do painel oficial de disponibilidade da NF-e.
 * Só classifica cores explicitamente identificadas no HTML; imagens sem
 * metadados reconhecíveis permanecem UNKNOWN, nunca presumidas como verdes.
 */
export const NFE_AVAILABILITY_URL = 'https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx';

export type AvailabilityStatus = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
export interface NfeServiceStatus {
  service: string;
  status: AvailabilityStatus;
  evidence: string;
}
export interface NfeAuthorityStatus {
  authority: string;
  services: NfeServiceStatus[];
}
export interface NfeAvailabilitySnapshot {
  checkedAt: string;
  sourceUrl: string;
  sourceLastCheckedAt?: string;
  version?: string;
  authorities: NfeAuthorityStatus[];
  santaCatarina: {
    normalAuthorizer: string;
    contingencyAuthorizer: string;
    services: NfeServiceStatus[];
  };
  parser: { recognizedIndicators: number; unknownIndicators: number };
}

const SERVICE_NAMES = [
  'authorization', 'authorizationReturn', 'invalidation', 'protocolQuery',
  'serviceStatus', 'averageTime', 'registrationQuery', 'eventReception',
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function classifyCell(cell: string): NfeServiceStatus {
  const attrs = [...cell.matchAll(/\b(?:alt|title|src|class|aria-label)\s*=\s*["']([^"']*)["']/gi)]
    .map(match => match[1]).join(' ').toLowerCase();
  const explicit = attrs.match(/(?:^|[^a-z])(green|verde|yellow|amarelo|red|vermelho)(?:[^a-z]|$)/i)?.[1]?.toLowerCase();
  const status: AvailabilityStatus = explicit
    ? (explicit === 'green' || explicit === 'verde' ? 'GREEN'
      : explicit === 'yellow' || explicit === 'amarelo' ? 'YELLOW' : 'RED')
    : 'UNKNOWN';
  return { service: '', status, evidence: explicit ? attrs.slice(0, 180) : 'INDICATOR_METADATA_NOT_RECOGNIZED' };
}

function extractRows(html: string): NfeAuthorityStatus[] {
  const results: NfeAuthorityStatus[] = [];
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi)?.join('\n') ?? html;
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
    if (cells.length < 2) continue;
    const authority = plainText(cells[0]).toUpperCase().replace(/\s+/g, '');
    if (!/^(?:[A-Z]{2}|SVRS|SVAN|SVC-AN|SVC-RS)$/.test(authority)) continue;
    const services = cells.slice(1, 9).map((cell, index) => {
      const item = classifyCell(cell);
      return { ...item, service: SERVICE_NAMES[index] ?? 'unknown' };
    });
    results.push({ authority, services });
  }
  return results;
}

export function parseNfeAvailabilityHtml(html: string, checkedAt = new Date().toISOString()): NfeAvailabilitySnapshot {
  const authorities = extractRows(html);
  const sourceLastCheckedAt = decodeHtml(html.match(/Última Verifica(?:ç|&ccedil;)ão\s*:\s*([^<\r\n]+)/i)?.[1] ?? '').trim() || undefined;
  const version = html.match(/WebServices\s+Vers(?:ão|ao)\s*([0-9.]+)/i)?.[1];
  const scRow = authorities.find(item => item.authority === 'SVRS');
  const relevantScServices = (scRow?.services ?? []).filter(item => item.service !== 'averageTime');
  const recognizedIndicators = authorities.reduce((total, item) => total + item.services.filter(service => service.status !== 'UNKNOWN').length, 0);
  const unknownIndicators = authorities.reduce((total, item) => total + item.services.filter(service => service.status === 'UNKNOWN').length, 0);
  return {
    checkedAt,
    sourceUrl: NFE_AVAILABILITY_URL,
    sourceLastCheckedAt,
    version,
    authorities,
    santaCatarina: {
      normalAuthorizer: 'SVRS',
      contingencyAuthorizer: 'SVC-AN',
      services: relevantScServices,
    },
    parser: { recognizedIndicators, unknownIndicators },
  };
}

export async function fetchNfeAvailability(fetchImpl: typeof fetch = fetch, now: () => string = () => new Date().toISOString()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(NFE_AVAILABILITY_URL, {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error('NFE_STATUS_SOURCE_HTTP_' + response.status), { status: 502 });
    const contentType = response.headers.get('content-type') ?? '';
    if (!/html|text/i.test(contentType)) throw Object.assign(new Error('NFE_STATUS_SOURCE_INVALID_CONTENT_TYPE'), { status: 502 });
    const html = await response.text();
    if (html.length > 5_000_000) throw Object.assign(new Error('NFE_STATUS_SOURCE_TOO_LARGE'), { status: 502 });
    const snapshot = parseNfeAvailabilityHtml(html, now());
    if (snapshot.authorities.length === 0) {
      throw Object.assign(new Error('NFE_STATUS_LAYOUT_NOT_RECOGNIZED'), { status: 502 });
    }
    return snapshot;
  } finally {
    clearTimeout(timeout);
  }
}
