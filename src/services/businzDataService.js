import { supabase } from '../supabaseClient';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate, saveCloudInvoiceRow } from '../utils/supabaseDataSync';

/**
 * Universal Native Data Service for BUSINZ.
 * 
 * ARCHITECTURAL MANDATE:
 * 1. Supabase Cloud + Local Authoritative Stores are the primary dual storage engines.
 * 2. Zero reliance on external accounting systems at runtime.
 * 3. All items, POs, Vendors, Customers, and Invoices are persisted directly to BUSINZ native stores.
 */

// ---------------------------
// 1. PURCHASE ORDERS (PO)
// ---------------------------
export async function getPurchaseOrders() {
  // 1. Fetch current cloud list from Supabase first
  let cloudList = [];
  try {
    cloudList = await fetchCloudStore('po_store', []);
  } catch (_) {}

  // 2. Fetch from live BUSINZ native backend with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/purchaseorders', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const merged = data.map(poItem => {
          const zNo = normalize(poItem.poNo);
          const zId = normalize(poItem.id);
          const cloudMatch = Array.isArray(cloudList) && cloudList.find(c => {
            const cNo = normalize(c.poNo);
            const cId = normalize(c.id);
            return (zNo && (cNo === zNo || cId === zNo)) ||
                   (zId && (cId === zId || cNo === zId));
          });
          if (cloudMatch) {
            const preservedItems = (Array.isArray(cloudMatch.items) && cloudMatch.items.length > 0)
              ? cloudMatch.items
              : (Array.isArray(poItem.items) && poItem.items.length > 0 ? poItem.items : []);
            const effPayDetails = cloudMatch.paymentDetails || poItem.paymentDetails;
            const effProceedDetails = cloudMatch.proceedDetails || poItem.proceedDetails;
            const effApprovedBy = cloudMatch.approvedBy || poItem.approvedBy;

            return {
              ...poItem,
              ...cloudMatch,
              vendor: (cloudMatch.vendor && cloudMatch.vendor !== 'Vendor' && cloudMatch.vendor !== 'Annamalaiyar' && cloudMatch.vendor !== 'Fresh Vendor') 
                ? cloudMatch.vendor 
                : ((poItem.vendor && poItem.vendor !== 'Vendor' && poItem.vendor !== 'Annamalaiyar') ? poItem.vendor : (cloudMatch.vendor || poItem.vendor || 'Vendor')),
              branch: cloudMatch.branch || poItem.branch || '',
              contactPerson: cloudMatch.contactPerson || poItem.contactPerson || '',
              gstNo: (cloudMatch.gstNo && cloudMatch.gstNo !== '—') ? cloudMatch.gstNo : (poItem.gstNo || '—'),
              poDate: cloudMatch.poDate || poItem.poDate || poItem.date,
              status: (() => {
                const totOrd = Number(cloudMatch.totalOrderedQty || poItem.totalOrderedQty || 0);
                const totRec = Number(cloudMatch.totalReceivedQty || cloudMatch.totalReceived || poItem.totalReceivedQty || poItem.totalReceived || 0);
                if (totOrd > 0 && totRec >= totOrd) {
                  return 'CLOSED / FULLY RECEIVED';
                }
                if (totOrd > 0 && totRec > 0 && totRec < totOrd) {
                  return 'OPEN / PARTIALLY RECEIVED';
                }
                const cStatus = String(cloudMatch.status || '').toUpperCase();
                const zStatus = String(poItem.status || '').toUpperCase();
                if ((cStatus.includes('CLOSED') || cStatus.includes('FULLY') || zStatus.includes('CLOSED') || zStatus.includes('FULLY')) && totOrd > 0 && totRec >= totOrd) {
                  return 'CLOSED / FULLY RECEIVED';
                }
                if ((cStatus.includes('PARTIAL') || zStatus.includes('PARTIAL')) && totRec > 0) {
                  return 'OPEN / PARTIALLY RECEIVED';
                }
                const getStageRank = (st, stType, approver, payDetails, proceedDetails) => {
                  const s = String(st || '').toLowerCase().trim();
                  const stt = String(stType || '').toLowerCase().trim();
                  if (s.includes('rejected') || stt.includes('rejected')) return 7;
                  if ((s.includes('closed') || s.includes('fully received') || stt.includes('closed')) && totOrd > 0 && totRec >= totOrd) return 6;
                  if (totOrd > 0 && totRec > 0 && totRec < totOrd) return 5;
                  if ((s.includes('partially') || stt.includes('partially')) && totRec > 0) return 5;
                  if (s.includes('proceed') || stt.includes('proceed') || Boolean(proceedDetails)) return 4;
                  if (s.includes('payment') || stt.includes('payment') || Boolean(payDetails)) return 3;
                  if (s.includes('md approved') || stt.includes('md_approved') || Boolean(approver)) return 2;
                  return 1;
                };
                const cRank = getStageRank(cloudMatch.status, cloudMatch.statusType, effApprovedBy, effPayDetails, effProceedDetails);
                const zRank = getStageRank(poItem.status, poItem.statusType, effApprovedBy, effPayDetails, effProceedDetails);
                const effectiveRank = Math.max(cRank, zRank);
                if (effectiveRank === 7) return 'REJECTED';
                if (effectiveRank === 6) return 'CLOSED / FULLY RECEIVED';
                if (effectiveRank === 5) return 'OPEN / PARTIALLY RECEIVED';
                if (effectiveRank === 4) return 'Proceed PO';
                if (effectiveRank === 3) return 'Payment Processed';
                if (effectiveRank === 2) return 'MD Approved';
                return cloudMatch.status || poItem.status || 'Draft';
              })(),
              statusType: (() => {
                const totOrd = Number(cloudMatch.totalOrderedQty || poItem.totalOrderedQty || 0);
                const totRec = Number(cloudMatch.totalReceivedQty || cloudMatch.totalReceived || poItem.totalReceivedQty || poItem.totalReceived || 0);
                if (totOrd > 0 && totRec >= totOrd) {
                  return 'closed';
                }
                if (totOrd > 0 && totRec > 0 && totRec < totOrd) {
                  return 'partially_received';
                }
                const cStatus = String(cloudMatch.status || '').toUpperCase();
                const zStatus = String(poItem.status || '').toUpperCase();
                if ((cStatus.includes('CLOSED') || cStatus.includes('FULLY') || zStatus.includes('CLOSED') || zStatus.includes('FULLY')) && totOrd > 0 && totRec >= totOrd) {
                  return 'closed';
                }
                if ((cStatus.includes('PARTIAL') || zStatus.includes('PARTIAL')) && totRec > 0) {
                  return 'partially_received';
                }
                const getStageRank = (st, stType, approver, payDetails, proceedDetails) => {
                  const s = String(st || '').toLowerCase().trim();
                  const stt = String(stType || '').toLowerCase().trim();
                  if (s.includes('rejected') || stt.includes('rejected')) return 7;
                  if ((s.includes('closed') || s.includes('fully received') || stt.includes('closed')) && totOrd > 0 && totRec >= totOrd) return 6;
                  if (totOrd > 0 && totRec > 0 && totRec < totOrd) return 5;
                  if ((s.includes('partially') || stt.includes('partially')) && totRec > 0) return 5;
                  if (s.includes('proceed') || stt.includes('proceed') || Boolean(proceedDetails)) return 4;
                  if (s.includes('payment') || stt.includes('payment') || Boolean(payDetails)) return 3;
                  if (s.includes('md approved') || stt.includes('md_approved') || Boolean(approver)) return 2;
                  return 1;
                };
                const cRank = getStageRank(cloudMatch.status, cloudMatch.statusType, effApprovedBy, effPayDetails, effProceedDetails);
                const zRank = getStageRank(poItem.status, poItem.statusType, effApprovedBy, effPayDetails, effProceedDetails);
                const effectiveRank = Math.max(cRank, zRank);
                if (effectiveRank === 7) return 'rejected';
                if (effectiveRank === 6) return 'closed';
                if (effectiveRank === 5) return 'partially_received';
                if (effectiveRank === 4) return 'proceed_po';
                if (effectiveRank === 3) return 'payment_processed';
                if (effectiveRank === 2) return 'md_approved';
                return cloudMatch.statusType || poItem.statusType || 'draft';
              })(),
              approvedBy: effApprovedBy,
              approvalDate: cloudMatch.approvalDate || poItem.approvalDate,
              approvalTime: cloudMatch.approvalTime || poItem.approvalTime,
              approvalRemarks: cloudMatch.approvalRemarks || poItem.approvalRemarks,
              proceedDetails: effProceedDetails,
              paymentDetails: effPayDetails,
              grnDetails: cloudMatch.grnDetails || poItem.grnDetails,
              totalOrderedQty: cloudMatch.totalOrderedQty !== undefined ? cloudMatch.totalOrderedQty : poItem.totalOrderedQty,
              totalReceivedQty: cloudMatch.totalReceivedQty !== undefined ? cloudMatch.totalReceivedQty : poItem.totalReceivedQty,
              totalRemainingQty: cloudMatch.totalRemainingQty !== undefined ? cloudMatch.totalRemainingQty : poItem.totalRemainingQty,
              receivingProgressPct: cloudMatch.receivingProgressPct !== undefined ? cloudMatch.receivingProgressPct : poItem.receivingProgressPct,
              grnCount: cloudMatch.grnCount !== undefined ? cloudMatch.grnCount : poItem.grnCount,
              totalReceived: cloudMatch.totalReceived !== undefined ? cloudMatch.totalReceived : poItem.totalReceived,
              grnHistory: (Array.isArray(cloudMatch.grnHistory) && cloudMatch.grnHistory.length > 0) ? cloudMatch.grnHistory : (poItem.grnHistory || []),
              items: preservedItems,
              notes: cloudMatch.notes || poItem.notes || '',
              terms: (cloudMatch.terms && cloudMatch.terms.length > 50) ? cloudMatch.terms : (poItem.terms || cloudMatch.terms || ''),
              deliveryAddress: (cloudMatch.deliveryAddress && cloudMatch.deliveryAddress !== '—' && cloudMatch.deliveryAddress !== 'Tamil Nadu, India') ? cloudMatch.deliveryAddress : (poItem.deliveryAddress || '—'),
              billingAddress: (cloudMatch.billingAddress && cloudMatch.billingAddress !== '—') ? cloudMatch.billingAddress : (poItem.billingAddress || '—'),
              paymentTerms: (cloudMatch.paymentTerms && cloudMatch.paymentTerms !== 'Net 30 Days' && cloudMatch.paymentTerms !== 'Due on Receipt') ? cloudMatch.paymentTerms : (poItem.paymentTerms || 'Net 30 Days'),
              priority: cloudMatch.priority || poItem.priority || 'High',
              scope: cloudMatch.scope || poItem.scope || 'Vendor Scope',
              transportName: cloudMatch.transportName || poItem.transportName || '',
              shippingCharges: cloudMatch.shippingCharges !== undefined ? cloudMatch.shippingCharges : (poItem.shippingCharges || 0),
              otherCharges: cloudMatch.otherCharges !== undefined ? cloudMatch.otherCharges : (poItem.otherCharges || 0),
              discountPct: cloudMatch.discountPct !== undefined ? cloudMatch.discountPct : (poItem.discountPct || 0),
              purchaser: (cloudMatch.purchaser && cloudMatch.purchaser !== '—') ? cloudMatch.purchaser : (poItem.purchaser || '—'),
              amount: (cloudMatch.amount && cloudMatch.amount !== '₹0.00' && cloudMatch.amount !== '₹ 0.00') ? cloudMatch.amount : poItem.amount
            };
          }
          return poItem;
        });

        // Also preserve any newly created local/cloud POs not yet returned by backend list
        if (Array.isArray(cloudList) && cloudList.length > 0) {
          const mergedPoKeys = new Set();
          merged.forEach(p => {
            const k1 = normalize(p.poNo);
            const k2 = normalize(p.id);
            if (k1) mergedPoKeys.add(k1);
            if (k2) mergedPoKeys.add(k2);
          });
          cloudList.forEach(c => {
            const c1 = normalize(c.poNo);
            const c2 = normalize(c.id);
            const alreadyIn = (c1 && mergedPoKeys.has(c1)) || (c2 && mergedPoKeys.has(c2));
            if (!alreadyIn) {
              merged.push(c);
            }
          });
        }

        return merged;
      }
    }
  } catch (_) {}

  // 3. Fallback to Supabase cloud store
  if (Array.isArray(cloudList) && cloudList.length > 0) {
    return cloudList;
  }

  return [];
}

export async function savePurchaseOrder(newOrUpdatedPO, syncRemote = false) {
  if (!newOrUpdatedPO) return;
  try {
    // 1. Fetch current cloud list from Supabase
    const cloudList = await fetchCloudStore('po_store', []);
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const targetNo = normalize(newOrUpdatedPO.poNo);
    const targetId = normalize(newOrUpdatedPO.id);

    const existingIdx = cloudList.findIndex(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return (targetNo && (pNo === targetNo || pId === targetNo)) ||
             (targetId && (pId === targetId || pNo === targetId));
    });

    let updatedList;
    if (existingIdx !== -1) {
      const existingPo = cloudList[existingIdx];
      // Preserve existing items if newOrUpdatedPO has empty items
      const preservedItems = (Array.isArray(newOrUpdatedPO.items) && newOrUpdatedPO.items.length > 0)
        ? newOrUpdatedPO.items
        : (existingPo.items || []);

      cloudList[existingIdx] = {
        ...existingPo,
        ...newOrUpdatedPO,
        items: preservedItems,
        paymentDetails: newOrUpdatedPO.paymentDetails || existingPo.paymentDetails,
        proceedDetails: newOrUpdatedPO.proceedDetails || existingPo.proceedDetails
      };
      updatedList = cloudList;
    } else {
      updatedList = [newOrUpdatedPO, ...cloudList];
    }

    // 2. Persist immediately to Supabase Cloud & Local Server with zero debounce delay
    await saveCloudStoreImmediate('po_store', updatedList);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: newOrUpdatedPO }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    }

    // 3. Post to backend purchase orders endpoint
    if (syncRemote) {
      try {
        fetch('/api/purchaseorders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedPO)
        }).catch(e => console.warn('[savePurchaseOrder] Backend notice:', e));
      } catch (_) {}
    }

    return updatedList;
  } catch (err) {
    console.warn('[savePurchaseOrder] Error:', err);
  }
}

// ---------------------------
// 2. VENDORS
// ---------------------------
export async function getVendors() {
  // 1. Try BUSINZ backend endpoint
  try {
    const res = await fetch('/api/vendors');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        saveCloudStore('vendor_store', data);
        return data;
      }
    }
  } catch (_) {}

  // 2. Fallback to Supabase cloud store
  try {
    const cloudVendors = await fetchCloudStore('vendor_store', []);
    if (Array.isArray(cloudVendors) && cloudVendors.length > 0) {
      return cloudVendors;
    }
  } catch (err) {
    console.warn('[getVendors] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveVendor(vendor) {
  if (!vendor) return;
  try {
    const cloudList = await fetchCloudStore('vendor_store', []);
    const vId = vendor.contact_id || vendor.id || vendor.vendorCode || vendor.code;
    const existingIdx = cloudList.findIndex(v => (v.contact_id && v.contact_id === vId) || (v.id && v.id === vId) || (v.code && v.code === vId));
    let updatedList;
    if (existingIdx !== -1) {
      cloudList[existingIdx] = { ...cloudList[existingIdx], ...vendor };
      updatedList = cloudList;
    } else {
      updatedList = [vendor, ...cloudList];
    }

    saveCloudStore('vendor_store', updatedList);

    try {
      fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor)
      }).catch(() => {});
    } catch (_) {}

    return updatedList;
  } catch (err) {
    console.warn('[saveVendor] Error:', err);
  }
}

// ---------------------------
// 3. CUSTOMERS
// ---------------------------
export async function getCustomers() {
  // 1. Try BUSINZ backend endpoint
  try {
    const res = await fetch('/api/customers');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (_) {}

  // 2. Fallback to Supabase canonical customers table
  try {
    const cloudCustomers = await fetchCloudStore('customer_store', []);
    if (Array.isArray(cloudCustomers) && cloudCustomers.length > 0) {
      return cloudCustomers;
    }
  } catch (err) {
    console.warn('[getCustomers] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveCustomer(customer) {
  if (!customer) return;
  try {
    // Save single customer directly to public.customers (single-record upsert)
    saveCloudStore('customer_store', customer);

    try {
      fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      }).catch(() => {});
    } catch (_) {}

    return customer;
  } catch (err) {
    console.warn('[saveCustomer] Error:', err);
  }
}

// ---------------------------
// 4. ITEMS & CATALOG
// ---------------------------
export async function getItems() {
  // 1. Try BUSINZ backend endpoint
  try {
    const res = await fetch('/api/items');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        saveCloudStore('item_store', data);
        return data;
      }
    }
  } catch (_) {}

  // 2. Fallback to Supabase cloud store
  try {
    const cloudItems = await fetchCloudStore('item_store', []);
    if (Array.isArray(cloudItems) && cloudItems.length > 0) {
      return cloudItems;
    }
  } catch (err) {
    console.warn('[getItems] Supabase fetch notice:', err);
  }

  return [];
}

// ---------------------------
// 5. INVOICES
// ---------------------------
export async function getInvoices() {
  // 1. Try BUSINZ backend endpoint
  try {
    const res = await fetch('/api/invoices');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (_) {}

  // 2. Fallback to Supabase cloud store
  try {
    const cloudInvoices = await fetchCloudStore('invoice_store', []);
    if (Array.isArray(cloudInvoices) && cloudInvoices.length > 0) {
      return cloudInvoices;
    }
  } catch (err) {
    console.warn('[getInvoices] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveInvoice(invoice) {
  if (!invoice) return;
  try {
    const cloudList = await fetchCloudStore('invoice_store', []);
    const invId = invoice.invNo || invoice.id || invoice.invoice_id;
    const existingIdx = cloudList.findIndex(i => (i.invNo && i.invNo === invId) || (i.id && i.id === invId));
    let updatedList;
    if (existingIdx !== -1) {
      cloudList[existingIdx] = { ...cloudList[existingIdx], ...invoice };
      updatedList = cloudList;
    } else {
      updatedList = [invoice, ...cloudList];
    }

    saveCloudInvoiceRow(invoice);

    try {
      fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      }).catch(() => {});
    } catch (_) {}

    return updatedList;
  } catch (err) {
    console.warn('[saveInvoice] Error:', err);
  }
}

