import crypto from 'crypto';
import path from 'path';
import JSZip from 'jszip';
import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { uploadPdf, uploadDocx, uploadZip } from '../middleware/upload.js';
import { CardService } from '../services/cardService.js';
import { GraphService } from '../services/graphService.js';
import { extractPdfContent } from '../extractors/pdfExtractor.js';
import { extractDocxContent } from '../extractors/docxExtractor.js';
import { extractUrlContent, validateAndNormalizeUrl } from '../extractors/urlExtractor.js';
import { cleanCardTitle, cleanTagNames, extractFirstHeading } from '../utils/titleCleaner.js';
import { pool } from '../utils/db.js';

const router = Router();

// Apply auth middleware to all card operations
router.use(authenticateToken);

// Helper to parse tagNames from request body (handles JSON string or array)
const parseTags = (rawTags: any): string[] => {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return cleanTagNames(rawTags.map(String));
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return cleanTagNames(parsed.map(String));
    } catch {
      return cleanTagNames(rawTags.split(',').map((t) => t.trim()).filter(Boolean));
    }
  }
  return [];
};

const sha256 = (buf: Buffer): string =>
  crypto.createHash('sha256').update(buf).digest('hex');

// Helper: ingest a single PDF buffer (used by single, batch, and ZIP endpoints)
async function ingestSinglePdfBuffer(
  userId: string,
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  customTitle?: string,
  tagNames: string[] = [],
  skipBackgroundGraph: boolean = false,
  extraMetadata?: Record<string, any>
) {
  const fileHash = sha256(buffer);
  let dup = await CardService.findDuplicateCard(userId, {
    fileHash,
    originalFilename,
    contentType: 'pdf',
  });
  if (dup) {
    const err: any = new Error(`Duplicate file: "${originalFilename}" already exists as "${dup.title}".`);
    err.statusCode = 409;
    err.code = 'DUPLICATE_CARD';
    throw err;
  }

  const extracted = await extractPdfContent(buffer, originalFilename);
  const resolvedTitle =
    customTitle && customTitle.trim() !== ''
      ? cleanCardTitle(customTitle, originalFilename)
      : extracted.title;

  dup = await CardService.findDuplicateCard(userId, {
    title: resolvedTitle,
    contentType: 'pdf',
  });
  if (dup) {
    const err: any = new Error(`Duplicate document: "${originalFilename}" already exists as "${dup.title}".`);
    err.statusCode = 409;
    err.code = 'DUPLICATE_CARD';
    throw err;
  }

  return await CardService.createCard({
    userId,
    title: resolvedTitle,
    contentType: 'pdf',
    rawContent: extracted.snippet,
    extractedText: extracted.text,
    metadata: {
      ...extracted.metadata,
      ...extraMetadata,
      fileHash,
      fileSize: buffer.length,
      mimeType,
    },
    tagNames,
    skipBackgroundGraph,
  });
}

// Helper: ingest a single DOCX buffer (used by single, batch, and ZIP endpoints)
async function ingestSingleDocxBuffer(
  userId: string,
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  customTitle?: string,
  tagNames: string[] = [],
  skipBackgroundGraph: boolean = false,
  extraMetadata?: Record<string, any>
) {
  const fileHash = sha256(buffer);
  let dup = await CardService.findDuplicateCard(userId, {
    fileHash,
    originalFilename,
    contentType: 'docx',
  });
  if (dup) {
    const err: any = new Error(`Duplicate file: "${originalFilename}" already exists as "${dup.title}".`);
    err.statusCode = 409;
    err.code = 'DUPLICATE_CARD';
    throw err;
  }

  const extracted = await extractDocxContent(buffer, originalFilename);
  const resolvedTitle =
    customTitle && customTitle.trim() !== ''
      ? cleanCardTitle(customTitle, originalFilename)
      : extracted.title;

  dup = await CardService.findDuplicateCard(userId, {
    title: resolvedTitle,
    contentType: 'docx',
  });
  if (dup) {
    const err: any = new Error(`Duplicate document: "${originalFilename}" already exists as "${dup.title}".`);
    err.statusCode = 409;
    err.code = 'DUPLICATE_CARD';
    throw err;
  }

  return await CardService.createCard({
    userId,
    title: resolvedTitle,
    contentType: 'docx',
    rawContent: extracted.snippet,
    extractedText: extracted.text,
    metadata: {
      ...extracted.metadata,
      ...extraMetadata,
      fileHash,
      fileSize: buffer.length,
      mimeType,
    },
    tagNames,
    skipBackgroundGraph,
  });
}

// 1. List Cards (with query filters + accurate per-type total counts)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { tag, contentType, search, limit, offset } = req.query;

    const [cards, countsRes] = await Promise.all([
      CardService.getCards({
        userId,
        tag: tag as string | undefined,
        contentType: contentType as string | undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      }),
      pool.query(
        `SELECT content_type, COUNT(*)::int AS cnt
         FROM cards
         WHERE user_id = $1
         GROUP BY content_type`,
        [userId]
      ),
    ]);

    const counts: Record<string, number> = { all: 0, note: 0, pdf: 0, docx: 0, link: 0 };
    for (const row of countsRes.rows) {
      counts[row.content_type] = row.cnt;
      counts.all += row.cnt;
    }

    res.status(200).json({ cards, count: cards.length, counts });
  } catch (err) {
    next(err);
  }
});

// 1b. Ingestion & Upload History (Auditing files, timestamps, ZIP archives, and statuses)
router.get('/upload-history', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const cardsRes = await pool.query(
      `SELECT 
         id,
         title,
         content_type,
         metadata,
         created_at
       FROM cards
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const zipArchivesMap: Record<string, {
      archiveName: string;
      uploadedAt: string;
      totalFiles: number;
      files: Array<{
        id: string;
        title: string;
        filename: string;
        contentType: string;
        createdAt: string;
        status: string;
      }>;
      status: string;
    }> = {};

    const standaloneUploads: Array<{
      id: string;
      title: string;
      filename: string;
      contentType: string;
      createdAt: string;
      status: string;
    }> = [];

    for (const row of cardsRes.rows) {
      const meta = row.metadata || {};
      const archiveName = meta.archiveName;
      const filename = meta.originalFilename || row.title;
      const fileItem = {
        id: row.id,
        title: row.title,
        filename,
        contentType: row.content_type,
        createdAt: row.created_at,
        status: 'Uploaded and working correctly',
      };

      if (archiveName) {
        if (!zipArchivesMap[archiveName]) {
          zipArchivesMap[archiveName] = {
            archiveName,
            uploadedAt: row.created_at,
            totalFiles: 0,
            files: [],
            status: 'All uploaded and working correctly',
          };
        }
        zipArchivesMap[archiveName].files.push(fileItem);
        zipArchivesMap[archiveName].totalFiles += 1;
      } else {
        standaloneUploads.push(fileItem);
      }
    }

    const zipArchives = Object.values(zipArchivesMap);

    res.status(200).json({
      summary: {
        totalFiles: cardsRes.rows.length,
        totalZipArchives: zipArchives.length,
        standaloneCount: standaloneUploads.length,
        status: 'All files active & working correctly in graph and AI assistant',
      },
      zipArchives,
      standaloneUploads,
      allFiles: cardsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        filename: r.metadata?.originalFilename || r.title,
        contentType: r.content_type,
        archiveName: r.metadata?.archiveName,
        createdAt: r.created_at,
        status: 'Uploaded and working correctly',
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Create Rich Note Card
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { title, content, tags } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
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

// 3. Ingest Single PDF Document
router.post(
  '/ingest/pdf',
  uploadPdf.single('file'),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'PDF file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const tagNames = parseTags(req.body.tags);
      const card = await ingestSinglePdfBuffer(
        userId,
        file.buffer,
        file.originalname,
        file.mimetype,
        req.body.title,
        tagNames
      );

      res.status(201).json({ message: 'PDF document ingested successfully.', card });
    } catch (err) {
      next(err);
    }
  }
);

// 3b. Batch Ingest Multiple PDF Documents
router.post(
  '/ingest/pdf/batch',
  uploadPdf.array('files', 30),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const files = (req.files as Express.Multer.File[]) || [];

      if (files.length === 0) {
        res.status(400).json({ error: 'At least one PDF file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const tagNames = parseTags(req.body.tags);
      const created: any[] = [];
      const errors: Array<{ filename: string; error: string; code?: string }> = [];

      for (const file of files) {
        try {
          const card = await ingestSinglePdfBuffer(
            userId,
            file.buffer,
            file.originalname,
            file.mimetype,
            undefined,
            tagNames,
            true
          );
          created.push(card);
        } catch (err: any) {
          errors.push({
            filename: file.originalname,
            error: err.message || 'Failed to ingest PDF',
            code: err.code,
          });
        }
      }

      if (created.length > 0) {
        GraphService.rebuildUserGraph(userId).catch(() => {});
      }

      const statusCode = created.length > 0 ? 201 : errors.some((e) => e.code === 'DUPLICATE_CARD') ? 409 : 400;
      res.status(statusCode).json({
        message:
          created.length > 0
            ? `Ingested ${created.length} of ${files.length} PDF file(s).`
            : errors[0]?.error || 'No PDF files could be ingested.',
        error: created.length === 0 ? errors[0]?.error : undefined,
        cards: created,
        errors,
        summary: {
          total: files.length,
          ingested: created.length,
          failed: errors.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Ingest Single DOCX Document
router.post(
  '/ingest/docx',
  uploadDocx.single('file'),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'DOCX file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const tagNames = parseTags(req.body.tags);
      const card = await ingestSingleDocxBuffer(
        userId,
        file.buffer,
        file.originalname,
        file.mimetype,
        req.body.title,
        tagNames
      );

      res.status(201).json({ message: 'DOCX document ingested successfully.', card });
    } catch (err) {
      next(err);
    }
  }
);

// 4b. Batch Ingest Multiple DOCX Documents
router.post(
  '/ingest/docx/batch',
  uploadDocx.array('files', 30),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const files = (req.files as Express.Multer.File[]) || [];

      if (files.length === 0) {
        res.status(400).json({ error: 'At least one DOCX file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      const tagNames = parseTags(req.body.tags);
      const created: any[] = [];
      const errors: Array<{ filename: string; error: string; code?: string }> = [];

      for (const file of files) {
        try {
          const card = await ingestSingleDocxBuffer(
            userId,
            file.buffer,
            file.originalname,
            file.mimetype,
            undefined,
            tagNames,
            true
          );
          created.push(card);
        } catch (err: any) {
          errors.push({
            filename: file.originalname,
            error: err.message || 'Failed to ingest DOCX',
            code: err.code,
          });
        }
      }

      if (created.length > 0) {
        GraphService.rebuildUserGraph(userId).catch(() => {});
      }

      const statusCode = created.length > 0 ? 201 : errors.some((e) => e.code === 'DUPLICATE_CARD') ? 409 : 400;
      res.status(statusCode).json({
        message:
          created.length > 0
            ? `Ingested ${created.length} of ${files.length} Word document(s).`
            : errors[0]?.error || 'No Word documents could be ingested.',
        error: created.length === 0 ? errors[0]?.error : undefined,
        cards: created,
        errors,
        summary: {
          total: files.length,
          ingested: created.length,
          failed: errors.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4c. Ingest ZIP Archive (extracts and ingests PDFs, DOCX, Markdown notes, and link manifests)
router.post(
  '/ingest/zip',
  uploadZip.single('file'),
  async (req: AuthRequest, res: Response, next): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'ZIP archive file is required.', code: 'FILE_REQUIRED' });
        return;
      }

      if (!file.buffer || file.buffer.length === 0) {
        res.status(400).json({ error: 'The uploaded ZIP archive is empty.', code: 'EMPTY_ZIP' });
        return;
      }

      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(file.buffer);
      } catch (err: any) {
        res.status(400).json({
          error: `Invalid or corrupted ZIP archive: ${err.message}`,
          code: 'INVALID_ZIP',
        });
        return;
      }

      const sharedTags = parseTags(req.body.tags);
      const created: any[] = [];
      const skipped: Array<{ filename: string; reason: string; code?: string }> = [];

      const entries = Object.values(zip.files).filter((entry) => {
        if (entry.dir) return false;
        const norm = entry.name.replace(/\\/g, '/');
        if (norm.startsWith('__MACOSX/') || norm.includes('/__MACOSX/')) return false;
        const base = path.posix.basename(norm);
        if (base.startsWith('.') || base.startsWith('~$')) return false;
        return true;
      });

      if (entries.length === 0) {
        res.status(400).json({
          error: 'No files were found inside the ZIP archive.',
          code: 'EMPTY_ZIP',
        });
        return;
      }

      for (const entry of entries) {
        const baseName = path.posix.basename(entry.name.replace(/\\/g, '/'));
        const ext = path.extname(baseName).toLowerCase();

        try {
          if (ext === '.pdf') {
            const buf = await entry.async('nodebuffer');
            const card = await ingestSinglePdfBuffer(
              userId,
              buf,
              baseName,
              'application/pdf',
              undefined,
              sharedTags,
              true,
              { archiveName: file.originalname, source: 'zip_archive' }
            );
            created.push(card);
          } else if (ext === '.docx') {
            const buf = await entry.async('nodebuffer');
            const card = await ingestSingleDocxBuffer(
              userId,
              buf,
              baseName,
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              undefined,
              sharedTags,
              true,
              { archiveName: file.originalname, source: 'zip_archive' }
            );
            created.push(card);
          } else if (ext === '.md') {
            const buf = await entry.async('nodebuffer');
            const text = buf.toString('utf-8').trim();
            if (text.length < 3) {
              skipped.push({
                filename: baseName,
                reason: 'No readable text found in markdown document.',
                code: 'NO_READABLE_TEXT',
              });
              continue;
            }
            const fileHash = sha256(buf);
            const dup = await CardService.findDuplicateCard(userId, {
              fileHash,
              originalFilename: baseName,
              contentType: 'note',
            });
            if (dup) {
              skipped.push({
                filename: baseName,
                reason: `Duplicate note: already exists as "${dup.title}".`,
                code: 'DUPLICATE_CARD',
              });
              continue;
            }
            const title = cleanCardTitle(extractFirstHeading(text), baseName);
            const card = await CardService.createCard({
              userId,
              title,
              contentType: 'note',
              rawContent: text,
              extractedText: text,
              metadata: {
                source: 'zip_archive',
                originalFilename: baseName,
                fileHash,
                archiveName: file.originalname,
              },
              tagNames: sharedTags,
              skipBackgroundGraph: true,
            });
            created.push(card);
          } else if (ext === '.json' && baseName.toLowerCase().includes('link')) {
            // Optional links.json manifest inside ZIP
            const rawJson = (await entry.async('string')).trim();
            const parsed = JSON.parse(rawJson);
            const urlList = Array.isArray(parsed) ? parsed : [];
            for (const item of urlList) {
              const rawUrl = typeof item === 'string' ? item : item?.url;
              if (!rawUrl) continue;
              try {
                const validated = validateAndNormalizeUrl(rawUrl);
                const dup = await CardService.findDuplicateCard(userId, {
                  url: validated.toString(),
                  contentType: 'link',
                });
                if (dup) {
                  skipped.push({
                    filename: rawUrl,
                    reason: `Duplicate URL: already exists as "${dup.title}".`,
                    code: 'DUPLICATE_CARD',
                  });
                  continue;
                }
                const extracted = await extractUrlContent(validated.toString());
                const linkTags = cleanTagNames([
                  ...sharedTags,
                  ...(Array.isArray(item?.tags) ? item.tags : []),
                ]);
                const card = await CardService.createCard({
                  userId,
                  title: extracted.title,
                  contentType: 'link',
                  rawContent: extracted.description,
                  extractedText: extracted.text || extracted.description,
                  metadata: {
                    ...extracted.metadata,
                    url: extracted.url,
                    siteName: extracted.siteName,
                    imageUrl: extracted.imageUrl,
                    description: extracted.description,
                    archiveName: file.originalname,
                  },
                  tagNames: linkTags,
                  skipBackgroundGraph: true,
                });
                created.push(card);
              } catch (linkErr: any) {
                skipped.push({
                  filename: rawUrl,
                  reason: linkErr.message || 'Failed to ingest URL from ZIP.',
                  code: linkErr.code,
                });
              }
            }
          } else {
            skipped.push({
              filename: baseName,
              reason: `Unsupported file type "${ext || '(none)'}". Only PDF, DOCX, Markdown (.md), and links JSON files are supported.`,
              code: 'UNSUPPORTED_FILE_TYPE',
            });
          }
        } catch (itemErr: any) {
          skipped.push({
            filename: baseName,
            reason: itemErr.message || 'Failed to extract file from ZIP archive.',
            code: itemErr.code,
          });
        }
      }

      if (created.length > 0) {
        GraphService.rebuildUserGraph(userId).catch(() => {});
      }

      res.status(created.length > 0 ? 201 : 400).json({
        message:
          created.length > 0
            ? `Extracted and ingested ${created.length} item(s) from "${file.originalname}" (${skipped.length} skipped).`
            : `No supported or new documents could be ingested from "${file.originalname}".`,
        error: created.length === 0 ? skipped[0]?.reason || 'No valid documents found in ZIP.' : undefined,
        cards: created,
        skipped,
        summary: {
          archiveName: file.originalname,
          totalEntries: entries.length,
          ingested: created.length,
          skipped: skipped.length,
        },
      });
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

    // Strict scheme & format validation before fetching
    const validatedUrl = validateAndNormalizeUrl(url.trim());

    // Duplicate URL check
    const dup = await CardService.findDuplicateCard(userId, {
      url: validatedUrl.toString(),
      contentType: 'link',
    });
    if (dup) {
      res.status(409).json({
        error: `Duplicate link: "${validatedUrl.toString()}" is already saved as "${dup.title}".`,
        code: 'DUPLICATE_CARD',
      });
      return;
    }

    const extracted = await extractUrlContent(validatedUrl.toString());
    const tagNames = parseTags(tags);

    const card = await CardService.createCard({
      userId,
      title: extracted.title || validatedUrl.hostname,
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
