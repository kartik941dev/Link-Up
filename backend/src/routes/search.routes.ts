import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { pool } from '../utils/db.js';
import { mlClient } from '../services/mlClient.js';

const router = Router();

// Secure search endpoint with JWT authentication
router.use(authenticateToken);

export interface SearchResultItem {
  id: string;
  title: string;
  content_type: string;
  snippet: string;
  similarity_score: number;
  match_type: 'hybrid' | 'semantic' | 'exact';
  tags: Array<{ id: string; name: string }>;
  created_at: string;
}

/**
 * GET /api/search
 * Query parameters:
 *  - q: search term (required)
 *  - mode: 'hybrid' | 'semantic' | 'exact' (default: 'hybrid')
 *  - limit: integer (default: 20)
 *  - tag: optional tag filter
 */
router.get('/', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const query = ((req.query.q as string) || '').trim();
    const mode = ((req.query.mode as string) || 'hybrid').toLowerCase();
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const tagFilter = req.query.tag as string | undefined;

    if (!query) {
      res.status(200).json({
        query: '',
        mode,
        total: 0,
        results: [],
      });
      return;
    }

    // 1. EXACT TEXT SEARCH (PostgreSQL FTS)
    if (mode === 'exact') {
      let tagJoin = '';
      const params: any[] = [userId, query];
      let paramIndex = 3;

      if (tagFilter) {
        tagJoin = `
          JOIN card_tags filter_ct ON filter_ct.card_id = c.id
          JOIN tags filter_t ON filter_t.id = filter_ct.tag_id AND filter_t.name = $${paramIndex}
        `;
        params.push(tagFilter);
        paramIndex++;
      }

      params.push(limit);

      const ftsQuery = `
        SELECT 
          c.id,
          c.title,
          c.content_type,
          c.created_at,
          SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
          ts_rank_cd(
            to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
            plainto_tsquery('english', $2)
          ) AS rank_score,
          COALESCE(
            json_agg(
              json_build_object('id', t.id, 'name', t.name)
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) AS tags
        FROM cards c
        ${tagJoin}
        LEFT JOIN card_tags ct ON ct.card_id = c.id
        LEFT JOIN tags t ON t.id = ct.tag_id
        WHERE c.user_id = $1
          AND (
            to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')) @@ plainto_tsquery('english', $2)
            OR c.title ILIKE '%' || $2 || '%'
            OR c.extracted_text ILIKE '%' || $2 || '%'
          )
        GROUP BY c.id
        ORDER BY rank_score DESC, c.created_at DESC
        LIMIT $${paramIndex - 1};
      `;

      const result = await pool.query(ftsQuery, params);
      const formatted: SearchResultItem[] = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content_type: row.content_type,
        snippet: row.snippet,
        similarity_score: Math.min(Math.round((row.rank_score + 0.3) * 100) / 100, 1.0),
        match_type: 'exact',
        tags: row.tags,
        created_at: row.created_at,
      }));

      res.status(200).json({
        query,
        mode: 'exact',
        total: formatted.length,
        results: formatted,
      });
      return;
    }

    // 2. VECTOR SEMANTIC SEARCH
    if (mode === 'semantic') {
      const queryEmbedding = await mlClient.generateEmbedding(query);
      if (!queryEmbedding) {
        res.status(503).json({
          error: 'ML service is currently unreachable for vector embedding.',
          code: 'ML_SERVICE_UNAVAILABLE',
        });
        return;
      }

      const vectorString = `[${queryEmbedding.join(',')}]`;
      let tagJoin = '';
      const params: any[] = [userId, vectorString];
      let paramIndex = 3;

      if (tagFilter) {
        tagJoin = `
          JOIN card_tags filter_ct ON filter_ct.card_id = c.id
          JOIN tags filter_t ON filter_t.id = filter_ct.tag_id AND filter_t.name = $${paramIndex}
        `;
        params.push(tagFilter);
        paramIndex++;
      }

      params.push(limit);

      const semanticQuery = `
        SELECT 
          c.id,
          c.title,
          c.content_type,
          c.created_at,
          SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
          (1 - (c.embedding <=> $2::vector)) AS vector_similarity,
          COALESCE(
            json_agg(
              json_build_object('id', t.id, 'name', t.name)
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) AS tags
        FROM cards c
        ${tagJoin}
        LEFT JOIN card_tags ct ON ct.card_id = c.id
        LEFT JOIN tags t ON t.id = ct.tag_id
        WHERE c.user_id = $1
          AND c.embedding IS NOT NULL
        GROUP BY c.id
        ORDER BY (c.embedding <=> $2::vector) ASC
        LIMIT $${paramIndex - 1};
      `;

      const result = await pool.query(semanticQuery, params);
      const formatted: SearchResultItem[] = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content_type: row.content_type,
        snippet: row.snippet,
        similarity_score: Math.round(row.vector_similarity * 100) / 100,
        match_type: 'semantic',
        tags: row.tags,
        created_at: row.created_at,
      }));

      res.status(200).json({
        query,
        mode: 'semantic',
        total: formatted.length,
        results: formatted,
      });
      return;
    }

    // 3. HYBRID SEARCH (PostgreSQL FTS + Dense Vector Similarity Fusion)
    const queryEmbedding = await mlClient.generateEmbedding(query);

    let tagJoin = '';
    const params: any[] = [userId, query];
    let paramIndex = 3;

    let vectorSelect = '0.0 AS vector_score';
    let vectorWhere = '';
    let vectorSort = 'fts_rank DESC';

    if (queryEmbedding) {
      const vectorString = `[${queryEmbedding.join(',')}]`;
      params.push(vectorString);
      const vecParam = `$${paramIndex}`;
      paramIndex++;

      vectorSelect = `
        CASE 
          WHEN c.embedding IS NOT NULL THEN (1 - (c.embedding <=> ${vecParam}::vector))
          ELSE 0.0
        END AS vector_score
      `;
      // Fusion score: 0.65 * vector + 0.35 * normalized FTS
      vectorSort = `
        (
          0.65 * CASE WHEN c.embedding IS NOT NULL THEN (1 - (c.embedding <=> ${vecParam}::vector)) ELSE 0.0 END +
          0.35 * (ts_rank_cd(to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')), plainto_tsquery('english', $2)) / 
                 (1 + ts_rank_cd(to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')), plainto_tsquery('english', $2))))
        ) DESC
      `;
    }

    if (tagFilter) {
      tagJoin = `
        JOIN card_tags filter_ct ON filter_ct.card_id = c.id
        JOIN tags filter_t ON filter_t.id = filter_ct.tag_id AND filter_t.name = $${paramIndex}
      `;
      params.push(tagFilter);
      paramIndex++;
    }

    params.push(limit);

    const hybridQuery = `
      SELECT 
        c.id,
        c.title,
        c.content_type,
        c.created_at,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
        ts_rank_cd(
          to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
          plainto_tsquery('english', $2)
        ) AS fts_rank,
        ${vectorSelect},
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM cards c
      ${tagJoin}
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY ${vectorSort}
      LIMIT $${paramIndex - 1};
    `;

    const result = await pool.query(hybridQuery, params);

    const formatted: SearchResultItem[] = result.rows.map((row) => {
      const vecScore = parseFloat(row.vector_score) || 0.0;
      const ftsScore = parseFloat(row.fts_rank) || 0.0;

      let matchType: 'hybrid' | 'semantic' | 'exact' = 'hybrid';
      if (ftsScore > 0.05 && vecScore > 0.45) {
        matchType = 'hybrid';
      } else if (vecScore > 0.5) {
        matchType = 'semantic';
      } else {
        matchType = 'exact';
      }

      const fused = Math.round((0.65 * vecScore + 0.35 * Math.min(ftsScore, 1.0)) * 100) / 100;

      return {
        id: row.id,
        title: row.title,
        content_type: row.content_type,
        snippet: row.snippet,
        similarity_score: Math.max(fused, Math.round(vecScore * 100) / 100),
        match_type: matchType,
        tags: row.tags,
        created_at: row.created_at,
      };
    });

    res.status(200).json({
      query,
      mode: 'hybrid',
      total: formatted.length,
      results: formatted,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
