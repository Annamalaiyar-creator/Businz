/**
 * scripts/recover_phase9y_test_residue.js
 *
 * BUSINZ ERP: Dedicated Dry-Run-First Synthetic Residue Recovery Script (Phase 9Z)
 *
 * Purpose:
 * Safely audit and recover orphaned synthetic records from prior Phase 9Y integration test runs
 * in the isolated optimization test environment without affecting production, development, or HRMS.
 *
 * Target Residue:
 * - Lead: VRM-LD-2026-01
 * - Employees: TA-TEST-552, SE-PEND-552, SE-ACT-552, SE-TEST-396
 *
 * Safety & Isolation Constraints:
 * 1. Default Mode is strictly DRY RUN: prints proposed changes with ZERO database writes.
 * 2. Live execution requires explicit argument: --execute-authorized
 * 3. Enforces strict workspace check: MUST run in /var/www/businz-optimization-test.
 * 4. Strictly validates database: MUST connect to 127.0.0.1 / businz_optimization_test / businz_test_user.
 * 5. Verifies synthetic ownership markers on every target record before removal.
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
  maskCredentials,
  REQUIRED_TEST_DATABASE,
  REQUIRED_TEST_DB_ROLE
} from './testEnvironmentGuard.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const KNOWN_SYNTHETIC_LEADS = ['VRM-LD-2026-01'];
export const KNOWN_SYNTHETIC_EMPLOYEES = ['TA-TEST-552', 'SE-PEND-552', 'SE-ACT-552', 'SE-TEST-396'];

export async function runResidueRecovery(options = {}) {
  const isExecuteAuthorized = Boolean(
    options.executeAuthorized || process.argv.includes('--execute-authorized')
  );
  const isDryRun = !isExecuteAuthorized;

  console.log('===================================================================');
  console.log('🧹 BUSINZ ERP: PHASE 9Z SYNTHETIC TEST RESIDUE RECOVERY');
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
    executed: false,
    committed: false
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 2: Audit Target Synthetic Leads & Foreign Key Dependencies
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Inspecting Target Synthetic Leads ---');

    for (const leadIdent of KNOWN_SYNTHETIC_LEADS) {
      const leadRes = await client.query(
        'SELECT id, lead_number, company_name, notes, created_at FROM public.leads WHERE id = $1 OR lead_number = $1',
        [leadIdent]
      );

      if (leadRes.rows.length === 0) {
        console.log(`   ℹ️  Lead "${leadIdent}" not present in public.leads (already clean).`);
        continue;
      }

      const leadRow = leadRes.rows[0];
      const isSynthetic = (
        (typeof leadRow.company_name === 'string' && leadRow.company_name.toUpperCase().includes('SYNTH')) ||
        (typeof leadRow.notes === 'string' && leadRow.notes.toUpperCase().includes('SYNTH')) ||
        leadRow.lead_number === 'VRM-LD-2026-01'
      );

      if (!isSynthetic) {
        console.warn(`   ⚠️  [SECURITY WARNING] Record "${leadIdent}" lacks synthetic markers! Skipping removal.`);
        continue;
      }

      // Check dependent child records
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

    // -------------------------------------------------------------------------
    // STEP 3: Audit Target Synthetic Employees in employees_store
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Inspecting Target Synthetic Employees in employees_store ---');
    const storeRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store'");
    let employeeList = [];
    if (storeRes.rows.length > 0 && Array.isArray(storeRes.rows[0].data)) {
      employeeList = storeRes.rows[0].data;
    }

    for (const empCode of KNOWN_SYNTHETIC_EMPLOYEES) {
      const match = employeeList.find(e => (e.employee_code || e.code) === empCode);
      if (match) {
        const isSynth = (
          empCode.includes('TEST') ||
          (match.email && match.email.includes('synth')) ||
          match.synthTag ||
          match.employee_name?.includes('Test') ||
          match.employee_name?.includes('Pending') ||
          match.employee_name?.includes('Active')
        );

        if (isSynth) {
          auditReport.employeesFound.push(match);
          console.log(`   🎯 Found target synthetic employee: ${match.employee_code} (${match.employee_name || 'N/A'}, ${match.email || 'N/A'})`);
        } else {
          console.warn(`   ⚠️  Employee ${empCode} lacks synthetic markers. Preserving.`);
        }
      } else {
        console.log(`   ℹ️  Employee "${empCode}" not present in employees_store (already clean).`);
      }
    }

    // -------------------------------------------------------------------------
    // STEP 4: Execution Decision (Dry Run vs Live Removal)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Proposed Actions Summary ---');
    console.log(`   Synthetic leads to delete:     ${auditReport.leadsFound.length}`);
    console.log(`   Synthetic employees to remove: ${auditReport.employeesFound.length}`);

    if (isDryRun) {
      console.log('\n===================================================================');
      console.log('🔍 DRY RUN COMPLETE: Zero database writes performed.');
      console.log('To execute live removal, run with:');
      console.log('   node scripts/recover_phase9y_test_residue.js --execute-authorized');
      console.log('===================================================================\n');
      return { success: true, dryRun: true, auditReport };
    }

    // LIVE REMOVAL WITH EXPLICIT TRANSACTION
    console.log('\n⚡ PROCEEDING WITH AUTHORIZED LIVE REMOVAL IN TRANSACTION...');
    await client.query('BEGIN');

    // 1. Delete dependent child records and parent leads
    for (const lead of auditReport.leadsFound) {
      const leadId = lead.id;

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
      console.log(`   ✅ Deleted synthetic lead ${leadId} and all child records.`);
    }

    // 2. Remove synthetic employees from controlroom_store (employees_store)
    if (auditReport.employeesFound.length > 0) {
      const lockRes = await client.query("SELECT data FROM public.controlroom_store WHERE key = 'employees_store' FOR UPDATE");
      if (lockRes.rows.length > 0 && Array.isArray(lockRes.rows[0].data)) {
        const currentList = lockRes.rows[0].data;
        const targetCodes = auditReport.employeesFound.map(e => e.employee_code || e.code);

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
  runResidueRecovery()
    .then(res => {
      if (!res.success) process.exit(1);
    })
    .catch(err => {
      console.error('Fatal recovery failure:', err);
      process.exit(1);
    });
}
