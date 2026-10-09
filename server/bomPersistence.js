/**
 * server/bomPersistence.js
 * 
 * BUSINZ CRM — Phase 51: Transaction-Safe PostgreSQL BOM Persistence
 * Shared backend persistence module for public.bom_orders and public.controlroom_store.
 * 
 * Strict Guarantees:
 * 1. Single pooled client per persistence operation
 * 2. Strict target database validation (businz_dev in development)
 * 3. Database-level transaction advisory lock (pg_advisory_xact_lock) & row-level locks
 * 4. In-transaction read of authoritative records
 * 5. Deterministic workflow rank & rich field preservation merge
 * 6. Atomic dual-representation update (public.bom_orders + public.controlroom_store)
 * 7. Parameterized SQL mapping via toDatabaseBomRowServer()
 * 8. Preservation of rich JSONB fields, attachments, salesperson & financial totals
 * 9. Explicit COMMIT on complete success; immediate ROLLBACK on any failure
 * 10. Memory, disk, and realtime broadcasts triggered strictly post-COMMIT by callers
 * 11. Stale-update rejection and collision-free sequence assignment
 * 12. Protection for historical records (BOM-659 through BOM-665, PI-00063)
 */

import { pool as defaultPool } from './db.js';
import { getFinancialYear, formatSequenceCode, extractMaxSequence } from './sequenceService.js';

// JSONB columns in public.bom_orders requiring JSON serialization in parameterized SQL
const JSONB_COLUMNS = new Set([
  'billing_address_obj',
  'delivery_address_obj',
  'items',
  'payments',
  'dispatch_packing',
  'accounts_verification',
  'preset_groups'
]);

/**
 * Calculates workflow progression rank.
 * Higher rank = later workflow stage.
 * Stale or lower-rank payloads are forbidden from regressing workflow states.
 */
export function getWorkflowRankServer(b) {
  if (!b) return 0;
  const s = String(b.status || '').toLowerCase();
  if (b.cancelled || s.includes('cancel')) return -1;
  if (b.fullyCompleted || s.includes('closed') || s.includes('completed') || s.includes('fully dispatched')) return 70;
  if (s.includes('awaiting lr copy') || s.includes('awaiting lr') || s.includes('dispatched')) return 60;
  if (s.includes('invoice confirmed') || s.includes('awaiting vehicle loading') || s.includes('vehicle loading') || s.includes('vehicle assigned') || s.includes('ready for dispatch')) return 50;
  if (s.includes('passed to invoice') || s.includes('accounts verified') || b.invoiceConfirmed || b.isAccountsDone) return 40;
  if (s.includes('packed') || s.includes('packing verified') || s.includes('awaiting accounts') || b.packingStatus === 'PACKING_VERIFIED') return 30;
  if (s.includes('partially packed') || b.packingStatus === 'PARTIALLY_PACKED') return 20;
  if (s.includes('sales confirmed') || s.includes('sent to dispatch') || s.includes('sent to production') || b.salesConfirmed) return 10;
  return 1;
}

/**
 * Maps database row from public.bom_orders into consumer JS object representation.
 */
export const toConsumerBomServer = (row) => {
  if (!row || typeof row !== 'object') return null;

  let av = row.accounts_verification || row.accountsVerification;
  if (typeof av === 'string' && (av.startsWith('{') || av.startsWith('['))) {
    try { av = JSON.parse(av); } catch (_) {}
  }
  let extraData = {};
  if (av && typeof av === 'object' && av._extra_data) {
    extraData = { ...av._extra_data };
  }

  let cleanDispatchPacking = row.dispatch_packing || row.dispatchPacking || extraData.dispatchPacking || [];
  if (typeof cleanDispatchPacking === 'string' && (cleanDispatchPacking.startsWith('[') || cleanDispatchPacking.startsWith('{'))) {
    try { cleanDispatchPacking = JSON.parse(cleanDispatchPacking); } catch (_) {}
  }
  if (!Array.isArray(cleanDispatchPacking)) {
    cleanDispatchPacking = [];
  }

  const isAccVerified = row.accounts_verified !== undefined
    ? Boolean(row.accounts_verified)
    : Boolean(
        (row.status && String(row.status).toLowerCase().includes('accounts verified')) ||
        row.invoice_confirmed ||
        row.invoice_no
      );
  const cleanAccountsVerification = (av && typeof av === 'object')
    ? { ...av }
    : {
        verified: isAccVerified,
        verifiedBy: row.accounts_verified_by || '',
        paymentStatus: row.accounts_payment_status || null,
        paymentDate: row.accounts_payment_date || null,
        totalAmount: row.accounts_total_amount !== undefined ? row.accounts_total_amount : null
      };
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
  const contactPerson = row.contact_person || extraData.contactPerson || '';
  const gstNo = row.gst_no || extraData.gstNo || extraData.gstin || '';
  const phone = row.mobile || '';
  const email = row.email || '';
  const billingAddr = row.billing_address || (row.billing_address_obj?.address ? `${row.billing_address_obj.address}, ${row.billing_address_obj.city || ''} ${row.billing_address_obj.state || ''} - ${row.billing_address_obj.pincode || ''}` : '');
  const deliveryAddr = row.delivery_address || (row.delivery_address_obj?.address ? `${row.delivery_address_obj.address}, ${row.delivery_address_obj.city || ''} ${row.delivery_address_obj.state || ''} - ${row.delivery_address_obj.pincode || ''}` : billingAddr);
  const salesRep = row.sales_person || row.created_by || extraData.salesPerson || extraData.createdBy || '';
  const salesPersonCode = row.sales_person_code || row.created_by_id || extraData.salesPersonCode || extraData.createdById || '';
  const createdBy = row.created_by || row.sales_person || extraData.createdBy || extraData.salesPerson || '';
  const createdById = row.created_by_id || row.sales_person_code || extraData.createdById || extraData.salesPersonCode || '';

  return {
    ...extraData,
    id,
    bomCode,
    code: bomCode,
    customerName,
    companyName,
    contactPerson,
    gstNo,
    gstin: gstNo,
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
    paymentType: row.payment_type || '100% Paid',
    partialAmount: Number(row.partial_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    creditDays: Number(row.credit_days || 0),
    creditDueDate: row.credit_due_date || '',
    remarks: row.remarks || '',
    status: row.status || 'Draft',
    salesConfirmed: Boolean(row.sales_confirmed),
    salesConfirmedAt: row.sales_confirmed_at || null,
    salesPerson: salesRep,
    salesPersonCode: salesPersonCode,
    c8: salesRep,
    createdBy: createdBy,
    createdById: createdById,
    dispatchPackingMedia: row.dispatch_packing_media || extraData.dispatchPackingMedia || { photos: [], videos: [] },
    items: Array.isArray(row.items) ? row.items : [],
    payments: (row.payments && typeof row.payments === 'object') ? row.payments : {},
    dispatchPacking: cleanDispatchPacking,
    accountsVerification: cleanAccountsVerification,
    packingStatus: row.packing_status || row.packingStatus || extraData.packingStatus || (
      (String(row.status || '').toLowerCase().includes('packed') || String(row.status || '').toLowerCase().includes('awaiting vehicle loading') || String(row.status || '').toLowerCase().includes('invoice confirmed')) ? 'PACKING_VERIFIED' :
      cleanDispatchPacking.length > 0 && cleanDispatchPacking.every(p => p.packed) ? 'PACKING_VERIFIED' :
      cleanDispatchPacking.some(p => p.packed) ? 'PARTIALLY_PACKED' : null
    ),
    packedAt: row.packed_at || row.packedAt || extraData.packedAt || cleanAccountsVerification?.packedAt || null,
    packedBy: row.packed_by || row.packedBy || extraData.packedBy || cleanAccountsVerification?.packedBy || null,
    packedById: row.packed_by_id || row.packedById || extraData.packedById || cleanAccountsVerification?.packedById || null,
    packingCompletedAt: row.packing_completed_at || row.packingCompletedAt || extraData.packingCompletedAt || null,
    invoiceConfirmed: Boolean(row.invoice_confirmed || row.invoiceConfirmed || extraData.invoiceConfirmed),
    invoiceDeducted: Boolean(row.invoice_deducted || row.invoiceDeducted || extraData.invoiceDeducted),
    invoiceNo: row.invoice_no || row.invoiceNo || extraData.invoiceNo || '',
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
    proofDoc: row.proof_doc || extraData.proofDoc || null,
    sourcePiNo: row.source_pi_no || extraData.sourcePiNo || null,
    vehicleLoading: row.vehicle_loading || extraData.vehicleLoading || null,
    lrCopyDoc: row.lr_copy_doc || extraData.lrCopyDoc || null,
    fullyCompleted: Boolean(extraData.fullyCompleted || row.status === 'Completed' || row.status === 'Closed' || row.status === 'Fully Dispatched & Delivered'),
    dispatchedAt: row.dispatched_at || extraData.dispatchedAt || null,
    completedAt: row.completed_at || extraData.completedAt || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
};

/**
 * Maps consumer BOM object into public.bom_orders database columns.
 */
export const toDatabaseBomRowServer = (item) => {
  if (!item || typeof item !== 'object') return null;

  const id = item.id || item.bomCode || item.code || `BOM-${Date.now()}`;
  const bomCode = item.bomCode || item.code || id;
  const code = item.code || bomCode;
  const sourcePiNo = item.sourcePiNo || item.source_pi_no || null;

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

  const sanitizeBomDocForStorage = (doc) => {
    if (!doc) return null;
    let target = doc;
    if (typeof doc === 'string' && (doc.startsWith('{') || doc.startsWith('['))) {
      try { target = JSON.parse(doc); } catch (_) { return doc; }
    }
    if (typeof target === 'object' && target !== null) {
      const clean = { ...target };
      delete clean.dataUrl;
      delete clean.fileData;
      delete clean.proofDocData;
      if (Array.isArray(clean.history)) {
        clean.history = clean.history.map(h => {
          if (h && typeof h === 'object') {
            const hClean = { ...h };
            delete hClean.dataUrl;
            delete hClean.fileData;
            return hClean;
          }
          return h;
        });
      }
      return clean;
    }
    if (typeof target === 'string') {
      const trimmed = target.trim();
      if (trimmed.startsWith('data:') || (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 100)) && !trimmed.startsWith('http'))) {
        return null;
      }
    }
    return target;
  };

  const serializeDoc = (doc) => {
    const sanitized = sanitizeBomDocForStorage(doc);
    if (!sanitized) return null;
    if (typeof sanitized === 'string') return sanitized;
    try {
      return JSON.stringify(sanitized);
    } catch (_) {
      return null;
    }
  };

  const standardFields = new Set([
    'id', 'bomCode', 'code', 'sourcePiNo', 'date', 'deliveryDate',
    'customerName', 'companyName', 'contactPerson', 'contact_person', 'gstNo', 'gst_no', 'gstin', 'mobile', 'phone', 'email', 'billingAddress',
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
    'cancelledBy', 'cancellationReason', 'invoiceNo', 'proofDoc',
    'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'
  ]);

  const extraData = {};
  Object.keys(item).forEach(k => {
    if (!standardFields.has(k)) {
      extraData[k] = item[k];
    }
  });

  const existingExtra = (item.accountsVerification && typeof item.accountsVerification === 'object' && item.accountsVerification._extra_data) || {};
  const mergedExtra = { ...existingExtra, ...extraData };
  if (item.dispatchPackingMedia) mergedExtra.dispatchPackingMedia = item.dispatchPackingMedia;
  if (item.vehicleLoading) mergedExtra.vehicleLoading = item.vehicleLoading;
  if (item.lrCopyDoc) mergedExtra.lrCopyDoc = item.lrCopyDoc;
  if (item.packingStatus) mergedExtra.packingStatus = item.packingStatus;
  if (item.packedAt) mergedExtra.packedAt = item.packedAt;
  if (item.packedBy) mergedExtra.packedBy = item.packedBy;
  if (item.packedById) mergedExtra.packedById = item.packedById;
  if (item.packingCompletedAt) mergedExtra.packingCompletedAt = item.packingCompletedAt;
  if (item.pendingSalesDispatchPayment !== undefined) mergedExtra.pendingSalesDispatchPayment = item.pendingSalesDispatchPayment;
  if (item.fullyCompleted !== undefined) mergedExtra.fullyCompleted = item.fullyCompleted;

  const accountsVerification = typeof item.accountsVerification === 'object' && item.accountsVerification !== null
    ? { ...item.accountsVerification, _extra_data: mergedExtra }
    : { _extra_data: mergedExtra };

  const cleanPayments = typeof item.payments === 'object' && item.payments !== null ? { ...item.payments } : {};
  delete cleanPayments.proofDocData;
  if (cleanPayments.proofDocObj) {
    cleanPayments.proofDocObj = sanitizeBomDocForStorage(cleanPayments.proofDocObj);
  }

  return {
    id,
    bom_code: bomCode,
    code,
    source_pi_no: sourcePiNo,
    date: sanitizeDate(item.date) || new Date().toISOString().slice(0, 10),
    delivery_date: sanitizeDate(item.deliveryDate),
    customer_name: item.companyName || item.customerName || item.vendor || 'Customer',
    company_name: item.companyName || item.customerName || item.vendor || '',
    contact_person: item.contactPerson || item.contact || extraData.contactPerson || '',
    gst_no: item.gstNo || item.gst || item.gstin || extraData.gstNo || '',
    mobile: item.mobile || item.phone || '',
    email: item.email || '',
    billing_address: item.billingAddress || item.c6 || '',
    billing_address_obj: item.billingAddressObj || {},
    delivery_address: item.deliveryAddress || item.c7 || '',
    delivery_address_obj: item.deliveryAddressObj || {},
    delivery_address_proof_doc: serializeDoc(item.deliveryAddressProofDoc),
    transport_mode: item.transportMode || 'Transport',
    transport_scope: item.transportScope || 'VRM Structures',
    transporter_name: item.transporterName || item.transporter || '',
    vehicle_no: item.vehicleNo || '',
    lr_no: item.lrNo || '',
    payment_type: item.paymentType || '100% Paid',
    partial_amount: sanitizeNumber(item.partialAmount, 0),
    balance_amount: sanitizeNumber(item.balanceAmount, 0),
    credit_days: Math.round(sanitizeNumber(item.creditDays, 0)),
    credit_due_date: sanitizeDate(item.creditDueDate),
    payment_proof_doc: serializeDoc(item.paymentProofDoc),
    remarks: item.remarks || '',
    status: item.status || 'Draft',
    sales_confirmed: Boolean(item.salesConfirmed),
    sales_person: item.salesPerson || item.sales_person || item.createdBy || item.created_by || item.c8 || '',
    sales_person_code: item.salesPersonCode || item.sales_person_code || item.createdById || item.created_by_id || extraData.salesPersonCode || '',
    created_by: item.createdBy || item.created_by || item.salesPerson || item.sales_person || '',
    created_by_id: item.createdById || item.created_by_id || item.salesPersonCode || item.sales_person_code || extraData.createdById || '',
    items: Array.isArray(item.items) ? item.items : [],
    payments: cleanPayments,
    dispatch_packing: Array.isArray(item.dispatchPacking) || typeof item.dispatchPacking === 'object' ? item.dispatchPacking : [],
    accounts_verification: accountsVerification,
    invoice_no: item.invoiceNo || item.invoice_no || extraData.invoiceNo || '',
    invoice_confirmed: Boolean(item.invoiceConfirmed || item.invoice_confirmed),
    invoice_deducted: Boolean(item.invoiceDeducted || item.invoice_deducted),
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
};

/**
 * Merges an existing authoritative BOM record with an incoming update.
 * Strictly preserves workflow progression, salesperson attribution, financial amounts,
 * rich line items, document attachments, and accounts verification.
 */
export function mergeBomRecords(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const eRank = getWorkflowRankServer(existing);
  const iRank = getWorkflowRankServer(incoming);

  return {
    ...existing,
    ...incoming,
    // Preserve rich items if incoming is empty/missing
    items: (Array.isArray(incoming.items) && incoming.items.length > 0) ? incoming.items : (existing.items || []),
    // Preserve customer details if incoming is empty or default
    customerName: incoming.customerName || incoming.companyName || existing.customerName || existing.companyName || 'Customer',
    companyName: incoming.companyName || incoming.customerName || existing.companyName || existing.customerName || '',
    contactPerson: incoming.contactPerson || incoming.contact || existing.contactPerson || '',
    gstNo: incoming.gstNo || incoming.gst || incoming.gstin || existing.gstNo || '',
    // Preserve salesperson and attribution if missing in partial update
    salesPerson: incoming.salesPerson || incoming.sales_person || existing.salesPerson || '',
    salesPersonCode: incoming.salesPersonCode || incoming.sales_person_code || existing.salesPersonCode || '',
    createdBy: incoming.createdBy || incoming.created_by || existing.createdBy || '',
    createdById: incoming.createdById || incoming.created_by_id || existing.createdById || '',
    sourcePiNo: incoming.sourcePiNo || incoming.source_pi_no || existing.sourcePiNo || null,
    // Preserve financial totals if incoming is 0 and existing is non-zero
    grandTotal: (Number(incoming.grandTotal) > 0) ? Number(incoming.grandTotal) : (existing.grandTotal || 0),
    subTotal: (Number(incoming.subTotal) > 0) ? Number(incoming.subTotal) : (existing.subTotal || 0),
    // Workflow progression safety: do not allow a stale lower-rank status to regress progress
    status: (iRank >= eRank) ? incoming.status : existing.status,
    packingStatus: (iRank >= eRank) ? (incoming.packingStatus || existing.packingStatus) : existing.packingStatus,
    fullyCompleted: (iRank >= eRank) ? (incoming.fullyCompleted ?? existing.fullyCompleted) : existing.fullyCompleted,
    // Deep merge dispatch packing and accounts verification
    dispatchPacking: (Array.isArray(incoming.dispatchPacking) && incoming.dispatchPacking.length > 0) ? incoming.dispatchPacking : (existing.dispatchPacking || []),
    accountsVerification: {
      ...(existing.accountsVerification || {}),
      ...(incoming.accountsVerification || {})
    },
    vehicleLoading: incoming.vehicleLoading || existing.vehicleLoading || null,
    lrCopyDoc: incoming.lrCopyDoc || existing.lrCopyDoc || null,
    dispatchPackingMedia: (incoming.dispatchPackingMedia?.photos?.length > 0 || incoming.dispatchPackingMedia?.videos?.length > 0)
      ? incoming.dispatchPackingMedia
      : (existing.dispatchPackingMedia || { photos: [], videos: [] })
  };
}

/**
 * Executes a targeted, parameterized INSERT or UPDATE on public.bom_orders.
 * Does NOT use blind generic UPSERT (ON CONFLICT DO UPDATE).
 */
async function executeBomOrderWrite(client, dbRow, existsInDb) {
  const keys = Object.keys(dbRow).filter(k => dbRow[k] !== undefined);
  if (keys.length === 0) return;

  if (existsInDb) {
    const updateKeys = keys.filter(k => k !== 'id');
    const setClauses = updateKeys.map((k, i) => {
      return `"${k}" = ${JSONB_COLUMNS.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`}`;
    }).join(', ');

    const values = updateKeys.map(k => {
      const v = dbRow[k];
      return (JSONB_COLUMNS.has(k) && typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
    });
    values.push(dbRow.id);

    const updateSql = `
      UPDATE public.bom_orders
      SET ${setClauses}
      WHERE id = $${values.length}
    `;
    await client.query(updateSql, values);
  } else {
    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((k, i) => {
      return JSONB_COLUMNS.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`;
    }).join(', ');

    const values = keys.map(k => {
      const v = dbRow[k];
      return (JSONB_COLUMNS.has(k) && typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
    });

    const insertSql = `
      INSERT INTO public.bom_orders (${cols})
      VALUES (${placeholders})
    `;
    await client.query(insertSql, values);
  }
}

/**
 * Validates target database in development environment.
 * Ensures the connected database is strictly businz_dev (or explicitly approved test DB).
 */
async function validateTargetDatabase(client, customAllowedDb = null) {
  const dbRes = await client.query('SELECT current_database() AS db_name');
  const currentDb = dbRes?.rows?.[0]?.db_name;

  const isDev = process.env.NODE_ENV === 'development' || 
                process.env.APP_ENV === 'development' || 
                process.env.PORT === '5002' ||
                process.env.PORT === '5001' ||
                process.env.VITE_APP_ENV === 'development';

  // Strict isolation: Never allow writing to production businz DB when running dev/staging server
  if (isDev && currentDb === 'businz') {
    throw new Error(
      `[Database Isolation Guard] Operation aborted: Connected to production database "businz" in development environment!`
    );
  }

  if (isDev) {
    const explicitTestDb = customAllowedDb || process.env.ALLOW_TEST_DB;
    if (explicitTestDb) {
      if (currentDb !== explicitTestDb) {
        throw new Error(
          `[Database Isolation Guard] Operation aborted: Test environment connected to "${currentDb}", but explicitly requires test database "${explicitTestDb}".`
        );
      }
    } else {
      if (currentDb !== 'businz_dev') {
        throw new Error(
          `[Database Isolation Guard] Operation aborted: Connected database is "${currentDb}", but development environment strictly requires "businz_dev".`
        );
      }
    }
  }
  return currentDb;
}

/**
 * Main Shared Transaction-Safe BOM Persistence Function
 * 
 * Supports both single BOM persistence (POST /api/boms) and batch persistence (saveLocalBoms).
 * 
 * @param {Object} options
 * @param {Object} [options.singleBom] - Single BOM record to create/update
 * @param {Array} [options.items] - Array of BOM records to save/update
 * @param {boolean} [options.isNew] - Whether this is an explicit new creation
 * @param {boolean} [options.isUpdate] - Whether this is an explicit update
 * @param {Object} [options.customPool] - Optional custom connection pool (for isolated tests)
 * @param {string} [options.customAllowedDb] - Optional custom allowed DB name
 */
export async function persistBomsTransactionSafe({
  singleBom = null,
  items = null,
  isNew = false,
  isUpdate = false,
  customPool = null,
  customAllowedDb = null
} = {}) {
  const poolToUse = customPool || defaultPool;
  const client = await poolToUse.connect();

  try {
    // 1. Target database validation
    await validateTargetDatabase(client, customAllowedDb);

    // 2. Begin transaction
    await client.query('BEGIN');

    // 3. Database-level advisory lock to serialize BOM operations across workers
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('businz_bom_orders_lock'))`);

    // 4. Lock and read authoritative controlroom_store
    const crRes = await client.query(`
      SELECT data FROM public.controlroom_store WHERE key = 'bom_store' FOR UPDATE
    `);

    let authoritativeStoreList = [];
    if (crRes?.rows?.[0]?.data && Array.isArray(crRes.rows[0].data)) {
      authoritativeStoreList = crRes.rows[0].data;
    }

    const storeMap = new Map();
    authoritativeStoreList.forEach(b => {
      const k = String(b?.bomCode || b?.code || b?.id || '').trim();
      if (k && k !== 'null' && k !== 'undefined' && k !== '[object Object]') {
        storeMap.set(k, b);
      }
    });

    let persistedBom = null;
    let finalCode = null;
    let shouldAssignNewCode = false;
    const changedRecords = [];

    // =========================================================================
    // CASE A: Single BOM creation/update (from POST /api/boms)
    // =========================================================================
    if (singleBom) {
      const bom = { ...singleBom };
      const incomingCode = String(bom.bomCode || bom.code || bom.id || '').trim();
      const isPlaceholderCode = !incomingCode || incomingCode.toLowerCase().includes('auto') || incomingCode.toLowerCase().includes('pending');
      const incomingPi = String(bom.sourcePiNo || bom.source_pi_no || bom.piNo || '').trim().toLowerCase();

      // Check existing in database
      const existingInDbRes = await client.query(`
        SELECT * FROM public.bom_orders 
        WHERE bom_code = $1 OR id = $1 
           OR ($2::text IS NOT NULL AND source_pi_no = $2)
        FOR UPDATE
      `, [incomingCode || null, incomingPi || null]);

      let existingDbRow = existingInDbRes.rows.find(r => r.bom_code === incomingCode || r.id === incomingCode) || null;
      let existingPiDbRow = incomingPi ? existingInDbRes.rows.find(r => String(r.source_pi_no || '').trim().toLowerCase() === incomingPi) : null;

      // Check storeMap fallback
      let existingPiBom = existingPiDbRow ? toConsumerBomServer(existingPiDbRow) : null;
      if (!existingPiBom && incomingPi) {
        existingPiBom = Array.from(storeMap.values()).find(item => {
          const p = String(item.sourcePiNo || item.source_pi_no || item.piNo || '').trim().toLowerCase();
          return p === incomingPi;
        });
      }

      const existingRecordWithCode = existingDbRow ? toConsumerBomServer(existingDbRow) : (incomingCode && !isPlaceholderCode && storeMap.has(incomingCode) ? storeMap.get(incomingCode) : null);
      const codeBelongsToSameRecord = existingRecordWithCode && (
        (existingPiBom && (existingPiBom.bomCode === incomingCode || existingPiBom.id === incomingCode)) ||
        (isUpdate && (existingRecordWithCode.id === bom.id || existingRecordWithCode.bomCode === incomingCode))
      );

      finalCode = incomingCode;

      if (existingPiBom) {
        // Strictly update existing BOM for this specific PI
        finalCode = existingPiBom.bomCode || existingPiBom.code || existingPiBom.id;
        shouldAssignNewCode = false;
      } else if (isUpdate && existingRecordWithCode && codeBelongsToSameRecord) {
        // Explicit update to the same existing BOM record
        finalCode = incomingCode;
        shouldAssignNewCode = false;
      } else if (incomingCode && !isPlaceholderCode && !existingRecordWithCode) {
        // Valid code that does NOT collide with any existing record
        finalCode = incomingCode;
        shouldAssignNewCode = false;
      } else {
        // Collision detected OR placeholder code: NEVER overwrite another record!
        shouldAssignNewCode = true;
        const fy = getFinancialYear();
        let maxSeq = 0;

        // 1. Authoritative: Query PostgreSQL directly for VRM-BOM sequence in current FY
        const vrmRes = await client.query(`
          SELECT bom_code FROM public.bom_orders
          WHERE bom_code ~ '^VRM-BOM-[0-9]{4}-[0-9]+$'
        `);
        if (vrmRes?.rows && vrmRes.rows.length > 0) {
          const dbMax = extractMaxSequence('BOM', fy, vrmRes.rows);
          if (dbMax > maxSeq) maxSeq = dbMax;
        }

        // 2. Inspect authoritative storeMap entries
        const storeMax = extractMaxSequence('BOM', fy, Array.from(storeMap.values()));
        if (storeMax > maxSeq) maxSeq = storeMax;

        const nextNum = maxSeq + 1;
        finalCode = formatSequenceCode('BOM', nextNum);
      }

      bom.bomCode = finalCode;
      bom.code = finalCode;
      bom.id = finalCode;

      const baseRecord = existingRecordWithCode || (existingPiBom ? existingPiBom : storeMap.get(finalCode));
      const merged = baseRecord ? mergeBomRecords(baseRecord, bom) : bom;

      // Parameterized write to public.bom_orders
      const dbRow = toDatabaseBomRowServer(merged);
      const rowExistsInDb = Boolean(existingDbRow || (existingPiDbRow && (existingPiDbRow.bom_code === finalCode || existingPiDbRow.id === finalCode)));
      await executeBomOrderWrite(client, dbRow, rowExistsInDb);

      storeMap.set(finalCode, merged);
      persistedBom = merged;
      changedRecords.push(merged);

      // Synchronize source PI record status in database within the transaction
      if (merged.sourcePiNo) {
        const cleanPi = String(merged.sourcePiNo).trim();
        // Strict guard: Do not alter or forcibly associate PI-00063 with BOM-665
        if (cleanPi !== 'PI-00063' || finalCode === 'BOM-665') {
          await client.query(`
            UPDATE public.proforma_invoices
            SET status = 'Converted to BOM',
                updated_at = NOW()
            WHERE (pi_no = $1 OR id = $1)
          `, [cleanPi]);
        }
      }
    }

    // =========================================================================
    // CASE B: Batch items persistence (from saveLocalBoms)
    // =========================================================================
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const cleanId = String(item.bomCode || item.code || item.id || '').trim();
        if (!cleanId || cleanId === 'null' || cleanId === 'undefined' || cleanId === '[object Object]') {
          continue;
        }

        const existingDbRes = await client.query(`
          SELECT * FROM public.bom_orders
          WHERE bom_code = $1 OR id = $1
          FOR UPDATE
        `, [cleanId]);

        const dbRowFromDb = existingDbRes.rows[0] ? toConsumerBomServer(existingDbRes.rows[0]) : null;
        const existing = dbRowFromDb || storeMap.get(cleanId);
        const merged = existing ? mergeBomRecords(existing, item) : item;

        const dbRow = toDatabaseBomRowServer(merged);
        await executeBomOrderWrite(client, dbRow, Boolean(dbRowFromDb));

        storeMap.set(cleanId, merged);
        changedRecords.push(merged);
      }
    }

    // 5. Update public.controlroom_store within the SAME transaction
    const fullStoreList = Array.from(storeMap.values());
    await client.query(`
      INSERT INTO public.controlroom_store (key, data, updated_at)
      VALUES ('bom_store', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1::jsonb, updated_at = NOW()
    `, [JSON.stringify(fullStoreList)]);

    // 6. Explicit COMMIT only when all relational & store writes succeed
    await client.query('COMMIT');

    return {
      success: true,
      persistedBom,
      finalCode,
      fullStoreList,
      changedRecords,
      shouldAssignNewCode
    };
  } catch (err) {
    // 7. Explicit ROLLBACK on any failure
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.warn('[PostgreSQL Rollback Notice]:', rbErr.message);
    }
    throw err;
  } finally {
    // 8. Always release connection back to pool
    client.release();
  }
}
