export interface ArtifactCandidate {
  url: string;
  linkText: string;
  extension: "pdf" | "xsd" | "xml" | "json";
}

/** Decode only the HTML entities commonly found in href/text attributes. */
function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point) : "";
    });
}

function readAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function cleanLinkText(anchor: string): string {
  const inner = anchor.replace(/^<a\b[^>]*>/i, "").replace(/<\/a\s*>$/i, "");
  return decodeHtml(inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 300);
}

/**
 * Finds document links on an already-fetched official page.
 * It performs no network request and never follows links.
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
  if (base.protocol !== "https:" || !allowedHosts.has(base.hostname.toLowerCase())) return [];

  const candidates = new Map<string, ArtifactCandidate>();
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi) ?? [];
  for (const anchor of anchors) {
    const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0];
    if (!openingTag) continue;
    const href = readAttribute(openingTag, "href");
    if (!href || /^(?:javascript|data|mailto|tel):/i.test(href.trim())) continue;

    let url: URL;
    try {
      url = new URL(href.trim(), base);
    } catch {
      continue;
    }
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
        (url.port !== "" && url.port !== "443") ||
        !allowedHosts.has(hostname) || hostname === "localhost" ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
      continue;
    }

    const match = url.pathname.toLowerCase().match(/\.(pdf|xsd|xml|json)$/);
    if (!match) continue;
    url.hash = "";
    const canonicalUrl = url.toString();
    if (!candidates.has(canonicalUrl)) {
      candidates.set(canonicalUrl, {
        url: canonicalUrl,
        linkText: cleanLinkText(anchor),
        extension: match[1] as ArtifactCandidate["extension"]
      });
    }
  }
  return [...candidates.values()];
}
