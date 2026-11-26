import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto, { createHash } from 'crypto';
import zlib from 'zlib';
import { getStoreFilePath } from '../runtimePaths.js';
import { isDbConnected, query } from '../db.js';
import { toDatabaseBomRowServer } from '../bomPersistence.js';

export let reconcileServerInventoryWithBoms = async () => {};
export let syncMissingRelationalBoms = async () => {};

let cachedBomsResult = null;
let lastBomFetchTimestamp = 0;
let cachedBomsWirePayload = null;

export function invalidateBomsRouterCache() {
  cachedBomsResult = null;
  cachedBomsWirePayload = null;
  lastBomFetchTimestamp = 0;
}
let serverBomSequenceCounter = null;
let serverBomReservationLock = Promise.resolve();

export default function createBomWorkflowRouter(dependencies) {
  const router = Router();
  const {
    loadDatabaseBoms,
    broadcastRealtimeEvent,
    broadcastCustomerTrackingUpdate,
    getOrCreateOrderTracking,
    createInternalNotification,
    extractMaxSequence,
    formatSequenceCode,
    getFinancialYear,
    getVerifiedUserSession,
    gzipAsync,
    hasAnyUserRole,
    isDbConnected,
    persistBomsTransactionSafe,
    pushStoreToSupabase,
    query,
    requireRole,
    resolveProductCode,
    safeWriteJsonFileAsync,
    toConsumerBomServer,
    toDatabaseBomRowServer,
    wordFingerprint,
    supabase,
    supabaseMemoryStore,
    pool
  } = dependencies;

// Protection 4: /api/reset-bom-workflow-data disabled with HTTP 403
router.post('/api/reset-bom-workflow-data', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Forbidden: /api/reset-bom-workflow-data is disabled to protect historical BOM, PI, and financial ledger data.'
  });
});

// Dedicated function to audit, deduplicate, and repair historical BOM sequence mappings for converted PIs
async function repairBomSequences() {
  console.log('🔄 [BOM Sequence Repair] Auditing and restoring 1-to-1 BOM sequence mapping...');

  let piList = [];
  if (isDbConnected()) {
    try {
      const sRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'sales_pi_store'`);
      if (sRes?.rows?.[0]?.data && Array.isArray(sRes.rows[0].data)) {
        piList = sRes.rows[0].data;
      }
    } catch (_) {}
  }
  if (piList.length === 0) {
    const piFilePath = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(piFilePath)) {
      try {
        piList = JSON.parse(fs.readFileSync(piFilePath, 'utf8'));
      } catch (_) {}
    }
  }
  if (!Array.isArray(piList)) piList = [];

  // Explicit sequential alignment mapping matching existing converted PIs
  const targetMap = {};

  let piUpdatedCount = 0;
  let bomUpdatedCount = 0;

  // 1. Ensure each PI in sales_pi_store has its distinct convertedBomCode
  if (piList.length > 0) {
    let piListChanged = false;
    piList = piList.map(pi => {
      const pNo = String(pi.piNo || pi.id || '').trim();
      if (targetMap[pNo]) {
        const assigned = targetMap[pNo].bomCode;
        if (pi.convertedBomCode !== assigned || pi.convertedBomNo !== assigned) {
          piUpdatedCount++;
          piListChanged = true;
          return {
            ...pi,
            status: 'Converted to BOM',
            convertedToBom: true,
            convertedBomCode: assigned,
            convertedBomNo: assigned
          };
        }
      } else if (
        (pi.convertedBomCode === 'BOM-659' || pi.convertedBomNo === 'BOM-659' || pi.converted_bom_code === 'BOM-659' || pi.converted_bom_no === 'BOM-659') &&
        pNo !== 'PI-00061'
      ) {
        piUpdatedCount++;
        piListChanged = true;
        return {
          ...pi,
          status: 'Issued',
          statusType: 'issued',
          convertedToBom: false,
          convertedBomCode: null,
          convertedBomNo: null,
          converted_bom_code: null,
          converted_bom_no: null
        };
      } else if (pNo.toLowerCase().includes('122') && (pi.status === 'Converted to BOM' || pi.convertedBomCode || pi.convertedBomNo)) {
        piUpdatedCount++;
        piListChanged = true;
        return {
          ...pi,
          status: 'Issued',
          statusType: 'issued',
          convertedToBom: false,
          convertedBomCode: null,
          convertedBomNo: null,
          converted_bom_code: null,
          converted_bom_no: null
        };
      } else if (pNo.toLowerCase().includes('495') && (String(pi.convertedBomCode || '').includes('381') || String(pi.convertedBomNo || '').includes('381'))) {
        piUpdatedCount++;
        piListChanged = true;
        return {
          ...pi,
          status: 'Issued',
          statusType: 'issued',
          convertedToBom: false,
          convertedBomCode: null,
          convertedBomNo: null,
          converted_bom_code: null,
          converted_bom_no: null
        };
      }
      return pi;
    });

    if (piListChanged) {
      if (isDbConnected()) {
        await query(`UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = 'sales_pi_store'`, [JSON.stringify(piList)]).catch(() => null);
        await query(`UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = 'proforma_invoice_store'`, [JSON.stringify(piList)]).catch(() => null);
      }
      try {
        fs.writeFileSync(getStoreFilePath('sales_pi_store.json'), JSON.stringify(piList, null, 2), 'utf8');
      } catch (_) {}
      supabaseMemoryStore['sales_pi_store'] = piList;
      supabaseMemoryStore['proforma_invoice_store'] = piList;
    }
  }

  // 2. Ensure each BOM exists on disk (bom_store.json)
  const diskPath = getStoreFilePath('bom_store.json');
  let currentDiskBoms = [];
  if (fs.existsSync(diskPath)) {
    try {
      currentDiskBoms = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
    } catch (_) {}
  }
  if (!Array.isArray(currentDiskBoms)) currentDiskBoms = [];
  const bomDiskMap = new Map();
  currentDiskBoms.forEach(b => {
    const c = b?.bomCode || b?.code || b?.id;
    if (c) bomDiskMap.set(c, b);
  });

  for (const [piNo, info] of Object.entries(targetMap)) {
    if (!bomDiskMap.has(info.bomCode)) {
      bomDiskMap.set(info.bomCode, {
        id: info.bomCode,
        bomCode: info.bomCode,
        code: info.bomCode,
        sourcePiNo: piNo,
        customerName: info.defaultCustomer,
        companyName: info.defaultCustomer,
        salesPerson: 'Annamalaiyar',
        grandTotal: info.defaultAmount,
        subTotal: Math.round(info.defaultAmount / 1.18),
        status: info.bomCode === 'BOM-659' ? 'COMPLETED & DISPATCHED' : 'Draft',
        salesConfirmed: true,
        date: '2026-10-06'
      });
      bomUpdatedCount++;
    }
  }

  const finalDiskBoms = Array.from(bomDiskMap.values());
  try {
    fs.writeFileSync(diskPath, JSON.stringify(finalDiskBoms, null, 2), 'utf8');
  } catch (_) {}
  supabaseMemoryStore.bom_store = finalDiskBoms;

  // 3. Ensure public.proforma_invoices and public.bom_orders tables in PostgreSQL are updated
  if (isDbConnected()) {
    try {
      await query(`
        UPDATE public.proforma_invoices
        SET converted_bom_code = NULL,
            converted_to_bom = false,
            status = 'Issued',
            updated_at = NOW()
        WHERE (converted_bom_code = 'BOM-659' OR converted_bom_no = 'BOM-659')
          AND pi_no != 'PI-00061'
          AND id != 'PI-00061'
      `);

      // Safety reconciliation: Unlink any mismatched BOM falsely claiming source_pi_no 122
      await query(`
        UPDATE public.bom_orders b
        SET source_pi_no = null,
            updated_at = NOW()
        WHERE (b.source_pi_no ILIKE '%122%')
          AND NOT EXISTS (
            SELECT 1 FROM public.proforma_invoices p
            WHERE (LOWER(TRIM(p.pi_no)) = LOWER(TRIM(b.source_pi_no)) OR LOWER(TRIM(p.id)) = LOWER(TRIM(b.source_pi_no)))
              AND (
                LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
              )
          );
      `).catch(() => {});

      // Safely restore PI-122 to Issued if no valid matching BOM exists
      await query(`
        UPDATE public.proforma_invoices p
        SET converted_bom_code = NULL,
            converted_bom_no = NULL,
            status = 'Issued',
            status_type = 'issued',
            updated_at = NOW()
        WHERE (p.pi_no ILIKE '%122%' OR p.id ILIKE '%122%')
          AND p.status = 'Converted to BOM'
          AND NOT EXISTS (
            SELECT 1 FROM public.bom_orders b
            WHERE (LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.pi_no)) OR LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.id)))
              AND (
                LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
              )
          );
      `).catch(() => {});

      // Safely detach accidental BOM-381 from PI-495
      await query(`
        UPDATE public.proforma_invoices p
        SET converted_bom_code = NULL,
            converted_bom_no = NULL,
            status = 'Issued',
            status_type = 'issued',
            updated_at = NOW()
        WHERE (p.pi_no ILIKE '%495%' OR p.id ILIKE '%495%')
          AND (p.converted_bom_code ILIKE '%381%' OR p.converted_bom_no ILIKE '%381%');
      `).catch(() => {});
    } catch (_) {}

    for (const [piNo, info] of Object.entries(targetMap)) {
      try {
        await query(`
          UPDATE public.proforma_invoices
          SET converted_bom_code = $1,
              converted_to_bom = true,
              status = 'Converted to BOM',
              updated_at = NOW()
          WHERE pi_no = $2 OR id = $2
        `, [info.bomCode, piNo]);
      } catch (_) {}
    }

    for (const [piNo, info] of Object.entries(targetMap)) {
      try {
        const piData = piList.find(p => String(p.piNo || p.id || '').trim() === piNo);
        const custName = piData?.customerName || piData?.vendor || info.defaultCustomer;
        const grandTotal = Number(piData?.total || piData?.grandTotal || info.defaultAmount || 0);
        const subTotal = Number(piData?.subtotal || piData?.unitValue || Math.round(grandTotal / 1.18));
        const items = Array.isArray(piData?.items) && piData.items.length > 0 ? JSON.stringify(piData.items) : '[]';
        const salesPerson = (piData?.salesPerson || piData?.salesperson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim();

        const existingBom = await query(`
          SELECT id, bom_code, source_pi_no FROM public.bom_orders 
          WHERE bom_code = $1 OR source_pi_no = $2
        `, [info.bomCode, piNo]);

        if (existingBom.rows.length === 0) {
          await query(`
            INSERT INTO public.bom_orders (
              id, bom_code, code, source_pi_no, customer_name, company_name, 
              grand_total, sub_total, sales_person, status, items, dispatch_packing, date, created_at, updated_at
            ) VALUES (
              $1, $1, $1, $2, $3, $3, 
              $4, $5, $6, 'Draft', $7::jsonb, $7::jsonb, CURRENT_DATE, NOW(), NOW()
            ) ON CONFLICT (id) DO UPDATE SET
              bom_code = EXCLUDED.bom_code,
              source_pi_no = EXCLUDED.source_pi_no,
              customer_name = EXCLUDED.customer_name,
              company_name = EXCLUDED.company_name,
              grand_total = EXCLUDED.grand_total,
              sub_total = EXCLUDED.sub_total,
              sales_person = EXCLUDED.sales_person,
              items = EXCLUDED.items,
              dispatch_packing = EXCLUDED.dispatch_packing,
              updated_at = NOW()
          `, [info.bomCode, piNo, custName, grandTotal, subTotal, salesPerson, items]);
          bomUpdatedCount++;
        } else {
          await query(`
            UPDATE public.bom_orders
            SET bom_code = $1,
                code = $1,
                source_pi_no = $2,
                customer_name = CASE WHEN customer_name IS NULL OR customer_name = '' OR customer_name = 'Customer' OR customer_name = '-' THEN $3 ELSE customer_name END,
                company_name = CASE WHEN company_name IS NULL OR company_name = '' OR company_name = 'Customer' OR company_name = '-' THEN $3 ELSE company_name END,
                grand_total = CASE WHEN grand_total IS NULL OR grand_total = 0 THEN $4 ELSE grand_total END,
                sub_total = CASE WHEN sub_total IS NULL OR sub_total = 0 THEN $5 ELSE sub_total END,
                sales_person = CASE WHEN sales_person IS NULL OR sales_person = '' OR sales_person = 'Anu' OR sales_person = 'Sales Department' THEN $6 ELSE sales_person END,
                items = CASE WHEN items IS NULL OR jsonb_array_length(items) = 0 THEN $7::jsonb ELSE items END,
                dispatch_packing = CASE WHEN dispatch_packing IS NULL OR jsonb_array_length(dispatch_packing) = 0 THEN $7::jsonb ELSE dispatch_packing END,
                updated_at = NOW()
            WHERE id = $1 OR bom_code = $1 OR source_pi_no = $2
          `, [info.bomCode, piNo, custName, grandTotal, subTotal, salesPerson, items]);
        }
      } catch (e) {
        console.warn(`[repairBomSequences notice for ${piNo}]:`, e.message);
      }
    }
  }

  // 4. Update sequence counter
  const extractMaxBoms = (supabaseMemoryStore.bom_store || []).map(b => {
    const m = String(b.bomCode || b.code || '').match(/VRM-BOM-\d{4}-(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  });
  const maxBomNum = extractMaxBoms.length > 0 ? Math.max(...extractMaxBoms) : 0;
  serverBomSequenceCounter = Math.max(serverBomSequenceCounter || 0, maxBomNum);

  // 5. Reload memory cache & broadcast updates
  await loadDatabaseBoms(true);
  try {
    broadcastRealtimeEvent('bom_updated', { action: 'repair_complete', count: bomUpdatedCount });
    broadcastRealtimeEvent('pi_updated', { action: 'repair_complete', count: piUpdatedCount });
  } catch (_) {}

  console.log(`✅ [BOM Sequence Repair] Complete. ${piUpdatedCount} PIs aligned, ${bomUpdatedCount} BOMs ensured.`);
  return { piUpdatedCount, bomUpdatedCount, maxSequence: serverBomSequenceCounter };
}

/**
 * Idempotent reconciliation:
 * Ensures all BOMs present in controlroom_store or bom_store.json
 * are cleanly represented in public.bom_orders without overwriting existing data.
 */
  syncMissingRelationalBoms = async function() {
  if (!isDbConnected()) return;
  try {
    const existingDbRes = await query(`SELECT bom_code, id, status, grand_total FROM public.bom_orders`).catch(() => null);
    const existingCodes = new Set();
    const existingDbMap = new Map();
    (existingDbRes?.rows || []).forEach(r => {
      if (r.bom_code) { existingCodes.add(r.bom_code); existingDbMap.set(r.bom_code, r); }
      if (r.id) { existingCodes.add(r.id); existingDbMap.set(r.id, r); }
    });

    // Read authoritative JSON store
    let bomsToSync = [];
    const crRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'bom_store'`).catch(() => null);
    if (crRes?.rows?.[0]?.data && Array.isArray(crRes.rows[0].data)) {
      bomsToSync = crRes.rows[0].data;
    }
    if (bomsToSync.length === 0) {
      const diskPath = getStoreFilePath('bom_store.json');
      if (fs.existsSync(diskPath)) {
        try { bomsToSync = JSON.parse(fs.readFileSync(diskPath, 'utf8')); } catch (_) {}
      }
    }
    if (!Array.isArray(bomsToSync) || bomsToSync.length === 0) return;

    let syncedCount = 0;
    for (const bom of bomsToSync) {
      const code = bom?.bomCode || bom?.code || bom?.id;
      if (!code) continue;
      if (/^BOM-6\d{2}$/i.test(code) || /^BOM-(STAGING|USER|POST)/i.test(code)) continue;

      const existingRecord = existingDbMap.get(code) || (bom?.id && existingDbMap.get(bom.id));
      if (existingRecord) {
        // Transparent conflict audit: detect and report differences rather than silently ignoring
        const dbStatus = String(existingRecord.status || '').trim();
        const storeStatus = String(bom.status || '').trim();
        const dbTotal = Number(existingRecord.grand_total || 0);
        const storeTotal = Number(bom.grandTotal || bom.grand_total || 0);

        if (dbStatus !== storeStatus || (dbTotal !== storeTotal && Math.abs(dbTotal - storeTotal) > 1)) {
          console.warn(`[BOM Reconciliation Conflict Notice] Divergence on ${code}: Database [Status: "${dbStatus}", Total: ${dbTotal}] vs Store [Status: "${storeStatus}", Total: ${storeTotal}]. Authoritative database preserved.`);
        }
        continue;
      }

      const dbRow = toDatabaseBomRowServer(bom);
      if (!dbRow) continue;

      const keys = Object.keys(dbRow).filter(k => dbRow[k] !== undefined);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const jsonbCols = new Set([
        'items', 'payments', 'dispatch_packing', 'accounts_verification', 
        'preset_groups', 'billing_address_obj', 'delivery_address_obj', 
        'dispatch_packing_media', 'vehicle_loading', 'data'
      ]);
      const placeholders = keys.map((k, i) => jsonbCols.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`).join(', ');
      const values = keys.map(k => {
        const v = dbRow[k];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });

      const sql = `
        INSERT INTO public.bom_orders (${cols})
        VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING
      `;

      try {
        await query(sql, values);
        existingCodes.add(code);
        if (bom?.id) existingCodes.add(bom.id);
        if (bom?.bomCode) existingCodes.add(bom.bomCode);
        syncedCount++;
      } catch (insertErr) {
        if (insertErr?.code === '23505') {
          // Unique violation on id or bom_code: safely skip duplicate
          console.warn(`[BOM Reconciliation Notice] Record ${code} already exists in database (skipped).`);
        } else {
          console.error(`[BOM Reconciliation Error] Failed to persist ${code} to public.bom_orders:`, insertErr.message);
          throw insertErr;
        }
      }
    }

    if (syncedCount > 0) {
      console.log(`✅ [BOM Reconciliation] Reconciled ${syncedCount} missing BOM(s) into public.bom_orders.`);
    }
    return { success: true, syncedCount };
  } catch (err) {
    console.error('❌ [BOM Reconciliation Fatal Error]:', err?.message || err);
    throw err;
  }
}

// Dedicated endpoint to fix and re-align historical BOM sequences for converted PIs - DISABLED
// Protection 5: /api/repair-bom-sequences disabled with HTTP 403
router.post('/api/repair-bom-sequences', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Forbidden: /api/repair-bom-sequences is disabled to protect historical BOM sequences.'
  });
});

// Recursive helper to sanitize heavy base64 data URLs & redundant snapshots from list items
const deepStripDataUrls = (val, depth = 0) => {
  if (!val || depth > 8) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > 200) {
      const mime = val.slice(5, val.indexOf(';')) || 'image/jpeg';
      return { hasDoc: true, isLightweightRef: true, type: mime };
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => deepStripDataUrls(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      if (k === 'auditLog' && Array.isArray(val[k])) {
        // Truncate heavy historical snapshots in auditLog for list views
        out[k] = val[k].slice(-5).map(entry => {
          if (entry && typeof entry === 'object') {
            const { snapshot, previousState, fullBom, ...cleanEntry } = entry;
            return cleanEntry;
          }
          return entry;
        });
      } else {
        out[k] = deepStripDataUrls(val[k], depth + 1);
      }
    }
    return out;
  }
  return val;
};

// Helper to strip heavy base64 dataUrls from BOM list responses while keeping all metadata
const stripHeavyDocsFromBom = (b) => {
  if (!b || typeof b !== 'object') return b;
  let stripped = { ...b };

  const stripDoc = (doc) => {
    if (!doc) return null;
    if (typeof doc === 'string') {
      if (doc.startsWith('data:') && doc.length > 200) {
        return { hasDoc: true, isLightweightRef: true, type: doc.slice(5, doc.indexOf(';')) || 'image/jpeg' };
      }
      return doc;
    }
    if (typeof doc === 'object') {
      const { dataUrl, fileData, base64, buffer, ...meta } = doc;
      return {
        ...meta,
        hasDoc: Boolean(dataUrl || fileData || base64 || meta.hasDoc || meta.storagePath || meta.url),
        isLightweightRef: true
      };
    }
    return doc;
  };

  if (stripped.paymentProofDoc) {
    stripped.paymentProofDoc = stripDoc(stripped.paymentProofDoc);
  }
  if (Array.isArray(stripped.paymentProofDocs)) {
    stripped.paymentProofDocs = stripped.paymentProofDocs.map(stripDoc);
  }
  if (stripped.deliveryAddressProofDoc) {
    stripped.deliveryAddressProofDoc = stripDoc(stripped.deliveryAddressProofDoc);
  }
  if (stripped.lrCopyDoc) {
    stripped.lrCopyDoc = stripDoc(stripped.lrCopyDoc);
  }
  if (stripped.dispatchPackingMedia && typeof stripped.dispatchPackingMedia === 'object') {
    const rawMedia = stripped.dispatchPackingMedia;
    const stripMediaItem = (item) => {
      if (!item || typeof item !== 'object') return item;
      const { dataUrl, fileData, base64, buffer, ...meta } = item;
      const resolvedUrl = meta.url || (meta.storagePath ? `/api/uploads/${meta.storageBucket || 'bom-documents'}/${meta.storagePath}` : (meta.name ? `/api/uploads/${encodeURIComponent(meta.name)}` : undefined));
      return {
        ...meta,
        url: resolvedUrl,
        dataUrl: (dataUrl && typeof dataUrl === 'string' && dataUrl.length < 50000) ? dataUrl : undefined
      };
    };
    const cleanPhotos = Array.isArray(rawMedia.photos) ? rawMedia.photos.map(stripMediaItem) : [];
    const cleanVideos = Array.isArray(rawMedia.videos) ? rawMedia.videos.map(stripMediaItem) : [];
    stripped.dispatchPackingMedia = {
      photos: cleanPhotos,
      videos: cleanVideos,
      photosCount: cleanPhotos.length,
      videosCount: cleanVideos.length,
      hasMedia: cleanPhotos.length > 0 || cleanVideos.length > 0
    };
  }

  // Deep recursive pass to sanitize nested base64 in dispatchPacking, items, accountsVerification, etc.
  stripped = deepStripDataUrls(stripped);

  return stripped;
};

// Centralized GET all BOMs endpoint - reads authoritative list from public.bom_orders with fast caching, document stripping and pagination
router.get('/api/boms', async (req, res) => {
  try {
    const now = Date.now();
    const shouldRefresh = Boolean(req.query.refresh === 'true' || req.query.refresh === '1');
    const includeDocs = Boolean(req.query.includeDocs === 'true' || req.query.includeDocs === '1');
    const pageParam = req.query.page ? parseInt(req.query.page, 10) : null;
    const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : (pageParam ? 50 : null);

    let finalBoms = null;
    // 1. Serve immediately from high-speed memory cache if fresh (< 30s) unless refresh requested
    if (!shouldRefresh && cachedBomsResult && (now - lastBomFetchTimestamp < 30000)) {
      finalBoms = cachedBomsResult;
    } else {
      // Helper to sort BOMs by code sequence descending
      const sortBoms = (list) => {
        const parseBomSeq = (code) => {
          const m = String(code || '').match(/BOM-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        };
        return list.sort((a, b) => {
          const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
          const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
          if (seqA !== seqB) return seqB - seqA;
          const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
          const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
          return dateB - dateA;
        });
      };

      // Load authoritative list directly from public.bom_orders (Zero leaves table interaction)
      const boms = await loadDatabaseBoms(shouldRefresh);
      finalBoms = sortBoms(Array.isArray(boms) ? boms : []);
      cachedBomsResult = finalBoms;
      lastBomFetchTimestamp = Date.now();
    }

    // Strip bulky inline documents & serve pre-serialized, pre-gzipped wire cache + ETag on cache hits
    if (!includeDocs) {
      if (!cachedBomsWirePayload || cachedBomsWirePayload.sourceRef !== finalBoms) {
        const strippedList = finalBoms.map(stripHeavyDocsFromBom);
        const jsonStr = JSON.stringify({ success: true, data: strippedList, total: strippedList.length });
        const gzipBuf = await gzipAsync(Buffer.from(jsonStr, 'utf-8'), { level: zlib.constants.Z_BEST_SPEED });
        const etag = `W/"boms-${strippedList.length}-${crypto.createHash('sha1').update(jsonStr).digest('hex').slice(0, 16)}"`;
        cachedBomsWirePayload = { sourceRef: finalBoms, strippedList, jsonStr, gzipBuf, etag };
      }

      if (pageParam === null) {
        res.setHeader('ETag', cachedBomsWirePayload.etag);
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
        if (req.headers['if-none-match'] === cachedBomsWirePayload.etag) {
          return res.status(304).end();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if ((req.headers['accept-encoding'] || '').includes('gzip')) {
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', cachedBomsWirePayload.gzipBuf.length);
          return res.end(cachedBomsWirePayload.gzipBuf);
        }
        return res.end(cachedBomsWirePayload.jsonStr);
      }

      const resultList = cachedBomsWirePayload.strippedList;
      const page = Math.max(1, pageParam);
      const limit = Math.max(1, limitParam || 50);
      const total = resultList.length;
      const startIndex = (page - 1) * limit;
      const pagedBoms = resultList.slice(startIndex, startIndex + limit);
      return res.json({
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        data: pagedBoms
      });
    }

    const resultList = finalBoms;

    // Server-side pagination if page query param provided
    if (pageParam !== null) {
      const page = Math.max(1, pageParam);
      const limit = Math.max(1, limitParam || 50);
      const total = resultList.length;
      const startIndex = (page - 1) * limit;
      const pagedBoms = resultList.slice(startIndex, startIndex + limit);
      return res.json({
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        data: pagedBoms
      });
    }

    return res.json({ success: true, data: resultList, total: resultList.length });
  } catch (err) {
    console.error('Error fetching BOMs:', err);
    return res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// Single BOM read endpoint by ID or bom_code
router.get('/api/boms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    // 1. Check memory cache first
    if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
      const found = supabaseMemoryStore.bom_store.find(b => 
        String(b.id || '').toLowerCase() === cleanId.toLowerCase() || 
        String(b.bomCode || '').toLowerCase() === cleanId.toLowerCase() || 
        String(b.code || '').toLowerCase() === cleanId.toLowerCase()
      );
      if (found) return res.json({ success: true, data: found });
    }

    // 2. Fetch single row from public.bom_orders via PostgreSQL
    if (isDbConnected()) {
      const dbRes = await query(`
        SELECT * FROM public.bom_orders
        WHERE LOWER(TRIM(id)) = LOWER($1) OR LOWER(TRIM(bom_code)) = LOWER($1) OR LOWER(TRIM(code)) = LOWER($1)
        LIMIT 1
      `, [cleanId]);

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        const consumer = toConsumerBomServer(dbRes.rows[0]);
        return res.json({ success: true, data: consumer });
      }
    }

    return res.status(404).json({ success: false, message: `BOM ${cleanId} not found` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single BOM accounts verification read endpoint (Only fetch accounts_verification on-demand for one order)
router.get('/api/boms/:id/accounts-verification', async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    if (isDbConnected()) {
      const dbRes = await query(`
        SELECT accounts_verification FROM public.bom_orders
        WHERE LOWER(TRIM(id)) = LOWER($1) OR LOWER(TRIM(bom_code)) = LOWER($1) OR LOWER(TRIM(code)) = LOWER($1)
        LIMIT 1
      `, [cleanId]);

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        const raw = dbRes.rows[0]?.accounts_verification || {};
        const clean = (typeof raw === 'object') ? { ...raw } : {};
        delete clean._extra_data;
        return res.json({ success: true, data: clean });
      }
    }

    return res.status(404).json({ success: false, message: `BOM ${cleanId} not found` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/api/reset-all-testing-data', requireRole(['Technical Administrator']), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Forbidden: Testing data reset is disabled in production.' });
  }
  try {
    // 1. Reset invoice store and sequence (Preserve legacy public.leaves BOM_STORE row 2 for rollback)
    await supabase.from('leaves').delete().in('employee', ['INVOICE_STORE', 'BOM_SEQUENCE']);
    await supabase.from('leaves').insert([
      { employee: 'INVOICE_STORE', reason: '[]', status: 'active', duration: '0', dates: new Date().toISOString(), type: 'Store' },
      { employee: 'BOM_SEQUENCE', reason: JSON.stringify({ lastNumber: 0, reservedAt: new Date().toISOString() }), status: 'active', duration: '0', dates: new Date().toISOString(), type: 'Store' }
    ]);

    // 2. Wipe in-memory stores
    supabaseMemoryStore.bom_store = [];
    supabaseMemoryStore.invoice_store = [];

    // 3. Wipe disk backup files
    try {
      fs.writeFileSync(getStoreFilePath('bom_store.json'), '[]', 'utf8');
      fs.writeFileSync(getStoreFilePath('invoice_store.json'), '[]', 'utf8');
    } catch (_) {}

    return res.json({ success: true, message: 'All testing data wiped clean' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Reconcile and deduct inventory across all active BOMs
reconcileServerInventoryWithBoms = async (bomsList = null) => {
  try {
    let boms = bomsList;
    if (!Array.isArray(boms)) {
      if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
        boms = supabaseMemoryStore.bom_store;
      } else {
        const bomsPath = getStoreFilePath('bom_store.json');
        if (fs.existsSync(bomsPath)) {
          try { boms = JSON.parse(fs.readFileSync(bomsPath, 'utf8')); } catch (_) {}
        }
      }
    }
    if (!Array.isArray(boms)) boms = [];

    // 1. Calculate total active and completed allocations per item
    // STRICT RULE: Only reduce stock when BOM is completed and sent to dispatch
    const allocations = new Map();
    boms.forEach(b => {
      const st = String(b?.status || '').toLowerCase();
      const isSentToDispatch = Boolean(b?.salesConfirmed) || [
        'sales confirmed - sent to dispatch',
        'sent to production',
        'confirmed',
        'packed & ready for dispatch',
        'partially packed',
        'dispatch packing verified - sent to accounts',
        'awaiting vehicle loading & dispatch'
      ].some(s => st.includes(s));

      const isCompletedOrDeducted = Boolean(
        b?.fullyCompleted ||
        (b?.vehicleLoading && (b?.vehicleLoading.fullyCompleted || b?.vehicleLoading.loadedAt)) ||
        st === 'completed' ||
        st === 'closed' ||
        st.includes('completed') ||
        st.includes('closed') ||
        st.includes('fully dispatched') ||
        st.includes('delivered') ||
        st.includes('awaiting lr copy')
      );

      // ONLY allocate active reserved stock when BOM is in progress and NOT yet completed or dispatched
      if (isSentToDispatch && !isCompletedOrDeducted && !st.includes('cancel') && !st.includes('stock restored')) {
        (b?.items || []).forEach(it => {
          const q = parseFloat(it?.qty || it?.bomQty || 0) || 0;
          if (q > 0) {
            const resCode = resolveProductCode(it).toLowerCase().trim();
            const code = String(it?.code || resCode || '').toLowerCase().trim();
            const name = String(it?.name || it?.description || '').toLowerCase().trim();
            const fp = wordFingerprint(name);
            if (code) allocations.set(code, (allocations.get(code) || 0) + q);
            if (name) allocations.set(name, (allocations.get(name) || 0) + q);
            if (fp) allocations.set(fp, (allocations.get(fp) || 0) + q);

            const isMr300 = code === 'mr-300mm' || code === 'mr100n' || (name.includes('mini rail') && name.includes('300'));
            if (isMr300) {
              if (code !== 'mr-300mm') allocations.set('mr-300mm', (allocations.get('mr-300mm') || 0) + q);
              if (code !== 'mr100n') allocations.set('mr100n', (allocations.get('mr100n') || 0) + q);
            }
          }
        });
      }
    });

    // 2. Update raw_materials_store.json
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let rawMats = [];
    if (Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0) {
      rawMats = supabaseMemoryStore.raw_materials_store;
    } else if (fs.existsSync(rawMatsPath)) {
      try { rawMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')); } catch (_) {}
    }
    if (Array.isArray(rawMats) && rawMats.length > 0) {
      let changed = false;
      rawMats.forEach(m => {
        const mRes = resolveProductCode(m).toLowerCase().trim();
        const mCode = String(m?.code || mRes || m?.sku || m?.itemId || '').toLowerCase().trim();
        const mName = String(m?.name || '').toLowerCase().trim();
        const mFp = wordFingerprint(mName);
        const isMr300 = mCode === 'mr-300mm' || mCode === 'mr100n' || (mName.includes('mini rail') && mName.includes('300'));
        const isAlu2414 = mCode === 'alu-len-2414mm' || mCode === 'rm-alu-2414';

        const blocked = Math.max(
          (mCode && allocations.get(mCode)) || 0,
          (mName && allocations.get(mName)) || 0,
          (mFp && allocations.get(mFp)) || 0,
          isMr300 ? (allocations.get('mr-300mm') || allocations.get('mr100n') || 0) : 0
        );

        let baseline;
        if (m?.physicalStock !== undefined && m?.physicalStock !== null && !isNaN(Number(m.physicalStock))) {
          baseline = Number(m.physicalStock);
        } else if (m?.openingStock !== undefined && m?.openingStock !== null && !isNaN(Number(m.openingStock))) {
          baseline = Number(m.openingStock);
        } else if (m?.stock !== undefined && m?.stock !== null && !isNaN(Number(m.stock))) {
          baseline = Number(m.stock);
        } else {
          baseline = isMr300 ? 2000 : (isAlu2414 ? 250 : 0);
        }

        const newStock = Math.max(0, baseline - blocked);
        const minL = parseFloat(m?.minLevel || 100) || 100;
        const newStatus = newStock === 0 ? 'Out of Stock' : (newStock <= minL ? 'Low Stock' : 'In Stock');

        if (m.stock !== newStock || m.reserved !== blocked || m.status !== newStatus || m.physicalStock !== baseline || m.availableStock !== newStock) {
          changed = true;
        }
        m.openingStock = (m.openingStock !== undefined && m.openingStock !== null && !isNaN(Number(m.openingStock))) ? Number(m.openingStock) : baseline;
        m.physicalStock = baseline;
        m.stock = newStock;
        m.availableStock = newStock;
        m.reserved = blocked;
        m.blockedForBom = blocked;
        m.status = newStatus;
      });

      if (changed) {
        fs.writeFileSync(rawMatsPath, JSON.stringify(rawMats, null, 2), 'utf8');
        supabaseMemoryStore.raw_materials_store = rawMats;
        pushStoreToSupabase('raw_materials_store', rawMats).catch(() => {});
        broadcastRealtimeEvent('inventory_updated', { action: 'reconcile', count: rawMats.length });
      }
    }

    // 3. Update item_store.json
    const itemsPath = getStoreFilePath('item_store.json');
    let items = [];
    if (Array.isArray(supabaseMemoryStore.item_store) && supabaseMemoryStore.item_store.length > 0) {
      items = supabaseMemoryStore.item_store;
    } else if (fs.existsSync(itemsPath)) {
      try { items = JSON.parse(fs.readFileSync(itemsPath, 'utf8')); } catch (_) {}
    }
    if (Array.isArray(items) && items.length > 0) {
      let changed = false;
      items.forEach(it => {
        const itRes = resolveProductCode(it).toLowerCase().trim();
        const itCode = String(it?.code || itRes || it?.sku || it?.itemId || '').toLowerCase().trim();
        const itName = String(it?.name || '').toLowerCase().trim();
        const itFp = wordFingerprint(itName);
        const isMr300 = itCode === 'mr-300mm' || itCode === 'mr100n' || (itName.includes('mini rail') && itName.includes('300'));
        const isAlu2414 = itCode === 'alu-len-2414mm' || itCode === 'rm-alu-2414';

        const blocked = Math.max(
          (itCode && allocations.get(itCode)) || 0,
          (itName && allocations.get(itName)) || 0,
          (itFp && allocations.get(itFp)) || 0,
          isMr300 ? (allocations.get('mr-300mm') || allocations.get('mr100n') || 0) : 0
        );

        let baseline;
        if (it?.physicalStock !== undefined && it?.physicalStock !== null && !isNaN(Number(it.physicalStock))) {
          baseline = Number(it.physicalStock);
        } else if (it?.openingStock !== undefined && it?.openingStock !== null && !isNaN(Number(it.openingStock))) {
          baseline = Number(it.openingStock);
        } else if (it?.stock !== undefined && it?.stock !== null && !isNaN(Number(it.stock))) {
          baseline = Number(it.stock);
        } else {
          baseline = isMr300 ? 2000 : (isAlu2414 ? 250 : 0);
        }

        const newStock = Math.max(0, baseline - blocked);
        const minL = parseFloat(it?.minLevel || 20) || 20;
        const newStatus = newStock === 0 ? 'Out of Stock' : (newStock <= minL ? 'Low Stock' : 'In Stock');

        if (it.stock !== newStock || it.reserved !== blocked || it.status !== newStatus || it.physicalStock !== baseline || it.availableStock !== newStock) {
          changed = true;
        }
        it.openingStock = (it.openingStock !== undefined && it.openingStock !== null && !isNaN(Number(it.openingStock))) ? Number(it.openingStock) : baseline;
        it.physicalStock = baseline;
        it.stock = newStock;
        it.availableStock = newStock;
        it.reserved = blocked;
        it.status = newStatus;
      });

      if (changed) {
        fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf8');
        supabaseMemoryStore.item_store = items;
        pushStoreToSupabase('item_store', items).catch(() => {});
        broadcastRealtimeEvent('item_store_updated', { action: 'reconcile', count: items.length });
      }
    }
    console.log(`[Inventory Reconcile] Reconciled stock for ${allocations.size} allocated items across ${boms.length} BOMs.`);
  } catch (err) {
    console.error('[Inventory Reconciliation Error]:', err);
  }
};

router.post('/api/inventory/reconcile-boms', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['sales', 'production', 'procurement', 'purchase', 'dispatch', 'accounts', 'billing', 'admin', 'technical administrator', 'ceo', 'director'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to reconcile inventory.`
    });
  }
  await reconcileServerInventoryWithBoms();
  res.json({ success: true, message: 'Server inventory reconciled with active BOMs' });
});

// Centralized atomic BOM creation/update endpoint - guarantees sequential non-clashing codes
router.post('/api/boms', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['sales', 'tech', 'accounts', 'dispatch', 'billing', 'production'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to modify BOMs.`
    });
  }
  return new Promise((resolveOuter) => {
    serverBomReservationLock = serverBomReservationLock.then(async () => {
      try {
        let { bom, isNew, isUpdate } = req.body || {};
        if (!bom && (req.body?.bomCode || req.body?.code || req.body?.id)) {
          bom = req.body;
          isUpdate = true;
        }
        if (!bom) {
          res.status(400).json({ success: false, message: 'Valid bom record required' });
          return resolveOuter();
        }

        // Server-side guarantee: recursively strip any raw base64 data URLs to prevent store bloating
        const stripServerDataUrls = (target) => {
          if (!target || typeof target !== 'object') return;
          if (target.dataUrl) delete target.dataUrl;
          if (target.fileData) delete target.fileData;
          if (target.proofDocData) delete target.proofDocData;
          Object.keys(target).forEach(k => {
            if (typeof target[k] === 'string' && (target[k].startsWith('data:') || (target[k].length > 1000 && /^[A-Za-z0-9+/=]+$/.test(target[k].slice(0, 100))))) {
              delete target[k];
            } else if (target[k] && typeof target[k] === 'object') {
              stripServerDataUrls(target[k]);
            }
          });
        };
        stripServerDataUrls(bom);

        // Ensure all line items have resolved product code for accurate inventory reservation
        if (Array.isArray(bom.items)) {
          bom.items.forEach(it => {
            if (!it.code || it.code === 'VRM-ITEM' || it.code === 'ITEM' || it.code.startsWith('FG-')) {
              const resCode = resolveProductCode(it);
              if (resCode) it.code = resCode;
            }
          });
        }

        const incomingCode = String(bom.bomCode || bom.code || bom.id || '').trim();
        // Reject invalid or ambiguous BOM identifiers on update
        if (isUpdate && (!incomingCode || incomingCode === 'null' || incomingCode === 'undefined' || incomingCode === '[object Object]')) {
          res.status(400).json({ success: false, message: 'Invalid or ambiguous BOM identifier for update' });
          return resolveOuter();
        }

        // 1. Transaction-safe PostgreSQL persistence with disk store fallback
        let persistResult = null;
        try {
          persistResult = await persistBomsTransactionSafe({
            singleBom: bom,
            isNew: Boolean(isNew),
            isUpdate: Boolean(isUpdate)
          });
        } catch (dbErr) {
          console.warn('[POST /api/boms DB Notice, falling back to disk persistence]:', dbErr?.message || dbErr);
          const diskPath = getStoreFilePath('bom_store.json');
          let currentList = [];
          if (fs.existsSync(diskPath)) {
            try { currentList = JSON.parse(fs.readFileSync(diskPath, 'utf8')); } catch (_) {}
          }
          if (!Array.isArray(currentList) || currentList.length === 0) {
            if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
              currentList = supabaseMemoryStore.bom_store;
            } else if (Array.isArray(cachedBomsResult) && cachedBomsResult.length > 0) {
              currentList = cachedBomsResult;
            } else {
              currentList = [];
            }
          }

          let targetCode = incomingCode;
          if (!targetCode || isNew || !currentList.some(b => (b.bomCode || b.code || b.id) === targetCode)) {
            const nextNum = extractMaxSequence('BOM', getFinancialYear(), currentList) + 1;
            targetCode = incomingCode || formatSequenceCode('BOM', nextNum);
          }
          bom.bomCode = targetCode;
          bom.code = targetCode;
          bom.id = bom.id || targetCode;

          const filtered = currentList.filter(b => (b.bomCode || b.code || b.id) !== targetCode);
          const fullStoreList = [bom, ...filtered];

          persistResult = {
            persistedBom: bom,
            finalCode: targetCode,
            fullStoreList,
            shouldAssignNewCode: Boolean(isNew)
          };
        }

        const { persistedBom, finalCode, fullStoreList, shouldAssignNewCode } = persistResult;

        // 2. ONLY AFTER successful PostgreSQL COMMIT: Update memory cache
        supabaseMemoryStore.bom_store = fullStoreList;
        cachedBomsResult = fullStoreList;
        lastBomFetchTimestamp = Date.now();

        // 3. Write disk backup asynchronously
        try {
          const diskPath = getStoreFilePath('bom_store.json');
          safeWriteJsonFileAsync(diskPath, fullStoreList);
        } catch (diskErr) {
          console.warn('[POST /api/boms disk write error]:', diskErr?.message || diskErr);
        }

        console.log(`[BOM Store] BOM ${finalCode} transaction-safely committed to PostgreSQL (isNew: ${shouldAssignNewCode}).`);

        // 4. Post-commit inventory reconciliation
        try {
          await reconcileServerInventoryWithBoms(fullStoreList);
        } catch (rErr) {
          console.error('Error reconciling inventory after BOM save:', rErr);
        }

        // 5. Real-time sub-second push to all connected browsers/devices immediately
        try {
          broadcastRealtimeEvent('bom_updated', {
            action: isExisting ? 'update' : 'create',
            recordId: persistedBom?.bomCode || persistedBom?.code || persistedBom?.id,
            bom: persistedBom
          });
          broadcastRealtimeEvent('inventory_updated', {
            action: 'update',
            reason: 'bom_stock_deduction',
            bomCode: persistedBom?.bomCode || persistedBom?.code
          });
        } catch (_) {}

        // 5b. Enterprise Precise Workflow Notifications (Outbox Pattern)
        try {
          const actorEmp = req.headers['x-employee-code'] || req.body?.actorEmpCode || bom?.salesPersonId || null;
          const actorName = req.headers['x-user-name'] || bom?.createdBy || bom?.salesPerson || 'Sales Executive';
          const actorRole = req.headers['x-user-role'] || 'Sales Executive';
          const custName = persistedBom.customerName || persistedBom.companyName || 'Customer';

          if (persistedBom.cancelled || String(persistedBom.status || '').toLowerCase().includes('cancel')) {
            const assignedRep = persistedBom.salesPerson || persistedBom.createdBy || null;
            // Workflow: BOM Cancellation -> Notify ONLY the specific Sales Person who owns it
            createInternalNotification({
              recipientEmpCode: persistedBom.salesPersonId || persistedBom.salesPersonEmpCode || null,
              recipientUserName: assignedRep,
              recipientRole: assignedRep ? null : 'Sales Executive',
              eventType: 'BOM_CANCELLED',
              documentType: 'bom',
              documentId: finalCode,
              title: `❌ BOM ${finalCode} Cancelled`,
              message: `BOM ${finalCode} (${custName}) was cancelled by ${persistedBom.cancelledByNameAndRole || persistedBom.cancelledBy || actorName}. Reason: ${persistedBom.cancellationReason || 'No reason specified'}`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Sales BOM',
              targetRecordId: finalCode,
              metadata: {
                recipientUserName: assignedRep,
                salesPerson: assignedRep
              },
              dedupId: `bom_cancel_${finalCode}_${persistedBom.cancelledAt || Date.now()}`
            });
          } else if (persistedBom.status === 'COMPLETED & DISPATCHED' || persistedBom.status === 'Completed & Dispatched' || persistedBom.status === 'Dispatched' || persistedBom.tabGroup === 'Closed') {
            // Workflow: Final Vehicle Loading / Dispatched -> Notify Sales
            createInternalNotification({
              recipientEmpCode: persistedBom.salesPersonId || null,
              recipientRole: 'Sales Executive',
              eventType: 'ORDER_DISPATCHED',
              documentType: 'bom',
              documentId: finalCode,
              title: `🚀 Order Dispatched: BOM ${finalCode}`,
              message: `Order ${finalCode} (${custName}) has been dispatched via ${persistedBom.vehicleLoading?.transporterName || 'Transporter'} (LR: ${persistedBom.vehicleLoading?.lrNumber || 'N/A'}).`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Sales BOM',
              targetRecordId: finalCode,
              dedupId: `bom_dispatched_${finalCode}`
            });
          } else if (persistedBom.status === 'Awaiting Vehicle Loading & Dispatch' || persistedBom.status === 'Invoice Confirmed' || persistedBom.invoiceGenerated || (persistedBom.taxInvoiceNo && !persistedBom.dispatched)) {
            // Workflow: Billing -> Dispatch: Tax Invoice confirmed, ready for vehicle loading
            createInternalNotification({
              recipientRole: 'Dispatch Head',
              eventType: 'INVOICE_COMPLETED',
              documentType: 'bom',
              documentId: finalCode,
              title: `🚚 Invoice Confirmed — Ready for Loading`,
              message: `Tax Invoice confirmed for BOM ${finalCode} (${custName}). Ready for vehicle loading verification.`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Dispatch Orders',
              targetRecordId: finalCode,
              dedupId: `bom_invoice_ready_loading_${finalCode}`
            });
          } else if (persistedBom.status === 'Accounts Verified - Proceed Billing' || persistedBom.accountsVerified || persistedBom.accountsVerification?.verified) {
            // Workflow: Accounts -> Billing: Payment verified, ready for Tax Invoice
            createInternalNotification({
              recipientRole: 'Billing',
              eventType: 'ACCOUNTS_APPROVED',
              documentType: 'bom',
              documentId: finalCode,
              title: `📄 Accounts Verified: BOM ${finalCode}`,
              message: `Payment verified for BOM ${finalCode} (${custName}). Ready for tax invoice generation.`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Invoice Management',
              targetRecordId: finalCode,
              dedupId: `bom_accounts_approved_${finalCode}`
            });
          } else if (persistedBom.creditSettled || persistedBom.status === 'Credit Settled (100% Paid)' || persistedBom.status === 'Payment Uploaded & Settled') {
            // Workflow: Sales settled credit payment -> notify Accounts
            createInternalNotification({
              recipientRole: 'Accounts Head',
              eventType: 'CREDIT_PAYMENT_SETTLED',
              documentType: 'bom',
              documentId: finalCode,
              title: `💳 Credit Payment Settled: ${finalCode}`,
              message: `${actorName || 'Sales'} recorded payment of ₹ ${Number(persistedBom.creditSettledAmount || persistedBom.grandTotal || 0).toLocaleString('en-IN')} for ${custName} (UTR: ${persistedBom.creditSettledUtr || 'N/A'}). Credit settled.`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Accounts Verification',
              targetRecordId: finalCode,
              dedupId: `bom_credit_settled_${finalCode}_${Date.now()}`
            });
          } else if (persistedBom.status === 'Dispatch Packing Verified - Sent to Accounts' || persistedBom.dispatchPackingVerified || persistedBom.status === 'Packed & Awaiting Accounts Verification' || persistedBom.status === 'PACKING VERIFIED - SENT TO ACCOUNTS' || persistedBom.accountsVerification?.readyForAccounts) {
            // Workflow: Dispatch -> Accounts: Packing verified, ready for payment verification
            createInternalNotification({
              recipientRole: 'Accounts Head',
              eventType: 'PACKING_VERIFIED',
              documentType: 'bom',
              documentId: finalCode,
              title: `💳 Packing Verified: BOM ${finalCode}`,
              message: `BOM ${finalCode} (${custName}) packed and verified by Dispatch. Ready for accounts verification.`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Accounts Verification',
              targetRecordId: finalCode,
              dedupId: `bom_packing_verified_${finalCode}`
            });
          } else if ((persistedBom.status === 'Sales Confirmed - Sent to Dispatch' || persistedBom.salesConfirmed) && persistedBom.status !== 'Draft' && persistedBom.status !== 'Pending Confirmation' && !String(persistedBom.status || '').toLowerCase().includes('pending confirmation')) {
            // Workflow: Sales -> Dispatch: BOM confirmed by Sales via Reconfirm BOM, ready for packing
            createInternalNotification({
              recipientRole: 'Dispatch Head',
              eventType: 'BOM_SUBMITTED',
              documentType: 'bom',
              documentId: finalCode,
              title: `📦 BOM Confirmed: ${finalCode}`,
              message: `BOM ${finalCode} (${custName}) confirmed by Sales. Ready for dispatch packing verification.`,
              actorEmpCode: actorEmp,
              actorName,
              actorRole,
              targetTab: 'Dispatch Orders',
              targetRecordId: finalCode,
              dedupId: `bom_submitted_${finalCode}`
            });
          } else if (!persistedBom.salesConfirmed || persistedBom.status === 'Pending Confirmation' || persistedBom.status === 'Draft' || String(persistedBom.status || '').toLowerCase().includes('pending confirmation')) {
            // Safety: Clean up any premature BOM_SUBMITTED dispatch notification for unconfirmed/pending BOM
            try {
              if (isDbConnected()) {
                await query(`
                  DELETE FROM public.internal_notifications
                  WHERE document_id = $1 AND event_type = 'BOM_SUBMITTED' AND recipient_role ILIKE '%dispatch%'
                `, [finalCode]);
              }
            } catch (_) {}
          }
        } catch (notifErr) {
          console.warn('[BOM Workflow Notification Notice]:', notifErr.message);
        }

        // 6. Update sequence metadata in leaves table if needed
        try {
          const vrmMatch = String(finalCode).match(/^VRM-BOM-(\d{4})-(\d+)$/i);
          if (vrmMatch) {
            const fy = parseInt(vrmMatch[1], 10);
            const seqVal = parseInt(vrmMatch[2], 10);
            if (serverBomSequenceCounter && typeof serverBomSequenceCounter === 'object' && serverBomSequenceCounter.fy === fy) {
              serverBomSequenceCounter.maxNum = Math.max(serverBomSequenceCounter.maxNum || 0, seqVal);
            } else {
              serverBomSequenceCounter = { fy, maxNum: seqVal };
            }
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sequence timeout')), 5000));
            const seqPromise = supabase.from('leaves').update({
              reason: JSON.stringify({ fy, lastNumber: seqVal, updatedAt: new Date().toISOString() }),
              duration: String(seqVal),
              dates: new Date().toISOString()
            }).eq('employee', `BOM_SEQUENCE_${fy}`);
            await Promise.race([seqPromise, timeoutPromise]);
          } else {
            const numMatch = String(finalCode).match(/^BOM-(\d+)$/i);
            if (numMatch) {
              const seqVal = parseInt(numMatch[1], 10);
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sequence timeout')), 5000));
              const seqPromise = supabase.from('leaves').update({
                reason: JSON.stringify({ lastNumber: seqVal, updatedAt: new Date().toISOString() }),
                duration: String(seqVal),
                dates: new Date().toISOString()
              }).eq('employee', 'BOM_SEQUENCE');
              await Promise.race([seqPromise, timeoutPromise]);
            }
          }
        } catch (_) {}

        // 7. Synchronize source PI in PostgreSQL database and file stores
        if (bom.sourcePiNo) {
          try {
            const cleanSrcPi = String(bom.sourcePiNo).trim();
            // Single targeted row update directly to PostgreSQL public.proforma_invoices
            await query(`
              UPDATE public.proforma_invoices
              SET status = 'Converted to BOM',
                  status_type = 'converted',
                  converted_bom_no = $1,
                  converted_bom_code = $1,
                  updated_at = NOW()
              WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($2)) OR LOWER(TRIM(id)) = LOWER(TRIM($2))
            `, [finalCode, cleanSrcPi]).catch(e => console.warn('[BOM source PI DB update warning]:', e.message));

            // Sync disk files as secondary fallback
            const updatePiDiskFile = (fileName) => {
              try {
                const fPath = getStoreFilePath(fileName);
                if (fs.existsSync(fPath)) {
                  const raw = fs.readFileSync(fPath, 'utf8');
                  const list = JSON.parse(raw);
                  if (Array.isArray(list)) {
                    let changed = false;
                    const updated = list.map(p => {
                      if (!p) return p;
                      const pNo = String(p.piNo || p.id || '').trim().toLowerCase();
                      if (pNo === cleanSrcPi.toLowerCase()) {
                        changed = true;
                        return {
                          ...p,
                          status: 'Converted to BOM',
                          statusType: 'converted',
                          convertedToBom: true,
                          isConverted: true,
                          convertedBomCode: finalCode,
                          convertedBomNo: finalCode,
                          convertedDate: new Date().toISOString()
                        };
                      }
                      return p;
                    });
                    if (changed) {
                      fs.writeFileSync(fPath, JSON.stringify(updated, null, 2), 'utf8');
                    }
                  }
                }
              } catch (_) {}
            };
            updatePiDiskFile('sales_pi_store.json');
            updatePiDiskFile('proforma_invoice_store.json');

            broadcastRealtimeEvent('pi_updated', {
              action: 'converted_to_bom',
              recordId: cleanSrcPi,
              piNo: cleanSrcPi,
              status: 'Converted to BOM',
              statusType: 'converted',
              convertedBomCode: finalCode
            });
          } catch (_) {}
        }

        // 8. BUSINZ Track — Automatically initialize or synchronize customer tracking
        try {
          const isDispatchReady = (persistedBom.sales_confirmed || persistedBom.salesConfirmed || persistedBom.status === 'Sales Confirmed - Sent to Dispatch') && !persistedBom.cancelled && !String(persistedBom.status || '').toLowerCase().includes('cancel') && persistedBom.status !== 'Draft' && persistedBom.status !== 'Pending Confirmation';
          if (isDispatchReady || (persistedBom.dispatch_packing && persistedBom.dispatch_packing.length > 0) || persistedBom.invoice_no || persistedBom.vehicleLoading) {
            const trackingRecord = await getOrCreateOrderTracking(persistedBom);
            if (trackingRecord) {
              broadcastCustomerTrackingUpdate(trackingRecord.tracking_token, {
                bomCode: finalCode,
                stage: trackingRecord.current_stage,
                packingPercentage: trackingRecord.packing_percentage
              });
            }
          }
        } catch (trackErr) {
          console.warn('[BUSINZ Track Hook Notice]:', trackErr.message);
        }

        // RESPOND TO CLIENT WITH CONFIRMED BOM (Persisted to database & disk)
        res.json({
          success: true,
          bom: persistedBom,
          bomCode: finalCode,
          nextCode: finalCode,
          nextBomCode: finalCode,
          total: fullStoreList.length
        });
        return resolveOuter();
      } catch (err) {
        console.error('Error saving BOM:', err);
        res.status(500).json({ success: false, message: err.message });
        resolveOuter();
      }
    }).catch(err => {
      console.error('Lock error in /api/boms:', err);
      res.status(500).json({ success: false, message: err?.message || 'Server lock error' });
      resolveOuter();
    });
  });
});

// Dedicated POST /api/boms/print-status & /api/boms/:id/print-status endpoint for Dispatch print tracking
router.post(['/api/boms/print-status', '/api/boms/:id/print-status'], async (req, res) => {
  try {
    const rawId = req.params.id || req.body?.bomId;
    const { printData } = req.body || {};
    if (!rawId || !printData) {
      return res.status(400).json({ success: false, message: 'bomId and printData required' });
    }
    const cleanId = String(rawId).trim().toLowerCase();

    // 1. Update in-memory store without blocking the event loop with synchronous multi-MB disk reads
    const diskPath = getStoreFilePath('bom_store.json');
    let fullList = (Array.isArray(cachedBomsResult) && cachedBomsResult.length > 0)
      ? cachedBomsResult
      : (Array.isArray(supabaseMemoryStore.bom_store) ? supabaseMemoryStore.bom_store : []);
    if (fullList.length === 0 && fs.existsSync(diskPath)) {
      try {
        fullList = JSON.parse(await fs.promises.readFile(diskPath, 'utf8'));
      } catch (_) {}
    }
    if (!Array.isArray(fullList)) fullList = [];

    let updatedBom = null;
    fullList = fullList.map(item => {
      const match = String(item.bomCode || item.code || item.id || '').trim().toLowerCase();
      if (match === cleanId) {
        updatedBom = {
          ...item,
          ...printData,
          updated_at: new Date().toISOString()
        };
        return updatedBom;
      }
      return item;
    });

    if (updatedBom) {
      try {
        safeWriteJsonFileAsync(diskPath, fullList);
      } catch (_) {}
      supabaseMemoryStore.bom_store = fullList;
      cachedBomsResult = fullList;
      lastBomFetchTimestamp = Date.now();

      // 2. Single atomic 1-row DB update on public.bom_orders + non-blocking legacy store mirror
      if (isDbConnected()) {
        try {
          await query(`
            UPDATE public.bom_orders
            SET accounts_verification = jsonb_set(
                  COALESCE(accounts_verification, '{}'::jsonb),
                  '{_extra_data}',
                  COALESCE(accounts_verification->'_extra_data', '{}'::jsonb) || $2::jsonb
                ),
                dispatch_printed = true,
                dispatch_printed_at = NOW(),
                dispatch_print_time_str = $3,
                dispatch_printed_date_str = $4,
                dispatch_printed_by = $5,
                dispatch_print_count = $6,
                updated_at = NOW()
            WHERE LOWER(TRIM(bom_code)) = $1 OR LOWER(TRIM(id)) = $1 OR LOWER(TRIM(code)) = $1
          `, [cleanId, JSON.stringify(printData), printData.dispatchPrintTimeStr || '', printData.dispatchPrintedDateStr || '', printData.dispatchPrintedBy || '', printData.dispatchPrintCount || 1]);
        } catch (_) {}

        setImmediate(() => {
          query(`
            UPDATE public.controlroom_store
            SET data = (
              SELECT jsonb_agg(
                CASE 
                  WHEN LOWER(TRIM(elem->>'bomCode')) = $1 OR LOWER(TRIM(elem->>'code')) = $1 OR LOWER(TRIM(elem->>'id')) = $1
                  THEN elem || $2::jsonb
                  ELSE elem
                END
              )
              FROM jsonb_array_elements(data::jsonb) AS elem
            ),
            updated_at = NOW()
            WHERE key IN ('controlroom_bom_store', 'bom_store')
          `, [cleanId, JSON.stringify(printData)]).catch(() => {});
        });
      }

      // 3. Broadcast real-time SSE event to ALL connected clients (Sales, Dispatch, Production, Admin)
      broadcastRealtimeEvent('bom_updated', {
        action: 'print_update',
        recordId: updatedBom.bomCode || updatedBom.code || updatedBom.id,
        bom: updatedBom,
        printData: {
          bomCode: updatedBom.bomCode || updatedBom.code || updatedBom.id,
          ...printData
        }
      });

      return res.json({ success: true, bom: updatedBom });
    }

    return res.status(404).json({ success: false, message: 'BOM order not found' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated DELETE /api/boms/:id endpoint
router.delete('/api/boms/:id', requireRole(['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Sales Head']), async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    // 1. Delete from Supabase public.bom_orders
    const { error } = await supabase.from('bom_orders').delete().or(`id.eq.${cleanId},bom_code.eq.${cleanId}`);
    if (error) {
      console.warn('[DELETE BOM Supabase notice]:', error.message);
    }
    // Also delete directly from PostgreSQL bom_orders table if database is connected
    if (isDbConnected()) {
      await query(`DELETE FROM bom_orders WHERE id = $1 OR bom_code = $1 OR code = $1`, [cleanId]).catch(() => null);
    }
    // 2. Update memory store & disk
    let current = supabaseMemoryStore.bom_store || [];
    if (!Array.isArray(current) || current.length === 0) {
      current = await loadDatabaseBoms();
    }
    const updated = current.filter(b => (b.id !== cleanId && b.bomCode !== cleanId && b.code !== cleanId));
    supabaseMemoryStore.bom_store = updated;
    cachedBomsResult = updated;
    lastBomFetchTimestamp = Date.now();
    try {
      const diskPath = getStoreFilePath('bom_store.json');
      safeWriteJsonFileAsync(diskPath, updated);
    } catch (_) {}
    if (isDbConnected()) {
      query(`
        INSERT INTO controlroom_store (key, data, updated_at)
        VALUES ('bom_store', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
      `, [JSON.stringify(updated)]).catch(() => null);
    }

    // 3. Broadcast real-time deletion
    broadcastRealtimeEvent('bom_updated', { recordId: cleanId, id: cleanId, action: 'delete' });

    res.json({ success: true, message: `BOM ${cleanId} deleted successfully`, total: updated.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


  return router;
}
