import { pool } from '../utils/db.js';
import { mlClient } from '../services/mlClient.js';

async function reindex() {
  console.log('[REINDEX] Starting card embedding backfill process...');

  const health = await mlClient.checkHealth();
  if (!health) {
    console.error(
      '[REINDEX] Error: ML Service is not reachable. Make sure FastAPI microservice is running on port 8000.'
    );
    process.exit(1);
  }

  console.log(`[REINDEX] ML Service connected. Model: ${health.model.name} (dim: ${health.model.dimension})`);

  try {
    const res = await pool.query(`
      SELECT id, title, COALESCE(extracted_text, raw_content, '') AS text_content
      FROM cards
      WHERE embedding IS NULL
      ORDER BY created_at DESC
    `);

    const cards = res.rows;
    console.log(`[REINDEX] Found ${cards.length} card(s) requiring vector embedding.`);

    if (cards.length === 0) {
      console.log('[REINDEX] All cards already have vector embeddings.');
      process.exit(0);
    }

    let successCount = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      process.stdout.write(`[REINDEX] (${i + 1}/${cards.length}) Processing: "${card.title.slice(0, 40)}" ... `);

      const success = await mlClient.syncCardEmbedding(card.id, card.title, card.text_content);
      if (success) {
        console.log('✅ Generated & Saved');
        successCount++;
      } else {
        console.log('❌ Failed');
      }
    }

    console.log(`\n[REINDEX] Completed. Successfully generated embeddings for ${successCount}/${cards.length} cards.`);
    process.exit(0);
  } catch (err: any) {
    console.error('[REINDEX] Fatal error during reindexing:', err.message);
    process.exit(1);
  }
}

reindex();
