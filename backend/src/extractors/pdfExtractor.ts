import pdfParse from 'pdf-parse';

export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  title?: string;
  author?: string;
  snippet: string;
  metadata: Record<string, any>;
}

export const extractPdfContent = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<ExtractedPdfResult> => {
  try {
    const data = await pdfParse(buffer);
    const rawText = data.text || '';

    // Clean whitespace and normalize line breaks
    const cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // Generate snippet preview (first ~250 characters)
    const snippet = cleanText.slice(0, 250).replace(/\n/g, ' ') + (cleanText.length > 250 ? '...' : '');

    const docTitle =
      data.info?.Title && data.info.Title.trim() !== ''
        ? data.info.Title.trim()
        : originalFilename
        ? originalFilename.replace(/\.pdf$/i, '')
        : 'Untitled PDF Document';

    return {
      text: cleanText,
      pageCount: data.numpages || 1,
      title: docTitle,
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
    console.error('[PDF_EXTRACTOR] Error parsing PDF:', err);
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }
};
