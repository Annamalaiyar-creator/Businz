import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_ID = Date.now();
const STAGING_DIR = `/tmp/businz_rehearsal_${TEST_ID}`;
const APP_DIR = path.join(STAGING_DIR, 'app');
const EXT_BASE = path.join(STAGING_DIR, 'ext');
const EXT_DATA_DIR = path.join(EXT_BASE, 'data');
const BACKUP_BASE = path.join(STAGING_DIR, 'backups');
const MANIFEST_FILE = path.join(BACKUP_BASE, 'deployment_manifest.json');

const REAL_BASELINE_COMMIT = 'f0ada49745d9fa1eceab4bf4dfa27ddb43f96eba';
const TARGET_RELEASE_COMMIT = 'dc3cede60613130f00bbca378a6434fb91ff04c7';
const PRODUCTION_PORT = 5001;

console.log('========================================================================');
console.log('🧪 STAGING REHEARSAL: COMPLETE DEPLOYMENT-TO-ROLLBACK CYCLE');
console.log('========================================================================');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// ----------------------------------------------------------------------
// 1. Setup Complete File Layout (33 Stores, Uploads, WhatsApp Sessions, .env)
// ----------------------------------------------------------------------
console.log('\n--- [PHASE 1] Initializing Real Production Staging Layout ---');

fs.mkdirSync(path.join(APP_DIR, 'server', 'uploads', 'bom-documents'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'server', 'wa_sessions', 'user_admin'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'server', '.wwebjs_auth', 'session'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'dist', 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'assets'), { recursive: true });
fs.mkdirSync(EXT_DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(EXT_BASE, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(EXT_BASE, 'wa_sessions'), { recursive: true });
fs.mkdirSync(BACKUP_BASE, { recursive: true });

// A. Uploads & Attachments
fs.writeFileSync(path.join(APP_DIR, 'server', 'uploads', 'sample_doc.pdf'), '%PDF-1.4 SAMPLE DOCUMENT');
fs.writeFileSync(path.join(APP_DIR, 'server', 'uploads', 'bom-documents', 'bom_proof_1.jpg'), 'JPEG_MOCK_DATA');

// B. WhatsApp Sessions & Credentials (including hidden dotfiles)
fs.writeFileSync(path.join(APP_DIR, 'server', 'wa_sessions', 'user_admin', 'creds.json'), JSON.stringify({ noiseKey: 'abc' }));
fs.writeFileSync(path.join(APP_DIR, 'server', '.wwebjs_auth', 'session', '.auth_token'), 'SECRET_TOKEN_DATA');

// C. Original Baseline .env
const originalEnvContent = `PORT=5001\nNODE_ENV=production\nBUSINZ_ADMIN_SECRET=prod_super_secret_key_2026\nDATABASE_URL=postgresql://postgres@localhost:5432/businz\n`;
fs.writeFileSync(path.join(APP_DIR, '.env'), originalEnvContent);

// D. Frontend baseline bundle
fs.writeFileSync(path.join(APP_DIR, 'dist', 'index.html'), '<!-- BASELINE DIST V1 (f0ada49) -->');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'assets', 'index-baseline.js'), 'console.log("Baseline JS");');
fs.writeFileSync(path.join(APP_DIR, 'assets', 'index-baseline.js'), 'console.log("Root Asset JS");');

// E. 33 JSON Stores
const REAL_VPS_33_STORES = [
  'bom_store.json', 'ceo_target_store.json', 'company_branding_store.json',
  'crm_customers.json', 'crm_leads.json', 'crm_opportunities.json',
  'crm_quotations.json', 'crm_whatsapp_conversations.json', 'customer_store.json',
  'dc_store.json', 'deleted_raw_materials_store.json', 'employees_store.json',
  'grn_store.json', 'invoice_store.json', 'item_store.json', 'media_cache.json',
  'notifications_store.json', 'package.json', 'payment_store.json', 'po_store.json',
  'presets_store.json', 'procurement_pi_store.json', 'proforma_invoice_store.json',
  'quotations_store.json', 'raw_materials_store.json', 'sales_pi_store.json',
  'vendor_store.json', 'vrm_prod_inventory.json', 'vrm_prod_ledger.json',
  'vrm_prod_recipes.json', 'vrm_prod_workorders.json', 'workorder_store.json',
  'oauth_session_store.json'
];

for (const store of REAL_VPS_33_STORES) {
  const p = path.join(APP_DIR, 'server', store);
  if (store === 'bom_store.json') {
    fs.writeFileSync(p, JSON.stringify([
      { id: 'BOM-659', bomCode: 'BOM-659', customerName: 'Teorainn Solar' },
      { id: 'VRM-BOM-2026-11', bomCode: 'VRM-BOM-2026-11', sourcePiNo: 'VRM-PI-2026-12' }
    ], null, 2));
  } else if (store === 'sales_pi_store.json') {
    fs.writeFileSync(p, JSON.stringify([
      { id: 'VRM-PI-2026-12', piNo: 'VRM-PI-2026-12', convertedBomCode: 'VRM-BOM-2026-11' }
    ], null, 2));
  } else if (store === 'package.json') {
    fs.writeFileSync(p, JSON.stringify({ name: 'businz-server', version: '1.0.0' }));
  } else {
    fs.writeFileSync(p, JSON.stringify([{ id: `INIT-${store}` }]));
  }
}
console.log('   ✅ Environment populated: 33 JSON stores, Uploads, WhatsApp sessions (with dotfiles), .env, Frontend.');

// ----------------------------------------------------------------------
// 2. Execute Deployment Phase (Backup, Seeding, Manifest)
// ----------------------------------------------------------------------
console.log('\n--- [PHASE 2] Simulating Deployment Procedure ---');
const recoveryDir = path.join(BACKUP_BASE, `recovery_${TEST_ID}`);
fs.mkdirSync(path.join(recoveryDir, 'json_stores'), { recursive: true });
fs.mkdirSync(path.join(recoveryDir, 'config'), { recursive: true });

// A. Verified Backup (NO silent error suppression, NO 2>/dev/null || true)
console.log('   Backing up uploads, WhatsApp sessions, and 33 stores...');
fs.cpSync(path.join(APP_DIR, 'server', 'uploads'), path.join(recoveryDir, 'uploads'), { recursive: true });
if (!fs.existsSync(path.join(recoveryDir, 'uploads', 'bom-documents', 'bom_proof_1.jpg'))) {
  throw new Error('FAIL: Upload backup verification failed');
}

fs.cpSync(path.join(APP_DIR, 'server', 'wa_sessions'), path.join(recoveryDir, 'wa_sessions'), { recursive: true });
fs.cpSync(path.join(APP_DIR, 'server', '.wwebjs_auth'), path.join(recoveryDir, '.wwebjs_auth'), { recursive: true });
if (!fs.existsSync(path.join(recoveryDir, '.wwebjs_auth', 'session', '.auth_token'))) {
  throw new Error('FAIL: Hidden WhatsApp auth dotfiles not backed up');
}

fs.copyFileSync(path.join(APP_DIR, '.env'), path.join(recoveryDir, 'config', '.env.bak'));
fs.cpSync(path.join(APP_DIR, 'dist'), path.join(recoveryDir, 'dist_frontend'), { recursive: true });
fs.cpSync(path.join(APP_DIR, 'assets'), path.join(recoveryDir, 'root_assets'), { recursive: true });

for (const s of REAL_VPS_33_STORES) {
  const src = path.join(APP_DIR, 'server', s);
  const dst = path.join(recoveryDir, 'json_stores', s);
  fs.copyFileSync(src, dst);
  if (sha256(src) !== sha256(dst)) throw new Error(`Backup hash mismatch: ${s}`);
}
console.log('   ✅ Verified complete backup: 33 JSON stores, uploads, WA sessions, .env, frontend.');

// B. Seeding to External Storage
console.log('   Seeding external persistent storage...');
for (const s of REAL_VPS_33_STORES) {
  const src = path.join(APP_DIR, 'server', s);
  const dst = path.join(EXT_DATA_DIR, s);
  fs.copyFileSync(src, dst);
  if (sha256(src) !== sha256(dst)) throw new Error(`External seed hash mismatch: ${s}`);
}

fs.cpSync(path.join(APP_DIR, 'server', 'uploads'), path.join(EXT_BASE, 'uploads'), { recursive: true });
fs.cpSync(path.join(APP_DIR, 'server', 'wa_sessions'), path.join(EXT_BASE, 'wa_sessions'), { recursive: true });
fs.cpSync(path.join(APP_DIR, 'server', '.wwebjs_auth'), path.join(EXT_BASE, 'wa_sessions', '.wwebjs_auth'), { recursive: true });

// C. Write Manifest
const manifest = {
  timestamp: new Date().toISOString(),
  recovery_dir: recoveryDir,
  release_commit: TARGET_RELEASE_COMMIT,
  baseline_commit: REAL_BASELINE_COMMIT,
  pm2_user: 'root',
  app_dir: APP_DIR,
  ext_base: EXT_BASE,
  ext_data_dir: EXT_DATA_DIR,
  expected_port: PRODUCTION_PORT,
  expected_stores: REAL_VPS_33_STORES
};
fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

// D. Release cutover simulation: update .env with external paths
fs.appendFileSync(path.join(APP_DIR, '.env'), `BUSINZ_DATA_DIR=${EXT_DATA_DIR}\nBUSINZ_MAINTENANCE_MODE=false\n`);

// Simulate new live business transactions created in external storage post-cutover
const liveBoms = JSON.parse(fs.readFileSync(path.join(EXT_DATA_DIR, 'bom_store.json'), 'utf8'));
liveBoms.push({ id: 'VRM-BOM-2026-LIVE-POST-CUTOVER-888', bomCode: 'VRM-BOM-2026-LIVE-POST-CUTOVER-888', status: 'Live' });
fs.writeFileSync(path.join(EXT_DATA_DIR, 'bom_store.json'), JSON.stringify(liveBoms, null, 2));
console.log('   ✅ Simulated new post-cutover live transaction: VRM-BOM-2026-LIVE-POST-CUTOVER-888');

// ----------------------------------------------------------------------
// 3. Execute Complete Rollback Rehearsal
// ----------------------------------------------------------------------
console.log('\n--- [PHASE 3] Executing Complete Rollback Rehearsal ---');

// A. Validate Manifest existence and parse expected stores
const readManifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
if (!readManifest.expected_stores || readManifest.expected_stores.length !== 33) {
  throw new Error('FAIL: Manifest does not contain all 33 expected stores');
}

// B. All-or-Nothing pre-validation of all 33 stores in external storage
let preValidationPassed = true;
for (const s of readManifest.expected_stores) {
  const extFile = path.join(readManifest.ext_data_dir, s);
  if (!fs.existsSync(extFile) || fs.statSync(extFile).size === 0) {
    preValidationPassed = false;
    break;
  }
  try {
    JSON.parse(fs.readFileSync(extFile, 'utf8'));
  } catch {
    preValidationPassed = false;
    break;
  }
}
if (!preValidationPassed) throw new Error('FAIL: Pre-validation of 33 stores failed');
console.log('   ✅ Pre-validation passed: 100% of 33 stores are non-zero and valid JSON.');

// C. Restore complete original .env (Requirement 3: strictly remove new release env vars)
fs.copyFileSync(path.join(readManifest.recovery_dir, 'config', '.env.bak'), path.join(APP_DIR, '.env'));
const restoredEnv = fs.readFileSync(path.join(APP_DIR, '.env'), 'utf8');
if (restoredEnv.includes('BUSINZ_DATA_DIR') || restoredEnv.includes('BUSINZ_MAINTENANCE_MODE')) {
  throw new Error('FAIL: Restored .env still contains new release environment variables');
}
if (!restoredEnv.includes('PORT=5001') || !restoredEnv.includes('BUSINZ_ADMIN_SECRET=prod_super_secret_key_2026')) {
  throw new Error('FAIL: Original .env configuration was not restored properly');
}
console.log('   ✅ Restored complete original .env. New release environment variables completely removed.');

// D. Restore frontend bundle
fs.rmSync(path.join(APP_DIR, 'dist'), { recursive: true });
fs.cpSync(path.join(readManifest.recovery_dir, 'dist_frontend'), path.join(APP_DIR, 'dist'), { recursive: true });
fs.cpSync(path.join(readManifest.recovery_dir, 'root_assets'), path.join(APP_DIR, 'assets'), { recursive: true });
console.log('   ✅ Restored baseline frontend bundle and root assets.');

// E. Reconcile all 33 stores into legacy server/ directory
for (const s of readManifest.expected_stores) {
  fs.copyFileSync(path.join(readManifest.ext_data_dir, s), path.join(APP_DIR, 'server', s));
}

// Reconcile uploads & WhatsApp sessions (preserving dotfiles)
fs.cpSync(path.join(readManifest.ext_base, 'uploads'), path.join(APP_DIR, 'server', 'uploads'), { recursive: true });
fs.cpSync(path.join(readManifest.ext_base, 'wa_sessions'), path.join(APP_DIR, 'server', 'wa_sessions'), { recursive: true });
if (fs.existsSync(path.join(readManifest.ext_base, 'wa_sessions', '.wwebjs_auth'))) {
  fs.cpSync(path.join(readManifest.ext_base, 'wa_sessions', '.wwebjs_auth'), path.join(APP_DIR, 'server', '.wwebjs_auth'), { recursive: true });
}
console.log('   ✅ Reconciled all 33 stores, uploads, and WhatsApp sessions (with dotfiles) into legacy paths.');

// F. Verify SHA256 Checksums
for (const s of readManifest.expected_stores) {
  const extHash = sha256(path.join(readManifest.ext_data_dir, s));
  const srvHash = sha256(path.join(APP_DIR, 'server', s));
  if (extHash !== srvHash) throw new Error(`Checksum mismatch on reconciled store: ${s}`);
}
console.log('   ✅ 100% SHA256 checksums verified identical on all 33 stores.');

// G. Verify post-cutover data survival in legacy path
const restoredBoms = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'server', 'bom_store.json'), 'utf8'));
const postCutoverFound = restoredBoms.some(b => b.id === 'VRM-BOM-2026-LIVE-POST-CUTOVER-888');
if (!postCutoverFound) throw new Error('FAIL: Post-cutover live transaction was lost!');
console.log('   ✅ Post-cutover live record (VRM-BOM-2026-LIVE-POST-CUTOVER-888) confirmed intact in legacy store.');

// H. Verify WhatsApp dotfile survival in legacy path
if (!fs.existsSync(path.join(APP_DIR, 'server', '.wwebjs_auth', 'session', '.auth_token'))) {
  throw new Error('FAIL: WhatsApp auth dotfile lost during rollback!');
}
console.log('   ✅ WhatsApp session credentials & dotfiles confirmed intact in legacy store.');

// Cleanup
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

console.log('\n========================================================================');
console.log('🎉 REHEARSAL SUCCESSFUL: DEPLOYMENT-TO-ROLLBACK CYCLE PASSED 100%!');
console.log('========================================================================\n');
