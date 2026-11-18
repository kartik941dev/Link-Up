import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { RagService } from '../services/ragService.js';
import { TagService } from '../services/tagService.js';
import { pool } from '../utils/db.js';

const router = Router();

// All RAG routes require JWT authentication
router.use(authenticateToken);

/**
 * GET /api/rag/suggestions
 * Dynamically generates prompt suggestions from the user's own top tags and cluster names.
 */
router.get('/suggestions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [countRes, clusterRes, topTags] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS cnt FROM cards WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT cluster_label, COUNT(*)::int AS cnt
         FROM cards
         WHERE user_id = $1
           AND cluster_label IS NOT NULL
           AND TRIM(cluster_label) <> ''
           AND cluster_label NOT IN ('Unclustered', 'Uncategorized Notes')
         GROUP BY cluster_label
         ORDER BY cnt DESC, cluster_label ASC
         LIMIT 4`,
        [userId]
      ),
      TagService.getUserTags(userId),
    ]);

    const cardCount: number = countRes.rows[0]?.cnt || 0;
    if (cardCount === 0) {
      res.status(200).json({
        success: true,
        data: {
          hasCards: false,
          cardCount: 0,
          suggestions: [],
        },
      });
      return;
    }

    const clusters: string[] = clusterRes.rows.map((r: any) => r.cluster_label);
    const tagNames: string[] = topTags.slice(0, 6).map((t: any) => t.name);

    const suggestions: string[] = [];

    if (clusters.length >= 1) {
      suggestions.push(`Summarize the key concepts from my "${clusters[0]}" cards.`);
    }
    if (clusters.length >= 2) {
      suggestions.push(`How do my cards in "${clusters[0]}" compare with "${clusters[1]}"?`);
    }
    if (tagNames.length >= 2) {
      suggestions.push(`What do my cards say about ${tagNames[0]} and ${tagNames[1]}?`);
    } else if (tagNames.length === 1) {
      suggestions.push(`Explain the main takeaways from my cards tagged "${tagNames[0]}".`);
    }
    if (tagNames.length >= 3) {
      suggestions.push(`What key details are mentioned about ${tagNames[2]} across my library?`);
    }

    // Fallback if user has cards but no clusters/tags yet
    if (suggestions.length < 2) {
      const titlesRes = await pool.query(
        'SELECT title FROM cards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3',
        [userId]
      );
      for (const row of titlesRes.rows) {
        if (suggestions.length >= 4) break;
        suggestions.push(`Summarize the main ideas in "${row.title}".`);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        hasCards: true,
        cardCount,
        suggestions: suggestions.slice(0, 4),
      },
    });
  } catch (err: any) {
    console.error('[RAG_ROUTE] Error building suggestions:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggested prompts',
    });
  }
});

/**
 * POST /api/rag/query
 * Executes multi-hop Agentic RAG retrieval, Groq generation, and hallucination verification.
 */
router.post('/query', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { query, conversationHistory, cardIdsFilter } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Question query is required and cannot be empty.',
      });
      return;
    }

    if (query.length > 2000) {
      res.status(400).json({
        success: false,
        error: 'Query length exceeds maximum limit of 2,000 characters.',
      });
      return;
    }

    const result = await RagService.query(
      userId,
      query.trim(),
      conversationHistory,
      cardIdsFilter
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[RAG_ROUTE] Error processing RAG query:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process RAG question',
      details: err.message,
    });
  }
});

export default router;
