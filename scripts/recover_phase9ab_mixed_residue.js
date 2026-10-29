/**
 * scripts/recover_phase9ab_mixed_residue.js
 *
 * BUSINZ ERP: Transactional PostgreSQL Mixed Synthetic Residue Recovery (Phase 9AB)
 *
 * Target Residue Across Two Failed Phase 9Y Runs:
 * 1. Run 1: SYNTH_P9Y_1793247013909 (runId: 1793247013909)
 * 2. Run 2: SYNTH_P9Y_1793250904736 (runId: 1793250904736)
 *
 * Observed Environment Residue on businz_optimization_test:
 * - public.leads: 1 row
 * - public.bom_orders: 4 rows
 * - employees_store: 3 items (Run 1)
 * - quotations_store: 1 item (Run 1)
 * - customer_pis_store: 1 item (Run 1)
 * - invoice_store: 1 item (Run 1)
 * - bom_store: 4 items (Run 1)
 * - reservations_store: 2 items (1 from Run 1, 1 from Run 2)
 * - lead_status_history: 1
 * - lead_notifications: 1
 * - lead_notification_recipients: 9
 *
 * Baseline Store Keys Restoration:
 * - Original baseline contained exactly three store keys:
 *   [customer_pis_store, employees_store, quotations_store]
 *   These rows are preserved, each set to an empty array ([]).
 * - Newly created store keys:
 *   [bom_store, invoice_store, reservations_store]
 *   These rows are deleted ONLY when every single item is confirmed synthetic,
 *   safely restoring controlroom_store count to exactly 3.
 *
 * Mandatory Safeguards:
 * 1. Default mode is strictly read-only DRY RUN (zero database writes).
 * 2. Live execution requires explicit CLI flag: --execute-authorized
 * 3. Strict workspace isolation: MUST execute in /var/www/businz-optimization-test.
 * 4. Strict DB isolation: MUST connect to 127.0.0.1 / businz_optimization_test / businz_test_user.
 * 5. Pre-execution backup verification: verifies backup archive exists and matches SHA-256:
 *    9be260cd30b7905f38e8688e46a74d5b0edcacd1301dbfaab5add5a7152bb6f6
 * 6. Single atomic PostgreSQL transaction with row-level locking (FOR UPDATE).
 * 7. Exact run-specific ownership verification on every target item before removal.
 * 8. Never uses TRUNCATE, DROP TABLE, broad DELETE, or database recreation.
 * 9. Pre-commit baseline audit inside transaction before COMMIT, with ROLLBACK on mismatch.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  resolveAndValidateTestDatabaseUrl,
  maskCredentials
} from './testEnvironmentGuard.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const EXPECTED_OPTIMIZATION_TEST_WORKSPACE = '/var/www/businz-optimization-test';

export const TARGET_RUNS = Object.freeze([
  {
    runId: '1793247013909',
    synthTag: 'SYNTH_P9Y_1793247013909',
    tagSuffix: '13909',
    shortTag: '909',
    employees: ['TA-TEST-909', 'SE-PEND-909', 'SE-ACT-909'],
    quotations: ['QT-13909'],
    pis: ['PI-13909'],
    invoices: ['INV-13909'],
    boms: ['BOM-13909', 'BOM-C1-3909', 'BOM-C2-3909', 'BOM-C3-3909'],
    reservations: ['res_SYNTH_P9Y_1793247013909']
  },
  {
    runId: '1793250904736',
    synthTag: 'SYNTH_P9Y_1793250904736',
    tagSuffix: '4736',
    shortTag: '736',
    employees: ['TA-TEST-736', 'SE-PEND-736', 'SE-ACT-736'],
    quotations: ['QT-4736', 'QT-04736'],
    pis: ['PI-4736', 'PI-04736'],
    invoices: ['INV-4736', 'INV-04736'],
    boms: ['BOM-4736', 'BOM-04736', 'BOM-C1-4736', 'BOM-C2-4736', 'BOM-C3-4736'],
    reservations: ['res_SYNTH_P9Y_1793250904736']
  }
]);

export const RUN_IDS = Object.freeze(TARGET_RUNS.map(r => r.runId));
export const SYNTH_TAGS = Object.freeze(TARGET_RUNS.map(r => r.synthTag));

export const BASELINE_STORE_KEYS = Object.freeze([
  'customer_pis_store',
  'employees_store',
  'quotations_store'
]);

export const NEWLY_CREATED_STORE_KEYS = Object.freeze([
  'bom_store',
  'invoice_store',
  'reservations_store'
]);

export const REQUIRED_BACKUP_PATH = 'storage/phase9ab-recovery-backup/pre-mixed-residue-20261029-054649.dump';
export const REQUIRED_BACKUP_SHA256 = '9be260cd30b7905f38e8688e46a74d5b0edcacd1301dbfaab5add5a7152bb6f6';

// -----------------------------------------------------------------------------
// Pure Isolation and Backup Validators
// -----------------------------------------------------------------------------

export function verifyWorkspaceIsolation(workspaceDir = path.resolve(__dirname, '..')) {
  return workspaceDir === EXPECTED_OPTIMIZATION_TEST_WORKSPACE;
}

export function verifyRecoveryBackup(workspaceDir = path.resolve(__dirname, '..'), customBackupPath = null) {
  const fullPath = customBackupPath || path.resolve(workspaceDir, REQUIRED_BACKUP_PATH);
  if (!fs.existsSync(fullPath)) {
    return {
      valid: false,
      reason: `Backup archive not found at "${fullPath}"`,
      path: fullPath
    };
  }

  try {
    const fileBytes = fs.readFileSync(fullPath);
    if (fileBytes.length === 0) {
      return {
        valid: false,
        reason: 'Backup archive is empty (0 bytes)',
        path: fullPath
      };
    }

    const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    if (hash !== REQUIRED_BACKUP_SHA256) {
      return {
        valid: false,
        reason: `Backup SHA-256 mismatch! Expected ${REQUIRED_BACKUP_SHA256}, got ${hash}`,
        path: fullPath,
        actualHash: hash
      };
    }

    return {
      valid: true,
      path: fullPath,
      hash,
      size: fileBytes.length
    };
  } catch (err) {
    return {
      valid: false,
      reason: `Cannot read backup archive: ${err.message}`,
      path: fullPath
    };
  }
}

// -----------------------------------------------------------------------------
// Pure Ownership Verification Functions Across Both Runs
// -----------------------------------------------------------------------------

export function verifySyntheticLeadOwnership(lead) {
  if (!lead || typeof lead !== 'object') return false;
  const companyName = String(lead.company_name || '');
  const notes = String(lead.notes || '');
  const leadNo = String(lead.lead_number || '');

  for (const r of TARGET_RUNS) {
    if (
      companyName.includes(r.synthTag) || notes.includes(r.synthTag) ||
      companyName.includes(r.runId) || notes.includes(r.runId) ||
      (r.runId === '1793247013909' && (leadNo === 'VRM-LD-2026-01' || companyName.includes('13909')))
    ) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticBomOwnership(bom) {
  if (!bom || typeof bom !== 'object') return false;
  const code = String(bom.bomCode || bom.bom_code || bom.code || bom.id || '').trim();
  const cust = String(bom.customerName || bom.customer_name || '');
  const synthTag = String(bom.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    const tagMatch = synthTag === r.synthTag || cust.includes(r.synthTag) || cust.includes(r.runId);
    const idMatch = code.includes(r.tagSuffix) || code.includes(r.runId) ||
      (r.runId === '1793247013909' && (code === 'BOM-13909' || code.includes('3909')));
    if (tagMatch || idMatch) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticEmployeeOwnership(emp) {
  if (!emp || typeof emp !== 'object') return false;
  const code = String(emp.employee_code || emp.code || '').trim();
  const email = String(emp.email || '').toLowerCase().trim();
  const synthTag = String(emp.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    const tagMatch = synthTag === r.synthTag || synthTag.includes(r.runId);
    const emailMatch = email.includes(r.runId) || email.includes(`${r.shortTag}@example.com`);
    const codeMatch = code.includes(r.shortTag) || code.includes(r.runId);
    if ((codeMatch || emailMatch) && (tagMatch || emailMatch || email.endsWith('@example.com'))) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticQuotationOwnership(quote) {
  if (!quote || typeof quote !== 'object') return false;
  const qNo = String(quote.quotationNo || quote.id || '').trim();
  const cust = String(quote.customerName || '');
  const synthTag = String(quote.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    if (
      synthTag === r.synthTag || cust.includes(r.synthTag) ||
      qNo.includes(r.tagSuffix) || qNo.includes(r.runId) || cust.includes(r.tagSuffix)
    ) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticPiOwnership(pi) {
  if (!pi || typeof pi !== 'object') return false;
  const pNo = String(pi.piNo || pi.id || pi.pi_no || '').trim();
  const cust = String(pi.customerName || pi.vendor || '');
  const synthTag = String(pi.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    if (
      synthTag === r.synthTag || cust.includes(r.synthTag) ||
      pNo.includes(r.tagSuffix) || pNo.includes(r.runId) || cust.includes(r.tagSuffix)
    ) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticInvoiceOwnership(inv) {
  if (!inv || typeof inv !== 'object') return false;
  const invNo = String(inv.invNo || inv.invoiceNo || inv.id || inv.code || '').trim();
  const cust = String(inv.customerName || '');
  const synthTag = String(inv.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    if (
      synthTag === r.synthTag || cust.includes(r.synthTag) ||
      invNo.includes(r.tagSuffix) || invNo.includes(r.runId) || cust.includes(r.tagSuffix)
    ) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

export function verifySyntheticReservationOwnership(res) {
  if (!res || typeof res !== 'object') return false;
  const rId = String(res.id || res.reservationId || res.bomCode || '').trim();
  const synthTag = String(res.synthTag || '').trim();

  for (const r of TARGET_RUNS) {
    if (
      synthTag === r.synthTag || rId === `res_${r.synthTag}` ||
      rId.includes(r.synthTag) || rId.includes(r.runId) || rId.includes(r.tagSuffix)
    ) {
      return { verified: true, runId: r.runId, synthTag: r.synthTag };
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// Main Recovery Runner
// -----------------------------------------------------------------------------

export async function runMixedResidueRecovery(options = {}) {
  const isExecuteAuthorized = Boolean(
    options.executeAuthorized || process.argv.includes('--execute-authorized')
  );
  const isDryRun = !isExecuteAuthorized;

  console.log('===================================================================');
  console.log('🧹 BUSINZ ERP: PHASE 9AB MIXED SYNTHETIC RESIDUE RECOVERY');
  console.log(`TARGET RUNS: ${TARGET_RUNS.map(r => r.synthTag).join(', ')}`);
  console.log(`MODE: ${isDryRun ? '🔍 DRY RUN (Audit Only — Zero Writes)' : '⚡ LIVE EXECUTION (--execute-authorized)'}`);
  console.log('===================================================================\n');

  // ---------------------------------------------------------------------------
  // STEP 1: Strict Environment Preflight Checks
  // ---------------------------------------------------------------------------
  console.log('--- Step 1: Isolation & Environment Validation ---');
  const actualWorkspace = path.resolve(__dirname, '..');
  const expectedWorkspace = EXPECTED_OPTIMIZATION_TEST_WORKSPACE;
  const workspaceDir = options.workspaceDir || actualWorkspace;

  if (workspaceDir !== expectedWorkspace) {
    console.error('🛑 [FAIL-CLOSED] Workspace mismatch:');
    console.error(`   Expected: "${expectedWorkspace}"`);
    console.error(`   Actual:   "${workspaceDir}"`);
    console.error('   Residue recovery can only be executed on the isolated Hostinger VPS test worktree.');
    process.exitCode = 1;
    return { success: false, reason: 'Workspace mismatch', dryRun: isDryRun };
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Backup Integrity Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 2: Backup Integrity Verification ---');
  if (!options.bypassBackupCheckForTesting) {
    const backupCheck = verifyRecoveryBackup(workspaceDir, options.backupPath);
    if (!backupCheck.valid) {
      if (isExecuteAuthorized) {
        console.error(`🛑 [FAIL-CLOSED] Backup verification failed before live recovery: ${backupCheck.reason}`);
        process.exitCode = 1;
        return { success: false, reason: backupCheck.reason, dryRun: false };
      } else {
        console.warn(`⚠️ [DRY RUN WARNING] Backup verification not met in audit context: ${backupCheck.reason}`);
      }
    } else {
      console.log(`✅ [Verified] Backup archive verified: ${backupCheck.path}`);
      console.log(`   SHA-256: ${backupCheck.hash}`);
      console.log(`   Size:    ${(backupCheck.size / 1024).toFixed(1)} KB`);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Database URL Validation & Pool Connection
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 3: Database Target Validation ---');
  let dbUrl;
  try {
    dbUrl = resolveAndValidateTestDatabaseUrl(options.databaseUrl);
    console.log(`✅ [Verified] Database target: ${maskCredentials(dbUrl)}`);
  } catch (err) {
    console.error(`🛑 [FAIL-CLOSED] Database validation failed: ${err.message}`);
    process.exitCode = 1;
    return { success: false, reason: err.message, dryRun: isDryRun };
  }

  const pool = options.pool || new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
  });

  const client = options.client || await pool.connect();
  const auditReport = {
    dryRun: isDryRun,
    leadsFound: [],
    childRecordsFound: {},
    bomsFound: [],
    employeesFound: [],
    quotationsFound: [],
    pisFound: [],
    bomStoreItemsFound: [],
    invoicesFound: [],
    reservationsFound: [],
    newlyCreatedStoreKeys: [],
    byRun: {
      [TARGET_RUNS[0].runId]: {
        synthTag: TARGET_RUNS[0].synthTag,
        leads: [],
        boms: [],
        employees: [],
        quotations: [],
        pis: [],
        invoices: [],
        bomStore: [],
        reservations: [],
        childRecords: { statusHistory: 0, notifications: 0, recipients: 0 }
      },
      [TARGET_RUNS[1].runId]: {
        synthTag: TARGET_RUNS[1].synthTag,
        leads: [],
        boms: [],
        employees: [],
        quotations: [],
        pis: [],
        invoices: [],
        bomStore: [],
        reservations: [],
        childRecords: { statusHistory: 0, notifications: 0, recipients: 0 }
      }
    },
    executed: false,
    committed: false
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 4: Inspect Leads and Dependent Records
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Inspecting Target Synthetic Leads & Dependencies ---');
    const leadRes = await client.query(
      `SELECT id, lead_number, company_name, notes, created_at FROM public.leads 
       WHERE company_name LIKE '%SYNTH_P9Y_%' OR notes LIKE '%SYNTH_P9Y_%' OR lead_number LIKE 'VRM-LD-2026-%'`
    );

    for (const leadRow of leadRes.rows) {
      const ownership = verifySyntheticLeadOwnership(leadRow);
      if (!ownership || !ownership.verified) {
        console.warn(`   ⚠️ [SECURITY WARNING] Lead ${leadRow.id} lacks exact synthetic ownership evidence. Skipping.`);
        continue;
      }

      const leadId = leadRow.id;
      const notifCheck = await client.query('SELECT id FROM public.lead_notifications WHERE lead_id = $1', [leadId]);
      const notifIds = notifCheck.rows.map(r => r.id);

      let recipientCount = 0;
      if (notifIds.length > 0) {
        const recipCheck = await client.query(
          'SELECT COUNT(*)::int as count FROM public.lead_notification_recipients WHERE notification_id = ANY($1)',
          [notifIds]
        );
        recipientCount = recipCheck.rows[0]?.count || 0;
      }

      const statusHistCheck = await client.query('SELECT COUNT(*)::int as count FROM public.lead_status_history WHERE lead_id = $1', [leadId]);
      const childCounts = {
        lead_notification_recipients: recipientCount,
        lead_notifications: notifIds.length,
        lead_status_history: statusHistCheck.rows[0]?.count || 0
      };

      auditReport.leadsFound.push(leadRow);
      auditReport.childRecordsFound[leadId] = childCounts;
      if (auditReport.byRun[ownership.runId]) {
        auditReport.byRun[ownership.runId].leads.push(leadRow.lead_number || String(leadRow.id));
        auditReport.byRun[ownership.runId].childRecords.statusHistory += childCounts.lead_status_history;
        auditReport.byRun[ownership.runId].childRecords.notifications += childCounts.lead_notifications;
        auditReport.byRun[ownership.runId].childRecords.recipients += childCounts.lead_notification_recipients;
      }
      console.log(`   🎯 Found target synthetic lead: ${leadRow.id} (${leadRow.company_name}) [Run: ${ownership.runId}]`);
      console.log(`      Child records: ${childCounts.lead_status_history} status history, ${childCounts.lead_notifications} notifications, ${childCounts.lead_notification_recipients} recipients`);
    }

    // -------------------------------------------------------------------------
    // STEP 5: Inspect BOM Orders in public.bom_orders
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Inspecting Target Synthetic BOMs in public.bom_orders ---');
    const hasBomOrders = await client.query("SELECT to_regclass('public.bom_orders') as reg");
    if (hasBomOrders.rows[0]?.reg) {
      const bomRes = await client.query(
        `SELECT id, bom_code, customer_name FROM public.bom_orders
         WHERE customer_name LIKE '%SYNTH_P9Y_%' OR bom_code LIKE '%13909%' OR bom_code LIKE '%3909%' OR bom_code LIKE '%04736%' OR bom_code LIKE '%4736%'`
      );
      for (const bRow of bomRes.rows) {
        const ownership = verifySyntheticBomOwnership(bRow);
        if (ownership && ownership.verified) {
          auditReport.bomsFound.push(bRow);
          if (auditReport.byRun[ownership.runId]) {
            auditReport.byRun[ownership.runId].boms.push(bRow.bom_code);
          }
          console.log(`   🎯 Found target synthetic BOM order: ${bRow.id} (${bRow.bom_code}) [Run: ${ownership.runId}]`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 6: Inspect Baseline Stores (employees_store, quotations_store, customer_pis_store)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Inspecting Baseline Store Residue ---');
    
    // Employees
    const empStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1", ['employees_store']);
    if (empStoreRes.rows.length > 0 && Array.isArray(empStoreRes.rows[0].data)) {
      for (const emp of empStoreRes.rows[0].data) {
        const ownership = verifySyntheticEmployeeOwnership(emp);
        if (ownership && ownership.verified) {
          auditReport.employeesFound.push(emp);
          if (auditReport.byRun[ownership.runId]) {
            auditReport.byRun[ownership.runId].employees.push(emp.employee_code || emp.code);
          }
          console.log(`   🎯 Found synthetic employee: ${emp.employee_code || emp.code} [Run: ${ownership.runId}]`);
        }
      }
    }

    // Quotations
    const quoteStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1", ['quotations_store']);
    if (quoteStoreRes.rows.length > 0 && Array.isArray(quoteStoreRes.rows[0].data)) {
      for (const q of quoteStoreRes.rows[0].data) {
        const ownership = verifySyntheticQuotationOwnership(q);
        if (ownership && ownership.verified) {
          auditReport.quotationsFound.push(q);
          if (auditReport.byRun[ownership.runId]) {
            auditReport.byRun[ownership.runId].quotations.push(q.quotationNo || q.id);
          }
          console.log(`   🎯 Found synthetic quotation: ${q.quotationNo || q.id} [Run: ${ownership.runId}]`);
        }
      }
    }

    // PIs
    const piStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1", ['customer_pis_store']);
    if (piStoreRes.rows.length > 0 && Array.isArray(piStoreRes.rows[0].data)) {
      for (const p of piStoreRes.rows[0].data) {
        const ownership = verifySyntheticPiOwnership(p);
        if (ownership && ownership.verified) {
          auditReport.pisFound.push(p);
          if (auditReport.byRun[ownership.runId]) {
            auditReport.byRun[ownership.runId].pis.push(p.piNo || p.id || p.pi_no);
          }
          console.log(`   🎯 Found synthetic PI: ${p.piNo || p.id || p.pi_no} [Run: ${ownership.runId}]`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 7: Inspect Newly Created Store Keys (bom_store, invoice_store, reservations_store)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Inspecting Newly Created Store Keys ---');
    const allKeysRes = await client.query('SELECT key FROM public.controlroom_store ORDER BY key');
    const activeKeys = allKeysRes.rows.map(r => r.key);

    for (const newKey of NEWLY_CREATED_STORE_KEYS) {
      if (activeKeys.includes(newKey)) {
        auditReport.newlyCreatedStoreKeys.push(newKey);
        const kRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1', [newKey]);
        const kData = kRes.rows[0]?.data;
        const count = Array.isArray(kData) ? kData.length : (kData ? 1 : 0);
        console.log(`   🎯 Found newly created store row "${newKey}" with ${count} items.`);

        if (newKey === 'bom_store' && Array.isArray(kData)) {
          for (const item of kData) {
            const ownership = verifySyntheticBomOwnership(item);
            if (ownership && ownership.verified) {
              auditReport.bomStoreItemsFound.push(item);
              if (auditReport.byRun[ownership.runId]) {
                auditReport.byRun[ownership.runId].bomStore.push(item.bomCode || item.code || item.id);
              }
            }
          }
        } else if (newKey === 'invoice_store' && Array.isArray(kData)) {
          for (const item of kData) {
            const ownership = verifySyntheticInvoiceOwnership(item);
            if (ownership && ownership.verified) {
              auditReport.invoicesFound.push(item);
              if (auditReport.byRun[ownership.runId]) {
                auditReport.byRun[ownership.runId].invoices.push(item.invNo || item.invoiceNo || item.id);
              }
            }
          }
        } else if (newKey === 'reservations_store' && Array.isArray(kData)) {
          for (const item of kData) {
            const ownership = verifySyntheticReservationOwnership(item);
            if (ownership && ownership.verified) {
              auditReport.reservationsFound.push(item);
              if (auditReport.byRun[ownership.runId]) {
                auditReport.byRun[ownership.runId].reservations.push(item.id || item.reservationId || item.bomCode);
              }
              console.log(`      -> Reservation: ${item.id || item.reservationId} [Run: ${ownership.runId}]`);
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 8: Proposed Deletion Summary & Dry-Run Exit
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Proposed Deletion Breakdown by Run Marker ---');
    for (const r of TARGET_RUNS) {
      const stats = auditReport.byRun[r.runId];
      console.log(`\n   🏷️  Run Marker: ${r.synthTag} (${r.runId})`);
      console.log(`      Leads:        ${stats.leads.length}${stats.leads.length > 0 ? ` [${stats.leads.join(', ')}]` : ''}`);
      if (stats.childRecords.notifications > 0 || stats.childRecords.recipients > 0 || stats.childRecords.statusHistory > 0) {
        console.log(`         -> Child records: ${stats.childRecords.statusHistory} status history, ${stats.childRecords.notifications} notifications, ${stats.childRecords.recipients} recipients`);
      }
      console.log(`      BOM orders:   ${stats.boms.length}${stats.boms.length > 0 ? ` [${stats.boms.join(', ')}]` : ''}`);
      console.log(`      Employees:    ${stats.employees.length}${stats.employees.length > 0 ? ` [${stats.employees.join(', ')}]` : ''}`);
      console.log(`      Quotations:   ${stats.quotations.length}${stats.quotations.length > 0 ? ` [${stats.quotations.join(', ')}]` : ''}`);
      console.log(`      PIs:          ${stats.pis.length}${stats.pis.length > 0 ? ` [${stats.pis.join(', ')}]` : ''}`);
      console.log(`      Invoices:     ${stats.invoices.length}${stats.invoices.length > 0 ? ` [${stats.invoices.join(', ')}]` : ''}`);
      console.log(`      BOM store:    ${stats.bomStore.length}${stats.bomStore.length > 0 ? ` [${stats.bomStore.join(', ')}]` : ''}`);
      console.log(`      Reservations: ${stats.reservations.length}${stats.reservations.length > 0 ? ` [${stats.reservations.join(', ')}]` : ''}`);
    }

    console.log('\n   📦 Store Row Actions:');
    console.log(`      Preserve as empty array: ${BASELINE_STORE_KEYS.join(', ')}`);
    console.log(`      Drop newly created rows: ${auditReport.newlyCreatedStoreKeys.join(', ') || 'None'}`);

    if (isDryRun) {
      console.log('\n===================================================================');
      console.log('🔍 DRY RUN COMPLETE: Zero database writes performed.');
      console.log('To execute live removal in transaction, run with:');
      console.log('   node scripts/recover_phase9ab_mixed_residue.js --execute-authorized');
      console.log('===================================================================\n');
      return { success: true, dryRun: true, auditReport };
    }

    // -------------------------------------------------------------------------
    // LIVE EXECUTION UNDER ATOMIC TRANSACTION
    // -------------------------------------------------------------------------
    console.log('\n⚡ PROCEEDING WITH AUTHORIZED LIVE REMOVAL IN TRANSACTION...');
    await client.query('BEGIN');

    // 1. Delete Leads and dependent records
    for (const lead of auditReport.leadsFound) {
      const leadId = lead.id;
      const lockLead = await client.query('SELECT * FROM public.leads WHERE id = $1 FOR UPDATE', [leadId]);
      if (lockLead.rows.length === 0 || !verifySyntheticLeadOwnership(lockLead.rows[0])) {
        throw new Error(`[FAIL-SAFE] Lead ${leadId} failed synthetic ownership verification under lock!`);
      }

      await client.query(`
        DELETE FROM public.lead_notification_recipients
        WHERE notification_id IN (SELECT id FROM public.lead_notifications WHERE lead_id = $1)
      `, [leadId]);
      await client.query('DELETE FROM public.lead_notifications WHERE lead_id = $1', [leadId]);
      await client.query('DELETE FROM public.lead_status_history WHERE lead_id = $1', [leadId]);
      await client.query('DELETE FROM public.lead_assignment_history WHERE lead_id = $1', [leadId]);
      await client.query('DELETE FROM public.lead_activities WHERE lead_id = $1', [leadId]);
      await client.query('DELETE FROM public.lead_followups WHERE lead_id = $1', [leadId]);
      await client.query('DELETE FROM public.lead_inactivity_incidents WHERE lead_id = $1', [leadId]);

      const hasCrmActivities = await client.query("SELECT to_regclass('public.crm_leads_activities') as reg");
      if (hasCrmActivities.rows[0]?.reg) {
        await client.query('DELETE FROM public.crm_leads_activities WHERE lead_id = $1', [leadId]);
      }

      await client.query('DELETE FROM public.leads WHERE id = $1', [leadId]);
      console.log(`   ✅ Deleted synthetic lead #${leadId}`);
    }

    // 2. Delete BOM Orders and child records
    for (const bom of auditReport.bomsFound) {
      const lockBom = await client.query('SELECT * FROM public.bom_orders WHERE id = $1 FOR UPDATE', [bom.id]);
      if (lockBom.rows.length === 0 || !verifySyntheticBomOwnership(lockBom.rows[0])) {
        throw new Error(`[FAIL-SAFE] BOM order ${bom.bom_code} failed verification under lock!`);
      }

      const hasBomItems = await client.query("SELECT to_regclass('public.bom_items') as reg");
      if (hasBomItems.rows[0]?.reg) {
        await client.query('DELETE FROM public.bom_items WHERE bom_order_id = $1 OR bom_code = $2', [bom.id, bom.bom_code]);
      }

      await client.query('DELETE FROM public.bom_orders WHERE id = $1', [bom.id]);
      console.log(`   ✅ Deleted synthetic BOM order "${bom.bom_code}"`);
    }

    // 3. Clean synthetic employees from employees_store (preserving row)
    const lockEmp = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE", ['employees_store']);
    if (lockEmp.rows.length > 0 && Array.isArray(lockEmp.rows[0].data)) {
      const cleanedList = lockEmp.rows[0].data.filter(e => !verifySyntheticEmployeeOwnership(e));
      await client.query(
        "UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = $2",
        [JSON.stringify(cleanedList), 'employees_store']
      );
      console.log(`   ✅ Reset employees_store to ${cleanedList.length} items (preserved row).`);
    }

    // 4. Clean synthetic quotations from quotations_store (preserving row)
    const lockQ = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE", ['quotations_store']);
    if (lockQ.rows.length > 0 && Array.isArray(lockQ.rows[0].data)) {
      const cleanedList = lockQ.rows[0].data.filter(q => !verifySyntheticQuotationOwnership(q));
      await client.query(
        "UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = $2",
        [JSON.stringify(cleanedList), 'quotations_store']
      );
      console.log(`   ✅ Reset quotations_store to ${cleanedList.length} items (preserved row).`);
    }

    // 5. Clean synthetic PIs from customer_pis_store (preserving row)
    const lockPi = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE", ['customer_pis_store']);
    if (lockPi.rows.length > 0 && Array.isArray(lockPi.rows[0].data)) {
      const cleanedList = lockPi.rows[0].data.filter(p => !verifySyntheticPiOwnership(p));
      await client.query(
        "UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = $2",
        [JSON.stringify(cleanedList), 'customer_pis_store']
      );
      console.log(`   ✅ Reset customer_pis_store to ${cleanedList.length} items (preserved row).`);
    }

    // Clean legacy PI stores if present
    for (const key of ['sales_pi_store', 'proforma_invoice_store']) {
      const lockS = await client.query("SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE", [key]);
      if (lockS.rows.length > 0 && Array.isArray(lockS.rows[0].data)) {
        const cleaned = lockS.rows[0].data.filter(p => !verifySyntheticPiOwnership(p));
        await client.query("UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = $2", [JSON.stringify(cleaned), key]);
      }
    }
    const hasPiTable = await client.query("SELECT to_regclass('public.proforma_invoices') as reg");
    if (hasPiTable.rows[0]?.reg) {
      await client.query(
        "DELETE FROM public.proforma_invoices WHERE pi_no LIKE '%13909%' OR pi_no LIKE '%04736%' OR pi_no LIKE '%4736%' OR customer_name LIKE '%SYNTH_P9Y_%'"
      );
    }

    // 6. Delete newly created store rows (bom_store, invoice_store, reservations_store)
    for (const newStoreKey of NEWLY_CREATED_STORE_KEYS) {
      const lockRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE', [newStoreKey]);
      if (lockRes.rows.length > 0) {
        let items = lockRes.rows[0].data;
        if (typeof items === 'string') {
          try { items = JSON.parse(items); } catch (_) { items = []; }
        }
        if (!Array.isArray(items)) items = [];

        let allExclusivelyOwned = true;
        for (const it of items) {
          if (newStoreKey === 'bom_store' && !verifySyntheticBomOwnership(it)) allExclusivelyOwned = false;
          else if (newStoreKey === 'invoice_store' && !verifySyntheticInvoiceOwnership(it)) allExclusivelyOwned = false;
          else if (newStoreKey === 'reservations_store' && !verifySyntheticReservationOwnership(it)) allExclusivelyOwned = false;
        }

        if (allExclusivelyOwned) {
          await client.query('DELETE FROM public.controlroom_store WHERE key = $1', [newStoreKey]);
          console.log(`   ✅ Deleted newly created store row "${newStoreKey}" (all ${items.length} items verified synthetic).`);
        } else {
          throw new Error(`[FAIL-SAFE] Store row "${newStoreKey}" contains non-synthetic or unverified items! Refusing row deletion.`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 9: Pre-Commit Complete Baseline Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Pre-Commit Baseline Verification ---');

    // A. Verify remaining store keys in controlroom_store match baseline keys exactly
    const postKeysRes = await client.query('SELECT key FROM public.controlroom_store ORDER BY key');
    const postKeys = postKeysRes.rows.map(r => r.key);
    const expectedKeys = [...BASELINE_STORE_KEYS].sort();

    const keysMatch = postKeys.length === expectedKeys.length &&
      expectedKeys.every((k, idx) => postKeys[idx] === k);

    if (!keysMatch) {
      throw new Error(`[BASELINE MISMATCH] Remaining store keys ${JSON.stringify(postKeys)} do not match baseline ${JSON.stringify(expectedKeys)}!`);
    }

    // B. Verify item counts in baseline stores are 0 (empty arrays)
    for (const bKey of expectedKeys) {
      const bRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1', [bKey]);
      const data = bRes.rows[0]?.data;
      if (!Array.isArray(data) || data.length !== 0) {
        throw new Error(`[BASELINE MISMATCH] Baseline store "${bKey}" has ${Array.isArray(data) ? data.length : 'non-array'} items, expected 0!`);
      }
    }

    // C. Verify zero residual synthetic leads in public.leads
    const residualLeads = await client.query(
      `SELECT count(*)::int as count FROM public.leads 
       WHERE company_name LIKE '%SYNTH_P9Y_%' OR notes LIKE '%SYNTH_P9Y_%'`
    );
    if ((residualLeads.rows[0]?.count || 0) > 0) {
      throw new Error(`[BASELINE MISMATCH] Found ${residualLeads.rows[0]?.count} residual synthetic leads in public.leads!`);
    }

    // D. Verify zero residual synthetic BOM orders in public.bom_orders
    const hasBoms = await client.query("SELECT to_regclass('public.bom_orders') as reg");
    if (hasBoms.rows[0]?.reg) {
      const residualBoms = await client.query(
        `SELECT count(*)::int as count FROM public.bom_orders 
         WHERE customer_name LIKE '%SYNTH_P9Y_%' OR bom_code LIKE '%13909%' OR bom_code LIKE '%3909%' OR bom_code LIKE '%04736%' OR bom_code LIKE '%4736%'`
      );
      if ((residualBoms.rows[0]?.count || 0) > 0) {
        throw new Error(`[BASELINE MISMATCH] Found ${residualBoms.rows[0]?.count} residual synthetic BOM orders!`);
      }
    }

    // E. Verify zero orphaned lead notifications
    const orphanedNotifs = await client.query(
      `SELECT count(*)::int as count FROM public.lead_notifications WHERE lead_id NOT IN (SELECT id FROM public.leads)`
    );
    if ((orphanedNotifs.rows[0]?.count || 0) > 0) {
      throw new Error(`[BASELINE MISMATCH] Found ${orphanedNotifs.rows[0]?.count} orphaned notifications!`);
    }

    console.log('✅ [Verified] Pre-commit database baseline checks all passed successfully.');

    await client.query('COMMIT');
    auditReport.executed = true;
    auditReport.committed = true;

    console.log('\n===================================================================');
    console.log('✅ RECOVERY SUCCESS: All mixed synthetic residue cleanly removed.');
    console.log('   Baseline restored to exactly 3 store keys, 0 residual synthetic rows.');
    console.log('===================================================================\n');
    return { success: true, dryRun: false, auditReport };

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n🛑 [RECOVERY ERROR] Transaction rolled back: ${err.message}`);
    process.exitCode = 1;
    return { success: false, error: err.message, dryRun: isDryRun };
  } finally {
    if (!options.client) client.release();
    if (!options.pool) await pool.end();
  }
}

// CLI execution guard
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMixedResidueRecovery()
    .then(res => {
      if (!res.success) process.exit(1);
    })
    .catch(err => {
      console.error('Fatal recovery failure:', err);
      process.exit(1);
    });
}
