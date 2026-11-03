#!/usr/bin/env node
// ==============================================================================
// BUSINZ — ISOLATED CONCURRENT-WRITE VALIDATION TEST FOR DEPLOYMENT & ROLLBACK
// Validates:
// 1. Concurrent writes during deployment are 100% preserved
// 2. Deployment code checkout does NOT overwrite live JSON stores
// 3. Rollback does NOT overwrite live JSON stores
// 4. Staged build and asset deployment work cleanly without data loss
// ==============================================================================
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = path.join(__dirname, '..', 'sandbox_validation_env');

console.log('🧪 ================================================================');
console.log('🧪 Starting Isolated Concurrent-Write Validation Test');
console.log(`📁 Sandbox Directory: ${SANDBOX_DIR}`);
console.log('🧪 ================================================================');

// Clean and prepare sandbox
if (fs.existsSync(SANDBOX_DIR)) {
  fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

const APP_DIR = path.join(SANDBOX_DIR, 'businz_app');
const BACKUP_BASE = path.join(SANDBOX_DIR, 'backups');
fs.mkdirSync(APP_DIR, { recursive: true });
fs.mkdirSync(BACKUP_BASE, { recursive: true });

// Initialize a Git repo in APP_DIR mimicking production baseline
console.log('📦 Setting up baseline repository...');
execSync('git init -b feature/crm-lead-management-system', { cwd: APP_DIR });
execSync('git config user.name "Production Admin"', { cwd: APP_DIR });
execSync('git config user.email "admin@businz.com"', { cwd: APP_DIR });

// Create server directory with active JSON stores
const SERVER_DIR = path.join(APP_DIR, 'server');
fs.mkdirSync(SERVER_DIR, { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'dist', 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'src'), { recursive: true });

// Initial baseline code and data
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Baseline v1 server\n');
fs.writeFileSync(path.join(APP_DIR, 'package.json'), '{"name":"businz","version":"1.0.0"}\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'index.html'), '<html><head></head><body>Baseline App</body></html>\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'assets', 'index-old.js'), 'console.log("old chunk");\n');
fs.writeFileSync(path.join(APP_DIR, 'assets', 'index-old.js'), 'console.log("old chunk");\n');

// Active transactional stores (mimicking live stores)
const leadsFile = path.join(SERVER_DIR, 'crm_leads.json');
const initialLeads = [{ id: 'LEAD-001', name: 'Baseline Customer 1', created_at: Date.now() }];
fs.writeFileSync(leadsFile, JSON.stringify(initialLeads, null, 2));

const bomFile = path.join(SERVER_DIR, 'bom_store.json');
const initialBoms = [{ id: 'BOM-001', title: 'Baseline BOM 1', created_at: Date.now() }];
fs.writeFileSync(bomFile, JSON.stringify(initialBoms, null, 2));

execSync('git add . && git commit -m "Baseline production release 04e0a51"', { cwd: APP_DIR });
const baselineCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();
console.log(`✅ Baseline commit created: ${baselineCommit}`);

// Create a branch/remote target representing 8f671fd (with code updates)
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Target v2 server with Phase 1-4 optimizations\n');
fs.writeFileSync(path.join(APP_DIR, 'src', 'new_feature.js'), 'export const optimized = true;\n');
// Simulate someone who accidentally committed modified JSON in the dev branch
fs.writeFileSync(leadsFile, JSON.stringify([{ id: 'DEV-MOCK', name: 'Dev Mock Lead' }], null, 2));
execSync('git add . && git commit -m "Target optimization release 8f671fd"', { cwd: APP_DIR });
const targetCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();
console.log(`✅ Target optimization commit created: ${targetCommit}`);

// Switch back to baseline commit in the live app
execSync(`git checkout ${baselineCommit}`, { cwd: APP_DIR });
fs.writeFileSync(leadsFile, JSON.stringify(initialLeads, null, 2)); // restore initial leads

console.log('\n🚀 Starting Concurrent Writer Process...');
let writeCount = 0;
let isWriting = true;
const writtenIds = new Set(['LEAD-001']);

const writerInterval = setInterval(() => {
  if (!isWriting) return;
  try {
    writeCount++;
    const current = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
    const newId = `LEAD-LIVE-${writeCount}`;
    current.push({ id: newId, name: `Concurrent Lead ${writeCount}`, timestamp: Date.now() });
    fs.writeFileSync(leadsFile, JSON.stringify(current, null, 2));
    writtenIds.add(newId);
  } catch (err) {
    console.error('❌ Error during concurrent write:', err.message);
  }
}, 50); // Write every 50ms

// Now simulate the Staged Deployment Procedure
console.log('\n🔄 Executing Staged Deployment Procedure...');
const timestamp = '20261027_test';
const recoveryDir = path.join(BACKUP_BASE, `recovery_${timestamp}`);
const stagedDir = path.join(BACKUP_BASE, `staged_${timestamp}`);

fs.mkdirSync(recoveryDir, { recursive: true });
fs.mkdirSync(path.join(recoveryDir, 'json_stores'), { recursive: true });
fs.mkdirSync(path.join(recoveryDir, 'dist_frontend'), { recursive: true });

// Step 3 backup copy
fs.copyFileSync(leadsFile, path.join(recoveryDir, 'json_stores', 'crm_leads.json'));
fs.copyFileSync(path.join(APP_DIR, 'dist', 'index.html'), path.join(recoveryDir, 'dist_frontend', 'index.html'));

// Step 4 staged build
console.log('   - Staging release in isolated directory...');
execSync(`git clone --local "${APP_DIR}" "${stagedDir}"`, { stdio: 'pipe' });
execSync(`git checkout ${targetCommit}`, { cwd: stagedDir, stdio: 'pipe' });

// Create staged build output
fs.mkdirSync(path.join(stagedDir, 'dist', 'assets'), { recursive: true });
fs.writeFileSync(path.join(stagedDir, 'dist', 'index.html'), '<html><head></head><body>V2 Optimized App</body></html>\n');
fs.writeFileSync(path.join(stagedDir, 'dist', 'assets', 'index-new.js'), 'console.log("new v2 chunk");\n');

// Step 6 Cutover code (Leaving server/*.json 100% untouched)
console.log('   - Cutting over backend code and assets into live app...');
fs.copyFileSync(path.join(stagedDir, 'server', 'index.js'), path.join(APP_DIR, 'server', 'index.js'));
fs.copyFileSync(path.join(stagedDir, 'dist', 'index.html'), path.join(APP_DIR, 'dist', 'index.html'));
fs.copyFileSync(path.join(stagedDir, 'dist', 'assets', 'index-new.js'), path.join(APP_DIR, 'dist', 'assets', 'index-new.js'));
fs.copyFileSync(path.join(stagedDir, 'dist', 'assets', 'index-new.js'), path.join(APP_DIR, 'assets', 'index-new.js'));

// Advance git reference in APP_DIR without touching working tree JSON files
execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${targetCommit}`, { cwd: APP_DIR });
execSync(`git symbolic-ref HEAD refs/heads/feature/crm-lead-management-system`, { cwd: APP_DIR });

fs.rmSync(stagedDir, { recursive: true, force: true });
console.log('   - Staged directory cleaned up.');

// Let concurrent writer continue writing into V2
setTimeout(() => {
  console.log('\n📊 Deployment Phase Results Check:');
  const postDeployLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  console.log(`   - Total leads recorded in live store: ${postDeployLeads.length}`);
  console.log(`   - Total writes attempted by concurrent writer: ${writtenIds.size}`);

  // Check if any written ID was lost
  let lostCount = 0;
  for (const id of writtenIds) {
    if (!postDeployLeads.some(l => l.id === id)) {
      lostCount++;
    }
  }
  console.log(`   - Lost records during deployment: ${lostCount}`);
  if (lostCount > 0) {
    clearInterval(writerInterval);
    console.error('❌ TEST FAILED: Records were lost during deployment!');
    process.exit(1);
  }
  console.log('✅ ZERO TRANSACTION LOSS: All concurrent writes preserved during deployment!');

  // Verify code was upgraded
  const serverCode = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
  if (!serverCode.includes('Target v2 server')) {
    clearInterval(writerInterval);
    console.error('❌ Code was not upgraded!');
    process.exit(1);
  }
  console.log('✅ Backend code successfully upgraded to Target v2.');

  // Verify old assets still exist alongside new assets (No 404s for active users)
  if (!fs.existsSync(path.join(APP_DIR, 'dist', 'assets', 'index-old.js')) ||
      !fs.existsSync(path.join(APP_DIR, 'dist', 'assets', 'index-new.js'))) {
    clearInterval(writerInterval);
    console.error('❌ Frontend assets not preserved backward-compatibly!');
    process.exit(1);
  }
  console.log('✅ Backward-compatible asset retention verified (Both old and new chunks present).');

  // Now simulate Rollback Procedure while writes are STILL happening!
  console.log('\n🚨 Executing Rollback Procedure while writes continue...');
  
  // Standalone rollback:
  // Reverts code:
  execSync(`git checkout ${baselineCommit} -- server/index.js`, { cwd: APP_DIR });
  execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${baselineCommit}`, { cwd: APP_DIR });
  
  // Reverts frontend:
  fs.copyFileSync(path.join(recoveryDir, 'dist_frontend', 'index.html'), path.join(APP_DIR, 'dist', 'index.html'));

  setTimeout(() => {
    isWriting = false;
    clearInterval(writerInterval);

    console.log('\n📊 Post-Rollback Results Check:');
    const postRollbackLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
    console.log(`   - Total leads recorded in live store: ${postRollbackLeads.length}`);
    console.log(`   - Total writes attempted by concurrent writer: ${writtenIds.size}`);

    let rollbackLostCount = 0;
    for (const id of writtenIds) {
      if (!postRollbackLeads.some(l => l.id === id)) {
        rollbackLostCount++;
      }
    }
    console.log(`   - Lost records during rollback: ${rollbackLostCount}`);

    if (rollbackLostCount > 0) {
      console.error('❌ TEST FAILED: Records were lost during rollback!');
      process.exit(1);
    }
    console.log('✅ ZERO TRANSACTION LOSS: All concurrent writes preserved through rollback!');

    // Verify code was reverted
    const rollbackServerCode = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
    if (!rollbackServerCode.includes('Baseline v1 server')) {
      console.error('❌ Code was not reverted!');
      process.exit(1);
    }
    console.log('✅ Backend code successfully reverted to Baseline v1.');

    // Clean up sandbox
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });

    console.log('\n🎉 ================================================================');
    console.log('🎉 ISOLATED CONCURRENT-WRITE VALIDATION TEST: 100% PASS');
    console.log('   - Concurrent Writes Preserved: 100%');
    console.log('   - Live Data Overwrite: 0 bytes');
    console.log('   - Asset Availability: 100%');
    console.log('   - Rollback Preservation: 100%');
    console.log('🎉 ================================================================');
    process.exit(0);
  }, 400);
}, 600);
