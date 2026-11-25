import { createHash } from "node:crypto";
export type ArtifactResourceKind = "PDF" | "HTML" | "XML" | "JSON" | "UNKNOWN";
export interface DiscoveredArtifactLink { url: string; text: string; resourceKind: ArtifactResourceKind }
export interface ArtifactDiscoveryOptions { allowedHosts: ReadonlySet<string>; fetcher?: typeof fetch; timeoutMs?: number; maxBytes?: number }
export interface ArtifactDiscoveryDatabase { query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> }
export interface ArtifactDiscoveryResult { status: "DISCOVERED" | "UNAVAILABLE" | "REJECTED" | "ERROR"; sourceUrl: string; linksFound: number; candidatesUpserted: number; pageSha256: string | null; httpStatus: number | null; errorCode: string | null }

const DOCUMENT_TERMS = /(?:nota\s+t[eé]cnica|\bnt\s*[-.]?\s*\d|manual|esquema|schema|\bxsd\b|\bxml\b|leiaute|layout|anexo|documenta[cç][aã]o\s+t[eé]cnica|legisla[cç][aã]o|\bato\b|portaria|resolu[cç][aã]o|informe\s+t[eé]cnico|tabela\s+t[eé]cnica|orienta[cç][aã]o\s+t[eé]cnica)/i;
function decodeHtml(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_m, d: string) => { const n = Number(d); return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; })
    .replace(/&#x([\da-f]+);/gi, (_m, h: string) => { const n = Number.parseInt(h, 16); return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; });
}
function resourceKind(url: URL): ArtifactResourceKind {
  const path = url.pathname.toLowerCase();
  if (/\.pdf$/.test(path)) return "PDF";
  if (/\.(?:xml|xsd)$/.test(path)) return "XML";
  if (/\.json$/.test(path)) return "JSON";
  if (/\.(?:html?|aspx?)$/.test(path)) return "HTML";
  return "UNKNOWN";
}
function isAllowedPort(url: URL): boolean {
  return !url.port || (url.hostname.toLowerCase() === "gnre.pe.gov.br" && url.port === "444");
}
function isDocumentLink(url: URL, text: string): boolean {
  return resourceKind(url) !== "UNKNOWN" || DOCUMENT_TERMS.test(text) || DOCUMENT_TERMS.test(url.pathname);
}
export function extractOfficialArtifactLinks(html: string, sourcePageUrl: string, allowedHosts: ReadonlySet<string>): DiscoveredArtifactLink[] {
  let base: URL;
  try { base = new URL(sourcePageUrl); } catch { return []; }
  if (base.protocol !== "https:" || base.username || base.password || !allowedHosts.has(base.hostname.toLowerCase()) || !isAllowedPort(base)) return [];
  const cleanHtml = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const found = new Map<string, DiscoveredArtifactLink>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(cleanHtml)) !== null) {
    const attrs = match[1] ?? "";
    const hrefMatch = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const rawHref = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!rawHref) continue;
    const text = decodeHtml((match[2] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim().slice(0, 500);
    let target: URL;
    try { target = new URL(decodeHtml(rawHref.trim()), base); } catch { continue; }
    target.hash = "";
    if (target.protocol !== "https:" || target.username || target.password || !allowedHosts.has(target.hostname.toLowerCase()) || !isAllowedPort(target)) continue;
    if (!isDocumentLink(target, text)) continue;
    found.set(target.toString(), { url: target.toString(), text, resourceKind: resourceKind(target) });
  }
  return [...found.values()];
}
async function readBoundedHtml(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("PAGE_TOO_LARGE");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new Error("PAGE_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function failure(status: ArtifactDiscoveryResult["status"], sourceUrl: string, errorCode: string, httpStatus: number | null = null): ArtifactDiscoveryResult {
  return { status, sourceUrl, linksFound: 0, candidatesUpserted: 0, pageSha256: null, httpStatus, errorCode };
}
export async function discoverOfficialArtifacts(db: ArtifactDiscoveryDatabase, sourceId: string, sourceUrl: string, options: ArtifactDiscoveryOptions): Promise<ArtifactDiscoveryResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)) return failure("REJECTED", sourceUrl, "INVALID_SOURCE_ID");
  let pageUrl: URL;
  try { pageUrl = new URL(sourceUrl); } catch { return failure("REJECTED", sourceUrl, "INVALID_SOURCE_URL"); }
  if (pageUrl.protocol !== "https:" || pageUrl.username || pageUrl.password || !options.allowedHosts.has(pageUrl.hostname.toLowerCase()) || !isAllowedPort(pageUrl)) {
    return failure("REJECTED", sourceUrl, "SOURCE_HOST_NOT_ALLOWED");
  }
  try {
    const response = await (options.fetcher ?? fetch)(pageUrl, {
      method: "GET", redirect: "manual",
      headers: { "user-agent": "FiscalIntelligenceHub-ArtifactDiscovery/0.1", "accept": "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
    });
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return failure("REJECTED", sourceUrl, "REDIRECT_BLOCKED", response.status); }
    if (!response.ok) { await response.body?.cancel(); return failure("UNAVAILABLE", sourceUrl, "HTTP_" + response.status, response.status); }
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
      await response.body?.cancel(); return failure("REJECTED", sourceUrl, "SOURCE_PAGE_NOT_HTML", response.status);
    }
    const body = await readBoundedHtml(response, options.maxBytes ?? 3 * 1024 * 1024);
    const pageSha256 = createHash("sha256").update(body).digest("hex");
    const links = extractOfficialArtifactLinks(new TextDecoder("utf-8", { fatal: false }).decode(body), sourceUrl, options.allowedHosts);
    let candidatesUpserted = 0;
    for (const link of links) {
      const inserted = await db.query(
        `INSERT INTO fiscal.normative_artifact_candidates
           (source_id, source_page_url, candidate_url, link_text, resource_kind)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (source_id, candidate_url) DO UPDATE
           SET source_page_url = EXCLUDED.source_page_url, link_text = EXCLUDED.link_text,
               resource_kind = EXCLUDED.resource_kind, last_seen_at = now()
         WHERE fiscal.normative_artifact_candidates.review_status <> 'REJECTED'`,
        [sourceId, sourceUrl, link.url, link.text, link.resourceKind]
      );
      candidatesUpserted += inserted.rowCount ?? 0;
    }
    return { status: "DISCOVERED", sourceUrl, linksFound: links.length, candidatesUpserted, pageSha256, httpStatus: response.status, errorCode: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return failure(message.includes("PAGE_TOO_LARGE") ? "REJECTED" : "ERROR", sourceUrl,
      message.includes("PAGE_TOO_LARGE") ? "SOURCE_PAGE_TOO_LARGE" :
      message.toLowerCase().includes("timeout") || message.toLowerCase().includes("abort") ? "FETCH_TIMEOUT" : "DISCOVERY_FAILED");
  }
}
