/**
 * ControlRoom Integrated Production & Inventory Store Manager
 * 
 * Single Source of Truth for Item Master, BOMs, Work Orders, Stock Movements,
 * Material Issue, Actual Consumption Variance, Scrap & Reusable Returns, and Audit Ledger.
 */

import { VRM_PRODUCTS } from './vrmProductsData';

// Central Item Master Database loaded strictly from official VRM catalog
export const INITIAL_ITEM_MASTER = VRM_PRODUCTS.map((p, idx) => ({
  code: p.code,
  name: p.name,
  category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Component' : 'Aluminium Profile',
  uom: p.uom || 'Nos',
  stock: 0,
  safetyStock: 50,
  unitRate: 1200 + (idx * 50) % 2500,
  location: p.material === 'HDG' ? 'Warehouse Bay #1 (HDG)' : p.material === 'GAL' ? 'Warehouse Bay #2 (GAL)' : 'Warehouse Bay #3 (Aluminium)',
  specs: `Material: ${p.material || 'HDG'} | Section: ${p.sections || 'Standard'} | GST: ${p.gst || '18%'}`
}));

// Configurable Bill of Materials (BOM) Registry built strictly from official VRM catalog
export const BOM_REGISTRY = {
  'BOM-L500-001': {
    bomCode: 'BOM-L500-001',
    productCode: 'L500',
    productName: 'LEG 500 mm (HDG)',
    uom: 'Nos',
    ruleType: 'ASSEMBLY_MULTI_COMPONENT',
    components: [
      { itemCode: 'BP', itemName: 'BRACING PLATE 80*160', qtyPerUnit: 2, uom: 'Nos' },
      { itemCode: 'B150', itemName: 'BASE PLATE 150*150', qtyPerUnit: 1, uom: 'Nos' },
      { itemCode: 'LB', itemName: 'L BRACING', qtyPerUnit: 2, uom: 'Nos' }
    ]
  },
  'BOM-R1600-002': {
    bomCode: 'BOM-R1600-002',
    productCode: 'R1600',
    productName: 'RAFTER 1600 mm (HDG)',
    uom: 'Nos',
    ruleType: 'ASSEMBLY_MULTI_COMPONENT',
    components: [
      { itemCode: 'RC40', itemName: 'RAFTER CLEAT 500*40', qtyPerUnit: 2, uom: 'Nos' },
      { itemCode: 'PC50', itemName: 'PURLIN CLEAT 50*60*60', qtyPerUnit: 4, uom: 'Nos' }
    ]
  },
  'BOM-MR100N-003': {
    bomCode: 'BOM-MR100N-003',
    productCode: 'MR100N',
    productName: '100mm mini rail (new)',
    uom: 'Nos',
    ruleType: 'PROFILE_ASSEMBLY',
    components: [
      { itemCode: 'UM', itemName: 'Universal Mid Clamp', qtyPerUnit: 2, uom: 'Nos' },
      { itemCode: 'UE', itemName: 'Universal End Clamp', qtyPerUnit: 2, uom: 'Nos' },
      { itemCode: 'E40', itemName: 'EPDM 40*40', qtyPerUnit: 1, uom: 'Nos' }
    ]
  }
};

class ProductionInventoryStore {
  constructor() {
    this.itemMaster = [...INITIAL_ITEM_MASTER];
    this.workOrders = [];

    // Transaction Audit Ledger
    this.ledger = [
      { id: 'TXN-901', timestamp: '2026-08-11 14:00', woRef: 'WO-2026-101', itemCode: 'BP', actionType: 'MATERIAL_ISSUE', qty: -1000, uom: 'Nos', user: 'Senthil Kumar', dept: 'Shop Floor', stockBefore: 1200, stockAfter: 200, notes: 'Issued for 500 Nos LEG 500 mm (HDG)' },
      { id: 'TXN-902', timestamp: '2026-08-11 14:00', woRef: 'WO-2026-101', itemCode: 'B150', actionType: 'MATERIAL_ISSUE', qty: -500, uom: 'Nos', user: 'Senthil Kumar', dept: 'Shop Floor', stockBefore: 850, stockAfter: 350, notes: 'Issued for 500 Nos LEG 500 mm (HDG)' },
      { id: 'TXN-903', timestamp: '2026-08-11 14:00', woRef: 'WO-2026-101', itemCode: 'LB', actionType: 'MATERIAL_ISSUE', qty: -1000, uom: 'Nos', user: 'Senthil Kumar', dept: 'Shop Floor', stockBefore: 1500, stockAfter: 500, notes: 'Issued for 500 Nos LEG 500 mm (HDG)' }
    ];
  }

  getItemMaster() {
    return this.itemMaster;
  }

  getWorkOrders() {
    return this.workOrders;
  }

  getBOM(bomCode) {
    return BOM_REGISTRY[bomCode] || null;
  }

  createWorkOrder(woData) {
    const newWO = {
      ...woData,
      createdAt: new Date().toISOString().split('T')[0],
      progress: woData.progress || 0
    };
    this.workOrders.unshift(newWO);

    // Update stock in Item Master if materials specified
    if (woData.materials && Array.isArray(woData.materials)) {
      woData.materials.forEach(mat => {
        const item = this.itemMaster.find(i => i.code === mat.name || i.name === mat.name);
        if (item) {
          item.stock = Math.max(0, item.stock - Number(mat.requiredQty || 0));
        }
      });
    }

    return newWO;
  }

  issueMaterialForWO(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) return false;

    wo.status = 'Material Issued';
    wo.issuedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // Create Ledger entries
    (wo.plannedMaterials || []).forEach(m => {
      const item = this.itemMaster.find(i => i.code === m.itemCode || i.name === m.itemName);
      const stockBefore = item ? item.stock : 1000;
      const stockAfter = Math.max(0, stockBefore - m.plannedQty);
      if (item) item.stock = stockAfter;

      this.ledger.unshift({
        id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: wo.issuedAt,
        woRef: wo.id,
        itemCode: m.itemCode,
        actionType: 'MATERIAL_ISSUE',
        qty: -m.plannedQty,
        uom: m.uom,
        user: 'Production Supervisor',
        dept: 'Shop Floor',
        stockBefore,
        stockAfter,
        notes: `Material issued for Work Order ${wo.id}`
      });
    });

    return true;
  }

  recordProductionOutput(woId, outputData) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) return false;

    wo.status = 'Completed';
    wo.output = outputData;
    wo.progress = 100;

    // Add accepted finished product to item master stock
    const fgItem = this.itemMaster.find(i => i.code === wo.productCode || i.name === wo.productName);
    if (fgItem) {
      fgItem.stock += Number(outputData.acceptedQty || 0);
    }

    return true;
  }

  getLedger() {
    return this.ledger;
  }
}

export const prodInventoryStore = new ProductionInventoryStore();
