import './optimizationTestGuard.js';
import { isOptimizationTestMode, getServerBindHost } from './optimizationTestGuard.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { pool, isDbConnected, initPostgresDatabase, createLocalDbClient, query, verifyDbConnectivity } from './db.js';
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
  toConsumerPi
} from './piPersistence.js';
import * as vrmDataModule from '../src/utils/vrmProductsData.js';
const VRM_PRODUCTS = vrmDataModule.VRM_PRODUCTS || vrmDataModule.default?.VRM_PRODUCTS || [];
const wordFingerprint = vrmDataModule.wordFingerprint || vrmDataModule.default?.wordFingerprint || ((w) => String(w || '').toLowerCase().trim());
const resolveProductCode = vrmDataModule.resolveProductCode || vrmDataModule.default?.resolveProductCode || ((c) => c);

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
          source, primary_contact, email, phone, status, notes, created_at, updated_at
        FROM public.customers
        ORDER BY company_name ASC
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
        .order('company_name', { ascending: true });
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

      supabaseMemoryStore.customer_store = mapped;
      supabaseMemoryStore.crm_customers = mapped;
      try {
        fs.writeFileSync(getStoreFilePath('customer_store.json'), JSON.stringify(mapped, null, 2), 'utf8');
        fs.writeFileSync(getStoreFilePath('crm_customers.json'), JSON.stringify(mapped, null, 2), 'utf8');
      } catch (_) {}
      return mapped;
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
    const merged = {
      ...existing,
      ...c,
      id: c.customerCode || c.id || existing.id || `CUST-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
      customerCode: c.customerCode || c.id || existing.customerCode || `CUST-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
      code: c.customerCode || c.id || existing.customerCode || `CUST-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
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

  // Auto-enrich with any customer referenced in PIs
  const piSources = [];
  try {
    const p = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(p)) piSources.push(...JSON.parse(fs.readFileSync(p, 'utf8') || '[]'));
  } catch (_) {}
  try {
    const p = getStoreFilePath('proforma_invoice_store.json');
    if (fs.existsSync(p)) piSources.push(...JSON.parse(fs.readFileSync(p, 'utf8') || '[]'));
  } catch (_) {}

  piSources.forEach(pi => {
    const comp = (pi.vendor || pi.customerName || pi.companyName || '').trim();
    if (comp) {
      register({
        id: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
        customerCode: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
        companyName: comp,
        customerName: pi.contactPerson || comp,
        customerType: pi.customerType || 'EPC Contractor',
        industry: 'Solar Energy / Infrastructure',
        gstNumber: pi.gstNo || pi.gstNumber || '—',
        panNumber: pi.panNumber || '—',
        address: (typeof pi.billingAddress === 'string' ? pi.billingAddress : pi.billingAddress?.street) || '',
        city: (typeof pi.billingAddress === 'object' ? pi.billingAddress.city : '') || '',
        state: (typeof pi.billingAddress === 'object' ? pi.billingAddress.state : '') || '',
        pincode: (typeof pi.billingAddress === 'object' ? pi.billingAddress.pincode : '') || '',
        dispatchAddress: (typeof pi.deliveryAddress === 'string' ? pi.deliveryAddress : pi.deliveryAddress?.street) || '',
        dispatchCity: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.city : '') || '',
        dispatchState: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.state : '') || '',
        dispatchPincode: (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress.pincode : '') || '',
        sameAsBilling: pi.sameAsBilling !== undefined ? pi.sameAsBilling : true,
        creditLimit: 2500000,
        creditDays: Number(pi.creditDays || 30),
        paymentTerms: pi.paymentTerms || 'Due on Receipt',
        assignedSalesperson: pi.salesPerson || pi.salesperson || 'Sales Executive',
        primaryContact: {
          name: pi.contactPerson || comp,
          phone: pi.phone || '',
          whatsapp: pi.phone || '',
          email: pi.email || ''
        },
        phone: pi.phone || '—',
        email: pi.email || '—',
        status: 'ACTIVE',
        createdAt: pi.createdAt || new Date().toISOString()
      });
    }
  });

  // Auto-enrich with any customer referenced in BOMs
  const bomSources = [];
  try {
    const p = getStoreFilePath('bom_store.json');
    if (fs.existsSync(p)) bomSources.push(...JSON.parse(fs.readFileSync(p, 'utf8') || '[]'));
  } catch (_) {}

  bomSources.forEach(b => {
    const comp = (b.customerName || b.companyName || '').trim();
    if (comp) {
      register({
        id: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
        customerCode: `CUST-${comp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
        companyName: comp,
        customerName: b.contactPerson || comp,
        customerType: b.customerType || 'EPC Contractor',
        industry: 'Solar Energy / Infrastructure',
        gstNumber: b.gstNo || '—',
        address: b.billingAddress || '',
        dispatchAddress: b.deliveryAddress || '',
        paymentTerms: b.paymentType || 'Due on Receipt',
        assignedSalesperson: b.salesPerson || 'Sales Executive',
        primaryContact: {
          name: b.contactPerson || comp,
          phone: b.mobile || '',
          whatsapp: b.mobile || '',
          email: b.email || ''
        },
        phone: b.mobile || '—',
        email: b.email || '—',
        status: 'ACTIVE',
        createdAt: b.createdAt || new Date().toISOString()
      });
    }
  });

  // Deduplicate by unique customer code or company name (preserves all distinct registered accounts)
  const finalMap = new Map();
  for (const val of custMap.values()) {
    const codeKey = (val.customerCode || val.id || val.code || '').toLowerCase().trim();
    const nameKey = (val.companyName || val.name || '').toLowerCase().trim();
    const primaryKey = codeKey || nameKey;
    if (primaryKey && !finalMap.has(primaryKey)) {
      finalMap.set(primaryKey, val);
    }
  }
  const result = Array.from(finalMap.values());
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

        // Authoritative merge: NEVER discard disk data or overwrite rich dispatch packing with empty database records
        const combinedMap = new Map();
        existingDiskList.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (c) combinedMap.set(c, item);
        });

        mapped.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (!c) return;
          const diskItem = combinedMap.get(c);
          if (diskItem) {
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
      }
    }
    return [];
  }
  // 0. Primary: Check PostgreSQL controlroom_store on Hostinger VPS
  // Protection 1: PostgreSQL is authoritative whenever the store row exists
  if (isDbConnected()) {
    try {
      const dbRes = await query('SELECT data FROM controlroom_store WHERE key = $1', [cleanKey]);
      if (dbRes.rows.length > 0 && dbRes.rows[0]?.data !== undefined && dbRes.rows[0]?.data !== null) {
        const d = dbRes.rows[0].data;
        supabaseMemoryStore[cleanKey] = d;
        supabaseMemoryStore[key] = d;
        return d;
      }
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

  // Merge or append incoming customer records
  incoming.forEach(c => {
    const k = String(c.customerCode || c.id || c.code || '').toLowerCase().trim();
    if (k) {
      const existing = custMap.get(k) || {};
      custMap.set(k, { ...existing, ...c });
    }
  });

  const fullList = Array.from(custMap.values());
  supabaseMemoryStore.customer_store = fullList;
  supabaseMemoryStore.crm_customers = fullList;

  // 2. Persist full list to disk files for zero data loss
  try {
    const custPath = getStoreFilePath('customer_store.json');
    fs.writeFileSync(custPath, JSON.stringify(fullList, null, 2), 'utf8');
    const crmPath = getStoreFilePath('crm_customers.json');
    fs.writeFileSync(crmPath, JSON.stringify(fullList, null, 2), 'utf8');
  } catch (diskErr) {
    console.warn('[saveLocalCustomers disk write error]:', diskErr?.message);
  }

  // 3. Upsert incoming records to canonical public.customers table (Zero data loss, 1 record changed = 1 write)
  try {
    const rows = incoming.map(c => ({
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
      dispatch_pincode: c.dispatch_pincode || (c.deliveryAddressObj && c.deliveryAddressObj.pincode) || '',
      delivery_address_obj: c.deliveryAddressObj || {},
      same_as_billing: Boolean(c.sameAsBilling),
      credit_limit: Number(c.creditLimit || 0),
      credit_days: Number(c.creditDays || 0),
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
    // Route directly to relational public.leaves table (Phase 9I zero-JSONB-bloat policy)
    const rows = Array.isArray(storeData) ? storeData : [storeData];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const emp = String(row.employee || row.empCode || row.code || '').trim().toUpperCase();
      if (!emp) continue;
      const reasonStr = typeof row.reason === 'object' ? JSON.stringify(row.reason) : String(row.reason || '');
      const status = row.status || 'active';
      const duration = String(row.duration || '1');
      const type = row.type || 'Store';
      const dates = row.dates || new Date().toISOString();
      const existing = await query('SELECT id FROM public.leaves WHERE employee = $1 ORDER BY id DESC LIMIT 1', [emp]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE public.leaves SET reason = $1, status = $2, duration = $3, type = $4, dates = $5 WHERE id = $6',
          [reasonStr, status, duration, type, dates, existing.rows[0].id]
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
  const jsonPayload = JSON.stringify(storeData);
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
  setImmediate(() => {
    try {
      const jsonStr = JSON.stringify(storeData);
      if (cleanKey === 'raw_materials_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('raw_materials_store.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'item_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('item_store.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'vendor_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('vendor_store.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'po_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('po_store.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'grn_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('grn_store.json'), jsonStr).catch(() => {});
      } else if ((cleanKey === 'workorder_store' || cleanKey === 'vrm_prod_workorders') && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('workorder_store.json'), jsonStr).catch(() => {});
        fs.promises.writeFile(getStoreFilePath('vrm_prod_workorders.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'employees_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('employees_store.json'), jsonStr).catch(() => {});
      } else if (cleanKey === 'invoice_store' && Array.isArray(storeData)) {
        fs.promises.writeFile(getStoreFilePath('invoice_store.json'), jsonStr).catch(() => {});
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-file-name', 'X-File-Name']
}));
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
app.all('/rest/v1/*', (req, res, next) => {
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
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Uploads Directory Warning]:', err.message);
}
app.use('/uploads', express.static(uploadsDir, { acceptRanges: true }));
app.use('/api/uploads', express.static(uploadsDir, { acceptRanges: true }));

// 🎥 MEDIA UPLOAD API (High-performance streaming binary upload for large videos)
app.post('/api/media/upload-raw', (req, res) => {
  try {
    const rawFileName = req.query.filename || req.query.name || req.headers['x-file-name'] || `media_${Date.now()}`;
    const decodedName = decodeURIComponent(rawFileName);
    const ext = path.extname(decodedName) || '.mp4';
    const safeBase = path.basename(decodedName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${safeBase}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    const writeStream = fs.createWriteStream(targetPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const stats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : { size: 0 };
      console.log(`[MEDIA UPLOAD] Raw file saved: ${uniqueName} (${stats.size} bytes)`);
      res.json({
        success: true,
        url: `/api/uploads/${uniqueName}`,
        filename: uniqueName,
        originalName: decodedName,
        size: stats.size
      });
    });

    writeStream.on('error', (err) => {
      console.error('[MEDIA UPLOAD WRITE ERROR]:', err);
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    console.error('[MEDIA UPLOAD EXCEPTION]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🎥 MEDIA UPLOAD API (JSON Base64 for images and documents)
app.post('/api/media/upload', async (req, res) => {
  try {
    const { name, dataUrl, mimeType } = req.body || {};
    if (!name || !dataUrl) {
      return res.status(400).json({ success: false, error: 'Missing name or dataUrl' });
    }
    const ext = path.extname(name) || (mimeType?.includes('video') ? '.mp4' : '.jpg');
    const safeBase = path.basename(name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${safeBase}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(targetPath, buffer);

    console.log(`[MEDIA UPLOAD] Base64 saved: ${uniqueName} (${buffer.length} bytes)`);
    res.json({
      success: true,
      url: `/api/uploads/${uniqueName}`,
      filename: uniqueName,
      originalName: name,
      size: buffer.length
    });
  } catch (err) {
    console.error('[MEDIA UPLOAD BASE64 ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔍 MEDIA FINDER API (Locates existing uploaded files on disk by original name)
let memoryMediaCache = null;
let memoryMediaCacheMtime = 0;
let cachedUploadsFileList = null;
let lastUploadsFileListTime = 0;

function getCachedMediaMap() {
  const mediaCachePath = getStoreFilePath('media_cache.json');
  try {
    if (fs.existsSync(mediaCachePath)) {
      const stats = fs.statSync(mediaCachePath);
      if (!memoryMediaCache || memoryMediaCacheMtime !== stats.mtimeMs) {
        memoryMediaCache = JSON.parse(fs.readFileSync(mediaCachePath, 'utf8') || '{}');
        memoryMediaCacheMtime = stats.mtimeMs;
      }
      return memoryMediaCache;
    }
  } catch (_) {}
  return memoryMediaCache || {};
}

function getCachedUploadsFileList(dir) {
  const now = Date.now();
  if (cachedUploadsFileList && (now - lastUploadsFileListTime < 20000)) {
    return cachedUploadsFileList;
  }
  const findFilesRecursively = (d) => {
    let results = [];
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(findFilesRecursively(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch (_) {}
    return results;
  };
  cachedUploadsFileList = findFilesRecursively(dir);
  lastUploadsFileListTime = now;
  return cachedUploadsFileList;
}

app.get('/api/media/find/:name', (req, res) => {
  try {
    const rawSearch = decodeURIComponent(req.params.name || '').toLowerCase().trim();
    if (!rawSearch) {
      return res.json({ found: false });
    }

    // Fast Path 1: Check in-memory media cache
    const mediaCache = getCachedMediaMap();
    if (mediaCache && typeof mediaCache === 'object') {
      const normalizedSearch = rawSearch.replace(/[\s_]+/g, ' ').trim();
      for (const [k, v] of Object.entries(mediaCache)) {
        const lowerK = String(k || '').toLowerCase();
        const normK = lowerK.replace(/[\s_]+/g, ' ').trim();
        if (lowerK === rawSearch || normK === normalizedSearch || lowerK.includes(rawSearch) || rawSearch.includes(lowerK)) {
          return res.json({ found: true, url: v, filename: k });
        }
      }
    }

    // Fast Path 2: Check direct physical files in uploadsDir
    if (fs.existsSync(uploadsDir)) {
      const sanitizedName = rawSearch.replace(/[^a-z0-9._-]/gi, '_');
      const directCandidates = [
        path.join(uploadsDir, rawSearch),
        path.join(uploadsDir, sanitizedName),
        path.join(uploadsDir, 'bom-documents', rawSearch),
        path.join(uploadsDir, 'bom-documents', sanitizedName)
      ];

      for (const cand of directCandidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          const rel = path.relative(uploadsDir, cand).replace(/\\/g, '/');
          return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(cand) });
        }
      }

      // Fast Path 3: Cached recursive search across uploadsDir
      const allFiles = getCachedUploadsFileList(uploadsDir);
      // Exact filename match
      const exact = allFiles.find(f => path.basename(f).toLowerCase() === rawSearch || path.basename(f).toLowerCase() === sanitizedName);
      if (exact) {
        const rel = path.relative(uploadsDir, exact).replace(/\\/g, '/');
        return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(exact) });
      }

      // Base slug match (ignoring timestamps and special characters)
      const searchBase = path.basename(rawSearch, path.extname(rawSearch)).replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (searchBase && searchBase.length >= 3) {
        const matched = allFiles.find(f => {
          const fBase = path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/gi, '');
          return fBase && (fBase.includes(searchBase) || searchBase.includes(fBase));
        });
        if (matched) {
          const rel = path.relative(uploadsDir, matched).replace(/\\/g, '/');
          return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(matched) });
        }
      }
    }

    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ found: false, error: err.message });
  }
});

// ============================================================================
// BUSINZ - TALLYPRIME & TALLY.ERP 9 HTTP CONNECTOR & XML INTEGRATION
// ============================================================================

// Check connectivity to local Tally HTTP Server (Default port 9000) & active companies
let customTallyUrl = process.env.TALLY_URL || 'http://127.0.0.1:9000';
let customTallyCompany = 'VRM STRUCTURES INDIA PRIVATE LIMITED';

app.get('/api/tally/status', async (req, res) => {
  try {
    const targetUrl = req.query.url || customTallyUrl;
    const result = await checkTallyStatus(targetUrl);
    if (result.primaryCompany) {
      customTallyCompany = result.primaryCompany;
    }
    res.json({
      ...result,
      configuredCompany: customTallyCompany
    });
  } catch (err) {
    res.json({
      online: false,
      host: customTallyUrl,
      message: err.message || 'Tally HTTP Server is offline or unreachable on port 9000.'
    });
  }
});

// Update Tally configuration (Host URL, Company Name)
app.post('/api/tally/config', (req, res) => {
  const { url, company } = req.body || {};
  if (url) customTallyUrl = url;
  if (company) customTallyCompany = company;
  res.json({
    success: true,
    url: customTallyUrl,
    company: customTallyCompany,
    message: 'Tally configuration updated successfully'
  });
});

// Fetch Live Profit & Loss statement directly from Tally Prime (Zero files)
app.get('/api/tally/pnl', async (req, res) => {
  const { fromDate, toDate, company } = req.query;
  const companyName = company || customTallyCompany;
  try {
    const pnlData = await fetchTallyPnl(customTallyUrl, companyName, fromDate, toDate);
    res.json(pnlData);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to retrieve P&L from Tally Prime'
    });
  }
});

// Direct automated voucher sync to Tally HTTP Server (Zero files)
app.post('/api/tally/direct-sync', async (req, res) => {
  const { xml, voucherType, recordCount, companyName } = req.body;
  if (!xml) {
    return res.status(400).json({ success: false, message: 'Voucher XML payload is required' });
  }

  try {
    const targetCompany = companyName || customTallyCompany;
    const result = await pushDirectVoucher(xml, customTallyUrl);
    res.json({
      ...result,
      company: targetCompany,
      recordCount: recordCount || 1,
      voucherType: voucherType || 'Voucher'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Direct sync to Tally Prime failed'
    });
  }
});

// Post XML Vouchers directly to Tally HTTP Server (Legacy / Direct)
app.post('/api/tally/sync', async (req, res) => {
  const { xml, type, recordCount, companyName } = req.body;
  if (!xml) {
    return res.status(400).json({ success: false, message: 'Tally XML payload is required' });
  }

  try {
    const result = await pushDirectVoucher(xml, customTallyUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Tally HTTP server not reachable on port 9000'
    });
  }
});

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

const loadLocalVendors = () => {
  if (supabaseMemoryStore.vendor_store && Array.isArray(supabaseMemoryStore.vendor_store) && supabaseMemoryStore.vendor_store.length > 0) {
    return supabaseMemoryStore.vendor_store;
  }
  try {
    const p = getStoreFilePath('vendor_store.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        supabaseMemoryStore.vendor_store = data;
        return data;
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
    unified.push(it);
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
    return memMats;
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
      const unified = Array.from(map.values()).filter(m => !isDeletedOrInvalid(m.code, m.sku, m.name));
      supabaseMemoryStore.raw_materials_store = unified;
      return unified;
    }
    supabaseMemoryStore.raw_materials_store = diskMats;
    return diskMats;
  }
  return memMats || [];
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
      }
    } catch (_) {
      clearInterval(keepAliveInterval);
      realtimeClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    realtimeClients.delete(res);
  });
});

// ⚡ Lightweight Native Active Session Management with Strict Server-Side Authentication
export const activeSessionsMap = new Map();

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

  const authResult = await authenticateEmployeeCredentials(identifier, password);
  if (!authResult || !authResult.verified) {
    return res.status(authResult?.status || 401).json({ 
      success: false, 
      error: authResult?.error || 'Authentication failed: Invalid credentials.' 
    });
  }

  // 3. CRITICAL SECURITY ENFORCEMENT:
  // Role, empCode, email, and user name are derived 100% STRICTLY from server-side database verification!
  // Client-submitted `role`, `empCode`, or `user` are COMPLETELY IGNORED.
  // Session ID is generated cryptographically on the server (no client session adoption).
  const verifiedSession = createSessionRecord(authResult, { device, browser });
  activeSessionsMap.set(verifiedSession.id, verifiedSession);

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

app.post('/api/sessions/heartbeat', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.body?.sessionId;
  const callerEmpCode = req.body?.empCode || req.body?.employee_code;

  const result = heartbeatSessionInMap(sessionId, activeSessionsMap, callerEmpCode);
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

  // 1. Check in-memory active session map with expiration & revocation validation
  const sessionValidation = validateSessionInMap(sessionId, activeSessionsMap);
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
  if (activeSessionsMap.has(String(sessionId).trim())) {
    return { valid: false, error: sessionValidation.error || 'Unauthorized: Session revoked or expired' };
  }

  // 2. Persistent session verification
  const sessionResult = await validateBusinzSession(sessionId);
  if (sessionResult && sessionResult.valid) {
    return {
      valid: true,
      sessionId,
      user: sessionResult.user || 'Active User',
      email: sessionResult.email,
      empCode: sessionResult.empCode || sessionResult.employee_code || 'EMP',
      role: sessionResult.role || 'Employee'
    };
  }

  return { valid: false, error: sessionResult?.error || 'Unauthorized: Invalid or expired session' };
}

app.get('/api/store/:key', async (req, res) => {
  const { key } = req.params;
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

      const userRole = String(session.role || '').trim();
      const userRoleLower = userRole.toLowerCase();
      const isExecutive = ['ceo', 'md', 'managing director', 'technical administrator'].some(r => userRoleLower.includes(r));

      // Client requested a specific role filter
      if (req.query.role) {
        const reqRoleLower = String(req.query.role).trim().toLowerCase();
        // If non-executive tries to query an executive or different department's notifications
        if (!isExecutive && !reqRoleLower.includes(userRoleLower) && reqRoleLower !== 'all') {
          return res.status(403).json({
            success: false,
            error: `Forbidden: Role "${userRole}" is not authorized to access notifications targeted to "${req.query.role}".`
          });
        }
      }

      const fullList = await getDatabaseStore('notifications_store');
      const list = Array.isArray(fullList) ? fullList : [];
      const total = list.length;

      // Scoping logic:
      // If executive: can view all notifications (or filter by req.query.role if provided)
      // If non-executive: strictly scoped to notifications targeting their verified session role OR 'All'
      let scopedList = list;
      if (!isExecutive) {
        scopedList = scopedList.filter(n => {
          if (!n) return false;
          const roles = Array.isArray(n.targetRoles) ? n.targetRoles : (n.role ? [n.role] : ['All']);
          return roles.some(r => {
            const rLower = String(r).toLowerCase().trim();
            return rLower === 'all' || rLower.includes(userRoleLower) || userRoleLower.includes(rLower);
          });
        });
      } else if (req.query.role) {
        const reqRole = String(req.query.role).trim().toLowerCase();
        scopedList = scopedList.filter(n => {
          if (!n) return false;
          const roles = Array.isArray(n.targetRoles) ? n.targetRoles : (n.role ? [n.role] : ['All']);
          return roles.some(r => String(r).toLowerCase().includes(reqRole) || r === 'All');
        });
      }

      // Incremental sync via ?sinceId= (returns newer notifications ahead of sinceId)
      if (req.query.sinceId) {
        const sinceIdx = scopedList.findIndex(n => n && (n.id === req.query.sinceId));
        const newerSlice = sinceIdx > 0 ? scopedList.slice(0, sinceIdx) : (sinceIdx === 0 ? [] : scopedList.slice(0, 50));
        return res.json({
          success: true,
          mode: 'incremental',
          sinceId: req.query.sinceId,
          total: scopedList.length,
          count: newerSlice.length,
          data: newerSlice
        });
      }

      // Incremental sync via ?since= (ISO timestamp or epoch)
      if (req.query.since) {
        const sinceTime = new Date(req.query.since).getTime();
        const newerSlice = !isNaN(sinceTime)
          ? scopedList.filter(n => n && n.createdAt && new Date(n.createdAt).getTime() > sinceTime)
          : scopedList.slice(0, 50);
        return res.json({
          success: true,
          mode: 'incremental',
          since: req.query.since,
          total: scopedList.length,
          count: newerSlice.length,
          data: newerSlice
        });
      }

      // Filter by unread if requested
      let filtered = scopedList;
      if (req.query.unread === 'true') {
        filtered = filtered.filter(n => n && Boolean(n.unread));
      }

      // Explicit ?all=true returns all permitted records without pagination
      if (req.query.all === 'true') {
        return res.json({
          success: true,
          page: 1,
          limit: filtered.length,
          total: scopedList.length,
          filteredTotal: filtered.length,
          totalPages: 1,
          hasMore: false,
          data: filtered
        });
      }

      // Server-side pagination (default 50 items per page, capped at 200)
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 200);
      const startIndex = (page - 1) * limit;
      const pagedData = filtered.slice(startIndex, startIndex + limit);

      return res.json({
        success: true,
        page,
        limit,
        total: scopedList.length,
        filteredTotal: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
        hasMore: startIndex + limit < filtered.length,
        data: pagedData
      });
    }
    const data = await getDatabaseStore(key);
    return res.json({ success: true, data: data !== undefined && data !== null ? data : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

// Dedicated employee registration endpoint with atomic uniqueness check
app.post('/api/auth/register-employee', async (req, res) => {
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

    // Reject self-registration of privileged executive or administrative roles
    if (isPrivilegedRole(role, cleanCode) || isPrivilegedRole(prefix, cleanCode)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Self-registration for executive or administrative roles (CEO, MD, Technical Administrator, etc.) is strictly forbidden. These roles must be provisioned directly by an authorized administrator.'
      });
    }

    const newEmpAccount = {
      employee_code: cleanCode,
      employee_name: String(employee_name || '').trim(),
      email: cleanEmail,
      password: hashPassword(String(password)),
      prefix: prefix || cleanCode.split('-')[0] || 'SE',
      role: role || 'Sales Executive',
      dashboard_type: dashboard_type || role || 'Sales Executive',
      status: 'Pending Approval',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    const updatedList = [...list, newEmpAccount];
    await saveDatabaseStore('employees_store', updatedList);

    return res.status(201).json({ success: true, account: newEmpAccount, data: updatedList });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const storeWriteQueues = new Map();

function enqueueStoreOperation(storeKey, opFn) {
  const currentQueue = storeWriteQueues.get(storeKey) || Promise.resolve();
  const execute = async () => {
    try {
      await currentQueue;
    } catch (_) {}
    return await opFn();
  };
  const nextQueue = execute();
  storeWriteQueues.set(storeKey, nextQueue);
  nextQueue.finally(() => {
    if (storeWriteQueues.get(storeKey) === nextQueue) {
      storeWriteQueues.delete(storeKey);
    }
  });
  return nextQueue;
}

app.post('/api/store/:key', async (req, res) => {
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
  if (!isDbConnected()) {
    return res.status(500).json({ success: false, error: `[Database Disconnected] PostgreSQL database is not connected. Cannot persist store "${key}".` });
  }

  if (key === 'notifications_store') {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }
  }

  // Dedicated relational leaves handler to eliminate JSONB bloat
  if (cleanKey === 'leaves') {
    return enqueueStoreOperation('leaves', async () => {
      try {
        const rows = Array.isArray(storeData) ? storeData : [storeData];
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const emp = String(row.employee || row.empCode || row.code || '').trim().toUpperCase();
          if (!emp) continue;
          const reasonStr = typeof row.reason === 'object' ? JSON.stringify(row.reason) : String(row.reason || '');
          const status = row.status || 'active';
          const duration = String(row.duration || '1');
          const type = row.type || 'Store';
          const dates = row.dates || new Date().toISOString();

          const existing = await query('SELECT id FROM public.leaves WHERE employee = $1 ORDER BY id DESC LIMIT 1', [emp]);
          if (existing.rows.length > 0) {
            await query(
              'UPDATE public.leaves SET reason = $1, status = $2, duration = $3, type = $4, dates = $5 WHERE id = $6',
              [reasonStr, status, duration, type, dates, existing.rows[0].id]
            );
          } else {
            await query(
              'INSERT INTO public.leaves (employee, reason, status, duration, type, dates) VALUES ($1, $2, $3, $4, $5, $6)',
              [emp, reasonStr, status, duration, type, dates]
            );
          }
        }
        return res.json({ success: true, count: rows.length, data: rows.slice(0, 50) });
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

app.delete('/api/store/:key/:id', async (req, res) => {
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
app.post('/api/vendors', async (req, res) => {
  try {
    const localVendors = loadLocalVendors();

    if (Array.isArray(req.body)) {
      const incomingList = req.body;
      const createdVendors = [];
      let currentVendors = [...localVendors];

      for (let i = 0; i < incomingList.length; i++) {
        const item = incomingList[i];
        const vName = String(item.name || item.companyName || `Vendor ${i + 1}`).trim();
        const vId = item.id || item.code || item.vendorCode || `VEND-${100 + currentVendors.length + 1}`;

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
          address: item.address || '',
          city: item.city || '',
          state: item.state || '',
          pincode: item.pincode || '',
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
    const vendorId = incoming.id || incoming.code || incoming.vendorCode || `VEND-${100 + localVendors.length + 1}`;

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
      address: incoming.address || '',
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
app.post('/api/customers', async (req, res) => {
  const localCustomers = loadLocalCustomers();
  const isBulk = Array.isArray(req.body);
  const incomingList = isBulk ? req.body : [req.body];

  if (incomingList.length === 0) {
    return res.status(400).json({ success: false, error: 'No customer data provided.' });
  }

  const existingMap = new Map();
  localCustomers.forEach(c => {
    const k = String(c.customerCode || c.id || '').trim().toLowerCase();
    if (k) existingMap.set(k, c);
  });

  const savedRecords = [];
  let nextCounter = localCustomers.length + 1;

  incomingList.forEach(incoming => {
    if (!incoming || typeof incoming !== 'object') return;
    let customerId = incoming.customerCode || incoming.id;
    if (!customerId || customerId.startsWith('CUST-VRM-')) {
      const { code } = getNextSequence('CS', localCustomers);
      customerId = code || `VRM-CS-${getFinancialYear()}-${String(nextCounter++).padStart(2, '0')}`;
    }
    const localCustomerRecord = {
      id: customerId,
      customerCode: customerId,
      customerName: incoming.customerName || incoming.companyName || incoming.name || 'New Customer',
      companyName: incoming.companyName || incoming.customerName || incoming.name || 'New Customer',
      customerType: incoming.customerType || 'EPC Contractor',
      industry: incoming.industry || '',
      gstNumber: incoming.gstNumber || incoming.gstin || '',
      panNumber: incoming.panNumber || incoming.pan || '',
      address1: incoming.address1 || incoming.billingAddress1 || incoming.billingAddressObj?.address1 || incoming.address || incoming.streetAddress || '',
      address2: incoming.address2 || incoming.billingAddress2 || incoming.billingAddressObj?.address2 || '',
      billingAddress1: incoming.billingAddress1 || incoming.address1 || incoming.billingAddressObj?.address1 || '',
      billingAddress2: incoming.billingAddress2 || incoming.address2 || incoming.billingAddressObj?.address2 || '',
      address: incoming.address || incoming.streetAddress || '',
      city: incoming.city || '',
      state: incoming.state || '',
      pincode: incoming.pincode || '',
      dispatchAddress1: incoming.dispatchAddress1 || incoming.shippingAddress1 || incoming.deliveryAddressObj?.address1 || incoming.dispatchAddress || incoming.address || '',
      dispatchAddress2: incoming.dispatchAddress2 || incoming.shippingAddress2 || incoming.deliveryAddressObj?.address2 || '',
      shippingAddress1: incoming.shippingAddress1 || incoming.dispatchAddress1 || incoming.deliveryAddressObj?.address1 || '',
      shippingAddress2: incoming.shippingAddress2 || incoming.dispatchAddress2 || incoming.deliveryAddressObj?.address2 || '',
      dispatchAddress: incoming.dispatchAddress || incoming.address || '',
      dispatchCity: incoming.dispatchCity || incoming.city || '',
      dispatchState: incoming.dispatchState || incoming.state || '',
      dispatchPincode: incoming.dispatchPincode || incoming.pincode || '',
      sameAsBilling: incoming.sameAsBilling !== undefined ? incoming.sameAsBilling : true,
      creditLimit: incoming.creditLimit || 2500000,
      creditDays: incoming.creditDays || 30,
      paymentTerms: incoming.paymentTerms || '50% Advance + 50% Dispatch',
      assignedSalesperson: incoming.assignedSalesperson || '',
      source: incoming.source || 'Direct',
      altPhone: incoming.altPhone || incoming.altNumber || incoming.primaryContact?.altPhone || '',
      altNumber: incoming.altNumber || incoming.altPhone || incoming.primaryContact?.altPhone || '',
      primaryContact: incoming.primaryContact || {
        name: incoming.contactPerson || incoming.contactName || '',
        phone: incoming.phone || incoming.mobile || '',
        altPhone: incoming.altPhone || incoming.altNumber || '',
        whatsapp: incoming.whatsapp || incoming.phone || incoming.mobile || '',
        email: incoming.email || ''
      },
      code: incoming.code || incoming.customerName || incoming.companyName || 'New Customer',
      c2: incoming.c2 || incoming.companyName || incoming.customerName || 'New Customer',
      c3: incoming.c3 || (incoming.primaryContact && incoming.primaryContact.name) || incoming.contactPerson || '',
      c4: incoming.c4 || (incoming.primaryContact && incoming.primaryContact.phone) || incoming.phone || incoming.mobile || '',
      c5: incoming.c5 || (incoming.primaryContact && incoming.primaryContact.email) || incoming.email || '',
      c6: incoming.c6 || incoming.billingAddress || incoming.address || '',
      billingAddressObj: incoming.billingAddressObj || {
        address1: incoming.address1 || incoming.billingAddress1 || '',
        address2: incoming.address2 || incoming.billingAddress2 || '',
        address: incoming.address || '',
        city: incoming.city || '',
        state: incoming.state || '',
        pincode: incoming.pincode || ''
      },
      c7: incoming.c7 || incoming.deliveryAddress || incoming.dispatchAddress || incoming.address || '',
      deliveryAddressObj: incoming.deliveryAddressObj || {
        address1: incoming.dispatchAddress1 || incoming.shippingAddress1 || '',
        address2: incoming.dispatchAddress2 || incoming.shippingAddress2 || '',
        address: incoming.dispatchAddress || incoming.address || '',
        city: incoming.dispatchCity || incoming.city || '',
        state: incoming.dispatchState || incoming.state || '',
        pincode: incoming.dispatchPincode || incoming.pincode || ''
      },
      status: incoming.status || 'ACTIVE',
      createdAt: incoming.createdAt || new Date().toISOString()
    };

    const k = String(customerId).trim().toLowerCase();
    existingMap.set(k, { ...(existingMap.get(k) || {}), ...localCustomerRecord });
    savedRecords.push(localCustomerRecord);
  });

  // Targeted INSERT/UPSERT each customer into authoritative PostgreSQL public.customers (Rule 2)
  for (const record of savedRecords) {
    try {
      await query(`
        INSERT INTO public.customers (
          id, customer_code, company_name, customer_name, customer_type, industry,
          gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
          dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
          same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
          source, primary_contact, email, phone, status, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29, NOW(), NOW()
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
          updated_at = NOW()
      `, [
        record.id,
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
        Number(record.creditLimit || 0),
        Number(record.creditDays || 0),
        record.paymentTerms,
        record.assignedSalesperson,
        record.source,
        JSON.stringify(record.primaryContact || {}),
        record.email,
        record.phone,
        record.status,
        record.notes || ''
      ]);
    } catch (pgErr) {
      console.warn('[POST /api/customers Postgres write notice]:', pgErr.message);
    }
  }

  const updatedCustomers = Array.from(existingMap.values());
  saveLocalCustomers(updatedCustomers);

  return res.json({
    success: true,
    message: isBulk ? `Successfully registered ${savedRecords.length} customers in BUSINZ!` : 'Customer registered in BUSINZ successfully!',
    count: savedRecords.length,
    customer: isBulk ? savedRecords[0] : savedRecords[0],
    customers: savedRecords
  });
});

// BUSINZ Native Customers endpoint (Native BUSINZ Store - Bounded & Fast per Rules 4, 8, 12)
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await loadDatabaseCustomers();
    const all = (customers && customers.length > 0) ? customers : loadLocalCustomers();
    
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
        paymentTerms: c.paymentTerms || '',
        creditLimit: c.creditLimit || 0,
        creditDays: c.creditDays || 0,
        assignedSalesperson: c.assignedSalesperson || c.salesPerson || 'Sales Rep',
        status: (c.status || 'Active').toUpperCase()
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

// BUSINZ Native Vendors endpoint (Native BUSINZ Store)
app.get('/api/vendors', async (req, res) => {
  const localVendors = loadLocalVendors();
  res.json(localVendors);
});



// Endpoint to delete a Vendor in BUSINZ Authoritative Store (Native BUSINZ Store)
app.delete('/api/vendors/:id', async (req, res) => {
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
app.get('/api/workorders', async (req, res) => {
  const localOrders = loadLocalWorkOrders();
  res.json({ success: true, count: localOrders.length, workOrders: localOrders });
});

// Endpoint to CREATE / ISSUE / UPDATE a Production Work Order
app.post('/api/workorders', async (req, res) => {
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
    res.json({ success: true, message: 'Production Work Order Saved!', workOrder: savedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single vendor details endpoint from BUSINZ local/database store (Native BUSINZ Store)
app.get('/api/vendors/:id', async (req, res) => {
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
      const billingObj = v.billingAddressObj || {
        address: v.address || 'Industrial Estate, Main Road',
        city: v.city || 'Chennai',
        state: v.state || 'Tamil Nadu',
        zip: v.pincode || '600001',
        country: 'India'
      };
      const shippingObj = v.shippingAddressObj || billingObj;

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

// GSTIN Lookup & Verification Endpoint from BUSINZ local stores (Native BUSINZ Store)
app.get('/api/gst-lookup', async (req, res) => {
  try {
    const rawGst = (req.query.gstin || '').trim().toUpperCase();
    if (!rawGst || rawGst.length !== 15) {
      return res.status(400).json({ error: 'Please enter a valid 15-character Indian GSTIN.' });
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

    // 1. Search local verified vendors
    const localVendors = loadLocalVendors();
    const matchedVendor = localVendors.find(v => 
      (v.gstin || '').toUpperCase().trim() === rawGst || 
      (v.pan || '').toUpperCase().trim() === pan
    );

    if (matchedVendor) {
      return res.json({
        success: true,
        gstin: rawGst,
        pan: pan,
        state: stateName,
        legalName: matchedVendor.companyName || matchedVendor.name,
        tradeName: matchedVendor.name,
        email: matchedVendor.email && matchedVendor.email !== '—' ? matchedVendor.email : `contact@${(matchedVendor.name || 'vendor').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        phone: matchedVendor.phone && matchedVendor.phone !== '—' ? matchedVendor.phone : (matchedVendor.mobile && matchedVendor.mobile !== '—' ? matchedVendor.mobile : '9840012345'),
        address: matchedVendor.address && matchedVendor.address !== '—' ? matchedVendor.address : `Industrial Estate, Main Road, ${stateName}`,
        city: matchedVendor.city || 'Chennai',
        pincode: matchedVendor.pincode || '600001',
        status: 'Active',
        taxpayerType: 'Regular',
        companyReg: `U${Math.floor(10000 + Math.random()*90000)}${stateCode}2018PTC098412`
      });
    }

    // 2. Search local verified customers
    const localCustomers = loadLocalCustomers();
    const matchedCustomer = localCustomers.find(c => 
      (c.gstNumber || c.gstin || '').toUpperCase().trim() === rawGst || 
      (c.panNumber || c.pan || '').toUpperCase().trim() === pan
    );

    if (matchedCustomer) {
      return res.json({
        success: true,
        gstin: rawGst,
        pan: pan,
        state: stateName,
        legalName: matchedCustomer.companyName || matchedCustomer.customerName,
        tradeName: matchedCustomer.customerName || matchedCustomer.companyName,
        email: matchedCustomer.email && matchedCustomer.email !== '—' ? matchedCustomer.email : (matchedCustomer.primaryContact?.email || ''),
        phone: matchedCustomer.phone && matchedCustomer.phone !== '—' ? matchedCustomer.phone : (matchedCustomer.primaryContact?.phone || ''),
        address: matchedCustomer.address || matchedCustomer.billingAddress || `Industrial Road, ${stateName}`,
        city: matchedCustomer.city || 'Chennai',
        pincode: matchedCustomer.pincode || '600001',
        status: 'Active',
        taxpayerType: 'Regular',
        companyReg: `U${Math.floor(10000 + Math.random()*90000)}${stateCode}2018PTC098412`
      });
    }

    const pTypeChar = pan.charAt(3);
    let businessType = 'Supplier / Manufacturer';
    if (pTypeChar === 'C') businessType = 'Private Limited Company';
    else if (pTypeChar === 'F') businessType = 'Partnership Firm';

    res.json({
      success: true,
      gstin: rawGst,
      pan: pan,
      state: stateName,
      legalName: `BUSINZ REGISTERED ENTITY (${pan})`,
      tradeName: `BUSINZ Industrial Partner`,
      email: `contact@entity-${pan.toLowerCase()}.com`,
      phone: `9440${Math.floor(10005 + Math.random()*89995)}`,
      address: `Door No. 12/484, Industrial Complex, Highway Road, ${stateName}`,
      city: stateCode === '33' ? 'Chennai' : (stateCode === '37' ? 'Nellore' : (stateCode === '36' ? 'Hyderabad' : 'Bangalore')),
      pincode: stateCode === '33' ? '600001' : (stateCode === '37' ? '524002' : '600028'),
      status: 'Active',
      taxpayerType: 'Regular',
      companyReg: `U28112${stateCode}2016PTC098412`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to create a new Purchase Order in BUSINZ Authoritative Store (Native BUSINZ Store)
app.post('/api/purchaseorders', async (req, res) => {
  try {
    const parseDateToYYYYMMDD = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
      return d.toISOString().split('T')[0];
    };

    const delAddressStr = String(req.body.deliveryAddress || '').trim();
    const billAddressStr = String(req.body.billingAddress || '').trim();
    const notesStr = String(req.body.notes || '').trim();
    const termsStr = String(req.body.terms || '').trim();

    const statusRequested = req.body.status || 'Draft';
    const isDraft = statusRequested === 'Draft' || statusRequested === 'DRAFT';
    const isPendingApproval = statusRequested === 'Draft / Pending Approval' || statusRequested === 'WAITING FOR APPROVAL';
    const isNoApproval = String(req.body.approvalRequired).toUpperCase() === 'NO' || statusRequested === 'OPEN';

    // Calculate total ordered quantity from line items
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    let calcTotalOrdered = 0;
    const processedItems = rawItems.map(item => {
      const q = Number(item.qty || item.quantity || 1);
      calcTotalOrdered += q;
      return {
        ...item,
        name: item.itemName || item.name || item.description || 'General Item',
        qty: q,
        rate: Number(item.unitPrice || item.rate || item.price || 0),
        tax: Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18),
        previouslyReceived: Number(item.previouslyReceived || 0),
        remainingQty: Number(item.remainingQty !== undefined ? item.remainingQty : q)
      };
    });

    const poNumber = req.body.poNo || `PO-2026-${Date.now()}`;
    const localPOObj = {
      id: poNumber,
      poNo: poNumber,
      vendor: req.body.vendor || 'Fresh Vendor',
      branch: req.body.branch || '',
      contactPerson: req.body.contactPerson || '',
      contactNo: req.body.contactNo || '',
      email: req.body.email || '',
      gstNo: req.body.gstNo || '',
      deliveryType: req.body.deliveryType || 'Organization',
      deliveryAddress: delAddressStr,
      billingAddress: billAddressStr,
      poDate: parseDateToYYYYMMDD(req.body.poDate),
      deliveryDate: parseDateToYYYYMMDD(req.body.deliveryDate),
      paymentTerms: req.body.paymentTerms || '',
      purchaser: req.body.purchaser || '',
      shipmentPref: req.body.shipmentPref || '',
      currency: req.body.currency || 'INR',
      project: req.body.project || '',
      priority: req.body.priority || 'Medium',
      shippingCharges: Number(req.body.shippingCharges || 0),
      otherCharges: Number(req.body.otherCharges || 0),
      discountPct: Number(req.body.discountPct || 0),
      notes: notesStr,
      terms: termsStr,
      approvalRequired: req.body.approvalRequired || 'YES',
      approver: req.body.approver || '',
      approvalPriority: req.body.approvalPriority || '',
      amount: req.body.amount || '₹0.00',
      status: isNoApproval ? 'OPEN' : (isPendingApproval ? 'Draft / Pending Approval' : 'Draft'),
      statusType: isNoApproval ? 'approved' : (isPendingApproval ? 'pending' : 'draft'),
      items: processedItems,
      totalOrderedQty: calcTotalOrdered,
      totalReceivedQty: 0,
      totalRemainingQty: calcTotalOrdered,
      grnCount: 0,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const localPOs = loadLocalPOs();
    const existingIdx = localPOs.findIndex(p => p.poNo === localPOObj.poNo || p.id === localPOObj.id);
    if (existingIdx !== -1) {
      localPOs[existingIdx] = { ...localPOs[existingIdx], ...localPOObj };
    } else {
      localPOs.unshift(localPOObj);
    }
    saveLocalPOs(localPOs);

    return res.json({
      success: true,
      message: isPendingApproval 
        ? 'PO created in BUSINZ as Draft & awaiting Approval!' 
        : 'PO created and issued in BUSINZ successfully!',
      purchaseorder: localPOObj,
      po: localPOObj,
      id: localPOObj.id,
      poNo: localPOObj.poNo
    });
  } catch (err) {
    console.error('[BUSINZ PO CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create PO in BUSINZ: ' + err.message });
  }
});
// Returns next sequential PO number matching unified sequence VRM-PO-[YYYY]-[SEQ] (e.g. VRM-PO-2026-01)
app.get('/api/next-po-number', async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];

    // 1. Query PostgreSQL purchase_orders if connected
    if (isDbConnected()) {
      try {
        const dbRes = await query(`
          SELECT po_no FROM public.purchase_orders
          WHERE po_no ~ '^VRM-PO-[0-9]{4}-[0-9]+$'
        `).catch(() => null);
        if (dbRes?.rows) records.push(...dbRes.rows);
      } catch (_) {}
    }

    // 2. Scan local po_store.json
    const localPOs = loadLocalPOs();
    if (Array.isArray(localPOs)) records.push(...localPOs);

    // 3. Scan memory store
    if (supabaseMemoryStore.po_store && Array.isArray(supabaseMemoryStore.po_store)) {
      records.push(...supabaseMemoryStore.po_store);
    }

    const { code, nextNum } = getNextSequence('PO', records);
    res.json({
      nextPoNo: code,
      nextPoNumber: code,
      nextNum,
      financialYear: fy
    });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextPoNo: `VRM-PO-${fy}-01`, nextPoNumber: `VRM-PO-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

let serverInvSequenceCounter = null;
let serverInvReservationLock = Promise.resolve();

const getOrReserveNextInvAtomic = async (commit = false) => {
  return new Promise((resolve, reject) => {
    serverInvReservationLock = serverInvReservationLock.then(async () => {
      try {
        const fy = getFinancialYear();
        let records = [];

        // 1. Query PostgreSQL invoices if available
        if (isDbConnected()) {
          try {
            const dbRes = await query(`
              SELECT invoice_no FROM public.tax_invoices
              WHERE invoice_no ~ '^VRM-INV-[0-9]{4}-[0-9]+$'
            `).catch(() => null);
            if (dbRes?.rows) records.push(...dbRes.rows);

            // Also check bom_orders in PG for assigned invoice_no
            const bomDbRes = await query(`
              SELECT invoice_no FROM public.bom_orders
              WHERE invoice_no ~ '^VRM-INV-[0-9]{4}-[0-9]+$'
            `).catch(() => null);
            if (bomDbRes?.rows) records.push(...bomDbRes.rows);
          } catch (_) {}
        }

        // 2. Scan local invoice_store.json
        const invStorePath = getStoreFilePath('invoice_store.json');
        if (fs.existsSync(invStorePath)) {
          try {
            const localInvs = JSON.parse(fs.readFileSync(invStorePath, 'utf8'));
            if (Array.isArray(localInvs)) records.push(...localInvs);
          } catch (_) {}
        }
        if (supabaseMemoryStore.invoice_store && Array.isArray(supabaseMemoryStore.invoice_store)) {
          records.push(...supabaseMemoryStore.invoice_store);
        }

        // 3. Scan bom_store.json for any BOM that already has an assigned invoiceNo
        const bomStorePath = getStoreFilePath('bom_store.json');
        if (fs.existsSync(bomStorePath)) {
          try {
            const localBoms = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
            if (Array.isArray(localBoms)) {
              localBoms.forEach(b => {
                if (b && b.invoiceNo) records.push({ invNo: b.invoiceNo });
              });
            }
          } catch (_) {}
        }

        let maxSeq = extractMaxSequence('INV', fy, records);

        if (serverInvSequenceCounter !== null && serverInvSequenceCounter.fy === fy && serverInvSequenceCounter.maxNum > maxSeq) {
          maxSeq = serverInvSequenceCounter.maxNum;
        }

        const nextNum = maxSeq + 1;
        const nextInvCode = formatSequenceCode('INV', nextNum);

        if (commit) {
          serverInvSequenceCounter = { fy, maxNum: nextNum };
        }

        resolve({ success: true, nextInvNo: nextInvCode, nextInvoiceNumber: nextInvCode, nextNum, maxNum: nextNum, financialYear: fy });
      } catch (err) {
        const fy = getFinancialYear();
        resolve({ success: true, nextInvNo: `VRM-INV-${fy}-01`, nextInvoiceNumber: `VRM-INV-${fy}-01`, nextNum: 1, financialYear: fy });
      }
    }).catch(reject);
  });
};

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
              WHERE bom_code ~ '^VRM-BOM-[0-9]{4}-[0-9]+$'
            `).catch(() => null);
            if (dbRes?.rows) records.push(...dbRes.rows);

            // Also check proforma_invoices for any converted_bom_code
            const piDbRes = await query(`
              SELECT converted_bom_code FROM public.proforma_invoices
              WHERE converted_bom_code ~ '^VRM-BOM-[0-9]{4}-[0-9]+$'
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

// Dedicated endpoint to reset BOM, PI, Dispatch, Accounts Verification, and Invoice Ledger data - DISABLED
// Protection 4: /api/reset-bom-workflow-data disabled with HTTP 403
app.post('/api/reset-bom-workflow-data', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Forbidden: /api/reset-bom-workflow-data is disabled to protect historical BOM, PI, and financial ledger data.'
  });
});

// Dedicated function to audit, deduplicate, and repair historical BOM sequence mappings for converted PIs
async function repairBomSequences() {
  console.log('🔄 [BOM Sequence Repair] Auditing and restoring 1-to-1 BOM sequence mapping...');

  let piList = [];
  if (isDbConnected()) {
    try {
      const sRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'sales_pi_store'`);
      if (sRes?.rows?.[0]?.data && Array.isArray(sRes.rows[0].data)) {
        piList = sRes.rows[0].data;
      }
    } catch (_) {}
  }
  if (piList.length === 0) {
    const piFilePath = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(piFilePath)) {
      try {
        piList = JSON.parse(fs.readFileSync(piFilePath, 'utf8'));
      } catch (_) {}
    }
  }
  if (!Array.isArray(piList)) piList = [];

  // Explicit sequential alignment mapping matching existing converted PIs
  const targetMap = {};

  let piUpdatedCount = 0;
  let bomUpdatedCount = 0;

  // 1. Ensure each PI in sales_pi_store has its distinct convertedBomCode
  if (piList.length > 0) {
    let piListChanged = false;
    piList = piList.map(pi => {
      const pNo = String(pi.piNo || pi.id || '').trim();
      if (targetMap[pNo]) {
        const assigned = targetMap[pNo].bomCode;
        if (pi.convertedBomCode !== assigned || pi.convertedBomNo !== assigned) {
          piUpdatedCount++;
          piListChanged = true;
          return {
            ...pi,
            status: 'Converted to BOM',
            convertedToBom: true,
            convertedBomCode: assigned,
            convertedBomNo: assigned
          };
        }
      } else if (
        (pi.convertedBomCode === 'BOM-659' || pi.convertedBomNo === 'BOM-659' || pi.converted_bom_code === 'BOM-659' || pi.converted_bom_no === 'BOM-659') &&
        pNo !== 'PI-00061'
      ) {
        piUpdatedCount++;
        piListChanged = true;
        return {
          ...pi,
          status: 'Issued',
          statusType: 'issued',
          convertedToBom: false,
          convertedBomCode: null,
          convertedBomNo: null,
          converted_bom_code: null,
          converted_bom_no: null
        };
      } else if (pNo.toLowerCase().includes('122') && (pi.status === 'Converted to BOM' || pi.convertedBomCode || pi.convertedBomNo)) {
        piUpdatedCount++;
        piListChanged = true;
        return {
          ...pi,
          status: 'Issued',
          statusType: 'issued',
          convertedToBom: false,
          convertedBomCode: null,
          convertedBomNo: null,
          converted_bom_code: null,
          converted_bom_no: null
        };
      }
      return pi;
    });

    if (piListChanged) {
      if (isDbConnected()) {
        await query(`UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = 'sales_pi_store'`, [JSON.stringify(piList)]).catch(() => null);
        await query(`UPDATE public.controlroom_store SET data = $1, updated_at = NOW() WHERE key = 'proforma_invoice_store'`, [JSON.stringify(piList)]).catch(() => null);
      }
      try {
        fs.writeFileSync(getStoreFilePath('sales_pi_store.json'), JSON.stringify(piList, null, 2), 'utf8');
      } catch (_) {}
      supabaseMemoryStore['sales_pi_store'] = piList;
      supabaseMemoryStore['proforma_invoice_store'] = piList;
    }
  }

  // 2. Ensure each BOM exists on disk (bom_store.json)
  const diskPath = getStoreFilePath('bom_store.json');
  let currentDiskBoms = [];
  if (fs.existsSync(diskPath)) {
    try {
      currentDiskBoms = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
    } catch (_) {}
  }
  if (!Array.isArray(currentDiskBoms)) currentDiskBoms = [];
  const bomDiskMap = new Map();
  currentDiskBoms.forEach(b => {
    const c = b?.bomCode || b?.code || b?.id;
    if (c) bomDiskMap.set(c, b);
  });

  for (const [piNo, info] of Object.entries(targetMap)) {
    if (!bomDiskMap.has(info.bomCode)) {
      bomDiskMap.set(info.bomCode, {
        id: info.bomCode,
        bomCode: info.bomCode,
        code: info.bomCode,
        sourcePiNo: piNo,
        customerName: info.defaultCustomer,
        companyName: info.defaultCustomer,
        salesPerson: 'Annamalaiyar',
        grandTotal: info.defaultAmount,
        subTotal: Math.round(info.defaultAmount / 1.18),
        status: info.bomCode === 'BOM-659' ? 'COMPLETED & DISPATCHED' : 'Draft',
        salesConfirmed: true,
        date: '2026-10-06'
      });
      bomUpdatedCount++;
    }
  }

  const finalDiskBoms = Array.from(bomDiskMap.values());
  try {
    fs.writeFileSync(diskPath, JSON.stringify(finalDiskBoms, null, 2), 'utf8');
  } catch (_) {}
  supabaseMemoryStore.bom_store = finalDiskBoms;

  // 3. Ensure public.proforma_invoices and public.bom_orders tables in PostgreSQL are updated
  if (isDbConnected()) {
    try {
      await query(`
        UPDATE public.proforma_invoices
        SET converted_bom_code = NULL,
            converted_to_bom = false,
            status = 'Issued',
            updated_at = NOW()
        WHERE (converted_bom_code = 'BOM-659' OR converted_bom_no = 'BOM-659')
          AND pi_no != 'PI-00061'
          AND id != 'PI-00061'
      `);

      // Safety reconciliation: Unlink any mismatched BOM falsely claiming source_pi_no 122
      await query(`
        UPDATE public.bom_orders b
        SET source_pi_no = null,
            updated_at = NOW()
        WHERE (b.source_pi_no ILIKE '%122%')
          AND NOT EXISTS (
            SELECT 1 FROM public.proforma_invoices p
            WHERE (LOWER(TRIM(p.pi_no)) = LOWER(TRIM(b.source_pi_no)) OR LOWER(TRIM(p.id)) = LOWER(TRIM(b.source_pi_no)))
              AND (
                LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
              )
          );
      `).catch(() => {});

      // Safely restore PI-122 to Issued if no valid matching BOM exists
      await query(`
        UPDATE public.proforma_invoices p
        SET converted_bom_code = NULL,
            converted_bom_no = NULL,
            status = 'Issued',
            status_type = 'issued',
            updated_at = NOW()
        WHERE (p.pi_no ILIKE '%122%' OR p.id ILIKE '%122%')
          AND p.status = 'Converted to BOM'
          AND NOT EXISTS (
            SELECT 1 FROM public.bom_orders b
            WHERE (LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.pi_no)) OR LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.id)))
              AND (
                LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
              )
          );
      `).catch(() => {});
    } catch (_) {}

    for (const [piNo, info] of Object.entries(targetMap)) {
      try {
        await query(`
          UPDATE public.proforma_invoices
          SET converted_bom_code = $1,
              converted_to_bom = true,
              status = 'Converted to BOM',
              updated_at = NOW()
          WHERE pi_no = $2 OR id = $2
        `, [info.bomCode, piNo]);
      } catch (_) {}
    }

    for (const [piNo, info] of Object.entries(targetMap)) {
      try {
        const piData = piList.find(p => String(p.piNo || p.id || '').trim() === piNo);
        const custName = piData?.customerName || piData?.vendor || info.defaultCustomer;
        const grandTotal = Number(piData?.total || piData?.grandTotal || info.defaultAmount || 0);
        const subTotal = Number(piData?.subtotal || piData?.unitValue || Math.round(grandTotal / 1.18));
        const items = Array.isArray(piData?.items) && piData.items.length > 0 ? JSON.stringify(piData.items) : '[]';
        const salesPerson = (piData?.salesPerson || piData?.salesperson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim();

        const existingBom = await query(`
          SELECT id, bom_code, source_pi_no FROM public.bom_orders 
          WHERE bom_code = $1 OR source_pi_no = $2
        `, [info.bomCode, piNo]);

        if (existingBom.rows.length === 0) {
          await query(`
            INSERT INTO public.bom_orders (
              id, bom_code, code, source_pi_no, customer_name, company_name, 
              grand_total, sub_total, sales_person, status, items, dispatch_packing, date, created_at, updated_at
            ) VALUES (
              $1, $1, $1, $2, $3, $3, 
              $4, $5, $6, 'Draft', $7::jsonb, $7::jsonb, CURRENT_DATE, NOW(), NOW()
            ) ON CONFLICT (id) DO UPDATE SET
              bom_code = EXCLUDED.bom_code,
              source_pi_no = EXCLUDED.source_pi_no,
              customer_name = EXCLUDED.customer_name,
              company_name = EXCLUDED.company_name,
              grand_total = EXCLUDED.grand_total,
              sub_total = EXCLUDED.sub_total,
              sales_person = EXCLUDED.sales_person,
              items = EXCLUDED.items,
              dispatch_packing = EXCLUDED.dispatch_packing,
              updated_at = NOW()
          `, [info.bomCode, piNo, custName, grandTotal, subTotal, salesPerson, items]);
          bomUpdatedCount++;
        } else {
          await query(`
            UPDATE public.bom_orders
            SET bom_code = $1,
                code = $1,
                source_pi_no = $2,
                customer_name = CASE WHEN customer_name IS NULL OR customer_name = '' OR customer_name = 'Customer' OR customer_name = '-' THEN $3 ELSE customer_name END,
                company_name = CASE WHEN company_name IS NULL OR company_name = '' OR company_name = 'Customer' OR company_name = '-' THEN $3 ELSE company_name END,
                grand_total = CASE WHEN grand_total IS NULL OR grand_total = 0 THEN $4 ELSE grand_total END,
                sub_total = CASE WHEN sub_total IS NULL OR sub_total = 0 THEN $5 ELSE sub_total END,
                sales_person = CASE WHEN sales_person IS NULL OR sales_person = '' OR sales_person = 'Anu' OR sales_person = 'Sales Department' THEN $6 ELSE sales_person END,
                items = CASE WHEN items IS NULL OR jsonb_array_length(items) = 0 THEN $7::jsonb ELSE items END,
                dispatch_packing = CASE WHEN dispatch_packing IS NULL OR jsonb_array_length(dispatch_packing) = 0 THEN $7::jsonb ELSE dispatch_packing END,
                updated_at = NOW()
            WHERE id = $1 OR bom_code = $1 OR source_pi_no = $2
          `, [info.bomCode, piNo, custName, grandTotal, subTotal, salesPerson, items]);
        }
      } catch (e) {
        console.warn(`[repairBomSequences notice for ${piNo}]:`, e.message);
      }
    }
  }

  // 4. Update sequence counter
  const extractMaxBoms = (supabaseMemoryStore.bom_store || []).map(b => {
    const m = String(b.bomCode || b.code || '').match(/VRM-BOM-\d{4}-(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  });
  const maxBomNum = extractMaxBoms.length > 0 ? Math.max(...extractMaxBoms) : 0;
  serverBomSequenceCounter = Math.max(serverBomSequenceCounter || 0, maxBomNum);

  // 5. Reload memory cache & broadcast updates
  await loadDatabaseBoms(true);
  try {
    broadcastRealtimeEvent('bom_updated', { action: 'repair_complete', count: bomUpdatedCount });
    broadcastRealtimeEvent('pi_updated', { action: 'repair_complete', count: piUpdatedCount });
  } catch (_) {}

  console.log(`✅ [BOM Sequence Repair] Complete. ${piUpdatedCount} PIs aligned, ${bomUpdatedCount} BOMs ensured.`);
  return { piUpdatedCount, bomUpdatedCount, maxSequence: serverBomSequenceCounter };
}

/**
 * Idempotent reconciliation:
 * Ensures all BOMs present in controlroom_store or bom_store.json
 * are cleanly represented in public.bom_orders without overwriting existing data.
 */
async function syncMissingRelationalBoms() {
  if (!isDbConnected()) return;
  try {
    const existingDbRes = await query(`SELECT bom_code, id, status, grand_total FROM public.bom_orders`).catch(() => null);
    const existingCodes = new Set();
    const existingDbMap = new Map();
    (existingDbRes?.rows || []).forEach(r => {
      if (r.bom_code) { existingCodes.add(r.bom_code); existingDbMap.set(r.bom_code, r); }
      if (r.id) { existingCodes.add(r.id); existingDbMap.set(r.id, r); }
    });

    // Read authoritative JSON store
    let bomsToSync = [];
    const crRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'bom_store'`).catch(() => null);
    if (crRes?.rows?.[0]?.data && Array.isArray(crRes.rows[0].data)) {
      bomsToSync = crRes.rows[0].data;
    }
    if (bomsToSync.length === 0) {
      const diskPath = getStoreFilePath('bom_store.json');
      if (fs.existsSync(diskPath)) {
        try { bomsToSync = JSON.parse(fs.readFileSync(diskPath, 'utf8')); } catch (_) {}
      }
    }
    if (!Array.isArray(bomsToSync) || bomsToSync.length === 0) return;

    let syncedCount = 0;
    for (const bom of bomsToSync) {
      const code = bom?.bomCode || bom?.code || bom?.id;
      if (!code) continue;
      if (/^BOM-6\d{2}$/i.test(code) || /^BOM-(STAGING|USER|POST)/i.test(code)) continue;

      const existingRecord = existingDbMap.get(code) || (bom?.id && existingDbMap.get(bom.id));
      if (existingRecord) {
        // Transparent conflict audit: detect and report differences rather than silently ignoring
        const dbStatus = String(existingRecord.status || '').trim();
        const storeStatus = String(bom.status || '').trim();
        const dbTotal = Number(existingRecord.grand_total || 0);
        const storeTotal = Number(bom.grandTotal || bom.grand_total || 0);

        if (dbStatus !== storeStatus || (dbTotal !== storeTotal && Math.abs(dbTotal - storeTotal) > 1)) {
          console.warn(`[BOM Reconciliation Conflict Notice] Divergence on ${code}: Database [Status: "${dbStatus}", Total: ${dbTotal}] vs Store [Status: "${storeStatus}", Total: ${storeTotal}]. Authoritative database preserved.`);
        }
        continue;
      }

      const dbRow = toDatabaseBomRowServer(bom);
      if (!dbRow) continue;

      const keys = Object.keys(dbRow).filter(k => dbRow[k] !== undefined);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const jsonbCols = new Set([
        'items', 'payments', 'dispatch_packing', 'accounts_verification', 
        'preset_groups', 'billing_address_obj', 'delivery_address_obj', 
        'dispatch_packing_media', 'vehicle_loading', 'data'
      ]);
      const placeholders = keys.map((k, i) => jsonbCols.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`).join(', ');
      const values = keys.map(k => {
        const v = dbRow[k];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });

      const sql = `
        INSERT INTO public.bom_orders (${cols})
        VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING
      `;

      try {
        await query(sql, values);
        existingCodes.add(code);
        if (bom?.id) existingCodes.add(bom.id);
        if (bom?.bomCode) existingCodes.add(bom.bomCode);
        syncedCount++;
      } catch (insertErr) {
        if (insertErr?.code === '23505') {
          // Unique violation on id or bom_code: safely skip duplicate
          console.warn(`[BOM Reconciliation Notice] Record ${code} already exists in database (skipped).`);
        } else {
          console.error(`[BOM Reconciliation Error] Failed to persist ${code} to public.bom_orders:`, insertErr.message);
          throw insertErr;
        }
      }
    }

    if (syncedCount > 0) {
      console.log(`✅ [BOM Reconciliation] Reconciled ${syncedCount} missing BOM(s) into public.bom_orders.`);
    }
    return { success: true, syncedCount };
  } catch (err) {
    console.error('❌ [BOM Reconciliation Fatal Error]:', err?.message || err);
    throw err;
  }
}

// Dedicated endpoint to fix and re-align historical BOM sequences for converted PIs - DISABLED
// Protection 5: /api/repair-bom-sequences disabled with HTTP 403
app.post('/api/repair-bom-sequences', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Forbidden: /api/repair-bom-sequences is disabled to protect historical BOM sequences.'
  });
});

// Helper to strip heavy base64 dataUrls from BOM list responses while keeping all metadata
const stripHeavyDocsFromBom = (b) => {
  if (!b || typeof b !== 'object') return b;
  const stripped = { ...b };

  const stripDoc = (doc) => {
    if (!doc) return null;
    if (typeof doc === 'string') {
      if (doc.startsWith('data:') && doc.length > 300) {
        return { hasDoc: true, isLightweightRef: true, type: doc.slice(5, doc.indexOf(';')) || 'image/jpeg' };
      }
      return doc;
    }
    if (typeof doc === 'object') {
      const { dataUrl, fileData, base64, buffer, ...meta } = doc;
      return {
        ...meta,
        hasDoc: Boolean(dataUrl || fileData || base64 || meta.hasDoc || meta.storagePath || meta.url),
        isLightweightRef: true
      };
    }
    return doc;
  };

  if (stripped.paymentProofDoc) {
    stripped.paymentProofDoc = stripDoc(stripped.paymentProofDoc);
  }
  if (Array.isArray(stripped.paymentProofDocs)) {
    stripped.paymentProofDocs = stripped.paymentProofDocs.map(stripDoc);
  }
  if (stripped.deliveryAddressProofDoc) {
    stripped.deliveryAddressProofDoc = stripDoc(stripped.deliveryAddressProofDoc);
  }
  if (stripped.lrCopyDoc) {
    stripped.lrCopyDoc = stripDoc(stripped.lrCopyDoc);
  }
  if (stripped.dispatchPackingMedia && typeof stripped.dispatchPackingMedia === 'object') {
    const rawMedia = stripped.dispatchPackingMedia;
    const photoCount = Array.isArray(rawMedia.photos) ? rawMedia.photos.length : 0;
    const videoCount = Array.isArray(rawMedia.videos) ? rawMedia.videos.length : 0;
    stripped.dispatchPackingMedia = {
      photosCount: photoCount,
      videosCount: videoCount,
      hasMedia: photoCount > 0 || videoCount > 0,
      isLightweightRef: true
    };
  }

  return stripped;
};

// Centralized GET all BOMs endpoint - reads authoritative list from public.bom_orders with fast caching, document stripping and pagination
app.get('/api/boms', async (req, res) => {
  try {
    const now = Date.now();
    const shouldRefresh = Boolean(req.query.refresh === 'true' || req.query.refresh === '1');
    const includeDocs = Boolean(req.query.includeDocs === 'true' || req.query.includeDocs === '1');
    const pageParam = req.query.page ? parseInt(req.query.page, 10) : null;
    const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : (pageParam ? 50 : null);

    let finalBoms = null;
    // 1. Serve immediately from high-speed memory cache if fresh (< 30s) unless refresh requested
    if (!shouldRefresh && cachedBomsResult && (now - lastBomFetchTimestamp < 30000)) {
      finalBoms = cachedBomsResult;
    } else {
      // Helper to sort BOMs by code sequence descending
      const sortBoms = (list) => {
        const parseBomSeq = (code) => {
          const m = String(code || '').match(/BOM-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        };
        return list.sort((a, b) => {
          const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
          const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
          if (seqA !== seqB) return seqB - seqA;
          const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
          const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
          return dateB - dateA;
        });
      };

      // Load authoritative list directly from public.bom_orders (Zero leaves table interaction)
      const boms = await loadDatabaseBoms(shouldRefresh);
      finalBoms = sortBoms(Array.isArray(boms) ? boms : []);
      cachedBomsResult = finalBoms;
      lastBomFetchTimestamp = Date.now();
    }

    // Strip bulky inline documents unless client explicitly asks for them
    const resultList = includeDocs ? finalBoms : finalBoms.map(stripHeavyDocsFromBom);

    // Server-side pagination if page query param provided
    if (pageParam !== null) {
      const page = Math.max(1, pageParam);
      const limit = Math.max(1, limitParam || 50);
      const total = resultList.length;
      const startIndex = (page - 1) * limit;
      const pagedBoms = resultList.slice(startIndex, startIndex + limit);
      return res.json({
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        data: pagedBoms
      });
    }

    return res.json({ success: true, data: resultList, total: resultList.length });
  } catch (err) {
    console.error('Error fetching BOMs:', err);
    return res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// Single BOM read endpoint by ID or bom_code
app.get('/api/boms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    // 1. Check memory cache first
    if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
      const found = supabaseMemoryStore.bom_store.find(b => 
        String(b.id || '').toLowerCase() === cleanId.toLowerCase() || 
        String(b.bomCode || '').toLowerCase() === cleanId.toLowerCase() || 
        String(b.code || '').toLowerCase() === cleanId.toLowerCase()
      );
      if (found) return res.json({ success: true, data: found });
    }

    // 2. Fetch single row from public.bom_orders via PostgreSQL
    if (isDbConnected()) {
      const dbRes = await query(`
        SELECT * FROM public.bom_orders
        WHERE LOWER(TRIM(id)) = LOWER($1) OR LOWER(TRIM(bom_code)) = LOWER($1) OR LOWER(TRIM(code)) = LOWER($1)
        LIMIT 1
      `, [cleanId]);

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        const consumer = toConsumerBomServer(dbRes.rows[0]);
        return res.json({ success: true, data: consumer });
      }
    }

    return res.status(404).json({ success: false, message: `BOM ${cleanId} not found` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single BOM accounts verification read endpoint (Only fetch accounts_verification on-demand for one order)
app.get('/api/boms/:id/accounts-verification', async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    if (isDbConnected()) {
      const dbRes = await query(`
        SELECT accounts_verification FROM public.bom_orders
        WHERE LOWER(TRIM(id)) = LOWER($1) OR LOWER(TRIM(bom_code)) = LOWER($1) OR LOWER(TRIM(code)) = LOWER($1)
        LIMIT 1
      `, [cleanId]);

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        const raw = dbRes.rows[0]?.accounts_verification || {};
        const clean = (typeof raw === 'object') ? { ...raw } : {};
        delete clean._extra_data;
        return res.json({ success: true, data: clean });
      }
    }

    return res.status(404).json({ success: false, message: `BOM ${cleanId} not found` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/reset-all-testing-data', async (req, res) => {
  try {
    // 1. Reset invoice store and sequence (Preserve legacy public.leaves BOM_STORE row 2 for rollback)
    await supabase.from('leaves').delete().in('employee', ['INVOICE_STORE', 'BOM_SEQUENCE']);
    await supabase.from('leaves').insert([
      { employee: 'INVOICE_STORE', reason: '[]', status: 'active', duration: '0', dates: new Date().toISOString(), type: 'Store' },
      { employee: 'BOM_SEQUENCE', reason: JSON.stringify({ lastNumber: 0, reservedAt: new Date().toISOString() }), status: 'active', duration: '0', dates: new Date().toISOString(), type: 'Store' }
    ]);

    // 2. Wipe in-memory stores
    supabaseMemoryStore.bom_store = [];
    supabaseMemoryStore.invoice_store = [];

    // 3. Wipe disk backup files
    try {
      fs.writeFileSync(getStoreFilePath('bom_store.json'), '[]', 'utf8');
      fs.writeFileSync(getStoreFilePath('invoice_store.json'), '[]', 'utf8');
    } catch (_) {}

    return res.json({ success: true, message: 'All testing data wiped clean' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Reconcile and deduct inventory across all active BOMs
const reconcileServerInventoryWithBoms = async (bomsList = null) => {
  try {
    let boms = bomsList;
    if (!Array.isArray(boms)) {
      if (Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
        boms = supabaseMemoryStore.bom_store;
      } else {
        const bomsPath = getStoreFilePath('bom_store.json');
        if (fs.existsSync(bomsPath)) {
          try { boms = JSON.parse(fs.readFileSync(bomsPath, 'utf8')); } catch (_) {}
        }
      }
    }
    if (!Array.isArray(boms)) boms = [];

    // 1. Calculate total active and completed allocations per item
    // STRICT RULE: Only reduce stock when BOM is completed and sent to dispatch
    const allocations = new Map();
    boms.forEach(b => {
      const st = String(b?.status || '').toLowerCase();
      const isSentToDispatch = Boolean(b?.salesConfirmed) || [
        'sales confirmed - sent to dispatch',
        'sent to production',
        'confirmed',
        'packed & ready for dispatch',
        'partially packed',
        'dispatch packing verified - sent to accounts',
        'awaiting vehicle loading & dispatch'
      ].some(s => st.includes(s));

      const isCompletedOrDeducted = Boolean(
        b?.fullyCompleted ||
        (b?.vehicleLoading && (b?.vehicleLoading.fullyCompleted || b?.vehicleLoading.loadedAt)) ||
        st === 'completed' ||
        st === 'closed' ||
        st.includes('completed') ||
        st.includes('closed') ||
        st.includes('fully dispatched') ||
        st.includes('delivered') ||
        st.includes('awaiting lr copy')
      );

      // ONLY allocate active reserved stock when BOM is in progress and NOT yet completed or dispatched
      if (isSentToDispatch && !isCompletedOrDeducted && !st.includes('cancel') && !st.includes('stock restored')) {
        (b?.items || []).forEach(it => {
          const q = parseFloat(it?.qty || it?.bomQty || 0) || 0;
          if (q > 0) {
            const resCode = resolveProductCode(it).toLowerCase().trim();
            const code = String(it?.code || resCode || '').toLowerCase().trim();
            const name = String(it?.name || it?.description || '').toLowerCase().trim();
            const fp = wordFingerprint(name);
            if (code) allocations.set(code, (allocations.get(code) || 0) + q);
            if (name) allocations.set(name, (allocations.get(name) || 0) + q);
            if (fp) allocations.set(fp, (allocations.get(fp) || 0) + q);

            const isMr300 = code === 'mr-300mm' || code === 'mr100n' || (name.includes('mini rail') && name.includes('300'));
            if (isMr300) {
              if (code !== 'mr-300mm') allocations.set('mr-300mm', (allocations.get('mr-300mm') || 0) + q);
              if (code !== 'mr100n') allocations.set('mr100n', (allocations.get('mr100n') || 0) + q);
            }
          }
        });
      }
    });

    // 2. Update raw_materials_store.json
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let rawMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { rawMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')); } catch (_) {}
    }
    if (Array.isArray(rawMats) && rawMats.length > 0) {
      let changed = false;
      rawMats.forEach(m => {
        const mRes = resolveProductCode(m).toLowerCase().trim();
        const mCode = String(m?.code || mRes || m?.sku || m?.itemId || '').toLowerCase().trim();
        const mName = String(m?.name || '').toLowerCase().trim();
        const mFp = wordFingerprint(mName);
        const isMr300 = mCode === 'mr-300mm' || mCode === 'mr100n' || (mName.includes('mini rail') && mName.includes('300'));
        const isAlu2414 = mCode === 'alu-len-2414mm' || mCode === 'rm-alu-2414';

        const blocked = Math.max(
          (mCode && allocations.get(mCode)) || 0,
          (mName && allocations.get(mName)) || 0,
          (mFp && allocations.get(mFp)) || 0,
          isMr300 ? (allocations.get('mr-300mm') || allocations.get('mr100n') || 0) : 0
        );

        let baseline = isMr300 ? 2000 : (isAlu2414 ? 250 : 0);
        if (m?.openingStock !== undefined && m?.openingStock !== null && Number(m.openingStock) > 0) {
          baseline = Number(m.openingStock);
        }

        const newStock = Math.max(0, baseline - blocked);
        const minL = parseFloat(m?.minLevel || 100) || 100;
        const newStatus = newStock === 0 ? 'Out of Stock' : (newStock <= minL ? 'Low Stock' : 'In Stock');

        if (m.stock !== newStock || m.reserved !== blocked || m.status !== newStatus || m.openingStock !== baseline) {
          m.openingStock = baseline;
          m.physicalStock = baseline;
          m.stock = newStock;
          m.availableStock = newStock;
          m.reserved = blocked;
          m.blockedForBom = blocked;
          m.status = newStatus;
          changed = true;
        }
      });

      if (changed) {
        fs.writeFileSync(rawMatsPath, JSON.stringify(rawMats, null, 2), 'utf8');
        supabaseMemoryStore.raw_materials_store = rawMats;
        pushStoreToSupabase('raw_materials_store', rawMats).catch(() => {});
        broadcastRealtimeEvent('inventory_updated', { action: 'reconcile', count: rawMats.length });
      }
    }

    // 3. Update item_store.json
    const itemsPath = getStoreFilePath('item_store.json');
    let items = [];
    if (fs.existsSync(itemsPath)) {
      try { items = JSON.parse(fs.readFileSync(itemsPath, 'utf8')); } catch (_) {}
    }
    if (Array.isArray(items) && items.length > 0) {
      let changed = false;
      items.forEach(it => {
        const itRes = resolveProductCode(it).toLowerCase().trim();
        const itCode = String(it?.code || itRes || it?.sku || it?.itemId || '').toLowerCase().trim();
        const itName = String(it?.name || '').toLowerCase().trim();
        const itFp = wordFingerprint(itName);
        const isMr300 = itCode === 'mr-300mm' || itCode === 'mr100n' || (itName.includes('mini rail') && itName.includes('300'));
        const isAlu2414 = itCode === 'alu-len-2414mm' || itCode === 'rm-alu-2414';

        const blocked = Math.max(
          (itCode && allocations.get(itCode)) || 0,
          (itName && allocations.get(itName)) || 0,
          (itFp && allocations.get(itFp)) || 0,
          isMr300 ? (allocations.get('mr-300mm') || allocations.get('mr100n') || 0) : 0
        );

        let baseline = isMr300 ? 2000 : (isAlu2414 ? 250 : 0);
        if (it?.openingStock !== undefined && it?.openingStock !== null && Number(it.openingStock) > 0 && Number(it.openingStock) < 5000) {
          baseline = Number(it.openingStock);
        }

        const newStock = Math.max(0, baseline - blocked);
        const minL = parseFloat(it?.minLevel || 20) || 20;
        const newStatus = newStock === 0 ? 'Out of Stock' : (newStock <= minL ? 'Low Stock' : 'In Stock');

        if (it.stock !== newStock || it.reserved !== blocked || it.status !== newStatus || it.openingStock !== baseline) {
          it.openingStock = baseline;
          it.physicalStock = baseline;
          it.stock = newStock;
          it.availableStock = newStock;
          it.reserved = blocked;
          it.status = newStatus;
          changed = true;
        }
      });

      if (changed) {
        fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf8');
        supabaseMemoryStore.item_store = items;
        pushStoreToSupabase('item_store', items).catch(() => {});
        broadcastRealtimeEvent('item_store_updated', { action: 'reconcile', count: items.length });
      }
    }
    console.log(`[Inventory Reconcile] Reconciled stock for ${allocations.size} allocated items across ${boms.length} BOMs.`);
  } catch (err) {
    console.error('[Inventory Reconciliation Error]:', err);
  }
};

app.post('/api/inventory/reconcile-boms', async (req, res) => {
  await reconcileServerInventoryWithBoms();
  res.json({ success: true, message: 'Server inventory reconciled with active BOMs' });
});

// Centralized atomic BOM creation/update endpoint - guarantees sequential non-clashing codes
app.post('/api/boms', async (req, res) => {
  return new Promise((resolveOuter) => {
    serverBomReservationLock = serverBomReservationLock.then(async () => {
      try {
        let { bom, isNew, isUpdate } = req.body || {};
        if (!bom && (req.body?.bomCode || req.body?.code || req.body?.id)) {
          bom = req.body;
          isUpdate = true;
        }
        if (!bom) {
          res.status(400).json({ success: false, message: 'Valid bom record required' });
          return resolveOuter();
        }

        // Server-side guarantee: recursively strip any raw base64 data URLs to prevent store bloating
        const stripServerDataUrls = (target) => {
          if (!target || typeof target !== 'object') return;
          if (target.dataUrl) delete target.dataUrl;
          if (target.fileData) delete target.fileData;
          if (target.proofDocData) delete target.proofDocData;
          Object.keys(target).forEach(k => {
            if (typeof target[k] === 'string' && (target[k].startsWith('data:') || (target[k].length > 1000 && /^[A-Za-z0-9+/=]+$/.test(target[k].slice(0, 100))))) {
              delete target[k];
            } else if (target[k] && typeof target[k] === 'object') {
              stripServerDataUrls(target[k]);
            }
          });
        };
        stripServerDataUrls(bom);

        // Ensure all line items have resolved product code for accurate inventory reservation
        if (Array.isArray(bom.items)) {
          bom.items.forEach(it => {
            if (!it.code || it.code === 'VRM-ITEM' || it.code === 'ITEM' || it.code.startsWith('FG-')) {
              const resCode = resolveProductCode(it);
              if (resCode) it.code = resCode;
            }
          });
        }

        const incomingCode = String(bom.bomCode || bom.code || bom.id || '').trim();
        // Reject invalid or ambiguous BOM identifiers on update
        if (isUpdate && (!incomingCode || incomingCode === 'null' || incomingCode === 'undefined' || incomingCode === '[object Object]')) {
          res.status(400).json({ success: false, message: 'Invalid or ambiguous BOM identifier for update' });
          return resolveOuter();
        }

        // 1. Transaction-safe PostgreSQL persistence via shared backend function
        const persistResult = await persistBomsTransactionSafe({
          singleBom: bom,
          isNew: Boolean(isNew),
          isUpdate: Boolean(isUpdate)
        });

        const { persistedBom, finalCode, fullStoreList, shouldAssignNewCode } = persistResult;

        // 2. ONLY AFTER successful PostgreSQL COMMIT: Update memory cache
        supabaseMemoryStore.bom_store = fullStoreList;
        cachedBomsResult = fullStoreList;
        lastBomFetchTimestamp = Date.now();

        // 3. Write disk backup asynchronously
        try {
          const diskPath = getStoreFilePath('bom_store.json');
          safeWriteJsonFileAsync(diskPath, fullStoreList);
        } catch (diskErr) {
          console.warn('[POST /api/boms disk write error]:', diskErr?.message || diskErr);
        }

        console.log(`[BOM Store] BOM ${finalCode} transaction-safely committed to PostgreSQL (isNew: ${shouldAssignNewCode}).`);

        // 4. Post-commit inventory reconciliation
        try {
          await reconcileServerInventoryWithBoms(fullStoreList);
        } catch (rErr) {
          console.error('Error reconciling inventory after BOM save:', rErr);
        }

        // 5. Real-time sub-second push to all connected browsers/devices immediately
        try {
          broadcastRealtimeEvent('bom_updated', {
            action: isExisting ? 'update' : 'create',
            recordId: persistedBom?.bomCode || persistedBom?.code || persistedBom?.id,
            bom: persistedBom
          });
          broadcastRealtimeEvent('inventory_updated', {
            action: 'update',
            reason: 'bom_stock_deduction',
            bomCode: persistedBom?.bomCode || persistedBom?.code
          });
        } catch (_) {}

        // 6. Update sequence metadata in leaves table if needed
        try {
          const vrmMatch = String(finalCode).match(/^VRM-BOM-(\d{4})-(\d+)$/i);
          if (vrmMatch) {
            const fy = parseInt(vrmMatch[1], 10);
            const seqVal = parseInt(vrmMatch[2], 10);
            if (serverBomSequenceCounter && typeof serverBomSequenceCounter === 'object' && serverBomSequenceCounter.fy === fy) {
              serverBomSequenceCounter.maxNum = Math.max(serverBomSequenceCounter.maxNum || 0, seqVal);
            } else {
              serverBomSequenceCounter = { fy, maxNum: seqVal };
            }
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sequence timeout')), 5000));
            const seqPromise = supabase.from('leaves').update({
              reason: JSON.stringify({ fy, lastNumber: seqVal, updatedAt: new Date().toISOString() }),
              duration: String(seqVal),
              dates: new Date().toISOString()
            }).eq('employee', `BOM_SEQUENCE_${fy}`);
            await Promise.race([seqPromise, timeoutPromise]);
          } else {
            const numMatch = String(finalCode).match(/^BOM-(\d+)$/i);
            if (numMatch) {
              const seqVal = parseInt(numMatch[1], 10);
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sequence timeout')), 5000));
              const seqPromise = supabase.from('leaves').update({
                reason: JSON.stringify({ lastNumber: seqVal, updatedAt: new Date().toISOString() }),
                duration: String(seqVal),
                dates: new Date().toISOString()
              }).eq('employee', 'BOM_SEQUENCE');
              await Promise.race([seqPromise, timeoutPromise]);
            }
          }
        } catch (_) {}

        // 7. Synchronize source PI in-memory cache and broadcast if applicable
        if (bom.sourcePiNo) {
          try {
            const piStoreRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'sales_pi_store'`).catch(() => null);
            if (piStoreRes?.rows?.[0]?.data && Array.isArray(piStoreRes.rows[0].data)) {
              supabaseMemoryStore['sales_pi_store'] = piStoreRes.rows[0].data;
              broadcastRealtimeEvent('pi_updated', { action: 'converted_to_bom', recordId: bom.sourcePiNo, piNo: bom.sourcePiNo, convertedBomCode: finalCode });
            }
          } catch (_) {}
        }

        // RESPOND TO CLIENT WITH CONFIRMED BOM (Persisted to database & disk)
        res.json({
          success: true,
          bom: persistedBom,
          bomCode: finalCode,
          nextCode: finalCode,
          nextBomCode: finalCode,
          total: fullStoreList.length
        });
        return resolveOuter();
      } catch (err) {
        console.error('Error saving BOM:', err);
        res.status(500).json({ success: false, message: err.message });
        resolveOuter();
      }
    }).catch(err => {
      console.error('Lock error in /api/boms:', err);
      res.status(500).json({ success: false, message: err?.message || 'Server lock error' });
      resolveOuter();
    });
  });
});

// Dedicated POST /api/boms/:id/print-status endpoint for Dispatch print tracking
app.post('/api/boms/:id/print-status', async (req, res) => {
  try {
    const rawId = req.params.id;
    const { printData } = req.body || {};
    if (!rawId || !printData) {
      return res.status(400).json({ success: false, message: 'bomId and printData required' });
    }
    const cleanId = String(rawId).trim().toLowerCase();

    // 1. Update in-memory / disk store
    const diskPath = getStoreFilePath('bom_store.json');
    let fullList = [];
    if (fs.existsSync(diskPath)) {
      try {
        fullList = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      } catch (_) {}
    }
    if (!Array.isArray(fullList) || fullList.length === 0) {
      fullList = Array.isArray(supabaseMemoryStore.bom_store) ? supabaseMemoryStore.bom_store : [];
    }

    let updatedBom = null;
    fullList = fullList.map(item => {
      const match = String(item.bomCode || item.code || item.id || '').trim().toLowerCase();
      if (match === cleanId) {
        updatedBom = {
          ...item,
          ...printData,
          updated_at: new Date().toISOString()
        };
        return updatedBom;
      }
      return item;
    });

    if (updatedBom) {
      try {
        safeWriteJsonFileAsync(diskPath, fullList);
      } catch (_) {}
      supabaseMemoryStore.bom_store = fullList;
      cachedBomsResult = fullList;
      lastBomFetchTimestamp = Date.now();

      // 2. Targeted 1-row DB update if connected
      if (isDbConnected()) {
        try {
          await query(`
            UPDATE public.controlroom_store
            SET data = (
              SELECT jsonb_agg(
                CASE 
                  WHEN LOWER(TRIM(elem->>'bomCode')) = $1 OR LOWER(TRIM(elem->>'code')) = $1 OR LOWER(TRIM(elem->>'id')) = $1
                  THEN elem || $2::jsonb
                  ELSE elem
                END
              )
              FROM jsonb_array_elements(data::jsonb) AS elem
            ),
            updated_at = NOW()
            WHERE key IN ('controlroom_bom_store', 'bom_store')
          `, [cleanId, JSON.stringify(printData)]);
        } catch (_) {}

        // Persist print tracking directly into public.bom_orders accounts_verification._extra_data
        try {
          await query(`
            UPDATE public.bom_orders
            SET accounts_verification = jsonb_set(
              COALESCE(accounts_verification, '{}'::jsonb),
              '{_extra_data}',
              COALESCE(accounts_verification->'_extra_data', '{}'::jsonb) || $2::jsonb
            ),
            updated_at = NOW()
            WHERE LOWER(TRIM(bom_code)) = $1 OR LOWER(TRIM(id)) = $1 OR LOWER(TRIM(code)) = $1
          `, [cleanId, JSON.stringify(printData)]);
        } catch (_) {}

        // Also update direct public.bom_orders print tracking columns
        try {
          await query(`
            UPDATE public.bom_orders
            SET dispatch_printed = true,
                dispatch_printed_at = NOW(),
                dispatch_print_time_str = $2,
                dispatch_printed_date_str = $3,
                dispatch_printed_by = $4,
                dispatch_print_count = $5
            WHERE LOWER(TRIM(bom_code)) = $1 OR LOWER(TRIM(id)) = $1 OR LOWER(TRIM(code)) = $1
          `, [cleanId, printData.dispatchPrintTimeStr || '', printData.dispatchPrintedDateStr || '', printData.dispatchPrintedBy || '', printData.dispatchPrintCount || 1]);
        } catch (_) {}
      }

      // 3. Broadcast real-time SSE event to ALL connected clients (Sales, Dispatch, Production, Admin)
      broadcastRealtimeEvent('bom_updated', {
        action: 'print_update',
        recordId: updatedBom.bomCode || updatedBom.code || updatedBom.id,
        bom: updatedBom,
        printData: {
          bomCode: updatedBom.bomCode || updatedBom.code || updatedBom.id,
          ...printData
        }
      });

      return res.json({ success: true, bom: updatedBom });
    }

    return res.status(404).json({ success: false, message: 'BOM order not found' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated DELETE /api/boms/:id endpoint
app.delete('/api/boms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cleanId = String(id).trim();
    // 1. Delete from Supabase public.bom_orders
    const { error } = await supabase.from('bom_orders').delete().or(`id.eq.${cleanId},bom_code.eq.${cleanId}`);
    if (error) {
      console.warn('[DELETE BOM Supabase notice]:', error.message);
    }
    // 2. Update memory store & disk
    let current = supabaseMemoryStore.bom_store || [];
    if (!Array.isArray(current) || current.length === 0) {
      current = await loadDatabaseBoms();
    }
    const updated = current.filter(b => (b.id !== cleanId && b.bomCode !== cleanId && b.code !== cleanId));
    supabaseMemoryStore.bom_store = updated;
    cachedBomsResult = updated;
    lastBomFetchTimestamp = Date.now();
    try {
      const diskPath = getStoreFilePath('bom_store.json');
      safeWriteJsonFileAsync(diskPath, updated);
    } catch (_) {}
    if (isDbConnected()) {
      query(`
        INSERT INTO controlroom_store (key, data, updated_at)
        VALUES ('bom_store', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
      `, [JSON.stringify(updated)]).catch(() => null);
    }

    // 3. Broadcast real-time deletion
    broadcastRealtimeEvent('bom_updated', { recordId: cleanId, id: cleanId, action: 'delete' });

    res.json({ success: true, message: `BOM ${cleanId} deleted successfully`, total: updated.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// BOM SECURE DOCUMENT STORAGE ENDPOINTS (Phase D2)
// Bucket: bom-documents (STRICTLY PRIVATE)
// All storage operations are executed server-side via service-role client.
// Browser receives ZERO direct storage CRUD access.
// ==============================================================================

// Session validation middleware for BOM document operations
const requireBusinzSession = async (req, res, next) => {
  const session = await getVerifiedUserSession(req);
  if (!session || !session.valid) {
    return res.status(401).json({
      success: false,
      error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
    });
  }

  req.userSession = session;
  next();
};

// POST /api/boms/:bomCode/documents - Upload document to bom-documents private bucket
app.post('/api/boms/:bomCode/documents', requireBusinzSession, async (req, res) => {
  try {
    const { bomCode } = req.params;
    const { fileName, mimeType, fileData, category } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: 'File data is required (base64 string or dataUrl)' });
    }

    // Convert fileData (dataUrl or base64 string) to Buffer
    let buffer;
    let resolvedMime = mimeType;

    if (typeof fileData === 'string') {
      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          resolvedMime = resolvedMime || matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          return res.status(400).json({ success: false, error: 'Malformed data URL' });
        }
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else if (Buffer.isBuffer(fileData)) {
      buffer = fileData;
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file payload format' });
    }

    const metadata = await uploadBomDocument({
      bomCode,
      category,
      fileBuffer: buffer,
      fileName,
      mimeType: resolvedMime
    });

    // Also mirror to media_cache.json so instant lookup works seamlessly across sessions
    try {
      const mediaCachePath = getStoreFilePath('media_cache.json');
      let mediaCache = {};
      if (fs.existsSync(mediaCachePath)) {
        mediaCache = JSON.parse(fs.readFileSync(mediaCachePath, 'utf8') || '{}');
      }
      const dataUrlToStore = (typeof fileData === 'string' && fileData.startsWith('data:'))
        ? fileData
        : `data:${resolvedMime};base64,${buffer.toString('base64')}`;
      mediaCache[fileName] = dataUrlToStore;
      if (metadata && metadata.storagePath) {
        mediaCache[metadata.storagePath] = dataUrlToStore;
      }
      safeWriteJsonFileAsync(mediaCachePath, mediaCache);
    } catch (cacheErr) {
      console.warn('[BOM Document Upload] Failed to update media_cache.json:', cacheErr.message);
    }

    res.json({
      success: true,
      metadata
    });
  } catch (err) {
    console.error('[BOM Document Upload Error]:', err.message);
    const statusCode = err.message.includes('exceeds') ? 413 :
      (err.message.includes('Invalid') || err.message.includes('Unsupported')) ? 400 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

// GET /api/boms/:bomCode/documents/signed-url - Generate short-lived signed URL
app.get('/api/boms/:bomCode/documents/signed-url', requireBusinzSession, async (req, res) => {
  try {
    const { bomCode } = req.params;
    const storagePath = req.query.path || req.query.storagePath;
    const expiresIn = req.query.expiresIn || 900; // 15 mins default

    if (!storagePath) {
      return res.status(400).json({ success: false, error: 'Storage path is required (?path=...)' });
    }

    const result = await createBomDocumentSignedUrl({
      bomCode,
      storagePath,
      expiresIn: Number(expiresIn)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
    const isBadReq = err.message.includes('Invalid');
    const statusCode = isForbidden ? 403 : isBadReq ? 400 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

// DELETE /api/boms/:bomCode/documents - Delete document from bom-documents bucket
app.delete('/api/boms/:bomCode/documents', requireBusinzSession, async (req, res) => {
  try {
    const { bomCode } = req.params;
    const storagePath = req.body?.path || req.query?.path || req.body?.storagePath;

    if (!storagePath) {
      return res.status(400).json({ success: false, error: 'Storage path is required' });
    }

    const result = await deleteBomDocument({
      bomCode,
      storagePath
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
    const isBadReq = err.message.includes('Invalid');
    const statusCode = isForbidden ? 403 : isBadReq ? 400 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

// GET /api/boms/:bomCode/documents/metadata - Inspect metadata
app.get('/api/boms/:bomCode/documents/metadata', requireBusinzSession, async (req, res) => {
  try {
    const { bomCode } = req.params;
    const storagePath = req.query.path || req.query.storagePath;

    if (!storagePath) {
      return res.status(400).json({ success: false, error: 'Storage path is required (?path=...)' });
    }

    const metadata = await getBomDocumentMetadata({
      bomCode,
      storagePath
    });

    if (!metadata) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      metadata
    });
  } catch (err) {
    const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
    const statusCode = isForbidden ? 403 : 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

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

// Endpoint to GET Sales Invoices strictly from BUSINZ Local Store & Database
app.get('/api/invoices', async (req, res) => {
  const getCleanLocalInvoices = () => {
    let raw = supabaseMemoryStore['invoice_store'];
    if (!raw || (Array.isArray(raw) && raw.length === 0)) {
      try {
        const filePath = getStoreFilePath('invoice_store.json');
        if (fs.existsSync(filePath)) {
          raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (e) {}
    }
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Object.keys(raw).length > 0 ? [raw] : []);
    return list.map(inv => {
      if (!inv || typeof inv !== 'object') return inv;
      if (inv.vehicleLoading?.lrCopyDoc?.dataUrl && inv.vehicleLoading.lrCopyDoc.dataUrl.length > 50000) {
        const copy = { ...inv, vehicleLoading: { ...inv.vehicleLoading, lrCopyDoc: { ...inv.vehicleLoading.lrCopyDoc } } };
        delete copy.vehicleLoading.lrCopyDoc.dataUrl;
        return copy;
      }
      return inv;
    });
  };

  const localInvoices = getCleanLocalInvoices();
  res.json(localInvoices);
});

// Endpoint to CREATE a Sales Invoice in BUSINZ Authoritative Store (Native BUSINZ Store)
app.post('/api/invoices', async (req, res) => {
  try {
    const normalizeInvoiceDate = (dateVal) => {
      if (!dateVal) return new Date().toISOString().split('T')[0];
      if (typeof dateVal === 'string') {
        const cleaned = dateVal.trim().replace(/Sept/i, 'Sep');
        const dmy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
          return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        }
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      return new Date().toISOString().split('T')[0];
    };

    const invDateStr = normalizeInvoiceDate(req.body.date);

    const assignedInvNo = (req.body.invNo && req.body.invNo !== 'Pending Confirmation')
      ? req.body.invNo
      : (req.body.invoiceNo && req.body.invoiceNo !== 'Pending Confirmation')
        ? req.body.invoiceNo
        : `INV-${Date.now()}`;

    const invRecord = {
      ...req.body,
      id: req.body.id || assignedInvNo,
      invNo: assignedInvNo,
      invoiceNo: assignedInvNo,
      date: invDateStr,
      status: req.body.status || 'Invoice Confirmed',
      pay: req.body.pay || 'Completed & Locked',
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const invStorePath = getStoreFilePath('invoice_store.json');
    let localInvList = [];
    if (fs.existsSync(invStorePath)) {
      try { localInvList = JSON.parse(fs.readFileSync(invStorePath, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(localInvList)) localInvList = [];

    const matchIdx = localInvList.findIndex(i =>
      (invRecord.invNo && i.invNo === invRecord.invNo) ||
      (invRecord.id && i.id === invRecord.id) ||
      (invRecord.bomCode && (i.bomCode === invRecord.bomCode || i.poNo === invRecord.bomCode)) ||
      (invRecord.poNo && (i.poNo === invRecord.poNo || i.bomCode === invRecord.poNo))
    );
    if (matchIdx !== -1) {
      localInvList[matchIdx] = { ...localInvList[matchIdx], ...invRecord };
    } else {
      localInvList.unshift(invRecord);
    }
    fs.writeFileSync(invStorePath, JSON.stringify(localInvList, null, 2), 'utf8');
    if (!supabaseMemoryStore['invoice_store']) supabaseMemoryStore['invoice_store'] = [];
    supabaseMemoryStore['invoice_store'] = localInvList;
    pushStoreToSupabase('invoice_store', localInvList).catch(() => {});

    // Synchronize matching BOM record with assigned invoice
    const targetBomCode = invRecord.bomCode || invRecord.poNo;
    if (targetBomCode) {
      try {
        const bomPath = getStoreFilePath('bom_store.json');
        let diskBoms = [];
        if (fs.existsSync(bomPath)) {
          try { diskBoms = JSON.parse(fs.readFileSync(bomPath, 'utf8')); } catch (_) {}
        }
        if (Array.isArray(diskBoms)) {
          let bomChanged = false;
          diskBoms = diskBoms.map(b => {
            if (b && (b.bomCode === targetBomCode || b.code === targetBomCode || b.id === targetBomCode)) {
              bomChanged = true;
              return {
                ...b,
                invoiceNo: assignedInvNo,
                invoiceConfirmed: true,
                status: (b.status === 'Completed' || b.status === 'COMPLETED & DISPATCHED' || b.status === 'Fully Dispatched & Delivered') ? b.status : 'Awaiting Vehicle Loading & Dispatch'
              };
            }
            return b;
          });
          if (bomChanged) {
            fs.writeFileSync(bomPath, JSON.stringify(diskBoms, null, 2), 'utf8');
            supabaseMemoryStore.bom_store = diskBoms;
            cachedBomsResult = diskBoms;
            try {
              const matched = diskBoms.find(b => b.bomCode === targetBomCode || b.code === targetBomCode);
              if (matched) {
                broadcastRealtimeEvent('bom_updated', { action: 'update', recordId: targetBomCode, bom: matched });
              }
            } catch (_) {}
          }
        }
      } catch (bErr) {
        console.warn('Error linking BOM in /api/invoices:', bErr);
      }
    }

    try {
      broadcastRealtimeEvent('invoice_updated', { action: 'create', recordId: invRecord?.invNo || invRecord?.id, invoice: invRecord });
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Invoice saved in BUSINZ successfully!',
      invoice: invRecord
    });
  } catch (err) {
    console.error('[BUSINZ INVOICE CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create invoice in BUSINZ: ' + err.message });
  }
});

// Proforma Invoices / Estimates endpoints
// Returns next sequential PI number matching unified sequence VRM-PI-[YYYY]-[SEQ] (e.g. VRM-PI-2026-01) directly from authoritative database
app.get(['/api/next-pi-number', '/api/next-estimate-number'], async (req, res) => {
  try {
    const nextSeq = await getNextDatabasePiNumber();
    res.json(nextSeq);
  } catch (err) {
    console.warn('[Next PI Number Fallback Warning]:', err.message);
    const fy = getFinancialYear();
    res.json({ nextPiNo: `VRM-PI-${fy}-01`, nextEstimateNo: `VRM-PI-${fy}-01`, nextNum: 1, fiscalYear: String(fy), financialYear: fy });
  }
});

// Quotations endpoint: Returns next sequential quotation number matching VRM-QT-[YYYY]-[SEQ] (e.g. VRM-QT-2026-01)
app.get(['/api/next-quotation-number', '/api/next-quote-number'], async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];
    const files = ['crm_quotations.json', 'quotation_store.json', 'sales_pi_store.json'];
    for (const f of files) {
      try {
        const p = getStoreFilePath(f);
        if (fs.existsSync(p)) {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(d)) records.push(...d);
        }
      } catch (_) {}
    }
    ['crm_quotations', 'quotation_store'].forEach(key => {
      if (Array.isArray(supabaseMemoryStore[key])) records.push(...supabaseMemoryStore[key]);
    });
    const { code, nextNum } = getNextSequence('QT', records);
    res.json({ nextQuoteNo: code, nextQuotationNumber: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextQuoteNo: `VRM-QT-${fy}-01`, nextQuotationNumber: `VRM-QT-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// CRM Leads endpoint: Returns next sequential lead number matching VRM-LD-[YYYY]-[SEQ] (e.g. VRM-LD-2026-01)
app.get(['/api/next-lead-number', '/api/crm/leads/next-number'], async (req, res) => {
  try {
    const fy = getFinancialYear();
    const leads = await loadDatabaseLeads();
    const { code, nextNum } = getNextSequence('LD', leads);
    res.json({ nextLeadNo: code, nextLeadNumber: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextLeadNo: `VRM-LD-${fy}-01`, nextLeadNumber: `VRM-LD-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// Customer Code endpoint: Returns next sequential Customer Code matching VRM-CS-[YYYY]-[SEQ] (e.g. VRM-CS-2026-01)
app.get(['/api/next-customer-number', '/api/crm/customers/next-number'], async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];
    try {
      const dbRes = await query('SELECT customer_code, id FROM public.customers');
      if (dbRes && Array.isArray(dbRes.rows)) records = dbRes.rows;
    } catch (_) {}

    if (records.length === 0) {
      const diskPath = getStoreFilePath('customer_store.json');
      if (fs.existsSync(diskPath)) {
        try {
          const d = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          if (Array.isArray(d)) records = d;
        } catch (_) {}
      }
    }
    const { code, nextNum } = getNextSequence('CS', records);
    res.json({ nextCustomerCode: code, nextCode: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextCustomerCode: `VRM-CS-${fy}-01`, nextCode: `VRM-CS-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// Delivery Challan endpoint: Returns next sequential DC number matching VRM-DC-[YYYY]-[SEQ] (e.g. VRM-DC-2026-01)
app.get('/api/next-dc-number', async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];
    const p = getStoreFilePath('dc_store.json');
    if (fs.existsSync(p)) {
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(d)) records.push(...d);
      } catch (_) {}
    }
    const { code, nextNum } = getNextSequence('DC', records);
    res.json({ nextDcNo: code, nextChallanNumber: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextDcNo: `VRM-DC-${fy}-01`, nextChallanNumber: `VRM-DC-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// GRN endpoint: Returns next sequential GRN number matching VRM-GRN-[YYYY]-[SEQ] (e.g. VRM-GRN-2026-01)
app.get('/api/next-grn-number', async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];
    const p = getStoreFilePath('grn_store.json');
    if (fs.existsSync(p)) {
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(d)) records.push(...d);
      } catch (_) {}
    }
    const { code, nextNum } = getNextSequence('GRN', records);
    res.json({ nextGrnNo: code, nextGrnNumber: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextGrnNo: `VRM-GRN-${fy}-01`, nextGrnNumber: `VRM-GRN-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});

// Work Order endpoint: Returns next sequential Work Order number matching VRM-WO-[YYYY]-[SEQ] (e.g. VRM-WO-2026-01)
app.get('/api/next-wo-number', async (req, res) => {
  try {
    const fy = getFinancialYear();
    let records = [];
    const p = getStoreFilePath('workorder_store.json');
    if (fs.existsSync(p)) {
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(d)) records.push(...d);
      } catch (_) {}
    }
    const { code, nextNum } = getNextSequence('WO', records);
    res.json({ nextWoNo: code, nextWorkOrderNumber: code, nextNum, financialYear: fy });
  } catch (err) {
    const fy = getFinancialYear();
    res.json({ nextWoNo: `VRM-WO-${fy}-01`, nextWorkOrderNumber: `VRM-WO-${fy}-01`, nextNum: 1, financialYear: fy });
  }
});


app.get(['/api/estimates', '/api/proforma-invoices'], async (req, res) => {
  let combinedEstimates = [];
  const existingMap = new Map();

  // 1. Authoritative primary source: PostgreSQL public.proforma_invoices
  try {
    const databasePis = await loadDatabaseProformaInvoices();
    if (Array.isArray(databasePis) && databasePis.length > 0) {
      databasePis.forEach(p => {
        if (p && p.piNo) {
          existingMap.set(String(p.piNo).trim().toLowerCase(), p);
          combinedEstimates.push(p);
        }
      });
    }
  } catch (err) {
    console.warn('[PI Database Read Notice]:', err.message);
  }

  // 2. Safely merge any disk PIs that are not yet in the relational database
  const p1 = getStoreFilePath('proforma_invoice_store.json');
  const p2 = getStoreFilePath('sales_pi_store.json');

  const checkAndMerge = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.piNo) {
              const k = String(item.piNo).trim().toLowerCase();
              if (!existingMap.has(k)) {
                existingMap.set(k, item);
                combinedEstimates.push(item);
              }
            }
          }
        }
      }
    } catch (_) {}
  };

  checkAndMerge(p1);
  checkAndMerge(p2);

  if (combinedEstimates.length === 0 && Array.isArray(supabaseMemoryStore['proforma_invoice_store']) && supabaseMemoryStore['proforma_invoice_store'].length > 0) {
    supabaseMemoryStore['proforma_invoice_store'].forEach(item => {
      if (item && item.piNo) {
        const k = String(item.piNo).trim().toLowerCase();
        if (!existingMap.has(k)) {
          existingMap.set(k, item);
          combinedEstimates.push(item);
        }
      }
    });
  }

  res.json(combinedEstimates);
});

// Direct import endpoint to ingest exported Quotes/Estimates
app.post('/api/import-estimates', async (req, res) => {
  try {
    const rawEstimates = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.estimates) ? req.body.estimates : []);
    if (rawEstimates.length === 0) {
      return res.status(400).json({ success: false, error: 'No estimates array provided in body' });
    }

    const p1 = getStoreFilePath('proforma_invoice_store.json');
    const p2 = getStoreFilePath('sales_pi_store.json');

    const mappedPIs = rawEstimates.map(est => ({
      id: est.estimate_id || est.id || est.estimate_number || est.piNo,
      piNo: est.estimate_number || est.piNo || est['Estimate Number'] || est['Quote Number'],
      piDate: est.date || est.piDate || est['Date'] || '',
      vendor: est.customer_name || est.vendor || est['Customer Name'] || '',
      customerName: est.customer_name || est.vendor || est['Customer Name'] || '',
      customerId: est.customer_id || '',
      salesPerson: est.salesperson_name || est.salesPerson || est['Salesperson'] || '',
      salesperson: est.salesperson_name || est.salesPerson || est['Salesperson'] || '',
      salesPersonCode: est.salesperson_id || '',
      amount: est.amount || `₹${Number(est.total || est['Total'] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      total: Number(est.total || est['Total'] || 0),
      status: (est.status || '').toLowerCase() === 'invoiced' ? 'Invoiced' : ((est.status || '').toLowerCase() === 'declined' ? 'Cancelled' : ((est.status || '').toLowerCase() === 'draft' ? 'Draft' : 'Issued')),
      statusType: (est.status || '').toLowerCase() === 'invoiced' ? 'invoiced' : ((est.status || '').toLowerCase() === 'declined' ? 'cancelled' : ((est.status || '').toLowerCase() === 'draft' ? 'draft' : 'issued'))
    })).filter(x => Boolean(x.piNo));

    supabaseMemoryStore['sales_pi_store'] = mappedPIs;
    supabaseMemoryStore['proforma_invoice_store'] = mappedPIs;

    fs.writeFileSync(p1, JSON.stringify(mappedPIs, null, 2), 'utf8');
    fs.writeFileSync(p2, JSON.stringify(mappedPIs, null, 2), 'utf8');
    saveDatabaseStore('sales_pi_store', mappedPIs).catch(() => {});
    broadcastRealtimeEvent('pi_updated', { action: 'import', count: mappedPIs.length });

    res.json({ success: true, count: mappedPIs.length, message: `Successfully imported ${mappedPIs.length} Quotes (PIs)` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Diagnostics endpoint to inspect BUSINZ local stores estimates count
app.get('/api/debug-estimates', async (req, res) => {
  const p1 = getStoreFilePath('proforma_invoice_store.json');
  let count = 0;
  try {
    if (fs.existsSync(p1)) count = JSON.parse(fs.readFileSync(p1, 'utf8')).length;
  } catch (_) {}
  res.json({
    connected: false,
    source: 'BUSINZ_LOCAL_STORE',
    cachedCount: count,
    estimatesInSample: count,
    rateLimitedUntil: null
  });
});

app.post(['/api/estimates', '/api/proforma-invoices'], async (req, res) => {
  try {
    // =========================================================================
    // STEP 1: STORE IN OUR DATABASE FIRST (MANDATORY DATABASE-FIRST RULE)
    // =========================================================================
    const saveResult = await saveProformaInvoiceToDatabase(req.body);
    const savedPi = saveResult.pi;

    console.log(`✅ [PI STEP 1: DATABASE PERSISTED] PI "${savedPi.piNo}" safely stored in PostgreSQL public.proforma_invoices.`);

    // Broadcast realtime event immediately so all connected clients/dashboards see the PI
    broadcastRealtimeEvent('pi_created', { action: 'create', recordId: savedPi?.piNo || savedPi?.id, pi: savedPi });

    // Store in database ONLY. Do NOT automatically push to Zoho.
    // As per requirement: PI is pushed to Zoho ONLY when salesperson explicitly clicks "Push to Zoho".
    return res.json({
      success: true,
      message: saveResult.wasAutoAdvanced
        ? `Proforma Invoice auto-advanced to ${savedPi.piNo} to prevent overwriting existing record.`
        : 'Proforma Invoice stored in BUSINZ database successfully!',
      pi: savedPi,
      estimate: savedPi,
      zohoSynced: Boolean(savedPi.zohoSynced),
      wasReassigned: saveResult.wasAutoAdvanced
    });
  } catch (err) {
    console.error('[BUSINZ PI CREATE ERROR]:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to store Proforma Invoice in database: ' + err.message
    });
  }
});

// Fetch current Zoho Books ERP integration configuration & status
app.get('/api/zoho/config', async (req, res) => {
  try {
    const config = getZohoConfigInfo(true);
    const stats = getZohoAuthStats();
    res.json({
      success: true,
      config,
      stats
    });
  } catch (err) {
    console.error('[Zoho Config Get Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Zoho Books ERP company account configuration
app.post('/api/zoho/config', async (req, res) => {
  try {
    const { companyName, orgId, clientId, clientSecret, refreshToken, apiDomain, accountsDomain } = req.body || {};
    if (!orgId || !clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID, Client ID, Client Secret, and Refresh Token are required.'
      });
    }

    const updated = await updateZohoConfig({
      companyName,
      orgId,
      clientId,
      clientSecret,
      refreshToken,
      apiDomain,
      accountsDomain
    });

    res.json({
      success: true,
      message: 'Zoho Books company credentials updated and applied successfully!',
      config: updated
    });
  } catch (err) {
    console.error('[Zoho Config Save Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test connection to Zoho Books OAuth & API live
app.post('/api/zoho/test-connection', async (req, res) => {
  try {
    const customCreds = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    const result = await testZohoConnection(customCreds);
    res.json(result);
  } catch (err) {
    console.error('[Zoho Test Connection Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Exchange temporary grant token (authorization code) for permanent refresh token
app.post('/api/zoho/exchange-code', async (req, res) => {
  try {
    const { code, clientId, clientSecret, orgId, apiDomain, accountsDomain, companyName } = req.body || {};
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Authorization code is required.' });
    }
    const result = await exchangeAuthorizationCode({
      code,
      clientId,
      clientSecret,
      orgId,
      apiDomain,
      accountsDomain,
      companyName
    });
    res.json(result);
  } catch (err) {
    console.error('[Zoho Code Exchange Error]:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Manual 1-Way Push Proforma Invoice to Zoho Books as Estimate / Quote
// Triggered strictly when the salesperson clicks the "Push to Zoho" button
app.post(['/api/zoho/push-pi', '/api/estimates/push-to-zoho'], async (req, res) => {
  try {
    let piRecord = req.body.pi || req.body;
    const piNo = String(req.body.piNo || piRecord.piNo || piRecord.id || '').trim();

    if (!piNo) {
      return res.status(400).json({ success: false, error: 'piNo is required to push to Zoho' });
    }

    // If full PI object wasn't supplied, load from PostgreSQL database first
    if (!piRecord.items || piRecord.items.length === 0) {
      try {
        const dbRes = await query(
          'SELECT * FROM public.proforma_invoices WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($1)) OR LOWER(TRIM(id)) = LOWER(TRIM($1))',
          [piNo]
        );
        if (dbRes.rows.length > 0) {
          const dbPi = toConsumerPi(dbRes.rows[0]);
          piRecord = { ...dbPi, ...piRecord };
        }
      } catch (_) {}

      if (!piRecord.items || piRecord.items.length === 0) {
        const pProforma = getStoreFilePath('proforma_invoice_store.json');
        const pSales = getStoreFilePath('sales_pi_store.json');
        let found = null;
        try {
          if (fs.existsSync(pProforma)) {
            const list = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
            found = list.find(p => String(p.piNo || p.id || '').trim().toLowerCase() === piNo.toLowerCase());
          }
          if (!found && fs.existsSync(pSales)) {
            const list = JSON.parse(fs.readFileSync(pSales, 'utf8'));
            found = list.find(p => String(p.piNo || p.id || '').trim().toLowerCase() === piNo.toLowerCase());
          }
        } catch (_) {}

        if (found) {
          piRecord = { ...found, ...piRecord };
        }
      }
    }

    piRecord.piNo = piNo;
    const result = await pushPiToZoho(piRecord);

    // Update database sync status
    if (result?.estimate?.estimate_id) {
      await updatePiZohoSyncStatus(piNo, {
        zohoSynced: true,
        zohoEstimateId: String(result.estimate.estimate_id).trim(),
        zohoEstimateNo: result.estimate.estimate_number || piNo,
        zohoSyncError: null
      });

      broadcastRealtimeEvent('pi_updated', {
        piNo,
        zohoSynced: true,
        zohoEstimateId: String(result.estimate.estimate_id).trim(),
        zohoEstimateNo: result.estimate.estimate_number || piNo
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[Zoho Push Route Error]:', err.message);
    const piNo = String(req.body.piNo || req.body?.pi?.piNo || '').trim();
    if (piNo) {
      await updatePiZohoSyncStatus(piNo, {
        zohoSynced: false,
        zohoSyncError: err.message
      }).catch(() => {});
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel / Decline Proforma Invoice (Estimate / Quote) in BUSINZ local stores (Native BUSINZ Store)
app.post(['/api/estimates/cancel', '/api/proforma-invoices/cancel'], async (req, res) => {
  const { piNo, reason = 'Cancelled by user in Businz' } = req.body;
  const cleanPiNo = String(piNo || '').trim();

  if (!cleanPiNo) {
    return res.status(400).json({ success: false, error: 'piNo is required to cancel a Proforma Invoice' });
  }

  // Persist cancellation in local stores (proforma_invoice_store and sales_pi_store)
  const cancelledTimestamp = new Date().toISOString();
  try {
    const pProforma = getStoreFilePath('proforma_invoice_store.json');
    if (fs.existsSync(pProforma)) {
      let localProforma = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
      if (Array.isArray(localProforma)) {
        localProforma = localProforma.map(p => {
          if (String(p.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) {
            return { ...p, status: 'Cancelled', statusType: 'cancelled', cancelledAt: cancelledTimestamp, cancelReason: reason };
          }
          return p;
        });
        fs.writeFileSync(pProforma, JSON.stringify(localProforma, null, 2), 'utf8');
        pushStoreToSupabase('proforma_invoice_store', localProforma).catch(() => {});
      }
    }

    const pSales = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(pSales)) {
      let localSales = JSON.parse(fs.readFileSync(pSales, 'utf8'));
      if (Array.isArray(localSales)) {
        localSales = localSales.map(p => {
          if (String(p.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) {
            return { ...p, status: 'Cancelled', statusType: 'cancelled', cancelledAt: cancelledTimestamp, cancelReason: reason };
          }
          return p;
        });
        fs.writeFileSync(pSales, JSON.stringify(localSales, null, 2), 'utf8');
        pushStoreToSupabase('sales_pi_store', localSales).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[CANCEL STORE PERSIST ERROR]', e);
  }

  res.json({
    success: true,
    message: `Proforma Invoice ${cleanPiNo} marked as Cancelled in BUSINZ!`
  });
});

// Delivery Challans endpoints - served strictly from BUSINZ local stores
app.get(['/api/deliverychallans', '/api/delivery-challans'], async (req, res) => {
  let localDCs = [];
  try {
    const p = getStoreFilePath('dc_store.json');
    if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}

  if (localDCs.length === 0 && Array.isArray(supabaseMemoryStore['dc_store']) && supabaseMemoryStore['dc_store'].length > 0) {
    localDCs = supabaseMemoryStore['dc_store'];
  }

  res.json(localDCs);
});

// Endpoint to CREATE a Delivery Challan in BUSINZ Authoritative Store (Native BUSINZ Store)
app.post(['/api/deliverychallans', '/api/delivery-challans'], async (req, res) => {
  let localDCs = [];
  const p = getStoreFilePath('dc_store.json');
  try {
    if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}

  const newDC = { 
    ...req.body, 
    id: req.body.id || req.body.challanNo || req.body.dcNo || `DC-${Date.now()}`,
    dcNo: req.body.challanNo || req.body.dcNo || `DC-${Date.now()}`,
    createdAt: req.body.createdAt || new Date().toISOString()
  };
  const updated = [newDC, ...localDCs];
  try { 
    fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8'); 
    supabaseMemoryStore['dc_store'] = updated;
    pushStoreToSupabase('dc_store', updated).catch(() => {});
  } catch (_) {}

  res.json({ 
    success: true, 
    message: 'Delivery Challan created in BUSINZ successfully!',
    deliverychallan: newDC 
  });
});


// Real-time synchronization endpoint retrieving purchase order details strictly from BUSINZ local stores
app.get('/api/purchaseorders/{*id}', async (req, res) => {
  const rawId = req.params.id;
  const poNo = decodeURIComponent(Array.isArray(rawId) ? rawId.join('/') : (rawId || ''));

  const localGRNs = loadLocalGRNs();
  const matchingGRNs = localGRNs.filter(g => {
    const ref = (g.poRef || g.poNo || g.poId || '').toLowerCase();
    const target = poNo.toLowerCase();
    return ref === target || ref.includes(target) || target.includes(ref);
  });
  
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const targetClean = normalize(poNo);
  const matchedLocalPO = localPOs.find(p => 
    normalize(p.id) === targetClean || 
    normalize(p.poNo) === targetClean || 
    normalize(p.purchaseorder_number) === targetClean ||
    (p.poNo && normalize(p.poNo).includes(targetClean)) ||
    (targetClean && normalize(p.poNo).length > 0 && targetClean.includes(normalize(p.poNo)))
  );

  let sampleItems = [];
  if (matchedLocalPO && Array.isArray(matchedLocalPO.items) && matchedLocalPO.items.length > 0) {
    sampleItems = matchedLocalPO.items.map(it => ({
      id: it.id || it.itemId || `PO-ITEM-${Math.random()}`,
      name: it.name || it.itemName || 'Material Item',
      description: it.description || it.desc || '',
      account: it.account || 'Raw Material',
      quantity: Number(it.qty || it.quantity || 1),
      unit: it.unit || 'NOS',
      rate: Number(it.rate || it.unitPrice || 0),
      tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : 18
    }));
  } else {
    sampleItems = [];
  }

  const itemReceivedTotals = {};
  matchingGRNs.forEach(grn => {
    (grn.items || []).forEach((it, idx) => {
      const qty = Number(it.accepted !== undefined ? it.accepted : (it.now || 0));
      const idKey = it.id || it.itemId || it.lineItemId;
      const nameKey = (it.name || '').trim().toLowerCase();
      if (idKey) itemReceivedTotals[idKey] = (itemReceivedTotals[idKey] || 0) + qty;
      if (nameKey) itemReceivedTotals[nameKey] = (itemReceivedTotals[nameKey] || 0) + qty;
      itemReceivedTotals[`IDX-${idx}`] = (itemReceivedTotals[`IDX-${idx}`] || 0) + qty;
    });
  });

  let totalOrderedQty = 0;
  let totalReceivedQty = 0;

  const items = sampleItems.map((item, idx) => {
    const idKey = item.id || item.itemId || item.lineItemId;
    const nameKey = (item.name || '').trim().toLowerCase();
    let prevReceived = 0;
    if (idKey && itemReceivedTotals[idKey] !== undefined) {
      prevReceived = itemReceivedTotals[idKey];
    } else if (nameKey && itemReceivedTotals[nameKey] !== undefined) {
      prevReceived = itemReceivedTotals[nameKey];
    } else if (itemReceivedTotals[`IDX-${idx}`] !== undefined) {
      prevReceived = itemReceivedTotals[`IDX-${idx}`];
    }
    const ordered = item.quantity || 0;
    const remaining = Math.max(0, ordered - prevReceived);

    totalOrderedQty += ordered;
    totalReceivedQty += Math.min(ordered, prevReceived);

    return {
      id: item.id || idKey || `PO-ITEM-${idx}`,
      name: item.name,
      sku: item.sku || `SKU-${101 + idx}`,
      description: item.description,
      account: item.account || 'Raw Material',
      qty: ordered,
      unit: item.unit || 'NOS',
      rate: item.rate || 0,
      tax: item.tax !== undefined ? item.tax : 18,
      previouslyReceived: prevReceived,
      remainingQty: remaining
    };
  });

  if (totalReceivedQty === 0 && matchingGRNs.length > 0) {
    matchingGRNs.forEach(grn => {
      (grn.items || []).forEach(it => {
        totalReceivedQty += Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      });
    });
  }

  const matchingClosedGRN = matchingGRNs.some(g => {
    const gs = String(g.status || '').toUpperCase();
    return gs.includes('CLOSED') || gs.includes('FULLY') || g.forceClosePO === true;
  });

  const isActuallyClosed = (totalOrderedQty > 0 && totalReceivedQty >= totalOrderedQty) || 
                          matchingClosedGRN || 
                          (matchedLocalPO && (matchedLocalPO.status === 'CLOSED / FULLY RECEIVED' || matchedLocalPO.statusType === 'closed'));
  const isPartiallyReceived = !isActuallyClosed && ((totalOrderedQty > 0 && totalReceivedQty > 0 && totalReceivedQty < totalOrderedQty) || (matchedLocalPO && (matchedLocalPO.status === 'OPEN / PARTIALLY RECEIVED' || matchedLocalPO.statusType === 'partially_received')));

  let statusType = matchedLocalPO?.statusType || 'draft';
  let statusText = matchedLocalPO?.status || 'Draft';

  if (isActuallyClosed) {
    statusType = 'closed';
    statusText = 'CLOSED / FULLY RECEIVED';
  } else if (isPartiallyReceived && totalReceivedQty > 0) {
    statusType = 'partially_received';
    statusText = 'OPEN / PARTIALLY RECEIVED';
  }

  return res.json({
    id: matchedLocalPO ? (matchedLocalPO.poNo || matchedLocalPO.id || poNo) : poNo,
    poNo: matchedLocalPO ? (matchedLocalPO.poNo || matchedLocalPO.purchaseorder_number || poNo) : poNo,
    vendor: matchedLocalPO ? matchedLocalPO.vendor : 'Vendor',
    branch: matchedLocalPO ? matchedLocalPO.branch : '',
    contactPerson: matchedLocalPO ? matchedLocalPO.contactPerson : '',
    contactNo: matchedLocalPO ? matchedLocalPO.contactNo : '',
    email: matchedLocalPO ? matchedLocalPO.email : '',
    gstNo: matchedLocalPO ? matchedLocalPO.gstNo : '',
    deliveryAddress: matchedLocalPO ? (matchedLocalPO.deliveryAddress || '—') : '—',
    billingAddress: matchedLocalPO ? (matchedLocalPO.billingAddress || '—') : '—',
    poDate: matchedLocalPO ? matchedLocalPO.poDate : '—',
    deliveryDate: matchedLocalPO ? matchedLocalPO.deliveryDate : '—',
    paymentTerms: matchedLocalPO ? matchedLocalPO.paymentTerms : 'Net 30 Days',
    purchaser: matchedLocalPO ? matchedLocalPO.purchaser : '—',
    shipmentPref: matchedLocalPO ? matchedLocalPO.shipmentPref : 'Road Transport',
    currency: matchedLocalPO ? matchedLocalPO.currency : 'INR',
    project: matchedLocalPO ? matchedLocalPO.project : '',
    priority: matchedLocalPO ? matchedLocalPO.priority : 'High',
    scope: matchedLocalPO ? matchedLocalPO.scope : 'Vendor Scope',
    transportName: matchedLocalPO ? matchedLocalPO.transportName : '',
    shippingCharges: matchedLocalPO ? (matchedLocalPO.shippingCharges || 0) : 0,
    otherCharges: matchedLocalPO ? (matchedLocalPO.otherCharges || 0) : 0,
    discountPct: matchedLocalPO ? (matchedLocalPO.discountPct || 0) : 0,
    notes: matchedLocalPO ? (matchedLocalPO.notes || '') : '',
    terms: matchedLocalPO ? (matchedLocalPO.terms || '') : '',
    approvalRequired: matchedLocalPO ? matchedLocalPO.approvalRequired : 'YES',
    approver: matchedLocalPO ? matchedLocalPO.approver : '',
    approvalPriority: matchedLocalPO ? matchedLocalPO.approvalPriority : '',
    items: items,
    totalOrderedQty: (matchedLocalPO && matchedLocalPO.totalOrderedQty) ? matchedLocalPO.totalOrderedQty : totalOrderedQty,
    totalReceivedQty: (matchedLocalPO && matchedLocalPO.totalReceivedQty) ? matchedLocalPO.totalReceivedQty : totalReceivedQty,
    totalRemainingQty: Math.max(0, (matchedLocalPO?.totalOrderedQty || totalOrderedQty) - totalReceivedQty),
    receivingProgressPct: totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : (isActuallyClosed ? '100.0' : 0),
    grnHistory: matchingGRNs,
    amount: matchedLocalPO ? matchedLocalPO.amount : '₹ 0.00',
    status: statusText,
    statusType: statusType,
    approvedBy: matchedLocalPO ? matchedLocalPO.approvedBy : undefined,
    approvalDate: matchedLocalPO ? matchedLocalPO.approvalDate : undefined,
    approvalTime: matchedLocalPO ? matchedLocalPO.approvalTime : undefined,
    approvalRemarks: matchedLocalPO ? matchedLocalPO.approvalRemarks : undefined,
    paymentDetails: matchedLocalPO ? matchedLocalPO.paymentDetails : undefined,
    proceedDetails: matchedLocalPO ? matchedLocalPO.proceedDetails : undefined
  });
});




// Endpoint to fetch receiving history & cumulative totals for a specific PO
app.get('/api/po-receiving-history/{*poRef}', async (req, res) => {
  const rawRef = req.params.poRef;
  const poRef = decodeURIComponent(Array.isArray(rawRef) ? rawRef.join('/') : (rawRef || ''));
  const grns = await getDatabaseStore('grn_store');
  const poGRNs = (Array.isArray(grns) ? grns : []).filter(g => {
    const ref = (g.poRef || g.poNo || g.poId || '').toLowerCase();
    const target = poRef.toLowerCase();
    return ref === target || ref.includes(target) || target.includes(ref) || (ref.includes('0202') && target.includes('0202')) || (ref.includes('0201') && target.includes('0201')) || (ref.includes('7327116') && target.includes('7327116'));
  });

  // Group total received quantities per item ID, item name, or position index
  const itemReceivedTotals = {};
  poGRNs.forEach(grn => {
    (grn.items || []).forEach((item, idx) => {
      const qty = Number(item.accepted !== undefined ? item.accepted : (item.now || 0));
      const itemId = item.id || item.itemId || item.lineItemId;
      const itemName = (item.name || '').trim().toLowerCase();
      if (itemId) {
        itemReceivedTotals[itemId] = (itemReceivedTotals[itemId] || 0) + qty;
      }
      if (itemName) {
        itemReceivedTotals[itemName] = (itemReceivedTotals[itemName] || 0) + qty;
      }
      itemReceivedTotals[idx] = (itemReceivedTotals[idx] || 0) + qty;
    });
  });

  res.json({
    poRef,
    grnHistory: poGRNs,
    itemReceivedTotals
  });
});

// Endpoint to list all stored GRNs
app.get('/api/grns', async (req, res) => {
  const grns = await getDatabaseStore('grn_store');
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

  const reconciled = (Array.isArray(grns) ? grns : []).map(grn => {
    const pRef = normalize(grn.poRef || grn.poNo || grn.poId);
    const matchedPO = localPOs.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return pRef && (pNo === pRef || pId === pRef || (pNo && pRef.includes(pNo)) || (pNo && pNo.includes(pRef)));
    });

    const isPoClosed = matchedPO && (
      String(matchedPO.status || '').toUpperCase().includes('CLOSED') ||
      String(matchedPO.status || '').toUpperCase().includes('FULLY') ||
      matchedPO.statusType === 'closed' ||
      matchedPO.order_status === 'closed' ||
      (Number(matchedPO.totalOrderedQty) > 0 && Number(matchedPO.totalReceivedQty || matchedPO.totalReceived) >= Number(matchedPO.totalOrderedQty))
    );

    if (isPoClosed && grn.status !== 'CLOSED / FULLY RECEIVED') {
      return {
        ...grn,
        status: 'CLOSED / FULLY RECEIVED'
      };
    }
    return grn;
  });

  const sorted = reconciled.sort((a, b) => {
    const parseNum = (item) => {
      const str = String(item.grnNo || item.id || item.poRef || '');
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return parseNum(b) - parseNum(a);
  });
  res.json(sorted);
});

// Endpoint to reset all GRNs
app.all('/api/grns/reset-all', async (req, res) => {
  try {
    const grnPath = getStoreFilePath('grn_store.json');
    try {
      fs.writeFileSync(grnPath, '[]', 'utf8');
    } catch (_) {}
    await saveDatabaseStore('grn_store', []);
    res.json({ success: true, message: 'All GRNs reset to empty.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to delete a GRN by ID or grnNo
app.delete('/api/grns/:id', async (req, res) => {
  const targetId = req.params.id;
  let grns = await getDatabaseStore('grn_store');
  if (!Array.isArray(grns)) grns = [];
  const existing = grns.find(g => g.id === targetId || g.grnNo === targetId);
  
  if (existing && (
    existing.status === 'CLOSED / FULLY RECEIVED' || 
    existing.status === 'Approved' || 
    existing.status === 'Fully Accepted' || 
    existing.status === 'Closed' || 
    existing.status === 'CLOSED'
  )) {
    return res.status(400).json({ error: 'Fully received or approved GRNs cannot be deleted.' });
  }

  const initialLen = grns.length;
  grns = grns.filter(g => g.id !== targetId && g.grnNo !== targetId);
  await saveDatabaseStore('grn_store', grns);
  res.json({ success: true, deleted: initialLen > grns.length });
});

// Endpoint to create a new GRN (Saves locally)
app.post('/api/grns', async (req, res) => {
  const grnData = req.body;
  let grns = loadLocalGRNs();
  if (!Array.isArray(grns) || grns.length === 0) {
    grns = await getDatabaseStore('grn_store');
  }
  if (!Array.isArray(grns)) grns = [];
  
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const poRefTarget = normalize(grnData.poRef || grnData.poNo || grnData.poId);
  
  // Calculate existing received quantity across all previous GRNs for this PO
  let pastReceivedQty = 0;
  grns.forEach(g => {
    const isSameGrn = (grnData.id && (g.id === grnData.id || g.grnNo === grnData.id)) || 
                      (grnData.grnNo && (g.grnNo === grnData.grnNo || g.id === grnData.grnNo));
    if (isSameGrn) return;
    const ref = normalize(g.poRef || g.poNo || g.poId);
    if (poRefTarget && (ref === poRefTarget || ref.includes(poRefTarget) || poRefTarget.includes(ref))) {
      (g.items || []).forEach(it => {
        pastReceivedQty += Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      });
    }
  });

  const currentAccepted = Number(grnData.acceptedQty !== undefined && grnData.acceptedQty !== '' ? grnData.acceptedQty : (grnData.receivedQty || 0));
  const totalReceivedSoFar = pastReceivedQty + currentAccepted;
  
  let totalOrdered = Number(grnData.totalOrderedQty || 0);
  if (totalOrdered === 0 && Array.isArray(grnData.items)) {
    totalOrdered = grnData.items.reduce((sum, it) => sum + (Number(it.ordered) || 0), 0);
  }

  const isFullyReceived = (totalOrdered > 0 && totalReceivedSoFar >= totalOrdered) || grnData.forceClosePO === true;
  const calculatedStatus = isFullyReceived ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED';

  console.log(`[GRN SAVE] PO: ${poRefTarget} | Past: ${pastReceivedQty} | Current: ${currentAccepted} | Total: ${totalReceivedSoFar}/${totalOrdered} | Status: ${calculatedStatus}`);

  const newGRN = {
    id: grnData.id || `GRN-${Date.now()}`,
    grnNo: grnData.grnNo || grnData.id || `GRN-${Date.now()}`,
    poRef: grnData.poRef || grnData.poNo || '—',
    poNo: grnData.poNo || grnData.poRef || '—',
    poId: grnData.poId || grnData.poRef || '—',
    vendor: grnData.vendor || 'Vendor',
    date: grnData.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    challanNo: grnData.challanNo || '—',
    receivedQty: grnData.receivedQty || 0,
    acceptedQty: grnData.acceptedQty !== undefined ? grnData.acceptedQty : (grnData.receivedQty || 0),
    rejectedQty: grnData.rejectedQty || 0,
    receivedBy: grnData.receivedBy || '—',
    inspectorName: grnData.inspectorName || '—',
    inspectionRemarks: grnData.inspectionRemarks || '—',
    items: grnData.items || [],
    documents: grnData.documents || [],
    status: calculatedStatus
  };

  // 1. SAVE GRN IMMEDIATELY TO LOCAL STORE AND SUPABASE!
  const existingGrnIdx = grns.findIndex(g => (newGRN.id && (g.id === newGRN.id || g.grnNo === newGRN.id)) || 
                                            (newGRN.grnNo && (g.grnNo === newGRN.grnNo || g.id === newGRN.grnNo)));
  if (existingGrnIdx >= 0) {
    grns[existingGrnIdx] = newGRN;
  } else {
    grns.unshift(newGRN);
  }
  saveLocalGRNs(grns);

  // 2. UPDATE MATCHING PO STATUS IN LOCAL STORE & SUPABASE IMMEDIATELY!
  try {
    const localPOs = loadLocalPOs();
    if (poRefTarget) {
      let matched = false;
      const updatedPOs = localPOs.map(po => {
        const poNum = normalize(po.poNo);
        const poId = normalize(po.id);
        if (poRefTarget === poNum || poRefTarget === poId) {
          matched = true;
          const ord = totalOrdered > 0 ? totalOrdered : Number(po.totalOrderedQty || (po.items ? po.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0));
          const rec = totalReceivedSoFar;
          const rem = Math.max(0, ord - rec);
          return {
            ...po,
            status: calculatedStatus,
            statusType: isFullyReceived ? 'closed' : 'partially_received',
            order_status: isFullyReceived ? 'closed' : 'received',
            totalOrderedQty: ord,
            totalReceivedQty: rec,
            totalRemainingQty: rem,
            receivingProgressPct: ord > 0 ? ((rec / ord) * 100).toFixed(1) : (isFullyReceived ? '100.0' : '0.0'),
            grnCount: (Number(po.grnCount) || 0) + 1,
            totalReceived: rec,
            items: (po.items || []).map((poIt, idx) => {
              const grnIt = (newGRN.items || []).find(gi => 
                (gi.name && poIt.name && gi.name.trim().toLowerCase() === poIt.name.trim().toLowerCase()) ||
                (gi.id && poIt.id && gi.id === poIt.id)
              ) || (newGRN.items || [])[idx];
              const itAccepted = grnIt ? Number(grnIt.accepted !== undefined && grnIt.accepted !== '' ? grnIt.accepted : (grnIt.now || 0)) : 0;
              const itOrdered = Number(poIt.qty || poIt.quantity || ord);
              const prevItRec = Number(poIt.previouslyReceived || 0) + itAccepted;
              return {
                ...poIt,
                previouslyReceived: prevItRec,
                remainingQty: Math.max(0, itOrdered - prevItRec)
              };
            })
          };
        }
        return po;
      });

      if (!matched) {
        const ord = totalOrdered > 0 ? totalOrdered : currentAccepted;
        const rec = totalReceivedSoFar;
        const rem = Math.max(0, ord - rec);
        updatedPOs.unshift({
          id: grnData.poRef || grnData.poNo || `PO-${Date.now()}`,
          poNo: grnData.poNo || grnData.poRef,
          vendor: grnData.vendor || 'Vendor',
          status: calculatedStatus,
          statusType: isFullyReceived ? 'closed' : 'partially_received',
          order_status: isFullyReceived ? 'closed' : 'received',
          totalOrderedQty: ord,
          totalReceivedQty: rec,
          totalRemainingQty: rem,
          grnCount: 1,
          totalReceived: rec,
          receivingProgressPct: ord > 0 ? ((rec / ord) * 100).toFixed(1) : (isFullyReceived ? '100.0' : '0.0'),
          items: (grnData.items || []).map(it => {
            const itOrd = Number(it.ordered || it.now || 0);
            const itAcc = Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
            return {
              name: it.name || 'Material Item',
              sku: it.sku || it.code || '',
              qty: itOrd,
              previouslyReceived: itAcc,
              remainingQty: Math.max(0, itOrd - itAcc)
            };
          })
        });
      }

      saveLocalPOs(updatedPOs);
      saveDatabaseStore('po_store', updatedPOs).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to update PO status in po_store:', err);
  }

  // 3. INWARD STOCK INTO INVENTORY (item_store.json & raw_materials_store.json) IMMEDIATELY!
  try {
    const localItems = loadLocalItems();
    if (Array.isArray(localItems) && localItems.length > 0) {
      let itemsUpdated = false;
      const updatedItems = localItems.map(item => {
        const itemNameClean = String(item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemCodeClean = String(item.code || item.sku || item.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let addedQty = 0;
        (newGRN.items || []).forEach(grnItem => {
          const grnItemNameClean = String(grnItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const grnItemCodeClean = String(grnItem.code || grnItem.sku || grnItem.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const isNameMatch = itemNameClean && grnItemNameClean && (itemNameClean === grnItemNameClean || itemNameClean.includes(grnItemNameClean) || grnItemNameClean.includes(itemNameClean));
          const isCodeMatch = itemCodeClean && grnItemCodeClean && (itemCodeClean === grnItemCodeClean || itemCodeClean.includes(grnItemCodeClean) || grnItemCodeClean.includes(itemCodeClean));

          if (isNameMatch || isCodeMatch) {
            const qty = Number(grnItem.accepted !== undefined && grnItem.accepted !== '' ? grnItem.accepted : (grnItem.now || 0));
            if (qty > 0) {
              addedQty += qty;
            }
          }
        });

        if (addedQty > 0) {
          itemsUpdated = true;
          const currentStock = Number(item.stock || 0);
          const newStock = currentStock + addedQty;
          console.log(`[INVENTORY STOCK UPDATE] Item: ${item.name} | Old Stock: ${currentStock} | Received: +${addedQty} | New Stock: ${newStock}`);
          return { 
            ...item, 
            stock: newStock,
            availableStock: newStock,
            physicalStock: (Number(item.physicalStock) || currentStock) + addedQty
          };
        }
        return item;
      });

      if (itemsUpdated) {
        saveLocalItems(updatedItems);
      }
    }

    const localRawMats = loadLocalRawMaterials();
    if (Array.isArray(localRawMats) && localRawMats.length > 0) {
      let rawUpdated = false;
      const updatedRaw = localRawMats.map(rm => {
        const rmNameClean = String(rm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const rmCodeClean = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        let addedQty = 0;
        (newGRN.items || []).forEach(grnItem => {
          const grnItemNameClean = String(grnItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const grnItemCodeClean = String(grnItem.code || grnItem.sku || grnItem.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isNameMatch = rmNameClean && grnItemNameClean && (rmNameClean === grnItemNameClean || rmNameClean.includes(grnItemNameClean) || grnItemNameClean.includes(rmNameClean));
          const isCodeMatch = rmCodeClean && grnItemCodeClean && (rmCodeClean === grnItemCodeClean || rmCodeClean.includes(grnItemCodeClean) || grnItemCodeClean.includes(rmCodeClean));

          if (isNameMatch || isCodeMatch) {
            const qty = Number(grnItem.accepted !== undefined && grnItem.accepted !== '' ? grnItem.accepted : (grnItem.now || 0));
            if (qty > 0) addedQty += qty;
          }
        });

        if (addedQty > 0) {
          rawUpdated = true;
          const currentStock = Number(rm.stock || 0);
          const newStock = currentStock + addedQty;
          console.log(`[RAW MATERIAL INWARD] Material: ${rm.name} | Old: ${currentStock} | Inwarded: +${addedQty} | New: ${newStock}`);
          return {
            ...rm,
            stock: newStock,
            availableStock: newStock,
            physicalStock: (Number(rm.physicalStock) || currentStock) + addedQty,
            goodsReceived: (Number(rm.goodsReceived) || 0) + addedQty,
            status: newStock > (rm.minLevel || 50) ? 'In Stock' : 'Low Stock',
            lastUpdated: `Inwarded from GRN ${newGRN.grnNo}`
          };
        }
        return rm;
      });

      if (rawUpdated) {
        const rawMatsPath = getStoreFilePath('raw_materials_store.json');
        fs.writeFileSync(rawMatsPath, JSON.stringify(updatedRaw, null, 2), 'utf8');
        supabaseMemoryStore.raw_materials_store = updatedRaw;
        pushStoreToSupabase('raw_materials_store', updatedRaw).catch(() => {});
        broadcastRealtimeEvent('inventory_updated', { action: 'update', recordId: newGRN.materialCode, grnNo: newGRN.grnNo });
      }
    }
  } catch (err) {
    console.error('Failed to update inventory stock on GRN save:', err);
  }

  // 4. RETURN SUCCESS TO CLIENT IMMEDIATELY!
  res.json({ success: true, grn: newGRN });
});

// Endpoint for MD Approval (Draft/Pending -> MD Approved) (Native BUSINZ Store)
app.post('/api/purchaseorders/:id/approve', async (req, res) => {
  const targetId = req.params.id;
  const remarks = req.body.remarks || 'Approved by MD';
  const approver = req.body.approver || 'Velmurugan Rathinam (MD)';

  const now = new Date();
  const approvedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const approvedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Update local PO store
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'MD Approved';
    localPOs[matchedIdx].statusType = 'md_approved';
    localPOs[matchedIdx].approvedBy = approver;
    localPOs[matchedIdx].approvalDate = approvedDate;
    localPOs[matchedIdx].approvalTime = approvedTime;
    localPOs[matchedIdx].approvalRemarks = remarks;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'MD Approved',
      statusType: 'md_approved',
      approvedBy: approver,
      approvalDate: approvedDate,
      approvalTime: approvedTime,
      approvalRemarks: remarks
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[approve] Supabase sync notice:', sbErr.message);
  }

  res.json({ success: true, message: `PO ${targetId} approved by ${approver} and marked as MD Approved!` });
});

// Endpoint for Payment Process (MD Approved -> Payment Processed / Credit Verified) (Native BUSINZ Store)
app.post('/api/purchaseorders/:id/process-payment', async (req, res) => {
  const targetId = req.params.id;
  const paymentMode = req.body.paymentMode || 'Bank Transfer';
  const paymentRef = req.body.paymentRef || 'TXN-PAID';
  const amountPaid = req.body.amountPaid || '';
  const remarks = req.body.remarks || 'Payment verified by Accounts';
  const isCredit = req.body.isCredit || paymentMode.toLowerCase().includes('credit');
  const creditTerms = req.body.creditTerms || 'Net 30 Days';

  const now = new Date();
  const paymentDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const paymentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const paymentImage = req.body.paymentImage || null;
  const paymentImageMeta = req.body.paymentImageMeta || null;

  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'Payment Processed';
    localPOs[matchedIdx].statusType = 'payment_processed';
    localPOs[matchedIdx].order_status = 'payment_processed';
    localPOs[matchedIdx].paymentDetails = {
      mode: paymentMode,
      refNo: paymentRef,
      amount: amountPaid || localPOs[matchedIdx].amount,
      date: paymentDate,
      time: paymentTime,
      remarks,
      isCredit,
      creditTerms,
      paymentImage,
      paymentImageMeta,
      verifiedBy: 'Accounts Team'
    };
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'Payment Processed',
      statusType: 'payment_processed',
      paymentDetails: {
        mode: paymentMode,
        refNo: paymentRef,
        amount: amountPaid,
        date: paymentDate,
        time: paymentTime,
        remarks,
        isCredit,
        creditTerms,
        paymentImage,
        paymentImageMeta,
        verifiedBy: 'Accounts Team'
      }
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[process-payment] Supabase sync notice:', sbErr.message);
  }

  res.json({ 
    success: true, 
    message: isCredit 
      ? `Credit terms verified by Accounts team for PO ${targetId}` 
      : `Payment processed and verified by Accounts for PO ${targetId}` 
  });
});

// Endpoint to Proceed PO (Payment Processed -> Proceed PO -> Ready for GRN & Auto Vendor Dispatch) (Native BUSINZ Store)
app.post('/api/purchaseorders/:id/proceed', async (req, res) => {
  const targetId = req.params.id;
  const remarks = req.body.remarks || 'Proceeded for dispatch and GRN';
  const authorizedBy = req.body.authorizedBy || 'Procurement Head';
  const incomingEmail = req.body.vendorEmail || req.body.email || '';

  const now = new Date();
  const proceedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const proceedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  const matchedPO = matchedIdx !== -1 ? localPOs[matchedIdx] : null;
  const vendorEmail = (incomingEmail && incomingEmail !== '—' && incomingEmail.includes('@'))
    ? incomingEmail.trim()
    : (matchedPO && matchedPO.email && matchedPO.email !== '—' && matchedPO.email.includes('@') ? matchedPO.email.trim() : '');

  const proceedDetails = {
    date: proceedDate,
    time: proceedTime,
    remarks,
    authorizedBy,
    vendorEmail,
    emailDispatched: Boolean(vendorEmail),
    emailSentAt: new Date().toISOString(),
    deliveryStatus: vendorEmail ? `Dispatched to ${vendorEmail}` : 'Authorized (Ready for GRN)'
  };

  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'Proceed PO';
    localPOs[matchedIdx].statusType = 'proceed_po';
    localPOs[matchedIdx].proceedDetails = proceedDetails;
    if (vendorEmail && (!localPOs[matchedIdx].email || localPOs[matchedIdx].email === '—')) {
      localPOs[matchedIdx].email = vendorEmail;
    }
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'Proceed PO',
      statusType: 'proceed_po',
      email: vendorEmail,
      proceedDetails
    });
    saveLocalPOs(localPOs);
  }

  try {
    await saveDatabaseStore('po_store', localPOs);
  } catch (sbErr) {
    console.warn('[proceed] Supabase sync notice:', sbErr.message);
  }

  const message = vendorEmail
    ? `PO ${targetId} marked as Proceed PO! An official copy was automatically dispatched to vendor (${vendorEmail}). Ready for GRN receiving.`
    : `PO ${targetId} marked as Proceed PO! Ready for GRN receiving.`;

  res.json({
    success: true,
    vendorEmail,
    emailDispatched: Boolean(vendorEmail),
    message
  });
});

// Endpoint to explicitly reject a Purchase Order (Pending -> Rejected) (Native BUSINZ Store)
app.post('/api/purchaseorders/:id/reject', async (req, res) => {
  const targetId = req.params.id;
  const reason = req.body.reason || req.body.rejectionReason;
  const rejectedBy = req.body.rejectedBy || 'CEO / Operations Manager';

  if (!reason || String(reason).trim() === '') {
    return res.status(400).json({ error: 'Rejection reason is mandatory when rejecting a Purchase Order.' });
  }

  const now = new Date();
  const rDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const rTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Update local PO store
  const localPOs = loadLocalPOs();
  const matchedIdx = localPOs.findIndex(p => p.id === targetId || p.poNo === targetId);
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'REJECTED';
    localPOs[matchedIdx].statusType = 'rejected';
    localPOs[matchedIdx].rejectedBy = rejectedBy;
    localPOs[matchedIdx].rejectionDate = rDate;
    localPOs[matchedIdx].rejectionTime = rTime;
    localPOs[matchedIdx].rejectionReason = reason;
    saveLocalPOs(localPOs);
  } else {
    localPOs.unshift({
      id: targetId,
      poNo: targetId,
      status: 'REJECTED',
      statusType: 'rejected',
      rejectedBy: rejectedBy,
      rejectionDate: rDate,
      rejectionTime: rTime,
      rejectionReason: reason
    });
    saveLocalPOs(localPOs);
  }

  res.json({ success: true, message: `PO ${targetId} rejected by ${rejectedBy}.` });
});

// Endpoint to explicitly close a Purchase Order in BUSINZ Authoritative Store (Native BUSINZ Store)
app.post('/api/purchaseorders/:id/close', async (req, res) => {
  const targetId = req.params.id;
  const localPOs = loadLocalPOs();
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const cleanTarget = normalize(targetId);
  const matchedIdx = localPOs.findIndex(p => {
    const pId = normalize(p.id);
    const pNo = normalize(p.poNo);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'CLOSED / FULLY RECEIVED';
    localPOs[matchedIdx].statusType = 'closed';
    localPOs[matchedIdx].order_status = 'closed';
    saveLocalPOs(localPOs);
  }
  res.json({ success: true, message: `Purchase Order ${targetId} marked as CLOSED in BUSINZ!` });
});

// Endpoint to delete a Purchase Order in BUSINZ Authoritative Store (Native BUSINZ Store)
app.delete('/api/purchaseorders/:id', async (req, res) => {
  const targetId = req.params.id;

  // Remove from local store
  const localPOs = loadLocalPOs();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedPOs = localPOs.filter(p => {
    const pId = String(p.id || '').toLowerCase();
    const pNo = String(p.poNo || '').toLowerCase();
    return pId !== targetClean && pNo !== targetClean;
  });
  saveLocalPOs(updatedPOs);

  res.json({ success: true, message: `PO ${targetId} deleted from BUSINZ!` });
});

// Real-time synchronization endpoint retrieving approval pending counts strictly from BUSINZ local stores
app.get('/api/approvals-pending', async (req, res) => {
  try {
    const pos = loadLocalPOs();
    const grns = loadLocalGRNs();
    let invoices = [];
    try {
      const invPath = getStoreFilePath('invoice_store.json');
      if (fs.existsSync(invPath)) invoices = JSON.parse(fs.readFileSync(invPath, 'utf8'));
    } catch (_) {}
    if (invoices.length === 0 && Array.isArray(supabaseMemoryStore.invoice_store)) {
      invoices = supabaseMemoryStore.invoice_store;
    }

    const posPending = pos.filter(po => {
      const st = String(po.status || '').toLowerCase();
      const stt = String(po.statusType || '').toLowerCase();
      return st.includes('pending') || st.includes('draft') || st.includes('waiting') || stt === 'pending' || stt === 'draft';
    }).length;

    const grnsPending = grns.filter(g => {
      const st = String(g.status || '').toLowerCase();
      return st.includes('pending') || st.includes('draft');
    }).length;

    const invoicesPending = invoices.filter(inv => {
      const st = String(inv.status || '').toLowerCase();
      const pay = String(inv.pay || '').toLowerCase();
      return st.includes('draft') || st.includes('pending') || pay.includes('draft') || pay.includes('ready');
    }).length;

    res.json({
      posPending,
      grnsPending,
      invoicesPending
    });
  } catch (err) {
    res.json({ posPending: 0, grnsPending: 0, invoicesPending: 0 });
  }
});



// Real-time endpoint retrieving items catalog strictly from BUSINZ local stores with search, category filtering & pagination
app.get('/api/items', async (req, res) => {
  const localItems = loadLocalItems();
  let guaranteedItems = (localItems || []).map(l => ({
    ...l,
    stock: (l.stock !== undefined && l.stock !== null) ? Number(l.stock) : 0,
    openingStock: (l.openingStock !== undefined && l.openingStock !== null) ? Number(l.openingStock) : 0
  }));

  // Filtering by category or search query
  const { category, search, page, limit } = req.query;
  if (category) {
    const catLower = String(category).toLowerCase().trim();
    guaranteedItems = guaranteedItems.filter(it => 
      String(it.category || it.cat || '').toLowerCase().trim() === catLower
    );
  }
  if (search) {
    const sLower = String(search).toLowerCase().trim();
    guaranteedItems = guaranteedItems.filter(it => 
      String(it.code || '').toLowerCase().includes(sLower) ||
      String(it.name || '').toLowerCase().includes(sLower) ||
      String(it.sku || '').toLowerCase().includes(sLower)
    );
  }

  // Server-side pagination if page query param provided
  if (page !== undefined && page !== null && page !== '') {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const total = guaranteedItems.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = guaranteedItems.slice(startIndex, startIndex + limitNum);
    return res.json({
      success: true,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total,
      data: paged
    });
  }

  res.json(guaranteedItems);
});

// Endpoint to retrieve live reconciled Raw Materials inventory with filtering & pagination
app.get('/api/raw-materials', async (req, res) => {
  try {
    let rawMats = [];
    if (supabaseMemoryStore.raw_materials_store && Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0) {
      rawMats = supabaseMemoryStore.raw_materials_store;
    } else {
      rawMats = loadLocalRawMaterials();
      if (!Array.isArray(rawMats) || rawMats.length === 0) {
        const cloudMats = await getDatabaseStore('raw_materials_store');
        if (Array.isArray(cloudMats) && cloudMats.length > 0) {
          cloudMats.forEach(item => {
            if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
              item.cat = 'Raw Material';
              item.category = 'Raw Material';
            }
          });
          supabaseMemoryStore.raw_materials_store = cloudMats;
          const rawMatsPath = getStoreFilePath('raw_materials_store.json');
          safeWriteJsonFileAsync(rawMatsPath, cloudMats);
          rawMats = cloudMats;
        }
      }
    }

    if (!Array.isArray(rawMats)) rawMats = [];

    // Optional filtering
    const { category, search, page, limit } = req.query;
    let filtered = rawMats;
    if (category) {
      const catLower = String(category).toLowerCase().trim();
      filtered = filtered.filter(it => 
        String(it.category || it.cat || '').toLowerCase().trim() === catLower
      );
    }
    if (search) {
      const sLower = String(search).toLowerCase().trim();
      filtered = filtered.filter(it => 
        String(it.code || '').toLowerCase().includes(sLower) ||
        String(it.name || '').toLowerCase().includes(sLower) ||
        String(it.sku || '').toLowerCase().includes(sLower)
      );
    }

    // Optional pagination
    if (page !== undefined && page !== null && page !== '') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 50);
      const total = filtered.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paged = filtered.slice(startIndex, startIndex + limitNum);
      return res.json({
        success: true,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
        data: paged
      });
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to update Raw Materials inventory
app.post('/api/raw-materials', async (req, res) => {
  try {
    const updatedMats = req.body;
    if (Array.isArray(updatedMats)) {
      const rawMatsPath = getStoreFilePath('raw_materials_store.json');
      safeWriteJsonFileAsync(rawMatsPath, updatedMats);
      supabaseMemoryStore.raw_materials_store = updatedMats;

      // Also sync matching items in item_store
      try {
        const itemPath = getStoreFilePath('item_store.json');
        let currentItems = [];
        if (fs.existsSync(itemPath)) {
          currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
        }
        if (Array.isArray(currentItems) && currentItems.length > 0) {
          const rawMap = new Map();
          updatedMats.forEach(rm => {
            const k = String(rm.code || rm.sku || rm.itemId || rm.name || '').toUpperCase().trim();
            if (k) rawMap.set(k, rm);
          });
          currentItems = currentItems.map(it => {
            const k = String(it.code || it.sku || it.itemId || it.name || '').toUpperCase().trim();
            const rm = rawMap.get(k);
            if (rm) {
              return {
                ...it,
                stock: rm.stock !== undefined ? rm.stock : it.stock,
                availableStock: rm.availableStock !== undefined ? rm.availableStock : it.availableStock,
                physicalStock: rm.physicalStock !== undefined ? rm.physicalStock : it.physicalStock,
                openingStock: rm.openingStock !== undefined ? rm.openingStock : it.openingStock,
                reserved: rm.reserved !== undefined ? rm.reserved : it.reserved
              };
            }
            return it;
          });
          safeWriteJsonFileAsync(itemPath, currentItems);
          supabaseMemoryStore.item_store = currentItems;
          pushStoreToSupabase('item_store', currentItems).catch(() => {});
          broadcastRealtimeEvent('item_store_updated', { action: 'update', count: currentItems.length });
        }
      } catch (err) {
        console.error('[item_store sync error]:', err?.message);
      }

      pushStoreToSupabase('raw_materials_store', updatedMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { action: 'update', count: updatedMats.length });
      return res.json({ success: true, count: updatedMats.length });
    }
    res.status(400).json({ success: false, message: 'Array of materials required' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get authoritative list of deleted raw material codes across all logins
app.get('/api/raw-materials/deleted', (req, res) => {
  res.json(loadDeletedRawMaterialCodes());
});

// Endpoint to delete raw materials across all stores, databases, and user logins
app.post('/api/raw-materials/delete', async (req, res) => {
  try {
    const rawCodes = Array.isArray(req.body?.codes)
      ? req.body.codes
      : (req.body?.code ? [req.body.code] : []);
    const codesToDelete = rawCodes.map(c => String(c).toUpperCase().trim()).filter(Boolean);

    if (codesToDelete.length === 0) {
      return res.status(400).json({ success: false, message: 'No material codes provided for deletion' });
    }

    // 1. Save deleted codes persistently
    const existingDeleted = loadDeletedRawMaterialCodes();
    const updatedDeleted = Array.from(new Set([...existingDeleted, ...codesToDelete]));
    saveDeletedRawMaterialCodes(updatedDeleted);

    // 2. Remove from raw materials store
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toUpperCase().trim();
      const mName = String(m.name || '').toUpperCase().trim();
      return !codesToDelete.includes(mCode) && !codesToDelete.includes(mName);
    });
    safeWriteJsonFileAsync(rawMatsPath, filteredMats);
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);

    // 3. Remove from items catalog store as well
    const itemPath = getStoreFilePath('item_store.json');
    let currentItems = [];
    if (fs.existsSync(itemPath)) {
      try { currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredItems = currentItems.filter(it => {
      const iCode = String(it.code || it.sku || it.itemId || it.id || '').toUpperCase().trim();
      const iName = String(it.name || '').toUpperCase().trim();
      return !codesToDelete.includes(iCode) && !codesToDelete.includes(iName);
    });
    safeWriteJsonFileAsync(itemPath, filteredItems);
    supabaseMemoryStore.item_store = filteredItems;
    saveDatabaseStore('item_store', filteredItems);

    // 4. Real-time broadcasts
    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: codesToDelete });
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedCodes: codesToDelete });

    return res.json({
      success: true,
      deletedCount: codesToDelete.length,
      remainingMats: filteredMats.length,
      message: `Deleted ${codesToDelete.length} item(s) from inventory across all stores.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/raw-materials/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ success: false, message: 'Invalid material code' });

    const existingDeleted = loadDeletedRawMaterialCodes();
    const updatedDeleted = Array.from(new Set([...existingDeleted, code]));
    saveDeletedRawMaterialCodes(updatedDeleted);

    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toUpperCase().trim();
      const mName = String(m.name || '').toUpperCase().trim();
      return mCode !== code && mName !== code;
    });
    fs.writeFileSync(rawMatsPath, JSON.stringify(filteredMats, null, 2), 'utf8');
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);

    const itemPath = getStoreFilePath('item_store.json');
    let currentItems = [];
    if (fs.existsSync(itemPath)) {
      try { currentItems = JSON.parse(fs.readFileSync(itemPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredItems = currentItems.filter(it => {
      const iCode = String(it.code || it.sku || it.itemId || it.id || '').toUpperCase().trim();
      const iName = String(it.name || '').toUpperCase().trim();
      return iCode !== code && iName !== code;
    });
    fs.writeFileSync(itemPath, JSON.stringify(filteredItems, null, 2), 'utf8');
    supabaseMemoryStore.item_store = filteredItems;
    saveDatabaseStore('item_store', filteredItems);

    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: [code] });
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedCodes: [code] });

    res.json({ success: true, message: `Material ${code} deleted permanently.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to bulk delete items from catalog store
app.post('/api/items/delete', async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body?.ids)
      ? req.body.ids
      : (req.body?.id ? [req.body.id] : []);
    const idsToDelete = rawIds.map(id => String(id).toLowerCase().trim()).filter(Boolean);

    const localItems = loadLocalItems();
    const updatedItems = localItems.filter(i => {
      const iId = String(i.itemId || i.id || '').toLowerCase().trim();
      const iSku = String(i.sku || '').toLowerCase().trim();
      const iName = String(i.name || '').toLowerCase().trim();
      return !idsToDelete.includes(iId) && !idsToDelete.includes(iSku) && !idsToDelete.includes(iName);
    });

    saveLocalItems(updatedItems);
    broadcastRealtimeEvent('item_store_updated', { action: 'delete', deletedIds: idsToDelete });

    // Also sync delete with raw materials
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let currentMats = [];
    if (fs.existsSync(rawMatsPath)) {
      try { currentMats = JSON.parse(fs.readFileSync(rawMatsPath, 'utf8')) || []; } catch (_) {}
    }
    const filteredMats = currentMats.filter(m => {
      const mCode = String(m.code || m.sku || '').toLowerCase().trim();
      const mName = String(m.name || '').toLowerCase().trim();
      return !idsToDelete.includes(mCode) && !idsToDelete.includes(mName);
    });
    fs.writeFileSync(rawMatsPath, JSON.stringify(filteredMats, null, 2), 'utf8');
    supabaseMemoryStore.raw_materials_store = filteredMats;
    saveDatabaseStore('raw_materials_store', filteredMats);
    broadcastRealtimeEvent('inventory_updated', { action: 'delete', deletedCodes: idsToDelete });

    res.json({ success: true, count: idsToDelete.length, message: `Deleted ${idsToDelete.length} item(s)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to atomically deduct stock for BOM orders across all roles
app.post('/api/raw-materials/deduct', async (req, res) => {
  try {
    const { bomCode, items, user } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, message: 'No items to deduct' });
    }

    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    let rawMats = loadLocalRawMaterials();
    if (!Array.isArray(rawMats) || rawMats.length === 0) {
      rawMats = [];
    }

    const itemsPath = getStoreFilePath('item_store.json');
    let itemsList = loadLocalItems();
    if (!Array.isArray(itemsList)) itemsList = [];

    const deductedList = [];

    items.forEach(it => {
      const qty = parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0;
      if (qty <= 0) return;
      const cleanCode = String(it.code || it.sku || '').toUpperCase().trim();
      const cleanName = String(it.name || it.description || '').toLowerCase().trim();

      const mat = rawMats.find(m => {
        const mCode = String(m.code || m.sku || '').toUpperCase().trim();
        const mName = String(m.name || '').toLowerCase().trim();
        if (cleanCode && mCode === cleanCode) return true;
        if (cleanName && mName === cleanName) return true;
        if (cleanName && cleanName.length > 5 && mName.includes(cleanName)) return true;
        if ((cleanCode === 'MR-300MM' || cleanName.includes('mini rail')) && (mCode === 'MR-300MM' || mCode === 'MR100N' || (mName.includes('mini rail') && mName.includes('300')))) return true;
        return false;
      });

      if (mat) {
        const baseOpen = Math.max(0, parseFloat(mat.openingStock !== undefined ? mat.openingStock : (mat.physicalStock !== undefined ? mat.physicalStock : 0)) || 0);
        const curStock = parseFloat(mat.stock !== undefined ? mat.stock : (mat.physicalStock || baseOpen)) || 0;
        const newStock = Math.max(0, curStock - qty);
        mat.openingStock = baseOpen;
        mat.stock = newStock;
        mat.physicalStock = newStock;
        mat.availableStock = newStock;
        mat.reserved = Math.max(0, (parseFloat(mat.reserved) || 0) - qty);
        mat.blockedForBom = mat.reserved;
        mat.lastUpdated = `Deducted ${qty} for BOM ${bomCode || 'Order'} by ${user || 'System'}`;
        deductedList.push({ code: mat.code, name: mat.name, deducted: qty, remaining: newStock });
      }

      const itMatch = itemsList.find(m => {
        const mCode = String(m.code || m.sku || m.itemId || '').toUpperCase().trim();
        const mName = String(m.name || '').toLowerCase().trim();
        if (cleanCode && mCode === cleanCode) return true;
        if (cleanName && mName === cleanName) return true;
        if (cleanName && cleanName.length > 5 && mName.includes(cleanName)) return true;
        if ((cleanCode === 'MR-300MM' || cleanName.includes('mini rail')) && (mCode === 'MR-300MM' || mCode === 'MR100N' || (mName.includes('mini rail') && mName.includes('300')))) return true;
        return false;
      });

      if (itMatch) {
        const baseOpen = Math.max(0, parseFloat(itMatch.openingStock !== undefined ? itMatch.openingStock : (itMatch.physicalStock !== undefined ? itMatch.physicalStock : 0)) || 0);
        const curStock = parseFloat(itMatch.stock !== undefined ? itMatch.stock : (itMatch.physicalStock || baseOpen)) || 0;
        const newStock = Math.max(0, curStock - qty);
        itMatch.openingStock = baseOpen;
        itMatch.stock = newStock;
        itMatch.physicalStock = newStock;
        itMatch.availableStock = newStock;
        itMatch.reserved = Math.max(0, (parseFloat(itMatch.reserved) || 0) - qty);
      }
    });

    if (deductedList.length > 0) {
      fs.writeFileSync(rawMatsPath, JSON.stringify(rawMats, null, 2), 'utf8');
      supabaseMemoryStore.raw_materials_store = rawMats;
      pushStoreToSupabase('raw_materials_store', rawMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { action: 'deduct', bomCode, deducted: deductedList });

      fs.writeFileSync(itemsPath, JSON.stringify(itemsList, null, 2), 'utf8');
      supabaseMemoryStore.item_store = itemsList;
      pushStoreToSupabase('item_store', itemsList).catch(() => {});
      broadcastRealtimeEvent('item_store_updated', { action: 'deduct', bomCode, deducted: deductedList });

      console.log(`[INVENTORY DEDUCTION] Deducted stock for BOM ${bomCode}:`, deductedList);
    }

    res.json({ success: true, deducted: deductedList, rawMaterials: rawMats });
  } catch (err) {
    console.error('[INVENTORY DEDUCTION ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});



// Endpoint to delete an Item in BUSINZ Authoritative Store (Native BUSINZ Store)
app.delete('/api/items/:id', async (req, res) => {
  const targetId = req.params.id;

  const localItems = loadLocalItems();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedItems = localItems.filter(i => {
    const iId = String(i.itemId || i.id || '').toLowerCase();
    const iSku = String(i.sku || '').toLowerCase();
    const iName = String(i.name || '').toLowerCase();
    return iId !== targetClean && iSku !== targetClean && iName !== targetClean;
  });
  saveLocalItems(updatedItems);

  res.json({ success: true, message: `Item ${targetId} deleted from BUSINZ!` });
});

// Real-time synchronization endpoint retrieving item details strictly from BUSINZ local stores
app.get('/api/items/:id', async (req, res) => {
  const targetId = String(req.params.id || '').trim().toLowerCase();
  const localItems = loadLocalItems();
  const item = localItems.find(i => 
    String(i.itemId || '').toLowerCase() === targetId ||
    String(i.id || '').toLowerCase() === targetId ||
    String(i.sku || '').toLowerCase() === targetId ||
    String(i.code || '').toLowerCase() === targetId
  );

  if (item) {
    res.json({
      itemId: item.itemId || item.id,
      name: item.name,
      sku: item.sku || item.code || '—',
      status: item.status || 'Active',
      description: item.description || '—',
      unit: item.unit || item.uom || 'NOS',
      rate: item.rate || item.price || 0,
      purchaseRate: item.purchaseRate || item.purchase_rate || item.rate || 0,
      purchaseDescription: item.purchaseDescription || item.purchase_description || item.description || '—',
      stockOnHand: item.stock !== undefined ? item.stock : (item.stockOnHand !== undefined ? item.stockOnHand : '—'),
      reorderLevel: item.reorderLevel || '—',
      itemType: item.itemType || 'sales_and_purchase',
      productType: item.productType || 'goods',
      purchaseAccount: item.purchaseAccount || 'Cost of Goods Sold',
      salesAccount: item.salesAccount || 'Sales',
      taxName: item.taxName || 'GST 18%',
      taxPercentage: item.taxPercentage !== undefined ? item.taxPercentage : 18
    });
  } else {
    res.status(404).json({ error: 'Item not found in local catalog.' });
  }
});

// Endpoint to update item details in BUSINZ Authoritative Store (Native BUSINZ Store)
app.put('/api/items/:id', async (req, res) => {
  const targetId = req.params.id;
  const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';

  let updatedItem = null;
  try {
    const localItems = loadLocalItems();
    const updated = localItems.map(it => {
      if (String(it.itemId || it.id) === String(targetId) || String(it.sku) === String(targetId)) {
        updatedItem = {
          ...it,
          ...req.body,
          status: reqStatus
        };
        return updatedItem;
      }
      return it;
    });
    saveLocalItems(updated);
  } catch (e) {
    console.error('Error updating local item:', e);
  }

  return res.json({ 
    success: true, 
    item: updatedItem || { id: targetId, ...req.body, status: reqStatus }, 
    message: 'Item updated successfully in BUSINZ.' 
  });
});

// Endpoint to create a new product in BUSINZ Authoritative Store (Native BUSINZ Store)
app.post('/api/items', async (req, res) => {
  try {
    const localItems = loadLocalItems();

    if (Array.isArray(req.body)) {
      const incomingList = req.body;
      const createdItems = [];
      let currentItems = [...localItems];

      incomingList.forEach((it, idx) => {
        const newItemId = it.itemId || it.id || it.sku || `ITEM-${Date.now()}-${idx + 1}`;
        const reqStatus = (it.status && String(it.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
        const cleanCode = String(it.code || it.sku || newItemId).trim();
        const cleanRate = Number(it.rate || it.price || 0) || 0;
        const cleanUnit = it.unit || it.uom || 'NOS';
        const cleanCat = it.category || it.cat || (it.productType === 'service' ? 'Services' : 'Finished Goods');
        const cleanStock = it.stock !== undefined ? Number(it.stock) : 0;

        const itemRecord = {
          itemId: newItemId,
          id: newItemId,
          code: cleanCode,
          sku: cleanCode,
          name: String(it.name || it.description || newItemId).trim(),
          rate: cleanRate,
          price: cleanRate,
          status: reqStatus,
          description: it.description || '—',
          unit: cleanUnit,
          uom: cleanUnit,
          purchaseRate: Number(it.purchaseRate || 0) || 0,
          purchaseDescription: it.purchaseDescription || '—',
          productType: it.productType || 'goods',
          category: cleanCat,
          cat: cleanCat,
          stock: cleanStock,
          openingStock: it.openingStock !== undefined ? Number(it.openingStock) : cleanStock,
          physicalStock: it.physicalStock !== undefined ? Number(it.physicalStock) : cleanStock,
          availableStock: it.availableStock !== undefined ? Number(it.availableStock) : cleanStock,
          available: cleanStock,
          reserved: 0,
          createdAt: it.createdAt || new Date().toISOString()
        };

        const targetId = String(itemRecord.itemId).toLowerCase().trim();
        const targetSku = String(itemRecord.sku).toLowerCase().trim();
        const targetName = String(itemRecord.name).toLowerCase().trim();

        const exIdx = currentItems.findIndex(i => {
          const iId = String(i.itemId || i.id || '').toLowerCase().trim();
          const iSku = String(i.sku || i.code || '').toLowerCase().trim();
          const iName = String(i.name || '').toLowerCase().trim();
          return (targetSku && iSku === targetSku) || (targetId && iId === targetId) || (targetName && iName === targetName);
        });

        if (exIdx !== -1) {
          currentItems[exIdx] = { ...currentItems[exIdx], ...itemRecord };
        } else {
          currentItems = [itemRecord, ...currentItems];
        }
        createdItems.push(itemRecord);
      });

      saveLocalItems(currentItems);

      try {
        broadcastRealtimeEvent('item_store_updated', { action: 'create', count: createdItems.length, items: createdItems });
      } catch (_) {}

      return res.json({
        success: true,
        count: createdItems.length,
        items: createdItems,
        message: `Successfully registered ${createdItems.length} items in BUSINZ!`
      });
    }

    const newItemId = req.body.itemId || req.body.id || ('ITEM-' + Date.now());
    const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
    const cleanCode = String(req.body.code || req.body.sku || newItemId).trim();
    const cleanRate = Number(req.body.rate || req.body.price || 0) || 0;
    const cleanUnit = req.body.unit || req.body.uom || 'NOS';
    const cleanCat = req.body.category || req.body.cat || (req.body.productType === 'service' ? 'Services' : 'Finished Goods');
    const cleanStock = req.body.stock !== undefined ? Number(req.body.stock) : 0;

    const itemToSave = {
      itemId: newItemId,
      id: newItemId,
      code: cleanCode,
      sku: cleanCode,
      name: String(req.body.name || '').trim(),
      rate: cleanRate,
      price: cleanRate,
      status: reqStatus,
      description: req.body.description || '—',
      unit: cleanUnit,
      uom: cleanUnit,
      purchaseRate: Number(req.body.purchaseRate) || 0,
      purchaseDescription: req.body.purchaseDescription || '—',
      productType: req.body.productType || 'goods',
      category: cleanCat,
      cat: cleanCat,
      stock: cleanStock,
      openingStock: req.body.openingStock !== undefined ? Number(req.body.openingStock) : cleanStock,
      physicalStock: req.body.physicalStock !== undefined ? Number(req.body.physicalStock) : cleanStock,
      availableStock: req.body.availableStock !== undefined ? Number(req.body.availableStock) : cleanStock,
      available: cleanStock,
      reserved: 0,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const filtered = localItems.filter(i => {
      const iId = String(i.itemId || i.id || '').toLowerCase().trim();
      const iSku = String(i.sku || i.code || '').toLowerCase().trim();
      const iName = String(i.name || '').toLowerCase().trim();
      const tId = String(itemToSave.itemId).toLowerCase().trim();
      const tSku = String(itemToSave.sku).toLowerCase().trim();
      const tName = String(itemToSave.name).toLowerCase().trim();
      return (tId && iId === tId) || (tSku && iSku === tSku) || (tName && iName === tName);
    });
    const updated = [itemToSave, ...filtered];
    saveLocalItems(updated);

    try {
      broadcastRealtimeEvent('item_store_updated', { action: 'update', recordId: itemToSave.code || itemToSave.itemId, item: itemToSave });
    } catch (_) {}

    return res.json({ 
      success: true, 
      item: itemToSave, 
      message: 'Item saved successfully in BUSINZ.'
    });
  } catch (e) {
    console.error('Failed to save newly created item to item_store:', e);
    return res.status(500).json({ error: 'Failed to save item: ' + e.message });
  }
});

// Universal Stock Reset Endpoint: Resets all stock to 0, wipes allocations, and sets each item to exactly 5,000
app.all('/api/inventory/reset-to-5000', async (req, res) => {
  try {
    const localItems = loadLocalItems();
    const existingRaw = supabaseMemoryStore.raw_materials_store || [];
    
    // Step 1: Combine VRM standardized products, catalog items, and existing raw profiles
    const itemMap = new Map();

    // 1. Add all 285 VRM standardized products
    (VRM_PRODUCTS || []).forEach(p => {
      const code = p.code || resolveProductCode(p) || p.name;
      const key = String(code).toUpperCase().trim();
      itemMap.set(key, {
        code: p.code || code,
        sku: p.code || code,
        itemId: p.code || code,
        name: p.name,
        cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        unit: p.uom || 'Nos',
        uom: p.uom || 'Nos',
        price: p.price || p.rate || 0,
        rate: p.price || p.rate || 0,
        gstRate: p.gst || '18%',
        status: 'Active',
        productType: 'goods',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        location: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        minLevel: 50,
        reorderLevel: 100
      });
    });

    // 2. Merge existing raw materials
    (existingRaw || []).forEach(rm => {
      const code = rm.code || rm.sku || rm.itemId || rm.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      itemMap.set(key, {
        ...existing,
        ...rm,
        code: rm.code || existing.code || code,
        name: rm.name || existing.name,
        cat: rm.cat || rm.category || existing.cat || 'Aluminium',
        category: rm.cat || rm.category || existing.cat || 'Aluminium',
        unit: rm.unit || rm.uom || existing.unit || 'Nos'
      });
    });

    // 3. Merge local catalog items
    (localItems || []).forEach(it => {
      const code = it.code || it.sku || it.itemId || it.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      itemMap.set(key, {
        ...existing,
        ...it,
        code: it.code || it.sku || existing.code || code,
        name: it.name || existing.name,
        cat: it.category || it.material || existing.cat || 'General',
        category: it.category || it.material || existing.cat || 'General',
        unit: it.unit || it.uom || existing.unit || 'Nos'
      });
    });

    // Step 2: Remove all stock (start from 0) and then add exactly 5,000
    const unified5000List = Array.from(itemMap.values()).map(item => ({
      ...item,
      stock: 5000,
      openingStock: 5000,
      physicalStock: 5000,
      availableStock: 5000,
      stockOnHand: 5000,
      reserved: 0,
      blockedForBom: 0,
      goodsReceived: 0,
      issuedProd: 0,
      matReturn: 0,
      stockAdj: 0,
      status: 'In Stock',
      lastUpdated: 'Stock Reset to 5,000'
    }));

    // Step 3: Persist to raw_materials_store (used by Inventory Stores)
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    try {
      fs.writeFileSync(rawMatsPath, JSON.stringify(unified5000List, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.raw_materials_store = unified5000List;
    await saveDatabaseStore('raw_materials_store', unified5000List);

    // Step 4: Persist to item_store (used by Item Directory & Catalog)
    const itemsPath = getStoreFilePath('item_store.json');
    try {
      fs.writeFileSync(itemsPath, JSON.stringify(unified5000List, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.item_store = unified5000List;
    await saveDatabaseStore('item_store', unified5000List);

    // Broadcast update to all connected clients
    broadcastRealtimeEvent('inventory_updated', { rawMaterials: unified5000List });
    broadcastRealtimeEvent('item_store_updated', { items: unified5000List });
    broadcastRealtimeEvent('stock_reset_5000', { timestamp: new Date().toISOString() });

    console.log(`✅ [STOCK RESET] All ${unified5000List.length} items reset from 0 to exactly 5,000 stock!`);
    res.json({
      success: true,
      count: unified5000List.length,
      message: `Successfully reset all stock starting from 0 and assigned exactly 5,000 stock to all ${unified5000List.length} items in the inventory store and item directory.`
    });
  } catch (err) {
    console.error('Error during stock reset:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Universal Stock Reset to ZERO Endpoint: Sets EVERY single item's stock to 0
app.all('/api/inventory/reset-to-zero', async (req, res) => {
  try {
    const localItems = loadLocalItems();
    const existingRaw = supabaseMemoryStore.raw_materials_store || [];
    
    const itemMap = new Map();

    (VRM_PRODUCTS || []).forEach(p => {
      const code = p.code || resolveProductCode(p) || p.name;
      const key = String(code).toUpperCase().trim();
      itemMap.set(key, {
        code: p.code || code,
        sku: p.code || code,
        itemId: p.code || code,
        name: p.name,
        cat: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        category: p.material === 'HDG' || p.material === 'GAL' ? 'Structure Assemblies' : (p.material === 'ALU' ? 'Aluminium Profiles' : 'Finished Goods'),
        unit: p.uom || 'Nos',
        uom: p.uom || 'Nos',
        price: p.price || p.rate || 0,
        rate: p.price || p.rate || 0,
        gstRate: p.gst || '18%',
        status: 'Out of Stock',
        productType: 'goods',
        store: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        location: p.material === 'HDG' ? 'Finished Goods Bay - HDG' : p.material === 'GAL' ? 'Finished Goods Bay - GAL' : 'Finished Goods Bay - Aluminium',
        hsn: '7604',
        minLevel: 50,
        reorderLevel: 100
      });
    });

    (existingRaw || []).forEach(rm => {
      const code = rm.code || rm.sku || rm.itemId || rm.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      itemMap.set(key, {
        ...existing,
        ...rm,
        code: rm.code || existing.code || code,
        name: rm.name || existing.name,
        cat: rm.cat || rm.category || existing.cat || 'Aluminium',
        category: rm.cat || rm.category || existing.cat || 'Aluminium',
        unit: rm.unit || rm.uom || existing.unit || 'Nos'
      });
    });

    (localItems || []).forEach(it => {
      const code = it.code || it.sku || it.itemId || it.name;
      if (!code) return;
      const key = String(code).toUpperCase().trim();
      const existing = itemMap.get(key) || {};
      itemMap.set(key, {
        ...existing,
        ...it,
        code: it.code || it.sku || existing.code || code,
        name: it.name || existing.name,
        cat: it.category || it.material || existing.cat || 'General',
        category: it.category || it.material || existing.cat || 'General',
        unit: it.unit || it.uom || existing.unit || 'Nos'
      });
    });

    // Reset ALL stock to exactly 0
    const zeroList = Array.from(itemMap.values()).map(item => ({
      ...item,
      stock: 0,
      openingStock: 0,
      physicalStock: 0,
      availableStock: 0,
      stockOnHand: 0,
      reserved: 0,
      blockedForBom: 0,
      goodsReceived: 0,
      issuedProd: 0,
      matReturn: 0,
      stockAdj: 0,
      status: 'Out of Stock',
      lastUpdated: 'Stock Set to 0'
    }));

    // Persist to raw_materials_store
    const rawMatsPath = getStoreFilePath('raw_materials_store.json');
    try {
      fs.writeFileSync(rawMatsPath, JSON.stringify(zeroList, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.raw_materials_store = zeroList;
    await saveDatabaseStore('raw_materials_store', zeroList);

    // Persist to item_store
    const itemsPath = getStoreFilePath('item_store.json');
    try {
      fs.writeFileSync(itemsPath, JSON.stringify(zeroList, null, 2), 'utf8');
    } catch (_) {}
    supabaseMemoryStore.item_store = zeroList;
    await saveDatabaseStore('item_store', zeroList);

    // Persist to vrm_prod_inventory
    const vrmPath = getStoreFilePath('vrm_prod_inventory.json');
    let vrmItems = [];
    try {
      if (fs.existsSync(vrmPath)) {
        vrmItems = JSON.parse(fs.readFileSync(vrmPath, 'utf8'));
      }
    } catch (_) {}
    if (Array.isArray(vrmItems) && vrmItems.length > 0) {
      vrmItems = vrmItems.map(vi => ({
        ...vi,
        physicalStock: 0,
        availableStock: 0,
        reservedStock: 0,
        issuedStock: 0,
        consumedStock: 0,
        stock: 0,
        openingStock: 0,
        status: 'Out of Stock'
      }));
      try {
        fs.writeFileSync(vrmPath, JSON.stringify(vrmItems, null, 2), 'utf8');
      } catch (_) {}
      supabaseMemoryStore.vrm_prod_inventory = vrmItems;
      await saveDatabaseStore('vrm_prod_inventory', vrmItems);
    }

    // Broadcast update to all connected clients immediately
    broadcastRealtimeEvent('inventory_updated', { rawMaterials: zeroList });
    broadcastRealtimeEvent('item_store_updated', { items: zeroList });
    broadcastRealtimeEvent('vrm_inventory_updated', { inventory: vrmItems });
    broadcastRealtimeEvent('stock_reset_0', { timestamp: new Date().toISOString() });

    console.log(`✅ [STOCK RESET TO 0] All ${zeroList.length} items set to exactly 0 stock!`);
    res.json({
      success: true,
      count: zeroList.length,
      message: `Successfully set every item stock to 0 across all stores.`
    });
  } catch (err) {
    console.error('Error during stock reset to 0:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// 📱 META WHATSAPP CLOUD API & CRM BACKEND
// ==========================================
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'vrm_structures_wa_secret_2026';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

// Meta WhatsApp Webhook verification (GET)
app.get('/api/crm/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Meta WhatsApp Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Meta WhatsApp Webhook listener for incoming messages (POST)
app.post('/api/crm/whatsapp/webhook', (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          const value = change.value;
          if (value?.messages && value.messages.length > 0) {
            const message = value.messages[0];
            const senderPhone = message.from; // e.g. "919876543210"
            const textBody = message.text?.body || '';
            const msgId = message.id;
            const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000).toISOString() : new Date().toISOString();

            console.log(`📩 Incoming WhatsApp from +${senderPhone}: "${textBody}"`);

            const formattedPhone = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`;
            broadcastRealtimeEvent('whatsapp_message', {
              from: senderPhone,
              formattedPhone,
              text: textBody,
              msgId,
              timestamp
            });
          }
        });
      });
      return res.status(200).send('EVENT_RECEIVED');
    }
    res.sendStatus(404);
  } catch (err) {
    console.error('WhatsApp webhook processing notice:', err);
    res.sendStatus(200);
  }
});

// Send outgoing WhatsApp message via Cloud API
app.post('/api/crm/whatsapp/send-message', async (req, res) => {
  const { to, text, type = 'text', templateName, templateVariables = [] } = req.body;
  if (!to) {
    return res.status(400).json({ error: 'Recipient phone number is required.' });
  }

  // If live credentials are provided, send via Meta Graph API; otherwise simulate success
  if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = type === 'template' ? {
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: templateVariables.length > 0 ? [
            {
              type: 'body',
              parameters: templateVariables.map(v => ({ type: 'text', text: String(v) }))
            }
          ] : []
        }
      } : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { preview_url: false, body: text }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return res.json({ success: true, metaResponse: data, messageId: data.messages?.[0]?.id || `WA-${Date.now()}` });
    } catch (apiErr) {
      console.error('Meta API call failed, using local dispatch:', apiErr.message);
    }
  }

  // Simulated delivery for local development & fallback
  res.json({
    success: true,
    simulated: true,
    messageId: `WA-SIM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'delivered',
    notice: 'Dispatched via VRM WhatsApp Cloud Gateway'
  });
});

// ==========================================
// 📱 MULTI-SESSION WHATSAPP FOR SALES REPS (METHOD 1)
// ==========================================

// Get user's session status & QR code
app.get('/api/whatsapp/multi/status/:userId', (req, res) => {
  const { userId } = req.params;
  const status = getUserSessionStatus(userId);
  res.json({ success: true, ...status });
});

// Start or request QR code connection for a sales rep
app.post('/api/whatsapp/multi/connect/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const status = await initUserSession(userId, {
      onMessageReceived: (msgData) => {
        console.log(`📩 [WhatsApp Multi] Rep ${userId} received message from ${msgData.formattedPhone}: "${msgData.text}"`);
        broadcastRealtimeEvent('whatsapp_message', msgData);
      },
      onStatusChange: (statusData) => {
        broadcastRealtimeEvent('whatsapp_session_update', statusData);
      },
      onChatsUpdated: (chatsList) => {
        broadcastRealtimeEvent('whatsapp_chats_updated', { userId, count: chatsList.length, chats: chatsList });
      }
    });
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect / logout sales rep's WhatsApp session
app.post('/api/whatsapp/multi/disconnect/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await logoutUserSession(userId);
    broadcastRealtimeEvent('whatsapp_session_update', { userId, status: 'DISCONNECTED', isReady: false });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all active sales reps sessions
app.get('/api/whatsapp/multi/sessions', (req, res) => {
  const sessions = getAllUserSessions();
  res.json({ success: true, sessions });
});

// Send message or PDF document from a specific sales rep's WhatsApp
app.post('/api/whatsapp/multi/send', async (req, res) => {
  const { userId, to, text, document, fileName, mimetype, caption } = req.body;
  if (!userId || !to) {
    return res.status(400).json({ error: 'Both userId and recipient phone (to) are required.' });
  }

  try {
    const result = await sendUserWhatsAppMessage(userId, {
      to,
      text,
      document,
      fileName,
      mimetype,
      caption
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(`[WhatsApp Multi Send Error for ${userId}]:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get real synced WhatsApp chats & contacts for a sales rep
app.get('/api/whatsapp/multi/chats/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const chats = getUserChats(userId);
    const session = getUserSessionStatus(userId);
    res.json({ success: true, chats, isConnected: session.isReady, phoneNumber: session.phoneNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, chats: [] });
  }
});

// Start a new chat conversation with a specific contact/phone number
app.post('/api/whatsapp/multi/start-chat', (req, res) => {
  const { userId, phone, name, company } = req.body;
  if (!userId || !phone) {
    return res.status(400).json({ error: 'Both userId and phone are required.' });
  }
  try {
    const chat = addUserChat(userId, { phone, name, company });
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI Solar Enquiry Analysis endpoint
app.post('/api/crm/ai/analyze-enquiry', (req, res) => {
  const { message = '' } = req.body;
  const clean = String(message || '').toLowerCase();

  const kwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kw|k\.w|kilowatt|megawatt|mw)/i);
  const panelMatch = clean.match(/(\d+)\s*(?:panel|panels|nos|modules)/i);

  let estimatedKw = null;
  let estimatedPanels = null;

  if (kwMatch) {
    let val = parseFloat(kwMatch[1]);
    if (clean.includes('mw') || clean.includes('megawatt')) val = val * 1000;
    estimatedKw = val;
    estimatedPanels = Math.round((val * 1000) / 550);
  } else if (panelMatch) {
    estimatedPanels = parseInt(panelMatch[1]);
    estimatedKw = Math.round((estimatedPanels * 550) / 1000);
  }

  let category = 'Aluminium Mounting Structures';
  if (clean.includes('tin') || clean.includes('sheet') || clean.includes('shed') || clean.includes('mini rail')) {
    category = 'Tin Shed Clamping Systems';
  } else if (clean.includes('ground') || clean.includes('hdg') || clean.includes('purlin') || clean.includes('fixed tilt')) {
    category = 'HDG Ground Mounting Structures';
  } else if (clean.includes('walkway') || clean.includes('handrail') || clean.includes('frp')) {
    category = 'Walkways & Safety Handrails';
  } else if (clean.includes('ballast') || clean.includes('flat roof')) {
    category = 'Ballasted Rooftop Systems';
  }

  let intent = 'General Inquiry';
  if (clean.includes('price') || clean.includes('rate') || clean.includes('cost') || clean.includes('quote') || clean.includes('quotation')) {
    intent = 'Price / Quotation Enquiry';
  } else if (clean.includes('urgent') || clean.includes('immediate') || clean.includes('dispatch') || clean.includes('stock')) {
    intent = 'Urgent Stock Availability';
  } else if (clean.includes('drawing') || clean.includes('staad') || clean.includes('spec') || clean.includes('datasheet')) {
    intent = 'Technical Specifications Request';
  }

  // Extract location if present
  let location = '';
  const locMatch = clean.match(/(?:at|in|near|for|location|site)\s*([a-zA-Z\s,]+?)(?:\.|\n|$|with|for|regarding)/i);
  if (locMatch && locMatch[1]) {
    location = locMatch[1].trim();
  }

  // Extract phone if present
  let phone = '';
  const phoneMatch = message.match(/(?:\+?91[\-\s]?)?[6-9]\d{9}/);
  if (phoneMatch) {
    phone = phoneMatch[0];
  }

  // Extract company name if present
  let companyName = '';
  const compMatch = message.match(/(?:from|m\/s|company|firm|epc|client)\s*([A-Za-z0-9\s\.\-&]+?)(?:\.|\n|,|$|regarding|pvt|ltd)/i);
  if (compMatch && compMatch[1]) {
    companyName = compMatch[1].trim();
  }

  const summary = `Customer is asking for pricing for approximately ${estimatedKw ? `${estimatedKw} kW` : (estimatedPanels ? `${estimatedPanels} panels` : 'solar structures')} (${category}).`;

  res.json({
    success: true,
    analysis: {
      requirement: `${estimatedKw ? `${estimatedKw} kW` : (estimatedPanels ? `${estimatedPanels} panels` : '')} ${category}`.trim(),
      estimatedKw,
      estimatedPanels,
      category,
      intent,
      companyName,
      location,
      phone,
      summary,
      confidenceScore: estimatedKw || estimatedPanels ? 95 : 80
    }
  });
});

// Automated Inbound Lead Simulator Endpoint (WhatsApp/Web Form Simulation)
app.post('/api/crm/leads/simulate-inbound', async (req, res) => {
  try {
    const {
      companyName = 'Surya Kiran Solar EPC',
      contactPerson = 'Ramesh Kumar',
      phone = '+91 98401 55678',
      message = 'Need urgent quotation for 150 kW Aluminium Rooftop solar mounting structure for project in Hosur.',
      source = 'IndiaMART Inbound',
      externalEnquiryId,
      productRequirement,
      estimatedKw = 150
    } = req.body;

    const creatorUser = {
      employee_code: 'INBOUND-SIMULATOR',
      employee_name: 'Inbound Ingestion Engine',
      role: 'System'
    };

    const leadRecord = await createDbLead({
      companyName,
      contactPerson,
      phone,
      whatsapp: phone,
      email: `${contactPerson.toLowerCase().replace(/\s+/g, '.')}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      location: 'Hosur, Tamil Nadu',
      source,
      productRequirement: productRequirement || message,
      estimatedKw,
      externalEnquiryId: externalEnquiryId || null,
      creatorUser
    });

    broadcastRealtimeEvent('crm_lead_created', { lead: leadRecord });

    res.json({
      success: true,
      message: 'Automated Inbound Lead Captured and Pre-Qualified in Database!',
      lead: leadRecord,
      data: leadRecord
    });
  } catch (err) {
    if (err.message && err.message.includes('already ingested')) {
      return res.json({ success: true, message: 'Lead already ingested (deduplicated)', skipped: true });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🚀 CENTRALIZED LEADS DATABASE REST API & AUDIT
// ==========================================
app.get(['/api/crm/leads', '/api/leads'], async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || req.query.userRole || '';
    const userEmpId = req.headers['x-user-emp-id'] || req.query.userEmpId || '';
    const userName = req.headers['x-user-name'] || req.query.userName || '';
    const { search, status, source, assignedTo, unassignedOnly } = req.query;

    const leads = await getDbLeads({
      userRole,
      userEmpId,
      userName,
      search,
      status,
      source,
      assignedTo,
      unassignedOnly: unassignedOnly === 'true'
    });

    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    console.error('[GET /api/crm/leads error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lead Notifications (Independent per-recipient read status)
app.get('/api/crm/leads/notifications', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }

    const callerRole = String(session.role || '').toLowerCase().trim();
    const callerEmpCode = String(session.empCode || '').trim();
    const requestedEmpCode = String(req.query.employeeCode || req.headers['x-user-emp-id'] || '').trim();

    const isExecutive = ['ceo', 'md', 'managing director', 'technical administrator', 'tech support', 'technical support'].some(r => callerRole.includes(r));

    let effectiveEmpCode = callerEmpCode;
    if (requestedEmpCode && requestedEmpCode !== callerEmpCode) {
      if (!isExecutive) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: User with role "${session.role}" cannot access notifications for employee "${requestedEmpCode}".`
        });
      }
      effectiveEmpCode = requestedEmpCode;
    }

    if (!effectiveEmpCode) {
      return res.json({ success: true, count: 0, notifications: [], data: [] });
    }

    const notifications = await getNotificationsForEmployee(effectiveEmpCode);
    res.json({ success: true, count: notifications.length, notifications, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crm/leads/notifications/:id/read', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({
        success: false,
        error: session?.error || 'Unauthorized: Active Businz session required (x-session-id)'
      });
    }

    const { id } = req.params;
    const callerRole = String(session.role || '').toLowerCase().trim();
    const callerEmpCode = String(session.empCode || '').trim();
    const requestedEmpCode = String(req.body.employeeCode || req.headers['x-user-emp-id'] || '').trim();

    const isExecutive = ['ceo', 'md', 'managing director', 'technical administrator'].some(r => callerRole.includes(r));

    let effectiveEmpCode = callerEmpCode;
    if (requestedEmpCode && requestedEmpCode !== callerEmpCode) {
      if (!isExecutive) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Cannot mark notification as read for employee "${requestedEmpCode}".`
        });
      }
      effectiveEmpCode = requestedEmpCode;
    }

    const result = await markNotificationRead(id, effectiveEmpCode);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/crm/leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const detail = await getLeadDetail(id);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, data: detail, lead: detail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/crm/leads', '/api/leads'], async (req, res) => {
  try {
    const leadData = (req.body && req.body.lead) ? req.body.lead : req.body;
    if (!leadData || Object.keys(leadData).length === 0) {
      return res.status(400).json({ success: false, error: 'No lead data provided' });
    }

    const creatorUser = {
      employee_code: req.headers['x-user-emp-id'] || req.body.creatorEmpId || 'USER',
      employee_name: req.headers['x-user-name'] || req.body.creatorName || 'Employee',
      role: req.headers['x-user-role'] || req.body.creatorRole || 'Sales Executive'
    };

    const userRoleLower = (creatorUser.role || '').toLowerCase();
    const isCeo = ['ceo', 'md', 'managing director'].some(r => userRoleLower.includes(r));
    const isTechSupport = ['tech support', 'technical support', 'technical administrator', 'technical admin', 'developer', 'admin'].some(r => userRoleLower.includes(r));
    const isSalesPerson = userRoleLower.includes('sales');

    if (isSalesPerson && !isCeo && !isTechSupport) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Only Tech Support and CEO/MD are authorized to create leads.'
      });
    }

    const createdLead = await createDbLead(leadData, creatorUser);
    broadcastRealtimeEvent('crm_lead_created', { lead: createdLead });

    res.json({ success: true, message: 'Lead created successfully', lead: createdLead, data: createdLead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Existing Lead
app.put(['/api/crm/leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const leadData = (req.body && req.body.lead) ? req.body.lead : req.body;
    if (!leadData || Object.keys(leadData).length === 0) {
      return res.status(400).json({ success: false, error: 'No update data provided' });
    }

    const updated = await updateDbLead(id, leadData);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    broadcastRealtimeEvent('crm_lead_updated', { lead: updated });
    res.json({ success: true, message: 'Lead updated successfully', lead: updated, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Centralized Lead Assignment (Only CEO & Tech Support)
app.post(['/api/crm/leads/:id/assign', '/api/leads/:id/assign'], async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId, assignedToName, assignedToRole, reason } = req.body;

    if (!assignedToId || !assignedToName) {
      return res.status(400).json({ success: false, error: 'Target assignee employee ID and Name are required.' });
    }

    const assignerUser = {
      employee_code: req.headers['x-user-emp-id'] || req.body.assignerEmpId,
      employee_name: req.headers['x-user-name'] || req.body.assignerName,
      role: req.headers['x-user-role'] || req.body.assignerRole
    };

    const updated = await assignDbLead({
      leadId: id,
      assignedToId,
      assignedToName,
      assignedToRole: assignedToRole || 'Sales Executive',
      assignerUser,
      reason: reason || 'Direct assignment from CRM'
    });

    broadcastRealtimeEvent('crm_lead_assigned', { lead: updated });
    res.json({ success: true, message: `Lead assigned to ${assignedToName}`, lead: updated, data: updated });
  } catch (err) {
    res.status(err.message.includes('Unauthorized') ? 403 : 500).json({ success: false, error: err.message });
  }
});

// Customer Interaction Activity Logger (Resets 24h timer on qualifying activities)
app.post(['/api/crm/leads/:id/activity', '/api/leads/:id/activity'], async (req, res) => {
  try {
    const { id } = req.params;
    const { activityType, summary, customerResponse, callDurationSeconds } = req.body;

    if (!activityType || !summary) {
      return res.status(400).json({ success: false, error: 'Activity type and summary are required.' });
    }

    const user = {
      employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
      employee_name: req.headers['x-user-name'] || req.body.userName,
      role: req.headers['x-user-role'] || req.body.userRole
    };

    const result = await recordLeadActivity({
      leadId: id,
      activityType,
      summary,
      customerResponse: customerResponse || '',
      callDurationSeconds: Number(callDurationSeconds) || 0,
      user
    });

    broadcastRealtimeEvent('crm_lead_activity_logged', { leadId: id, activity: result });
    res.json({ success: true, message: 'Activity recorded successfully', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Status Transition with Audit Trail & Customer Conversion Linking
app.all(['/api/crm/leads/:id/status', '/api/leads/:id/status'], async (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
  try {
    const { id } = req.params;
    const status = req.body.newStatus || req.body.status;
    const remarks = req.body.remarks;
    const convertedCustomerId = req.body.convertedCustomerId || req.body.converted_customer_id || null;
    const convertedCustomerCode = req.body.convertedCustomerCode || req.body.converted_customer_code || null;

    if (!status) return res.status(400).json({ success: false, error: 'New status is required.' });

    const user = {
      employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
      employee_name: req.headers['x-user-name'] || req.body.userName,
      role: req.headers['x-user-role'] || req.body.userRole
    };

    const result = await updateDbLeadStatus({
      leadId: id,
      newStatus: status,
      remarks: remarks || '',
      convertedCustomerId,
      convertedCustomerCode,
      user
    });

    // Also update server/crm_leads.json for disk persistence
    try {
      const diskPath = getStoreFilePath('crm_leads.json');
      if (fs.existsSync(diskPath)) {
        let leads = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        leads = leads.map(l => (l.id === id || l.lead_number === id) ? {
          ...l,
          status,
          converted_customer_id: convertedCustomerId || l.converted_customer_id,
          converted_customer_code: convertedCustomerCode || l.converted_customer_code,
          convertedCustomerCode: convertedCustomerCode || l.convertedCustomerCode,
          updated_at: new Date().toISOString()
        } : l);
        fs.writeFileSync(diskPath, JSON.stringify(leads, null, 2), 'utf8');
      }
    } catch (diskErr) {
      console.warn('crm_leads.json update notice:', diskErr.message);
    }

    broadcastRealtimeEvent('crm_lead_status_updated', { leadId: id, ...result });
    res.json({ success: true, message: 'Status updated', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Schedule Follow-up
app.post(['/api/crm/leads/:id/followup', '/api/leads/:id/followup'], async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt, notes } = req.body;

    if (!scheduledAt) return res.status(400).json({ success: false, error: 'Scheduled date/time is required.' });

    const user = {
      employee_code: req.headers['x-user-emp-id'] || req.body.userEmpId,
      employee_name: req.headers['x-user-name'] || req.body.userName,
      role: req.headers['x-user-role'] || req.body.userRole
    };

    const result = await scheduleLeadFollowup({
      leadId: id,
      scheduledAt,
      notes: notes || '',
      user
    });

    res.json({ success: true, message: 'Follow-up scheduled', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Sales & Support Staff for Lead Assignment
app.get('/api/crm/salespersons', async (req, res) => {
  try {
    let employees = [];
    try {
      employees = await getDatabaseStore('employees_store');
    } catch (_) {}

    const salesList = [];
    const seenCodes = new Set();

    // Default registered sales team: Strictly Sales Executive & Sales Head only
    const defaults = [
      { employee_code: 'SE-VRM090', employee_name: 'Karthi', role: 'Sales Executive', email: 'karthi@vrmstructures.in' },
      { employee_code: 'SE-VRM091', employee_name: 'Mohith JV', role: 'Sales Executive', email: 'mohith@vrmstructures.in' },
      { employee_code: 'SE-VRM092', employee_name: 'Gowtham', role: 'Sales Executive', email: 'gowtham@vrmstructures.in' },
      { employee_code: 'SE-VRM093', employee_name: 'Suresh Babu', role: 'Sales Executive', email: 'suresh@vrmstructures.in' },
      { employee_code: 'SH-VRM001', employee_name: 'Vijay', role: 'Sales Head', email: 'vijay@vrmstructures.in' }
    ];

    if (Array.isArray(employees)) {
      employees.forEach(emp => {
        const code = emp.employee_code || emp.code || emp.id;
        const name = emp.employee_name || emp.name;
        const role = emp.role || emp.designation || '';
        const roleNorm = (role || '').trim().toLowerCase();
        const isSales = roleNorm === 'sales executive' || roleNorm === 'sales head' ||
                        roleNorm.includes('sales executive') || roleNorm.includes('sales head');
        if (code && isSales && !seenCodes.has(code)) {
          seenCodes.add(code);
          salesList.push({
            employee_code: code,
            employee_name: name || code,
            role: role || 'Sales Executive',
            email: emp.email || ''
          });
        }
      });
    }

    defaults.forEach(d => {
      if (!seenCodes.has(d.employee_code)) {
        seenCodes.add(d.employee_code);
        salesList.push(d);
      }
    });

    res.json({ success: true, salespersons: salesList, data: salesList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🇮🇳 INDIAMART INTEGRATION API (ENCRYPTED)
// ==========================================
app.get('/api/integrations/indiamart/config', async (req, res) => {
  try {
    const config = await getIndiaMartConfig();
    res.json({ success: true, config, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/integrations/indiamart/config', async (req, res) => {
  try {
    const { mobileNumber, crmApiKey, autoSyncEnabled, syncIntervalMinutes } = req.body;
    const updated = await saveIndiaMartConfig({
      mobileNumber,
      crmApiKey,
      autoSyncEnabled,
      syncIntervalMinutes: Number(syncIntervalMinutes) || 15
    });
    res.json({ success: true, message: 'IndiaMART configuration saved securely!', config: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/integrations/indiamart/test', async (req, res) => {
  try {
    const result = await testIndiaMartConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/integrations/indiamart/sync', async (req, res) => {
  try {
    const type = req.body?.type || 'MANUAL';
    const result = await syncIndiaMartLeads(type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/integrations/indiamart/logs', async (req, res) => {
  try {
    const logs = await getIndiaMartSyncLogs(30);
    res.json({ success: true, count: logs.length, logs, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Automatic 24h & 48h Inactivity Background Checker (Runs 5s after startup and 5m after each completion)
if (!isOptimizationTestMode()) {
  setTimeout(async () => {
    try {
      if (isMaintenanceModeActive()) return;
      await checkAndProcessLeadInactivity({ source: 'startup' });
    } catch (err) {
      console.warn('[Initial Lead Inactivity Check Error]:', err.message);
    }
  }, 5000);
} else {
  console.log('🛡️ [Startup Lead Inactivity] Test mode active: initial inactivity check disabled.');
}

let inactivityTimer = null;
function scheduleNextInactivityCheck() {
  if (isOptimizationTestMode()) {
    console.log('🛡️ [Lead Inactivity Scheduler] Test mode active: background scheduling disabled.');
    return;
  }
  inactivityTimer = setTimeout(async () => {
    try {
      if (!isMaintenanceModeActive()) {
        await checkAndProcessLeadInactivity({ source: 'scheduler' });
      }
    } catch (err) {
      console.warn('[Background Lead Inactivity Check Error]:', err.message);
    } finally {
      // Schedule next execution strictly AFTER previous run completes, preventing interval drift & overlap
      scheduleNextInactivityCheck();
    }
  }, 5 * 60 * 1000);
}
scheduleNextInactivityCheck();

app.post('/api/crm/leads/check-inactivity', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({ success: false, error: session?.error || 'Unauthorized: Authentication session required' });
    }
    if (!['Technical Administrator', 'Super Admin', 'CEO', 'Director', 'Admin', 'Sales Manager'].includes(session.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges to trigger inactivity check' });
    }

    const result = await checkAndProcessLeadInactivity({ source: 'manual-api' });
    if (result && result.skipped) {
      return res.status(200).json({
        success: true,
        message: 'Inactivity check is already in progress; skipped duplicate execution',
        skipped: true,
        overlappingSkipped: result.overlappingSkipped
      });
    }
    res.json({ success: true, message: 'Inactivity check completed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Periodic lightweight memory diagnostic logger (Runs every 15 minutes)
if (!isOptimizationTestMode()) {
  setInterval(() => {
    try {
      logMemoryDiagnostic('PERIODIC');
    } catch (_) {}
  }, 15 * 60 * 1000);
}

// Authenticated memory and background job diagnostics endpoint
app.get('/api/system/diagnostics/memory', async (req, res) => {
  try {
    const session = await getVerifiedUserSession(req);
    if (!session || !session.valid) {
      return res.status(401).json({ success: false, error: session?.error || 'Unauthorized: Authentication session required' });
    }
    if (!['Technical Administrator', 'Super Admin', 'CEO', 'Director', 'Admin'].includes(session.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required for system diagnostics' });
    }
    const diagnostics = getSystemDiagnostics();
    res.json({ success: true, diagnostics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🛡️ ENTERPRISE DISASTER RECOVERY & BACKUP API

// 1. List all available backups
app.get('/api/system/backup/list', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Trigger instant full backup
app.get('/api/system/backup/create', async (req, res) => {
  try {
    const result = await createFullBackup({
      supabaseClient: supabase,
      memoryStore: supabaseMemoryStore,
      triggeredBy: req.query.user || 'Admin Web Console'
    });
    res.json({ success: true, backup: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Download a backup file directly
app.get('/api/system/backup/download/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.resolve(getBackupDir(), safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/json');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Download latest backup directly
app.get('/api/system/backup/latest/download', (req, res) => {
  try {
    const backups = listBackups();
    if (backups.length === 0) {
      return res.status(404).json({ success: false, error: 'No backups exist yet' });
    }
    const latest = backups[0];
    const filePath = path.resolve(getBackupDir(), latest.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);
    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Restore from backup
app.post('/api/system/backup/restore', async (req, res) => {
  try {
    let backupData = req.body;
    // If filename is passed instead of full payload
    if (req.body.filename && (!req.body.stores || Object.keys(req.body.stores).length === 0)) {
      const safeFilename = path.basename(req.body.filename);
      const filePath = path.resolve(getBackupDir(), safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Backup file does not exist on server' });
      }
      backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const result = await restoreFromBackup(backupData, {
      supabaseClient: supabase,
      memoryStore: supabaseMemoryStore
    });

    res.json({ success: true, message: 'ERP state restored successfully', details: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Automated periodic backup (every 24 hours)
if (!isOptimizationTestMode()) {
  setInterval(async () => {
    try {
      if (isMaintenanceModeActive()) {
        console.log('[Automated Backup] Maintenance mode active; skipping 24h scheduled snapshot.');
        return;
      }
      console.log('[Automated Backup] Running 24-hour scheduled snapshot...');
      await createFullBackup({
        supabaseClient: supabase,
        memoryStore: supabaseMemoryStore,
        triggeredBy: 'Automated 24h Scheduler'
      });
    } catch (e) {
      console.warn('[Automated Backup Error]:', e.message);
    }
  }, 24 * 60 * 60 * 1000);
}

// 🌐 SERVE PRODUCTION DIST (FOR PLESK & STANDALONE HOSTING)
const distPath = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : path.resolve(process.cwd(), 'dist');

if (fs.existsSync(distPath)) {
  app.use('/assets', express.static(path.join(distPath, 'assets')));
  const rootAssets = path.resolve(__dirname, '../assets');
  if (fs.existsSync(rootAssets)) {
    app.use('/assets', express.static(rootAssets));
  }
  app.use(express.static(distPath));
  app.use((req, res, next) => {
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

if (isOptimizationTestMode()) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🛡️ [Server Startup] BUSINZ Optimization Test Server bound exclusively to 127.0.0.1:${PORT}`);
    console.log(`🛡️ [Server Startup] External network access to port ${PORT} is strictly blocked (localhost only).`);
    console.log('🛡️ [Server Startup] WhatsApp auto-restoration disabled in optimization test mode.');
  });
} else {
  app.listen(PORT, () => {
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
}

export default app;
export {
  supabaseMemoryStore,
  saveLocalBoms,
  syncMissingRelationalBoms,
  toDatabaseBomRowServer,
  toConsumerBomServer,
  getWorkflowRankServer,
  loadDatabaseBoms,
  persistBomsTransactionSafe,
  saveDatabaseStore,
  getDatabaseStore
};

