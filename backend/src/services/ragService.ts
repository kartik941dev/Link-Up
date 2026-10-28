import { pool } from '../utils/db.js';
import { mlClient } from './mlClient.js';

export interface RAGCitation {
  card_id: string;
  title: string;
  content_type: string;
  snippet: string;
  created_at?: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface RAGVerification {
  grounded: boolean;
  confidence: number;
  unsupported_claims: string[];
  explanation?: string;
}

export interface RAGQueryResponse {
  query: string;
  answer: string;
  citations: RAGCitation[];
  verification: RAGVerification;
  retrievedCardsCount: number;
  graphExpansionUsed: boolean;
}

export class RagService {
  /**
   * Executes multi-hop Agentic RAG query and enriches citations with database metadata.
   */
  static async query(
    userId: string,
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    cardIdsFilter?: string[]
  ): Promise<RAGQueryResponse> {
    const trimmedQuery = query.trim();

    // 1. Invoke ML microservice RAG pipeline
    try {
      const mlResult = await mlClient.queryRAG(
        userId,
        trimmedQuery,
        conversationHistory,
        cardIdsFilter
      );

      if (mlResult) {
        // Enrich citations with full DB details (tags, created_at, content_type)
        const enrichedCitations = await this.enrichCitations(userId, mlResult.citations);

        return {
          query: mlResult.query,
          answer: mlResult.answer,
          citations: enrichedCitations,
          verification: mlResult.verification,
          retrievedCardsCount: mlResult.retrieved_cards_count,
          graphExpansionUsed: mlResult.graph_expansion_used,
        };
      }
    } catch (err: any) {
      console.warn(`[RagService] ML RAG call failed: ${err.message}. Using DB fallback.`);
    }

    // 2. Fallback: PostgreSQL Full-Text Search extractive answer
    return await this.fallbackQuery(userId, trimmedQuery);
  }

  /**
   * Enriches citation objects with tags and metadata from PostgreSQL
   */
  private static async enrichCitations(
    userId: string,
    citations: Array<{ card_id: string; title: string; content_type: string; snippet: string }>
  ): Promise<RAGCitation[]> {
    if (!citations || citations.length === 0) return [];

    const cardIds = citations.map((c) => c.card_id);
    try {
      const query = `
        SELECT 
          c.id, c.title, c.content_type, c.created_at,
          COALESCE(
            json_agg(
              json_build_object('id', t.id, 'name', t.name)
            ) FILTER (WHERE t.id IS NOT NULL), 
            '[]'
          ) AS tags
        FROM cards c
        LEFT JOIN card_tags ct ON ct.card_id = c.id
        LEFT JOIN tags t ON t.id = ct.tag_id
        WHERE c.id = ANY($1::uuid[]) AND c.user_id = $2
        GROUP BY c.id;
      `;
      const res = await pool.query(query, [cardIds, userId]);
      const cardMap = new Map<string, any>(res.rows.map((r) => [r.id, r]));

      return citations.map((cit) => {
        const dbCard = cardMap.get(cit.card_id);
        return {
          card_id: cit.card_id,
          title: dbCard?.title || cit.title,
          content_type: dbCard?.content_type || cit.content_type,
          snippet: cit.snippet,
          created_at: dbCard?.created_at,
          tags: dbCard?.tags || [],
        };
      });
    } catch (err) {
      console.warn('[RagService] Could not enrich citations from DB:', err);
      return citations;
    }
  }

  /**
   * Database fallback using full-text search when ML service is offline
   */
  private static async fallbackQuery(userId: string, query: string): Promise<RAGQueryResponse> {
    const ftsQuery = `
      SELECT 
        c.id, c.title, c.content_type, c.created_at,
        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 300) AS snippet,
        ts_rank_cd(
          to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
          plainto_tsquery('english', $2)
        ) AS rank
      FROM cards c
      WHERE c.user_id = $1 
        AND (c.title ILIKE $3 OR c.extracted_text ILIKE $3)
      ORDER BY rank DESC, c.created_at DESC
      LIMIT 4;
    `;
    const res = await pool.query(ftsQuery, [userId, query, `%${query}%`]);
    const matchedCards = res.rows;

    if (matchedCards.length === 0) {
      return {
        query,
        answer: "Based on your indexed knowledge cards, no matching information was found.",
        citations: [],
        verification: {
          grounded: true,
          confidence: 0.90,
          unsupported_claims: [],
          explanation: "No relevant cards found matching the search terms.",
        },
        retrievedCardsCount: 0,
        graphExpansionUsed: false,
      };
    }

    const citations: RAGCitation[] = matchedCards.map((c) => ({
      card_id: c.id,
      title: c.title,
      content_type: c.content_type,
      snippet: c.snippet,
      created_at: c.created_at,
      tags: [],
    }));

    const answerLines = [
      `### Direct Knowledge Matches for: *"${query}"*\n`,
      "Here are the relevant excerpts found directly in your knowledge cards:\n",
    ];

    for (const c of matchedCards) {
      answerLines.push(`- **${c.title}**: ${c.snippet} [Card: ${c.id} - ${c.title}]\n`);
    }

    return {
      query,
      answer: answerLines.join('\n'),
      citations,
      verification: {
        grounded: true,
        confidence: 0.92,
        unsupported_claims: [],
        explanation: "Extracted directly from verified knowledge cards via database full-text search.",
      },
      retrievedCardsCount: matchedCards.length,
      graphExpansionUsed: false,
    };
  }
}
