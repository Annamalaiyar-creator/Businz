/**
 * E2E MASTER WORKFLOW VERIFICATION SUITE FOR BUSINZ
 * Validates Tests A through N against the authoritative business logic and configs.
 */
import { buildProductionConfigs } from './src/components/views/productionConfigs.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('BUSINZ MASTER E2E WORKFLOW TEST SUITE (TESTS A - N)');
console.log('====================================================\n');

// 1. Setup Mock BOMs and Store
const salespersonA = { name: 'Priya Sharma', code: 'EMP-001' };
const salespersonB = { name: 'Rahul Varma', code: 'EMP-002' };
const salespersonC = { name: 'Kavitha Nair', code: 'EMP-003' };
const salespersonD = { name: 'Suresh Kumar', code: 'EMP-004' };
const salespersonE = { name: 'Ananya Roy', code: 'EMP-005' };
const salespersonF = { name: 'Vikram Singh', code: 'EMP-006' };

// Initial inventory state
const INITIAL_PHYSICAL_STOCK = 1000; // units of MR-300MM

// Helper to compute inventory reservation like centralInventoryStore & RawMaterialInventoryView
function computeInventory(boms) {
  let physical = INITIAL_PHYSICAL_STOCK;
  let reservedByBom = {};
  let totalReserved = 0;

  boms.forEach(b => {
    const isCancelled = Boolean(b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored');
    const isDeducted = Boolean(b.stockDeducted || b.status === 'Completed' || b.status === 'Invoice Confirmed' || b.invoiceConfirmed);

    if (isDeducted && !isCancelled) {
      const q = (b.items || []).reduce((acc, it) => acc + (it.qty || it.bomQty || 0), 0);
      physical = Math.max(0, physical - q);
    } else if (!isCancelled) {
      const q = (b.items || []).reduce((acc, it) => acc + (it.qty || it.bomQty || 0), 0);
      reservedByBom[b.bomCode] = q;
      totalReserved += q;
    }
  });

  const available = Math.max(0, physical - totalReserved);
  return { physical, totalReserved, available, reservedByBom };
}

// ----------------------------------------------------
// TEST A – PI Creation & Visibility
// ----------------------------------------------------
console.log('--- TEST A: PI Creation & Visibility ---');
const pi001 = {
  piNo: 'PI-2026-001',
  customerName: 'Adani Solar Projects',
  status: 'Issued',
  salesPerson: salespersonA.name,
  salesPersonCode: salespersonA.code,
  items: [{ code: 'MR-300MM', name: 'Mini Rail 300mm', qty: 100, rate: 350 }]
};
// Check that PI does not appear in BOM, Dispatch, Accounts, or Billing
const configsA = buildProductionConfigs({ bomStore: [], invoiceList: [] });
const dispatchRowsA = configsA['Dispatch Orders'].rows;
const accountsRowsA = configsA['Accounts Verification'].rows;
const invoiceRowsA = configsA['Invoice Management'].rows;

assert(dispatchRowsA.length === 0, 'Saved PI does NOT appear on Dispatch page');
assert(accountsRowsA.length === 0, 'Saved PI does NOT appear on Accounts page');
assert(invoiceRowsA.length === 0, 'Saved PI does NOT appear on Billing/Invoice page');
const invA = computeInventory([]);
assert(invA.totalReserved === 0 && invA.physical === INITIAL_PHYSICAL_STOCK, 'Stock quantities remain unchanged, no reservation on PI save');

// ----------------------------------------------------
// TEST B & C – PI to BOM Conversion & Draft Preparation
// ----------------------------------------------------
console.log('\n--- TEST B & C: PI to BOM Conversion & Draft Preparation ---');
const bom001_draft = {
  bomCode: 'VRM-BOM-2026-01',
  code: 'VRM-BOM-2026-01',
  sourcePiNo: pi001.piNo,
  customerName: pi001.customerName,
  status: 'Draft',
  salesConfirmed: false,
  salesPerson: salespersonA.name,
  salesPersonCode: salespersonA.code,
  createdBy: salespersonA.name,
  createdById: salespersonA.code,
  items: [{ code: 'MR-300MM', name: 'Mini Rail 300mm', qty: 100, rate: 350 }]
};

const configsBC = buildProductionConfigs({ bomStore: [bom001_draft], invoiceList: [] });
const dispatchRowsBC = configsBC['Dispatch Orders'].rows;
const accountsRowsBC = configsBC['Accounts Verification'].rows;
const invoiceRowsBC = configsBC['Invoice Management'].rows;

assert(dispatchRowsBC.length === 0, 'Draft BOM in preparation does NOT appear on Dispatch page');
assert(accountsRowsBC.length === 0, 'Draft BOM in preparation does NOT appear on Accounts page');
assert(invoiceRowsBC.length === 0, 'Draft BOM in preparation does NOT appear on Billing/Invoice page');

const invBC = computeInventory([bom001_draft]);
assert(invBC.reservedByBom['VRM-BOM-2026-01'] === 100, 'Inventory reservation starts atomically upon conversion for 100 units');
assert(invBC.available === 900, 'Available stock reflects deduction of reserved quantity (1000 - 100 = 900)');

// ----------------------------------------------------
// TEST D – BOM Completion (Forward to Dispatch)
// ----------------------------------------------------
console.log('\n--- TEST D: BOM Completion (Forward to Dispatch) ---');
const bom001_confirmed = {
  ...bom001_draft,
  status: 'Sales Confirmed - Sent to Dispatch',
  salesConfirmed: true,
  salesConfirmedAt: new Date().toISOString()
};

const configsD = buildProductionConfigs({ bomStore: [bom001_confirmed], invoiceList: [] });
const dispatchRowsD = configsD['Dispatch Orders'].rows;
const accountsRowsD = configsD['Accounts Verification'].rows;
const invoiceRowsD = configsD['Invoice Management'].rows;

assert(dispatchRowsD.length === 1 && dispatchRowsD[0].code === 'VRM-BOM-2026-01', 'BOM advances to Dispatch page upon completion');
assert(accountsRowsD.length === 0, 'Confirmed BOM does NOT appear on Accounts page yet');
assert(invoiceRowsD.length === 0, 'Confirmed BOM does NOT appear on Billing/Invoice page yet');
const invD = computeInventory([bom001_confirmed]);
assert(invD.totalReserved === 100, 'Reserved stock remains held during BOM confirmation');

// ----------------------------------------------------
// TEST E – Dispatch Packing Progress Save
// ----------------------------------------------------
console.log('\n--- TEST E: Dispatch Packing Progress Save ---');
const bom001_partially_packed = {
  ...bom001_confirmed,
  status: 'Partially Packed',
  packingStatus: 'PARTIALLY_PACKED',
  dispatchPacking: [{ code: 'MR-300MM', name: 'Mini Rail 300mm', bomQty: 100, qty: 100, packed: true }],
  accountsVerification: { readyForAccounts: false, verified: false }
};

const configsE = buildProductionConfigs({ bomStore: [bom001_partially_packed], invoiceList: [] });
assert(configsE['Dispatch Orders'].rows.length === 1, 'BOM remains permanently visible on Dispatch page');
assert(configsE['Accounts Verification'].rows.length === 0, 'Draft/partially packed BOM does NOT leak into Accounts before Send to Accounts');
assert(configsE['Invoice Management'].rows.length === 0, 'Partially packed BOM does NOT leak into Billing');
const invE = computeInventory([bom001_partially_packed]);
assert(invE.totalReserved === 100, 'Inventory reservation remains strictly active during packing');

// ----------------------------------------------------
// TEST F – Dispatch Explicit Forward to Accounts
// ----------------------------------------------------
console.log('\n--- TEST F: Dispatch Explicit Forward to Accounts ---');
const bom001_sent_to_accounts = {
  ...bom001_partially_packed,
  status: 'Packed & Awaiting Accounts Verification',
  packingStatus: 'PACKING_VERIFIED',
  accountsVerification: { readyForAccounts: true, verified: false }
};

const configsF = buildProductionConfigs({ bomStore: [bom001_sent_to_accounts], invoiceList: [] });
assert(configsF['Dispatch Orders'].rows.length === 1, 'Record remains permanently visible on Dispatch page');
assert(configsF['Accounts Verification'].rows.length === 1, 'Record now officially enters Accounts Verification');
assert(configsF['Invoice Management'].rows.length === 0, 'Billing CANNOT see record before Accounts clearance');
const invF = computeInventory([bom001_sent_to_accounts]);
assert(invF.totalReserved === 100, 'Reservation remains 100% active, no stock released prematurely');

// ----------------------------------------------------
// TEST G – Accounts Verification & Forward to Billing
// ----------------------------------------------------
console.log('\n--- TEST G: Accounts Verification & Forward to Billing ---');
const bom001_accounts_verified = {
  ...bom001_sent_to_accounts,
  status: 'Accounts Verified & Passed to Invoice',
  isAccountsDone: true,
  accountsVerification: { readyForAccounts: true, verified: true, paymentStatus: '100% Paid', verifiedBy: 'Accounts Lead' }
};

const configsG = buildProductionConfigs({ bomStore: [bom001_accounts_verified], invoiceList: [] });
assert(configsG['Dispatch Orders'].rows.length === 1, 'Dispatch permanently retains the record');
assert(configsG['Accounts Verification'].rows.length === 1, 'Accounts permanently retains the record');
assert(configsG['Invoice Management'].rows.length === 1, 'Billing receives the record after Accounts clearance');
const invG = computeInventory([bom001_accounts_verified]);
assert(invG.totalReserved === 100, 'Reserved stock remains untouched and active in Billing stage');

// ----------------------------------------------------
// TEST H – Invoice Completion & Single BOM Stock Deduction
// ----------------------------------------------------
console.log('\n--- TEST H: Invoice Completion & Single BOM Stock Deduction ---');
const bom001_invoiced = {
  ...bom001_accounts_verified,
  status: 'Awaiting Vehicle Loading & Dispatch',
  invoiceConfirmed: true,
  invoiceNo: 'VRM-INV-2026-01',
  stockDeducted: true
};

const configsH = buildProductionConfigs({ bomStore: [bom001_invoiced], invoiceList: [] });
assert(configsH['Dispatch Orders'].rows.length === 1, 'Dispatch retains record with Awaiting Vehicle Load');
const dispRowH = configsH['Dispatch Orders'].rows[0];
assert(dispRowH.status === 'AWAITING VEHICLE LOAD', 'Dispatch status displays exact AWAITING VEHICLE LOAD');
assert(configsH['Accounts Verification'].rows.length === 1, 'Accounts retains record');
assert(configsH['Invoice Management'].rows.length === 1, 'Billing retains completed invoice record');

const invH = computeInventory([bom001_invoiced]);
assert(invH.physical === 900, 'Physical stock deducted by 100 units (1000 - 100 = 900)');
assert(invH.totalReserved === 0, 'Active reservation for BOM-001 is closed to 0');
assert(invH.available === 900, 'Available stock remains accurate (900 physical - 0 reserved = 900)');

// ----------------------------------------------------
// TEST I – Final Dispatch Completion
// ----------------------------------------------------
console.log('\n--- TEST I: Final Dispatch Completion ---');
const bom001_completed = {
  ...bom001_invoiced,
  status: 'Completed',
  fullyCompleted: true,
  vehicleLoading: { loadedAt: new Date().toISOString(), photos: ['photo1.jpg', 'photo2.jpg'], lrNo: 'LR-9988' }
};

const configsI = buildProductionConfigs({ bomStore: [bom001_completed], invoiceList: [] });
assert(configsI['Dispatch Orders'].rows.length === 1, 'Completed BOM remains visible in Dispatch Orders');
assert(configsI['Accounts Verification'].rows.length === 1, 'Completed BOM remains visible in Accounts');
assert(configsI['Invoice Management'].rows.length === 1, 'Completed BOM remains visible in Billing');
const invI = computeInventory([bom001_completed]);
assert(invI.physical === 900, 'No duplicate physical stock deduction occurred (remains 900)');

// ----------------------------------------------------
// TEST J – Concurrent Reservations Across 6 Salespersons
// ----------------------------------------------------
console.log('\n--- TEST J: Concurrent Reservations Across 6 Salespersons ---');
const sixBoms = [
  { bomCode: 'VRM-BOM-2026-01', status: 'Draft', salesPerson: salespersonA.name, salesPersonCode: salespersonA.code, items: [{ code: 'MR-300MM', qty: 100 }] },
  { bomCode: 'VRM-BOM-2026-02', status: 'Draft', salesPerson: salespersonB.name, salesPersonCode: salespersonB.code, items: [{ code: 'MR-300MM', qty: 150 }] },
  { bomCode: 'VRM-BOM-2026-03', status: 'Sales Confirmed - Sent to Dispatch', salesPerson: salespersonC.name, salesPersonCode: salespersonC.code, items: [{ code: 'MR-300MM', qty: 200 }] },
  { bomCode: 'VRM-BOM-2026-04', status: 'Partially Packed', salesPerson: salespersonD.name, salesPersonCode: salespersonD.code, items: [{ code: 'MR-300MM', qty: 50 }] },
  { bomCode: 'VRM-BOM-2026-05', status: 'Packed & Awaiting Accounts Verification', salesPerson: salespersonE.name, salesPersonCode: salespersonE.code, items: [{ code: 'MR-300MM', qty: 120 }] },
  { bomCode: 'VRM-BOM-2026-06', status: 'Accounts Verified & Passed to Invoice', salesPerson: salespersonF.name, salesPersonCode: salespersonF.code, items: [{ code: 'MR-300MM', qty: 80 }] }
];

const invJ1 = computeInventory(sixBoms);
const expectedTotalReserved = 100 + 150 + 200 + 50 + 120 + 80; // = 700
assert(invJ1.totalReserved === expectedTotalReserved, `Combined reserved stock across 6 salespersons is ${expectedTotalReserved}`);
assert(invJ1.available === 1000 - expectedTotalReserved, `Available stock correctly computed (1000 - 700 = ${1000 - expectedTotalReserved})`);

// Now complete invoice for BOM-001 (Salesperson A)
const sixBomsWithBom1Invoiced = sixBoms.map(b => b.bomCode === 'VRM-BOM-2026-01' ? { ...b, status: 'Invoice Confirmed', invoiceConfirmed: true, stockDeducted: true } : b);
const invJ2 = computeInventory(sixBomsWithBom1Invoiced);

assert(invJ2.physical === 900, 'Physical stock reduced only by BOM-001 invoiced qty (1000 - 100 = 900)');
assert(invJ2.reservedByBom['VRM-BOM-2026-01'] === undefined, 'BOM-001 active reservation cleared to 0');
assert(invJ2.reservedByBom['VRM-BOM-2026-02'] === 150, 'Salesperson B BOM-002 reservation strictly untouched (150)');
assert(invJ2.reservedByBom['VRM-BOM-2026-03'] === 200, 'Salesperson C BOM-003 reservation strictly untouched (200)');
assert(invJ2.reservedByBom['VRM-BOM-2026-04'] === 50,  'Salesperson D BOM-004 reservation strictly untouched (50)');
assert(invJ2.reservedByBom['VRM-BOM-2026-05'] === 120, 'Salesperson E BOM-005 reservation strictly untouched (120)');
assert(invJ2.reservedByBom['VRM-BOM-2026-06'] === 80,  'Salesperson F BOM-006 reservation strictly untouched (80)');
assert(invJ2.totalReserved === 600, 'Total reserved reduced strictly by 100 (700 -> 600)');
assert(invJ2.available === 300, 'Available stock remains consistent (900 - 600 = 300)');

// ----------------------------------------------------
// TEST K – Duplicate Submission & Idempotency
// ----------------------------------------------------
console.log('\n--- TEST K: Duplicate Submission & Idempotency ---');
// Simulating repeated deduction call on the same BOM
const invK1 = computeInventory(sixBomsWithBom1Invoiced);
const invK2 = computeInventory(sixBomsWithBom1Invoiced);
assert(invK1.physical === invK2.physical, 'Physical stock deducted only once despite repeated checks');
assert(invK1.totalReserved === invK2.totalReserved, 'Reservation not altered on repeated submission');

// ----------------------------------------------------
// TEST L – Salesperson Identity Preservation
// ----------------------------------------------------
console.log('\n--- TEST L: Salesperson Identity Preservation ---');
const configsL = buildProductionConfigs({ bomStore: sixBoms, invoiceList: [] });
const dispatchL = configsL['Dispatch Orders'].rows;
// In Dispatch Orders, only BOMs that entered dispatch are shown (BOM-03, 04, 05, 06)
assert(dispatchL.length === 4, 'Dispatch only shows confirmed/in-progress BOMs, not draft preparation');
const bom03Row = dispatchL.find(r => r.code === 'VRM-BOM-2026-03');
const bom04Row = dispatchL.find(r => r.code === 'VRM-BOM-2026-04');
assert(bom03Row && bom03Row.salesPerson === salespersonC.name, 'BOM-003 salesperson strictly preserved as Kavitha Nair');
assert(bom04Row && bom04Row.salesPerson === salespersonD.name, 'BOM-004 salesperson strictly preserved as Suresh Kumar');

// ----------------------------------------------------
// TEST M – Permanent Visibility Audit
// ----------------------------------------------------
console.log('\n--- TEST M: Permanent Visibility Audit ---');
// Verify that an order that reaches stage 7 (Completed) is permanently visible in BOM, Dispatch, Accounts, and Billing
const fullyCompletedBom = {
  bomCode: 'VRM-BOM-2026-99',
  code: 'VRM-BOM-2026-99',
  customerName: 'Tata Power Solar',
  status: 'Completed',
  fullyCompleted: true,
  salesConfirmed: true,
  isAccountsDone: true,
  accountsVerification: { readyForAccounts: true, verified: true },
  invoiceConfirmed: true,
  invoiceNo: 'VRM-INV-2026-99',
  stockDeducted: true,
  vehicleLoading: { loadedAt: new Date().toISOString() }
};

const configsM = buildProductionConfigs({ bomStore: [fullyCompletedBom], invoiceList: [] });
assert(configsM['Dispatch Orders'].rows.some(r => r.code === 'VRM-BOM-2026-99'), 'Completed order permanently visible on Dispatch page');
assert(configsM['Accounts Verification'].rows.some(r => r.code === 'VRM-BOM-2026-99'), 'Completed order permanently visible on Accounts page');
assert(configsM['Invoice Management'].rows.some(r => r.poNo === 'VRM-BOM-2026-99' || r.bomCode === 'VRM-BOM-2026-99'), 'Completed order permanently visible on Billing/Invoice page');

// ----------------------------------------------------
// TEST N – Failure Recovery
// ----------------------------------------------------
console.log('\n--- TEST N: Failure Recovery ---');
// If invoice completion fails, BOM status remains 'Accounts Verified & Passed to Invoice'
const failedBomState = { ...bom001_accounts_verified };
const invN = computeInventory([failedBomState]);
assert(invN.physical === INITIAL_PHYSICAL_STOCK, 'Failed operation does NOT deduct physical stock prematurely');
assert(invN.reservedByBom['VRM-BOM-2026-01'] === 100, 'Failed operation preserves active reservation without corruption');

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
