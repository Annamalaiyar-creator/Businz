
export const storeWriteQueues = new Map();

export function enqueueStoreOperation(storeKey, opFn) {
  const previousTail = storeWriteQueues.get(storeKey) || Promise.resolve();

  const opPromise = (async () => {
    try {
      await previousTail;
    } catch (_) {
    }
    return await opFn();
  })();

  const nextQueue = opPromise.catch(() => {});
  storeWriteQueues.set(storeKey, nextQueue);
  nextQueue.finally(() => {
    if (storeWriteQueues.get(storeKey) === nextQueue) {
      storeWriteQueues.delete(storeKey);
    }
  });
  return opPromise;
}
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createStoreRouter(dependencies) {
  const router = Router();
  const {
    getDatabaseStore,
    saveDatabaseStore,
    getVerifiedUserSession,
    broadcastRealtimeEvent,
    requireRole,
    hasAnyUserRole,
    isPrivilegedRole,
    isExecutiveOrAdminRole,
    loadLocalVendors,
    saveLocalVendors,
    loadDatabaseOpportunities,
    loadDatabaseLeads,
    loadDatabaseBoms,
    saveLocalLeads,
    getNextVendorSequence,
    getPoStageRank,
    normalizeUserRole,
    query,
    isDbConnected,
    supabase,
    supabaseMemoryStore,
    STORE_PAYLOAD_LIMIT_BYTES
  } = dependencies;

router.get('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  const cleanKey = String(key || '').trim();
  if (!cleanKey || cleanKey.includes('..') || cleanKey.includes('/') || cleanKey.includes('\\') || !/^[a-zA-Z0-9_-]{1,64}$/.test(cleanKey)) {
    return res.status(400).json({ success: false, error: '[Validation Error] Invalid store key.' });
  }
  const employeeFilter = req.query.employee;
  if (!isDbConnected()) {
    return res.status(500).json({ success: false, error: `[Database Disconnected] PostgreSQL database is not connected. Cannot read store "${key}".` });
  }
  try {
    if (key === 'leaves' && employeeFilter) {
      const dbRes = await query('SELECT id, reason, dates, duration, status FROM public.leaves WHERE employee = $1 ORDER BY id DESC LIMIT 50', [String(employeeFilter).toUpperCase()]);
      return res.json({ success: true, data: dbRes.rows });
    }
    if (key === 'notifications_store') {
      const session = await getVerifiedUserSession(req);
      if (!session || !session.valid) {
        return res.status(401).json({
          success: false,
          error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
        });
      }
      return res.json({
        success: true,
        mode: 'decommissioned',
        total: 0,
        count: 0,
        data: []
      });
    }

    if (key === 'vrm_prod_ledger') {
      const data = await getDatabaseStore(key);
      const list = Array.isArray(data) ? data : [];
      if (req.query.all === 'true' || req.query.limit === 'all') {
        return res.json({ success: true, data: list });
      }
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
      return res.json({ success: true, data: list.slice(0, limit), totalCount: list.length });
    }

    const data = await getDatabaseStore(key);
    if ((cleanKey === 'item_store' || cleanKey === 'raw_materials_store') && Array.isArray(data)) {
      return res.json({ success: true, data: data.map(applyDefaultCableUom) });
    }
    return res.json({ success: true, data: data !== undefined && data !== null ? data : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

// Alias for employees directory
router.get(['/api/employees', '/api/team/members'], async (req, res) => {
  try {
    const data = await getDatabaseStore('employees_store');
    const safeList = (Array.isArray(data) ? data : []).map(emp => {
      if (!emp || typeof emp !== 'object') return emp;
      const { password, password_hash, pass, token, secret, ...safeEmp } = emp;
      return safeEmp;
    });
    return res.json({ success: true, data: safeList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Opportunities list endpoint
router.get(['/api/crm/opportunities', '/api/opportunities'], async (req, res) => {
  try {
    const data = await loadDatabaseOpportunities();
    return res.json({ success: true, data: Array.isArray(data) ? data : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated employee registration endpoint with atomic uniqueness check
router.post('/api/auth/register-employee', async (req, res) => {
  try {
    const { employee_code, employee_name, email, password, prefix, role, dashboard_type } = req.body || {};
    const cleanCode = String(employee_code || '').trim().toUpperCase();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanCode || !cleanEmail || !password) {
      return res.status(400).json({ success: false, error: 'Employee Code, Email, and Password are required.' });
    }

    const currentEmps = await getDatabaseStore('employees_store');
    const list = Array.isArray(currentEmps) ? currentEmps : [];
    const normalize = (s) => String(s || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');

    const normCode = normalize(cleanCode);
    const existingCode = list.find(e => normalize(e.employee_code || e.code) === normCode);
    if (existingCode) {
      return res.status(409).json({ 
        success: false, 
        error: `Employee Code "${cleanCode}" is already in use by ${existingCode.employee_name ? `"${existingCode.employee_name}"` : 'another user'} (${existingCode.status || 'Active'}). Every employee must have a unique Employee Code.` 
      });
    }

    const existingEmail = list.find(e => String(e.email || '').trim().toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.status(409).json({ 
        success: false, 
        error: `Email "${cleanEmail}" is already registered under Employee Code "${existingEmail.employee_code || existingEmail.code || ''}". Please sign in instead.` 
      });
    }

    // Require approval/authorization checks:
    // Active administrator or HR executive sessions may provision accounts directly (including executive roles).
    // All public self-registrations are strictly forced to 'Pending Approval'.
    const session = await getVerifiedUserSession(req);
    const sessionRole = String(session?.role || '').toLowerCase();
    const isAdminOrHr = session?.valid && ['ceo', 'md', 'managing director', 'technical administrator', 'admin', 'super admin', 'hr'].some(r => sessionRole.includes(r));

    // Reject self-registration of privileged executive or administrative roles unless provisioned by an authorized administrator
    if (!isAdminOrHr && (isPrivilegedRole(role, cleanCode) || isPrivilegedRole(prefix, cleanCode))) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Self-registration for executive or administrative roles (CEO, MD, Technical Administrator, etc.) is strictly forbidden. These roles must be provisioned directly by an authorized administrator.'
      });
    }

    let finalStatus = 'Pending Approval';
    if (isAdminOrHr && req.body.status && ['Active', 'Approved'].includes(req.body.status)) {
      finalStatus = req.body.status;
    } else if (isAdminOrHr) {
      finalStatus = 'Active';
    }

    const newEmpAccount = {
      employee_code: cleanCode,
      employee_name: String(employee_name || '').trim(),
      email: cleanEmail,
      password: String(password).trim(),
      prefix: prefix || cleanCode.split('-')[0] || 'SE',
      role: role || 'Sales Executive',
      dashboard_type: dashboard_type || role || 'Sales Executive',
      status: finalStatus,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    const updatedList = [...list, newEmpAccount];
    await saveDatabaseStore('employees_store', updatedList);

    // Return strictly sanitized account metadata (Zero password/hash/verifier exposure, Zero company-wide list exposure)
    const sanitizedAccount = {
      employee_code: newEmpAccount.employee_code,
      employee_name: newEmpAccount.employee_name,
      email: newEmpAccount.email,
      role: newEmpAccount.role,
      status: newEmpAccount.status,
      prefix: newEmpAccount.prefix
    };

    return res.status(201).json({ success: true, account: sanitizedAccount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// enqueueStoreOperation defined at module level


// Targeted single-preset upsert (Tech Support / Admin / Executive) — avoids whole-store overwrites
router.post('/api/presets', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }
    const roleStr = normalizeUserRole(session.role);
    const canManagePresets = isExecutiveOrAdminRole(session.role) ||
      hasAnyUserRole(session.role, ['tech', 'support', 'technical', 'engineering', 'production', 'admin']) ||
      roleStr.includes('tech') || roleStr.includes('support') || roleStr.includes('engineer');
    if (!canManagePresets) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${session.role}" is not authorized to create or edit presets.`
      });
    }
    if (!isDbConnected()) {
      return res.status(500).json({ success: false, error: 'Database is not connected. Cannot save preset.' });
    }

    const incoming = req.body?.preset || req.body;
    const presetId = String(incoming?.id || '').trim();
    const presetLabel = String(incoming?.label || '').trim();
    if (!presetId || !presetLabel) {
      return res.status(400).json({ success: false, error: 'Preset id and label are required.' });
    }

    const savedPreset = await enqueueStoreOperation('presets_store', async () => {
      const currentRaw = await getDatabaseStore('presets_store');
      const currentMap = (currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw))
        ? { ...currentRaw }
        : {};
      const nextPreset = {
        ...incoming,
        id: presetId,
        label: presetLabel,
        isCustom: true,
        updated_at: new Date().toISOString(),
        updated_by: session.name || session.empCode || session.role || 'Tech Support'
      };
      currentMap[presetId] = nextPreset;
      await saveDatabaseStore('presets_store', currentMap);
      return nextPreset;
    });

    broadcastRealtimeEvent('preset_updated', {
      key: 'presets_store',
      action: 'upsert',
      recordId: savedPreset.id,
      preset: savedPreset
    });

    return res.json({ success: true, preset: savedPreset });
  } catch (err) {
    console.error('[POST /api/presets Error]', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save preset.' });
  }
});

// Targeted single-preset delete (Tech Support / Admin / Executive)
router.delete('/api/presets/:id', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }
    const roleStr = normalizeUserRole(session.role);
    const canManagePresets = isExecutiveOrAdminRole(session.role) ||
      hasAnyUserRole(session.role, ['tech', 'support', 'technical', 'engineering', 'production', 'admin']) ||
      roleStr.includes('tech') || roleStr.includes('support') || roleStr.includes('engineer');
    if (!canManagePresets) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${session.role}" is not authorized to delete presets.`
      });
    }
    if (!isDbConnected()) {
      return res.status(500).json({ success: false, error: 'Database is not connected. Cannot delete preset.' });
    }

    const presetId = decodeURIComponent(String(req.params.id || '')).trim();
    if (!presetId) {
      return res.status(400).json({ success: false, error: 'Preset id is required.' });
    }

    await enqueueStoreOperation('presets_store', async () => {
      const currentRaw = await getDatabaseStore('presets_store');
      const currentMap = (currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw))
        ? { ...currentRaw }
        : {};
      delete currentMap[presetId];
      await saveDatabaseStore('presets_store', currentMap);
    });

    broadcastRealtimeEvent('preset_updated', {
      key: 'presets_store',
      action: 'delete',
      recordId: presetId,
      presetId
    });

    return res.json({ success: true, deletedId: presetId });
  } catch (err) {
    console.error('[DELETE /api/presets/:id Error]', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete preset.' });
  }
});

router.post('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  const cleanKey = String(key || '').trim().toLowerCase();

  // 1. Validate store key
  if (!cleanKey || cleanKey.includes('..') || cleanKey.includes('/') || cleanKey.length > 64) {
    return res.status(400).json({ success: false, error: '[Validation Error] Invalid store key.' });
  }

  // 2. Reject oversized requests safely before expensive merging or serialization (Phase 9I)
  const MAX_STORE_PAYLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_STORE_PAYLOAD_BYTES) {
    return res.status(413).json({
      success: false,
      error: `[Payload Too Large] Payload size exceeds 15 MB store limit. Document attachments must use media storage.`
    });
  }

  const rawBody = req.body;
  const storeData = (key === 'notifications_store' && rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) && rawBody.data !== undefined)
    ? rawBody.data
    : rawBody;

  // 3. Enforce active session for all write operations
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }

  // 4. Role-based access control for sensitive stores
  const sessionRole = session.role;
  if (cleanKey === 'employees_store') {
    if (!isExecutiveOrAdminRole(sessionRole) && !normalizeUserRole(sessionRole).includes('hr')) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to employees_store.`
      });
    }
  } else if (['settings', 'system_settings', 'api_keys', 'integrations', 'credentials'].includes(cleanKey)) {
    if (!isExecutiveOrAdminRole(sessionRole)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to ${cleanKey}.`
      });
    }
  } else if (cleanKey === 'po_store') {
    if (!hasAnyUserRole(sessionRole, ['procurement', 'purchase', 'accounts', 'finance'])) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to po_store.`
      });
    }
  } else if (cleanKey === 'bom_store') {
    if (!hasAnyUserRole(sessionRole, ['sales', 'accounts', 'dispatch', 'billing', 'production'])) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to bom_store.`
      });
    }
  } else if (cleanKey === 'invoice_store') {
    if (!hasAnyUserRole(sessionRole, ['billing', 'accounts', 'finance'])) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to invoice_store.`
      });
    }
  } else if (cleanKey === 'item_store' || cleanKey === 'raw_materials_store') {
    if (!hasAnyUserRole(sessionRole, ['procurement', 'purchase', 'production', 'dispatch', 'accounts', 'billing', 'finance'])) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${sessionRole}" is not authorized to write to ${cleanKey}.`
      });
    }
  }

  if (key === 'notifications_store') {
    return res.json({ success: true, message: 'Notifications store decommissioned', count: 0 });
  }

  if (!isDbConnected()) {
    return res.status(500).json({ success: false, error: `[Database Disconnected] PostgreSQL database is not connected. Cannot persist store "${key}".` });
  }

  // Dedicated relational leaves handler to eliminate JSONB bloat (Phase 9R Issue 3)
  if (cleanKey === 'leaves') {
    const sessionEmpCode = String(session.empCode || session.user?.employee_code || session.employee_code || '').trim().toUpperCase();
    const isExecutiveOrHr = isExecutiveOrAdminRole(sessionRole) || normalizeUserRole(sessionRole).includes('hr');

    return enqueueStoreOperation('leaves', async () => {
      try {
        const rows = Array.isArray(storeData) ? storeData : [storeData];
        const processed = [];

        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const emp = String(row.employee || row.empCode || row.code || '').trim().toUpperCase();
          if (!emp) continue;

          // Isolate legacy store synchronization: ignore non-leave records or legacy store markers
          if (row.type === 'Store' || ['BOM_STORE', 'INVOICE_STORE', 'BOM_SEQUENCE'].includes(emp)) {
            continue;
          }

          // Non-executive users may only submit or modify leave records for their own employee code
          if (!isExecutiveOrHr && emp !== sessionEmpCode) {
            return res.status(403).json({
              success: false,
              error: `Forbidden: You cannot submit or modify leave records for other employees (${emp}).`
            });
          }

          const reasonStr = typeof row.reason === 'object' ? JSON.stringify(row.reason) : String(row.reason || '');
          const status = row.status || 'Pending Approval';
          const duration = String(row.duration || '1');
          const type = row.type || 'Casual';
          const dates = row.dates || new Date().toISOString();
          const rowId = row.id ? parseInt(row.id, 10) : null;

          if (rowId && !isNaN(rowId) && rowId > 0) {
            // Stable identity update: only UPDATE when verified record id is provided
            let updateRes;
            if (isExecutiveOrHr) {
              updateRes = await query(
                'UPDATE public.leaves SET reason = $1, status = $2, duration = $3, type = $4, dates = $5, employee = $6 WHERE id = $7 RETURNING id',
                [reasonStr, status, duration, type, dates, emp, rowId]
              );
            } else {
              updateRes = await query(
                'UPDATE public.leaves SET reason = $1, status = $2, duration = $3, type = $4, dates = $5 WHERE id = $6 AND employee = $7 RETURNING id',
                [reasonStr, status, duration, type, dates, rowId, sessionEmpCode]
              );
            }
            if (updateRes.rows.length === 0) {
              return res.status(404).json({
                success: false,
                error: `Leave record #${rowId} not found or unauthorized to update.`
              });
            }
            processed.push({ id: rowId, employee: emp, status, duration, type, dates, action: 'updated' });
          } else {
            // New record: always INSERT a new row so historical applications are strictly preserved
            const insertRes = await query(
              'INSERT INTO public.leaves (employee, reason, status, duration, type, dates) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
              [emp, reasonStr, status, duration, type, dates]
            );
            const newId = insertRes.rows[0]?.id;
            processed.push({ id: newId, employee: emp, status, duration, type, dates, action: 'inserted' });
          }
        }

        return res.json({ success: true, count: processed.length, data: processed });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });
  }

  return enqueueStoreOperation(key, async () => {
    try {
      let finalDataToSave = storeData;

    // Smart merge for array collections
    if (Array.isArray(storeData) && storeData.length === 0) {
      finalDataToSave = [];
    } else if (key === 'employees_store' && Array.isArray(storeData)) {
      // Smart merge for employees_store so newly registered accounts never overwrite previously created accounts
      const currentEmps = await getDatabaseStore('employees_store');
      const list = Array.isArray(currentEmps) ? currentEmps : [];
      const normalize = (s) => String(s || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
      const empMap = new Map();
      list.forEach(e => {
        const c = normalize(e.employee_code || e.code);
        const em = String(e.email || '').trim().toLowerCase();
        if (c) empMap.set(c, e);
        if (em) empMap.set(em, e);
      });
      storeData.forEach(item => {
        const c = normalize(item.employee_code || item.code);
        const em = String(item.email || '').trim().toLowerCase();
        const existing = (c && empMap.get(c)) || (em && empMap.get(em));
        if (existing) {
          const merged = { ...existing, ...item };
          if (c) empMap.set(c, merged);
          if (em) empMap.set(em, merged);
        } else {
          if (c) empMap.set(c, item);
          if (em) empMap.set(em, item);
        }
      });
      finalDataToSave = Array.from(new Set(empMap.values()));
    } else if (key === 'employees_store' && storeData && typeof storeData === 'object') {
      const currentEmps = await getDatabaseStore('employees_store');
      const list = Array.isArray(currentEmps) ? currentEmps : [];
      const normalize = (s) => String(s || '').trim().toUpperCase().replace(/O/g, '0').replace(/[-_\s]/g, '');
      const c = normalize(storeData.employee_code || storeData.code);
      const em = String(storeData.email || '').trim().toLowerCase();
      let matched = false;
      const mergedList = list.map(e => {
        const ec = normalize(e.employee_code || e.code);
        const eem = String(e.email || '').trim().toLowerCase();
        if ((c && ec === c) || (em && eem === em)) {
          matched = true;
          return { ...e, ...storeData };
        }
        return e;
      });
      if (!matched) mergedList.push(storeData);
      finalDataToSave = mergedList;
    } else if (key === 'notifications_store') {
      // Smart non-destructive merge for notifications_store: NEVER truncate or overwrite historical records
      const currentNotifs = await getDatabaseStore('notifications_store');
      const list = Array.isArray(currentNotifs) ? currentNotifs : [];
      const incomingList = Array.isArray(storeData) ? storeData : (storeData && typeof storeData === 'object' ? [storeData] : []);

      const notifMap = new Map();
      // 1. Put incoming new/updated notifications first
      incomingList.forEach(n => {
        if (n && (n.id || n.message)) {
          const k = n.id || n.message;
          notifMap.set(k, n);
        }
      });
      // 2. Preserve all historical notifications without data loss
      list.forEach(n => {
        if (n && (n.id || n.message)) {
          const k = n.id || n.message;
          if (!notifMap.has(k)) {
            notifMap.set(k, n);
          } else {
            // Merge status changes (e.g. read status) while keeping existing metadata
            notifMap.set(k, { ...n, ...notifMap.get(k) });
          }
        }
      });
      finalDataToSave = Array.from(notifMap.values());
    } else if (Array.isArray(storeData)) {
      const currentData = await getDatabaseStore(key);
      if (Array.isArray(currentData) && currentData.length > 0) {
        if (key === 'po_store') {
          const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
          const poMap = new Map();
          currentData.forEach(p => {
            const k1 = normalize(p.poNo);
            const k2 = normalize(p.id);
            if (k1) poMap.set(k1, p);
            if (k2) poMap.set(k2, p);
          });
          storeData.forEach(item => {
            const k1 = normalize(item.poNo);
            const k2 = normalize(item.id);
            const existing = (k1 && poMap.get(k1)) || (k2 && poMap.get(k2));
            if (existing) {
              const eRank = getPoStageRank(existing);
              const iRank = getPoStageRank(item);
              const effPay = item.paymentDetails || existing.paymentDetails;
              const effProceed = item.proceedDetails || existing.proceedDetails;
              const effApp = item.approvedBy || existing.approvedBy;
              let effStatus = (iRank >= eRank ? item.status : existing.status) || item.status || existing.status;
              let effStatusType = (iRank >= eRank ? item.statusType : existing.statusType) || item.statusType || existing.statusType;
              if (effProceed && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 4) {
                effStatus = 'Proceed PO';
                effStatusType = 'proceed_po';
              } else if (effPay && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 3) {
                effStatus = 'Payment Processed';
                effStatusType = 'payment_processed';
              } else if (effApp && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 2) {
                effStatus = 'MD Approved';
                effStatusType = 'md_approved';
              }
              const merged = {
                ...existing,
                ...item,
                status: effStatus,
                statusType: effStatusType,
                paymentDetails: effPay,
                proceedDetails: effProceed,
                approvedBy: effApp,
                approvalDate: item.approvalDate || existing.approvalDate,
                approvalTime: item.approvalTime || existing.approvalTime,
                approvalRemarks: item.approvalRemarks || existing.approvalRemarks
              };
              if (k1) poMap.set(k1, merged);
              if (k2) poMap.set(k2, merged);
            } else {
              if (k1) poMap.set(k1, item);
              if (k2) poMap.set(k2, item);
            }
          });
          finalDataToSave = Array.from(new Set(poMap.values()));
        } else {
          const getId = (item) => {
            if (!item || typeof item !== 'object') return null;
            if (key === 'invoice_store') {
              return item.invNo || item.invoiceNo || item.invoiceNumber || item.id || item.code || item.bomCode || item.poNo;
            }
            return item.employee || item.piNo || item.estimate_number || item.estimateId || item.bomCode || item.code || item.id || item.poNo || item.invNo || item.grnNo || item.vendorCode || item.email || item.name;
          };

          const map = new Map();
          currentData.forEach(item => {
            const id = getId(item);
            if (id) map.set(id, item);
          });

          storeData.forEach(item => {
            const id = getId(item);
            if (id) {
              if (map.has(id)) {
                map.set(id, { ...map.get(id), ...item });
              } else {
                map.set(id, item);
              }
            }
          });

          finalDataToSave = Array.from(map.values());
        }
      }
    } else if ((key === 'presets_store' || key === 'templates_store' || key === 'company_branding_store') && storeData && typeof storeData === 'object' && !Array.isArray(storeData)) {
      finalDataToSave = storeData;
    } else if (storeData && typeof storeData === 'object' && !Array.isArray(storeData) && key !== 'company_branding_store' && key !== 'templates_store') {
      const currentData = await getDatabaseStore(key);
      const list = Array.isArray(currentData) ? [...currentData] : (currentData && typeof currentData === 'object' && Object.keys(currentData).length > 0 ? [currentData] : []);
      const getId = (item) => {
        if (!item || typeof item !== 'object') return null;
        return item.employee || item.invNo || item.invoiceNo || item.invoiceNumber || item.id || item.piNo || item.estimate_number || item.estimateId || item.bomCode || item.code || item.poNo || item.grnNo || item.vendorCode || item.email || item.name;
      };
      const singleId = getId(storeData);
      const existingIdx = singleId ? list.findIndex(it => getId(it) === singleId) : -1;
      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], ...storeData };
      } else {
        list.unshift(storeData);
      }
      finalDataToSave = list;
    }

    if (key === 'invoice_store' && Array.isArray(finalDataToSave)) {
      finalDataToSave.forEach(inv => {
        if (inv?.vehicleLoading?.lrCopyDoc?.dataUrl && inv.vehicleLoading.lrCopyDoc.dataUrl.length > 50000) {
          delete inv.vehicleLoading.lrCopyDoc.dataUrl;
        }
      });
    }

    if ((key === 'raw_materials_store' || key === 'item_store') && Array.isArray(finalDataToSave)) {
      finalDataToSave.forEach(item => {
        if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
          item.cat = 'Raw Material';
          item.category = 'Raw Material';
        }
      });
    }

    await saveDatabaseStore(key, finalDataToSave);
    if (key === 'notifications_store') {
      const returnedSlice = Array.isArray(storeData)
        ? storeData.slice(0, 50)
        : (storeData && typeof storeData === 'object' ? [storeData] : (Array.isArray(finalDataToSave) ? finalDataToSave.slice(0, 50) : [finalDataToSave]));
      return res.json({
        success: true,
        count: Array.isArray(storeData) ? storeData.length : 1,
        total: Array.isArray(finalDataToSave) ? finalDataToSave.length : 1,
        data: returnedSlice
      });
    }
    const returnedData = Array.isArray(finalDataToSave)
      ? (finalDataToSave.length <= 50 ? finalDataToSave : finalDataToSave.slice(0, 50))
      : finalDataToSave;
    return res.json({
      success: true,
      count: Array.isArray(storeData) ? storeData.length : 1,
      total: Array.isArray(finalDataToSave) ? finalDataToSave.length : 1,
      data: returnedData
    });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, message: err.message });
    }
  });
});

router.delete('/api/store/:key/:id', requireRole(['Technical Administrator', 'CEO', 'MD', 'Managing Director', 'HR']), async (req, res) => {
  const { key, id } = req.params;
  if (key === 'employees_store') {
    try {
      const current = await getDatabaseStore('employees_store');
      const list = Array.isArray(current) ? current : [];
      const cleanTarget = String(id || '').trim().toLowerCase();
      const updated = list.filter(e => {
        const c = String(e.employee_code || e.code || '').trim().toLowerCase();
        const em = String(e.email || '').trim().toLowerCase();
        const sid = String(e.id || '').trim().toLowerCase();
        return sid !== cleanTarget && c !== cleanTarget && em !== cleanTarget;
      });
      await saveDatabaseStore('employees_store', updated);
      try {
        await supabase.from('users').delete().or(`email.eq.${cleanTarget},department.ilike.%${cleanTarget}%`);
      } catch (_) {}
      return res.json({ success: true, message: `Employee ${id} deleted successfully`, count: updated.length, data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  if (key === 'crm_opportunities' || key === 'opportunities') {
    try {
      // 1. Delete from Supabase public.opportunities
      const { error } = await supabase.from('opportunities').delete().eq('id', id);
      if (error) {
        console.warn('[DELETE opportunity Supabase notice]:', error.message);
      }
      // 2. Update memory store & disk
      let current = supabaseMemoryStore.crm_opportunities || [];
      if (!Array.isArray(current) || current.length === 0) {
        current = await loadDatabaseOpportunities();
      }
      const updated = current.filter(item => (item.id || item.oppNumber) !== id);
      supabaseMemoryStore.crm_opportunities = updated;
      supabaseMemoryStore.opportunities = updated;
      try {
        const oppPath = getStoreFilePath('crm_opportunities.json');
        fs.writeFileSync(oppPath, JSON.stringify(updated, null, 2), 'utf8');
      } catch (_) {}

      // 3. Broadcast event (lightweight deletion)
      broadcastRealtimeEvent('crm_updated', { type: 'opportunities_updated', action: 'delete', recordId: id });

      return res.json({ success: true, message: `Opportunity ${id} deleted successfully`, data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  if (key === 'crm_leads' || key === 'leads') {
    try {
      // 1. Delete from Supabase public.leads if exists
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) {
        console.warn('[DELETE lead Supabase notice]:', error.message);
      }
      // 2. Update memory store & disk
      let current = supabaseMemoryStore.crm_leads || [];
      if (!Array.isArray(current) || current.length === 0) {
        current = await loadDatabaseLeads();
      }
      const updated = current.filter(item => (item.id || item.leadNumber) !== id);
      await saveLocalLeads(updated);

      return res.json({ success: true, message: `Lead ${id} deleted successfully`, data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  if (key === 'bom_store' || key === 'boms') {
    try {
      const cleanId = String(id).trim();
      const { error } = await supabase.from('bom_orders').delete().or(`id.eq.${cleanId},bom_code.eq.${cleanId}`);
      if (error) {
        console.warn('[DELETE BOM Supabase notice]:', error.message);
      }
      let current = supabaseMemoryStore.bom_store || [];
      if (!Array.isArray(current) || current.length === 0) {
        current = await loadDatabaseBoms();
      }
      const updated = current.filter(b => (b.id !== cleanId && b.bomCode !== cleanId && b.code !== cleanId));
      // Phase C: Disk file bom_store.json is retained as a passive emergency fallback only
      // and is not rewritten on normal BOM delete operations.

      broadcastRealtimeEvent('bom_updated', { recordId: cleanId, id: cleanId, action: 'delete' });
      return res.json({ success: true, message: `BOM ${cleanId} deleted successfully`, data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  return res.status(400).json({ success: false, error: `Deletion not supported for store key: ${key}` });
});

// Endpoint to create or update a vendor in BUSINZ Authoritative Store (Native BUSINZ Store)
router.post('/api/vendors', async (req, res) => {
  try {
    const localVendors = loadLocalVendors();

    if (Array.isArray(req.body)) {
      const incomingList = req.body;
      const createdVendors = [];
      let currentVendors = [...localVendors];
      let highestSeq = getNextVendorSequence(currentVendors);

      for (let i = 0; i < incomingList.length; i++) {
        const item = incomingList[i];
        const vName = String(item.name || item.companyName || `Vendor ${i + 1}`).trim();
        let vId = item.id || item.code || item.vendorCode;
        if (!vId || vId === '—' || (vId === 'VEND-171' && !item.code)) {
          highestSeq++;
          vId = `VEND-${highestSeq}`;
        }

        const vAddress1 = item.address_1 || item.address1 || item.street || item.address || '';
        const vAddress2 = item.address_2 || item.address2 || item.street2 || '';
        const vFullAddress = [vAddress1, vAddress2].filter(Boolean).join(', ') || item.address || '';

        const vRecord = {
          id: vId,
          code: item.code || vId,
          name: vName,
          companyName: item.companyName || vName,
          type: item.type || 'Supplier',
          contact: item.contact || item.contactPerson || '—',
          phone: item.phone && item.phone !== '—' ? item.phone : '—',
          mobile: item.mobile && item.mobile !== '—' ? item.mobile : (item.phone || '—'),
          email: item.email && item.email !== '—' ? item.email : '—',
          cat: item.cat || item.category || 'General Vendor',
          status: item.status || 'Active',
          spend: item.spend || '—',
          payable: item.payable || '₹0.00',
          terms: item.terms || item.paymentTerms || 'Due on Receipt',
          gstin: item.gstin || item.gstNo || item.gstNumber || '—',
          gstTreatment: item.gstTreatment || '—',
          sourceOfSupply: item.sourceOfSupply || '—',
          pan: item.pan || item.pan_no || '—',
          currency: item.currency || item.currency_code || 'INR',
          website: item.website || '—',
          address: vFullAddress,
          address_1: vAddress1,
          address_2: vAddress2,
          street: vAddress1,
          street2: vAddress2,
          city: item.city || '',
          state: item.state || '',
          pincode: item.pincode || item.pinCode || item.zip || '',
          country: item.country || 'India',
          billingAddressObj: item.billingAddressObj || {
            address: vAddress1 || vFullAddress,
            address_1: vAddress1,
            address_2: vAddress2,
            street: vAddress1,
            street2: vAddress2,
            city: item.city || '',
            state: item.state || '',
            zip: item.pincode || item.pinCode || item.zip || '',
            country: item.country || 'India'
          },
          shippingAddressObj: item.shippingAddressObj || {
            address: vAddress1 || vFullAddress,
            address_1: vAddress1,
            address_2: vAddress2,
            street: vAddress1,
            street2: vAddress2,
            city: item.city || '',
            state: item.state || '',
            zip: item.pincode || item.pinCode || item.zip || '',
            country: item.country || 'India'
          },
          createdAt: item.createdAt || new Date().toISOString()
        };

        const targetId = String(vRecord.id).toLowerCase().trim();
        const targetName = vName.toLowerCase().trim();
        const exIdx = currentVendors.findIndex(v => {
          const vId = String(v.id || '').toLowerCase().trim();
          const vCode = String(v.code || '').toLowerCase().trim();
          const vNameEx = String(v.name || v.companyName || '').toLowerCase().trim();
          return (targetId && (vId === targetId || vCode === targetId)) || (targetName && vNameEx === targetName);
        });

        if (exIdx !== -1) {
          currentVendors[exIdx] = { ...currentVendors[exIdx], ...vRecord };
        } else {
          currentVendors = [vRecord, ...currentVendors];
        }
        createdVendors.push(vRecord);
      }

      saveLocalVendors(currentVendors);

      return res.json({
        success: true,
        message: `Successfully registered ${createdVendors.length} vendors in BUSINZ!`,
        count: createdVendors.length,
        vendors: createdVendors
      });
    }

    const incoming = req.body || {};
    const vendorName = String(incoming.name || incoming.companyName || 'New Vendor').trim();
    let highestSeq = getNextVendorSequence(localVendors);
    let vendorId = incoming.id || incoming.code || incoming.vendorCode;
    if (!vendorId || vendorId === '—' || (vendorId === 'VEND-171' && !incoming.code)) {
      highestSeq++;
      vendorId = `VEND-${highestSeq}`;
    }

    const vAddress1 = incoming.address_1 || incoming.address1 || incoming.street || incoming.address || '';
    const vAddress2 = incoming.address_2 || incoming.address2 || incoming.street2 || '';
    const vFullAddress = [vAddress1, vAddress2].filter(Boolean).join(', ') || incoming.address || '';

    const vendorRecord = {
      id: vendorId,
      code: incoming.code || vendorId,
      name: vendorName,
      companyName: incoming.companyName || vendorName,
      type: incoming.type || 'Supplier',
      contact: incoming.contact || incoming.contactPerson || '—',
      phone: incoming.phone && incoming.phone !== '—' ? incoming.phone : '—',
      mobile: incoming.mobile && incoming.mobile !== '—' ? incoming.mobile : '—',
      email: incoming.email && incoming.email !== '—' ? incoming.email : '—',
      cat: incoming.cat || incoming.category || 'General Vendor',
      status: incoming.status || 'Active',
      spend: incoming.spend || '—',
      payable: incoming.payable || '₹0.00',
      terms: incoming.terms || incoming.paymentTerms || 'Due on Receipt',
      gstin: incoming.gstin || incoming.gstNo || incoming.gstNumber || '—',
      gstTreatment: incoming.gstTreatment || '—',
      sourceOfSupply: incoming.sourceOfSupply || '—',
      pan: incoming.pan || incoming.pan_no || '—',
      currency: incoming.currency || incoming.currency_code || 'INR',
      website: incoming.website || '—',
      address: vFullAddress,
      address_1: vAddress1,
      address_2: vAddress2,
      street: vAddress1,
      street2: vAddress2,
      city: incoming.city || '',
      state: incoming.state || '',
      pincode: incoming.pincode || incoming.pinCode || incoming.zip || '',
      country: incoming.country || 'India',
      billingAddressObj: incoming.billingAddressObj || {
        address: vAddress1 || vFullAddress,
        address_1: vAddress1,
        address_2: vAddress2,
        street: vAddress1,
        street2: vAddress2,
        city: incoming.city || '',
        state: incoming.state || '',
        zip: incoming.pincode || incoming.pinCode || incoming.zip || '',
        country: incoming.country || 'India'
      },
      shippingAddressObj: incoming.shippingAddressObj || {
        address: vAddress1 || vFullAddress,
        address_1: vAddress1,
        address_2: vAddress2,
        street: vAddress1,
        street2: vAddress2,
        city: incoming.city || '',
        state: incoming.state || '',
        zip: incoming.pincode || incoming.pinCode || incoming.zip || '',
        country: incoming.country || 'India'
      },
      createdAt: incoming.createdAt || new Date().toISOString()
    };

    const targetIdClean = String(vendorRecord.id).toLowerCase().trim();
    const targetNameClean = vendorName.toLowerCase().trim();

    // In-place update or prepend
    const existingIdx = localVendors.findIndex(v => {
      const vId = String(v.id || '').toLowerCase().trim();
      const vCode = String(v.code || '').toLowerCase().trim();
      const vName = String(v.name || v.companyName || '').toLowerCase().trim();
      return (targetIdClean && (vId === targetIdClean || vCode === targetIdClean)) || (targetNameClean && vName === targetNameClean);
    });

    let updatedVendors;
    if (existingIdx !== -1) {
      localVendors[existingIdx] = { ...localVendors[existingIdx], ...vendorRecord };
      updatedVendors = [...localVendors];
    } else {
      updatedVendors = [vendorRecord, ...localVendors];
    }

    saveLocalVendors(updatedVendors);

    return res.json({
      success: true,
      message: 'Vendor saved in BUSINZ successfully!',
      vendor: vendorRecord,
      contact: {
        contact_id: vendorRecord.id,
        contact_name: vendorRecord.name,
        company_name: vendorRecord.companyName,
        contact_type: 'vendor',
        email: vendorRecord.email,
        phone: vendorRecord.phone,
        status: vendorRecord.status
      }
    });
  } catch (err) {
    console.error('[BUSINZ VENDOR SAVE ERROR]', err);
    res.status(500).json({ error: 'Failed to save vendor in BUSINZ: ' + err.message });
  }
});

// Endpoint to create a new customer in BUSINZ Authoritative Store (Native BUSINZ Store)

  return router;
}
