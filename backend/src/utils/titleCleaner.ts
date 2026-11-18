/**
 * Utilities for clean card titles, deduplicating repeated link titles/descriptions,
 * filtering generic/file-type noise tags, and extracting local fallback keywords.
 */

export const NOISE_TAGS = new Set([
  'pdf',
  'docx',
  'doc',
  'txt',
  'zip',
  'note',
  'notes',
  'link',
  'web link',
  'weblink',
  'url',
  'documentation',
  'document',
  'research',
  'article',
  'file',
]);

const GENERIC_DOC_TITLES = new Set([
  'untitled',
  'untitled document',
  'document',
  'document1',
  'microsoft word',
  'word document',
  'slide 1',
  'presentation',
]);

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how',
  'however', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'like', 'make', 'many', 'may', 'more',
  'most', 'much', 'must', 'new', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'one',
  'only', 'or', 'other', 'our', 'out', 'over', 'own', 'same', 'see', 'she', 'should', 'since',
  'so', 'some', 'still', 'such', 'take', 'than', 'that', 'the', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'two', 'under', 'until', 'up', 'use',
  'used', 'using', 'very', 'was', 'way', 'we', 'well', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'why', 'will', 'with', 'within', 'without', 'would', 'you', 'your',
  'pdf', 'docx', 'doc', 'txt', 'zip', 'note', 'notes', 'link', 'web', 'website', 'url', 'http',
  'https', 'www', 'com', 'org', 'html', 'page', 'site', 'documentation', 'document', 'documents',
  'research', 'article', 'file', 'files', 'summary', 'overview', 'introduction', 'guide', 'manual',
  'chapter', 'section', 'example', 'information', 'content', 'text', 'data', 'system', 'project',
  'report', 'study', 'work', 'time', 'year', 'part', 'first', 'second', 'third', 'based',
]);

/**
 * Removes repeated glued tokens (e.g. "MDNMDNMDNMozilla" -> "MDN"),
 * repeated consecutive words (e.g. "JavaScript JavaScript" -> "JavaScript"),
 * and repeated separator segments (e.g. "JavaScript | MDN | MDN" -> "JavaScript | MDN").
 */
export function deduplicateText(input: string): string {
  if (!input) return '';
  let text = input.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Collapse glued repetitions inside a token, e.g. "MDNMDNMDNMozilla" -> "MDN", "MDNMDN" -> "MDN"
  text = text.replace(/\b([A-Za-z]{2,16})\1+(?:[A-Za-z]*)?\b/g, (match, unit: string) => {
    // Only trim trailing site suffix if the unit was clearly repeated (2+ times)
    if (match.toLowerCase().includes('mozilla') && unit.toUpperCase() === 'MDN') {
      return 'MDN';
    }
    // Strip exact repeats of unit while keeping any distinct word after it if meaningful
    const rest = match.replace(new RegExp(`^(?:${unit})+`, 'i'), '');
    if (!rest) return unit;
    // If rest is a known glued brand tail like "Mozilla" glued onto repeated "MDNMDN", drop glued tail
    if (rest.length <= 12) return unit;
    return `${unit} ${rest}`;
  });

  // 2. Collapse consecutive duplicate words (case-insensitive): "JavaScript JavaScript (JS)" -> "JavaScript (JS)"
  text = text.replace(/\b([A-Za-z0-9][A-Za-z0-9+.#-]*)\s+\1\b/gi, '$1');

  // 3. Collapse consecutive duplicate 2-word phrases
  text = text.replace(/\b([A-Za-z0-9]+\s+[A-Za-z0-9]+)\s+\1\b/gi, '$1');

  // 4. Deduplicate separator-delimited segments (|, -, –, —, ::)
  const sepMatch = text.match(/\s*(\||–|—|::)\s*/);
  if (sepMatch) {
    const sep = sepMatch[1];
    const parts = text
      .split(new RegExp(`\\s*\\${sep === '|' ? '|' : sep}\\s*`))
      .map((p) => p.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const uniqueParts: string[] = [];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueParts.push(part);
      }
    }
    text = uniqueParts.join(` ${sep} `);
  }

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans a raw title or filename into a readable title:
 * - strips file extensions (.pdf, .docx, .doc, .md, .txt, .zip)
 * - replaces underscores with spaces
 * - collapses whitespace and deduplicates repeated words
 * - title-cases all-lowercase slugs
 */
export function cleanCardTitle(rawTitle?: string, fallbackFilename?: string): string {
  const candidate = (rawTitle || '').trim();
  const isGeneric =
    !candidate ||
    GENERIC_DOC_TITLES.has(candidate.toLowerCase()) ||
    /\.(pdf|docx?|md|txt|zip)$/i.test(candidate);

  let chosen = isGeneric && fallbackFilename ? fallbackFilename : candidate || fallbackFilename || 'Untitled Card';

  // Strip path prefix if any (e.g. from zip entries)
  chosen = chosen.split(/[\\/]/).pop() || chosen;

  // Strip known file extensions
  chosen = chosen.replace(/\.(pdf|docx?|md|txt|zip|html?)$/i, '');

  // Replace underscores with spaces, normalize dash spacing only when surrounding underscores/slugs
  chosen = chosen.replace(/_+/g, ' ');
  if (/^[a-z0-9-]+$/.test(chosen) && chosen.includes('-')) {
    chosen = chosen.replace(/-+/g, ' ');
  }

  chosen = deduplicateText(chosen);

  // If all lowercase (e.g., slug filename), title-case words nicely
  if (chosen === chosen.toLowerCase() && /[a-z]/.test(chosen)) {
    chosen = chosen.replace(/\b([a-z])([a-z0-9]*)/g, (_, first: string, rest: string) => {
      return first.toUpperCase() + rest;
    });
  }

  return chosen.slice(0, 200).trim() || 'Untitled Card';
}

/**
 * Extracts a clean first heading from plain extracted text when document metadata has no title.
 */
export function extractFirstHeading(text: string): string | undefined {
  if (!text) return undefined;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter((l) => l.length >= 4);

  for (const line of lines.slice(0, 8)) {
    // Skip URLs, page numbers, boilerplate headers, very long paragraphs
    if (line.length > 95) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^(page\s*\d+|table of contents|contents|date:|author:|prepared by:)/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (GENERIC_DOC_TITLES.has(line.toLowerCase())) continue;
    return deduplicateText(line);
  }
  return undefined;
}

/**
 * Normalizes user/auto tags to lowercase, deduplicated content keywords,
 * removing file-type badges and generic placeholder labels.
 */
export function cleanTagNames(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const cleaned = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ');
    if (!cleaned || cleaned.length < 2 || cleaned.length > 50) continue;
    if (NOISE_TAGS.has(cleaned)) continue;
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

/**
 * Lightweight local keyword fallback (2-4 lowercase content keywords) if ML /keywords is offline.
 */
export function extractFallbackKeywords(title: string, text: string, maxTags: number = 4): string[] {
  const combined = `${title} ${title} ${(text || '').slice(0, 4000)}`.toLowerCase();
  const tokens = (combined.match(/[a-z][a-z0-9-]{2,24}/g) || [])
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t) && !NOISE_TAGS.has(t));

  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([word]) => word);
}
