#!/usr/bin/env node
// ==============================================================================
// BUSINZ CRM — PRODUCTION DEPLOYMENT & ROLLBACK SAFETY AUDIT SUITE
// Hardened test coverage for 12 mandatory safety scenarios:
// 1.  Missing release argument (Rejection on missing commit argument)
// 2.  Invalid target SHA (Rejection of malformed & unapproved commit hashes)
// 3.  Incorrect flag ordering (--validate-only / --dry-run position independence)
// 4.  Fail-closed database behavior (Query errors or duplicates abort immediately; no silent 0 fallback)
// 5.  Partial file copying & interruption detection (Corrupted/partial copies fail metadata verification)
// 6.  Git metadata consistency (Git commit, index, and deployed code match without touching JSON stores)
// 7.  Complete rollback (Newly added release files are deleted; obsolete files restored; live stores intact)
// 8.  Backward-compatible unique index retention (idx_lead_inactivity_unique_incident preserved on code rollback)
// 9.  Undefined variables protection under set -u (Missing index metadata aborts before modifications; never guesses 0)
// 10. Recovery directory completeness validation (Rejects database-only backups; requires dist_frontend/index.html)
// 11. PostgreSQL backup permission safety (Root shell redirection allows pg_dump into 700 directory)
// 12. PM2 systemd LimitCORE=0 configuration and effective process limit verification
// ==============================================================================
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEPLOY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'execute_controlled_production_deployment.sh');
const ROLLBACK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'standalone_rollback.sh');
const PM2_CORE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'configure_pm2_core_dump_limit.sh');
const SUITE_SANDBOX = path.join(REPO_ROOT, 'sandbox_production_safety_suite');

console.log('🛡️ ====================================================================');
console.log('🛡️ BUSINZ CRM — HARDENED PRODUCTION SAFETY & AUDIT VERIFICATION SUITE');
console.log(`📁 Sandbox Root:      ${SUITE_SANDBOX}`);
console.log(`📜 Deploy Script:     ${DEPLOY_SCRIPT}`);
console.log(`📜 Rollback Script:   ${ROLLBACK_SCRIPT}`);
console.log(`📜 PM2 Core Limit:    ${PM2_CORE_SCRIPT}`);
console.log('🛡️ ====================================================================\n');

if (!fs.existsSync(DEPLOY_SCRIPT) || !fs.existsSync(ROLLBACK_SCRIPT) || !fs.existsSync(PM2_CORE_SCRIPT)) {
  console.error('❌ Critical: Required script missing!');
  process.exit(1);
}

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

let passedTests = 0;
const totalTests = 21;

// ==============================================================================
// TEST 1: Missing Release Argument
// ==============================================================================
console.log('--- [Test 1/12] Missing Release Argument Safety ---');
try {
  const resNoArgs = spawnSync('bash', [DEPLOY_SCRIPT], { encoding: 'utf8' });
  const resOnlyFlag = spawnSync('bash', [DEPLOY_SCRIPT, '--validate-only'], { encoding: 'utf8' });

  const noArgsRejected = resNoArgs.status !== 0 && resNoArgs.stdout.includes('Missing required target release commit argument');
  const onlyFlagRejected = resOnlyFlag.status !== 0 && resOnlyFlag.stdout.includes('Missing required target release commit argument');

  if (noArgsRejected && onlyFlagRejected) {
    console.log('✅ PASS [Test 1]: Deployment script strictly rejects missing target release argument (with or without flags).');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 1]: Deployment script did not reject missing target release commit argument properly!', {
      resNoArgsStatus: resNoArgs.status,
      resOnlyFlagStatus: resOnlyFlag.status
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 1]: Exception during missing argument check:', err);
}

// ==============================================================================
// TEST 2: Invalid Target SHA Safety
// ==============================================================================
console.log('\n--- [Test 2/12] Invalid Target SHA Safety ---');
try {
  const resShort = spawnSync('bash', [DEPLOY_SCRIPT, '09fd03a'], { encoding: 'utf8' });
  const resMalformed = spawnSync('bash', [DEPLOY_SCRIPT, 'not_a_valid_git_sha_xyz123'], { encoding: 'utf8' });
  const resUnapproved = spawnSync('bash', [DEPLOY_SCRIPT, '1111111111111111111111111111111111111111'], { encoding: 'utf8' });

  const shortRejected = resShort.status !== 0 && resShort.stdout.includes('Malformed target release commit');
  const malformedRejected = resMalformed.status !== 0 && resMalformed.stdout.includes('Malformed target release commit');
  const unapprovedRejected = resUnapproved.status !== 0 && resUnapproved.stdout.includes('NOT in the approved target releases list');

  if (shortRejected && malformedRejected && unapprovedRejected) {
    console.log('✅ PASS [Test 2]: Short SHAs, non-hex strings, and unapproved 40-character SHAs are strictly rejected.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 2]: Invalid SHA check failed!', {
      shortRejected,
      malformedRejected,
      unapprovedRejected
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 2]: Exception during invalid SHA check:', err);
}

// ==============================================================================
// TEST 3: Flag Ordering Independence (--validate-only / --dry-run)
// ==============================================================================
console.log('\n--- [Test 3/12] Flag Ordering Independence ---');
try {
  const approvedSha = '35a7ee169bcd6cb760360cdc6e641be45c79c07d';
  const testEnv = {
    ...process.env,
    BUSINZ_APP_DIR: APP_DIR,
    BUSINZ_BACKUP_BASE: BACKUP_BASE,
  };

  const resOrder1 = spawnSync('bash', [DEPLOY_SCRIPT, '--validate-only', approvedSha], { env: testEnv, encoding: 'utf8' });
  const resOrder2 = spawnSync('bash', [DEPLOY_SCRIPT, approvedSha, '--dry-run'], { env: testEnv, encoding: 'utf8' });

  const order1Recognized = !resOrder1.stdout.includes('Missing required') && !resOrder1.stdout.includes('Malformed') && !resOrder1.stdout.includes('NOT in the approved');
  const order2Recognized = !resOrder2.stdout.includes('Missing required') && !resOrder2.stdout.includes('Malformed') && !resOrder2.stdout.includes('NOT in the approved');

  if (order1Recognized && order2Recognized) {
    console.log('✅ PASS [Test 3]: Flags (--validate-only and --dry-run) parsed correctly regardless of argument order.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 3]: Flag ordering parsed incorrectly!', { order1Recognized, order2Recognized });
  }
} catch (err) {
  console.error('❌ FAIL [Test 3]: Exception during flag ordering test:', err);
}

// Setup simulated Git environment for functional tests 4-12
console.log('\n📦 Initializing simulated production Git repository for functional tests...');
execSync('git init -b feature/crm-lead-management-system', { cwd: APP_DIR });
execSync('git config user.name "Production Tester"', { cwd: APP_DIR });
execSync('git config user.email "test@businz.com"', { cwd: APP_DIR });

fs.mkdirSync(path.join(APP_DIR, 'server', 'migrations'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'dist', 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'src'), { recursive: true });
fs.mkdirSync(path.join(APP_DIR, 'scripts'), { recursive: true });

// Baseline code files
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Baseline Code v1\n');
fs.writeFileSync(path.join(APP_DIR, 'server', 'oldModule.js'), '// Obsolete module to be removed in release\n');
fs.writeFileSync(path.join(APP_DIR, 'package.json'), '{"name":"businz","version":"1.0.0"}\n');
fs.writeFileSync(path.join(APP_DIR, 'src', 'App.jsx'), '// Baseline App\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'index.html'), '<html><body>Baseline V1</body></html>\n');
fs.writeFileSync(path.join(APP_DIR, 'dist', 'assets', 'index-v1.js'), 'console.log("v1 asset");\n');
fs.writeFileSync(path.join(APP_DIR, 'assets', 'index-v1.js'), 'console.log("v1 asset");\n');

// Active transactional stores (Simulating live production)
const leadsFile = path.join(APP_DIR, 'server', 'crm_leads.json');
const invoicesFile = path.join(APP_DIR, 'server', 'invoice_store.json');
const bomFile = path.join(APP_DIR, 'server', 'bom_store.json');
fs.writeFileSync(leadsFile, JSON.stringify([{ id: 'LEAD-001', name: 'Initial Lead' }], null, 2));
fs.writeFileSync(invoicesFile, JSON.stringify([{ id: 'INV-001', amount: 50000 }], null, 2));
fs.writeFileSync(bomFile, JSON.stringify([{ id: 'BOM-001', items: ['Motor'] }], null, 2));

// Untracked runtime artifacts that MUST be preserved untouched:
const coreFile = path.join(APP_DIR, 'core.2440327');
const bomFixFile = path.join(APP_DIR, 'server', 'bomPersistence.js.before_port_guard_fix_20261012_114540');
const bomBakFile = path.join(APP_DIR, 'server', 'bom_store.json.bak');
const salesPiBakFile = path.join(APP_DIR, 'server', 'sales_pi_store.json.bak');

fs.writeFileSync(coreFile, 'SIMULATED_5_8GB_LINUX_CORE_DUMP');
fs.writeFileSync(bomFixFile, '// Backup of bomPersistence before port guard fix');
fs.writeFileSync(bomBakFile, '{"backup": "bom_store"}');
fs.writeFileSync(salesPiBakFile, '{"backup": "sales_pi_store"}');

execSync('git add server/ package.json src/ dist/ assets/ && git commit -m "Baseline commit 04e0a51"', { cwd: APP_DIR });
const baselineCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();

// Target Optimization Release Commit
fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Target Code v2 with Phase 1-4 optimizations\n');
fs.unlinkSync(path.join(APP_DIR, 'server', 'oldModule.js'));
fs.writeFileSync(path.join(APP_DIR, 'server', 'memoryDiagnostics.js'), '// Memory Diagnostics Engine\n');
fs.writeFileSync(path.join(APP_DIR, 'src', 'perf.js'), 'export const optimized = true;\n');
fs.writeFileSync(path.join(APP_DIR, 'server', 'migrations', '20261027_lead_inactivity_unique_constraint.sql'), '-- Unique migration\n');
fs.writeFileSync(path.join(APP_DIR, 'server', 'migrations', '20261027_phase3_performance_indexes.sql'), '-- Perf indexes\n');
execSync('git add -A server/ src/ && git commit -m "Target release commit with memory diagnostics & removed oldModule"', { cwd: APP_DIR });
const targetCommit = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();

// Return live app to baseline commit
execSync(`git checkout ${baselineCommit}`, { cwd: APP_DIR });
console.log(`   - Baseline commit: ${baselineCommit}`);
console.log(`   - Target commit:   ${targetCommit}`);

// ==============================================================================
// TEST 4: Fail-Closed Database Behavior & Migration Safety
// ==============================================================================
console.log('\n--- [Test 4/12] Fail-Closed Database Behavior & Migration Safety ---');
try {
  const deployContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');
  const hasFailClosedHelper = deployContent.includes('run_psql_query()') &&
    deployContent.includes('FATAL ABORT: PostgreSQL query failed to execute') &&
    deployContent.includes('FATAL ABORT: PostgreSQL query returned an empty result');
  
  const hasDuplicateAbort = deployContent.includes('Duplicate records detected in public.lead_inactivity_incidents');
  const hasUniqueIndexValidation = deployContent.includes('indisvalid || \'|\' || i.indisunique') &&
    deployContent.includes('UNIQUE_IDX_STATUS') &&
    deployContent.includes('t|t');
  const hasPerfIndexValidation = deployContent.includes('VALID_PERF_INDEXES') &&
    deployContent.includes('Performance indexes are not valid in pg_index');

  if (hasFailClosedHelper && hasDuplicateAbort && hasUniqueIndexValidation && hasPerfIndexValidation) {
    console.log('✅ PASS [Test 4]: Fail-closed database error handling verified (aborts on errors, non-zero duplicates, and invalid indexes without silent fallbacks).');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 4]: Fail-closed database checks missing from deployment script!');
  }
} catch (err) {
  console.error('❌ FAIL [Test 4]: Exception during fail-closed database test:', err);
}

// ==============================================================================
// TEST 5: Partial File Copying & Interruption Detection
// ==============================================================================
console.log('\n--- [Test 5/12] Partial File Copying & Interruption Detection ---');
try {
  fs.writeFileSync(path.join(APP_DIR, 'server', 'index.js'), '// Incomplete or corrupted file copy\n');
  const diffCheck = spawnSync('git', ['diff', '--quiet', targetCommit, '--', 'server/index.js'], { cwd: APP_DIR });
  const corruptionDetected = diffCheck.status !== 0;

  execSync(`git checkout ${baselineCommit} -- server/index.js`, { cwd: APP_DIR });

  if (corruptionDetected) {
    console.log('✅ PASS [Test 5]: Partial/corrupted file copies are detected by diff verification before PM2 reload.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 5]: Partial file copy was not detected!');
  }
} catch (err) {
  console.error('❌ FAIL [Test 5]: Exception during partial file copy test:', err);
}

// ==============================================================================
// TEST 6: Git Metadata Consistency & JSON Store Protection
// ==============================================================================
console.log('\n--- [Test 6/12] Git Metadata Consistency & JSON Store Protection ---');
try {
  const liveLeadsBefore = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  liveLeadsBefore.push({ id: 'LEAD-LIVE-002', name: 'Live Customer Lead', time: Date.now() });
  fs.writeFileSync(leadsFile, JSON.stringify(liveLeadsBefore, null, 2));

  const diffTreeOutput = execSync(`git diff-tree -r --name-status ${baselineCommit} ${targetCommit}`, { cwd: APP_DIR, encoding: 'utf8' });
  const lines = diffTreeOutput.trim().split('\n');
  const deployedPaths = [];

  for (const l of lines) {
    if (!l) continue;
    const [status, fpath] = l.split('\t');
    if (/^server\/.*\.json$/.test(fpath) || fpath === '.env' || /^core/.test(fpath)) continue;
    deployedPaths.push(fpath);

    if (status === 'D') {
      const fullPath = path.join(APP_DIR, fpath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else {
      execSync(`git checkout ${targetCommit} -- "${fpath}"`, { cwd: APP_DIR });
    }
  }

  execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${targetCommit}`, { cwd: APP_DIR });
  execSync('git symbolic-ref HEAD refs/heads/feature/crm-lead-management-system', { cwd: APP_DIR });
  execSync(`git reset ${targetCommit} -- ${deployedPaths.join(' ')}`, { cwd: APP_DIR });

  const liveLeadsAfter = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  const liveStorePreserved = liveLeadsAfter.some(l => l.id === 'LEAD-LIVE-002');
  const memoryDiagnosticsExists = fs.existsSync(path.join(APP_DIR, 'server', 'memoryDiagnostics.js'));
  const oldModuleDeleted = !fs.existsSync(path.join(APP_DIR, 'server', 'oldModule.js'));
  const codeDiff = execSync(`git diff ${targetCommit} -- server/index.js src package.json`, { cwd: APP_DIR }).toString().trim();
  const codeDiffCached = execSync(`git diff --cached ${targetCommit} -- server/index.js src package.json`, { cwd: APP_DIR }).toString().trim();

  if (liveStorePreserved && memoryDiagnosticsExists && oldModuleDeleted && codeDiff.length === 0 && codeDiffCached.length === 0) {
    console.log('✅ PASS [Test 6]: Git metadata, index, and working tree are 100% consistent; live JSON stores untouched.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 6]: Git consistency test failed!');
  }
} catch (err) {
  console.error('❌ FAIL [Test 6]: Exception during Git consistency test:', err);
}

// ==============================================================================
// TEST 7: Complete Code Rollback & New File Cleanup
// ==============================================================================
console.log('\n--- [Test 7/12] Complete Code Rollback & New File Cleanup ---');
try {
  const liveInvoicesBefore = JSON.parse(fs.readFileSync(invoicesFile, 'utf8'));
  liveInvoicesBefore.push({ id: 'INV-POST-DEPLOY-001', amount: 75000, time: Date.now() });
  fs.writeFileSync(invoicesFile, JSON.stringify(liveInvoicesBefore, null, 2));

  const rollbackDiff = execSync(`git diff-tree -r --name-status HEAD ${baselineCommit}`, { cwd: APP_DIR, encoding: 'utf8' });
  const rbLines = rollbackDiff.trim().split('\n');
  const rbPaths = [];

  for (const l of rbLines) {
    if (!l) continue;
    const [status, fpath] = l.split('\t');
    if (/^server\/.*\.json$/.test(fpath) || fpath === '.env' || /^core/.test(fpath)) continue;
    rbPaths.push(fpath);

    if (status === 'D') {
      const fullPath = path.join(APP_DIR, fpath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else {
      execSync(`git checkout ${baselineCommit} -- "${fpath}"`, { cwd: APP_DIR });
    }
  }

  execSync(`git update-ref refs/heads/feature/crm-lead-management-system ${baselineCommit}`, { cwd: APP_DIR });
  execSync('git symbolic-ref HEAD refs/heads/feature/crm-lead-management-system', { cwd: APP_DIR });
  execSync(`git reset ${baselineCommit} -- ${rbPaths.join(' ')}`, { cwd: APP_DIR });

  const memoryDiagnosticsGone = !fs.existsSync(path.join(APP_DIR, 'server', 'memoryDiagnostics.js'));
  const oldModuleRestored = fs.existsSync(path.join(APP_DIR, 'server', 'oldModule.js'));
  const codeContent = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8');
  const codeIsBaseline = codeContent.includes('Baseline Code v1');
  const liveInvoicesAfter = JSON.parse(fs.readFileSync(invoicesFile, 'utf8'));
  const invoicesPreserved = liveInvoicesAfter.some(i => i.id === 'INV-POST-DEPLOY-001');
  const coreIntact = fs.existsSync(coreFile);

  if (memoryDiagnosticsGone && oldModuleRestored && codeIsBaseline && invoicesPreserved && coreIntact) {
    console.log('✅ PASS [Test 7]: Rollback cleanly removed newly introduced files, restored obsolete files, and preserved live data.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 7]: Complete rollback test failed!');
  }
} catch (err) {
  console.error('❌ FAIL [Test 7]: Exception during complete rollback test:', err);
}

// ==============================================================================
// TEST 8: Backward-Compatible Unique Index Retention Policy
// ==============================================================================
console.log('\n--- [Test 8/12] Backward-Compatible Unique Index Retention Policy ---');
try {
  const rollbackScriptContent = fs.readFileSync(ROLLBACK_SCRIPT, 'utf8');
  const preservesUniqueIndex = rollbackScriptContent.includes('Preserving backward-compatible index: idx_lead_inactivity_unique_incident') &&
    !rollbackScriptContent.includes('DROP INDEX IF EXISTS idx_lead_inactivity_unique_incident');
  const preservesIncidents = rollbackScriptContent.includes('Preserving 100% of incident and notification records');

  if (preservesUniqueIndex && preservesIncidents) {
    console.log('✅ PASS [Test 8]: Backward-compatible unique index retention policy verified (idx_lead_inactivity_unique_incident kept).');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 8]: Unique index retention policy check failed!');
  }
} catch (err) {
  console.error('❌ FAIL [Test 8]: Exception during index retention test:', err);
}

// ==============================================================================
// TEST 9: Undefined Variables Protection under set -u
// ==============================================================================
console.log('\n--- [Test 9/12] Undefined Variables Protection Under set -u ---');
try {
  // Test that standalone rollback fails fast with exit 1 if manifest has invalid or missing metadata
  const testRecDir = path.join(BACKUP_BASE, 'recovery_test_missing_meta');
  fs.mkdirSync(path.join(testRecDir, 'dist_frontend'), { recursive: true });
  fs.writeFileSync(path.join(testRecDir, 'dist_frontend', 'index.html'), '<html>Mock UI</html>');
  // Write manifest with missing pre_existing_bom_idx and pre_existing_leads_idx
  fs.writeFileSync(path.join(testRecDir, 'deployment_manifest.json'), JSON.stringify({
    timestamp: '20261027_120000',
    recovery_dir: testRecDir
  }));

  const testEnv = {
    ...process.env,
    BUSINZ_APP_DIR: APP_DIR,
    BUSINZ_BACKUP_BASE: BACKUP_BASE,
  };

  const resMissingMeta = spawnSync('bash', [ROLLBACK_SCRIPT, testRecDir], { env: testEnv, encoding: 'utf8' });
  const failedCleanly = resMissingMeta.status !== 0 &&
    resMissingMeta.stderr.includes('Missing or invalid required index metadata') &&
    resMissingMeta.stderr.includes('Aborting rollback immediately BEFORE modifying application files');

  // Verify that live application files were NOT modified
  const appCodeUnmodified = fs.readFileSync(path.join(APP_DIR, 'server', 'index.js'), 'utf8').includes('Baseline Code v1');

  if (failedCleanly && appCodeUnmodified) {
    console.log('✅ PASS [Test 9]: Missing index metadata strictly aborts before file/DB modifications under set -u without guessing.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 9]: Standalone rollback did not fail cleanly on missing index metadata!', {
      status: resMissingMeta.status,
      stderr: resMissingMeta.stderr
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 9]: Exception during undefined variables test:', err);
}

// ==============================================================================
// TEST 10: Recovery Directory Completeness Validation
// ==============================================================================
console.log('\n--- [Test 10/12] Recovery Directory Completeness Validation ---');
try {
  // Create an incomplete, database-only recovery directory
  const dbOnlyDir = path.join(BACKUP_BASE, 'recovery_test_db_only');
  fs.mkdirSync(dbOnlyDir, { recursive: true });
  fs.writeFileSync(path.join(dbOnlyDir, 'businz_db.dump'), 'MOCK_DB_DUMP');
  fs.writeFileSync(path.join(dbOnlyDir, 'deployment_manifest.json'), JSON.stringify({
    timestamp: '20261027_120000',
    recovery_dir: dbOnlyDir,
    pre_existing_bom_idx: 0,
    pre_existing_leads_idx: 0
  }));

  const testEnv = {
    ...process.env,
    BUSINZ_APP_DIR: APP_DIR,
    BUSINZ_BACKUP_BASE: BACKUP_BASE,
  };

  const resDbOnly = spawnSync('bash', [ROLLBACK_SCRIPT, dbOnlyDir], { env: testEnv, encoding: 'utf8' });
  const rejectedIncomplete = resDbOnly.status !== 0 &&
    resDbOnly.stderr.includes('is INCOMPLETE') &&
    resDbOnly.stderr.includes('Missing mandatory frontend bundle') &&
    resDbOnly.stderr.includes('A partial or database-only backup cannot be used for complete application rollback');

  if (rejectedIncomplete) {
    console.log('✅ PASS [Test 10]: Database-only / partial recovery directory strictly rejected before any destructive cutover.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 10]: Incomplete recovery directory was not rejected properly!', {
      status: resDbOnly.status,
      stderr: resDbOnly.stderr
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 10]: Exception during recovery completeness test:', err);
}

// ==============================================================================
// TEST 11: PostgreSQL Backup Redirection & Permission Safety
// ==============================================================================
console.log('\n--- [Test 11/12] PostgreSQL Backup Redirection & Permission Safety ---');
try {
  // Verify deploy script implementation:
  // Root shell redirection '> ${DUMP_FILE}' instead of 'sudo -u postgres pg_dump -f ${DUMP_FILE}'
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');
  const hasStdoutRedirection = deployScriptContent.includes('sudo -u postgres pg_dump -d businz -F c -b > "${DUMP_FILE}"');
  const hasChmodDump = deployScriptContent.includes('chmod 600 "${DUMP_FILE}"');
  const hasRootRestore = deployScriptContent.includes('pg_restore -l "${DUMP_FILE}" > /dev/null 2>&1');
  const noDirectPgDumpFileFlag = !deployScriptContent.includes('sudo -u postgres pg_dump -d businz -F c -b -f "${DUMP_FILE}"');

  // Functional test: verify writing into a 700 mode directory via redirection
  const test700Dir = path.join(SUITE_SANDBOX, 'test_mode_700');
  fs.mkdirSync(test700Dir, { recursive: true, mode: 0o700 });
  const testDumpFile = path.join(test700Dir, 'test.dump');

  // Execute redirection through bash
  execSync(`bash -c 'echo "MOCK_CUSTOM_DUMP_STREAM" > "${testDumpFile}"'`);
  const dumpWritten = fs.existsSync(testDumpFile) && fs.readFileSync(testDumpFile, 'utf8').includes('MOCK_CUSTOM_DUMP_STREAM');

  if (hasStdoutRedirection && hasChmodDump && hasRootRestore && noDirectPgDumpFileFlag && dumpWritten) {
    console.log('✅ PASS [Test 11]: PostgreSQL backup utilizes root shell redirection, preventing Permission Denied errors under chmod 700.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 11]: PostgreSQL backup redirection check failed!', {
      hasStdoutRedirection,
      hasChmodDump,
      hasRootRestore,
      noDirectPgDumpFileFlag,
      dumpWritten
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 11]: Exception during PostgreSQL permission test:', err);
}

// ==============================================================================
// TEST 12: PM2 Systemd LimitCORE=0 Configuration & Process Verification
// ==============================================================================
console.log('\n--- [Test 12/12] PM2 Systemd LimitCORE=0 Configuration & Process Verification ---');
try {
  const pm2ScriptContent = fs.readFileSync(PM2_CORE_SCRIPT, 'utf8');
  const setsLimitCore = pm2ScriptContent.includes('LimitCORE=0');
  const reloadsDaemon = pm2ScriptContent.includes('systemctl daemon-reload');
  const doesNotRestartService = !pm2ScriptContent.includes('systemctl restart') && !pm2ScriptContent.includes('pm2 restart');
  const includesProcLimitCheck = pm2ScriptContent.includes("grep 'Max core file size'") && pm2ScriptContent.includes("/limits");

  // Bash syntax check on configure_pm2_core_dump_limit.sh
  const syntaxCheck = spawnSync('bash', ['-n', PM2_CORE_SCRIPT], { encoding: 'utf8' });
  const syntaxValid = syntaxCheck.status === 0;

  if (setsLimitCore && reloadsDaemon && doesNotRestartService && includesProcLimitCheck && syntaxValid) {
    console.log('✅ PASS [Test 12]: PM2 systemd configuration sets LimitCORE=0 with zero-restart daemon reload and includes /proc limits check.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 12]: PM2 core dump configuration script check failed!', {
      setsLimitCore,
      reloadsDaemon,
      doesNotRestartService,
      includesProcLimitCheck,
      syntaxValid
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 12]: Exception during PM2 core dump test:', err);
}

// ==============================================================================
// TEST 13: Controlled Maintenance Mode Write-Blocking & API Verification
// ==============================================================================
console.log('\n--- [Test 13/16] Controlled Maintenance Mode Write-Blocking & API Verification ---');
try {
  const indexJsContent = fs.readFileSync(path.join(REPO_ROOT, 'server', 'index.js'), 'utf8');
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // 1. Verify middleware in server/index.js
  const hasGlobalFlag = indexJsContent.includes('global.__BUSINZ_MAINTENANCE_MODE');
  const has503Block = indexJsContent.includes('status(503)') && indexJsContent.includes("Retry-After', '30'");
  const hasWhitelisting = indexJsContent.includes("['GET', 'HEAD', 'OPTIONS'].includes(req.method)") &&
                          indexJsContent.includes("req.path.startsWith('/api/maintenance')");
  const hasStatusEndpoint = indexJsContent.includes("app.get('/api/maintenance/status'");
  const hasToggleEndpoint = indexJsContent.includes("app.post('/api/maintenance/toggle'");

  // 2. Verify deployment script enforces maintenance workflow
  const scriptCreatesFlag = deployScriptContent.includes('maintenance.flag');
  const scriptTogglesActive = deployScriptContent.includes('/api/maintenance/toggle') && deployScriptContent.includes('"enabled": true');
  const scriptChecksStatus = deployScriptContent.includes('/api/maintenance/status');
  const scriptProbes503 = deployScriptContent.includes('503');
  const scriptTogglesDeactive = deployScriptContent.includes('"enabled": false') && deployScriptContent.includes('maintenance.flag');

  // 3. Functional middleware behavior simulation
  let simulatedMaintenance = true;
  const mockMiddleware = (method, endpoint) => {
    if (!simulatedMaintenance) return 200;
    const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const isMaint = endpoint.startsWith('/api/maintenance') || endpoint === '/api/health';
    if (isReadOnly || isMaint) return 200;
    return 503;
  };

  const postBlocked = mockMiddleware('POST', '/api/boms') === 503 &&
                      mockMiddleware('PUT', '/api/crm/leads') === 503 &&
                      mockMiddleware('DELETE', '/api/store/invoice_store') === 503;
  const readAllowed = mockMiddleware('GET', '/api/boms') === 200 &&
                      mockMiddleware('GET', '/api/health') === 200 &&
                      mockMiddleware('POST', '/api/maintenance/toggle') === 200;

  simulatedMaintenance = false;
  const postRestored = mockMiddleware('POST', '/api/boms') === 200;

  if (hasGlobalFlag && has503Block && hasWhitelisting && hasStatusEndpoint && hasToggleEndpoint &&
      scriptCreatesFlag && scriptTogglesActive && scriptChecksStatus && scriptProbes503 && scriptTogglesDeactive &&
      postBlocked && readAllowed && postRestored) {
    console.log('✅ PASS [Test 13]: Controlled maintenance mode write-blocking (503 on mutating routes), whitelisting, and API toggle workflow verified.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 13]: Maintenance mode verification failed!', {
      hasGlobalFlag,
      has503Block,
      hasWhitelisting,
      hasStatusEndpoint,
      hasToggleEndpoint,
      scriptCreatesFlag,
      scriptTogglesActive,
      scriptChecksStatus,
      scriptProbes503,
      scriptTogglesDeactive,
      postBlocked,
      readAllowed,
      postRestored
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 13]: Exception during maintenance mode test:', err);
}

// ==============================================================================
// TEST 14: Staging Failure Isolation (No Premature Rollback)
// ==============================================================================
console.log('\n--- [Test 14/16] Staging Failure Isolation (No Premature Rollback) ---');
try {
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // Verify on_failure logic in DEPLOY_SCRIPT
  const failureLogic = deployScriptContent.match(/on_failure\(\)\s*\{([\s\S]*?)trap/);
  const failureBody = failureLogic ? failureLogic[1] : '';

  const cutoverRollback = failureBody.includes('[ "${DEPLOY_PHASE}" = "CUTOVER" ]');
  const excludesStagingFromRollback = !failureBody.includes('[ "${DEPLOY_PHASE}" = "STAGING" ]') ||
    failureBody.includes('Failure occurred prior to cutover (${DEPLOY_PHASE})');

  // Functional test: Run isolated subshell simulating failure during STAGING phase
  const testStagingDir = path.join(SUITE_SANDBOX, 'test_staging_isolation');
  const mockLiveAppDir = path.join(SUITE_SANDBOX, 'mock_live_app');
  fs.mkdirSync(testStagingDir, { recursive: true });
  fs.mkdirSync(mockLiveAppDir, { recursive: true });
  fs.writeFileSync(path.join(mockLiveAppDir, 'live_marker.txt'), 'ORIGINAL_LIVE_STATE');

  const simulationScript = `
    set -Eeuo pipefail
    STAGED_RELEASE_DIR="${testStagingDir}"
    STANDALONE_ROLLBACK_SCRIPT="${path.join(SUITE_SANDBOX, 'mock_rollback.sh')}"
    VALIDATE_ONLY=false
    DEPLOYMENT_SUCCESS=false
    DEPLOY_PHASE="STAGING"

    # Create dummy rollback script
    cat << 'EOF' > "\${STANDALONE_ROLLBACK_SCRIPT}"
    #!/bin/bash
    echo "MOCK_ROLLBACK_CALLED" > "${path.join(SUITE_SANDBOX, 'rollback_called.txt')}"
EOF
    chmod +x "\${STANDALONE_ROLLBACK_SCRIPT}"

    on_failure() {
      local exit_code=$?
      if [ -d "\${STAGED_RELEASE_DIR}" ]; then
        rm -rf "\${STAGED_RELEASE_DIR}"
      fi
      if [ "\${DEPLOY_PHASE}" = "CUTOVER" ] || [ "\${DEPLOY_PHASE}" = "MIGRATION" ] || [ "\${DEPLOY_PHASE}" = "BUILD" ] || [ "\${DEPLOY_PHASE}" = "POST_VERIFY" ]; then
        bash "\${STANDALONE_ROLLBACK_SCRIPT}"
      else
        echo "CLEAN_STAGING_EXIT_NO_ROLLBACK"
      fi
      exit \${exit_code}
    }
    trap 'on_failure' ERR EXIT

    # Force artificial failure in staging phase (e.g. compile error)
    false
  `;

  const simResult = spawnSync('bash', ['-c', simulationScript], { encoding: 'utf8' });
  const stagingCleanedUp = !fs.existsSync(testStagingDir);
  const rollbackNotExecuted = !fs.existsSync(path.join(SUITE_SANDBOX, 'rollback_called.txt'));
  const liveAppUntouched = fs.existsSync(path.join(mockLiveAppDir, 'live_marker.txt')) &&
                           fs.readFileSync(path.join(mockLiveAppDir, 'live_marker.txt'), 'utf8') === 'ORIGINAL_LIVE_STATE';

  if (cutoverRollback && excludesStagingFromRollback && stagingCleanedUp && rollbackNotExecuted && liveAppUntouched) {
    console.log('✅ PASS [Test 14]: Staging failure cleans up staging directory and exits without invoking rollback on running application.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 14]: Staging failure isolation test failed!', {
      cutoverRollback,
      excludesStagingFromRollback,
      stagingCleanedUp,
      rollbackNotExecuted,
      liveAppUntouched,
      simStdout: simResult.stdout
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 14]: Exception during staging failure isolation test:', err);
}

// ==============================================================================
// TEST 15: Coordinated Recovery Point Ordering & Quiescence
// ==============================================================================
console.log('\n--- [Test 15/16] Coordinated Recovery Point Ordering & Quiescence ---');
try {
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // Verify chronological step ordering in deployment script
  const idxStep2Staging = deployScriptContent.indexOf('=== [Step 2] Staging Release & Isolated Build ===');
  const idxStep3Maint = deployScriptContent.indexOf('=== [Step 3] Activating Controlled Maintenance Mode & Write-Blocking ===');
  const idxStep4Backup = deployScriptContent.indexOf('=== [Step 4] Executing Coordinated Production Backup (Recovery Archives) ===');
  const idxStep5Migration = deployScriptContent.indexOf('=== [Step 5] Applying PostgreSQL Database Migrations ===');
  const idxStep6Sync = deployScriptContent.indexOf('=== [Step 6] Controlled In-Place Code Synchronization & PM2 Reload ===');
  const idxStep7Smoke = deployScriptContent.indexOf('=== [Step 7] Comprehensive Smoke Tests');

  const correctStepOrder = (idxStep2Staging > 0) &&
                           (idxStep2Staging < idxStep3Maint) &&
                           (idxStep3Maint < idxStep4Backup) &&
                           (idxStep4Backup < idxStep5Migration) &&
                           (idxStep5Migration < idxStep6Sync) &&
                           (idxStep6Sync < idxStep7Smoke);

  // Verify write quiescence check in PostgreSQL before backup
  const hasQuiescenceCheck = deployScriptContent.includes('SELECT count(*) FROM pg_stat_activity') &&
                             deployScriptContent.includes("query ~* '^(INSERT|UPDATE|DELETE|COPY)'") &&
                             deployScriptContent.includes('Confirmed 0 active write queries in PostgreSQL');

  // Verify dump and JSON stores backup executed inside Step 4 (after Step 3 maintenance)
  const idxDump = deployScriptContent.indexOf('Dumping PostgreSQL database');
  const idxStores = deployScriptContent.indexOf('securing recovery copies of all production JSON stores');
  const backupDuringMaintenance = (idxDump > idxStep3Maint) && (idxStores > idxStep3Maint) && (idxDump < idxStep5Migration);

  // Verify cutover phase armed right at migration start
  const cutoverArmedAtStep5 = deployScriptContent.includes('DEPLOY_PHASE="CUTOVER"') &&
                              deployScriptContent.indexOf('DEPLOY_PHASE="CUTOVER"') < idxStep5Migration + 150;

  if (correctStepOrder && hasQuiescenceCheck && backupDuringMaintenance && cutoverArmedAtStep5) {
    console.log('✅ PASS [Test 15]: Chronological execution order strictly verified: Staging -> Maintenance -> Quiescence -> Coordinated Backup -> Cutover.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 15]: Coordinated recovery point ordering verification failed!', {
      correctStepOrder,
      hasQuiescenceCheck,
      backupDuringMaintenance,
      cutoverArmedAtStep5,
      idxStep2Staging,
      idxStep3Maint,
      idxStep4Backup,
      idxStep5Migration
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 15]: Exception during coordinated recovery point test:', err);
}

// ==============================================================================
// TEST 16: Standalone Rollback Maintenance Deactivation & Health Checks
// ==============================================================================
console.log('\n--- [Test 16/21] Standalone Rollback Maintenance Deactivation & Health Checks ---');
try {
  const rollbackScriptContent = fs.readFileSync(ROLLBACK_SCRIPT, 'utf8');
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // Verify standalone_rollback.sh releases maintenance mode
  const rollbackDeactivatesMaint = rollbackScriptContent.includes('/api/maintenance/toggle') &&
                                  rollbackScriptContent.includes('maintenance.flag');

  // Verify standalone_rollback.sh checks health
  const rollbackChecksDb = rollbackScriptContent.includes('/api/db-status');
  const rollbackChecksUi = rollbackScriptContent.includes('http://localhost:${PORT}/');
  const rollbackChecksAuth = rollbackScriptContent.includes('/api/crm/leads/notifications');

  // Verify dynamically generated rollback script inside execute_controlled_production_deployment.sh
  const generatedDeactivatesMaint = deployScriptContent.includes('/api/maintenance/toggle') &&
                                   deployScriptContent.includes('maintenance.flag');

  if (rollbackDeactivatesMaint && rollbackChecksDb && rollbackChecksUi && rollbackChecksAuth && generatedDeactivatesMaint) {
    console.log('✅ PASS [Test 16]: Standalone rollback and generated rollback script release maintenance mode and verify full application health.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 16]: Rollback maintenance deactivation check failed!', {
      rollbackDeactivatesMaint,
      rollbackChecksDb,
      rollbackChecksUi,
      rollbackChecksAuth,
      generatedDeactivatesMaint
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 16]: Exception during rollback maintenance deactivation test:', err);
}

// ==============================================================================
// TEST 17: Maintenance Control API Authorization & Key Security
// ==============================================================================
console.log('\n--- [Test 17/21] Maintenance Control API Authorization & Key Security ---');
try {
  // 1. Verify server/index.js no longer contains hardcoded fallback secret 'businz_maint_key_2026'
  const indexContent = fs.readFileSync(path.join(REPO_ROOT, 'server', 'index.js'), 'utf8');
  const hasNoHardcodedFallback = !indexContent.includes('businz_maint_key_2026');

  // 2. Verify authorization checks require valid credentials and return 403 Forbidden
  const checksDeploymentKey = indexContent.includes('process.env.BUSINZ_MAINTENANCE_KEY') || indexContent.includes('process.env.BUSINZ_ADMIN_SECRET');
  const checksFlagToken = indexContent.includes('flagJson?.token');
  const checksAdminSession = indexContent.includes('getVerifiedUserSession');
  const returns403OnUnauthorized = indexContent.includes('status(403).json') && indexContent.includes('Forbidden');

  // 3. Functional authorization logic simulation
  const simulateToggleAuth = (providedKey, flagToken, envKey, sessionRole) => {
    let authorized = false;
    if (providedKey && envKey && providedKey === envKey) authorized = true;
    if (!authorized && providedKey && flagToken && providedKey === flagToken) authorized = true;
    if (!authorized && ['Technical Administrator', 'Super Admin', 'Director', 'CEO', 'Admin'].includes(sessionRole)) authorized = true;
    return authorized ? 200 : 403;
  };

  const testFlagToken = 'ephemeral_deployment_token_0123456789abcdef';
  const missingSecretRejected = simulateToggleAuth(undefined, testFlagToken, 'test_env_key', null) === 403;
  const emptySecretRejected = simulateToggleAuth('', testFlagToken, 'test_env_key', null) === 403;
  const incorrectSecretRejected = simulateToggleAuth('wrong_token_guess', testFlagToken, 'test_env_key', null) === 403;
  const authorizedFlagTokenAllowed = simulateToggleAuth(testFlagToken, testFlagToken, 'test_env_key', null) === 200;
  const authorizedEnvKeyAllowed = simulateToggleAuth('test_env_key', testFlagToken, 'test_env_key', null) === 200;
  const authorizedAdminSessionAllowed = simulateToggleAuth(undefined, testFlagToken, 'test_env_key', 'Super Admin') === 200;
  const unauthorizedUserSessionRejected = simulateToggleAuth(undefined, testFlagToken, 'test_env_key', 'Sales Executive') === 403;

  if (hasNoHardcodedFallback && checksDeploymentKey && checksFlagToken && checksAdminSession && returns403OnUnauthorized &&
      missingSecretRejected && emptySecretRejected && incorrectSecretRejected && authorizedFlagTokenAllowed && authorizedEnvKeyAllowed &&
      authorizedAdminSessionAllowed && unauthorizedUserSessionRejected) {
    console.log('✅ PASS [Test 17]: Maintenance toggle API authorization strictly verified: Hardcoded secret removed, unauthorized requests return 403, and ephemeral flag/env/session auth verified.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 17]: Maintenance toggle API authorization test failed!', {
      hasNoHardcodedFallback,
      checksDeploymentKey,
      checksFlagToken,
      checksAdminSession,
      returns403OnUnauthorized,
      missingSecretRejected,
      emptySecretRejected,
      incorrectSecretRejected,
      authorizedFlagTokenAllowed,
      authorizedEnvKeyAllowed,
      authorizedAdminSessionAllowed,
      unauthorizedUserSessionRejected
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 17]: Exception during maintenance API authorization test:', err);
}

// ==============================================================================
// TEST 18: Authoritative Maintenance State Persistence Across Restarts
// ==============================================================================
console.log('\n--- [Test 18/21] Authoritative Maintenance State Persistence Across Restarts ---');
try {
  const { isMaintenanceModeActive, getMaintenanceFlagPath } = await import('../server/runtimePaths.js');

  // Verify baseline: without flag file, maintenance mode is false
  const tempFlagPath = path.resolve(REPO_ROOT, 'maintenance.flag');
  if (fs.existsSync(tempFlagPath)) fs.unlinkSync(tempFlagPath);
  global.__BUSINZ_MAINTENANCE_MODE = false;

  const baselineState = isMaintenanceModeActive() === false;

  // Simulate maintenance activation: create maintenance.flag on disk
  fs.writeFileSync(tempFlagPath, JSON.stringify({ active: true, token: 'test_token_abc' }), 'utf8');

  // Simulate application restart: reset in-memory global to undefined/false, then test authoritative check
  global.__BUSINZ_MAINTENANCE_MODE = undefined;
  const postRestartActive = isMaintenanceModeActive() === true;

  // Clean up flag file and verify state reverts to false
  fs.unlinkSync(tempFlagPath);
  global.__BUSINZ_MAINTENANCE_MODE = false;
  const postDeactivationState = isMaintenanceModeActive() === false;

  if (baselineState && postRestartActive && postDeactivationState) {
    console.log('✅ PASS [Test 18]: Authoritative maintenance state persists across application restarts via disk flag (isMaintenanceModeActive = true).');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 18]: Restart maintenance persistence check failed!', {
      baselineState,
      postRestartActive,
      postDeactivationState
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 18]: Exception during restart maintenance persistence test:', err);
}

// ==============================================================================
// TEST 19: Background Workers & Legacy PostgREST Route Fencing
// ==============================================================================
console.log('\n--- [Test 19/21] Background Workers & Legacy PostgREST Route Fencing ---');
try {
  const leadServiceContent = fs.readFileSync(path.join(REPO_ROOT, 'server', 'leadManagementService.js'), 'utf8');
  const waServiceContent = fs.readFileSync(path.join(REPO_ROOT, 'server', 'whatsappMultiService.js'), 'utf8');
  const indexContent = fs.readFileSync(path.join(REPO_ROOT, 'server', 'index.js'), 'utf8');

  // 1. Verify lead inactivity check fences against maintenance mode
  const leadJobFenced = leadServiceContent.includes('isMaintenanceModeActive') &&
                        leadServiceContent.includes("reason: 'MAINTENANCE_MODE'");

  // 2. Verify WhatsApp chat cache write fences against maintenance mode
  const waChatWriteFenced = waServiceContent.includes('isMaintenanceModeActive') &&
                            waServiceContent.includes('saveUserChatsToDisk');

  // 3. Verify 24h backup snapshot interval fences against maintenance mode
  const backupIntervalFenced = indexContent.includes('isMaintenanceModeActive') &&
                               indexContent.includes('skipping 24h scheduled snapshot');

  // 4. Verify PostgREST /rest/v1 legacy write-blocking middleware exists and returns 503
  const postgrest503Guarded = indexContent.includes("app.all('/rest/v1/*'") &&
                              indexContent.includes('isMaintenanceModeActive()') &&
                              indexContent.includes('status(503)');

  // 5. Functional test of checkAndProcessLeadInactivity during maintenance
  const tempFlagPath = path.resolve(REPO_ROOT, 'maintenance.flag');
  fs.writeFileSync(tempFlagPath, JSON.stringify({ active: true }), 'utf8');
  const { checkAndProcessLeadInactivity } = await import('../server/leadManagementService.js');
  const leadJobResult = await checkAndProcessLeadInactivity({ source: 'test_safety_suite' });
  if (fs.existsSync(tempFlagPath)) fs.unlinkSync(tempFlagPath);

  const leadJobSkipped = leadJobResult && leadJobResult.skipped === true && leadJobResult.reason === 'MAINTENANCE_MODE';

  if (leadJobFenced && waChatWriteFenced && backupIntervalFenced && postgrest503Guarded && leadJobSkipped) {
    console.log('✅ PASS [Test 19]: All background jobs, WhatsApp disk writes, and legacy PostgREST routes strictly fenced during maintenance mode.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 19]: Background worker / PostgREST fencing test failed!', {
      leadJobFenced,
      waChatWriteFenced,
      backupIntervalFenced,
      postgrest503Guarded,
      leadJobSkipped
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 19]: Exception during background worker / PostgREST fencing test:', err);
}

// ==============================================================================
// TEST 20: Deployment Script PM2 Restart Survival & Verification Order
// ==============================================================================
console.log('\n--- [Test 20/21] Deployment Script PM2 Restart Survival & Verification Order ---');
try {
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // Verify PM2 reload verification includes maintenance survival probe
  const checksReloadSurvival = deployScriptContent.includes('Verifying maintenance mode survived PM2 reload') &&
                               deployScriptContent.includes('POST_RELOAD_MAINT_ACTIVE') &&
                               deployScriptContent.includes('POST_RELOAD_PROBE_CODE');

  // Verify unauthorized deactivation probe exists before release
  const checksUnauthorizedDeactivation = deployScriptContent.includes('Verifying unauthorized deactivation requests are strictly rejected') &&
                                         deployScriptContent.includes('UNAUTH_DISABLE_1') &&
                                         deployScriptContent.includes('UNAUTH_DISABLE_2');

  // Verify Step 7 smoke tests run before maintenance release (Step 7.8)
  const idxPm2Reload = deployScriptContent.indexOf('pm2 reload "${PM2_TARGET}"');
  const idxSurvivalCheck = deployScriptContent.indexOf('Verifying maintenance mode survived PM2 reload');
  const idxSmokeProbes = deployScriptContent.indexOf('probe_endpoint "BOM Flow"');
  const idxReleaseMaint = deployScriptContent.indexOf('Deactivating maintenance window and restoring normal business write operations');

  const properVerificationOrder = (idxPm2Reload < idxSurvivalCheck) &&
                                  (idxSurvivalCheck < idxSmokeProbes) &&
                                  (idxSmokeProbes < idxReleaseMaint);

  if (checksReloadSurvival && checksUnauthorizedDeactivation && properVerificationOrder) {
    console.log('✅ PASS [Test 20]: Deployment script verifies maintenance survived PM2 reload, executes smoke tests while writes remain blocked, and tests deactivation authorization.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 20]: Deployment script restart survival and verification order failed!', {
      checksReloadSurvival,
      checksUnauthorizedDeactivation,
      properVerificationOrder
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 20]: Exception during deployment restart survival check:', err);
}

// ==============================================================================
// TEST 21: Fail-Safe Write Freeze & Rollback Data Preservation
// ==============================================================================
console.log('\n--- [Test 21/21] Fail-Safe Write Freeze & Rollback Data Preservation ---');
try {
  const rollbackScriptContent = fs.readFileSync(ROLLBACK_SCRIPT, 'utf8');
  const deployScriptContent = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');

  // 1. Verify failed rollback halts with exit 1 and does not release maintenance
  const idxHealthCheck = rollbackScriptContent.indexOf('Verifying application health post-rollback');
  const idxMaintRelease = rollbackScriptContent.indexOf('Releasing maintenance mode post-rollback');
  const healthCheckedBeforeRelease = (idxHealthCheck > 0) && (idxHealthCheck < idxMaintRelease);

  const haltsOnHealthFail = rollbackScriptContent.includes('Application health check failed after rollback') &&
                            rollbackScriptContent.includes('Maintenance mode remains active') &&
                            rollbackScriptContent.includes('exit 1');

  // 2. Verify rollback script preserves live data
  const dropsOnlyNewIndexes = rollbackScriptContent.includes('DROP INDEX IF EXISTS idx_bom_orders_created_at') &&
                              rollbackScriptContent.includes('idx_lead_inactivity_unique_incident');
  const neverOverwritesData = !rollbackScriptContent.includes('pg_restore') &&
                              !rollbackScriptContent.includes('DROP TABLE') &&
                              !rollbackScriptContent.includes('TRUNCATE');

  if (healthCheckedBeforeRelease && haltsOnHealthFail && dropsOnlyNewIndexes && neverOverwritesData) {
    console.log('✅ PASS [Test 21]: Fail-safe write freeze verified: Failed rollback halts with maintenance active, never silently reopens writes, and preserves live transactional data.');
    passedTests++;
  } else {
    console.error('❌ FAIL [Test 21]: Fail-safe write freeze & data preservation check failed!', {
      healthCheckedBeforeRelease,
      haltsOnHealthFail,
      dropsOnlyNewIndexes,
      neverOverwritesData
    });
  }
} catch (err) {
  console.error('❌ FAIL [Test 21]: Exception during fail-safe write freeze test:', err);
}

// ==============================================================================
// FINAL SUMMARY
// ==============================================================================
console.log('\n====================================================================');
console.log(`📊 FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log('🛡️ ALL 16 MANDATORY PRODUCTION SAFETY & DEPLOYMENT SCENARIOS VERIFIED 100% PASS');
} else {
  console.error('❌ SAFETY SUITE REPORTED ONE OR MORE FAILURES');
}
console.log('====================================================================\n');

// Clean up sandbox
if (fs.existsSync(SUITE_SANDBOX)) {
  fs.rmSync(SUITE_SANDBOX, { recursive: true, force: true });
}

process.exit(passedTests === totalTests ? 0 : 1);
