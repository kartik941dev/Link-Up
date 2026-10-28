import fs from 'fs';
import path from 'path';
import { pool } from '../utils/db.js';

async function runMigrations() {
  console.log('[MIGRATION] Starting database migration runner...');
  const client = await pool.connect();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Discover migration SQL files
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`[MIGRATION] Migrations directory not found at ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`[MIGRATION] Found ${files.length} migration file(s).`);

    // 3. Check already applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[MIGRATION] Skipping already executed: ${file}`);
        continue;
      }

      console.log(`[MIGRATION] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATION] Successfully executed: ${file}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATION] FAILED to execute: ${file}`);
        console.error(err);
        throw err;
      }
    }

    console.log('[MIGRATION] All migrations successfully verified and up-to-date.');
  } catch (err: any) {
    console.error('[MIGRATION] Error during migration execution:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
