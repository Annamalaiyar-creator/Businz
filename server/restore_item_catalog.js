import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { pool, query, isDbConnected, initPostgresDatabase } from './db.js';

async function restoreCatalog() {
  const itemStorePath = path.resolve(__dirname, 'item_store.json');
  if (!fs.existsSync(itemStorePath)) {
    console.error('[RESTORE ERROR] item_store.json not found at', itemStorePath);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(itemStorePath, 'utf8'));
  console.log(`[RESTORE] Read ${items.length} items from ${itemStorePath}`);

  if (items.length < 50) {
    console.error('[RESTORE ERROR] item_store.json contains fewer than 50 items. Aborting to prevent accidental data loss.');
    process.exit(1);
  }

  try {
    await initPostgresDatabase();
  } catch (err) {
    console.warn('[RESTORE] DB init notice:', err?.message);
  }

  if (isDbConnected()) {
    console.log('[RESTORE] PostgreSQL is connected. Updating controlroom_store for "item_store"...');
    await query(`
      INSERT INTO controlroom_store (key, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()
    `, ['item_store', JSON.stringify(items)]);
    console.log('[RESTORE] Successfully updated PostgreSQL controlroom_store with restored items!');
  } else {
    console.log('[RESTORE] PostgreSQL not connected in current environment; disk file server/item_store.json is ready and authoritative.');
  }

  console.log('[RESTORE] Catalog restoration completed successfully!');
  process.exit(0);
}

restoreCatalog().catch(err => {
  console.error('[RESTORE ERROR]:', err);
  process.exit(1);
});
