import { pool } from '../utils/db.js';
import { mlClient } from './mlClient.js';

export interface GraphNode {
  id: string;
  title: string;
  content_type: 'note' | 'pdf' | 'docx' | 'link';
  centrality: number;
  cluster_label?: string | null;
  snippet: string;
  tags: Array<{ id: string; name: string }>;
  created_at: string;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  weight: number;
  similarity_score: number;
  edge_type: string;
  reason: string;
  created_at: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalNodes: number;
    totalLinks: number;
    avgSimilarity: number;
    maxCentrality: number;
  };
}

export class GraphService {
  /**
   * Rebuilds the knowledge graph for a user by calculating similarity
   * and updating topological centrality (PageRank).
   */
  static async rebuildUserGraph(userId: string, minSimilarity: number = 0.60): Promise<{
    nodeCount: number;
    edgeCount: number;
    source: 'ml_service' | 'database_fallback';
  }> {
    // 1. Try ML Microservice first (NumPy pairwise cosine + NetworkX PageRank)
    try {
      const mlRes = await mlClient.buildGraph(userId, minSimilarity);
      if (mlRes && mlRes.status === 'ok') {
        return {
          nodeCount: mlRes.node_count,
          edgeCount: mlRes.edge_count,
          source: 'ml_service',
        };
      }
    } catch (err: any) {
      console.warn(`[GraphService] ML microservice rebuild failed: ${err.message}. Falling back to PostgreSQL native.`);
    }

    // 2. Database Fallback via pgvector
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing edges
      await client.query('DELETE FROM graph_edges WHERE user_id = $1', [userId]);

      // Check number of embedded cards
      const countRes = await client.query(
        'SELECT COUNT(*) FROM cards WHERE user_id = $1 AND embedding IS NOT NULL',
        [userId]
      );
      const totalCards = parseInt(countRes.rows[0].count, 10);

      if (totalCards < 2) {
        await client.query('UPDATE cards SET centrality = 0.0 WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
        return { nodeCount: totalCards, edgeCount: 0, source: 'database_fallback' };
      }

      // Compute pairwise cosine similarities in PostgreSQL
      const insertEdgesQuery = `
        INSERT INTO graph_edges (
          user_id, source_card_id, target_card_id, weight, similarity_score, edge_type, reason
        )
        SELECT
          $1,
          c1.id,
          c2.id,
          ROUND((1 - (c1.embedding <=> c2.embedding))::numeric, 4) AS weight,
          ROUND((1 - (c1.embedding <=> c2.embedding))::numeric, 4) AS similarity_score,
          CASE 
            WHEN (1 - (c1.embedding <=> c2.embedding)) >= 0.85 THEN 'direct_reference'
            WHEN (1 - (c1.embedding <=> c2.embedding)) >= 0.72 THEN 'topic_cluster'
            ELSE 'semantic_similarity'
          END AS edge_type,
          'Semantic similarity (' || ROUND(((1 - (c1.embedding <=> c2.embedding)) * 100)::numeric, 0) || '%)' AS reason
        FROM cards c1
        JOIN cards c2 ON c1.user_id = c2.user_id AND c1.id < c2.id
        WHERE c1.user_id = $1 
          AND c1.embedding IS NOT NULL 
          AND c2.embedding IS NOT NULL
          AND (1 - (c1.embedding <=> c2.embedding)) >= $2;
      `;
      const edgeInsertRes = await client.query(insertEdgesQuery, [userId, minSimilarity]);
      const edgeCount = edgeInsertRes.rowCount || 0;

      // Degree centrality fallback calculation
      const centralityQuery = `
        WITH card_degrees AS (
          SELECT card_id, COUNT(*) AS degree
          FROM (
            SELECT source_card_id AS card_id FROM graph_edges WHERE user_id = $1
            UNION ALL
            SELECT target_card_id AS card_id FROM graph_edges WHERE user_id = $1
          ) all_edges
          GROUP BY card_id
        ),
        max_deg AS (
          SELECT COALESCE(MAX(degree), 1) as max_val FROM card_degrees
        )
        UPDATE cards c
        SET centrality = ROUND(COALESCE(cd.degree::numeric / md.max_val::numeric, 0.0), 4),
            updated_at = CURRENT_TIMESTAMP
        FROM max_deg md
        LEFT JOIN card_degrees cd ON cd.card_id = c.id
        WHERE c.user_id = $1;
      `;
      await client.query(centralityQuery, [userId]);

      await client.query('COMMIT');
      return { nodeCount: totalCards, edgeCount, source: 'database_fallback' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[GraphService] Error rebuilding graph via database fallback: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves nodes and edges for the user knowledge graph.
   */
  static async getUserGraph(userId: string, minSimilarity: number = 0.50): Promise<GraphData> {
    // 1. Fetch nodes
    const nodesQuery = `
      SELECT 
        c.id,
        c.title,
        c.content_type,
        COALESCE(c.centrality, 0.0) AS centrality,
        c.cluster_label,
        c.created_at,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 250) AS snippet,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM cards c
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.centrality DESC, c.created_at DESC;
    `;
    const nodesRes = await pool.query(nodesQuery, [userId]);
    const nodes: GraphNode[] = nodesRes.rows;

    // 2. Fetch edges filtered by threshold
    const linksQuery = `
      SELECT 
        ge.id,
        ge.source_card_id AS source,
        ge.target_card_id AS target,
        ge.weight,
        ge.similarity_score,
        ge.edge_type,
        ge.reason,
        ge.created_at
      FROM graph_edges ge
      WHERE ge.user_id = $1 AND ge.similarity_score >= $2
      ORDER BY ge.similarity_score DESC;
    `;
    const linksRes = await pool.query(linksQuery, [userId, minSimilarity]);
    const links: GraphLink[] = linksRes.rows;

    // Calculate summary statistics
    const totalNodes = nodes.length;
    const totalLinks = links.length;
    const avgSimilarity =
      totalLinks > 0
        ? Math.round(
            (links.reduce((acc, l) => acc + Number(l.similarity_score), 0) / totalLinks) * 100
          ) / 100
        : 0;
    const maxCentrality =
      totalNodes > 0
        ? Math.max(...nodes.map((n) => Number(n.centrality)))
        : 0;

    return {
      nodes,
      links,
      stats: {
        totalNodes,
        totalLinks,
        avgSimilarity,
        maxCentrality,
      },
    };
  }

  /**
   * Retrieves 1st-hop and 2nd-hop connected neighbors for a specific card.
   */
  static async getCardNeighbors(userId: string, cardId: string): Promise<{
    card: GraphNode | null;
    firstHop: Array<{ card: GraphNode; edge: GraphLink }>;
    secondHop: Array<{ card: GraphNode; via: string; edge: GraphLink }>;
  }> {
    // Check main card
    const mainCardRes = await pool.query(
      `SELECT c.id, c.title, c.content_type, COALESCE(c.centrality, 0.0) AS centrality,
              SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 250) AS snippet,
              c.created_at
       FROM cards c WHERE c.id = $1 AND c.user_id = $2`,
      [cardId, userId]
    );

    if (mainCardRes.rows.length === 0) {
      return { card: null, firstHop: [], secondHop: [] };
    }

    const card = mainCardRes.rows[0];

    // Find 1st-hop neighbors
    const firstHopQuery = `
      SELECT 
        ge.id AS edge_id, ge.source_card_id, ge.target_card_id, ge.weight, ge.similarity_score, ge.edge_type, ge.reason,
        c.id, c.title, c.content_type, COALESCE(c.centrality, 0.0) AS centrality,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 200) AS snippet,
        c.created_at
      FROM graph_edges ge
      JOIN cards c ON (c.id = CASE WHEN ge.source_card_id = $1 THEN ge.target_card_id ELSE ge.source_card_id END)
      WHERE ge.user_id = $2 AND (ge.source_card_id = $1 OR ge.target_card_id = $1)
      ORDER BY ge.similarity_score DESC;
    `;
    const firstHopRes = await pool.query(firstHopQuery, [cardId, userId]);

    const firstHop = firstHopRes.rows.map((row) => ({
      card: {
        id: row.id,
        title: row.title,
        content_type: row.content_type,
        centrality: Number(row.centrality),
        snippet: row.snippet,
        tags: [],
        created_at: row.created_at,
      },
      edge: {
        id: row.edge_id,
        source: row.source_card_id,
        target: row.target_card_id,
        weight: Number(row.weight),
        similarity_score: Number(row.similarity_score),
        edge_type: row.edge_type,
        reason: row.reason,
        created_at: row.created_at,
      },
    }));

    return { card, firstHop, secondHop: [] };
  }

  /**
   * Generates formatted data for CSV or JSON export.
   */
  static async exportGraphDataset(userId: string): Promise<{
    json: any;
    csvNodes: string;
    csvEdges: string;
  }> {
    const graphData = await this.getUserGraph(userId, 0.0);

    // Build CSV Nodes
    const nodeHeaders = ['id', 'title', 'content_type', 'centrality', 'cluster_label', 'created_at', 'tags'];
    const nodeRows = graphData.nodes.map((n) => {
      const tagString = n.tags.map((t) => t.name).join(';');
      const cleanTitle = `"${n.title.replace(/"/g, '""')}"`;
      return [n.id, cleanTitle, n.content_type, n.centrality, n.cluster_label || '', n.created_at, `"${tagString}"`].join(',');
    });
    const csvNodes = [nodeHeaders.join(','), ...nodeRows].join('\n');

    // Build CSV Edges
    const edgeHeaders = ['id', 'source_card_id', 'target_card_id', 'weight', 'similarity_score', 'edge_type', 'reason', 'created_at'];
    const edgeRows = graphData.links.map((e) => {
      const cleanReason = `"${e.reason.replace(/"/g, '""')}"`;
      return [e.id, e.source, e.target, e.weight, e.similarity_score, e.edge_type, cleanReason, e.created_at].join(',');
    });
    const csvEdges = [edgeHeaders.join(','), ...edgeRows].join('\n');

    return {
      json: {
        exportedAt: new Date().toISOString(),
        nodes: graphData.nodes,
        links: graphData.links,
        stats: graphData.stats,
      },
      csvNodes,
      csvEdges,
    };
  }
}
