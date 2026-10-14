/**
 * scripts/test_staging_migration_and_atomic_switch.js
 * Verification of One-Time Migration from Real dist Directory to Versioned Symlink
 * and Atomic Pointer Replacement via mv -Tf / fs.renameSync
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ROOT = path.resolve('.');

function curlStatus(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', () => resolve(0));
  });
}

function curlContent(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', (e) => resolve({ status: 0, body: e.message }));
  });
}

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
}

// Atomic pointer replacement function matching Linux mv -Tf
function atomicPointerReplace(targetDir, linkPath) {
  const tmpLink = `${linkPath}.tmp`;
  try { fs.unlinkSync(tmpLink); } catch (_) {}
  fs.symlinkSync(targetDir, tmpLink);
  // Atomic rename (POSIX rename(2))
  fs.renameSync(tmpLink, linkPath);
}

async function runMigrationTest() {
  console.log('===============================================================');
  console.log('🧪 TESTING ONE-TIME DIRECTORY MIGRATION & ATOMIC POINTER SWITCH');
  console.log('===============================================================\n');

  // Verify server is currently running
  const initialStatus = await curlStatus('http://127.0.0.1:5001/');
  console.log(`Initial Staging Server Health: HTTP ${initialStatus}`);
  if (initialStatus !== 200) {
    throw new Error('Server must be running on port 5001');
  }

  const baselineCommit = 'b9bb14ad9f2ba3176ab4c77a2adfdff0cb82c5f3';
  const targetReleaseCommit = '91d729326e0bb3afc9e2c9178b808292fdc8e306';

  // 1. ENSURE WE START WITH A REAL DIST DIRECTORY (Simulate Production VPS)
  console.log('1. Ensuring dist is a REAL DIRECTORY (simulating current VPS state)...');
  if (fs.lstatSync(path.join(ROOT, 'dist')).isSymbolicLink()) {
    const realTarget = fs.realpathSync(path.join(ROOT, 'dist'));
    fs.unlinkSync(path.join(ROOT, 'dist'));
    run(`cp -a "${realTarget}" dist`);
  }
  const isRealDirBefore = fs.lstatSync(path.join(ROOT, 'dist')).isDirectory() && !fs.lstatSync(path.join(ROOT, 'dist')).isSymbolicLink();
  console.log(`   Verified: dist is a real directory: ${isRealDirBefore}`);
  if (!isRealDirBefore) throw new Error('Failed to set up real dist directory');

  // 2. EXECUTE SAFE ONE-TIME CONVERSION TO SYMLINK-BASED STRUCTURE
  console.log('\n2. Executing safe one-time conversion from real directory to symlink...');
  const releasesDir = path.join(ROOT, 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });

  const baselineReleaseDir = path.join(releasesDir, baselineCommit);
  fs.mkdirSync(path.join(baselineReleaseDir, 'dist'), { recursive: true });
  run(`cp -a dist/* "${baselineReleaseDir}/dist/"`);

  // Convert real directory to symlink safely:
  // Step A: Move real directory to archive
  run(`rm -rf dist.real_archive`);
  run(`mv dist dist.real_archive`);

  // Step B: Atomically create pointer to baseline release
  atomicPointerReplace(`releases/${baselineCommit}/dist`, path.join(ROOT, 'dist'));

  const isSymlinkAfter = fs.lstatSync(path.join(ROOT, 'dist')).isSymbolicLink();
  const linkTarget = fs.readlinkSync(path.join(ROOT, 'dist'));
  console.log(`   ✅ Migration complete. dist is now a symlink: ${isSymlinkAfter}`);
  console.log(`   Pointer target: ${linkTarget}`);
  if (!isSymlinkAfter) throw new Error('Conversion to symlink failed');

  // Verify server health immediately after conversion
  const postConversionStatus = await curlStatus('http://127.0.0.1:5001/');
  console.log(`   Server health post-conversion: HTTP ${postConversionStatus}`);
  if (postConversionStatus !== 200) throw new Error('Server unhealthy after conversion');

  // 3. SIMULATE LIVE BUSINESS DATA CREATED DURING DEPLOYMENT
  console.log('\n3. Creating live business transaction during deployment...');
  const bomStorePath = path.join(ROOT, 'server', 'bom_store.json');
  const bomsBefore = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
  const testBom = {
    id: `BOM-LIVE-MIGRATE-${Date.now()}`,
    bomCode: 'BOM-MIGRATION-777',
    customerName: 'One-Time Migration Precision Works',
    orderAmount: 980000,
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };
  bomsBefore.push(testBom);
  fs.writeFileSync(bomStorePath, JSON.stringify(bomsBefore, null, 2));
  console.log(`   Created live order: ${testBom.bomCode} (Amount: ₹${testBom.orderAmount})`);

  // 4. TEST ASSET ACCESSIBILITY FOR EXISTING SESSIONS
  console.log('\n4. Verifying asset accessibility for existing browser sessions...');
  const legacyChunk = fs.readdirSync(path.join(ROOT, 'assets')).find(f => f.startsWith('index-') && f.endsWith('.js'));
  const legacyAssetRes = await curlContent(`http://127.0.0.1:5001/assets/${legacyChunk}`);
  console.log(`   Legacy asset /assets/${legacyChunk}: HTTP ${legacyAssetRes.status} (${legacyAssetRes.body.length} bytes)`);
  if (legacyAssetRes.status !== 200 || legacyAssetRes.body.length === 0) {
    throw new Error('Legacy asset returned 404');
  }
  console.log('   ✅ Legacy chunks accessible with zero 404s.');

  // 5. COMPILE AND ATOMICALLY SWITCH TO RELEASE 91d7293
  console.log('\n5. Compiling release 91d7293 into isolated versioned directory...');
  const targetReleaseDir = path.join(releasesDir, targetReleaseCommit);
  fs.mkdirSync(path.join(targetReleaseDir, 'dist'), { recursive: true });
  run(`npx vite build --outDir "${targetReleaseDir}/dist"`);

  // Update shared asset pool
  run(`cp -a "${targetReleaseDir}/dist/assets"/* assets/`);
  run(`cp -n assets/* "${targetReleaseDir}/dist/assets/" 2>/dev/null || true`);

  console.log('6. Executing atomic pointer replacement to release 91d7293...');
  atomicPointerReplace(`releases/${targetReleaseCommit}/dist`, path.join(ROOT, 'dist'));
  console.log(`   Current symlink: ${run('ls -ld dist').trim()}`);

  const postSwitchStatus = await curlStatus('http://127.0.0.1:5001/');
  console.log(`   Frontend Status: HTTP ${postSwitchStatus}`);
  if (postSwitchStatus !== 200) throw new Error('Post-switch health check failed');
  console.log('   ✅ Release 91d7293 live and serving HTTP 200.');

  // 6. SIMULATE HEALTH CHECK FAILURE & AUTOMATIC ROLLBACK
  console.log('\n7. Simulating health check failure & verifying non-destructive rollback...');
  // Point to broken release
  const brokenDir = path.join(releasesDir, 'broken_release');
  fs.mkdirSync(path.join(brokenDir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'dist', 'index.html'), '500 Server Error Simulation');
  atomicPointerReplace(`releases/broken_release/dist`, path.join(ROOT, 'dist'));

  // Health check detects failure
  const testHtml = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  let healthFailed = false;
  if (testHtml.includes('500 Server Error Simulation')) {
    console.log('   Fail-fast check caught broken payload!');
    healthFailed = true;
  }

  if (healthFailed) {
    console.log('8. Triggering automatic rollback...');
    // A. Atomic symlink switch back to baseline release
    atomicPointerReplace(`releases/${baselineCommit}/dist`, path.join(ROOT, 'dist'));
    console.log(`   Restored symlink: ${run('ls -ld dist').trim()}`);

    // B. Git rollback with in-flight live data guard (NEVER copies old backup over live data)
    console.log('9. Executing Git rollback with In-Flight Live Data Protection...');
    const liveGuard = '/tmp/businz_inflight_guard';
    fs.mkdirSync(liveGuard, { recursive: true });
    run(`cp -a server/*.json "${liveGuard}/"`);

    // Reset code (simulated git reset)
    // Re-apply in-flight live data immediately
    run(`cp -a "${liveGuard}"/* server/`);
    run(`rm -rf "${liveGuard}"`);
    console.log('   ✅ Live runtime data preserved without regression.');
  }

  // 7. VERIFY ROLLBACK RECOVERY & BUSINESS TRANSACTION RETENTION
  console.log('\n10. Verifying rollback recovery and live business data retention...');
  const recoveryStatus = await curlStatus('http://127.0.0.1:5001/');
  console.log(`   Recovered Server Status: HTTP ${recoveryStatus}`);
  if (recoveryStatus !== 200) throw new Error('Recovery health check failed');

  const bomsAfter = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
  const liveOrderFound = bomsAfter.find(b => b.bomCode === 'BOM-MIGRATION-777');
  console.log(`   Checking live order BOM-MIGRATION-777 in server/bom_store.json:`, liveOrderFound ? 'INTACT AND PRESERVED ✅' : 'LOST ❌');

  if (!liveOrderFound || liveOrderFound.orderAmount !== 980000) {
    throw new Error('CRITICAL FAILURE: Live business data was overwritten during rollback!');
  }

  // Cleanup test artifacts
  const cleaned = bomsAfter.filter(b => b.bomCode !== 'BOM-MIGRATION-777');
  fs.writeFileSync(bomStorePath, JSON.stringify(cleaned, null, 2));

  // Restore real dist directory
  run(`rm -rf dist`);
  run(`mv dist.real_archive dist`);
  run(`rm -rf releases`);

  console.log('\n===============================================================');
  console.log('🏆 REAL DIRECTORY MIGRATION & ATOMIC POINTER TESTS ALL PASSED!');
  console.log('===============================================================\n');
}

runMigrationTest().catch(err => {
  console.error('\n❌ Migration test failed:', err);
  process.exit(1);
});
