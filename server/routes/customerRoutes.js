import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createCustomerRouter(dependencies) {
  const router = Router();
  const {
    requireBusinzSession,
    requireRole,
    broadcastRealtimeEvent,
    createInternalNotification,
    deduplicateCustomerRecords,
    formatSequenceCode,
    getFinancialYear,
    getNextSequence,
    isDbConnected,
    isExecutiveOrAdminRole,
    isValidCustomerCode,
    loadDatabaseCustomers,
    loadLocalCustomers,
    saveLocalCustomers,
    safeWriteJsonFileAsync,
    query,
    supabaseMemoryStore
  } = dependencies;

  const parseSafeNumber = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };

  let customersSchemaEnsured = false;
  async function ensureCustomersSchema() {
    if (customersSchemaEnsured || !query) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS public.customers (
          id TEXT PRIMARY KEY,
          customer_code TEXT,
          company_name TEXT NOT NULL,
          customer_name TEXT,
          customer_type TEXT DEFAULT 'Customer',
          industry TEXT,
          gst_number TEXT,
          pan_number TEXT,
          billing_address TEXT,
          city TEXT,
          state TEXT,
          pincode TEXT,
          billing_address_obj JSONB DEFAULT '{}'::jsonb,
          dispatch_address TEXT,
          dispatch_city TEXT,
          dispatch_state TEXT,
          dispatch_pincode TEXT,
          delivery_address_obj JSONB DEFAULT '{}'::jsonb,
          same_as_billing BOOLEAN DEFAULT false,
          credit_limit NUMERIC DEFAULT 0,
          credit_days INTEGER DEFAULT 0,
          payment_terms TEXT DEFAULT 'Due on Receipt',
          assigned_salesperson TEXT,
          source TEXT DEFAULT 'Manual',
          primary_contact JSONB DEFAULT '{}'::jsonb,
          email TEXT,
          phone TEXT,
          status TEXT DEFAULT 'Active',
          notes TEXT,
          credit_approved BOOLEAN DEFAULT FALSE,
          credit_status TEXT DEFAULT 'none',
          credit_requested_limit NUMERIC DEFAULT 0,
          credit_requested_by TEXT DEFAULT '',
          credit_requested_at TIMESTAMPTZ,
          credit_approved_by TEXT DEFAULT '',
          credit_approved_at TIMESTAMPTZ,
          credit_rejection_reason TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const cols = [
        'customer_code TEXT',
        'company_name TEXT',
        'customer_name TEXT',
        "customer_type TEXT DEFAULT 'Customer'",
        'industry TEXT',
        'gst_number TEXT',
        'pan_number TEXT',
        'billing_address TEXT',
        'city TEXT',
        'state TEXT',
        'pincode TEXT',
        "billing_address_obj JSONB DEFAULT '{}'::jsonb",
        'dispatch_address TEXT',
        'dispatch_city TEXT',
        'dispatch_state TEXT',
        'dispatch_pincode TEXT',
        "delivery_address_obj JSONB DEFAULT '{}'::jsonb",
        'same_as_billing BOOLEAN DEFAULT false',
        'credit_limit NUMERIC DEFAULT 0',
        'credit_days INTEGER DEFAULT 0',
        "payment_terms TEXT DEFAULT 'Due on Receipt'",
        'assigned_salesperson TEXT',
        "source TEXT DEFAULT 'Manual'",
        "primary_contact JSONB DEFAULT '{}'::jsonb",
        'email TEXT',
        'phone TEXT',
        "status TEXT DEFAULT 'Active'",
        'notes TEXT',
        'credit_approved BOOLEAN DEFAULT FALSE',
        "credit_status TEXT DEFAULT 'none'",
        'credit_requested_limit NUMERIC DEFAULT 0',
        "credit_requested_by TEXT DEFAULT ''",
        'credit_requested_at TIMESTAMPTZ',
        "credit_approved_by TEXT DEFAULT ''",
        'credit_approved_at TIMESTAMPTZ',
        "credit_rejection_reason TEXT DEFAULT ''"
      ];
      for (const c of cols) {
        await query(`ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ${c}`).catch(() => {});
      }

      await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code_unique ON public.customers (customer_code)`).catch(() => {});
      customersSchemaEnsured = true;
    } catch (err) {
      console.warn('[ensureCustomersSchema Notice]:', err.message);
    }
  }

  ensureCustomersSchema().catch(() => {});

  router.post('/api/customers', requireBusinzSession, async (req, res) => {
    try {
      await ensureCustomersSchema().catch(() => {});
      const loadedCustomers = await loadDatabaseCustomers();
  const localCustomers = Array.isArray(loadedCustomers) ? loadedCustomers : [];
  const isBulk = Array.isArray(req.body);
  const incomingList = isBulk ? req.body : [req.body];

  if (incomingList.length === 0) {
    return res.status(400).json({ success: false, error: 'No customer data provided.' });
  }

  const normalizeCustName = (n) => {
    if (!n) return '';
    return String(n)
      .toLowerCase()
      .replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp|enterprises|solutions)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const normalizeCustGst = (g) => {
    if (!g) return '';
    const clean = String(g).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    return clean.length >= 10 ? clean : '';
  };

  const normalizeCustPhone = (p) => {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '';
  };

  // Build multi-index lookup maps over localCustomers for strict deduplication
  const byCode = new Map();
  const byGst = new Map();
  const byName = new Map();
  const byPhone = new Map();
  const existingMap = new Map();

  localCustomers.forEach(c => {
    const codeKey = String(c.customerCode || c.id || '').trim().toLowerCase();
    const gstKey = normalizeCustGst(c.gstNumber || c.gstNo || c.gstin);
    const nameKey = normalizeCustName(c.companyName || c.customerName || c.name);
    const phoneKey = normalizeCustPhone(c.phone || c.mobile || c.primaryContact?.phone);

    if (codeKey) {
      byCode.set(codeKey, c);
      existingMap.set(codeKey, c);
    }
    if (gstKey) byGst.set(gstKey, c);
    if (nameKey) byName.set(nameKey, c);
    if (phoneKey) byPhone.set(phoneKey, c);
  });

  const savedRecords = [];
  const dbRowIdByCode = new Map();
  let nextCounter = localCustomers.length + 1;

  // "Add Customer" (single record flagged isNew) must never silently overwrite an existing customer
  const rejectedNew = [];

  incomingList.forEach(incoming => {
    if (!incoming || typeof incoming !== 'object') return;

    const incName = incoming.companyName || incoming.customerName || incoming.name || '';
    const incNormName = normalizeCustName(incName);
    const incGst = normalizeCustGst(incoming.gstNumber || incoming.gstin || incoming.gstNo || '');
    const incPhone = normalizeCustPhone(incoming.phone || incoming.mobile || incoming.primaryContact?.phone || '');
    const rawIncCode = String(incoming.customerCode || incoming.id || incoming.code || '').trim();
    const incCode = rawIncCode.toLowerCase();
    const isFakeCode = !rawIncCode || !isValidCustomerCode(rawIncCode);

    // Strict Multi-field Deduplication Matching:
    // 1. GST match (highest priority, globally unique in India)
    // 2. Official Customer Code match (VRM-CS-... or VRMS/CS/...) when not explicitly creating a brand new record
    // 3. Normalized Company Name match
    // 4. Primary Phone match
    let matchedExisting = null;
    if (incGst && byGst.has(incGst)) {
      matchedExisting = byGst.get(incGst);
    } else if (!incoming.isNew && rawIncCode && !isFakeCode && byCode.has(incCode)) {
      matchedExisting = byCode.get(incCode);
    } else if (incNormName && byName.has(incNormName)) {
      matchedExisting = byName.get(incNormName);
    } else if (incPhone && byPhone.has(incPhone)) {
      matchedExisting = byPhone.get(incPhone);
    }

    if (incoming.isNew === true && !isBulk) {
      // Add Customer: only the GST number decides a duplicate. Same name / phone with another or no GST is a separate customer.
      matchedExisting = incGst && byGst.has(incGst) ? byGst.get(incGst) : null;
      if (matchedExisting) {
        rejectedNew.push({
          status: 409,
          error: `GST ${incoming.gstNumber || incoming.gstin || incoming.gstNo} is already registered to ${matchedExisting.companyName || matchedExisting.customerName || matchedExisting.name} (${matchedExisting.customerCode || matchedExisting.id})${matchedExisting.assignedSalesperson ? `, handled by ${matchedExisting.assignedSalesperson}` : ''}. Open that customer instead of adding a new one.`,
          existingCustomerCode: matchedExisting.customerCode || matchedExisting.id
        });
        return;
      }
      if (!incPhone) {
        rejectedNew.push({ status: 400, error: 'Mobile / Phone must have at least 10 digits.' });
        return;
      }
    }

    let customerId = matchedExisting ? (matchedExisting.customerCode || matchedExisting.id || matchedExisting.code) : null;
    if (!customerId || !isValidCustomerCode(customerId)) {
      if (rawIncCode && !isFakeCode && !byCode.has(incCode)) {
        customerId = rawIncCode;
      } else {
        const currentPool = Array.from(existingMap.values());
        let { code: seqCode, nextNum, financialYear } = getNextSequence('CS', currentPool);
        while (seqCode && byCode.has(String(seqCode).trim().toLowerCase())) {
          nextNum++;
          seqCode = formatSequenceCode('CS', nextNum);
        }
        customerId = seqCode || `VRM-CS-${financialYear || getFinancialYear()}-${String(nextCounter++).padStart(2, '0')}`;
      }
    }

    const effectiveGst = (incoming.gstNumber && incoming.gstNumber !== '—' ? incoming.gstNumber : '') ||
                         (incoming.gstin && incoming.gstin !== '—' ? incoming.gstin : '') ||
                         (matchedExisting?.gstNumber && matchedExisting.gstNumber !== '—' ? matchedExisting.gstNumber : '') ||
                         '';
    const effectiveEmail = String(incoming.email || incoming.primaryContact?.email || matchedExisting?.email || matchedExisting?.primaryContact?.email || '').trim();
    const effectivePhone = String(incoming.phone || incoming.mobile || incoming.primaryContact?.phone || matchedExisting?.phone || matchedExisting?.primaryContact?.phone || '').trim();
    const isCallerExecutive = isExecutiveOrAdminRole(req.userSession?.role);
    const prevCreditApproved = Boolean(matchedExisting?.creditApproved || String(matchedExisting?.creditStatus || '').toLowerCase() === 'approved');
    const prevCreditStatus = String(matchedExisting?.creditStatus || (prevCreditApproved ? 'approved' : 'none')).toLowerCase();
    const prevCreditLimit = parseSafeNumber(matchedExisting?.creditLimit, 0);
    const wantsCreditRequest = Boolean(
      incoming.requestCreditApproval === true ||
      String(incoming.creditStatus || '').toLowerCase() === 'pending_ceo_approval'
    );
    const incomingReqLimit = parseSafeNumber(incoming.creditRequestedLimit ?? incoming.creditLimit, 0);

    let finalCreditApproved = prevCreditApproved;
    let finalCreditStatus = prevCreditStatus;
    let finalCreditLimit = prevCreditLimit;
    let finalCreditRequestedLimit = parseSafeNumber(matchedExisting?.creditRequestedLimit, 0);
    let finalCreditRequestedBy = matchedExisting?.creditRequestedBy || '';
    let finalCreditRequestedAt = matchedExisting?.creditRequestedAt || null;
    let finalCreditApprovedBy = matchedExisting?.creditApprovedBy || '';
    let finalCreditApprovedAt = matchedExisting?.creditApprovedAt || null;
    let finalCreditRejectionReason = matchedExisting?.creditRejectionReason || '';
    let notifyCeoCreditRequest = false;

    if (isCallerExecutive) {
      if (incoming.creditApproved === true || String(incoming.creditStatus || '').toLowerCase() === 'approved') {
        finalCreditApproved = true;
        finalCreditStatus = 'approved';
        finalCreditLimit = parseSafeNumber(incoming.creditLimit ?? incoming.creditRequestedLimit ?? prevCreditLimit, 0);
        finalCreditApprovedBy = req.userSession?.user || req.userSession?.empCode || 'CEO';
        finalCreditApprovedAt = new Date().toISOString();
        finalCreditRejectionReason = '';
      } else if (String(incoming.creditStatus || '').toLowerCase() === 'rejected') {
        finalCreditApproved = false;
        finalCreditStatus = 'rejected';
        finalCreditLimit = 0;
        finalCreditApprovedBy = req.userSession?.user || req.userSession?.empCode || 'CEO';
        finalCreditApprovedAt = new Date().toISOString();
        finalCreditRejectionReason = String(incoming.creditRejectionReason || '').trim();
      } else if (incoming.creditApproved === false && String(incoming.creditStatus || '').toLowerCase() === 'none') {
        finalCreditApproved = false;
        finalCreditStatus = 'none';
        finalCreditLimit = 0;
        finalCreditRejectionReason = '';
      } else if (incoming.creditLimit !== undefined && finalCreditApproved) {
        finalCreditLimit = parseSafeNumber(incoming.creditLimit, prevCreditLimit);
      }
    } else if (wantsCreditRequest && !prevCreditApproved) {
      finalCreditApproved = false;
      finalCreditStatus = 'pending_ceo_approval';
      finalCreditRequestedLimit = 0;
      finalCreditRequestedBy = req.userSession?.user || req.userSession?.empCode || incoming.assignedSalesperson || 'Sales';
      finalCreditRequestedAt = new Date().toISOString();
      finalCreditRejectionReason = '';
      notifyCeoCreditRequest = prevCreditStatus !== 'pending_ceo_approval';
    }

    const safeCreditLimit = finalCreditLimit;
    const safeCreditDays = isCallerExecutive
      ? Math.trunc(parseSafeNumber(incoming.creditDays ?? matchedExisting?.creditDays, 30))
      : Math.trunc(parseSafeNumber(matchedExisting?.creditDays, 0));
    const { isNew: _omitIsNew, requestCreditApproval: _omitReqFlag, ...incomingRest } = incoming;

    const localCustomerRecord = {
      ...(matchedExisting || {}),
      ...incomingRest,
      id: customerId,
      customerCode: customerId,
      code: customerId,
      customerName: incoming.customerName || incoming.companyName || matchedExisting?.customerName || incoming.name || 'New Customer',
      companyName: incoming.companyName || incoming.customerName || matchedExisting?.companyName || incoming.name || 'New Customer',
      customerType: incoming.customerType || matchedExisting?.customerType || 'EPC Contractor',
      industry: incoming.industry || matchedExisting?.industry || '',
      gstNumber: effectiveGst,
      gstNo: effectiveGst,
      panNumber: incoming.panNumber || incoming.pan || matchedExisting?.panNumber || '',
      address1: incoming.address1 || incoming.billingAddress1 || incoming.billingAddressObj?.address1 || incoming.address || incoming.streetAddress || matchedExisting?.address1 || '',
      address2: incoming.address2 || incoming.billingAddress2 || incoming.billingAddressObj?.address2 || matchedExisting?.address2 || '',
      billingAddress1: incoming.billingAddress1 || incoming.address1 || incoming.billingAddressObj?.address1 || matchedExisting?.billingAddress1 || '',
      billingAddress2: incoming.billingAddress2 || incoming.address2 || incoming.billingAddressObj?.address2 || matchedExisting?.billingAddress2 || '',
      address: incoming.address || incoming.streetAddress || matchedExisting?.address || '',
      city: incoming.city || matchedExisting?.city || '',
      state: incoming.state || matchedExisting?.state || '',
      pincode: incoming.pincode || matchedExisting?.pincode || '',
      dispatchAddress1: incoming.dispatchAddress1 || incoming.shippingAddress1 || incoming.deliveryAddressObj?.address1 || incoming.dispatchAddress || incoming.address || matchedExisting?.dispatchAddress1 || '',
      dispatchAddress2: incoming.dispatchAddress2 || incoming.shippingAddress2 || incoming.deliveryAddressObj?.address2 || matchedExisting?.dispatchAddress2 || '',
      shippingAddress1: incoming.shippingAddress1 || incoming.dispatchAddress1 || incoming.deliveryAddressObj?.address1 || matchedExisting?.shippingAddress1 || '',
      shippingAddress2: incoming.shippingAddress2 || incoming.dispatchAddress2 || incoming.deliveryAddressObj?.address2 || matchedExisting?.shippingAddress2 || '',
      dispatchAddress: incoming.dispatchAddress || incoming.address || matchedExisting?.dispatchAddress || '',
      dispatchCity: incoming.dispatchCity || incoming.city || matchedExisting?.dispatchCity || '',
      dispatchState: incoming.dispatchState || incoming.state || matchedExisting?.dispatchState || '',
      dispatchPincode: incoming.dispatchPincode || incoming.pincode || matchedExisting?.dispatchPincode || '',
      sameAsBilling: incoming.sameAsBilling !== undefined ? incoming.sameAsBilling : (matchedExisting?.sameAsBilling ?? true),
      creditLimit: safeCreditLimit,
      creditDays: safeCreditDays,
      creditApproved: finalCreditApproved,
      creditStatus: finalCreditStatus,
      creditRequestedLimit: finalCreditRequestedLimit,
      creditRequestedBy: finalCreditRequestedBy,
      creditRequestedAt: finalCreditRequestedAt,
      creditApprovedBy: finalCreditApprovedBy,
      creditApprovedAt: finalCreditApprovedAt,
      creditRejectionReason: finalCreditRejectionReason,
      _notifyCeoCreditRequest: notifyCeoCreditRequest,
      paymentTerms: incoming.paymentTerms || matchedExisting?.paymentTerms || '50% Advance + 50% Dispatch',
      assignedSalesperson: incoming.assignedSalesperson || incoming.salesPerson || incoming.salesperson || incoming.salesRep || incoming.c8 || incoming.createdBy || matchedExisting?.assignedSalesperson || '',
      salesPerson: incoming.salesPerson || incoming.assignedSalesperson || incoming.salesperson || incoming.salesRep || incoming.createdBy || matchedExisting?.salesPerson || '',
      createdBy: incoming.createdBy || incoming.assignedSalesperson || incoming.salesPerson || matchedExisting?.createdBy || '',
      salesPersonCode: incoming.salesPersonCode || incoming.createdById || matchedExisting?.salesPersonCode || '',
      createdById: incoming.createdById || incoming.salesPersonCode || matchedExisting?.createdById || '',
      source: incoming.source || matchedExisting?.source || 'Direct',
      email: effectiveEmail,
      phone: effectivePhone,
      mobile: effectivePhone,
      altPhone: incoming.altPhone || incoming.altNumber || incoming.primaryContact?.altPhone || matchedExisting?.altPhone || '',
      altNumber: incoming.altNumber || incoming.altPhone || incoming.primaryContact?.altPhone || matchedExisting?.altNumber || '',
      primaryContact: {
        name: incoming.contactPerson || incoming.contactName || incoming.primaryContact?.name || matchedExisting?.primaryContact?.name || '',
        phone: effectivePhone,
        altPhone: incoming.altPhone || incoming.altNumber || incoming.primaryContact?.altPhone || matchedExisting?.primaryContact?.altPhone || '',
        whatsapp: incoming.whatsapp || effectivePhone || matchedExisting?.primaryContact?.whatsapp || '',
        email: effectiveEmail
      },
      notes: incoming.notes ?? matchedExisting?.notes ?? '',
      c2: incoming.companyName || incoming.customerName || matchedExisting?.companyName || 'New Customer',
      c3: incoming.primaryContact?.name || incoming.contactPerson || matchedExisting?.c3 || '',
      c4: effectivePhone,
      c5: effectiveEmail,
      c6: incoming.billingAddress || incoming.address || matchedExisting?.c6 || '',
      billingAddressObj: incoming.billingAddressObj || matchedExisting?.billingAddressObj || {
        address1: incoming.address1 || incoming.billingAddress1 || '',
        address2: incoming.address2 || incoming.billingAddress2 || '',
        address: incoming.address || '',
        city: incoming.city || '',
        state: incoming.state || '',
        pincode: incoming.pincode || ''
      },
      c7: incoming.deliveryAddress || incoming.dispatchAddress || incoming.address || matchedExisting?.c7 || '',
      deliveryAddressObj: incoming.deliveryAddressObj || matchedExisting?.deliveryAddressObj || {
        address1: incoming.dispatchAddress1 || incoming.shippingAddress1 || '',
        address2: incoming.dispatchAddress2 || incoming.shippingAddress2 || '',
        address: incoming.dispatchAddress || incoming.address || '',
        city: incoming.dispatchCity || incoming.city || '',
        state: incoming.dispatchState || incoming.state || '',
        pincode: incoming.dispatchPincode || incoming.pincode || ''
      },
      status: incoming.status || matchedExisting?.status || 'ACTIVE',
      createdAt: incoming.createdAt || matchedExisting?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const k = String(customerId).trim().toLowerCase();
    existingMap.set(k, localCustomerRecord);
    dbRowIdByCode.set(k, matchedExisting?.id || customerId);

    // If a previous dummy code key existed in existingMap, remove it so only the official record persists
    if (matchedExisting && matchedExisting.id && matchedExisting.id.toLowerCase() !== k) {
      existingMap.delete(matchedExisting.id.toLowerCase());
    }
    if (matchedExisting && matchedExisting.customerCode && matchedExisting.customerCode.toLowerCase() !== k) {
      existingMap.delete(matchedExisting.customerCode.toLowerCase());
    }

    // Keep lookup maps updated
    byCode.set(k, localCustomerRecord);
    if (incGst) byGst.set(incGst, localCustomerRecord);
    if (incNormName) byName.set(incNormName, localCustomerRecord);
    if (incPhone) byPhone.set(incPhone, localCustomerRecord);

    savedRecords.push(localCustomerRecord);
  });

  if (rejectedNew.length > 0) {
    const { status, ...body } = rejectedNew[0];
    return res.status(status).json({ success: false, ...body });
  }

  // Targeted INSERT/UPSERT each customer into authoritative PostgreSQL public.customers (Rule 2)
  for (const record of savedRecords) {
    const dbRowId = dbRowIdByCode.get(String(record.customerCode).trim().toLowerCase()) || record.id || record.customerCode;
    try {
      await query(`
        INSERT INTO public.customers (
          id, customer_code, company_name, customer_name, customer_type, industry,
          gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
          dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
          same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
          source, primary_contact, email, phone, status, notes,
          credit_approved, credit_status, credit_requested_limit, credit_requested_by,
          credit_requested_at, credit_approved_by, credit_approved_at, credit_rejection_reason,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35, $36, $37,
          NOW(), NOW()
        )
        ON CONFLICT (customer_code) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          customer_name = EXCLUDED.customer_name,
          customer_type = EXCLUDED.customer_type,
          industry = EXCLUDED.industry,
          gst_number = EXCLUDED.gst_number,
          pan_number = EXCLUDED.pan_number,
          billing_address = EXCLUDED.billing_address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          pincode = EXCLUDED.pincode,
          billing_address_obj = EXCLUDED.billing_address_obj,
          dispatch_address = EXCLUDED.dispatch_address,
          dispatch_city = EXCLUDED.dispatch_city,
          dispatch_state = EXCLUDED.dispatch_state,
          dispatch_pincode = EXCLUDED.dispatch_pincode,
          delivery_address_obj = EXCLUDED.delivery_address_obj,
          same_as_billing = EXCLUDED.same_as_billing,
          credit_limit = EXCLUDED.credit_limit,
          credit_days = EXCLUDED.credit_days,
          payment_terms = EXCLUDED.payment_terms,
          assigned_salesperson = EXCLUDED.assigned_salesperson,
          source = EXCLUDED.source,
          primary_contact = EXCLUDED.primary_contact,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          credit_approved = EXCLUDED.credit_approved,
          credit_status = EXCLUDED.credit_status,
          credit_requested_limit = EXCLUDED.credit_requested_limit,
          credit_requested_by = EXCLUDED.credit_requested_by,
          credit_requested_at = EXCLUDED.credit_requested_at,
          credit_approved_by = EXCLUDED.credit_approved_by,
          credit_approved_at = EXCLUDED.credit_approved_at,
          credit_rejection_reason = EXCLUDED.credit_rejection_reason,
          updated_at = NOW()
      `, [
        dbRowId,
        record.customerCode,
        record.companyName,
        record.customerName,
        record.customerType,
        record.industry,
        record.gstNumber,
        record.panNumber,
        record.address,
        record.city,
        record.state,
        record.pincode,
        JSON.stringify(record.billingAddressObj || {}),
        record.dispatchAddress,
        record.dispatchCity,
        record.dispatchState,
        record.dispatchPincode,
        JSON.stringify(record.deliveryAddressObj || {}),
        Boolean(record.sameAsBilling),
        parseSafeNumber(record.creditLimit, 0),
        Math.trunc(parseSafeNumber(record.creditDays, 0)),
        record.paymentTerms,
        record.assignedSalesperson,
        record.source,
        JSON.stringify(record.primaryContact || {}),
        record.email || '',
        record.phone || '',
        record.status,
        record.notes || '',
        Boolean(record.creditApproved),
        record.creditStatus || 'none',
        parseSafeNumber(record.creditRequestedLimit, 0),
        record.creditRequestedBy || '',
        record.creditRequestedAt || null,
        record.creditApprovedBy || '',
        record.creditApprovedAt || null,
        record.creditRejectionReason || ''
      ]);
      if (record._notifyCeoCreditRequest) {
        delete record._notifyCeoCreditRequest;
        createInternalNotification({
          eventType: 'CUSTOMER_CREDIT_APPROVAL_REQUESTED',
          documentType: 'CUSTOMER',
          documentId: record.customerCode,
          title: 'Credit Approval Requested',
          message: `${record.creditRequestedBy || 'Sales'} requested Credit Facility approval for ${record.companyName} (${record.customerCode}). Please review and set the Credit Limit.`,
          actorEmpCode: req.userSession?.empCode || '',
          actorName: req.userSession?.user || 'Sales',
          actorRole: req.userSession?.role || 'Sales',
          targetRoles: ['CEO', 'MD', 'Managing Director', 'Technical Administrator'],
          targetTab: 'CEO Dashboard',
          targetRecordId: record.customerCode
        }).catch(() => {});
      } else {
        delete record._notifyCeoCreditRequest;
      }
    } catch (pgErr) {
      console.error('[POST /api/customers Postgres write error]:', pgErr.message);
      if (isDbConnected()) {
        return res.status(500).json({
          success: false,
          error: 'Failed to save customer to PostgreSQL: ' + pgErr.message
        });
      }
    }
  }

  // Update authoritative in-memory cache synchronously BEFORE returning so immediate GETs include the new customer at the top
  const savedKeys = new Set(savedRecords.map(r => String(r.customerCode || r.id || '').trim().toLowerCase()).filter(Boolean));
  const remainingCustomers = Array.from(existingMap.values()).filter(c => {
    const k = String(c.customerCode || c.id || '').trim().toLowerCase();
    return k && !savedKeys.has(k);
  });
  const updatedCustomers = [...savedRecords, ...remainingCustomers];
  supabaseMemoryStore.customer_store = updatedCustomers;
  supabaseMemoryStore.crm_customers = updatedCustomers;

  safeWriteJsonFileAsync(getStoreFilePath('customer_store.json'), updatedCustomers);
  safeWriteJsonFileAsync(getStoreFilePath('crm_customers.json'), updatedCustomers);

  try {
    const primary = savedRecords[0];
    if (primary) {
      broadcastRealtimeEvent('crm_updated', {
        type: 'customer_updated',
        action: 'upsert',
        recordId: primary.customerCode || primary.id,
        customer: primary,
        count: savedRecords.length
      });
    }
  } catch (_) {}

  return res.json({
    success: true,
    message: isBulk ? `Successfully registered ${savedRecords.length} customers in BUSINZ!` : 'Customer registered in BUSINZ successfully!',
    count: savedRecords.length,
    customer: isBulk ? savedRecords[0] : savedRecords[0],
    customers: savedRecords
  });
} catch (err) {
  console.error('[POST /api/customers unhandled error]:', err);
  return res.status(500).json({
    success: false,
    error: err.message || 'Failed to save customer to database'
  });
}
});

// BUSINZ Native Customers endpoint (Native BUSINZ Store - Bounded & Fast per Rules 4, 8, 12)
router.get('/api/customers', async (req, res) => {
  try {
    const customers = await loadDatabaseCustomers();
    const rawAll = (customers && customers.length > 0) ? customers : loadLocalCustomers();
    const all = rawAll;
    
    const q = String(req.query.q || req.query.search || '').trim().toLowerCase();
    const full = req.query.full === 'true';
    const limitParam = parseInt(req.query.limit, 10);

    // Helper to format clean, lightweight summary record (Eliminates 14MB payload bloat)
    const formatSummary = (c) => {
      const pContact = c.primaryContact || c.primary_contact || {};
      const effectiveContact = (c.contactPerson && c.contactPerson !== '—' ? c.contactPerson : '') ||
                               (c.contact && c.contact !== '—' ? c.contact : '') ||
                               (pContact.name && pContact.name !== '—' ? pContact.name : '') ||
                               (c.customerName && c.customerName !== c.companyName ? c.customerName : '');
      const rawPhone = (c.phone && c.phone !== '—' ? c.phone : '') ||
                       (c.mobile && c.mobile !== '—' ? c.mobile : '') ||
                       pContact.phone || pContact.altPhone || pContact.whatsapp || '';
      const cleanPhone = String(rawPhone || '').replace(/^'/, '').trim();
      const effectiveEmail = (c.email && c.email !== '—' ? c.email : '') || pContact.email || '';
      const gst = (c.gstNo && c.gstNo !== '—' ? c.gstNo : '') ||
                  (c.gstNumber && c.gstNumber !== '—' ? c.gstNumber : '') ||
                  (c.gst && c.gst !== '—' ? c.gst : '') || '';
      const bAddr = c.billingAddress || c.address1 || c.address || c.street || c.billingAddressObj?.address1 || c.billingAddressObj?.address || '';
      const dAddr = c.dispatchAddress || c.deliveryAddress || c.dispatchAddress1 || c.deliveryAddressObj?.address1 || c.deliveryAddressObj?.address || bAddr;

      return {
        id: c.customerCode || c.id || c.code || '',
        customerCode: c.customerCode || c.code || c.id || '',
        code: c.customerCode || c.code || c.id || '',
        companyName: c.companyName || c.name || c.c2 || '',
        name: c.companyName || c.name || c.c2 || '',
        customerName: c.customerName || effectiveContact || c.companyName || '',
        contactPerson: effectiveContact,
        contact: effectiveContact,
        phone: cleanPhone,
        mobile: cleanPhone,
        email: effectiveEmail,
        gstNo: gst,
        gstNumber: gst,
        gst: gst,
        primaryContact: {
          name: effectiveContact || c.companyName || '',
          phone: cleanPhone,
          whatsapp: cleanPhone,
          email: effectiveEmail
        },
        billingAddress: bAddr,
        address: bAddr,
        address1: bAddr,
        city: c.city || c.billingAddressObj?.city || '',
        state: c.state || c.billingAddressObj?.state || '',
        pincode: c.pincode || c.pinCode || c.zip || c.billingAddressObj?.pincode || '',
        billingAddressObj: c.billingAddressObj || {
          address: bAddr,
          city: c.city || '',
          state: c.state || '',
          pincode: c.pincode || ''
        },
        dispatchAddress: dAddr,
        deliveryAddress: dAddr,
        dispatchCity: c.dispatchCity || c.deliveryAddressObj?.city || c.city || '',
        dispatchState: c.dispatchState || c.deliveryAddressObj?.state || c.state || '',
        dispatchPincode: c.dispatchPincode || c.deliveryAddressObj?.pincode || c.pincode || '',
        deliveryAddressObj: c.deliveryAddressObj || c.delivery_address_obj || {
          address: dAddr,
          city: c.dispatchCity || c.city || '',
          state: c.dispatchState || c.state || '',
          pincode: c.dispatchPincode || c.pincode || ''
        },
        sameAsBilling: c.sameAsBilling !== false,
        customerType: c.customerType || c.customer_type || 'EPC Contractor',
        industry: c.industry || '',
        source: c.source || 'Direct',
        notes: c.notes || '',
        paymentTerms: c.paymentTerms || '',
        creditLimit: Number(c.creditLimit || 0),
        creditDays: Number(c.creditDays || 0),
        creditApproved: Boolean(c.creditApproved || String(c.creditStatus || '').toLowerCase() === 'approved'),
        creditStatus: String(c.creditStatus || (c.creditApproved ? 'approved' : 'none')).toLowerCase(),
        creditRequestedLimit: Number(c.creditRequestedLimit || 0),
        creditRequestedBy: c.creditRequestedBy || '',
        creditRequestedAt: c.creditRequestedAt || null,
        creditApprovedBy: c.creditApprovedBy || '',
        creditApprovedAt: c.creditApprovedAt || null,
        creditRejectionReason: c.creditRejectionReason || '',
        assignedSalesperson: c.assignedSalesperson || c.salesPerson || 'Sales Rep',
        status: (c.status || 'Active').toUpperCase(),
        createdAt: c.createdAt || c.created_at || '',
        updatedAt: c.updatedAt || c.updated_at || ''
      };
    };

    if (q) {
      const matches = [];
      for (let i = 0; i < all.length; i++) {
        const c = all[i];
        const name = (c.companyName || c.name || c.c2 || '').toLowerCase();
        const contact = (c.contactPerson || c.contact || c.customerName || '').toLowerCase();
        const code = (c.customerCode || c.code || c.id || '').toLowerCase();
        const phone = (c.phone || c.mobile || '').toLowerCase();
        const gst = (c.gstNumber || c.gstNo || '').toLowerCase();
        const city = (c.city || '').toLowerCase();

        if (name.includes(q) || contact.includes(q) || code.includes(q) || phone.includes(q) || gst.includes(q) || city.includes(q)) {
          matches.push(full ? c : formatSummary(c));
          if (matches.length >= (limitParam > 0 ? limitParam : 50)) break;
        }
      }
      return res.json(matches);
    }

    if (full) {
      return res.json(all);
    }

    const bounded = limitParam > 0 ? all.slice(0, limitParam).map(formatSummary) : all.map(formatSummary);
    return res.json(bounded);
  } catch (err) {
    console.error('Error in GET /api/customers:', err);
    return res.json([]);
  }
});

// CEO Credit Customer Approval Endpoints (Single-row PostgreSQL updates per Rule 2 & Rule 4)
router.get('/api/customers/credit-requests', requireBusinzSession, async (req, res) => {
  try {
    const customers = await loadDatabaseCustomers();
    const rawAll = (customers && customers.length > 0) ? customers : loadLocalCustomers();
    const all = rawAll;
    const summarize = (c) => ({
      customerCode: c.customerCode || c.code || c.id || '',
      companyName: c.companyName || c.name || c.c2 || '',
      contactPerson: c.contactPerson || c.contact || c.primaryContact?.name || '',
      phone: c.phone || c.mobile || c.primaryContact?.phone || '',
      gstNo: c.gstNumber || c.gstNo || '',
      city: c.city || '',
      assignedSalesperson: c.assignedSalesperson || c.salesPerson || '',
      creditApproved: Boolean(c.creditApproved || String(c.creditStatus || '').toLowerCase() === 'approved'),
      creditStatus: String(c.creditStatus || (c.creditApproved ? 'approved' : 'none')).toLowerCase(),
      creditLimit: Number(c.creditLimit || 0),
      creditDays: Number(c.creditDays || 30),
      creditRequestedLimit: Number(c.creditRequestedLimit || 0),
      creditRequestedBy: c.creditRequestedBy || '',
      creditRequestedAt: c.creditRequestedAt || null,
      creditApprovedBy: c.creditApprovedBy || '',
      creditApprovedAt: c.creditApprovedAt || null,
      creditRejectionReason: c.creditRejectionReason || ''
    });

    const pending = all
      .filter(c => String(c.creditStatus || '').toLowerCase() === 'pending_ceo_approval')
      .map(summarize)
      .slice(0, 200);
    const approved = all
      .filter(c => Boolean(c.creditApproved) || String(c.creditStatus || '').toLowerCase() === 'approved')
      .map(summarize)
      .slice(0, 500);

    return res.json({ success: true, pending, approved });
  } catch (err) {
    console.error('[GET /api/customers/credit-requests] error:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to load credit requests' });
  }
});

router.post('/api/customers/:customerCode/credit-decision', requireRole(['ceo', 'md', 'managing director', 'technical administrator', 'admin']), async (req, res) => {
  try {
    const rawCode = decodeURIComponent(String(req.params.customerCode || '')).trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, error: 'Customer code is required' });
    }
    const { decision, creditLimit, creditDays, rejectionReason } = req.body || {};
    const normDecision = String(decision || '').trim().toLowerCase();
    if (!['approve', 'approved', 'reject', 'rejected', 'revoke'].includes(normDecision)) {
      return res.status(400).json({ success: false, error: 'decision must be approve, reject, or revoke' });
    }

    const isApprove = normDecision === 'approve' || normDecision === 'approved';
    const isRevoke = normDecision === 'revoke';
    const finalApproved = isApprove;
    const finalStatus = isApprove ? 'approved' : (isRevoke ? 'none' : 'rejected');
    const finalLimit = isApprove ? parseSafeNumber(creditLimit, 0) : 0;
    const finalDays = Math.max(1, Math.min(365, Math.trunc(parseSafeNumber(creditDays, 30)) || 30));
    if (isApprove && finalLimit <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter an approved Credit Limit greater than ₹0.' });
    }
    const approverName = req.userSession?.user || req.userSession?.empCode || 'CEO';
    const cleanReason = isApprove ? '' : String(rejectionReason || '').trim();
    const nowIso = new Date().toISOString();

    if (isDbConnected()) {
      const upd = await query(
        `UPDATE public.customers
         SET credit_approved = $1,
             credit_status = $2,
             credit_limit = $3,
             credit_days = $4,
             credit_approved_by = $5,
             credit_approved_at = NOW(),
             credit_rejection_reason = $6,
             updated_at = NOW()
         WHERE LOWER(customer_code) = LOWER($7) OR LOWER(id) = LOWER($7)
         RETURNING customer_code, company_name, credit_requested_by, assigned_salesperson`,
        [finalApproved, finalStatus, finalLimit, finalDays, approverName, cleanReason, rawCode]
      );
      if (!upd || upd.rowCount === 0) {
        return res.status(404).json({ success: false, error: `Customer "${rawCode}" not found in database.` });
      }
    }

    // Update in-memory customer cache & local JSON cache in place (single matching record)
    let updatedCustomer = null;
    const updateListInPlace = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        const codeMatch = String(c?.customerCode || c?.code || c?.id || '').trim().toLowerCase() === rawCode.toLowerCase();
        if (codeMatch) {
          arr[i] = {
            ...c,
            creditApproved: finalApproved,
            creditStatus: finalStatus,
            creditLimit: finalLimit,
            creditDays: finalDays,
            creditApprovedBy: approverName,
            creditApprovedAt: nowIso,
            creditRejectionReason: cleanReason,
            updatedAt: nowIso
          };
          updatedCustomer = arr[i];
        }
      }
    };
    updateListInPlace(supabaseMemoryStore.customer_store);
    const diskCustomers = loadLocalCustomers();
    updateListInPlace(diskCustomers);
    try { saveLocalCustomers(diskCustomers); } catch (_) {}

    if (updatedCustomer) {
      createInternalNotification({
        eventType: isApprove ? 'CUSTOMER_CREDIT_APPROVED' : 'CUSTOMER_CREDIT_REJECTED',
        documentType: 'CUSTOMER',
        documentId: updatedCustomer.customerCode || rawCode,
        title: isApprove ? 'Credit Approved by CEO' : (isRevoke ? 'Credit Facility Revoked' : 'Credit Request Rejected'),
        message: isApprove
          ? `CEO approved Credit Facility for ${updatedCustomer.companyName} (${rawCode}) with limit ₹${finalLimit.toLocaleString('en-IN')} (${finalDays} days).`
          : `Credit request for ${updatedCustomer.companyName} (${rawCode}) was ${isRevoke ? 'revoked' : 'rejected'}${cleanReason ? `: ${cleanReason}` : '.'}`,
        actorEmpCode: req.userSession?.empCode || '',
        actorName: approverName,
        actorRole: req.userSession?.role || 'CEO',
        targetRoles: ['Sales', 'Sales Executive', 'Sales Head', 'Accounts'],
        targetTab: 'Customers',
        targetRecordId: updatedCustomer.customerCode || rawCode
      }).catch(() => {});
    }

    return res.json({
      success: true,
      customer: updatedCustomer || {
        customerCode: rawCode,
        creditApproved: finalApproved,
        creditStatus: finalStatus,
        creditLimit: finalLimit,
        creditDays: finalDays,
        creditApprovedBy: approverName,
        creditApprovedAt: nowIso,
        creditRejectionReason: cleanReason
      }
    });
  } catch (err) {
    console.error('[POST /api/customers/:customerCode/credit-decision] error:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update credit decision' });
  }
});

router.post('/api/customers/credit-bulk-approve', requireRole(['ceo', 'md', 'managing director', 'technical administrator', 'admin']), async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.customers) ? req.body.customers : [];
    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'customers array is required' });
    }
    const approverName = req.userSession?.user || req.userSession?.empCode || 'CEO';
    const nowIso = new Date().toISOString();
    const approvedCodes = [];
    const notFound = [];

    for (const item of entries) {
      const code = String(item?.customerCode || item?.code || '').trim();
      const name = String(item?.companyName || item?.name || '').trim();
      const limitVal = parseSafeNumber(item?.creditLimit, 0);
      const daysVal = Math.max(1, Math.min(365, Math.trunc(parseSafeNumber(item?.creditDays, 30)) || 30));
      if (!code && !name) continue;

      if (isDbConnected()) {
        const upd = code
          ? await query(
              `UPDATE public.customers
               SET credit_approved = TRUE, credit_status = 'approved', credit_limit = $1, credit_days = $2,
                   credit_approved_by = $3, credit_approved_at = NOW(), credit_rejection_reason = '', updated_at = NOW()
               WHERE LOWER(customer_code) = LOWER($4) OR LOWER(id) = LOWER($4)
               RETURNING customer_code`,
              [limitVal, daysVal, approverName, code]
            )
          : await query(
              `UPDATE public.customers
               SET credit_approved = TRUE, credit_status = 'approved', credit_limit = $1, credit_days = $2,
                   credit_approved_by = $3, credit_approved_at = NOW(), credit_rejection_reason = '', updated_at = NOW()
               WHERE LOWER(TRIM(company_name)) = LOWER(TRIM($4))
               RETURNING customer_code`,
              [limitVal, daysVal, approverName, name]
            );
        if (upd && upd.rowCount > 0) {
          approvedCodes.push(upd.rows[0].customer_code);
        } else {
          notFound.push(code || name);
        }
      }
    }

    if (approvedCodes.length > 0) {
      await loadDatabaseCustomers(true).catch(() => {});
    }

    return res.json({ success: true, approvedCount: approvedCodes.length, approvedCodes, notFound });
  } catch (err) {
    console.error('[POST /api/customers/credit-bulk-approve] error:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Bulk credit approval failed' });
  }
});

  return router;
}
