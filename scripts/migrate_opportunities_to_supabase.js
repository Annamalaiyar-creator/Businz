import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbm12Y3B6bGVicnZkeW51bndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjA3ODYsImV4cCI6MjEwMTk5Njc4Nn0.x3NIpkDHzNa9dMQ9pnz4qGiy0ZBeAX98Hzbj54AHSfo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function toDatabaseOpportunityRow(item) {
  if (!item || typeof item !== 'object') return null;

  const id = item.id || item.oppNumber || `OPP-${Date.now()}`;
  const companyName = item.companyName || item.customerName || 'Customer';
  const title = item.title || `${companyName} Opportunity`;
  const customerId = item.customerId || item.customer_id || null;
  const dealValue = Number(item.dealValue || item.deal_value || 0);
  const stage = item.stage || 'Requirement Received';
  const probability = Number.isInteger(Number(item.probability)) ? Number(item.probability) : 20;
  const salesperson = item.assignedSalesperson || item.salesperson || item.assigned_salesperson || 'Sales Representative';

  let targetCloseDate = null;
  const rawDate = item.targetCloseDate || item.expectedClosingDate || item.target_close_date;
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        targetCloseDate = d.toISOString().split('T')[0];
      }
    } catch (_) {}
  }

  // Pack extra non-column fields into notes JSON metadata
  const extraMetadata = {};
  if (item.capacityKw !== undefined) extraMetadata.capacityKw = item.capacityKw;
  if (item.structureType !== undefined) extraMetadata.structureType = item.structureType;
  if (item.oppNumber !== undefined) extraMetadata.oppNumber = item.oppNumber;
  if (item.contactPerson !== undefined) extraMetadata.contactPerson = item.contactPerson;
  if (item.phone !== undefined) extraMetadata.phone = item.phone;
  if (item.requirement !== undefined) extraMetadata.requirement = item.requirement;
  if (item.productCategory !== undefined) extraMetadata.productCategory = item.productCategory;
  if (item.estimatedQty !== undefined) extraMetadata.estimatedQty = item.estimatedQty;
  if (item.priority !== undefined) extraMetadata.priority = item.priority;
  if (item.bomCode !== undefined) extraMetadata.bomCode = item.bomCode;
  if (item.quotationNumber !== undefined) extraMetadata.quotationNumber = item.quotationNumber;
  if (item.lastActivity !== undefined) extraMetadata.lastActivity = item.lastActivity;
  if (item.nextFollowup !== undefined) extraMetadata.nextFollowup = item.nextFollowup;

  let notesVal = item.notes || '';
  if (Object.keys(extraMetadata).length > 0) {
    extraMetadata._userNotes = item.notes || '';
    notesVal = JSON.stringify(extraMetadata);
  }

  return {
    id,
    customer_id: customerId,
    company_name: companyName,
    title,
    deal_value: dealValue,
    stage,
    probability,
    assigned_salesperson: salesperson,
    target_close_date: targetCloseDate,
    notes: notesVal,
    created_at: item.createdAt || item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function runMigration() {
  console.log('================================================================');
  console.log('🚀 BUSINZ PHASE 2 — CRM OPPORTUNITIES ONE-TIME MIGRATION SCRIPT');
  console.log('================================================================');

  let recordsFound = 0;
  let recordsMigrated = 0;
  let duplicatesFound = 0;
  let conflictsFound = 0;
  let recordsSkipped = 0;

  const rawCandidates = [];

  // 1. Fetch from public.leaves WHERE employee = 'CRM_OPPORTUNITIES'
  try {
    const { data: leavesRows, error: leavesErr } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee', 'CRM_OPPORTUNITIES');

    if (!leavesErr && Array.isArray(leavesRows) && leavesRows.length > 0) {
      leavesRows.forEach(r => {
        try {
          const parsed = JSON.parse(r.reason);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => rawCandidates.push({ ...p, _source: 'leaves' }));
          } else if (parsed && typeof parsed === 'object') {
            rawCandidates.push({ ...parsed, _source: 'leaves' });
          }
        } catch (_) {}
      });
      console.log(`[Leaves Source] Found ${leavesRows.length} leaves rows.`);
    } else {
      console.log(`[Leaves Source] 0 records in public.leaves (employee = CRM_OPPORTUNITIES).`);
    }
  } catch (err) {
    console.warn('[Leaves Fetch Error]:', err.message);
  }

  // 2. Fetch from server/crm_opportunities.json
  const diskPath = path.resolve(__dirname, '../server/crm_opportunities.json');
  if (fs.existsSync(diskPath)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData)) {
        diskData.forEach(d => rawCandidates.push({ ...d, _source: 'disk_json' }));
        console.log(`[Disk JSON Source] Found ${diskData.length} records in crm_opportunities.json.`);
      }
    } catch (e) {
      console.warn('[Disk Read Error]:', e.message);
    }
  }

  recordsFound = rawCandidates.length;
  console.log(`Total candidate records found across all sources: ${recordsFound}`);

  // 3. De-duplicate candidates by Opportunity ID & clean fields
  const oppMap = new Map();
  for (const item of rawCandidates) {
    if (!item) {
      recordsSkipped++;
      continue;
    }
    const id = (item.id || item.oppNumber || '').trim();
    if (!id) {
      recordsSkipped++;
      continue;
    }

    if (!oppMap.has(id)) {
      oppMap.set(id, item);
    } else {
      duplicatesFound++;
      // Merge records, favoring more complete fields
      const existing = oppMap.get(id);
      oppMap.set(id, { ...existing, ...item });
    }
  }

  console.log(`Unique opportunities to migrate after de-duplication: ${oppMap.size}`);

  // 4. Transform to canonical public.opportunities rows
  const databaseRows = [];
  for (const [id, item] of oppMap.entries()) {
    try {
      const dbRow = toDatabaseOpportunityRow(item);
      if (dbRow) {
        databaseRows.push(dbRow);
      } else {
        recordsSkipped++;
      }
    } catch (err) {
      conflictsFound++;
      console.error(`Conflict preparing opportunity [${id}]:`, err.message);
    }
  }

  // 5. Upsert individual rows to public.opportunities (Zero leaves array blob)
  for (const row of databaseRows) {
    try {
      const { error: upsertErr } = await supabase
        .from('opportunities')
        .upsert(row, { onConflict: 'id' });

      if (upsertErr) {
        conflictsFound++;
        console.error(`❌ Failed to upsert ${row.id}:`, upsertErr.message);
      } else {
        recordsMigrated++;
        console.log(`  ✅ [${row.id}] ${row.company_name} - ${row.title} (₹${row.deal_value.toLocaleString('en-IN')}) [${row.stage}]`);
      }
    } catch (err) {
      conflictsFound++;
      console.error(`Exception upserting ${row.id}:`, err.message);
    }
  }

  // 6. Verify final row count on Supabase
  const { count: finalCount, error: countErr } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true });

  console.log('\n================================================================');
  console.log('📊 OPPORTUNITIES MIGRATION REPORT');
  console.log('================================================================');
  console.log(`- Total candidate records found: ${recordsFound}`);
  console.log(`- Total records migrated:        ${recordsMigrated}`);
  console.log(`- Duplicate records resolved:    ${duplicatesFound}`);
  console.log(`- Conflicted records:            ${conflictsFound}`);
  console.log(`- Records skipped:               ${recordsSkipped}`);
  console.log(`- Final database row count:      ${countErr ? 'Error' : finalCount}`);
  console.log('================================================================\n');
}

runMigration();
