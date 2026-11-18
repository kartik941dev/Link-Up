import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { AppError } from '../middleware/errorHandler.js';
import { deduplicateText } from '../utils/titleCleaner.js';

export interface ExtractedUrlResult {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  siteName?: string;
  text: string;
  snippet: string;
  metadata: Record<string, any>;
}

const badRequest = (message: string, code: string): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
};

// SSRF prevention: Check for internal/private hosts
export const isPrivateOrInternalHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 Private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // Link-local
    if (a === 127) return true; // Loopback
  }

  return false;
};

/**
 * Validates and normalizes a raw user-provided URL.
 * Rejects javascript:, ftp:, data:, file:, malformed URLs, and private/internal hosts.
 */
export const validateAndNormalizeUrl = (rawUrl: string): URL => {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || /\s/.test(trimmed)) {
    throw badRequest('Invalid URL format provided. Please enter a valid http:// or https:// URL.', 'INVALID_URL');
  }

  // Check explicit scheme BEFORE any fallback prefixing so javascript:, ftp:, data:, etc. are strictly rejected
  const explicitSchemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (explicitSchemeMatch) {
    const scheme = explicitSchemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw badRequest(
        `Unsupported URL scheme "${scheme}:". Only HTTP and HTTPS links are allowed.`,
        'INVALID_URL_SCHEME'
      );
    }
  }

  const normalizedInput = explicitSchemeMatch ? trimmed : `https://${trimmed}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedInput);
  } catch {
    throw badRequest('Invalid URL format provided. Please enter a valid web address.', 'INVALID_URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw badRequest('Only HTTP and HTTPS protocols are allowed.', 'INVALID_URL_SCHEME');
  }

  // Require a valid public domain with a TLD (at least one dot)
  if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.') || parsedUrl.hostname.startsWith('.') || parsedUrl.hostname.endsWith('.')) {
    throw badRequest('Invalid URL hostname. Please provide a full web address such as https://example.com.', 'INVALID_URL');
  }

  if (isPrivateOrInternalHost(parsedUrl.hostname)) {
    throw badRequest('Access to private or local network resources is restricted.', 'RESTRICTED_HOST');
  }

  return parsedUrl;
};

/**
 * Extracts clean title, description, and readable article text from HTML.
 * Exported separately so unit tests can test title/description cleaning deterministically.
 */
export const parseHtmlMetadataAndContent = (
  html: string,
  parsedUrl: URL
): ExtractedUrlResult => {
  const $ = cheerio.load(html);

  // 1. Title: Take from og:title first, else <head><title> (NEVER concatenate multiple tags or SVG <title>s)
  const ogTitleRaw = $('meta[property="og:title"]').first().attr('content')?.trim() || '';
  const headTitleRaw = $('head title').first().text().trim() || '';
  const chosenTitleRaw = ogTitleRaw || headTitleRaw || parsedUrl.hostname;
  const cleanTitle = deduplicateText(chosenTitleRaw) || parsedUrl.hostname;

  // 2. Site name
  const siteNameRaw =
    $('meta[property="og:site_name"]').first().attr('content')?.trim() ||
    parsedUrl.hostname.replace(/^www\./, '');
  const siteName = deduplicateText(siteNameRaw);

  // 3. Description: Prefer og:description or meta[name="description"]
  let ogDescriptionRaw =
    $('meta[property="og:description"]').first().attr('content')?.trim() ||
    $('meta[name="description"]').first().attr('content')?.trim() ||
    $('meta[name="twitter:description"]').first().attr('content')?.trim() ||
    '';

  let ogImage =
    $('meta[property="og:image"]').first().attr('content')?.trim() ||
    $('meta[name="twitter:image"]').first().attr('content')?.trim() ||
    undefined;

  // Resolve relative image URLs and restrict to http/https only (XSS safety)
  if (ogImage) {
    try {
      const resolvedImg = new URL(ogImage, parsedUrl.origin);
      ogImage =
        resolvedImg.protocol === 'http:' || resolvedImg.protocol === 'https:'
          ? resolvedImg.toString()
          : undefined;
    } catch {
      ogImage = undefined;
    }
  }

  // 4. Remove non-article chrome, scripts, styles, SVGs, sidebars, breadcrumbs, and nav elements
  $(
    'script, style, noscript, iframe, nav, footer, header, aside, svg, form, button, input, select, textarea, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], ' +
    '.sidebar, .toc, .table-of-contents, .breadcrumb, .breadcrumbs, .nav, .navbar, .menu, .cookie-banner'
  ).remove();

  // Extract main readable container
  const $main = $('article, main, [role="main"], .article-content, #content, .post-content').first();
  const $root = $main.length > 0 ? $main : $('body');

  // Collect structured text from block elements so headings never glue directly onto following paragraphs
  const blocks: string[] = [];
  $root.find('h1, h2, h3, h4, p, li, pre, blockquote').each((_i, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length >= 2) {
      blocks.push(t);
    }
  });

  let cleanText = '';
  if (blocks.length > 0) {
    // Deduplicate adjacent identical lines
    const dedupedBlocks: string[] = [];
    for (const b of blocks) {
      if (dedupedBlocks.length === 0 || dedupedBlocks[dedupedBlocks.length - 1] !== b) {
        dedupedBlocks.push(b);
      }
    }
    cleanText = dedupedBlocks.join('\n\n').trim();
  } else {
    cleanText = $root
      .text()
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  // Fallback description from first meaningful paragraph in main article (NOT concatenated headings + body)
  if (!ogDescriptionRaw) {
    const paragraphs: string[] = [];
    $root.find('p').each((_i, el) => {
      const p = $(el).text().replace(/\s+/g, ' ').trim();
      if (p.length >= 35) {
        paragraphs.push(p);
      }
    });
    ogDescriptionRaw = paragraphs[0] || cleanText.split('\n\n').find((b) => b.length >= 35) || cleanText.slice(0, 260);
  }

  let cleanDescription = deduplicateText(ogDescriptionRaw);
  // Prevent description from starting with duplicated page heading word(s)
  const leadingTopic = cleanTitle.split(/\s*[|–—-]\s*/)[0]?.trim();
  if (leadingTopic && leadingTopic.length >= 3) {
    const escaped = leadingTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanDescription = cleanDescription.replace(
      new RegExp(`^(${escaped})\\s+\\1\\b`, 'i'),
      '$1'
    );
  }

  const oneLineDescription =
    cleanDescription.length > 260
      ? cleanDescription.slice(0, 257).trimEnd() + '...'
      : cleanDescription;

  return {
    url: parsedUrl.toString(),
    title: cleanTitle,
    description: oneLineDescription,
    imageUrl: ogImage,
    siteName,
    text: cleanText || oneLineDescription,
    snippet: oneLineDescription,
    metadata: {
      canonicalUrl: $('link[rel="canonical"]').first().attr('href') || parsedUrl.toString(),
      author: $('meta[name="author"]').first().attr('content')?.trim(),
      publishedTime: $('meta[property="article:published_time"]').first().attr('content')?.trim(),
      hostname: parsedUrl.hostname,
      charCount: cleanText.length,
    },
  };
};

export const extractUrlContent = async (rawUrl: string): Promise<ExtractedUrlResult> => {
  const parsedUrl = validateAndNormalizeUrl(rawUrl);

  try {
    const response = await axios.get(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 LinkUpBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      signal: AbortSignal.timeout(10000),
      maxRedirects: 5,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const html = response.data;
    if (typeof html !== 'string' || html.trim().length === 0) {
      throw badRequest('Target URL did not return readable HTML content.', 'UNREADABLE_URL');
    }

    return parseHtmlMetadataAndContent(html, parsedUrl);
  } catch (err: any) {
    if (err.statusCode) {
      throw err;
    }

    let friendlyMsg = `Could not reach URL (${parsedUrl.hostname})`;
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      friendlyMsg = `URL is unreachable: domain "${parsedUrl.hostname}" could not be resolved.`;
    } else if (err.code === 'ECONNREFUSED') {
      friendlyMsg = `URL is unreachable: connection refused by "${parsedUrl.hostname}".`;
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.name === 'TimeoutError' || err.name === 'AbortError') {
      friendlyMsg = `URL timed out after 10 seconds while connecting to "${parsedUrl.hostname}".`;
    } else if (err.response?.status) {
      friendlyMsg = `URL returned HTTP ${err.response.status} from "${parsedUrl.hostname}".`;
    } else if (err.message) {
      friendlyMsg = `Failed to reach URL: ${err.message}`;
    }

    console.error(`[URL_EXTRACTOR] Error fetching ${rawUrl}:`, err.message);
    throw badRequest(friendlyMsg, 'URL_UNREACHABLE');
  }
};
