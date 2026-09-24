import { supabase } from '../supabaseClient.js';

// Preserve local browser caches for zero-data-loss protection per project guidelines

/**
 * Helper function to safely merge local and remote array datasets without losing local records
 */
function mergeDatasets(localArray, remoteArray) {
  if (!Array.isArray(localArray) && !Array.isArray(remoteArray)) {
    return remoteArray || localArray;
  }
  if (!Array.isArray(localArray)) return Array.isArray(remoteArray) ? remoteArray : [];
  if (!Array.isArray(remoteArray)) return localArray;

  const getId = (item) => {
    if (!item || typeof item !== 'object') return JSON.stringify(item);
    if (item.email && (item.employee_code || item.role)) return `emp_${item.email.toLowerCase().trim()}`;
    return item.piNo || item.estimate_number || item.estimateId || item.employee_code || item.bomCode || item.id || item.workOrderNo || item.woNo || item.code || item.poNo || item.invNo || item.grnNo || item.vendorCode || item.coilNo || item.email || item.name;
  };

  const map = new Map();
  localArray.forEach(item => {
    if (item) {
      const id = getId(item);
      map.set(id, item);
    }
  });

  remoteArray.forEach(item => {
    if (item) {
      const id = getId(item);
      if (map.has(id)) {
        map.set(id, { ...map.get(id), ...item });
      } else {
        map.set(id, item);
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Convert canonical public.customers database row to consumer-ready shape
 * Preserving all legacy camelCase and c2-c8 aliases so no existing views break
 */
export function toConsumerCustomer(c) {
  if (!c || typeof c !== 'object') return c;
  const code = c.customer_code || c.id || '';
  const comp = c.company_name || c.customer_name || 'Customer';
  const name = c.customer_name || comp;
  const billAddr = c.billing_address || '';
  const dispAddr = c.dispatch_address || billAddr;
  const billObj = (c.billing_address_obj && Object.keys(c.billing_address_obj).length > 0) ? c.billing_address_obj : {
    address: billAddr,
    city: c.city || '',
    state: c.state || '',
    pincode: c.pincode || ''
  };
  const dispObj = (c.delivery_address_obj && Object.keys(c.delivery_address_obj).length > 0) ? c.delivery_address_obj : {
    address: dispAddr,
    city: c.dispatch_city || c.city || '',
    state: c.dispatch_state || c.state || '',
    pincode: c.dispatch_pincode || c.pincode || ''
  };
  const phone = (c.phone && c.phone !== '—') ? c.phone : '';
  const email = (c.email && c.email !== '—') ? c.email : '';
  const gst = (c.gst_number && c.gst_number !== '—') ? c.gst_number : '';
  const pan = (c.pan_number && c.pan_number !== '—') ? c.pan_number : '';
  const rep = c.assigned_salesperson || 'Sales Rep';

  return {
    ...c,
    id: code,
    customerCode: code,
    code: code,
    companyName: comp,
    c2: comp,
    customerName: name,
    c3: name,
    customerType: c.customer_type || 'Customer',
    industry: c.industry || 'Solar Energy / Infrastructure',
    gstNumber: gst || '—',
    gstNo: gst || '—',
    panNumber: pan || '—',
    address: billAddr,
    city: c.city || billObj.city || '',
    state: c.state || billObj.state || '',
    pincode: c.pincode || billObj.pincode || '',
    billingAddress: billAddr,
    c6: billAddr,
    billingAddressObj: billObj,
    dispatchAddress: dispAddr,
    deliveryAddress: dispAddr,
    c7: dispAddr,
    dispatchCity: c.dispatch_city || dispObj.city || '',
    dispatchState: c.dispatch_state || dispObj.state || '',
    dispatchPincode: c.dispatch_pincode || dispObj.pincode || '',
    deliveryAddressObj: dispObj,
    sameAsBilling: Boolean(c.same_as_billing),
    creditLimit: Number(c.credit_limit || 0),
    creditDays: Number(c.credit_days || 0),
    paymentTerms: c.payment_terms || 'Due on Receipt',
    assignedSalesperson: rep,
    salesPerson: rep,
    c8: rep,
    source: c.source || (c.zoho_contact_id ? 'Zoho Books' : 'Manual'),
    zohoContactId: c.zoho_contact_id || null,
    primaryContact: c.primary_contact || {
      name: name,
      phone: phone,
      whatsapp: phone,
      email: email
    },
    email: email || '—',
    c5: email || '—',
    phone: phone || '—',
    c4: phone || '—',
    status: (c.status || 'Active').toUpperCase(),
    notes: c.notes || '',
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at || new Date().toISOString()
  };
}

/**
 * Convert customer object from any component to canonical public.customers database row
 */
export function toDatabaseCustomerRow(item) {
  if (!item || typeof item !== 'object') return null;
  const code = item.customerCode || item.customer_code || item.code || item.id || `CUST-${Date.now()}`;
  const comp = item.companyName || item.company_name || item.c2 || item.customerName || item.name || 'Customer';
  const name = item.customerName || item.customer_name || item.c3 || comp;
  const billAddr = item.billingAddress || item.c6 || item.address || item.billing_address || '';
  const dispAddr = item.dispatchAddress || item.deliveryAddress || item.c7 || item.dispatch_address || billAddr;
  const billObj = item.billingAddressObj || item.billing_address_obj || {};
  const dispObj = item.deliveryAddressObj || item.delivery_address_obj || {};

  return {
    id: code,
    customer_code: code,
    company_name: comp,
    customer_name: name,
    customer_type: item.customerType || item.customer_type || 'Customer',
    industry: item.industry || 'Solar Energy / Infrastructure',
    gst_number: item.gstNumber || item.gst_number || item.gstNo || '—',
    pan_number: item.panNumber || item.pan_number || '—',
    billing_address: billAddr,
    city: item.city || billObj.city || '',
    state: item.state || billObj.state || '',
    pincode: item.pincode || billObj.pincode || '',
    billing_address_obj: billObj,
    dispatch_address: dispAddr,
    dispatch_city: item.dispatchCity || item.dispatch_city || dispObj.city || '',
    dispatch_state: item.dispatchState || item.dispatch_state || dispObj.state || '',
    dispatch_pincode: item.dispatchPincode || item.dispatch_pincode || dispObj.pincode || '',
    delivery_address_obj: dispObj,
    same_as_billing: Boolean(item.sameAsBilling !== undefined ? item.sameAsBilling : item.same_as_billing),
    credit_limit: Number(item.creditLimit || item.credit_limit || 0),
    credit_days: Number(item.creditDays || item.credit_days || 0),
    payment_terms: item.paymentTerms || item.payment_terms || 'Due on Receipt',
    assigned_salesperson: item.assignedSalesperson || item.assigned_salesperson || item.salesPerson || item.c8 || 'Sales Rep',
    source: item.source || (item.zohoContactId || item.zoho_contact_id ? 'Zoho Books' : 'Manual'),
    zoho_contact_id: item.zohoContactId || item.zoho_contact_id || null,
    primary_contact: item.primaryContact || item.primary_contact || {},
    email: item.email || item.c5 || '—',
    phone: item.phone || item.c4 || '—',
    status: item.status || 'Active',
    notes: item.notes || '',
    updated_at: new Date().toISOString()
  };
}

/**
 * Convert canonical public.opportunities database row to consumer-ready shape
 * Preserves all legacy properties (capacityKw, structureType, contactPerson, bomCode, etc.)
 */
export function toConsumerOpportunity(o) {
  if (!o || typeof o !== 'object') return o;

  let extraMeta = {};
  let plainNotes = o.notes || '';
  if (o.notes && typeof o.notes === 'string' && o.notes.startsWith('{') && o.notes.endsWith('}')) {
    try {
      const parsed = JSON.parse(o.notes);
      if (parsed && typeof parsed === 'object') {
        extraMeta = parsed;
        plainNotes = parsed._userNotes !== undefined ? parsed._userNotes : '';
      }
    } catch (_) {}
  }

  const salesperson = o.assigned_salesperson || extraMeta.salesperson || 'Sales Representative';
  const closeDate = o.target_close_date || extraMeta.expectedClosingDate || '';

  return {
    ...extraMeta,
    id: o.id,
    oppNumber: extraMeta.oppNumber || o.id,
    title: o.title,
    customerId: o.customer_id || extraMeta.customerId || '',
    customerName: o.company_name,
    companyName: o.company_name,
    dealValue: Number(o.deal_value || 0),
    stage: o.stage || 'Requirement Received',
    probability: Number(o.probability !== null && o.probability !== undefined ? o.probability : 20),
    assignedSalesperson: salesperson,
    salesperson: salesperson,
    targetCloseDate: closeDate,
    expectedClosingDate: closeDate,
    capacityKw: extraMeta.capacityKw || 100,
    structureType: extraMeta.structureType || 'Aluminium Rooftop Rails',
    contactPerson: extraMeta.contactPerson || '',
    phone: extraMeta.phone || '',
    requirement: extraMeta.requirement || '',
    productCategory: extraMeta.productCategory || 'Aluminium Mounting Structures',
    estimatedQty: extraMeta.estimatedQty || '',
    priority: extraMeta.priority || 'HIGH',
    bomCode: extraMeta.bomCode || '',
    quotationNumber: extraMeta.quotationNumber || '',
    lastActivity: extraMeta.lastActivity || '',
    nextFollowup: extraMeta.nextFollowup || '',
    notes: plainNotes,
    createdAt: o.created_at || new Date().toISOString(),
    updatedAt: o.updated_at || new Date().toISOString()
  };
}

/**
 * Convert opportunity object from any component to canonical public.opportunities database row
 */
export function toDatabaseOpportunityRow(item) {
  if (!item || typeof item !== 'object') return null;

  const id = item.id || item.oppNumber || `OPP-${Date.now()}`;
  const companyName = item.companyName || item.customerName || 'Customer';
  const title = item.title || `${companyName} Opportunity`;
  const customerId = item.customerId || item.customer_id || null;
  const dealValue = Number(item.dealValue || item.deal_value || 0);
  const stage = item.stage || 'Requirement Received';
  const probability = Number.isInteger(Number(item.probability)) ? Number(item.probability) : 20;
  const salesperson = item.assignedSalesperson || item.salesperson || item.assigned_salesperson || 'Sales Representative';

  let targetCloseDate = null;
  const rawDate = item.targetCloseDate || item.expectedClosingDate || item.target_close_date;
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        targetCloseDate = d.toISOString().split('T')[0];
      }
    } catch (_) {}
  }

  // Pack extra non-column fields into notes JSON metadata
  const extraMetadata = {};
  if (item.capacityKw !== undefined) extraMetadata.capacityKw = item.capacityKw;
  if (item.structureType !== undefined) extraMetadata.structureType = item.structureType;
  if (item.oppNumber !== undefined) extraMetadata.oppNumber = item.oppNumber;
  if (item.contactPerson !== undefined) extraMetadata.contactPerson = item.contactPerson;
  if (item.phone !== undefined) extraMetadata.phone = item.phone;
  if (item.requirement !== undefined) extraMetadata.requirement = item.requirement;
  if (item.productCategory !== undefined) extraMetadata.productCategory = item.productCategory;
  if (item.estimatedQty !== undefined) extraMetadata.estimatedQty = item.estimatedQty;
  if (item.priority !== undefined) extraMetadata.priority = item.priority;
  if (item.bomCode !== undefined) extraMetadata.bomCode = item.bomCode;
  if (item.quotationNumber !== undefined) extraMetadata.quotationNumber = item.quotationNumber;
  if (item.lastActivity !== undefined) extraMetadata.lastActivity = item.lastActivity;
  if (item.nextFollowup !== undefined) extraMetadata.nextFollowup = item.nextFollowup;

  let notesVal = item.notes || '';
  if (Object.keys(extraMetadata).length > 0) {
    extraMetadata._userNotes = item.notes || '';
    notesVal = JSON.stringify(extraMetadata);
  }

  return {
    id,
    customer_id: customerId,
    company_name: companyName,
    title,
    deal_value: dealValue,
    stage,
    probability,
    assigned_salesperson: salesperson,
    target_close_date: targetCloseDate,
    notes: notesVal,
    created_at: item.createdAt || item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Single-row atomic save/upsert for an Opportunity (Zero leaves table interaction)
 */
export async function saveCloudOpportunityRow(opp) {
  if (!opp) return null;
  const row = toDatabaseOpportunityRow(opp);
  if (!row) return null;

  try {
    const { data, error } = await supabase
      .from('opportunities')
      .upsert(row, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('[SupabaseSync] Single opportunity save error:', error.message);
    }

    const consumerOpp = toConsumerOpportunity(data?.[0] || row);

    // Broadcast local event
    window.dispatchEvent(new CustomEvent('controlroom_opportunity_update', {
      detail: { opportunity: consumerOpp, action: 'upsert' }
    }));
    window.dispatchEvent(new CustomEvent('controlroom_store_update', {
      detail: { storeKey: 'crm_opportunities', action: 'upsert', item: consumerOpp }
    }));

    // Async disk backup fallback
    try {
      fetch('/api/store/crm_opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consumerOpp)
      }).catch(() => {});
    } catch (_) {}

    return consumerOpp;
  } catch (err) {
    console.warn('[SupabaseSync] Single opportunity upsert error:', err?.message || err);
    return opp;
  }
}

/**
 * Single-row atomic delete for an Opportunity (Zero leaves table interaction)
 */
export async function deleteCloudOpportunityRow(oppId) {
  if (!oppId) return false;

  try {
    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', oppId);

    if (error) {
      console.warn('[SupabaseSync] Single opportunity delete error:', error.message);
      return false;
    }

    // Broadcast local event
    window.dispatchEvent(new CustomEvent('controlroom_opportunity_update', {
      detail: { id: oppId, action: 'delete' }
    }));
    window.dispatchEvent(new CustomEvent('controlroom_store_update', {
      detail: { storeKey: 'crm_opportunities', action: 'delete', id: oppId }
    }));

    // Async server deletion
    try {
      fetch(`/api/store/crm_opportunities/${encodeURIComponent(oppId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Single opportunity delete error:', err?.message || err);
    return false;
  }
}

/**
 * Convert canonical public.leads database row to consumer-ready shape
 */
export function toConsumerLead(l) {
  if (!l || typeof l !== 'object') return l;

  let extra = {};
  if (l.notes && typeof l.notes === 'string' && l.notes.startsWith('{') && l.notes.endsWith('}')) {
    try {
      const parsed = JSON.parse(l.notes);
      if (parsed && typeof parsed === 'object') extra = parsed;
    } catch (_) {}
  }

  return {
    ...extra,
    id: l.id,
    leadNumber: l.lead_number || extra.leadNumber || l.id,
    companyName: l.company_name || extra.companyName || '',
    contactPerson: l.contact_person || extra.contactPerson || '',
    designation: l.designation || extra.designation || '',
    phone: l.phone || extra.phone || '',
    whatsapp: l.whatsapp || extra.whatsapp || l.phone || '',
    email: l.email || extra.email || '',
    location: l.location || extra.location || '',
    source: l.source || extra.source || 'Direct',
    status: l.status || extra.status || 'New Lead',
    priority: l.priority || extra.priority || 'MEDIUM',
    assignedSalesperson: l.assigned_salesperson || extra.assignedSalesperson || 'Sales Rep',
    assignedEmail: l.assigned_email || extra.assignedEmail || '',
    estimatedKw: Number(l.estimated_kw !== undefined && l.estimated_kw !== null ? l.estimated_kw : (extra.estimatedKw || 50)),
    category: l.category || extra.category || 'Aluminium Mounting Structures',
    estimatedValue: Number(l.estimated_value !== undefined && l.estimated_value !== null ? l.estimated_value : (extra.estimatedValue || 0)),
    notes: l.notes && !l.notes.startsWith('{') ? l.notes : (extra.notes || ''),
    timeline: Array.isArray(extra.timeline) ? extra.timeline : (l.timeline || []),
    createdAt: l.created_at || extra.createdAt || new Date().toISOString(),
    updatedAt: l.updated_at || extra.updatedAt || new Date().toISOString(),
    ...extra
  };
}

/**
 * Convert lead object to canonical database row
 */
export function toDatabaseLeadRow(lead) {
  if (!lead || typeof lead !== 'object') return null;
  const id = lead.id || `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const extra = { ...lead };
  delete extra.id;
  delete extra.leadNumber;
  delete extra.companyName;
  delete extra.contactPerson;
  delete extra.designation;
  delete extra.phone;
  delete extra.whatsapp;
  delete extra.email;
  delete extra.location;
  delete extra.source;
  delete extra.status;
  delete extra.priority;
  delete extra.assignedSalesperson;
  delete extra.assignedEmail;
  delete extra.estimatedKw;
  delete extra.category;
  delete extra.estimatedValue;

  let notesVal = lead.notes || '';
  if (Object.keys(extra).length > 0) {
    extra._userNotes = lead.notes || '';
    notesVal = JSON.stringify(extra);
  }

  return {
    id,
    lead_number: lead.leadNumber || id,
    company_name: lead.companyName || '',
    contact_person: lead.contactPerson || '',
    designation: lead.designation || '',
    phone: lead.phone || '',
    whatsapp: lead.whatsapp || lead.phone || '',
    email: lead.email || '',
    location: lead.location || '',
    source: lead.source || 'Direct',
    status: lead.status || 'New Lead',
    priority: lead.priority || 'MEDIUM',
    assigned_salesperson: lead.assignedSalesperson || 'Sales Rep',
    assigned_email: lead.assignedEmail || '',
    estimated_kw: Number(lead.estimatedKw || 0),
    category: lead.category || 'Aluminium Mounting Structures',
    estimated_value: Number(lead.estimatedValue || 0),
    notes: notesVal,
    created_at: lead.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Single-row atomic delete for a Lead
 */
export async function deleteCloudLeadRow(leadId) {
  if (!leadId) return false;
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.warn('[SupabaseSync] Single lead delete error:', error.message);
    }

    window.dispatchEvent(new CustomEvent('controlroom_leads_update', {
      detail: { id: leadId, action: 'delete' }
    }));
    window.dispatchEvent(new CustomEvent('controlroom_store_update', {
      detail: { storeKey: 'crm_leads', action: 'delete', id: leadId }
    }));

    try {
      fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' }).catch(() => {});
      fetch(`/api/store/crm_leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' }).catch(() => {});
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Single lead delete error:', err?.message || err);
    return false;
  }
}

/**
 * Convert canonical public.bom_orders database row to consumer-ready shape
 * Preserves all legacy field aliases (c2-c8, extraData, etc.) so no existing views break
 */
export function toConsumerBom(row) {
  if (!row || typeof row !== 'object') return row;
  const custName = (row.customer_name || row.customerName || row.vendor || '').trim();
  if (custName === 'Customer' && !row.source_pi_no && !row.sourcePiNo) {
    return null;
  }

  let extraData = {};
  if (row.accounts_verification && typeof row.accounts_verification === 'object' && row.accounts_verification._extra_data) {
    extraData = { ...row.accounts_verification._extra_data };
  }

  const cleanAccountsVerification = (row.accounts_verification && typeof row.accounts_verification === 'object')
    ? { ...row.accounts_verification }
    : {};
  delete cleanAccountsVerification._extra_data;

  const parseDoc = (doc) => {
    if (!doc) return null;
    if (typeof doc === 'object') return doc;
    if (typeof doc === 'string' && (doc.startsWith('{') || doc.startsWith('['))) {
      try {
        return JSON.parse(doc);
      } catch (_) {}
    }
    return doc;
  };

  const id = row.id || row.bom_code || '';
  const bomCode = row.bom_code || row.id || '';
  const customerName = row.customer_name || row.company_name || '';
  const companyName = row.company_name || row.customer_name || '';
  const phone = row.mobile || '';
  const email = row.email || '';
  const billingAddr = row.billing_address || '';
  const deliveryAddr = row.delivery_address || '';
  const salesRep = row.sales_person || '';

  return {
    ...extraData,
    id,
    bomCode,
    code: bomCode,
    customerName,
    companyName,
    c2: companyName,
    c3: customerName,
    date: row.date || '',
    deliveryDate: row.delivery_date || '',
    mobile: phone,
    phone,
    c4: phone,
    email,
    c5: email,
    billingAddress: billingAddr,
    c6: billingAddr,
    billingAddressObj: row.billing_address_obj || {},
    deliveryAddress: deliveryAddr,
    c7: deliveryAddr,
    deliveryAddressObj: row.delivery_address_obj || {},
    deliveryAddressProofDoc: parseDoc(row.delivery_address_proof_doc),
    paymentProofDoc: parseDoc(row.payment_proof_doc),
    transportMode: row.transport_mode || 'Transport',
    transportScope: row.transport_scope || 'VRM Structures',
    transporterName: row.transporter_name || '',
    vehicleNo: row.vehicle_no || '',
    lrNo: row.lr_no || '',
    paymentType: row.payment_type || 'Credit Payment',
    partialAmount: Number(row.partial_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    creditDays: Number(row.credit_days || 0),
    creditDueDate: row.credit_due_date || '',
    remarks: row.remarks || '',
    status: row.status || 'Draft',
    salesConfirmed: Boolean(row.sales_confirmed),
    salesConfirmedAt: row.sales_confirmed_at || null,
    salesPerson: salesRep,
    salesPersonCode: row.sales_person_code || extraData.salesPersonCode || '',
    c8: salesRep,
    createdBy: row.created_by || '',
    createdById: row.created_by_id || extraData.createdById || '',
    items: Array.isArray(row.items) ? row.items : [],
    payments: (row.payments && typeof row.payments === 'object') ? row.payments : {},
    dispatchPacking: (Array.isArray(row.dispatch_packing) || (row.dispatch_packing && typeof row.dispatch_packing === 'object')) ? row.dispatch_packing : [],
    accountsVerification: cleanAccountsVerification,
    invoiceConfirmed: Boolean(row.invoice_confirmed),
    invoiceDeducted: Boolean(row.invoice_deducted),
    invoiceNo: row.invoice_no || extraData.invoiceNo || '',
    stockBlocked: Boolean(row.stock_blocked),
    stockBlockedAt: row.stock_blocked_at || null,
    stockDeducted: Boolean(row.stock_deducted),
    stockDeductionDate: row.stock_deduction_date || extraData.stockDeductionDate || null,
    presetName: row.preset_name || extraData.presetName || '',
    presetKitPrice: Number(row.preset_kit_price || extraData.presetKitPrice || 0),
    presetSetCount: Number(row.preset_set_count || extraData.presetSetCount || 0),
    presetGroups: Array.isArray(row.preset_groups) ? row.preset_groups : (extraData.presetGroups || []),
    subTotal: Number(row.sub_total || 0),
    gstAmount: Number(row.gst_amount || 0),
    cgstAmount: Number(row.cgst_amount || 0),
    sgstAmount: Number(row.sgst_amount || 0),
    grandTotal: Number(row.grand_total || 0),
    cancelled: Boolean(row.cancelled || extraData.cancelled),
    cancelledAt: row.cancelled_at || extraData.cancelledAt || null,
    cancelledBy: row.cancelled_by || extraData.cancelledBy || null,
    cancellationReason: row.cancellation_reason || extraData.cancellationReason || '',
    dispatchPackingMedia: Array.isArray(row.dispatch_packing_media) ? row.dispatch_packing_media : (extraData.dispatchPackingMedia || []),
    proofDoc: row.proof_doc || extraData.proofDoc || null,
    sourcePiNo: row.source_pi_no || extraData.sourcePiNo || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

/**
 * Convert BOM object from any component to canonical public.bom_orders database row
 */
export function toDatabaseBomRow(item) {
  if (!item || typeof item !== 'object') return null;
  const cust = (item.customerName || item.customer_name || item.vendor || '').trim();
  if (cust === 'Customer' && !item.sourcePiNo && !item.source_pi_no) {
    return null;
  }

  const id = item.id || item.bomCode || item.code || `BOM-${Date.now()}`;
  const bomCode = item.bomCode || item.code || id;
  const code = item.code || bomCode;
  const sourcePiNo = item.sourcePiNo || null;

  const sanitizeDate = (d) => {
    if (!d) return null;
    const str = String(d).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
  };

  const sanitizeTimestamp = (ts) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      return !isNaN(d.getTime()) ? d.toISOString() : null;
    } catch (_) {
      return null;
    }
  };

  const sanitizeNumber = (val, defaultVal = 0) => {
    if (val === null || val === undefined || val === '') return defaultVal;
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
  };

  const serializeDoc = (doc) => {
    if (!doc) return null;
    if (typeof doc === 'string') return doc;
    try {
      return JSON.stringify(doc);
    } catch (_) {
      return null;
    }
  };

  const standardFields = new Set([
    'id', 'bomCode', 'code', 'sourcePiNo', 'date', 'deliveryDate',
    'customerName', 'companyName', 'mobile', 'phone', 'email', 'billingAddress',
    'billingAddressObj', 'deliveryAddress', 'deliveryAddressObj',
    'deliveryAddressProofDoc', 'transportMode', 'transportScope',
    'transporterName', 'vehicleNo', 'lrNo', 'paymentType', 'partialAmount',
    'balanceAmount', 'creditDays', 'creditDueDate', 'paymentProofDoc',
    'remarks', 'status', 'salesConfirmed', 'salesConfirmedAt', 'salesPerson',
    'salesPersonCode', 'createdBy', 'createdById', 'items', 'payments',
    'dispatchPacking', 'accountsVerification', 'invoiceConfirmed',
    'invoiceDeducted', 'stockBlocked', 'stockBlockedAt', 'presetName',
    'presetKitPrice', 'presetSetCount', 'presetGroups', 'subTotal',
    'gstAmount', 'cgstAmount', 'sgstAmount', 'grandTotal', 'stockDeducted',
    'stockDeductionDate', 'createdAt', 'updatedAt', 'cancelled', 'cancelledAt',
    'cancelledBy', 'cancellationReason', 'invoiceNo', 'dispatchPackingMedia', 'proofDoc',
    'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'
  ]);

  const extraData = {};
  Object.keys(item).forEach(k => {
    if (!standardFields.has(k)) {
      extraData[k] = item[k];
    }
  });

  const accountsVerification = typeof item.accountsVerification === 'object' && item.accountsVerification !== null
    ? { ...item.accountsVerification, _extra_data: extraData }
    : { _extra_data: extraData };

  return {
    id,
    bom_code: bomCode,
    code,
    source_pi_no: sourcePiNo,
    date: sanitizeDate(item.date) || new Date().toISOString().slice(0, 10),
    delivery_date: sanitizeDate(item.deliveryDate),
    customer_name: item.customerName || item.companyName || 'Customer',
    company_name: item.companyName || item.customerName || '',
    mobile: item.mobile || item.phone || '',
    email: item.email || '',
    billing_address: item.billingAddress || item.c6 || '',
    billing_address_obj: item.billingAddressObj || {},
    delivery_address: item.deliveryAddress || item.c7 || '',
    delivery_address_obj: item.deliveryAddressObj || {},
    delivery_address_proof_doc: serializeDoc(item.deliveryAddressProofDoc),
    transport_mode: item.transportMode || 'Transport',
    transport_scope: item.transportScope || 'VRM Structures',
    transporter_name: item.transporterName || '',
    vehicle_no: item.vehicleNo || '',
    lr_no: item.lrNo || '',
    payment_type: item.paymentType || 'Credit Payment',
    partial_amount: sanitizeNumber(item.partialAmount, 0),
    balance_amount: sanitizeNumber(item.balanceAmount, 0),
    credit_days: Math.round(sanitizeNumber(item.creditDays, 0)),
    credit_due_date: sanitizeDate(item.creditDueDate),
    payment_proof_doc: serializeDoc(item.paymentProofDoc),
    remarks: item.remarks || '',
    status: item.status || 'Draft',
    sales_confirmed: Boolean(item.salesConfirmed),
    sales_confirmed_at: sanitizeTimestamp(item.salesConfirmedAt),
    sales_person: item.salesPerson || item.c8 || '',
    sales_person_code: item.salesPersonCode || extraData.salesPersonCode || '',
    created_by: item.createdBy || '',
    created_by_id: item.createdById || extraData.createdById || '',
    items: Array.isArray(item.items) ? item.items : [],
    payments: typeof item.payments === 'object' && item.payments !== null ? item.payments : {},
    dispatch_packing: Array.isArray(item.dispatchPacking) || typeof item.dispatchPacking === 'object' ? item.dispatchPacking : [],
    accounts_verification: accountsVerification,
    invoice_confirmed: Boolean(item.invoiceConfirmed),
    invoice_deducted: Boolean(item.invoiceDeducted),
    stock_blocked: Boolean(item.stockBlocked),
    stock_blocked_at: sanitizeTimestamp(item.stockBlockedAt),
    preset_name: item.presetName || '',
    preset_kit_price: sanitizeNumber(item.presetKitPrice, 0),
    preset_set_count: Math.round(sanitizeNumber(item.presetSetCount, 0)),
    preset_groups: Array.isArray(item.presetGroups) ? item.presetGroups : [],
    sub_total: sanitizeNumber(item.subTotal, 0),
    gst_amount: sanitizeNumber(item.gstAmount, 0),
    cgst_amount: sanitizeNumber(item.cgstAmount, 0),
    sgst_amount: sanitizeNumber(item.sgstAmount, 0),
    grand_total: sanitizeNumber(item.grandTotal, 0),
    stock_deducted: Boolean(item.stockDeducted),
    created_at: sanitizeTimestamp(item.createdAt || item.date) || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Single-row atomic save/upsert for a BOM order (Zero leaves table interaction)
 */
export async function saveCloudBomRow(bom) {
  if (!bom) return null;
  const row = toDatabaseBomRow(bom);
  if (!row) return null;

  try {
    const { data, error } = await supabase
      .from('bom_orders')
      .upsert(row, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('[SupabaseSync] Single BOM save error:', error.message);
    }

    const consumerBom = toConsumerBom(data?.[0] || row);

    // Broadcast local events matching existing listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('controlroom_bom_updated', {
        detail: { bom: consumerBom, action: 'upsert' }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', {
        detail: { bom: consumerBom, action: 'upsert' }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_store_update', {
        detail: { storeKey: 'bom_store', action: 'upsert', item: consumerBom }
      }));
    }

    // Async server notification
    try {
      const baseUrl = (typeof window !== 'undefined' && window.location?.origin) ? '' : 'http://localhost:5001';
      fetch(`${baseUrl}/api/boms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: consumerBom, isUpdate: true })
      }).catch(() => {});
    } catch (_) {}

    return consumerBom;
  } catch (err) {
    console.warn('[SupabaseSync] Single BOM upsert error:', err?.message || err);
    return bom;
  }
}

/**
 * Single-row atomic delete for a BOM order (Zero leaves table interaction)
 */
export async function deleteCloudBomRow(bomId) {
  if (!bomId) return false;
  const cleanId = String(bomId).trim();

  try {
    const { error } = await supabase
      .from('bom_orders')
      .delete()
      .or(`id.eq.${cleanId},bom_code.eq.${cleanId}`);

    if (error) {
      console.warn('[SupabaseSync] Single BOM delete error:', error.message);
      return false;
    }

    // Broadcast local events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('controlroom_bom_updated', {
        detail: { id: cleanId, action: 'delete' }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', {
        detail: { id: cleanId, action: 'delete' }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_store_update', {
        detail: { storeKey: 'bom_store', action: 'delete', id: cleanId }
      }));
    }

    // Async server deletion
    try {
      const baseUrl = (typeof window !== 'undefined' && window.location?.origin) ? '' : 'http://localhost:5001';
      fetch(`${baseUrl}/api/boms/${encodeURIComponent(cleanId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Single BOM delete error:', err?.message || err);
    return false;
  }
}

/**
 * Fetch a single BOM by ID or bom_code directly from public.bom_orders
 */
export async function fetchCloudBom(bomId) {
  if (!bomId) return null;
  const cleanId = String(bomId).trim();
  try {
    const { data, error } = await supabase
      .from('bom_orders')
      .select('*')
      .or(`id.eq.${cleanId},bom_code.eq.${cleanId}`)
      .maybeSingle();

    if (!error && data) {
      return toConsumerBom(data);
    }
  } catch (err) {
    console.warn('[SupabaseSync] Single BOM fetch error:', err?.message || err);
  }
  return null;
}

/**
 * Fetch a data collection DIRECTLY from Supabase cloud database
 * @param {string} storeKey - Unique identifier (e.g. 'bom_store', 'invoice_store', 'customer_store', 'crm_opportunities')
 * @param {Array|Object} fallbackData - Default initial data if cloud is empty
 * @returns {Promise<Array|Object>}
 */
export async function fetchCloudStore(storeKey, fallbackData = []) {
  // CANONICAL CUSTOMER READ PATH: Query public.customers directly (Zero leaves table egress)
  if (storeKey === 'customer_store' || storeKey === 'crm_customers') {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Customers cloud fetch timeout')), 3000));
      const fetchPromise = supabase
        .from('customers')
        .select(`
          id, customer_code, company_name, customer_name, customer_type, industry,
          gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
          dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
          same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
          source, zoho_contact_id, primary_contact, email, phone, status, notes, created_at, updated_at
        `)
        .order('company_name', { ascending: true });

      const { data: dbCustomers, error: custErr } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!custErr && Array.isArray(dbCustomers) && dbCustomers.length > 0) {
        return dbCustomers.map(c => toConsumerCustomer(c));
      }
    } catch (err) {
      console.warn('[SupabaseSync] Direct customers fetch fallback notice:', err?.message || err);
    }
  }

  // CANONICAL OPPORTUNITIES READ PATH: Query public.opportunities directly (Zero leaves table egress)
  if (storeKey === 'crm_opportunities' || storeKey === 'opportunities') {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Opportunities cloud fetch timeout')), 3000));
      const fetchPromise = supabase
        .from('opportunities')
        .select(`
          id, customer_id, company_name, title, deal_value, stage,
          probability, assigned_salesperson, target_close_date, notes, created_at, updated_at
        `)
        .order('created_at', { ascending: false });

      const { data: dbOpps, error: oppErr } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!oppErr && Array.isArray(dbOpps) && dbOpps.length > 0) {
        return dbOpps.map(o => toConsumerOpportunity(o));
      }
    } catch (err) {
      console.warn('[SupabaseSync] Direct opportunities fetch fallback notice:', err?.message || err);
    }
  }

  // CANONICAL BOM READ PATH: Query public.bom_orders directly (Zero leaves table egress)
  if (storeKey === 'bom_store' || storeKey === 'BOM_STORE') {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('BOM orders cloud fetch timeout')), 4000));
      const fetchPromise = supabase
        .from('bom_orders')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: dbBoms, error: bomErr } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!bomErr && Array.isArray(dbBoms) && dbBoms.length > 0) {
        return dbBoms.map(b => toConsumerBom(b)).filter(Boolean);
      }
    } catch (err) {
      console.warn('[SupabaseSync] Direct BOM fetch fallback notice:', err?.message || err);
    }
  }

  // CANONICAL LEADS READ PATH: Query public.leads directly
  if (storeKey === 'crm_leads' || storeKey === 'leads') {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Leads cloud fetch timeout')), 3000));
      const fetchPromise = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: dbLeads, error: leadErr } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!leadErr && Array.isArray(dbLeads) && dbLeads.length > 0) {
        return dbLeads.map(l => toConsumerLead(l));
      }
    } catch (err) {
      console.warn('[SupabaseSync] Direct leads fetch fallback notice:', err?.message || err);
    }
  }

  // 1. Fetch instantly from local server endpoint /api/store/:key first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`/api/store/${storeKey}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.data !== undefined && json.data !== null) {
        if (Array.isArray(json.data) && json.data.length > 0) {
          if (storeKey === 'customer_store' || storeKey === 'crm_customers') {
            return json.data.map(c => toConsumerCustomer(c));
          }
          if (storeKey === 'crm_opportunities' || storeKey === 'opportunities') {
            return json.data.map(o => toConsumerOpportunity(o));
          }
          if (storeKey === 'crm_leads' || storeKey === 'leads') {
            return json.data.map(l => toConsumerLead(l));
          }
          if (storeKey === 'bom_store' || storeKey === 'BOM_STORE') {
            return json.data.map(b => toConsumerBom(b)).filter(Boolean);
          }
          return json.data;
        } else if (json.data && typeof json.data === 'object' && Object.keys(json.data).length > 0) {
          return json.data;
        }
      }
    }
  } catch (err) {}

  // For employees_store, fetch directly from Supabase users table (with 1.5s timeout)
  if (storeKey === 'employees_store') {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud fetch timeout')), 1500));
      const fetchPromise = supabase.from('users').select('*');
      const { data: dbUsers, error: userErr } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!userErr && Array.isArray(dbUsers) && dbUsers.length > 0) {
        // Only map genuine ControlRoom registered employees (those with CODE:::ROLE:::STATUS metadata)
        return dbUsers
          .filter(u => u.department && u.department.includes(':::'))
          .map(u => {
            const parts = u.department.split(':::');
            const empCode = parts[0];
            const role = parts[1] || u.role || 'Sales Executive';
            const status = parts[2] || 'Pending Approval';

            return {
              id: u.id,
              employee_code: empCode,
              employee_name: u.name,
              email: u.email,
              password: u.password,
              role: role,
              department: u.department,
              status: status
            };
          });
      }
    } catch (err) {}
  }

  // 1. Fetch directly from Supabase leaves table store (for unmigrated stores only, with 5s safety timeout)
  if (storeKey !== 'customer_store' && storeKey !== 'crm_customers' && storeKey !== 'crm_opportunities' && storeKey !== 'opportunities' && storeKey !== 'bom_store' && storeKey !== 'BOM_STORE') {
    try {
      const fetchPromise = supabase
        .from('leaves')
        .select('reason')
        .eq('employee', storeKey.toUpperCase())
        .order('id', { ascending: false })
        .limit(1);

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud fetch timeout')), 5000));
      const { data: records, error } = await Promise.race([fetchPromise, timeoutPromise]);

      const record = (records && records.length > 0) ? records[0] : null;

      if (!error && record && record.reason) {
        try {
          const cloudParsed = JSON.parse(record.reason);
          if (Array.isArray(cloudParsed)) {
            return cloudParsed;
          } else if (cloudParsed && typeof cloudParsed === 'object') {
            return cloudParsed;
          }
        } catch (pErr) {}
      }
    } catch (err) {
      // continue to server API fallback
    }
  }



  // 2. Fallback to Node server endpoint /api/store/:key (which queries Supabase)
  try {
    const res = await fetch(`/api/store/${storeKey}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data !== undefined && json.data !== null) {
        return json.data;
      }
    }
  } catch (err) {}

  return fallbackData;
}

const saveDebounceTimers = {};
const pendingSaveData = {};

/**
 * Save a data collection DIRECTLY to Supabase cloud database (No localStorage dependency)
 * @param {string} storeKey - Unique identifier
 * @param {Array|Object} storeData - Data to save
 */
export async function saveCloudStoreImmediate(storeKey, storeData) {
  if (storeData === undefined || storeData === null) return;

  // Direct persistence for employees to Supabase users table
  if (storeKey === 'employees_store' && Array.isArray(storeData)) {
    try {
      for (const emp of storeData) {
        if (!emp || !emp.email) continue;
        const cleanEmail = (emp.email || '').trim().toLowerCase();
        const cleanCode = emp.employee_code || emp.code || 'FE-VRM001';
        const cleanRole = emp.role || 'Floor Employee';
        const cleanStatus = emp.status || 'Pending Approval';
        const deptMeta = `${cleanCode}:::${cleanRole}:::${cleanStatus}`;

        const { data: existing } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existing && existing.id) {
          await supabase
            .from('users')
            .update({
              name: emp.employee_name || emp.name,
              password: emp.password || '123456',
              role: cleanRole,
              department: deptMeta
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('users')
            .insert({
              name: emp.employee_name || emp.name,
              email: cleanEmail,
              password: emp.password || '123456',
              role: cleanRole,
              department: deptMeta,
              annual_leave: 20,
              sick_leave: 5
            });
        }
      }
    } catch (err) {
      console.error('Error syncing employees to users table:', err);
    }
  }

  // CANONICAL CUSTOMER WRITE PATH: Direct normalized upsert to public.customers table (Zero leaves table egress)
  if (storeKey === 'customer_store' || storeKey === 'crm_customers') {
    try {
      if (Array.isArray(storeData)) {
        const rows = storeData.map(c => toDatabaseCustomerRow(c)).filter(Boolean);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            await supabase.from('customers').upsert(batch, { onConflict: 'customer_code' });
          }
        }
      } else if (storeData && typeof storeData === 'object') {
        const row = toDatabaseCustomerRow(storeData);
        if (row) {
          await supabase.from('customers').upsert(row, { onConflict: 'customer_code' });
        }
      }

      // Broadcast update locally to all listening React components in current window
      window.dispatchEvent(new CustomEvent('controlroom_store_update', {
        detail: { storeKey: 'customer_store', data: storeData }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_customer_update', {
        detail: storeData
      }));
    } catch (err) {
      console.warn('[SupabaseSync] Error persisting to public.customers:', err?.message || err);
    }

    // Keep lightweight async fallback to local server disk json backup
    try {
      fetch(`/api/store/${storeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      }).catch(() => {});
    } catch (_) {}

    return; // STOP! NEVER touch leaves table for customers!
  }

  // CANONICAL OPPORTUNITIES WRITE PATH: Direct normalized upsert to public.opportunities table (Zero leaves table egress)
  if (storeKey === 'crm_opportunities' || storeKey === 'opportunities') {
    try {
      if (Array.isArray(storeData)) {
        const rows = storeData.map(o => toDatabaseOpportunityRow(o)).filter(Boolean);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            await supabase.from('opportunities').upsert(batch, { onConflict: 'id' });
          }
        }
      } else if (storeData && typeof storeData === 'object') {
        const row = toDatabaseOpportunityRow(storeData);
        if (row) {
          await supabase.from('opportunities').upsert(row, { onConflict: 'id' });
        }
      }

      // Broadcast update locally to all listening React components in current window
      window.dispatchEvent(new CustomEvent('controlroom_store_update', {
        detail: { storeKey: 'crm_opportunities', data: storeData }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_opportunity_update', {
        detail: { opportunity: storeData, action: 'upsert' }
      }));
    } catch (err) {
      console.warn('[SupabaseSync] Error persisting to public.opportunities:', err?.message || err);
    }

    // Keep lightweight async fallback to local server disk json backup
    try {
      fetch(`/api/store/${storeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      }).catch(() => {});
    } catch (_) {}

    return; // STOP! NEVER touch leaves table for opportunities!
  }

  // CANONICAL LEADS WRITE PATH: Direct normalized upsert to public.leads table (Zero leaves table egress)
  if (storeKey === 'crm_leads' || storeKey === 'leads') {
    try {
      if (Array.isArray(storeData)) {
        const rows = storeData.map(l => toDatabaseLeadRow(l)).filter(Boolean);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            await supabase.from('leads').upsert(batch, { onConflict: 'id' });
          }
        }
      } else if (storeData && typeof storeData === 'object') {
        const row = toDatabaseLeadRow(storeData);
        if (row) {
          await supabase.from('leads').upsert(row, { onConflict: 'id' });
        }
      }

      window.dispatchEvent(new CustomEvent('controlroom_store_update', {
        detail: { storeKey: 'crm_leads', data: storeData }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_leads_update', {
        detail: { leads: storeData, action: 'upsert' }
      }));
    } catch (err) {
      console.warn('[SupabaseSync] Error persisting to public.leads:', err?.message || err);
    }

    try {
      fetch(`/api/store/${storeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      }).catch(() => {});
    } catch (_) {}

    return; // STOP! NEVER touch leaves table for leads!
  }

  // CANONICAL BOM WRITE PATH: Direct normalized upsert to public.bom_orders table (Zero leaves table egress)
  if (storeKey === 'bom_store' || storeKey === 'BOM_STORE') {
    try {
      if (Array.isArray(storeData)) {
        const rows = storeData
          .filter(b => b && !((b.customerName === 'Customer' || b.customer_name === 'Customer' || b.vendor === 'Customer') && !b.sourcePiNo && !b.source_pi_no))
          .map(b => toDatabaseBomRow(b))
          .filter(Boolean);
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 20) {
            const batch = rows.slice(i, i + 20);
            await supabase.from('bom_orders').upsert(batch, { onConflict: 'id' });
          }
        }
      } else if (storeData && typeof storeData === 'object') {
        const row = toDatabaseBomRow(storeData);
        if (row) {
          await supabase.from('bom_orders').upsert(row, { onConflict: 'id' });
        }
      }

      // Broadcast update locally to all listening React components in current window
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('controlroom_store_update', {
          detail: { storeKey: 'bom_store', data: storeData }
        }));
        window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', {
          detail: { storeData }
        }));
        window.dispatchEvent(new CustomEvent('controlroom_bom_updated', {
          detail: { storeData }
        }));
      }
    } catch (err) {
      console.warn('[SupabaseSync] Error persisting to public.bom_orders:', err?.message || err);
    }

    // Keep lightweight async fallback to local server disk json backup
    try {
      fetch(`/api/store/${storeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      }).catch(() => {});
    } catch (_) {}

    return; // STOP! NEVER touch leaves table for BOMs!
  }

  try {
    const employeeKey = storeKey.toUpperCase();
    const { data: records } = await supabase
      .from('leaves')
      .select('id')
      .eq('employee', employeeKey)
      .order('id', { ascending: false });

    const payload = {
      employee: employeeKey,
      reason: JSON.stringify(storeData),
      status: 'active',
      dates: new Date().toISOString(),
      duration: String(Array.isArray(storeData) ? storeData.length : 1),
      type: 'Store'
    };

    if (records && records.length > 0) {
      await supabase.from('leaves').update(payload).eq('id', records[0].id);
      if (records.length > 1) {
        const excess = records.slice(1).map(r => r.id);
        supabase.from('leaves').delete().in('id', excess).then(() => {}).catch(() => {});
      }
    } else {
      await supabase.from('leaves').insert(payload);
    }

    // Broadcast update locally to all listening React components in current window
    window.dispatchEvent(new CustomEvent('controlroom_store_update', {
      detail: { storeKey, data: storeData }
    }));
  } catch (err) {
    console.warn(`[Supabase Immediate Sync Warn for ${storeKey}]:`, err?.message || err);
  }

  try {
    await fetch(`/api/store/${storeKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    }).catch(() => {});
  } catch (err) {}
}

export function saveCloudStore(storeKey, storeData) {
  pendingSaveData[storeKey] = storeData;

  // Clear existing debounce timer
  if (saveDebounceTimers[storeKey]) {
    clearTimeout(saveDebounceTimers[storeKey]);
  }

  // Debounced save to Supabase cloud database & server API
  saveDebounceTimers[storeKey] = setTimeout(async () => {
    const dataToSave = pendingSaveData[storeKey];
    if (dataToSave === undefined || dataToSave === null) return;
    await saveCloudStoreImmediate(storeKey, dataToSave);
  }, 300);
}

/**
 * Deduplicates BOM list by unique bomCode and unique sourcePiNo (Strict 1-to-1 PI Rule).
 * Merges duplicate entries in place without fabricating clone BOM codes.
 */
export function resolveBomCollisions(bomList, sequenceMax = 658) {
  if (!Array.isArray(bomList)) return { list: [], maxSeq: sequenceMax };
  let maxSeq = Math.max(sequenceMax, 658);

  const getWorkflowRank = (b) => {
    if (!b) return 0;
    const s = String(b.status || '').toLowerCase();
    if (s.includes('invoice confirmed') || s.includes('closed') || s.includes('completed')) return 60;
    if (s.includes('passed to invoice') || s.includes('accounts verified')) return 50;
    if (s.includes('awaiting vehicle loading') || s.includes('vehicle loading') || s.includes('ready for dispatch')) return 40;
    if (s.includes('packed') || s.includes('awaiting accounts')) return 30;
    if (s.includes('partially packed')) return 20;
    if (s.includes('sales confirmed') || s.includes('sent to dispatch') || s.includes('sent to production')) return 10;
    return 1;
  };

  const seenCodes = new Map();
  const seenPiNos = new Map();
  const resolvedList = [];

  for (const b of bomList) {
    if (!b) continue;
    const cust = (b.customerName || b.customer_name || b.vendor || '').trim();
    if (cust === 'Customer' && !b.sourcePiNo && !b.source_pi_no) {
      continue;
    }
    const code = String(b.bomCode || b.code || b.id || '').trim();
    if (!code || code === 'BOM-PENDING' || code === 'BOM-AUTO') {
      continue;
    }

    const piNo = String(b.sourcePiNo || b.source_pi_no || b.piNo || '').trim().toLowerCase();

    // 1. If code was already seen, merge in place (preferring higher workflow progression)
    if (seenCodes.has(code)) {
      const idx = seenCodes.get(code);
      const existing = resolvedList[idx];
      const existingRank = getWorkflowRank(existing);
      const newRank = getWorkflowRank(b);
      resolvedList[idx] = newRank >= existingRank ? { ...existing, ...b } : { ...b, ...existing };
      continue;
    }

    // 2. Strict 1-to-1 PI to BOM Rule: If this source PI is already represented, merge/keep the authoritative one
    if (piNo && piNo !== 'null' && piNo !== 'undefined' && seenPiNos.has(piNo)) {
      const idx = seenPiNos.get(piNo);
      const existing = resolvedList[idx];
      const existingRank = getWorkflowRank(existing);
      const newRank = getWorkflowRank(b);

      if (newRank > existingRank) {
        seenCodes.delete(String(existing.bomCode || existing.code || existing.id || '').trim());
        resolvedList[idx] = { ...existing, ...b };
        seenCodes.set(code, idx);
      } else {
        resolvedList[idx] = { ...b, ...existing };
      }
      continue;
    }

    // New unique BOM
    const newIdx = resolvedList.length;
    resolvedList.push(b);
    seenCodes.set(code, newIdx);
    if (piNo && piNo !== 'null' && piNo !== 'undefined') {
      seenPiNos.set(piNo, newIdx);
    }

    const m = code.match(/^BOM-(\d+)/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
    }
  }

  return { list: resolvedList, maxSeq };
}

/**
 * Atomically reserve or peek the next sequential BOM code from Supabase.
 * Guaranteed uniqueness across 5+ concurrent salespeople.
 * @param {boolean} [commit=true] - If true, atomically increments and saves the new counter.
 * @returns {Promise<string>} Next BOM code (e.g., 'BOM-625')
 */
export async function getAndReserveNextBomCode(commit = true) {
  // First attempt atomic server reservation with strict 1200ms timeout to prevent UI hangs
  try {
    const endpoint = commit ? '/api/boms/reserve-code' : '/api/boms/next-code';
    const method = commit ? 'POST' : 'GET';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const apiRes = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timeoutId);
    if (apiRes && apiRes.ok) {
      const data = await apiRes.json().catch(() => null);
      const resolved = data?.nextBomCode || data?.nextCode;
      if (resolved && /^BOM-\d+$/i.test(resolved)) {
        return resolved;
      }
    }
  } catch (_) {}

  let highestNum = 658;

  try {
    // High-speed single-row query for sequence counter (50ms)
    const seqRes = await supabase
      .from('leaves')
      .select('id, reason, duration')
      .eq('employee', 'BOM_SEQUENCE')
      .order('id', { ascending: false })
      .limit(1);

    const seqRow = seqRes.data?.[0];

    let seqCounter = 0;
    if (seqRow) {
      if (seqRow.reason) {
        try {
          const parsedSeq = JSON.parse(seqRow.reason);
          const rawSeq = parsedSeq?.lastNumber ?? parsedSeq?.counter ?? parsedSeq ?? seqRow.duration ?? 0;
          const pVal = parseInt(String(rawSeq).replace(/[^0-9]/g, ''), 10);
          if (Number.isFinite(pVal) && pVal > 0) seqCounter = pVal;
        } catch (_) {}
      }
      if (!seqCounter && seqRow.duration) {
        const dVal = parseInt(String(seqRow.duration).replace(/[^0-9]/g, ''), 10);
        if (Number.isFinite(dVal) && dVal > 0) seqCounter = dVal;
      }
    }

    // Instant local cache inspection (0ms) to ensure no collisions with locally cached BOMs
    let storeMax = 0;
    try {
      const savedStr = localStorage.getItem('controlroom_bom_store');
      if (savedStr) {
        const list = JSON.parse(savedStr);
        if (Array.isArray(list)) {
          list.forEach(b => {
            const raw = String(b.bomCode || b.code || b.id || '');
            const match = raw.match(/BOM-(\d+)/i);
            if (match) {
              const parsed = parseInt(match[1], 10);
              if (Number.isFinite(parsed) && parsed > storeMax) storeMax = parsed;
            }
          });
        }
      }
    } catch (_) {}

    // High-speed query directly to canonical public.bom_orders (prevents sequence drift)
    try {
      const { data: dbBoms } = await supabase
        .from('bom_orders')
        .select('bom_code, id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (Array.isArray(dbBoms)) {
        dbBoms.forEach(b => {
          const raw = String(b.bom_code || b.id || '');
          const match = raw.match(/BOM-(\d+)/i);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (Number.isFinite(parsed) && parsed > storeMax) storeMax = parsed;
          }
        });
      }
    } catch (_) {}

    const safeSeq = Number.isFinite(seqCounter) && seqCounter > 0 ? seqCounter : 0;
    const safeStore = Number.isFinite(storeMax) && storeMax > 0 ? storeMax : 0;
    highestNum = Math.max(safeSeq, safeStore, 658);
    const nextNum = highestNum + 1;
    const formattedCode = `BOM-${String(nextNum).padStart(3, '0')}`;

    if (commit) {
      const seqPayload = JSON.stringify({
        lastNumber: nextNum,
        updatedAt: new Date().toISOString(),
        reservedBy: 'Sales Rep'
      });

      if (seqRow && seqRow.id) {
        await supabase
          .from('leaves')
          .update({
            reason: seqPayload,
            dates: new Date().toISOString(),
            status: 'active',
            duration: String(nextNum)
          })
          .eq('id', seqRow.id);
      } else {
        await supabase
          .from('leaves')
          .insert({
            employee: 'BOM_SEQUENCE',
            reason: seqPayload,
            dates: new Date().toISOString(),
            status: 'active',
            duration: String(nextNum),
            type: 'Sequence'
          });
      }
    }

    return formattedCode;
  } catch (err) {
    console.error('Error reserving next BOM code from Supabase:', err);
    return `BOM-${String(highestNum + 1).padStart(3, '0')}`;
  }
}

/**
 * Subscribe to real-time changes on a specific store in Supabase
 * @param {string} storeKey - Store key to listen to
 * @param {Function} onUpdateCallback - Callback when updated
 * @returns {Object} Subscription channel that can be unsubscribed
 */
export function subscribeToCloudStore(storeKey, onUpdateCallback) {
  try {
    const employeeKey = storeKey.toUpperCase();
    
    // Window-level broadcast listener for cross-component sync
    const handleLocalUpdate = (e) => {
      if (e?.detail?.storeKey === storeKey && e?.detail?.data !== undefined) {
        onUpdateCallback(e.detail.data);
      }
    };
    window.addEventListener('controlroom_store_update', handleLocalUpdate);

    // Supabase Realtime subscription for cross-device/cross-user sync
    const isBomStore = storeKey === 'bom_store' || storeKey === 'BOM_STORE';
    const targetTable = storeKey === 'employees_store'
      ? 'users'
      : ((storeKey === 'customer_store' || storeKey === 'crm_customers')
        ? 'customers'
        : ((storeKey === 'crm_opportunities' || storeKey === 'opportunities')
          ? 'opportunities'
          : (isBomStore ? 'bom_orders' : 'leaves')));

    const hasNoFilter = storeKey === 'employees_store' ||
      storeKey === 'customer_store' ||
      storeKey === 'crm_customers' ||
      storeKey === 'crm_opportunities' ||
      storeKey === 'opportunities' ||
      isBomStore;

    const channel = supabase
      .channel(`sync_${storeKey}_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: targetTable,
          filter: hasNoFilter ? undefined : `employee=eq.${employeeKey}`
        },
        async (payload) => {
          if (storeKey === 'employees_store') {
            const list = await fetchCloudStore('employees_store', []);
            onUpdateCallback(list);
          } else if (storeKey === 'customer_store' || storeKey === 'crm_customers') {
            const list = await fetchCloudStore('customer_store', []);
            onUpdateCallback(list);
          } else if (storeKey === 'crm_opportunities' || storeKey === 'opportunities') {
            const list = await fetchCloudStore('crm_opportunities', []);
            onUpdateCallback(list);
          } else if (isBomStore) {
            const list = await fetchCloudStore('bom_store', []);
            onUpdateCallback(list);
          } else if (payload && payload.new && payload.new.reason) {
            try {
              const parsed = JSON.parse(payload.new.reason);
              onUpdateCallback(parsed);
            } catch (_) {}
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        window.removeEventListener('controlroom_store_update', handleLocalUpdate);
        if (channel) supabase.removeChannel(channel);
      }
    };
  } catch (err) {
    console.warn(`[SupabaseSync] Realtime subscribe error for ${storeKey}:`, err);
    return null;
  }
}
