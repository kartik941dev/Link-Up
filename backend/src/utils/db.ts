import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Parse database URL to handle SSL configuration correctly
const isSslRequired =
  config.databaseUrl.includes('sslmode=require') ||
  config.databaseUrl.includes('neon.tech') ||
  config.databaseUrl.includes('supabase.co');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isSslRequired
    ? {
        rejectUnauthorized: false,
      }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development') {
    // console.debug(`[DB Query] ${text.slice(0, 60)}... (${duration}ms)`);
  }
  return res;
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const res = await pool.query('SELECT NOW() as current_time');
    console.log('[DB] PostgreSQL connected successfully at:', res.rows[0].current_time);
    return true;
  } catch (err: any) {
    console.error('[DB] PostgreSQL connection error:', err.message);
    return false;
  }
};
