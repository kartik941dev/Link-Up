import { pool } from '../utils/db.js';
import { NOISE_TAGS } from '../utils/titleCleaner.js';

export class TagService {
  // Get all active content tags for user with card usage counts (excludes unused & file-type noise tags)
  static async getUserTags(userId: string) {
    const noiseList = Array.from(NOISE_TAGS);
    const query = `
      SELECT 
        t.id, 
        t.name, 
        t.created_at,
        COUNT(ct.card_id)::int AS card_count
      FROM tags t
      JOIN card_tags ct ON ct.tag_id = t.id
      JOIN cards c ON c.id = ct.card_id AND c.user_id = $1
      WHERE t.user_id = $1
        AND LOWER(t.name) <> ALL($2::text[])
      GROUP BY t.id
      HAVING COUNT(ct.card_id) > 0
      ORDER BY card_count DESC, t.name ASC
    `;
    const res = await pool.query(query, [userId, noiseList]);
    return res.rows;
  }

  // Create tag
  static async createTag(userId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tag name cannot be empty.');

    const res = await pool.query(
      `INSERT INTO tags (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, created_at`,
      [userId, trimmed]
    );
    return res.rows[0];
  }

  // Delete tag
  static async deleteTag(tagId: string, userId: string) {
    const res = await pool.query(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING id',
      [tagId, userId]
    );
    return res.rows.length > 0;
  }
}
