#!/usr/bin/env bash
# ==============================================================================
# BUSINZ CRM — CONTROLLED PM2 SYSTEMD CORE DUMP LIMIT CONFIGURATION
# Purpose: Enforce LimitCORE=0 in systemd to prevent future 5.8 GB core dumps
# Safety: Strictly modifies unit configuration and runs systemctl daemon-reload.
#         DOES NOT RESTART THE RUNNING PM2 SERVICE OUTSIDE MAINTENANCE WINDOW.
# ==============================================================================
set -Eeuo pipefail

echo "🛡️ ==================================================================="
echo "🛡️ BUSINZ CRM — PM2 SYSTEMD CORE DUMP LIMIT CONFIGURATION (LimitCORE=0)"
echo "🛡️ Timestamp: $(date)"
echo "🛡️ ==================================================================="

# Detect PM2 service name
PM2_SERVICE="pm2-root.service"
if [ ! -f "/etc/systemd/system/${PM2_SERVICE}" ]; then
  DETECTED=$(ls -1 /etc/systemd/system/pm2-*.service 2>/dev/null | head -1 || true)
  if [ -n "${DETECTED}" ]; then
    PM2_SERVICE=$(basename "${DETECTED}")
  fi
fi

DROPIN_DIR="/etc/systemd/system/${PM2_SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/limitcore.conf"

echo "📌 Target Service:     ${PM2_SERVICE}"
echo "📌 Drop-in Directory:  ${DROPIN_DIR}"
echo "📌 Drop-in Config:     ${DROPIN_FILE}"

# 1. Create drop-in configuration directory
mkdir -p "${DROPIN_DIR}"
chmod 755 "${DROPIN_DIR}"

# 2. Write drop-in override setting LimitCORE=0
cat << 'EOF' > "${DROPIN_FILE}"
[Service]
LimitCORE=0
EOF
chmod 644 "${DROPIN_FILE}"
echo "✅ Created systemd drop-in configuration at ${DROPIN_FILE}."

# 3. Reload systemd daemon to pick up configuration changes
echo "🔄 Executing systemctl daemon-reload (Zero runtime interruption)..."
systemctl daemon-reload

# 4. Verify systemd configuration (without restarting the service)
EFFECTIVE_SYSTEMD_LIMIT=$(systemctl show -p LimitCORE "${PM2_SERVICE}" 2>/dev/null || true)
echo "✅ Verified systemd unit configuration: ${EFFECTIVE_SYSTEMD_LIMIT}"

if [ "${EFFECTIVE_SYSTEMD_LIMIT}" != "LimitCORE=0" ]; then
  echo "⚠️ WARNING: systemctl show reported '${EFFECTIVE_SYSTEMD_LIMIT}' (expected 'LimitCORE=0')."
else
  echo "✅ Confirmed: systemd unit '${PM2_SERVICE}' has LimitCORE=0 enabled."
fi

echo ""
echo "🛑 CRITICAL PRODUCTION SAFETY NOTICE:"
echo "   The running PM2 service has NOT been restarted."
echo "   The new core dump limit will apply automatically when PM2 reloads/restarts"
echo "   during the scheduled maintenance cutover window."
echo ""
echo "📋 TO VERIFY EFFECTIVE PROCESS LIMIT AFTER RESTART DURING MAINTENANCE:"
echo "   1. Find Node PID:   NODE_PID=\$(pgrep -f 'businz.*server/index.js' || pm2 pid businz)"
echo "   2. Check /proc:     grep 'Max core file size' /proc/\${NODE_PID}/limits"
echo "   Expected Output:    Max core file size          0                    0                    bytes"
echo "======================================================================="
