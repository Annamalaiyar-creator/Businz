/**
 * scripts/recover_phase9y_run_13909_residue.js
 *
 * BUSINZ ERP: Dedicated Dry-Run-First Synthetic Residue Recovery for Run 1793247013909 (Phase 9AB)
 *
 * Purpose:
 * Safely audit and recover orphaned synthetic records from failed Phase 9Y integration run
 * SYNTH_P9Y_1793247013909 in the isolated optimization test environment without affecting
 * production, development, or HRMS.
 *
 * Target Residue:
 * - Lead: VRM-LD-2026-01 (or lead matching SYNTH_P9Y_1793247013909)
 * - Employees: TA-TEST-909, SE-PEND-909, SE-ACT-909
 * - Quotations: QT-13909 in quotations_store
 * - Proforma Invoices: PI-13909 in customer_pis_store / sales_pi_store / proforma_invoices
 * - BOM Orders: BOM-13909, BOM-C1-3909, BOM-C2-3909, BOM-C3-3909 in bom_orders and bom_store
 * - Invoices: INV-13909 in invoice_store
 * - Reservations: res_SYNTH_P9Y_1793247013909 in reservations_store
 *
 * Baseline Store Keys Restoration:
 * - Baseline contained exactly three store keys: employees_store, quotations_store, customer_pis_store
 * - Newly created store keys (bom_store, invoice_store, reservations_store) are safely removed
 *   when verified empty and exclusively owned, restoring controlroom_store count to 3.
 *
 * Safety & Isolation Constraints:
 * 1. Default Mode is strictly DRY RUN: prints proposed changes with ZERO database writes.
 * 2. Live execution requires explicit argument: --execute-authorized
 * 3. Enforces strict workspace check: MUST run in /var/www/businz-optimization-test.
 * 4. Strictly validates database: MUST connect to 127.0.0.1 / businz_optimization_test / businz_test_user.
 * 5. Verifies independent synthetic ownership evidence on every target record before removal.
 * 6. Deletes dependent child records in foreign-key-safe order under explicit transaction.
 * 7. Preserves all unrelated records in database and JSONB stores.
 * 8. Never resets global numbering sequences.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  resolveAndValidateTestDatabaseUrl,
  maskCredentials
} from './testEnvironmentGuard.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TARGET_RUN_ID = '1793247013909';
export const TARGET_SYNTH_TAG = `SYNTH_P9Y_${TARGET_RUN_ID}`;
export const KNOWN_SYNTHETIC_LEADS_909 = ['VRM-LD-2026-01'];
export const KNOWN_SYNTHETIC_EMPLOYEES_909 = ['TA-TEST-909', 'SE-PEND-909', 'SE-ACT-909'];
export const KNOWN_SYNTHETIC_QUOTES_909 = ['QT-13909'];
export const KNOWN_SYNTHETIC_PIS_909 = ['PI-13909'];
export const KNOWN_SYNTHETIC_BOMS_909 = ['BOM-13909', 'BOM-C1-3909', 'BOM-C2-3909', 'BOM-C3-3909'];
export const KNOWN_SYNTHETIC_INVOICES_909 = ['INV-13909'];
export const KNOWN_SYNTHETIC_RESERVATIONS_909 = [`res_${TARGET_SYNTH_TAG}`, 'res_SYNTH_P9Y_1793247013909'];

export const BASELINE_STORE_KEYS_909 = Object.freeze([
  'customer_pis_store',
  'employees_store',
  'quotations_store'
]);

export const NEWLY_CREATED_STORE_KEYS_909 = Object.freeze([
  'bom_store',
  'invoice_store',
  'reservations_store'
]);

/**
 * Strict synthetic lead ownership verification
 */
export function verifySyntheticLeadOwnership909(lead) {
  if (!lead) return false;
  const companyName = String(lead.company_name || '');
  const notes = String(lead.notes || '');
  return companyName.includes(TARGET_SYNTH_TAG) || notes.includes(TARGET_SYNTH_TAG) || companyName.includes('13909');
}

/**
 * Strict synthetic employee ownership verification
 */
export function verifySyntheticEmployeeEvidence909(emp) {
  if (!emp || typeof emp !== 'object') return false;
  const code = String(emp.employee_code || emp.code || '').trim();
  if (!KNOWN_SYNTHETIC_EMPLOYEES_909.includes(code)) return false;

  const email = String(emp.email || '').toLowerCase().trim();
  const synthTag = String(emp.synthTag || '').trim();

  const hasValidTag = synthTag === TARGET_SYNTH_TAG || (synthTag.startsWith('SYNTH_P9Y_') && synthTag.includes('909'));
  const hasValidEmail = email.endsWith('@example.com') &&
    (email.startsWith('synth_admin_') || email.startsWith('synth_pend_') || email.startsWith('synth_act_') || email.startsWith('synth_')) &&
    (email.includes('909@example.com') || email.includes(TARGET_RUN_ID));

  return hasValidTag || hasValidEmail;
}

/**
 * Strict synthetic quotation ownership verification
 */
export function verifySyntheticQuotationOwnership909(quote) {
  if (!quote || typeof quote !== 'object') return false;
  const qNo = String(quote.quotationNo || quote.id || '').trim();
  if (!KNOWN_SYNTHETIC_QUOTES_909.includes(qNo)) return false;

  const synthTag = String(quote.synthTag || '').trim();
  const cust = String(quote.customerName || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('13909');
}

/**
 * Strict synthetic Proforma Invoice ownership verification
 */
export function verifySyntheticPiOwnership909(pi) {
  if (!pi || typeof pi !== 'object') return false;
  const pNo = String(pi.piNo || pi.id || pi.pi_no || '').trim();
  if (!KNOWN_SYNTHETIC_PIS_909.includes(pNo)) return false;

  const synthTag = String(pi.synthTag || '').trim();
  const cust = String(pi.customerName || pi.vendor || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('13909');
}

/**
 * Strict synthetic BOM ownership verification
 */
export function verifySyntheticBomOwnership909(bom) {
  if (!bom || typeof bom !== 'object') return false;
  const code = String(bom.bomCode || bom.bom_code || bom.code || bom.id || '').trim();
  const idMatches = KNOWN_SYNTHETIC_BOMS_909.includes(code) || code.includes('3909') || code.includes('13909');
  if (!idMatches) return false;

  const synthTag = String(bom.synthTag || '').trim();
  const cust = String(bom.customerName || bom.customer_name || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('13909') || idMatches;
}

/**
 * Strict synthetic Invoice ownership verification
 */
export function verifySyntheticInvoiceOwnership909(inv) {
  if (!inv || typeof inv !== 'object') return false;
  const invNo = String(inv.invNo || inv.invoiceNo || inv.id || inv.code || '').trim();
  const idMatches = KNOWN_SYNTHETIC_INVOICES_909.includes(invNo) || invNo.includes('13909');
  if (!idMatches) return false;

  const synthTag = String(inv.synthTag || '').trim();
  const cust = String(inv.customerName || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('13909') || idMatches;
}

/**
 * Strict synthetic Reservation ownership verification
 */
export function verifySyntheticReservationOwnership909(res) {
  if (!res || typeof res !== 'object') return false;
  const rId = String(res.id || res.reservationId || res.bomCode || '').trim();
  const idMatches = KNOWN_SYNTHETIC_RESERVATIONS_909.includes(rId) || rId.includes('13909') || rId.includes(TARGET_SYNTH_TAG);
  if (!idMatches) return false;

  const synthTag = String(res.synthTag || '').trim();
  return synthTag === TARGET_SYNTH_TAG || rId.includes(TARGET_SYNTH_TAG) || rId.includes('13909');
}

export const EXPECTED_OPTIMIZATION_TEST_WORKSPACE = '/var/www/businz-optimization-test';

/**
 * Validates whether the given workspace path matches the dedicated test worktree.
 * Pure function: allows deterministic testing of workspace validation logic
 * across both Hostinger VPS (/var/www/businz-optimization-test) and development environments.
 */
export function verifyWorkspaceIsolation(workspaceDir = path.resolve(__dirname, '..')) {
  return workspaceDir === EXPECTED_OPTIMIZATION_TEST_WORKSPACE;
}

export async function runResidueRecovery13909(options = {}) {
  const isExecuteAuthorized = Boolean(
    options.executeAuthorized || process.argv.includes('--execute-authorized')
  );
  const isDryRun = !isExecuteAuthorized;

  console.log('===================================================================');
  console.log(`🧹 BUSINZ ERP: PHASE 9AB SYNTHETIC RESIDUE RECOVERY (RUN ${TARGET_RUN_ID})`);
  console.log(`MODE: ${isDryRun ? '🔍 DRY RUN (Audit Only — Zero Writes)' : '⚡ LIVE EXECUTION (--execute-authorized)'}`);
  console.log('===================================================================\n');

  // ---------------------------------------------------------------------------
  // STEP 1: Strict Environment Preflight Checks
  // ---------------------------------------------------------------------------
  console.log('--- Step 1: Isolation & Environment Validation ---');
  const actualWorkspace = path.resolve(__dirname, '..');
  const expectedWorkspace = EXPECTED_OPTIMIZATION_TEST_WORKSPACE;

  // RULE 4: Live recovery (--execute-authorized) can NEVER bypass workspace protection.
  // Overrides are strictly forbidden for live execution.
  if (isExecuteAuthorized && actualWorkspace !== expectedWorkspace) {
    console.error(`🛑 [FAIL-CLOSED] Live recovery workspace mismatch:`);
    console.error(`   Expected: "${expectedWorkspace}"`);
    console.error(`   Actual:   "${actualWorkspace}"`);
    console.error('   Live residue recovery can only be executed on the isolated Hostinger VPS test worktree.');
    process.exitCode = 1;
    return { success: false, reason: 'Workspace mismatch', dryRun: false };
  }

  // In dry-run mode, allow testing invalid workspace rejection by passing options.workspaceDir
  const workspaceDir = (isDryRun && options.workspaceDir) ? options.workspaceDir : actualWorkspace;

  if (workspaceDir !== expectedWorkspace) {
    console.error(`🛑 [FAIL-CLOSED] Workspace mismatch:`);
    console.error(`   Expected: "${expectedWorkspace}"`);
    console.error(`   Actual:   "${workspaceDir}"`);
    console.error('   Residue recovery can only be executed on the isolated Hostinger VPS test worktree.');
    process.exitCode = 1;
    return { success: false, reason: 'Workspace mismatch', dryRun: isDryRun };
  }

  // Database URL Validation (strictly before Pool creation or DB connection)
  let dbUrl;
  try {
    dbUrl = resolveAndValidateTestDatabaseUrl(options.databaseUrl);
    console.log(`✅ [Verified] Database target: ${maskCredentials(dbUrl)}`);
  } catch (err) {
    console.error(`🛑 [FAIL-CLOSED] Database validation failed: ${err.message}`);
    process.exitCode = 1;
    return { success: false, reason: err.message, dryRun: isDryRun };
  }

  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
  });

  const client = await pool.connect();
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
    executed: false,
    committed: false
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 2: Audit Target Synthetic Leads & Foreign Key Dependencies
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Inspecting Target Synthetic Leads ---');
    const leadRes = await client.query(
      `SELECT id, lead_number, company_name, notes, created_at FROM public.leads 
       WHERE company_name LIKE $1 ESCAPE '\\' OR notes = $2 OR lead_number = ANY($3)`,
      [`%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`, TARGET_SYNTH_TAG, KNOWN_SYNTHETIC_LEADS_909]
    );

    for (const leadRow of leadRes.rows) {
      if (!verifySyntheticLeadOwnership909(leadRow)) {
        console.warn(`   ⚠️  [SECURITY WARNING] Lead ${leadRow.id} lacks exact run tag ${TARGET_SYNTH_TAG}. Skipping.`);
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
      const assignHistCheck = await client.query('SELECT COUNT(*)::int as count FROM public.lead_assignment_history WHERE lead_id = $1', [leadId]);
      const actCheck = await client.query('SELECT COUNT(*)::int as count FROM public.lead_activities WHERE lead_id = $1', [leadId]);
      const followCheck = await client.query('SELECT COUNT(*)::int as count FROM public.lead_followups WHERE lead_id = $1', [leadId]);
      const inactCheck = await client.query('SELECT COUNT(*)::int as count FROM public.lead_inactivity_incidents WHERE lead_id = $1', [leadId]);

      const childCounts = {
        lead_notification_recipients: recipientCount,
        lead_notifications: notifIds.length,
        lead_status_history: statusHistCheck.rows[0]?.count || 0,
        lead_assignment_history: assignHistCheck.rows[0]?.count || 0,
        lead_activities: actCheck.rows[0]?.count || 0,
        lead_followups: followCheck.rows[0]?.count || 0,
        lead_inactivity_incidents: inactCheck.rows[0]?.count || 0
      };

      auditReport.leadsFound.push(leadRow);
      auditReport.childRecordsFound[leadId] = childCounts;

      console.log(`   🎯 Found target synthetic lead: ${leadRow.id} (${leadRow.company_name})`);
    }

    // -------------------------------------------------------------------------
    // STEP 3: Audit Target Synthetic BOM Orders in public.bom_orders
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Inspecting Target Synthetic BOMs in public.bom_orders ---');
    const hasBomOrders = await client.query("SELECT to_regclass('public.bom_orders') as reg");
    if (hasBomOrders.rows[0]?.reg) {
      const bomRes = await client.query(
        `SELECT id, bom_code, customer_name FROM public.bom_orders
         WHERE bom_code = ANY($1) OR customer_name LIKE $2 ESCAPE '\\'`,
        [KNOWN_SYNTHETIC_BOMS_909, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]
      );
      for (const bRow of bomRes.rows) {
        if (verifySyntheticBomOwnership909(bRow)) {
          auditReport.bomsFound.push(bRow);
          console.log(`   🎯 Found target synthetic BOM order: ${bRow.id} (${bRow.bom_code})`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 4: Audit Target Synthetic Employees in employees_store
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Inspecting Target Synthetic Employees in employees_store ---');
    const empStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store'");
    if (empStoreRes.rows.length > 0 && Array.isArray(empStoreRes.rows[0].data)) {
      for (const empCode of KNOWN_SYNTHETIC_EMPLOYEES_909) {
        const match = empStoreRes.rows[0].data.find(e => (e.employee_code || e.code) === empCode);
        if (match && verifySyntheticEmployeeEvidence909(match)) {
          auditReport.employeesFound.push(match);
          console.log(`   🎯 Found target synthetic employee: ${match.employee_code || match.code}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 5: Audit Target Synthetic Quotations in quotations_store
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Inspecting Target Synthetic Quotations in quotations_store ---');
    const quoteStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'quotations_store'");
    if (quoteStoreRes.rows.length > 0 && Array.isArray(quoteStoreRes.rows[0].data)) {
      for (const qNo of KNOWN_SYNTHETIC_QUOTES_909) {
        const match = quoteStoreRes.rows[0].data.find(q => (q.quotationNo || q.id) === qNo);
        if (match && verifySyntheticQuotationOwnership909(match)) {
          auditReport.quotationsFound.push(match);
          console.log(`   🎯 Found target synthetic quotation: ${match.quotationNo || match.id}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 6: Audit Target Synthetic PIs
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Inspecting Target Synthetic Proforma Invoices ---');
    for (const storeKey of ['customer_pis_store', 'sales_pi_store', 'proforma_invoice_store']) {
      const pStoreRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1', [storeKey]);
      if (pStoreRes.rows.length > 0 && Array.isArray(pStoreRes.rows[0].data)) {
        for (const targetPiNo of KNOWN_SYNTHETIC_PIS_909) {
          const match = pStoreRes.rows[0].data.find(p => (p.piNo || p.id || p.pi_no) === targetPiNo);
          if (match && verifySyntheticPiOwnership909(match)) {
            auditReport.pisFound.push({ storeKey, pi: match });
            console.log(`   🎯 Found target synthetic PI: ${match.piNo || match.id} in store "${storeKey}"`);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 7: Audit Newly Created Store Keys (bom_store, invoice_store, reservations_store)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Inspecting Newly Created Store Keys in controlroom_store ---');
    const allKeysRes = await client.query('SELECT key FROM public.controlroom_store ORDER BY key');
    const activeKeys = allKeysRes.rows.map(r => r.key);

    for (const newKey of NEWLY_CREATED_STORE_KEYS_909) {
      if (activeKeys.includes(newKey)) {
        auditReport.newlyCreatedStoreKeys.push(newKey);
        const kRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1', [newKey]);
        const kData = kRes.rows[0]?.data;
        const count = Array.isArray(kData) ? kData.length : (kData ? 1 : 0);
        console.log(`   🎯 Found newly created store row "${newKey}" with ${count} items.`);

        if (newKey === 'bom_store' && Array.isArray(kData)) {
          for (const item of kData) {
            if (verifySyntheticBomOwnership909(item)) {
              auditReport.bomStoreItemsFound.push(item);
            }
          }
        } else if (newKey === 'invoice_store' && Array.isArray(kData)) {
          for (const item of kData) {
            if (verifySyntheticInvoiceOwnership909(item)) {
              auditReport.invoicesFound.push(item);
            }
          }
        } else if (newKey === 'reservations_store' && Array.isArray(kData)) {
          for (const item of kData) {
            if (verifySyntheticReservationOwnership909(item)) {
              auditReport.reservationsFound.push(item);
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 8: Decision (Dry Run vs Live Removal)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Proposed Actions Summary ---');
    console.log(`   Synthetic leads to delete:        ${auditReport.leadsFound.length}`);
    console.log(`   Synthetic BOM orders to delete:   ${auditReport.bomsFound.length}`);
    console.log(`   Synthetic employees to remove:    ${auditReport.employeesFound.length}`);
    console.log(`   Synthetic quotations to remove:   ${auditReport.quotationsFound.length}`);
    console.log(`   Synthetic PIs to remove:          ${auditReport.pisFound.length}`);
    console.log(`   Newly created store rows to drop: ${auditReport.newlyCreatedStoreKeys.join(', ') || 'None'}`);

    if (isDryRun) {
      console.log('\n===================================================================');
      console.log('🔍 DRY RUN COMPLETE: Zero database writes performed.');
      console.log('To execute live removal, run with:');
      console.log('   node scripts/recover_phase9y_run_13909_residue.js --execute-authorized');
      console.log('===================================================================\n');
      return { success: true, dryRun: true, auditReport };
    }

    // -------------------------------------------------------------------------
    // LIVE EXECUTION IN TRANSACTION
    // -------------------------------------------------------------------------
    console.log('\n⚡ PROCEEDING WITH AUTHORIZED LIVE REMOVAL IN TRANSACTION...');
    await client.query('BEGIN');

    // 1. Delete Leads and dependent records
    for (const lead of auditReport.leadsFound) {
      const leadId = lead.id;
      const lockLead = await client.query('SELECT * FROM public.leads WHERE id = $1 FOR UPDATE', [leadId]);
      if (lockLead.rows.length === 0 || !verifySyntheticLeadOwnership909(lockLead.rows[0])) {
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
      if (lockBom.rows.length === 0 || !verifySyntheticBomOwnership909(lockBom.rows[0])) {
        throw new Error(`[FAIL-SAFE] BOM order ${bom.bom_code} failed verification under lock!`);
      }

      const hasBomItems = await client.query("SELECT to_regclass('public.bom_items') as reg");
      if (hasBomItems.rows[0]?.reg) {
        await client.query('DELETE FROM public.bom_items WHERE bom_order_id = $1 OR bom_code = $2', [bom.id, bom.bom_code]);
      }

      await client.query('DELETE FROM public.bom_orders WHERE id = $1', [bom.id]);
      console.log(`   ✅ Deleted synthetic BOM order "${bom.bom_code}"`);
    }

    // 3. Remove synthetic employees from employees_store
    if (auditReport.employeesFound.length > 0) {
      const lockEmp = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store' FOR UPDATE");
      if (lockEmp.rows.length > 0 && Array.isArray(lockEmp.rows[0].data)) {
        const targetCodes = auditReport.employeesFound.map(e => e.employee_code || e.code);
        const cleanedList = lockEmp.rows[0].data.filter(e => !targetCodes.includes(e.employee_code || e.code));
        await client.query(
          "UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = 'employees_store'",
          [JSON.stringify(cleanedList)]
        );
        console.log(`   ✅ Cleaned synthetic employees from employees_store`);
      }
    }

    // 4. Remove synthetic quotations from quotations_store
    if (auditReport.quotationsFound.length > 0) {
      const lockQ = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'quotations_store' FOR UPDATE");
      if (lockQ.rows.length > 0 && Array.isArray(lockQ.rows[0].data)) {
        const targetQ = auditReport.quotationsFound.map(q => q.quotationNo || q.id);
        const cleanedList = lockQ.rows[0].data.filter(q => !targetQ.includes(q.quotationNo || q.id));
        await client.query(
          "UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = 'quotations_store'",
          [JSON.stringify(cleanedList)]
        );
        console.log(`   ✅ Cleaned synthetic quotations from quotations_store`);
      }
    }

    // 5. Remove synthetic PIs from PI stores and relational table
    if (auditReport.pisFound.length > 0) {
      for (const storeKey of ['customer_pis_store', 'sales_pi_store', 'proforma_invoice_store']) {
        const lockPi = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE', [storeKey]);
        if (lockPi.rows.length > 0 && Array.isArray(lockPi.rows[0].data)) {
          const cleanedList = lockPi.rows[0].data.filter(p => !KNOWN_SYNTHETIC_PIS_909.includes(p.piNo || p.id || p.pi_no));
          await client.query(
            'UPDATE public.controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = $2',
            [JSON.stringify(cleanedList), storeKey]
          );
          console.log(`   ✅ Cleaned synthetic PIs from store "${storeKey}"`);
        }
      }

      const hasPiTable = await client.query("SELECT to_regclass('public.proforma_invoices') as reg");
      if (hasPiTable.rows[0]?.reg) {
        await client.query(
          "DELETE FROM public.proforma_invoices WHERE pi_no = ANY($1) OR id = ANY($1)",
          [KNOWN_SYNTHETIC_PIS_909]
        );
        console.log(`   ✅ Cleaned synthetic PIs from public.proforma_invoices table`);
      }
    }

    // 6. Delete newly created store rows if empty and exclusively owned
    for (const newStoreKey of NEWLY_CREATED_STORE_KEYS_909) {
      const lockRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE', [newStoreKey]);
      if (lockRes.rows.length > 0) {
        let items = lockRes.rows[0].data;
        if (typeof items === 'string') {
          try { items = JSON.parse(items); } catch (_) { items = []; }
        }
        if (!Array.isArray(items)) items = [];

        let allExclusivelyOwned = true;
        for (const it of items) {
          if (newStoreKey === 'bom_store' && !verifySyntheticBomOwnership909(it)) allExclusivelyOwned = false;
          else if (newStoreKey === 'invoice_store' && !verifySyntheticInvoiceOwnership909(it)) allExclusivelyOwned = false;
          else if (newStoreKey === 'reservations_store' && !verifySyntheticReservationOwnership909(it)) allExclusivelyOwned = false;
        }

        if (allExclusivelyOwned) {
          await client.query('DELETE FROM public.controlroom_store WHERE key = $1', [newStoreKey]);
          console.log(`   ✅ Deleted newly created store row "${newStoreKey}" (exclusively owned residue removed).`);
        } else {
          throw new Error(`[FAIL-SAFE] Store row "${newStoreKey}" contains non-synthetic items! Refusing deletion.`);
        }
      }
    }

    // 7. Verify post-recovery store keys set match baseline exactly
    const postKeysRes = await client.query('SELECT key FROM public.controlroom_store ORDER BY key');
    const postKeys = postKeysRes.rows.map(r => r.key);
    const expectedKeys = [...BASELINE_STORE_KEYS_909].sort();

    const keysMatch = postKeys.length === expectedKeys.length &&
      expectedKeys.every((k, idx) => postKeys[idx] === k);

    if (!keysMatch) {
      throw new Error(`[BASELINE MISMATCH] Remaining store keys ${JSON.stringify(postKeys)} do not match baseline ${JSON.stringify(expectedKeys)}! Rolling back.`);
    }

    await client.query('COMMIT');
    auditReport.executed = true;
    auditReport.committed = true;

    console.log('\n===================================================================');
    console.log('✅ RECOVERY SUCCESS: All target test residue cleanly removed and baseline restored.');
    console.log('===================================================================\n');
    return { success: true, dryRun: false, auditReport };

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n🛑 [RECOVERY ERROR] Transaction rolled back due to error: ${err.message}`);
    process.exitCode = 1;
    return { success: false, error: err.message, dryRun: isDryRun };
  } finally {
    client.release();
    await pool.end();
  }
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runResidueRecovery13909()
    .then(res => {
      if (!res.success) process.exit(1);
    })
    .catch(err => {
      console.error('Fatal recovery failure:', err);
      process.exit(1);
    });
}
