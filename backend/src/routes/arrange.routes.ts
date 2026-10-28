import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ArrangeService } from '../services/arrangeService.js';

const router = Router();

// All arrange routes require JWT authentication
router.use(authenticateToken);

/**
 * GET /api/arrange/smart
 * Returns cards organized into thematic clusters and swimlanes.
 * Query params: ?force=true&minSimilarity=0.35
 */
router.get('/smart', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const force = req.query.force === 'true';
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : 0.35;

    const result = await ArrangeService.getArrangement(
      userId,
      isNaN(minSimilarity) ? 0.35 : minSimilarity,
      force
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[ARRANGE_ROUTE] Error fetching smart arrangement:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate smart arrangement',
      details: err.message,
    });
  }
});

/**
 * POST /api/arrange/smart/regenerate
 * Forces fresh re-clustering and LLM topic naming for all user cards.
 */
router.post('/smart/regenerate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const minSimilarity = req.body.minSimilarity ? parseFloat(req.body.minSimilarity) : 0.35;

    const result = await ArrangeService.getArrangement(
      userId,
      isNaN(minSimilarity) ? 0.35 : minSimilarity,
      true // forceRegenerate = true
    );

    res.status(200).json({
      success: true,
      message: 'Knowledge arrangement recalculated successfully',
      data: result,
    });
  } catch (err: any) {
    console.error('[ARRANGE_ROUTE] Error regenerating arrangement:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate smart arrangement',
      details: err.message,
    });
  }
});

export default router;
