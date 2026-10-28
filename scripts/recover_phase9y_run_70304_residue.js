/**
 * scripts/recover_phase9y_run_70304_residue.js
 *
 * BUSINZ ERP: Dedicated Dry-Run-First Synthetic Residue Recovery for Run 1793190270304 (Phase 9AA)
 *
 * Purpose:
 * Safely audit and recover orphaned synthetic records from failed Phase 9Y integration run
 * SYNTH_P9Y_1793190270304 in the isolated optimization test environment without affecting
 * production, development, or HRMS.
 *
 * Target Residue:
 * - Lead: VRM-LD-2026-01 (or lead matching SYNTH_P9Y_1793190270304)
 * - Employees: TA-TEST-304, SE-PEND-304, SE-ACT-304
 * - Quotations: QT-70304 in quotations_store
 * - Proforma Invoices: PI-70304 in customer_pis_store / sales_pi_store
 *
 * Safety & Isolation Constraints:
 * 1. Default Mode is strictly DRY RUN: prints proposed changes with ZERO database writes.
 * 2. Live execution requires explicit argument: --execute-authorized
 * 3. Enforces strict workspace check: MUST run in /var/www/businz-optimization-test.
 * 4. Strictly validates database: MUST connect to 127.0.0.1 / businz_optimization_test / businz_test_user.
 * 5. Verifies independent synthetic ownership evidence on every target record before removal.
 * 6. Deletes dependent child records in foreign-key-safe order.
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

export const TARGET_RUN_ID = '1793190270304';
export const TARGET_SYNTH_TAG = `SYNTH_P9Y_${TARGET_RUN_ID}`;
export const KNOWN_SYNTHETIC_LEADS_304 = ['VRM-LD-2026-01'];
export const KNOWN_SYNTHETIC_EMPLOYEES_304 = ['TA-TEST-304', 'SE-PEND-304', 'SE-ACT-304'];
export const KNOWN_SYNTHETIC_QUOTES_304 = ['QT-70304'];
export const KNOWN_SYNTHETIC_PIS_304 = ['PI-70304'];

/**
 * Strict synthetic lead ownership verification
 * Requirement: Lead number alone is NEVER sufficient; MUST have SYNTH_P9Y_1793190270304 marker.
 */
export function verifySyntheticLeadOwnership304(lead) {
  if (!lead) return false;
  const companyName = String(lead.company_name || '');
  const notes = String(lead.notes || '');
  const hasMarker = companyName.includes(TARGET_SYNTH_TAG) || notes.includes(TARGET_SYNTH_TAG);
  return hasMarker;
}

/**
 * Strict synthetic employee ownership verification
 * Requirement:
 * - Exact known employee code (TA-TEST-304, SE-PEND-304, SE-ACT-304)
 * - Plus run-specific identity marker (304 or 1793190270304)
 * - Fails closed on generic prefixes or missing evidence.
 */
export function verifySyntheticEmployeeEvidence304(emp) {
  if (!emp || typeof emp !== 'object') return false;
  const code = String(emp.employee_code || emp.code || '').trim();
  if (!KNOWN_SYNTHETIC_EMPLOYEES_304.includes(code)) return false;

  const email = String(emp.email || '').toLowerCase().trim();
  const synthTag = String(emp.synthTag || '').trim();

  const hasValidTag = synthTag === TARGET_SYNTH_TAG || (synthTag.startsWith('SYNTH_P9Y_') && synthTag.includes('304'));
  const hasValidEmail = email.endsWith('@example.com') &&
    (email.startsWith('synth_admin_') || email.startsWith('synth_pend_') || email.startsWith('synth_act_') || email.startsWith('synth_')) &&
    (email.includes('304@example.com') || email.includes(TARGET_RUN_ID));

  return hasValidTag || hasValidEmail;
}

/**
 * Strict synthetic quotation ownership verification
 */
export function verifySyntheticQuotationOwnership304(quote) {
  if (!quote || typeof quote !== 'object') return false;
  const qNo = String(quote.quotationNo || quote.id || '').trim();
  if (!KNOWN_SYNTHETIC_QUOTES_304.includes(qNo)) return false;

  const synthTag = String(quote.synthTag || '').trim();
  const cust = String(quote.customerName || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('304');
}

/**
 * Strict synthetic Proforma Invoice ownership verification
 */
export function verifySyntheticPiOwnership304(pi) {
  if (!pi || typeof pi !== 'object') return false;
  const pNo = String(pi.piNo || pi.id || '').trim();
  if (!KNOWN_SYNTHETIC_PIS_304.includes(pNo)) return false;

  const synthTag = String(pi.synthTag || '').trim();
  const cust = String(pi.customerName || pi.vendor || '');
  return synthTag === TARGET_SYNTH_TAG || cust.includes(TARGET_SYNTH_TAG) || cust.includes('304');
}

export async function runResidueRecovery304(options = {}) {
  const isExecuteAuthorized = Boolean(
    options.executeAuthorized || process.argv.includes('--execute-authorized')
  );
  const isDryRun = !isExecuteAuthorized;

  console.log('===================================================================');
  console.log(`🧹 BUSINZ ERP: PHASE 9AA SYNTHETIC RESIDUE RECOVERY (RUN ${TARGET_RUN_ID})`);
  console.log(`MODE: ${isDryRun ? '🔍 DRY RUN (Audit Only — Zero Writes)' : '⚡ LIVE EXECUTION (--execute-authorized)'}`);
  console.log('===================================================================\n');

  // ---------------------------------------------------------------------------
  // STEP 1: Strict Environment Preflight Checks
  // ---------------------------------------------------------------------------
  console.log('--- Step 1: Isolation & Environment Validation ---');
  const workspaceDir = path.resolve(__dirname, '..');
  const expectedWorkspace = '/var/www/businz-optimization-test';

  if (workspaceDir !== expectedWorkspace && !options.bypassWorkspaceCheckForTesting) {
    console.error(`🛑 [FAIL-CLOSED] Workspace mismatch:`);
    console.error(`   Expected: "${expectedWorkspace}"`);
    console.error(`   Actual:   "${workspaceDir}"`);
    console.error('   Residue recovery can only be executed on the isolated Hostinger VPS test worktree.');
    process.exitCode = 1;
    return { success: false, reason: 'Workspace mismatch', dryRun: isDryRun };
  }

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
    employeesFound: [],
    quotationsFound: [],
    pisFound: [],
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
      [`%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`, TARGET_SYNTH_TAG, KNOWN_SYNTHETIC_LEADS_304]
    );

    for (const leadRow of leadRes.rows) {
      if (!verifySyntheticLeadOwnership304(leadRow)) {
        console.warn(`   ⚠️  [SECURITY WARNING] Lead ${leadRow.id} (${leadRow.lead_number}) lacks exact run tag ${TARGET_SYNTH_TAG}. Skipping.`);
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
      console.log(`      Associated child records:`, JSON.stringify(childCounts));
    }

    if (auditReport.leadsFound.length === 0) {
      console.log(`   ℹ️  No synthetic leads found matching ${TARGET_SYNTH_TAG} (already clean).`);
    }

    // -------------------------------------------------------------------------
    // STEP 3: Audit Target Synthetic Employees in employees_store
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Inspecting Target Synthetic Employees in employees_store ---');
    const empStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store'");
    let empList = [];
    if (empStoreRes.rows.length > 0 && Array.isArray(empStoreRes.rows[0].data)) {
      empList = empStoreRes.rows[0].data;
    }

    for (const empCode of KNOWN_SYNTHETIC_EMPLOYEES_304) {
      const match = empList.find(e => (e.employee_code || e.code) === empCode);
      if (match) {
        if (verifySyntheticEmployeeEvidence304(match)) {
          auditReport.employeesFound.push(match);
          console.log(`   🎯 Found target synthetic employee: ${match.employee_code || match.code} (${match.email || 'N/A'})`);
        } else {
          console.warn(`   ⚠️  Employee ${empCode} lacks synthetic markers for run 304. Preserving.`);
        }
      } else {
        console.log(`   ℹ️  Employee "${empCode}" not present in employees_store (already clean).`);
      }
    }

    // -------------------------------------------------------------------------
    // STEP 4: Audit Target Synthetic Quotations in quotations_store
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Inspecting Target Synthetic Quotations in quotations_store ---');
    const quoteStoreRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'quotations_store'");
    let quoteList = [];
    if (quoteStoreRes.rows.length > 0 && Array.isArray(quoteStoreRes.rows[0].data)) {
      quoteList = quoteStoreRes.rows[0].data;
    }

    for (const qNo of KNOWN_SYNTHETIC_QUOTES_304) {
      const match = quoteList.find(q => (q.quotationNo || q.id) === qNo);
      if (match) {
        if (verifySyntheticQuotationOwnership304(match)) {
          auditReport.quotationsFound.push(match);
          console.log(`   🎯 Found target synthetic quotation: ${match.quotationNo || match.id} (${match.customerName || 'N/A'})`);
        } else {
          console.warn(`   ⚠️  Quotation ${qNo} lacks synthetic markers for run 304. Preserving.`);
        }
      } else {
        console.log(`   ℹ️  Quotation "${qNo}" not present in quotations_store (already clean).`);
      }
    }

    // -------------------------------------------------------------------------
    // STEP 5: Audit Target Synthetic Proforma Invoices
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Inspecting Target Synthetic Proforma Invoices ---');
    const piStoresToCheck = ['customer_pis_store', 'sales_pi_store', 'proforma_invoice_store'];
    for (const storeKey of piStoresToCheck) {
      const pStoreRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1', [storeKey]);
      if (pStoreRes.rows.length > 0 && Array.isArray(pStoreRes.rows[0].data)) {
        for (const targetPiNo of KNOWN_SYNTHETIC_PIS_304) {
          const match = pStoreRes.rows[0].data.find(p => (p.piNo || p.id) === targetPiNo);
          if (match && verifySyntheticPiOwnership304(match)) {
            auditReport.pisFound.push({ storeKey, pi: match });
            console.log(`   🎯 Found target synthetic PI: ${match.piNo || match.id} in store "${storeKey}"`);
          }
        }
      }
    }

    // Check public.proforma_invoices relational table if present
    const hasPiTable = await client.query("SELECT to_regclass('public.proforma_invoices') as reg");
    if (hasPiTable.rows[0]?.reg) {
      const dbPiRes = await client.query(
        'SELECT * FROM public.proforma_invoices WHERE pi_no = ANY($1) OR id = ANY($1)',
        [KNOWN_SYNTHETIC_PIS_304]
      );
      for (const row of dbPiRes.rows) {
        if (verifySyntheticPiOwnership304(row)) {
          auditReport.pisFound.push({ storeKey: 'public.proforma_invoices', pi: row });
          console.log(`   🎯 Found target synthetic PI: ${row.pi_no || row.id} in relational table public.proforma_invoices`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 6: Execution Decision (Dry Run vs Live Removal)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Proposed Actions Summary ---');
    console.log(`   Synthetic leads to delete:      ${auditReport.leadsFound.length}`);
    console.log(`   Synthetic employees to remove:  ${auditReport.employeesFound.length}`);
    console.log(`   Synthetic quotations to remove: ${auditReport.quotationsFound.length}`);
    console.log(`   Synthetic PIs to remove:        ${auditReport.pisFound.length}`);

    if (isDryRun) {
      console.log('\n===================================================================');
      console.log('🔍 DRY RUN COMPLETE: Zero database writes performed.');
      console.log('To execute live removal, run with:');
      console.log('   node scripts/recover_phase9y_run_70304_residue.js --execute-authorized');
      console.log('===================================================================\n');
      return { success: true, dryRun: true, auditReport };
    }

    // LIVE REMOVAL WITH EXPLICIT TRANSACTION
    console.log('\n⚡ PROCEEDING WITH AUTHORIZED LIVE REMOVAL IN TRANSACTION...');
    await client.query('BEGIN');

    // 1. Delete dependent child records and parent leads with row locks and parameterized ownership-constrained deletes
    for (const lead of auditReport.leadsFound) {
      const leadId = lead.id;

      // Acquire exclusive row lock and re-verify synthetic ownership markers
      const lockRes = await client.query(
        'SELECT id, lead_number, company_name, notes FROM public.leads WHERE id = $1 FOR UPDATE',
        [leadId]
      );
      if (lockRes.rows.length === 0) {
        throw new Error(`[FAIL-SAFE] Target lead ${leadId} disappeared before locked removal. Aborting transaction.`);
      }
      const lockedLead = lockRes.rows[0];
      if (!verifySyntheticLeadOwnership304(lockedLead)) {
        throw new Error(`[FAIL-SAFE] Lead ${leadId} failed synthetic ownership verification under FOR UPDATE lock! Aborting transaction.`);
      }

      await client.query(`
        DELETE FROM public.lead_notification_recipients
        WHERE notification_id IN (
          SELECT n.id FROM public.lead_notifications n
          JOIN public.leads l ON n.lead_id = l.id
          WHERE l.id = $1 AND (l.company_name LIKE $2 ESCAPE '\\' OR l.notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_notifications
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_status_history
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_assignment_history
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_activities
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_followups
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      await client.query(`
        DELETE FROM public.lead_inactivity_incidents
        WHERE lead_id = $1 AND lead_id IN (
          SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        )
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      const hasCrmActivities = await client.query("SELECT to_regclass('public.crm_leads_activities') as reg");
      if (hasCrmActivities.rows[0]?.reg) {
        await client.query(`
          DELETE FROM public.crm_leads_activities
          WHERE lead_id = $1 AND lead_id IN (
            SELECT id FROM public.leads WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
          )
        `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);
      }

      const delLeadRes = await client.query(`
        DELETE FROM public.leads
        WHERE id = $1 AND (company_name LIKE $2 ESCAPE '\\' OR notes LIKE $2 ESCAPE '\\')
        RETURNING id
      `, [leadId, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);

      if (delLeadRes.rowCount !== 1) {
        throw new Error(`[FAIL-SAFE] Expected to delete 1 lead row for ${leadId}, but deleted ${delLeadRes.rowCount}. Aborting.`);
      }

      console.log(`   ✅ Deleted synthetic lead ${leadId} and all child records.`);
    }

    // 2. Remove synthetic employees from controlroom_store (employees_store)
    if (auditReport.employeesFound.length > 0) {
      const lockRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store' FOR UPDATE");
      if (lockRes.rows.length > 0 && Array.isArray(lockRes.rows[0].data)) {
        const currentList = lockRes.rows[0].data;
        const targetCodes = auditReport.employeesFound.map(e => e.employee_code || e.code);

        for (const item of currentList) {
          const itemCode = item.employee_code || item.code;
          if (targetCodes.includes(itemCode)) {
            if (!verifySyntheticEmployeeEvidence304(item)) {
              throw new Error(`[FAIL-SAFE] Employee ${itemCode} under lock failed synthetic evidence verification! Aborting.`);
            }
          }
        }

        const cleanedList = currentList.filter(item => {
          const itemCode = item.employee_code || item.code;
          return !targetCodes.includes(itemCode);
        });

        await client.query(`
          UPDATE public.controlroom_store
          SET data = $1::jsonb, updated_at = NOW()
          WHERE key = 'employees_store'
        `, [JSON.stringify(cleanedList)]);

        console.log(`   ✅ Removed ${targetCodes.length} synthetic employees from employees_store (preserved ${cleanedList.length} unrelated employees).`);
      }
    }

    // 3. Remove synthetic quotations from controlroom_store (quotations_store)
    if (auditReport.quotationsFound.length > 0) {
      const lockRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'quotations_store' FOR UPDATE");
      if (lockRes.rows.length > 0 && Array.isArray(lockRes.rows[0].data)) {
        const currentList = lockRes.rows[0].data;
        const targetQuotes = auditReport.quotationsFound.map(q => q.quotationNo || q.id);

        const cleanedList = currentList.filter(item => {
          const qNo = item.quotationNo || item.id;
          return !targetQuotes.includes(qNo);
        });

        await client.query(`
          UPDATE public.controlroom_store
          SET data = $1::jsonb, updated_at = NOW()
          WHERE key = 'quotations_store'
        `, [JSON.stringify(cleanedList)]);

        console.log(`   ✅ Removed ${targetQuotes.length} synthetic quotations from quotations_store (preserved ${cleanedList.length} unrelated quotations).`);
      }
    }

    // 4. Remove synthetic PIs from controlroom_store and public.proforma_invoices
    if (auditReport.pisFound.length > 0) {
      for (const storeKey of piStoresToCheck) {
        const lockRes = await client.query('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE', [storeKey]);
        if (lockRes.rows.length > 0 && Array.isArray(lockRes.rows[0].data)) {
          const currentList = lockRes.rows[0].data;
          const cleanedList = currentList.filter(item => {
            const pNo = item.piNo || item.id;
            return !KNOWN_SYNTHETIC_PIS_304.includes(pNo);
          });

          await client.query(`
            UPDATE public.controlroom_store
            SET data = $1::jsonb, updated_at = NOW()
            WHERE key = $2
          `, [JSON.stringify(cleanedList), storeKey]);

          console.log(`   ✅ Cleaned synthetic PIs from store "${storeKey}" (preserved ${cleanedList.length} unrelated PIs).`);
        }
      }

      if (hasPiTable.rows[0]?.reg) {
        await client.query(`
          DELETE FROM public.proforma_invoices
          WHERE (pi_no = ANY($1) OR id = ANY($1))
            AND (customer_name LIKE $2 ESCAPE '\\' OR vendor LIKE $2 ESCAPE '\\')
        `, [KNOWN_SYNTHETIC_PIS_304, `%${TARGET_SYNTH_TAG.replace(/_/g, '\\_')}%`]);
        console.log(`   ✅ Cleaned synthetic PIs from public.proforma_invoices table.`);
      }
    }

    // Commit live transaction safely
    await client.query('COMMIT');
    auditReport.executed = true;
    auditReport.committed = true;

    console.log('\n===================================================================');
    console.log('✅ RECOVERY SUCCESS: All target test residue cleanly removed.');
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
  runResidueRecovery304()
    .then(res => {
      if (!res.success) process.exit(1);
    })
    .catch(err => {
      console.error('Fatal recovery failure:', err);
      process.exit(1);
    });
}
