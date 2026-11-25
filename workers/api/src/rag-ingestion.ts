export interface IngestInput {
  sourceId: string;
  url: string;
  title: string;
  jurisdiction: string;
  publishedAt: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  version: string;
  content: string;
}

export interface IngestResult {
  documentId: string;
  contentHash: string;
  chunkIds: string[];
  changed: boolean;
}

export function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits normalized text into overlapping chunks.
 * Invalid limits are normalized so a bad configuration cannot cause a
 * one-character stepping loop or an unbounded overlap.
 */
export function chunkDocument(
  text: string,
  maxChars = 1800,
  overlap = 250,
): string[] {
  const clean = normalizeDocumentText(text);
  if (!clean) return [];

  const safeMaxChars = Number.isFinite(maxChars)
    ? Math.max(1, Math.trunc(maxChars))
    : 1800;
  const requestedOverlap = Number.isFinite(overlap)
    ? Math.trunc(overlap)
    : 250;
  const safeOverlap = Math.max(0, Math.min(requestedOverlap, Math.floor(safeMaxChars / 2)));

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(clean.length, start + safeMaxChars);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;

    // Always advances by at least one character.
    start = end - safeOverlap;
  }

  return chunks;
}

export async function hashDocument(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeDocumentText(content));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
