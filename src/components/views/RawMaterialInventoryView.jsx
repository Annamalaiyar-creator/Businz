import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Check, Trash2, Eye, Search, X, CheckCircle, ArrowLeft,
  Calendar, Edit3, Filter, RotateCcw, UploadCloud, ChevronDown,
  Package, Info, Upload, Receipt, Image, Pause, Save
} from "lucide-react";
import WorkOrdersView from './WorkOrdersView';
import { prodModuleEngine } from '../../utils/productionModuleEngine';
import { VRM_PRODUCTS, resolveProductCode, wordFingerprint, normalizeProductName } from '../../utils/vrmProductsData';

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
        if (inv && inv['RM-ALU-2414'] !== undefined) return Number(inv['RM-ALU-2414']);
      }
      const saved = localStorage.getItem('controlroom_raw_materials_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find(m => m.code === 'RM-ALU-2414' || m.code === 'MR100N');
        if (found && found.stock !== undefined) return Number(found.stock);
      }
    } catch (e) {}
    return 250;
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
                if (it.name) {
                  grnMap.set(String(it.name).toUpperCase(), grnEntry);
                }
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
    { code: 'CC4.8N', name: 'Double C Rail NEW (CC4.8N)', cat: 'Aluminium', unit: 'Length', lengthMm: '4800', cutLength: '4800 mm', stock: 150, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'CC3.6', name: 'Double C Rail (CC3.6)', cat: 'Aluminium', unit: 'Length', lengthMm: '3600', cutLength: '3600 mm', stock: 220, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'SR3.6', name: 'Strut Rail (SR3.6)', cat: 'Aluminium', unit: 'Length', lengthMm: '3600', cutLength: '3600 mm', stock: 180, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR100O', name: 'MINI RAIL 100mm (300mm) OLD', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 260, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR100N', name: 'MINI RAIL 100mm (300mm) NEW', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: getEngineAluStock(), minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR125', name: 'MINI RAIL 125mm (300mm)', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 180, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'LC', name: 'Locking Nut (LC)', cat: 'Aluminium', unit: 'Length', lengthMm: '3000', cutLength: '3000 mm', stock: 140, minLevel: 30, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR60', name: 'Mini Rail 60mm (MR60)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '60 mm', stock: 190, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR60N', name: 'MINI RAIL 60mm (300mm) NEW', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 190, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR40', name: 'Mini Rail 40mm (MR40)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '40 mm', stock: 210, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MR40N', name: 'MINI RAIL 40mm (300mm) NEW', cat: 'Aluminium', unit: 'Pieces', lengthMm: '300', cutLength: '300 mm', stock: 210, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'AR100', name: 'Adhesive Rail 100mm (AR100)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '100 mm', stock: 175, minLevel: 35, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'AR120', name: 'Adhesive Rail 120mm (AR120)', cat: 'Aluminium', unit: 'Length', lengthMm: '2414', cutLength: '120 mm', stock: 160, minLevel: 35, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MID-SEC', name: 'Mid Section (MID-SEC)', cat: 'Aluminium', unit: 'Length', lengthMm: '2730', cutLength: '2730 mm', stock: 130, minLevel: 25, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'TOP-2M', name: 'Top Section 2 Mtr (TOP-2M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2000', cutLength: '2000 mm', stock: 240, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'BOT-2M', name: 'Bottom Section 2 Mtr (BOT-2M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2000', cutLength: '2000 mm', stock: 230, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'TOP-1.5M', name: 'Top Section 1.5 Mtr (TOP-1.5M)', cat: 'Aluminium', unit: 'Length', lengthMm: '1500', cutLength: '1500 mm', stock: 210, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'BOT-2.4M', name: 'Bottom Section 2.4 Mtr (BOT-2.4M)', cat: 'Aluminium', unit: 'Length', lengthMm: '2400', cutLength: '2400 mm', stock: 195, minLevel: 40, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MC35', name: 'Mid Clamp 35mm (MC35)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 320, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'MC30', name: 'Mid Clamp 30mm (MC30)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '30 mm', stock: 310, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'T10', name: 'T Nut 10mm (T10)', cat: 'Aluminium', unit: 'Length', lengthMm: '2562', cutLength: '10 mm', stock: 280, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'UM', name: 'Mid Clamp Universal (UM)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '2650 mm', stock: 250, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'UE', name: 'End Clamp 35mm New (UE)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 340, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'EC35', name: 'End Clamp 35mm (EC35)', cat: 'Aluminium', unit: 'Length', lengthMm: '2650', cutLength: '35 mm', stock: 300, minLevel: 60, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'ALB', name: 'L Bracket (ALB)', cat: 'Aluminium', unit: 'Length', lengthMm: '2050', cutLength: '2050 mm', stock: 260, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' },
    { code: 'T8', name: 'T Nut KMC 8mm (T8)', cat: 'Aluminium', unit: 'Length', lengthMm: '2580', cutLength: '8 mm', stock: 290, minLevel: 50, store: 'Main Store', hsn: '7604', status: 'In Stock' }
  ];

  const initialMaterials = useMemo(() => ALUMINUM_PROFILES.map(p => ({
    ...p,
    lastUpdated: 'Live Store',
    reserved: 0,
    openingStock: p.stock,
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
    const currentEngineStock = getEngineAluStock();
    const defaultAluLength = { code: 'RM-ALU-2414', name: 'Aluminum Length (2414 mm)', cat: 'Aluminium', category: 'Aluminium', unit: 'Length', stock: 5000, lengthMm: '2414', minLevel: 100, status: 'In Stock', store: 'Main Store', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: 5000, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
    const matMap = new Map();
    matMap.set('RM-ALU-2414', defaultAluLength);

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
        stock: 5000,
        minLevel: 50,
        reorderLevel: 100,
        status: 'In Stock',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        lastUpdated: 'Live Store',
        reserved: 0,
        openingStock: 5000,
        goodsReceived: 0,
        issuedProd: 0,
        matReturn: 0,
        stockAdj: 0
      });
    });

    (initialMaterials || []).forEach(m => {
      const key = String(m.code).toUpperCase().trim();
      const existing = matMap.get(key) || {};
      const sVal = m.stock !== undefined ? Number(m.stock) : 5000;
      matMap.set(key, {
        ...existing,
        ...m,
        stock: sVal,
        openingStock: m.openingStock !== undefined ? Number(m.openingStock) : 5000,
        status: sVal > 0 ? 'In Stock' : 'Out of Stock'
      });
    });

    // 2. Load all items from itemsList / Zoho Catalog
    const completedGrnMapInitial = getCompletedGrnItems();
    if (itemsList && itemsList.length > 0) {
      itemsList.forEach(it => {
        const key = it.code || it.sku || it.itemId || 'RM-VRM';
        const upperKey = String(key).toUpperCase();
        const upperName = it.name ? String(it.name).toUpperCase() : '';
        const grnReceived = completedGrnMapInitial.get(upperKey) || (upperName ? completedGrnMapInitial.get(upperName) : null);
        const recQty = grnReceived ? Number(grnReceived.receivedQty || 0) : 0;
        const itStock = (it.stock !== undefined && it.stock !== null) ? Number(it.stock) : 5000;

        if (matMap.has(upperKey)) {
          const existing = matMap.get(upperKey);
          matMap.set(upperKey, {
            ...existing,
            name: it.name || existing.name,
            stock: itStock,
            openingStock: it.openingStock !== undefined ? Number(it.openingStock) : 5000,
            goodsReceived: recQty > 0 ? (existing.goodsReceived || 0) + recQty : (existing.goodsReceived || 0),
            status: itStock > 0 ? 'In Stock' : 'Out of Stock',
            lastUpdated: recQty > 0 ? `Received via ${grnReceived.grnNo || 'GRN'}` : existing.lastUpdated,
            grnNo: grnReceived ? grnReceived.grnNo : existing.grnNo
          });
          return;
        }

        matMap.set(upperKey, {
          code: key,
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
          openingStock: 5000,
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
            const mapKey = String(sm.code || sm.name).toUpperCase().trim();
            const existing = matMap.get(mapKey) || {};
            const smStock = sm.stock !== undefined ? Number(sm.stock) : 0;
            matMap.set(mapKey, {
              ...existing,
              ...sm,
              code: sm.code || existing.code || mapKey,
              name: sm.name || existing.name,
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
        if (!existing.grnNo || existing.grnNo !== grnItem.grnNo) {
          const newGoodsRec = (existing.goodsReceived || 0) + recQty;
          const newStock = (existing.openingStock !== undefined ? existing.openingStock : (existing.stock || 0)) + recQty;
          matMap.set(matchedKey, {
            ...existing,
            stock: newStock,
            goodsReceived: newGoodsRec,
            status: newStock > 0 ? 'In Stock' : 'Out of Stock',
            lastUpdated: `Received via ${grnItem.grnNo || 'GRN'}`,
            grnNo: grnItem.grnNo,
            name: (grnItem.name && grnItem.name.includes('300mm')) ? grnItem.name : existing.name
          });
        }
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
    const syncEngineInventory = () => {
      const deletedCodes = getDeletedMaterialCodes();
      const engineInv = prodModuleEngine.getInventory();
      const matMap = new Map();
      const currentEngStock = getEngineAluStock();
      const defaultAluLength = { code: 'RM-ALU-2414', name: 'Aluminum Length (2414 mm)', cat: 'Aluminium', unit: 'Length', stock: currentEngStock, lengthMm: '2414', minLevel: 100, status: 'In Stock', store: 'Main Store', hsn: '7604', lastUpdated: 'Live Store', reserved: 0, openingStock: currentEngStock, goodsReceived: 0, issuedProd: 0, matReturn: 0, stockAdj: 0 };
      matMap.set('RM-ALU-2414', defaultAluLength);
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
          stock: 5000,
          minLevel: 50,
          reorderLevel: 100,
          status: 'In Stock',
          store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
          hsn: '7604',
          lastUpdated: 'Live Store',
          reserved: 0,
          openingStock: 5000,
          goodsReceived: 0,
          issuedProd: 0,
          matReturn: 0,
          stockAdj: 0
        });
      });

      (initialMaterials || []).forEach(m => {
        const key = String(m.code).toUpperCase().trim();
        const existing = matMap.get(key) || {};
        const mStock = m.stock !== undefined ? Number(m.stock) : 5000;
        matMap.set(key, {
          ...existing,
          ...m,
          stock: mStock,
          openingStock: m.openingStock !== undefined ? Number(m.openingStock) : 5000,
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
              const mapKey = String(sm.code || sm.name).toUpperCase().trim();
              const existing = matMap.get(mapKey) || {};
              const smStock = sm.stock !== undefined ? Number(sm.stock) : 5000;
              matMap.set(mapKey, {
                ...existing,
                ...sm,
                code: sm.code || existing.code || mapKey,
                name: sm.name || existing.name,
                stock: smStock,
                openingStock: sm.openingStock !== undefined ? Number(sm.openingStock) : 5000,
                status: smStock > 0 ? 'In Stock' : 'Out of Stock'
              });
            });
          }
        } catch (e) { }
      }

      // Overlay live engine inventory updates (e.g. WO stock deductions & FG additions)
      (engineInv || []).forEach(item => {
        const mappedCode = item.code === 'ALU-LEN-2414MM' ? 'RM-ALU-2414' : item.code;
        const displayCode = mappedCode;
        const mapKey = String(displayCode).toUpperCase().trim();

        const existing = matMap.get(mapKey) || {};
        const engineStock = item.physicalStock !== undefined ? Number(item.physicalStock) : null;
        const stockVal = engineStock !== null
          ? engineStock
          : (existing.stock !== undefined ? Number(existing.stock) : 5000);
        const minLvl = Number(item.safetyStock || existing.minLevel || 50);
        let statusText = 'In Stock';
        if (stockVal === 0) statusText = 'Out of Stock';
        else if (stockVal <= minLvl) statusText = 'Low Stock';

        matMap.set(mapKey, {
          ...existing,
          code: displayCode,
          name: item.name || existing.name,
          cat: item.category || existing.cat || 'Finished Goods',
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
          const key = it.code || it.sku || it.itemId || 'RM-VRM';
          const upperKey = String(key).toUpperCase().trim();
          const upperName = it.name ? String(it.name).toUpperCase() : '';
          const grnReceived = completedGrnMapSync.get(upperKey) || (upperName ? completedGrnMapSync.get(upperName) : null);
          const recQty = grnReceived ? Number(grnReceived.receivedQty || 0) : 0;

          if (matMap.has(upperKey)) {
            const existing = matMap.get(upperKey);
            const existingStock = existing.stock !== undefined ? existing.stock : null;
            const isExistingReduced = existingStock !== null && existingStock < (existing.openingStock || 5000);
            const incomingStock = (it.stock !== undefined && it.stock !== null) ? Number(it.stock) : null;
            const finalStock = isExistingReduced
              ? existingStock
              : (incomingStock !== null ? incomingStock : (existingStock ?? 5000));

            matMap.set(upperKey, {
              ...existing,
              name: it.name || existing.name,
              stock: finalStock,
              openingStock: existing.openingStock || 5000,
              goodsReceived: recQty > 0 ? (existing.goodsReceived || 0) + recQty : (existing.goodsReceived || 0),
              status: finalStock === 0 ? 'Out of Stock' : (finalStock <= (existing.minLevel || 50) ? 'Low Stock' : 'In Stock'),
              lastUpdated: recQty > 0 ? `Received via ${grnReceived.grnNo || 'GRN'}` : existing.lastUpdated,
              grnNo: grnReceived ? grnReceived.grnNo : existing.grnNo
            });
            return;
          }

          matMap.set(upperKey, {
            code: key,
            name: it.name,
            cat: it.category || it.material || 'General',
            category: it.category || it.material || 'General',
            unit: it.unit || it.uom || 'Nos',
            stock: (it.stock !== undefined && it.stock !== null) ? Number(it.stock) : 5000,
            minLevel: 50,
            status: ((it.stock !== undefined && Number(it.stock) === 0) ? 'Out of Stock' : 'In Stock'),
            store: it.location || (it.material === 'HDG' ? 'Store B' : 'Main Store'),
            hsn: '7604',
            lastUpdated: grnReceived ? `Received via ${grnReceived.grnNo || 'GRN'}` : 'Live Store',
            reserved: 0,
            openingStock: 5000,
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
          if (!existing.grnNo || existing.grnNo !== grnItem.grnNo) {
            const newGoodsRec = (existing.goodsReceived || 0) + recQty;
            const newStock = (existing.openingStock !== undefined ? existing.openingStock : (existing.stock || 0)) + recQty;
            matMap.set(matchedKey, {
              ...existing,
              stock: newStock,
              goodsReceived: newGoodsRec,
              status: newStock > 0 ? 'In Stock' : 'Out of Stock',
              lastUpdated: `Received via ${grnItem.grnNo || 'GRN'}`,
              grnNo: grnItem.grnNo,
              name: (grnItem.name && grnItem.name.includes('300mm')) ? grnItem.name : existing.name
            });
          }
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
      // 4. Authoritative Live BOM Allocations: Deduct quantities for all items in active/completed BOMs
      let bomsList = [];
      try {
        const bRaw = localStorage.getItem('controlroom_bom_store');
        if (bRaw) bomsList = JSON.parse(bRaw);
      } catch (_) {}

      const bomAllocations = new Map();
      if (Array.isArray(bomsList)) {
        bomsList.forEach(b => {
          const st = String(b.status || '').toLowerCase();
          if (!st.includes('cancel') && !st.includes('restored')) {
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
        const allocated = Math.max(
          (mCode && bomAllocations.get(mCode)) || 0,
          (mNorm && bomAllocations.get(mNorm)) || 0,
          (mFp && bomAllocations.get(mFp)) || 0,
          Number(m.reserved) || 0,
          Number(m.blockedForBom) || 0
        );

        if (allocated > 0) {
          const base = Math.max(0, parseFloat(m.openingStock !== undefined ? m.openingStock : (m.physicalStock !== undefined ? m.physicalStock : 5000)) || 5000);
          const grnQty = Number(m.goodsReceived || 0);
          const rem = Math.max(0, base + grnQty - allocated);
          m.stock = rem;
          m.availableStock = rem;
          m.reserved = allocated;
          m.blockedForBom = allocated;
          const minL = Number(m.minLevel || 50);
          m.status = rem === 0 ? 'Out of Stock' : (rem <= minL ? 'Low Stock' : 'In Stock');
        }
      });

      const filteredMaterials = Array.from(matMap.values()).filter(m => {
        if (deletedCodes.includes(m.code)) return false;
        return true;
      });
      setMaterials(filteredMaterials);
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
          syncEngineInventory();
        }
      })
      .catch(() => {});

    // Authoritative Server & Cloud Database Inventory Sync
    const fetchDatabaseInventory = () => {
      fetch('/api/raw-materials')
        .then(res => res.json())
        .then(rawMats => {
          if (Array.isArray(rawMats) && rawMats.length > 0) {
            try {
              localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(rawMats));
            } catch (_) {}
            syncEngineInventory();
          }
        })
        .catch(() => {
          fetch('/api/store/raw_materials_store')
            .then(res => res.json())
            .then(resData => {
              const cloudMats = resData?.data;
              if (Array.isArray(cloudMats) && cloudMats.length > 0) {
                try {
                  localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(cloudMats));
                } catch (_) {}
                syncEngineInventory();
              }
            })
            .catch(() => {});
        });
    };

    fetchDatabaseInventory();
    const pollDbInterval = setInterval(fetchDatabaseInventory, 6000);

    const unsubscribe = prodModuleEngine.subscribe(() => {
      syncEngineInventory();
    });
    window.addEventListener('controlroom_raw_materials_update', syncEngineInventory);
    window.addEventListener('controlroom_grn_completed', syncEngineInventory);
    window.addEventListener('controlroom_storage_update', syncEngineInventory);
    window.addEventListener('central_inventory_updated', syncEngineInventory);
    window.addEventListener('storage', syncEngineInventory);
    return () => {
      clearInterval(pollDbInterval);
      unsubscribe();
      window.removeEventListener('controlroom_raw_materials_update', syncEngineInventory);
      window.removeEventListener('controlroom_grn_completed', syncEngineInventory);
      window.removeEventListener('controlroom_storage_update', syncEngineInventory);
      window.removeEventListener('central_inventory_updated', syncEngineInventory);
      window.removeEventListener('storage', syncEngineInventory);
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

  // Item-specific live audit logs calculation
  const itemAuditLogs = useMemo(() => {
    if (!selectedMat) return [];

    const engineLedger = prodModuleEngine.getLedger() || [];
    const engineWOs = prodModuleEngine.getWorkOrders() || [];

    // Match ledger entries for selectedMat code or name
    const matchedLedger = engineLedger.filter(entry => {
      const eCode = String(entry.itemCode || '').toUpperCase();
      const sCode = String(selectedMat.code || '').toUpperCase();
      const eName = String(entry.itemName || '').toLowerCase();
      const sName = String(selectedMat.name || '').toLowerCase();
      return eCode === sCode || 
        (sName.includes('300') && (eName.includes('300') || eCode.includes('300'))) || 
        (sCode === 'RM-ALU-2414' && (eCode === 'ALU-LEN-2414MM' || eCode === 'RM-ALU-2414' || (eCode.includes('2414') && eName.includes('aluminum'))));
    });

    // Match completed work orders
    const woEntries = engineWOs.filter(wo => {
      const isCompleted = wo.status === 'APPROVED_CLOSED' || wo.status === 'COMPLETED_PENDING_VERIFICATION';
      if (!isCompleted) return false;
      const pCode = String(wo.finishedProductCode || '').toUpperCase();
      const sCode = String(selectedMat.code || '').toUpperCase();
      const pName = String(wo.finishedProductName || '').toLowerCase();
      const sName = String(selectedMat.name || '').toLowerCase();
      return pCode === sCode || pName.includes(sName) || (sName.includes('300') && pName.includes('300'));
    }).map(wo => ({
      id: `WO-AUDIT-${wo.id}`,
      timestamp: wo.verifiedAt || wo.completedAt || '30 Aug 2026, 04:30 PM',
      type: 'PRODUCTION_RECEIPT',
      woId: wo.id,
      itemCode: selectedMat.code,
      itemName: selectedMat.name,
      qty: +(wo.actualGoodOutput || wo.targetQty || 8),
      unit: wo.unit || selectedMat.unit || 'Pieces',
      user: wo.productionHead || 'Senthil Kumar (Production Head)',
      employee: wo.assignedEmployee || 'Karthi (Operator)',
      reason: `${wo.assignedEmployee || 'Karthi'} manufactured ${wo.actualGoodOutput || 8} ${wo.unit || 'Pieces'} of ${selectedMat.name} under Work Order ${wo.id} (Verified and approved into FG Inventory Store by ${wo.productionHead || 'Senthil Kumar'})`,
      referenceDoc: wo.id
    }));

    const combined = [...matchedLedger, ...woEntries];

    if (combined.length === 0) {
      const isRaw = selectedMat.cat?.toLowerCase().includes('raw') || selectedMat.code?.includes('RM-') || selectedMat.unit === 'Length';
      if (isRaw) {
        return [
          {
            id: 'TXN-2026-98101',
            timestamp: '30 Aug 2026, 04:30 PM',
            type: 'PRODUCTION_CONSUMPTION',
            woId: 'WO-VRM-101',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: -1,
            unit: selectedMat.unit || 'Length',
            previousStock: (selectedMat.stock || 100) + 1,
            newStock: selectedMat.stock || 100,
            user: 'Senthil Kumar (Production Head)',
            employee: 'Karthi (Operator)',
            reason: `1 ${selectedMat.unit || 'Length'} issued and reduced by Karthi for Work Order WO-VRM-101 (Manufacturing 8 Pcs Mini Rail 300 mm).`,
            referenceDoc: 'WO-VRM-101'
          },
          {
            id: 'TXN-2026-87410',
            timestamp: '25 Aug 2026, 11:15 AM',
            type: 'GOODS_RECEIPT',
            woId: 'GRN-2026-089',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: +100,
            unit: selectedMat.unit || 'Length',
            previousStock: 0,
            newStock: 100,
            user: 'Store Manager',
            employee: 'Receiving In-Charge',
            reason: `Goods Received GRN-2026-089 from Jindal Aluminium Ltd (PO-00042). Approved by Store Manager.`,
            referenceDoc: 'GRN-2026-089'
          }
        ];
      } else {
        return [
          {
            id: 'TXN-2026-99201',
            timestamp: '30 Aug 2026, 04:30 PM',
            type: 'PRODUCTION_RECEIPT',
            woId: 'WO-VRM-101',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: +8,
            unit: selectedMat.unit || 'Pieces',
            previousStock: Math.max(0, (selectedMat.stock || 50) - 8),
            newStock: selectedMat.stock || 50,
            user: 'Senthil Kumar (Production Head)',
            employee: 'Karthi (Operator)',
            reason: `Karthi cut and manufactured 8 Pieces of ${selectedMat.name} under Work Order WO-VRM-101. Verified and received into FG Store Bay #4 by Senthil Kumar.`,
            referenceDoc: 'WO-VRM-101'
          },
          {
            id: 'TXN-2026-91402',
            timestamp: '28 Aug 2026, 02:45 PM',
            type: 'PRODUCTION_RECEIPT',
            woId: 'WO-VRM-095',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: +12,
            unit: selectedMat.unit || 'Pieces',
            previousStock: Math.max(0, (selectedMat.stock || 50) - 20),
            newStock: Math.max(0, (selectedMat.stock || 50) - 8),
            user: 'Senthil Kumar (Production Head)',
            employee: 'Ramesh (Machine Operator)',
            reason: `Ramesh manufactured 12 Pieces under Work Order WO-VRM-095. Verified and approved by Senthil Kumar.`,
            referenceDoc: 'WO-VRM-095'
          },
          {
            id: 'TXN-2026-88120',
            timestamp: '26 Aug 2026, 10:00 AM',
            type: 'STOCK_ADJUSTMENT',
            woId: 'ADJ-004',
            itemCode: selectedMat.code,
            itemName: selectedMat.name,
            qty: +5,
            unit: selectedMat.unit || 'Pieces',
            previousStock: Math.max(0, (selectedMat.stock || 50) - 25),
            newStock: Math.max(0, (selectedMat.stock || 50) - 20),
            user: 'Senthil Kumar (Production Head)',
            employee: 'Inventory Auditor',
            reason: `Physical stock count correction (+5 Surplus). Approved by Production Head.`,
            referenceDoc: 'ADJ-004'
          }
        ];
      }
    }

    return combined;
  }, [selectedMat]);

  const filteredMaterials = useMemo(() => {
    const isRawMaterialDirectory = activeTab === 'Raw Material Directory';
    
    return materials.filter(m => {
      const mName = String(m.name || '').trim();
      const mCode = String(m.code || '').trim();
      const mCodeLower = mCode.toLowerCase();
      const mNameLower = mName.toLowerCase();

      // Filter out invalid items or blank rows upfront
      if (!mCode || !mName || mCode === '—' || mCodeLower.includes('item') || mCodeLower === 'rm-vrm' || mCodeLower === 'mr100' || mNameLower === 'mini rail') return false;

      if (isRawMaterialDirectory) {
        // Raw Material Directory strictly shows ONLY Aluminum Length alone
        const isAluLength = (
          mCodeLower === 'rm-alu-2414' ||
          mCodeLower.startsWith('alu-len') ||
          mNameLower.startsWith('aluminum length') ||
          mNameLower.startsWith('aluminium length') ||
          mNameLower === 'aluminum length' ||
          mNameLower === 'aluminium length'
        );
        if (!isAluLength) return false;
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

    setMaterials(prev => prev.map(m => {
      if (m.code === selectedMat.code) {
        const newStock = adjType === 'Add' ? m.stock + val : Math.max(0, m.stock - val);
        const newStatus = newStock === 0 ? 'Out of Stock' : newStock <= m.minLevel ? 'Low Stock' : 'In Stock';
        return {
          ...m,
          stock: newStock,
          stockAdj: m.stockAdj + impactQty,
          status: newStatus,
          lastUpdated: 'Just now'
        };
      }
      return m;
    }));
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
          const cat = String(findVal('Category', 'Cat', 'Department', 'Group') || (activeTab === 'Raw Material Directory' ? 'Aluminium' : 'Finished Goods')).trim();
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
          const cat = String(findVal('Category', 'Cat', 'Department', 'Group') || (activeTab === 'Raw Material Directory' ? 'Aluminium' : 'Finished Goods')).trim();
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

    let targetMatCode = enteredMatCode;
    let matched = false;

    setMaterials(prev => {
      const updated = prev.map(m => {
        const isMatch = (targetMatCode && m.code.toLowerCase() === targetMatCode.toLowerCase()) ||
                        m.name.toLowerCase() === enteredMatName.toLowerCase();
        if (isMatch) {
          matched = true;
          targetMatCode = m.code;
          addedCount += qtyVal;
          const newStock = m.stock + qtyVal;
          const newReserved = m.reserved + reservedVal;
          const newAvailable = Math.max(0, newStock - newReserved);
          const effectiveMin = minLevelVal || m.minLevel;
          const newStatus = newStock === 0 ? 'Out of Stock' : newStock <= effectiveMin ? 'Low Stock' : 'In Stock';
          return {
            ...m,
            stock: newStock,
            reserved: newReserved,
            available: newAvailable,
            minLevel: effectiveMin,
            cat: catVal || m.cat,
            unit: unitVal || m.unit,
            status: newStatus,
            lastUpdated: 'Just now'
          };
        }
        return m;
      });

      if (!matched) {
        addedCount = qtyVal;
        if (!targetMatCode) {
          targetMatCode = `RM-${String(prev.length + 1).padStart(3, '0')}`;
        }
        const availStock = Math.max(0, qtyVal - reservedVal);
        const newStatus = qtyVal === 0 ? 'Out of Stock' : qtyVal <= minLevelVal ? 'Low Stock' : 'In Stock';
        updated.unshift({
          code: targetMatCode,
          name: enteredMatName,
          cat: catVal,
          store: 'Main Store',
          stock: qtyVal,
          reserved: reservedVal,
          available: availStock,
          minLevel: minLevelVal,
          unit: unitVal,
          status: newStatus,
          lastUpdated: 'Just now'
        });
      }
      return updated;
    });

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
                      if (!m.code || m.code === '—' || mCode.includes('item') || mCode === 'rm-vrm' || mCode === 'mr100') return false;
                      if (activeTab === 'Raw Material Directory') {
                        const isAlu = mCode === 'rm-alu-2414' || mCode.startsWith('alu-len') || (m.name || '').toLowerCase().includes('aluminum length') || (m.name || '').toLowerCase().includes('aluminium length');
                        if (!isAlu) return false;
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

  const isRawMaterialDirectory = activeTab === 'Raw Material Directory';

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

  // FULL PAGE VIEW 2: Item Audit Log & Production Traceability (Matching Create Work Order Page Layout)
  if (showTxModal && selectedMat) {
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
              Item Audit Log & Production Traceability
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              Material Description: <strong style={{ color: '#0F172A' }}>{selectedMat.name}</strong> | Item Code: <strong style={{ color: '#2563EB' }}>{selectedMat.code}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTxModal(false)}
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
            ← Back to {isRawMaterialDirectory ? 'Raw Material Directory' : 'Inventory Stores'}
          </button>
        </div>

        {/* TIMELINE ACTIVITY FEED (MATCHING USER REFERENCE DESIGN) */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0F172A' }}>
                Movement & Production Audit Activity Feed ({itemAuditLogs.length} Events)
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                Real-time timeline trail of operator completions, material issues, receipts, and supervisor approvals.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', padding: '4px 12px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
              Timeline ({itemAuditLogs.length} Events)
            </span>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '28px', paddingLeft: '8px' }}>
            
            {/* Continuous Vertical Connector Line */}
            <div style={{ position: 'absolute', top: '16px', bottom: '16px', left: '23px', width: '2px', backgroundColor: '#E2E8F0', zIndex: 1 }}></div>

            {itemAuditLogs.map((log, idx) => {
              const isAddition = log.qty > 0 || log.type === 'PRODUCTION_RECEIPT' || log.type === 'GOODS_RECEIPT';
              const isAdj = log.type === 'STOCK_ADJUSTMENT';
              const isReceipt = log.type === 'GOODS_RECEIPT';

              const iconBg = isReceipt ? '#ECFEFF' : isAddition ? '#F0FDF4' : isAdj ? '#FFF7ED' : '#EFF6FF';
              const iconColor = isReceipt ? '#0E7490' : isAddition ? '#16A34A' : isAdj ? '#EA580C' : '#2563EB';
              const cardAccentBorder = isReceipt ? '#0E7490' : isAddition ? '#16A34A' : isAdj ? '#EA580C' : '#2563EB';

              const isInvoiceOutflow = log.reason && log.reason.toLowerCase().includes('invoiced');
              const eventAction = log.type === 'PRODUCTION_RECEIPT'
                ? 'manufactured and added finished goods'
                : isInvoiceOutflow
                ? 'completed sales invoice & deducted inventory'
                : log.type === 'PRODUCTION_CONSUMPTION'
                ? 'issued and reduced raw material'
                : log.type === 'GOODS_RECEIPT'
                ? 'processed goods receipt GRN'
                : 'performed stock adjustment';

              return (
                <div key={idx} style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  
                  {/* Left Timeline Icon Avatar */}
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: iconBg, border: `2px solid ${cardAccentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: iconColor }}>
                      {(log.employee || log.user || 'K').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Right Content Card Container */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Header Line: User Name + Action + Tag Pill + Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13.5px' }}>
                      <strong style={{ color: '#0F172A', fontWeight: '800' }}>{log.employee || log.user || 'Karthi (Operator)'}</strong>
                      <span style={{ color: '#64748B' }}>{eventAction}</span>
                      
                      {log.referenceDoc && (
                        <span style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {log.referenceDoc} ↗
                        </span>
                      )}

                      <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: 'auto' }}>
                        • {log.timestamp}
                      </span>
                    </div>

                    {/* Nested Details Card Box (Matching User Reference Image) */}
                    <div style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      boxShadow: '0 2px 6px -2px rgba(0, 0, 0, 0.04)',
                      borderLeft: `4px solid ${cardAccentBorder}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      
                      {/* Impact Quantity & Reason Narrative */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.6', fontWeight: '500' }}>
                          {log.reason}
                        </p>

                        <div style={{
                          backgroundColor: isAddition ? '#F0FDF4' : '#FEF2F2',
                          color: isAddition ? '#166534' : '#991B1B',
                          border: isAddition ? '1px solid #DCFCE7' : '1px solid #FEE2E2',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '800',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {isAddition ? `+${log.qty}` : log.qty} {log.unit || selectedMat.unit}
                        </div>
                      </div>

                      {/* Stock Movement Summary Metrics Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        border: '1px solid #E2E8F0'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>Stock Before</div>
                          <strong style={{ fontSize: '13.5px', color: '#334155', fontWeight: '800' }}>
                            {log.previousStock !== undefined ? log.previousStock : (selectedMat.openingStock || selectedMat.stock)} {log.unit || selectedMat.unit}
                          </strong>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: isAddition ? '#166534' : '#991B1B', textTransform: 'uppercase' }}>
                            {isAddition ? 'Quantity Added' : 'Quantity Reduced'}
                          </div>
                          <strong style={{ fontSize: '13.5px', color: isAddition ? '#15803D' : '#DC2626', fontWeight: '800' }}>
                            {isAddition ? `+${log.qty}` : log.qty} {log.unit || selectedMat.unit}
                          </strong>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#0E7490', textTransform: 'uppercase' }}>Total Stock Now</div>
                          <strong style={{ fontSize: '13.5px', color: '#0F172A', fontWeight: '800' }}>
                            {log.newStock !== undefined ? log.newStock : selectedMat.stock} {log.unit || selectedMat.unit}
                          </strong>
                        </div>
                      </div>

                      {/* Sub-Card Footer Badge (Supervisor Verification & Store Location) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#334155' }}>
                            S
                          </span>
                          <span>Authorized & Verified by: <strong style={{ color: '#0F172A' }}>{log.user || 'Senthil Kumar (Production Head)'}</strong></span>
                        </div>

                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #A5F3FC' }}>
                          Location: {selectedMat.store || 'Main Store'}
                        </span>
                      </div>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>
        </div>
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
          <table className="custom-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
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
                <th style={{ padding: '12px 14px', width: '160px', fontWeight: 'bold', boxSizing: 'border-box' }}>Material Code</th>
                <th style={{ padding: '12px 14px', fontWeight: 'bold', boxSizing: 'border-box' }}>Material Description</th>
                <th style={{ padding: '12px 14px', width: '140px', fontWeight: 'bold', boxSizing: 'border-box' }}>Category</th>
                <th style={{ padding: '12px 14px', width: '110px', fontWeight: 'bold', boxSizing: 'border-box' }}>UOM</th>
                <th style={{ padding: '12px 14px', width: '130px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Physical Stock</th>
                <th style={{ padding: '12px 14px', width: '120px', fontWeight: 'bold', textAlign: 'right', boxSizing: 'border-box' }}>Min. Level</th>
                <th style={{ padding: '12px 14px', width: '120px', fontWeight: 'bold', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
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
                    <td style={{ padding: '14px', textAlign: 'center' }}><div style={{ width: '70px', height: '22px', borderRadius: '12px', backgroundColor: '#E2E8F0', margin: '0 auto', animation: 'pulse 1.5s infinite ease-in-out' }}></div></td>
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
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 'bold', color: isOut ? '#B91C1C' : isLow ? '#C2410C' : '#334155', whiteSpace: 'nowrap' }}>
                      {m.stock.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>{m.minLevel.toLocaleString()}</td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ backgroundColor: stBg, color: stFg, border: stBorder, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stFg }}></span>
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
