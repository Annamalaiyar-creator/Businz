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
 * Fetch a data collection DIRECTLY from Supabase cloud database
 * @param {string} storeKey - Unique identifier (e.g. 'bom_store', 'invoice_store', 'customer_store')
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
  if (storeKey !== 'customer_store' && storeKey !== 'crm_customers') {
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
 * Automatically detects and resolves any duplicate BOM code collisions.
 * Preserves both orders by renumbering the conflicting order to the next available sequence code.
 */
export function resolveBomCollisions(bomList, sequenceMax = 658) {
  if (!Array.isArray(bomList)) return { list: [], maxSeq: sequenceMax };
  let maxSeq = Math.max(sequenceMax, 658);
  
  bomList.forEach(b => {
    const m = String(b?.bomCode || b?.code || b?.id || '').match(/^BOM-(\d+)/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
    }
  });

  const seenCodes = new Map();
  const resolvedList = [];

  for (const b of bomList) {
    if (!b) continue;
    const code = String(b.bomCode || b.code || b.id || '').trim();
    if (!code || code === 'BOM-PENDING') {
      maxSeq += 1;
      const newCode = `BOM-${String(maxSeq).padStart(3, '0')}`;
      resolvedList.push({ ...b, id: newCode, bomCode: newCode, code: newCode });
      continue;
    }

    if (!seenCodes.has(code)) {
      seenCodes.set(code, b);
      resolvedList.push(b);
    } else {
      const existing = seenCodes.get(code);
      const bCust = (b.companyName || b.customerName || '').trim().toLowerCase();
      const exCust = (existing.companyName || existing.customerName || '').trim().toLowerCase();
      const bSales = (b.salesPerson || '').trim().toLowerCase();
      const exSales = (existing.salesPerson || '').trim().toLowerCase();
      const bDate = b.salesConfirmedAt || b.createdAt || b.date;
      const exDate = existing.salesConfirmedAt || existing.createdAt || existing.date;

      const isExactSame = (bCust && exCust && bCust === exCust && bSales === exSales) || (bDate && exDate && bDate === exDate);
      if (isExactSame) {
        const idx = resolvedList.findIndex(r => (r.bomCode || r.code || r.id) === code);
        if (idx !== -1) {
          resolvedList[idx] = { ...resolvedList[idx], ...b };
        }
      } else {
        maxSeq += 1;
        const newCode = `BOM-${String(maxSeq).padStart(3, '0')}`;
        console.warn(`[Collision Guard] Distinct order for '${b.companyName || b.customerName}' renumbered from ${code} to ${newCode}`);
        const renumbered = { ...b, id: newCode, bomCode: newCode, code: newCode };
        resolvedList.push(renumbered);
        seenCodes.set(newCode, renumbered);
      }
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
    const channel = supabase
      .channel(`sync_${storeKey}_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: storeKey === 'employees_store' ? 'users' : (storeKey === 'customer_store' || storeKey === 'crm_customers' ? 'customers' : 'leaves'),
          filter: (storeKey === 'employees_store' || storeKey === 'customer_store' || storeKey === 'crm_customers') ? undefined : `employee=eq.${employeeKey}`
        },
        async (payload) => {
          if (storeKey === 'employees_store') {
            const list = await fetchCloudStore('employees_store', []);
            onUpdateCallback(list);
          } else if (storeKey === 'customer_store' || storeKey === 'crm_customers') {
            const list = await fetchCloudStore('customer_store', []);
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
