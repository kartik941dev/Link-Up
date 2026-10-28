import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { RagService } from '../services/ragService.js';

const router = Router();

// All RAG routes require JWT authentication
router.use(authenticateToken);

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
