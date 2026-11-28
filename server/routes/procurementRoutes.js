import { Router } from 'express';

export default function createProcurementRouter(dependencies) {
  const router = Router();
  const {
    loadLocalVendors,
    saveLocalVendors,
    loadLocalWorkOrders,
    saveLocalWorkOrders,
    loadLocalCustomers,
    getNextSequence,
    requireRole,
    createInternalNotification
  } = dependencies;

router.get('/api/vendors', async (req, res) => {
  const localVendors = loadLocalVendors();
  res.json(localVendors);
});



// Endpoint to delete a Vendor in BUSINZ Authoritative Store (Native BUSINZ Store)
router.delete('/api/vendors/:id', requireRole(['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Procurement', 'Procurement Head', 'Procurement Manager', 'Purchase']), async (req, res) => {
  const targetId = req.params.id;

  // 1. Remove from local store
  const localVendors = loadLocalVendors();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedVendors = localVendors.filter(v => {
    const vId = String(v.id || '').toLowerCase();
    const vCode = String(v.code || '').toLowerCase();
    const vName = String(v.name || '').toLowerCase();
    return vId !== targetClean && vCode !== targetClean && vName !== targetClean;
  });
  saveLocalVendors(updatedVendors);

  res.json({ success: true, message: `Vendor ${targetId} deleted from BUSINZ!` });
});


// Endpoint to GET Production Work Orders (Local & Supabase Store)
router.get('/api/workorders', async (req, res) => {
  const localOrders = loadLocalWorkOrders();
  res.json({ success: true, count: localOrders.length, workOrders: localOrders });
});

// Endpoint to CREATE / ISSUE / UPDATE a Production Work Order
router.post('/api/workorders', async (req, res) => {
  try {
    const currentOrders = loadLocalWorkOrders();
    const woId = req.body.workOrderNo || req.body.id || getNextSequence('WO', currentOrders).code;
    const existingIndex = currentOrders.findIndex(o => (o.workOrderNo && o.workOrderNo === woId) || (o.id && o.id === woId));

    let savedOrder;
    let updated;

    if (existingIndex !== -1) {
      // Update existing work order
      savedOrder = {
        ...currentOrders[existingIndex],
        ...req.body,
        id: woId,
        workOrderNo: woId,
        plannedQty: req.body.plannedQty !== undefined ? (parseInt(req.body.plannedQty) || 0) : currentOrders[existingIndex].plannedQty,
        completedQty: req.body.completedQty !== undefined ? (parseInt(req.body.completedQty) || 0) : (currentOrders[existingIndex].completedQty || 0),
      };
      updated = [...currentOrders];
      updated[existingIndex] = savedOrder;
    } else {
      // Create new work order
      savedOrder = {
        id: woId,
        workOrderNo: woId,
        productName: req.body.productName || 'Solar Mounting Rail',
        plannedQty: parseInt(req.body.plannedQty) || 500,
        completedQty: parseInt(req.body.completedQty) || 0,
        delayDays: 0,
        delayReason: req.body.delayReason || 'Normal Production',
        status: req.body.status || 'In Progress',
        statusColor: '#EA580C',
        rawMaterial: req.body.rawMaterial || 'Raw Alu Coil',
        customer: req.body.customer || 'Solar Client',
        targetDate: req.body.targetDate || new Date().toISOString().split('T')[0],
        currentStage: req.body.currentStage || req.body.stage || 'Raw Material Prep',
        stage: req.body.stage || req.body.currentStage || 'Raw Material Prep',
        bomCode: req.body.bomCode || '',
        ...req.body
      };
      updated = [savedOrder, ...currentOrders];
    }

    saveLocalWorkOrders(updated);

    if (existingIndex === -1) {
      try {
        const rawAssignee = String(req.body.assignedEmployee || '').trim();
        const targetAssigneeName = (rawAssignee && rawAssignee.toLowerCase() !== 'unassigned') ? rawAssignee : null;
        createInternalNotification({
          recipientRole: 'Production',
          recipientUserName: targetAssigneeName,
          eventType: 'WORK_ORDER_ASSIGNED',
          documentType: 'work_order',
          documentId: woId,
          title: `🔧 Work Order Assigned: ${woId}`,
          message: `Work Order ${woId} (${savedOrder.productName}, Qty: ${savedOrder.plannedQty}) has been issued${targetAssigneeName ? ` and assigned to ${targetAssigneeName}` : ''}.`,
          actorEmpCode: req.headers['x-employee-code'] || null,
          actorName: req.headers['x-user-name'] || req.body.productionHead || 'Production Admin',
          actorRole: req.headers['x-user-role'] || 'Production Admin',
          targetTab: 'Work Orders',
          targetRecordId: woId,
          metadata: {
            workOrderNo: woId,
            productName: savedOrder.productName,
            assignedEmployee: targetAssigneeName
          },
          dedupId: `wo_assigned_${woId}`
        });
      } catch (notifErr) {
        console.warn('[Work Order Notification Warning]:', notifErr.message);
      }
    }

    res.json({ success: true, message: 'Production Work Order Saved!', workOrder: savedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single vendor details endpoint from BUSINZ local/database store (Native BUSINZ Store)
router.get('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const localVendors = loadLocalVendors();
    const normalize = (s) => String(s || '').toLowerCase().trim();
    const target = normalize(id);

    const v = localVendors.find(vend => 
      normalize(vend.id) === target || 
      normalize(vend.code) === target || 
      normalize(vend.vendorId) === target ||
      normalize(vend.name) === target ||
      normalize(vend.companyName) === target
    );

    if (v) {
      const addr1 = v.address_1 || v.street || (v.billingAddressObj && (v.billingAddressObj.address_1 || v.billingAddressObj.street)) || v.address || '';
      const addr2 = v.address_2 || v.street2 || (v.billingAddressObj && (v.billingAddressObj.address_2 || v.billingAddressObj.street2)) || '';

      const billingObj = v.billingAddressObj ? { ...v.billingAddressObj } : {
        address: addr1 || v.address || 'Industrial Estate, Main Road',
        address_1: addr1,
        address_2: addr2,
        street: addr1,
        street2: addr2,
        city: v.city || 'Chennai',
        state: v.state || 'Tamil Nadu',
        zip: v.pincode || '600001',
        country: v.country || 'India'
      };
      if (!billingObj.address_1) billingObj.address_1 = addr1;
      if (!billingObj.address_2) billingObj.address_2 = addr2;
      if (!billingObj.street) billingObj.street = addr1;
      if (!billingObj.street2) billingObj.street2 = addr2;

      const shippingObj = v.shippingAddressObj ? { ...v.shippingAddressObj } : { ...billingObj };
      if (!shippingObj.address_1) shippingObj.address_1 = addr1;
      if (!shippingObj.address_2) shippingObj.address_2 = addr2;
      if (!shippingObj.street) shippingObj.street = addr1;
      if (!shippingObj.street2) shippingObj.street2 = addr2;

      const detailedVendor = {
        id: v.id || v.code,
        code: v.id || v.code,
        name: v.name || v.companyName,
        companyName: v.companyName || v.name,
        type: v.type === 'Manufacturer' ? 'customer_vendor' : 'vendor',
        contact: v.contact || v.primaryContact || '—',
        email: v.email && v.email !== '—' ? v.email : '',
        phone: v.phone && v.phone !== '—' ? v.phone : (v.mobile || ''),
        mobile: v.mobile || '',
        cat: v.cat || 'General Vendor',
        status: v.status || 'Active',
        spend: v.spend || '—',
        payable: v.payable || '₹0.00',
        terms: v.terms || 'Due on Receipt',
        gstin: v.gstin && v.gstin !== '—' ? v.gstin : '',
        pan: v.pan && v.pan !== '—' ? v.pan : '',
        currency: v.currency || 'INR',
        website: v.website || '—',
        address_1: addr1,
        address_2: addr2,
        street: addr1,
        street2: addr2,
        billingAddressObj: billingObj,
        shippingAddressObj: shippingObj,
        billingAddress: v.address || 'Industrial Estate, Main Road, Tamil Nadu',
        shippingAddress: v.address || 'Industrial Estate, Main Road, Tamil Nadu',
        notes: v.notes || '',
        contactPersons: v.contactPersons || [],
        contact: {
          contact_id: v.id || v.code,
          contact_name: v.name || v.companyName,
          company_name: v.companyName || v.name,
          contact_type: v.type === 'Manufacturer' ? 'customer_vendor' : 'vendor',
          status: (v.status || 'Active').toLowerCase(),
          email: v.email && v.email !== '—' ? v.email : '',
          phone: v.phone && v.phone !== '—' ? v.phone : (v.mobile || ''),
          gst_no: v.gstin && v.gstin !== '—' ? v.gstin : '',
          pan_no: v.pan && v.pan !== '—' ? v.pan : '',
          billing_address: billingObj,
          shipping_address: shippingObj,
          payment_terms: v.terms || 'Due on Receipt'
        }
      };

      return res.json(detailedVendor);
    }

    res.status(404).json({ error: 'Vendor not found in BUSINZ local database.' });
  } catch (err) {
    console.error('[GET VENDOR BY ID ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve vendor details: ' + err.message });
  }
});

// GSTIN Lookup & Verification Endpoint (Local Cache & BUSINZ DB first -> Sandbox.co.in only for brand-new GSTINs)
const gstLookupCache = new Map();
let cachedSandboxToken = '';
let cachedSandboxTokenExp = 0;

async function getSandboxAccessToken(apiKey, apiSecret) {
  if (cachedSandboxToken && Date.now() < cachedSandboxTokenExp - 60000) {
    return cachedSandboxToken;
  }
  const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'x-api-version': '1.0'
    }
  });
  const authData = await authRes.json().catch(() => ({}));
  const token = authData?.access_token || authData?.data?.access_token || '';
  if (!authRes.ok || !token) {
    throw new Error(authData?.message || 'Sandbox.co.in authentication failed');
  }
  cachedSandboxToken = token;
  cachedSandboxTokenExp = Date.now() + 20 * 60 * 60 * 1000;
  return token;
}

async function lookupGstinSandbox(rawGst, stateMap) {
  const apiKey = String(process.env.SANDBOX_API_KEY || '').trim();
  const apiSecret = String(process.env.SANDBOX_API_SECRET || '').trim();
  if (!apiKey || !apiSecret) return { configured: false };

  const token = await getSandboxAccessToken(apiKey, apiSecret);
  const res = await fetch('https://api.sandbox.co.in/gst/compliance/public/gstin/search', {
    method: 'POST',
    headers: {
      Authorization: token,
      'x-api-key': apiKey,
      'x-api-version': '1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ gstin: rawGst })
  });
  const payload = await res.json().catch(() => ({}));
  const d = payload?.data?.data || payload?.data || payload || {};
  const info = d?.taxpayerInfo || d;
  const legalName = String(info.lgnm || info.legalName || info.legal_name || info.name || info.tradeNam || info.tradeName || info.trade_name || '').trim();
  const tradeName = String(info.tradeNam || info.tradeName || info.trade_name || legalName).trim();

  if (!res.ok || (!legalName && !tradeName && !info.gstin)) {
    throw new Error(payload?.message || d?.error?.message || 'GSTIN not found in Sandbox.co.in');
  }

  const stateCode = rawGst.substring(0, 2);
  const formatGstAddr = (addrObj = {}, label = 'Principal') => {
    const a = addrObj?.addr || addrObj || {};
    const line1Parts = [a.bno, a.flno, a.bnm].map(x => String(x || '').trim()).filter(Boolean);
    const line2Parts = [a.st, a.loc].map(x => String(x || '').trim()).filter(Boolean);
    const address1 = line1Parts.join(', ');
    const address2 = line2Parts.join(', ');
    const city = String(a.dst || a.loc || '').trim();
    const state = String(a.stcd || stateMap[stateCode] || '').trim();
    const pincode = String(a.pncd || '').trim();
    const fullAddress = [address1, address2, city, state, pincode].filter(Boolean).join(', ');
    return { label, address1, address2, address: fullAddress, city, state, pincode };
  };

  const principal = formatGstAddr(info?.pradr, 'Principal Place of Business');
  const additionalList = Array.isArray(info?.adadr)
    ? info.adadr.map((entry, idx) => formatGstAddr(entry, `Additional Place ${idx + 1}`)).filter(x => x.address)
    : [];
  const allAddresses = [principal, ...additionalList].filter(x => x.address || x.city || x.state);

  return {
    configured: true,
    data: {
      success: true,
      source: 'sandbox.co.in',
      gstin: rawGst,
      pan: rawGst.substring(2, 12),
      state: principal.state,
      legalName: legalName || tradeName,
      tradeName: tradeName || legalName,
      address1: principal.address1,
      address2: principal.address2,
      address: principal.address,
      city: principal.city,
      pincode: principal.pincode,
      addresses: allAddresses,
      status: info.sts || 'Active',
      taxpayerType: info.dty || 'Regular'
    }
  };
}

router.get('/api/gst-lookup', async (req, res) => {
  try {
    const rawGst = (req.query.gstin || '').trim().toUpperCase();
    if (!rawGst || rawGst.length !== 15) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 15-character Indian GSTIN.' });
    }

    const stateMap = {
      '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
      '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
      '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
      '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
      '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
      '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh'
    };

    const stateCode = rawGst.substring(0, 2);
    const pan = rawGst.substring(2, 12);
    const stateName = stateMap[stateCode] || 'Tamil Nadu';

    // 1. Check in-memory GST lookup cache first (0 Sandbox API calls)
    if (gstLookupCache.has(rawGst)) {
      return res.json(gstLookupCache.get(rawGst));
    }

    // 2. Search local verified customers first (0 Sandbox API calls)
    const localCustomers = loadLocalCustomers();
    const matchedCustomer = localCustomers.find(c =>
      (c.gstNumber || c.gstin || c.gstNo || '').toUpperCase().trim() === rawGst
    );

    if (matchedCustomer && (matchedCustomer.companyName || matchedCustomer.customerName)) {
      const principalAddr = {
        label: 'Principal Place of Business',
        address1: matchedCustomer.address1 || '',
        address2: matchedCustomer.address2 || '',
        address: matchedCustomer.address || matchedCustomer.billingAddress || '',
        city: matchedCustomer.city || '',
        state: matchedCustomer.state || stateName,
        pincode: matchedCustomer.pincode || ''
      };
      const extraAddrs = Array.isArray(matchedCustomer.additionalAddresses) ? matchedCustomer.additionalAddresses : [];
      const payload = {
        success: true,
        source: 'local_customer',
        gstin: rawGst,
        pan,
        state: matchedCustomer.state || stateName,
        legalName: matchedCustomer.companyName || matchedCustomer.customerName,
        tradeName: matchedCustomer.customerName || matchedCustomer.companyName,
        email: matchedCustomer.email && matchedCustomer.email !== '—' ? matchedCustomer.email : (matchedCustomer.primaryContact?.email || ''),
        phone: matchedCustomer.phone && matchedCustomer.phone !== '—' ? matchedCustomer.phone : (matchedCustomer.primaryContact?.phone || ''),
        address1: principalAddr.address1,
        address2: principalAddr.address2,
        address: principalAddr.address,
        city: principalAddr.city,
        pincode: principalAddr.pincode,
        addresses: extraAddrs.length > 0 ? extraAddrs : [principalAddr],
        status: 'Active',
        taxpayerType: 'Regular'
      };
      gstLookupCache.set(rawGst, payload);
      return res.json(payload);
    }

    // 3. Search local verified vendors (0 Sandbox API calls)
    const localVendors = loadLocalVendors();
    const matchedVendor = localVendors.find(v =>
      (v.gstin || v.gstNo || '').toUpperCase().trim() === rawGst
    );

    if (matchedVendor && (matchedVendor.companyName || matchedVendor.name)) {
      const payload = {
        success: true,
        source: 'local_vendor',
        gstin: rawGst,
        pan,
        state: stateName,
        legalName: matchedVendor.companyName || matchedVendor.name,
        tradeName: matchedVendor.name,
        email: matchedVendor.email && matchedVendor.email !== '—' ? matchedVendor.email : '',
        phone: matchedVendor.phone && matchedVendor.phone !== '—' ? matchedVendor.phone : (matchedVendor.mobile && matchedVendor.mobile !== '—' ? matchedVendor.mobile : ''),
        address: matchedVendor.address && matchedVendor.address !== '—' ? matchedVendor.address : '',
        city: matchedVendor.city || '',
        pincode: matchedVendor.pincode || '',
        status: 'Active',
        taxpayerType: 'Regular'
      };
      gstLookupCache.set(rawGst, payload);
      return res.json(payload);
    }

    // 4. Live Sandbox.co.in lookup only for brand-new GSTINs not yet in BUSINZ
    const sandboxResult = await lookupGstinSandbox(rawGst, stateMap).catch((err) => ({ configured: true, error: err.message }));
    if (sandboxResult.configured && sandboxResult.data) {
      gstLookupCache.set(rawGst, sandboxResult.data);
      return res.json(sandboxResult.data);
    }

    if (sandboxResult.error) {
      return res.status(404).json({ success: false, error: sandboxResult.error });
    }

    return res.status(400).json({
      success: false,
      needsApiKey: true,
      pan,
      state: stateName,
      error: 'Sandbox.co.in API credentials (SANDBOX_API_KEY & SANDBOX_API_SECRET) are not configured in server .env.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

  return router;
}
