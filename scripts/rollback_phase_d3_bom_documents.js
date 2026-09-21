/**
 * BUSINZ BOM DOCUMENT MIGRATION — PHASE D3 ROLLBACK UTILITY
 *
 * Emergency utility to restore Base64 documents from pre-D3 backup.
 * DO NOT RUN UNLESS ROLLBACK IS EXPLICITLY REQUIRED.
 *
 * Usage:
 *   node scripts/rollback_phase_d3_bom_documents.js --dry-run
 *   node scripts/rollback_phase_d3_bom_documents.js --execute
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const BUCKET_NAME = 'bom-documents';

const isDryRun = process.argv.includes('--dry-run');
const isExecute = process.argv.includes('--execute');

if (!isDryRun && !isExecute) {
  console.log('⚠️ Safety check: Please run with --dry-run to preview or --execute to perform rollback.');
  process.exit(0);
}

async function runRollback() {
  console.log('====================================================');
  console.log(`⚠️ BUSINZ PHASE D3 ROLLBACK UTILITY ${isDryRun ? '[DRY RUN]' : '[LIVE RESTORATION]'}`);
  console.log('====================================================\n');

  // Locate latest backup
  const backupDir = path.resolve(__dirname, '../server/backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup directory not found: server/backups');
  }

  const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('bom_orders_pre_d3_backup_')).sort();
  if (backupFiles.length === 0) {
    throw new Error('No pre-D3 backup files found in server/backups');
  }

  const targetBackupFile = path.join(backupDir, backupFiles[backupFiles.length - 1]);
  console.log(`Step 1: Reading backup from: ${path.basename(targetBackupFile)}`);
  const backedUpBoms = JSON.parse(fs.readFileSync(targetBackupFile, 'utf8'));
  console.log(`✅ Loaded ${backedUpBoms.length} BOM records from backup.`);

  // Verify current records
  const { data: currentBoms, error: fetchErr } = await supabaseAdmin.from('bom_orders').select('*');
  if (fetchErr || !currentBoms) throw new Error(`Failed to fetch current bom_orders: ${fetchErr?.message}`);

  console.log(`\nStep 2: Preparing restoration for ${backedUpBoms.length} affected BOMs...`);
  for (const backupBom of backedUpBoms) {
    const bomCode = backupBom.id || backupBom.bom_code;
    const current = currentBoms.find(b => (b.id || b.bom_code) === bomCode);
    console.log(`  • BOM ${bomCode}:`);
    console.log(`    - Has payment_proof_doc in backup: ${Boolean(backupBom.payment_proof_doc)}`);
    console.log(`    - Has delivery_address_proof_doc in backup: ${Boolean(backupBom.delivery_address_proof_doc)}`);
    console.log(`    - Has payments.proofDocObj in backup: ${Boolean(backupBom.payments?.proofDocObj)}`);

    if (isExecute) {
      // Restore record
      const { error: updateErr } = await supabaseAdmin
        .from('bom_orders')
        .update({
          payment_proof_doc: backupBom.payment_proof_doc,
          delivery_address_proof_doc: backupBom.delivery_address_proof_doc,
          payments: backupBom.payments,
          updated_at: new Date().toISOString()
        })
        .eq('id', bomCode);

      if (updateErr) throw new Error(`Failed to restore BOM ${bomCode}: ${updateErr.message}`);
      console.log(`    ✅ Successfully restored BOM ${bomCode} in public.bom_orders`);
    }
  }

  if (isExecute) {
    // Refresh memory cache
    try {
      await fetch('http://localhost:5001/api/boms?refresh=true');
      console.log('\n✅ Server cache refreshed.');
    } catch (_) {}
  }

  console.log('\n====================================================');
  console.log(`🎉 ROLLBACK ${isDryRun ? 'DRY RUN COMPLETED' : 'EXECUTED SUCCESSFULLY'}`);
  console.log('====================================================');
}

runRollback().catch(err => {
  console.error('\n❌ Rollback error:', err);
  process.exit(1);
});
