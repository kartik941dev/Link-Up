import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { AppError } from '../middleware/errorHandler.js';
import { cleanCardTitle, extractFirstHeading } from '../utils/titleCleaner.js';

export interface ExtractedDocxResult {
  text: string;
  title: string;
  snippet: string;
  wordCount: number;
  metadata: Record<string, any>;
}

const createDocxError = (message: string, code: string = 'DOCX_PARSE_ERROR'): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
};

function hasReadableContent(text: string): boolean {
  const meaningfulChars = (text || '').match(/[\p{L}\p{N}]/gu);
  return !!meaningfulChars && meaningfulChars.length >= 3;
}

export const extractDocxContent = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<ExtractedDocxResult> => {
  if (!buffer || buffer.length === 0) {
    throw createDocxError(
      'No readable text found: the uploaded DOCX file is empty (0 bytes).',
      'NO_READABLE_TEXT'
    );
  }

  try {
    const rawResult = await mammoth.extractRawText({ buffer });
    const rawText = rawResult.value || '';

    // Clean text
    const cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    if (!hasReadableContent(cleanText)) {
      throw createDocxError(
        'No readable text found in the uploaded DOCX document.',
        'NO_READABLE_TEXT'
      );
    }

    // Prefer first HTML heading (<h1>/<h2>/<h3>) from Mammoth, else first heading line, else cleaned filename
    let headingTitle: string | undefined;
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      if (htmlResult.value) {
        const $ = cheerio.load(htmlResult.value);
        const hText = $('h1, h2, h3').first().text().replace(/\s+/g, ' ').trim();
        if (hText.length >= 3 && hText.length <= 120) {
          headingTitle = hText;
        }
      }
    } catch {
      // Ignore HTML heading extraction failures; fall back to plain text heading
    }

    const firstHeading = headingTitle || extractFirstHeading(cleanText);
    const resolvedTitle = cleanCardTitle(firstHeading, originalFilename);

    const words = cleanText.split(/\s+/).filter(Boolean);
    const snippet =
      cleanText.slice(0, 250).replace(/\n/g, ' ') + (cleanText.length > 250 ? '...' : '');

    return {
      text: cleanText,
      title: resolvedTitle,
      snippet,
      wordCount: words.length,
      metadata: {
        originalFilename,
        charCount: cleanText.length,
        messages: rawResult.messages,
      },
    };
  } catch (err: any) {
    if (err.statusCode) {
      throw err;
    }
    console.error('[DOCX_EXTRACTOR] Error parsing DOCX:', err);
    throw createDocxError(`Failed to parse DOCX document: ${err.message}`, 'DOCX_PARSE_ERROR');
  }
};
