import { VRM_PRODUCTS, resolveProductCode, wordFingerprint, normalizeProductName } from './vrmProductsData.js';
import { centralInventoryStore } from './centralInventoryStore.js';

/**
 * Product Catalog & Live Stock Service
 * Provides the unified, full 285+ standardized VRM products catalog
 * combined with real-time stock balances from Central Inventory Store and Zoho Books.
 */
export const getFullProductsCatalogWithStock = (directItems = null) => {
  // 1. Build live stock map from Central Inventory Store
  const stockMap = new Map();
  const rawStoreMap = new Map();

  try {
    const centralItems = centralInventoryStore.getInventoryItems();
    if (Array.isArray(centralItems)) {
      centralItems.forEach(ci => {
        const resCode = resolveProductCode(ci);
        const codeKey = String(resCode || ci.code || '').toLowerCase().trim();
        const origCode = String(ci.code || '').toLowerCase().trim();
        const nameKey = String(ci.name || '').toLowerCase().trim();
        const normKey = normalizeProductName(ci.name);
        const fpKey = wordFingerprint(ci.name);
        const st = ci.available !== undefined 
          ? Number(ci.available) 
          : (ci.onHand !== undefined ? Number(ci.onHand) : Number(ci.stock !== undefined ? ci.stock : 0));
        
        if (codeKey) stockMap.set(codeKey, st);
        if (origCode) stockMap.set(origCode, st);
        if (nameKey) stockMap.set(nameKey, st);
        if (normKey) stockMap.set(normKey, st);
        if (fpKey) stockMap.set(fpKey, st);
      });
    }
  } catch (e) {
    console.warn('[CATALOG] Central store stock query notice:', e.message);
  }

  // Also check raw materials store from localStorage for live inventory store stock
  let parsedRawMats = [];
  try {
    const rawSaved = localStorage.getItem('controlroom_raw_materials_store');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (Array.isArray(parsed)) {
        parsedRawMats = parsed;
        parsed.forEach(rm => {
          const resCode = resolveProductCode(rm);
          const codeKey = String(resCode || rm.code || rm.sku || rm.itemId || '').toLowerCase().trim();
          const origCode = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().trim();
          const nameKey = String(rm.name || '').toLowerCase().trim();
          const normKey = normalizeProductName(rm.name);
          const fpKey = wordFingerprint(rm.name);
          const st = Number(rm.stock !== undefined ? rm.stock : (rm.availableStock !== undefined ? rm.availableStock : (rm.physicalStock || 0)));
          if (codeKey) rawStoreMap.set(codeKey, st);
          if (origCode) rawStoreMap.set(origCode, st);
          if (nameKey) rawStoreMap.set(nameKey, st);
          if (normKey) rawStoreMap.set(normKey, st);
          if (fpKey) rawStoreMap.set(fpKey, st);
        });
      }
    }
  } catch (_) {}

  // 2. Map all 285 VRM standardized products with true live inventory stock
  const catalogMap = new Map();

  (VRM_PRODUCTS || []).forEach(p => {
    const resCode = resolveProductCode(p).toLowerCase().trim();
    const codeKey = String(resCode || p.code || '').toLowerCase().trim();
    const nameKey = String(p.name || '').toLowerCase().trim();
    const normKey = normalizeProductName(p.name);
    const fpKey = wordFingerprint(nameKey);

    // Live stock balance lookup:
    // 1. Raw materials store (Authoritative inventory store)
    // 2. Central inventory store
    // 3. 0 baseline
    let realStock = null;
    let baseStock = 0;

    const findInStore = (store) => {
      if (codeKey && store.has(codeKey)) return Number(store.get(codeKey));
      if (normKey && store.has(normKey)) return Number(store.get(normKey));
      if (nameKey && store.has(nameKey)) return Number(store.get(nameKey));
      if (fpKey && store.has(fpKey)) return Number(store.get(fpKey));
      return null;
    };

    const rawBal = findInStore(rawStoreMap);
    const centralBal = findInStore(stockMap);

    if (rawBal !== null && !isNaN(rawBal)) {
      realStock = Math.max(0, rawBal);
      baseStock = realStock;
    } else if (centralBal !== null && !isNaN(centralBal)) {
      realStock = Math.max(0, centralBal);
      baseStock = realStock;
    } else {
      realStock = 0;
      baseStock = 0;
    }

    const itemRecord = {
      code: p.code || '',
      name: p.name || '',
      category: p.material || p.category || 'Structure Assembly',
      uom: p.uom || 'NOS',
      rate: String(p.price || p.rate || '0'),
      price: String(p.price || p.rate || '0'),
      gstRate: p.gst || '18%',
      stock: realStock,
      availableStock: realStock,
      physicalStock: baseStock,
      reservedStock: 0
    };

    const itemKey = codeKey || nameKey;
    catalogMap.set(itemKey, itemRecord);
    if (nameKey && !catalogMap.has(nameKey)) {
      catalogMap.set(nameKey, itemRecord);
    }
  });


  // 3. Include any items from Zoho, custom item store, or raw materials store
  const mergeExtraItems = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach(ci => {
      const rawCode = String(ci.code || ci.sku || ci.itemId || ci.id || '').trim();
      const nameKey = String(ci.name || '').toLowerCase().trim();
      const resCode = resolveProductCode(ci);
      const itemKey = rawCode ? rawCode.toLowerCase() : nameKey;
      const lookupCode = (rawCode || resCode || '').toLowerCase();

      let realStock = 0;
      if (lookupCode && rawStoreMap.has(lookupCode)) realStock = rawStoreMap.get(lookupCode);
      else if (lookupCode && stockMap.has(lookupCode)) realStock = stockMap.get(lookupCode);
      else if (nameKey && rawStoreMap.has(nameKey)) realStock = rawStoreMap.get(nameKey);
      else if (nameKey && stockMap.has(nameKey)) realStock = stockMap.get(nameKey);
      else realStock = Number(ci.stock !== undefined ? ci.stock : (ci.availableStock !== undefined ? ci.availableStock : (ci.physicalStock || 0)));

      if (itemKey) {
        const existing = catalogMap.get(itemKey);
        if (!existing) {
          catalogMap.set(itemKey, {
            code: rawCode || ci.code || ci.sku || resCode || '',
            name: ci.name,
            category: ci.category || ci.cat || ci.description || 'Raw Material',
            uom: ci.uom || ci.unit || 'NOS',
            rate: String(ci.rate || ci.price || '0'),
            price: String(ci.rate || ci.price || '0'),
            gstRate: ci.gstRate || ci.gst || '18%',
            stock: realStock,
            availableStock: realStock
          });
        } else {
          if (ci.rate || ci.price) {
            existing.rate = String(ci.rate || ci.price || existing.rate);
            existing.price = existing.rate;
          }
          if (realStock !== undefined && !isNaN(realStock)) {
            existing.stock = realStock;
            existing.availableStock = realStock;
          }
        }
      }
    });
  };

  if (Array.isArray(parsedRawMats) && parsedRawMats.length > 0) {
    mergeExtraItems(parsedRawMats);
  }

  if (Array.isArray(directItems) && directItems.length > 0) {
    mergeExtraItems(directItems);
  }

  try {
    const customItemsStr = localStorage.getItem('controlroom_items_list');
    if (customItemsStr) {
      mergeExtraItems(JSON.parse(customItemsStr));
    }
  } catch (_) {}

  // Deduplicate items so fullList only contains unique items
  const uniqueItemsMap = new Map();
  for (const it of catalogMap.values()) {
    const uKey = String(it.code || it.name || '').toLowerCase().trim();
    if (uKey && !uniqueItemsMap.has(uKey)) {
      uniqueItemsMap.set(uKey, it);
    }
  }
  const fullList = Array.from(uniqueItemsMap.values());

  // Save to localStorage so other modules also have the full catalog ready
  try {
    localStorage.setItem('controlroom_items_list', JSON.stringify(fullList));
  } catch (_) {}

  return fullList;
};
