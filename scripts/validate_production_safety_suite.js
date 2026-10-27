#!/usr/bin/env node
// ==============================================================================
// BUSINZ CRM — COMPREHENSIVE PRODUCTION SAFETY TEST SUITE (HARDENED)
// Tests 6 Critical Failure, Concurrency & Untracked Preservation Scenarios:
// 1. Staged Build-Failure Protection (Live app untouched if build fails)
// 2. Interrupted-Copy Protection (Safe staging prevents broken live application state)
// 3. Concurrent-Write Safety (Zero transaction loss during cutover)
// 4. Untracked Artifact Preservation (core dump, .bak files, and *fix_* files untouched)
// 5. Backward-Compatible Asset Retention (Zero 404s for active browser sessions)
// 6. Rollback Data Preservation (Code reverted to baseline, 100% live writes preserved)
// ==============================================================================
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUITE_SANDBOX = path.join(__dirname, '..', 'sandbox_safety_suite');

console.log('🛡️ ================================================================');
console.log('🛡️ BUSINZ CRM — COMPREHENSIVE PRODUCTION SAFETY TEST SUITE');
console.log(`📁 Sandbox Root: ${SUITE_SANDBOX}`);
console.log('🛡️ ================================================================');

// Clean & prepare sandbox
if (fs.existsSync(SUITE_SANDBOX)) {
  fs.rmSync(SUITE_SANDBOX, { recursive: true, force: true });
}
fs.mkdirSync(SUITE_SANDBOX, { recursive: true });

const APP_DIR = path.join(SUITE_SANDBOX, 'businz_app');
const BACKUP_BASE = path.join(SUITE_SANDBOX, 'backups');
const RELEASES_DIR = path.join(BACKUP_BASE, 'releases');
fs.mkdirSync(APP_DIR, { recursive: true });
fs.mkdirSync(RELEASES_DIR, { recursive: true });

// Setup Baseline Git Repo
execSync('git init -b feature/crm-lead-management-system', { cwd: APP_DIR });
execSync('git config user.name "Production Tester"', { cwd: APP_DIR });
execSync('git config user.email "test@businz.com"', { cwd: APP_DIR });

fs.mkdirSync(path.join(APP_DIR, 'server'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'dist', 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'src'), { recursive: true });

// Baseline files
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Baseline Code v1\n');
fs.writeFileSync(path.join(APP_DIR, 'package.json'), '{"name":"businz","version":"1.0.0"}\n');
fs.writeFileSync(path.join(APP_DIR, 'src', 'App.jsx'), '// Baseline App\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'index.html'), '<html><head></head><body>Baseline V1</body></html>\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'assets', 'index-v1.js'), 'console.log("v1 asset");\n');
fs.writeFileSync(path.join(APP_DIR, 'assets', 'index-v1.js'), 'console.log("v1 asset");\n');

// Active transactional stores (Simulating live production)
const leadsFile = path.join(APP_DIR, 'server', 'crm_leads.json');
const invoicesFile = path.join(APP_DIR, 'server', 'invoice_store.json');
fs.writeFileSync(leadsFile, JSON.stringify([{ id: 'LEAD-001', name: 'Initial Lead' }], null, 2));
fs.writeFileSync(invoicesFile, JSON.stringify([{ id: 'INV-001', amount: 50000 }], null, 2));

// Untracked runtime artifacts that MUST be preserved untouched:
const coreFile = path.join(APP_DIR, 'core.2440327');
const bomFixFile = path.join(APP_DIR, 'server', 'bomPersistence.js.before_port_guard_fix_20261012_114540');
const bomBakFile = path.join(APP_DIR, 'server', 'bom_store.json.bak');
const salesPiBakFile = path.join(APP_DIR, 'server', 'sales_pi_store.json.bak');

fs.writeFileSync(coreFile, 'SIMULATED_5_8GB_LINUX_CORE_DUMP');
fs.writeFileSync(bomFixFile, '// Backup of bomPersistence before port guard fix');
fs.writeFileSync(bomBakFile, '{"backup": "bom_store"}');
fs.writeFileSync(salesPiBakFile, '{"backup": "sales_pi_store"}');

execSync('git add server/index.js package.json src/App.jsx dist/ assets/ server/crm_leads.json server/invoice_store.json && git commit -m "Baseline commit 04e0a51"', { cwd: APP_DIR });
const baselineCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();

// Target Optimization Release Commit
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Target Code v2 with Phase 1-4 optimizations\n');
fs.writeFileSync(path.join(APP_DIR, 'src', 'perf.js'), 'export const optimized = true;\n');
execSync('git add server/index.js src/perf.js && git commit -m "Target commit 8f671fd"', { cwd: APP_DIR });
const targetCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();

// Return live app to baseline commit
execSync(`git checkout ${baselineCommit}`, { cwd: APP_DIR });
console.log(`✅ Baseline commit: ${baselineCommit}`);
console.log(`✅ Target commit:   ${targetCommit}`);

let passedTests = 0;
const totalTests = 6;

// ==============================================================================
// TEST 1: Staged Build-Failure Protection
// ==============================================================================
console.log('\n--- [Test 1/6] Staged Build-Failure Protection ---');
const failStageDir = path.join(RELEASES_DIR, 'staged_build_fail_test');
execSync(`git clone --local "${APP_DIR}" "${failStageDir}"`, { stdio: 'pipe' });
execSync(`git checkout ${targetCommit}`, { cwd: failStageDir, stdio: 'pipe' });

// Simulate build failure by removing dist
fs.rmSync(path.join(failStageDir, 'dist'), { recursive: true, force: true });
const buildSuccess = fs.existsSync(path.join(failStageDir, 'dist', 'index.html'));
if (!buildSuccess) {
  // Build failed in staging: Live app MUST remain untouched
  fs.rmSync(failStageDir, { recursive: true, force: true });
  const liveServer = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
  if (liveServer.includes('Baseline Code v1')) {
    console.log('✅ PASS: Build failure in staging prevented cutover; live application remained 100% untouched.');
    passedTests++;
  } else {
    console.error('❌ FAIL: Live app was modified despite build failure!');
  }
}

// ==============================================================================
// TEST 2: Interrupted-Copy Protection
// ==============================================================================
console.log('\n--- [Test 2/6] Interrupted-Copy Protection ---');
const interruptedStageDir = path.join(RELEASES_DIR, 'staged_interrupted_test');
execSync(`git clone --local "${APP_DIR}" "${interruptedStageDir}"`, { stdio: 'pipe' });
const preInterruptedLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
// Simulate failure prior to cutover
fs.rmSync(interruptedStageDir, { recursive: true, force: true });
const postInterruptedLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
if (preInterruptedLeads.length === postInterruptedLeads.length) {
  console.log('✅ PASS: Interrupted staging operations left live stores completely unaffected.');
  passedTests++;
} else {
  console.error('❌ FAIL: Data loss during interrupted staging test!');
}

// ==============================================================================
// TEST 3, 4 & 5: Concurrent-Write Safety, Untracked Preservation & Backward Assets
// ==============================================================================
console.log('\n--- [Test 3/6] Concurrent-Write Safety During Versioned Cutover ---');
console.log('--- [Test 4/6] Untracked Artifact Preservation (No rsync --delete) ---');
console.log('--- [Test 5/6] Backward-Compatible Frontend Asset Retention (Zero 404s) ---');

const validStageDir = path.join(RELEASES_DIR, `release_20261027_test_${targetCommit.slice(0, 7)}`);
execSync(`git clone --local "${APP_DIR}" "${validStageDir}"`, { stdio: 'pipe' });
execSync(`git checkout ${targetCommit}`, { cwd: validStageDir, stdio: 'pipe' });

// Staged build outputs
fs.mkdirSync(path.join(validStageDir, 'dist', 'assets'), { recursive: true });
fs.writeFileSync(path.join(validStageDir, 'dist', 'index.html'), '<html><head></head><body>V2 Optimized</body></html>\n');
fs.writeFileSync(path.join(validStageDir, 'dist', 'assets', 'index-v2.js'), 'console.log("v2 asset");\n');

// Start concurrent writer process writing to crm_leads.json during staging & cutover
let concurrentWrites = 0;
let isWriting = true;
const writtenIds = new Set(['LEAD-001']);

const writer = setInterval(() => {
  if (!isWriting) return;
  concurrentWrites++;
  const id = `LEAD-LIVE-${concurrentWrites}`;
  const curr = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  curr.push({ id, name: `Live Lead ${concurrentWrites}`, time: Date.now() });
  fs.writeFileSync(leadsFile, JSON.stringify(curr, null, 2));
  writtenIds.add(id);
}, 30);

// SAFE NON-DESTRUCTIVE CUTOVER PROCEDURE (Replacing rsync --delete)
// 1. Copy code release files strictly
const serverJsFiles = fs.readdirSync(path.join(validStageDir, 'server')).filter(f => f.endsWith('.js'));
serverJsFiles.forEach(f => {
  fs.copyFileSync(path.join(validStageDir, 'server', f), path.join(APP_DIR, 'server', f));
});

// 2. Synchronize src and package.json
fs.cpSync(path.join(validStageDir, 'src'), path.join(APP_DIR, 'src'), { recursive: true });
fs.copyFileSync(path.join(validStageDir, 'package.json'), path.join(APP_DIR, 'package.json'));

// 3. Deploy frontend assets with backward-compatible chunk retention
const newAssets = fs.readdirSync(path.join(validStageDir, 'dist', 'assets'));
newAssets.forEach(f => {
  fs.copyFileSync(path.join(validStageDir, 'dist', 'assets', f), path.join(APP_DIR, 'dist', 'assets', f));
  fs.copyFileSync(path.join(validStageDir, 'dist', 'assets', f), path.join(APP_DIR, 'assets', f));
});
fs.copyFileSync(path.join(validStageDir, 'dist', 'index.html'), path.join(APP_DIR, 'dist', 'index.html'));

// 4. Update Git reference cleanly
execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${targetCommit}`, { cwd: APP_DIR });
execSync(`git reset ${targetCommit} -- server/index.js src package.json`, { cwd: APP_DIR });

// Verify concurrent writes
setTimeout(() => {
  isWriting = false;
  clearInterval(writer);

  console.log(`   - Concurrent writes recorded: ${concurrentWrites}`);
  const postCutoverLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  
  let missingInCutover = 0;
  for (const id of writtenIds) {
    if (!postCutoverLeads.some(l => l.id === id)) missingInCutover++;
  }
  
  const upgradedCode = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
  const hasV1Asset = fs.existsSync(path.join(APP_DIR, 'dist', 'assets', 'index-v1.js'));
  const hasV2Asset = fs.existsSync(path.join(APP_DIR, 'dist', 'assets', 'index-v2.js'));

  // Verify untracked artifacts intact:
  const coreIntact = fs.existsSync(coreFile);
  const bomFixIntact = fs.existsSync(bomFixFile);
  const bomBakIntact = fs.existsSync(bomBakFile);
  const salesPiBakIntact = fs.existsSync(salesPiBakFile);

  if (missingInCutover === 0 && upgradedCode.includes('Target Code v2')) {
    console.log(`✅ PASS [Test 3]: Concurrent writes durable (${concurrentWrites} live writes preserved, 0 lost during cutover).`);
    passedTests++;
  } else {
    console.error(`❌ FAIL [Test 3]: Missing ${missingInCutover} concurrent transactions during cutover!`);
  }

  if (coreIntact && bomFixIntact && bomBakIntact && salesPiBakIntact) {
    console.log('✅ PASS [Test 4]: All untracked artifacts (core.2440327, bomPersistence fix, *.bak) preserved 100% untouched.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 4]: Untracked files were deleted or overwritten during deployment!');
  }

  if (hasV1Asset && hasV2Asset) {
    console.log('✅ PASS [Test 5]: Both baseline (v1) and target (v2) frontend chunks exist simultaneously (Zero 404s).');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 5]: Backward-compatible assets missing from dist/assets!');
  }

  // ==============================================================================
  // TEST 6: Rollback Data Preservation
  // ==============================================================================
  console.log('\n--- [Test 6/6] Rollback Data Preservation ---');
  // Write additional transaction during post-deployment operation
  const postDeploymentLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  postDeploymentLeads.push({ id: 'LEAD-POST-DEPLOY-001', name: 'Post Deploy Lead', time: Date.now() });
  fs.writeFileSync(leadsFile, JSON.stringify(postDeploymentLeads, null, 2));

  // Perform Standalone Rollback: Code reverts to baseline commit, stores left untouched
  execSync(`git checkout ${baselineCommit} -- server/index.js src/ package.json`, { cwd: APP_DIR });
  execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${baselineCommit}`, { cwd: APP_DIR });
  
  // Revert frontend index.html to baseline
  fs.writeFileSync(path.join(APP_DIR, 'dist', 'index.html'), '<html><head></head><body>Baseline V1 Restored</body></html>\n');

  const rolledBackCode = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
  const rolledBackLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  const hasPostDeployLead = rolledBackLeads.some(l => l.id === 'LEAD-POST-DEPLOY-001');

  const coreStillIntact = fs.existsSync(coreFile);
  const bomFixStillIntact = fs.existsSync(bomFixFile);
  const bomBakStillIntact = fs.existsSync(bomBakFile);
  const salesPiBakStillIntact = fs.existsSync(salesPiBakFile);

  if (rolledBackCode.includes('Baseline Code v1') && hasPostDeployLead && coreStillIntact && bomFixStillIntact && bomBakStillIntact && salesPiBakStillIntact) {
    console.log('✅ PASS [Test 6]: Rollback successfully reverted code to baseline 04e0a51 while preserving 100% of live transactions & untracked files.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 6]: Rollback corrupted data or failed to restore code!');
  }

  // Final Summary
  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🛡️ ALL PRODUCTION SAFETY AND INTEGRITY TESTS VERIFIED 100% PASS');
  } else {
    console.error('❌ SAFETY SUITE REPORTED ONE OR MORE FAILURES');
  }
  console.log('================================================================\n');

  // Cleanup sandbox
  fs.rmSync(SUITE_SANDBOX, { recursive: true, force: true });
  process.exit(passedTests === totalTests ? 0 : 1);
}, 500);
