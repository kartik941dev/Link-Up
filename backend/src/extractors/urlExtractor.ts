import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

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

// SSRF prevention: Check for internal/private hosts
export const isPrivateOrInternalHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 Private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const [_, a, b] = match.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // Link-local
    if (a === 127) return true; // Loopback
  }

  return false;
};

export const extractUrlContent = async (rawUrl: string): Promise<ExtractedUrlResult> => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch (err) {
    throw new Error('Invalid URL format provided.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed.');
  }

  if (isPrivateOrInternalHost(parsedUrl.hostname)) {
    throw new Error('Access to private or local network resources is restricted.');
  }

  try {
    const response = await axios.get(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LinkUpBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const html = response.data;
    if (typeof html !== 'string') {
      throw new Error('Target URL did not return HTML content.');
    }

    const $ = cheerio.load(html);

    // Extract OpenGraph / Twitter meta tags
    const ogTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      parsedUrl.hostname;

    const ogDescription =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    let ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      undefined;

    // Resolve relative image URLs
    if (ogImage && !ogImage.startsWith('http')) {
      try {
        ogImage = new URL(ogImage, parsedUrl.origin).toString();
      } catch {
        ogImage = undefined;
      }
    }

    const siteName =
      $('meta[property="og:site_name"]').attr('content') ||
      parsedUrl.hostname.replace(/^www\./, '');

    // Clean body HTML: remove scripts, styles, headers, footers, navs
    $('script, style, noscript, iframe, nav, footer, header, aside, svg').remove();

    // Prefer main article text if available
    let bodyText = $('article, main, .article-content, #content, .post-content').text();
    if (!bodyText || bodyText.trim().length < 100) {
      bodyText = $('body').text();
    }

    const cleanText = bodyText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const snippet =
      (ogDescription && ogDescription.length > 20
        ? ogDescription
        : cleanText.slice(0, 250).replace(/\n/g, ' ')) +
      (cleanText.length > 250 && !ogDescription ? '...' : '');

    return {
      url: parsedUrl.toString(),
      title: ogTitle.trim(),
      description: ogDescription.trim(),
      imageUrl: ogImage,
      siteName,
      text: cleanText,
      snippet: snippet.trim(),
      metadata: {
        canonicalUrl: $('link[rel="canonical"]').attr('href') || parsedUrl.toString(),
        author: $('meta[name="author"]').attr('content'),
        publishedTime: $('meta[property="article:published_time"]').attr('content'),
        hostname: parsedUrl.hostname,
        charCount: cleanText.length,
      },
    };
  } catch (err: any) {
    console.error(`[URL_EXTRACTOR] Error fetching ${rawUrl}:`, err.message);
    throw new Error(`Failed to ingest web link: ${err.message}`);
  }
};
