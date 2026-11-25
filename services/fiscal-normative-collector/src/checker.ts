import { createHash } from "node:crypto";

export type CheckStatus = "AVAILABLE" | "CHANGED" | "UNAVAILABLE" | "REJECTED" | "ERROR";

export interface NormativeSource {
  id: string;
  name: string;
  official_url: string;
}

export interface SnapshotResult {
  status: CheckStatus;
  httpStatus: number | null;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  contentSha256: string | null;
  normalizedContentSha256: string | null;
  fingerprintVersion: string;
  responseMs: number;
  errorCode: string | null;
}

export interface CheckOptions {
  allowedHosts: ReadonlySet<string>;
  maxBytes?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

const FINGERPRINT_VERSION = "html-content-v1";

export function normalizeHtmlForFingerprint(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!doctype[^>]*>/gi, " ")
    .replace(/\s+(?:nonce|integrity|crossorigin|class|style|id|data-[\w:-]+|aria-busy)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim()
    .toLowerCase();
}

function fingerprint(body: Uint8Array, contentType: string): {
  raw: string;
  normalized: string;
} {
  const raw = createHash("sha256").update(body).digest("hex");
  if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
    return { raw, normalized: raw };
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(body);
  const normalized = normalizeHtmlForFingerprint(html);
  return {
    raw,
    normalized: createHash("sha256").update(normalized, "utf8").digest("hex")
  };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("RESPONSE_TOO_LARGE");
  }
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
        throw new Error("RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function result(
  status: CheckStatus,
  startedAt: number,
  values: Partial<SnapshotResult> = {}
): SnapshotResult {
  return {
    status,
    httpStatus: null,
    contentType: null,
    contentLength: null,
    etag: null,
    lastModified: null,
    contentSha256: null,
    normalizedContentSha256: null,
    fingerprintVersion: FINGERPRINT_VERSION,
    responseMs: Math.max(0, Math.round(performance.now() - startedAt)),
    errorCode: null,
    ...values
  };
}

export async function inspectSource(
  source: NormativeSource,
  previousNormalizedHash: string | null,
  options: CheckOptions
): Promise<SnapshotResult> {
  const startedAt = performance.now();
  let url: URL;
  try {
    url = new URL(source.official_url);
  } catch {
    return result("REJECTED", startedAt, { errorCode: "INVALID_SOURCE_URL" });
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return result("REJECTED", startedAt, { errorCode: "HTTPS_REQUIRED" });
  }
  if (!options.allowedHosts.has(url.hostname.toLowerCase())) {
    return result("REJECTED", startedAt, { errorCode: "HOST_NOT_ALLOWED" });
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 3 * 1024 * 1024;
  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "FiscalIntelligenceHub-SourceMonitor/0.2",
        "accept": "text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,application/pdf;q=0.9,*/*;q=0.1"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const metadata = {
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: Number(response.headers.get("content-length") ?? "0") || null,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return result("REJECTED", startedAt, { ...metadata, errorCode: "REDIRECT_BLOCKED" });
    }
    if (!response.ok) {
      await response.body?.cancel();
      return result("UNAVAILABLE", startedAt, { ...metadata, errorCode: "HTTP_" + response.status });
    }
    const contentType = (metadata.contentType ?? "").split(";")[0]!.trim().toLowerCase();
    const supported = /^(text\/html|application\/xhtml\+xml|application\/xml|text\/xml|application\/rss\+xml|application\/atom\+xml|application\/pdf|application\/json)$/.test(contentType);
    if (!supported) {
      await response.body?.cancel();
      return result("REJECTED", startedAt, { ...metadata, errorCode: "UNSUPPORTED_CONTENT_TYPE" });
    }
    const body = await readBoundedBody(response, maxBytes);
    const hashes = fingerprint(body, contentType);
    const status: CheckStatus = previousNormalizedHash && previousNormalizedHash !== hashes.normalized
      ? "CHANGED" : "AVAILABLE";
    return result(status, startedAt, {
      ...metadata,
      contentLength: body.byteLength,
      contentSha256: hashes.raw,
      normalizedContentSha256: hashes.normalized
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const code = message.includes("RESPONSE_TOO_LARGE") ? "RESPONSE_TOO_LARGE"
      : message.includes("Timeout") || message.includes("abort") ? "FETCH_TIMEOUT"
      : "FETCH_FAILED";
    return result(code === "RESPONSE_TOO_LARGE" ? "REJECTED" : "ERROR", startedAt, { errorCode: code });
  }
}
