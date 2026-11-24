import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createPoWorkflowRouter(dependencies) {
  const router = Router();
  const {
    loadLocalGRNs,
    loadLocalPOs,
    loadLocalItems,
    loadLocalRawMaterials,
    saveLocalGRNs,
    saveLocalPOs,
    saveLocalItems,
    saveLocalVendors,
    broadcastRealtimeEvent,
    requireRole,
    createInternalNotification,
    getDatabaseStore,
    saveDatabaseStore,
    pushStoreToSupabase,
    supabaseMemoryStore
  } = dependencies;

// Real-time synchronization endpoint retrieving purchase order details strictly from BUSINZ local stores
router.get('/api/purchaseorders/{*id}', async (req, res) => {
  const rawId = req.params.id;
  const poNo = decodeURIComponent(Array.isArray(rawId) ? rawId.join('/') : (rawId || ''));

  const localGRNs = loadLocalGRNs();
  const matchingGRNs = localGRNs.filter(g => {
    const ref = (g.poRef || g.poNo || g.poId || '').toLowerCase();
    const target = poNo.toLowerCase();
    return ref === target || ref.includes(target) || target.includes(ref);
  });
  
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const targetClean = normalize(poNo);
  const matchedLocalPO = localPOs.find(p => 
    normalize(p.id) === targetClean || 
    normalize(p.poNo) === targetClean || 
    normalize(p.purchaseorder_number) === targetClean ||
    (p.poNo && normalize(p.poNo).includes(targetClean)) ||
    (targetClean && normalize(p.poNo).length > 0 && targetClean.includes(normalize(p.poNo)))
  );

  let sampleItems = [];
  if (matchedLocalPO && Array.isArray(matchedLocalPO.items) && matchedLocalPO.items.length > 0) {
    sampleItems = matchedLocalPO.items.map(it => ({
      id: it.id || it.itemId || `PO-ITEM-${Math.random()}`,
      name: it.name || it.itemName || 'Material Item',
      description: it.description || it.desc || '',
      account: it.account || 'Raw Material',
      quantity: Number(it.qty || it.quantity || 1),
      unit: it.unit || 'NOS',
      rate: Number(it.rate || it.unitPrice || 0),
      tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : 18
    }));
  } else {
    sampleItems = [];
  }

  const itemReceivedTotals = {};
  matchingGRNs.forEach(grn => {
    (grn.items || []).forEach((it, idx) => {
      const qty = Number(it.accepted !== undefined ? it.accepted : (it.now || 0));
      const idKey = it.id || it.itemId || it.lineItemId;
      const nameKey = (it.name || '').trim().toLowerCase();
      if (idKey) itemReceivedTotals[idKey] = (itemReceivedTotals[idKey] || 0) + qty;
      if (nameKey) itemReceivedTotals[nameKey] = (itemReceivedTotals[nameKey] || 0) + qty;
      itemReceivedTotals[`IDX-${idx}`] = (itemReceivedTotals[`IDX-${idx}`] || 0) + qty;
    });
  });

  let totalOrderedQty = 0;
  let totalReceivedQty = 0;

  const items = sampleItems.map((item, idx) => {
    const idKey = item.id || item.itemId || item.lineItemId;
    const nameKey = (item.name || '').trim().toLowerCase();
    let prevReceived = 0;
    if (idKey && itemReceivedTotals[idKey] !== undefined) {
      prevReceived = itemReceivedTotals[idKey];
    } else if (nameKey && itemReceivedTotals[nameKey] !== undefined) {
      prevReceived = itemReceivedTotals[nameKey];
    } else if (itemReceivedTotals[`IDX-${idx}`] !== undefined) {
      prevReceived = itemReceivedTotals[`IDX-${idx}`];
    }
    const ordered = item.quantity || 0;
    const remaining = Math.max(0, ordered - prevReceived);

    totalOrderedQty += ordered;
    totalReceivedQty += Math.min(ordered, prevReceived);

    return {
      id: item.id || idKey || `PO-ITEM-${idx}`,
      name: item.name,
      sku: item.sku || `SKU-${101 + idx}`,
      description: item.description,
      account: item.account || 'Raw Material',
      qty: ordered,
      unit: item.unit || 'NOS',
      rate: item.rate || 0,
      tax: item.tax !== undefined ? item.tax : 18,
      previouslyReceived: prevReceived,
      remainingQty: remaining
    };
  });

  if (totalReceivedQty === 0 && matchingGRNs.length > 0) {
    matchingGRNs.forEach(grn => {
      (grn.items || []).forEach(it => {
        totalReceivedQty += Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      });
    });
  }

  const matchingClosedGRN = matchingGRNs.some(g => {
    const gs = String(g.status || '').toUpperCase();
    return gs.includes('CLOSED') || gs.includes('FULLY') || g.forceClosePO === true;
  });

  const isActuallyClosed = (totalOrderedQty > 0 && totalReceivedQty >= totalOrderedQty) || 
                          matchingClosedGRN || 
                          (matchedLocalPO && (matchedLocalPO.status === 'CLOSED / FULLY RECEIVED' || matchedLocalPO.statusType === 'closed'));
  const isPartiallyReceived = !isActuallyClosed && ((totalOrderedQty > 0 && totalReceivedQty > 0 && totalReceivedQty < totalOrderedQty) || (matchedLocalPO && (matchedLocalPO.status === 'OPEN / PARTIALLY RECEIVED' || matchedLocalPO.statusType === 'partially_received')));

  let statusType = matchedLocalPO?.statusType || 'draft';
  let statusText = matchedLocalPO?.status || 'Draft';

  if (isActuallyClosed) {
    statusType = 'closed';
    statusText = 'CLOSED / FULLY RECEIVED';
  } else if (isPartiallyReceived && totalReceivedQty > 0) {
    statusType = 'partially_received';
    statusText = 'OPEN / PARTIALLY RECEIVED';
  }

  return res.json({
    id: matchedLocalPO ? (matchedLocalPO.poNo || matchedLocalPO.id || poNo) : poNo,
    poNo: matchedLocalPO ? (matchedLocalPO.poNo || matchedLocalPO.purchaseorder_number || poNo) : poNo,
    vendor: matchedLocalPO ? matchedLocalPO.vendor : 'Vendor',
    branch: matchedLocalPO ? matchedLocalPO.branch : '',
    contactPerson: matchedLocalPO ? matchedLocalPO.contactPerson : '',
    contactNo: matchedLocalPO ? matchedLocalPO.contactNo : '',
    email: matchedLocalPO ? matchedLocalPO.email : '',
    gstNo: matchedLocalPO ? matchedLocalPO.gstNo : '',
    deliveryAddress: matchedLocalPO ? (matchedLocalPO.deliveryAddress || '—') : '—',
    billingAddress: matchedLocalPO ? (matchedLocalPO.billingAddress || '—') : '—',
    poDate: matchedLocalPO ? matchedLocalPO.poDate : '—',
    deliveryDate: matchedLocalPO ? matchedLocalPO.deliveryDate : '—',
    paymentTerms: matchedLocalPO ? matchedLocalPO.paymentTerms : 'Net 30 Days',
    purchaser: matchedLocalPO ? matchedLocalPO.purchaser : '—',
    shipmentPref: matchedLocalPO ? matchedLocalPO.shipmentPref : 'Road Transport',
    currency: matchedLocalPO ? matchedLocalPO.currency : 'INR',
    project: matchedLocalPO ? matchedLocalPO.project : '',
    priority: matchedLocalPO ? matchedLocalPO.priority : 'High',
    scope: matchedLocalPO ? matchedLocalPO.scope : 'Vendor Scope',
    transportName: matchedLocalPO ? matchedLocalPO.transportName : '',
    shippingCharges: matchedLocalPO ? (matchedLocalPO.shippingCharges || 0) : 0,
    otherCharges: matchedLocalPO ? (matchedLocalPO.otherCharges || 0) : 0,
    discountPct: matchedLocalPO ? (matchedLocalPO.discountPct || 0) : 0,
    notes: matchedLocalPO ? (matchedLocalPO.notes || '') : '',
    terms: matchedLocalPO ? (matchedLocalPO.terms || '') : '',
    approvalRequired: matchedLocalPO ? matchedLocalPO.approvalRequired : 'YES',
    approver: matchedLocalPO ? matchedLocalPO.approver : '',
    approvalPriority: matchedLocalPO ? matchedLocalPO.approvalPriority : '',
    items: items,
    totalOrderedQty: (matchedLocalPO && matchedLocalPO.totalOrderedQty) ? matchedLocalPO.totalOrderedQty : totalOrderedQty,
    totalReceivedQty: (matchedLocalPO && matchedLocalPO.totalReceivedQty) ? matchedLocalPO.totalReceivedQty : totalReceivedQty,
    totalRemainingQty: Math.max(0, (matchedLocalPO?.totalOrderedQty || totalOrderedQty) - totalReceivedQty),
    receivingProgressPct: totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : (isActuallyClosed ? '100.0' : 0),
    grnHistory: matchingGRNs,
    amount: matchedLocalPO ? matchedLocalPO.amount : '₹ 0.00',
    status: statusText,
    statusType: statusType,
    approvedBy: matchedLocalPO ? matchedLocalPO.approvedBy : undefined,
    approvalDate: matchedLocalPO ? matchedLocalPO.approvalDate : undefined,
    approvalTime: matchedLocalPO ? matchedLocalPO.approvalTime : undefined,
    approvalRemarks: matchedLocalPO ? matchedLocalPO.approvalRemarks : undefined,
    paymentDetails: matchedLocalPO ? matchedLocalPO.paymentDetails : undefined,
    proceedDetails: matchedLocalPO ? matchedLocalPO.proceedDetails : undefined
  });
});




// Endpoint to parse an uploaded digital PO PDF and extract form fields (never overwrites BUSINZ PO Number)
router.post('/api/po/parse-pdf', async (req, res) => {
  try {
    const rawBase64 = String(req.body?.fileBase64 || '').trim();
    if (!rawBase64) {
      return res.status(400).json({ ok: false, error: 'Missing PDF file data (fileBase64).' });
    }
    const base64Body = rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
    const pdfBuffer = Buffer.from(base64Body, 'base64');
    if (pdfBuffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ ok: false, error: 'PDF file exceeds the 10 MB size limit.' });
    }

    const { parsePoPdfBuffer } = await import('./poPdfParser.js');
    const result = await parsePoPdfBuffer(pdfBuffer);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[PO PDF Parse Error]', err?.message || err);
    return res.status(400).json({
      ok: false,
      error: err?.message || 'Unable to parse the uploaded PO PDF.'
    });
  }
});

// Endpoint to fetch receiving history & cumulative totals for a specific PO
router.get('/api/po-receiving-history/{*poRef}', async (req, res) => {
  const rawRef = req.params.poRef;
  const poRef = decodeURIComponent(Array.isArray(rawRef) ? rawRef.join('/') : (rawRef || ''));
  const grns = await getDatabaseStore('grn_store');
  const poGRNs = (Array.isArray(grns) ? grns : []).filter(g => {
    const ref = (g.poRef || g.poNo || g.poId || '').toLowerCase();
    const target = poRef.toLowerCase();
    return ref === target || ref.includes(target) || target.includes(ref) || (ref.includes('0202') && target.includes('0202')) || (ref.includes('0201') && target.includes('0201')) || (ref.includes('7327116') && target.includes('7327116'));
  });

  // Group total received quantities per item ID, item name, or position index
  const itemReceivedTotals = {};
  poGRNs.forEach(grn => {
    (grn.items || []).forEach((item, idx) => {
      const qty = Number(item.accepted !== undefined ? item.accepted : (item.now || 0));
      const itemId = item.id || item.itemId || item.lineItemId;
      const itemName = (item.name || '').trim().toLowerCase();
      if (itemId) {
        itemReceivedTotals[itemId] = (itemReceivedTotals[itemId] || 0) + qty;
      }
      if (itemName) {
        itemReceivedTotals[itemName] = (itemReceivedTotals[itemName] || 0) + qty;
      }
      itemReceivedTotals[idx] = (itemReceivedTotals[idx] || 0) + qty;
    });
  });

  res.json({
    poRef,
    grnHistory: poGRNs,
    itemReceivedTotals
  });
});

// Endpoint to list all stored GRNs
router.get('/api/grns', async (req, res) => {
  const grns = await getDatabaseStore('grn_store');
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

  const reconciled = (Array.isArray(grns) ? grns : []).map(grn => {
    const pRef = normalize(grn.poRef || grn.poNo || grn.poId);
    const matchedPO = localPOs.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return pRef && (pNo === pRef || pId === pRef || (pNo && pRef.includes(pNo)) || (pNo && pNo.includes(pRef)));
    });

    const isPoClosed = matchedPO && (
      String(matchedPO.status || '').toUpperCase().includes('CLOSED') ||
      String(matchedPO.status || '').toUpperCase().includes('FULLY') ||
      matchedPO.statusType === 'closed' ||
      matchedPO.order_status === 'closed' ||
      (Number(matchedPO.totalOrderedQty) > 0 && Number(matchedPO.totalReceivedQty || matchedPO.totalReceived) >= Number(matchedPO.totalOrderedQty))
    );

    if (isPoClosed && grn.status !== 'CLOSED / FULLY RECEIVED') {
      return {
        ...grn,
        status: 'CLOSED / FULLY RECEIVED'
      };
    }
    return grn;
  });

  const sorted = reconciled.sort((a, b) => {
    const parseNum = (item) => {
      const str = String(item.grnNo || item.id || item.poRef || '');
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return parseNum(b) - parseNum(a);
  });
  res.json(sorted);
});

// Endpoint to reset all GRNs
router.all('/api/grns/reset-all', async (req, res) => {
  try {
    const grnPath = getStoreFilePath('grn_store.json');
    try {
      fs.writeFileSync(grnPath, '[]', 'utf8');
    } catch (_) {}
    await saveDatabaseStore('grn_store', []);
    res.json({ success: true, message: 'All GRNs reset to empty.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to delete a GRN by ID or grnNo
router.delete('/api/grns/:id', requireRole(['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Procurement', 'Procurement Head', 'Procurement Manager', 'Stores']), async (req, res) => {
  const targetId = req.params.id;
  let grns = await getDatabaseStore('grn_store');
  if (!Array.isArray(grns)) grns = [];
  const existing = grns.find(g => g.id === targetId || g.grnNo === targetId);
  
  if (existing && (
    existing.status === 'CLOSED / FULLY RECEIVED' || 
    existing.status === 'Approved' || 
    existing.status === 'Fully Accepted' || 
    existing.status === 'Closed' || 
    existing.status === 'CLOSED'
  )) {
    return res.status(400).json({ error: 'Fully received or approved GRNs cannot be deleted.' });
  }

  const initialLen = grns.length;
  grns = grns.filter(g => g.id !== targetId && g.grnNo !== targetId);
  await saveDatabaseStore('grn_store', grns);
  res.json({ success: true, deleted: initialLen > grns.length });
});

// Endpoint to create a new GRN (Saves locally)
router.post('/api/grns', async (req, res) => {
  const grnData = req.body;
  let grns = loadLocalGRNs();
  if (!Array.isArray(grns) || grns.length === 0) {
    grns = await getDatabaseStore('grn_store');
  }
  if (!Array.isArray(grns)) grns = [];
  
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const poRefTarget = normalize(grnData.poRef || grnData.poNo || grnData.poId);
  
  // Calculate existing received quantity across all previous GRNs for this PO
  let pastReceivedQty = 0;
  grns.forEach(g => {
    const isSameGrn = (grnData.id && (g.id === grnData.id || g.grnNo === grnData.id)) || 
                      (grnData.grnNo && (g.grnNo === grnData.grnNo || g.id === grnData.grnNo));
    if (isSameGrn) return;
    const ref = normalize(g.poRef || g.poNo || g.poId);
    if (poRefTarget && (ref === poRefTarget || ref.includes(poRefTarget) || poRefTarget.includes(ref))) {
      (g.items || []).forEach(it => {
        pastReceivedQty += Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      });
    }
  });

  const currentAccepted = Number(grnData.acceptedQty !== undefined && grnData.acceptedQty !== '' ? grnData.acceptedQty : (grnData.receivedQty || 0));
  const totalReceivedSoFar = pastReceivedQty + currentAccepted;
  
  let totalOrdered = Number(grnData.totalOrderedQty || 0);
  if (totalOrdered === 0 && Array.isArray(grnData.items)) {
    totalOrdered = grnData.items.reduce((sum, it) => sum + (Number(it.ordered) || 0), 0);
  }

  const isFullyReceived = (totalOrdered > 0 && totalReceivedSoFar >= totalOrdered) || grnData.forceClosePO === true;
  const calculatedStatus = isFullyReceived ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED';

  console.log(`[GRN SAVE] PO: ${poRefTarget} | Past: ${pastReceivedQty} | Current: ${currentAccepted} | Total: ${totalReceivedSoFar}/${totalOrdered} | Status: ${calculatedStatus}`);

  const newGRN = {
    id: grnData.id || `GRN-${Date.now()}`,
    grnNo: grnData.grnNo || grnData.id || `GRN-${Date.now()}`,
    poRef: grnData.poRef || grnData.poNo || '—',
    poNo: grnData.poNo || grnData.poRef || '—',
    poId: grnData.poId || grnData.poRef || '—',
    vendor: grnData.vendor || 'Vendor',
    date: grnData.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    challanNo: grnData.challanNo || '—',
    receivedQty: grnData.receivedQty || 0,
    acceptedQty: grnData.acceptedQty !== undefined ? grnData.acceptedQty : (grnData.receivedQty || 0),
    rejectedQty: grnData.rejectedQty || 0,
    receivedBy: grnData.receivedBy || '—',
    inspectorName: grnData.inspectorName || '—',
    inspectionRemarks: grnData.inspectionRemarks || '—',
    items: grnData.items || [],
    documents: grnData.documents || [],
    status: calculatedStatus
  };

  // 1. SAVE GRN IMMEDIATELY TO LOCAL STORE AND SUPABASE!
  const existingGrnIdx = grns.findIndex(g => (newGRN.id && (g.id === newGRN.id || g.grnNo === newGRN.id)) || 
                                            (newGRN.grnNo && (g.grnNo === newGRN.grnNo || g.id === newGRN.grnNo)));
  if (existingGrnIdx >= 0) {
    grns[existingGrnIdx] = newGRN;
  } else {
    grns.unshift(newGRN);
  }
  saveLocalGRNs(grns);

  // 2. UPDATE MATCHING PO STATUS IN LOCAL STORE & SUPABASE IMMEDIATELY!
  try {
    const localPOs = loadLocalPOs();
    if (poRefTarget) {
      let matched = false;
      const updatedPOs = localPOs.map(po => {
        const poNum = normalize(po.poNo);
        const poId = normalize(po.id);
        if (poRefTarget === poNum || poRefTarget === poId) {
          matched = true;
          const ord = totalOrdered > 0 ? totalOrdered : Number(po.totalOrderedQty || (po.items ? po.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0));
          const rec = totalReceivedSoFar;
          const rem = Math.max(0, ord - rec);
          return {
            ...po,
            status: calculatedStatus,
            statusType: isFullyReceived ? 'closed' : 'partially_received',
            order_status: isFullyReceived ? 'closed' : 'received',
            totalOrderedQty: ord,
            totalReceivedQty: rec,
            totalRemainingQty: rem,
            receivingProgressPct: ord > 0 ? ((rec / ord) * 100).toFixed(1) : (isFullyReceived ? '100.0' : '0.0'),
            grnCount: (Number(po.grnCount) || 0) + 1,
            totalReceived: rec,
            items: (po.items || []).map((poIt, idx) => {
              const grnIt = (newGRN.items || []).find(gi => 
                (gi.name && poIt.name && gi.name.trim().toLowerCase() === poIt.name.trim().toLowerCase()) ||
                (gi.id && poIt.id && gi.id === poIt.id)
              ) || (newGRN.items || [])[idx];
              const itAccepted = grnIt ? Number(grnIt.accepted !== undefined && grnIt.accepted !== '' ? grnIt.accepted : (grnIt.now || 0)) : 0;
              const itOrdered = Number(poIt.qty || poIt.quantity || ord);
              const prevItRec = Number(poIt.previouslyReceived || 0) + itAccepted;
              return {
                ...poIt,
                previouslyReceived: prevItRec,
                remainingQty: Math.max(0, itOrdered - prevItRec)
              };
            })
          };
        }
        return po;
      });

      if (!matched) {
        const ord = totalOrdered > 0 ? totalOrdered : currentAccepted;
        const rec = totalReceivedSoFar;
        const rem = Math.max(0, ord - rec);
        updatedPOs.unshift({
          id: grnData.poRef || grnData.poNo || `PO-${Date.now()}`,
          poNo: grnData.poNo || grnData.poRef,
          vendor: grnData.vendor || 'Vendor',
          status: calculatedStatus,
          statusType: isFullyReceived ? 'closed' : 'partially_received',
          order_status: isFullyReceived ? 'closed' : 'received',
          totalOrderedQty: ord,
          totalReceivedQty: rec,
          totalRemainingQty: rem,
          grnCount: 1,
          totalReceived: rec,
          receivingProgressPct: ord > 0 ? ((rec / ord) * 100).toFixed(1) : (isFullyReceived ? '100.0' : '0.0'),
          items: (grnData.items || []).map(it => {
            const itOrd = Number(it.ordered || it.now || 0);
            const itAcc = Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
            return {
              name: it.name || 'Material Item',
              sku: it.sku || it.code || '',
              qty: itOrd,
              previouslyReceived: itAcc,
              remainingQty: Math.max(0, itOrd - itAcc)
            };
          })
        });
      }

      saveLocalPOs(updatedPOs);
      saveDatabaseStore('po_store', updatedPOs).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to update PO status in po_store:', err);
  }

  // 3. INWARD STOCK INTO INVENTORY (item_store.json & raw_materials_store.json) IMMEDIATELY!
  try {
    const localItems = loadLocalItems();
    if (Array.isArray(localItems) && localItems.length > 0) {
      let itemsUpdated = false;
      const updatedItems = localItems.map(item => {
        const itemNameClean = String(item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemCodeClean = String(item.code || item.sku || item.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let addedQty = 0;
        (newGRN.items || []).forEach(grnItem => {
          const grnItemNameClean = String(grnItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const grnItemCodeClean = String(grnItem.code || grnItem.sku || grnItem.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const isNameMatch = itemNameClean && grnItemNameClean && (itemNameClean === grnItemNameClean || itemNameClean.includes(grnItemNameClean) || grnItemNameClean.includes(itemNameClean));
          const isCodeMatch = itemCodeClean && grnItemCodeClean && (itemCodeClean === grnItemCodeClean || itemCodeClean.includes(grnItemCodeClean) || grnItemCodeClean.includes(itemCodeClean));

          if (isNameMatch || isCodeMatch) {
            const qty = Number(grnItem.accepted !== undefined && grnItem.accepted !== '' ? grnItem.accepted : (grnItem.now || 0));
            if (qty > 0) {
              addedQty += qty;
            }
          }
        });

        if (addedQty > 0) {
          itemsUpdated = true;
          const currentStock = Number(item.stock || 0);
          const newStock = currentStock + addedQty;
          console.log(`[INVENTORY STOCK UPDATE] Item: ${item.name} | Old Stock: ${currentStock} | Received: +${addedQty} | New Stock: ${newStock}`);
          return { 
            ...item, 
            stock: newStock,
            availableStock: newStock,
            physicalStock: (Number(item.physicalStock) || currentStock) + addedQty
          };
        }
        return item;
      });

      if (itemsUpdated) {
        saveLocalItems(updatedItems);
      }
    }

    const localRawMats = loadLocalRawMaterials();
    if (Array.isArray(localRawMats) && localRawMats.length > 0) {
      let rawUpdated = false;
      const updatedRaw = localRawMats.map(rm => {
        const rmNameClean = String(rm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const rmCodeClean = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        let addedQty = 0;
        (newGRN.items || []).forEach(grnItem => {
          const grnItemNameClean = String(grnItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const grnItemCodeClean = String(grnItem.code || grnItem.sku || grnItem.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isNameMatch = rmNameClean && grnItemNameClean && (rmNameClean === grnItemNameClean || rmNameClean.includes(grnItemNameClean) || grnItemNameClean.includes(rmNameClean));
          const isCodeMatch = rmCodeClean && grnItemCodeClean && (rmCodeClean === grnItemCodeClean || rmCodeClean.includes(grnItemCodeClean) || grnItemCodeClean.includes(rmCodeClean));

          if (isNameMatch || isCodeMatch) {
            const qty = Number(grnItem.accepted !== undefined && grnItem.accepted !== '' ? grnItem.accepted : (grnItem.now || 0));
            if (qty > 0) addedQty += qty;
          }
        });

        if (addedQty > 0) {
          rawUpdated = true;
          const currentStock = Number(rm.stock || 0);
          const newStock = currentStock + addedQty;
          console.log(`[RAW MATERIAL INWARD] Material: ${rm.name} | Old: ${currentStock} | Inwarded: +${addedQty} | New: ${newStock}`);
          return {
            ...rm,
            stock: newStock,
            availableStock: newStock,
            physicalStock: (Number(rm.physicalStock) || currentStock) + addedQty,
            goodsReceived: (Number(rm.goodsReceived) || 0) + addedQty,
            status: newStock > (rm.minLevel || 50) ? 'In Stock' : 'Low Stock',
            lastUpdated: `Inwarded from GRN ${newGRN.grnNo}`
          };
        }
        return rm;
      });

      if (rawUpdated) {
        const rawMatsPath = getStoreFilePath('raw_materials_store.json');
        fs.writeFileSync(rawMatsPath, JSON.stringify(updatedRaw, null, 2), 'utf8');
        supabaseMemoryStore.raw_materials_store = updatedRaw;
        pushStoreToSupabase('raw_materials_store', updatedRaw).catch(() => {});
        broadcastRealtimeEvent('inventory_updated', { action: 'update', recordId: newGRN.materialCode, grnNo: newGRN.grnNo });
      }
    }
  } catch (err) {
    console.error('Failed to update inventory stock on GRN save:', err);
  }

  // ⚡ Broadcast real-time GRN event to all clients (Accounts, Stores, Procurement)
  try {
    const actEmp = req.headers['x-employee-code'] || newGRN.receivedBy || null;
    const actName = req.headers['x-user-name'] || newGRN.receivedBy || 'Stores';
    const actRole = req.headers['x-user-role'] || 'Stores';

    // Notify Accounts team transparently of inwarded GRN
    createInternalNotification({
      recipientRole: 'Accounts Head',
      eventType: 'GRN_RECEIVED',
      documentType: 'GRN',
      documentId: newGRN.grnNo,
      title: `📦 GRN ${newGRN.grnNo} Received for PO ${newGRN.poNo}`,
      message: `Goods Receipt Note ${newGRN.grnNo} inwarded (${currentAccepted} qty accepted). Total Received: ${totalReceivedSoFar}/${totalOrdered}. PO Status: ${calculatedStatus}.`,
      actorEmpCode: actEmp,
      actorName: actName,
      actorRole: actRole,
      targetTab: 'GRN',
      targetRecordId: newGRN.grnNo,
      metadata: {
        grnNo: newGRN.grnNo,
        poNo: newGRN.poNo,
        vendor: newGRN.vendor,
        receivedQty: currentAccepted,
        status: calculatedStatus
      },
      dedupId: `grn_notif_acc_${newGRN.grnNo}_${Date.now()}`
    });

    const grnPayload = { grn: newGRN, poNo: newGRN.poNo, status: calculatedStatus, action: 'create' };
    broadcastRealtimeEvent('grn_updated', grnPayload);
    broadcastRealtimeEvent('controlroom_grn_completed', newGRN);
    broadcastRealtimeEvent('controlroom_po_updated', { id: newGRN.poNo, status: calculatedStatus, action: 'update' });
    broadcastRealtimeEvent('po_updated', { id: newGRN.poNo, status: calculatedStatus, action: 'update' });
  } catch (grnNotifErr) {
    console.warn('[GRN Notification Warning]:', grnNotifErr.message);
  }

  // 4. RETURN SUCCESS TO CLIENT IMMEDIATELY!
  res.json({ success: true, grn: newGRN });
});

// Endpoint for MD Approval (Draft/Pending -> MD Approved) (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/approve', async (req, res) => {
  const targetId = req.params.id;
  const remarks = req.body.remarks || 'Approved by CEO & Payment Authorized';
  const approver = req.body.approver || 'Velmurugan Rathinam (CEO)';

  const now = new Date();
  const approvedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const approvedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  // Update local PO store
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'MD Approved';
    localPOs[matchedIdx].statusType = 'md_approved';
    localPOs[matchedIdx].approvedBy = approver;
    localPOs[matchedIdx].approvedAt = now.toISOString();
    localPOs[matchedIdx].approvedDate = approvedDate;
    localPOs[matchedIdx].approvedTime = approvedTime;
    localPOs[matchedIdx].approvalDate = approvedDate;
    localPOs[matchedIdx].approvalTime = approvedTime;
    localPOs[matchedIdx].approvalRemarks = remarks;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'MD Approved',
      statusType: 'md_approved',
      approvedBy: approver,
      approvedAt: now.toISOString(),
      approvedDate,
      approvedTime,
      approvalDate: approvedDate,
      approvalTime: approvedTime,
      approvalRemarks: remarks
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[approve] Supabase sync notice:', sbErr.message);
  }

  // ⚡ Broadcast approval update and notify Accounts & Procurement in real time
  try {
    const matchedPO = matchedIdx !== -1 ? localPOs[matchedIdx] : null;
    const vendorName = matchedPO?.vendor || 'Vendor';
    const poAmount = matchedPO?.amount || '';

    // 1. Notify Accounts team to proceed with payment release
    createInternalNotification({
      recipientRole: 'Accounts Head',
      eventType: 'PO_APPROVED_FOR_PAYMENT',
      documentType: 'PO',
      documentId: targetId,
      title: `✅ PO ${targetId} Approved by CEO — Payment Authorized`,
      message: `Purchase Order ${targetId} for ${vendorName} (${poAmount}) approved by CEO. Payment & credit clearance authorized. Ready for Accounts verification.`,
      actorEmpCode: req.headers['x-employee-code'] || null,
      actorName: approver,
      actorRole: 'CEO',
      targetTab: 'Purchase Orders',
      targetRecordId: targetId,
      metadata: {
        poNo: targetId,
        approver,
        vendor: vendorName,
        amount: poAmount,
        remarks,
        filterTab: 'MD_APPROVED'
      },
      dedupId: `po_approved_acc_${targetId}_${Date.now()}`
    });

    // 2. Notify Procurement Head that CEO approved
    createInternalNotification({
      recipientRole: 'Procurement Head',
      eventType: 'PO_APPROVED',
      documentType: 'PO',
      documentId: targetId,
      title: `✅ PO ${targetId} Approved by CEO`,
      message: `Purchase Order ${targetId} approved by ${approver}. Payment authorized to proceed. Moved to Accounts.`,
      actorEmpCode: req.headers['x-employee-code'] || null,
      actorName: approver,
      actorRole: 'CEO',
      targetTab: 'Purchase Orders',
      targetRecordId: targetId,
      metadata: {
        poNo: targetId,
        approver,
        vendor: vendorName,
        amount: poAmount,
        remarks,
        filterTab: 'MD_APPROVED'
      },
      dedupId: `po_approved_proc_${targetId}_${Date.now()}`
    });

    const broadcastPayload = { id: targetId, po: matchedPO, status: 'MD Approved', action: 'update' };
    broadcastRealtimeEvent('purchase_order_updated', broadcastPayload);
    broadcastRealtimeEvent('controlroom_po_updated', broadcastPayload);
    broadcastRealtimeEvent('po_updated', broadcastPayload);
  } catch (notifErr) {
    console.warn('[PO Approve Notification Warning]:', notifErr.message);
  }

  res.json({ success: true, message: `PO ${targetId} approved by ${approver} and payment authorized!` });
});

// Endpoint for Payment Process (MD Approved -> Payment Processed / Credit Verified) (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/process-payment', async (req, res) => {
  const targetId = req.params.id;
  const paymentMode = req.body.paymentMode || 'Bank Transfer';
  const paymentRef = req.body.paymentRef || 'TXN-PAID';
  const amountPaid = req.body.amountPaid || '';
  const remarks = req.body.remarks || 'Payment verified by Accounts';
  const isCredit = req.body.isCredit || paymentMode.toLowerCase().includes('credit');
  const creditTerms = req.body.creditTerms || 'Net 30 Days';

  const now = new Date();
  const paymentDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const paymentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  // Handle multiple payment proof images (up to 4 images)
  const incomingImages = Array.isArray(req.body.paymentImages) ? req.body.paymentImages.slice(0, 4) : [];
  const singleImage = req.body.paymentImage || (incomingImages[0]?.dataUrl || null);
  const singleImageMeta = req.body.paymentImageMeta || (incomingImages[0] ? {
    name: incomingImages[0].name || 'Payment_Proof.jpg',
    size: incomingImages[0].size || '',
    type: incomingImages[0].type || 'image/jpeg'
  } : null);

  const paymentImages = incomingImages.length > 0
    ? incomingImages
    : (singleImage ? [{ dataUrl: singleImage, ...singleImageMeta }] : []);

  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });

  const paymentDetailsObj = {
    mode: paymentMode,
    refNo: paymentRef,
    amount: amountPaid || (matchedIdx !== -1 ? localPOs[matchedIdx].amount : ''),
    date: paymentDate,
    time: paymentTime,
    paidAt: now.toISOString(),
    remarks,
    isCredit,
    creditTerms,
    paymentImage: singleImage,
    paymentImageMeta: singleImageMeta,
    paymentImages: paymentImages,
    verifiedBy: 'Accounts Team'
  };

  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'Payment Processed';
    localPOs[matchedIdx].statusType = 'payment_processed';
    localPOs[matchedIdx].order_status = 'payment_processed';
    localPOs[matchedIdx].paymentDetails = paymentDetailsObj;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'Payment Processed',
      statusType: 'payment_processed',
      paymentDetails: paymentDetailsObj
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[process-payment] Supabase sync notice:', sbErr.message);
  }

  // ⚡ Real-Time Workflow Notification to Procurement Head: Payment Processed, Ready for Proceed PO!
  try {
    const matchedPO = matchedIdx !== -1 ? localPOs[matchedIdx] : null;
    const vendorName = matchedPO?.vendor || 'Vendor';

    createInternalNotification({
      recipientRole: 'Procurement Head',
      eventType: 'PO_PAYMENT_PROCESSED',
      documentType: 'PO',
      documentId: targetId,
      title: `💳 Payment Processed for PO ${targetId}`,
      message: `Accounts verified payment for PO ${targetId} (${vendorName}, ${isCredit ? 'Credit Terms' : paymentMode}). Payment proof attached. Ready to Proceed PO!`,
      actorEmpCode: req.headers['x-employee-code'] || null,
      actorName: req.headers['x-user-name'] || 'Accounts Team',
      actorRole: 'Accounts',
      targetTab: 'Purchase Orders',
      targetRecordId: targetId,
      metadata: {
        poNo: targetId,
        vendor: vendorName,
        paymentMode,
        paymentRef,
        amount: amountPaid,
        hasProof: paymentImages.length > 0,
        filterTab: 'PAYMENT_PROCESSED'
      },
      dedupId: `po_paid_proc_${targetId}_${Date.now()}`
    });

    const broadcastPayload = { id: targetId, po: localPOs[matchedIdx], status: 'Payment Processed', action: 'update' };
    broadcastRealtimeEvent('purchase_order_updated', broadcastPayload);
    broadcastRealtimeEvent('controlroom_po_updated', broadcastPayload);
    broadcastRealtimeEvent('po_updated', broadcastPayload);
  } catch (notifErr) {
    console.warn('[PO Payment Process Notification Warning]:', notifErr.message);
  }

  res.json({ 
    success: true, 
    message: isCredit 
      ? `Credit terms verified by Accounts team for PO ${targetId}` 
      : `Payment processed and verified by Accounts for PO ${targetId}` 
  });
});

// Endpoint to Proceed PO (Payment Processed -> Proceed PO -> Ready for GRN & Auto Vendor Dispatch) (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/proceed', async (req, res) => {
  const targetId = req.params.id;
  const remarks = req.body.remarks || 'Proceeded for dispatch and GRN';
  const authorizedBy = req.body.authorizedBy || 'Procurement Head';
  const incomingEmail = req.body.vendorEmail || req.body.email || '';
  const vendorPhone = req.body.vendorPhone || req.body.phone || '';

  const now = new Date();
  const proceedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const proceedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  const matchedPO = matchedIdx !== -1 ? localPOs[matchedIdx] : null;
  const vendorEmail = (incomingEmail && incomingEmail !== '—' && incomingEmail.includes('@'))
    ? incomingEmail.trim()
    : (matchedPO && matchedPO.email && matchedPO.email !== '—' && matchedPO.email.includes('@') ? matchedPO.email.trim() : '');

  const proceedDetails = {
    date: proceedDate,
    time: proceedTime,
    proceededAt: now.toISOString(),
    remarks,
    authorizedBy,
    vendorEmail,
    vendorPhone,
    emailDispatched: Boolean(vendorEmail),
    emailSentAt: new Date().toISOString(),
    deliveryStatus: vendorEmail ? `Dispatched to ${vendorEmail}` : 'Authorized (Ready for GRN)'
  };

  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'Proceed PO';
    localPOs[matchedIdx].statusType = 'proceed_po';
    localPOs[matchedIdx].proceedDetails = proceedDetails;
    if (vendorEmail && (!localPOs[matchedIdx].email || localPOs[matchedIdx].email === '—')) {
      localPOs[matchedIdx].email = vendorEmail;
    }
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'Proceed PO',
      statusType: 'proceed_po',
      email: vendorEmail,
      proceedDetails
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[proceed] Supabase sync notice:', sbErr.message);
  }

  // ⚡ Real-Time Workflow Notification to Accounts, CEO, and Stores: PO Proceeded & Dispatched!
  try {
    const vName = matchedPO?.vendor || 'Vendor';

    createInternalNotification({
      recipientRole: 'Accounts Head',
      eventType: 'PO_PROCEEDED_DISPATCHED',
      documentType: 'PO',
      documentId: targetId,
      title: `🚀 PO ${targetId} Proceeded & Dispatched to Vendor`,
      message: `Purchase Order ${targetId} for ${vName} has been authorized and dispatched to vendor by Procurement. Ready for GRN receiving.`,
      actorEmpCode: req.headers['x-employee-code'] || null,
      actorName: authorizedBy,
      actorRole: 'Procurement',
      targetTab: 'Purchase Orders',
      targetRecordId: targetId,
      metadata: {
        poNo: targetId,
        vendor: vName,
        vendorEmail,
        filterTab: 'PROCEED_PO'
      },
      dedupId: `po_proceed_acc_${targetId}_${Date.now()}`
    });

    const broadcastPayload = { id: targetId, po: localPOs[matchedIdx], status: 'Proceed PO', action: 'update' };
    broadcastRealtimeEvent('purchase_order_updated', broadcastPayload);
    broadcastRealtimeEvent('controlroom_po_updated', broadcastPayload);
    broadcastRealtimeEvent('po_updated', broadcastPayload);
  } catch (notifErr) {
    console.warn('[PO Proceed Notification Warning]:', notifErr.message);
  }

  const message = vendorEmail
    ? `PO ${targetId} marked as Proceed PO! An official copy was automatically dispatched to vendor (${vendorEmail}). Ready for GRN receiving.`
    : `PO ${targetId} marked as Proceed PO! Ready for GRN receiving.`;

  res.json({
    success: true,
    vendorEmail,
    emailDispatched: Boolean(vendorEmail),
    message
  });
});

// Endpoint to explicitly reject a Purchase Order (Pending -> Rejected) (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/reject', async (req, res) => {
  const targetId = req.params.id;
  const reason = req.body.reason || req.body.rejectionReason;
  const rejectedBy = req.body.rejectedBy || 'CEO / Operations Manager';

  if (!reason || String(reason).trim() === '') {
    return res.status(400).json({ error: 'Rejection reason is mandatory when rejecting a Purchase Order.' });
  }

  const now = new Date();
  const rDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const rTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Update local PO store
  const localPOs = loadLocalPOs();
  const matchedIdx = localPOs.findIndex(p => p.id === targetId || p.poNo === targetId);
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'REJECTED';
    localPOs[matchedIdx].statusType = 'rejected';
    localPOs[matchedIdx].rejectedBy = rejectedBy;
    localPOs[matchedIdx].rejectionDate = rDate;
    localPOs[matchedIdx].rejectionTime = rTime;
    localPOs[matchedIdx].rejectionReason = reason;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'REJECTED',
      statusType: 'rejected',
      rejectedBy: rejectedBy,
      rejectionDate: rDate,
      rejectionTime: rTime,
      rejectionReason: reason
    });
    saveLocalPOs(localPOs);
  }

  try {
    createInternalNotification({
      recipientRole: 'Procurement Head',
      eventType: 'PO_REJECTED',
      documentType: 'PO',
      documentId: targetId,
      title: `❌ PO ${targetId} Rejected`,
      message: `Purchase Order ${targetId} was rejected by ${rejectedBy}. Reason: ${reason}`,
      actorEmpCode: req.headers['x-employee-code'] || null,
      actorName: rejectedBy,
      actorRole: req.headers['x-user-role'] || 'CEO',
      targetTab: 'Purchase Orders',
      targetRecordId: targetId,
      metadata: {
        poNo: targetId,
        rejectedBy,
        reason
      },
      dedupId: `po_rejected_${targetId}_${Date.now()}`
    });
  } catch (notifErr) {
    console.warn('[PO Reject Notification Warning]:', notifErr.message);
  }

  res.json({ success: true, message: `PO ${targetId} rejected by ${rejectedBy}.` });
});

// Endpoint to explicitly cancel a Purchase Order with mandatory remark (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/cancel', async (req, res) => {
  const targetId = req.params.id;
  const reason = req.body.reason || req.body.cancelReason || req.body.remark;
  const cancelledBy = req.body.cancelledBy || 'Procurement Head';

  if (!reason || String(reason).trim() === '') {
    return res.status(400).json({ error: 'Cancellation remark is mandatory when cancelling a Purchase Order.' });
  }

  const now = new Date();
  const cDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const cTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Update local PO store
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });

  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'CANCELLED';
    localPOs[matchedIdx].statusType = 'cancelled';
    localPOs[matchedIdx].cancelledBy = cancelledBy;
    localPOs[matchedIdx].cancelledDate = cDate;
    localPOs[matchedIdx].cancelledTime = cTime;
    localPOs[matchedIdx].cancelReason = reason;
    localPOs[matchedIdx].cancellationRemark = reason;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'CANCELLED',
      statusType: 'cancelled',
      cancelledBy: cancelledBy,
      cancelledDate: cDate,
      cancelledTime: cTime,
      cancelReason: reason,
      cancellationRemark: reason
    });
    saveLocalPOs(localPOs);
  }

  res.json({ success: true, message: `PO ${targetId} cancelled by ${cancelledBy}.` });
});

// Endpoint to explicitly close a Purchase Order in BUSINZ Authoritative Store (Native BUSINZ Store)
router.post('/api/purchaseorders/:id/close', async (req, res) => {
  const targetId = req.params.id;
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'CLOSED / FULLY RECEIVED';
    localPOs[matchedIdx].statusType = 'closed';
    localPOs[matchedIdx].order_status = 'closed';
    saveLocalPOs(localPOs);
  }
  res.json({ success: true, message: `Purchase Order ${targetId} marked as CLOSED in BUSINZ!` });
});

// Endpoint to delete a Purchase Order in BUSINZ Authoritative Store (supports both /api/purchaseorders/:id and /api/zoho/purchaseorders/:id)
router.delete(['/api/purchaseorders/:id', '/api/zoho/purchaseorders/:id'], async (req, res) => {
  const targetId = req.params.id;

  // Remove from local store
  const localPOs = loadLocalPOs();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedPOs = localPOs.filter(p => {
    const pId = String(p.id || '').toLowerCase();
    const pNo = String(p.poNo || p.po_number || '').toLowerCase();
    return pId !== targetClean && pNo !== targetClean;
  });
  saveLocalPOs(updatedPOs);

  res.json({ success: true, message: `PO ${targetId} deleted from BUSINZ!`, remainingCount: updatedPOs.length });
});

// Endpoint to safely clear all vendors from BUSINZ Authoritative Store (supports GET and POST)
router.all('/api/procurement/clear-all-vendors', async (req, res) => {
  try {
    saveLocalVendors([]);
    res.json({
      success: true,
      message: 'All vendors successfully removed from BUSINZ Authoritative Store.',
      vendorCount: 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to delete dummy purchase orders (supports GET and POST)
router.all(['/api/procurement/clear-dummy-pos', '/api/procurement/clear-all-pos'], async (req, res) => {
  try {
    const { poNumbers, all = true } = req.body || {};
    const localPOs = loadLocalPOs();
    let updatedPOs = [];

    if (all || (!poNumbers && req.query.all !== 'false')) {
      // Clear all dummy test POs completely
      updatedPOs = [];
    } else if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      const targets = new Set(poNumbers.map(n => String(n).trim().toLowerCase()));
      updatedPOs = localPOs.filter(p => {
        const idLower = String(p.id || '').trim().toLowerCase();
        const noLower = String(p.poNo || p.po_number || '').trim().toLowerCase();
        return !targets.has(idLower) && !targets.has(noLower);
      });
    }

    const removedCount = localPOs.length - updatedPOs.length;
    saveLocalPOs(updatedPOs);

    res.json({
      success: true,
      message: `Successfully removed ${removedCount} Purchase Order(s).`,
      removedCount,
      remainingCount: updatedPOs.length,
      remainingPOs: updatedPOs.map(p => p.poNo || p.id)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-time synchronization endpoint retrieving approval pending counts strictly from BUSINZ local stores
router.get('/api/approvals-pending', async (req, res) => {
  try {
    const pos = loadLocalPOs();
    const grns = loadLocalGRNs();
    let invoices = [];
    try {
      const invPath = getStoreFilePath('invoice_store.json');
      if (fs.existsSync(invPath)) invoices = JSON.parse(fs.readFileSync(invPath, 'utf8'));
    } catch (_) {}
    if (invoices.length === 0 && Array.isArray(supabaseMemoryStore.invoice_store)) {
      invoices = supabaseMemoryStore.invoice_store;
    }

    const posPending = pos.filter(po => {
      const st = String(po.status || '').toLowerCase();
      const stt = String(po.statusType || '').toLowerCase();
      return st.includes('pending') || st.includes('draft') || st.includes('waiting') || stt === 'pending' || stt === 'draft';
    }).length;

    const grnsPending = grns.filter(g => {
      const st = String(g.status || '').toLowerCase();
      return st.includes('pending') || st.includes('draft');
    }).length;

    const invoicesPending = invoices.filter(inv => {
      const st = String(inv.status || '').toLowerCase();
      const pay = String(inv.pay || '').toLowerCase();
      return st.includes('draft') || st.includes('pending') || pay.includes('draft') || pay.includes('ready');
    }).length;

    res.json({
      posPending,
      grnsPending,
      invoicesPending
    });
  } catch (err) {
    res.json({ posPending: 0, grnsPending: 0, invoicesPending: 0 });
  }
});

  return router;
}
