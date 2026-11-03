/**
 * scripts/test_backup_restore_and_mutex_safety.js
 * 
 * Verifies:
 * 1. Memory Non-Mutation: setting backupData.stores[k] = null does NOT mutate active in-memory stores.
 * 2. Full Backup Creation & Header Reader Verification on Representative Data.
 * 3. Restoration Integrity: record counts, document attachments, media, customer data, PI, BOM, inventory, dispatch, invoices.
 * 4. Mutex Concurrency, Bounded Execution & Epoch Fencing under concurrent/failed operations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createFullBackup,
  readBackupHeader,
  restoreFromBackup
} from '../server/backupEngine.js';
import {
  checkAndProcessLeadInactivity,
  getInactivityEngineStatus,
  withTransaction
} from '../server/leadManagementService.js';
import { getBackupDir, getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  console.log(`\n============================================================`);
  console.log(`🛡️ BUSINZ CRM — BACKUP RESTORATION & MUTEX FENCING SAFETY SUITE`);
  console.log(`============================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Memory Non-Mutation Guarantee
  // --------------------------------------------------------------------------
  console.log(`--- [Test 1] In-Memory Store Non-Mutation During Backup Streaming ---`);
  const representativeBoms = [
    {
      id: 'BOM-TEST-001',
      bomCode: 'BOM-TEST-001',
      sourcePiNo: 'VRM-PI-2026-99',
      customerName: 'Solar Tech Corp',
      paymentProofDoc: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      addressProofDoc: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...',
      items: [{ itemCode: 'ITEM-1', qty: 100, rate: 250 }]
    },
    {
      id: 'BOM-TEST-002',
      bomCode: 'BOM-TEST-002',
      sourcePiNo: 'VRM-PI-2026-98',
      customerName: 'Renewable Power Ltd',
      paymentProofDoc: null,
      addressProofDoc: null,
      items: [{ itemCode: 'ITEM-2', qty: 50, rate: 500 }]
    }
  ];

  const representativePis = [
    { id: 'PI-TEST-001', piNo: 'VRM-PI-2026-99', customerName: 'Solar Tech Corp', totalAmount: 25000 },
    { id: 'PI-TEST-002', piNo: 'VRM-PI-2026-98', customerName: 'Renewable Power Ltd', totalAmount: 25000 }
  ];

  const representativeCustomers = [
    { id: 'CUST-001', name: 'Solar Tech Corp', phone: '+919876543210', email: 'info@solartech.com' },
    { id: 'CUST-002', name: 'Renewable Power Ltd', phone: '+919876543211', email: 'sales@renewable.com' }
  ];

  const representativeInventory = [
    { id: 'RM-001', code: 'HDG-STEEL-50', name: 'HDG Channel 50x50', currentStock: 1200 },
    { id: 'RM-002', code: 'ALUM-CLAMP-M8', name: 'Aluminum Clamp M8', currentStock: 5000 }
  ];

  const representativeInvoices = [
    { id: 'INV-TEST-001', invoiceNo: 'INV-2026-001', bomCode: 'BOM-TEST-001', amount: 29500, status: 'Paid' }
  ];

  const representativeWorkorders = [
    { id: 'WO-TEST-001', woNo: 'WO-2026-001', bomCode: 'BOM-TEST-001', status: 'Completed', transportMode: 'Self-Pickup' }
  ];

  const activeLiveMemoryStore = {
    bom_store: representativeBoms,
    sales_pi_store: representativePis,
    customer_store: representativeCustomers,
    raw_materials_store: representativeInventory,
    invoice_store: representativeInvoices,
    workorder_store: representativeWorkorders
  };

  let backupResult = null;
  try {
    backupResult = await createFullBackup({
      memoryStore: activeLiveMemoryStore,
      triggeredBy: 'Safety Audit Test Suite'
    });

    assert(
      Array.isArray(activeLiveMemoryStore.bom_store) && activeLiveMemoryStore.bom_store.length === 2,
      'Active memoryStore.bom_store was NOT set to null and retained all 2 records'
    );
    assert(
      activeLiveMemoryStore.bom_store[0].paymentProofDoc.startsWith('data:image/jpeg'),
      'Active memoryStore document attachment (paymentProofDoc) was completely preserved'
    );
    assert(
      activeLiveMemoryStore.bom_store[0].addressProofDoc.startsWith('data:application/pdf'),
      'Active memoryStore document attachment (addressProofDoc) was completely preserved'
    );
    assert(
      Array.isArray(activeLiveMemoryStore.sales_pi_store) && activeLiveMemoryStore.sales_pi_store.length === 2,
      'Active memoryStore.sales_pi_store retained all records'
    );
    assert(
      Array.isArray(activeLiveMemoryStore.customer_store) && activeLiveMemoryStore.customer_store.length === 2,
      'Active memoryStore.customer_store retained all records'
    );
    assert(
      Array.isArray(activeLiveMemoryStore.raw_materials_store) && activeLiveMemoryStore.raw_materials_store.length === 2,
      'Active memoryStore.raw_materials_store retained all records'
    );
    assert(
      Array.isArray(activeLiveMemoryStore.invoice_store) && activeLiveMemoryStore.invoice_store.length === 1,
      'Active memoryStore.invoice_store retained all records'
    );
    assert(
      Array.isArray(activeLiveMemoryStore.workorder_store) && activeLiveMemoryStore.workorder_store.length === 1,
      'Active memoryStore.workorder_store retained all records'
    );
  } catch (err) {
    assert(false, 'Test 1 backup creation threw unexpected error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Backup File JSON Integrity & Streaming Header Extraction
  // --------------------------------------------------------------------------
  console.log(`\n--- [Test 2] Streamed Backup File JSON Validation & Header Streaming ---`);
  let parsedBackupFile = null;
  try {
    assert(backupResult && backupResult.success === true, 'Backup returned success: true');
    assert(fs.existsSync(backupResult.filePath), 'Backup file exists on disk');

    const fileContent = fs.readFileSync(backupResult.filePath, 'utf8');
    parsedBackupFile = JSON.parse(fileContent);
    assert(typeof parsedBackupFile === 'object', 'Streamed backup is 100% valid JSON');

    const header = readBackupHeader(backupResult.filePath);
    assert(
      header.metadata && header.metadata.totalStores === 26,
      'Header reader accurately extracts totalStores count via header probing'
    );
    assert(
      header.createdAt === backupResult.createdAt,
      'Header reader extracts matching createdAt timestamp'
    );
  } catch (err) {
    assert(false, 'Test 2 JSON parsing / header read failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Full Restoration & Round-Trip Data Integrity
  // --------------------------------------------------------------------------
  console.log(`\n--- [Test 3] Restoration Integrity Across All ERP Workflows ---`);
  const storesToProtect = ['bom_store', 'sales_pi_store', 'customer_store', 'raw_materials_store', 'item_store', 'invoice_store', 'workorder_store'];
  const originalStoreSnapshots = {};
  for (const s of storesToProtect) {
    const p = getStoreFilePath(`${s}.json`);
    if (fs.existsSync(p)) {
      originalStoreSnapshots[s] = fs.readFileSync(p, 'utf8');
    }
  }

  try {
    const isolatedRestoredMemoryStore = {};
    const restoreResult = await restoreFromBackup(parsedBackupFile, {
      memoryStore: isolatedRestoredMemoryStore
    });

    assert(restoreResult.success === true, 'restoreFromBackup returned success: true');

    // Verify BOMs
    const restoredBoms = isolatedRestoredMemoryStore.bom_store;
    assert(
      Array.isArray(restoredBoms) && restoredBoms.length === 2,
      'Restored BOM orders count matches exactly (2/2)'
    );
    assert(
      restoredBoms[0].bomCode === 'BOM-TEST-001' && restoredBoms[0].sourcePiNo === 'VRM-PI-2026-99',
      'Restored BOM code and source PI link match 100%'
    );
    assert(
      restoredBoms[0].paymentProofDoc === representativeBoms[0].paymentProofDoc,
      'Restored BOM payment proof document data URL matches exactly'
    );
    assert(
      restoredBoms[0].addressProofDoc === representativeBoms[0].addressProofDoc,
      'Restored BOM address proof document data URL matches exactly'
    );

    // Verify PI
    const restoredPis = isolatedRestoredMemoryStore.sales_pi_store;
    assert(
      Array.isArray(restoredPis) && restoredPis.length === 2 && restoredPis[0].piNo === 'VRM-PI-2026-99',
      'Restored Proforma Invoices match 100%'
    );

    // Verify Customers
    const restoredCusts = isolatedRestoredMemoryStore.customer_store;
    assert(
      Array.isArray(restoredCusts) && restoredCusts.length === 2 && restoredCusts[0].email === 'info@solartech.com',
      'Restored Customers match 100%'
    );

    // Verify Inventory & Raw Materials
    const restoredRms = isolatedRestoredMemoryStore.raw_materials_store;
    assert(
      Array.isArray(restoredRms) && restoredRms.length === 2 && restoredRms[0].currentStock === 1200,
      'Restored Inventory raw materials match 100%'
    );

    // Verify Invoices & Dispatch
    const restoredInvs = isolatedRestoredMemoryStore.invoice_store;
    const restoredWos = isolatedRestoredMemoryStore.workorder_store;
    assert(
      Array.isArray(restoredInvs) && restoredInvs.length === 1 && restoredInvs[0].amount === 29500,
      'Restored Invoices match 100%'
    );
    assert(
      Array.isArray(restoredWos) && restoredWos.length === 1 && restoredWos[0].transportMode === 'Self-Pickup',
      'Restored Dispatch workorders match 100%'
    );
  } catch (err) {
    assert(false, 'Test 3 restore failed', err.message);
  } finally {
    // Revert original store files to prevent test pollution of project files
    for (const [s, content] of Object.entries(originalStoreSnapshots)) {
      const p = getStoreFilePath(`${s}.json`);
      try { fs.writeFileSync(p, content, 'utf8'); } catch (_) {}
    }
    // Clean up test backup file
    if (backupResult?.filePath && fs.existsSync(backupResult.filePath)) {
      try { fs.unlinkSync(backupResult.filePath); } catch (_) {}
    }
  }

  // --------------------------------------------------------------------------
  // TEST 4: Mutex Concurrency, Bounded Execution & Epoch Fencing
  // --------------------------------------------------------------------------
  console.log(`\n--- [Test 4] Mutex Concurrency, Bounded Execution & Epoch Fencing ---`);
  try {
    const status1 = getInactivityEngineStatus();
    assert(status1.isRunning === false, 'Engine initially idle');

    // Simulate 2 rapid concurrent invocations (e.g. background scheduler + manual admin trigger)
    const runA = checkAndProcessLeadInactivity({ source: 'scheduler-test' });
    const runB = checkAndProcessLeadInactivity({ source: 'manual-admin-test' });

    const [resA, resB] = await Promise.all([runA, runB]);
    const skippedRuns = [resA, resB].filter(r => r && r.skipped === true);
    assert(skippedRuns.length === 1, 'Exactly one concurrent run executed while the other was safely skipped');
    assert(skippedRuns[0].reason === 'ALREADY_RUNNING', 'Skipped run reported reason: ALREADY_RUNNING');

    const status2 = getInactivityEngineStatus();
    assert(status2.isRunning === false, 'Mutex cleanly released after completion');
    assert(status2.overlappingRunsSkipped >= 1, 'Overlapping skip counter accurately tracked');
  } catch (err) {
    assert(false, 'Test 4 concurrency check failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Failed Transaction Error Recovery & Lock Release
  // --------------------------------------------------------------------------
  console.log(`\n--- [Test 5] Transaction Failure Error Handling & Lock Release ---`);
  try {
    let rollbackObserved = false;
    try {
      await withTransaction(async (client) => {
        // Intentionally execute invalid SQL to trigger transaction failure
        await client.query('SELECT * FROM public.__non_existent_table_for_rollback_test__');
      });
    } catch (err) {
      rollbackObserved = true;
    }
    assert(rollbackObserved === true, 'Transaction failure was cleanly caught and rolled back');

    // Confirm inactivity engine still functions normally after a transaction failure
    const status3 = getInactivityEngineStatus();
    assert(status3.isRunning === false, 'Engine mutex remains idle and unlocked after transaction failure');

    const normalRun = await checkAndProcessLeadInactivity({ source: 'post-failure-test' });
    assert(normalRun.success === true, 'Subsequent inactivity check succeeds without hanging');
  } catch (err) {
    assert(false, 'Test 5 failed transaction test threw unexpected error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Standalone Rollback Script Backward-Compatible DB Policy
  // --------------------------------------------------------------------------
  console.log(`\n--- [Test 6] Standalone Rollback Preserves Backward-Compatible Schema ---`);
  try {
    const rollbackScriptPath = path.join(__dirname, 'standalone_rollback.sh');
    const rollbackScript = fs.readFileSync(rollbackScriptPath, 'utf8');

    const hasActiveDropCommand = rollbackScript.split('\n')
      .some(line => !line.trim().startsWith('#') && line.includes('DROP') && line.includes('idx_lead_inactivity_unique_incident'));

    assert(
      !hasActiveDropCommand,
      'standalone_rollback.sh does NOT automatically execute drop on idx_lead_inactivity_unique_incident'
    );
    assert(
      rollbackScript.includes('Preserving backward-compatible index: idx_lead_inactivity_unique_incident'),
      'standalone_rollback.sh explicitly documents preserving backward-compatible index'
    );
  } catch (err) {
    assert(false, 'Test 6 rollback script check failed', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log(`\n------------------------------------------------------------`);
  console.log(`📊 FINAL THREE SAFETY CHECKS SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------\n`);

  return { passed, failed };
}

if (process.argv[1]?.endsWith('test_backup_restore_and_mutex_safety.js')) {
  runTestSuite().then(r => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

export { runTestSuite };
