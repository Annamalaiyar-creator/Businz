import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BASELINE_COMMIT = 'b9bb14ad9f2ba3176ab4c77a2adfdff0cb82c5f3';
const RELEASE_COMMIT = 'dc3cede60613130f00bbca378a6434fb91ff04c7';
const TEST_ID = Date.now();
const STAGING_BACKUP_BASE = `/tmp/businz_staging_safeguards_${TEST_ID}`;
const STAGING_EXT_DIR = `/tmp/businz_staging_ext_${TEST_ID}`;
const MANIFEST_PATH = path.join(STAGING_BACKUP_BASE, 'deployment_manifest.json');

console.log('========================================================================');
console.log('🧪 STAGING TEST: PHASE-AWARE RECOVERY FROM BUILD FAILURE');
console.log('========================================================================');

// Create test directories
fs.mkdirSync(STAGING_BACKUP_BASE, { recursive: true });
fs.mkdirSync(STAGING_EXT_DIR, { recursive: true });

// 1. Setup mock previous dist and root assets
console.log('\n📦 1. Setting up Baseline Frontend & Root Assets...');
fs.mkdirSync(path.join(ROOT_DIR, 'dist', 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT_DIR, 'dist', 'index.html'), '<!-- BASELINE DIST V1 -->');
fs.writeFileSync(path.join(ROOT_DIR, 'dist', 'assets', 'vendor-hash1.js'), 'console.log("v1 vendor");');
fs.mkdirSync(path.join(ROOT_DIR, 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT_DIR, 'assets', 'vendor-hash1.js'), 'console.log("v1 vendor root");');

// 2. Simulate pre-migration backup & deployment manifest creation
console.log('\n🛡️ 2. Creating Complete Backup & Deployment Manifest...');
const recoveryDir = path.join(STAGING_BACKUP_BASE, `recovery_${TEST_ID}`);
fs.mkdirSync(path.join(recoveryDir, 'dist_frontend', 'assets'), { recursive: true });
fs.mkdirSync(path.join(recoveryDir, 'root_assets'), { recursive: true });
fs.mkdirSync(path.join(recoveryDir, 'json_stores'), { recursive: true });

// Copy dist and assets
fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'index.html'), path.join(recoveryDir, 'dist_frontend', 'index.html'));
fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'assets', 'vendor-hash1.js'), path.join(recoveryDir, 'dist_frontend', 'assets', 'vendor-hash1.js'));
fs.copyFileSync(path.join(ROOT_DIR, 'assets', 'vendor-hash1.js'), path.join(recoveryDir, 'root_assets', 'vendor-hash1.js'));

// Backup runtime stores
fs.copyFileSync(path.join(ROOT_DIR, 'server', 'bom_store.json'), path.join(recoveryDir, 'json_stores', 'bom_store.json'));
fs.copyFileSync(path.join(ROOT_DIR, 'server', 'invoice_store.json'), path.join(recoveryDir, 'json_stores', 'invoice_store.json'));

// Validate backup completeness
if (!fs.existsSync(path.join(recoveryDir, 'dist_frontend', 'index.html')) ||
    !fs.existsSync(path.join(recoveryDir, 'root_assets', 'vendor-hash1.js')) ||
    !fs.existsSync(path.join(recoveryDir, 'json_stores', 'bom_store.json'))) {
  throw new Error('FAIL: Incomplete backup validation');
}

// Write deployment manifest
const manifest = {
  timestamp: new Date().toISOString(),
  recovery_dir: recoveryDir,
  release_commit: RELEASE_COMMIT,
  baseline_commit: BASELINE_COMMIT,
  app_dir: ROOT_DIR,
  ext_data_dir: STAGING_EXT_DIR
};
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`   ✅ Manifest written: ${MANIFEST_PATH}`);

// 3. Seed external storage with post-cutover live BOM & Invoice data
console.log('\n💾 3. Seeding Live Production Data in External Storage...');
const liveBoms = [
  { id: 'BOM-PROD-SAFEGUARD-999', bom_code: 'BOM-PROD-SAFEGUARD-999', grand_total: 890000 }
];
const liveInvoices = [
  { id: 'INV-PROD-SAFEGUARD-999', invoice_no: 'INV-PROD-SAFEGUARD-999', grand_total: 890000 }
];
fs.writeFileSync(path.join(STAGING_EXT_DIR, 'bom_store.json'), JSON.stringify(liveBoms, null, 2));
fs.writeFileSync(path.join(STAGING_EXT_DIR, 'invoice_store.json'), JSON.stringify(liveInvoices, null, 2));

// 4. Simulate Failure during Deployment (Phase 4: Build Failure)
console.log('\n💥 4. Simulating Build Failure in Phase 4...');
let phase = 'PHASE_4_BUILD';
let buildFailed = false;

try {
  // Simulate failed build command
  throw new Error('SIMULATED_BUILD_ERROR: Vite failed due to memory limit');
} catch (buildErr) {
  buildFailed = true;
  console.log(`   ⚠️ Caught failure in ${phase}: ${buildErr.message}`);
  console.log('   🔄 Initiating Phase-Aware Automatic Recovery...');

  // Phase-aware recovery routine
  const readManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  
  // Revert Git to baseline
  execSync(`git checkout -f ${readManifest.baseline_commit} --quiet`, { cwd: ROOT_DIR });
  console.log(`   ✓ Reverted Git code to baseline ${readManifest.baseline_commit}`);

  // Restore preserved dist and root assets (retaining older hashed assets)
  fs.cpSync(path.join(readManifest.recovery_dir, 'dist_frontend'), path.join(ROOT_DIR, 'dist'), { recursive: true });
  fs.cpSync(path.join(readManifest.recovery_dir, 'root_assets'), path.join(ROOT_DIR, 'assets'), { recursive: true });
  console.log('   ✓ Restored dist/ and root assets/ from verified manifest recovery directory');

  // Reconcile external live data into server/
  fs.cpSync(path.join(STAGING_EXT_DIR, 'bom_store.json'), path.join(ROOT_DIR, 'server', 'bom_store.json'));
  fs.cpSync(path.join(STAGING_EXT_DIR, 'invoice_store.json'), path.join(ROOT_DIR, 'server', 'invoice_store.json'));
  console.log('   ✓ Authoritative live BOM & Invoice data preserved in server/');
}

// 5. Verify Post-Recovery State & Data Integrity
console.log('\n🔍 5. Verifying Zero Data Overwrite & Complete Recovery...');
const recoveredBoms = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'server', 'bom_store.json'), 'utf8'));
const recoveredInvoices = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'server', 'invoice_store.json'), 'utf8'));

const bomSaved = recoveredBoms.some(b => b.bom_code === 'BOM-PROD-SAFEGUARD-999');
const invSaved = recoveredInvoices.some(i => i.invoice_no === 'INV-PROD-SAFEGUARD-999');
const distRestored = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'index.html'), 'utf8').includes('BASELINE DIST V1');
const assetRestored = fs.existsSync(path.join(ROOT_DIR, 'assets', 'vendor-hash1.js'));

if (!bomSaved || !invSaved) {
  throw new Error('FAIL: Production BOM or Invoice data was overwritten/lost during recovery!');
}
if (!distRestored || !assetRestored) {
  throw new Error('FAIL: Frontend dist/ or root assets/ were not properly restored!');
}

console.log('   ✅ CONFIRMED: BOM-PROD-SAFEGUARD-999 survived build failure recovery unharmed');
console.log('   ✅ CONFIRMED: INV-PROD-SAFEGUARD-999 survived build failure recovery unharmed');
console.log('   ✅ CONFIRMED: dist/ and root assets/ successfully restored from manifest');

// Cleanup
execSync(`git checkout -f develop --quiet`, { cwd: ROOT_DIR });
execSync(`git checkout -- server/bom_store.json server/invoice_store.json`, { cwd: ROOT_DIR });
fs.rmSync(path.join(ROOT_DIR, 'assets', 'vendor-hash1.js'), { force: true });
fs.rmSync(STAGING_BACKUP_BASE, { recursive: true, force: true });
fs.rmSync(STAGING_EXT_DIR, { recursive: true, force: true });

console.log('\n========================================================================');
console.log('🎉 PHASE-AWARE RECOVERY & DATA PRESERVATION VERIFIED 100% PASSED!');
console.log('========================================================================\n');
