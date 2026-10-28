import pdfParse from 'pdf-parse';

export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  title?: string;
  author?: string;
  snippet: string;
  metadata: Record<string, any>;
}

// Fallback helper to extract printable strings when PDF cross-reference table is damaged
function extractFallbackStrings(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const textMatches: string[] = [];

  // 1. Try extracting text within PDF text blocks BT ... ET
  const textBlockRegex = /BT[\s\S]*?ET/g;
  let blockMatch;
  while ((blockMatch = textBlockRegex.exec(content)) !== null) {
    const block = blockMatch[0];
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match;
    while ((match = tjRegex.exec(block)) !== null) {
      textMatches.push(match[1]);
    }
  }

  if (textMatches.length > 0) {
    return textMatches.join(' ').replace(/\\([()\\])/g, '$1').trim();
  }

  // 2. Fallback: extract continuous printable text sequences
  const rawStrings = content.match(/[\x20-\x7E\r\n\t]{4,}/g);
  if (rawStrings) {
    const filtered = rawStrings.filter(
      (s) =>
        !s.startsWith('/Type') &&
        !s.startsWith('/Filter') &&
        !s.startsWith('/Length') &&
        !s.startsWith('/Font') &&
        !s.includes('endobj') &&
        !s.includes('endstream') &&
        !s.includes('xref') &&
        !s.includes('trailer') &&
        !s.includes('startxref')
    );
    return filtered.join('\n').trim();
  }

  return '';
}

export const extractPdfContent = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<ExtractedPdfResult> => {
  const docTitle = originalFilename
    ? originalFilename.replace(/\.pdf$/i, '')
    : 'Untitled PDF Document';

  // 1. Guard against empty files
  if (!buffer || buffer.length === 0) {
    throw new Error(
      'The uploaded PDF file is empty (0 bytes). Please upload a valid PDF document with text.'
    );
  }

  // 2. Check if the file is a text/markdown file saved with a .pdf extension
  const header = buffer.subarray(0, 5).toString('ascii');
  if (!header.startsWith('%PDF')) {
    const possibleText = buffer.toString('utf-8').trim();
    if (possibleText.length > 0) {
      console.warn(
        `[PDF_EXTRACTOR] File "${originalFilename}" does not contain standard %PDF header. Treating as raw text document.`
      );
      const cleanText = possibleText
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
      const snippet =
        cleanText.slice(0, 250).replace(/\n/g, ' ') +
        (cleanText.length > 250 ? '...' : '');

      return {
        text: cleanText,
        pageCount: 1,
        title: docTitle,
        snippet,
        metadata: {
          numpages: 1,
          format: 'text-as-pdf-fallback',
          originalFilename,
          charCount: cleanText.length,
        },
      };
    }
  }

  // 3. Standard PDF parsing with pdf-parse
  try {
    const data = await pdfParse(buffer);
    const rawText = data.text || '';

    // Clean whitespace and normalize line breaks
    let cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // If pdf-parse succeeded but returned almost nothing, try fallback
    if (cleanText.length < 10) {
      const fallback = extractFallbackStrings(buffer);
      if (fallback.length > cleanText.length) {
        cleanText = fallback;
      }
    }

    const snippet =
      cleanText.slice(0, 250).replace(/\n/g, ' ') +
      (cleanText.length > 250 ? '...' : '');

    const resolvedTitle =
      data.info?.Title && data.info.Title.trim() !== ''
        ? data.info.Title.trim()
        : docTitle;

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
    console.warn(`[PDF_EXTRACTOR] Standard pdfParse failed: ${err.message}. Attempting resilient fallback...`);

    // 4. Resilient Fallback for damaged/non-standard xref tables
    const fallbackText = extractFallbackStrings(buffer);
    if (fallbackText && fallbackText.length >= 10) {
      console.info(`[PDF_EXTRACTOR] Successfully recovered ${fallbackText.length} characters using fallback extractor.`);
      const snippet =
        fallbackText.slice(0, 250).replace(/\n/g, ' ') +
        (fallbackText.length > 250 ? '...' : '');

      return {
        text: fallbackText,
        pageCount: 1,
        title: docTitle,
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
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }
};
