#!/usr/bin/env node
/**
 * Standalone Backup Script for Control Room Enterprise ERP
 * Usage: npm run backup
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createFullBackup, listBackups } from '../server/backupEngine.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zjkabqcgymxysqgfbbge.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqa2FicWNneW14eXNxZ2ZiYmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyOTQzNzYsImV4cCI6MjEwMDg3MDM3Nn0.z821_dGCjnS_LZnj6l5mERGtu8wZvkMRDiGURXxFXmY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('====================================================');
console.log('🛡️  CONTROL ROOM ERP - FULL DISASTER RECOVERY BACKUP');
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
