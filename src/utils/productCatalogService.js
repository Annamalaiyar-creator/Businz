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
        const codeKey = String(ci.code || '').toLowerCase().trim();
        const nameKey = String(ci.name || '').toLowerCase().trim();
        const normKey = normalizeProductName(ci.name);
        const fpKey = wordFingerprint(ci.name);
        const st = ci.available !== undefined 
          ? Number(ci.available) 
          : (ci.onHand !== undefined ? Number(ci.onHand) : Number(ci.stock !== undefined ? ci.stock : 0));
        
        if (codeKey) stockMap.set(codeKey, st);
        if (nameKey) stockMap.set(nameKey, st);
        if (normKey) stockMap.set(normKey, st);
        if (fpKey) stockMap.set(fpKey, st);
      });
    }
  } catch (e) {
    console.warn('[CATALOG] Central store stock query notice:', e.message);
  }

  // Also check raw materials store from localStorage for any live line adjustments
  try {
    const rawSaved = localStorage.getItem('controlroom_raw_materials_store');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (Array.isArray(parsed)) {
        parsed.forEach(rm => {
          const codeKey = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().trim();
          const nameKey = String(rm.name || '').toLowerCase().trim();
          const normKey = normalizeProductName(rm.name);
          const fpKey = wordFingerprint(rm.name);
          const st = Number(rm.stock !== undefined ? rm.stock : (rm.availableStock !== undefined ? rm.availableStock : (rm.physicalStock || 0)));
          if (codeKey) rawStoreMap.set(codeKey, st);
          if (nameKey) rawStoreMap.set(nameKey, st);
          if (normKey) rawStoreMap.set(normKey, st);
          if (fpKey) rawStoreMap.set(fpKey, st);
        });
      }
    }
  } catch (_) {}

  // 1.5 Calculate active allocations from active BOMs and active Proforma Invoices (PIs)
  const bomReservedMap = new Map();
  const registerAllocation = (pItem) => {
    const qty = parseFloat(pItem.qty || pItem.bomQty || pItem.quantity || 0) || 0;
    if (qty <= 0) return;
    const resCode = resolveProductCode(pItem).toLowerCase().trim();
    const pCode = String(resCode || pItem.code || '').toLowerCase().trim();
    const pName = String(pItem.name || pItem.description || '').toLowerCase().trim();
    const norm = normalizeProductName(pName);
    const fp = wordFingerprint(pName);
    if (pCode) bomReservedMap.set(pCode, (bomReservedMap.get(pCode) || 0) + qty);
    if (pName) bomReservedMap.set(pName, (bomReservedMap.get(pName) || 0) + qty);
    if (norm) bomReservedMap.set(norm, (bomReservedMap.get(norm) || 0) + qty);
    if (fp) bomReservedMap.set(fp, (bomReservedMap.get(fp) || 0) + qty);
  };

  try {
    const bomSaved = localStorage.getItem('controlroom_bom_store');
    let localBOMs = [];
    if (bomSaved) {
      const parsed = JSON.parse(bomSaved);
      if (Array.isArray(parsed)) localBOMs = parsed;
    }
    localBOMs.forEach(b => {
      const bStatus = String(b.status || '').toLowerCase();
      if (!bStatus.includes('cancelled') && !bStatus.includes('stock restored')) {
        (b.items || []).forEach(pItem => {
          registerAllocation(pItem);
        });
      }
    });
  } catch (_) {}

  try {
    const piSaved = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_procurement_pi_store');
    let localPIs = [];
    if (piSaved) {
      const parsed = JSON.parse(piSaved);
      if (Array.isArray(parsed)) localPIs = parsed;
    }
    localPIs.forEach(pi => {
      const piStatus = String(pi.status || '').toLowerCase();
      if (piStatus !== 'cancelled' && piStatus !== 'declined' && piStatus !== 'converted to bom' && !pi.convertedToBom && !pi.isConverted) {
        (pi.items || []).forEach(pItem => {
          registerAllocation(pItem);
        });
      }
    });
  } catch (_) {}

  // 2. Map all 285 VRM standardized products with true reduced available stock
  const catalogMap = new Map();

  (VRM_PRODUCTS || []).forEach(p => {
    const resCode = resolveProductCode(p).toLowerCase().trim();
    const codeKey = String(resCode || p.code || '').toLowerCase().trim();
    const nameKey = String(p.name || '').toLowerCase().trim();
    const normKey = normalizeProductName(p.name);
    const fpKey = wordFingerprint(nameKey);

    // Determine baseline stock before allocations
    let baseStock = null;
    if (codeKey && stockMap.has(codeKey)) {
      baseStock = Number(stockMap.get(codeKey));
    } else if (normKey && stockMap.has(normKey)) {
      baseStock = Number(stockMap.get(normKey));
    } else if (nameKey && stockMap.has(nameKey)) {
      baseStock = Number(stockMap.get(nameKey));
    } else if (fpKey && stockMap.has(fpKey)) {
      baseStock = Number(stockMap.get(fpKey));
    } else if (codeKey && rawStoreMap.has(codeKey)) {
      baseStock = Number(rawStoreMap.get(codeKey));
    } else if (normKey && rawStoreMap.has(normKey)) {
      baseStock = Number(rawStoreMap.get(normKey));
    } else if (nameKey && rawStoreMap.has(nameKey)) {
      baseStock = Number(rawStoreMap.get(nameKey));
    } else if (fpKey && rawStoreMap.has(fpKey)) {
      baseStock = Number(rawStoreMap.get(fpKey));
    }

    if (baseStock === null || isNaN(baseStock)) {
      baseStock = 5000;
    }

    // Active allocations for this item from active BOMs and active PIs
    const blockedQty = Math.max(
      (codeKey && bomReservedMap.get(codeKey)) || 0,
      (normKey && bomReservedMap.get(normKey)) || 0,
      (nameKey && bomReservedMap.get(nameKey)) || 0,
      (fpKey && bomReservedMap.get(fpKey)) || 0
    );
    let realStock = Math.max(0, baseStock - blockedQty);

    // If raw materials store has explicit stock adjustment, honor it (including legitimate 0)
    const rawStock = (codeKey && rawStoreMap.has(codeKey))
      ? rawStoreMap.get(codeKey)
      : ((normKey && rawStoreMap.has(normKey))
        ? rawStoreMap.get(normKey)
        : ((nameKey && rawStoreMap.has(nameKey))
          ? rawStoreMap.get(nameKey)
          : ((fpKey && rawStoreMap.has(fpKey))
            ? rawStoreMap.get(fpKey)
            : null)));

    if (rawStock !== null && !isNaN(rawStock)) {
      const explicitRaw = Number(rawStock);
      // Honor the explicit balance directly from the Inventory Store
      realStock = Math.max(0, explicitRaw);
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
      reservedStock: blockedQty
    };

    catalogMap.set(nameKey, itemRecord);
    if (normKey && !catalogMap.has(normKey)) {
      catalogMap.set(normKey, itemRecord);
    }
  });


  // 3. Include any items from Zoho or custom item store
  const mergeExtraItems = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach(ci => {
      const nameKey = String(ci.name || '').toLowerCase().trim();
      const codeKey = String(ci.code || ci.sku || ci.itemId || ci.id || '').toLowerCase().trim();

      let realStock = 0;
      if (codeKey && stockMap.has(codeKey)) realStock = stockMap.get(codeKey);
      else if (nameKey && stockMap.has(nameKey)) realStock = stockMap.get(nameKey);
      else realStock = Number(ci.stock !== undefined ? ci.stock : (ci.availableStock !== undefined ? ci.availableStock : 0));

      if (nameKey) {
        const existing = catalogMap.get(nameKey);
        if (!existing) {
          catalogMap.set(nameKey, {
            code: ci.code || ci.sku || '',
            name: ci.name,
            category: ci.category || ci.description || 'Raw Material',
            uom: ci.uom || ci.unit || 'NOS',
            rate: String(ci.rate || ci.price || '0'),
            price: String(ci.rate || ci.price || '0'),
            gstRate: ci.gstRate || '18%',
            stock: realStock,
            availableStock: realStock
          });
        } else if (ci.rate || ci.price) {
          // If price is specified from Zoho, keep updated
          existing.rate = String(ci.rate || ci.price || existing.rate);
          existing.price = existing.rate;
        }
      }
    });
  };

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
    const uKey = String(it.name || it.code || '').toLowerCase().trim();
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
