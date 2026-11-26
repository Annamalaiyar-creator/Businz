import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';
import { invalidateBomsRouterCache } from './bomWorkflowRoutes.js';

export default function createInvoiceRouter(dependencies) {
  const router = Router();
  let cachedBomsResult = null;
  const {
    broadcastRealtimeEvent,
    getVerifiedUserSession,
    hasAnyUserRole,
    isDbConnected,
    saveDatabaseStore,
    query,
    supabaseMemoryStore
  } = dependencies;

// Endpoint to GET Sales Invoices strictly from BUSINZ Local Store & Database
router.get('/api/invoices', async (req, res) => {
  const getCleanLocalInvoices = () => {
    let raw = supabaseMemoryStore['invoice_store'];
    if (!raw || (Array.isArray(raw) && raw.length === 0)) {
      try {
        const filePath = getStoreFilePath('invoice_store.json');
        if (fs.existsSync(filePath)) {
          raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (e) {}
    }
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Object.keys(raw).length > 0 ? [raw] : []);
    return list.map(inv => {
      if (!inv || typeof inv !== 'object') return inv;
      if (inv.vehicleLoading?.lrCopyDoc?.dataUrl && inv.vehicleLoading.lrCopyDoc.dataUrl.length > 50000) {
        const copy = { ...inv, vehicleLoading: { ...inv.vehicleLoading, lrCopyDoc: { ...inv.vehicleLoading.lrCopyDoc } } };
        delete copy.vehicleLoading.lrCopyDoc.dataUrl;
        return copy;
      }
      return inv;
    });
  };

  const localInvoices = getCleanLocalInvoices();
  res.json(localInvoices);
});

// Endpoint to CREATE a Sales Invoice in BUSINZ Authoritative Store (Native BUSINZ Store)
router.post('/api/invoices', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['billing', 'accounts', 'finance'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to create or update invoices.`
    });
  }
  try {
    const normalizeInvoiceDate = (dateVal) => {
      if (!dateVal) return new Date().toISOString().split('T')[0];
      if (typeof dateVal === 'string') {
        const cleaned = dateVal.trim().replace(/Sept/i, 'Sep');
        const dmy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
          return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        }
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      return new Date().toISOString().split('T')[0];
    };

    const invDateStr = normalizeInvoiceDate(req.body.date);

    const assignedInvNo = (req.body.invNo && req.body.invNo !== 'Pending Confirmation')
      ? req.body.invNo
      : (req.body.invoiceNo && req.body.invoiceNo !== 'Pending Confirmation')
        ? req.body.invoiceNo
        : `INV-${Date.now()}`;

    const invRecord = {
      ...req.body,
      id: req.body.id || assignedInvNo,
      invNo: assignedInvNo,
      invoiceNo: assignedInvNo,
      date: invDateStr,
      status: req.body.status || 'Invoice Confirmed',
      pay: req.body.pay || 'Completed & Locked',
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const invStorePath = getStoreFilePath('invoice_store.json');
    let localInvList = [];
    if (fs.existsSync(invStorePath)) {
      try { localInvList = JSON.parse(fs.readFileSync(invStorePath, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(localInvList)) localInvList = [];

    const targetBomCode = invRecord.bomCode || invRecord.poNo;

    // Prevent duplicate invoices for the same BOM
    if (targetBomCode) {
      const existingDuplicate = localInvList.find(i =>
        i &&
        (i.bomCode === targetBomCode || i.poNo === targetBomCode) &&
        i.invNo !== assignedInvNo &&
        i.id !== (invRecord.id || assignedInvNo)
      );
      if (existingDuplicate) {
        return res.status(409).json({
          success: false,
          error: `[Duplicate Invoice] Invoice ${existingDuplicate.invNo || existingDuplicate.id} already exists for BOM ${targetBomCode}. Duplicate invoices are not permitted.`
        });
      }
    }

    const matchIdx = localInvList.findIndex(i =>
      (invRecord.invNo && i.invNo === invRecord.invNo) ||
      (invRecord.id && i.id === invRecord.id) ||
      (targetBomCode && (i.bomCode === targetBomCode || i.poNo === targetBomCode))
    );
    if (matchIdx !== -1) {
      localInvList[matchIdx] = { ...localInvList[matchIdx], ...invRecord };
    } else {
      localInvList.unshift(invRecord);
    }
    fs.writeFileSync(invStorePath, JSON.stringify(localInvList, null, 2), 'utf8');
    if (!supabaseMemoryStore['invoice_store']) supabaseMemoryStore['invoice_store'] = [];
    supabaseMemoryStore['invoice_store'] = localInvList;
    if (isDbConnected()) {
      await saveDatabaseStore('invoice_store', localInvList);
    }

    // Synchronize matching BOM record with assigned invoice
    if (targetBomCode) {
      try {
        const bomPath = getStoreFilePath('bom_store.json');
        let diskBoms = [];
        if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
          diskBoms = supabaseMemoryStore.bom_store;
        } else if (fs.existsSync(bomPath)) {
          try { diskBoms = JSON.parse(fs.readFileSync(bomPath, 'utf8')); } catch (_) {}
        }
        if (Array.isArray(diskBoms)) {
          let bomChanged = false;
          let matchedBom = null;
          diskBoms = diskBoms.map(b => {
            if (b && (b.bomCode === targetBomCode || b.code === targetBomCode || b.id === targetBomCode)) {
              bomChanged = true;
              const nextStatus = (b.status === 'Completed' || b.status === 'COMPLETED & DISPATCHED' || b.status === 'Fully Dispatched & Delivered')
                ? b.status
                : 'Awaiting Vehicle Loading & Dispatch';
              matchedBom = {
                ...b,
                invoiceNo: assignedInvNo,
                invoiceConfirmed: true,
                isAccountsDone: true,
                accountsVerification: {
                  ...(b.accountsVerification || {}),
                  verified: true
                },
                status: nextStatus
              };
              return matchedBom;
            }
            return b;
          });
          if (bomChanged) {
            fs.writeFileSync(bomPath, JSON.stringify(diskBoms, null, 2), 'utf8');
            supabaseMemoryStore.bom_store = diskBoms;
            cachedBomsResult = diskBoms;
            if (isDbConnected()) {
              try {
                await query(
                  `UPDATE public.bom_orders
                   SET invoice_no = $1,
                       invoice_confirmed = true,
                       accounts_verification = jsonb_set(
                         COALESCE(accounts_verification, '{}'::jsonb),
                         '{verified}',
                         'true'::jsonb,
                         true
                       ),
                       status = CASE
                         WHEN status ILIKE '%complete%' OR status ILIKE '%dispatched%' OR status ILIKE '%delivered%' THEN status
                         ELSE 'Awaiting Vehicle Loading & Dispatch'
                       END,
                       updated_at = NOW()
                   WHERE bom_code = $2 OR code = $2`,
                  [assignedInvNo, targetBomCode]
                );
                await saveDatabaseStore('bom_store', diskBoms);
              } catch (dbBomErr) {
                console.warn('[POST /api/invoices BOM DB update warning]:', dbBomErr?.message);
              }
            }
            if (matchedBom) {
              broadcastRealtimeEvent('bom_updated', { action: 'update', recordId: targetBomCode, bom: matchedBom });
            }
          }
        }
      } catch (bErr) {
        console.warn('Error linking BOM in /api/invoices:', bErr);
      }
    }

    try {
      broadcastRealtimeEvent('invoice_updated', { action: 'create', recordId: invRecord?.invNo || invRecord?.id, invoice: invRecord });
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Invoice saved in BUSINZ successfully!',
      invoice: invRecord
    });
  } catch (err) {
    console.error('[BUSINZ INVOICE CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create invoice in BUSINZ: ' + err.message });
  }
});

// Authoritative endpoint to complete an Invoice & advance its BOM to "Awaiting Vehicle Loading & Dispatch"
router.post('/api/invoices/complete', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  if (!hasAnyUserRole(session.role, ['billing', 'accounts', 'finance'])) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Role "${session.role}" is not authorized to complete invoices.`
    });
  }

  try {
    const body = req.body || {};
    const assignedInvNo = (body.invNo && body.invNo !== 'Pending Confirmation')
      ? body.invNo
      : (body.invoiceNo && body.invoiceNo !== 'Pending Confirmation')
        ? body.invoiceNo
        : `VRM-INV-${Date.now()}`;
    const targetBomCode = String(body.bomCode || body.poNo || '').trim();
    const attachedDocs = Array.isArray(body.attachedInvoiceDocs) ? body.attachedInvoiceDocs : [];
    const nowIso = new Date().toISOString();

    const invRecord = {
      ...body,
      id: body.id || assignedInvNo,
      invNo: assignedInvNo,
      invoiceNo: assignedInvNo,
      bomCode: targetBomCode,
      poNo: targetBomCode,
      status: 'Invoice Confirmed',
      pay: 'Completed & Locked',
      match: 'Matched',
      invoiceConfirmed: true,
      invoiceConfirmedAt: nowIso,
      confirmedBy: session.name || 'Billing & Invoice Exec',
      attachedInvoiceDocs: attachedDocs,
      updatedAt: nowIso
    };

    // 1. Persist in invoice_store (memory + disk + DB)
    const invStorePath = getStoreFilePath('invoice_store.json');
    let localInvList = Array.isArray(supabaseMemoryStore['invoice_store']) ? [...supabaseMemoryStore['invoice_store']] : [];
    if (localInvList.length === 0 && fs.existsSync(invStorePath)) {
      try { localInvList = JSON.parse(fs.readFileSync(invStorePath, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(localInvList)) localInvList = [];

    const matchIdx = localInvList.findIndex(i =>
      i && (
        (assignedInvNo && (i.invNo === assignedInvNo || i.invoiceNo === assignedInvNo || i.id === assignedInvNo)) ||
        (targetBomCode && (i.bomCode === targetBomCode || i.poNo === targetBomCode))
      )
    );
    if (matchIdx !== -1) {
      localInvList[matchIdx] = { ...localInvList[matchIdx], ...invRecord };
    } else {
      localInvList.unshift(invRecord);
    }
    try { fs.writeFileSync(invStorePath, JSON.stringify(localInvList, null, 2), 'utf8'); } catch (_) {}
    supabaseMemoryStore['invoice_store'] = localInvList;
    if (isDbConnected()) {
      await saveDatabaseStore('invoice_store', localInvList).catch(() => {});
    }

    // 2. Update public.bom_orders directly in PostgreSQL & memory store
    if (targetBomCode) {
      if (isDbConnected()) {
        await query(
          `UPDATE public.bom_orders
           SET invoice_no = $1,
               invoice_confirmed = true,
               stock_deducted = true,
               stock_deduction_date = COALESCE(stock_deduction_date, NOW()),
               status = CASE
                 WHEN status ILIKE '%complete%' OR status ILIKE '%dispatched%' OR status ILIKE '%delivered%' THEN status
                 ELSE 'Awaiting Vehicle Loading & Dispatch'
               END,
               accounts_verification = jsonb_set(
                 jsonb_set(
                   COALESCE(accounts_verification, '{}'::jsonb),
                   '{verified}',
                   'true'::jsonb,
                   true
                 ),
                 '{_extra_data}',
                 COALESCE(accounts_verification->'_extra_data', '{}'::jsonb) || $2::jsonb,
                 true
               ),
               updated_at = NOW()
           WHERE bom_code = $3 OR code = $3 OR id = $3`,
          [
            assignedInvNo,
            JSON.stringify({
              invoiceConfirmedAt: nowIso,
              invoiceNo: assignedInvNo,
              attachedInvoiceDocs: attachedDocs
            }),
            targetBomCode
          ]
        );
      }

      if (Array.isArray(supabaseMemoryStore.bom_store)) {
        supabaseMemoryStore.bom_store = supabaseMemoryStore.bom_store.map(b => {
          if (b && (b.bomCode === targetBomCode || b.code === targetBomCode || b.id === targetBomCode)) {
            const nextStatus = (b.status === 'Completed' || b.status === 'COMPLETED & DISPATCHED' || b.status === 'Fully Dispatched & Delivered')
              ? b.status
              : 'Awaiting Vehicle Loading & Dispatch';
            return {
              ...b,
              invoiceNo: assignedInvNo,
              invoiceConfirmed: true,
              invoiceConfirmedAt: b.invoiceConfirmedAt || nowIso,
              attachedInvoiceDocs: attachedDocs,
              status: nextStatus
            };
          }
          return b;
        });
      }

      try {
        invalidateBomsRouterCache();
        broadcastRealtimeEvent('bom_updated', { action: 'update', recordId: targetBomCode });
      } catch (_) {}
    }

    try {
      broadcastRealtimeEvent('invoice_updated', { action: 'update', recordId: assignedInvNo, invoice: invRecord });
    } catch (_) {}

    return res.json({ success: true, invoice: invRecord });
  } catch (err) {
    console.error('[POST /api/invoices/complete ERROR]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

  return router;
}
