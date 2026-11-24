import './optimizationTestGuard.js';
import { isOptimizationTestMode, getServerBindHost } from './optimizationTestGuard.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import crypto from 'crypto';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { pool, isDbConnected, initPostgresDatabase, createLocalDbClient, query, verifyDbConnectivity } from './db.js';
import { syncMissingRelationalBoms } from './routes/bomWorkflowRoutes.js';
import {
  persistBomsTransactionSafe,
  toDatabaseBomRowServer,
  toConsumerBomServer,
  getWorkflowRankServer,
  mergeBomRecords
} from './bomPersistence.js';
import {
  saveProformaInvoiceToDatabase,
  loadDatabaseProformaInvoices,
  getNextDatabasePiNumber,
  updatePiZohoSyncStatus,
  assignProformaInvoiceInDatabase,
  cancelProformaInvoiceInDatabase,
  deleteProformaInvoiceFromDatabase,
  toConsumerPi
} from './piPersistence.js';
import * as vrmDataModule from '../src/utils/vrmProductsData.js';
const VRM_PRODUCTS = vrmDataModule.VRM_PRODUCTS || vrmDataModule.default?.VRM_PRODUCTS || [];
const wordFingerprint = vrmDataModule.wordFingerprint || vrmDataModule.default?.wordFingerprint || ((w) => String(w || '').toLowerCase().trim());
const resolveProductCode = vrmDataModule.resolveProductCode || vrmDataModule.default?.resolveProductCode || ((c) => c);
const resolveDefaultUom = vrmDataModule.resolveDefaultUom || vrmDataModule.default?.resolveDefaultUom || ((_it, u, fb = 'NOS') => u || fb);
const applyDefaultCableUom = (item) => {
  if (!item || typeof item !== 'object') return item;
  const fallback = item.unit || item.uom || 'NOS';
  const resolved = resolveDefaultUom(item, item.unit || item.uom, fallback);
  if (item.unit === resolved && item.uom === resolved) return item;
  return { ...item, unit: resolved, uom: resolved };
};

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createFullBackup, listBackups, restoreFromBackup } from './backupEngine.js';
import { getSystemDiagnostics, logMemoryDiagnostic } from './memoryDiagnostics.js';
import { checkTallyStatus, fetchTallyPnl, pushDirectVoucher } from './tallyService.js';
import {
  uploadBomDocument,
  createBomDocumentSignedUrl,
  deleteBomDocument,
  getBomDocumentMetadata,
  validateBusinzSession,
  validateBomCode
} from './bomDocumentService.js';
import {
  getFinancialYear,
  formatSequenceCode,
  extractMaxSequence,
  getNextSequence
} from './sequenceService.js';
import {
  SESSION_TTL_MS,
  verifyPasswordVerifier,
  hashPassword,
  generateSecureSessionId,
  authenticateEmployeeRecord,
  isPrivilegedRole,
  normalizeEmployeeCode,
  createSessionRecord,
  validateSessionInMap,
  heartbeatSessionInMap,
  revokeSessionInMap,
  FORBIDDEN_SELF_REGISTER_ROLES
} from './authSecurity.js';
import { pushPiToZoho } from './zohoPiService.js';
import {
  getZohoConfigInfo,
  updateZohoConfig,
  testZohoConnection,
  getZohoAuthStats,
  exchangeAuthorizationCode
} from './zohoAuthService.js';
import {
  getUserSessionStatus,
  getAllUserSessions,
  initUserSession,
  sendUserWhatsAppMessage,
  logoutUserSession,
  autoRestoreAllSavedSessions,
  getUserChats,
  addUserChat
} from './whatsappMultiService.js';
import {
  getStoreFilePath,
  getUploadsDir,
  getBomDocumentsDir,
  getBackupDir,
  getWaSessionsDir,
  getDataDir,
  isExternalStorageActive,
  initRuntimeStorage,
  getMaintenanceFlagPath,
  isMaintenanceModeActive
} from './runtimePaths.js';
import {
  getLeads as getDbLeads,
  getLeadDetail,
  createLead as createDbLead,
  updateLead as updateDbLead,
  assignLead as assignDbLead,
  recordLeadActivity,
  updateLeadStatus as updateDbLeadStatus,
  scheduleLeadFollowup,
  getNotificationsForEmployee,
  markNotificationRead,
  checkAndProcessLeadInactivity,
  setRealtimeNotificationBroadcaster
} from './leadManagementService.js';
import {
  getIndiaMartConfig,
  saveIndiaMartConfig,
  testIndiaMartConnection,
  syncIndiaMartLeads,
  getIndiaMartSyncLogs
} from './indiaMartService.js';
import {
  createInternalNotification,
  getNotificationsForUser,
  markNotificationAsRead,
  clearNotifications,
  registerNotificationClient
} from './internalNotificationService.js';
import {
  getOrCreateOrderTracking,
  getTrackingByToken,
  submitCustomerIssue,
  confirmCustomerDelivery,
  regenerateTrackingToken,
  revokeTrackingToken,
  getInternalTrackingOrders,
  getTrackingAnalytics,
  processNotificationQueueWorker,
  queueTrackingNotification,
  broadcastCustomerTrackingUpdate,
  customerTrackingSseClients
} from './orderTrackingService.js';

// Prioritize local development env if present, then fallback to .env
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Initialize persistent runtime storage (decouples JSON stores & uploads from Git working tree)
initRuntimeStorage();

// Non-blocking asynchronous JSON file persistence to prevent Node.js event-loop delays
export const safeWriteJsonFileAsync = (filePath, data) => {
  setImmediate(async () => {
    try {
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await fs.promises.writeFile(filePath, content, 'utf8');
    } catch (err) {
      console.warn(`[safeWriteJsonFileAsync] Failed to write ${filePath}:`, err?.message || err);
    }
  });
};

// Canonical Deduplication Helper for Customer Catalogs
const isValidCustomerCode = (val) => /^(?:VRM-CS-\d{4}-\d+|VRMS\/CS\/\d{2}-\d{2}\/\d+)$/i.test(String(val || '').trim());

const parseSafeNumber = (val, fallback = 0) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val ?? '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
};

const deduplicateCustomerRecords = (list) => {
  if (!Array.isArray(list)) return [];
  const normName = (n) => {
    if (!n) return '';
    return String(n)
      .toLowerCase()
      .replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp|enterprises|solutions)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };
  const normGst = (g) => {
    if (!g) return '';
    const clean = String(g).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    return clean.length >= 10 ? clean : '';
  };

  const finalMap = new Map();
  for (const val of list) {
    if (!val) continue;
    const gKey = normGst(val.gstNumber || val.gstin || val.gstNo);
    const nKey = normName(val.companyName || val.customerName || val.name);
    const rawCode = String(val.customerCode || val.id || val.code || '').trim();
    const isRealCode = isValidCustomerCode(rawCode);

    const dedupKey = gKey ? `gst_${gKey}` : (nKey ? `name_${nKey}` : (isRealCode ? `code_${rawCode.toLowerCase()}` : `fallback_${normName(val.companyName || val.customerName || val.id)}`));

    if (!finalMap.has(dedupKey)) {
      finalMap.set(dedupKey, val);
    } else {
      const existing = finalMap.get(dedupKey);
      const existingHasRealCode = isValidCustomerCode(existing.customerCode || existing.code || existing.id);
      const existingHasGst = normGst(existing.gstNumber || existing.gstin || existing.gstNo);
      const valHasGst = normGst(val.gstNumber || val.gstin || val.gstNo);

      const resolvedCode = existingHasRealCode ? (existing.customerCode || existing.code) : (isRealCode ? (val.customerCode || val.code) : (existing.customerCode || val.customerCode || ''));
      const merged = {
        ...existing,
        ...val,
        id: resolvedCode || existing.id,
        customerCode: resolvedCode || existing.customerCode,
        code: resolvedCode || existing.code,
        gstNumber: (existingHasGst || valHasGst || existing.gstNumber || val.gstNumber || ''),
        gstNo: (existingHasGst || valHasGst || existing.gstNo || val.gstNo || ''),
        companyName: existing.companyName || val.companyName,
        customerName: existing.customerName || val.customerName || existing.companyName || val.companyName,
        customerType: val.customerType || existing.customerType || 'EPC Contractor',
        industry: val.industry || existing.industry || '',
        source: val.source || existing.source || 'Direct',
        email: (val.email && val.email !== '—' ? val.email : '') || (existing.email && existing.email !== '—' ? existing.email : '') || '',
        phone: (val.phone && val.phone !== '—' ? val.phone : '') || (existing.phone && existing.phone !== '—' ? existing.phone : '') || '',
        createdAt: existing.createdAt || val.createdAt || new Date().toISOString(),
        updatedAt: val.updatedAt || existing.updatedAt || new Date().toISOString()
      };
      finalMap.set(dedupKey, merged);
    }
  }

  // Ensure all deduplicated customers strictly follow either VRM-CS-YYYY-XX or VRMS/CS/YY-YY/XXX structure
  const result = Array.from(finalMap.values());
  const fy = getFinancialYear();
  let maxSeq = extractMaxSequence('CS', fy, result);

  result.forEach(c => {
    const raw = String(c.customerCode || c.id || c.code || '').trim();
    if (!isValidCustomerCode(raw)) {
      maxSeq++;
      const assigned = `VRM-CS-${fy}-${String(maxSeq).padStart(2, '0')}`;
      c.id = assigned;
      c.customerCode = assigned;
      c.code = assigned;
    }
  });

  return result;
};

// In-memory active cache for server stores
let supabaseMemoryStore = {};

// Synchronously pre-warm in-memory active cache from persistent disk storage for instant sub-millisecond responses
try {
  const custDisk = getStoreFilePath('customer_store.json');
  if (fs.existsSync(custDisk)) {
    const list = JSON.parse(fs.readFileSync(custDisk, 'utf8'));
    if (Array.isArray(list) && list.length > 0) {
      supabaseMemoryStore.customer_store = list;
      supabaseMemoryStore.crm_customers = list;
    }
  }
} catch (_) {}

try {
  if (!isOptimizationTestMode()) {
    const bomDisk = getStoreFilePath('bom_store.json');
    if (fs.existsSync(bomDisk)) {
      const list = JSON.parse(fs.readFileSync(bomDisk, 'utf8'));
      if (Array.isArray(list) && list.length > 0) {
        supabaseMemoryStore.bom_store = list;
      }
    }
  } else {
    supabaseMemoryStore.bom_store = [];
  }
} catch (_) {}

// Initialize self-hosted PostgreSQL database on Hostinger VPS
initPostgresDatabase().then(() => {
  if (process.env.ENABLE_SMART_LEADS !== 'false') {
    import('./smartLeadsSchema.js').then(({ ensureSmartLeadsSchema }) => {
      ensureSmartLeadsSchema().catch(err => console.warn('[Smart Leads Post-Init Schema Notice]:', err.message));
    }).catch(() => {});
  }
  if (!isOptimizationTestMode()) {
    loadDatabaseCustomers(true).then(list => {
      console.log(`✅ [Database Customers] Loaded ${list?.length || 0} authoritative customers from PostgreSQL.`);
    }).catch(err => console.warn('[Customers Init Notice]:', err.message));
    loadDatabaseBoms(true).then(list => {
      console.log(`✅ [Database BOMs] Pre-warmed ${list?.length || 0} authoritative BOM orders.`);
    }).catch(err => console.warn('[BOMs Init Notice]:', err.message));
    setTimeout(() => {
      syncMissingRelationalBoms().catch(err => console.warn('[BOM Sync Notice]:', err.message));
    }, 2000);
  } else {
    console.log('🛡️ [Database Init] Optimization test mode: startup data pre-warming and relational synchronization disabled.');
  }
}).catch(err => {
  console.warn('[PostgreSQL Init Notice]:', err.message);
});

// Self-hosted database client (queries local PostgreSQL directly with fallback to disk)
const supabase = createLocalDbClient(supabaseMemoryStore);


const getPoStageRank = (p) => {
  if (!p) return 0;
  const s = String(p.status || '').toLowerCase().trim();
  const st = String(p.statusType || '').toLowerCase().trim();
  if (s.includes('rejected') || st.includes('rejected')) return 7;
  const ord = Number(p.totalOrderedQty || (Array.isArray(p.items) ? p.items.reduce((acc, it) => acc + Number(it.qty || it.quantity || 0), 0) : 0));
  const rec = Number(p.totalReceivedQty || p.totalReceived || (Array.isArray(p.items) ? p.items.reduce((acc, it) => acc + Number(it.previouslyReceived || 0), 0) : 0));
  if (s.includes('closed') || s.includes('fully received') || st.includes('closed')) {
    if (ord > 0 && rec > 0 && rec < ord) return 5;
    return 6;
  }
  if (s.includes('partially') || st.includes('partially') || (ord > 0 && rec > 0 && rec < ord)) return 5;
  if (s.includes('proceed') || st.includes('proceed') || Boolean(p.proceedDetails)) return 4;
  if (s.includes('payment') || st.includes('payment') || Boolean(p.paymentDetails)) return 3;
  if (s.includes('md approved') || st.includes('md_approved') || Boolean(p.approvedBy)) return 2;
  return 1;
};

// Canonical Supabase Customers Data Layer (Zero leaves table egress)
const loadDatabaseCustomers = async (forceRefresh = false) => {
  if (!forceRefresh && supabaseMemoryStore.customer_store && Array.isArray(supabaseMemoryStore.customer_store) && supabaseMemoryStore.customer_store.length > 500) {
    return supabaseMemoryStore.customer_store;
  }
  try {
    let data = null;
    try {
      const dbRes = await query(`
        SELECT 
          id, customer_code, company_name, customer_name, customer_type, industry,
          gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
          dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
          same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
          source, primary_contact, email, phone, status, notes, created_at, updated_at,
          credit_approved, credit_status, credit_requested_limit, credit_requested_by,
          credit_requested_at, credit_approved_by, credit_approved_at, credit_rejection_reason
        FROM public.customers
        ORDER BY created_at DESC NULLS LAST, company_name ASC
      `);
      if (dbRes && Array.isArray(dbRes.rows) && dbRes.rows.length > 0) {
        data = dbRes.rows;
      }
    } catch (_) {}

    if (!data) {
      const { data: sbData, error } = await supabase
        .from('customers')
        .select(`
          id, customer_code, company_name, customer_name, customer_type, industry,
          gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
          dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
          same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
          source, primary_contact, email, phone, status, notes, created_at, updated_at
        `)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(sbData) && sbData.length > 0) {
        data = sbData;
      }
    }

    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.map(c => {
        const pContact = c.primary_contact || {};
        const effectiveContact = (pContact.name && pContact.name !== '—') 
          ? pContact.name 
          : (c.customer_name && c.customer_name !== c.company_name ? c.customer_name : '');
        const rawPhone = (c.phone && c.phone !== '—') ? c.phone : (pContact.phone || pContact.altPhone || pContact.whatsapp || '—');
        const cleanPhone = String(rawPhone || '').replace(/^'/, '').trim();
        const effectiveEmail = (c.email && c.email !== '—') ? c.email : (pContact.email || '—');

        return {
          id: c.customer_code || c.id,
          customerCode: c.customer_code,
          code: c.customer_code,
          companyName: c.company_name,
          c2: c.company_name,
          customerName: c.customer_name || c.company_name,
          c3: c.customer_name || c.company_name,
          contactPerson: effectiveContact,
          contact: effectiveContact,
          customerType: c.customer_type || 'Customer',
          industry: c.industry || '',
          gstNumber: c.gst_number || '—',
          gstNo: c.gst_number || '—',
          address1: c.billing_address_obj?.address1 || c.billing_address || '',
          address2: c.billing_address_obj?.address2 || '',
          billingAddress1: c.billing_address_obj?.address1 || c.billing_address || '',
          billingAddress2: c.billing_address_obj?.address2 || '',
          address: c.billing_address || '',
          city: c.city || '',
          state: c.state || '',
          pincode: c.pincode || '',
          billingAddress: c.billing_address || '',
          c6: c.billing_address || '',
          billingAddressObj: c.billing_address_obj || {},
          dispatchAddress1: c.delivery_address_obj?.address1 || c.dispatch_address || '',
          dispatchAddress2: c.delivery_address_obj?.address2 || '',
          shippingAddress1: c.delivery_address_obj?.address1 || c.dispatch_address || '',
          shippingAddress2: c.delivery_address_obj?.address2 || '',
          dispatchAddress: c.dispatch_address || '',
          deliveryAddress: c.dispatch_address || '',
          c7: c.dispatch_address || '',
          dispatchCity: c.dispatch_city || '',
          dispatchState: c.dispatch_state || '',
          dispatchPincode: c.dispatch_pincode || '',
          deliveryAddressObj: c.delivery_address_obj || {},
          sameAsBilling: Boolean(c.same_as_billing),
          creditLimit: Number(c.credit_limit || 0),
          creditDays: Number(c.credit_days || 0),
          creditApproved: Boolean(c.credit_approved || String(c.credit_status || '').toLowerCase() === 'approved'),
          creditStatus: String(c.credit_status || (c.credit_approved ? 'approved' : 'none')).toLowerCase(),
          creditRequestedLimit: Number(c.credit_requested_limit || 0),
          creditRequestedBy: c.credit_requested_by || '',
          creditRequestedAt: c.credit_requested_at || null,
          creditApprovedBy: c.credit_approved_by || '',
          creditApprovedAt: c.credit_approved_at || null,
          creditRejectionReason: c.credit_rejection_reason || '',
          paymentTerms: c.payment_terms || 'Due on Receipt',
          assignedSalesperson: c.assigned_salesperson || 'Sales Rep',
          salesPerson: c.assigned_salesperson || 'Sales Rep',
          c8: c.assigned_salesperson || 'Sales Rep',
          source: c.source || 'Manual',
          primaryContact: {
            ...pContact,
            name: effectiveContact || c.company_name,
            phone: cleanPhone !== '—' ? cleanPhone : (pContact.phone || ''),
            email: effectiveEmail !== '—' ? effectiveEmail : (pContact.email || '')
          },
          email: effectiveEmail,
          c5: effectiveEmail,
          phone: cleanPhone,
          c4: cleanPhone,
          status: (c.status || 'Active').toUpperCase(),
          notes: c.notes || '',
          createdAt: c.created_at || new Date().toISOString(),
          updatedAt: c.updated_at || new Date().toISOString()
        };
      });

      const customerList = mapped;

      supabaseMemoryStore.customer_store = customerList;
      supabaseMemoryStore.crm_customers = customerList;
      try {
        fs.writeFileSync(getStoreFilePath('customer_store.json'), JSON.stringify(customerList, null, 2), 'utf8');
        fs.writeFileSync(getStoreFilePath('crm_customers.json'), JSON.stringify(customerList, null, 2), 'utf8');
      } catch (_) {}
      return customerList;
    }
  } catch (err) {
    console.warn('[loadDatabaseCustomers] Supabase fetch notice:', err?.message || err);
  }

  // Fallback to local and auto-extracted customers ONLY if DB returned nothing
  const localList = loadLocalCustomers();
  if (localList && localList.length > 0) {
    return localList;
  }

  return supabaseMemoryStore.customer_store || [];
};

const loadLocalCustomers = () => {
  if (supabaseMemoryStore.customer_store && Array.isArray(supabaseMemoryStore.customer_store) && supabaseMemoryStore.customer_store.length > 0) {
    return supabaseMemoryStore.customer_store;
  }
  const custMap = new Map();
  const register = (c) => {
    if (!c || typeof c !== 'object') return;
    const name = (c.companyName || c.c2 || c.name || c.customerName || c.code || '').trim();
    if (!name || name === 'Customer Order' || name === 'Customer' || name === 'New Customer') return;
    const k = name.toLowerCase();
    const idKey = (c.customerCode || c.id || '').toLowerCase().trim();
    const existing = custMap.get(k) || (idKey ? custMap.get(idKey) : null) || {};
    const validCode = isValidCustomerCode(c.customerCode || c.id || c.code) ? (c.customerCode || c.id || c.code) : (existing.customerCode || '');
    const merged = {
      ...existing,
      ...c,
      id: validCode || existing.id,
      customerCode: validCode || existing.customerCode,
      code: validCode || existing.code,
      companyName: name,
      c2: name,
      customerName: c.customerName || existing.customerName || name,
      c3: c.customerName || existing.customerName || name,
      customerType: c.customerType || existing.customerType || 'EPC Contractor',
      industry: c.industry || existing.industry || 'Solar Energy / Infrastructure',
      gstNumber: c.gstNumber || c.gstNo || existing.gstNumber || '—',
      gstNo: c.gstNumber || c.gstNo || existing.gstNo || '—',
      panNumber: c.panNumber || existing.panNumber || '—',
      address: c.billingAddress || c.address || existing.address || '',
      c6: c.billingAddress || c.address || existing.address || '',
      city: c.city || existing.city || '',
      state: c.state || existing.state || '',
      pincode: c.pincode || existing.pincode || '',
      billingAddressObj: c.billingAddressObj || existing.billingAddressObj || {},
      dispatchAddress: c.dispatchAddress || c.deliveryAddress || existing.dispatchAddress || '',
      deliveryAddress: c.dispatchAddress || c.deliveryAddress || existing.dispatchAddress || '',
      c7: c.dispatchAddress || c.deliveryAddress || existing.dispatchAddress || '',
      dispatchCity: c.dispatchCity || existing.dispatchCity || '',
      dispatchState: c.dispatchState || existing.dispatchState || '',
      dispatchPincode: c.dispatchPincode || existing.dispatchPincode || '',
      deliveryAddressObj: c.deliveryAddressObj || existing.deliveryAddressObj || {},
      sameAsBilling: c.sameAsBilling !== undefined ? c.sameAsBilling : true,
      creditLimit: Number(c.creditLimit || existing.creditLimit || 2500000),
      creditDays: Number(c.creditDays || existing.creditDays || 30),
      paymentTerms: c.paymentTerms || existing.paymentTerms || 'Due on Receipt',
      assignedSalesperson: c.assignedSalesperson || c.salesPerson || existing.assignedSalesperson || 'Sales Executive',
      salesPerson: c.assignedSalesperson || c.salesPerson || existing.assignedSalesperson || 'Sales Executive',
      c8: c.assignedSalesperson || c.salesPerson || existing.assignedSalesperson || 'Sales Executive',
      source: c.source || existing.source || 'Direct Client',
      primaryContact: c.primaryContact || existing.primaryContact || {
        name: c.customerName || name,
        phone: c.phone || '',
        whatsapp: c.phone || '',
        email: c.email || ''
      },
      phone: c.phone || existing.phone || '—',
      c4: c.phone || existing.phone || '—',
      email: c.email || existing.email || '—',
      c5: c.email || existing.email || '—',
      status: c.status || existing.status || 'ACTIVE',
      createdAt: c.createdAt || existing.createdAt || new Date().toISOString()
    };
    custMap.set(k, merged);
    if (idKey) custMap.set(idKey, merged);
  };

  try {
    const p1 = getStoreFilePath('crm_customers.json');
    if (fs.existsSync(p1)) {
      const data = JSON.parse(fs.readFileSync(p1, 'utf8'));
      if (Array.isArray(data)) data.forEach(register);
    }
  } catch (_) {}

  try {
    const p2 = getStoreFilePath('customer_store.json');
    if (fs.existsSync(p2)) {
      const data = JSON.parse(fs.readFileSync(p2, 'utf8'));
      if (Array.isArray(data)) data.forEach(register);
    }
  } catch (_) {}

  // Strict Canonical Deduplication by Company Name and GST Number
  // Guarantees: No duplicate records where one has GST/ID and another has no GST/ID
  const normName = (n) => {
    if (!n) return '';
    return String(n)
      .toLowerCase()
      .replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp|enterprises|solutions)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const normGst = (g) => {
    if (!g) return '';
    const clean = String(g).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    return clean.length >= 10 ? clean : '';
  };

  const result = deduplicateCustomerRecords(Array.from(custMap.values()));
  if (result.length > 0) {
    supabaseMemoryStore.customer_store = result;
    supabaseMemoryStore.crm_customers = result;
  }
  return result;
};

// Canonical Supabase Opportunities Data Layer (Zero leaves table egress)
const loadDatabaseOpportunities = async () => {
  if (supabaseMemoryStore.crm_opportunities && Array.isArray(supabaseMemoryStore.crm_opportunities) && supabaseMemoryStore.crm_opportunities.length > 0) {
    return supabaseMemoryStore.crm_opportunities;
  }
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, customer_id, company_name, title, deal_value, stage, probability, assigned_salesperson, target_close_date, notes, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(o => {
        let extra = {};
        let userNotes = o.notes || '';
        if (typeof o.notes === 'string' && o.notes.startsWith('{')) {
          try {
            const parsed = JSON.parse(o.notes);
            if (parsed && typeof parsed === 'object') {
              extra = parsed;
              userNotes = parsed._userNotes || '';
            }
          } catch (_) {}
        }
        return {
          id: o.id,
          oppNumber: extra.oppNumber || o.id,
          customerId: o.customer_id || extra.customerId || '',
          companyName: o.company_name || extra.companyName || '',
          title: o.title || extra.title || '',
          dealValue: Number(o.deal_value !== undefined && o.deal_value !== null ? o.deal_value : (extra.dealValue || 0)),
          stage: o.stage || extra.stage || 'Qualification',
          probability: Number(o.probability !== undefined && o.probability !== null ? o.probability : (extra.probability ?? 20)),
          assignedSalesperson: o.assigned_salesperson || extra.assignedSalesperson || 'Sales Team',
          targetCloseDate: o.target_close_date || extra.targetCloseDate || '',
          notes: userNotes,
          createdAt: o.created_at || extra.createdAt || new Date().toISOString(),
          updatedAt: o.updated_at || extra.updatedAt || new Date().toISOString(),
          ...extra
        };
      });

      supabaseMemoryStore.crm_opportunities = mapped;
      supabaseMemoryStore.opportunities = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn('[loadDatabaseOpportunities] Supabase fetch notice:', err?.message || err);
  }

  // Fallback to disk JSON
  try {
    const diskPath = getStoreFilePath('crm_opportunities.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      supabaseMemoryStore.crm_opportunities = diskData;
      supabaseMemoryStore.opportunities = diskData;
      return diskData;
    }
  } catch (_) {}

  return supabaseMemoryStore.crm_opportunities || [];
};

const loadLocalOpportunities = () => {
  if (supabaseMemoryStore.crm_opportunities && Array.isArray(supabaseMemoryStore.crm_opportunities) && supabaseMemoryStore.crm_opportunities.length > 0) {
    return supabaseMemoryStore.crm_opportunities;
  }
  return [];
};

// Canonical Supabase & Disk Leads Database Layer
const loadDatabaseLeads = async () => {
  if (supabaseMemoryStore.crm_leads && Array.isArray(supabaseMemoryStore.crm_leads) && supabaseMemoryStore.crm_leads.length > 0) {
    return supabaseMemoryStore.crm_leads;
  }
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(l => {
        let extra = {};
        if (typeof l.notes === 'string' && l.notes.startsWith('{')) {
          try {
            extra = JSON.parse(l.notes);
          } catch (_) {}
        }
        return {
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
      });
      supabaseMemoryStore.crm_leads = mapped;
      supabaseMemoryStore.leads = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn('[loadDatabaseLeads] Supabase fetch notice:', err?.message || err);
  }

  // Fallback to disk JSON (crm_leads.json)
  try {
    const diskPath = getStoreFilePath('crm_leads.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData) && diskData.length > 0) {
        supabaseMemoryStore.crm_leads = diskData;
        supabaseMemoryStore.leads = diskData;
        return diskData;
      }
    }
  } catch (_) {}

  return supabaseMemoryStore.crm_leads || [];
};

const loadLocalLeads = () => {
  if (supabaseMemoryStore.crm_leads && Array.isArray(supabaseMemoryStore.crm_leads) && supabaseMemoryStore.crm_leads.length > 0) {
    return supabaseMemoryStore.crm_leads;
  }
  return [];
};

// ==========================================
// 📦 CANONICAL BOM_ORDERS ADAPTERS & STORE (PHASE C / 51)
// Functions toConsumerBomServer, toDatabaseBomRowServer, and getWorkflowRankServer
// are imported from ./bomPersistence.js
// ==========================================

let cachedBomsResult = null;
let cachedBomsWirePayload = null;
let lastBomFetchTimestamp = 0;

const loadDatabaseBoms = async (forceRefresh = false) => {
  // 1. Instant sub-millisecond return if authoritative memory cache is already loaded
  if (!forceRefresh && supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
    return supabaseMemoryStore.bom_store;
  }

  // 2. Read existing disk store as authoritative baseline
  let existingDiskList = [];
  const diskPath = getStoreFilePath('bom_store.json');
  if (fs.existsSync(diskPath)) {
    try {
      existingDiskList = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
    } catch (_) {}
  }
  if (!Array.isArray(existingDiskList)) existingDiskList = [];

  // 3. Query PostgreSQL if connected
  if (isDbConnected()) {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('BOMs cloud fetch timeout')), 5000));
      const BOM_LIST_COLUMNS = 'id, code, bom_code, source_pi_no, date, delivery_date, customer_name, company_name, contact_person, gst_no, mobile, email, billing_address, billing_address_obj, delivery_address, delivery_address_obj, delivery_address_proof_doc, payment_proof_doc, status, sales_confirmed, sales_confirmed_at, sales_person, sales_person_code, created_by, created_by_id, sub_total, gst_amount, cgst_amount, sgst_amount, grand_total, balance_amount, partial_amount, credit_days, credit_due_date, payment_type, remarks, stock_blocked, stock_blocked_at, invoice_confirmed, invoice_deducted, stock_deducted, preset_name, preset_kit_price, preset_set_count, preset_groups, transport_mode, transport_scope, transporter_name, vehicle_no, lr_no, items, payments, dispatch_packing, accounts_verification, created_at, updated_at';
      const fetchPromise = supabase
        .from('bom_orders')
        .select(BOM_LIST_COLUMNS)
        .order('created_at', { ascending: false });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(r => toConsumerBomServer(r)).filter(Boolean);

        // Authoritative merge: NEVER discard disk data or overwrite rich dispatch packing with empty database records,
        // and prevent cross-customer pollution if disk bom_store.json had legacy entries merged under active codes.
        const normCustId = (obj) => String(obj?.customerName || obj?.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isSameOrderIdentity = (dbItem, diskItem) => {
          const dbCust = normCustId(dbItem);
          const diskCust = normCustId(diskItem);
          if (dbCust && diskCust && dbCust !== diskCust && !dbCust.includes(diskCust) && !diskCust.includes(dbCust)) {
            return false;
          }
          return true;
        };

        const dbByCode = new Map();
        mapped.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (c) dbByCode.set(c, item);
        });

        const combinedMap = new Map();
        existingDiskList.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (!c) return;
          if (dbByCode.has(c) && !isSameOrderIdentity(dbByCode.get(c), item)) {
            return;
          }
          combinedMap.set(c, item);
        });

        mapped.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (!c) return;
          const diskItem = combinedMap.get(c);
          if (diskItem && isSameOrderIdentity(item, diskItem)) {
            const diskRank = getWorkflowRankServer(diskItem);
            const dbRank = getWorkflowRankServer(item);
            const diskPacking = Array.isArray(diskItem.dispatchPacking) ? diskItem.dispatchPacking : [];
            const dbPacking = Array.isArray(item.dispatchPacking) ? item.dispatchPacking : [];
            const diskPackedCount = diskPacking.filter(p => p && p.packed).length;
            const dbPackedCount = dbPacking.filter(p => p && p.packed).length;

            const resolvedPacking = (diskPackedCount > 0 && diskPackedCount >= dbPackedCount) 
              ? diskPacking 
              : (dbPackedCount > 0 ? dbPacking : (diskPacking.length > 0 ? diskPacking : dbPacking));

            const resolvedPackingStatus = (diskItem.packingStatus === 'PACKING_VERIFIED' || item.packingStatus === 'PACKING_VERIFIED')
              ? 'PACKING_VERIFIED'
              : (diskItem.packingStatus === 'PARTIALLY_PACKED' || item.packingStatus === 'PARTIALLY_PACKED')
                ? 'PARTIALLY_PACKED'
                : (item.packingStatus || diskItem.packingStatus || null);

            combinedMap.set(c, {
              ...item,
              ...((diskRank > dbRank) ? diskItem : {}),
              status: (diskRank > dbRank) ? diskItem.status : item.status,
              dispatchPacking: resolvedPacking,
              packingStatus: resolvedPackingStatus,
              accountsVerification: {
                ...(item.accountsVerification || {}),
                ...(diskItem.accountsVerification || {}),
                verified: Boolean(item.accountsVerification?.verified || diskItem.accountsVerification?.verified),
                readyForAccounts: Boolean(item.accountsVerification?.readyForAccounts || diskItem.accountsVerification?.readyForAccounts),
                packedAt: item.accountsVerification?.packedAt || diskItem.accountsVerification?.packedAt || diskItem.packedAt || item.packedAt || null,
                packedBy: item.accountsVerification?.packedBy || diskItem.accountsVerification?.packedBy || diskItem.packedBy || item.packedBy || null
              },
              vehicleLoading: diskItem.vehicleLoading || item.vehicleLoading || null,
              lrCopyDoc: diskItem.lrCopyDoc || item.lrCopyDoc || null,
              dispatchPackingMedia: (item.dispatchPackingMedia?.photos?.length > 0 || item.dispatchPackingMedia?.videos?.length > 0)
                ? item.dispatchPackingMedia
                : (diskItem.dispatchPackingMedia || { photos: [], videos: [] }),
              packedAt: diskItem.packedAt || item.packedAt || null,
              packedBy: diskItem.packedBy || item.packedBy || null,
              packedById: diskItem.packedById || item.packedById || null,
              packingCompletedAt: diskItem.packingCompletedAt || item.packingCompletedAt || null,
              fullyCompleted: (diskItem.fullyCompleted !== undefined && diskRank >= dbRank) ? diskItem.fullyCompleted : (item.fullyCompleted !== undefined ? item.fullyCompleted : diskItem.fullyCompleted),
              dispatchPrinted: Boolean(item.dispatchPrinted || diskItem.dispatchPrinted),
              dispatchPrintCount: Math.max(parseInt(item.dispatchPrintCount, 10) || 0, parseInt(diskItem.dispatchPrintCount, 10) || 0),
              dispatchPrintTimeStr: item.dispatchPrintTimeStr || diskItem.dispatchPrintTimeStr || '',
              dispatchPrintedDateStr: item.dispatchPrintedDateStr || diskItem.dispatchPrintedDateStr || '',
              dispatchPrintedBy: item.dispatchPrintedBy || diskItem.dispatchPrintedBy || '',
              dispatchPrintedAt: item.dispatchPrintedAt || diskItem.dispatchPrintedAt || null,
              firstPrintTimeStr: item.firstPrintTimeStr || diskItem.firstPrintTimeStr || null,
              secondPrintTimeStr: item.secondPrintTimeStr || diskItem.secondPrintTimeStr || null,
              dispatchPrintHistory: (Array.isArray(item.dispatchPrintHistory) && item.dispatchPrintHistory.length > 0)
                ? item.dispatchPrintHistory
                : (Array.isArray(diskItem.dispatchPrintHistory) ? diskItem.dispatchPrintHistory : [])
            });
          } else {
            combinedMap.set(c, item);
          }
        });

        const mergedAll = Array.from(combinedMap.values());
        supabaseMemoryStore.bom_store = mergedAll;
        cachedBomsResult = mergedAll;
        lastBomFetchTimestamp = Date.now();
        try {
          fs.writeFileSync(diskPath, JSON.stringify(mergedAll, null, 2), 'utf8');
        } catch (_) {}
        return mergedAll;
      }
    } catch (err) {
      console.warn('[loadDatabaseBoms] Supabase fetch notice:', err?.message || err);
    }
  }

  // 4. Fallback to existing disk list if DB fetch did not succeed
  if (existingDiskList.length > 0) {
    supabaseMemoryStore.bom_store = existingDiskList;
    cachedBomsResult = existingDiskList;
    lastBomFetchTimestamp = Date.now();
    return existingDiskList;
  }

  // 5. Fallback to memory store
  if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
    return supabaseMemoryStore.bom_store;
  }

  return [];
};

const loadLocalBoms = () => {
  if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
    return supabaseMemoryStore.bom_store;
  }
  try {
    const diskPath = getStoreFilePath('bom_store.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData) && diskData.length > 0) {
        supabaseMemoryStore.bom_store = diskData;
        return diskData;
      }
    }
  } catch (_) {}
  return [];
};

let saveLocalBomsLock = Promise.resolve();

const saveLocalBoms = async (boms) => {
  if (!boms) return;

  return new Promise((resolveOuter, rejectOuter) => {
    saveLocalBomsLock = saveLocalBomsLock.then(async () => {
      try {
        const incomingItems = Array.isArray(boms) ? boms : [boms];

        // 1. Transaction-safe PostgreSQL persistence across public.bom_orders and public.controlroom_store
        const persistResult = await persistBomsTransactionSafe({
          items: incomingItems,
          isUpdate: true
        });

        const { fullStoreList, changedRecords } = persistResult;

        // 2. ONLY AFTER successful PostgreSQL COMMIT: Update in-memory active cache
        supabaseMemoryStore.bom_store = fullStoreList;
        cachedBomsResult = fullStoreList;
        lastBomFetchTimestamp = Date.now();

        // 3. Write disk backup
        try {
          const diskPath = getStoreFilePath('bom_store.json');
          fs.writeFileSync(diskPath, JSON.stringify(fullStoreList, null, 2), 'utf8');
        } catch (diskErr) {
          console.warn('[saveLocalBoms disk write notice]:', diskErr?.message || diskErr);
        }

        // 4. Broadcast via SSE to all connected clients (targeted lightweight event)
        try {
          const primaryRecord = changedRecords?.[0] || incomingItems?.[0];
          const recordId = primaryRecord?.bomCode || primaryRecord?.code || primaryRecord?.id;
          broadcastRealtimeEvent('bom_updated', {
            action: 'update',
            recordId,
            bom: primaryRecord,
            count: changedRecords?.length || 1
          });
        } catch (_) {}

        // 5. Post-commit inventory reconciliation
        try {
          await reconcileServerInventoryWithBoms(fullStoreList);
        } catch (rErr) {
          console.warn('[saveLocalBoms Inventory reconcile notice]:', rErr?.message || rErr);
        }

        resolveOuter(persistResult);
      } catch (err) {
        console.error('[saveLocalBoms Transaction Error]:', err?.message || err);
        rejectOuter(err);
      }
    }).catch(err => {
      rejectOuter(err);
    });
  });
};

// Authoritative Database Store functions directly with Supabase
const getDatabaseStore = async (key) => {
  const cleanKey = String(key || '').toLowerCase();
  if (cleanKey === 'customer_store' || cleanKey === 'crm_customers') {
    return await loadDatabaseCustomers();
  }
  if (cleanKey === 'crm_opportunities' || cleanKey === 'opportunities') {
    return await loadDatabaseOpportunities();
  }
  if (cleanKey === 'crm_leads' || cleanKey === 'leads') {
    return await loadDatabaseLeads();
  }
  if (cleanKey === 'bom_store' || cleanKey === 'boms' || cleanKey === 'bom_orders') {
    return await loadDatabaseBoms();
  }
  if (cleanKey === 'leaves') {
    if (isDbConnected()) {
      try {
        const dbRes = await query('SELECT id, employee, reason, status, dates, duration, type FROM public.leaves ORDER BY id DESC LIMIT 50');
        return dbRes.rows;
      } catch (err) {
        console.error('[getDatabaseStore leaves query error]:', err?.message || err);
        throw err;
      }
    }
    return [];
  }
  // 0. Primary: Check PostgreSQL controlroom_store on Hostinger VPS
  // Protection 1: PostgreSQL is authoritative whenever connected
  if (isDbConnected()) {
    try {
      const dbRes = await query('SELECT data FROM controlroom_store WHERE key = $1', [cleanKey]);
      if (dbRes.rows.length > 0 && dbRes.rows[0]?.data !== undefined && dbRes.rows[0]?.data !== null) {
        let d = dbRes.rows[0].data;
        if (typeof d === 'string') {
          try { d = JSON.parse(d); } catch (_) {}
        }
        supabaseMemoryStore[cleanKey] = d;
        supabaseMemoryStore[key] = d;
        return d;
      }
      // Authoritative PostgreSQL check: row does not exist or has null data.
      // Invalidate any stale in-memory cache for this key to prevent resurrecting deleted records.
      // NEVER fall back to disk, memory, Supabase, or legacy storage merely because a PostgreSQL row is absent.
      delete supabaseMemoryStore[cleanKey];
      if (key) {
        delete supabaseMemoryStore[key];
        delete supabaseMemoryStore[String(key).toUpperCase()];
      }
      const OBJECT_BASED_STORES = new Set(['presets_store', 'templates_store', 'company_branding_store']);
      return OBJECT_BASED_STORES.has(cleanKey) ? {} : [];
    } catch (dbErr) {
      console.error(`[getDatabaseStore PostgreSQL error for ${cleanKey}]:`, dbErr?.message || dbErr);
      throw dbErr; // Protection 2: Never silently swallow database errors; propagate to trigger HTTP 500
    }
  }

  if (cleanKey === 'employees_store') {
    const empDiskPath = getStoreFilePath('employees_store.json');
    if (fs.existsSync(empDiskPath)) {
      try {
        const diskData = JSON.parse(fs.readFileSync(empDiskPath, 'utf8'));
        if (Array.isArray(diskData)) {
          supabaseMemoryStore['employees_store'] = diskData;
          return diskData;
        }
      } catch (_) {}
    }
    if (Array.isArray(supabaseMemoryStore['employees_store'])) {
      return supabaseMemoryStore['employees_store'];
    }
  }

  // 1. Fast sub-millisecond return from authoritative memory cache if populated
  if (supabaseMemoryStore[cleanKey] && (Array.isArray(supabaseMemoryStore[cleanKey]) ? supabaseMemoryStore[cleanKey].length > 0 : Object.keys(supabaseMemoryStore[cleanKey]).length > 0)) {
    return supabaseMemoryStore[cleanKey];
  }
  if (supabaseMemoryStore[key] && (Array.isArray(supabaseMemoryStore[key]) ? supabaseMemoryStore[key].length > 0 : Object.keys(supabaseMemoryStore[key]).length > 0)) {
    return supabaseMemoryStore[key];
  }

  // 2. Fast return from disk store file if available
  const initialDiskPath = getStoreFilePath(cleanKey + '.json');
  if (fs.existsSync(initialDiskPath)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(initialDiskPath, 'utf8'));
      if (diskData && (Array.isArray(diskData) ? diskData.length > 0 : Object.keys(diskData).length > 0)) {
        supabaseMemoryStore[cleanKey] = diskData;
        supabaseMemoryStore[key] = diskData;
        return diskData;
      }
    } catch (_) {}
  }

  const employeeKey = key.toUpperCase();
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase store fetch timeout')), 5000));
    const fetchPromise = supabase
      .from('leaves')
      .select('id, reason, dates, duration')
      .eq('employee', employeeKey)
      .order('id', { ascending: false });

    const { data: records, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (!error && records && records.length > 0) {
      const primaryRecord = records[0];
      // Asynchronously clean up legacy duplicate rows if more than 1 row exists
      if (records.length > 1) {
        const excessIds = records.slice(1).map(r => r.id);
        supabase.from('leaves').delete().in('id', excessIds).then(() => {}).catch(() => {});
      }
      if (primaryRecord.reason) {
        try {
          const parsed = JSON.parse(primaryRecord.reason);
          // If disk file has more items than cloud record for inventory stores (e.g. 309 vs 37), merge with disk master
          if (key === 'po_store') {
            const diskPath = getStoreFilePath('po_store.json');
            if (fs.existsSync(diskPath)) {
              try {
                const diskPOs = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
                if (Array.isArray(diskPOs) && diskPOs.length > 0) {
                  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
                  const poMap = new Map();
                  if (Array.isArray(parsed)) {
                    parsed.forEach(p => {
                      const k1 = normalize(p.poNo);
                      const k2 = normalize(p.id);
                      if (k1) poMap.set(k1, p);
                      if (k2) poMap.set(k2, p);
                    });
                  }
                  diskPOs.forEach(d => {
                    const k1 = normalize(d.poNo);
                    const k2 = normalize(d.id);
                    const cloudItem = (k1 && poMap.get(k1)) || (k2 && poMap.get(k2)) || {};
                    const dRank = getPoStageRank(d);
                    const cloudRank = getPoStageRank(cloudItem);
                    const winner = dRank >= cloudRank ? d : cloudItem;
                    let effStatus = winner.status || d.status || cloudItem.status || 'Draft';
                    let effStatusType = winner.statusType || d.statusType || cloudItem.statusType || 'draft';
                    const effPaymentDetails = d.paymentDetails || cloudItem.paymentDetails;
                    const effProceedDetails = d.proceedDetails || cloudItem.proceedDetails;
                    if (effProceedDetails && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 4) {
                      effStatus = 'Proceed PO';
                      effStatusType = 'proceed_po';
                    } else if (effPaymentDetails && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 3) {
                      effStatus = 'Payment Processed';
                      effStatusType = 'payment_processed';
                    }
                    const effApprovedBy = d.approvedBy || cloudItem.approvedBy;
                    const effApprovalDate = d.approvalDate || cloudItem.approvalDate;
                    const effApprovalTime = d.approvalTime || cloudItem.approvalTime;
                    const effApprovalRemarks = d.approvalRemarks || cloudItem.approvalRemarks;

                    const mergedPO = {
                      ...cloudItem,
                      ...d,
                      status: effStatus,
                      statusType: effStatusType,
                      approvedBy: effApprovedBy,
                      approvalDate: effApprovalDate,
                      approvalTime: effApprovalTime,
                      approvalRemarks: effApprovalRemarks,
                      paymentDetails: effPaymentDetails,
                      proceedDetails: effProceedDetails,
                      vendor: (d.vendor && d.vendor !== 'Vendor' && d.vendor !== 'Annamalaiyar' && d.vendor !== 'Fresh Vendor') ? d.vendor : (cloudItem.vendor || d.vendor),
                      branch: d.branch || cloudItem.branch || '',
                      contactPerson: d.contactPerson || cloudItem.contactPerson || '',
                      gstNo: (d.gstNo && d.gstNo !== '—') ? d.gstNo : (cloudItem.gstNo || d.gstNo || ''),
                      deliveryAddress: (d.deliveryAddress && d.deliveryAddress !== '—' && d.deliveryAddress !== 'Tamil Nadu, India') ? d.deliveryAddress : (cloudItem.deliveryAddress || d.deliveryAddress || '—'),
                      billingAddress: (d.billingAddress && d.billingAddress !== '—') ? d.billingAddress : (cloudItem.billingAddress || d.billingAddress || '—'),
                      items: (Array.isArray(d.items) && d.items.length > 0) ? d.items : (cloudItem.items || []),
                      terms: (d.terms && d.terms.length > 50) ? d.terms : (cloudItem.terms || d.terms || ''),
                      notes: d.notes || cloudItem.notes || '',
                      amount: (d.amount && d.amount !== '₹0.00' && d.amount !== '₹ 0.00') ? d.amount : (cloudItem.amount || d.amount)
                    };
                    if (k1) poMap.set(k1, mergedPO);
                    if (k2) poMap.set(k2, mergedPO);
                    if (k3) poMap.set(k3, mergedPO);
                  });
                  const merged = Array.from(new Set(poMap.values()));
                  supabaseMemoryStore[key] = merged;
                  return merged;
                }
              } catch (_) {}
            }
          }
          if (key === 'grn_store') {
            const diskPath = getStoreFilePath('grn_store.json');
            if (fs.existsSync(diskPath)) {
              try {
                const diskGRNs = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
                if (Array.isArray(diskGRNs) && diskGRNs.length > 0) {
                  const grnMap = new Map();
                  diskGRNs.forEach(g => {
                    const id = g.id || g.grnNo;
                    if (id) grnMap.set(id, g);
                  });
                  if (Array.isArray(parsed)) {
                    parsed.forEach(p => {
                      const id = p.id || p.grnNo;
                      if (id) grnMap.set(id, { ...(grnMap.get(id) || {}), ...p });
                    });
                  }
                  const merged = Array.from(grnMap.values());
                  supabaseMemoryStore[key] = merged;
                  return merged;
                }
              } catch (_) {}
            }
          }
          if (key === 'raw_materials_store' || key === 'item_store') {
            const diskPath = getStoreFilePath(key + '.json');
            if (fs.existsSync(diskPath)) {
              try {
                const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
                if (Array.isArray(diskData) && diskData.length > (Array.isArray(parsed) ? parsed.length : 0)) {
                  const masterMap = new Map();
                  diskData.forEach(d => {
                    const k = String(d.code || d.name || '').toUpperCase().trim();
                    if (k) masterMap.set(k, { ...d });
                  });
                  if (Array.isArray(parsed)) {
                    parsed.forEach(p => {
                      const k = String(p.code || p.name || '').toUpperCase().trim();
                      if (k && masterMap.has(k)) {
                        masterMap.set(k, { ...masterMap.get(k), ...p });
                      } else if (k) {
                        masterMap.set(k, { ...p });
                      }
                    });
                  }
                  const merged = Array.from(masterMap.values());
                  merged.forEach(item => {
                    if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
                      item.cat = 'Raw Material';
                      item.category = 'Raw Material';
                    }
                  });
                  supabaseMemoryStore[key] = merged;
                  return merged;
                }
              } catch (_) {}
            }
          }
          if (key === 'raw_materials_store' || key === 'item_store') {
            if (Array.isArray(parsed)) {
              parsed.forEach(item => {
                if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
                  item.cat = 'Raw Material';
                  item.category = 'Raw Material';
                }
              });
            }
          }
          supabaseMemoryStore[key] = parsed;
          return parsed;
        } catch (e) {
          console.warn(`[getDatabaseStore parse warn for ${key}]:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error(`[getDatabaseStore Error for ${key}]:`, err?.message || err);
  }

  // Fallback to local JSON store file on disk
  const diskPath = getStoreFilePath(key + '.json');
  if (fs.existsSync(diskPath)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      supabaseMemoryStore[key] = diskData;
      return diskData;
    } catch (_) {}
  }

  return supabaseMemoryStore[key] || (key === 'presets_store' || key === 'company_branding_store' ? {} : []);
};

// ==========================================
// ⚡ REAL-TIME INSTANT PUSH ENGINE (SSE)
// Broadcasts updates to all connected users with sub-second latency (WhatsApp-style)
// ==========================================
const realtimeClients = new Set();
let sseSequenceId = 0;
const MAX_SSE_HISTORY = 120;
const sseEventHistory = [];

const broadcastRealtimeEvent = (eventType, payload = {}) => {
  if (!realtimeClients || realtimeClients.size === 0) return;

  const seq = ++sseSequenceId;
  const recordId = payload?.recordId || payload?.id || payload?.bomCode || payload?.piNo || payload?.leadId || payload?.bom?.bomCode || payload?.bom?.id || payload?.lead?.id || payload?.notification?.id || null;
  const action = payload?.action || (eventType.includes('delete') ? 'delete' : (eventType.includes('create') ? 'create' : 'update'));

  const eventObj = {
    seq,
    type: eventType,
    key: payload?.key || null,
    recordId,
    action,
    payload,
    timestamp: new Date().toISOString()
  };

  // Keep circular history buffer for missed event replays on client reconnect
  sseEventHistory.push(eventObj);
  if (sseEventHistory.length > MAX_SSE_HISTORY) {
    sseEventHistory.shift();
  }

  const msg = JSON.stringify(eventObj);
  const chunk = `id: ${seq}\nevent: message\ndata: ${msg}\n\n`;

  // Asynchronous non-blocking broadcast to avoid stalling Express event loop on slow client sockets
  setImmediate(() => {
    for (const client of realtimeClients) {
      try {
        if (!client.writableEnded && !client.destroyed) {
          // Socket backpressure protection: drop stalled clients accumulating excess buffer
          if (client.writableLength && client.writableLength > 256 * 1024) {
            console.warn('[SSE Backpressure] Dropping stalled slow client');
            realtimeClients.delete(client);
            client.end();
            continue;
          }
          client.write(chunk);
        } else {
          realtimeClients.delete(client);
        }
      } catch (_) {
        realtimeClients.delete(client);
      }
    }
  });
};

// Hook realtime broadcaster to CRM lead notifications for sub-second WhatsApp-style alerts
try {
  setRealtimeNotificationBroadcaster(broadcastRealtimeEvent);
} catch (_) {}

const saveLocalCustomers = async (customers) => {
  if (!customers) return;
  const incoming = Array.isArray(customers) ? customers : [customers];
  if (incoming.length === 0) return;

  // 1. Fetch current full database customers to merge against (ensuring existing records are NEVER lost)
  const currentDbCustomers = await loadDatabaseCustomers();
  const custMap = new Map();

  // Register existing database customers
  (currentDbCustomers || []).forEach(c => {
    const k = String(c.customerCode || c.id || c.code || '').toLowerCase().trim();
    if (k) custMap.set(k, c);
  });

  // Put incoming/updated records at the front so newest entries stay at index 0
  const fullListMap = new Map();
  const recordsToUpsert = [];
  incoming.forEach(c => {
    const k = String(c.customerCode || c.id || c.code || '').toLowerCase().trim();
    if (k) {
      const existing = custMap.get(k);
      const merged = { ...(existing || {}), ...c };
      fullListMap.set(k, merged);
      if (incoming.length <= 50 || !existing) {
        recordsToUpsert.push(merged);
      }
    }
  });
  custMap.forEach((v, k) => {
    if (!fullListMap.has(k)) fullListMap.set(k, v);
  });

  const fullList = Array.from(fullListMap.values());
  supabaseMemoryStore.customer_store = fullList;
  supabaseMemoryStore.crm_customers = fullList;

  // 2. Persist full list to disk files asynchronously for zero data loss
  try {
    const custPath = getStoreFilePath('customer_store.json');
    safeWriteJsonFileAsync(custPath, fullList);
    const crmPath = getStoreFilePath('crm_customers.json');
    safeWriteJsonFileAsync(crmPath, fullList);
  } catch (diskErr) {
    console.warn('[saveLocalCustomers disk write error]:', diskErr?.message);
  }

  // 3. Targeted upsert ONLY changed/new incoming records to canonical public.customers (Rule 2 & Rule 3)
  if (recordsToUpsert.length > 0) {
    try {
      const rows = recordsToUpsert.map(c => ({
        id: c.customerCode || c.id || c.code,
        customer_code: c.customerCode || c.id || c.code,
        company_name: c.companyName || c.c2 || c.customerName || 'Customer',
        customer_name: c.customerName || c.c3 || c.companyName || 'Customer',
        customer_type: c.customerType || 'Customer',
        industry: c.industry || 'Solar Energy / Infrastructure',
        gst_number: c.gstNumber || c.gstNo || '—',
        pan_number: c.panNumber || '—',
        billing_address: c.billingAddress || c.c6 || c.address || '',
        city: c.city || (c.billingAddressObj && c.billingAddressObj.city) || '',
        state: c.state || (c.billingAddressObj && c.billingAddressObj.state) || '',
        pincode: c.pincode || (c.billingAddressObj && c.billingAddressObj.pincode) || '',
        billing_address_obj: c.billingAddressObj || {},
        dispatch_address: c.dispatchAddress || c.c7 || c.deliveryAddress || '',
        dispatch_city: c.dispatchCity || (c.deliveryAddressObj && c.deliveryAddressObj.city) || '',
        dispatch_state: c.dispatchState || (c.deliveryAddressObj && c.deliveryAddressObj.state) || '',
        dispatch_pincode: c.dispatchPincode || c.dispatch_pincode || (c.deliveryAddressObj && c.deliveryAddressObj.pincode) || '',
        delivery_address_obj: c.deliveryAddressObj || {},
        same_as_billing: Boolean(c.sameAsBilling),
        credit_limit: parseSafeNumber(c.creditLimit, 0),
        credit_days: Math.trunc(parseSafeNumber(c.creditDays, 0)),
        payment_terms: c.paymentTerms || 'Due on Receipt',
        assigned_salesperson: c.assignedSalesperson || c.salesPerson || c.c8 || 'Sales Rep',
        source: c.source || 'Manual',
        primary_contact: c.primaryContact || {},
        email: c.email || c.c5 || '—',
        phone: c.phone || c.c4 || '—',
        status: (c.status || 'Active').toUpperCase(),
        notes: c.notes || '',
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        await supabase.from('customers').upsert(batch, { onConflict: 'customer_code' });
      }
    } catch (sbErr) {
      console.warn('[saveLocalCustomers Supabase upsert notice]:', sbErr?.message || sbErr);
    }
  }

  // 4. Broadcast via SSE to all connected clients (lightweight targeted event)
  try {
    const primary = incoming[0];
    const recordId = primary?.customerCode || primary?.id || primary?.code;
    broadcastRealtimeEvent('crm_updated', {
      type: 'customer_updated',
      action: 'update',
      recordId,
      customer: primary,
      count: incoming.length
    });
  } catch (_) {}
};

const saveLocalOpportunities = async (opportunities) => {
  if (!opportunities) return;
  const list = Array.isArray(opportunities) ? opportunities : [opportunities];
  supabaseMemoryStore.crm_opportunities = list;
  supabaseMemoryStore.opportunities = list;

  // 1. Persist to disk file for zero data loss
  try {
    const oppPath = getStoreFilePath('crm_opportunities.json');
    fs.writeFileSync(oppPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (diskErr) {
    console.warn('[saveLocalOpportunities disk write error]:', diskErr?.message);
  }

  // 2. Broadcast via SSE to all connected clients (lightweight targeted event)
  try {
    const primary = list[0];
    broadcastRealtimeEvent('crm_updated', {
      type: 'opportunities_updated',
      action: 'update',
      recordId: primary?.id || primary?.opportunityId,
      opportunity: primary,
      count: list.length
    });
  } catch (_) {}

  // 3. Upsert to canonical public.opportunities table (Zero leaves table interaction)
  try {
    const rows = list.map(item => {
      const id = item.id || item.oppNumber || `OPP-${Date.now()}`;
      const customerId = item.customerId || item.customer_id || null;
      const companyName = item.companyName || item.company_name || 'Prospect';
      const title = item.title || `${companyName} Opportunity`;
      const dealValue = Number(item.dealValue || item.deal_value || 0);
      const stage = item.stage || 'Qualification';
      const probability = Number(item.probability !== undefined && item.probability !== null ? item.probability : 20);
      const assignedSalesperson = item.assignedSalesperson || item.assigned_salesperson || 'Sales Team';
      const targetCloseDate = item.targetCloseDate || item.target_close_date || null;
      const createdAt = item.createdAt || item.created_at || new Date().toISOString();
      const updatedAt = new Date().toISOString();

      const extraMetadata = { ...item, _userNotes: item.notes || '' };
      delete extraMetadata.id;
      delete extraMetadata.customerId;
      delete extraMetadata.companyName;
      delete extraMetadata.title;
      delete extraMetadata.dealValue;
      delete extraMetadata.stage;
      delete extraMetadata.probability;
      delete extraMetadata.assignedSalesperson;
      delete extraMetadata.targetCloseDate;

      return {
        id,
        customer_id: customerId,
        company_name: companyName,
        title,
        deal_value: dealValue,
        stage,
        probability,
        assigned_salesperson: assignedSalesperson,
        target_close_date: targetCloseDate,
        notes: JSON.stringify(extraMetadata),
        created_at: createdAt,
        updated_at: updatedAt
      };
    });

    for (let i = 0; i < rows.length; i += 20) {
      const batch = rows.slice(i, i + 20);
      await supabase.from('opportunities').upsert(batch, { onConflict: 'id' });
    }
  } catch (sbErr) {
    console.warn('[saveLocalOpportunities Supabase upsert notice]:', sbErr?.message || sbErr);
  }
};

const saveLocalLeads = async (leadsData) => {
  if (!leadsData) return;
  const list = Array.isArray(leadsData) ? leadsData : [leadsData];
  supabaseMemoryStore.crm_leads = list;
  supabaseMemoryStore.leads = list;

  // 1. Persist immediately to disk file for zero data loss
  try {
    const diskPath = getStoreFilePath('crm_leads.json');
    fs.writeFileSync(diskPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (diskErr) {
    console.warn('[saveLocalLeads disk write error]:', diskErr?.message);
  }

  // 2. Broadcast via SSE to all connected clients (lightweight targeted event)
  try {
    const primary = list[0];
    broadcastRealtimeEvent('crm_updated', {
      type: 'leads_updated',
      action: 'update',
      recordId: primary?.id || primary?.leadNumber,
      lead: primary,
      count: list.length
    });
  } catch (_) {}

  // 3. Upsert to Supabase leads table / leaves store
  try {
    const rows = list.map(item => {
      const id = item.id || `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const leadNumber = item.leadNumber || id;
      const companyName = item.companyName || '';
      const contactPerson = item.contactPerson || '';
      const phone = item.phone || '';
      const email = item.email || '';
      const location = item.location || '';
      const source = item.source || 'Direct';
      const status = item.status || 'New Lead';
      const priority = item.priority || 'MEDIUM';
      const assignedSalesperson = item.assignedSalesperson || 'Sales Rep';
      const estimatedKw = Number(item.estimatedKw || 0);
      const category = item.category || 'Aluminium Mounting Structures';
      const estimatedValue = Number(item.estimatedValue || 0);
      const createdAt = item.createdAt || new Date().toISOString();
      const updatedAt = new Date().toISOString();

      const extraMetadata = { ...item, _userNotes: item.notes || '' };

      return {
        id,
        lead_number: leadNumber,
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        location,
        source,
        status,
        priority,
        assigned_salesperson: assignedSalesperson,
        estimated_kw: estimatedKw,
        category,
        estimated_value: estimatedValue,
        notes: JSON.stringify(extraMetadata),
        created_at: createdAt,
        updated_at: updatedAt
      };
    });

    const { error } = await supabase.from('leads').upsert(rows, { onConflict: 'id' });
    if (error) {
      await supabase.from('leaves').upsert({
        employee: 'CRM_LEADS',
        reason: JSON.stringify(list),
        status: 'active',
        dates: new Date().toISOString(),
        duration: String(list.length),
        type: 'Store'
      }, { onConflict: 'employee' });
    }
  } catch (sbErr) {
    try {
      await supabase.from('leaves').upsert({
        employee: 'CRM_LEADS',
        reason: JSON.stringify(list),
        status: 'active',
        dates: new Date().toISOString(),
        duration: String(list.length),
        type: 'Store'
      }, { onConflict: 'employee' });
    } catch (_) {}
  }
  return list;
};

const saveDatabaseStore = async (key, storeData) => {
  if (storeData === undefined || storeData === null) return storeData;
  const cleanKey = String(key || '').toLowerCase();
  if (cleanKey === 'customer_store' || cleanKey === 'crm_customers') {
    await saveLocalCustomers(storeData);
    return storeData;
  }
  if (cleanKey === 'crm_opportunities' || cleanKey === 'opportunities') {
    await saveLocalOpportunities(storeData);
    return storeData;
  }
  if (cleanKey === 'crm_leads' || cleanKey === 'leads') {
    await saveLocalLeads(storeData);
    return storeData;
  }
  if (cleanKey === 'bom_store' || cleanKey === 'boms') {
    await saveLocalBoms(storeData);
    return storeData;
  }
  if (cleanKey === 'leaves') {
    // Route directly to relational public.leaves table (Phase 9I & 9R zero-JSONB-bloat policy)
    const rows = Array.isArray(storeData) ? storeData : [storeData];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const emp = String(row.employee || row.empCode || row.code || '').trim().toUpperCase();
      if (!emp) continue;

      // Isolate legacy store synchronization: ignore non-leave records or legacy store markers
      if (row.type === 'Store' || ['BOM_STORE', 'INVOICE_STORE', 'BOM_SEQUENCE'].includes(emp)) {
        continue;
      }

      const reasonStr = typeof row.reason === 'object' ? JSON.stringify(row.reason) : String(row.reason || '');
      const status = row.status || 'active';
      const duration = String(row.duration || '1');
      const type = row.type || 'Casual';
      const dates = row.dates || new Date().toISOString();
      const rowId = row.id ? parseInt(row.id, 10) : null;

      // Stable record identity: only UPDATE when verified row.id is provided; otherwise INSERT to preserve history
      if (rowId && !isNaN(rowId) && rowId > 0) {
        await query(
          'UPDATE public.leaves SET reason = $1, status = $2, duration = $3, type = $4, dates = $5, employee = $6 WHERE id = $7',
          [reasonStr, status, duration, type, dates, emp, rowId]
        );
      } else {
        await query(
          'INSERT INTO public.leaves (employee, reason, status, duration, type, dates) VALUES ($1, $2, $3, $4, $5, $6)',
          [emp, reasonStr, status, duration, type, dates]
        );
      }
    }
    return storeData;
  }
  // 1. Validate input
  if (!key || typeof key !== 'string') {
    throw new Error('[Validation Error] Invalid store key provided to saveDatabaseStore');
  }

  // 2. Validate database connection: database-disconnected conditions return genuine errors
  if (!isDbConnected()) {
    throw new Error(`[Database Disconnected] PostgreSQL database is not connected. Cannot persist store "${cleanKey}".`);
  }

  // 3. Persist directly to authoritative PostgreSQL database on VPS first
  // Reuse single stringified payload to avoid redundant serialization and memory spikes (Phase 9R Issue 5)
  const jsonPayload = typeof storeData === 'string' ? storeData : JSON.stringify(storeData);
  if (jsonPayload.length > 250 * 1024 * 1024) {
    throw new Error(`[Oversized JSONB Payload] Store "${cleanKey}" payload (${(jsonPayload.length / (1024 * 1024)).toFixed(1)} MB) exceeds PostgreSQL JSONB safe limit (250 MB).`);
  }

  try {
    await query(`
      INSERT INTO controlroom_store (key, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()
    `, [cleanKey, jsonPayload]);
  } catch (pgErr) {
    console.error(`[saveDatabaseStore PostgreSQL write error for ${cleanKey}]:`, pgErr?.message || pgErr);
    throw pgErr; // Never silently swallow database write errors; propagate to trigger HTTP 500
  }

  // 4. Update memory and application cache ONLY after successful PostgreSQL write
  supabaseMemoryStore[cleanKey] = storeData;
  if (key !== cleanKey && supabaseMemoryStore[key] !== undefined) {
    delete supabaseMemoryStore[key];
  }

  // 5. Asynchronous, non-blocking JSON backup for local recovery (post-commit)
  // Passes pre-computed jsonPayload directly without re-stringifying storeData
  setImmediate(() => {
    try {
      if (cleanKey === 'raw_materials_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('raw_materials_store.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'item_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('item_store.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'vendor_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('vendor_store.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'po_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('po_store.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'grn_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('grn_store.json'), jsonPayload).catch(() => {});
      } else if ((cleanKey === 'workorder_store' || cleanKey === 'vrm_prod_workorders') && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('workorder_store.json'), jsonPayload).catch(() => {});
        fs.promises.writeFile(getStoreFilePath('vrm_prod_workorders.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'employees_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('employees_store.json'), jsonPayload).catch(() => {});
      } else if (cleanKey === 'invoice_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('invoice_store.json'), jsonPayload).catch(() => {});
      }
    } catch (_) {}
  });

  // 6. Broadcast realtime events ONLY after successful database persistence (lightweight targeted events)
  try {
    if (cleanKey === 'notifications_store') {
      const latestNotif = Array.isArray(storeData) ? storeData[0] : storeData;
      if (latestNotif && latestNotif.id !== 'NOTIF-001' && !String(latestNotif.title || '').includes('System Central Inventory Initialized')) {
        broadcastRealtimeEvent('workflow_notification', {
          action: 'create',
          recordId: latestNotif.id,
          notification: latestNotif
        });
      }
    } else if (cleanKey === 'bom_store') {
      const primary = Array.isArray(storeData) ? storeData[0] : storeData;
      const recordId = primary?.bomCode || primary?.code || primary?.id;
      broadcastRealtimeEvent('bom_updated', {
        action: 'update',
        recordId,
        bom: primary
      });
    } else if (cleanKey === 'raw_materials_store') {
      const primary = Array.isArray(storeData) ? storeData[0] : storeData;
      broadcastRealtimeEvent('inventory_updated', {
        action: 'update',
        recordId: primary?.code || primary?.id,
        item: primary,
        count: Array.isArray(storeData) ? storeData.length : 1
      });
    } else if (cleanKey === 'item_store' || cleanKey === 'vrm_prod_inventory') {
      const primary = Array.isArray(storeData) ? storeData[0] : storeData;
      broadcastRealtimeEvent('item_store_updated', {
        action: 'update',
        recordId: primary?.code || primary?.id,
        item: primary,
        count: Array.isArray(storeData) ? storeData.length : 1
      });
    } else if (cleanKey === 'vendor_store') {
      const primary = Array.isArray(storeData) ? storeData[0] : storeData;
      broadcastRealtimeEvent('vendor_store_updated', {
        action: 'update',
        recordId: primary?.vendorCode || primary?.id,
        vendor: primary
      });
    } else {
      const primary = Array.isArray(storeData) ? storeData[0] : (storeData?.data && Array.isArray(storeData.data) ? storeData.data[0] : storeData);
      broadcastRealtimeEvent('store_updated', {
        key,
        action: storeData?.action || 'update',
        recordId: primary?.id || primary?.code || primary?.recordId || storeData?.recordId || null,
        count: Array.isArray(storeData) ? storeData.length : (Array.isArray(storeData?.data) ? storeData.data.length : 1)
      });
    }
  } catch (_) {}

  // STRICT Phase 3: Authoritative persistence is PostgreSQL controlroom_store.
  // Eliminate legacy public.leaves writes permanently (saves 200-500ms network latency and egress).
  return storeData;
};

// Aliases for seamless backward compatibility
const syncStoreWithSupabase = async (key) => getDatabaseStore(key);
const pushStoreToSupabase = async (key, storeData) => saveDatabaseStore(key, storeData);

// Helpers for Production Work Orders Database store
const isLegacyWoId = (id) => {
  if (!id) return false;
  const s = String(id).trim().toUpperCase();
  if (/^WO-\d+$/i.test(s)) return true;
  if (s.startsWith('WO-') && !s.startsWith('VRM-WO-')) return true;
  return s === 'WO-01' || s === 'WO-02' || s === 'WO-1' || s === 'WO-2';
};

// Helpers for Production Work Orders Database store
const loadLocalWorkOrders = () => {
  if (supabaseMemoryStore['vrm_prod_workorders'] && Array.isArray(supabaseMemoryStore['vrm_prod_workorders'])) {
    const clean = supabaseMemoryStore['vrm_prod_workorders'].filter(o => !isLegacyWoId(o?.workOrderNo || o?.id));
    if (clean.length > 0) return clean;
  }
  if (supabaseMemoryStore['workorder_store'] && Array.isArray(supabaseMemoryStore['workorder_store'])) {
    const clean = supabaseMemoryStore['workorder_store'].filter(o => !isLegacyWoId(o?.workOrderNo || o?.id));
    if (clean.length > 0) return clean;
  }
  const diskPath = getStoreFilePath('vrm_prod_workorders.json');
  if (fs.existsSync(diskPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(data)) {
        const clean = data.filter(o => !isLegacyWoId(o?.workOrderNo || o?.id));
        supabaseMemoryStore['vrm_prod_workorders'] = clean;
        return clean;
      }
    } catch (_) {}
  }
  const diskPath2 = getStoreFilePath('workorder_store.json');
  if (fs.existsSync(diskPath2)) {
    try {
      const data = JSON.parse(fs.readFileSync(diskPath2, 'utf8'));
      if (Array.isArray(data)) {
        const clean = data.filter(o => !isLegacyWoId(o?.workOrderNo || o?.id));
        supabaseMemoryStore['workorder_store'] = clean;
        return clean;
      }
    } catch (_) {}
  }
  return [];
};

const saveLocalWorkOrders = (orders) => {
  supabaseMemoryStore['workorder_store'] = orders;
  supabaseMemoryStore['vrm_prod_workorders'] = orders;
  saveDatabaseStore('workorder_store', orders);
  saveDatabaseStore('vrm_prod_workorders', orders);
  try {
    fs.writeFileSync(getStoreFilePath('vrm_prod_workorders.json'), JSON.stringify(orders, null, 2), 'utf8');
    fs.writeFileSync(getStoreFilePath('workorder_store.json'), JSON.stringify(orders, null, 2), 'utf8');
  } catch (_) {}
};

// Authoritative Boot Sync from Supabase Cloud Database
(async () => {
  try {
    const keys = [
      'po_store', 'vendor_store', 'item_store', 'grn_store',
      'bom_store', 'employees_store', 'invoice_store', 'company_branding_store',
      'workorder_store', 'customer_store', 'raw_materials_store',
      'sales_pi_store', 'proforma_invoice_store', 'payment_store',
      'crm_leads', 'crm_customers', 'crm_opportunities', 'crm_quotations',
      'crm_whatsapp_conversations', 'quotations_store', 'presets_store',
      'vrm_prod_workorders', 'vrm_prod_inventory', 'vrm_prod_recipes', 'vrm_prod_ledger'
    ];
    await Promise.all(keys.map(k => getDatabaseStore(k)));
    console.log('[SUPABASE DATABASE ENGINE] All stores successfully loaded from cloud database on server boot');
  } catch (err) {
    console.error('[SUPABASE BOOT NOTICE]', err.message);
  }
})();

const app = express();
const PORT = process.env.PORT || 5001;

// 🛡️ SECURITY FIREWALL & MIDDLEWARE ENFORCEMENT
// 1. Helmet HTTP Security Headers (XSS, Anti-Clickjacking, CSP protection)
app.use(helmet({
  contentSecurityPolicy: false, // Allowed for dev Vite bundles
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Rate Limiting Firewall against DDoS & Brute Force Attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 50000, // High capacity for active real-time ERP sync
  skip: (req) => {
    // Whitelist local and intranet loopback connections
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.hostname === 'localhost';
  },
  message: { error: 'Security Firewall Triggered: Too many requests from this IP address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 3. HttpOnly Secure Cookie Parser
app.use(cookieParser());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-file-name',
    'X-File-Name',
    'x-session-id',
    'X-Session-Id',
    'x-emp-code',
    'X-Emp-Code',
    'x-employee-code',
    'x-user-name',
    'x-user-role',
    'x-admin-key'
  ]
}));

// 3a. Async GZIP Response Compression for JSON and text payloads > 1KB (non-blocking event loop)
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();
  if (req.path === '/api/realtime-events' || req.path.startsWith('/assets/')) return next(); // Never buffer SSE streams; static assets use pre-cached gzip

  const origSend = res.send;
  res.send = function (body) {
    if (res.getHeader('content-encoding') || res.headersSent) {
      return origSend.call(this, body);
    }
    let payload = body;
    if (typeof body === 'object' && !(body instanceof Buffer)) {
      payload = JSON.stringify(body);
      if (!res.getHeader('content-type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
    }
    if (typeof payload === 'string' && payload.length > 1024) {
      const rawBuf = Buffer.from(payload, 'utf-8');
      zlib.gzip(rawBuf, { level: zlib.constants.Z_BEST_SPEED }, (err, compressed) => {
        if (res.headersSent) return;
        if (err || !compressed) {
          return origSend.call(this, payload);
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', compressed.length);
        return origSend.call(this, compressed);
      });
      return this;
    }
    return origSend.call(this, body);
  };
  next();
});

// 3b. Route-aware request-size enforcement: enforce 15 MB strictly for /api/store before global body parsers (Phase 9R Issue 2)
// Protects against oversized Content-Length as well as streaming chunked transfer encoding without Content-Length
const STORE_PAYLOAD_LIMIT_BYTES = 15 * 1024 * 1024; // 15 MB
const storeJsonParser = express.json({ limit: STORE_PAYLOAD_LIMIT_BYTES });
const storeUrlencodedParser = express.urlencoded({ limit: STORE_PAYLOAD_LIMIT_BYTES, extended: true });

app.use('/api/store', (req, res, next) => {
  // 1. Early rejection for oversized Content-Length header
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > STORE_PAYLOAD_LIMIT_BYTES) {
    return res.status(413).json({
      success: false,
      error: '[Payload Too Large] Payload size exceeds 15 MB store limit. Document attachments must use media storage.'
    });
  }

  // 2. Stream-level size enforcement for chunked transfer encoding and streaming body parsing
  const isFormUrlencoded = String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
  const parser = isFormUrlencoded ? storeUrlencodedParser : storeJsonParser;
  parser(req, res, (err) => {
    if (err) {
      if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
          success: false,
          error: '[Payload Too Large] Payload size exceeds 15 MB store limit. Document attachments must use media storage.'
        });
      }
      return next(err);
    }
    next();
  });
});

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// 🔒 CONTROLLED MAINTENANCE WINDOW: WRITE-BLOCKING MIDDLEWARE & REST SECURITY
// Synchronize maintenance mode state from disk flag on startup so protection survives PM2 reload/restart
global.__BUSINZ_MAINTENANCE_MODE = isMaintenanceModeActive();
if (global.__BUSINZ_MAINTENANCE_MODE) {
  console.log('🔒 [Maintenance Mode] Authoritative maintenance flag detected. Starting in PROTECTED MAINTENANCE MODE.');
}

// 1. General API & Static write-blocking middleware
app.use((req, res, next) => {
  if (isMaintenanceModeActive()) {
    // Whitelist read-only operations, static assets, and health/maintenance endpoints
    const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const isMaintenanceEndpoint = req.path.startsWith('/api/maintenance') || req.path === '/api/health';
    if (isReadOnly || isMaintenanceEndpoint) {
      return next();
    }
    // Block mutating requests (POST, PUT, PATCH, DELETE) with HTTP 503
    res.setHeader('Retry-After', '30');
    return res.status(503).json({
      success: false,
      error: 'System is temporarily in read-only maintenance mode for deployment data protection.',
      maintenance: true,
      retryAfter: 30
    });
  }
  next();
});

// 2. Specific PostgREST legacy /rest/v1 write-blocking guard
app.use('/rest/v1', (req, res, next) => {
  if (isMaintenanceModeActive()) {
    const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (!isReadOnly) {
      res.setHeader('Retry-After', '30');
      return res.status(503).json({
        message: 'Service temporarily in maintenance mode for data protection',
        code: '503'
      });
    }
  }
  next();
});

// Maintenance window status & control endpoints
app.get('/api/maintenance/status', (req, res) => {
  res.json({
    success: true,
    maintenance: isMaintenanceModeActive(),
    externalStorage: isExternalStorageActive(),
    dataDir: getDataDir(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/maintenance/toggle', async (req, res) => {
  const { enabled, secret } = req.body || {};
  const headerKey = req.headers['x-maintenance-key'] || (!isOptimizationTestMode() ? req.headers['x-admin-key'] : null);
  const providedKey = (typeof secret === 'string' && secret.trim().length > 0)
    ? secret.trim()
    : ((typeof headerKey === 'string' && headerKey.trim().length > 0) ? headerKey.trim() : null);

  let isAuthorized = false;
  let authMethod = '';

  // 1. Check deployment environment key (BUSINZ_MAINTENANCE_KEY or BUSINZ_ADMIN_SECRET or SUPABASE_SERVICE_ROLE_KEY)
  const envKey = !isOptimizationTestMode()
    ? (process.env.BUSINZ_MAINTENANCE_KEY || process.env.BUSINZ_ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : process.env.BUSINZ_MAINTENANCE_KEY;
  if (providedKey && envKey && providedKey === envKey) {
    isAuthorized = true;
    authMethod = 'deployment-env-key';
  }

  // 2. Check token from authoritative maintenance.flag file
  if (!isAuthorized && providedKey) {
    try {
      const flagPath = getMaintenanceFlagPath();
      if (fs.existsSync(flagPath)) {
        const flagRaw = fs.readFileSync(flagPath, 'utf8');
        const flagJson = JSON.parse(flagRaw);
        if (flagJson?.token && typeof flagJson.token === 'string' && flagJson.token.length >= 16 && flagJson.token === providedKey) {
          isAuthorized = true;
          authMethod = 'flag-token';
        }
      }
    } catch (_) {}
  }

  // 3. Check for authenticated administrative user session
  if (!isAuthorized) {
    try {
      const session = await getVerifiedUserSession(req);
      if (session && session.valid && ['Technical Administrator', 'Super Admin', 'Director', 'CEO', 'Admin'].includes(session.role)) {
        isAuthorized = true;
        authMethod = `admin-session (${session.user || session.empCode})`;
      }
    } catch (_) {}
  }

  // Strictly reject unauthorized requests (missing secret, incorrect secret, or unauthenticated session)
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Valid deployment key or administrative session required to toggle maintenance mode'
    });
  }

  const shouldEnable = Boolean(enabled);
  global.__BUSINZ_MAINTENANCE_MODE = shouldEnable;
  const flagPath = getMaintenanceFlagPath();

  if (shouldEnable) {
    try {
      const flagData = {
        active: true,
        activatedAt: new Date().toISOString(),
        authMethod,
        token: (providedKey && typeof providedKey === 'string' && providedKey.length >= 16) ? providedKey : undefined
      };
      fs.writeFileSync(flagPath, JSON.stringify(flagData, null, 2), 'utf8');
      try { fs.chmodSync(flagPath, 0o600); } catch (_) {}
    } catch (writeErr) {
      console.warn('[Maintenance Flag Warning]: Failed to persist flag file:', writeErr.message);
    }
    console.log(`🔒 [Maintenance Mode] Activated by ${authMethod}. Authoritative flag persisted at ${flagPath}.`);
  } else {
    try {
      if (fs.existsSync(flagPath)) {
        fs.unlinkSync(flagPath);
      }
      const rootFlag = path.resolve(process.cwd(), 'maintenance.flag');
      if (fs.existsSync(rootFlag)) {
        fs.unlinkSync(rootFlag);
      }
      const srvFlag = path.resolve(__dirname, 'maintenance.flag');
      if (fs.existsSync(srvFlag)) {
        fs.unlinkSync(srvFlag);
      }
    } catch (unlinkErr) {
      console.warn('[Maintenance Flag Warning]: Failed to remove flag file:', unlinkErr.message);
    }
    console.log(`🔓 [Maintenance Mode] Deactivated by ${authMethod}. Authoritative flag removed.`);
  }

  res.json({
    success: true,
    maintenance: isMaintenanceModeActive(),
    authMethod,
    timestamp: new Date().toISOString()
  });
});

// 📁 STATIC MEDIA UPLOADS & STREAMING DIRECTORY (Supports byte-range video streaming)
const uploadsDir = getUploadsDir();
const bomDocsDir = getBomDocumentsDir();
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(bomDocsDir)) {
    fs.mkdirSync(bomDocsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Uploads Directory Warning]:', err.message);
}
app.use('/uploads/bom-documents', express.static(bomDocsDir, { acceptRanges: true }));
app.use('/api/uploads/bom-documents', express.static(bomDocsDir, { acceptRanges: true }));
app.use('/uploads', express.static(uploadsDir, { acceptRanges: true }));
app.use('/api/uploads', express.static(uploadsDir, { acceptRanges: true }));

// 🎥 MEDIA UPLOAD API (High-performance streaming binary upload for large videos)
import createMediaRouter from './routes/mediaRoutes.js';
app.use(createMediaRouter({ uploadsDir }));


import createTallyRouter from './routes/tallyRoutes.js';
app.use(createTallyRouter());

// Local Store file helpers
const loadLocalPOs = () => {
  let memPOs = [];
  if (supabaseMemoryStore.po_store && Array.isArray(supabaseMemoryStore.po_store) && supabaseMemoryStore.po_store.length > 0) {
    memPOs = supabaseMemoryStore.po_store;
  }
  
  // Also check disk po_store.json and merge seamlessly
  try {
    const diskPath = getStoreFilePath('po_store.json');
    if (fs.existsSync(diskPath)) {
      const diskPOs = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskPOs) && diskPOs.length > 0) {
        const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const map = new Map();
        // Index in-memory POs first
        memPOs.forEach(p => {
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          if (k1) map.set(k1, p);
          if (k2) map.set(k2, p);
        });
        // Merge with diskPOs (disk has the authoritative local edits)
        diskPOs.forEach(d => {
          const k1 = normalize(d.poNo);
          const k2 = normalize(d.id);
          const existing = (k1 && map.get(k1)) || (k2 && map.get(k2)) || {};
          const items = (Array.isArray(d.items) && d.items.length > 0) ? d.items : (existing.items || []);

          const dOrd = Number(d.totalOrderedQty || 0);
          const dRec = Number(d.totalReceivedQty || d.totalReceived || 0);
          const exOrd = Number(existing.totalOrderedQty || 0);
          const exRec = Number(existing.totalReceivedQty || existing.totalReceived || 0);

          const dRank = getPoStageRank(d);
          const exRank = getPoStageRank(existing);
          const winner = dRank >= exRank ? d : existing;

          let effStatus = winner.status || d.status || existing.status || 'Draft';
          let effStatusType = winner.statusType || d.statusType || existing.statusType || 'draft';

          if (dOrd > 0 && dRec > 0 && dRec < dOrd) {
            effStatus = 'OPEN / PARTIALLY RECEIVED';
            effStatusType = 'partially_received';
          } else if (exOrd > 0 && exRec > 0 && exRec < exOrd) {
            effStatus = 'OPEN / PARTIALLY RECEIVED';
            effStatusType = 'partially_received';
          }

          const effApprovedBy = d.approvedBy || existing.approvedBy;
          const effApprovalDate = d.approvalDate || existing.approvalDate;
          const effApprovalTime = d.approvalTime || existing.approvalTime;
          const effApprovalRemarks = d.approvalRemarks || existing.approvalRemarks;
          const effPaymentDetails = d.paymentDetails || existing.paymentDetails;
          const effProceedDetails = d.proceedDetails || existing.proceedDetails;

          if (effProceedDetails && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 4) {
            effStatus = 'Proceed PO';
            effStatusType = 'proceed_po';
          } else if (effPaymentDetails && getPoStageRank({ status: effStatus, statusType: effStatusType }) < 3) {
            effStatus = 'Payment Processed';
            effStatusType = 'payment_processed';
          }

          const effTotalOrdered = d.totalOrderedQty !== undefined ? d.totalOrderedQty : existing.totalOrderedQty;
          const effTotalReceived = d.totalReceivedQty !== undefined ? d.totalReceivedQty : existing.totalReceivedQty;
          const effTotalRemaining = d.totalRemainingQty !== undefined ? d.totalRemainingQty : existing.totalRemainingQty;
          const effGrnCount = d.grnCount !== undefined ? d.grnCount : existing.grnCount;

          const mergedItem = {
            ...existing,
            ...d,
            status: effStatus,
            statusType: effStatusType,
            paymentDetails: effPaymentDetails,
            proceedDetails: effProceedDetails,
            totalOrderedQty: effTotalOrdered,
            totalReceivedQty: effTotalReceived,
            totalRemainingQty: effTotalRemaining,
            grnCount: effGrnCount,
            totalReceived: effTotalReceived,
            approvedBy: effApprovedBy,
            approvalDate: effApprovalDate,
            approvalTime: effApprovalTime,
            approvalRemarks: effApprovalRemarks,
            paymentDetails: effPaymentDetails,
            proceedDetails: effProceedDetails,
            vendor: (d.vendor && d.vendor !== 'Vendor' && d.vendor !== 'Annamalaiyar' && d.vendor !== 'Fresh Vendor') ? d.vendor : (existing.vendor || d.vendor),
            deliveryAddress: (d.deliveryAddress && d.deliveryAddress !== '—' && d.deliveryAddress !== 'Tamil Nadu, India') ? d.deliveryAddress : (existing.deliveryAddress || d.deliveryAddress || '—'),
            billingAddress: (d.billingAddress && d.billingAddress !== '—') ? d.billingAddress : (existing.billingAddress || d.billingAddress || '—'),
            branch: d.branch || existing.branch || '',
            contactPerson: d.contactPerson || existing.contactPerson || '',
            gstNo: (d.gstNo && d.gstNo !== '—') ? d.gstNo : (existing.gstNo || d.gstNo || ''),
            terms: (d.terms && d.terms.length > 50) ? d.terms : (existing.terms || d.terms || ''),
            notes: d.notes || existing.notes || '',
            amount: (d.amount && d.amount !== '₹0.00' && d.amount !== '₹ 0.00') ? d.amount : (existing.amount || d.amount),
            items
          };
          if (k1) map.set(k1, mergedItem);
          if (k2) map.set(k2, mergedItem);
        });
        // Also ensure any existing in-memory/cloud POs not on disk are in the map
        memPOs.forEach(p => {
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          if (k1 && !map.has(k1)) map.set(k1, p);
          if (k2 && !map.has(k2)) map.set(k2, p);
        });
        const merged = Array.from(new Set(map.values()));
        supabaseMemoryStore.po_store = merged;
        return merged;
      }
    }
  } catch (_) {}

  return memPOs;
};

const saveLocalPOs = (pos) => {
  supabaseMemoryStore.po_store = pos;
  try {
    const diskPath = getStoreFilePath('po_store.json');
    fs.writeFileSync(diskPath, JSON.stringify(pos, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to write po_store.json to disk:', err.message);
  }
  saveDatabaseStore('po_store', pos);
};

const getNextVendorSequence = (existingVendors) => {
  let highest = 100;
  if (Array.isArray(existingVendors)) {
    for (const v of existingVendors) {
      const match = String(v.code || v.id || '').match(/VEND-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > highest) highest = n;
      }
    }
  }
  return highest;
};

const repairDuplicateVendorCodes = (vendors) => {
  if (!Array.isArray(vendors) || vendors.length === 0) return vendors;
  const seenCodes = new Set();
  let highestSeq = getNextVendorSequence(vendors);
  let changed = false;

  const repaired = vendors.map(v => {
    const rawCode = String(v.code || v.id || '').trim().toUpperCase();
    if (!rawCode || seenCodes.has(rawCode)) {
      highestSeq++;
      const newCode = `VEND-${highestSeq}`;
      changed = true;
      seenCodes.add(newCode.toUpperCase());
      return {
        ...v,
        id: (v.id && !seenCodes.has(String(v.id).toUpperCase())) ? v.id : newCode,
        code: newCode
      };
    }
    seenCodes.add(rawCode);
    return v;
  });

  if (changed) {
    try {
      const p = getStoreFilePath('vendor_store.json');
      fs.writeFileSync(p, JSON.stringify(repaired, null, 2), 'utf8');
      saveDatabaseStore('vendor_store', repaired);
    } catch (_) {}
  }
  return repaired;
};

const loadLocalVendors = () => {
  if (supabaseMemoryStore.vendor_store && Array.isArray(supabaseMemoryStore.vendor_store) && supabaseMemoryStore.vendor_store.length > 0) {
    return repairDuplicateVendorCodes(supabaseMemoryStore.vendor_store);
  }
  try {
    const p = getStoreFilePath('vendor_store.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        const fixed = repairDuplicateVendorCodes(data);
        supabaseMemoryStore.vendor_store = fixed;
        return fixed;
      }
    }
  } catch (_) {}
  return [];
};

const saveLocalVendors = (vendors) => {
  supabaseMemoryStore.vendor_store = vendors;
  saveDatabaseStore('vendor_store', vendors);
};

const isRawZohoNumericId = (code) => Boolean(code && /^\d{10,}$/.test(String(code).trim()));

const loadDeletedRawMaterialCodes = () => {
  const delPath = getStoreFilePath('deleted_raw_materials_store.json');
  if (fs.existsSync(delPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(delPath, 'utf8'));
      if (Array.isArray(data)) return data;
    } catch (_) {}
  }
  return supabaseMemoryStore.deleted_raw_materials_store || [];
};

const saveDeletedRawMaterialCodes = (codes) => {
  const delPath = getStoreFilePath('deleted_raw_materials_store.json');
  const arr = Array.from(new Set((codes || []).map(c => String(c).toUpperCase().trim())));
  try {
    fs.writeFileSync(delPath, JSON.stringify(arr, null, 2), 'utf8');
  } catch (_) {}
  supabaseMemoryStore.deleted_raw_materials_store = arr;
  saveDatabaseStore('deleted_raw_materials_store', arr);
};

const loadLocalItems = () => {
  const itemsPath = getStoreFilePath('item_store.json');
  const deletedCodes = loadDeletedRawMaterialCodes().map(c => String(c).toUpperCase().trim());
  const isDeletedOrInvalid = (c, s, n) => {
    const uc = String(c || '').toUpperCase().trim();
    const us = String(s || '').toUpperCase().trim();
    const un = String(n || '').toUpperCase().trim();
    if (isRawZohoNumericId(uc) || isRawZohoNumericId(us) || isRawZohoNumericId(un)) return true;
    return (uc && deletedCodes.includes(uc)) || (us && deletedCodes.includes(us)) || (un && deletedCodes.includes(un));
  };

  let diskItems = [];
  if (fs.existsSync(itemsPath)) {
    try {
      diskItems = (JSON.parse(fs.readFileSync(itemsPath, 'utf8')) || []).filter(d => {
        return !isDeletedOrInvalid(d.code, d.sku, d.name) && !isDeletedOrInvalid(d.itemId, d.id, d.name);
      });
    } catch (_) {}
  }

  const baseList = diskItems.length > 0 ? diskItems : (supabaseMemoryStore.item_store || []);
  const seen = new Set();
  const unified = [];

  baseList.forEach(it => {
    if (!it || !it.name || isDeletedOrInvalid(it.code, it.sku, it.name) || isDeletedOrInvalid(it.itemId, it.id, it.name)) return;
    const c = String(it.code || it.sku || it.itemId || it.id || '').toLowerCase().trim();
    const n = String(it.name || '').toLowerCase().trim();
    const key = c ? `c:${c}` : `n:${n}`;
    if (seen.has(key)) return;
    seen.add(key);
    unified.push(applyDefaultCableUom(it));
  });

  supabaseMemoryStore.item_store = unified;
  return unified;
};

const loadLocalRawMaterials = () => {
  const rawPath = getStoreFilePath('raw_materials_store.json');
  const deletedCodes = loadDeletedRawMaterialCodes().map(c => String(c).toUpperCase().trim());
  const isDeletedOrInvalid = (c, s, n) => {
    const uc = String(c || '').toUpperCase().trim();
    const us = String(s || '').toUpperCase().trim();
    const un = String(n || '').toUpperCase().trim();
    if (isRawZohoNumericId(uc) || isRawZohoNumericId(us) || isRawZohoNumericId(un)) return true;
    return (uc && deletedCodes.includes(uc)) || (us && deletedCodes.includes(us)) || (un && deletedCodes.includes(un));
  };

  let diskMats = [];
  if (fs.existsSync(rawPath)) {
    try {
      diskMats = (JSON.parse(fs.readFileSync(rawPath, 'utf8')) || []).filter(d => {
        return !isDeletedOrInvalid(d.code, d.sku, d.name) && !isDeletedOrInvalid(d.itemId, d.id, d.name);
      });
    } catch (_) {}
  }
  const memMats = (supabaseMemoryStore.raw_materials_store || []).filter(m => {
    return !isDeletedOrInvalid(m.code, m.sku, m.name) && !isDeletedOrInvalid(m.itemId, m.id, m.name);
  });
  if (Array.isArray(memMats) && memMats.length >= diskMats.length && memMats.length > 0) {
    return memMats.map(applyDefaultCableUom);
  }
  if (Array.isArray(diskMats) && diskMats.length > 0) {
    if (Array.isArray(memMats) && memMats.length > 0) {
      const map = new Map();
      diskMats.forEach(d => {
        const k = String(d.code || d.name || '').toUpperCase().trim();
        if (k) map.set(k, { ...d });
      });
      memMats.forEach(m => {
        const k = String(m.code || m.name || '').toUpperCase().trim();
        if (k && map.has(k)) {
          map.set(k, { ...map.get(k), ...m });
        } else if (k) {
          map.set(k, { ...m });
        }
      });
      const unified = Array.from(map.values()).filter(m => !isDeletedOrInvalid(m.code, m.sku, m.name)).map(applyDefaultCableUom);
      supabaseMemoryStore.raw_materials_store = unified;
      return unified;
    }
    const normalizedDisk = diskMats.map(applyDefaultCableUom);
    supabaseMemoryStore.raw_materials_store = normalizedDisk;
    return normalizedDisk;
  }
  return (memMats || []).map(applyDefaultCableUom);
};

const saveLocalItems = (items) => {
  supabaseMemoryStore.item_store = items;
  saveDatabaseStore('item_store', items);
};

const getGRNStorePath = () => {
  return getStoreFilePath('grn_store.json');
};

const loadLocalGRNs = () => {
  if (supabaseMemoryStore.grn_store && Array.isArray(supabaseMemoryStore.grn_store) && supabaseMemoryStore.grn_store.length > 0) {
    return supabaseMemoryStore.grn_store;
  }
  const diskPath = getStoreFilePath('grn_store.json');
  if (fs.existsSync(diskPath)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData) && diskData.length > 0) {
        supabaseMemoryStore.grn_store = diskData;
        return diskData;
      }
    } catch (_) {}
  }
  return [];
};

const saveLocalGRNs = (grns) => {
  supabaseMemoryStore.grn_store = grns;
  const diskPath = getStoreFilePath('grn_store.json');
  try {
    fs.writeFileSync(diskPath, JSON.stringify(grns, null, 2), 'utf8');
  } catch (_) {}
  saveDatabaseStore('grn_store', grns);
};

// Lightweight server heartbeat for dev proxy & load balancers
app.get(['/api/health', '/api/ping'], (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Health & PostgreSQL Database Status Check
app.get('/api/db-status', async (req, res) => {
  try {
    const health = await verifyDbConnectivity(3000);
    if (!health.ok) {
      return res.status(503).json({
        status: 'error',
        connected: false,
        message: health.error,
        isPoolActive: isDbConnected()
      });
    }
    const result = await query('SELECT current_database(), current_user, version(), NOW() as server_time;');
    const storeCount = await query('SELECT count(*) as total_tables FROM public.controlroom_store;');
    res.json({
      status: 'online',
      connected: true,
      database: result.rows[0]?.current_database || health.database || 'unknown',
      user: result.rows[0]?.current_user || 'unknown',
      serverTime: result.rows[0]?.server_time,
      storeTablesCount: Number(storeCount.rows[0]?.total_tables || 0),
      isPoolActive: isDbConnected(),
      latencyMs: health.latencyMs
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      connected: false,
      message: err.message,
      isPoolActive: isDbConnected()
    });
  }
});

// ⚡ Real-Time Push Gateway (Server-Sent Events)
// ⚡ Real-Time Push Gateway (Server-Sent Events)
// Enables sub-second instant updates across all 10+ users without page refresh
app.get('/api/realtime-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const lastEventIdHeader = req.headers['last-event-id'] || req.query.lastEventId;
  const lastEventId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : 0;

  res.write(`id: ${sseSequenceId}\nevent: message\ndata: ${JSON.stringify({ type: 'connected', seq: sseSequenceId, timestamp: new Date().toISOString() })}\n\n`);
  realtimeClients.add(res);

  // Register client for authenticated enterprise workflow notification dispatch
  const clientInfo = {
    res,
    empCode: req.query.empCode || req.headers['x-employee-code'] || '',
    role: req.query.role || req.headers['x-user-role'] || '',
    userName: req.query.userName || req.headers['x-user-name'] || '',
    connectedAt: new Date().toISOString()
  };
  const unregisterNotifClient = registerNotificationClient(clientInfo);

  // If client reconnected with lastEventId, check for ring buffer overflow or server sequence reset
  if (lastEventId > 0) {
    const oldestSeq = sseEventHistory.length > 0 ? sseEventHistory[0].seq : 0;
    const isSequenceReset = lastEventId > sseSequenceId;
    const isBufferOverflow = sseEventHistory.length > 0 && (lastEventId < oldestSeq - 1);

    if (isSequenceReset || isBufferOverflow) {
      // Signal client that ring buffer overflowed or sequence was reset; client must perform full state resync
      res.write(`id: ${sseSequenceId}\nevent: message\ndata: ${JSON.stringify({ 
        type: 'resync_required', 
        seq: sseSequenceId, 
        reason: isSequenceReset ? 'server_restart' : 'buffer_overflow',
        message: 'Missed event gap exceeds replay buffer. Full authoritative state resync required.' 
      })}\n\n`);
    } else if (sseEventHistory.length > 0) {
      const missed = sseEventHistory.filter(e => e.seq > lastEventId);
      for (const ev of missed) {
        try {
          res.write(`id: ${ev.seq}\nevent: message\ndata: ${JSON.stringify(ev)}\n\n`);
        } catch (_) {
          realtimeClients.delete(res);
          break;
        }
      }
    }
  }

  const keepAliveInterval = setInterval(() => {
    try {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': keepalive\n\n');
      } else {
        clearInterval(keepAliveInterval);
        realtimeClients.delete(res);
        unregisterNotifClient();
      }
    } catch (_) {
      clearInterval(keepAliveInterval);
      realtimeClients.delete(res);
      unregisterNotifClient();
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    realtimeClients.delete(res);
    unregisterNotifClient();
  });
});

// ==========================================
// 🔔 REAL-TIME INTERNAL NOTIFICATION ENDPOINTS
// ==========================================
app.get('/api/notifications', async (req, res) => {
  const empCode = req.query.empCode || req.headers['x-employee-code'] || '';
  const role = req.query.role || req.headers['x-user-role'] || '';
  const userName = req.query.userName || req.headers['x-user-name'] || '';
  const unreadOnly = req.query.unreadOnly === 'true';
  const limit = parseInt(req.query.limit, 10) || 50;
  const since = req.query.since || null;

  try {
    const result = await getNotificationsForUser({ empCode, role, userName, unreadOnly, limit, since });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications/unread-count', async (req, res) => {
  const empCode = req.query.empCode || req.headers['x-employee-code'] || '';
  const role = req.query.role || req.headers['x-user-role'] || '';
  const userName = req.query.userName || req.headers['x-user-name'] || '';

  try {
    const { unreadCount } = await getNotificationsForUser({ empCode, role, userName, unreadOnly: true, limit: 1 });
    res.json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const { notificationId, all } = req.body || {};
  const empCode = req.body?.empCode || req.headers['x-employee-code'] || req.headers['x-user-emp-id'] || '';
  const role = req.body?.role || req.headers['x-user-role'] || '';

  try {
    const result = await markNotificationAsRead({ notificationId, empCode, role, all: Boolean(all) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/clear', async (req, res) => {
  const { notificationId, all, purgeAll } = req.body || {};
  const empCode = req.body?.empCode || req.headers['x-employee-code'] || req.headers['x-user-emp-id'] || '';
  const role = req.body?.role || req.headers['x-user-role'] || '';

  try {
    const result = await clearNotifications({ notificationId, empCode, role, all: all !== false, purgeAll: Boolean(purgeAll) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint for frontend to trigger workflow notifications across departments
app.post('/api/workflow-notifications', async (req, res) => {
  try {
    const {
      recipientEmpCode,
      recipientRole,
      recipientUserName,
      eventType,
      documentType,
      documentId,
      title,
      message,
      actorEmpCode,
      actorName,
      actorRole,
      targetTab,
      targetRecordId,
      metadata,
      dedupId
    } = req.body || {};

    const actorEmp = actorEmpCode || req.headers['x-employee-code'] || req.headers['x-user-emp-id'] || null;
    const actName = actorName || req.headers['x-user-name'] || 'System';
    const actRole = actorRole || req.headers['x-user-role'] || 'System';

    const result = await createInternalNotification({
      recipientEmpCode,
      recipientRole,
      recipientUserName: recipientUserName || metadata?.recipientUserName || metadata?.salesPerson || null,
      eventType,
      documentType: documentType || 'BOM',
      documentId,
      title,
      message,
      actorEmpCode: actorEmp,
      actorName: actName,
      actorRole: actRole,
      targetTab,
      targetRecordId,
      metadata,
      dedupId
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⚡ Lightweight Native Active Session Management with Strict Server-Side Authentication
export const activeSessionsMap = new Map();
let activeSessionsWriteQueue = Promise.resolve();

export const saveActiveSessionsToDisk = () => {
  try {
    const diskPath = getStoreFilePath('active_sessions.json');
    const list = Array.from(activeSessionsMap.values()).map(({ _lastPersistedAt, ...rest }) => rest);
    const serialized = JSON.stringify(list, null, 2);
    activeSessionsWriteQueue = activeSessionsWriteQueue.then(async () => {
      const tmpPath = `${diskPath}.tmp.${process.pid}`;
      try {
        await fs.promises.writeFile(tmpPath, serialized, 'utf8');
        await fs.promises.rename(tmpPath, diskPath);
      } catch (err) {
        try { await fs.promises.unlink(tmpPath); } catch (_) {}
        console.warn(`[saveActiveSessionsToDisk] Failed to write ${diskPath}:`, err?.message || err);
      }
    }).catch(() => {});
  } catch (_) {}
};

export const persistSessionToDb = async (sessionRec) => {
  if (!sessionRec?.id || isOptimizationTestMode() || !isDbConnected()) return;
  try {
    const cleanId = String(sessionRec.id).trim();
    const payloadJson = JSON.stringify({
      user: sessionRec.user,
      email: sessionRec.email,
      empCode: sessionRec.empCode,
      role: sessionRec.role,
      expiresAt: sessionRec.expiresAt,
      lastActiveTimestamp: sessionRec.lastActiveTimestamp,
      device: sessionRec.device,
      browser: sessionRec.browser
    });
    const upd = await query(
      `UPDATE public.leaves
       SET reason = $1, status = $2, dates = NOW()
       WHERE employee = 'SESSION_REGISTRY' AND duration = $3
       RETURNING id`,
      [payloadJson, sessionRec.status || 'active', cleanId]
    );
    if (!upd || upd.rowCount === 0) {
      await query(
        `INSERT INTO public.leaves (employee, reason, status, duration, type, dates)
         VALUES ('SESSION_REGISTRY', $1, $2, $3, 'Session', NOW())`,
        [payloadJson, sessionRec.status || 'active', cleanId]
      );
    }
  } catch (err) {
    console.warn('[persistSessionToDb] Non-fatal session DB persistence warning:', err?.message || err);
  }
};

export const revokeSessionInDb = async (sessionId) => {
  if (!sessionId || isOptimizationTestMode() || !isDbConnected()) return;
  try {
    await query(
      `UPDATE public.leaves
       SET status = 'revoked', dates = NOW()
       WHERE employee = 'SESSION_REGISTRY' AND duration = $1`,
      [String(sessionId).trim()]
    );
  } catch (err) {
    console.warn('[revokeSessionInDb] Non-fatal session DB revoke warning:', err?.message || err);
  }
};

export const loadActiveSessionsFromDisk = () => {
  try {
    const diskPath = getStoreFilePath('active_sessions.json');
    if (fs.existsSync(diskPath)) {
      const list = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(list)) {
        list.forEach(s => {
          if (!s || !s.id) return;
          const sid = String(s.id).trim();
          if (!sid) return;
          const cur = activeSessionsMap.get(sid);
          if (!cur) {
            activeSessionsMap.set(sid, s);
            return;
          }
          // Never resurrect an in-memory revoked session from stale disk state
          if (cur.status === 'revoked') return;
          if (s.status === 'revoked') {
            activeSessionsMap.set(sid, s);
            return;
          }
          const diskLast = Number(s.lastActiveTimestamp || 0);
          const memLast = Number(cur.lastActiveTimestamp || 0);
          const diskExp = Number(s.expiresAt || 0);
          const memExp = Number(cur.expiresAt || 0);
          if (diskLast > memLast || diskExp > memExp) {
            activeSessionsMap.set(sid, s);
          }
        });
      }
    }
  } catch (_) {}
};
loadActiveSessionsFromDisk();

export async function authenticateEmployeeCredentials(identifier, password) {
  if (!identifier || !password) {
    return { verified: false, error: 'Identifier and password are required', status: 400 };
  }
  const cleanId = String(identifier).trim().toLowerCase();
  const normCode = normalizeEmployeeCode(identifier);

  let employees = [];
  try {
    const data = await getDatabaseStore('employees_store');
    if (Array.isArray(data)) employees = [...data];
  } catch (_) {}

  if (employees.length === 0 && !isOptimizationTestMode()) {
    try {
      const diskPath = getStoreFilePath('employees_store.json');
      if (fs.existsSync(diskPath)) {
        const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        if (Array.isArray(diskData)) employees = [...diskData];
      }
    } catch (_) {}
  }

  const matched = employees.find(e => {
    const eCode = normalizeEmployeeCode(e.employee_code || e.code);
    const eMail = String(e.email || '').trim().toLowerCase();
    return (normCode && eCode === normCode) || (cleanId && eMail === cleanId);
  });

  return authenticateEmployeeRecord(matched, password);
}

/**
 * 🔒 Authenticated Session Registration Endpoint
 * STOPS privilege escalation: Ignores client-supplied role, employeeCode, or user identity.
 * Validates employee credentials strictly against the server-side employees store.
 * Generates cryptographic session tokens (sess_...) on the server; never permits session adoption.
 */
const loginFailedAttemptsMap = new Map();
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000;

app.post('/api/sessions/register', async (req, res) => {
  const { email, empCode, employee_code, password, device, browser } = req.body || {};

  // 1. Allow scoped internal automation services (strictly disabled in optimization test mode)
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && !isOptimizationTestMode() && process.env.SUPABASE_SERVICE_ROLE_KEY && adminKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const automationSession = createSessionRecord(
      {
        employee_code: 'SERVICE-AUTO',
        employee_name: 'Internal Automation Service',
        email: 'automation@vrmstructures.com',
        role: 'Technical Administrator'
      },
      { device: device || 'Server', browser: browser || 'CLI' }
    );
    activeSessionsMap.set(automationSession.id, automationSession);
    return res.json({
      success: true,
      session: {
        id: automationSession.id,
        role: automationSession.role,
        empCode: automationSession.empCode,
        user: automationSession.user,
        email: automationSession.email
      }
    });
  }

  // 2. New session registration: MUST provide valid employee credentials!
  const identifier = empCode || employee_code || email;
  if (!identifier || !password) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required: employeeCode/email and password must be provided to register an active session.' 
    });
  }

  const rateKey = `${req.ip || 'unknown'}:${String(identifier).trim().toLowerCase()}`;
  const attemptState = loginFailedAttemptsMap.get(rateKey);
  if (attemptState && attemptState.lockedUntil && Date.now() < attemptState.lockedUntil) {
    const waitSec = Math.ceil((attemptState.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please wait ${waitSec}s before trying again.`
    });
  }

  const authResult = await authenticateEmployeeCredentials(identifier, password);
  if (!authResult || !authResult.verified) {
    const prevCount = (attemptState && (!attemptState.lockedUntil || Date.now() >= attemptState.lockedUntil)) ? attemptState.count : 0;
    const nextCount = prevCount + 1;
    loginFailedAttemptsMap.set(rateKey, {
      count: nextCount,
      lockedUntil: nextCount >= LOGIN_MAX_FAILURES ? (Date.now() + LOGIN_LOCKOUT_MS) : null
    });
    return res.status(authResult?.status || 401).json({ 
      success: false, 
      error: authResult?.error || 'Authentication failed: Invalid credentials.' 
    });
  }
  loginFailedAttemptsMap.delete(rateKey);

  // 3. CRITICAL SECURITY ENFORCEMENT:
  // Role, empCode, email, and user name are derived 100% STRICTLY from server-side database verification!
  // Client-submitted `role`, `empCode`, or `user` are COMPLETELY IGNORED.
  // Session ID is generated cryptographically on the server (no client session adoption).
  // Concurrent sessions allowed by default; opt-in single-device policy via SINGLE_DEVICE_SESSION=true
  if (process.env.SINGLE_DEVICE_SESSION === 'true' && authResult.employee_code) {
    const targetEmpNorm = String(authResult.employee_code).trim().toUpperCase();
    for (const [sid, s] of activeSessionsMap.entries()) {
      if (String(s.empCode || '').trim().toUpperCase() === targetEmpNorm && s.status !== 'revoked') {
        s.status = 'revoked';
        s.revokedAt = Date.now();
        activeSessionsMap.set(sid, s);
        revokeSessionInDb(sid);
      }
    }
  }
  const verifiedSession = createSessionRecord(authResult, { device, browser });
  activeSessionsMap.set(verifiedSession.id, verifiedSession);
  saveActiveSessionsToDisk();
  await persistSessionToDb(verifiedSession);

  return res.status(200).json({
    success: true,
    session: {
      id: verifiedSession.id,
      empCode: verifiedSession.empCode,
      user: verifiedSession.user,
      email: verifiedSession.email,
      role: verifiedSession.role
    }
  });
});

app.post('/api/sessions/heartbeat', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.body?.sessionId;
  const callerEmpCode = req.headers['x-emp-code'] || req.body?.empCode || req.body?.employee_code;
  const callerRole = req.headers['x-user-role'] || req.body?.role;
  const callerName = req.body?.userName;

  let result = heartbeatSessionInMap(sessionId, activeSessionsMap, callerEmpCode);
  if (!result.success && result.status !== 'revoked' && result.status !== 'forbidden') {
    // Reload from disk in case another worker/process registered the session or server restarted
    loadActiveSessionsFromDisk();
    result = heartbeatSessionInMap(sessionId, activeSessionsMap, callerEmpCode);
  }
  if (!result.success && result.status !== 'revoked' && result.status !== 'forbidden') {
    // If not found in memory (e.g. server restart / PM2 reload), rehydrate from verified persistent session
    try {
      const verified = await getVerifiedUserSession(req);
      if (verified && verified.valid) {
        const now = Date.now();
        const restoredId = String(sessionId || verified.sessionId).trim();
        const restored = {
          id: restoredId,
          sessionId: restoredId,
          user: verified.user,
          email: verified.email,
          empCode: verified.empCode,
          role: verified.role,
          lastActiveTimestamp: now,
          expiresAt: now + SESSION_TTL_MS,
          status: 'active'
        };
        activeSessionsMap.set(restored.id, restored);
        result = heartbeatSessionInMap(restored.id, activeSessionsMap, callerEmpCode);
        if (result.success) {
          restored._lastPersistedAt = Date.now();
          saveActiveSessionsToDisk();
        }
      }
    } catch (_) {}
  }

  // Gracefully rehydrate active session if server memory was wiped by PM2 reload
  if (!result.success && result.status !== 'revoked' && result.status !== 'forbidden' && (callerEmpCode || sessionId)) {
    const cleanId = String(sessionId || '').trim();
    if (cleanId && cleanId.length >= 3) {
      const now = Date.now();
      const autoRevived = {
        id: cleanId,
        sessionId: cleanId,
        user: callerName || callerEmpCode || 'Active Employee',
        email: req.body?.email || `${String(callerEmpCode || 'emp').toLowerCase()}@vrmstructures.in`,
        empCode: callerEmpCode || 'EMP',
        role: callerRole || 'Employee',
        lastActiveTimestamp: now,
        expiresAt: now + SESSION_TTL_MS,
        status: 'active'
      };
      activeSessionsMap.set(cleanId, autoRevived);
      saveActiveSessionsToDisk();
      persistSessionToDb(autoRevived).catch(() => {});
      result = {
        success: true,
        status: 'active',
        sessionId: cleanId,
        lastActiveTimestamp: now,
        role: autoRevived.role,
        empCode: autoRevived.empCode,
        email: autoRevived.email,
        user: autoRevived.user
      };
    }
  }

  if (result.success) {
    const liveRec = activeSessionsMap.get(String(sessionId || '').trim());
    if (liveRec && (!liveRec._lastPersistedAt || (Date.now() - liveRec._lastPersistedAt) >= 60000)) {
      liveRec._lastPersistedAt = Date.now();
      saveActiveSessionsToDisk();
    }
    // Refresh sliding 30-day expires_at in PostgreSQL at most once every 30 minutes so PM2 restarts never expire active users
    if (liveRec && (!liveRec._lastDbPersistedAt || (Date.now() - liveRec._lastDbPersistedAt) >= 30 * 60 * 1000)) {
      liveRec._lastDbPersistedAt = Date.now();
      persistSessionToDb(liveRec).catch(() => {});
    }
  }

  if (!result.success) {
    const statusCode = result.status === 'forbidden' ? 403 : 401;
    return res.status(statusCode).json(result);
  }

  return res.json(result);
});

app.get('/api/sessions/active', async (req, res) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Active Businz session required to view active sessions.'
    });
  }

  const callerRole = String(session.role || '').toLowerCase();
  const isExecutive = ['ceo', 'md', 'managing director', 'technical administrator'].some(r => callerRole.includes(r));

  const now = Date.now();
  const list = [];
  for (const [id, s] of activeSessionsMap.entries()) {
    if (now - (s.lastActiveTimestamp || 0) < 24 * 3600 * 1000) {
      if (isExecutive || s.empCode === session.empCode || s.id === session.sessionId) {
        list.push({
          id: s.id,
          empCode: s.empCode,
          user: s.user,
          email: s.email,
          role: s.role,
          device: s.device,
          browser: s.browser,
          ip: s.ip,
          location: s.location,
          loginTime: s.loginTime,
          lastActiveTimestamp: s.lastActiveTimestamp,
          status: s.status
        });
      }
    } else {
      activeSessionsMap.delete(id);
    }
  }
  res.json({ success: true, data: list });
});

app.post('/api/sessions/revoke', async (req, res) => {
  const sessionId = req.body?.sessionId || req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID is required to revoke.' });
  }

  const callerSession = await getVerifiedUserSession(req);
  if (!callerSession || !callerSession.valid) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Valid authenticated session required to revoke sessions.' 
    });
  }

  const result = revokeSessionInMap(sessionId, activeSessionsMap, callerSession);
  if (!result.success) {
    return res.status(403).json(result);
  }

  saveActiveSessionsToDisk();
  await revokeSessionInDb(sessionId);
  return res.json(result);
});

/**
 * 🔒 Verified Server-Side User Session Resolution
 * Validates request session against in-memory active sessions or database registry.
 * Derives user ID, employee code, role, and email strictly server-side.
 */
export async function getVerifiedUserSession(req) {
  const sessionId = req.headers['x-session-id'] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null) ||
    req.cookies?.['controlroom_device_session_id'] ||
    req.cookies?.['businz_device_session_id'] ||
    req.body?.sessionId ||
    req.query?.sessionId;

  // Check admin key header for automated internal test suites (strictly disabled in optimization test mode)
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && !isOptimizationTestMode() && process.env.SUPABASE_SERVICE_ROLE_KEY && adminKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      valid: true,
      user: 'Internal Automation Service',
      empCode: 'SERVICE-AUTO',
      role: 'Technical Administrator',
      email: 'automation@vrmstructures.com'
    };
  }

  if (!sessionId) {
    return { valid: false, error: 'Unauthorized: Active Businz session required (x-session-id)' };
  }

  const cleanSid = String(sessionId).trim();

  // 1. Check in-memory active session map with expiration & revocation validation
  let sessionValidation = validateSessionInMap(cleanSid, activeSessionsMap);
  if (sessionValidation.valid) {
    const s = sessionValidation.session;
    return {
      valid: true,
      sessionId: s.id,
      user: s.user || s.displayName || s.email,
      email: s.email,
      empCode: s.empCode || s.employee_code || s.code || 'EMP',
      role: s.role || 'Employee'
    };
  }

  // If session was found in map but revoked or expired, do not fall back to persistent validation
  if (sessionValidation.revoked || sessionValidation.expired || activeSessionsMap.has(cleanSid)) {
    return { valid: false, error: sessionValidation.error || 'Unauthorized: Session revoked or expired' };
  }

  // 2. Reload from disk store in case another worker registered the session or server restarted
  loadActiveSessionsFromDisk();
  sessionValidation = validateSessionInMap(cleanSid, activeSessionsMap);
  if (sessionValidation.valid) {
    const s = sessionValidation.session;
    return {
      valid: true,
      sessionId: s.id,
      user: s.user || s.displayName || s.email,
      email: s.email,
      empCode: s.empCode || s.employee_code || s.code || 'EMP',
      role: s.role || 'Employee'
    };
  }
  if (sessionValidation.revoked || sessionValidation.expired) {
    return { valid: false, error: sessionValidation.error || 'Unauthorized: Session revoked or expired' };
  }

  // 3. Persistent database session verification + in-memory rehydration
  const sessionResult = await validateBusinzSession(cleanSid);
  if (sessionResult && sessionResult.valid) {
    const hydratedUser = sessionResult.user || 'Active User';
    const hydratedEmpCode = sessionResult.empCode || sessionResult.employee_code || 'EMP';
    const hydratedRole = sessionResult.role || 'Employee';
    activeSessionsMap.set(cleanSid, {
      id: cleanSid,
      sessionId: cleanSid,
      user: hydratedUser,
      email: sessionResult.email,
      empCode: hydratedEmpCode,
      role: hydratedRole,
      status: 'active',
      lastActiveTimestamp: Date.now(),
      expiresAt: sessionResult.expiresAt || (Date.now() + SESSION_TTL_MS)
    });
    return {
      valid: true,
      sessionId: cleanSid,
      user: hydratedUser,
      email: sessionResult.email,
      empCode: hydratedEmpCode,
      role: hydratedRole
    };
  }

  return { valid: false, error: sessionResult?.error || 'Unauthorized: Session expired or invalid. Please log out and log in again.' };
}

export const normalizeUserRole = (role) => String(role || '').toLowerCase().trim();

export const isExecutiveOrAdminRole = (role) => {
  const r = normalizeUserRole(role);
  return ['ceo', 'md', 'managing director', 'technical administrator', 'admin', 'super admin'].some(k => r.includes(k));
};

export const hasAnyUserRole = (sessionRole, allowedRoles = []) => {
  if (isExecutiveOrAdminRole(sessionRole)) return true;
  const r = normalizeUserRole(sessionRole);
  return allowedRoles.some(allowed => r.includes(String(allowed || '').toLowerCase()));
};

export const requireBusinzSession = async (req, res, next) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }
  req.userSession = session;
  if (typeof next === 'function') next();
  return session;
};

export const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }
    req.userSession = session;
    if (!hasAnyUserRole(session.role, allowedRoles)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${session.role}" is not authorized for this operation.`
      });
    }
    if (typeof next === 'function') next();
    return session;
  };
};

// Smart Leads (new CRM module) — active unless explicitly disabled
if (process.env.ENABLE_SMART_LEADS !== 'false') {
  const { createSmartLeadsRouter, runSmartLeadsSlaEscalation } = await import('./smartLeadsRouter.js');
  const { ensureSmartLeadsSchema } = await import('./smartLeadsSchema.js');
  ensureSmartLeadsSchema().catch(err => console.error('[Smart Leads Schema]', err.message));
  const getSmartLeadsStaff = async () => {
    const employees = await getDatabaseStore('employees_store').catch(() => []);
    return (Array.isArray(employees) ? employees : []).flatMap(emp => {
      const user_id = emp.employee_code || emp.code || emp.id;
      return user_id ? [{ user_id: String(user_id), name: emp.employee_name || emp.name || String(user_id), role: emp.role || emp.designation || '' }] : [];
    });
  };
  // Master SLA, Follow-up Reminders & Inactivity Automation (Smart Leads only), every 60 seconds
  let smartLeadsSlaRunning = false;
  const smartLeadsSlaTimer = setInterval(async () => {
    if (smartLeadsSlaRunning || isMaintenanceModeActive()) return;
    smartLeadsSlaRunning = true;
    try {
      await runSmartLeadsSlaEscalation({ notify: (params) => createInternalNotification(params), getStaff: getSmartLeadsStaff });
    } catch (err) {
      console.error('[Smart Leads SLA]', err.message);
    } finally {
      smartLeadsSlaRunning = false;
    }
  }, 60 * 1000);
  smartLeadsSlaTimer.unref?.();
  app.use('/api/smart-leads', createSmartLeadsRouter({
    requireSession: requireBusinzSession,
    broadcast: (type, payload) => broadcastRealtimeEvent(type, payload),
    notify: (params) => createInternalNotification(params),
    getStaff: getSmartLeadsStaff,
    getTeam: async () => {
      const employees = await getDatabaseStore('employees_store').catch(() => []);
      const seen = new Set();
      return (Array.isArray(employees) ? employees : []).flatMap(emp => {
        const user_id = emp.employee_code || emp.code || emp.id;
        const role = emp.role || emp.designation || '';
        const isSales = `${role} ${emp.department || ''}`.toLowerCase().includes('sales');
        if (!user_id || !isSales || seen.has(user_id)) return [];
        seen.add(user_id);
        return [{ user_id: String(user_id), name: emp.employee_name || emp.name || String(user_id), role: role || 'Sales Executive' }];
      });
    }
  }));
  console.log('🧪 [Smart Leads] Module ENABLED (ENABLE_SMART_LEADS=true).');
}


import createStoreRouter, { enqueueStoreOperation, storeWriteQueues } from './routes/storeRoutes.js';
app.use(createStoreRouter({
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
}));

import createCustomerRouter from './routes/customerRoutes.js';
app.use(createCustomerRouter({
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
}));


// BUSINZ Native Vendors endpoint (Native BUSINZ Store)
import createProcurementRouter from './routes/procurementRoutes.js';
app.use(createProcurementRouter({
  loadLocalVendors,
  saveLocalVendors,
  loadLocalWorkOrders,
  saveLocalWorkOrders,
  loadLocalCustomers,
  getNextSequence,
  requireRole,
  createInternalNotification
}));


import createPoCoreRouter from './routes/poCoreRoutes.js';
app.use(createPoCoreRouter({
  loadLocalPOs,
  saveLocalPOs,
  broadcastRealtimeEvent,
  createInternalNotification,
  extractMaxSequence,
  formatSequenceCode,
  getFinancialYear,
  getNextSequence,
  isDbConnected,
  query,
  supabaseMemoryStore
}));


// Returns next sequential Tax Invoice number matching unified sequence VRM-INV-[YYYY]-[SEQ] (e.g. VRM-INV-2026-01)
// Supports ?reserve=true for atomic locking across concurrent users
app.get('/api/next-invoice-number', async (req, res) => {
  try {
    const isReserve = req.query.reserve === 'true' || req.query.commit === 'true';
    const result = await getOrReserveNextInvAtomic(isReserve);
    res.json(result);
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextInvNo: `VRM-INV-${fy}-01`, nextInvoiceNumber: `VRM-INV-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// Explicit atomic invoice number reservation endpoint
app.post('/api/invoices/reserve-number', async (req, res) => {
  try {
    const result = await getOrReserveNextInvAtomic(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

let serverBomSequenceCounter = null;
let serverBomReservationLock = Promise.resolve();

const getOrReserveNextBomAtomic = async (commit = false) => {
  return new Promise((resolve, reject) => {
    serverBomReservationLock = serverBomReservationLock.then(async () => {
      try {
        const fy = getFinancialYear();
        let records = [];

        // 1. Authoritative: Query PostgreSQL directly for VRM-BOM sequence in current FY
        if (isDbConnected()) {
          try {
            const dbRes = await query(`
              SELECT bom_code FROM public.bom_orders
              WHERE bom_code ~ '^VRMS/BOM/[0-9]{2}-[0-9]{2}/[0-9]+$' OR bom_code ~ '^VRM-BOM-[0-9]{4}-[0-9]+$' OR bom_code ~ '^VRM-BOM-[0-9]+$'
            `).catch(() => null);
            if (dbRes?.rows) records.push(...dbRes.rows);

            // Also check proforma_invoices for any converted_bom_code
            const piDbRes = await query(`
              SELECT converted_bom_code FROM public.proforma_invoices
              WHERE converted_bom_code ~ '^VRMS/BOM/[0-9]{2}-[0-9]{2}/[0-9]+$' OR converted_bom_code ~ '^VRM-BOM-[0-9]{4}-[0-9]+$' OR converted_bom_code ~ '^VRM-BOM-[0-9]+$'
            `).catch(() => null);
            if (piDbRes?.rows) records.push(...piDbRes.rows);
          } catch (dbErr) {
            console.warn('[getOrReserveNextBomAtomic PG check]:', dbErr.message);
          }
        }

        const filePath = getStoreFilePath('bom_store.json');
        if (fs.existsSync(filePath)) {
          try {
            const fileBoms = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (Array.isArray(fileBoms)) records.push(...fileBoms);
          } catch (e) {}
        }
        if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store)) {
          records.push(...supabaseMemoryStore.bom_store);
        }

        // Also check sales_pi_store on disk and in memory
        const piFilePath = getStoreFilePath('sales_pi_store.json');
        if (fs.existsSync(piFilePath)) {
          try {
            const piRecords = JSON.parse(fs.readFileSync(piFilePath, 'utf8'));
            if (Array.isArray(piRecords)) records.push(...piRecords);
          } catch (_) {}
        }
        if (Array.isArray(supabaseMemoryStore.sales_pi_store)) {
          records.push(...supabaseMemoryStore.sales_pi_store);
        }

        let maxSeq = extractMaxSequence('BOM', fy, records);

        if (serverBomSequenceCounter !== null && serverBomSequenceCounter.fy === fy && serverBomSequenceCounter.maxNum > maxSeq) {
          maxSeq = serverBomSequenceCounter.maxNum;
        }

        const nextNum = maxSeq + 1;
        const nextBomCode = formatSequenceCode('BOM', nextNum);

        if (commit) {
          serverBomSequenceCounter = { fy, maxNum: nextNum };
          try {
            await supabase.from('leaves').update({
              reason: JSON.stringify({ fy, lastNumber: nextNum, updatedAt: new Date().toISOString() }),
              duration: String(nextNum),
              dates: new Date().toISOString()
            }).eq('employee', `BOM_SEQUENCE_${fy}`);
          } catch (_) {}
        }

        resolve({ success: true, nextBomCode, nextCode: nextBomCode, maxNum: nextNum, counter: nextNum, financialYear: fy });
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });
};

// Centralized Next BOM Code generator with optional atomic reservation
app.get('/api/boms/next-code', async (req, res) => {
  try {
    const isReserve = req.query.reserve === 'true';
    const result = await getOrReserveNextBomAtomic(isReserve);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Atomic sequential reservation endpoint for concurrent salespeople
app.post('/api/boms/reserve-code', async (req, res) => {
  try {
    const result = await getOrReserveNextBomAtomic(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Disabled legacy endpoint: VRMS/BOM/26-27/556-559 belong to active production orders
app.all(['/api/boms/repair-sequence-554-555', '/api/boms/repair-sequence-556-557', '/api/boms/repair-sequence-558-559'], (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Disabled: VRMS/BOM/26-27/556-559 are assigned to active production orders.'
  });
});
let reservedQuoteLastSeq = 0;
app.post('/api/quotations/reserve-number', async (req, res) => {
  try {
    const existing = await getDatabaseStore('crm_quotations');
    const list = Array.isArray(existing) ? existing : [];
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
    let maxSeq = 0;
    list.forEach(q => {
      const code = String(q.quoteNumber || q.code || q.id || '');
      const m = code.match(/(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
      }
    });
    const nextSeq = Math.max(reservedQuoteLastSeq, maxSeq) + 1;
    reservedQuoteLastSeq = nextSeq;
    const nextCode = `VRMS/QT/${fy}/${String(nextSeq).padStart(3, '0')}`;
    return res.json({ success: true, nextQuoteNo: nextCode, sequence: nextSeq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reserve quotation number' });
  }
});

import createBomWorkflowRouter, { reconcileServerInventoryWithBoms } from './routes/bomWorkflowRoutes.js';
app.use(createBomWorkflowRouter({
  loadDatabaseBoms,
  broadcastRealtimeEvent,
  broadcastCustomerTrackingUpdate,
  getOrCreateOrderTracking,
  createInternalNotification,
  extractMaxSequence,
  formatSequenceCode,
  getFinancialYear,
  getVerifiedUserSession,
  gzipAsync,
  hasAnyUserRole,
  isDbConnected,
  persistBomsTransactionSafe,
  pushStoreToSupabase,
  query,
  requireRole,
  resolveProductCode,
  safeWriteJsonFileAsync,
  toConsumerBomServer,
  toDatabaseBomRowServer,
  wordFingerprint,
  supabase,
  supabaseMemoryStore,
  pool
}));

import createBomDocumentRouter from './routes/bomDocumentRoutes.js';
app.use(createBomDocumentRouter({ requireBusinzSession, safeWriteJsonFileAsync }));

// Real-time endpoint retrieving purchase orders strictly from BUSINZ local stores
app.get('/api/purchaseorders', async (req, res) => {
  let localPOs = loadLocalPOs();
  const localGRNs = loadLocalGRNs();

  // Calculate live receiving quantities and update status if applicable
  const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

  const reconciledPOs = localPOs.map(po => {
    const pNoClean = clean(po.poNo || po.id || po.purchaseorder_number);
    const pIdClean = clean(po.id);
    const matchingGRNs = localGRNs.filter(g => {
      const gRef = clean(g.poRef || g.poNo || g.poId);
      return gRef && (gRef === pNoClean || gRef === pIdClean);
    });

    let totalReceived = 0;
    matchingGRNs.forEach(grn => {
      if (Array.isArray(grn.items) && grn.items.length > 0) {
        grn.items.forEach(it => {
          totalReceived += Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
        });
      } else {
        totalReceived += Number(grn.acceptedQty !== undefined && grn.acceptedQty !== '' ? grn.acceptedQty : (grn.receivedQty || 0));
      }
    });

    let totalOrdered = Number(po.totalOrderedQty) || 0;
    if (totalOrdered === 0 && Array.isArray(po.items) && po.items.length > 0) {
      totalOrdered = po.items.reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0);
    }
    if (totalOrdered === 0 && matchingGRNs.length > 0) {
      const gWithOrd = matchingGRNs.find(g => Number(g.totalOrderedQty) > 0);
      if (gWithOrd) totalOrdered = Number(gWithOrd.totalOrderedQty);
    }
    if (totalOrdered === 0 && matchingGRNs.length > 0) {
      matchingGRNs.forEach(g => {
        if (Array.isArray(g.items)) {
          const ordSum = g.items.reduce((s, it) => s + Number(it.ordered || 0), 0);
          if (ordSum > totalOrdered) totalOrdered = ordSum;
        }
      });
    }

    const matchingClosedGRN = matchingGRNs.some(g => {
      const gs = String(g.status || '').toUpperCase();
      return gs.includes('CLOSED') || gs.includes('FULLY') || g.forceClosePO === true;
    });

    const isFullyReceived = (totalOrdered > 0 && totalReceived >= totalOrdered) || 
                            matchingClosedGRN || 
                            po.status === 'CLOSED / FULLY RECEIVED' || po.statusType === 'closed';
    const isPartial = !isFullyReceived && (totalOrdered > 0 && totalReceived > 0 && totalReceived < totalOrdered);

    let statusType = po.statusType || 'draft';
    let statusText = po.status || 'Draft';

    if (isFullyReceived) {
      statusType = 'closed';
      statusText = 'CLOSED / FULLY RECEIVED';
    } else if (isPartial && totalReceived > 0) {
      statusType = 'partially_received';
      statusText = 'OPEN / PARTIALLY RECEIVED';
    }

    const grnStamps = matchingGRNs
      .map(g => g.createdAt || g.created_at || g.updatedAt || g.grnDate || g.receiptDate || g.date)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const firstGrnAt = grnStamps[0] || po.firstGrnAt || null;
    const lastGrnAt = grnStamps[grnStamps.length - 1] || po.lastGrnAt || null;

    return {
      ...po,
      id: po.id || po.poNo,
      poNo: po.poNo || po.id,
      vendor: po.vendor || 'Vendor',
      totalOrderedQty: totalOrdered,
      totalReceivedQty: totalReceived > 0 ? totalReceived : (Number(po.totalReceivedQty) || Number(po.totalReceived) || 0),
      totalRemainingQty: Math.max(0, totalOrdered - totalReceived),
      receivingProgressPct: totalOrdered > 0 ? ((totalReceived / totalOrdered) * 100).toFixed(1) : (isFullyReceived ? '100.0' : (po.receivingProgressPct || '0.0')),
      grnCount: matchingGRNs.length > 0 ? matchingGRNs.length : (po.grnCount || 0),
      totalReceived: totalReceived > 0 ? totalReceived : (Number(po.totalReceived) || 0),
      firstGrnAt,
      lastGrnAt,
      status: statusText,
      statusType: statusType,
      items: Array.isArray(po.items) ? po.items : []
    };
  });

  const sorted = [...reconciledPOs].sort((a, b) => {
    const parsePoNum = (item) => {
      const str = String(item.poNo || item.id || '');
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return parsePoNum(b) - parsePoNum(a);
  });

  res.json(sorted);
});

import createInvoiceRouter from './routes/invoiceRoutes.js';
app.use(createInvoiceRouter({
  broadcastRealtimeEvent,
  getVerifiedUserSession,
  hasAnyUserRole,
  isDbConnected,
  saveDatabaseStore,
  query,
  supabaseMemoryStore
}));


// Proforma Invoices / Estimates endpoints
// Returns next sequential PI number matching unified sequence VRM-PI-[YYYY]-[SEQ] (e.g. VRM-PI-2026-01) directly from authoritative database
import createSequenceRouter from './routes/sequenceRoutes.js';
app.use(createSequenceRouter({ supabaseMemoryStore, loadDatabaseLeads }));


import createEstimateRouter from './routes/estimateRoutes.js';
app.use(createEstimateRouter({
  loadDatabaseProformaInvoices,
  saveProformaInvoiceToDatabase,
  saveDatabaseStore,
  broadcastRealtimeEvent,
  getZohoConfigInfo,
  getZohoAuthStats,
  updateZohoConfig,
  testZohoConnection,
  exchangeAuthorizationCode,
  pushPiToZoho,
  updatePiZohoSyncStatus,
  cancelProformaInvoiceInDatabase,
  deleteProformaInvoiceFromDatabase,
  toConsumerPi,
  query,
  pool,
  supabaseMemoryStore
}));

import createDeliveryChallanRouter from './routes/deliveryChallanRoutes.js';
app.use(createDeliveryChallanRouter({ supabaseMemoryStore, pushStoreToSupabase }));


import createPoWorkflowRouter from './routes/poWorkflowRoutes.js';
app.use(createPoWorkflowRouter({
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
}));




import createRawMaterialsRouter from './routes/rawMaterialsRoutes.js';
app.use(createRawMaterialsRouter({
  loadLocalItems,
  saveLocalItems,
  loadLocalRawMaterials,
  broadcastRealtimeEvent,
  getVerifiedUserSession,
  hasAnyUserRole,
  isExecutiveOrAdminRole,
  loadDeletedRawMaterialCodes,
  saveDeletedRawMaterialCodes,
  resolveDefaultUom,
  resolveProductCode,
  safeWriteJsonFileAsync,
  saveDatabaseStore,
  getDatabaseStore,
  pushStoreToSupabase,
  supabaseMemoryStore,
  query,
  isDbConnected
}));

import createWhatsAppRouter from './routes/whatsappRoutes.js';
app.use(createWhatsAppRouter({ broadcastRealtimeEvent, createDbLead }));

import createCrmLeadsRouter from './routes/crmLeadsRoutes.js';
app.use(createCrmLeadsRouter({
  requireBusinzSession,
  getNotificationsForUser,
  markNotificationAsRead,
  broadcastRealtimeEvent,
  createInternalNotification,
  assignProformaInvoiceInDatabase,
  supabaseMemoryStore,
  pushStoreToSupabase,
  pool,
  getDatabaseStore,
  getVerifiedUserSession,
  isOptimizationTestMode
}));

import createSystemBackupRouter from './routes/systemBackupRoutes.js';
app.use(createSystemBackupRouter({ supabase, supabaseMemoryStore, getVerifiedUserSession, isMaintenanceModeActive }));

import trackingRoutes from './routes/trackingRoutes.js';
app.use(trackingRoutes);

// 🌐 SERVE PRODUCTION DIST (FOR PLESK & STANDALONE HOSTING)
const distPath = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : path.resolve(process.cwd(), 'dist');

if (fs.existsSync(distPath)) {
  const distAssetsDir = path.join(distPath, 'assets');
  const rootAssets = path.resolve(__dirname, '../assets');
  const hasRootAssets = fs.existsSync(rootAssets);
  const staticGzipCache = new Map();
  const MAX_STATIC_GZIP_ENTRIES = 250;
  const STATIC_MIME_MAP = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
  };

  app.use('/assets', async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let relPath = '';
    try {
      relPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
    } catch (_) {
      return next();
    }
    if (!relPath) return next();

    const isHashed = /\-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/i.test(relPath);
    if (isHashed) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    const ext = path.extname(relPath).toLowerCase();
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') || !STATIC_MIME_MAP[ext]) {
      return next();
    }

    const baseDirs = hasRootAssets ? [distAssetsDir, rootAssets] : [distAssetsDir];
    let resolvedPath = null;
    let stat = null;
    for (const baseDir of baseDirs) {
      const candidate = path.resolve(baseDir, relPath);
      if (!candidate.startsWith(baseDir + path.sep)) continue;
      try {
        const s = await fs.promises.stat(candidate);
        if (s.isFile()) {
          resolvedPath = candidate;
          stat = s;
          break;
        }
      } catch (_) {}
    }
    if (!resolvedPath || !stat) return next();

    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    let entry = staticGzipCache.get(resolvedPath);
    if (!entry || entry.mtimeMs !== stat.mtimeMs || entry.size !== stat.size) {
      try {
        const raw = await fs.promises.readFile(resolvedPath);
        const gzipBuf = await gzipAsync(raw, { level: zlib.constants.Z_BEST_SPEED });
        if (staticGzipCache.size >= MAX_STATIC_GZIP_ENTRIES) {
          const oldestKey = staticGzipCache.keys().next().value;
          if (oldestKey) staticGzipCache.delete(oldestKey);
        }
        entry = { mtimeMs: stat.mtimeMs, size: stat.size, gzipBuf };
        staticGzipCache.set(resolvedPath, entry);
      } catch (_) {
        return next();
      }
    }

    res.setHeader('Content-Type', STATIC_MIME_MAP[ext]);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Length', entry.gzipBuf.length);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.end(entry.gzipBuf);
  });

  app.use('/assets', express.static(distAssetsDir, { maxAge: '1y', immutable: true }));
  if (hasRootAssets) {
    app.use('/assets', express.static(rootAssets, { maxAge: '1y', immutable: true }));
  }
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.startsWith('/assets/')) {
      return res.status(404).end();
    }
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.supabaseMemoryStore = supabaseMemoryStore;

if (process.env.BUSINZ_SKIP_LISTEN === 'true') {
  console.log('🛡️ [Server Startup] Module import mode: automatic app.listen() skipped.');
} else if (isOptimizationTestMode()) {
  const testHttpServer = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🛡️ [Server Startup] BUSINZ Optimization Test Server bound exclusively to 127.0.0.1:${PORT}`);
    console.log(`🛡️ [Server Startup] External network access to port ${PORT} is strictly blocked (localhost only).`);
    console.log('🛡️ [Server Startup] WhatsApp auto-restoration disabled in optimization test mode.');
  });
  testHttpServer.keepAliveTimeout = 65000;
  testHttpServer.headersTimeout = 66000;
} else {
  const prodHttpServer = app.listen(PORT, () => {
    console.log(`BUSINZ Native Server running on port ${PORT}`);
    autoRestoreAllSavedSessions({
      onMessageReceived: (msgData) => {
        broadcastRealtimeEvent('whatsapp_message', msgData);
      },
      onStatusChange: (statusData) => {
        broadcastRealtimeEvent('whatsapp_session_update', statusData);
      },
      onChatsUpdated: (chatsList) => {
        broadcastRealtimeEvent('whatsapp_chats_updated', { count: chatsList.length, chats: chatsList });
      }
    }).catch(() => {});
  });
  prodHttpServer.keepAliveTimeout = 65000;
  prodHttpServer.headersTimeout = 66000;
}

export default app;
export {
  supabaseMemoryStore,
  saveLocalBoms,
  toDatabaseBomRowServer,
  toConsumerBomServer,
  getWorkflowRankServer,
  loadDatabaseBoms,
  persistBomsTransactionSafe,
  saveDatabaseStore,
  getDatabaseStore,
  storeWriteQueues,
  STORE_PAYLOAD_LIMIT_BYTES,
  reconcileServerInventoryWithBoms
};
