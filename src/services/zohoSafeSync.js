import { supabase } from '../supabaseClient';
import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';

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

  // 2. Fetch from live Zoho backend
  try {
    const res = await fetch('/api/zoho/purchaseorders');
    if (res.ok) {
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
            return {
              ...zohoPo,
              ...cloudMatch,
              vendor: (cloudMatch.vendor && cloudMatch.vendor !== 'Vendor' && cloudMatch.vendor !== 'Annamalaiyar') ? cloudMatch.vendor : (zohoPo.vendor || 'Vendor'),
              status: zohoPo.status || cloudMatch.status,
              statusType: zohoPo.statusType || cloudMatch.statusType,
              items: (cloudMatch.items && cloudMatch.items.length > 0) ? cloudMatch.items : (zohoPo.items || []),
              deliveryAddress: (cloudMatch.deliveryAddress && cloudMatch.deliveryAddress !== '—') ? cloudMatch.deliveryAddress : (zohoPo.deliveryAddress || '—'),
              billingAddress: (cloudMatch.billingAddress && cloudMatch.billingAddress !== '—') ? cloudMatch.billingAddress : (zohoPo.billingAddress || '—'),
              paymentTerms: (cloudMatch.paymentTerms && cloudMatch.paymentTerms !== 'Net 30 Days') ? cloudMatch.paymentTerms : (zohoPo.paymentTerms || 'Net 30 Days'),
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

        saveCloudStore('po_store', merged);
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

export async function saveSafeZohoPO(newOrUpdatedPO) {
  if (!newOrUpdatedPO) return;
  try {
    // 1. Fetch current cloud list from Supabase
    const cloudList = await fetchCloudStore('po_store', []);
    const targetId = newOrUpdatedPO.poNo || newOrUpdatedPO.id;
    const existingIdx = cloudList.findIndex(p => (p.poNo && p.poNo === targetId) || (p.id && p.id === targetId));
    let updatedList;
    if (existingIdx !== -1) {
      cloudList[existingIdx] = { ...cloudList[existingIdx], ...newOrUpdatedPO };
      updatedList = cloudList;
    } else {
      updatedList = [newOrUpdatedPO, ...cloudList];
    }

    // 2. Persist immediately to Supabase Cloud
    saveCloudStore('po_store', updatedList);

    // 3. Post to Zoho Books API
    try {
      fetch('/api/zoho/purchaseorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrUpdatedPO)
      }).catch(e => console.warn('[saveSafeZohoPO] Zoho sync notice:', e));
    } catch (_) {}

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
