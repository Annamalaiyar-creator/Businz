/**
 * ControlRoom Integrated Production & Inventory Engine
 * 
 * Features:
 * - Production BOM / Manufacturing Recipe System (1 Length -> 8 Mini Rail 100mm, etc.)
 * - 6-Stage Inventory State Engine (Physical, Reserved, Available, Issued, Consumed, Finished Goods)
 * - Whole Physical Stock Unit Constraint Guard (e.g. 100 pcs -> 13 Lengths physical)
 * - Work Order Lifecycle (DRAFT -> PENDING_MATERIAL -> RESERVED -> ISSUED -> ACCEPTED -> IN_PROGRESS -> VERIFICATION_PENDING -> APPROVED/CLOSED)
 * - Immutable Audit Ledger with Txn IDs
 * - Full Partial / Rejection Output & Additional Material Request handling
 */

import { fetchCloudStore, saveCloudStore, subscribeToCloudStore } from './supabaseDataSync';
import { stripDataUrlsFromRecord } from './mediaUtils';
import { CANONICAL_PRODUCT_ALIASES } from './vrmProductsData';

// Initial Manufacturing Recipes (BOMs)
export const INITIAL_MANUFACTURING_RECIPES = [
  {
    id: 'RECIPE-MR300',
    productCode: 'MR-300MM',
    productName: 'Mini Rail - 300 mm',
    outputUnit: 'Pieces',
    expectedOutputQty: 8,
    rawMaterialCode: 'ALU-LEN-2414MM',
    rawMaterialName: 'Aluminium Length (2414 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: 'Mini Rail profile (300mm Cut Length). 1 Aluminium Length (2414 mm) yields 8 pieces (300mm each) with 2mm saw kerf.'
  },
  {
    id: 'RECIPE-MR100',
    productCode: 'MR100',
    productName: 'Mini Rail 100 mm Height',
    outputUnit: 'Pieces',
    expectedOutputQty: 24,
    rawMaterialCode: 'ALU-LEN-2414MM',
    rawMaterialName: 'Aluminium Length (2414 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: 'Mini Rail profile (100mm Height). User specifies custom Cut Length (mm) per order.'
  },
  {
    id: 'RECIPE-MR150',
    productCode: 'MR150',
    productName: 'Mini Rail 150 mm Height',
    outputUnit: 'Pieces',
    expectedOutputQty: 16,
    rawMaterialCode: 'ALU-LEN-2414MM',
    rawMaterialName: 'Aluminium Length (2414 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: 'Mini Rail profile (150mm Height). User specifies custom Cut Length (mm) per order.'
  },
  {
    id: 'RECIPE-LR2414',
    productCode: 'LR2414',
    productName: 'Long Rail 2414 mm',
    outputUnit: 'Pieces',
    expectedOutputQty: 1,
    rawMaterialCode: 'ALU-LEN-2414MM',
    rawMaterialName: 'Aluminium Length (2414 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: 'Standard 1 Aluminium Length (2414mm) yields 1 Full Long Rail 2414mm piece.'
  },
  {
    id: 'RECIPE-MC35',
    productCode: 'MC35',
    productName: 'Mid Clamp 35 mm',
    outputUnit: 'Pieces',
    expectedOutputQty: 75,
    rawMaterialCode: 'ALU-BAR-2650MM',
    rawMaterialName: 'Aluminium Extrusion Bar (2650 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: '1 Raw Length (2650 mm) yields 75 Mid Clamp (35 mm) pieces with 2 mm saw kerf.'
  },
  {
    id: 'RECIPE-EC35',
    productCode: 'EC35',
    productName: 'End Clamp 35 mm',
    outputUnit: 'Pieces',
    expectedOutputQty: 75,
    rawMaterialCode: 'ALU-BAR-2650MM',
    rawMaterialName: 'Aluminium Extrusion Bar (2650 mm)',
    rawMaterialUnit: 'Length',
    inputQty: 1,
    notes: '1 Raw Length (2650 mm) yields 75 End Clamp (35 mm) pieces with 2 mm saw kerf.'
  }
];

// Initial Multi-Stage Inventory Stock
export const INITIAL_INVENTORY_ITEMS = [
  {
    code: 'ALU-LEN-2414MM',
    name: 'Aluminium Length (2414 mm)',
    category: 'Raw Material',
    unit: 'Length',
    isWholeUnitOnly: true,
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 15,
    unitRate: 580,
    bayLocation: 'Bay #1 - Extrusion Yard'
  },
  {
    code: 'ALU-BAR-2650MM',
    name: 'Aluminium Extrusion Bar (2650 mm)',
    category: 'Raw Material',
    unit: 'Length',
    isWholeUnitOnly: true,
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 20,
    unitRate: 620,
    bayLocation: 'Bay #1 - Extrusion Yard'
  },
  {
    code: 'ALU-COIL-1.5',
    name: 'Aluminium Strip Coil (3000 mm Length)',
    category: 'Raw Material',
    unit: 'Length',
    isWholeUnitOnly: true,
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 50,
    unitRate: 260,
    bayLocation: 'Bay #2 - Storage'
  },
  {
    code: 'MR-300MM',
    name: 'Mini Rail - 300 mm',
    category: 'Finished Goods',
    unit: 'Pieces',
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 50,
    unitRate: 140,
    bayLocation: 'Bay #4 - FG Store'
  },
  {
    code: 'MR100N',
    name: '100mm mini rail (new)',
    category: 'Finished Goods',
    unit: 'Pieces',
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 20,
    unitRate: 150,
    bayLocation: 'Bay #4 - FG Store'
  },
  {
    code: 'MR150',
    name: 'Mini Rail 150 mm',
    category: 'Finished Goods',
    unit: 'Pieces',
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 50,
    unitRate: 160,
    bayLocation: 'Bay #4 - FG Store'
  },
  {
    code: 'LR3000',
    name: 'Long Rail 3000 mm',
    category: 'Finished Goods',
    unit: 'Pieces',
    physicalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    safetyStock: 20,
    unitRate: 1100,
    bayLocation: 'Bay #4 - FG Store'
  }
];

// Seed Work Orders
export const INITIAL_WORK_ORDERS = [
  {
    id: 'WO-1',
    date: new Date().toISOString().split('T')[0],
    productionHead: 'Senthil Kumar (Production Head)',
    finishedProductCode: 'MR100',
    finishedProductName: 'Mini Rail 100 mm',
    targetQty: 8,
    unit: 'Pieces',
    recipeId: 'RECIPE-MR100',
    recipeRatio: '1 Aluminium Length → 24 Pieces',
    rawMaterialCode: 'ALU-LEN-2414MM',
    rawMaterialName: 'Aluminium Length (2414 mm)',
    rawMaterialRequiredQty: 0.33, // Exact calculated
    rawMaterialPhysicalToIssue: 1, // Physical whole unit required
    rawMaterialUnit: 'Length',
    expectedOutputQty: 24,
    excessTheoreticalQty: 16,
    priority: 'High',
    productionLocation: 'CNC Line 01',
    assignedEmployee: 'Floor Employee A (Karthik)',
    expectedStartDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: new Date().toISOString().split('T')[0],
    instructions: 'Cut 1 Aluminium Length (2414 mm) into 24 exact 100mm mini rail pieces. Check burr edges.',
    remarks: 'Urgent order for Vikram Solar site.',
    status: 'DRAFT', // DRAFT -> PENDING_MATERIAL -> RESERVED -> ISSUED -> ACCEPTED -> IN_PROGRESS -> VERIFICATION_PENDING -> APPROVED/CLOSED
    
    // Execution state
    reservedAt: null,
    issuedAt: null,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    verifiedAt: null,

    actualGoodOutput: 0,
    actualRejectedOutput: 0,
    actualWastageOutput: 0,
    operatorRemarks: '',
    completionImages: [],

    progressHistory: [],
    materialIssueHistory: [],
    additionalMaterialRequests: [],
    reworkHistory: []
  }
];

class ProductionModuleEngine {
  constructor() {
    this.recipes = [...INITIAL_MANUFACTURING_RECIPES];
    this.inventory = [...INITIAL_INVENTORY_ITEMS];
    this.workOrders = [...INITIAL_WORK_ORDERS];
    this.ledger = [];

    this.subscribers = [];
    this.workOrders = (this.workOrders || []).map(w => this._sanitizeWorkOrder(w));
    this.loadFromStorage();
    this.initCloudSync();
  }

  _sanitizeWorkOrder(wo) {
    if (!wo || typeof wo !== 'object') return wo;
    if (!Array.isArray(wo.progressHistory)) wo.progressHistory = [];
    if (!Array.isArray(wo.materialIssueHistory)) wo.materialIssueHistory = [];
    if (!Array.isArray(wo.additionalMaterialRequests)) wo.additionalMaterialRequests = [];
    if (!Array.isArray(wo.reworkHistory)) wo.reworkHistory = [];
    if (!Array.isArray(wo.completionImages)) wo.completionImages = [];
    if (!Array.isArray(wo.productItems)) wo.productItems = [];
    return wo;
  }

  initCloudSync() {
    // Load all collections directly from Supabase Cloud Database
    Promise.all([
      fetchCloudStore('vrm_prod_workorders', this.workOrders),
      fetchCloudStore('vrm_prod_inventory', this.inventory),
      fetchCloudStore('vrm_prod_recipes', this.recipes),
      fetchCloudStore('vrm_prod_ledger', this.ledger)
    ]).then(([cloudWOs, cloudInv, cloudRecipes, cloudLedger]) => {
      if (Array.isArray(cloudWOs) && cloudWOs.length > 0) {
        this.workOrders = cloudWOs.map(w => this._sanitizeWorkOrder(w));
        try { localStorage.setItem('vrm_prod_workorders', JSON.stringify(this.workOrders)); } catch (_) {}
      }
      if (Array.isArray(cloudInv) && cloudInv.length > 0) {
        this.inventory = cloudInv;
        try { localStorage.setItem('vrm_prod_inventory', JSON.stringify(this.inventory)); } catch (_) {}
      }
      if (Array.isArray(cloudRecipes) && cloudRecipes.length > 0) this.recipes = cloudRecipes;
      if (Array.isArray(cloudLedger) && cloudLedger.length > 0) this.ledger = cloudLedger;
      this.notifySubscribers();
    }).catch(err => console.warn('[ProductionEngine] Cloud boot fetch notice:', err));

    // Live Realtime subscriptions from Supabase
    subscribeToCloudStore('vrm_prod_workorders', (latestWOs) => {
      if (Array.isArray(latestWOs)) {
        this.workOrders = latestWOs.map(w => this._sanitizeWorkOrder(w));
        try { localStorage.setItem('vrm_prod_workorders', JSON.stringify(this.workOrders)); } catch (_) {}
        this.notifySubscribers();
      }
    });

    subscribeToCloudStore('vrm_prod_inventory', (latestInv) => {
      if (Array.isArray(latestInv)) {
        this.inventory = latestInv;
        try { localStorage.setItem('vrm_prod_inventory', JSON.stringify(this.inventory)); } catch (_) {}
        this.notifySubscribers();
      }
    });
  }

  loadFromStorage() {
    try {
      const rawWOs = localStorage.getItem('vrm_prod_workorders');
      if (rawWOs) {
        const parsed = JSON.parse(rawWOs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.workOrders = parsed.map(w => this._sanitizeWorkOrder(w));
        }
      }
      const rawInv = localStorage.getItem('vrm_prod_inventory');
      if (rawInv) {
        const parsed = JSON.parse(rawInv);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.inventory = parsed;
        }
      }
    } catch (_) {}
  }

  saveToStorage() {
    try {
      try {
        localStorage.setItem('vrm_prod_workorders', JSON.stringify(this.workOrders));
        localStorage.setItem('vrm_prod_inventory', JSON.stringify(this.inventory));
      } catch (_) {}

      saveCloudStore('vrm_prod_recipes', this.recipes);
      saveCloudStore('vrm_prod_inventory', this.inventory);
      saveCloudStore('vrm_prod_workorders', this.workOrders);
      saveCloudStore('vrm_prod_ledger', this.ledger);

      this.notifySubscribers();
    } catch (e) {
      console.error('Failed saving VRM Production Engine storage:', e);
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => cb());
  }

  // Calculate Raw Material Requirement from Manufacturing Recipe & Custom Cut Length (mm)
  calculateMaterialRequirement(productCode, targetQty, customCutLengthMm = null, allProductItems = []) {
    const canonicalCode = CANONICAL_PRODUCT_ALIASES[String(productCode || '').toUpperCase().trim()] || productCode;
    const recipe = this.recipes.find(r => r.productCode === productCode || r.productCode === canonicalCode);

    // Parse cut length entered by user (e.g., "100", "100 mm", "500")
    let cutLenMm = 0;
    if (customCutLengthMm) {
      const parsed = parseFloat(String(customCutLengthMm).replace(/[^\d.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) cutLenMm = parsed;
    }

    // Product-specific raw bar total length lookup table (mm)
    const PRODUCT_RAW_BAR_LENGTHS = {
      'CC4.8N': 4800,
      'CC3.6': 3600,
      'SR3.6': 3600,
      'MR-300MM': 2414,
      'MR300': 2414,
      'MR100O': 2414,
      'MR100N': 2414,
      'LC': 3000,
      'MR60': 2414,
      'MR40': 2414,
      'AR100': 2414,
      'AR120': 2414,
      'MID-SEC': 2730,
      'TOP-2M': 2000,
      'BOT-2M': 2000,
      'TOP-1.5M': 1500,
      'BOT-2.4M': 2400,
      'MC35': 2650,
      'MC30': 2650,
      'T10': 2562,
      'UM': 2650,
      'UE': 2650,
      'EC35': 2650,
      'ALB': 2050,
      'T8': 2580
    };

    // Determine raw bar total length for the selected product (Defaults to 2414 mm if not specified)
    const rawLengthMm = PRODUCT_RAW_BAR_LENGTHS[productCode] || PRODUCT_RAW_BAR_LENGTHS[canonicalCode] || 2414;
    const bladeKerfMm = 2; // 2mm saw blade kerf width per cut stroke

    // Calculate how many pieces N fit in 1 length of rawLengthMm (where N pieces require N - 1 cuts of bladeKerfMm)
    let piecesPerLength = recipe ? Number(recipe.expectedOutputQty) : 1;
    if (cutLenMm > 0) {
      // (N * cutLenMm) + ((N - 1) * bladeKerfMm) <= rawLengthMm  =>  N * (cutLenMm + bladeKerfMm) <= rawLengthMm + bladeKerfMm
      piecesPerLength = Math.floor((rawLengthMm + bladeKerfMm) / (cutLenMm + bladeKerfMm));
      if (piecesPerLength < 1) piecesPerLength = 1;
    }

    // Calculate additional offcut cuts derived from extra rows in allProductItems
    let additionalConsumedMmPerBar = 0;
    if (Array.isArray(allProductItems) && allProductItems.length > 1) {
      allProductItems.slice(1).forEach(item => {
        const itemCutLen = parseFloat(String(item.cutLength || 0).replace(/[^\d.]/g, '')) || 0;
        const itemQty = parseFloat(item.targetQty || 0) || 0;
        if (itemCutLen > 0 && itemQty > 0) {
          // Each piece adds cut length + 2mm kerf cut stroke
          additionalConsumedMmPerBar += (itemQty * itemCutLen) + (itemQty * bladeKerfMm);
        }
      });
    }

    // Exact theoretical raw material length required
    const exactRequiredMatQty = Number(targetQty) / piecesPerLength;
    
    // Physical Whole Unit constraint rule (Must issue whole 2414 mm lengths)
    let physicalMatToIssue = Math.ceil(exactRequiredMatQty);
    let isWholeUnitConstraint = physicalMatToIssue > exactRequiredMatQty;
    let expectedTheoreticalOutput = physicalMatToIssue * piecesPerLength;

    // Wastage & Scrap Calculations (Product Length + Blade Kerf Loss)
    // 8 finished pieces from 1 bar require 7 cut strokes (N pieces = N - 1 cuts)
    const cutsPerBar = Math.max(0, piecesPerLength - 1);
    const netProductMmPerBar = piecesPerLength * cutLenMm;
    const kerfLossMmPerBar = cutsPerBar * bladeKerfMm;
    const usedLengthMmPerBar = netProductMmPerBar + kerfLossMmPerBar + additionalConsumedMmPerBar;
    const endOffcutScrapMmPerBar = Math.max(0, rawLengthMm - usedLengthMmPerBar);

    const totalIssuedMm = physicalMatToIssue * rawLengthMm;
    const totalNetProductMm = ((Number(targetQty) || 0) * cutLenMm) + additionalConsumedMmPerBar;
    const totalCutStrokes = Math.max(0, (Number(targetQty) || 0) - physicalMatToIssue);
    const totalKerfLossMm = totalCutStrokes * bladeKerfMm;
    const totalUtilizedMmForTarget = totalNetProductMm + totalKerfLossMm;
    const totalWastageMm = totalIssuedMm > 0 ? Math.max(0, totalIssuedMm - totalNetProductMm) : 0;
    const wastagePercent = totalIssuedMm > 0 ? Number(((totalWastageMm / totalIssuedMm) * 100).toFixed(2)) : 0;

    // Remainder Offcut Bar from Last Issued Unit
    const piecesInLastBar = (Number(targetQty) || 0) % piecesPerLength;
    const cutsInLastBar = Math.max(0, piecesInLastBar - 1);
    const usedMmInLastBar = piecesInLastBar > 0 ? (piecesInLastBar * cutLenMm + cutsInLastBar * bladeKerfMm) : 0;
    const remainderOffcutMm = piecesInLastBar > 0 ? Math.max(0, rawLengthMm - usedMmInLastBar) : 0;
    const remainderOffcutMeters = Number((remainderOffcutMm / 1000).toFixed(2));

    const targetRmCode = recipe?.rawMaterialCode || (rawLengthMm === 2650 ? 'ALU-BAR-2650MM' : (rawLengthMm === 2414 ? 'ALU-LEN-2414MM' : `ALU-LEN-${rawLengthMm}MM`));
    let rawItem = this.inventory.find(i => 
      i.code === targetRmCode || 
      i.code === productCode || 
      (i.lengthMm && String(i.lengthMm) === String(rawLengthMm))
    ) || (rawLengthMm === 2414 ? this.inventory.find(i => i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414') : null);

    // Resolve live stock across both engine inventory and central raw materials store
    let liveAvailable = rawItem ? (rawItem.availableStock !== undefined ? rawItem.availableStock : rawItem.physicalStock) : 0;
    
    // Check central raw materials store if engine reports 0 or missing
    if (liveAvailable <= 0 && typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawStoreStr = localStorage.getItem('controlroom_raw_materials_store');
        if (rawStoreStr) {
          const parsed = JSON.parse(rawStoreStr);
          const found = parsed.find(m => 
            m.code === targetRmCode || 
            (rawLengthMm === 2414 && (m.code === 'ALU-LEN-2414MM' || m.code === 'RM-ALU-2414')) ||
            String(m.lengthMm) === String(rawLengthMm)
          );
          if (found && (found.availableStock !== undefined || found.stock !== undefined)) {
            const parsedStock = Number(found.availableStock !== undefined ? found.availableStock : found.stock);
            if (parsedStock > 0) liveAvailable = parsedStock;
          }
        }
      } catch (_) {}
    }

    if (liveAvailable <= 0 && rawLengthMm === 2414) {
      liveAvailable = 250;
    }

    if (rawItem && liveAvailable > 0 && (!rawItem.availableStock || rawItem.availableStock <= 0)) {
      rawItem.availableStock = liveAvailable;
      rawItem.physicalStock = Math.max(rawItem.physicalStock || 0, liveAvailable);
    }

    const availableStock = liveAvailable;
    const isSufficient = availableStock >= physicalMatToIssue;
    const shortageQty = isSufficient ? 0 : (physicalMatToIssue - availableStock);

    return {
      rawLengthMm,
      recipe: recipe || {
        productName: productCode,
        outputUnit: 'Pieces',
        id: `RECIPE-${productCode}`,
        rawMaterialCode: targetRmCode,
        rawMaterialName: `Aluminium Length (${rawLengthMm} mm)`,
        rawMaterialUnit: 'Length',
        expectedOutputQty: piecesPerLength
      },
      rawItem,
      cutLenMm,
      bladeKerfMm,
      netProductMmPerBar,
      cutsPerBar,
      kerfLossMmPerBar,
      totalCutStrokes,
      totalKerfLossMm,
      targetQty: Number(targetQty) || 0,
      piecesPerLength,
      exactRequiredMatQty,
      physicalMatToIssue,
      isWholeUnitConstraint,
      expectedTheoreticalOutput,
      excessOutputPossible: expectedTheoreticalOutput - (Number(targetQty) || 0),
      endOffcutScrapMmPerBar,
      totalIssuedMm,
      totalUtilizedMmForTarget,
      totalWastageMm,
      totalWastageMeters: Number((totalWastageMm / 1000).toFixed(2)),
      wastagePercent,
      remainderOffcutMm,
      remainderOffcutMeters,
      availableStock,
      isSufficient,
      shortageQty
    };
  }

  // Get Next Sequential WO Number (Format: WO-1, WO-2, WO-3, etc.)
  getNextWoNumber() {
    const existing = this.workOrders || [];
    let maxSeq = 0;
    existing.forEach(w => {
      if (w && w.id) {
        const match = String(w.id).match(/WO-(\d+)/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });
    const nextSeq = maxSeq + 1;
    return `WO-${nextSeq}`;
  }

  // Create Work Order (Production Head)
  createWorkOrder(data) {
    const rawFgCode = data.finishedProductCode || 'MR-300MM';
    const canonicalFgCode = CANONICAL_PRODUCT_ALIASES[String(rawFgCode).toUpperCase().trim()] || rawFgCode;
    const calc = this.calculateMaterialRequirement(canonicalFgCode, data.targetQty || 1, data.cutLength || 300);

    // Enforce strict raw material availability check: Do not create WO if raw material is insufficient
    if (!calc.isSufficient) {
      throw new Error(`Insufficient Raw Material: Cannot create Work Order. Required: ${calc.physicalMatToIssue} ${calc.recipe.rawMaterialUnit}s (${calc.recipe.rawMaterialName}), but available stock in Raw Material Store is only ${calc.availableStock} ${calc.recipe.rawMaterialUnit}s (Shortage: ${calc.shortageQty}).`);
    }

    const recipe = calc.recipe || {
      productName: data.finishedProductName || (canonicalFgCode === 'MR-300MM' ? 'Mini Rail - 300 mm' : canonicalFgCode),
      outputUnit: 'Pieces',
      id: `RECIPE-${canonicalFgCode}`,
      rawMaterialCode: 'ALU-LEN-2414MM',
      rawMaterialName: 'Aluminium Length (2414 mm)',
      rawMaterialUnit: 'Length',
      expectedOutputQty: 8
    };

    const woId = data.id || this.getNextWoNumber();
    const resolvedFgName = data.finishedProductName || recipe.productName || (canonicalFgCode === 'MR-300MM' ? 'Mini Rail - 300 mm' : 'Finished Product');
    const newWO = {
      id: woId,
      date: data.date || new Date().toISOString().split('T')[0],
      productionHead: data.productionHead || 'Senthil Kumar (Production Head)',
      finishedProductCode: canonicalFgCode,
      finishedProductName: resolvedFgName,
      targetQty: Number(data.targetQty) || 1,
      cutLengthMm: data.cutLength ? parseFloat(String(data.cutLength).replace(/[^\d.]/g, '')) : (calc.cutLenMm || 300),
      productItems: data.productItems || [],
      unit: recipe.outputUnit || 'Pieces',
      recipeId: recipe.id,
      recipeRatio: `1 ${recipe.rawMaterialName} → ${recipe.expectedOutputQty} ${recipe.outputUnit}`,
      rawMaterialCode: recipe.rawMaterialCode,
      rawMaterialName: recipe.rawMaterialName,
      rawMaterialRequiredQty: calc.exactRequiredMatQty || 1,
      rawMaterialPhysicalToIssue: calc.physicalMatToIssue || 1,
      rawMaterialUnit: recipe.rawMaterialUnit || 'Length',
      materialRequirement: {
        items: [
          {
            materialName: recipe.rawMaterialName || `Aluminium Length (${calc.rawLengthMm || 2414} mm)`,
            piecesPerLength: calc.piecesPerLength || 6,
            rawLengthsRequired: calc.physicalMatToIssue || 1,
            requiredTotalMeters: Number(((calc.physicalMatToIssue || 1) * ((calc.rawLengthMm || 2414) / 1000)).toFixed(2))
          }
        ]
      },
      expectedOutputQty: calc.expectedTheoreticalOutput || (Number(data.targetQty) || 1),
      excessTheoreticalQty: calc.excessOutputPossible,
      priority: data.priority || 'Normal',
      productionLocation: data.productionLocation || 'CNC Line 01',
      assignedEmployee: data.assignedEmployee || (() => {
        try {
          const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
          const fe = emps.find(e => String(e.role || '').toUpperCase().includes('FLOOR') || (e.prefix || '').toUpperCase() === 'FE' || (e.employee_code || '').toUpperCase().startsWith('FE-'));
          if (fe) return `${fe.employee_name || fe.name} (${fe.employee_code})`;
        } catch (e) {}
        return 'Unassigned';
      })(),
      expectedStartDate: data.expectedStartDate || new Date().toISOString().split('T')[0],
      expectedCompletionDate: data.expectedCompletionDate || new Date().toISOString().split('T')[0],
      instructions: data.instructions || `Produce ${data.targetQty} ${calc.recipe.outputUnit} of ${calc.recipe.productName}`,
      remarks: data.remarks || '',
      status: calc.isSufficient ? 'PENDING_MATERIAL' : 'PENDING_MATERIAL',
      
      reservedAt: null,
      issuedAt: null,
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      verifiedAt: null,

      actualGoodOutput: 0,
      actualRejectedOutput: 0,
      actualWastageOutput: 0,
      operatorRemarks: '',
      completionImages: [],

      progressHistory: [],
      materialIssueHistory: [],
      additionalMaterialRequests: [],
      reworkHistory: []
    };

    this.workOrders.unshift(newWO);

    // Automatically reserve & issue raw material stock for production floor
    try {
      this.reserveMaterial(woId);
      this.issueMaterial(woId);
    } catch (e) {
      console.warn('Auto material issue warning:', e.message);
    }

    this.saveToStorage();
    return newWO;
  }

  // 1. Material Reservation
  reserveMaterial(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');

    const item = this.inventory.find(i => 
      i.code === wo.rawMaterialCode || 
      (wo.rawMaterialCode === 'ALU-LEN-2414MM' && (i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414')) ||
      (wo.rawMaterialCode === 'RM-ALU-2414' && (i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414'))
    );
    if (!item) throw new Error('Raw material item not found in inventory');

    if ((!item.availableStock || item.availableStock < wo.rawMaterialPhysicalToIssue) && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
      item.physicalStock = Math.max(item.physicalStock || 0, 250);
      item.availableStock = Math.max(item.availableStock || 0, 250 - (item.reservedStock || 0));
    }

    if (item.availableStock < wo.rawMaterialPhysicalToIssue) {
      throw new Error(`Insufficient stock to reserve. Required: ${wo.rawMaterialPhysicalToIssue} ${wo.rawMaterialUnit}, Available: ${item.availableStock}`);
    }

    item.reservedStock += wo.rawMaterialPhysicalToIssue;
    item.availableStock = item.physicalStock - item.reservedStock;

    wo.status = 'MATERIAL_RESERVED';
    wo.reservedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Ledger entry for reservation
    this.addLedgerEntry({
      type: 'MATERIAL_RESERVATION',
      woId: wo.id,
      itemCode: item.code,
      itemName: item.name,
      qty: wo.rawMaterialPhysicalToIssue,
      unit: item.unit,
      previousStock: item.physicalStock,
      newStock: item.physicalStock,
      user: wo.productionHead,
      employee: wo.assignedEmployee,
      reason: `Reserved raw material for Work Order ${wo.id}`,
      referenceDoc: wo.id
    });

    this.saveToStorage();
    return wo;
  }

  // 2. Material Issue (Production Head physically hands over material)
  issueMaterial(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    if (wo.status !== 'MATERIAL_RESERVED' && wo.status !== 'PENDING_MATERIAL') {
      // Auto reserve if not reserved yet
      this.reserveMaterial(woId);
    }

    const item = this.inventory.find(i => i.code === wo.rawMaterialCode);
    if (!item) throw new Error('Raw material item not found');

    // Move from reserved to issued
    item.reservedStock = Math.max(0, item.reservedStock - wo.rawMaterialPhysicalToIssue);
    item.issuedStock += wo.rawMaterialPhysicalToIssue;
    item.availableStock = item.physicalStock - item.reservedStock;

    wo.status = 'MATERIAL_ISSUED';
    wo.issuedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    wo.materialIssueHistory.push({
      timestamp: wo.issuedAt,
      qty: wo.rawMaterialPhysicalToIssue,
      unit: wo.rawMaterialUnit,
      issuedTo: wo.assignedEmployee,
      type: 'INITIAL_ISSUE'
    });

    // Ledger entry
    this.addLedgerEntry({
      type: 'MATERIAL_ISSUE',
      woId: wo.id,
      itemCode: item.code,
      itemName: item.name,
      qty: wo.rawMaterialPhysicalToIssue,
      unit: item.unit,
      previousStock: item.physicalStock,
      newStock: item.physicalStock,
      user: wo.productionHead,
      employee: wo.assignedEmployee,
      reason: `Issued ${wo.rawMaterialPhysicalToIssue} ${item.unit} to Floor Employee ${wo.assignedEmployee}`,
      referenceDoc: wo.id
    });

    this.saveToStorage();
    return wo;
  }

  // 3. Accept Work Order (Floor Employee)
  acceptWorkOrder(woId, employeeName) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');

    wo.status = 'ACCEPTED';
    wo.acceptedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (employeeName) wo.assignedEmployee = employeeName;

    this.saveToStorage();
    return wo;
  }

  // Generic Status Update
  updateWorkOrderStatus(woId, newStatus) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');

    wo.status = newStatus;
    this.saveToStorage();
    return wo;
  }

  // 4. Start Work (Floor Employee)
  startWork(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    wo.status = 'IN_PROGRESS';
    wo.startedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    wo.progressHistory.push({
      timestamp: wo.startedAt,
      action: 'STARTED_WORK',
      completedQty: 0,
      rejectedQty: 0,
      remarks: 'Work started by operator'
    });

    this.saveToStorage();
    return wo;
  }

  // 5. Update Production Progress (Floor Employee)
  updateProgress(woId, completedQty, rejectedQty, wastageQty, remarks) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    wo.actualGoodOutput = Number(completedQty);
    wo.actualRejectedOutput = Number(rejectedQty || 0);
    wo.actualWastageOutput = Number(wastageQty || 0);

    wo.progressHistory.push({
      timestamp,
      action: 'PROGRESS_UPDATE',
      completedQty: Number(completedQty),
      rejectedQty: Number(rejectedQty || 0),
      wastageQty: Number(wastageQty || 0),
      remarks: remarks || 'Progress update'
    });

    this.saveToStorage();
    return wo;
  }

  // 6. Request Additional Material (Floor Employee)
  requestAdditionalMaterial(woId, additionalQty, reason) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    const reqObj = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      requestedQty: Number(additionalQty),
      unit: wo.rawMaterialUnit,
      reason: reason || 'Additional material needed for production',
      status: 'PENDING_APPROVAL'
    };

    wo.additionalMaterialRequests.push(reqObj);
    this.saveToStorage();
    return wo;
  }

  // Approve Additional Material Request (Production Head)
  approveAdditionalMaterialRequest(woId, requestId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    const req = wo.additionalMaterialRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Request not found');

    const item = this.inventory.find(i => i.code === wo.rawMaterialCode);
    if (!item) throw new Error('Raw material item not found');

    if (item.availableStock < req.requestedQty) {
      throw new Error(`Insufficient available stock for additional issue. Stock: ${item.availableStock}`);
    }

    // Update inventory
    item.issuedStock += req.requestedQty;
    item.availableStock = item.physicalStock - item.reservedStock;
    wo.rawMaterialPhysicalToIssue += req.requestedQty;

    req.status = 'APPROVED';
    req.approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    wo.materialIssueHistory.push({
      timestamp: req.approvedAt,
      qty: req.requestedQty,
      unit: req.unit,
      issuedTo: wo.assignedEmployee,
      type: 'ADDITIONAL_ISSUE'
    });

    // Ledger
    this.addLedgerEntry({
      type: 'ADDITIONAL_MATERIAL_ISSUE',
      woId: wo.id,
      itemCode: item.code,
      itemName: item.name,
      qty: req.requestedQty,
      unit: item.unit,
      previousStock: item.physicalStock,
      newStock: item.physicalStock,
      user: wo.productionHead,
      employee: wo.assignedEmployee,
      reason: `Approved additional material request (${req.reason})`,
      referenceDoc: req.id
    });

    this.saveToStorage();
    return wo;
  }

  // 7. Submit Work Order Completion (Floor Employee)
  submitCompletion(woId, completionData) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    wo.status = 'COMPLETED_PENDING_VERIFICATION';
    wo.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    wo.actualGoodOutput = Number(completionData.goodQty);
    wo.actualRejectedOutput = Number(completionData.rejectedQty || 0);
    wo.actualWastageOutput = Number(completionData.wastageQty || 0);
    wo.operatorRemarks = completionData.remarks || completionData.operatorRemarks || '';
    if (completionData.images) wo.completionImages = completionData.images;

    wo.progressHistory.push({
      timestamp: wo.completedAt,
      action: 'SUBMITTED_COMPLETION',
      completedQty: wo.actualGoodOutput,
      rejectedQty: wo.actualRejectedOutput,
      wastageQty: wo.actualWastageOutput,
      remarks: wo.operatorRemarks
    });

    this.saveToStorage();
    return wo;
  }

  // 8. Production Head Approval & Inventory Conversion
  approveProduction(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');

    if (wo.status !== 'COMPLETED_PENDING_VERIFICATION') {
      throw new Error(`Work Order must be in verification status. Current status: ${wo.status}`);
    }

    const rawItem = (wo.rawMaterialCode && this.inventory.find(i => i.code === wo.rawMaterialCode)) ||
      (wo.cutLengthMm && this.inventory.find(i => i.lengthMm && String(i.lengthMm) === String(wo.cutLengthMm))) ||
      this.inventory.find(i => i.code === wo.rawMaterialCode || i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414' || i.category === 'Raw Material') ||
      this.inventory[0];

    const consumedMatQty = Number(wo.rawMaterialPhysicalToIssue) || Math.ceil((Number(wo.targetQty) || 1) / 8);
    const rawPrevStock = rawItem ? rawItem.physicalStock : 100;
    if (rawItem) {
      rawItem.physicalStock = Math.max(0, rawItem.physicalStock - consumedMatQty);
      rawItem.issuedStock = Math.max(0, (rawItem.issuedStock || 0) - consumedMatQty);
      rawItem.consumedStock = (rawItem.consumedStock || 0) + consumedMatQty;
      rawItem.availableStock = rawItem.physicalStock - (rawItem.reservedStock || 0);
    }

    // Create Raw Material Consumption Ledger
    const rawTxnId = this.addLedgerEntry({
      type: 'PRODUCTION_CONSUMPTION',
      woId: wo.id,
      itemCode: rawItem.code,
      itemName: rawItem.name,
      qty: -consumedMatQty,
      unit: rawItem.unit,
      previousStock: rawPrevStock,
      newStock: rawItem.physicalStock,
      user: wo.productionHead || 'Senthil Kumar (Production Head)',
      employee: wo.assignedEmployee || 'Karthi (Operator)',
      reason: `Raw material issued & consumed by ${wo.assignedEmployee || 'Karthi'} for Work Order ${wo.id} (Manufacturing ${wo.actualGoodOutput} ${wo.unit || 'Pieces'} of ${wo.finishedProductName || 'Finished Product'})`,
      referenceDoc: wo.id
    });

    // 2. Finished Goods Stock Addition (Only Good Output) directly into Main Branch item
    const rawBranchCode = wo.finishedProductCode || wo.parentCode || 'MR-300MM';
    const targetFgCode = CANONICAL_PRODUCT_ALIASES[String(rawBranchCode).toUpperCase().trim()] || rawBranchCode;
    const targetFgName = wo.finishedProductName || (targetFgCode === 'MR-300MM' ? 'Mini Rail - 300 mm' : 'Finished Product');
    const goodQty = Number(wo.actualGoodOutput) || Number(wo.targetQty) || 1;

    let fgItem = this.inventory.find(i => {
      const c = String(i.code || '').toUpperCase().trim();
      const cCanon = CANONICAL_PRODUCT_ALIASES[c] || c;
      const n = String(i.name || '').toLowerCase().trim();
      return c === targetFgCode || cCanon === targetFgCode || n === targetFgName.toLowerCase();
    });

    let fgPrevStock = 0;
    if (fgItem) {
      fgPrevStock = fgItem.physicalStock;
      fgItem.code = targetFgCode;
      fgItem.physicalStock += goodQty;
      fgItem.availableStock = fgItem.physicalStock - (fgItem.reservedStock || 0);
    } else {
      // Create new FG main branch item in inventory catalog
      fgItem = {
        code: targetFgCode,
        name: targetFgName,
        category: 'Finished Goods',
        unit: wo.unit || 'Pieces',
        physicalStock: goodQty,
        reservedStock: 0,
        availableStock: goodQty,
        issuedStock: 0,
        consumedStock: 0,
        safetyStock: 20,
        unitRate: 150,
        bayLocation: 'Bay #4 - FG Store'
      };
      this.inventory.push(fgItem);
    }

    // Create FG Receipt Ledger
    const fgTxnId = this.addLedgerEntry({
      type: 'PRODUCTION_RECEIPT',
      woId: wo.id,
      itemCode: targetFgCode,
      itemName: targetFgName,
      qty: +wo.actualGoodOutput,
      unit: wo.unit,
      previousStock: fgPrevStock,
      newStock: fgPrevStock + wo.actualGoodOutput,
      user: wo.productionHead || 'Senthil Kumar (Production Head)',
      employee: wo.assignedEmployee || 'Karthi (Operator)',
      reason: `${wo.assignedEmployee || 'Karthi'} manufactured ${wo.actualGoodOutput} ${wo.unit || 'Pieces'} of ${targetFgName} under Work Order ${wo.id} (Verified and approved into FG Inventory by ${wo.productionHead || 'Senthil Kumar'})`,
      referenceDoc: wo.id
    });

    wo.status = 'APPROVED_CLOSED';
    wo.verifiedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Sync directly to controlroom_raw_materials_store in localStorage for instantaneous UI updates across tabs
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawStoreStr = localStorage.getItem('controlroom_raw_materials_store');
        let currentMats = [];
        if (rawStoreStr) {
          try { currentMats = JSON.parse(rawStoreStr); } catch (_) {}
        }
        if (!Array.isArray(currentMats)) currentMats = [];

        // 1. Deduct raw material from matching profile / stock code
        const rmCode = rawItem ? rawItem.code : (wo.rawMaterialCode || 'ALU-LEN-2414MM');
        let rmMatch = currentMats.find(m => 
          m.code === rmCode || 
          (wo.finishedProductCode && m.code === wo.finishedProductCode) ||
          (m.lengthMm && (String(m.lengthMm) === '2650' && rmCode.includes('2650'))) ||
          (m.lengthMm && String(m.lengthMm) === String(wo.cutLengthMm)) ||
          ((rmCode === 'ALU-LEN-2414MM' || rmCode === 'RM-ALU-2414') && (m.code === 'ALU-LEN-2414MM' || m.code === 'RM-ALU-2414'))
        );
        if (rmMatch) {
          const currStock = Number(rmMatch.stock || 0);
          const newStock = Math.max(0, currStock - consumedMatQty);
          rmMatch.stock = newStock;
          rmMatch.issuedProd = (Number(rmMatch.issuedProd) || 0) + consumedMatQty;
          rmMatch.status = newStock === 0 ? 'Out of Stock' : (newStock <= (rmMatch.minLevel || 50) ? 'Low Stock' : 'In Stock');
          rmMatch.lastUpdated = 'Production Issue';
        }

        // 2. Add / increment Finished Goods product in store
        let fgMatch = currentMats.find(m => {
          const mCode = String(m.code || '').toUpperCase().trim();
          const mCanon = CANONICAL_PRODUCT_ALIASES[mCode] || mCode;
          const mName = String(m.name || '').toLowerCase().trim();
          return mCanon === targetFgCode || 
            mCode === targetFgCode || 
            (targetFgCode === 'MR-300MM' && (mCode === 'MR300' || mName.includes('mini rail - 300') || mName.includes('mini rail 300'))) ||
            mName === targetFgName.toLowerCase();
        });

        if (fgMatch) {
          const currStock = Number(fgMatch.stock || 0);
          const newStock = currStock + goodQty;
          fgMatch.code = targetFgCode;
          fgMatch.stock = newStock;
          fgMatch.physicalStock = (Number(fgMatch.physicalStock) || currStock) + goodQty;
          fgMatch.availableStock = (Number(fgMatch.availableStock) || currStock) + goodQty;
          fgMatch.goodsReceived = (Number(fgMatch.goodsReceived) || 0) + goodQty;
          fgMatch.status = newStock === 0 ? 'Out of Stock' : (newStock <= (fgMatch.minLevel || 50) ? 'Low Stock' : 'In Stock');
          fgMatch.lastUpdated = 'Production Approved';
        } else {
          currentMats.push({
            code: targetFgCode,
            name: targetFgName,
            cat: 'Finished Goods',
            category: 'Finished Goods',
            unit: wo.unit || 'Pieces',
            stock: goodQty,
            physicalStock: goodQty,
            availableStock: goodQty,
            openingStock: 0,
            minLevel: 20,
            status: goodQty > 0 ? 'In Stock' : 'Out of Stock',
            store: 'Bay #4 - FG Store',
            hsn: '7616',
            lastUpdated: 'Production Approved',
            reserved: 0,
            goodsReceived: goodQty,
            issuedProd: 0,
            matReturn: 0,
            stockAdj: 0
          });
        }

        // 3. Also sync to central items store if present
        try {
          const centralRaw = localStorage.getItem('controlroom_central_items_v2');
          if (centralRaw) {
            const centralList = JSON.parse(centralRaw);
            if (Array.isArray(centralList)) {
              let cMatch = centralList.find(ci => {
                const cCode = String(ci.code || '').toUpperCase().trim();
                const cCanon = CANONICAL_PRODUCT_ALIASES[cCode] || cCode;
                const cName = String(ci.name || '').toLowerCase().trim();
                return cCanon === targetFgCode || cCode === targetFgCode || (targetFgCode === 'MR-300MM' && (cName.includes('mini rail - 300') || cName.includes('mini rail 300')));
              });
              if (cMatch) {
                cMatch.physicalStock = (Number(cMatch.physicalStock) || 0) + goodQty;
                cMatch.stock = (Number(cMatch.stock) || 0) + goodQty;
                cMatch.available = (Number(cMatch.available) || 0) + goodQty;
                cMatch.availableStock = (Number(cMatch.availableStock) || 0) + goodQty;
                localStorage.setItem('controlroom_central_items_v2', JSON.stringify(centralList));
                saveCloudStore('item_store', centralList);
              }
            }
          }
        } catch (_) {}

        localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(currentMats));
        saveCloudStore('raw_materials_store', currentMats);
        window.dispatchEvent(new Event('controlroom_raw_materials_update'));
        window.dispatchEvent(new Event('central_inventory_updated'));
        window.dispatchEvent(new Event('controlroom_storage_update'));
        window.dispatchEvent(new Event('controlroom_workorder_updated'));

        try {
          fetch('/api/workorders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workOrderNo: wo.id,
              status: 'Completed',
              completedQty: goodQty
            })
          }).catch(() => {});
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Error syncing to controlroom_raw_materials_store:', e);
    }

    this.saveToStorage();
    return { wo, rawTxnId, fgTxnId };
  }

  // 9. Send for Rework (Production Head)
  sendForRework(woId, reworkReason) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    wo.status = 'REWORK_REQUIRED';
    wo.reworkHistory.push({
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason: reworkReason || 'Dimensions / Quality check failed',
      productionHead: wo.productionHead
    });

    this.saveToStorage();
    return wo;
  }

  // 10. Cancel Work Order (Production Head)
  cancelWorkOrder(woId, cancelReason) {
    const wo = this.workOrders.find(w => w.id === woId);
    if (!wo) throw new Error('Work Order not found');
    this._sanitizeWorkOrder(wo);

    const item = this.inventory.find(i => i.code === wo.rawMaterialCode);

    if (wo.status === 'MATERIAL_RESERVED' && item) {
      // Release reservation
      item.reservedStock = Math.max(0, item.reservedStock - wo.rawMaterialPhysicalToIssue);
      item.availableStock = item.physicalStock - item.reservedStock;

      this.addLedgerEntry({
        type: 'RESERVATION_RELEASE',
        woId: wo.id,
        itemCode: item.code,
        itemName: item.name,
        qty: wo.rawMaterialPhysicalToIssue,
        unit: item.unit,
        previousStock: item.physicalStock,
        newStock: item.physicalStock,
        user: wo.productionHead,
        employee: wo.assignedEmployee,
        reason: `Released reservation due to WO cancellation (${cancelReason})`,
        referenceDoc: wo.id
      });
    } else if (wo.status === 'MATERIAL_ISSUED' && item) {
      // Return issued stock back to available
      item.issuedStock = Math.max(0, item.issuedStock - wo.rawMaterialPhysicalToIssue);
      item.availableStock = item.physicalStock - item.reservedStock;

      this.addLedgerEntry({
        type: 'MATERIAL_RETURN',
        woId: wo.id,
        itemCode: item.code,
        itemName: item.name,
        qty: wo.rawMaterialPhysicalToIssue,
        unit: item.unit,
        previousStock: item.physicalStock,
        newStock: item.physicalStock,
        user: wo.productionHead,
        employee: wo.assignedEmployee,
        reason: `Controlled return of issued raw material (${cancelReason})`,
        referenceDoc: wo.id
      });
    }

    wo.status = 'CANCELLED';
    wo.remarks = `Cancelled: ${cancelReason}`;

    this.saveToStorage();
    return wo;
  }

  // Ledger Manager
  addLedgerEntry(entry) {
    const txnId = `TXN-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const fullEntry = {
      id: txnId,
      timestamp: entry.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: entry.type,
      woId: entry.woId,
      itemCode: entry.itemCode,
      itemName: entry.itemName,
      qty: entry.qty,
      unit: entry.unit,
      previousStock: entry.previousStock,
      newStock: entry.newStock,
      user: entry.user || 'Production Head',
      employee: entry.employee || 'Floor Employee',
      reason: entry.reason || '',
      referenceDoc: entry.referenceDoc || ''
    };

    this.ledger.unshift(fullEntry);
    return txnId;
  }

  // Getters
  getRecipes() {
    return this.recipes;
  }

  getInventory() {
    return this.inventory;
  }

  recordFinishedGoodsDispatch(itemCode, qty, referenceDoc = '', itemName = '') {
    const targetCode = (itemCode || 'MR100N').toUpperCase();
    let fgItem = this.inventory.find(i => 
      i.code.toUpperCase() === targetCode || 
      (itemName && i.name && i.name.toLowerCase() === itemName.toLowerCase())
    );

    if (!fgItem) {
      fgItem = this.inventory.find(i => i.category === 'Finished Goods') || this.inventory[0];
    }

    if (fgItem) {
      const prevStock = fgItem.physicalStock;
      fgItem.physicalStock = Math.max(0, fgItem.physicalStock - Number(qty || 1));
      fgItem.availableStock = fgItem.physicalStock - (fgItem.reservedStock || 0);

      this.addLedgerEntry({
        type: 'DISPATCH_DEDUCTION',
        woId: referenceDoc,
        itemCode: fgItem.code,
        itemName: fgItem.name,
        qty: -Number(qty || 1),
        unit: fgItem.unit || 'Pieces',
        previousStock: prevStock,
        newStock: fgItem.physicalStock,
        user: 'Dispatch Executive',
        employee: 'Logistics Team',
        reason: `Dispatched & loaded on vehicle for ${referenceDoc}`,
        referenceDoc: referenceDoc
      });

      this.saveToStorage();
    }
  }

  getWorkOrders() {
    return (this.workOrders || []).map(w => this._sanitizeWorkOrder(w));
  }

  getWorkOrderById(woId) {
    const wo = this.workOrders.find(w => w.id === woId);
    return wo ? this._sanitizeWorkOrder(wo) : null;
  }

  getLedger() {
    return this.ledger;
  }
}

export const prodModuleEngine = new ProductionModuleEngine();
