import { supabase } from '../supabaseClient';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate } from '../utils/supabaseDataSync';

/**
 * Universal Safe Synchronizer for Zoho Books + Supabase in Control Room.
 * 
 * ARCHITECTURAL MANDATE:
 * 1. Supabase Cloud + Zoho Books are the authoritative dual storage engines.
 * 2. Zero reliance on browser localStorage.
 * 3. All items, POs, Vendors, Customers, and Invoices are stored in Zoho Books AND Supabase Cloud.
 */

// ---------------------------
// 1. PURCHASE ORDERS (PO)
// ---------------------------
export async function getSafeZohoPOs() {
  // 1. Fetch current cloud list from Supabase first
  let cloudList = [];
  try {
    cloudList = await fetchCloudStore('po_store', []);
  } catch (_) {}

  // 2. Fetch from live Zoho backend with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/zoho/purchaseorders', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const merged = data.map(zohoPo => {
          const zNo = normalize(zohoPo.poNo);
          const zId = normalize(zohoPo.id);
          const cloudMatch = Array.isArray(cloudList) && cloudList.find(c => {
            const cNo = normalize(c.poNo);
            const cId = normalize(c.id);
            const cZohoId = normalize(c.zohoId);
            return (zNo && (cNo === zNo || cId === zNo)) || (zId && (cId === zId || cZohoId === zId));
          });
          if (cloudMatch) {
            const preservedItems = (Array.isArray(cloudMatch.items) && cloudMatch.items.length > 0)
              ? cloudMatch.items
              : (Array.isArray(zohoPo.items) && zohoPo.items.length > 0 ? zohoPo.items : []);
            return {
              ...zohoPo,
              ...cloudMatch,
              vendor: (cloudMatch.vendor && cloudMatch.vendor !== 'Vendor' && cloudMatch.vendor !== 'Annamalaiyar' && cloudMatch.vendor !== 'Fresh Vendor') 
                ? cloudMatch.vendor 
                : ((zohoPo.vendor && zohoPo.vendor !== 'Vendor' && zohoPo.vendor !== 'Annamalaiyar') ? zohoPo.vendor : (cloudMatch.vendor || zohoPo.vendor || 'Vendor')),
              branch: cloudMatch.branch || zohoPo.branch || '',
              contactPerson: cloudMatch.contactPerson || zohoPo.contactPerson || '',
              gstNo: (cloudMatch.gstNo && cloudMatch.gstNo !== '—') ? cloudMatch.gstNo : (zohoPo.gstNo || '—'),
              status: (() => {
                const totOrd = Number(cloudMatch.totalOrderedQty || zohoPo.totalOrderedQty || 0);
                const totRec = Number(cloudMatch.totalReceivedQty || cloudMatch.totalReceived || zohoPo.totalReceivedQty || zohoPo.totalReceived || 0);
                if (totOrd > 0 && totRec > 0 && totRec < totOrd) {
                  return 'OPEN / PARTIALLY RECEIVED';
                }
                const getStageRank = (st, stType, approver) => {
                  const s = String(st || '').toLowerCase().trim();
                  const stt = String(stType || '').toLowerCase().trim();
                  if (s.includes('rejected') || stt.includes('rejected')) return 7;
                  if (s.includes('closed') || s.includes('fully received') || stt.includes('closed')) {
                    if (totOrd > 0 && totRec > 0 && totRec < totOrd) return 5;
                    return 6;
                  }
                  if (s.includes('partially') || stt.includes('partially')) return 5;
                  if (s.includes('proceed') || stt.includes('proceed')) return 4;
                  if (s.includes('payment') || stt.includes('payment')) return 3;
                  if (s.includes('md approved') || stt.includes('md_approved') || Boolean(approver)) return 2;
                  return 1;
                };
                const cRank = getStageRank(cloudMatch.status, cloudMatch.statusType, cloudMatch.approvedBy);
                const zRank = getStageRank(zohoPo.status, zohoPo.statusType, zohoPo.approvedBy);
                if (zRank > cRank) return zohoPo.status;
                if (cRank > zRank) return cloudMatch.status;
                return cloudMatch.status || zohoPo.status || 'Draft';
              })(),
              statusType: (() => {
                const totOrd = Number(cloudMatch.totalOrderedQty || zohoPo.totalOrderedQty || 0);
                const totRec = Number(cloudMatch.totalReceivedQty || cloudMatch.totalReceived || zohoPo.totalReceivedQty || zohoPo.totalReceived || 0);
                if (totOrd > 0 && totRec > 0 && totRec < totOrd) {
                  return 'partially_received';
                }
                const getStageRank = (st, stType, approver) => {
                  const s = String(st || '').toLowerCase().trim();
                  const stt = String(stType || '').toLowerCase().trim();
                  if (s.includes('rejected') || stt.includes('rejected')) return 7;
                  if (s.includes('closed') || s.includes('fully received') || stt.includes('closed')) {
                    if (totOrd > 0 && totRec > 0 && totRec < totOrd) return 5;
                    return 6;
                  }
                  if (s.includes('partially') || stt.includes('partially')) return 5;
                  if (s.includes('proceed') || stt.includes('proceed')) return 4;
                  if (s.includes('payment') || stt.includes('payment')) return 3;
                  if (s.includes('md approved') || stt.includes('md_approved') || Boolean(approver)) return 2;
                  return 1;
                };
                const cRank = getStageRank(cloudMatch.status, cloudMatch.statusType, cloudMatch.approvedBy);
                const zRank = getStageRank(zohoPo.status, zohoPo.statusType, zohoPo.approvedBy);
                if (zRank > cRank) return zohoPo.statusType || 'draft';
                if (cRank > zRank) return cloudMatch.statusType || 'draft';
                return cloudMatch.statusType || zohoPo.statusType || 'draft';
              })(),
              approvedBy: cloudMatch.approvedBy || zohoPo.approvedBy,
              approvalDate: cloudMatch.approvalDate || zohoPo.approvalDate,
              approvalTime: cloudMatch.approvalTime || zohoPo.approvalTime,
              approvalRemarks: cloudMatch.approvalRemarks || zohoPo.approvalRemarks,
              proceedDetails: cloudMatch.proceedDetails || zohoPo.proceedDetails,
              paymentDetails: cloudMatch.paymentDetails || zohoPo.paymentDetails,
              grnDetails: cloudMatch.grnDetails || zohoPo.grnDetails,
              totalOrderedQty: cloudMatch.totalOrderedQty !== undefined ? cloudMatch.totalOrderedQty : zohoPo.totalOrderedQty,
              totalReceivedQty: cloudMatch.totalReceivedQty !== undefined ? cloudMatch.totalReceivedQty : zohoPo.totalReceivedQty,
              totalRemainingQty: cloudMatch.totalRemainingQty !== undefined ? cloudMatch.totalRemainingQty : zohoPo.totalRemainingQty,
              receivingProgressPct: cloudMatch.receivingProgressPct !== undefined ? cloudMatch.receivingProgressPct : zohoPo.receivingProgressPct,
              grnCount: cloudMatch.grnCount !== undefined ? cloudMatch.grnCount : zohoPo.grnCount,
              totalReceived: cloudMatch.totalReceived !== undefined ? cloudMatch.totalReceived : zohoPo.totalReceived,
              grnHistory: (Array.isArray(cloudMatch.grnHistory) && cloudMatch.grnHistory.length > 0) ? cloudMatch.grnHistory : (zohoPo.grnHistory || []),
              items: preservedItems,
              notes: cloudMatch.notes || zohoPo.notes || '',
              terms: (cloudMatch.terms && cloudMatch.terms.length > 50) ? cloudMatch.terms : (zohoPo.terms || cloudMatch.terms || ''),
              deliveryAddress: (cloudMatch.deliveryAddress && cloudMatch.deliveryAddress !== '—' && cloudMatch.deliveryAddress !== 'Tamil Nadu, India') ? cloudMatch.deliveryAddress : (zohoPo.deliveryAddress || '—'),
              billingAddress: (cloudMatch.billingAddress && cloudMatch.billingAddress !== '—') ? cloudMatch.billingAddress : (zohoPo.billingAddress || '—'),
              paymentTerms: (cloudMatch.paymentTerms && cloudMatch.paymentTerms !== 'Net 30 Days' && cloudMatch.paymentTerms !== 'Due on Receipt') ? cloudMatch.paymentTerms : (zohoPo.paymentTerms || 'Net 30 Days'),
              priority: cloudMatch.priority || zohoPo.priority || 'High',
              scope: cloudMatch.scope || zohoPo.scope || 'Vendor Scope',
              transportName: cloudMatch.transportName || zohoPo.transportName || '',
              shippingCharges: cloudMatch.shippingCharges !== undefined ? cloudMatch.shippingCharges : (zohoPo.shippingCharges || 0),
              otherCharges: cloudMatch.otherCharges !== undefined ? cloudMatch.otherCharges : (zohoPo.otherCharges || 0),
              discountPct: cloudMatch.discountPct !== undefined ? cloudMatch.discountPct : (zohoPo.discountPct || 0),
              purchaser: (cloudMatch.purchaser && cloudMatch.purchaser !== '—') ? cloudMatch.purchaser : (zohoPo.purchaser || '—'),
              amount: (cloudMatch.amount && cloudMatch.amount !== '₹0.00' && cloudMatch.amount !== '₹ 0.00') ? cloudMatch.amount : zohoPo.amount
            };
          }
          return zohoPo;
        });

        // Also preserve any newly created local/cloud POs not yet returned by Zoho list
        if (Array.isArray(cloudList) && cloudList.length > 0) {
          const mergedPoNos = new Set(merged.map(p => normalize(p.poNo || p.id)));
          cloudList.forEach(c => {
            const cKey = normalize(c.poNo || c.id);
            if (cKey && !mergedPoNos.has(cKey)) {
              merged.push(c);
            }
          });
        }

        // Only save to cloud if we are not erasing items from records that already had items
        const isSafeToSave = cloudList.every(c => {
          if (!Array.isArray(c.items) || c.items.length === 0) return true;
          const m = merged.find(p => normalize(p.poNo) === normalize(c.poNo) || normalize(p.id) === normalize(c.id));
          return m && Array.isArray(m.items) && m.items.length > 0;
        });
        if (isSafeToSave || cloudList.length === 0) {
          saveCloudStore('po_store', merged);
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

export async function saveSafeZohoPO(newOrUpdatedPO, syncWithZoho = false) {
  if (!newOrUpdatedPO) return;
  try {
    // 1. Fetch current cloud list from Supabase
    const cloudList = await fetchCloudStore('po_store', []);
    const targetId = newOrUpdatedPO.poNo || newOrUpdatedPO.id;
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const cleanTargetId = normalize(targetId);

    const existingIdx = cloudList.findIndex(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      const pZohoId = normalize(p.zohoId);
      return (cleanTargetId && (pNo === cleanTargetId || pId === cleanTargetId || pZohoId === cleanTargetId));
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
        items: preservedItems
      };
      updatedList = cloudList;
    } else {
      updatedList = [newOrUpdatedPO, ...cloudList];
    }

    // 2. Persist immediately to Supabase Cloud & Local Server with zero debounce delay
    await saveCloudStoreImmediate('po_store', updatedList);

    // 3. Post to Zoho Books API ONLY when explicitly asked (avoids 3x duplicate creations)
    if (syncWithZoho) {
      try {
        fetch('/api/zoho/purchaseorders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrUpdatedPO)
        }).catch(e => console.warn('[saveSafeZohoPO] Zoho sync notice:', e));
      } catch (_) {}
    }

    return updatedList;
  } catch (err) {
    console.warn('[saveSafeZohoPO] Error:', err);
  }
}

// ---------------------------
// 2. VENDORS
// ---------------------------
export async function getSafeZohoVendors() {
  // 1. Try Zoho backend endpoint
  try {
    const res = await fetch('/api/zoho/vendors');
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
    console.warn('[getSafeZohoVendors] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveSafeZohoVendor(vendor) {
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
      fetch('/api/zoho/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor)
      }).catch(() => {});
    } catch (_) {}

    return updatedList;
  } catch (err) {
    console.warn('[saveSafeZohoVendor] Error:', err);
  }
}

// ---------------------------
// 3. CUSTOMERS
// ---------------------------
export async function getSafeZohoCustomers() {
  // 1. Try Zoho backend endpoint
  try {
    const res = await fetch('/api/zoho/customers');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        saveCloudStore('customer_store', data);
        return data;
      }
    }
  } catch (_) {}

  // 2. Fallback to Supabase cloud store
  try {
    const cloudCustomers = await fetchCloudStore('customer_store', []);
    if (Array.isArray(cloudCustomers) && cloudCustomers.length > 0) {
      return cloudCustomers;
    }
  } catch (err) {
    console.warn('[getSafeZohoCustomers] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveSafeZohoCustomer(customer) {
  if (!customer) return;
  try {
    const cloudList = await fetchCloudStore('customer_store', []);
    const cId = customer.contact_id || customer.customerCode || customer.id || customer.code;
    const existingIdx = cloudList.findIndex(c => (c.customerCode && c.customerCode === cId) || (c.id && c.id === cId) || (c.code && c.code === cId));
    let updatedList;
    if (existingIdx !== -1) {
      cloudList[existingIdx] = { ...cloudList[existingIdx], ...customer };
      updatedList = cloudList;
    } else {
      updatedList = [customer, ...cloudList];
    }

    saveCloudStore('customer_store', updatedList);

    try {
      fetch('/api/zoho/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      }).catch(() => {});
    } catch (_) {}

    return updatedList;
  } catch (err) {
    console.warn('[saveSafeZohoCustomer] Error:', err);
  }
}

// ---------------------------
// 4. ITEMS & CATALOG
// ---------------------------
export async function getSafeZohoItems() {
  // 1. Try Zoho backend endpoint
  try {
    const res = await fetch('/api/zoho/items');
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
    console.warn('[getSafeZohoItems] Supabase fetch notice:', err);
  }

  return [];
}

// ---------------------------
// 5. INVOICES
// ---------------------------
export async function getSafeZohoInvoices() {
  // 1. Try Zoho backend endpoint
  try {
    const res = await fetch('/api/zoho/invoices');
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        saveCloudStore('invoice_store', data);
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
    console.warn('[getSafeZohoInvoices] Supabase fetch notice:', err);
  }

  return [];
}

export async function saveSafeZohoInvoice(invoice) {
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

    saveCloudStore('invoice_store', updatedList);

    try {
      fetch('/api/zoho/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      }).catch(() => {});
    } catch (_) {}

    return updatedList;
  } catch (err) {
    console.warn('[saveSafeZohoInvoice] Error:', err);
  }
}
