import mammoth from 'mammoth';

export interface ExtractedDocxResult {
  text: string;
  title: string;
  snippet: string;
  wordCount: number;
  metadata: Record<string, any>;
}

export const extractDocxContent = async (
  buffer: Buffer,
  originalFilename?: string
): Promise<ExtractedDocxResult> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value || '';

    // Clean text
    const cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const words = cleanText.split(/\s+/).filter(Boolean);
    const snippet = cleanText.slice(0, 250).replace(/\n/g, ' ') + (cleanText.length > 250 ? '...' : '');

    const docTitle = originalFilename
      ? originalFilename.replace(/\.docx$/i, '')
      : words.slice(0, 6).join(' ') || 'Untitled DOCX Document';

    return {
      text: cleanText,
      title: docTitle,
      snippet,
      wordCount: words.length,
      metadata: {
        originalFilename,
        charCount: cleanText.length,
        messages: result.messages,
      },
    };
  } catch (err: any) {
    console.error('[DOCX_EXTRACTOR] Error parsing DOCX:', err);
    throw new Error(`Failed to parse DOCX document: ${err.message}`);
  }
};
