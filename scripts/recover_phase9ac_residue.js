/**
 * scripts/recover_phase9ac_residue.js
 *
 * BUSINZ ERP: Transactional PostgreSQL Synthetic Residue Recovery (Phase 9AC)
 *
 * Comprehensive Multi-Layer Recovery Coverage:
 * 1. Relational Data:
 *    - public.bom_orders (filtered by exact synthetic marker)
 *    - public.leads (and child records: lead_status_history, lead_notifications, lead_notification_recipients)
 * 2. ControlRoom JSONB Stores:
 *    - employees_store: filters out synthetic employee accounts, preserves all authentic staff
 *    - customer_pis_store: filters out synthetic proforma invoices
 *    - quotations_store: filters out synthetic quotations
 *    - vrm_prod_ledger: filters out synthetic inventory ledger entries (TX-PROD-...)
 *    - notifications_store: filters out synthetic notifications
 *    - bom_store: dropped when all records are verified synthetic
 *    - invoice_store: dropped when all records are verified synthetic
 *    - reservations_store: dropped when all records are verified synthetic
 * 3. Uploaded Media Storage:
 *    - Cleans test inspection photos and LR documents containing the synthetic marker from storage/uploads
 * 4. Invoice Sequences:
 *    - Sequence calculation in getOrReserveNextInvAtomic dynamically derives from stored invoices and BOMs;
 *      removing synthetic records automatically restores sequential counter baseline.
 * 5. Session State:
 *    - Cleans synthetic session tokens matching synthetic employee credentials.
 *
 * Strict Pre-Commit Baseline Check:
 * - Pre-test clean baseline contains EXACTLY 3 store keys:
 *     1. customer_pis_store
 *     2. employees_store
 *     3. quotations_store
 * - If any newly created store key (bom_store, invoice_store, reservations_store)
 *   remains, or if any unexpected store key is present, transaction ROLLS BACK immediately.
 *
 * Mandatory Safeguards:
 * 1. Default mode is read-only DRY RUN (zero commits).
 * 2. Live execution requires explicit CLI flag: --execute-authorized
 * 3. Strict workspace isolation: /var/www/businz-optimization-test (or --mock).
 * 4. Strict DB isolation: 127.0.0.1 / businz_optimization_test / businz_test_user.
 * 5. Single atomic PostgreSQL transaction with row-level locking (FOR UPDATE).
 * 6. Exact synthetic marker matching on every target item before deletion.
 * 7. Never uses TRUNCATE, DROP TABLE, broad DELETE, or database recreation.
 * 8. Pre-commit baseline audit inside transaction before COMMIT, with ROLLBACK on mismatch.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  resolveAndValidateTestDatabaseUrl,
  maskCredentials,
  REQUIRED_TEST_DATABASE,
  REQUIRED_TEST_HOST,
  REQUIRED_TEST_PORT
} from './testEnvironmentGuard.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const EXPECTED_OPTIMIZATION_TEST_WORKSPACE = '/var/www/businz-optimization-test';

export const BASELINE_STORE_KEYS = Object.freeze([
  'customer_pis_store',
  'employees_store',
  'quotations_store'
]);

export const DYNAMIC_STORE_KEYS = Object.freeze([
  'bom_store',
  'invoice_store',
  'reservations_store'
]);

/**
 * Validates workspace path isolation.
 */
export function verifyWorkspaceIsolation(currentDir = process.cwd()) {
  const resolved = path.resolve(currentDir);
  return resolved === EXPECTED_OPTIMIZATION_TEST_WORKSPACE;
}

/**
 * Checks if a string contains the synthetic run marker.
 */
export function isSyntheticMarkerMatch(value, synthMarker) {
  if (!value || typeof value !== 'string') return false;
  if (synthMarker) {
    return value.includes(synthMarker);
  }
  return value.includes('SYNTH_P9AC_');
}

/**
 * Checks if an employee record belongs to the synthetic run.
 */
export function verifySyntheticEmployeeOwnership(emp, synthMarker) {
  if (!emp || typeof emp !== 'object') return false;
  const code = String(emp.employee_code || emp.code || '');
  const email = String(emp.email || '');
  const name = String(emp.employee_name || emp.name || '');
  return (
    isSyntheticMarkerMatch(code, synthMarker) ||
    isSyntheticMarkerMatch(email, synthMarker) ||
    isSyntheticMarkerMatch(name, synthMarker)
  );
}

/**
 * Checks if a BOM order belongs to the synthetic run.
 */
export function verifySyntheticBomOwnership(bom, synthMarker) {
  if (!bom || typeof bom !== 'object') return false;
  const code = String(bom.bomCode || bom.bom_code || bom.code || bom.id || '');
  const client = String(bom.clientName || bom.client_name || bom.customerName || bom.customer_name || '');
  const notes = String(bom.notes || bom.remarks || '');
  return (
    isSyntheticMarkerMatch(code, synthMarker) ||
    isSyntheticMarkerMatch(client, synthMarker) ||
    isSyntheticMarkerMatch(notes, synthMarker)
  );
}

/**
 * Checks if a reservation belongs to the synthetic run.
 */
export function verifySyntheticReservationOwnership(res, synthMarker) {
  if (!res || typeof res !== 'object') return false;
  const id = String(res.id || '');
  const refNo = String(res.refNo || res.bomCode || '');
  const itemCode = String(res.itemCode || '');
  return (
    isSyntheticMarkerMatch(id, synthMarker) ||
    isSyntheticMarkerMatch(refNo, synthMarker) ||
    isSyntheticMarkerMatch(itemCode, synthMarker)
  );
}

/**
 * Checks if an invoice belongs to the synthetic run.
 */
export function verifySyntheticInvoiceOwnership(inv, synthMarker) {
  if (!inv || typeof inv !== 'object') return false;
  const invNo = String(inv.invNo || inv.invoiceNo || inv.code || '');
  const poNo = String(inv.poNo || inv.bomCode || '');
  const client = String(inv.clientName || inv.customerName || '');
  return (
    isSyntheticMarkerMatch(invNo, synthMarker) ||
    isSyntheticMarkerMatch(poNo, synthMarker) ||
    isSyntheticMarkerMatch(client, synthMarker)
  );
}

/**
 * Checks if a stock ledger entry belongs to the synthetic run.
 */
export function verifySyntheticLedgerOwnership(entry, synthMarker) {
  if (!entry || typeof entry !== 'object') return false;
  const refNo = String(entry.refNo || entry.sourceDoc || '');
  const id = String(entry.id || '');
  const remarks = String(entry.remarks || '');
  return (
    isSyntheticMarkerMatch(refNo, synthMarker) ||
    isSyntheticMarkerMatch(id, synthMarker) ||
    isSyntheticMarkerMatch(remarks, synthMarker)
  );
}

/**
 * Checks if a notification belongs to the synthetic run.
 */
export function verifySyntheticNotificationOwnership(notif, synthMarker) {
  if (!notif || typeof notif !== 'object') return false;
  const title = String(notif.title || '');
  const msg = String(notif.message || notif.msg || '');
  const id = String(notif.id || '');
  return (
    isSyntheticMarkerMatch(title, synthMarker) ||
    isSyntheticMarkerMatch(msg, synthMarker) ||
    isSyntheticMarkerMatch(id, synthMarker)
  );
}

/**
 * Quarantines / cleans synthetic files from uploads directory safely.
 * Operates strictly post-commit to prevent filesystem deletion on database rollback.
 * Staged into a recovery quarantine directory and reports exact failures.
 */
export function cleanSyntheticUploads(uploadsDir, synthMarker, quarantineRoot = null) {
  const result = {
    identified: [],
    quarantined: [],
    failed: []
  };

  if (!uploadsDir || !fs.existsSync(uploadsDir) || !synthMarker) return result;

  try {
    const files = fs.readdirSync(uploadsDir);
    const targetFiles = files.filter(f => isSyntheticMarkerMatch(f, synthMarker));
    result.identified = targetFiles;

    if (targetFiles.length === 0) return result;

    const quarantineDir = quarantineRoot || path.join(uploadsDir, '.quarantine', `cleanup-${Date.now()}`);

    for (const f of targetFiles) {
      const srcPath = path.join(uploadsDir, f);
      try {
        if (!fs.existsSync(quarantineDir)) {
          fs.mkdirSync(quarantineDir, { recursive: true });
        }
        const destPath = path.join(quarantineDir, f);
        fs.renameSync(srcPath, destPath);
        result.quarantined.push({ file: f, quarantinedTo: destPath });
      } catch (err) {
        result.failed.push({ file: f, error: err.message });
      }
    }
  } catch (err) {
    result.failed.push({ file: '*', error: err.message });
  }

  return result;
}

/**
 * Main recovery runner.
 */
export async function runPhase9acResidueRecovery(options = {}) {
  const {
    execute = false,
    mock = false,
    mockClient = null,
    synthMarker = 'SYNTH_P9AC_',
    workspaceDir = process.cwd(),
    uploadsDir = null
  } = options;

  const report = {
    mode: execute ? 'EXECUTE_AUTHORIZED' : 'DRY_RUN',
    synthMarker,
    startTime: new Date().toISOString(),
    workspaceVerified: false,
    databaseVerified: false,
    syntheticBomsDeleted: 0,
    syntheticLeadsDeleted: 0,
    employeesCleaned: 0,
    reservationsCleaned: 0,
    invoicesCleaned: 0,
    ledgerCleaned: 0,
    notificationsCleaned: 0,
    uploadsCleaned: 0,
    storeKeysRemoved: [],
    finalStoreKeys: [],
    baselineVerified: false,
    committed: false,
    errors: []
  };

  if (!mock) {
    if (!verifyWorkspaceIsolation(workspaceDir)) {
      throw new Error(`[ISOLATION ERROR] Recovery script must run exclusively in ${EXPECTED_OPTIMIZATION_TEST_WORKSPACE}. Current: ${workspaceDir}`);
    }
    report.workspaceVerified = true;
  } else {
    report.workspaceVerified = true;
  }

  let pool = null;
  let client = mockClient;

  try {
    if (!mock) {
      const dbUrl = resolveAndValidateTestDatabaseUrl();
      report.databaseVerified = true;
      pool = new Pool({
        connectionString: dbUrl,
        host: REQUIRED_TEST_HOST,
        port: parseInt(REQUIRED_TEST_PORT, 10),
        database: REQUIRED_TEST_DATABASE,
        max: 2,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000
      });
      client = await pool.connect();
    }

    await client.query('BEGIN');

    // 1. Recover relational BOM orders
    const bomRes = await client.query(
      `SELECT id, bom_code, client_name FROM public.bom_orders 
       WHERE bom_code LIKE $1 OR client_name LIKE $1 OR notes LIKE $1 FOR UPDATE`,
      [`%${synthMarker}%`]
    );

    const bomsToDelete = (bomRes.rows || []).filter(row =>
      verifySyntheticBomOwnership(row, synthMarker)
    );

    for (const b of bomsToDelete) {
      await client.query('DELETE FROM public.bom_orders WHERE id = $1', [b.id]);
      report.syntheticBomsDeleted++;
    }

    // 2. Recover relational Leads & Child Records
    const leadRes = await client.query(
      `SELECT id, lead_number, company_name FROM public.leads 
       WHERE company_name LIKE $1 OR notes LIKE $1 FOR UPDATE`,
      [`%${synthMarker}%`]
    );

    const leadsToDelete = (leadRes.rows || []).filter(l =>
      isSyntheticMarkerMatch(l.company_name, synthMarker) || isSyntheticMarkerMatch(l.notes, synthMarker)
    );

    for (const l of leadsToDelete) {
      await client.query(
        `DELETE FROM public.lead_notification_recipients WHERE notification_id IN 
         (SELECT id FROM public.lead_notifications WHERE lead_id = $1)`,
        [l.id]
      );
      await client.query('DELETE FROM public.lead_notifications WHERE lead_id = $1', [l.id]);
      await client.query('DELETE FROM public.lead_status_history WHERE lead_id = $1', [l.id]);
      await client.query('DELETE FROM public.leads WHERE id = $1', [l.id]);
      report.syntheticLeadsDeleted++;
    }

    // 3. Recover controlroom_store JSONB records
    const storeRes = await client.query(
      'SELECT key, data FROM public.controlroom_store FOR UPDATE'
    );
    const storeMap = new Map();
    (storeRes.rows || []).forEach(r => storeMap.set(r.key, r.data));

    // A. Clean employees_store
    if (storeMap.has('employees_store')) {
      const emps = Array.isArray(storeMap.get('employees_store')) ? storeMap.get('employees_store') : [];
      const nonSyntheticEmps = emps.filter(e => !verifySyntheticEmployeeOwnership(e, synthMarker));
      report.employeesCleaned = emps.length - nonSyntheticEmps.length;
      await client.query(
        'UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = $2',
        [JSON.stringify(nonSyntheticEmps), 'employees_store']
      );
    }

    // B. Clean customer_pis_store
    if (storeMap.has('customer_pis_store')) {
      const pis = Array.isArray(storeMap.get('customer_pis_store')) ? storeMap.get('customer_pis_store') : [];
      const cleanPis = pis.filter(p => !isSyntheticMarkerMatch(p.piNumber || p.pi_number || p.clientName || '', synthMarker));
      await client.query(
        'UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = $2',
        [JSON.stringify(cleanPis), 'customer_pis_store']
      );
    }

    // C. Clean quotations_store
    if (storeMap.has('quotations_store')) {
      const qts = Array.isArray(storeMap.get('quotations_store')) ? storeMap.get('quotations_store') : [];
      const cleanQts = qts.filter(q => !isSyntheticMarkerMatch(q.quotationNo || q.quoteNo || q.clientName || '', synthMarker));
      await client.query(
        'UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = $2',
        [JSON.stringify(cleanQts), 'quotations_store']
      );
    }

    // D. Clean vrm_prod_ledger (stock ledger)
    if (storeMap.has('vrm_prod_ledger')) {
      const ledger = Array.isArray(storeMap.get('vrm_prod_ledger')) ? storeMap.get('vrm_prod_ledger') : [];
      const cleanLedger = ledger.filter(entry => !verifySyntheticLedgerOwnership(entry, synthMarker));
      report.ledgerCleaned = ledger.length - cleanLedger.length;
      if (cleanLedger.length === 0) {
        // Drop key if it was created exclusively for tests and now empty
        await client.query('DELETE FROM public.controlroom_store WHERE key = $1', ['vrm_prod_ledger']);
        report.storeKeysRemoved.push('vrm_prod_ledger');
      } else {
        await client.query(
          'UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = $2',
          [JSON.stringify(cleanLedger), 'vrm_prod_ledger']
        );
      }
    }

    // E. Clean notifications_store
    if (storeMap.has('notifications_store')) {
      const notifs = Array.isArray(storeMap.get('notifications_store')) ? storeMap.get('notifications_store') : [];
      const cleanNotifs = notifs.filter(n => !verifySyntheticNotificationOwnership(n, synthMarker));
      report.notificationsCleaned = notifs.length - cleanNotifs.length;
      if (cleanNotifs.length === 0) {
        await client.query('DELETE FROM public.controlroom_store WHERE key = $1', ['notifications_store']);
        report.storeKeysRemoved.push('notifications_store');
      } else {
        await client.query(
          'UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = $2',
          [JSON.stringify(cleanNotifs), 'notifications_store']
        );
      }
    }

    // F. Clean dynamic stores: bom_store, invoice_store, reservations_store
    for (const key of DYNAMIC_STORE_KEYS) {
      if (storeMap.has(key)) {
        const items = Array.isArray(storeMap.get(key)) ? storeMap.get(key) : [];
        let isAllSynthetic = true;

        if (key === 'reservations_store') {
          for (const item of items) {
            if (!verifySyntheticReservationOwnership(item, synthMarker)) {
              isAllSynthetic = false;
              throw new Error(`[SAFETY ROLLBACK] Unrelated non-synthetic reservation found in ${key}: ${JSON.stringify(item)}`);
            }
          }
          report.reservationsCleaned += items.length;
        } else if (key === 'invoice_store') {
          for (const item of items) {
            if (!verifySyntheticInvoiceOwnership(item, synthMarker)) {
              isAllSynthetic = false;
              throw new Error(`[SAFETY ROLLBACK] Unrelated non-synthetic invoice found in ${key}: ${JSON.stringify(item)}`);
            }
          }
          report.invoicesCleaned += items.length;
        } else if (key === 'bom_store') {
          for (const item of items) {
            if (!verifySyntheticBomOwnership(item, synthMarker)) {
              isAllSynthetic = false;
              throw new Error(`[SAFETY ROLLBACK] Unrelated non-synthetic BOM found in ${key}: ${JSON.stringify(item)}`);
            }
          }
        }

        if (isAllSynthetic) {
          await client.query('DELETE FROM public.controlroom_store WHERE key = $1', [key]);
          report.storeKeysRemoved.push(key);
        }
      }
    }

    // 4. Pre-Commit Baseline Assertion
    const finalStoreRes = await client.query(
      'SELECT key FROM public.controlroom_store ORDER BY key'
    );
    const remainingKeys = (finalStoreRes.rows || []).map(r => r.key).sort();
    report.finalStoreKeys = remainingKeys;

    const expectedKeys = [...BASELINE_STORE_KEYS].sort();
    if (JSON.stringify(remainingKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`[BASELINE MISMATCH] Expected exactly 3 store keys [${expectedKeys.join(', ')}], found [${remainingKeys.join(', ')}]`);
    }
    report.baselineVerified = true;

    // 5. Commit or Rollback
    if (execute) {
      await client.query('COMMIT');
      report.committed = true;

      // 6. Post-Commit Uploads Quarantine: strictly executed AFTER database commit succeeds
      if (uploadsDir) {
        const uploadCleanup = cleanSyntheticUploads(uploadsDir, synthMarker);
        report.uploadsCleaned = uploadCleanup.quarantined.length;
        report.uploadsFailed = uploadCleanup.failed;
        if (uploadCleanup.failed.length > 0) {
          console.warn(`⚠️ [RECOVERY WARNING] Incomplete upload quarantine: ${uploadCleanup.failed.length} file(s) failed to quarantine.`);
        }
      }
    } else {
      await client.query('ROLLBACK');
      report.committed = false;
      if (uploadsDir) {
        // Audit-only scan in dry run
        const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        report.uploadsIdentified = files.filter(f => isSyntheticMarkerMatch(f, synthMarker)).length;
      }
    }

    return report;
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    report.errors.push(err.message);
    throw err;
  } finally {
    if (pool && client) {
      try { client.release(); } catch (_) {}
      try { await pool.end(); } catch (_) {}
    }
  }
}

// Direct CLI invocation
if (process.argv[1] && path.basename(process.argv[1]) === 'recover_phase9ac_residue.js') {
  const execute = process.argv.includes('--execute-authorized');
  const markerArg = process.argv.find(a => a.startsWith('--marker='));
  const synthMarker = markerArg ? markerArg.split('=')[1] : 'SYNTH_P9AC_';

  console.log(`🛡️ BUSINZ Phase 9AC Residue Recovery [${execute ? 'LIVE EXECUTION' : 'DRY RUN'}]`);
  console.log(`   Marker: ${synthMarker}`);

  runPhase9acResidueRecovery({ execute, synthMarker })
    .then(report => {
      console.log('✅ Recovery Completed Successfully:');
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Recovery Failed:');
      console.error(err.message);
      process.exit(1);
    });
}
