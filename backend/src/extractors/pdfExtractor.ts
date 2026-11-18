import zlib from 'zlib';
import pdfParse from 'pdf-parse';
import { AppError } from '../middleware/errorHandler.js';
import { cleanCardTitle, extractFirstHeading } from '../utils/titleCleaner.js';

export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  title: string;
  author?: string;
  snippet: string;
  metadata: Record<string, any>;
}

const createPdfError = (message: string, code: string = 'PDF_PARSE_ERROR'): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
};

// Decode ASCII85 / Base85 data stream (standard in ReportLab and Adobe PostScript streams)
function decodeAscii85(str: string): Buffer {
  const s = str.replace(/<~|~>/g, '').replace(/\s+/g, '');
  const out: number[] = [];
  let tuple = 0;
  let count = 0;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'z' && count === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const val = c.charCodeAt(0) - 33;
    if (val < 0 || val > 84) continue;
    tuple = tuple * 85 + val;
    count++;
    if (count === 5) {
      out.push((tuple >> 24) & 0xff);
      out.push((tuple >> 16) & 0xff);
      out.push((tuple >> 8) & 0xff);
      out.push(tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }

  if (count > 1) {
    for (let j = count; j < 5; j++) {
      tuple = tuple * 85 + 84;
    }
    for (let k = 0; k < count - 1; k++) {
      out.push((tuple >> (24 - k * 8)) & 0xff);
    }
  }

  return Buffer.from(out);
}

// Fallback helper to extract printable strings when PDF cross-reference table is damaged
function extractFallbackStrings(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const textMatches: string[] = [];
  const textBlockRegex = /BT[\s\S]*?ET/g;

  // 1. Direct BT ... ET blocks in uncompressed content
  let blockMatch;
  while ((blockMatch = textBlockRegex.exec(content)) !== null) {
    const block = blockMatch[0];
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match;
    while ((match = tjRegex.exec(block)) !== null) {
      textMatches.push(match[1]);
    }
  }

  // 2. Compressed stream objects (FlateDecode or ASCII85Decode + FlateDecode)
  try {
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(content)) !== null) {
      try {
        const streamData = streamMatch[1];
        let decompressed: string = '';

        // Try raw inflateSync
        try {
          const rawBytes = Buffer.from(streamData, 'latin1');
          decompressed = zlib.inflateSync(rawBytes).toString('latin1');
        } catch {
          try {
            const rawBytes = Buffer.from(streamData, 'latin1');
            decompressed = zlib.inflateRawSync(rawBytes).toString('latin1');
          } catch {
            // Try ASCII85 decode followed by inflate
            try {
              const ascii85 = decodeAscii85(streamData);
              if (ascii85.length > 0) {
                decompressed = zlib.inflateSync(ascii85).toString('latin1');
              }
            } catch {
              try {
                const ascii85 = decodeAscii85(streamData);
                if (ascii85.length > 0) {
                  decompressed = zlib.inflateRawSync(ascii85).toString('latin1');
                }
              } catch {
                // Not a compressed text stream
              }
            }
          }
        }

        if (decompressed) {
          let decompMatch;
          while ((decompMatch = textBlockRegex.exec(decompressed)) !== null) {
            const block = decompMatch[0];
            const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
            let match;
            while ((match = tjRegex.exec(block)) !== null) {
              textMatches.push(match[1]);
            }
          }
        }
      } catch {
        // Continue
      }
    }
  } catch {
    // Continue
  }

  if (textMatches.length > 0) {
    return textMatches.join(' ').replace(/\\([()\\])/g, '$1').trim();
  }

  return '';
}

function hasReadableContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;

  // Filter out scanned image / binary font stream noise (e.g. dlhEn,b`_P.9!Sq$@...)
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && trimmed.length > 50) {
    const symbolCount = (trimmed.match(/[!@#$%^&*()_+=[\]{};':"\\|<>\/?`~-]/g) || []).length;
    if (symbolCount / trimmed.length > 0.15) {
      return false; // Binary stream / font encoding artifact, not readable natural text
    }
  }

  // Must have real Unicode letters or digits (supports English, Hindi, numbers)
  const meaningfulChars = trimmed.match(/[\p{L}\p{N}]/gu);
  return !!meaningfulChars && meaningfulChars.length >= 8;
}

export const extractPdfContent = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<ExtractedPdfResult> => {
  // 1. Guard against empty files
  if (!buffer || buffer.length === 0) {
    throw createPdfError(
      'No readable text found: the uploaded PDF file is empty (0 bytes).',
      'NO_READABLE_TEXT'
    );
  }

  // 2. Check header
  const header = buffer.subarray(0, 5).toString('ascii');
  if (!header.startsWith('%PDF')) {
    throw createPdfError(
      'Invalid PDF file: file does not have a valid PDF header.',
      'INVALID_PDF'
    );
  }

  // 3. Standard PDF parsing with pdf-parse
  // Copy into a standalone unpooled Buffer so byteOffset is guaranteed to be 0
  try {
    const standaloneBuffer = Buffer.allocUnsafeSlow(buffer.length);
    buffer.copy(standaloneBuffer);
    const data = await pdfParse(standaloneBuffer);
    const rawText = data.text || '';

    // Clean whitespace and normalize line breaks
    let cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    if (!hasReadableContent(cleanText)) {
      const fallback = extractFallbackStrings(buffer);
      if (hasReadableContent(fallback)) {
        cleanText = fallback;
      }
    }

    if (!hasReadableContent(cleanText)) {
      throw createPdfError(
        'No readable text found in the uploaded PDF document.',
        'NO_READABLE_TEXT'
      );
    }

    const snippet =
      cleanText.slice(0, 250).replace(/\n/g, ' ') +
      (cleanText.length > 250 ? '...' : '');

    // Title priority: PDF metadata Title -> first heading in text -> cleaned filename
    const metaTitle =
      data.info?.Title && typeof data.info.Title === 'string' && data.info.Title.trim() !== ''
        ? data.info.Title.trim()
        : undefined;
    const firstHeading = extractFirstHeading(cleanText);
    const resolvedTitle = cleanCardTitle(metaTitle || firstHeading, originalFilename);

    return {
      text: cleanText,
      pageCount: data.numpages || 1,
      title: resolvedTitle,
      author: data.info?.Author || undefined,
      snippet,
      metadata: {
        numpages: data.numpages,
        version: data.version,
        producer: data.info?.Producer,
        creator: data.info?.Creator,
        creationDate: data.info?.CreationDate,
        originalFilename,
        charCount: cleanText.length,
      },
    };
  } catch (err: any) {
    if (err.statusCode) {
      throw err;
    }
    console.warn(`[PDF_EXTRACTOR] Standard pdfParse failed: ${err.message}. Attempting resilient fallback...`);

    // 1. Resilient retry: normalize escaped parentheses in metadata strings (common in ReportLab PDFs)
    try {
      const sanitizedStr = buffer.toString('latin1').replace(/\\([()])/g, ' ');
      const sanitizedBuf = Buffer.from(sanitizedStr, 'latin1');
      const sanitizedData = await pdfParse(sanitizedBuf);
      const rawText = sanitizedData.text || '';
      const cleanText = rawText
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      if (hasReadableContent(cleanText)) {
        const metaTitle =
          sanitizedData.info?.Title && typeof sanitizedData.info.Title === 'string' && sanitizedData.info.Title.trim() !== ''
            ? sanitizedData.info.Title.trim()
            : undefined;
        const firstHeading = extractFirstHeading(cleanText);
        const resolvedTitle = cleanCardTitle(metaTitle || firstHeading, originalFilename);

        return {
          text: cleanText,
          pageCount: sanitizedData.numpages || 1,
          title: resolvedTitle,
          author: sanitizedData.info?.Author || undefined,
          snippet: cleanText.slice(0, 250).replace(/\n/g, ' ') + (cleanText.length > 250 ? '...' : ''),
          metadata: {
            numpages: sanitizedData.numpages,
            version: sanitizedData.version,
            producer: sanitizedData.info?.Producer,
            creator: sanitizedData.info?.Creator,
            creationDate: sanitizedData.info?.CreationDate,
            originalFilename,
            charCount: cleanText.length,
            recoveredViaSanitization: true,
          },
        };
      }
    } catch {
      // Continue to stream extraction fallback
    }

    // 2. Stream decompression and text extraction fallback
    const fallbackText = extractFallbackStrings(buffer);
    if (hasReadableContent(fallbackText)) {
      const snippet =
        fallbackText.slice(0, 250).replace(/\n/g, ' ') +
        (fallbackText.length > 250 ? '...' : '');
      const firstHeading = extractFirstHeading(fallbackText);
      const resolvedTitle = cleanCardTitle(firstHeading, originalFilename);

      return {
        text: fallbackText,
        pageCount: 1,
        title: resolvedTitle,
        snippet,
        metadata: {
          numpages: 1,
          format: 'recovered-stream-fallback',
          originalFilename,
          charCount: fallbackText.length,
          recoveredFromError: err.message,
        },
      };
    }

    console.error('[PDF_EXTRACTOR] Error parsing PDF:', err);
    throw createPdfError('No readable text found or PDF file could not be parsed.', 'NO_READABLE_TEXT');
  }
};
