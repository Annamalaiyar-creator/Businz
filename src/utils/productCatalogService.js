import { resolveProductCode, wordFingerprint, normalizeProductName } from './vrmProductsData.js';
import { centralInventoryStore } from './centralInventoryStore.js';
import { getHsnCode } from './hsnCodeService.js';

const getDeletedCodes = () => {
  try {
    const raw = localStorage.getItem('controlroom_deleted_raw_materials');
    return raw ? JSON.parse(raw).map(c => String(c).toUpperCase().trim()) : [];
  } catch (_) {
    return [];
  }
};

let cachedBaseCatalog = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2000;

export const invalidateCatalogCache = () => {
  cachedBaseCatalog = null;
  lastCacheTime = 0;
};

if (typeof window !== 'undefined') {
  window.addEventListener('central_inventory_updated', invalidateCatalogCache);
  window.addEventListener('controlroom_items_update', invalidateCatalogCache);
  window.addEventListener('controlroom_raw_materials_update', invalidateCatalogCache);
}

let serverItemsCache = null;

export const syncFullCatalogFromBackend = async () => {
  try {
    const res = await fetch('/api/items', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        const deletedCodes = getDeletedCodes();
        const cleaned = data.filter(it => {
          const c = String(it.code || it.sku || it.itemId || it.id || '').toUpperCase().trim();
          const n = String(it.name || '').toUpperCase().trim();
          if (/^\d{10,}$/.test(c) || /^\d{10,}$/.test(n)) return false;
          return !deletedCodes.includes(c) && !deletedCodes.includes(n);
        });
        serverItemsCache = cleaned;
        try {
          localStorage.setItem('controlroom_item_store', JSON.stringify(cleaned));
        } catch (_) {}
        invalidateCatalogCache();
        try {
          window.dispatchEvent(new Event('central_inventory_updated'));
          window.dispatchEvent(new Event('controlroom_items_update'));
        } catch (_) {}
        return getFullProductsCatalogWithStock();
      }
    }
  } catch (_) {}
  return getFullProductsCatalogWithStock();
};

// Eager sync on client load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncFullCatalogFromBackend();
  }, 100);
}

/**
 * Product Catalog & Live Stock Service
 * STRICT USER RULE: Only products registered in the Item Directory (/api/items, controlroom_item_store)
 * are included. Static dummy catalogs (VRM_PRODUCTS) and duplicate products are strictly excluded.
 */
export const getFullProductsCatalogWithStock = (directItems = null) => {
  const hasDirectItems = Array.isArray(directItems) && directItems.length > 0;
  const now = Date.now();

  if (cachedBaseCatalog && (now - lastCacheTime < CACHE_TTL_MS)) {
    if (!hasDirectItems || directItems === cachedBaseCatalog) {
      return cachedBaseCatalog;
    }
  }

  const deletedCodes = getDeletedCodes();
  const isItemDeleted = (code, name, sku, itemId) => {
    const c = String(code || '').toUpperCase().trim();
    const n = String(name || '').toUpperCase().trim();
    const s = String(sku || '').toUpperCase().trim();
    const id = String(itemId || '').toUpperCase().trim();
    return (c && deletedCodes.includes(c)) || 
           (n && deletedCodes.includes(n)) || 
           (s && deletedCodes.includes(s)) || 
           (id && deletedCodes.includes(id));
  };

  // 1. Build live stock map from Central Inventory Store
  const stockMap = new Map();
  try {
    const centralItems = centralInventoryStore.getInventoryItems();
    if (Array.isArray(centralItems)) {
      centralItems.forEach(ci => {
        if (isItemDeleted(ci.code, ci.name, ci.sku, ci.itemId)) return;
        const resCode = resolveProductCode(ci);
        const codeKey = String(resCode || ci.code || ci.sku || '').toLowerCase().trim();
        const origCode = String(ci.code || ci.sku || '').toLowerCase().trim();
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

  // 2. Collect candidate items strictly from the Item Directory sources
  let candidatePool = [];

  if (hasDirectItems) {
    candidatePool = directItems;
  } else if (Array.isArray(serverItemsCache) && serverItemsCache.length > 0) {
    candidatePool = serverItemsCache;
  } else {
    // Read from localStorage item_store (saved by ItemsDirectoryView & /api/items)
    try {
      const rawStore = localStorage.getItem('controlroom_item_store') || localStorage.getItem('item_store');
      if (rawStore) {
        const parsed = JSON.parse(rawStore);
        if (Array.isArray(parsed) && parsed.length > 0) {
          candidatePool = parsed;
        }
      }
    } catch (_) {}

    // Fallback to custom items list if item_store is not yet cached
    if (candidatePool.length === 0) {
      try {
        const rawCustom = localStorage.getItem('controlroom_items_list');
        if (rawCustom) {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            candidatePool = parsed;
          }
        }
      } catch (_) {}
    }

    // Trigger background sync if on browser and cache was empty
    if (typeof window !== 'undefined' && !serverItemsCache) {
      setTimeout(() => syncFullCatalogFromBackend(), 50);
    }
  }

  // 3. Deduplicate and enrich items with live stock
  const seenMap = new Map();
  const seenNames = new Map();
  const result = [];

  (candidatePool || []).forEach(ci => {
    if (!ci || !ci.name) return;
    const rawCode = String(ci.code || ci.sku || ci.itemId || ci.id || '').trim();
    const rawName = String(ci.name || '').trim();
    if (!rawName) return;
    if (/^\d{10,}$/.test(rawCode) || /^\d{10,}$/.test(rawName)) return; // skip raw zoho numeric IDs
    if (isItemDeleted(rawCode, rawName, ci.sku, ci.itemId || ci.id)) return;

    const codeKey = rawCode.toLowerCase();
    const nameKey = rawName.toLowerCase();
    const normName = normalizeProductName(rawName);

    // Live stock lookup
    let realStock = 0;
    if (codeKey && stockMap.has(codeKey)) {
      realStock = Math.max(0, Number(stockMap.get(codeKey)));
    } else if (normName && stockMap.has(normName)) {
      realStock = Math.max(0, Number(stockMap.get(normName)));
    } else if (nameKey && stockMap.has(nameKey)) {
      realStock = Math.max(0, Number(stockMap.get(nameKey)));
    } else {
      realStock = Math.max(0, Number(ci.stock !== undefined ? ci.stock : (ci.availableStock !== undefined ? ci.availableStock : 0)));
    }

    // Check if this item has already been seen (by code or by exact name)
    const isAutoCode = !rawCode || rawCode.startsWith('ITEM-') || rawCode.startsWith('ITM-') || rawCode.startsWith('FG-');
    let existing = null;
    if (codeKey && seenMap.has(codeKey)) {
      existing = seenMap.get(codeKey);
    } else if (isAutoCode && seenNames.has(nameKey)) {
      existing = seenNames.get(nameKey);
    }

    if (existing) {
      // Merge best attributes
      if ((!existing.rate || Number(existing.rate) === 0) && Number(ci.rate || ci.price || 0) > 0) {
        existing.rate = String(ci.rate || ci.price);
        existing.price = existing.rate;
      }
      if ((!existing.code || existing.code.startsWith('ITEM-') || existing.code.startsWith('ITM-')) && rawCode && !rawCode.startsWith('ITEM-') && !rawCode.startsWith('ITM-')) {
        existing.code = rawCode;
        existing.sku = rawCode;
      }
      if (realStock > existing.stock) {
        existing.stock = realStock;
        existing.availableStock = realStock;
      }
      return;
    }

    const itemRecord = {
      id: ci.id || ci.itemId || rawCode || `ITM-${Date.now()}`,
      itemId: ci.itemId || ci.id || rawCode || '',
      code: rawCode,
      sku: ci.sku || rawCode,
      name: rawName,
      category: ci.category || ci.cat || ci.description || 'Finished Goods',
      uom: ci.uom || ci.unit || 'NOS',
      unit: ci.unit || ci.uom || 'NOS',
      rate: String(ci.rate || ci.price || '0'),
      price: String(ci.price || ci.rate || '0'),
      gstRate: ci.gstRate || ci.gst || '18%',
      hsn: ci.hsn || ci.hsn_or_sac || ci.hsnCode || getHsnCode(ci),
      stock: realStock,
      availableStock: realStock,
      physicalStock: realStock,
      status: ci.status || 'Active'
    };

    if (codeKey) seenMap.set(codeKey, itemRecord);
    seenNames.set(nameKey, itemRecord);
    result.push(itemRecord);
  });

  if (!hasDirectItems && result.length > 0) {
    cachedBaseCatalog = result;
    lastCacheTime = now;
  }

  return result;
};
