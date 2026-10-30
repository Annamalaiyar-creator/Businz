/**
 * scripts/test_build_isolated_frontend.js
 *
 * Automated verification suite for BUSINZ Phase 9AC Isolated Frontend Build Suite.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  BUILD_WORKSPACE,
  STAGED_DIST_DIR,
  MANIFEST_PATH,
  REQUIRED_JSPDF_VERSIONS,
  FORBIDDEN_STRINGS,
  verifyWorkspaceDependencies,
  verifyIndexHtmlReferences,
  auditStagedAssets,
  computeFileSha256
} from './build_isolated_frontend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

console.log('===================================================================');
console.log('🧪 BUSINZ ERP: TEST ISOLATED FRONTEND BUILD & DEPENDENCY SUITE');
console.log('===================================================================\n');

// Group 1: Workspace Directory Structure & Isolation
console.log('--- 1. Isolated Workspace Structure & Immutability ---');

it('1.1 Isolated workspace exists and is located under storage/', () => {
  assert.ok(BUILD_WORKSPACE.includes(path.join(ROOT_DIR, 'storage')), 'Workspace must be inside storage/');
  assert.ok(fs.existsSync(BUILD_WORKSPACE), 'BUILD_WORKSPACE directory must exist');
});

it('1.2 Staged dist directory exists independently of root dist/', () => {
  assert.ok(STAGED_DIST_DIR.includes(path.join(ROOT_DIR, 'storage')), 'Staged dist must be inside storage/');
  const rootDist = path.join(ROOT_DIR, 'dist');
  assert.notStrictEqual(STAGED_DIST_DIR, rootDist, 'Staged dist must not equal root dist');
});

it('1.3 Root package.json and package-lock.json remain unaltered', () => {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.strictEqual(rootPkg.name, 'businz');
  assert.ok(!rootPkg.dependencies['dompurify'], 'dompurify should not have been added to root dependencies');
});

// Group 2: Dependency Verification & Locked Versions
console.log('\n--- 2. Dependency Verification & Locked Versions ---');

it('2.1 verifyWorkspaceDependencies verifies all required jsPDF versions', () => {
  const res = verifyWorkspaceDependencies();
  assert.strictEqual(res.verified, true);
  for (const [pkg, expectedVer] of Object.entries(REQUIRED_JSPDF_VERSIONS)) {
    assert.strictEqual(res.packages[pkg].installed, true);
    assert.strictEqual(res.packages[pkg].version, expectedVer);
  }
});

it('2.2 Module resolution inside isolated workspace resolves dompurify and jspdf directly', () => {
  const res = verifyWorkspaceDependencies();
  assert.strictEqual(res.resolutions['dompurify'], true, 'dompurify must resolve');
  assert.strictEqual(res.resolutions['jspdf'], true, 'jspdf must resolve');
  assert.strictEqual(res.resolutions['canvg'], true, 'canvg must resolve');
  assert.strictEqual(res.resolutions['core-js'], true, 'core-js must resolve');
});

// Group 3: Staged Dist & Asset Verification
console.log('\n--- 3. Staged Dist & Asset Verification ---');

it('3.1 All asset references in staged index.html exist on disk', () => {
  const check = verifyIndexHtmlReferences(STAGED_DIST_DIR);
  assert.strictEqual(check.exists, true);
  assert.strictEqual(check.allFound, true);
  assert.ok(check.references.length >= 4, 'Must have at least 4 asset references in index.html');
  assert.strictEqual(check.missing.length, 0);
});

it('3.2 DOMPurify chunk (purify.es-*.js) exists in staged dist assets', () => {
  const assetsDir = path.join(STAGED_DIST_DIR, 'assets');
  const files = fs.readdirSync(assetsDir);
  const purifyFile = files.find(f => f.startsWith('purify.es-') && f.endsWith('.js'));
  assert.ok(purifyFile, 'purify.es chunk must exist in assets directory');
});

// Group 4: Network Isolation & Security Audit
console.log('\n--- 4. Network Isolation & Security Audit ---');

it('4.1 Audit detects 0 forbidden strings across all staged assets', () => {
  const audit = auditStagedAssets(STAGED_DIST_DIR);
  assert.strictEqual(audit.clean, true);
  assert.strictEqual(audit.forbiddenFindings.length, 0);
  assert.ok(audit.filesScanned > 40, 'Must have scanned all generated chunks');
});

// Group 5: Manifest Verification
console.log('\n--- 5. Build Artifact Manifest Verification ---');

it('5.1 build-manifest.json exists and is valid JSON', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), 'Manifest file must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.strictEqual(manifest.application, 'BUSINZ');
  assert.strictEqual(manifest.gitCommit, 'c817e22e0bafbb0b2f5dc3603c6345c24c1e1bfe');
  assert.ok(manifest.totalFiles > 50, 'Manifest must contain all built assets');
  assert.strictEqual(manifest.files.length, manifest.totalFiles);
});

it('5.2 Manifest SHA-256 matches actual file on disk for index.html', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const entry = manifest.files.find(f => f.path === 'index.html');
  assert.ok(entry, 'index.html must be recorded in manifest');
  const actualHash = computeFileSha256(path.join(STAGED_DIST_DIR, 'index.html'));
  assert.strictEqual(entry.sha256, actualHash, 'SHA-256 hash must match disk');
});

it('5.3 Manifest SHA-256 matches actual file on disk for purify chunk', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const entry = manifest.files.find(f => f.path.includes('purify'));
  assert.ok(entry, 'purify chunk must be recorded in manifest');
  const actualHash = computeFileSha256(path.join(STAGED_DIST_DIR, entry.path));
  assert.strictEqual(entry.sha256, actualHash, 'SHA-256 hash must match disk');
});

console.log('\n===================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} PASSED, 0 FAILED (TOTAL: ${totalTests})`);
console.log('===================================================================');
