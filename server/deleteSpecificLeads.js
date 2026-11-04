/**
 * Standalone Lead Deletion Utility for BUSINZ
 * Removes specifically requested leads:
 * - VRM-LD-2026-10
 * - VRM-LD-2026-04
 * - VRM-LD-2026-03
 * - VRM-LD-2026-02
 * 
 * Safely cascades through child tables (incidents, activities, status history, followups, assignment history)
 * and purges both PostgreSQL database rows and disk/memory cache.
 */

import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStoreFilePath } from './runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_LEAD_NUMBERS = [
  'VRM-LD-2026-10',
  'VRM-LD-2026-04',
  'VRM-LD-2026-03',
  'VRM-LD-2026-02'
];

export async function deleteTargetLeadsFromDb() {
  console.log(`[Lead Purge] Checking for target leads to delete: ${TARGET_LEAD_NUMBERS.join(', ')}...`);

  let dbDeletedCount = 0;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Find any leads matching target lead numbers or IDs
    const findQuery = `
      SELECT id, lead_number, company_name, contact_name 
      FROM public.leads 
      WHERE lead_number = ANY($1) OR id = ANY($1);
    `;
    const findRes = await client.query(findQuery, [TARGET_LEAD_NUMBERS]);
    const matchedLeads = findRes.rows || [];

    if (matchedLeads.length > 0) {
      const targetIds = matchedLeads.map(l => l.id);
      console.log(`[Lead Purge] Found ${matchedLeads.length} leads in database to delete:`, matchedLeads.map(l => `${l.lead_number || l.id} (${l.company_name || l.contact_name || 'No Name'})`));

      // 1. Delete inactivity incidents
      await client.query(`DELETE FROM public.lead_inactivity_incidents WHERE lead_id = ANY($1);`, [targetIds]);

      // 2. Delete activities
      await client.query(`DELETE FROM public.lead_activities WHERE lead_id = ANY($1);`, [targetIds]);

      // 3. Delete status history
      await client.query(`DELETE FROM public.lead_status_history WHERE lead_id = ANY($1);`, [targetIds]);

      // 4. Delete followups
      await client.query(`DELETE FROM public.lead_followups WHERE lead_id = ANY($1);`, [targetIds]);

      // 5. Delete assignment history
      await client.query(`DELETE FROM public.lead_assignment_history WHERE lead_id = ANY($1);`, [targetIds]);

      // 6. Nullify notifications referencing target leads
      await client.query(`UPDATE public.lead_notifications SET lead_id = NULL WHERE lead_id = ANY($1);`, [targetIds]);

      // 7. Nullify quotations referencing target leads
      await client.query(`UPDATE public.quotations SET lead_id = NULL WHERE lead_id = ANY($1);`, [targetIds]);

      // 8. Delete leads
      const delRes = await client.query(`DELETE FROM public.leads WHERE id = ANY($1);`, [targetIds]);
      dbDeletedCount = delRes.rowCount || matchedLeads.length;

      await client.query('COMMIT');
      console.log(`✅ [Lead Purge] Successfully deleted ${dbDeletedCount} leads from PostgreSQL database.`);
    } else {
      await client.query('ROLLBACK');
      console.log(`ℹ️ [Lead Purge] No target leads found in PostgreSQL database.`);
    }
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.warn(`[Lead Purge Notice - DB]:`, err.message);
  } finally {
    if (client) client.release();
  }

  // 2. Also remove from local disk JSON (server/crm_leads.json)
  try {
    const diskPath = getStoreFilePath('crm_leads.json');
    if (fs.existsSync(diskPath)) {
      const raw = fs.readFileSync(diskPath, 'utf8');
      const leads = JSON.parse(raw);
      if (Array.isArray(leads)) {
        const filtered = leads.filter(l => {
          const lNum = l.lead_number || l.leadNumber || '';
          const lId = l.id || '';
          return !TARGET_LEAD_NUMBERS.includes(lNum) && !TARGET_LEAD_NUMBERS.includes(lId);
        });
        if (filtered.length !== leads.length) {
          fs.writeFileSync(diskPath, JSON.stringify(filtered, null, 2), 'utf8');
          console.log(`✅ [Lead Purge] Removed ${leads.length - filtered.length} target leads from crm_leads.json.`);
        }
      }
    }
  } catch (diskErr) {
    console.warn(`[Lead Purge Notice - Disk]:`, diskErr.message);
  }

  return { success: true, count: dbDeletedCount };
}

// Allow direct CLI execution: node server/deleteSpecificLeads.js
if (process.argv[1] && process.argv[1].endsWith('deleteSpecificLeads.js')) {
  deleteTargetLeadsFromDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

