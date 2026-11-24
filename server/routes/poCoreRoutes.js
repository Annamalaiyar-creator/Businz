import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createPoCoreRouter(dependencies) {
  const router = Router();
  const {
    loadLocalPOs,
    saveLocalPOs,
    broadcastRealtimeEvent,
    createInternalNotification,
    extractMaxSequence,
    formatSequenceCode,
    getFinancialYear,
    getNextSequence,
    isDbConnected,
    query,
    supabaseMemoryStore
  } = dependencies;

// Endpoint to create a new Purchase Order in BUSINZ Authoritative Store (Native BUSINZ Store)
router.post('/api/purchaseorders', async (req, res) => {
  try {
    const parseDateToYYYYMMDD = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
      return d.toISOString().split('T')[0];
    };

    const delAddressStr = String(req.body.deliveryAddress || '').trim();
    const billAddressStr = String(req.body.billingAddress || '').trim();
    const notesStr = String(req.body.notes || '').trim();
    const termsStr = String(req.body.terms || '').trim();

    const statusRequested = req.body.status || 'Draft';
    const isDraft = statusRequested === 'Draft' || statusRequested === 'DRAFT';
    const isPendingApproval = statusRequested === 'Draft / Pending Approval' || statusRequested === 'WAITING FOR APPROVAL';
    const isNoApproval = String(req.body.approvalRequired).toUpperCase() === 'NO' || statusRequested === 'OPEN';

    // Calculate total ordered quantity from line items
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    let calcTotalOrdered = 0;
    const processedItems = rawItems.map(item => {
      const q = Number(item.qty || item.quantity || 1);
      const parsedRate = parseFloat(String(item.rate ?? item.unitPrice ?? item.unit_price ?? item.item_rate ?? item.purchaseRate ?? item.price ?? 0).replace(/[^0-9.-]/g, '')) || 0;
      calcTotalOrdered += q;
      return {
        ...item,
        name: item.itemName || item.name || item.description || 'General Item',
        qty: q,
        rate: parsedRate,
        tax: Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18),
        previouslyReceived: Number(item.previouslyReceived || 0),
        remainingQty: Number(item.remainingQty !== undefined ? item.remainingQty : q)
      };
    });

    const poNumber = req.body.poNo || `PO-2026-${Date.now()}`;
    const localPOObj = {
      id: poNumber,
      poNo: poNumber,
      vendor: req.body.vendor || 'Fresh Vendor',
      branch: req.body.branch || '',
      contactPerson: req.body.contactPerson || '',
      contactNo: req.body.contactNo || '',
      email: req.body.email || '',
      gstNo: req.body.gstNo || '',
      deliveryType: req.body.deliveryType || 'Organization',
      deliveryAddress: delAddressStr,
      billingAddress: billAddressStr,
      poDate: parseDateToYYYYMMDD(req.body.poDate),
      deliveryDate: parseDateToYYYYMMDD(req.body.deliveryDate),
      paymentTerms: req.body.paymentTerms || '',
      purchaser: req.body.purchaser || '',
      shipmentPref: req.body.shipmentPref || '',
      currency: req.body.currency || 'INR',
      project: req.body.project || '',
      priority: req.body.priority || 'Medium',
      shippingCharges: Number(req.body.shippingCharges || 0),
      otherCharges: Number(req.body.otherCharges || 0),
      discountPct: Number(req.body.discountPct || 0),
      notes: notesStr,
      terms: termsStr,
      approvalRequired: req.body.approvalRequired || 'YES',
      approver: req.body.approver || '',
      approvalPriority: req.body.approvalPriority || '',
      amount: req.body.amount || '₹0.00',
      status: isNoApproval ? 'OPEN' : (isPendingApproval ? 'Draft / Pending Approval' : 'Draft'),
      statusType: isNoApproval ? 'approved' : (isPendingApproval ? 'pending' : 'draft'),
      items: processedItems,
      totalOrderedQty: calcTotalOrdered,
      totalReceivedQty: 0,
      totalRemainingQty: calcTotalOrdered,
      grnCount: 0,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const localPOs = loadLocalPOs();
    const existingIdx = localPOs.findIndex(p => p.poNo === localPOObj.poNo || p.id === localPOObj.id);
    if (existingIdx !== -1) {
      localPOs[existingIdx] = { ...localPOs[existingIdx], ...localPOObj };
    } else {
      localPOs.unshift(localPOObj);
    }
    saveLocalPOs(localPOs);

    // ⚡ Real-Time Workflow Notification to CEO for Review & Approval
    try {
      const actEmp = req.headers['x-employee-code'] || req.body.actorEmpCode || req.body.purchaser || null;
      const actName = req.headers['x-user-name'] || req.body.actorName || req.body.purchaser || 'Procurement';
      const actRole = req.headers['x-user-role'] || req.body.actorRole || 'Procurement';
      const vendorName = localPOObj.vendor || 'Vendor';

      const needsApproval = !isDraft && (isPendingApproval || localPOObj.status === 'Draft / Pending Approval' || localPOObj.statusType === 'pending' || String(localPOObj.approvalRequired).toUpperCase() === 'YES');

      if (needsApproval && !isNoApproval) {
        createInternalNotification({
          recipientRole: 'CEO',
          eventType: 'PO_SUBMITTED_FOR_APPROVAL',
          documentType: 'PO',
          documentId: localPOObj.poNo,
          title: `📋 PO ${localPOObj.poNo} Awaiting CEO Approval`,
          message: `Purchase Order ${localPOObj.poNo} for ${vendorName} (${localPOObj.amount}) has been raised by ${actName} and is awaiting your review & approval.`,
          actorEmpCode: actEmp,
          actorName: actName,
          actorRole: actRole,
          targetTab: 'Purchase Orders',
          targetRecordId: localPOObj.poNo,
          metadata: {
            poNo: localPOObj.poNo,
            vendor: vendorName,
            amount: localPOObj.amount,
            purchaser: localPOObj.purchaser || actName,
            status: localPOObj.status,
            filterTab: 'Pending MD Approval'
          },
          dedupId: `po_pending_approval_${localPOObj.poNo}_${Date.now()}`
        });
      }

      // Broadcast real-time PO update event to all connected clients
      broadcastRealtimeEvent('purchase_order_created', { po: localPOObj });
      broadcastRealtimeEvent('controlroom_po_updated', { po: localPOObj });
    } catch (notifErr) {
      console.warn('[PO Notification Warning]:', notifErr.message);
    }

    return res.json({
      success: true,
      message: isPendingApproval 
        ? 'PO created in BUSINZ as Draft & awaiting Approval!' 
        : 'PO created and issued in BUSINZ successfully!',
      purchaseorder: localPOObj,
      po: localPOObj,
      id: localPOObj.id,
      poNo: localPOObj.poNo
    });
  } catch (err) {
    console.error('[BUSINZ PO CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create PO in BUSINZ: ' + err.message });
  }
});
// Returns next sequential PO number matching unified sequence VRM-PO-[YYYY]-[SEQ] (e.g. VRM-PO-2026-01)
router.get('/api/next-po-number', async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];

    // 1. Query PostgreSQL purchase_orders if connected
    if (isDbConnected()) {
      try {
        const dbRes = await query(`
          SELECT po_no FROM public.purchase_orders
          WHERE po_no ~ '^VRM-PO-[0-9]{4}-[0-9]+$'
        `).catch(() => null);
        if (dbRes?.rows) records.push(...dbRes.rows);
      } catch (_) {}
    }

    // 2. Scan local po_store.json
    const localPOs = loadLocalPOs();
    if (Array.isArray(localPOs)) records.push(...localPOs);

    // 3. Scan memory store
    if (supabaseMemoryStore.po_store && Array.isArray(supabaseMemoryStore.po_store)) {
      records.push(...supabaseMemoryStore.po_store);
    }

    const { code, nextNum } = getNextSequence('PO', records);
    res.json({
      nextPoNo: code,
      nextPoNumber: code,
      nextNum,
      financialYear: fy
    });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextPoNo: `VRM-PO-${fy}-01`, nextPoNumber: `VRM-PO-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

let serverInvSequenceCounter = null;
let serverInvReservationLock = Promise.resolve();

const getOrReserveNextInvAtomic = async (commit = false) => {
  return new Promise((resolve, reject) => {
    serverInvReservationLock = serverInvReservationLock.then(async () => {
      try {
        const fy = getFinancialYear();
        let records = [];

        // 1. Query PostgreSQL invoices if available
        if (isDbConnected()) {
          try {
            const dbRes = await query(`
              SELECT invoice_no FROM public.tax_invoices
              WHERE invoice_no ~ '^VRM-INV-[0-9]{4}-[0-9]+$'
            `).catch(() => null);
            if (dbRes?.rows) records.push(...dbRes.rows);

            // Also check bom_orders in PG for assigned invoice_no
            const bomDbRes = await query(`
              SELECT invoice_no FROM public.bom_orders
              WHERE invoice_no ~ '^VRM-INV-[0-9]{4}-[0-9]+$'
            `).catch(() => null);
            if (bomDbRes?.rows) records.push(...bomDbRes.rows);
          } catch (_) {}
        }

        // 2. Scan local invoice_store.json
        const invStorePath = getStoreFilePath('invoice_store.json');
        if (fs.existsSync(invStorePath)) {
          try {
            const localInvs = JSON.parse(fs.readFileSync(invStorePath, 'utf8'));
            if (Array.isArray(localInvs)) records.push(...localInvs);
          } catch (_) {}
        }
        if (supabaseMemoryStore.invoice_store && Array.isArray(supabaseMemoryStore.invoice_store)) {
          records.push(...supabaseMemoryStore.invoice_store);
        }

        // 3. Scan bom_store.json for any BOM that already has an assigned invoiceNo
        const bomStorePath = getStoreFilePath('bom_store.json');
        if (fs.existsSync(bomStorePath)) {
          try {
            const localBoms = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
            if (Array.isArray(localBoms)) {
              localBoms.forEach(b => {
                if (b && b.invoiceNo) records.push({ invNo: b.invoiceNo });
              });
            }
          } catch (_) {}
        }

        let maxSeq = extractMaxSequence('INV', fy, records);

        if (serverInvSequenceCounter !== null && serverInvSequenceCounter.fy === fy && serverInvSequenceCounter.maxNum > maxSeq) {
          maxSeq = serverInvSequenceCounter.maxNum;
        }

        const nextNum = maxSeq + 1;
        const nextInvCode = formatSequenceCode('INV', nextNum);

        if (commit) {
          serverInvSequenceCounter = { fy, maxNum: nextNum };
        }

        resolve({ success: true, nextInvNo: nextInvCode, nextInvoiceNumber: nextInvCode, nextNum, maxNum: nextNum, financialYear: fy });
      } catch (err) {
        const fy = getFinancialYear();
        resolve({ success: true, nextInvNo: `VRM-INV-${fy}-01`, nextInvoiceNumber: `VRM-INV-${fy}-01`, nextNum: 1, financialYear: fy });
      }
    }).catch(reject);
  });
};

  return router;
}
