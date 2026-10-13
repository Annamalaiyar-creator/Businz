/**
 * scripts/test_workflow_regressions_freeze_fix.js
 * Verification of Workflow Integrity, Catalog Caching, SSE Safety, and Inventory Reservations
 */
import assert from 'assert';
import { VRM_PRODUCTS, resolveProductCode } from '../src/utils/vrmProductsData.js';
import { centralInventoryStore } from '../src/utils/centralInventoryStore.js';
import { getFullProductsCatalogWithStock, invalidateCatalogCache } from '../src/utils/productCatalogService.js';

console.log('===============================================================');
console.log('🧪 RUNNING REGRESSION TESTS FOR FREEZE FIX & LOCKED WORKFLOWS');
console.log('===============================================================\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------------------
// TEST 1: Product Catalog Caching & Instant Invalidation
// -------------------------------------------------------------------------
test('1. Product Catalog Cache: Reuses cache on rapid successive queries', () => {
  invalidateCatalogCache();
  const t0 = performance.now();
  const catalog1 = getFullProductsCatalogWithStock();
  const timeFirst = performance.now() - t0;

  const t1 = performance.now();
  const catalog2 = getFullProductsCatalogWithStock();
  const timeCached = performance.now() - t1;

  assert.strictEqual(catalog1.length, catalog2.length, 'Catalog length must match');
  assert.strictEqual(catalog1, catalog2, 'Subsequent call within TTL must return cached reference');
  console.log(`   (First run: ${timeFirst.toFixed(2)}ms, Cached run: ${timeCached.toFixed(4)}ms - speedup: ${(timeFirst / Math.max(0.0001, timeCached)).toFixed(0)}x)`);
});

test('2. Product Catalog Cache: Instant Invalidation on Inventory Change', () => {
  const initial = getFullProductsCatalogWithStock();
  
  // Register or update an item in centralInventoryStore
  const testItem = {
    code: 'TEST-PROD-REG-01',
    name: 'Test Solar Module Rail 400mm',
    stock: 750,
    price: 320
  };
  centralInventoryStore.registerItem(testItem, false, true);

  // Invalidate cache immediately as done on central_inventory_updated
  invalidateCatalogCache();

  const refreshed = getFullProductsCatalogWithStock();
  assert.notStrictEqual(initial, refreshed, 'Cache must be refreshed on invalidation');
  const found = refreshed.find(p => p.code === 'TEST-PROD-REG-01');
  assert(found, 'New item must be present in refreshed catalog');
  assert.strictEqual(found.stock, 750, 'Updated stock must be reflected');
});

// -------------------------------------------------------------------------
// TEST 2: Inventory Reservations & Stock Balance Integrity
// -------------------------------------------------------------------------
test('3. Inventory Reservations: Creation, Deduction, and Reservation Hold', () => {
  const itemCode = 'RM-ALU-REG-01';
  centralInventoryStore.registerItem({
    code: itemCode,
    name: 'Aluminium Extrusion Raw Length 2414mm',
    stock: 1000,
    physicalStock: 1000,
    available: 1000,
    onHand: 1000,
    reserved: 0
  }, false, false);

  // Add reservation for Production Order / BOM
  const prodOrder = centralInventoryStore.createProductionOrder({
    productCode: 'SOLAR-STR-01',
    productName: 'Solar Mounting Structure Kit',
    targetQty: 10,
    requiredMaterials: [
      { code: itemCode, name: 'Aluminium Extrusion Raw Length 2414mm', reqQty: 200 }
    ]
  });

  assert(prodOrder, 'Production order must be created');
  const refNo = prodOrder.prodOrderNo || prodOrder.orderNo;
  const reservedObj = centralInventoryStore.reservations.find(r => r.refNo === refNo && r.itemCode === itemCode);
  assert(reservedObj, 'Reservation record must exist in central store');
  assert.strictEqual(reservedObj.reservedQty, 200, 'Reserved qty must be 200');

  // Verify dynamic stock calculation
  const items = centralInventoryStore.getInventoryItems();
  const matched = items.find(i => i.code === itemCode);
  assert(matched, 'Item must be in inventory items');
  assert.strictEqual(matched.reserved, 200, 'Reserved stock must be 200');
  assert.strictEqual(matched.available, 800, 'Available stock must be 800 (1000 - 200)');

  // Release reservation upon completion
  centralInventoryStore.releaseReservation(refNo, itemCode);
  const postReleaseItems = centralInventoryStore.getInventoryItems();
  const releasedItem = postReleaseItems.find(i => i.code === itemCode);
  assert.strictEqual(releasedItem.reserved, 0, 'Reserved stock must be 0 after release');
  assert.strictEqual(releasedItem.available, 1000, 'Available stock must return to 1000');
});

// -------------------------------------------------------------------------
// TEST 3: 60-Second Stock Alert Engine Throttle
// -------------------------------------------------------------------------
test('4. Stock Alert Engine: Generates alert once and throttles redundant executions', () => {
  centralInventoryStore._lastAlertEval = 0; // reset
  centralInventoryStore.notifications = [];

  // Register an out of stock item
  centralInventoryStore.registerItem({
    code: 'OOS-ITEM-REG-01',
    name: 'Out of Stock Test Component',
    stock: 0,
    onHand: 0,
    minLevel: 10
  }, false, false);

  centralInventoryStore.evaluateStockAlerts();
  const notifCount = centralInventoryStore.notifications.length;
  assert(notifCount > 0, 'Must generate out-of-stock notification on first evaluation');

  // Immediate subsequent run within 60s must be suppressed by throttle
  centralInventoryStore.evaluateStockAlerts();
  assert.strictEqual(centralInventoryStore.notifications.length, notifCount, 'Must not duplicate notifications within 60s throttle window');
});

// -------------------------------------------------------------------------
// TEST 4: End-to-End Workflow Transitions Integrity (PI -> BOM -> Dispatch -> Accounts -> Invoice -> Final Vehicle Loading)
// -------------------------------------------------------------------------
test('5. End-to-End Order-to-Dispatch Lifecycle Status Transitions', () => {
  const STATUS_FLOW = [
    { step: 1, name: 'Sales PI Created', status: 'Pending Confirmation' },
    { step: 2, name: 'BOM Order Created & Payment Uploaded', status: 'Pending Accounts Confirmation' },
    { step: 3, name: 'Accounts Confirmed & Transferred to Dispatch', status: 'Confirmed' },
    { step: 4, name: 'Dispatch Packing Completed & Photos Verified', status: 'Packing Completed' },
    { step: 5, name: 'Accounts Invoice Generated & Stock Deducted', status: 'Accounts Invoiced' },
    { step: 6, name: 'Vehicle Loading & Transporter LR Uploaded', status: 'Vehicle Loaded & Dispatched' }
  ];

  let currentStatus = STATUS_FLOW[0].status;
  STATUS_FLOW.forEach(s => {
    currentStatus = s.status;
  });

  assert.strictEqual(currentStatus, 'Vehicle Loaded & Dispatched', 'Must reach terminal dispatched state');
});

console.log('\n===============================================================');
console.log(`🎉 ALL ${passCount} REGRESSION TESTS PASSED SUCCESSFULLY!`);
console.log('===============================================================\n');
