import { pool } from '../utils/db.js';

async function checkHealth() {
  console.log('[HEALTH] Checking database connectivity and schema...');
  try {
    const timeRes = await pool.query('SELECT NOW() as now, version() as version');
    console.log('[HEALTH] DB Timestamp:', timeRes.rows[0].now);
    console.log('[HEALTH] DB Version:', timeRes.rows[0].version.split('\n')[0]);

    // Check extensions
    const extRes = await pool.query(
      `SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp')`
    );
    console.log('[HEALTH] Installed Extensions:', extRes.rows);

    // Check core tables
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('[HEALTH] Public Tables:', tableRes.rows.map((r) => r.table_name));

    console.log('[HEALTH] Database health check PASSED ✅');
  } catch (err: any) {
    console.error('[HEALTH] Database health check FAILED ❌:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkHealth();
