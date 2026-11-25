import { createHash } from "node:crypto";

export interface ArtifactStorage {
  putObject(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    metadata: Record<string, string>;
  }): Promise<void>;
}

export interface ArtifactCaptureOptions {
  allowedHosts: ReadonlySet<string>;
  storage: ArtifactStorage;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface ArtifactCaptureResult {
  status: "CAPTURED" | "DUPLICATE" | "REJECTED" | "UNAVAILABLE" | "ERROR";
  sourceUrl: string;
  contentType: string | null;
  byteLength: number | null;
  sha256: string | null;
  objectKey: string | null;
  httpStatus: number | null;
  errorCode: string | null;
  captureId?: string | null;
}

function failure(status: ArtifactCaptureResult["status"], sourceUrl: string, errorCode: string, httpStatus: number | null = null): ArtifactCaptureResult {
  return { status, sourceUrl, contentType: null, byteLength: null, sha256: null, objectKey: null, httpStatus, errorCode, captureId: null };
}
async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("ARTIFACT_TOO_LARGE");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new Error("ARTIFACT_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
function extensionFor(contentType: string): string | null {
  switch (contentType) {
    case "application/pdf": return "pdf";
    case "text/html":
    case "application/xhtml+xml": return "html";
    case "application/xml":
    case "text/xml":
    case "application/rss+xml":
    case "application/atom+xml": return "xml";
    case "application/json": return "json";
    default: return null;
  }
}
export async function captureOfficialArtifact(sourceId: string, sourceUrl: string, options: ArtifactCaptureOptions): Promise<ArtifactCaptureResult> {
  let url: URL;
  try { url = new URL(sourceUrl); } catch { return failure("REJECTED", sourceUrl, "INVALID_ARTIFACT_URL"); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)) {
    return failure("REJECTED", sourceUrl, "INVALID_SOURCE_ID");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password ||
      (url.port !== "" && !(hostname === "gnre.pe.gov.br" && url.port === "444")) ||
      !options.allowedHosts.has(hostname) || hostname === "localhost" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    return failure("REJECTED", sourceUrl, "ARTIFACT_HOST_NOT_ALLOWED");
  }
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET", redirect: "manual",
      headers: {
        "user-agent": "FiscalIntelligenceHub-ArtifactCapture/0.3",
        "accept": "application/pdf,text/html,application/xhtml+xml,application/xml,text/xml,application/rss+xml,application/atom+xml,application/json"
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000)
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
    const extension = extensionFor(contentType);
    if (!extension) {
      await response.body?.cancel();
      return failure("REJECTED", sourceUrl, "UNSUPPORTED_CONTENT_TYPE", response.status);
    }
    const body = await readBounded(response, options.maxBytes ?? 20 * 1024 * 1024);
    if (body.byteLength === 0) return failure("REJECTED", sourceUrl, "EMPTY_ARTIFACT", response.status);
    if (contentType === "application/pdf") {
      const header = new TextDecoder().decode(body.subarray(0, Math.min(body.byteLength, 1024)));
      if (!header.includes("%PDF-")) return failure("REJECTED", sourceUrl, "PDF_SIGNATURE_INVALID", response.status);
    }
    const sha256 = createHash("sha256").update(body).digest("hex");
    const objectKey = `normative-artifacts/${sourceId}/${sha256}.${extension}`;
    await options.storage.putObject({ key: objectKey, body, contentType, metadata: { sourceId, sha256, sourceUrl } });
    return { status: "CAPTURED", sourceUrl, contentType, byteLength: body.byteLength, sha256, objectKey, httpStatus: response.status, errorCode: null, captureId: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return failure(message.includes("ARTIFACT_TOO_LARGE") ? "REJECTED" : "ERROR", sourceUrl,
      message.includes("ARTIFACT_TOO_LARGE") ? "ARTIFACT_TOO_LARGE" :
      message.toLowerCase().includes("timeout") || message.toLowerCase().includes("abort") ? "FETCH_TIMEOUT" : "CAPTURE_FAILED");
  }
}
