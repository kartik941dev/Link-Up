import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { CardService } from '../services/cardService.js';
import { extractPdfContent } from '../extractors/pdfExtractor.js';
import { extractDocxContent } from '../extractors/docxExtractor.js';
import { extractUrlContent } from '../extractors/urlExtractor.js';

const router = Router();

// Apply auth middleware to all card operations
router.use(authenticateToken);

// Helper to parse tagNames from request body (handles JSON string or array)
const parseTags = (rawTags: any): string[] => {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(String);
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Comma-separated fallback
      return rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
};

// 1. List Cards (with query filters)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { tag, contentType, search, limit, offset } = req.query;

    const cards = await CardService.getCards({
      userId,
      tag: tag as string | undefined,
      contentType: contentType as string | undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.status(200).json({ cards, count: cards.length });
  } catch (err) {
    next(err);
  }
});

// 2. Create Rich Note Card
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { title, content, tags } = req.body;

    if (!title || title.trim() === '') {
      res.status(400).json({ error: 'Card title is required.', code: 'TITLE_REQUIRED' });
      return;
    }

    const tagNames = parseTags(tags);
    const card = await CardService.createCard({
      userId,
      title: title.trim(),
      contentType: 'note',
      rawContent: content || '',
      extractedText: content || '',
      tagNames,
      metadata: { source: 'manual_note' },
    });

    res.status(201).json({ message: 'Note card created successfully.', card });
  } catch (err) {
    next(err);
  }
});

// 3. Ingest PDF Document
router.post(
  '/ingest/pdf',
  upload.single('file'),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'PDF file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const extracted = await extractPdfContent(file.buffer, file.originalname);
      const tagNames = parseTags(req.body.tags);

      // Default tag "PDF" if not supplied
      if (!tagNames.includes('PDF')) {
        tagNames.push('PDF');
      }

      const card = await CardService.createCard({
        userId,
        title: req.body.title || extracted.title || file.originalname,
        contentType: 'pdf',
        rawContent: extracted.snippet,
        extractedText: extracted.text,
        metadata: {
          ...extracted.metadata,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
        tagNames,
      });

      res.status(201).json({ message: 'PDF document ingested successfully.', card });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Ingest DOCX Document
router.post(
  '/ingest/docx',
  upload.single('file'),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'DOCX file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const extracted = await extractDocxContent(file.buffer, file.originalname);
      const tagNames = parseTags(req.body.tags);

      if (!tagNames.includes('DOCX')) {
        tagNames.push('DOCX');
      }

      const card = await CardService.createCard({
        userId,
        title: req.body.title || extracted.title || file.originalname,
        contentType: 'docx',
        rawContent: extracted.snippet,
        extractedText: extracted.text,
        metadata: {
          ...extracted.metadata,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
        tagNames,
      });

      res.status(201).json({ message: 'DOCX document ingested successfully.', card });
    } catch (err) {
      next(err);
    }
  }
);

// 5. Ingest Web & Social URL Link
router.post('/ingest/social-link', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { url, tags } = req.body;

    if (!url || typeof url !== 'string' || url.trim() === '') {
      res.status(400).json({ error: 'A valid URL is required.', code: 'URL_REQUIRED' });
      return;
    }

    const extracted = await extractUrlContent(url.trim());
    const tagNames = parseTags(tags);

    if (!tagNames.includes('Web Link')) {
      tagNames.push('Web Link');
    }

    const card = await CardService.createCard({
      userId,
      title: extracted.title || url,
      contentType: 'link',
      rawContent: extracted.description || extracted.snippet,
      extractedText: extracted.text || extracted.description,
      metadata: {
        ...extracted.metadata,
        url: extracted.url,
        siteName: extracted.siteName,
        imageUrl: extracted.imageUrl,
        description: extracted.description,
      },
      tagNames,
    });

    res.status(201).json({ message: 'Web link ingested successfully.', card });
  } catch (err) {
    next(err);
  }
});

// 6. Get Single Card
router.get('/:id', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cardId = req.params.id as string;

    const card = await CardService.getCardById(cardId, userId);
    if (!card) {
      res.status(404).json({ error: 'Card not found.', code: 'NOT_FOUND' });
      return;
    }

    res.status(200).json({ card });
  } catch (err) {
    next(err);
  }
});

// 7. Update Card
router.put('/:id', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cardId = req.params.id as string;
    const { title, content, tags, metadata } = req.body;

    const updated = await CardService.updateCard(cardId, userId, {
      title,
      rawContent: content,
      extractedText: content,
      tagNames: tags !== undefined ? parseTags(tags) : undefined,
      metadata,
    });

    res.status(200).json({ message: 'Card updated successfully.', card: updated });
  } catch (err) {
    next(err);
  }
});

// 8. Delete Card
router.delete('/:id', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cardId = req.params.id as string;

    const deleted = await CardService.deleteCard(cardId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Card not found or already deleted.', code: 'NOT_FOUND' });
      return;
    }

    res.status(200).json({ message: 'Card deleted successfully.', id: cardId });
  } catch (err) {
    next(err);
  }
});

export default router;
