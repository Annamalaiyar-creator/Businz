#!/usr/bin/env node
/**
 * Standalone Backup Script for Control Room Enterprise ERP
 * Usage: npm run backup
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createFullBackup, listBackups } from '../server/backupEngine.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('====================================================');
console.log('🛡️  BUSINZ ERP - FULL DISASTER RECOVERY BACKUP');
console.log('====================================================');

(async () => {
  try {
    const result = await createFullBackup({
      supabaseClient: supabase,
      memoryStore: {},
      triggeredBy: 'CLI (npm run backup)'
    });

    console.log('----------------------------------------------------');
    console.log('🎉 BACKUP COMPLETED SUCCESSFULLY!');
    console.log(`📁 File:      ${result.filename}`);
    console.log(`📊 Records:   ${result.metadata.totalRecords}`);
    console.log(`📎 Media:     ${result.metadata.mediaCount} files (${result.metadata.mediaSizeFormatted})`);
    console.log(`📦 Total Size:${result.metadata.backupSizeFormatted}`);
    console.log('----------------------------------------------------');

    const all = listBackups();
    console.log(`Total snapshots in vault: ${all.length}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  }
})();
