#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# BUSINZ Phase 9AC: Reproducible Isolated Frontend Build for Hostinger VPS
# Target Workspace: /var/www/businz-optimization-test
# Target Port: 5101 (Isolated Test Backend)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==================================================================="
echo "🏗️  BUSINZ Phase 9AC: Hostinger Isolated Frontend Build"
echo "   Working Directory: ${ROOT_DIR}"
echo "==================================================================="

# Verify we are in an authorized test worktree
if [[ "${ROOT_DIR}" != *"/businz-optimization-test"* ]] && [[ "${ROOT_DIR}" != *"/ControlRoom"* ]]; then
  echo "🛑 [SAFETY FAIL-CLOSED] This script can only be run in /var/www/businz-optimization-test!"
  exit 1
fi

STORAGE_DIR="${ROOT_DIR}/storage"
BUILD_WORKSPACE="${STORAGE_DIR}/isolated-build-workspace"
STAGED_DIST="${STORAGE_DIR}/staged-dist"

# 1. Clean previous isolated build directories
echo "🧹 Cleaning previous staging and build workspace directories..."
rm -rf "${BUILD_WORKSPACE}" "${STAGED_DIST}"
mkdir -p "${BUILD_WORKSPACE}" "${STAGED_DIST}"

# 2. Copy source and locked configuration files
echo "📁 Copying source files into isolated build workspace..."
cp "${ROOT_DIR}/package.json" "${BUILD_WORKSPACE}/package.json"
cp "${ROOT_DIR}/package-lock.json" "${BUILD_WORKSPACE}/package-lock.json"
cp "${ROOT_DIR}/vite.config.js" "${BUILD_WORKSPACE}/vite.config.js"
cp "${ROOT_DIR}/index.html" "${BUILD_WORKSPACE}/index.html"
cp -r "${ROOT_DIR}/src" "${BUILD_WORKSPACE}/src"
if [ -d "${ROOT_DIR}/public" ]; then
  cp -r "${ROOT_DIR}/public" "${BUILD_WORKSPACE}/public"
fi

# 3. Populate base dependencies into isolated workspace
echo "📦 Replicating base dependencies from root node_modules into isolated workspace..."
if [ -d "${ROOT_DIR}/node_modules" ]; then
  cp -a "${ROOT_DIR}/node_modules" "${BUILD_WORKSPACE}/node_modules"
else
  echo "🛑 [ERROR] Root node_modules not found at ${ROOT_DIR}/node_modules"
  exit 1
fi

# 4. Check and install locked jsPDF and native dependencies directly inside isolated workspace
echo "⚙️  Verifying locked jsPDF & native packages inside isolated workspace..."
MISSING_PKGS=()

for pkg in "dompurify@3.4.15" "canvg@3.0.11" "core-js@3.50.0" "@babel/runtime@7.29.7"; do
  pkg_name="${pkg%@*}"
  if [ ! -f "${BUILD_WORKSPACE}/node_modules/${pkg_name}/package.json" ]; then
    MISSING_PKGS+=("${pkg}")
  fi
done

if [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]]; then
  for pkg in "@rolldown/binding-linux-x64-gnu@1.2.1" "lightningcss-linux-x64-gnu@1.33.0"; do
    pkg_name="${pkg%@*}"
    if [ ! -f "${BUILD_WORKSPACE}/node_modules/${pkg_name}/package.json" ]; then
      MISSING_PKGS+=("${pkg}")
    fi
  done
fi

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
  echo "   Installing missing packages in isolated workspace: ${MISSING_PKGS[*]}"
  (cd "${BUILD_WORKSPACE}" && npm install --no-save "${MISSING_PKGS[@]}")
else
  echo "   ✅ All locked jsPDF and native packages already present in isolated workspace."
fi

# Verify dompurify exists in the isolated workspace hierarchy
if [ ! -d "${BUILD_WORKSPACE}/node_modules/dompurify" ]; then
  echo "🛑 [ERROR] dompurify was not installed into ${BUILD_WORKSPACE}/node_modules/dompurify"
  exit 1
fi

# 5. Execute isolated Vite build
echo "🚀 Executing Vite build targeting ${STAGED_DIST}..."
BUSINZ_OPTIMIZATION_TEST_MODE=true \
PORT=5101 \
VITE_BACKEND_PORT=5101 \
VITE_BACKEND_URL=http://127.0.0.1:5101 \
NODE_ENV=production \
node "${BUILD_WORKSPACE}/node_modules/vite/bin/vite.js" build --outDir "${STAGED_DIST}" --emptyOutDir

VITE_EXIT_CODE=$?
if [ ${VITE_EXIT_CODE} -ne 0 ]; then
  echo "🛑 [BUILD ERROR] Vite exited with nonzero code ${VITE_EXIT_CODE}"
  exit ${VITE_EXIT_CODE}
fi

echo "✅ Vite exited cleanly with code 0."

# 6. Verify DOMPurify chunk exists
echo "🔍 Verifying DOMPurify chunk in staged assets..."
if ls "${STAGED_DIST}/assets/purify.es-"*.js 1> /dev/null 2>&1; then
  echo "   ✅ Found DOMPurify chunk: $(ls "${STAGED_DIST}/assets/purify.es-"*.js)"
else
  echo "🛑 [ERROR] Missing DOMPurify chunk (purify.es-*.js) in ${STAGED_DIST}/assets!"
  exit 1
fi

# 7. Audit for forbidden production / dev ports
echo "🛡️  Auditing generated assets for forbidden production port references (5001-5004)..."
FORBIDDEN_MATCHES=$(grep -rnE "(localhost|127\.0\.0\.1):(5001|5002|5003|5004)" "${STAGED_DIST}" || true)
if [ -n "${FORBIDDEN_MATCHES}" ]; then
  echo "🛑 [AUDIT FAILED] Forbidden port references found:"
  echo "${FORBIDDEN_MATCHES}"
  exit 1
fi
echo "   ✅ 0 forbidden port references found."

# 8. Generate checksum manifest
echo "📝 Generating build-manifest.json..."
cd "${ROOT_DIR}"
node -e '
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const stagedDist = path.resolve("storage/staged-dist");
const manifestPath = path.join(stagedDist, "build-manifest.json");

let gitCommit = "c817e22e0bafbb0b2f5dc3603c6345c24c1e1bfe";
try {
  gitCommit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch (_) {}

const filesList = [];
function collectFiles(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(full);
    else if (ent.isFile()) {
      const rel = path.relative(stagedDist, full);
      if (rel === "build-manifest.json") continue;
      const buf = fs.readFileSync(full);
      const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
      filesList.push({ path: rel, sizeBytes: fs.statSync(full).size, sha256 });
    }
  }
}
collectFiles(stagedDist);
filesList.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  application: "BUSINZ",
  workflow: "Phase 9AC Hostinger Isolated Frontend Build",
  buildArtifactPath: stagedDist,
  gitCommit,
  buildTimestamp: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  totalFiles: filesList.length,
  files: filesList
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log("   ✅ Created build-manifest.json with " + filesList.length + " files hashed.");
'

echo "==================================================================="
echo "🎉 SUCCESS: Isolated frontend build completed cleanly on Hostinger VPS!"
echo "   Artifact location: ${STAGED_DIST}"
echo "   Manifest location: ${STAGED_DIST}/build-manifest.json"
echo "   Exit code: 0"
echo "==================================================================="
