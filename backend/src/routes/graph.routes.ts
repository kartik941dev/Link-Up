import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { GraphService } from '../services/graphService.js';

const router = Router();

// All graph routes require JWT authentication
router.use(authenticateToken);

/**
 * GET /api/graph
 * Returns graph nodes and links for current user, filtered by optional minSimilarity query.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : 0.50;

    const graph = await GraphService.getUserGraph(userId, isNaN(minSimilarity) ? 0.50 : minSimilarity);
    res.status(200).json({
      success: true,
      data: graph,
    });
  } catch (err: any) {
    console.error('[GRAPH_ROUTE] Error fetching graph:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge graph',
      details: err.message,
    });
  }
});

/**
 * POST /api/graph/rebuild
 * Recomputes all pairwise connections and PageRank centralities for the user.
 */
router.post('/rebuild', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const minSimilarity = req.body.minSimilarity ? parseFloat(req.body.minSimilarity) : 0.60;

    const result = await GraphService.rebuildUserGraph(userId, isNaN(minSimilarity) ? 0.60 : minSimilarity);
    res.status(200).json({
      success: true,
      message: 'Knowledge graph connections recalculated successfully',
      data: result,
    });
  } catch (err: any) {
    console.error('[GRAPH_ROUTE] Error rebuilding graph:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to rebuild knowledge graph',
      details: err.message,
    });
  }
});

/**
 * GET /api/graph/neighbors/:cardId
 * Returns 1st-hop and 2nd-hop connected neighbor cards for a given card ID.
 */
router.get('/neighbors/:cardId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cardId = String(req.params.cardId);

    const neighbors = await GraphService.getCardNeighbors(userId, cardId);
    if (!neighbors.card) {
      res.status(404).json({
        success: false,
        error: 'Card not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: neighbors,
    });
  } catch (err: any) {
    console.error('[GRAPH_ROUTE] Error fetching card neighbors:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve card neighbors',
      details: err.message,
    });
  }
});

/**
 * GET /api/graph/export
 * Downloads the graph in JSON or CSV format.
 * Query params: ?format=json|csv&type=nodes|edges
 */
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const format = (req.query.format as string) || 'json';
    const type = (req.query.type as string) || 'all';

    const exportData = await GraphService.exportGraphDataset(userId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      if (type === 'edges') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="linkup-graph-edges-${timestamp}.csv"`);
        res.status(200).send(exportData.csvEdges);
        return;
      }

      if (type === 'nodes') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="linkup-graph-nodes-${timestamp}.csv"`);
        res.status(200).send(exportData.csvNodes);
        return;
      }

      // Default CSV: concatenated nodes and edges with boundary header
      const combinedCsv = `### NODES ###\n${exportData.csvNodes}\n\n### EDGES ###\n${exportData.csvEdges}`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="linkup-knowledge-graph-${timestamp}.csv"`);
      res.status(200).send(combinedCsv);
      return;
    }

    // Default: JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="linkup-knowledge-graph-${timestamp}.json"`);
    res.status(200).send(JSON.stringify(exportData.json, null, 2));
  } catch (err: any) {
    console.error('[GRAPH_ROUTE] Error exporting graph:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to export knowledge graph',
      details: err.message,
    });
  }
});

export default router;
