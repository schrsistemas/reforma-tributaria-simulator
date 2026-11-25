export interface OfficialDates {
  publishedAt?: string;
  publishedAtSource: 'JSON_LD' | 'HTML_META' | 'EXPLICIT_TEXT' | 'RETRIEVAL_FALLBACK';
  effectiveFrom?: string;
  effectiveFromSource: 'EXPLICIT_TEXT' | 'PUBLICATION_DATE_CLAUSE' | 'UNKNOWN';
  effectiveTo?: string;
  effectiveToSource: 'EXPLICIT_TEXT' | 'UNKNOWN';
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseOfficialDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const input = value.trim();
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = input.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (br) return validIsoDate(Number(br[3]), Number(br[2]), Number(br[1]));
  return undefined;
}

/**
 * Extracts only dates with explicit publication/effectiveness semantics.
 * Generic dates, page update timestamps and retrieval time are not treated
 * as legal publication or commencement dates.
 */
export function extractOfficialDates(htmlOrText: string): OfficialDates {
  const metadata: Record<string, string> = {};
  const scripts = htmlOrText.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const parsed: unknown = JSON.parse(body);
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && key === 'datePublished') metadata.JSON_LD = child;
          else if (child && typeof child === 'object') visit(child);
        }
      };
      visit(parsed);
    } catch {
      // Invalid JSON-LD is ignored; visible legal text remains eligible.
    }
  }

  const metaTags = htmlOrText.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = tag.match(/(?:property|name|itemprop)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const value = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (key && value && ['article:published_time', 'datepublished', 'dc.date', 'dcterms.created'].includes(key)) {
      metadata.HTML_META = value;
    }
  }

  const plain = htmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');

  const documentIdentifiers = plain.match(/(?:lei\s+complementar|lei|decreto|portaria|instru[cç][aã]o\s+normativa|resolu[cç][aã]o)\s+(?:n[ºo.]?\s*)?\d+(?:[./-]\d+)*(?:\/\d{4})?/gi) ?? [];
  const uniqueDocumentIdentifiers = new Set(documentIdentifiers.map((value) => value.toLowerCase().replace(/\s+/g, ' ').trim()));
  if (uniqueDocumentIdentifiers.size !== 1) {
    return {
      publishedAtSource: 'RETRIEVAL_FALLBACK',
      effectiveFromSource: 'UNKNOWN',
      effectiveToSource: 'UNKNOWN',
    };
  }

  const explicitPublication = plain.match(/(?:publicad[oa]\s+em|data\s+de\s+publica[cç][aã]o\s*[:：]?|publica[cç][aã]o\s*[:：])\s*(\d{1,2}[\/.]\d{1,2}[\/.]\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1];
  const publishedAt = parseOfficialDate(metadata.JSON_LD) ??
    parseOfficialDate(metadata.HTML_META) ??
    parseOfficialDate(explicitPublication);
  const publishedAtSource: OfficialDates['publishedAtSource'] = publishedAt
    ? metadata.JSON_LD && parseOfficialDate(metadata.JSON_LD) === publishedAt ? 'JSON_LD'
      : metadata.HTML_META && parseOfficialDate(metadata.HTML_META) === publishedAt ? 'HTML_META'
      : 'EXPLICIT_TEXT'
    : 'RETRIEVAL_FALLBACK';

  const explicitEffective = plain.match(/(?:entra\s+em\s+vigor|produz\s+efeitos|vig[eê]ncia\s+(?:inicia|in[ií]cio)\s+em)\s*(?:(?:em|a\s+partir\s+de|no\s+dia)\s*)?(\d{1,2}[\/.]\d{1,2}[\/.]\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1];
  const effectiveFrom = parseOfficialDate(explicitEffective);
  const explicitEnd = plain.match(/(?:vig[eê]ncia\s+(?:at[eé]|vai\s+at[eé])|vigora\s+at[eé]|produz\s+efeitos\s+at[eé])\s*(\d{1,2}[\/.]\d{1,2}[\/.]\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1];
  const effectiveTo = parseOfficialDate(explicitEnd);
  const effectiveToSource = effectiveTo ? 'EXPLICIT_TEXT' : 'UNKNOWN';
  if (effectiveFrom) return { publishedAt, publishedAtSource, effectiveFrom, effectiveFromSource: 'EXPLICIT_TEXT', effectiveTo, effectiveToSource };

  if (publishedAt && /entra\s+em\s+vigor\s+na\s+data\s+de\s+sua\s+publica[cç][aã]o/i.test(plain)) {
    return { publishedAt, publishedAtSource, effectiveFrom: publishedAt, effectiveFromSource: 'PUBLICATION_DATE_CLAUSE', effectiveTo, effectiveToSource };
  }
  return { publishedAt, publishedAtSource, effectiveFromSource: 'UNKNOWN', effectiveTo, effectiveToSource };
}

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


export interface LegalChunkUnit {
  type: 'PREAMBLE' | 'ARTICLE_CAPUT' | 'PARAGRAPH' | 'ITEM' | 'ALINEA' | 'TABLE' | 'ANNEX' | 'FALLBACK';
  label?: string;
  article?: string;
  paragraph?: string;
  item?: string;
  alinea?: string;
  heading?: string;
}

export interface LegalChunk {
  text: string;
  ordinal: number;
  structure: 'LEGAL' | 'FALLBACK';
  units: LegalChunkUnit[];
}

interface LegalSegment {
  lines: string[];
  unit: LegalChunkUnit;
}

/**
 * Segments normative documents by legal device before applying size limits.
 *
 * A chunk never crosses an article or a paragraph/item/alinea boundary.
 * Oversized individual devices are split by the character fallback while
 * retaining the same hierarchy metadata. Documents without recognizable
 * legal structure continue to use the existing character chunker.
 */
export function chunkLegalDocument(
  text: string,
  maxChars = 1800,
  overlap = 250,
): LegalChunk[] {
  const clean = normalizeDocumentText(text);
  if (!clean) return [];

  const safeMaxChars = Number.isFinite(maxChars)
    ? Math.max(1, Math.trunc(maxChars))
    : 1800;
  const safeOverlap = Number.isFinite(overlap)
    ? Math.max(0, Math.min(Math.trunc(overlap), Math.floor(safeMaxChars / 2)))
    : 250;

  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  const articlePattern = /^(Art(?:igo)?\.?\s+\d+[º°o]?(?:-[A-Z])?)(?:\s|$)/i;
  const paragraphPattern = /^(§\s*\d+[º°o]?|Parágrafo\s+único)(?:\s|[.:—-]|$)/i;
  const itemPattern = /^([IVXLCDM]+)\s*[-–—.)]\s+/i;
  const alineaPattern = /^([a-z])\)\s+/i;
  const annexPattern = /^(ANEXO(?:\s+[IVXLCDM\d]+)?)(?:\s|$)/i;
  const hasLegalStructure = lines.some((line) =>
    articlePattern.test(line) || annexPattern.test(line) || paragraphPattern.test(line),
  );

  if (!hasLegalStructure) {
    return chunkDocument(clean, safeMaxChars, safeOverlap).map((chunk, ordinal) => ({
      text: chunk,
      ordinal,
      structure: 'FALLBACK',
      units: [{ type: 'FALLBACK' }],
    }));
  }

  const segments: LegalSegment[] = [];
  let article: string | undefined;
  let paragraph: string | undefined;
  let item: string | undefined;
  let alinea: string | undefined;
  let heading: string | undefined;
  let current: LegalSegment | undefined;
  let tableLines: string[] = [];

  const flushCurrent = (): void => {
    if (current?.lines.length) segments.push(current);
    current = undefined;
  };
  const flushTable = (): void => {
    if (!tableLines.length) return;
    segments.push({
      lines: tableLines,
      unit: { type: 'TABLE', article, paragraph, item, alinea, heading },
    });
    tableLines = [];
  };
  const beginUnit = (unit: LegalChunkUnit, line: string): void => {
    flushTable();
    flushCurrent();
    current = { lines: [line], unit };
  };

  for (const line of lines) {
    const articleMatch = line.match(articlePattern);
    const annexMatch = line.match(annexPattern);
    const paragraphMatch = line.match(paragraphPattern);
    const itemMatch = line.match(itemPattern);
    const alineaMatch = line.match(alineaPattern);

    if (articleMatch) {
      article = articleMatch[1];
      paragraph = undefined;
      item = undefined;
      alinea = undefined;
      heading = undefined;
      beginUnit({ type: 'ARTICLE_CAPUT', label: article, article }, line);
      continue;
    }
    if (annexMatch) {
      article = undefined;
      paragraph = undefined;
      item = undefined;
      alinea = undefined;
      heading = annexMatch[1];
      beginUnit({ type: 'ANNEX', label: heading, heading }, line);
      continue;
    }
    if (/^(CAPÍTULO|TÍTULO|SEÇÃO|SUBSEÇÃO)\b/i.test(line)) {
      heading = line;
      paragraph = undefined;
      item = undefined;
      alinea = undefined;
      beginUnit({ type: 'PREAMBLE', label: line, article, heading }, line);
      continue;
    }
    if (paragraphMatch) {
      paragraph = paragraphMatch[1];
      item = undefined;
      alinea = undefined;
      beginUnit({ type: 'PARAGRAPH', label: paragraph, article, paragraph, heading }, line);
      continue;
    }
    if (itemMatch) {
      item = itemMatch[1].toUpperCase();
      alinea = undefined;
      beginUnit({ type: 'ITEM', label: item, article, paragraph, item, heading }, line);
      continue;
    }
    if (alineaMatch) {
      alinea = alineaMatch[1].toLowerCase();
      beginUnit({ type: 'ALINEA', label: alinea, article, paragraph, item, alinea, heading }, line);
      continue;
    }

    // Consecutive table rows form one table unit and cannot be merged with
    // surrounding prose or a different legal device.
    const looksLikeTableRow = line.includes('|') || /\t/.test(line) ||
      /^\s*[-+|]{3,}\s*$/.test(line);
    if (looksLikeTableRow) {
      flushCurrent();
      tableLines.push(line);
      continue;
    }
    flushTable();
    if (current) current.lines.push(line);
    else {
      current = {
        lines: [line],
        unit: { type: 'PREAMBLE', article, paragraph, item, alinea, heading },
      };
    }
  }
  flushTable();
  flushCurrent();

  const output: LegalChunk[] = [];
  const pushText = (value: string, unit: LegalChunkUnit): void => {
    const parts = value.length <= safeMaxChars
      ? [value]
      : chunkDocument(value, safeMaxChars, safeOverlap);
    for (const part of parts) {
      output.push({
        text: part,
        ordinal: output.length,
        structure: 'LEGAL',
        units: [{ ...unit }],
      });
    }
  };

  for (const segment of segments) {
    const value = segment.lines.join('\n').trim();
    if (value) pushText(value, segment.unit);
  }

  // Defensive fallback: malformed structural input must not discard text.
  if (!output.length) {
    return chunkDocument(clean, safeMaxChars, safeOverlap).map((chunk, ordinal) => ({
      text: chunk,
      ordinal,
      structure: 'FALLBACK',
      units: [{ type: 'FALLBACK' }],
    }));
  }

  return output;
}
