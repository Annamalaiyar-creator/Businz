import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createRawMaterialsRouter(dependencies) {
  const router = Router();
  const {
    loadLocalItems,
    saveLocalItems,
    loadLocalRawMaterials,
    broadcastRealtimeEvent,
    getVerifiedUserSession,
    hasAnyUserRole,
    isExecutiveOrAdminRole,
    loadDeletedRawMaterialCodes,
    saveDeletedRawMaterialCodes,
    resolveDefaultUom,
    resolveProductCode,
    applyDefaultCableUom = (item) => item,
    safeWriteJsonFileAsync,
    saveDatabaseStore,
    getDatabaseStore,
    pushStoreToSupabase,
    supabaseMemoryStore,
    query,
    isDbConnected
  } = dependencies;

// Real-time endpoint retrieving items catalog strictly from BUSINZ local stores with search, category filtering & pagination
router.get('/api/items', async (req, res) => {
  const localItems = loadLocalItems();
  let guaranteedItems = (localItems || []).map(l => ({
    ...l,
    stock: (l.stock !== undefined && l.stock !== null) ? Number(l.stock) : 0,
    openingStock: (l.openingStock !== undefined && l.openingStock !== null) ? Number(l.openingStock) : 0
  }));

  // Filtering by category or search query
  const { category, search, page, limit } = req.query;
  if (category) {
    const catLower = String(category).toLowerCase().trim();
    guaranteedItems = guaranteedItems.filter(it => 
      String(it.category || it.cat || '').toLowerCase().trim() === catLower
    );
  }
  if (search) {
    const sLower = String(search).toLowerCase().trim();
    guaranteedItems = guaranteedItems.filter(it => 
      String(it.code || '').toLowerCase().includes(sLower) ||
      String(it.name || '').toLowerCase().includes(sLower) ||
      String(it.sku || '').toLowerCase().includes(sLower)
    );
  }

  // Server-side pagination if page query param provided
  if (page !== undefined && page !== null && page !== '') {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const total = guaranteedItems.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = guaranteedItems.slice(startIndex, startIndex + limitNum);
    return res.json({
      success: true,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total,
      data: paged
    });
  }

  res.json(guaranteedItems);
});

// Endpoint to retrieve live reconciled Raw Materials inventory with filtering & pagination
router.get('/api/raw-materials', async (req, res) => {
  try {
    let rawMats = [];
    if (supabaseMemoryStore.raw_materials_store && Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0) {
      rawMats = supabaseMemoryStore.raw_materials_store;
    } else {
      rawMats = loadLocalRawMaterials();
      if (!Array.isArray(rawMats) || rawMats.length === 0) {
        const cloudMats = await getDatabaseStore('raw_materials_store');
        if (Array.isArray(cloudMats) && cloudMats.length > 0) {
          cloudMats.forEach(item => {
            if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
              item.cat = 'Raw Material';
              item.category = 'Raw Material';
            }
          });
          supabaseMemoryStore.raw_materials_store = cloudMats;
          const rawMatsPath = getStoreFilePath('raw_materials_store.json');
          safeWriteJsonFileAsync(rawMatsPath, cloudMats);
          rawMats = cloudMats;
        }
      }
    }

    if (!Array.isArray(rawMats)) rawMats = [];

    // Optional filtering
    const { category, search, page, limit } = req.query;
    let filtered = rawMats.map(applyDefaultCableUom);
    if (category) {
      const catLower = String(category).toLowerCase().trim();
      filtered = filtered.filter(it => 
        String(it.category || it.cat || '').toLowerCase().trim() === catLower
      );
    }
    if (search) {
      const sLower = String(search).toLowerCase().trim();
      filtered = filtered.filter(it => 
        String(it.code || '').toLowerCase().includes(sLower) ||
        String(it.name || '').toLowerCase().includes(sLower) ||
        String(it.sku || '').toLowerCase().includes(sLower)
      );
    }

    // Optional pagination
    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 50);
      const total = filtered.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paged = filtered.slice(startIndex, startIndex + limitNum);
      return res.json({
        success: true,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
        data: paged
      });
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to update Raw Materials inventory
router.post('/api/raw-materials', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['procurement', 'purchase', 'production', 'dispatch'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to update raw materials.`
    });
  }
  try {
    const updatedMats = req.body;
    if (Array.isArray(updatedMats)) {
      const rawMatsPath = getStoreFilePath('raw_materials_store.json');
      safeWriteJsonFileAsync(rawMatsPath, updatedMats);
      supabaseMemoryStore.raw_materials_store = updatedMats;

      // Also sync matching items in item_store
      try {
        const itemPath = getStoreFilePath('item_store.json');
        let currentItems = [];
        if (fs.existsSync(itemPath)) {
          currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
        }
        if (Array.isArray(currentItems) && currentItems.length > 0) {
          const rawMap = new Map();
          updatedMats.forEach(rm => {
            const k = String(rm.code || rm.sku || rm.itemId || rm.name || '').toUpperCase().trim();
            if (k) rawMap.set(k, rm);
          });
          currentItems = currentItems.map(it => {
            const k = String(it.code || it.sku || it.itemId || it.name || '').toUpperCase().trim();
            const rm = rawMap.get(k);
            if (rm) {
              return {
                ...it,
                stock: rm.stock !== undefined ? rm.stock : it.stock,
                availableStock: rm.availableStock !== undefined ? rm.availableStock : it.availableStock,
                physicalStock: rm.physicalStock !== undefined ? rm.physicalStock : it.physicalStock,
                openingStock: rm.openingStock !== undefined ? rm.openingStock : it.openingStock,
                reserved: rm.reserved !== undefined ? rm.reserved : it.reserved
              };
            }
            return it;
          });
          safeWriteJsonFileAsync(itemPath, currentItems);
          supabaseMemoryStore.item_store = currentItems;
          pushStoreToSupabase('item_store', currentItems).catch(() => {});
          broadcastRealtimeEvent('item_store_updated', { action: 'update', count: currentItems.length });
        }
      } catch (err) {
        console.error('[item_store sync error]:', err?.message);
      }

      pushStoreToSupabase('raw_materials_store', updatedMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { action: 'update', count: updatedMats.length });
      return res.json({ success: true, count: updatedMats.length });
    }
    res.status(400).json({ success: false, message: 'Array of materials required' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get authoritative list of deleted raw material codes across all logins
router.get('/api/raw-materials/deleted', (req, res) => {
  res.json(loadDeletedRawMaterialCodes());
});

// Endpoint to delete raw materials across all stores, databases, and user logins
router.post('/api/raw-materials/delete', async (req, res) => {
  try {
    const rawCodes = Array.isArray(req.body?.codes)
      ? req.body.codes
      : (req.body?.code ? [req.body.code] : []);
    const codesToDelete = rawCodes.map(c => String(c).toUpperCase().trim()).filter(Boolean);

    if (codesToDelete.length === 0) {
      return res.status(400).json({ success: false, message: 'No material codes provided for deletion' });
    }

    // 1. Save deleted codes persistently
    const existingDeleted = loadDeletedRawMaterialCodes();
    const updatedDeleted = Array.from(new Set([...existingDeleted, ...codesToDelete]));
    saveDeletedRawMaterialCodes(updatedDeleted);

    // 2. Remove from raw materials store
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toUpperCase().trim();
      const mName = String(m.name || '').toUpperCase().trim();
      return !codesToDelete.includes(mCode) && !codesToDelete.includes(mName);
    });
    safeWriteJsonFileAsync(rawMatsPath, filteredMats);
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);

    // 3. Remove from items catalog store as well
    const itemPath = getStoreFilePath('item_store.json');
    let currentItems = [];
    if (fs.existsSync(itemPath)) {
      try { currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredItems = currentItems.filter(it => {
      const iCode = String(it.code || it.sku || it.itemId || it.id || '').toUpperCase().trim();
      const iName = String(it.name || '').toUpperCase().trim();
      return !codesToDelete.includes(iCode) && !codesToDelete.includes(iName);
    });
    safeWriteJsonFileAsync(itemPath, filteredItems);
    supabaseMemoryStore.item_store = filteredItems;
    saveDatabaseStore('item_store', filteredItems);

    // 4. Real-time broadcasts
    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: codesToDelete });
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedCodes: codesToDelete });

    return res.json({
      success: true,
      deletedCount: codesToDelete.length,
      remainingMats: filteredMats.length,
      message: `Deleted ${codesToDelete.length} item(s) from inventory across all stores.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/raw-materials/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ success: false, message: 'Invalid material code' });

    const existingDeleted = loadDeletedRawMaterialCodes();
    const updatedDeleted = Array.from(new Set([...existingDeleted, code]));
    saveDeletedRawMaterialCodes(updatedDeleted);

    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toUpperCase().trim();
      const mName = String(m.name || '').toUpperCase().trim();
      return mCode !== code && mName !== code;
    });
    fs.writeFileSync(rawMatsPath, JSON.stringify(filteredMats, null, 2), 'utf8');
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);

    const itemPath = getStoreFilePath('item_store.json');
    let currentItems = [];
    if (fs.existsSync(itemPath)) {
      try { currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredItems = currentItems.filter(it => {
      const iCode = String(it.code || it.sku || it.itemId || it.id || '').toUpperCase().trim();
      const iName = String(it.name || '').toUpperCase().trim();
      return iCode !== code && iName !== code;
    });
    fs.writeFileSync(itemPath, JSON.stringify(filteredItems, null, 2), 'utf8');
    supabaseMemoryStore.item_store = filteredItems;
    saveDatabaseStore('item_store', filteredItems);

    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: [code] });
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedCodes: [code] });

    res.json({ success: true, message: `Material ${code} deleted permanently.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to bulk delete items from catalog store
router.post('/api/items/delete', async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body?.ids)
      ? req.body.ids
      : (req.body?.id ? [req.body.id] : []);
    const idsToDelete = rawIds.map(id => String(id).toLowerCase().trim()).filter(Boolean);

    const localItems = loadLocalItems();
    const updatedItems = localItems.filter(i => {
      const iId = String(i.itemId || i.id || '').toLowerCase().trim();
      const iSku = String(i.sku || '').toLowerCase().trim();
      const iName = String(i.name || '').toLowerCase().trim();
      return !idsToDelete.includes(iId) && !idsToDelete.includes(iSku) && !idsToDelete.includes(iName);
    });

    saveLocalItems(updatedItems);
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedIds: idsToDelete });

    // Also sync delete with raw materials
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toLowerCase().trim();
      const mName = String(m.name || '').toLowerCase().trim();
      return !idsToDelete.includes(mCode) && !idsToDelete.includes(mName);
    });
    fs.writeFileSync(rawMatsPath, JSON.stringify(filteredMats, null, 2), 'utf8');
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);
    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: idsToDelete });

    res.json({ success: true, count: idsToDelete.length, message: `Deleted ${idsToDelete.length} item(s)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to atomically deduct stock for BOM orders across all roles
router.post('/api/raw-materials/deduct', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['dispatch', 'production', 'billing', 'accounts'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to deduct raw materials.`
    });
  }
  try {
    const { bomCode, items, user } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, message: 'No items to deduct' });
    }

    const targetBomCode = String(bomCode || '').trim();
    const bomPath = getStoreFilePath('bom_store.json');
    let diskBoms = [];
    if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
      diskBoms = supabaseMemoryStore.bom_store;
    } else if (fs.existsSync(bomPath)) {
      try { diskBoms = JSON.parse(fs.readFileSync(bomPath, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(diskBoms)) diskBoms = [];

    // Idempotency guarantee: prevent double deduction if already processed for this BOM
    if (targetBomCode) {
      const matchedBom = diskBoms.find(b =>
        b && String(b.bomCode || b.code || b.id || '').toUpperCase() === targetBomCode.toUpperCase()
      );
      if (matchedBom && (matchedBom.stockDeducted === true || matchedBom.inventoryDeducted === true)) {
        return res.json({
          success: true,
          message: `Stock already deducted for BOM ${targetBomCode}. Operation is idempotent.`,
          alreadyDeducted: true,
          deducted: [],
          rawMaterials: (Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0)
            ? supabaseMemoryStore.raw_materials_store
            : loadLocalRawMaterials()
        });
      }
    }

    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let rawMats = (Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0)
      ? supabaseMemoryStore.raw_materials_store
      : loadLocalRawMaterials();
    if (!Array.isArray(rawMats) || rawMats.length === 0) {
      rawMats = [];
    }

    const itemsPath = getStoreFilePath('item_store.json');
    let itemsList = (Array.isArray(supabaseMemoryStore.item_store) && supabaseMemoryStore.item_store.length > 0)
      ? supabaseMemoryStore.item_store
      : loadLocalItems();
    if (!Array.isArray(itemsList)) itemsList = [];

    const deductedList = [];

    items.forEach(it => {
      const qty = parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0;
      if (qty <= 0) return;
      const cleanCode = String(it.code || it.sku || '').toUpperCase().trim();
      const cleanName = String(it.name || it.description || '').toLowerCase().trim();

      const mat = rawMats.find(m => {
        const mCode = String(m.code || m.sku || '').toUpperCase().trim();
        const mName = String(m.name || '').toLowerCase().trim();
        if (cleanCode && mCode === cleanCode) return true;
        if (cleanName && mName === cleanName) return true;
        if (cleanName && cleanName.length > 5 && mName.includes(cleanName)) return true;
        if ((cleanCode === 'MR-300MM' || cleanName.includes('mini rail')) && (mCode === 'MR-300MM' || mCode === 'MR100N' || (mName.includes('mini rail') && mName.includes('300')))) return true;
        return false;
      });

      if (mat) {
        const baseOpen = Math.max(0, parseFloat(mat.openingStock !== undefined ? mat.openingStock : (mat.physicalStock !== undefined ? mat.physicalStock : 0)) || 0);
        const curStock = parseFloat(mat.stock !== undefined ? mat.stock : (mat.physicalStock || baseOpen)) || 0;
        const newStock = Math.max(0, curStock - qty);
        mat.openingStock = baseOpen;
        mat.stock = newStock;
        mat.physicalStock = newStock;
        mat.availableStock = newStock;
        mat.reserved = Math.max(0, (parseFloat(mat.reserved) || 0) - qty);
        mat.blockedForBom = mat.reserved;
        mat.lastUpdated = `Deducted ${qty} for BOM ${bomCode || 'Order'} by ${user || session.user || 'System'}`;
        deductedList.push({ code: mat.code, name: mat.name, deducted: qty, remaining: newStock });
      }

      const itMatch = itemsList.find(m => {
        const mCode = String(m.code || m.sku || m.itemId || '').toUpperCase().trim();
        const mName = String(m.name || '').toLowerCase().trim();
        if (cleanCode && mCode === cleanCode) return true;
        if (cleanName && mName === cleanName) return true;
        if (cleanName && cleanName.length > 5 && mName.includes(cleanName)) return true;
        if ((cleanCode === 'MR-300MM' || cleanName.includes('mini rail')) && (mCode === 'MR-300MM' || mCode === 'MR100N' || (mName.includes('mini rail') && mName.includes('300')))) return true;
        return false;
      });

      if (itMatch) {
        const baseOpen = Math.max(0, parseFloat(itMatch.openingStock !== undefined ? itMatch.openingStock : (itMatch.physicalStock !== undefined ? itMatch.physicalStock : 0)) || 0);
        const curStock = parseFloat(itMatch.stock !== undefined ? itMatch.stock : (itMatch.physicalStock || baseOpen)) || 0;
        const newStock = Math.max(0, curStock - qty);
        itMatch.openingStock = baseOpen;
        itMatch.stock = newStock;
        itMatch.physicalStock = newStock;
        itMatch.availableStock = newStock;
        itMatch.reserved = Math.max(0, (parseFloat(itMatch.reserved) || 0) - qty);
      }
    });

    if (deductedList.length > 0) {
      fs.writeFileSync(rawMatsPath, JSON.stringify(rawMats, null, 2), 'utf8');
      supabaseMemoryStore.raw_materials_store = rawMats;
      pushStoreToSupabase('raw_materials_store', rawMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { action: 'deduct', bomCode, deducted: deductedList });

      fs.writeFileSync(itemsPath, JSON.stringify(itemsList, null, 2), 'utf8');
      supabaseMemoryStore.item_store = itemsList;
      pushStoreToSupabase('item_store', itemsList).catch(() => {});
      broadcastRealtimeEvent('item_store_updated', { action: 'deduct', bomCode, deducted: deductedList });

      // Mark BOM as stockDeducted
      if (targetBomCode && diskBoms.length > 0) {
        let bChanged = false;
        diskBoms = diskBoms.map(b => {
          if (b && String(b.bomCode || b.code || b.id || '').toUpperCase() === targetBomCode.toUpperCase()) {
            bChanged = true;
            return { ...b, stockDeducted: true, inventoryDeducted: true, deductedAt: new Date().toISOString() };
          }
          return b;
        });
        if (bChanged) {
          safeWriteJsonFileAsync(bomPath, diskBoms);
          supabaseMemoryStore.bom_store = diskBoms;
          pushStoreToSupabase('bom_store', diskBoms).catch(() => {});
          if (isDbConnected()) {
            query(`UPDATE public.bom_orders SET accounts_verification = jsonb_set(COALESCE(accounts_verification, '{}'::jsonb), '{stockDeducted}', 'true'::jsonb, true), updated_at = NOW() WHERE bom_code = $1 OR code = $1`, [targetBomCode]).catch(() => {});
          }
        }
      }

      console.log(`[INVENTORY DEDUCTION] Deducted stock for BOM ${bomCode}:`, deductedList);
    }

    res.json({ success: true, deducted: deductedList, rawMaterials: rawMats });
  } catch (err) {
    console.error('[INVENTORY DEDUCTION ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});



// Endpoint to delete an Item in BUSINZ Authoritative Store (Native BUSINZ Store)
router.delete('/api/items/:id', async (req, res) => {
  const targetId = req.params.id;

  const localItems = loadLocalItems();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedItems = localItems.filter(i => {
    const iId = String(i.itemId || i.id || '').toLowerCase();
    const iSku = String(i.sku || '').toLowerCase();
    const iName = String(i.name || '').toLowerCase();
    return iId !== targetClean && iSku !== targetClean && iName !== targetClean;
  });
  saveLocalItems(updatedItems);

  res.json({ success: true, message: `Item ${targetId} deleted from BUSINZ!` });
});

// Real-time synchronization endpoint retrieving item details strictly from BUSINZ local stores
router.get('/api/items/:id', async (req, res) => {
  const targetId = String(req.params.id || '').trim().toLowerCase();
  const localItems = loadLocalItems();
  const item = localItems.find(i => 
    String(i.itemId || '').toLowerCase() === targetId ||
    String(i.id || '').toLowerCase() === targetId ||
    String(i.sku || '').toLowerCase() === targetId ||
    String(i.code || '').toLowerCase() === targetId
  );

  if (item) {
    res.json({
      itemId: item.itemId || item.id,
      name: item.name,
      sku: item.sku || item.code || '—',
      status: item.status || 'Active',
      description: item.description || '—',
      unit: item.unit || item.uom || 'NOS',
      rate: item.rate || item.price || 0,
      purchaseRate: item.purchaseRate || item.purchase_rate || item.rate || 0,
      purchaseDescription: item.purchaseDescription || item.purchase_description || item.description || '—',
      stockOnHand: item.stock !== undefined ? item.stock : (item.stockOnHand !== undefined ? item.stockOnHand : '—'),
      reorderLevel: item.reorderLevel || '—',
      itemType: item.itemType || 'sales_and_purchase',
      productType: item.productType || 'goods',
      purchaseAccount: item.purchaseAccount || 'Cost of Goods Sold',
      salesAccount: item.salesAccount || 'Sales',
      taxName: item.taxName || 'GST 18%',
      taxPercentage: item.taxPercentage !== undefined ? item.taxPercentage : 18
    });
  } else {
    res.status(404).json({ error: 'Item not found in local catalog.' });
  }
});

// Endpoint to update item details in BUSINZ Authoritative Store (Native BUSINZ Store)
router.put('/api/items/:id', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['procurement', 'purchase', 'production', 'admin', 'ceo'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to update items.`
    });
  }
  const rawId = req.params.id;
  const targetId = String(rawId || '').trim();
  if (!targetId || targetId === 'undefined' || targetId === 'null') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: Target item ID or SKU cannot be empty or undefined.'
    });
  }

  const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';

  let updatedItem = null;
  try {
    const localItems = loadLocalItems();
    const updated = localItems.map(it => {
      if (!it) return it;
      const itItemId = it.itemId ? String(it.itemId).trim() : null;
      const itId = it.id ? String(it.id).trim() : null;
      const itSku = it.sku ? String(it.sku).trim() : null;
      const itCode = it.code ? String(it.code).trim() : null;

      const isMatch = (
        (itItemId && itItemId === targetId) ||
        (itId && itId === targetId) ||
        (itSku && itSku.toLowerCase() === targetId.toLowerCase()) ||
        (itCode && itCode.toLowerCase() === targetId.toLowerCase())
      );

      if (isMatch) {
        updatedItem = {
          ...it,
          ...req.body,
          status: reqStatus
        };
        return updatedItem;
      }
      return it;
    });
    saveLocalItems(updated);
  } catch (e) {
    console.error('Error updating local item:', e);
  }

  return res.json({ 
    success: true, 
    item: updatedItem || { id: targetId, ...req.body, status: reqStatus }, 
    message: 'Item updated successfully in BUSINZ.' 
  });
});

// Endpoint to create a new product in BUSINZ Authoritative Store (Native BUSINZ Store)
router.post('/api/items', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['procurement', 'purchase', 'production'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to create items.`
    });
  }
  try {
    const localItems = loadLocalItems();

    if (Array.isArray(req.body)) {
      const incomingList = req.body;
      const createdItems = [];
      let currentItems = [...localItems];

      incomingList.forEach((it, idx) => {
        const newItemId = it.itemId || it.id || it.sku || `ITEM-${Date.now()}-${idx + 1}`;
        const reqStatus = (it.status && String(it.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
        const cleanCode = String(it.code || it.sku || newItemId).trim();
        const cleanName = String(it.name || it.description || newItemId).trim();
        const cleanRate = Number(it.rate || it.price || 0) || 0;
        const cleanUnit = resolveDefaultUom({ name: cleanName, code: cleanCode }, it.unit || it.uom, 'NOS');
        const cleanCat = it.category || it.cat || (it.productType === 'service' ? 'Services' : 'Finished Goods');
        const cleanStock = it.stock !== undefined ? Number(it.stock) : 0;

        const itemRecord = {
          itemId: newItemId,
          id: newItemId,
          code: cleanCode,
          sku: cleanCode,
          name: cleanName,
          rate: cleanRate,
          price: cleanRate,
          status: reqStatus,
          description: it.description || '—',
          unit: cleanUnit,
          uom: cleanUnit,
          purchaseRate: Number(it.purchaseRate || 0) || 0,
          purchaseDescription: it.purchaseDescription || '—',
          productType: it.productType || 'goods',
          category: cleanCat,
          cat: cleanCat,
          stock: cleanStock,
          openingStock: it.openingStock !== undefined ? Number(it.openingStock) : cleanStock,
          physicalStock: it.physicalStock !== undefined ? Number(it.physicalStock) : cleanStock,
          availableStock: it.availableStock !== undefined ? Number(it.availableStock) : cleanStock,
          available: cleanStock,
          reserved: 0,
          createdAt: it.createdAt || new Date().toISOString()
        };

        const targetId = String(itemRecord.itemId).toLowerCase().trim();
        const targetSku = String(itemRecord.sku).toLowerCase().trim();
        const targetName = String(itemRecord.name).toLowerCase().trim();

        const exIdx = currentItems.findIndex(i => {
          const iId = String(i.itemId || i.id || '').toLowerCase().trim();
          const iSku = String(i.sku || i.code || '').toLowerCase().trim();
          const iName = String(i.name || '').toLowerCase().trim();
          return (targetSku && iSku === targetSku) || (targetId && iId === targetId) || (targetName && iName === targetName);
        });

        if (exIdx !== -1) {
          currentItems[exIdx] = { ...currentItems[exIdx], ...itemRecord };
        } else {
          currentItems = [itemRecord, ...currentItems];
        }
        createdItems.push(itemRecord);
      });

      saveLocalItems(currentItems);

      try {
        broadcastRealtimeEvent('item_store_updated', { action: 'create', count: createdItems.length, items: createdItems });
      } catch (_) {}

      return res.json({
        success: true,
        count: createdItems.length,
        items: createdItems,
        message: `Successfully registered ${createdItems.length} items in BUSINZ!`
      });
    }

    const newItemId = req.body.itemId || req.body.id || ('ITEM-' + Date.now());
    const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
    const cleanCode = String(req.body.code || req.body.sku || newItemId).trim();
    const cleanName = String(req.body.name || '').trim();
    const cleanRate = Number(req.body.rate || req.body.price || 0) || 0;
    const cleanUnit = resolveDefaultUom({ name: cleanName, code: cleanCode }, req.body.unit || req.body.uom, 'NOS');
    const cleanCat = req.body.category || req.body.cat || (req.body.productType === 'service' ? 'Services' : 'Finished Goods');
    const cleanStock = req.body.stock !== undefined ? Number(req.body.stock) : 0;

    const itemToSave = {
      itemId: newItemId,
      id: newItemId,
      code: cleanCode,
      sku: cleanCode,
      name: cleanName,
      rate: cleanRate,
      price: cleanRate,
      status: reqStatus,
      description: req.body.description || '—',
      unit: cleanUnit,
      uom: cleanUnit,
      purchaseRate: Number(req.body.purchaseRate) || 0,
      purchaseDescription: req.body.purchaseDescription || '—',
      productType: req.body.productType || 'goods',
      category: cleanCat,
      cat: cleanCat,
      stock: cleanStock,
      openingStock: req.body.openingStock !== undefined ? Number(req.body.openingStock) : cleanStock,
      physicalStock: req.body.physicalStock !== undefined ? Number(req.body.physicalStock) : cleanStock,
      availableStock: req.body.availableStock !== undefined ? Number(req.body.availableStock) : cleanStock,
      available: cleanStock,
      reserved: 0,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const filtered = localItems.filter(i => {
      const iId = String(i.itemId || i.id || '').toLowerCase().trim();
      const iSku = String(i.sku || i.code || '').toLowerCase().trim();
      const iName = String(i.name || '').toLowerCase().trim();
      const tId = String(itemToSave.itemId).toLowerCase().trim();
      const tSku = String(itemToSave.sku).toLowerCase().trim();
      const tName = String(itemToSave.name).toLowerCase().trim();
      return (tId && iId === tId) || (tSku && iSku === tSku) || (tName && iName === tName);
    });
    const updated = [itemToSave, ...filtered];
    saveLocalItems(updated);

    try {
      broadcastRealtimeEvent('item_store_updated', { action: 'update', recordId: itemToSave.code || itemToSave.itemId, item: itemToSave });
    } catch (_) {}

    return res.json({ 
      success: true, 
      item: itemToSave, 
      message: 'Item saved successfully in BUSINZ.'
    });
  } catch (e) {
    console.error('Failed to save newly created item to item_store:', e);
    return res.status(500).json({ error: 'Failed to save item: ' + e.message });
  }
});

// Universal Stock Reset Endpoint: Resets all stock to 0, wipes allocations, and sets each item to exactly 5,000
router.all('/api/inventory/reset-to-5000', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!isExecutiveOrAdminRole(session.role)) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to execute inventory reset.`
    });
  }
  try {
    const localItems = loadLocalItems();
    const existingRaw = supabaseMemoryStore.raw_materials_store || [];
    
    // Step 1: Combine VRM standardized products, catalog items, and existing raw profiles
    const itemMap = new Map();

    // 1. Add all 285 VRM standardized products
    (VRM_PRODUCTS || []).forEach(p => {
      const code = p.code || resolveProductCode(p) || p.name;
      const key = String(code).toUpperCase().trim();
      const baseUnit = resolveDefaultUom(p, p.uom, 'Nos');
      itemMap.set(key, {
        code: p.code || code,
        sku: p.code || code,
        itemId: p.code || code,
        name: p.name,
        cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        unit: baseUnit,
        uom: baseUnit,
        price: p.price || p.rate || 0,
        rate: p.price || p.rate || 0,
        gstRate: p.gst || '18%',
        status: 'Active',
        productType: 'goods',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        location: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        minLevel: 50,
        reorderLevel: 100
      });
    });

    // 2. Merge existing raw materials
    (existingRaw || []).forEach(rm => {
      const code = rm.code || rm.sku || rm.itemId || rm.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      const resolvedUnit = resolveDefaultUom(
        { ...existing, ...rm },
        rm.unit || rm.uom || existing.unit,
        'Nos'
      );
      itemMap.set(key, {
        ...existing,
        ...rm,
        code: rm.code || existing.code || code,
        name: rm.name || existing.name,
        cat: rm.cat || rm.category || existing.cat || 'Aluminium',
        category: rm.cat || rm.category || existing.cat || 'Aluminium',
        unit: resolvedUnit,
        uom: resolvedUnit
      });
    });

    // 3. Merge local catalog items
    (localItems || []).forEach(it => {
      const code = it.code || it.sku || it.itemId || it.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      const resolvedUnit = resolveDefaultUom(
        { ...existing, ...it },
        it.unit || it.uom || existing.unit,
        'Nos'
      );
      itemMap.set(key, {
        ...existing,
        ...it,
        code: it.code || it.sku || existing.code || code,
        name: it.name || existing.name,
        cat: it.category || it.material || existing.cat || 'General',
        category: it.category || it.material || existing.cat || 'General',
        unit: resolvedUnit,
        uom: resolvedUnit
      });
    });

    // Step 2: Remove all stock (start from 0) and then add exactly 5,000
    const unified5000List = Array.from(itemMap.values()).map(item => ({
      ...item,
      stock: 5000,
      openingStock: 5000,
      physicalStock: 5000,
      availableStock: 5000,
      stockOnHand: 5000,
      reserved: 0,
      blockedForBom: 0,
      goodsReceived: 0,
      issuedProd: 0,
      matReturn: 0,
      stockAdj: 0,
      status: 'In Stock',
      lastUpdated: 'Stock Reset to 5,000'
    }));

    // Step 3: Persist to raw_materials_store (used by Inventory Stores)
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    try {
      fs.writeFileSync(rawMatsPath, JSON.stringify(unified5000List, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.raw_materials_store = unified5000List;
    await saveDatabaseStore('raw_materials_store', unified5000List);

    // Step 4: Persist to item_store (used by Item Directory & Catalog)
    const itemsPath = getStoreFilePath('item_store.json');
    try {
      fs.writeFileSync(itemsPath, JSON.stringify(unified5000List, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.item_store = unified5000List;
    await saveDatabaseStore('item_store', unified5000List);

    // Broadcast update to all connected clients
    broadcastRealtimeEvent('inventory_updated', { rawMaterials: unified5000List });
    broadcastRealtimeEvent('item_store_updated', { items: unified5000List });
    broadcastRealtimeEvent('stock_reset_5000', { timestamp: new Date().toISOString() });

    console.log(`✅ [STOCK RESET] All ${unified5000List.length} items reset from 0 to exactly 5,000 stock!`);
    res.json({
      success: true,
      count: unified5000List.length,
      message: `Successfully reset all stock starting from 0 and assigned exactly 5,000 stock to all ${unified5000List.length} items in the inventory store and item directory.`
    });
  } catch (err) {
    console.error('Error during stock reset:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Universal Stock Reset to ZERO Endpoint: Sets EVERY single item's stock to 0
router.all('/api/inventory/reset-to-zero', async (req, res) => {
  try {
    const localItems = loadLocalItems();
    const existingRaw = supabaseMemoryStore.raw_materials_store || [];
    
    const itemMap = new Map();

    (VRM_PRODUCTS || []).forEach(p => {
      const code = p.code || resolveProductCode(p) || p.name;
      const key = String(code).toUpperCase().trim();
      const baseUnit = resolveDefaultUom(p, p.uom, 'Nos');
      itemMap.set(key, {
        code: p.code || code,
        sku: p.code || code,
        itemId: p.code || code,
        name: p.name,
        cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        unit: baseUnit,
        uom: baseUnit,
        price: p.price || p.rate || 0,
        rate: p.price || p.rate || 0,
        gstRate: p.gst || '18%',
        status: 'Out of Stock',
        productType: 'goods',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        location: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        minLevel: 50,
        reorderLevel: 100
      });
    });

    (existingRaw || []).forEach(rm => {
      const code = rm.code || rm.sku || rm.itemId || rm.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      const resolvedUnit = resolveDefaultUom(
        { ...existing, ...rm },
        rm.unit || rm.uom || existing.unit,
        'Nos'
      );
      itemMap.set(key, {
        ...existing,
        ...rm,
        code: rm.code || existing.code || code,
        name: rm.name || existing.name,
        cat: rm.cat || rm.category || existing.cat || 'Aluminium',
        category: rm.cat || rm.category || existing.cat || 'Aluminium',
        unit: resolvedUnit,
        uom: resolvedUnit
      });
    });

    (localItems || []).forEach(it => {
      const code = it.code || it.sku || it.itemId || it.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      const resolvedUnit = resolveDefaultUom(
        { ...existing, ...it },
        it.unit || it.uom || existing.unit,
        'Nos'
      );
      itemMap.set(key, {
        ...existing,
        ...it,
        code: it.code || it.sku || existing.code || code,
        name: it.name || existing.name,
        cat: it.category || it.material || existing.cat || 'General',
        category: it.category || it.material || existing.cat || 'General',
        unit: resolvedUnit,
        uom: resolvedUnit
      });
    });

    // Reset ALL stock to exactly 0
    const zeroList = Array.from(itemMap.values()).map(item => ({
      ...item,
      stock: 0,
      openingStock: 0,
      physicalStock: 0,
      availableStock: 0,
      stockOnHand: 0,
      reserved: 0,
      blockedForBom: 0,
      goodsReceived: 0,
      issuedProd: 0,
      matReturn: 0,
      stockAdj: 0,
      status: 'Out of Stock',
      lastUpdated: 'Stock Set to 0'
    }));

    // Persist to raw_materials_store
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    try {
      fs.writeFileSync(rawMatsPath, JSON.stringify(zeroList, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.raw_materials_store = zeroList;
    await saveDatabaseStore('raw_materials_store', zeroList);

    // Persist to item_store
    const itemsPath = getStoreFilePath('item_store.json');
    try {
      fs.writeFileSync(itemsPath, JSON.stringify(zeroList, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.item_store = zeroList;
    await saveDatabaseStore('item_store', zeroList);

    // Persist to vrm_prod_inventory
    const vrmPath = getStoreFilePath('vrm_prod_inventory.json');
    let vrmItems = [];
    try {
      if (fs.existsSync(vrmPath)) {
        vrmItems = JSON.parse(fs.readFileSync(vrmPath, 'utf8'));
      }
    } catch (_) {}
    if (Array.isArray(vrmItems) && vrmItems.length > 0) {
      vrmItems = vrmItems.map(vi => ({
        ...vi,
        physicalStock: 0,
        availableStock: 0,
        reservedStock: 0,
        issuedStock: 0,
        consumedStock: 0,
        stock: 0,
        openingStock: 0,
        status: 'Out of Stock'
      }));
      try {
        fs.writeFileSync(vrmPath, JSON.stringify(vrmItems, null, 2), 'utf8');
      } catch (_) {}
      supabaseMemoryStore.vrm_prod_inventory = vrmItems;
      await saveDatabaseStore('vrm_prod_inventory', vrmItems);
    }

    // Broadcast update to all connected clients immediately
    broadcastRealtimeEvent('inventory_updated', { rawMaterials: zeroList });
    broadcastRealtimeEvent('item_store_updated', { items: zeroList });
    broadcastRealtimeEvent('vrm_inventory_updated', { inventory: vrmItems });
    broadcastRealtimeEvent('stock_reset_0', { timestamp: new Date().toISOString() });

    console.log(`✅ [STOCK RESET TO 0] All ${zeroList.length} items set to exactly 0 stock!`);
    res.json({
      success: true,
      count: zeroList.length,
      message: `Successfully set every item stock to 0 across all stores.`
    });
  } catch (err) {
    console.error('Error during stock reset to 0:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



  return router;
}
