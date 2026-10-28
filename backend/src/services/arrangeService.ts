import { pool } from '../utils/db.js';
import { mlClient } from './mlClient.js';

export interface ArrangedCard {
  id: string;
  user_id: string;
  title: string;
  content_type: string;
  snippet: string;
  metadata?: Record<string, any>;
  centrality?: number;
  cluster_label?: string;
  created_at: string;
  updated_at: string;
  tags: Array<{ id: string; name: string }>;
}

export interface ClusterSection {
  id: string;
  name: string;
  card_count: number;
  common_tags: string[];
  cards: ArrangedCard[];
}

export interface SmartArrangeResponse {
  totalCards: number;
  clustersCount: number;
  clusters: ClusterSection[];
}

export class ArrangeService {
  /**
   * Retrieves or computes semantic cluster arrangement for the user's cards.
   */
  static async getArrangement(
    userId: string,
    minSimilarity: number = 0.35,
    forceRegenerate: boolean = false
  ): Promise<SmartArrangeResponse> {
    // 1. If regeneration not forced, check if user already has clusters in DB
    if (!forceRegenerate) {
      const cached = await this.getArrangementFromDatabase(userId);
      if (cached && cached.clusters.length > 0) {
        return cached;
      }
    }

    // 2. Call ML microservice for fresh Louvain / Agglomerative clustering and Groq LLM naming
    try {
      const mlResult = await mlClient.smartArrange(userId, minSimilarity);
      if (mlResult && mlResult.clusters && mlResult.clusters.length > 0) {
        return {
          totalCards: mlResult.total_cards,
          clustersCount: mlResult.clusters_count,
          clusters: mlResult.clusters.map((c, idx) => ({
            id: c.id || `cluster-${idx + 1}`,
            name: c.name || 'Knowledge Cluster',
            card_count: c.card_count,
            common_tags: c.common_tags || [],
            cards: c.cards,
          })),
        };
      }
    } catch (err: any) {
      console.warn(`[ArrangeService] ML clustering failed: ${err.message}. Using fallback grouping.`);
    }

    // 3. Fallback: Group cards by tags or content types if ML is offline or cards have no embeddings
    return await this.getFallbackArrangement(userId);
  }

  /**
   * Reads existing clustered cards directly from PostgreSQL
   */
  private static async getArrangementFromDatabase(userId: string): Promise<SmartArrangeResponse | null> {
    const query = `
      SELECT 
        c.id,
        c.user_id,
        c.title,
        c.content_type,
        c.metadata,
        c.centrality,
        c.cluster_label,
        c.created_at,
        c.updated_at,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
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
      ORDER BY c.created_at DESC;
    `;

    const res = await pool.query(query, [userId]);
    const cards = res.rows;
    if (cards.length === 0) {
      return { totalCards: 0, clustersCount: 0, clusters: [] };
    }

    // Check if any cards have a cluster_label assigned
    const clusteredCards = cards.filter((c: any) => c.cluster_label && c.cluster_label.trim() !== '');
    if (clusteredCards.length === 0) {
      return null; // Trigger fresh ML clustering
    }

    // Group cards by cluster_label
    const clusterMap = new Map<string, ArrangedCard[]>();
    for (const card of cards) {
      const label = card.cluster_label ? card.cluster_label.trim() : 'Uncategorized Notes';
      if (!clusterMap.has(label)) {
        clusterMap.set(label, []);
      }
      clusterMap.get(label)!.push(card);
    }

    const clusters: ClusterSection[] = [];
    let idx = 1;
    for (const [name, memberCards] of clusterMap.entries()) {
      clusters.push({
        id: `cluster-${idx}`,
        name,
        card_count: memberCards.length,
        common_tags: this.extractCommonTags(memberCards),
        cards: memberCards,
      });
      idx++;
    }

    // Sort clusters so "Uncategorized Notes" is at the end if present
    clusters.sort((a, b) => {
      if (a.name === 'Uncategorized Notes') return 1;
      if (b.name === 'Uncategorized Notes') return -1;
      return b.card_count - a.card_count;
    });

    return {
      totalCards: cards.length,
      clustersCount: clusters.length,
      clusters,
    };
  }

  /**
   * Resilient fallback grouping by top tags or content type if ML service is unreachable
   */
  private static async getFallbackArrangement(userId: string): Promise<SmartArrangeResponse> {
    const query = `
      SELECT 
        c.id,
        c.user_id,
        c.title,
        c.content_type,
        c.metadata,
        c.centrality,
        c.cluster_label,
        c.created_at,
        c.updated_at,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
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
      ORDER BY c.created_at DESC;
    `;

    const res = await pool.query(query, [userId]);
    const cards = res.rows;
    if (cards.length === 0) {
      return { totalCards: 0, clustersCount: 0, clusters: [] };
    }

    const groupMap = new Map<string, ArrangedCard[]>();
    for (const c of cards) {
      const primaryTag = c.tags && c.tags.length > 0 ? c.tags[0].name : null;
      let groupName = primaryTag ? `${primaryTag} Collection` : `${c.content_type.toUpperCase()} Resources`;
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(c);
    }

    const clusters: ClusterSection[] = [];
    let idx = 1;
    for (const [name, memberCards] of groupMap.entries()) {
      clusters.push({
        id: `fallback-${idx}`,
        name,
        card_count: memberCards.length,
        common_tags: this.extractCommonTags(memberCards),
        cards: memberCards,
      });
      idx++;
    }

    return {
      totalCards: cards.length,
      clustersCount: clusters.length,
      clusters,
    };
  }

  private static extractCommonTags(cards: ArrangedCard[]): string[] {
    const countMap: Record<string, number> = {};
    for (const card of cards) {
      if (card.tags) {
        for (const t of card.tags) {
          countMap[t.name] = (countMap[t.name] || 0) + 1;
        }
      }
    }
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  }
}
