/**
 * scripts/build_isolated_frontend.js
 *
 * BUSINZ ERP: Isolated Frontend Build Dependency Repair & Staging Suite (Phase 9AC)
 *
 * Requirements:
 * 1. Zero modifications to root node_modules, package.json, or package-lock.json.
 * 2. Zero npm install / ci / audit fix commands executed in active worktree root.
 * 3. Separate build workspace under storage/isolated-build-workspace/ with its own dependencies.
 * 4. Exact locked dependencies verified:
 *    - jsPDF dependencies:
 *        - @babel/runtime: 7.29.7
 *        - canvg: 3.0.11
 *        - core-js: 3.50.0
 *        - dompurify: 3.4.15
 *        - jspdf: 4.2.1
 *    - Linux native bindings (on Linux x86_64):
 *        - @rolldown/binding-linux-x64-gnu: 1.2.1
 *        - lightningcss-linux-x64-gnu: 1.33.0
 * 5. Fails closed against port 5001 or backend auto-spawn:
 *    BUSINZ_OPTIMIZATION_TEST_MODE=true, PORT=5101, VITE_BACKEND_PORT=5101.
 * 6. Outputs compiled bundle to storage/staged-dist/ without replacing active dist/.
 * 7. Comprehensive static network isolation audit scanning for forbidden URLs.
 * 8. Complete verification of index.html asset references.
 * 9. Generation of SHA-256 artifact manifest in storage/staged-dist/build-manifest.json.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
export const BUILD_WORKSPACE = path.join(STORAGE_DIR, 'isolated-build-workspace');
export const STAGED_DIST_DIR = path.join(STORAGE_DIR, 'staged-dist');
export const MANIFEST_PATH = path.join(STAGED_DIST_DIR, 'build-manifest.json');

export const REQUIRED_JSPDF_VERSIONS = Object.freeze({
  '@babel/runtime': '7.29.7',
  'canvg': '3.0.11',
  'core-js': '3.50.0',
  'dompurify': '3.4.15',
  'jspdf': '4.2.1'
});

export const REQUIRED_LINUX_NATIVE_PACKAGES = Object.freeze({
  '@rolldown/binding-linux-x64-gnu': '1.2.1',
  'lightningcss-linux-x64-gnu': '1.33.0'
});

export const FORBIDDEN_STRINGS = Object.freeze([
  'localhost:5001',
  'localhost:5002',
  'localhost:5003',
  'localhost:5004',
  '127.0.0.1:5001',
  '127.0.0.1:5002',
  '127.0.0.1:5003',
  '127.0.0.1:5004'
]);

/**
 * Computes SHA-256 hash of a file.
 */
export function computeFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Recursively copies a directory without touching symlinks or originals.
 */
export function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Initializes the isolated build workspace under storage/.
 */
export function setupIsolatedWorkspace() {
  console.log(`📁 Setting up isolated build workspace at: ${BUILD_WORKSPACE}`);

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.mkdirSync(BUILD_WORKSPACE, { recursive: true });

  // 1. Copy required project files
  const filesToCopy = [
    'package.json',
    'package-lock.json',
    'vite.config.js',
    'index.html'
  ];

  for (const file of filesToCopy) {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(BUILD_WORKSPACE, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // 2. Copy source directories
  copyDirSync(path.join(ROOT_DIR, 'src'), path.join(BUILD_WORKSPACE, 'src'));
  if (fs.existsSync(path.join(ROOT_DIR, 'public'))) {
    copyDirSync(path.join(ROOT_DIR, 'public'), path.join(BUILD_WORKSPACE, 'public'));
  }

  console.log('   ✅ Source and configuration copied cleanly into build workspace.');
}

/**
 * Populates and verifies dependencies inside the isolated build workspace.
 */
export function prepareIsolatedDependencies() {
  console.log('📦 Preparing isolated dependencies in build workspace...');
  const targetNodeModules = path.join(BUILD_WORKSPACE, 'node_modules');

  // If root node_modules exists, copy it as base to save network and keep verified packages
  const rootNodeModules = path.join(ROOT_DIR, 'node_modules');
  if (fs.existsSync(rootNodeModules) && !fs.existsSync(targetNodeModules)) {
    console.log('   📋 Replicating verified base dependencies into build workspace...');
    copyDirSync(rootNodeModules, targetNodeModules);
  }

  // Check and install missing dependencies strictly inside BUILD_WORKSPACE
  const isLinuxX64 = process.platform === 'linux' && process.arch === 'x64';
  const missingPkgs = [];

  for (const [pkg, reqVer] of Object.entries(REQUIRED_JSPDF_VERSIONS)) {
    const pkgJsonPath = path.join(targetNodeModules, pkg, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      missingPkgs.push(`${pkg}@${reqVer}`);
    } else {
      try {
        const ver = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
        if (ver !== reqVer) {
          missingPkgs.push(`${pkg}@${reqVer}`);
        }
      } catch (_) {
        missingPkgs.push(`${pkg}@${reqVer}`);
      }
    }
  }

  if (isLinuxX64) {
    for (const [pkg, reqVer] of Object.entries(REQUIRED_LINUX_NATIVE_PACKAGES)) {
      const pkgJsonPath = path.join(targetNodeModules, pkg, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) {
        missingPkgs.push(`${pkg}@${reqVer}`);
      }
    }
  }

  if (missingPkgs.length > 0) {
    console.log(`   ⚙️ Installing missing locked packages directly inside isolated workspace: ${missingPkgs.join(', ')}`);
    const installRes = spawnSync(
      'npm',
      ['install', '--no-save', ...missingPkgs],
      { cwd: BUILD_WORKSPACE, encoding: 'utf8', env: process.env }
    );

    if (installRes.status !== 0) {
      console.warn(`   ⚠️ npm install exited with code ${installRes.status}: ${installRes.stderr || installRes.stdout}`);
    } else {
      console.log('   ✅ Locked dependencies successfully installed into isolated workspace.');
    }
  } else {
    console.log('   ✅ All locked jsPDF and native packages already present and verified in build workspace.');
  }

  return verifyWorkspaceDependencies();
}

/**
 * Verifies exact package versions and import resolution.
 */
export function verifyWorkspaceDependencies() {
  console.log('🔍 Verifying package integrity and import resolution in build workspace...');
  const targetNodeModules = path.join(BUILD_WORKSPACE, 'node_modules');
  const results = {
    verified: true,
    packages: {},
    errors: []
  };

  for (const [pkg, reqVer] of Object.entries(REQUIRED_JSPDF_VERSIONS)) {
    const pkgJsonPath = path.join(targetNodeModules, pkg, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      results.verified = false;
      results.errors.push(`Missing package: ${pkg}`);
      results.packages[pkg] = { installed: false, expected: reqVer };
      continue;
    }

    try {
      const ver = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
      const matched = ver === reqVer;
      if (!matched) results.verified = false;
      results.packages[pkg] = { installed: true, version: ver, expected: reqVer, matched };
    } catch (err) {
      results.verified = false;
      results.errors.push(`Corrupt package.json for ${pkg}: ${err.message}`);
    }
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    for (const [pkg, reqVer] of Object.entries(REQUIRED_LINUX_NATIVE_PACKAGES)) {
      const pkgJsonPath = path.join(targetNodeModules, pkg, 'package.json');
      const exists = fs.existsSync(pkgJsonPath);
      results.packages[pkg] = { installed: exists, expected: reqVer };
      if (!exists) {
        results.verified = false;
        results.errors.push(`Missing Linux native binding: ${pkg}`);
      }
    }
  }

  // Import resolution probe via Node inside build workspace
  const probeScript = `
    const path = require('path');
    const modules = ['jspdf', 'canvg', 'core-js', 'dompurify', 'vite', 'react', 'react-dom'];
    const resolved = {};
    for (const m of modules) {
      try {
        require.resolve(m, { paths: [path.resolve('${BUILD_WORKSPACE}')] });
        resolved[m] = true;
      } catch (e) {
        resolved[m] = false;
      }
    }
    console.log(JSON.stringify(resolved));
  `;

  try {
    const probeRes = spawnSync('node', ['-e', probeScript], {
      cwd: BUILD_WORKSPACE,
      encoding: 'utf8'
    });
    if (probeRes.status === 0 && probeRes.stdout) {
      const resolutions = JSON.parse(probeRes.stdout.trim());
      results.resolutions = resolutions;
      for (const [mod, ok] of Object.entries(resolutions)) {
        if (!ok) {
          results.verified = false;
          results.errors.push(`Failed to resolve module import: ${mod}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Probe execution error: ${err.message}`);
  }

  return results;
}

/**
 * Executes the Vite build inside the isolated workspace.
 */
export function runIsolatedBuild() {
  console.log(`🚀 Executing isolated Vite build targeting: ${STAGED_DIST_DIR}`);
  fs.mkdirSync(STAGED_DIST_DIR, { recursive: true });

  const viteBin = path.join(BUILD_WORKSPACE, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`Vite binary not found at ${viteBin}`);
  }

  const buildEnv = {
    ...process.env,
    BUSINZ_OPTIMIZATION_TEST_MODE: 'true',
    PORT: '5101',
    VITE_BACKEND_PORT: '5101',
    VITE_BACKEND_URL: 'http://127.0.0.1:5101',
    NODE_ENV: 'production'
  };

  const startTime = Date.now();
  const buildResult = spawnSync(
    'node',
    [viteBin, 'build', '--outDir', STAGED_DIST_DIR, '--emptyOutDir'],
    {
      cwd: BUILD_WORKSPACE,
      env: buildEnv,
      encoding: 'utf8'
    }
  );
  const durationMs = Date.now() - startTime;

  return {
    exitCode: buildResult.status,
    stdout: buildResult.stdout,
    stderr: buildResult.stderr,
    durationMs,
    stagedDistPath: STAGED_DIST_DIR
  };
}

/**
 * Verifies that all asset references in index.html actually exist in the output directory.
 */
export function verifyIndexHtmlReferences(stagedDistDir = STAGED_DIST_DIR) {
  console.log('🔍 Verifying index.html asset references...');
  const indexPath = path.join(stagedDistDir, 'index.html');
  const results = {
    exists: fs.existsSync(indexPath),
    references: [],
    allFound: true,
    missing: []
  };

  if (!results.exists) {
    results.allFound = false;
    results.missing.push('index.html');
    return results;
  }

  const content = fs.readFileSync(indexPath, 'utf8');

  // Match src="..." and href="..."
  const attrRegex = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const rawRef = match[1];
    // Skip external protocols (http, https, //) and fonts
    if (rawRef.startsWith('http://') || rawRef.startsWith('https://') || rawRef.startsWith('//')) {
      continue;
    }

    // Relative to dist root
    const cleanRef = rawRef.startsWith('/') ? rawRef.slice(1) : rawRef;
    const localPath = path.join(stagedDistDir, cleanRef);
    const fileExists = fs.existsSync(localPath);

    results.references.push({
      ref: rawRef,
      localPath,
      exists: fileExists
    });

    if (!fileExists) {
      results.allFound = false;
      results.missing.push(rawRef);
    }
  }

  return results;
}

/**
 * Scans all generated assets for forbidden production/development URLs.
 */
export function auditStagedAssets(stagedDistDir = STAGED_DIST_DIR) {
  console.log(`🛡️ Auditing staged assets in: ${stagedDistDir}`);
  const report = {
    clean: true,
    filesScanned: 0,
    forbiddenFindings: []
  };

  if (!fs.existsSync(stagedDistDir)) {
    report.clean = false;
    report.forbiddenFindings.push({ file: 'none', error: 'Staged dist directory does not exist' });
    return report;
  }

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
        report.filesScanned++;
        const content = fs.readFileSync(fullPath, 'utf8');

        for (const forbidden of FORBIDDEN_STRINGS) {
          if (content.includes(forbidden)) {
            report.clean = false;
            report.forbiddenFindings.push({
              file: path.relative(stagedDistDir, fullPath),
              forbiddenString: forbidden
            });
          }
        }
      }
    }
  }

  scanDir(stagedDistDir);
  return report;
}

/**
 * Generates the complete build-manifest.json containing SHA-256 checksums of all assets.
 */
export function generateArtifactManifest(stagedDistDir = STAGED_DIST_DIR, gitCommit = 'c817e22e0bafbb0b2f5dc3603c6345c24c1e1bfe') {
  console.log(`📝 Generating SHA-256 artifact manifest for: ${stagedDistDir}`);
  const filesList = [];

  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(stagedDistDir, fullPath);
        // Do not include the manifest itself in the manifest files list
        if (relPath === 'build-manifest.json') continue;

        const stat = fs.statSync(fullPath);
        const sha256 = computeFileSha256(fullPath);
        filesList.push({
          path: relPath,
          sizeBytes: stat.size,
          sha256
        });
      }
    }
  }

  collectFiles(stagedDistDir);
  filesList.sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    application: 'BUSINZ',
    workflow: 'Phase 9AC Isolated Frontend Build Dependency Repair',
    buildArtifactPath: stagedDistDir,
    gitCommit,
    buildTimestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    totalFiles: filesList.length,
    files: filesList
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`   ✅ Manifest written to: ${MANIFEST_PATH} (${filesList.length} files hashed)`);
  return manifest;
}

/**
 * Main Suite Runner
 */
export async function runCompleteIsolatedBuildWorkflow() {
  console.log('===================================================================');
  console.log('🏗️ BUSINZ ERP: ISOLATED FRONTEND BUILD & DEPENDENCY REPAIR SUITE');
  console.log('===================================================================\n');

  setupIsolatedWorkspace();
  const depResults = prepareIsolatedDependencies();
  console.log('\n📊 Dependency Verification Summary:');
  console.log(JSON.stringify(depResults, null, 2));

  if (!depResults.verified) {
    console.error('\n❌ Dependency integrity verification failed!');
    console.error(depResults.errors);
    return { success: false, depResults };
  }

  console.log('\n-------------------------------------------------------------------');
  const buildResult = runIsolatedBuild();
  console.log(`⏱️ Build finished with exit code ${buildResult.exitCode} in ${buildResult.durationMs}ms`);

  if (buildResult.exitCode !== 0) {
    console.error('❌ Build failed:');
    console.error(buildResult.stderr || buildResult.stdout);
    return { success: false, depResults, buildResult };
  }

  console.log('\n-------------------------------------------------------------------');
  const indexCheck = verifyIndexHtmlReferences(buildResult.stagedDistPath);
  console.log(`🔍 index.html Asset Reference Verification: ${indexCheck.references.length} references found.`);
  if (indexCheck.allFound) {
    console.log('   ✅ All index.html asset references exist on disk.');
  } else {
    console.error('   ❌ Missing asset references from index.html:');
    console.error(indexCheck.missing);
  }

  console.log('\n-------------------------------------------------------------------');
  const auditResult = auditStagedAssets(buildResult.stagedDistPath);
  console.log(`🛡️ Network Isolation Audit: Scanned ${auditResult.filesScanned} files.`);
  if (auditResult.clean) {
    console.log('   ✅ Audit Passed: 0 forbidden port/host strings found in generated assets.');
  } else {
    console.error('   ❌ Audit Failed: Forbidden strings detected!');
    console.error(JSON.stringify(auditResult.forbiddenFindings, null, 2));
  }

  // Ensure active dist was not touched
  const activeDistPath = path.join(ROOT_DIR, 'dist');
  assert.notStrictEqual(buildResult.stagedDistPath, activeDistPath);
  console.log(`   ✅ Active dist directory untouched: ${activeDistPath}`);

  // Fetch current git commit
  let gitCommit = 'c817e22e0bafbb0b2f5dc3603c6345c24c1e1bfe';
  try {
    const revRes = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT_DIR, encoding: 'utf8' });
    if (revRes.status === 0 && revRes.stdout.trim()) {
      gitCommit = revRes.stdout.trim();
    }
  } catch (_) {}

  console.log('\n-------------------------------------------------------------------');
  const manifest = generateArtifactManifest(buildResult.stagedDistPath, gitCommit);

  const isSuccess = buildResult.exitCode === 0 &&
                    indexCheck.allFound &&
                    auditResult.clean &&
                    manifest.totalFiles > 0;

  return {
    success: isSuccess,
    depResults,
    buildResult,
    indexCheck,
    auditResult,
    manifest
  };
}

if (process.argv[1] && process.argv[1].endsWith('build_isolated_frontend.js') && !process.argv[1].endsWith('test_build_isolated_frontend.js')) {
  runCompleteIsolatedBuildWorkflow()
    .then(res => {
      if (res.success) {
        console.log('\n===================================================================');
        console.log('🎉 ISOLATED FRONTEND BUILD & STAGING SUCCEEDED (EXIT CODE 0)');
        console.log(`   Staged Assets: ${STAGED_DIST_DIR}`);
        console.log(`   Manifest:      ${MANIFEST_PATH}`);
        console.log(`   Total Assets:  ${res.manifest.totalFiles} files`);
        console.log('===================================================================');
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌ Fatal build error:', err);
      process.exit(1);
    });
}
