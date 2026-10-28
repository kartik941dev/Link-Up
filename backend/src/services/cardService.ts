import { pool } from '../utils/db.js';
import { mlClient } from './mlClient.js';
import { GraphService } from './graphService.js';

export interface CreateCardInput {
  userId: string;
  title: string;
  contentType: 'note' | 'pdf' | 'docx' | 'link';
  rawContent?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
  tagNames?: string[];
}

export interface UpdateCardInput {
  title?: string;
  rawContent?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
  tagNames?: string[];
}

export interface CardQueryOptions {
  userId: string;
  tag?: string;
  contentType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CardService {
  // Helper to sync tags for a card
  private static async syncTags(
    client: any,
    userId: string,
    cardId: string,
    tagNames: string[]
  ) {
    // Delete existing links for this card
    await client.query('DELETE FROM card_tags WHERE card_id = $1', [cardId]);

    if (!tagNames || tagNames.length === 0) return;

    for (const rawName of tagNames) {
      const name = rawName.trim();
      if (!name) continue;

      // Upsert tag
      let tagRes = await client.query(
        'SELECT id FROM tags WHERE user_id = $1 AND name = $2',
        [userId, name]
      );

      let tagId: string;
      if (tagRes.rows.length === 0) {
        const createRes = await client.query(
          'INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING id',
          [userId, name]
        );
        tagId = createRes.rows[0].id;
      } else {
        tagId = tagRes.rows[0].id;
      }

      // Link card to tag
      await client.query(
        `INSERT INTO card_tags (card_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT (card_id, tag_id) DO NOTHING`,
        [cardId, tagId]
      );
    }
  }

  // Create Card
  static async createCard(input: CreateCardInput) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO cards (
          user_id, title, content_type, raw_content, extracted_text, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        input.userId,
        input.title.trim(),
        input.contentType,
        input.rawContent || '',
        input.extractedText || input.rawContent || '',
        JSON.stringify(input.metadata || {}),
      ];

      const res = await client.query(insertQuery, values);
      const card = res.rows[0];

      if (input.tagNames && input.tagNames.length > 0) {
        await this.syncTags(client, input.userId, card.id, input.tagNames);
      }

      await client.query('COMMIT');

      // Trigger automatic background embedding generation & graph connection update
      mlClient
        .syncCardEmbedding(
          card.id,
          input.title,
          input.extractedText || input.rawContent || ''
        )
        .then(() => {
          GraphService.rebuildUserGraph(input.userId).catch((err) => {
            console.warn(`[GRAPH] Background graph rebuild notice: ${err.message}`);
          });
        })
        .catch((e) => {
          console.warn(`[EMBED] Background vectorization notice: ${e.message}`);
        });

      return await this.getCardById(card.id, input.userId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Get Card By ID
  static async getCardById(cardId: string, userId: string) {
    const queryStr = `
      SELECT 
        c.*,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) AS tags
      FROM cards c
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE c.id = $1 AND c.user_id = $2
      GROUP BY c.id
    `;

    const res = await pool.query(queryStr, [cardId, userId]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  // List Cards with Filtering
  static async getCards(opts: CardQueryOptions) {
    const limit = Math.min(opts.limit || 50, 100);
    const offset = opts.offset || 0;
    const params: any[] = [opts.userId];
    let paramIndex = 2;

    let whereClauses = ['c.user_id = $1'];

    if (opts.contentType) {
      whereClauses.push(`c.content_type = $${paramIndex}`);
      params.push(opts.contentType);
      paramIndex++;
    }

    if (opts.search) {
      whereClauses.push(
        `(c.title ILIKE $${paramIndex} OR c.extracted_text ILIKE $${paramIndex})`
      );
      params.push(`%${opts.search}%`);
      paramIndex++;
    }

    let joinClause = '';
    if (opts.tag) {
      joinClause = `
        JOIN card_tags filter_ct ON filter_ct.card_id = c.id
        JOIN tags filter_t ON filter_t.id = filter_ct.tag_id AND filter_t.name = $${paramIndex}
      `;
      params.push(opts.tag);
      paramIndex++;
    }

    const queryStr = `
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
      ${joinClause}
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const res = await pool.query(queryStr, params);
    return res.rows;
  }

  // Update Card
  static async updateCard(cardId: string, userId: string, input: UpdateCardInput) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
        [cardId, userId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Card not found or access denied.');
      }

      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [cardId, userId];
      let idx = 3;

      if (input.title !== undefined) {
        updates.push(`title = $${idx}`);
        values.push(input.title.trim());
        idx++;
      }
      if (input.rawContent !== undefined) {
        updates.push(`raw_content = $${idx}`);
        values.push(input.rawContent);
        idx++;
      }
      if (input.extractedText !== undefined) {
        updates.push(`extracted_text = $${idx}`);
        values.push(input.extractedText);
        idx++;
      }
      if (input.metadata !== undefined) {
        updates.push(`metadata = $${idx}`);
        values.push(JSON.stringify(input.metadata));
        idx++;
      }

      const updateQuery = `
        UPDATE cards 
        SET ${updates.join(', ')} 
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      await client.query(updateQuery, values);

      if (input.tagNames !== undefined) {
        await this.syncTags(client, userId, cardId, input.tagNames);
      }

      await client.query('COMMIT');

      // Trigger re-embedding if content or title changed
      if (input.title !== undefined || input.extractedText !== undefined || input.rawContent !== undefined) {
        this.getCardById(cardId, userId).then((freshCard) => {
          if (freshCard) {
            mlClient.syncCardEmbedding(
              cardId,
              freshCard.title,
              freshCard.extracted_text || freshCard.raw_content || ''
            ).catch((e) => {
              console.warn(`[EMBED] Background re-embedding notice: ${e.message}`);
            });
          }
        }).catch(() => {});
      }

      return await this.getCardById(cardId, userId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Delete Card
  static async deleteCard(cardId: string, userId: string) {
    const res = await pool.query(
      'DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING id',
      [cardId, userId]
    );
    return res.rows.length > 0;
  }
}
