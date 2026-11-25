import { createHash } from "node:crypto";

export type ArtifactExtension = "pdf" | "xsd" | "xml" | "json";
export type ArtifactResourceKind = "PDF" | "HTML" | "XML" | "JSON" | "UNKNOWN";

export interface ArtifactCandidate {
  url: string;
  linkText: string;
  extension: ArtifactExtension;
}
export interface DiscoveredArtifactLink {
  url: string;
  text: string;
  resourceKind: ArtifactResourceKind;
}
export interface ArtifactDiscoveryOptions {
  allowedHosts: ReadonlySet<string>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}
export interface ArtifactDiscoveryDatabase {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface ArtifactDiscoveryResult {
  status: "DISCOVERED" | "UNAVAILABLE" | "REJECTED" | "ERROR";
  sourceUrl: string;
  linksFound: number;
  candidatesUpserted: number;
  pageSha256: string | null;
  httpStatus: number | null;
  errorCode: string | null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    });
}

function resourceKind(extension: ArtifactExtension): ArtifactResourceKind {
  if (extension === "pdf") return "PDF";
  if (extension === "xml" || extension === "xsd") return "XML";
  if (extension === "json") return "JSON";
  return "UNKNOWN";
}

function allowedPort(url: URL): boolean {
  return url.port === "" || (url.hostname.toLowerCase() === "gnre.pe.gov.br" && url.port === "444");
}

/**
 * Extracts direct links to supported official artifacts from an already-fetched
 * HTML page. It performs no network requests and never follows discovered links.
 */
export function discoverArtifactCandidates(
  html: string,
  baseUrl: string,
  allowedHosts: ReadonlySet<string>
): ArtifactCandidate[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  if (base.protocol !== "https:" || base.username || base.password ||
      !allowedHosts.has(base.hostname.toLowerCase()) || !allowedPort(base)) return [];

  const document = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const anchors = document.match(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi) ?? [];
  const candidates = new Map<string, ArtifactCandidate>();

  for (const anchor of anchors) {
    const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0];
    if (!openingTag) continue;
    const hrefMatch = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(openingTag);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!href || /^(?:javascript|data|mailto|tel):/i.test(href.trim())) continue;

    let url: URL;
    try {
      url = new URL(decodeHtml(href.trim()), base);
    } catch {
      continue;
    }
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
        !allowedHosts.has(hostname) || hostname === "localhost" ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":") ||
        !allowedPort(url)) continue;

    const extensionMatch = url.pathname.toLowerCase().match(/\.(pdf|xsd|xml|json)$/);
    if (!extensionMatch) continue;
    url.hash = "";
    const canonicalUrl = url.toString();
    if (!candidates.has(canonicalUrl)) {
      const linkText = decodeHtml(anchor
        .replace(/^<a\b[^>]*>/i, "")
        .replace(/<\/a\s*>$/i, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()).slice(0, 300);
      candidates.set(canonicalUrl, {
        url: canonicalUrl,
        linkText,
        extension: extensionMatch[1] as ArtifactExtension
      });
    }
  }
  return [...candidates.values()];
}

/** Backward-compatible discovery view used by the source checker tests. */
export function extractOfficialArtifactLinks(
  html: string,
  sourcePageUrl: string,
  allowedHosts: ReadonlySet<string>
): DiscoveredArtifactLink[] {
  return discoverArtifactCandidates(html, sourcePageUrl, allowedHosts).map(candidate => ({
    url: candidate.url,
    text: candidate.linkText,
    resourceKind: resourceKind(candidate.extension)
  }));
}

async function readBoundedHtml(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("PAGE_TOO_LARGE");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("PAGE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function failure(
  status: ArtifactDiscoveryResult["status"],
  sourceUrl: string,
  errorCode: string,
  httpStatus: number | null = null
): ArtifactDiscoveryResult {
  return { status, sourceUrl, linksFound: 0, candidatesUpserted: 0, pageSha256: null, httpStatus, errorCode };
}

/**
 * Fetches one allowlisted source landing page and persists direct artifact links.
 * Existing human review decisions are never reset by rediscovery.
 */
export async function discoverOfficialArtifacts(
  db: ArtifactDiscoveryDatabase,
  sourceId: string,
  sourceUrl: string,
  options: ArtifactDiscoveryOptions
): Promise<ArtifactDiscoveryResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)) {
    return failure("REJECTED", sourceUrl, "INVALID_SOURCE_ID");
  }
  let pageUrl: URL;
  try {
    pageUrl = new URL(sourceUrl);
  } catch {
    return failure("REJECTED", sourceUrl, "INVALID_SOURCE_URL");
  }
  if (pageUrl.protocol !== "https:" || pageUrl.username || pageUrl.password ||
      !options.allowedHosts.has(pageUrl.hostname.toLowerCase()) || !allowedPort(pageUrl)) {
    return failure("REJECTED", sourceUrl, "SOURCE_HOST_NOT_ALLOWED");
  }

  try {
    const response = await (options.fetcher ?? fetch)(pageUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "FiscalIntelligenceHub-ArtifactDiscovery/0.1",
        "accept": "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return failure("REJECTED", sourceUrl, "REDIRECT_BLOCKED", response.status);
    }
    if (!response.ok) {
      await response.body?.cancel();
      return failure("UNAVAILABLE", sourceUrl, "HTTP_" + response.status, response.status);
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
      await response.body?.cancel();
      return failure("REJECTED", sourceUrl, "SOURCE_PAGE_NOT_HTML", response.status);
    }
    const body = await readBoundedHtml(response, options.maxBytes ?? 3 * 1024 * 1024);
    const pageSha256 = createHash("sha256").update(body).digest("hex");
    const candidates = discoverArtifactCandidates(
      new TextDecoder("utf-8", { fatal: false }).decode(body),
      sourceUrl,
      options.allowedHosts
    );
    let candidatesUpserted = 0;
    for (const candidate of candidates) {
      const inserted = await db.query(
        `INSERT INTO fiscal.normative_artifact_candidates
           (source_id, source_page_url, artifact_url, link_text, file_extension)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (source_id, artifact_url) DO UPDATE
           SET source_page_url = EXCLUDED.source_page_url,
               link_text = EXCLUDED.link_text,
               file_extension = EXCLUDED.file_extension,
               last_seen_at = now()
         WHERE fiscal.normative_artifact_candidates.review_status <> 'REJECTED'`,
        [sourceId, sourceUrl, candidate.url, candidate.linkText, candidate.extension]
      );
      candidatesUpserted += inserted.rowCount ?? 0;
    }
    return {
      status: "DISCOVERED",
      sourceUrl,
      linksFound: candidates.length,
      candidatesUpserted,
      pageSha256,
      httpStatus: response.status,
      errorCode: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return failure(
      message.includes("PAGE_TOO_LARGE") ? "REJECTED" : "ERROR",
      sourceUrl,
      message.includes("PAGE_TOO_LARGE") ? "SOURCE_PAGE_TOO_LARGE" :
        message.toLowerCase().includes("timeout") || message.toLowerCase().includes("abort")
          ? "FETCH_TIMEOUT" : "DISCOVERY_FAILED"
    );
  }
}
