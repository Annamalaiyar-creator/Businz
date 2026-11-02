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
  const backupPath = path.resolve(__dirname, 'backups/phase10_pre_zoho_schema_retirement_2026-10-07T04-54-17-860Z/item_store.json');

  let items = [];
  if (fs.existsSync(itemStorePath)) {
    try {
      items = JSON.parse(fs.readFileSync(itemStorePath, 'utf8')) || [];
    } catch (_) {
      items = [];
    }
  }

  const distinctNames = new Set((items || []).map(it => (it?.name || '').trim().toLowerCase()).filter(Boolean));
  console.log(`[RESTORE] Read ${items.length} items with ${distinctNames.size} distinct names from ${itemStorePath}`);

  // If item_store.json is corrupted (e.g. all 289 items have identical names) or empty, restore from clean backup
  if (distinctNames.size < 10 || items.length < 50) {
    console.warn(`[RESTORE WARNING] item_store.json is corrupted (${distinctNames.size} distinct names). Restoring from verified backup...`);
    if (!fs.existsSync(backupPath)) {
      console.error('[RESTORE ERROR] Backup file not found at', backupPath);
      process.exit(1);
    }

    const backupRaw = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    items = backupRaw.map((it, idx) => {
      const code = (it.code || it.sku || it.itemId || it.id || `ITM-${1000 + idx}`).toString().trim();
      const sku = (it.sku || it.code || code).toString().trim();
      const itemId = (it.itemId || it.id || code).toString().trim();
      const id = (it.id || it.itemId || code).toString().trim();
      return {
        ...it,
        code,
        sku,
        itemId,
        id,
        name: (it.name || '').trim(),
        rate: Number(it.rate || it.price) || 0,
        price: Number(it.price || it.rate) || 0,
        unit: it.unit || it.uom || 'NOS',
        status: it.status || 'Active'
      };
    });

    fs.writeFileSync(itemStorePath, JSON.stringify(items, null, 2), 'utf8');
    console.log(`[RESTORE] Successfully rewrote ${itemStorePath} with ${items.length} clean backup items!`);
  }

  if (items.length < 50) {
    console.error('[RESTORE ERROR] Items catalog contains fewer than 50 items. Aborting to prevent accidental data loss.');
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

  console.log(`[RESTORE] Catalog restoration completed successfully (${items.length} distinct products ready)!`);
  process.exit(0);
}

restoreCatalog().catch(err => {
  console.error('[RESTORE ERROR]:', err);
  process.exit(1);
});

