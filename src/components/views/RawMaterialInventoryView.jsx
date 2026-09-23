import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Check, Trash2, Eye, Search, X, CheckCircle, ArrowLeft,
  Calendar, Edit3, Filter, RotateCcw, UploadCloud, ChevronDown,
  Package, Info, Upload, Receipt, Image, Pause, Save
} from "lucide-react";
import WorkOrdersView from './WorkOrdersView';
import { prodModuleEngine } from '../../utils/productionModuleEngine';
import { VRM_PRODUCTS, resolveProductCode, wordFingerprint, normalizeProductName, CANONICAL_PRODUCT_ALIASES } from '../../utils/vrmProductsData';
import { fetchCloudStore, subscribeToCloudStore, saveCloudStore } from '../../utils/supabaseDataSync';

const RawMaterialInventoryView = ({ showAddStockForm: externalShowForm, setShowAddStockForm: externalSetShowForm, userRole, activeTab, itemsLoading, showCustomAlert, itemsList: passedItemsList = [] }) => {
  const isSalesUser = userRole === 'Sales Executive' || userRole === 'Sales Head' || String(userRole || '').toLowerCase().includes('sales');
  const [internalShowAddStockForm, setInternalShowAddStockForm] = useState(false);
  const isAddStockActive = externalShowForm !== undefined ? externalShowForm : internalShowAddStockForm;
  const setAddStockActive = externalSetShowForm || setInternalShowAddStockForm;

  const getStoredItemsList = () => {
    if (Array.isArray(passedItemsList) && passedItemsList.length > 0) return passedItemsList;
    try {
      const saved = localStorage.getItem('controlroom_items_list') || localStorage.getItem('controlroom_inventory_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  };

  const itemsList = useMemo(() => getStoredItemsList(), [passedItemsList]);

  const getEngineAluStock = () => {
    try {
      if (typeof prodModuleEngine !== 'undefined' && prodModuleEngine.getInventory) {
        const inv = prodModuleEngine.getInventory();
        if (Array.isArray(inv)) {
          const match = inv.find(i => i.code === 'ALU-LEN-2414MM' || i.code === 'RM-ALU-2414');
          if (match && (match.availableStock !== undefined || match.physicalStock !== undefined || match.stock !== undefined)) {
            const val = Number(match.availableStock ?? match.physicalStock ?? match.stock);
            if (val > 0) return val;
          }
        } else if (inv && (inv['ALU-LEN-2414MM'] !== undefined || inv['RM-ALU-2414'] !== undefined)) {
          const val = Number(inv['ALU-LEN-2414MM'] ?? inv['RM-ALU-2414']);
          if (val > 0) return val;
        }
      }
      const saved = localStorage.getItem('controlroom_raw_materials_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find(m => m.code === 'ALU-LEN-2414MM' || m.code === 'RM-ALU-2414' || m.code === 'MR100N');
        if (found && found.stock !== undefined) return Number(found.stock);
      }
    } catch (e) {}
    return 0;
  };

  const getCompletedGrnItems = () => {
    try {
      const grnsStr = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const grns = JSON.parse(grnsStr);
      if (!Array.isArray(grns)) return new Map();
      const grnMap = new Map();
      grns.forEach(grn => {
        const status = (grn.status || '').toLowerCase();
        const isReceived = status.includes('received') || 
                           status.includes('approved') || 
                           status.includes('verified') || 
                           status.includes('completed') || 
                           status.includes('posted') ||
                           status.includes('open');
        if (isReceived) {
          if (Array.isArray(grn.items) && grn.items.length > 0) {
            grn.items.forEach(it => {
              const code = it.materialCode || it.itemCode || it.code || it.sku || it.itemId || it.id || it.name;
              const recQty = Number(it.accepted !== undefined ? it.accepted : (it.now !== undefined ? it.now : (it.receivedQty || it.qty || 0)));
              if (code && recQty > 0) {
                const upperCode = String(code).toUpperCase();
                const existing = grnMap.get(upperCode);
                const prevQty = existing ? existing.receivedQty : 0;
                const grnEntry = { 
                  ...it, 
                  code,
                  materialCode: code,
                  materialName: it.materialName || it.name || it.itemName || code,
                  name: it.materialName || it.name || it.itemName || code,
                  category: it.category || 'Aluminium',
                  unit: it.unit || it.uom || 'Nos',
                  grnNo: grn.grnNo || grn.id, 
                  receivedQty: prevQty + recQty 
                };
                grnMap.set(upperCode, grnEntry);
              }
            });
          } else if (grn.materialCode || grn.itemCode || grn.code) {
            const code = grn.materialCode || grn.itemCode || grn.code;
            const recQty = Number(grn.receivedQty || grn.acceptedQty || grn.qty || 0);
            if (recQty > 0) {
              grnMap.set(String(code).toUpperCase(), { ...grn, code, receivedQty: recQty });
            }
          }
        }
      });
      return grnMap;
    } catch (e) {
      return new Map();
    }
  };


  const ALUMINUM_PROFILES = [
    { code: 'MR-300MM', name: 'Mini Rail - 300 mm', cat: 'Aluminium Profiles', category: 'Aluminium Profiles', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 50, store: 'Bay #4 - FG Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'CC4.8N', name: 'Double C Rail NEW (CC4.8N)', cat: 'Aluminium', unit: 'Length', lengthMm: '4800', cutLength: '4800 mm', stock: 0, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'CC3.6', name: 'Double C Rail (CC3.6)', cat: 'Aluminium', unit: 'Length', lengthMm: '3600', cutLength: '3600 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'SR3.6', name: 'Strut Rail (SR3.6)', cat: 'Aluminium', unit: 'Length', lengthMm: '3600', cutLength: '3600 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MR100O', name: 'MINI RAIL 100mm (300mm) OLD', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MR100N', name: 'MINI RAIL 100mm (300mm) NEW', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MR125', name: 'MINI RAIL 125mm (300mm)', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'LC', name: 'Locking Nut (LC)', cat: 'Aluminium', unit: 'Length', lengthMm: '3000', cutLength: '3000 mm', stock: 0, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MR60', name: 'MINI RAIL 60mm (300mm) NEW', cat: '6063T6', category: '6063T6', unit: 'Nos', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MR40', name: 'MINI RAIL 40mm (300mm) NEW', cat: '6063T6', category: '6063T6', unit: 'Nos', lengthMm: '300', cutLength: '300 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'AR100', name: 'Adhesive Rail 100mm (AR100)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '100 mm', stock: 0, minLevel: 35, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'AR120', name: 'Adhesive Rail 120mm (AR120)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '120 mm', stock: 0, minLevel: 35, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MID-SEC', name: 'Mid Section (MID-SEC)', cat: 'Aluminium', unit: 'Length', lengthMm: '2730', cutLength: '2730 mm', stock: 0, minLevel: 25, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'TOP-2M', name: 'Top Section 2 Mtr (TOP-2M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2000', cutLength: '2000 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'BOT-2M', name: 'Bottom Section 2 Mtr (BOT-2M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2000', cutLength: '2000 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'TOP-1.5M', name: 'Top Section 1.5 Mtr (TOP-1.5M)', cat: 'Aluminium', unit: 'Length', lengthMm: '1500', cutLength: '1500 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'BOT-2.4M', name: 'Bottom Section 2.4 Mtr (BOT-2.4M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2400', cutLength: '2400 mm', stock: 0, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MC35', name: 'Mid Clamp 35mm (MC35)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 0, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'MC30', name: 'Mid Clamp 30mm (MC30)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '30 mm', stock: 0, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'T10', name: 'T Nut 10mm (T10)', cat: 'Aluminium', unit: 'Length', lengthMm: '2562', cutLength: '10 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'UM', name: 'Mid Clamp Universal (UM)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '2650 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'UE', name: 'End Clamp 35mm New (UE)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 0, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'EC35', name: 'End Clamp 35mm (EC35)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 0, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'ALB', name: 'L Bracket (ALB)', cat: 'Aluminium', unit: 'Length', lengthMm: '2050', cutLength: '2050 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' },
    { code: 'T8', name: 'T Nut KMC 8mm (T8)', cat: 'Aluminium', unit: 'Length', lengthMm: '2580', cutLength: '8 mm', stock: 0, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'Out of Stock' }
  ];

  const initialMaterials = useMemo(() => ALUMINUM_PROFILES.map(p => ({
    ...p,
    lastUpdated: 'Live Store',
    reserved: 0,
    openingStock: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0
  })), []);

  const getDeletedMaterialCodes = () => {
    try {
      const raw = localStorage.getItem('controlroom_deleted_raw_materials');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const [materials, setMaterials] = useState(() => {
    // One-time client migration to ensure all stock counts are initialized to 0
    try {
      const stockZeroKey = 'controlroom_stock_zero_reset_v5';
      if (localStorage.getItem(stockZeroKey) !== 'true') {
        localStorage.setItem(stockZeroKey, 'true');
        ['controlroom_raw_materials_store', 'controlroom_central_items_v2'].forEach(key => {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const zeroed = list.map(item => ({
                  ...item,
                  stock: 0,
                  availableStock: 0,
                  physicalStock: 0,
                  openingStock: 0,
                  reserved: 0,
                  blockedForBom: 0,
                  goodsReceived: 0,
                  status: 'Out of Stock'
                }));
                localStorage.setItem(key, JSON.stringify(zeroed));
              }
            } catch (_) {}
          }
        });
        localStorage.setItem('controlroom_central_grns_v2', '[]');
        localStorage.setItem('goods_receipt_notes', '[]');
      }
    } catch (_) {}

    const defaultAluLength = { code: 'ALU-LEN-2414MM', name: 'Aluminium Length (2414 mm)', cat: 'Raw Material', category: 'Raw Material', unit: 'Length', stock: 0, lengthMm: '2414', minLevel: 15, status: 'Out of Stock', store: 'Bay #1 - Extrusion Yard', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: 0, physicalStock: 0, availableStock: 0, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
    const defaultMiniRail = { code: 'MR-300MM', name: 'Mini Rail - 300 mm', cat: 'Aluminium Profiles', category: 'Aluminium Profiles', unit: 'Pieces', stock: 0, lengthMm: '300', minLevel: 50, status: 'Out of Stock', store: 'Bay #4 - FG Store', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: 0, physicalStock: 0, availableStock: 0, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
    const matMap = new Map();
    matMap.set('ALU-LEN-2414MM', defaultAluLength);
    matMap.set('MR-300MM', defaultMiniRail);

    // 1. Seed all official VRM standardized catalog products (285 items)
    (VRM_PRODUCTS || []).forEach(p => {
      const code = p.code || resolveProductCode(p) || p.name;
      const key = String(code).toUpperCase().trim();
      matMap.set(key, {
        code: p.code || code,
        name: p.name,
        cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        unit: p.uom || 'Nos',
        stock: 0,
        minLevel: 50,
        reorderLevel: 100,
        status: 'Out of Stock',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        lastUpdated: 'Live Store',
        reserved: 0,
        openingStock: 0,
        goodsReceived: 0,
        issuedProd: 0,
        matReturn: 0,
        stockAdj: 0
      });
    });

    (initialMaterials || []).forEach(m => {
      const rawKey = String(m.code).toUpperCase().trim();
      const key = CANONICAL_PRODUCT_ALIASES[rawKey] || rawKey;
      const existing = matMap.get(key) || {};
      const sVal = m.stock !== undefined ? Number(m.stock) : (existing.stock !== undefined ? Number(existing.stock) : 0);
      matMap.set(key, {
        ...existing,
        ...m,
        code: key,
        stock: sVal,
        openingStock: m.openingStock !== undefined ? Number(m.openingStock) : (existing.openingStock || 0),
        status: sVal > 0 ? 'In Stock' : 'Out of Stock'
      });
    });

    // 2. Load all items from itemsList / Zoho Catalog
    const completedGrnMapInitial = getCompletedGrnItems();
    if (itemsList && itemsList.length > 0) {
      itemsList.forEach(it => {
        const rawKey = it.code || it.sku || it.itemId || 'RM-VRM';
        const rawUpper = String(rawKey).toUpperCase().trim();
        const upperKey = CANONICAL_PRODUCT_ALIASES[rawUpper] || rawUpper;
        const upperName = it.name ? String(it.name).toUpperCase() : '';
        const grnReceived = completedGrnMapInitial.get(upperKey) || (upperName ? completedGrnMapInitial.get(upperName) : null);
        const recQty = grnReceived ? Number(grnReceived.receivedQty || 0) : 0;
        const itStock = (it.stock !== undefined && it.stock !== null) ? Number(it.stock) : 0;

        if (matMap.has(upperKey)) {
          const existing = matMap.get(upperKey);
          matMap.set(upperKey, {
            ...existing,
            name: it.name || existing.name,
            stock: itStock > 0 ? itStock : (existing.stock || 0),
            openingStock: it.openingStock !== undefined ? Number(it.openingStock) : (existing.openingStock || 0),
            goodsReceived: Math.max(Number(existing.goodsReceived || 0), recQty),
            status: (itStock > 0 || (existing.stock && Number(existing.stock) > 0)) ? 'In Stock' : 'Out of Stock',
            lastUpdated: recQty > 0 ? `Received via ${grnReceived.grnNo || 'GRN'}` : existing.lastUpdated,
            grnNo: grnReceived ? grnReceived.grnNo : existing.grnNo
          });
          return;
        }

        matMap.set(upperKey, {
          code: upperKey,
          name: it.name,
          cat: it.category || it.material || 'General',
          category: it.category || it.material || 'General',
          unit: it.unit || it.uom || 'Nos',
          stock: itStock,
          minLevel: 50,
          status: itStock > 0 ? 'In Stock' : 'Out of Stock',
          store: it.location || (it.material === 'HDG' ? 'Store B' : 'Main Store'),
          hsn: '7604',
          lastUpdated: grnReceived ? `Received via ${grnReceived.grnNo || 'GRN'}` : 'Live Store',
          reserved: 0,
          openingStock: 0,
          goodsReceived: recQty,
          issuedProd: 0,
          matReturn: 0,
          stockAdj: 0,
          grnNo: grnReceived ? grnReceived.grnNo : undefined
        });
      });
    }

    // 3. Load saved raw materials from localStorage if available
    const savedMatStr = localStorage.getItem('controlroom_raw_materials_store');
    if (savedMatStr) {
      try {
        const savedMats = JSON.parse(savedMatStr);
        if (Array.isArray(savedMats) && savedMats.length > 0) {
          savedMats.forEach(sm => {
            const rawKey = String(sm.code || sm.name).toUpperCase().trim();
            const mapKey = CANONICAL_PRODUCT_ALIASES[rawKey] || rawKey;
            const existing = matMap.get(mapKey) || {};
            const smStock = sm.stock !== undefined ? Number(sm.stock) : 0;
            const isAlu2414 = mapKey === 'ALU-LEN-2414MM' || mapKey === 'RM-ALU-2414';
            matMap.set(mapKey, {
              ...existing,
              ...sm,
              code: sm.code || existing.code || mapKey,
              name: sm.name || existing.name,
              cat: isAlu2414 ? 'Raw Material' : (sm.cat || sm.category || existing.cat || 'General'),
              category: isAlu2414 ? 'Raw Material' : (sm.category || sm.cat || existing.category || 'General'),
              stock: smStock,
              openingStock: sm.openingStock !== undefined ? Number(sm.openingStock) : 0,
              status: smStock > 0 ? 'In Stock' : 'Out of Stock'
            });
          });
        }
      } catch (e) {}
    }

    // Also include any raw material items from completed GRNs even if not in itemsList
    completedGrnMapInitial.forEach((grnItem, gCode) => {
      const itemKey = grnItem.materialCode || grnItem.itemCode || grnItem.code || grnItem.sku || gCode;
      const recQty = Number(grnItem.receivedQty || 0);
      if (recQty <= 0) return;

      let matchedKey = null;
      if (matMap.has(itemKey)) matchedKey = itemKey;
      else if (matMap.has(gCode)) matchedKey = gCode;
      else if (grnItem.code && matMap.has(grnItem.code)) matchedKey = grnItem.code;
      else if (grnItem.sku && matMap.has(grnItem.sku)) matchedKey = grnItem.sku;
      else {
        for (const [k, v] of matMap.entries()) {
          const vName = String(v.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const gName = String(grnItem.name || grnItem.materialName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (vName && gName && (vName === gName || vName.includes(gName) || gName.includes(vName))) {
            matchedKey = k;
            break;
          }
        }
      }

      if (matchedKey) {
        const existing = matMap.get(matchedKey);
        matMap.set(matchedKey, {
          ...existing,
          goodsReceived: Math.max(Number(existing.goodsReceived || 0), recQty),
          grnNo: existing.grnNo || grnItem.grnNo,
          name: (grnItem.name && grnItem.name.includes('300mm')) ? grnItem.name : existing.name
        });
      } else {
        matMap.set(itemKey, {
          code: itemKey,
          name: grnItem.materialName || grnItem.itemName || grnItem.name || itemKey,
          cat: grnItem.category || 'Aluminium',
          unit: grnItem.unit || grnItem.uom || 'Nos',
          stock: recQty,
          minLevel: 50,
          status: 'In Stock',
          store: 'Main Store',
          hsn: '7604',
          lastUpdated: `Received via ${grnItem.grnNo || 'GRN'}`,
          reserved: 0,
          openingStock: 0,
          goodsReceived: recQty,
          issuedProd: 0,
          matReturn: 0,
          stockAdj: 0,
          grnNo: grnItem.grnNo
        });
      }
    });
    const deletedCodes = getDeletedMaterialCodes();
    return Array.from(matMap.values()).filter(m => !deletedCodes.includes(m.code));
  });

  useEffect(() => {
    let isSyncing = false;
    let debounceTimer = null;
    let isFetchingDb = false;
    let debounceDbTimer = null;

    const syncEngineInventory = () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const deletedCodes = getDeletedMaterialCodes();
      const engineInv = prodModuleEngine.getInventory();
      const matMap = new Map();
      const defaultAluLength = { code: 'ALU-LEN-2414MM', name: 'Aluminium Length (2414 mm)', cat: 'Raw Material', category: 'Raw Material', unit: 'Length', stock: 0, lengthMm: '2414', minLevel: 15, status: 'Out of Stock', store: 'Bay #1 - Extrusion Yard', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: 0, physicalStock: 0, availableStock: 0, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
      const defaultMiniRail = { code: 'MR-300MM', name: 'Mini Rail - 300 mm', cat: 'Aluminium Profiles', category: 'Aluminium Profiles', unit: 'Pieces', stock: 0, lengthMm: '300', minLevel: 50, status: 'Out of Stock', store: 'Bay #4 - FG Store', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: 0, physicalStock: 0, availableStock: 0, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
      matMap.set('ALU-LEN-2414MM', defaultAluLength);
      matMap.set('MR-300MM', defaultMiniRail);
      // 1. Seed all official VRM standardized catalog products (285 items)
      (VRM_PRODUCTS || []).forEach(p => {
        const code = p.code || resolveProductCode(p) || p.name;
        const key = String(code).toUpperCase().trim();
        matMap.set(key, {
          code: p.code || code,
          name: p.name,
          cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
          category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
          unit: p.uom || 'Nos',
          stock: 0,
          minLevel: 50,
          reorderLevel: 100,
          status: 'Out of Stock',
          store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
          hsn: '7604',
          lastUpdated: 'Live Store',
          reserved: 0,
          openingStock: 0,
          goodsReceived: 0,
          issuedProd: 0,
          matReturn: 0,
          stockAdj: 0
        });
      });

      (initialMaterials || []).forEach(m => {
        const rawKey = String(m.code).toUpperCase().trim();
        const key = CANONICAL_PRODUCT_ALIASES[rawKey] || rawKey;
        const existing = matMap.get(key) || {};
        const mStock = m.stock !== undefined ? Number(m.stock) : (existing.stock !== undefined ? Number(existing.stock) : 0);
        matMap.set(key, {
          ...existing,
          ...m,
          code: key,
          stock: mStock,
          openingStock: m.openingStock !== undefined ? Number(m.openingStock) : (existing.openingStock || 0),
          status: mStock > 0 ? 'In Stock' : 'Out of Stock'
        });
      });

      // Load stored raw materials from localStorage if updated on invoice completion
      const savedMatStr = localStorage.getItem('controlroom_raw_materials_store');
      if (savedMatStr) {
        try {
          const savedMats = JSON.parse(savedMatStr);
          if (Array.isArray(savedMats) && savedMats.length > 0) {
            savedMats.forEach(sm => {
              const rawKey = String(sm.code || sm.name).toUpperCase().trim();
              const mapKey = CANONICAL_PRODUCT_ALIASES[rawKey] || rawKey;
              const existing = matMap.get(mapKey) || {};
              const smStock = sm.stock !== undefined ? Number(sm.stock) : 0;
              const isAlu2414 = mapKey === 'ALU-LEN-2414MM' || mapKey === 'RM-ALU-2414';
              matMap.set(mapKey, {
                ...existing,
                ...sm,
                code: existing.code || sm.code || mapKey,
                name: existing.name || sm.name,
                cat: isAlu2414 ? 'Raw Material' : (existing.cat || sm.cat || sm.category || existing.category || 'General'),
                category: isAlu2414 ? 'Raw Material' : (existing.category || sm.category || sm.cat || existing.cat || 'General'),
                stock: smStock,
                openingStock: sm.openingStock !== undefined ? Number(sm.openingStock) : (existing.openingStock || 0),
                status: smStock > 0 ? 'In Stock' : 'Out of Stock'
              });
            });
          }
        } catch (e) { }
      }

      // Overlay live engine inventory updates (e.g. WO stock deductions & FG additions)
      (engineInv || []).forEach(item => {
        const displayCode = item.code === 'RM-ALU-2414' ? 'ALU-LEN-2414MM' : item.code;
        const rawKey = String(displayCode).toUpperCase().trim();
        const mapKey = CANONICAL_PRODUCT_ALIASES[rawKey] || rawKey;

        const existing = matMap.get(mapKey) || {};
        const engineStock = item.physicalStock !== undefined ? Number(item.physicalStock) : null;
        const stockVal = (engineStock !== null && engineStock > 0)
          ? engineStock
          : (existing.stock !== undefined ? Number(existing.stock) : (engineStock ?? 0));
        const minLvl = Number(item.safetyStock || existing.minLevel || 50);
        let statusText = 'In Stock';
        if (stockVal === 0) statusText = 'Out of Stock';
        else if (stockVal <= minLvl) statusText = 'Low Stock';

        const isAlu2414 = mapKey === 'ALU-LEN-2414MM' || mapKey === 'RM-ALU-2414';
        matMap.set(mapKey, {
          ...existing,
          code: existing.code || displayCode || mapKey,
          name: existing.name || item.name,
          cat: isAlu2414 ? 'Raw Material' : (item.category || existing.cat || 'Finished Goods'),
          category: isAlu2414 ? 'Raw Material' : (item.category || existing.category || 'Finished Goods'),
          unit: item.unit || existing.unit || 'Pieces',
          stock: stockVal,
          minLevel: minLvl,
          status: statusText,
          store: item.bayLocation || existing.store || 'Main Store',
          lastUpdated: existing.lastUpdated || 'Live Engine'
        });
      });

      // Load all items from itemsList / Zoho Catalog
      const completedGrnMapSync = getCompletedGrnItems();
      if (itemsList && itemsList.length > 0) {
        itemsList.forEach(it => {
          const rawKey = it.code || it.sku || it.itemId || 'RM-VRM';
          const rawUpper = String(rawKey).toUpperCase().trim();
          const upperKey = CANONICAL_PRODUCT_ALIASES[rawUpper] || rawUpper;
          const upperName = it.name ? String(it.name).toUpperCase() : '';
          const grnReceived = completedGrnMapSync.get(upperKey) || (upperName ? completedGrnMapSync.get(upperName) : null);
          const recQty = grnReceived ? Number(grnReceived.receivedQty || 0) : 0;

          if (matMap.has(upperKey)) {
            const existing = matMap.get(upperKey);
            const existingStock = existing.stock !== undefined ? Number(existing.stock) : null;
            const existingPhys = Number(existing.physicalStock !== undefined ? existing.physicalStock : (existing.openingStock || 0));
            const baseOpen = Math.max(0, Number(existing.openingStock || 0), existingPhys);
            const incomingStock = (it.stock !== undefined && it.stock !== null && Number(it.stock) > 0) ? Number(it.stock) : null;

            // Never overwrite non-zero user/store stock with 0 from catalog defaults
            let finalStock = existingStock ?? 0;
            if (incomingStock !== null && (existingStock === 0 || existingStock === null)) {
              finalStock = incomingStock;
            } else if (existingStock !== null && existingStock > 0) {
              finalStock = existingStock;
            } else if (incomingStock !== null) {
              finalStock = incomingStock;
            }

            matMap.set(upperKey, {
              ...existing,
              name: it.name || existing.name,
              stock: finalStock,
              openingStock: baseOpen > 0 ? baseOpen : (existing.openingStock || 0),
              physicalStock: Math.max(Number(existing.physicalStock || 0), baseOpen, finalStock),
              goodsReceived: Math.max(Number(existing.goodsReceived || 0), recQty),
              status: finalStock === 0 ? 'Out of Stock' : (finalStock <= (existing.minLevel || 50) ? 'Low Stock' : 'In Stock'),
              lastUpdated: recQty > 0 ? `Received via ${grnReceived.grnNo || 'GRN'}` : existing.lastUpdated,
              grnNo: grnReceived ? grnReceived.grnNo : existing.grnNo
            });
            return;
          }

          matMap.set(upperKey, {
            code: upperKey,
            name: it.name,
            cat: it.category || it.material || 'General',
            category: it.category || it.material || 'General',
            unit: it.unit || it.uom || 'Nos',
            stock: (it.stock !== undefined && it.stock !== null) ? Number(it.stock) : 0,
            minLevel: 50,
            status: (it.stock !== undefined && Number(it.stock) > 0) ? 'In Stock' : 'Out of Stock',
            store: it.location || (it.material === 'HDG' ? 'Store B' : 'Main Store'),
            hsn: '7604',
            lastUpdated: grnReceived ? `Received via ${grnReceived.grnNo || 'GRN'}` : 'Live Store',
            reserved: 0,
            openingStock: 0,
            goodsReceived: recQty,
            issuedProd: 0,
            matReturn: 0,
            stockAdj: 0,
            grnNo: grnReceived ? grnReceived.grnNo : undefined
          });
        });
      }

      // Also include any raw material items from completed GRNs even if not in itemsList
      completedGrnMapSync.forEach((grnItem, gCode) => {
        const itemKey = grnItem.materialCode || grnItem.itemCode || grnItem.code || grnItem.sku || gCode;
        const recQty = Number(grnItem.receivedQty || 0);
        if (recQty <= 0) return;

        let matchedKey = null;
        if (matMap.has(itemKey)) matchedKey = itemKey;
        else if (matMap.has(gCode)) matchedKey = gCode;
        else if (grnItem.code && matMap.has(grnItem.code)) matchedKey = grnItem.code;
        else if (grnItem.sku && matMap.has(grnItem.sku)) matchedKey = grnItem.sku;
        else {
          for (const [k, v] of matMap.entries()) {
            const vName = String(v.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const gName = String(grnItem.name || grnItem.materialName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (vName && gName && (vName === gName || vName.includes(gName) || gName.includes(vName))) {
              matchedKey = k;
              break;
            }
          }
        }

        if (matchedKey) {
          const existing = matMap.get(matchedKey);
          matMap.set(matchedKey, {
            ...existing,
            goodsReceived: Math.max(Number(existing.goodsReceived || 0), recQty),
            grnNo: existing.grnNo || grnItem.grnNo,
            name: (grnItem.name && grnItem.name.includes('300mm')) ? grnItem.name : existing.name
          });
        } else {
          matMap.set(itemKey, {
            code: itemKey,
            name: grnItem.materialName || grnItem.itemName || grnItem.name || itemKey,
            cat: grnItem.category || 'Aluminium',
            unit: grnItem.unit || grnItem.uom || 'Nos',
            stock: recQty,
            minLevel: 50,
            status: 'In Stock',
            store: 'Main Store',
            hsn: '7604',
            lastUpdated: `Received via ${grnItem.grnNo || 'GRN'}`,
            reserved: 0,
            openingStock: 0,
            goodsReceived: recQty,
            issuedProd: 0,
            matReturn: 0,
            stockAdj: 0,
            grnNo: grnItem.grnNo
          });
        }
      });
      // 4. Authoritative Live BOM Allocations: Deduct quantities ONLY for items in completed BOMs sent to dispatch
      let bomsList = [];
      try {
        const bRaw = localStorage.getItem('controlroom_bom_store');
        if (bRaw) bomsList = JSON.parse(bRaw);
      } catch (_) {}

      const bomAllocations = new Map();
      const seenBomIds = new Set();
      if (Array.isArray(bomsList)) {
        bomsList.forEach(b => {
          const bomKey = String(b.bomNumber || b.bomNo || b.id || '').toUpperCase().trim();
          if (bomKey && seenBomIds.has(bomKey)) return;
          if (bomKey) seenBomIds.add(bomKey);

          const st = String(b.status || '').toLowerCase();
          const isSentToDispatch = Boolean(b.salesConfirmed) || [
            'sales confirmed - sent to dispatch',
            'sent to production',
            'confirmed',
            'packed & ready for dispatch',
            'partially packed',
            'closed',
            'dispatch packing verified - sent to accounts',
            'awaiting vehicle loading & dispatch'
          ].some(s => st.includes(s));
          if (isSentToDispatch && !st.includes('cancel') && !st.includes('restored')) {
            (b.items || []).forEach(it => {
              const q = parseFloat(it.qty || it.bomQty || 0) || 0;
              if (q > 0) {
                const resCode = resolveProductCode(it);
                const c = String(resCode || it.code || '').toUpperCase().trim();
                const n = normalizeProductName(it.name || it.description || '');
                const fp = wordFingerprint(it.name || it.description || '');
                if (c) bomAllocations.set(c, (bomAllocations.get(c) || 0) + q);
                if (n) bomAllocations.set(n, (bomAllocations.get(n) || 0) + q);
                if (fp) bomAllocations.set(fp, (bomAllocations.get(fp) || 0) + q);

                const isMr300 = c === 'MR-300MM' || c === 'MR300' ||
                  ((n.includes('mini rail') || n.includes('minirail')) && !/\b(75|100|120|125|150|40|60)\s*mm/i.test(n) && (n.includes('300') || n === 'mini rail'));
                if (isMr300) {
                  bomAllocations.set('MR-300MM', (bomAllocations.get('MR-300MM') || 0) + q);
                  bomAllocations.set('MR300', (bomAllocations.get('MR300') || 0) + q);
                }
              }
            });
          }
        });
      }

      // Reconcile remaining stock in matMap
      matMap.forEach((m, key) => {
        const mCode = String(m.code || key).toUpperCase().trim();
        const mNorm = normalizeProductName(m.name || '');
        const mFp = wordFingerprint(m.name || '');
        const isMr300Only = (mCode === 'MR-300MM' || mCode === 'MR300') ||
          ((mNorm.includes('mini rail') || mNorm.includes('minirail')) && !/\b(75|100|120|125|150|40|60)\s*mm/i.test(mNorm) && (mNorm.includes('300') || mNorm === 'mini rail'));
        const allocated = Math.max(
          (mCode && bomAllocations.get(mCode)) || 0,
          (mNorm && bomAllocations.get(mNorm)) || 0,
          (mFp && bomAllocations.get(mFp)) || 0,
          isMr300Only ? (bomAllocations.get('MR-300MM') || bomAllocations.get('MR300') || 0) : 0
        );

        const grnQty = Number(m.goodsReceived || 0);
        let base = Math.max(0, parseFloat(
          m.openingStock !== undefined 
            ? m.openingStock 
            : (grnQty > 0 ? 0 : (m.physicalStock !== undefined ? m.physicalStock : (m.stock !== undefined ? m.stock : 0)))
        ) || 0);
        if (m.physicalStock !== undefined && Number(m.physicalStock) > base) {
          base = Number(m.physicalStock);
        }
        if (m.stock !== undefined && Number(m.stock) > base && grnQty === 0) {
          base = Number(m.stock);
        }

        if (base === 0 && grnQty === 0 && (!m.physicalStock || Number(m.physicalStock) === 0) && (!m.stock || Number(m.stock) === 0)) {
          m.openingStock = 0;
          m.physicalStock = 0;
          m.stock = 0;
          m.availableStock = 0;
          m.reserved = 0;
          m.blockedForBom = 0;
          m.status = 'Out of Stock';
          return;
        }

        // Authoritative physical warehouse stock is initial opening baseline + all received GRNs
        const totalPhysical = base + grnQty;

        // Reconcile available free stock and reserved allocations
        let rem;
        let finalReserved = allocated;
        if (allocated > 0) {
          finalReserved = allocated;
          rem = Math.max(0, totalPhysical - allocated);
        } else if (m.stock !== undefined && m.reserved !== undefined && Number(m.reserved) > 0 && Number(m.stock) + Number(m.reserved) === totalPhysical) {
          rem = Number(m.stock);
          finalReserved = Number(m.reserved);
        } else {
          rem = Math.max(0, totalPhysical - (Number(m.reserved) || 0));
        }

        m.openingStock = base;
        m.physicalStock = totalPhysical;
        m.stock = rem;
        m.availableStock = rem;
        m.reserved = finalReserved;
        m.blockedForBom = finalReserved;
        const minL = Number(m.minLevel !== undefined ? m.minLevel : (m.reorderLevel !== undefined ? m.reorderLevel : 50));
        m.minLevel = minL;
        m.status = rem === 0 ? 'Out of Stock' : (rem <= minL ? 'Low Stock' : 'In Stock');
      });

      const dedupMap = new Map();
      Array.from(matMap.values()).forEach(m => {
        if (!m || !m.code) return;
        const upperCode = String(m.code).toUpperCase().trim();
        const canonical = CANONICAL_PRODUCT_ALIASES[upperCode] || upperCode;
        if (deletedCodes.includes(upperCode) || deletedCodes.includes(canonical)) return;

        if (dedupMap.has(canonical)) {
          const existing = dedupMap.get(canonical);
          const mStock = Number(m.stock || 0);
          const eStock = Number(existing.stock || 0);
          const mPhys = Number(m.physicalStock || 0);
          const ePhys = Number(existing.physicalStock || 0);
          const mRes = Number(m.reserved || 0);
          const eRes = Number(existing.reserved || 0);

          existing.physicalStock = Math.max(ePhys, mPhys);
          existing.reserved = Math.max(eRes, mRes);
          existing.blockedForBom = existing.reserved;
          existing.stock = Math.max(0, existing.physicalStock - existing.reserved);
          existing.availableStock = existing.stock;
          existing.status = existing.stock === 0 ? 'Out of Stock' : (existing.stock <= (existing.minLevel || 50) ? 'Low Stock' : 'In Stock');
        } else {
          dedupMap.set(canonical, { ...m, code: canonical });
        }
      });

      const filteredMaterials = Array.from(dedupMap.values());
      setMaterials(filteredMaterials);
      try {
        localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(filteredMaterials));
      } catch (_) {}
    } finally {
      isSyncing = false;
    }
  };

    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncEngineInventory();
      }, 150);
    };

    syncEngineInventory();

    // Fetch live GRNs from server API on mount and update store
    fetch('/api/grns')
      .then(res => res.json())
      .then(grns => {
        if (Array.isArray(grns) && grns.length > 0) {
          try {
            localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(grns));
            localStorage.setItem('goods_receipt_notes', JSON.stringify(grns));
          } catch (_) {}
          debouncedSync();
        }
      })
      .catch(() => {});

    // Authoritative Server & Cloud Database Inventory Sync
    const fetchDatabaseInventory = async () => {
      if (isFetchingDb) return;
      isFetchingDb = true;
      try {
        // 1. Authoritative sync of BOMs directly from Supabase Cloud
        try {
          let bData = await fetchCloudStore('BOM_STORE', []);
          if (!Array.isArray(bData) || bData.length === 0) {
            const bRes = await fetch('/api/boms');
            if (bRes.ok) {
              const json = await bRes.json();
              bData = json?.data || json;
            }
          }
          if (Array.isArray(bData) && bData.length > 0) {
            try {
              localStorage.setItem('controlroom_bom_store', JSON.stringify(bData));
            } catch (_) {}
          }
        } catch (_) {}

        // 2. Authoritative sync of RAW_MATERIALS_STORE directly from Supabase Cloud
        try {
          let rawMats = await fetchCloudStore('RAW_MATERIALS_STORE', []);
          if (!Array.isArray(rawMats) || rawMats.length === 0) {
            const rRes = await fetch('/api/raw-materials');
            if (rRes.ok) rawMats = await rRes.json();
          }
          if (Array.isArray(rawMats) && rawMats.length > 0) {
            try {
              localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(rawMats));
            } catch (_) {}
          }
        } catch (_) {}

        debouncedSync();
      } finally {
        isFetchingDb = false;
      }
    };

    const debouncedFetchDatabase = () => {
      if (debounceDbTimer) clearTimeout(debounceDbTimer);
      debounceDbTimer = setTimeout(() => {
        fetchDatabaseInventory();
      }, 250);
    };

    fetchDatabaseInventory();
    const pollDbInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchDatabaseInventory();
      }
    }, 30000);

    const unsubCloudBoms = subscribeToCloudStore('BOM_STORE', () => {
      debouncedFetchDatabase();
    });
    const unsubCloudRaw = subscribeToCloudStore('RAW_MATERIALS_STORE', () => {
      debouncedFetchDatabase();
    });

    const unsubscribe = prodModuleEngine.subscribe(() => {
      debouncedSync();
    });
    window.addEventListener('controlroom_raw_materials_update', debouncedSync);
    window.addEventListener('controlroom_bom_store_updated', debouncedFetchDatabase);
    window.addEventListener('controlroom_grn_completed', debouncedSync);
    window.addEventListener('controlroom_storage_update', debouncedSync);
    window.addEventListener('central_inventory_updated', debouncedSync);
    window.addEventListener('storage', debouncedSync);
    return () => {
      clearInterval(pollDbInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (debounceDbTimer) clearTimeout(debounceDbTimer);
      if (unsubCloudBoms && typeof unsubCloudBoms.unsubscribe === 'function') unsubCloudBoms.unsubscribe();
      if (unsubCloudRaw && typeof unsubCloudRaw.unsubscribe === 'function') unsubCloudRaw.unsubscribe();
      unsubscribe();
      window.removeEventListener('controlroom_raw_materials_update', debouncedSync);
      window.removeEventListener('controlroom_bom_store_updated', debouncedFetchDatabase);
      window.removeEventListener('controlroom_grn_completed', debouncedSync);
      window.removeEventListener('controlroom_storage_update', debouncedSync);
      window.removeEventListener('central_inventory_updated', debouncedSync);
      window.removeEventListener('storage', debouncedSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsList, initialMaterials]);
  const [selectedCode, setSelectedCode] = useState('RM-001');
  const [sideTab, setSideTab] = useState('Stock Balance'); // 'Stock Balance' | 'Transaction History' | 'Details' | 'Store wise Stock'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('All Categories');
  const [selectedStore, setSelectedStore] = useState('All Stores');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [showTxModal, setShowTxModal] = useState(false);
  const [auditViewMode, setAuditViewMode] = useState('table'); // 'table' | 'timeline'
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('ALL');
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjType, setAdjType] = useState('Add');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('Stock Audit Correction');
  const [selectedTab, setSelectedTab] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [goToPageInput, setGoToPageInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemsPendingDelete, setItemsPendingDelete] = useState([]);

  const selectedMat = useMemo(() => {
    const base = materials.find(m => m.code === selectedCode) || materials[0];
    if (!base) return null;
    return base;
  }, [materials, selectedCode]);

  // Item-specific authoritative audit logs & traceability engine
  const itemAuditLogs = useMemo(() => {
    if (!selectedMat) return [];

    const sCode = String(selectedMat.code || '').toLowerCase().trim();
    const sName = String(selectedMat.name || '').toLowerCase().trim();
    const sNorm = normalizeProductName(selectedMat.name || '');
    const sFp = wordFingerprint(selectedMat.name || '');

    const logs = [];

    // 1. Authoritative Sales BOM Allocations & Dispatch Deductions
    try {
      const bRaw = localStorage.getItem('controlroom_bom_store');
      let boms = [];
      if (bRaw) boms = JSON.parse(bRaw);

      // Pre-map linked PI to Sales Person as fallback
      const piMap = {};
      try {
        const pRaw = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_procurement_pi_store');
        if (pRaw) {
          const pis = JSON.parse(pRaw);
          if (Array.isArray(pis)) {
            pis.forEach(p => {
              const no = String(p.piNo || p.id || '').toUpperCase().trim();
              const sp = p.salesPerson || p.salesperson || p.createdBy || '';
              if (no && sp) piMap[no] = sp;
            });
          }
        }
      } catch (_) {}

      if (Array.isArray(boms)) {
        boms.forEach(b => {
          const st = String(b?.status || '').toLowerCase();
          if (st.includes('cancel') || st.includes('stock restored')) return;
          const isSentToDispatch = Boolean(b?.salesConfirmed) || [
            'sales confirmed - sent to dispatch',
            'sent to production',
            'confirmed',
            'packed & ready for dispatch',
            'partially packed',
            'closed',
            'dispatch packing verified - sent to accounts',
            'awaiting vehicle loading & dispatch'
          ].some(s => st.includes(s));

          const rawSales = b.salesPerson || b.salesperson || b.salesRep || b.createdBy || b.createdByName || b.salesPersonName || (b.sourcePiNo ? piMap[String(b.sourcePiNo).toUpperCase().trim()] : '') || '';
          const cleanSalesPerson = rawSales ? rawSales.replace(/\s*\([^)]*\)/g, '').trim() : '';
          const salesCode = b.salesPersonCode || b.createdById || '';
          const displaySalesPerson = cleanSalesPerson ? `${cleanSalesPerson}${salesCode ? ` (${salesCode})` : ''}` : 'Sales Executive';

          (b?.items || []).forEach(it => {
            const itRes = resolveProductCode(it).toLowerCase().trim();
            const itCode = String(itRes || it.code || '').toLowerCase().trim();
            const itName = String(it.name || it.description || '').toLowerCase().trim();
            const itNorm = normalizeProductName(it.name || '');
            const itFp = wordFingerprint(it.name || '');

            const isMatch = (sCode && itCode === sCode) || (sName && itName === sName) || (sNorm && itNorm === sNorm) || (sFp && itFp === sFp);
            if (isMatch) {
              const qty = parseFloat(it.qty || it.bomQty || 0) || 0;
              if (qty > 0) {
                const rawDate = b.salesConfirmedAt || b.createdAt || b.date;
                let formattedDate = 'Recent Order';
                try {
                  if (rawDate) {
                    const d = new Date(rawDate);
                    formattedDate = !isNaN(d.getTime())
                      ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                      : String(rawDate);
                  }
                } catch (_) {}

                const baseStock = Math.max(0, parseFloat(selectedMat.openingStock !== undefined ? selectedMat.openingStock : (selectedMat.physicalStock || 0)) || 0);
                const afterStock = Math.max(0, baseStock - qty);

                logs.push({
                  id: `BOM-LOG-${b.bomCode || b.code || b.id}-${itCode}`,
                  timestamp: formattedDate,
                  type: isSentToDispatch ? 'BOM_DISPATCH' : 'BOM_RESERVATION',
                  typeName: isSentToDispatch ? 'BOM Dispatch Deduction' : 'BOM Order Allocation',
                  typeColor: isSentToDispatch ? '#DC2626' : '#D97706',
                  typeBg: isSentToDispatch ? '#FEF2F2' : '#FFFBEB',
                  typeBorder: isSentToDispatch ? '#FEE2E2' : '#FEF3C7',
                  referenceDoc: b.bomCode || b.code || b.id || 'BOM Order',
                  itemCode: selectedMat.code,
                  itemName: selectedMat.name,
                  qty: -qty,
                  unit: it.uom || selectedMat.unit || 'NOS',
                  previousStock: baseStock,
                  newStock: isSentToDispatch ? afterStock : baseStock,
                  user: displaySalesPerson,
                  salesPerson: cleanSalesPerson || 'Sales Executive',
                  salesPersonCode: salesCode,
                  salesPersonFull: displaySalesPerson,
                  sourcePiNo: b.sourcePiNo || '',
                  role: 'Sales Department',
                  reason: isSentToDispatch
                    ? `Deducted ${(Number(qty) || 0).toLocaleString()} ${it.uom || selectedMat.unit || 'NOS'} for customer order ${b.companyName || b.customerName || 'Direct Client'} under ${b.bomCode || b.code} (Sales Confirmed - Forwarded to Dispatch). Sales Owner: ${displaySalesPerson}.`
                    : `Allocated ${(Number(qty) || 0).toLocaleString()} ${it.uom || selectedMat.unit || 'NOS'} for customer order ${b.companyName || b.customerName || 'Direct Client'} under ${b.bomCode || b.code}. Sales Owner: ${displaySalesPerson}.`,
                  source: b.companyName || b.customerName || 'Sales Order',
                  location: selectedMat.store || 'Finished Goods Bay'
                });
              }
            }
          });
        });
      }
    } catch (_) {}

    // 2. Authoritative Goods Receipts (GRN Inwarding from Procurement)
    try {
      const gRaw = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || localStorage.getItem('controlroom_grn_store');
      let grns = [];
      if (gRaw) grns = JSON.parse(gRaw);
      if (Array.isArray(grns)) {
        grns.forEach(g => {
          (g.items || []).forEach(git => {
            const gCode = String(git.materialCode || git.itemCode || git.code || git.sku || git.itemId || '').toLowerCase().trim();
            const gName = String(git.materialName || git.name || '').toLowerCase().trim();
            const gNorm = normalizeProductName(git.materialName || git.name || '');
            const isMatch = (sCode && gCode && (gCode === sCode || gCode.includes(sCode) || sCode.includes(gCode))) || 
                            (sName && gName && (gName === sName || gName.includes(sName) || sName.includes(gName))) ||
                            (sNorm && gNorm && sNorm === gNorm);
            if (isMatch) {
              const recQty = parseFloat(git.accepted !== undefined && git.accepted !== '' ? git.accepted : (git.now !== undefined && git.now !== '' ? git.now : (git.receivedQty || git.qty || 0))) || 0;
              if (recQty > 0) {
                const rawDate = g.createdAt || g.grnDate || g.date;
                let formattedDate = 'Recent Receipt';
                try {
                  if (rawDate) {
                    const d = new Date(rawDate);
                    formattedDate = !isNaN(d.getTime())
                      ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                      : String(rawDate);
                  }
                } catch (_) {}

                logs.push({
                  id: `GRN-LOG-${g.grnNo || g.id}-${gCode || 'item'}`,
                  timestamp: formattedDate,
                  type: 'GOODS_RECEIPT',
                  typeName: 'Goods Receipt Note (GRN)',
                  typeColor: '#0E7490',
                  typeBg: '#ECFEFF',
                  typeBorder: '#CFFAFE',
                  referenceDoc: g.grnNo || g.id || 'GRN',
                  itemCode: selectedMat.code,
                  itemName: selectedMat.name,
                  qty: +recQty,
                  unit: git.unit || git.uom || selectedMat.unit || 'NOS',
                  previousStock: Math.max(0, (selectedMat.stock || 0) - recQty),
                  newStock: selectedMat.stock,
                  user: g.inspectedBy || g.verifiedBy || g.receivedBy || 'Store In-Charge',
                  role: 'Warehouse Receiving',
                  reason: `Inwarded ${(Number(recQty) || 0).toLocaleString()} ${git.unit || git.uom || selectedMat.unit || 'NOS'} via ${g.grnNo || 'GRN'} from supplier ${g.vendor || g.vendorName || g.supplier || 'Vendor'}. Quality inspection approved.`,
                  source: g.vendor || g.vendorName || g.supplier || 'Procurement Order',
                  location: selectedMat.store || 'Main Store'
                });
              }
            }
          });
        });
      }
    } catch (_) {}

    // 3. Central Ledger & Production Work Orders
    try {
      const engineLedger = (typeof prodModuleEngine !== 'undefined' && prodModuleEngine.getLedger) ? prodModuleEngine.getLedger() : [];
      (engineLedger || []).forEach(entry => {
        const eCode = String(entry.itemCode || '').toUpperCase().trim();
        const eName = String(entry.itemName || '').toLowerCase().trim();
        if (eCode === sCode.toUpperCase() || eName === sName) {
          logs.push({
            id: entry.id || `TX-${Date.now()}`,
            timestamp: entry.dateTime || entry.timestamp || 'Production Log',
            type: entry.type || 'PRODUCTION_LOG',
            typeName: entry.type === 'PRODUCTION_RECEIPT' ? 'Production Output Inward' : (entry.type === 'PRODUCTION_CONSUMPTION' ? 'Raw Material Consumption' : (entry.type === 'OPENING_STOCK' ? 'Opening Stock Balance' : 'Inventory Transaction')),
            typeColor: entry.type === 'PRODUCTION_RECEIPT' ? '#16A34A' : (entry.type === 'OPENING_STOCK' ? '#2563EB' : '#4F46E5'),
            typeBg: entry.type === 'PRODUCTION_RECEIPT' ? '#F0FDF4' : (entry.type === 'OPENING_STOCK' ? '#EFF6FF' : '#EEF2FF'),
            typeBorder: entry.type === 'PRODUCTION_RECEIPT' ? '#DCFCE7' : (entry.type === 'OPENING_STOCK' ? '#DBEAFE' : '#E0E7FF'),
            referenceDoc: entry.refNo || entry.sourceDoc || 'WO-Record',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: entry.direction === 'IN' ? +(entry.qty || 0) : -(entry.qty || 0),
            unit: entry.unit || selectedMat.unit || 'NOS',
            previousStock: entry.previousStock !== undefined ? entry.previousStock : (entry.type === 'OPENING_STOCK' ? 0 : undefined),
            newStock: entry.newStock !== undefined ? entry.newStock : (entry.type === 'OPENING_STOCK' ? (entry.qty || 0) : undefined),
            user: entry.user || 'Production Head',
            role: entry.department || 'Production & Quality',
            reason: entry.remarks || `Production operation entry for ${selectedMat.name}.`,
            source: entry.sourceDoc || 'Production Floor',
            location: entry.warehouse || selectedMat.store || 'Plant Bay'
          });
        }
      });
    } catch (_) {}

    // 4. Initial Physical Stock Baseline Setup
    const initialBase = Math.max(0, parseFloat(selectedMat.openingStock !== undefined ? selectedMat.openingStock : 0) || 0);
    logs.push({
      id: `INIT-${selectedMat.code}`,
      timestamp: 'Initial Setup Baseline',
      type: 'OPENING_STOCK',
      typeName: 'Initial Opening Stock',
      typeColor: '#2563EB',
      typeBg: '#EFF6FF',
      typeBorder: '#DBEAFE',
      referenceDoc: 'SETUP-BASE',
      itemCode: selectedMat.code,
      itemName: selectedMat.name,
      qty: +initialBase,
      unit: selectedMat.unit || 'NOS',
      previousStock: 0,
      newStock: initialBase,
      user: 'Central Inventory Master',
      role: 'System Setup',
      reason: `Initial ready physical stock balance of ${(Number(initialBase) || 0).toLocaleString()} ${selectedMat.unit || 'NOS'} provisioned for active sales dispatch and manufacturing assembly.`,
      source: 'Central Finished Goods Registry',
      location: selectedMat.store || 'Finished Goods Bay'
    });

    return logs;
  }, [selectedMat]);

  const filteredMaterials = useMemo(() => {
    const isRawMaterialDirectory = activeTab === 'Raw Material Directory' || (activeTab && activeTab.toLowerCase().includes('raw material'));
    
    return materials.filter(m => {
      const mName = String(m.name || '').trim();
      const mCode = String(m.code || '').trim();
      const mCodeLower = mCode.toLowerCase();
      const mNameLower = mName.toLowerCase();

      // Filter out invalid items or blank rows upfront, and unify legacy MR300 into canonical MR-300MM
      if (!mCode || !mName || mCode === '—' || mCodeLower === 'rm-vrm' || mCodeLower === 'mr300') return false;

      // Identify whether an item is raw material strictly based on Category
      const itemCat = String(m.category || m.cat || '').trim().toLowerCase();
      const isRawMaterial = itemCat === 'raw material' || itemCat === 'raw materials' || mCodeLower === 'alu-len-2414mm' || mCodeLower === 'rm-alu-2414';

      if (isRawMaterialDirectory) {
        // Raw Material Directory strictly shows ONLY items where Category is 'Raw Material'
        if (!isRawMaterial) return false;
      } else {
        // Inventory Stores strictly shows ALL OTHER categories (NEVER show raw materials)
        if (isRawMaterial) return false;
      }

      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = !q || 
        mCodeLower.includes(q) || 
        mNameLower.includes(q) ||
        (m.sku && String(m.sku).toLowerCase().includes(q)) ||
        (q.includes('300') && (mNameLower.includes('300') || (m.cutLength && String(m.cutLength).includes('300')) || (m.lengthMm && String(m.lengthMm).includes('300'))));
      const matchesCat = selectedCat === 'All Categories' || m.cat === selectedCat || m.category === selectedCat;
      const matchesStore = selectedStore === 'All Stores' || m.store === selectedStore;
      const matchesStatus = selectedStatus === 'All Status' || m.status === selectedStatus;
      return matchesSearch && matchesCat && matchesStore && matchesStatus;
    });

    const seenCanonical = new Set();
    return matched.filter(m => {
      const upper = String(m.code || '').toUpperCase().trim();
      const canonical = CANONICAL_PRODUCT_ALIASES[upper] || upper;
      if (seenCanonical.has(canonical)) return false;
      seenCanonical.add(canonical);
      return true;
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [materials, searchQuery, selectedCat, selectedStore, selectedStatus, activeTab]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    return materials.filter(m => m.status === 'Low Stock' || m.status === 'Out of Stock');
  }, [materials]);

  // Category summary breakdown
  const catSummary = [
    { label: 'Aluminium', amount: '₹ 18,40,000', pct: '37.7%', color: '#3b82f6' },
    { label: 'Steel', amount: '₹ 16,25,600', pct: '33.3%', color: '#22c55e' },
    { label: 'Fasteners', amount: '₹ 7,80,320', pct: '16.0%', color: '#f59e0b' },
    { label: 'Coating', amount: '₹ 2,10,000', pct: '4.3%', color: '#ec4899' },
    { label: 'Packing', amount: '₹ 2,19,400', pct: '4.5%', color: '#a855f7' }
  ];

  // Recent activity log
  const recentActivities = [
    { type: 'grn', code: 'GRN-102', desc: 'Goods Receipt GRN-102', detail: 'Aluminium Sheet - 500 KG', time: '20 Aug 2026, 10:30 AM', bg: '#dcfce7', color: '#166534' },
    { type: 'issue', code: 'PI-045', desc: 'Material Issue PI-045', detail: 'GI Sheet - 150 KG', time: '20 Aug 2026, 09:15 AM', bg: '#dbeafe', color: '#1e40af' },
    { type: 'adj', code: 'ADJ-008', desc: 'Stock Adjustment ADJ-008', detail: 'MS Channel +10 Nos', time: '19 Aug 2026, 04:45 PM', bg: '#ffedd5', color: '#ea580c' }
  ];

  const handleStockAdjustment = () => {
    if (!adjQty || isNaN(adjQty)) return;
    const val = parseFloat(adjQty);
    const impactQty = adjType === 'Add' ? val : -val;
    const formattedTime = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    const adjRefDoc = `ADJ-${Math.floor(1000 + Math.random() * 9000)}`;

    // Log stock adjustment entry to engine ledger so it instantly appears in Item Audit Log
    prodModuleEngine.addLedgerEntry({
      timestamp: formattedTime,
      type: 'STOCK_ADJUSTMENT',
      woId: adjRefDoc,
      itemCode: selectedMat.code,
      itemName: selectedMat.name,
      qty: impactQty,
      unit: selectedMat.unit || 'Pieces',
      previousStock: selectedMat.stock,
      newStock: adjType === 'Add' ? selectedMat.stock + val : Math.max(0, selectedMat.stock - val),
      user: 'Senthil Kumar (Production Head)',
      employee: 'Inventory Controller',
      reason: `Stock Adjustment (${adjType === 'Add' ? 'Add Audit Surplus' : 'Deduct Shortage/Wastage'} ${impactQty > 0 ? '+' + impactQty : impactQty} ${selectedMat.unit}): ${adjReason || 'Physical Audit Correction'}`,
      referenceDoc: adjRefDoc
    });

    const updatedMaterials = materials.map(m => {
      if (m.code === selectedMat.code) {
        const currentPhys = Number(m.physicalStock !== undefined ? m.physicalStock : (m.stock || 0));
        const currentOpen = Number(m.openingStock !== undefined ? m.openingStock : currentPhys);
        const newOpening = adjType === 'Add' ? currentOpen + val : Math.max(0, currentOpen - val);
        const newPhysical = adjType === 'Add' ? currentPhys + val : Math.max(0, currentPhys - val);
        const currentRes = Number(m.reserved || 0);
        const newStock = Math.max(0, newPhysical - currentRes);
        const newStatus = newStock === 0 ? 'Out of Stock' : newStock <= (m.minLevel || 50) ? 'Low Stock' : 'In Stock';
        return {
          ...m,
          openingStock: newOpening,
          physicalStock: newPhysical,
          stock: newStock,
          availableStock: newStock,
          available: newStock,
          stockAdj: (m.stockAdj || 0) + impactQty,
          status: newStatus,
          lastUpdated: 'Stock Adjusted'
        };
      }
      return m;
    });

    setMaterials(updatedMaterials);

    try {
      localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedMaterials));
    } catch (_) {}

    // Post to server endpoints to update disk and trigger real-time SSE broadcasts
    try {
      fetch('/api/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(() => {});
      fetch('/api/store/raw_materials_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(() => {});
      fetch('/api/store/item_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(() => {});
    } catch (_) {}

    try {
      saveCloudStore('raw_materials_store', updatedMaterials);
    } catch (_) {}

    // Real-time local broadcast to other views in the same browser window
    try {
      window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update', {
        detail: { rawMaterials: updatedMaterials, storeData: updatedMaterials }
      }));
      window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    setShowAdjModal(false);
    setAdjQty('');
  };

  const [showAddStockForm, setShowAddStockForm] = useState(false);

  const getFreshReceiptForm = () => ({
    receiptType: 'Goods Receipt (Purchase)',
    receiptNo: `GRN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
    receiptDate: new Date().toLocaleDateString('en-GB'),
    poNo: '',
    supplier: '',
    supplierInvNo: '',
    invoiceDate: '',
    deliveryChallanNo: '',
    transporterName: '',
    vehicleNo: '',
    driverName: '',
    remarks: ''
  });

  const getFreshReceiptItems = () => [
    { id: 1, material: '', batchNo: '', unit: '', qty: '' }
  ];

  const [receiptForm, setReceiptForm] = useState(getFreshReceiptForm);
  const [receiptItems, setReceiptItems] = useState(getFreshReceiptItems);
  const [isMatDropdownOpen, setIsMatDropdownOpen] = useState(false);
  const matDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (matDropdownRef.current && !matDropdownRef.current.contains(e.target)) {
        setIsMatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFilesQueue, setUploadFilesQueue] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Helper to format file size cleanly
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Process a single file from queue or direct selection
  const processUploadedFile = (file, queueId) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!Array.isArray(data) || data.length === 0) {
          setUploadFilesQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'error', progress: 100, errorMsg: 'File is empty' } : f));
          return;
        }

        const importedMaterials = [];

        data.forEach((row, idx) => {
          const findVal = (...keys) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(
                origKey => origKey.trim().toLowerCase() === k.trim().toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return row[matchedKey];
              }
            }
            return '';
          };

          const code = String(findVal('Item Code', 'Material Code', 'Code', 'SKU', 'Part Number', 'Part No') || `ITEM-${Date.now()}-${idx + 1}`).trim();
          const name = String(findVal('Item Name', 'Material Description', 'Description', 'Product Name', 'Name') || code).trim();
          const cat = String(findVal('Category', 'Cat', 'Department', 'Group') || (activeTab === 'Raw Material Directory' ? 'Raw Material' : 'Finished Goods')).trim();
          const unit = String(findVal('Unit', 'UOM', 'Unit of Measure') || 'Length').trim();
          const stock = Number(String(findVal('Physical Stock', 'Current Stock', 'Stock', 'Quantity', 'Qty') || '0').replace(/[^0-9.-]+/g, '')) || 0;
          const minLevel = Number(String(findVal('Min Level', 'Safety Stock', 'Reorder Level', 'Min. Level') || '50').replace(/[^0-9.-]+/g, '')) || 50;
          const store = String(findVal('Store Location', 'Store', 'Location', 'Bay') || 'Main Store').trim();
          const hsn = String(findVal('HSN', 'HSN Code', 'SAC') || '7604').trim();
          const lengthMm = String(findVal('Length', 'Length Mm', 'Length (mm)', 'LengthMm') || '').replace(/[^0-9.]+/g, '');

          let status = 'In Stock';
          if (stock === 0) status = 'Out of Stock';
          else if (stock <= minLevel) status = 'Low Stock';

          importedMaterials.push({
            code,
            name,
            cat,
            unit,
            stock,
            minLevel,
            lengthMm: lengthMm || undefined,
            store,
            hsn,
            status,
            lastUpdated: 'Imported from File',
            reserved: 0,
            openingStock: stock,
            goodsReceived: 0,
            issuedProd: 0,
            matReturn: 0,
            stockAdj: 0
          });
        });

        if (importedMaterials.length > 0) {
          setMaterials(prev => {
            const existingMap = new Map();
            prev.forEach(item => existingMap.set(item.code, item));
            importedMaterials.forEach(item => existingMap.set(item.code, item));
            const combined = Array.from(existingMap.values());
            try {
              localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(combined));
            } catch (err) {}
            return combined;
          });

          // Synchronize with productionModuleEngine
          importedMaterials.forEach(item => {
            try {
              const inv = prodModuleEngine.getInventory();
              const existingIdx = inv.findIndex(i => i.code === item.code);
              if (existingIdx >= 0) {
                inv[existingIdx].physicalStock = item.stock;
                inv[existingIdx].availableStock = Math.max(0, item.stock - (inv[existingIdx].reservedStock || 0));
              } else {
                inv.push({
                  code: item.code,
                  name: item.name,
                  category: item.cat,
                  unit: item.unit,
                  physicalStock: item.stock,
                  reservedStock: 0,
                  availableStock: item.stock,
                  issuedStock: 0,
                  consumedStock: 0,
                  safetyStock: item.minLevel,
                  unitRate: 500,
                  bayLocation: item.store
                });
              }
            } catch (e) {}
          });
          prodModuleEngine.saveToStorage();

          // Update file item in queue to completed
          setUploadFilesQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'completed', progress: 100, count: importedMaterials.length } : f));
        }
      } catch (err) {
        console.error('File parsing error:', err);
        setUploadFilesQueue(prev => prev.map(f => f.id === queueId ? { ...f, status: 'error', progress: 100, errorMsg: err.message } : f));
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleFilesSelected = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);

    newFiles.forEach(file => {
      const queueId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');

      const newFileEntry = {
        id: queueId,
        name: file.name,
        size: file.size,
        progress: 20,
        status: isExcel ? 'uploading' : 'completed',
        fileObj: file
      };

      setUploadFilesQueue(prev => [newFileEntry, ...prev]);

      if (isExcel) {
        setTimeout(() => {
          setUploadFilesQueue(prev => prev.map(f => f.id === queueId ? { ...f, progress: 65 } : f));
        }, 350);

        setTimeout(() => {
          processUploadedFile(file, queueId);
        }, 750);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!Array.isArray(data) || data.length === 0) {
          showCustomAlert('The uploaded file is empty or could not be read.', 'Upload Failed', 'error');
          setIsUploading(false);
          return;
        }

        const importedMaterials = [];

        data.forEach((row, idx) => {
          const findVal = (...keys) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(
                origKey => origKey.trim().toLowerCase() === k.trim().toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return row[matchedKey];
              }
            }
            return '';
          };

          const code = String(findVal('Item Code', 'Material Code', 'Code', 'SKU', 'Part Number', 'Part No') || `ITEM-${Date.now()}-${idx + 1}`).trim();
          const name = String(findVal('Item Name', 'Material Description', 'Description', 'Product Name', 'Name') || code).trim();
          const cat = String(findVal('Category', 'Cat', 'Department', 'Group') || (activeTab === 'Raw Material Directory' ? 'Raw Material' : 'Finished Goods')).trim();
          const unit = String(findVal('Unit', 'UOM', 'Unit of Measure') || 'Length').trim();
          const stock = Number(String(findVal('Physical Stock', 'Current Stock', 'Stock', 'Quantity', 'Qty') || '0').replace(/[^0-9.-]+/g, '')) || 0;
          const minLevel = Number(String(findVal('Min Level', 'Safety Stock', 'Reorder Level', 'Min. Level') || '50').replace(/[^0-9.-]+/g, '')) || 50;
          const store = String(findVal('Store Location', 'Store', 'Location', 'Bay') || 'Main Store').trim();
          const hsn = String(findVal('HSN', 'HSN Code', 'SAC') || '7604').trim();
          const lengthMm = String(findVal('Length', 'Length Mm', 'Length (mm)', 'LengthMm') || '').replace(/[^0-9.]+/g, '');

          let status = 'In Stock';
          if (stock === 0) status = 'Out of Stock';
          else if (stock <= minLevel) status = 'Low Stock';

          importedMaterials.push({
            code,
            name,
            cat,
            unit,
            stock,
            minLevel,
            lengthMm: lengthMm || undefined,
            store,
            hsn,
            status,
            lastUpdated: 'Imported from File',
            reserved: 0,
            openingStock: stock,
            goodsReceived: 0,
            issuedProd: 0,
            matReturn: 0,
            stockAdj: 0
          });
        });

        if (importedMaterials.length > 0) {
          setMaterials(prev => {
            const existingMap = new Map();
            prev.forEach(item => existingMap.set(item.code, item));
            importedMaterials.forEach(item => existingMap.set(item.code, item));
            const combined = Array.from(existingMap.values());
            try {
              localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(combined));
            } catch (err) {}
            return combined;
          });

          // Synchronize with productionModuleEngine
          importedMaterials.forEach(item => {
            try {
              const inv = prodModuleEngine.getInventory();
              const existingIdx = inv.findIndex(i => i.code === item.code);
              if (existingIdx >= 0) {
                inv[existingIdx].physicalStock = item.stock;
                inv[existingIdx].availableStock = Math.max(0, item.stock - (inv[existingIdx].reservedStock || 0));
              } else {
                inv.push({
                  code: item.code,
                  name: item.name,
                  category: item.cat,
                  unit: item.unit,
                  physicalStock: item.stock,
                  reservedStock: 0,
                  availableStock: item.stock,
                  issuedStock: 0,
                  consumedStock: 0,
                  safetyStock: item.minLevel,
                  unitRate: 500,
                  bayLocation: item.store
                });
              }
            } catch (e) {}
          });
          prodModuleEngine.saveToStorage();

          showCustomAlert(`✅ Successfully imported ${importedMaterials.length} items from ${file.name}!`, 'Import Complete', 'success');
        }
      } catch (err) {
        console.error('File parsing error:', err);
        showCustomAlert(`Failed to read file: ${err.message}`, 'Import Error', 'error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleOpenAddStock = () => {
    if (isSalesUser) return;
    setReceiptForm(getFreshReceiptForm());
    setReceiptItems(getFreshReceiptItems());
    setAddStockActive(true);
  };

  const handleOpenStockAdj = (mat) => {
    if (isSalesUser) {
      if (mat && mat.code) {
        setSelectedCode(mat.code);
        setShowTxModal(true);
      }
      return;
    }
    if (mat && mat.code) {
      setSelectedCode(mat.code);
    }
    setShowAdjModal(true);
  };

  const handleAddMaterialRow = () => {
    setReceiptItems(prev => [
      ...prev,
      { id: prev.length + 1, material: '', batchNo: '', unit: '', qty: 0, rate: 0, tax: '18%', amount: 0 }
    ]);
  };

  const handleRemoveMaterialRow = (id) => {
    if (receiptItems.length <= 1) return;
    setReceiptItems(prev => prev.filter(item => item.id !== id));
  };

  const updateMaterialRow = (id, field, value) => {
    setReceiptItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const q = parseFloat(updated.qty) || 0;
          const r = parseFloat(updated.rate) || 0;
          updated.amount = q * r;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveAndConfirm = () => {
    let addedCount = 0;
    const enteredMatCode = (receiptForm.materialCode || '').trim();
    const enteredMatName = (receiptItems[0]?.material || '').trim();
    const catVal = receiptForm.category || 'Aluminium';
    const qtyVal = parseFloat(receiptItems[0]?.qty) || 0;
    const reservedVal = parseFloat(receiptForm.reservedStock) || 0;
    const minLevelVal = parseFloat(receiptForm.minLevel) || 10;
    const unitVal = receiptItems[0]?.unit || 'Numbers';
    const batchNoVal = (receiptForm.supplierInvNo || receiptItems[0]?.batchNo || '').trim();
    const notesVal = (receiptForm.remarks || '').trim();

    if (!catVal) {
      showCustomAlert('Please select a Category.', 'Category Required', 'warning');
      return;
    }
    if (!enteredMatName) {
      showCustomAlert('Please enter a valid Material Description / Name.', 'Material Description Required', 'warning');
      return;
    }
    if (qtyVal <= 0) {
      showCustomAlert('Please enter a valid Physical Stock quantity (> 0).', 'Quantity Required', 'warning');
      return;
    }

    let rawTarget = String(enteredMatCode || '').toUpperCase().trim();
    let targetMatCode = CANONICAL_PRODUCT_ALIASES[rawTarget] || rawTarget;
    let matched = false;

    let updatedMaterials = materials.map(m => {
      const canonicalMCode = CANONICAL_PRODUCT_ALIASES[String(m.code || '').toUpperCase().trim()] || String(m.code || '').toUpperCase().trim();
      const isMatch = (targetMatCode && (String(m.code).toLowerCase() === targetMatCode.toLowerCase() || canonicalMCode.toLowerCase() === targetMatCode.toLowerCase())) ||
                      String(m.name || '').toLowerCase() === enteredMatName.toLowerCase();
      if (isMatch) {
        matched = true;
        targetMatCode = m.code;
        addedCount += qtyVal;
        const currentPhys = Number(m.physicalStock !== undefined ? m.physicalStock : (m.stock || 0));
        const currentOpen = Number(m.openingStock !== undefined ? m.openingStock : currentPhys);
        const newOpening = currentOpen + qtyVal;
        const newPhysical = currentPhys + qtyVal;
        const newReserved = (Number(m.reserved) || 0) + reservedVal;
        const newStock = Math.max(0, newPhysical - newReserved);
        const effectiveMin = minLevelVal || m.minLevel || 10;
        const newStatus = newStock === 0 ? 'Out of Stock' : newStock <= effectiveMin ? 'Low Stock' : 'In Stock';
        return {
          ...m,
          openingStock: newOpening,
          physicalStock: newPhysical,
          stock: newStock,
          availableStock: newStock,
          available: newStock,
          reserved: newReserved,
          blockedForBom: newReserved,
          minLevel: effectiveMin,
          cat: catVal || m.cat,
          category: catVal || m.category,
          unit: unitVal || m.unit,
          status: newStatus,
          lastUpdated: 'Stock Added'
        };
      }
      return m;
    });

    if (!matched) {
      addedCount = qtyVal;
      if (!targetMatCode) {
        targetMatCode = `RM-${String(materials.length + 1).padStart(3, '0')}`;
      }
      const availStock = Math.max(0, qtyVal - reservedVal);
      const newStatus = qtyVal === 0 ? 'Out of Stock' : qtyVal <= minLevelVal ? 'Low Stock' : 'In Stock';
      updatedMaterials = [{
        code: targetMatCode,
        name: enteredMatName,
        cat: catVal,
        category: catVal,
        store: 'Main Store',
        openingStock: qtyVal,
        physicalStock: qtyVal,
        stock: availStock,
        availableStock: availStock,
        available: availStock,
        reserved: reservedVal,
        blockedForBom: reservedVal,
        minLevel: minLevelVal,
        unit: unitVal,
        status: newStatus,
        lastUpdated: 'Stock Added'
      }, ...updatedMaterials];
    }

    setMaterials(updatedMaterials);

    // 1. Persist to local browser storage immediately
    try {
      localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedMaterials));
    } catch (_) {}

    // 2. Persist to server disk store & broadcast via SSE to ALL connected users
    try {
      fetch('/api/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(err => console.warn('[RawMaterials API sync error]:', err));

      fetch('/api/store/raw_materials_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(err => console.warn('[Store API sync error]:', err));

      fetch('/api/store/item_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterials)
      }).catch(() => {});
    } catch (_) {}

    // 3. Persist to Supabase cloud database
    try {
      saveCloudStore('raw_materials_store', updatedMaterials);
      saveCloudStore('item_store', updatedMaterials);
    } catch (_) {}

    // 4. Real-time local broadcast to App.jsx and other open views in this window
    try {
      window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update', {
        detail: { rawMaterials: updatedMaterials, storeData: updatedMaterials }
      }));
      window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // Sync with central productionModuleEngine live inventory
    try {
      const engineInv = prodModuleEngine.getInventory();
      const engineMatch = engineInv.find(i => 
        i.code.toLowerCase() === targetMatCode.toLowerCase() ||
        i.name.toLowerCase() === enteredMatName.toLowerCase()
      );
      if (engineMatch) {
        engineMatch.physicalStock += qtyVal;
        engineMatch.reservedStock = (engineMatch.reservedStock || 0) + reservedVal;
        engineMatch.availableStock = Math.max(0, engineMatch.physicalStock - engineMatch.reservedStock);
      } else {
        engineInv.unshift({
          code: targetMatCode,
          name: enteredMatName,
          category: catVal,
          unit: unitVal,
          isWholeUnitOnly: unitVal === 'Length' || unitVal === 'Bar',
          physicalStock: qtyVal,
          reservedStock: reservedVal,
          availableStock: Math.max(0, qtyVal - reservedVal),
          issuedStock: 0,
          consumedStock: 0,
          safetyStock: minLevelVal,
          unitRate: 580,
          bayLocation: 'Main Store'
        });
      }
      prodModuleEngine.saveToStorage();
    } catch (e) {
      console.error('Engine sync error:', e);
    }

    showCustomAlert(`✅ Stock Intake Completed! ${qtyVal} ${unitVal} of "${enteredMatName}" (${targetMatCode}) added to inventory stock balance.`, 'Stock Updated', 'success');
    setSearchQuery('');
    setSelectedTab('All');
    setSelectedCat('All Categories');
    setSelectedStatus('All Status');
    setCurrentPage(1);
    setReceiptForm({ materialCode: '', category: 'Aluminium', reservedStock: '', minLevel: '10', lengthMm: '2414', supplierInvNo: '', remarks: '' });
    setReceiptItems([{ id: 1, material: '', qty: '', unit: 'Length' }]);
    setAddStockActive(false);
  };

  if (isAddStockActive && !isSalesUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif" }}>

        {/* Header / Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setAddStockActive(false)}
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            >
              <ArrowLeft size={15} /> Back
            </button>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
                Add Stock / Inventory Creation
              </h2>
              <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                Create or update raw material inventory stock details
              </span>
            </div>
          </div>
        </div>

        {/* Premium Card Form */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Section Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Stock Creation Details</h3>
              <span style={{ fontSize: '11.5px', color: '#64748B' }}>Specify material code, physical stock, reserved stock, and min level</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', fontSize: '13px' }}>
            
            {/* 1. Material Code */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Material Code
              </label>
              <input
                type="text"
                value={receiptForm.materialCode || ''}
                onChange={(e) => setReceiptForm({ ...receiptForm, materialCode: e.target.value })}
                placeholder="e.g. RM-011 (Auto-generated if empty)"
                style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', fontWeight: '700', color: '#0E7490', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              />
            </div>

            {/* 2. Category */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={receiptForm.category || ''}
                onChange={(e) => setReceiptForm({ ...receiptForm, category: e.target.value })}
                style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', fontWeight: '700', color: receiptForm.category ? '#0F172A' : '#94A3B8', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              >
                <option value="" disabled>Select the Category</option>
                <option value="Aluminium">Aluminium</option>
                <option value="Hot Dip Galvanized">Hot Dip Galvanized</option>
                <option value="Fasteners">Fasteners</option>
                <option value="Inverter (Hybrid)">Inverter (Hybrid)</option>
                <option value="Inverter (On Grid)">Inverter (On Grid)</option>
                <option value="Module (DCR)">Module (DCR)</option>
                <option value="Module (Ndcr)">Module (Ndcr)</option>
                <option value="Galvalume">Galvalume</option>
                <option value="MS Material (Without Galvanized)">MS Material (Without Galvanized)</option>
                <option value="HR Coil">HR Coil</option>
                <option value="HR Sheet">HR Sheet</option>
                <option value="Dispenser Gun">Dispenser Gun</option>
                <option value="Adhesive Glue">Adhesive Glue</option>
                <option value="Lugs & Gland">Lugs & Gland</option>
                <option value="Square Tube">Square Tube</option>
                <option value="EPDM">EPDM</option>
                <option value="Cables">Cables</option>
                <option value="FRP">FRP</option>
              </select>
            </div>

            {/* 3. Material Description / Name (Searchable & Typable Combobox Dropdown) */}
            <div style={{ gridColumn: 'span 2', position: 'relative' }} ref={matDropdownRef}>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Material Description / Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={receiptItems[0]?.material || ''}
                  onFocus={() => setIsMatDropdownOpen(true)}
                  onChange={(e) => {
                    const enteredVal = e.target.value;
                    updateMaterialRow(receiptItems[0]?.id || 1, 'material', enteredVal);
                    setIsMatDropdownOpen(true);
                    const matObj = materials.find(m => 
                      m.name.toLowerCase() === enteredVal.toLowerCase() || 
                      m.code.toLowerCase() === enteredVal.toLowerCase()
                    );
                    if (matObj) {
                      if (matObj.unit) updateMaterialRow(receiptItems[0]?.id || 1, 'unit', matObj.unit);
                      if (matObj.code) setReceiptForm(prev => ({ ...prev, materialCode: matObj.code, category: matObj.cat || prev.category }));
                    }
                  }}
                  placeholder="Type or select material name (e.g. Structural Steel Beams)..."
                  style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 40px 0 14px', fontSize: '13.5px', fontWeight: '600', color: '#0F172A', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                  onFocusCapture={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  onBlurCapture={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                />
                <button
                  type="button"
                  onClick={() => setIsMatDropdownOpen(!isMatDropdownOpen)}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px' }}
                  title="Toggle Dropdown"
                >
                  <ChevronDown size={18} style={{ transform: isMatDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              </div>

              {/* Dropdown Options Menu */}
              {isMatDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '12px',
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  padding: '6px'
                }}>
                  {(() => {
                    const searchFilter = (receiptItems[0]?.material || '').trim().toLowerCase();
                    const availableList = materials.filter(m => {
                      const mCode = String(m.code || '').toLowerCase();
                      const isRawDir = activeTab === 'Raw Material Directory' || (activeTab && activeTab.toLowerCase().includes('raw material'));
                      const itemCat = String(m.category || m.cat || '').trim().toLowerCase();
                      const isRaw = itemCat === 'raw material' || itemCat === 'raw materials' || String(m.code || '').toLowerCase() === 'alu-len-2414mm' || String(m.code || '').toLowerCase() === 'rm-alu-2414';
                      if (isRawDir) {
                        if (!isRaw) return false;
                      } else {
                        if (isRaw) return false;
                      }
                      if (searchFilter) {
                        return (m.name || '').toLowerCase().includes(searchFilter) || mCode.includes(searchFilter);
                      }
                      return true;
                    });

                    if (availableList.length === 0) {
                      return (
                        <div style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B', textAlign: 'center' }}>
                          No matching items found. You can type to create new: <strong style={{ color: '#0E7490' }}>"{receiptItems[0]?.material}"</strong>
                        </div>
                      );
                    }

                    return availableList.map((m) => (
                      <div
                        key={m.code}
                        onClick={() => {
                          updateMaterialRow(receiptItems[0]?.id || 1, 'material', m.name);
                          if (m.unit) updateMaterialRow(receiptItems[0]?.id || 1, 'unit', m.unit === 'Mtr' ? 'Meters' : m.unit === 'Nos' ? 'Numbers' : m.unit);
                          setReceiptForm(prev => ({
                            ...prev,
                            materialCode: m.code,
                            category: m.cat || prev.category || ''
                          }));
                          setIsMatDropdownOpen(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>{m.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            Code: <span style={{ color: '#0E7490', fontWeight: '700' }}>{m.code}</span> • Cat: {m.cat || 'General'}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                          Stock: {m.stock} {m.unit || 'Units'}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* 4. Unit of Measurement */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Unit of Measurement <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={receiptItems[0]?.unit || 'Numbers'}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  updateMaterialRow(receiptItems[0]?.id || 1, 'unit', newUnit);
                  // Set default dimension values per UOM
                  let defaultDim = newUnit === 'Meters' ? '1.0' : '1';
                  setReceiptForm(prev => ({ ...prev, lengthMm: defaultDim }));
                }}
                style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', fontWeight: '700', color: '#0F172A', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              >
                <option value="Numbers">Numbers (Nos / Pcs)</option>
                <option value="Meters">Meters (Mtr)</option>
              </select>
            </div>

            {/* 5. Dynamic Unit Dimension / Value Container */}
            {(() => {
              const currentUnit = receiptItems[0]?.unit || 'Numbers';
              const isMeters = currentUnit === 'Meters';
              const fieldLabel = isMeters ? 'Length Dimension per Unit (Meters)' : 'Quantity Pack Size / Count (Numbers)';
              const fieldPlaceholder = isMeters ? 'e.g. 1.0' : 'e.g. 1';
              const unitBadge = isMeters ? 'Meters' : 'Numbers';

              return (
                <div>
                  <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {fieldLabel}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      value={receiptForm.lengthMm !== undefined ? receiptForm.lengthMm : (isMeters ? '1.0' : '1')}
                      onChange={(e) => setReceiptForm({ ...receiptForm, lengthMm: e.target.value })}
                      placeholder={fieldPlaceholder}
                      style={{ flex: 1, height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '14px', fontWeight: '700', color: '#0F172A', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    />
                    <div style={{ height: '44px', padding: '0 14px', borderRadius: '10px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', color: '#0E7490', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      {unitBadge}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 5. Physical Stock */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Physical Stock <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="number"
                  value={receiptItems[0]?.qty || ''}
                  onChange={(e) => updateMaterialRow(receiptItems[0]?.id || 1, 'qty', e.target.value)}
                  placeholder="e.g. 100"
                  style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '15px', fontWeight: '800', color: '#0E7490', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                />
              </div>
            </div>



            {/* 8. Min. Level */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Min. Level (Reorder Threshold)
              </label>
              <input
                type="number"
                value={receiptForm.minLevel || ''}
                onChange={(e) => setReceiptForm({ ...receiptForm, minLevel: e.target.value })}
                placeholder="e.g. 10"
                style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', color: '#0F172A', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              />
            </div>



            {/* 10. Remarks / Notes */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontWeight: '700', color: '#334155', marginBottom: '7px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Remarks / Notes
              </label>
              <input
                type="text"
                value={receiptForm.remarks}
                onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })}
                placeholder="Enter any receiving notes..."
                style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', color: '#0F172A', outline: 'none', backgroundColor: '#F8FAFC', transition: 'all 0.15s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '20px', marginTop: '4px' }}>
            <button
              onClick={() => setAddStockActive(false)}
              style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '11px 22px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndConfirm}
              style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', borderRadius: '10px', padding: '11px 26px', fontSize: '13.5px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(14, 116, 144, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#085D75'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
            >
              <CheckCircle size={16} /> Save & Update Stock
            </button>
          </div>

        </div>

      </div>
    );
  }

  const isRawMaterialDirectory = activeTab === 'Raw Material Directory' || (activeTab && activeTab.toLowerCase().includes('raw material'));

  const pageConfig = {
    title: isRawMaterialDirectory ? 'Raw Material Directory' : 'Inventory Stores',
    subtitle: isRawMaterialDirectory
      ? 'Master catalog of raw aluminum coils, extrusions, raw lengths, and raw material stock balances'
      : 'Finished goods warehouse store, manufactured solar mounting products, and ready stock balances',
    actionText: 'Add Stock',
    searchPlaceholder: isRawMaterialDirectory
      ? 'Search Raw Materials (Material Code, Name, Category)...'
      : 'Search Inventory (Material Code, Description, Store)...',
    tabs: [
      { id: 'All', label: isRawMaterialDirectory ? 'All Raw Materials' : 'All Stock Items', count: filteredMaterials.length, bg: '#F1F5F9', fg: '#475569' },
      { id: 'Sufficient', label: 'Sufficient Stock', count: filteredMaterials.filter(m => m.status === 'In Stock').length, bg: '#F0FDF4', fg: '#15803D' },
      { id: 'Warning', label: 'Reorder Warning', count: filteredMaterials.filter(m => m.status === 'Low Stock').length, bg: '#FFF7ED', fg: '#C2410C' },
      { id: 'Critical', label: 'Critical Shortage', count: filteredMaterials.filter(m => m.status === 'Out of Stock').length, bg: '#FEF2F2', fg: '#B91C1C' }
    ]
  };

  const displayedMaterials = filteredMaterials.filter(m => {
    if (selectedTab === 'Sufficient') return m.status === 'In Stock';
    if (selectedTab === 'Warning') return m.status === 'Low Stock';
    if (selectedTab === 'Critical') return m.status === 'Out of Stock';
    return true;
  });

  const totalPages = Math.ceil(displayedMaterials.length / pageSize) || 1;
  const currentMaterialsPage = displayedMaterials.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(currentMaterialsPage.map(m => m.code));
    } else {
      setSelectedRows([]);
    }
  };

  const handleToggleRow = (code) => {
    if (selectedRows.includes(code)) {
      setSelectedRows(selectedRows.filter(c => c !== code));
    } else {
      setSelectedRows([...selectedRows, code]);
    }
  };

  if (showAdjModal && selectedMat && !isSalesUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Top Header Card matching Create Work Order Page */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '18px 24px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          gap: '16px'
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>
              Stock Adjustment & Physical Audit Edit
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              Material Description: <strong style={{ color: '#0F172A' }}>{selectedMat.name}</strong> | Item Code: <strong style={{ color: '#2563EB' }}>{selectedMat.code}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdjModal(false)}
            style={{
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              marginLeft: 'auto'
            }}
          >
            Cancel & Return
          </button>
        </div>

        {/* Main Form Card */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '28px', maxWidth: '720px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', boxSizing: 'border-box' }}>
          
          {/* Item Header Banner */}
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Target Material</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{selectedMat.name} ({selectedMat.code})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Current Stock</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0E7490', marginTop: '2px' }}>{selectedMat.stock} {selectedMat.unit}</div>
            </div>
          </div>

          {/* Adjustment Type Selection */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>
              Adjustment Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setAdjType('Add')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: adjType === 'Add' ? '2px solid #16A34A' : '1px solid #E2E8F0',
                  backgroundColor: adjType === 'Add' ? '#F0FDF4' : '#FFFFFF',
                  color: adjType === 'Add' ? '#166534' : '#64748B',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                ➕ Add Stock (Physical Surplus)
              </button>
              <button
                type="button"
                onClick={() => setAdjType('Deduct')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: adjType === 'Deduct' ? '2px solid #DC2626' : '1px solid #E2E8F0',
                  backgroundColor: adjType === 'Deduct' ? '#FEF2F2' : '#FFFFFF',
                  color: adjType === 'Deduct' ? '#991B1B' : '#64748B',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                ➖ Deduct Stock (Shortage / Damage)
              </button>
            </div>
          </div>

          {/* Quantity Field */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>
              Adjustment Quantity ({selectedMat.unit})
            </label>
            <input
              type="number"
              placeholder={`Enter quantity to ${adjType === 'Add' ? 'add' : 'deduct'}...`}
              value={adjQty}
              onChange={(e) => setAdjQty(e.target.value)}
              style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 16px', fontSize: '15px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Reason / Remarks */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>
              Audit Reason / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Physical Audit Surplus, Damage Shortage, Scrapped..."
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              style={{ width: '100%', height: '44px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 16px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Live Calculation Preview */}
          {adjQty && !isNaN(adjQty) && (
            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '14px 18px', color: '#1E40AF', fontSize: '13px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Resulting New Physical Stock:</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#1D4ED8' }}>
                {adjType === 'Add' ? selectedMat.stock + Number(adjQty) : Math.max(0, selectedMat.stock - Number(adjQty))} {selectedMat.unit}
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowAdjModal(false)}
              style={{ padding: '12px 24px', border: '1px solid #CBD5E1', borderRadius: '10px', background: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#475569' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStockAdjustment}
              style={{ padding: '12px 28px', border: 'none', borderRadius: '10px', background: '#0E7490', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(14, 116, 144, 0.3)' }}
            >
              Confirm Stock Adjustment & Save Audit Trail
            </button>
          </div>

        </div>
      </div>
    );
  }

  // FULL PAGE VIEW 2: Item Audit Log & Production Traceability (Executive Dual-View Interface)
  if (showTxModal && selectedMat) {
    const isOut = selectedMat.status === 'Out of Stock';
    const isLow = selectedMat.status === 'Low Stock';
    const stBg = isOut ? '#FEF2F2' : isLow ? '#FFF7ED' : '#F0FDF4';
    const stFg = isOut ? '#B91C1C' : isLow ? '#C2410C' : '#15803D';
    const stBorder = isOut ? '1px solid #FEE2E2' : isLow ? '1px solid #FFEDD5' : '1px solid #DCFCE7';

    const physicalStockVal = Math.max(0, parseFloat(selectedMat.physicalStock !== undefined ? selectedMat.physicalStock : (selectedMat.stock !== undefined ? selectedMat.stock : (selectedMat.openingStock || 0))) || 0);
    const reservedVal = Math.max(0, parseFloat(selectedMat.reserved !== undefined ? selectedMat.reserved : (selectedMat.blockedForBom || 0)) || 0);
    const availableVal = Math.max(0, parseFloat(selectedMat.stock !== undefined ? selectedMat.stock : (physicalStockVal - reservedVal)) || 0);
    const minLevelVal = Math.max(0, parseFloat(selectedMat.minLevel !== undefined ? selectedMat.minLevel : (selectedMat.reorderLevel || 50)) || 50);

    const filteredLogs = itemAuditLogs.filter(log => {
      if (auditTypeFilter === 'OUTFLOW' && log.qty >= 0) return false;
      if (auditTypeFilter === 'INFLOW' && log.qty <= 0) return false;
      if (auditTypeFilter === 'BOM' && !String(log.type || '').startsWith('BOM')) return false;
      if (auditTypeFilter === 'GRN' && log.type !== 'GOODS_RECEIPT') return false;

      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase().trim();
        const str = `${log.referenceDoc} ${log.reason} ${log.typeName} ${log.user} ${log.role} ${log.source} ${log.salesPerson || ''} ${log.salesPersonFull || ''} ${log.salesPersonCode || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Top Breadcrumb & Actions Bar */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '16px 24px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          gap: '16px'
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
              <span>BUSINZ</span>
              <span>/</span>
              <span>{isRawMaterialDirectory ? 'Raw Material Directory' : 'Inventory Stores'}</span>
              <span>/</span>
              <span style={{ color: '#0E7490' }}>Item Audit Log & Traceability</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Item Audit Log & Production Traceability
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC' }}>
                Live Inventory Ledger
              </span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowTxModal(false)}
            style={{
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
          >
            <ArrowLeft size={16} /> Back to {isRawMaterialDirectory ? 'Raw Material Directory' : 'Inventory Stores'}
          </button>
        </div>

        {/* Executive Material Identity Banner & KPI Summary Cards */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {/* Material Identity Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: '#0E7490', color: '#FFFFFF', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px' }}>
                  {selectedMat.code}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {selectedMat.name}
                </h2>
                <span style={{ backgroundColor: stBg, color: stFg, border: stBorder, padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', minWidth: '6px', minHeight: '6px', borderRadius: '50%', backgroundColor: stFg, flexShrink: 0, display: 'inline-block' }}></span>
                  {selectedMat.status || 'In Stock'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#64748B', flexWrap: 'wrap' }}>
                <span>Category: <strong style={{ color: '#1E293B' }}>{selectedMat.cat || selectedMat.category || 'General'}</strong></span>
                <span>•</span>
                <span>UOM: <strong style={{ color: '#1E293B' }}>{selectedMat.unit || 'NOS'}</strong></span>
                <span>•</span>
                <span>Warehouse Location: <strong style={{ color: '#0E7490' }}>{selectedMat.store || 'Finished Goods Bay'}</strong></span>
                <span>•</span>
                <span>HSN Code: <strong style={{ color: '#1E293B' }}>{selectedMat.hsn || '7604'}</strong></span>
              </div>
            </div>

            {/* View Mode Toggle Switcher (Table vs Timeline) */}
            <div style={{ display: 'inline-flex', padding: '3px', backgroundColor: '#F1F5F9', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setAuditViewMode('table')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: auditViewMode === 'table' ? '#FFFFFF' : 'transparent',
                  color: auditViewMode === 'table' ? '#0F172A' : '#64748B',
                  boxShadow: auditViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                📋 Audit Ledger Table
              </button>
              <button
                type="button"
                onClick={() => setAuditViewMode('timeline')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: auditViewMode === 'timeline' ? '#FFFFFF' : 'transparent',
                  color: auditViewMode === 'timeline' ? '#0F172A' : '#64748B',
                  boxShadow: auditViewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                ⏱️ Activity Timeline
              </button>
            </div>
          </div>

          {/* 4 Executive Stock KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* KPI 1: Physical Stock Baseline */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Physical Warehouse Stock
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
                {(Number(physicalStockVal) || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                Physical count & opening balance baseline
              </div>
            </div>

            {/* KPI 2: Reserved for Orders */}
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Allocated / In Dispatch
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#D97706' }}>
                {reservedVal > 0 ? `-${(Number(reservedVal) || 0).toLocaleString()}` : '0'} <span style={{ fontSize: '13px', fontWeight: '600', color: '#B45309' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#92400E' }}>
                Blocked for confirmed sales BOMs
              </div>
            </div>

            {/* KPI 3: Live Available Stock */}
            <div style={{ backgroundColor: '#ECFEFF', border: '1.5px solid #0E7490', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 2px 6px rgba(14, 116, 144, 0.08)' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Live Available Free Stock
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0E7490' }}>
                {(Number(availableVal) || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#155E75', fontWeight: '600' }}>
                Ready for immediate sales dispatch booking
              </div>
            </div>

            {/* KPI 4: Minimum Threshold & Safety Buffer */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Min. Reorder Threshold
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#334155' }}>
                {(Number(minLevelVal) || 0).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: availableVal <= minLevelVal ? '#DC2626' : '#16A34A', fontWeight: '600' }}>
                {availableVal <= minLevelVal ? '⚠️ Below safety reorder level' : '✓ Stock is above minimum threshold'}
              </div>
            </div>

          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
            {/* Search input */}
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by document #, user, reason..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px 0 34px',
                  fontSize: '12.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {auditSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAuditSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `All Events (${itemAuditLogs.length})` },
                { id: 'OUTFLOW', label: 'Dispatches & Deductions' },
                { id: 'INFLOW', label: 'Receipts & Additions' },
                { id: 'BOM', label: 'Sales BOMs' },
                { id: 'GRN', label: 'GRN Inwarding' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAuditTypeFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: auditTypeFilter === f.id ? '1px solid #0E7490' : '1px solid #E2E8F0',
                    backgroundColor: auditTypeFilter === f.id ? '#ECFEFF' : '#FFFFFF',
                    color: auditTypeFilter === f.id ? '#0E7490' : '#64748B',
                    fontSize: '11.5px',
                    fontWeight: auditTypeFilter === f.id ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AUDIT LOG DATA DISPLAY: TABLE MODE OR TIMELINE MODE */}
        {auditViewMode === 'table' ? (
          /* ======================== 1. DETAILED AUDIT LEDGER TABLE ======================== */
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '150px' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '180px' }}>Event Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '130px' }}>Ref Document</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800' }}>Activity Description / Narrative</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', textAlign: 'right', width: '120px' }}>Impact Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', textAlign: 'center', width: '140px' }}>Stock Balance</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '180px' }}>Sales Owner / Authorized By</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '140px' }}>Warehouse Bay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Info size={28} style={{ color: '#CBD5E1' }} />
                          <strong style={{ color: '#475569', fontSize: '14px' }}>No audit transactions found</strong>
                          <span style={{ fontSize: '12px' }}>Try clearing the search query or adjusting the category filter.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const isAddition = log.qty > 0;
                      const isZero = log.qty === 0;
                      const qtyColor = isAddition ? '#16A34A' : isZero ? '#64748B' : '#DC2626';
                      const qtyBg = isAddition ? '#F0FDF4' : isZero ? '#F8FAFC' : '#FEF2F2';
                      const qtyBorder = isAddition ? '#DCFCE7' : isZero ? '#E2E8F0' : '#FEE2E2';

                      return (
                        <tr
                          key={log.id || idx}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                            transition: 'background-color 0.15s ease'
                          }}
                          className="table-row-hover"
                        >
                          {/* Date & Time */}
                          <td style={{ padding: '14px 16px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={13} style={{ color: '#94A3B8' }} />
                              <span>{log.timestamp}</span>
                            </div>
                          </td>

                          {/* Event Category Badge */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: log.typeBg || '#F1F5F9',
                              color: log.typeColor || '#334155',
                              border: `1px solid ${log.typeBorder || '#E2E8F0'}`,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {log.typeName || log.type}
                            </span>
                          </td>

                          {/* Reference Document */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              color: '#0F172A',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              fontFamily: 'monospace'
                            }}>
                              {log.referenceDoc}
                            </span>
                          </td>

                          {/* Activity Description */}
                          <td style={{ padding: '14px 16px', color: '#1E293B', lineHeight: '1.5', minWidth: '270px' }}>
                            <div style={{ fontWeight: '500' }}>{log.reason}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {log.source && (
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  Customer: <strong style={{ color: '#0F172A' }}>{log.source}</strong>
                                </span>
                              )}
                              {log.salesPerson && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#ECFEFF',
                                  color: '#0E7490',
                                  border: '1px solid #CFFAFE'
                                }}>
                                  <span>👤 Sales Person:</span>
                                  <strong style={{ color: '#155E75' }}>{log.salesPersonFull || log.salesPerson}</strong>
                                </span>
                              )}
                              {log.sourcePiNo && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  border: '1px solid #E2E8F0'
                                }}>
                                  Ref PI: {log.sourcePiNo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Impact Quantity */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: qtyBg,
                              color: qtyColor,
                              border: `1px solid ${qtyBorder}`,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              fontFamily: 'monospace',
                              display: 'inline-block'
                            }}>
                              {isAddition ? `+${(Number(log.qty) || 0).toLocaleString()}` : (Number(log.qty) || 0).toLocaleString()} {log.unit}
                            </span>
                          </td>

                          {/* Stock Balance Movement */}
                          <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#F1F5F9',
                              color: '#0F172A',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700'
                            }}>
                              {log.previousStock !== undefined ? (Number(log.previousStock) || 0).toLocaleString() : '—'} → <strong style={{ color: '#0E7490' }}>{log.newStock !== undefined ? (Number(log.newStock) || 0).toLocaleString() : (Number(availableVal) || 0).toLocaleString()}</strong>
                            </span>
                          </td>

                          {/* Sales Owner / Authorized By */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            {log.salesPerson ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ fontSize: '12px' }}>👤</span>
                                  <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px' }}>
                                    {log.salesPerson}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', marginTop: '2px' }}>
                                  {log.salesPersonCode ? `Sales Rep (${log.salesPersonCode})` : (log.role || 'Sales Department')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '12.5px' }}>
                                  {log.user || 'Production Head'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>
                                  {log.role || 'Production & Logistics'}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Warehouse Location */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12px' }}>
                            <span style={{ backgroundColor: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', fontWeight: '600' }}>
                              {log.location || selectedMat.store || 'Finished Goods Bay'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div style={{
              padding: '12px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12.5px',
              color: '#64748B'
            }}>
              <span>Showing <strong>{filteredLogs.length}</strong> of <strong>{itemAuditLogs.length}</strong> verified events</span>
              <span style={{ color: '#0E7490', fontWeight: '700' }}>Authoritative BUSINZ Material Traceability Trail</span>
            </div>
          </div>
        ) : (
          /* ======================== 2. VISUAL ACTIVITY TIMELINE ======================== */
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0F172A' }}>
                  Sequential Traceability Trail ({filteredLogs.length} Events)
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                  Chronological lifecycle progression from initial stock setup, supplier inwarding, to sales dispatch allocations.
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '4px 12px', borderRadius: '20px', border: '1px solid #CFFAFE' }}>
                {filteredLogs.length} Logged Events
              </span>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '26px', paddingLeft: '12px' }}>
              
              {/* Perfectly Centered Vertical Connector Line */}
              <div style={{
                position: 'absolute',
                top: '20px',
                bottom: '20px',
                left: '29px',
                width: '2px',
                backgroundColor: '#E2E8F0',
                zIndex: 1
              }}></div>

              {filteredLogs.map((log, idx) => {
                const isAddition = log.qty > 0;
                const isZero = log.qty === 0;
                const accentColor = log.typeColor || (isAddition ? '#16A34A' : '#DC2626');
                const avatarBg = log.typeBg || (isAddition ? '#F0FDF4' : '#FEF2F2');
                const avatarBorder = log.typeBorder || (isAddition ? '#DCFCE7' : '#FEE2E2');

                return (
                  <div key={log.id || idx} style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    
                    {/* Left Center Avatar */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: avatarBg,
                      border: `2px solid ${accentColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: accentColor }}>
                        {isAddition ? '+' : (isZero ? '•' : '−')}
                      </span>
                    </div>

                    {/* Right Timeline Card */}
                    <div style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px 22px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      borderLeft: `4px solid ${accentColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: log.typeBg || '#F1F5F9',
                            color: log.typeColor || '#334155',
                            border: `1px solid ${log.typeBorder || '#E2E8F0'}`,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {log.typeName || log.type}
                          </span>
                          <span style={{
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F172A',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            fontFamily: 'monospace'
                          }}>
                            {log.referenceDoc}
                          </span>
                          {log.salesPerson ? (
                            <span style={{
                              fontSize: '11.5px',
                              backgroundColor: '#ECFEFF',
                              border: '1px solid #A5F3FC',
                              color: '#0E7490',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <span>👤 Sales Person:</span>
                              <strong style={{ color: '#155E75' }}>{log.salesPersonFull || log.salesPerson}</strong>
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Authorized by: <strong style={{ color: '#0F172A' }}>{log.user}</strong> ({log.role})
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                          <Calendar size={13} />
                          <span>{log.timestamp}</span>
                        </div>
                      </div>

                      {/* Narrative Reason */}
                      <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', fontWeight: '500' }}>
                        {log.reason}
                      </div>

                      {/* Movement Metric Banner */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px' }}>
                          <div>
                            <span style={{ color: '#64748B' }}>Baseline Before: </span>
                            <strong>{log.previousStock !== undefined ? (Number(log.previousStock) || 0).toLocaleString() : '—'} {log.unit}</strong>
                          </div>
                          <span>→</span>
                          <div>
                            <span style={{ color: '#64748B' }}>New Balance: </span>
                            <strong style={{ color: '#0E7490' }}>{log.newStock !== undefined ? (Number(log.newStock) || 0).toLocaleString() : (Number(availableVal) || 0).toLocaleString()} {log.unit}</strong>
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: isAddition ? '#F0FDF4' : '#FEF2F2',
                          color: isAddition ? '#166534' : '#991B1B',
                          border: isAddition ? '1px solid #DCFCE7' : '1px solid #FEE2E2',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '800',
                          fontFamily: 'monospace'
                        }}>
                          {isAddition ? `+${(Number(log.qty) || 0).toLocaleString()}` : (Number(log.qty) || 0).toLocaleString()} {log.unit}
                        </div>
                      </div>

                      {/* Footer entity info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748B', paddingTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Customer / Order: <strong style={{ color: '#0F172A' }}>{log.source || 'Warehouse Inventory Store'}</strong></span>
                        {log.salesPerson && (
                          <span style={{ backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CFFAFE', color: '#0E7490', fontWeight: '700' }}>
                            👤 Sales Person: <strong>{log.salesPersonFull || log.salesPerson}</strong>
                          </span>
                        )}
                        <span>Bay: <strong style={{ color: '#0E7490' }}>{log.location || selectedMat.store || 'Finished Goods Bay'}</strong></span>
                      </div>
                    </div>

                  </div>
                );
              })}

            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 1. TOP HEADER SECTION MATCHING CONTROLROOM DESIGN SYSTEM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
            {pageConfig.title}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            {pageConfig.subtitle}
          </span>
        </div>

        {!isSalesUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Hidden file input for Excel / CSV */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
            />

            {/* Upload File Button (Modern Sleek Enterprise Design) */}
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                height: '38px',
                padding: '0 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#0E7490';
                e.currentTarget.style.color = '#0E7490';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.color = '#0F172A';
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Upload size={14} strokeWidth={2.2} />
              </div>
              <span>Upload Files</span>
            </button>

            <button
              onClick={handleOpenAddStock}
              style={{
                backgroundColor: '#0E7490',
                border: '1px solid #0E7490',
                color: '#FFFFFF',
                height: '38px',
                padding: '0 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#085D75';
                e.currentTarget.style.borderColor = '#085D75';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0E7490';
                e.currentTarget.style.borderColor = '#0E7490';
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{pageConfig.actionText}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. FILTERS & SEARCH ROW CARD (EXACT MATCH FOR BOM & PO DESIGN) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '340px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search Inventory (Material Code, Description)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: 'white' }}>
            <Calendar style={{ width: '14px', height: '14px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="dd/mm/yyyy"
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', width: '90px', backgroundColor: 'transparent' }}
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
          >
            <option value="All Status">Status: All</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          <button
            onClick={() => { setSearchQuery(''); setSelectedStatus('All Status'); }}
            title="Clear Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. STATUS SUB-TABS ROW (EXACT MATCH FOR BOM & PO DESIGN) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        {pageConfig.tabs.map((tab) => {
          const isActive = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '10px 4px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: isActive ? '#2563eb' : '#64748b',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '12px',
                backgroundColor: tab.bg,
                color: tab.fg,
                fontWeight: 'bold'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN DATA TABLE (EXACT MATCH FOR BOM & PO DESIGN) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1150px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold' }}>
                <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    checked={currentMaterialsPage.length > 0 && selectedRows.length === currentMaterialsPage.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                  />
                </th>
                <th style={{ padding: '12px 14px', width: '140px', minWidth: '130px', fontWeight: 'bold', boxSizing: 'border-box' }}>Material Code</th>
                <th style={{ padding: '12px 14px', minWidth: '220px', fontWeight: 'bold', boxSizing: 'border-box' }}>Material Description</th>
                <th style={{ padding: '12px 14px', width: '130px', minWidth: '120px', fontWeight: 'bold', boxSizing: 'border-box' }}>Category</th>
                <th style={{ padding: '12px 14px', width: '80px', minWidth: '70px', fontWeight: 'bold', boxSizing: 'border-box' }}>UOM</th>
                <th style={{ padding: '12px 14px', width: '125px', minWidth: '115px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Available Stock</th>
                <th style={{ padding: '12px 14px', width: '105px', minWidth: '95px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Reserved</th>
                <th style={{ padding: '12px 14px', width: '115px', minWidth: '105px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Physical Stock</th>
                <th style={{ padding: '12px 14px', width: '95px', minWidth: '85px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Min. Level</th>
                <th style={{ padding: '12px 16px', width: '135px', minWidth: '135px', fontWeight: 'bold', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-rm-${i}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px' }}><div style={{ width: '90px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px' }}><div style={{ width: '180px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px' }}><div style={{ width: '80px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px' }}><div style={{ width: '50px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px', textAlign: 'right' }}><div style={{ width: '60px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', marginLeft: 'auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px', textAlign: 'right' }}><div style={{ width: '50px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', marginLeft: 'auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px', textAlign: 'right' }}><div style={{ width: '50px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', marginLeft: 'auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px', textAlign: 'right' }}><div style={{ width: '40px', height: '16px', borderRadius: '6px', backgroundColor: '#E2E8F0', marginLeft: 'auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                    <td style={{ padding: '14px 16px', width: '135px', textAlign: 'center', boxSizing: 'border-box' }}><div style={{ width: '85px', height: '22px', borderRadius: '12px', backgroundColor: '#E2E8F0', margin: '0 auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
                  </tr>
                ))
              ) : currentMaterialsPage.map((m, idx) => {
                const isSelected = selectedRows.includes(m.code);
                const isOut = m.status === 'Out of Stock';
                const isLow = m.status === 'Low Stock';

                const stBg = isOut ? '#FEF2F2' : isLow ? '#FFF7ED' : '#F0FDF4';
                const stFg = isOut ? '#B91C1C' : isLow ? '#C2410C' : '#15803D';
                const stBorder = isOut ? '1px solid #FEE2E2' : isLow ? '1px solid #FFEDD5' : '1px solid #DCFCE7';

                return (
                  <tr
                    key={m.code || idx}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#ECFEFF' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                    className={`table-row-hover ${isSelected ? 'selected-row' : ''}`}
                  >
                    <td style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box', borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(m.code)}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                      />
                    </td>
                    <td
                      onClick={() => {
                        if (isSalesUser) {
                          setSelectedCode(m.code);
                          setShowTxModal(true);
                        } else {
                          handleOpenStockAdj(m);
                        }
                      }}
                      title={isSalesUser ? `View ${m.code} Stock Details & Traceability` : `Edit / Adjust ${m.code}`}
                      style={{
                        padding: '12px 14px',
                        fontWeight: 'bold',
                        color: '#2563EB',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <span style={{ color: '#0E7490', fontWeight: '800' }}>{m.code}</span>
                    </td>
                    <td
                      title={m.name}
                      style={{
                        padding: '12px 14px',
                        fontWeight: '600',
                        color: '#1E293B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <strong style={{ color: '#0F172A' }}>{m.name}</strong> 
                    </td>
                    <td
                      title={m.cat}
                      style={{
                        padding: '12px 14px',
                        color: '#64748B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {m.cat}
                    </td>
                    <td
                      title={m.unit}
                      style={{
                        padding: '12px 14px',
                        color: '#64748B',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {m.unit}
                    </td>
                    {/* Available Stock */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: isOut ? '#B91C1C' : isLow ? '#C2410C' : '#0E7490' }}>
                        {(Number(m.availableStock !== undefined ? m.availableStock : (m.stock !== undefined ? m.stock : 0)) || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Reserved in Active BOMs */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {Number(m.reserved || 0) > 0 ? (
                        <span style={{ backgroundColor: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid #FDE68A' }}>
                          {Number(m.reserved).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '12px' }}>0</span>
                      )}
                    </td>

                    {/* In-Store Physical Stock Baseline */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {(Number(m.physicalStock !== undefined ? m.physicalStock : (m.openingStock !== undefined ? m.openingStock : 0)) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {(Number(m.minLevel !== undefined ? m.minLevel : (m.reorderLevel !== undefined ? m.reorderLevel : 0)) || 0).toLocaleString()}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 16px', width: '135px', minWidth: '135px', textAlign: 'center', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                      <span style={{ backgroundColor: stBg, color: stFg, border: stBorder, padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <span style={{ width: '6px', height: '6px', minWidth: '6px', minHeight: '6px', maxWidth: '6px', maxHeight: '6px', borderRadius: '50%', backgroundColor: stFg, flexShrink: 0, display: 'inline-block' }}></span>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. STRICT RULE 6 PAGINATION FOOTER */}
        <div style={{ padding: '12px 20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
          {/* Left side: Showing per page selector (5, 10) + entries info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Showing per page</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                style={{ height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#0F172A', cursor: 'pointer' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>| Showing {Math.min((currentPage - 1) * pageSize + 1, displayedMaterials.length)} to {Math.min(currentPage * pageSize, displayedMaterials.length)} of {displayedMaterials.length} entries</span>
          </div>

          {/* Right side: 3-Page Window Pagination Adjacent to Go to page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: '6px', width: '28px', height: '28px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>«</button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: '6px', width: '28px', height: '28px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>‹</button>

            {(() => {
              let start = Math.max(1, currentPage - 1);
              if (start + 2 > totalPages) {
                start = Math.max(1, totalPages - 2);
              }
              const pagesToShow = [];
              for (let i = start; i <= Math.min(totalPages, start + 2); i++) {
                pagesToShow.push(i);
              }
              return pagesToShow.map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    border: currentPage === p ? '1px solid #0E7490' : '1px solid #E2E8F0',
                    background: currentPage === p ? '#ECFEFF' : 'white',
                    color: currentPage === p ? '#0E7490' : '#475569',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ));
            })()}

            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: '6px', width: '28px', height: '28px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>›</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: '6px', width: '28px', height: '28px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>»</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
              <span>Go to page</span>
              <input
                type="number"
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                placeholder={currentPage.toString()}
                style={{ width: '45px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', textAlign: 'center', fontSize: '12px', outline: 'none' }}
              />
              <button
                onClick={() => {
                  const p = parseInt(goToPageInput);
                  if (p >= 1 && p <= totalPages) setCurrentPage(p);
                  setGoToPageInput('');
                }}
                style={{ border: '1px solid #0E7490', background: '#0E7490', color: 'white', borderRadius: '6px', padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Go ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING SELECTION TOOLBAR MATCHING STANDARD PURCHASE ORDERS & BOM DESIGN */}
      {selectedRows.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10000,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px' }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          <button
            onClick={() => {
              if (selectedRows.length > 0) {
                setSelectedCode(selectedRows[0]);
                setShowTxModal(true);
              }
            }}
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Info size={14} /> Info
          </button>

          {!isSalesUser && (
            <>
              <button
                onClick={() => {
                  if (selectedRows.length > 1) {
                    alert('You cannot edit multiple items at once.');
                  } else if (selectedRows.length === 1) {
                    const targetCode = selectedRows[0];
                    const targetMat = materials.find(m => m.code === targetCode) || { code: targetCode, name: targetCode };
                    handleOpenStockAdj(targetMat);
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#1E293B',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
              >
                <Edit3 size={14} style={{ color: '#64748B' }} /> Edit / Adjust
              </button>

              <button
                onClick={() => {
                  const items = materials.filter(m => selectedRows.includes(m.code));
                  setItemsPendingDelete(items.length > 0 ? items : selectedRows.map(c => ({ code: c, name: c })));
                  setShowDeleteModal(true);
                }}
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#EF4444',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
              >
                <Trash2 size={14} style={{ color: '#EF4444' }} /> Delete
              </button>
            </>
          )}

          <button
            onClick={() => setSelectedRows([])}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* CUSTOM CONTROLROOM DESIGN DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '460px',
            width: '92%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            boxSizing: 'border-box'
          }}>
            {/* Top Header with Circular Red Warning Badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(220, 38, 38, 0.15)'
              }}>
                <Trash2 size={24} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
                  {itemsPendingDelete.length > 1
                    ? `Delete ${itemsPendingDelete.length} Materials`
                    : 'Delete Raw Material'}
                </h3>
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: '500' }}>
                  This item will be removed from your active stock register.
                </span>
              </div>
            </div>

            {/* Items Preview Box */}
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              {itemsPendingDelete.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: i < itemsPendingDelete.length - 1 ? '1px solid #EEF2F6' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.name || item.code}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                      Code: {item.code}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}>
                    {item.stock !== undefined ? `${item.stock} ${item.unit || ''}` : 'Active'}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '12.5px', color: '#64748B', lineHeight: '1.45', margin: '0 0 24px 0' }}>
              Are you sure you want to proceed? Once confirmed, this material will be deleted from the Directory.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemsPendingDelete([]);
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const codesToDelete = itemsPendingDelete.map(item => item.code);
                  const currentDeleted = getDeletedMaterialCodes();
                  const newDeleted = Array.from(new Set([...currentDeleted, ...codesToDelete]));
                  try {
                    localStorage.setItem('controlroom_deleted_raw_materials', JSON.stringify(newDeleted));
                  } catch (e) {}

                  const updatedMaterials = materials.filter(m => !codesToDelete.includes(m.code));
                  setMaterials(updatedMaterials);
                  setSelectedRows(prev => prev.filter(code => !codesToDelete.includes(code)));
                  try {
                    localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedMaterials));
                  } catch (e) {}

                  // Notify engine inventory listeners
                  window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update'));

                  setShowDeleteModal(false);
                  setItemsPendingDelete([]);
                  if (typeof showCustomAlert === 'function') {
                    showCustomAlert(
                      `${codesToDelete.length} material item(s) deleted successfully.`,
                      'Item Deleted',
                      'success'
                    );
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. UPLOAD FILES MODAL (MATCHING USER REFERENCE DESIGN EXACTLY) */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif",
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '24px',
            maxWidth: '480px',
            width: '92%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>

            {/* Header matching image: [Upload Icon Box]  Upload Files  /  Select files to upload  [X Close button] */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  border: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0F172A',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <Upload size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Upload Files
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0', fontWeight: '500' }}>
                    Select files to upload
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            {/* Drag and drop dropzone with dashed border matching image */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer && e.dataTransfer.files) {
                  handleFilesSelected(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                border: isDragOver ? '2px dashed #0E7490' : '1.5px dashed #CBD5E1',
                borderRadius: '16px',
                backgroundColor: isDragOver ? '#F0FDFA' : '#F8FAFC',
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Cloud upload icon inside white card */}
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <UploadCloud size={20} strokeWidth={2.2} />
              </div>

              <div>
                <div style={{ fontSize: '13.5px', color: '#1E293B', fontWeight: '600' }}>
                  Drag and drop file(s) or <span style={{ color: '#4F46E5', fontWeight: '700' }}>choose file(s)</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  Max 25MB each, Only XLSX, CSV, ZIP, PDF, or IMAGES.
                </div>
              </div>
            </div>

            {/* File Upload List Cards matching image design */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '2px' }}>
              {uploadFilesQueue.length === 0 ? (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  borderRadius: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                  fontSize: '12.5px',
                  color: '#94A3B8'
                }}>
                  No files added yet. Drop your Excel or CSV files here to import.
                </div>
              ) : (
                uploadFilesQueue.map((item) => {
                  const ext = item.name.split('.').pop().toLowerCase();
                  const isZip = ext === 'zip' || ext === 'rar' || ext === '7z';
                  const isExcel = ext === 'xlsx' || ext === 'xls' || ext === 'csv';
                  const isHeic = ext === 'heic' || ext === 'png' || ext === 'jpg' || ext === 'jpeg';

                  // Badge color configs matching user image
                  const badgeBg = isZip ? '#FF9800' : isExcel ? '#10B981' : isHeic ? '#2563EB' : '#64748B';
                  const badgeText = ext.toUpperCase().slice(0, 4);

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Left File Type Badge Icon */}
                        <div style={{
                          width: '36px',
                          height: '42px',
                          borderRadius: '8px',
                          backgroundColor: badgeBg,
                          color: '#FFFFFF',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>{badgeText}</span>
                        </div>

                        {/* Center Info: File Name, Status, and Size */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13.5px',
                            fontWeight: '700',
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.name}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '3px' }}>
                            {item.status === 'completed' ? (
                              <>
                                <div style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10B981',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#FFFFFF'
                                }}>
                                  <Check size={9} strokeWidth={3} />
                                </div>
                                <span style={{ color: '#475569', fontWeight: '600' }}>Completed</span>
                                <span style={{ color: '#94A3B8' }}>•</span>
                                <span style={{ color: '#94A3B8' }}>{formatFileSize(item.size)}</span>
                                {item.count && (
                                  <span style={{ color: '#0E7490', fontWeight: '700', marginLeft: '4px' }}>
                                    ({item.count} items imported)
                                  </span>
                                )}
                              </>
                            ) : item.status === 'error' ? (
                              <span style={{ color: '#EF4444', fontWeight: '600' }}>
                                {item.errorMsg || 'Failed to import'}
                              </span>
                            ) : (
                              <>
                                <span style={{ color: '#6366F1', fontWeight: '600' }}>Uploading</span>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  border: '2px solid #C7D2FE',
                                  borderTopColor: '#6366F1',
                                  animation: 'spin 0.8s linear infinite'
                                }} />
                                <span style={{ color: '#6366F1', fontWeight: '600' }}>{item.progress}%</span>
                                <span style={{ color: '#94A3B8' }}>•</span>
                                <span style={{ color: '#94A3B8' }}>{formatFileSize(item.size)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Action Icons: Trash for completed / Pause-cancel for in progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.status === 'completed' ? (
                            <button
                              type="button"
                              onClick={() => setUploadFilesQueue(prev => prev.filter(f => f.id !== item.id))}
                              title="Remove file"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Pause"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#64748B',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}
                              >
                                <Pause size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setUploadFilesQueue(prev => prev.filter(f => f.id !== item.id))}
                                title="Cancel"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#64748B',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Progress bar matching image */}
                      {item.status === 'uploading' && (
                        <div style={{
                          width: '100%',
                          height: '4px',
                          borderRadius: '4px',
                          backgroundColor: '#E2E8F0',
                          overflow: 'hidden',
                          marginTop: '2px'
                        }}>
                          <div style={{
                            width: `${item.progress}%`,
                            height: '100%',
                            backgroundColor: '#6366F1',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Done / Close footer button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{
                  backgroundColor: '#0E7490',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
                }}
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};


export { WorkOrdersView };
export default RawMaterialInventoryView;
